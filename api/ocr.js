export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  try {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "sk-your-key-here") {
      res.status(500).json({
        error: "OPENAI_API_KEY is not set in Vercel Environment Variables. Add OPENAI_API_KEY, then redeploy."
      });
      return;
    }

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ error: "Expected multipart/form-data upload." });
      return;
    }

    const body = await readRequestBody(req, 20 * 1024 * 1024);
    const parts = parseMultipart(body, contentType);
    const files = parts.filter((part) => part.name === "file" && part.filename).slice(0, 2);
    const direction = parts.find((part) => part.name === "direction")?.text || "outgoing";

    if (!files.length) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const dataUrls = files.map((file) => `data:${file.contentType};base64,${file.data.toString("base64")}`);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildOpenAIRequest(direction, dataUrls))
    });

    const responseText = await response.text();
    const payload = parseJsonText(responseText);
    if (!response.ok || !payload) {
      res.status(response.ok ? 502 : response.status).json({
        error: payload?.error?.message || summarizeNonJson(responseText) || "OpenAI OCR failed."
      });
      return;
    }

    const outputText = collectOutputText(payload);
    const parsed = parseModelJson(outputText);
    res.status(200).json(normalizeOcrResult(parsed, direction, outputText));
  } catch (error) {
    res.status(500).json({ error: error.message || "OCR server error." });
  }
}

function buildOpenAIRequest(direction, dataUrls) {
  const prompt = promptForDirection(direction);
  const schema = schemaForDirection(direction);
  return {
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        ...dataUrls.map((image_url) => ({ type: "input_image", image_url }))
      ]
    }],
    text: { format: schema }
  };
}

function promptForDirection(direction) {
  if (direction === "income") return "Read this income proof, bank deposit screen, or transaction history. If multiple rows are visible, extract every row in transactions and return type transaction_batch. For each row return date, description, reference, amount, and direction income/expense/repayment. Use income for positive/credit/deposit rows and expense for debit/payment rows. Dates YYYY-MM-DD. JSON only.";
  if (direction === "repayment") return "Read this payment proof. Return recipient, date, reference, amount. Dates YYYY-MM-DD. JSON only.";
  if (direction === "expense") return "Read this expense or bank/e-wallet transaction history. If this is a Pinduoduo/拼多多 order detail screenshot, always return type supplier_invoice with supplier 拼多多, invoiceNo from 订单编号, date/orderTime from 下单时间 or 拼单时间, item product name, qty 1, unitPrice/total from 实付, and currency CNY when the amount uses ￥/¥/元/人民币. Otherwise, if multiple outgoing rows are visible, return every row in expenses. Use rightmost negative RM amounts as positive amounts. Dates YYYY-MM-DD. JSON only.";
  if (direction === "settlement") return "Read this settlement spreadsheet. Left side is Snackfactorie Enterprise goods, right side is Pasar Mini Zai Hin goods, bottom/right amount is owedAmount. Dates YYYY-MM-DD. JSON only.";
  return "Read this supplier invoice or online order detail. If it is a Pinduoduo/拼多多 order screenshot, supplier must be 拼多多, invoiceNo from 订单编号, date/orderTime from 下单时间 or 拼单时间, item product from product title, qty 1 if no quantity is visible, unitPrice/total from 实付, and currency CNY when the amount uses ￥/¥/元/人民币. Return supplier, invoiceNo, date, orderTime, currency, items with product qty unitPrice total, and total. Dates YYYY-MM-DD. JSON only.";
}

function schemaForDirection(direction) {
  if (direction === "income") return objectSchema("income_ocr", {
    type: { type: "string", enum: ["income", "transaction_batch"] },
    payer: nullableString(),
    date: nullableString(),
    reference: nullableString(),
    amount: { type: "number" },
    transactions: {
      type: "array",
      items: objectShape({
        date: nullableString(),
        description: nullableString(),
        reference: nullableString(),
        amount: { type: "number" },
        direction: { type: "string", enum: ["income", "expense", "repayment"] }
      })
    },
    rawText: nullableString()
  });
  if (direction === "repayment") return objectSchema("repayment_ocr", {
    type: { type: "string", enum: ["payment_proof"] },
    recipient: nullableString(),
    date: nullableString(),
    reference: nullableString(),
    amount: { type: "number" },
    rawText: nullableString()
  });
  if (direction === "expense") return objectSchema("expense_ocr", {
    type: { type: "string", enum: ["personal_expenses", "supplier_invoice"] },
    merchant: nullableString(),
    supplier: nullableString(),
    invoiceNo: nullableString(),
    date: nullableString(),
    orderTime: nullableString(),
    currency: nullableString(),
    category: nullableString(),
    amount: { type: "number" },
    total: { type: "number" },
    items: {
      type: "array",
      items: objectShape({
        product: nullableString(),
        qty: { type: "number" },
        unitPrice: { type: "number" },
        total: { type: "number" }
      })
    },
    expenses: {
      type: "array",
      items: objectShape({
        merchant: nullableString(),
        date: nullableString(),
        category: nullableString(),
        amount: { type: "number" },
        note: nullableString()
      })
    },
    rawText: nullableString()
  });
  if (direction === "settlement") return objectSchema("settlement_statement_ocr", {
    type: { type: "string", enum: ["settlement_statement"] },
    date: nullableString(),
    myCompany: nullableString(),
    otherCompany: nullableString(),
    myItems: { type: "array", items: settlementItemShape() },
    otherItems: { type: "array", items: settlementItemShape() },
    myTotal: { type: "number" },
    otherTotal: { type: "number" },
    owedAmount: { type: "number" },
    notes: nullableString(),
    rawText: nullableString()
  });
  return objectSchema("supplier_invoice_ocr", {
    type: { type: "string", enum: ["supplier_invoice"] },
    supplier: nullableString(),
    invoiceNo: nullableString(),
    date: nullableString(),
    orderTime: nullableString(),
    currency: nullableString(),
    items: {
      type: "array",
      items: objectShape({
        product: nullableString(),
        qty: { type: "number" },
        unitPrice: { type: "number" },
        total: { type: "number" }
      })
    },
    total: { type: "number" },
    rawText: nullableString()
  });
}

function objectSchema(name, properties) {
  return { type: "json_schema", name, strict: true, schema: objectShape(properties) };
}

function objectShape(properties) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties)
  };
}

function nullableString() {
  return { type: ["string", "null"] };
}

function settlementItemShape() {
  return objectShape({
    description: nullableString(),
    amount: { type: "number" },
    note: nullableString()
  });
}

function normalizeOcrResult(parsed, direction, outputText) {
  return { ...parsed, rawText: parsed.rawText || outputText };
}

function parseMultipart(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return [];
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let start = body.indexOf(boundary);
  while (start !== -1) {
    start += boundary.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), start);
    if (headerEnd === -1) break;
    const headers = body.slice(start, headerEnd).toString("utf8");
    const dataStart = headerEnd + 4;
    let next = body.indexOf(boundary, dataStart);
    if (next === -1) break;
    let dataEnd = next;
    if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) dataEnd -= 2;
    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1] || "";
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
    const partContentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "text/plain";
    const data = body.slice(dataStart, dataEnd);
    parts.push({ name, filename, contentType: partContentType, data, text: data.toString("utf8") });
    start = next;
  }
  return parts;
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) reject(new Error("Upload is too large."));
      else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function collectOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || []).flatMap((item) => item.content || []).map((content) => content.text || "").join("\n").trim();
}

function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI did not return valid JSON.");
  }
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarizeNonJson(text) {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}
