import katex from "katex";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Lấy mảng các chuỗi HTML gốc, mỗi phần tử là một nội dung hoặc đáp án từ Firebase
  const { htmls } = req.body;
  if (!Array.isArray(htmls)) {
    res.status(400).json({ error: "Missing htmls array" });
    return;
  }

  // Hàm tách tất cả LaTeX từ các thẻ <script type="math/tex">...</script> trong một chuỗi HTML
  function extractLatexArray(html) {
    if (!html || typeof html !== "string") return [];
    // Có thể có nhiều công thức trong 1 câu, ta trả về mảng (nếu chỉ lấy 1 thì lấy match[1])
    const regex = /<script[^>]*type="math\/tex"[^>]*>([\s\S]*?)<\/script>/g;
    const matches = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match[1]) matches.push(match[1].trim());
    }
    return matches;
  }

  // Với mỗi html, tách tất cả LaTeX, render từng cái, trả về html đã render
  const results = htmls.map((html) => {
    const latexArr = extractLatexArray(html);
    if (!latexArr.length) {
      return {
        htmls: [],
        latexArr: [],
        error: "No LaTeX found in input",
      };
    }
    const htmls = latexArr.map((latex) => {
      try {
        // Render KaTeX thành HTML (output: "html" là HTML, "mathml" là MathML, "htmlAndMathml" là cả hai)
        return katex.renderToString(latex, {
          output: "html",
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        return `<span style="color:red;">[Lỗi KaTeX: ${e.message}]</span>`;
      }
    });
    return {
      htmls,
      latexArr,
      error: "",
    };
  });

  res.status(200).json({ results });
}
