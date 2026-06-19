export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb"
    }
  }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const path = String(body.path || "");
    const method = String(body.method || "GET").toUpperCase();
    const requestBody = body.body;
    const extraHeaders = body.headers || {};

    if (!path.startsWith("/") || path.includes("://")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(400).json({ error: "Invalid Supabase path." });
      return;
    }
    if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(405).json({ error: "Invalid Supabase method." });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(500).json({ error: "SUPABASE_URL or SUPABASE_ANON_KEY is not set." });
      return;
    }

    const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: req.headers.authorization || `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        ...extraHeaders
      },
      body: requestBody == null ? undefined : requestBody
    });

    const text = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(text);
  } catch (error) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(500).json({ error: error.message || "Supabase proxy failed." });
  }
}
