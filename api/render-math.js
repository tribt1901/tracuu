import katex from "katex";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { latexArr } = req.body;
  if (!Array.isArray(latexArr)) {
    res.status(400).json({ error: "Missing latexArr array" });
    return;
  }
  const results = latexArr.map(latex => {
    if (!latex) return { error: "No LaTeX found", html: "", latex: "" };
    try {
      const rendered = katex.renderToString(latex, { output: "html", throwOnError: false, displayMode: true });
      return { html: rendered, latex };
    } catch (e) {
      return { error: e.message, html: "", latex };
    }
  });
  res.status(200).json({ results });
}
