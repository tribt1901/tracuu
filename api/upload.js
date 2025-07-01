const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');

// Đọc biến môi trường từ Vercel dashboard
const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID;

// Tắt bodyParser mặc định của Vercel để xử lý multipart form
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

// Hàm xác thực Google Drive
function getDriveService() {
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oAuth2Client });
}

// Hàm xử lý upload
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Dùng formidable để parse form data
  const form = formidable({ multiples: false });
  form.parse(req, async function (err, fields, files) {
    if (err) {
      res.status(500).json({ error: 'Error parsing form data' });
      return;
    }
    if (!files.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const file = files.file;
    const filePath = file.filepath || file.path; // formidable v2+ dùng filepath

    try {
      const drive = getDriveService();

      const fileMeta = {
        name: file.originalFilename || file.name,
        parents: [FOLDER_ID]
      };
      const media = {
        mimeType: file.mimetype || file.type,
        body: fs.createReadStream(filePath)
      };
      const response = await drive.files.create({
        resource: fileMeta,
        media: media,
        fields: 'id'
      });

      const fileId = response.data.id;

      // Tạo link xem ảnh (nếu là ảnh) hoặc link download file
      const fileUrl = `https://drive.google.com/uc?id=${fileId}`;

      res.status(200).json({ url: fileUrl, fileId });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Error uploading file to Google Drive' });
    } finally {
      // Xóa file tạm sau khi upload (nếu có)
      if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    }
  });
};
