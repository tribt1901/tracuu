/**
 * Vercel Serverless API: /api/tracuu
 *
 * Supports:
 *  - GET  /api/tracuu?op=captcha     -> fetch captcha image from target and return base64 + cookie string
 *  - POST /api/tracuu                 -> submit tra cứu form to target using cookie string returned earlier
 *
 * Usage (frontend on same Vercel deployment):
 *  1) GET  /api/tracuu?op=captcha
 *     Response:
 *     { ok: true, image: "data:image/png;base64,...", cookies: "PHPSESSID=xxx; other=yyy" }
 *
 *  2) POST /api/tracuu
 *     JSON body: { bsx: "30A12345", type: "1", captcha: "abcd", cookies: "PHPSESSID=xxx; other=yyy" }
 *     Response:
 *     - If target returns JSON-like string: { ok: true, type: 'json', data: ... }
 *     - If target returns HTML: { ok: true, type: 'html', html: "..." }
 *
 * Notes:
 *  - This implementation is "stateless" (no server-side memory). The client is responsible
 *    for holding the cookie string returned with the captcha and sending it back on submit.
 *  - This is a pragmatic approach for serverless environments (Vercel). It is not as robust
 *    as a CookieJar-backed server but avoids storing session state between invocations.
 *  - If the target uses reCAPTCHA or more advanced anti-bot, this flow will likely fail.
 *  - Make sure you comply with target site's terms of service and legal constraints.
 */

const TARGET = process.env.TARGET_HOST || 'https://www.csgt.vn';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) tracuu-proxy/1.0';

function cookieStringFromSetCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  // setCookieHeader may be a single string containing one Set-Cookie header,
  // or multiple comma-separated Set-Cookie headers (rare). Split carefully.
  // Try to split on comma only when it's followed by another cookie name (heuristic).
  const parts = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader.split(/,(?=\s*[^=;]+=[^;]+)/);
  const cookies = parts.map(p => (p || '').split(';')[0].trim()).filter(Boolean);
  return cookies.join('; ');
}

async function fetchWithTimeout(url, opts = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    // Only allow GET/POST
    if (req.method === 'GET') {
      const op = (req.query.op || '').toLowerCase();
      if (op !== 'captcha') {
        res.status(400).json({ ok: false, error: 'Invalid op. Use ?op=captcha' });
        return;
      }

      // Try to fetch captcha image directly.
      // Many targets expose captcha at a path like /lib/captcha/captcha.class.php
      // We'll try that path first; if not working, fallback to fetching root and scanning (not implemented).
      const captchaPath = '/lib/captcha/captcha.class.php';
      const captchaUrl = TARGET.replace(/\/$/, '') + captchaPath;

      // Initial HEAD/GET to target root may sometimes set cookies; optionally fetch root first.
      // We'll attempt direct captcha fetch and try to collect Set-Cookie headers from the response.
      const headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': TARGET + '/',
      };

      // Fetch captcha
      const imResp = await fetchWithTimeout(captchaUrl, { method: 'GET', headers }, 15000);

      if (!imResp.ok) {
        // Try fetching root page first to get a session cookie, then fetch captcha with that cookie
        try {
          const rootResp = await fetchWithTimeout(TARGET + '/', { method: 'GET', headers }, 10000);
          const setCookieRoot = rootResp.headers.get('set-cookie') || '';
          const cookieHeaderRoot = cookieStringFromSetCookie(setCookieRoot);
          const imResp2 = await fetchWithTimeout(captchaUrl, {
            method: 'GET',
            headers: { ...headers, Cookie: cookieHeaderRoot }
          }, 15000);
          if (!imResp2.ok) {
            res.status(502).json({ ok: false, error: 'Failed to fetch captcha (2)', status: imResp2.status });
            return;
          }
          const buf2 = Buffer.from(await imResp2.arrayBuffer());
          const mime2 = imResp2.headers.get('content-type') || 'image/png';
          const b64_2 = buf2.toString('base64');
          // combine cookies from root and captcha responses (if any)
          const scRoot = setCookieRoot;
          const scImg = imResp2.headers.get('set-cookie') || '';
          const cookieHeader = cookieStringFromSetCookie([scRoot, scImg].filter(Boolean).join(','));
          res.status(200).json({ ok: true, image: `data:${mime2};base64,${b64_2}`, cookies: cookieHeader });
          return;
        } catch (e) {
          res.status(502).json({ ok: false, error: 'Failed to fetch captcha: ' + e.message });
          return;
        }
      }

      // If initial captcha response ok:
      const buf = Buffer.from(await imResp.arrayBuffer());
      const mime = imResp.headers.get('content-type') || 'image/png';
      const setCookieHeader = imResp.headers.get('set-cookie') || '';
      const cookieHeader = cookieStringFromSetCookie(setCookieHeader);
      res.status(200).json({ ok: true, image: `data:${mime};base64,${buf.toString('base64')}`, cookies: cookieHeader });
      return;
    }

    if (req.method === 'POST') {
      // Expect JSON body
      const { bsx, type, captcha, cookies } = req.body || {};
      if (!bsx) {
        res.status(400).json({ ok: false, error: 'Missing bsx (biển số xe)' });
        return;
      }

      // Compose form data as application/x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append('BienKS', bsx);
      params.append('Xe', String(type || '1'));
      if (captcha) params.append('captcha', captcha);
      // Optional fields
      // ipClient: can't trust req.socket.remoteAddress behind some platforms; pass what you have
      const ipClient = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
      params.append('ipClient', ipClient);
      params.append('cUrl', '');

      const postUrl = TARGET.replace(/\/$/, '') + '/?mod=contact&task=tracuu_post&ajax';
      const headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': TARGET + '/',
      };
      if (cookies) headers['Cookie'] = cookies;

      const resp = await fetchWithTimeout(postUrl, { method: 'POST', headers, body: params.toString() }, 20000);

      // read text
      const text = await resp.text();

      // Some targets return JSON-like string with whitespace/newlines. Try parse.
      const trimmed = (text || '').trim();
      try {
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const parsed = JSON.parse(trimmed.replace(/\s+/g, ' '));
          res.status(200).json({ ok: true, type: 'json', data: parsed });
          return;
        }
      } catch (e) {
        // fallthrough to return raw HTML
      }

      // Return HTML result (client can parse)
      res.status(200).json({ ok: true, type: 'html', html: text });
      return;
    }

    // Method not allowed
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('api/tracuu error:', err && err.stack ? err.stack : err);
    res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
