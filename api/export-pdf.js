const db = require('../firebase');
const PDFDocument = require('pdfkit');
const stream = require('stream');

module.exports = async (req, res) => {
  const subjectId = req.query.subject;
  if (!subjectId) {
    res.status(400).send('Missing subject');
    return;
  }
  try {
    // Lấy tên môn học
    const subDoc = await db.collection('mon_hoc').doc(subjectId).get();
    if (!subDoc.exists) return res.status(404).send('Subject not found');
    const tenMon = subDoc.data().ten_mon;

    // Lấy danh sách câu hỏi
    const snapshot = await db.collection('cau_hoi').where('mon_hoc_id', '==', subjectId).get();
    let list = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      const correct = d.lua_chon && d.dap_an_dung ? d.lua_chon[d.dap_an_dung] : "";
      list.push({ question: d.noi_dung, answer: correct });
    });
    // Sắp xếp câu hỏi từ a-z
    list.sort((a, b) => (a.question || "").localeCompare(b.question || ""));

    // Tạo PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="DeCuong_${tenMon.replace(/\s+/g,"_")}.pdf"`);

    // Ghi vào response
    doc.pipe(res);
    doc.fontSize(16).text(`Đề cương Môn "${tenMon}"`, { align: 'center' });
    doc.moveDown();

    // Vẽ bảng 2 cột
    doc.fontSize(12).text('Câu hỏi', 50, doc.y, { continued: true, width: 260, underline: true });
    doc.text('Đáp án đúng', 320, doc.y, { underline: true });
    doc.moveDown(0.5);

    list.forEach(item => {
      doc.font('Helvetica').fontSize(11)
        .text(item.question || '', 50, doc.y, { width: 260, continued: true })
        .text(item.answer || '', 320, doc.y);
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (e) {
    res.status(500).send(e.message);
  }
};
