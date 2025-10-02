// api/search.js (Vercel serverless)
const axios = require('axios');

const BEHAVIOR_BASE = 'https://behavior-score.kalapa.vn/api/v1';
const APP_KEY = process.env.KALAPA_APP_KEY || '24542112a8d3428b8c270102185dce71'; // tốt nhất set vào env

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { bsx, type } = req.body || {};
  if (!bsx) return res.status(400).json({ error: 'missing bsx' });

  try {
    // Body mẫu dự đoán: service "datasets/chunk" có thể nhận dataset_id, filters, limit...
    const dataset_id = req.cookies?.kalapa_dataset_id || `session-${Date.now()}`;

    const payload = {
      // đây là 1 payload mẫu — có thể server đòi khác, bạn cần kiểm tra response để điều chỉnh
      dataset_id,
      filters: { license_plate: bsx, vehicle_type: String(type) },
      limit: 20,
      cursor: null
    };

    const resp = await axios.post(`${BEHAVIOR_BASE}/datasets/chunk`, payload, {
      headers: {
        'Content-Type': 'application/json',
        // Thử đặt app_key ở header (tùy server)
        'x-app-key': APP_KEY,
        // hoặc 'Authorization': `Bearer ${APP_KEY}`,
      },
      timeout: 15000
    });

    // Trả về cho client
    return res.status(200).json(resp.data);
  } catch (err) {
    console.error('proxy error', err?.response?.status, err?.response?.data || err.message);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: err.message };
    return res.status(status).json({ error: 'backend_error', details: data });
  }
};
