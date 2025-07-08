import katex from "katex";

export default function handler(req, res) {
  // Nhận array các chuỗi HTML từ client
  const { htmls } = req.body;

  // Hàm tách latex từ HTML đã render MathJax
  function extractLatex(html) {
    // Regex lấy LaTeX trong <script type="math/tex">...</script>
    const match = html.match(/<script[^>]*type="math\/tex"[^>]*>([\s\S]*?)<\/script>/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return "";
  }

  // Render từng latex thành HTML tĩnh (SVG/HTML)
  const results = htmls.map(html => {
    const latex = extractLatex(html);
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
