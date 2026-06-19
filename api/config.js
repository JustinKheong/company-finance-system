export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    res.status(400).json({
      error: "Vercel production cannot save OPENAI_API_KEY from the browser. Add OPENAI_API_KEY in Vercel Project Settings > Environment Variables, then redeploy.",
      canSaveApiKey: false
    });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.status(200).json({
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    canSaveApiKey: false,
    runtime: "vercel"
  });
}
