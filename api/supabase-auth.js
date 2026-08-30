export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const path = String(body.path || "");
    const payload = body.body || {};

    if (!["/token?grant_type=password", "/token?grant_type=refresh_token", "/signup", "/resend"].includes(path)) {
      res.status(400).json({ error: "Invalid Supabase Auth path." });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      res.status(500).json({ error: "SUPABASE_URL or SUPABASE_ANON_KEY is not set." });
      return;
    }

    const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json; charset=utf-8";
    res.status(response.status);
    res.setHeader("Content-Type", contentType.includes("application/json") ? contentType : "application/json; charset=utf-8");
    if (contentType.includes("application/json")) {
      res.send(text || "{}");
    } else {
      res.json({ error: text || "Supabase Auth returned a non-JSON response." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || "Supabase Auth proxy failed." });
  }
}
