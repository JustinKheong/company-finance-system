import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
await loadEnvFile();
const port = Number(process.env.PORT || 4173);
const model = process.env.OPENAI_MODEL || "gpt-5.5";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (req.method === "POST" && pathname === "/api/ocr") {
      await handleOcr(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/config") {
      sendJson(res, 200, {
        hasApiKey: hasUsableApiKey(),
        model
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/config") {
      await handleSaveConfig(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/supabase-config") {
      sendJson(res, 200, {
        url: process.env.SUPABASE_URL || "",
        anonKey: process.env.SUPABASE_ANON_KEY || ""
      });
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}).listen(port, () => {
  console.log(`Finance OCR app running at http://localhost:${port}/`);
});

async function handleOcr(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!hasUsableApiKey()) {
    sendJson(res, 500, {
      error: "OPENAI_API_KEY is not set. Save your key in the page, then try OCR again."
    });
    return;
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    sendJson(res, 400, { error: "Expected multipart/form-data upload." });
    return;
  }

  const body = await readRequestBody(req, 20 * 1024 * 1024);
  const parts = parseMultipart(body, contentType);
  const files = parts.filter((part) => part.name === "file" && part.filename).slice(0, 2);
  const direction = parts.find((part) => part.name === "direction")?.text || "outgoing";

  if (!files.length) {
    sendJson(res, 400, { error: "No file uploaded." });
    return;
  }

  if (files.some((file) => !file.contentType.startsWith("image/"))) {
    sendJson(res, 400, { error: "Please upload an image file for OCR." });
    return;
  }

  const dataUrls = files.map((file) => `data:${file.contentType};base64,${file.data.toString("base64")}`);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildOpenAIRequest(direction, dataUrls))
  });

  const responseText = await response.text();
  const payload = parseJsonText(responseText);
  if (!response.ok) {
    sendJson(res, response.status, {
      error: payload?.error?.message || `OpenAI OCR failed. ${summarizeNonJson(responseText)}`
    });
    return;
  }
  if (!payload) {
    sendJson(res, 502, { error: `OpenAI did not return JSON. ${summarizeNonJson(responseText)}` });
    return;
  }

  const outputText = collectOutputText(payload);
  const parsed = parseModelJson(outputText);
  sendJson(res, 200, normalizeOcrResult(parsed, direction, outputText));
}

async function handleSaveConfig(req, res) {
  const body = await readRequestBody(req, 64 * 1024);
  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    sendJson(res, 400, { error: "Invalid JSON." });
    return;
  }

  const apiKey = String(payload.apiKey || "").trim();
  const requestedModel = String(payload.model || model || "gpt-5.5").trim();

  if (!apiKey.startsWith("sk-")) {
    sendJson(res, 400, { error: "API key should start with sk-." });
    return;
  }

  const envText = [
    `OPENAI_API_KEY=${apiKey}`,
    `OPENAI_MODEL=${requestedModel}`,
    `PORT=${port}`,
    ""
  ].join("\n");

  await writeFile(join(rootDir, "openai-config.env"), envText, "utf8");
  process.env.OPENAI_API_KEY = apiKey;
  process.env.OPENAI_MODEL = requestedModel;
  sendJson(res, 200, { ok: true, hasApiKey: true, model: requestedModel });
}

function buildOpenAIRequest(direction, dataUrls) {
  const isIncome = direction === "income";
  const isRepayment = direction === "repayment";
  const isExpense = direction === "expense";
  const isSettlement = direction === "settlement";
  const prompt = isSettlement ? settlementPrompt() : isRepayment ? repaymentPrompt() : isExpense ? expensePrompt() : isIncome ? incomePrompt() : supplierInvoicePrompt();
  const schema = isSettlement ? settlementSchema() : isRepayment ? repaymentSchema() : isExpense ? expenseSchema() : isIncome ? incomeSchema() : supplierInvoiceSchema();
  return {
    model,
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: prompt
        },
        ...dataUrls.map((dataUrl) => ({
          type: "input_image",
          image_url: dataUrl
        }))
      ]
    }],
    text: {
      format: schema
    }
  };
}

function supplierInvoicePrompt() {
  return [
    "Read the uploaded supplier invoice image or images for a Malaysian small business finance system.",
    "If there are two images, treat them as parts/pages of the same order unless they clearly show unrelated documents.",
    "Return only the supplier invoice data.",
    "Extract supplier name, invoice number, invoice date, product line items, quantities, unit prices, line totals, and grand total.",
    "Dates must be YYYY-MM-DD. Amounts must be numbers without currency symbols.",
    "If a field is not visible, use null for strings and 0 for numbers.",
    "Do not invent products or prices."
  ].join(" ");
}

function incomePrompt() {
  return [
    "Read the uploaded income or payment received proof image or images for a Malaysian small business finance system.",
    "If there are two images, combine visible details from both images into one record.",
    "Return payer/customer, date, reference number, and amount received.",
    "Dates must be YYYY-MM-DD. Amounts must be numbers without currency symbols.",
    "If a field is not visible, use null for strings and 0 for numbers."
  ].join(" ");
}

function repaymentPrompt() {
  return [
    "Read the uploaded payment proof or repayment screenshot image or images for a Malaysian small business finance system.",
    "If there are two images, combine visible details from both images into one payment record.",
    "Return recipient/payee, payment date, reference number, and payment amount.",
    "Dates must be YYYY-MM-DD. Amounts must be numbers without currency symbols.",
    "If a field is not visible, use null for strings and 0 for numbers."
  ].join(" ");
}

function expensePrompt() {
  return [
    "Read the uploaded company/personal expense receipt, transaction history, or e-wallet/bank history image for a Malaysian small business finance system.",
    "If the image shows multiple transactions, extract every visible outgoing expense row separately.",
    "For bank statement rows, use the transaction description/payee as merchant, the visible transaction date as date, and the rightmost red/negative RM amount as the expense amount.",
    "Return negative outgoing amounts as positive numbers without currency symbols.",
    "If the row is a transfer to Touch 'n Go or eWallet, keep the merchant as Touch 'n Go or the visible recipient/name.",
    "Return merchant/payee, date, category, and amount for each row.",
    "Use short categories such as phone, toll, software, meal, petrol, parking, transport, water bill, electricity, packaging, rental, or other.",
    "Dates must be YYYY-MM-DD. Amounts must be numbers without currency symbols.",
    "If a field is not visible, use null for strings and 0 for numbers."
  ].join(" ");
}

function settlementPrompt() {
  return [
    "Read this settlement spreadsheet or table screenshot for a Malaysian small business.",
    "The left side represents goods/items taken by my company. My company is Snackfactorie Enterprise unless the image clearly states another name.",
    "The right side represents goods/items taken by the other company. The other company is Pasar Mini Zai Hin unless the image clearly states another name.",
    "The far right or bottom-right amount is the total amount owed.",
    "Use the visible date from the table and return it as YYYY-MM-DD.",
    "Extract rows for my side and the other side. Use the visible description/reference/date/note as description or note, and visible numeric amounts as amount.",
    "Return totals for my side, other side, and owed amount. Amounts must be numbers without currency symbols.",
    "Do not invent rows. If a side has no visible rows, return an empty array."
  ].join(" ");
}

function supplierInvoiceSchema() {
  return {
    type: "json_schema",
    name: "supplier_invoice_ocr",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["supplier_invoice"] },
        supplier: { type: ["string", "null"] },
        invoiceNo: { type: ["string", "null"] },
        date: { type: ["string", "null"] },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              product: { type: ["string", "null"] },
              qty: { type: "number" },
              unitPrice: { type: "number" },
              total: { type: "number" }
            },
            required: ["product", "qty", "unitPrice", "total"]
          }
        },
        total: { type: "number" },
        rawText: { type: ["string", "null"] }
      },
      required: ["type", "supplier", "invoiceNo", "date", "items", "total", "rawText"]
    }
  };
}

function incomeSchema() {
  return {
    type: "json_schema",
    name: "income_ocr",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["income"] },
        payer: { type: ["string", "null"] },
        date: { type: ["string", "null"] },
        reference: { type: ["string", "null"] },
        amount: { type: "number" },
        rawText: { type: ["string", "null"] }
      },
      required: ["type", "payer", "date", "reference", "amount", "rawText"]
    }
  };
}

function repaymentSchema() {
  return {
    type: "json_schema",
    name: "repayment_ocr",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["payment_proof"] },
        recipient: { type: ["string", "null"] },
        date: { type: ["string", "null"] },
        reference: { type: ["string", "null"] },
        amount: { type: "number" },
        rawText: { type: ["string", "null"] }
      },
      required: ["type", "recipient", "date", "reference", "amount", "rawText"]
    }
  };
}

function expenseSchema() {
  const expenseItemSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      merchant: { type: ["string", "null"] },
      date: { type: ["string", "null"] },
      category: { type: ["string", "null"] },
      amount: { type: "number" },
      note: { type: ["string", "null"] }
    },
    required: ["merchant", "date", "category", "amount", "note"]
  };
  return {
    type: "json_schema",
    name: "expense_ocr",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["personal_expenses"] },
        merchant: { type: ["string", "null"] },
        date: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        amount: { type: "number" },
        expenses: { type: "array", items: expenseItemSchema },
        rawText: { type: ["string", "null"] }
      },
      required: ["type", "merchant", "date", "category", "amount", "expenses", "rawText"]
    }
  };
}

function settlementSchema() {
  const itemSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      description: { type: ["string", "null"] },
      amount: { type: "number" },
      note: { type: ["string", "null"] }
    },
    required: ["description", "amount", "note"]
  };
  return {
    type: "json_schema",
    name: "settlement_statement_ocr",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["settlement_statement"] },
        date: { type: ["string", "null"] },
        myCompany: { type: ["string", "null"] },
        otherCompany: { type: ["string", "null"] },
        myItems: { type: "array", items: itemSchema },
        otherItems: { type: "array", items: itemSchema },
        myTotal: { type: "number" },
        otherTotal: { type: "number" },
        owedAmount: { type: "number" },
        notes: { type: ["string", "null"] },
        rawText: { type: ["string", "null"] }
      },
      required: ["type", "date", "myCompany", "otherCompany", "myItems", "otherItems", "myTotal", "otherTotal", "owedAmount", "notes", "rawText"]
    }
  };
}

function normalizeOcrResult(parsed, direction, outputText) {
  if (direction === "settlement") {
    return {
      type: "settlement_statement",
      date: parsed.date || new Date().toISOString().slice(0, 10),
      myCompany: parsed.myCompany || "Snackfactorie Enterprise",
      otherCompany: parsed.otherCompany || "Pasar Mini Zai Hin",
      myItems: Array.isArray(parsed.myItems) ? parsed.myItems.map(normalizeSettlementItem) : [],
      otherItems: Array.isArray(parsed.otherItems) ? parsed.otherItems.map(normalizeSettlementItem) : [],
      myTotal: Number(parsed.myTotal || 0),
      otherTotal: Number(parsed.otherTotal || 0),
      owedAmount: Number(parsed.owedAmount || 0),
      notes: parsed.notes || "",
      rawText: parsed.rawText || outputText
    };
  }

  if (direction === "expense") {
    const expenses = Array.isArray(parsed.expenses)
      ? parsed.expenses.map(normalizeExpenseItem).filter((item) => item.amount > 0)
      : [];
    const totalAmount = expenses.length
      ? expenses.reduce((sum, item) => sum + item.amount, 0)
      : Number(parsed.amount || 0);
    return {
      type: expenses.length > 1 ? "personal_expenses_batch" : "personal_expenses",
      merchant: parsed.merchant || "Unknown Merchant",
      date: parsed.date || new Date().toISOString().slice(0, 10),
      category: parsed.category || "其他",
      amount: totalAmount,
      expenses,
      rawText: parsed.rawText || outputText
    };
  }

  if (direction === "repayment") {
    return {
      type: "payment_proof",
      recipient: parsed.recipient || "Unknown Recipient",
      date: parsed.date || new Date().toISOString().slice(0, 10),
      reference: parsed.reference || "-",
      amount: Number(parsed.amount || 0),
      matchedInvoiceId: null,
      rawText: parsed.rawText || outputText
    };
  }

  if (direction === "income") {
    return {
      type: "income",
      payer: parsed.payer || "Unknown Payer",
      date: parsed.date || new Date().toISOString().slice(0, 10),
      reference: parsed.reference || "-",
      amount: Number(parsed.amount || 0),
      rawText: parsed.rawText || outputText
    };
  }

  return {
    type: "supplier_invoice",
    supplier: parsed.supplier || "Unknown Supplier",
    invoiceNo: parsed.invoiceNo || `INV-${Date.now()}`,
    date: parsed.date || new Date().toISOString().slice(0, 10),
    items: Array.isArray(parsed.items)
      ? parsed.items.map((item) => ({
          product: item.product || "Unknown Product",
          qty: Number(item.qty || 0),
          unitPrice: Number(item.unitPrice || 0),
          total: Number(item.total || 0)
        }))
      : [],
    total: Number(parsed.total || 0),
    paid: 0,
    status: "Unpaid",
    rawText: parsed.rawText || outputText
  };
}

function normalizeSettlementItem(item) {
  return {
    description: item.description || "-",
    amount: Number(item.amount || 0),
    note: item.note || ""
  };
}

function normalizeExpenseItem(item) {
  return {
    merchant: item.merchant || "Unknown Merchant",
    date: item.date || new Date().toISOString().slice(0, 10),
    category: item.category || "其他",
    amount: Number(item.amount || 0),
    note: item.note || ""
  };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    if (req.method !== "HEAD") res.end(data);
    else res.end();
  } catch {
    sendText(res, 404, "Not found");
  }
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Upload too large. Maximum is 12MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
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
    let dataStart = headerEnd + 4;
    let next = body.indexOf(boundary, dataStart);
    if (next === -1) break;
    let dataEnd = next;
    if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) dataEnd -= 2;

    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1] || "";
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
    const partContentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "text/plain";
    const data = body.slice(dataStart, dataEnd);

    parts.push({
      name,
      filename,
      contentType: partContentType,
      data,
      text: data.toString("utf8")
    });

    start = next;
  }

  return parts;
}

function collectOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  const texts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.text) texts.push(content.text);
    }
  }
  return texts.join("\n").trim();
}

function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OCR returned no JSON.");
    return JSON.parse(match[0]);
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
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function loadEnvFile() {
  await loadOneEnvFile(".env", false);
  await loadOneEnvFile("openai-config.env", true);
}

async function loadOneEnvFile(filename, override) {
  try {
    const envText = await readFile(join(rootDir, filename), "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (key && (override || process.env[key] === undefined || isPlaceholderKey(process.env[key]))) {
        process.env[key] = value;
      }
    }
  } catch {
    // Local env files are optional; environment variables still work.
  }
}

function hasUsableApiKey() {
  return Boolean(process.env.OPENAI_API_KEY && !isPlaceholderKey(process.env.OPENAI_API_KEY));
}

function isPlaceholderKey(value) {
  return !value || value === "sk-your-key-here" || value.includes("your-key");
}
