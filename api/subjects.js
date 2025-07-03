const db = require('../firebase');

module.exports = async (req, res) => {
  try {
    const snapshot = await db.collection('mon_hoc').get();
    const data = [];
    snapshot.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    // Sắp xếp tên môn học từ a-z
    data.sort((a, b) => (a.ten_mon || "").localeCompare(b.ten_mon || ""));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
