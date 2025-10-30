/**
 * API: /api/tracuu
 * -------------------------------------
 * GET  /api/tracuu?op=captcha
 *    → Lấy ảnh captcha (base64) và cookie phiên làm việc
 *
 * POST /api/tracuu
 *    → Gửi form tra cứu kèm cookie và mã captcha
 *
 * Ghi chú:
 *  - Stateless (client giữ cookie), phù hợp môi trường Serverless (Vercel)
 *  - Nếu site đích có reCAPTCHA hoặc biện pháp chống bot nâng cao => có thể thất bại
 *  - Đảm bảo tuân thủ điều khoản sử dụng website đích
 */

const TARGET = process.env.TARGET_HOST || "https://www.csgt.vn";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) tracuu-proxy/1.1";

// Helper: tách cookie từ header "set-cookie"
function cookieStringFromSetCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const parts = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader.split(/,(?=\s*[^=;]+=[^;]+)/);
  return parts
    .map((p) => (p || "").split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

// Helper: fetch có timeout
async function fetchWithTimeout(url, opts = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ========== MAIN HANDLER ==========
export default async function handler(req, res) {
  try {
    // ======= [GET] /api/tracuu?op=captcha =======
    if (req.method === "GET") {
      const op = (req.query.op || "").toLowerCase();
      if (op !== "captcha") {
        return res
          .status(400)
          .json({ ok: false, error: "Thiếu hoặc sai tham số ?op=captcha" });
      }

      const captchaPath = "/lib/captcha/captcha.class.php";
      const captchaUrl = TARGET.replace(/\/$/, "") + captchaPath;

      const headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept:
          "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: TARGET + "/",
      };

      // Thử fetch captcha trực tiếp
      let imResp = await fetchWithTimeout(captchaUrl, { method: "GET", headers }, 15000);

      // Nếu lỗi, thử fetch root để lấy cookie rồi fetch lại captcha
      if (!imResp.ok) {
        try {
          const rootResp = await fetchWithTimeout(TARGET + "/", { method: "GET", headers }, 10000);
          const rootCookies = cookieStringFromSetCookie(rootResp.headers.get("set-cookie") || "");
          imResp = await fetchWithTimeout(
            captchaUrl,
            { method: "GET", headers: { ...headers, Cookie: rootCookies } },
            15000
          );

          if (!imResp.ok) {
            return res
              .status(502)
              .json({ ok: false, error: "Không lấy được captcha (lần 2)", status: imResp.status });
          }

          const imgBuf = Buffer.from(await imResp.arrayBuffer());
          const mime = imResp.headers.get("content-type") || "image/png";
          const setCookieHeader = imResp.headers.get("set-cookie") || "";
          const mergedCookies = cookieStringFromSetCookie(
            [rootCookies, setCookieHeader].filter(Boolean).join(",")
          );

          return res.status(200).json({
            ok: true,
            image: `data:${mime};base64,${imgBuf.toString("base64")}`,
            cookies: mergedCookies,
          });
        } catch (e) {
          return res
            .status(502)
            .json({ ok: false, error: "Không lấy được captcha: " + e.message });
        }
      }

      // Nếu fetch thành công lần đầu
      const buf = Buffer.from(await imResp.arrayBuffer());
      const mime = imResp.headers.get("content-type") || "image/png";
      const cookieHeader = cookieStringFromSetCookie(imResp.headers.get("set-cookie") || "");

      return res.status(200).json({
        ok: true,
        image: `data:${mime};base64,${buf.toString("base64")}`,
        cookies: cookieHeader,
      });
    }

    // ======= [POST] /api/tracuu =======
    if (req.method === "POST") {
      const { bsx, type = "1", captcha = "", cookies = "" } = req.body || {};
      if (!bsx) {
        return res.status(400).json({ ok: false, error: "Thiếu biển số xe (bsx)" });
      }

      // Tạo form data
      const params = new URLSearchParams({
        BienKS: bsx,
        Xe: String(type),
        captcha,
        ipClient: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString(),
        cUrl: "",
      });

      const postUrl = TARGET.replace(/\/$/, "") + "/?mod=contact&task=tracuu_post&ajax";
      const headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: TARGET + "/",
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      };
      if (cookies) headers["Cookie"] = cookies;

      const resp = await fetchWithTimeout(
        postUrl,
        { method: "POST", headers, body: params.toString() },
        20000
      );

      const text = await resp.text();
      const trimmed = text.trim();

      // Nếu phản hồi là JSON
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed.replace(/\s+/g, " "));
          return res.status(200).json({ ok: true, type: "json", data: parsed });
        } catch {
          /* Nếu lỗi parse thì trả HTML thô */
        }
      }

      // Trả về HTML thô
      return res.status(200).json({ ok: true, type: "html", html: text });
    }

    // ======= Method khác =======
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("api/tracuu error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Internal Server Error",
    });
  }
}
