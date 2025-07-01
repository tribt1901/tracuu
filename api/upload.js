const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Lấy thông tin từ biến môi trường
  const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
  const FOLDER_ID = process.env.GDRIVE_FOLDER_ID;

  const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID, CLIENT_SECRET
  );
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  // Parse form data
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });
    const file = files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    try {
      const result = await drive.files.create({
        requestBody: {
          name: file.originalFilename,
          parents: [FOLDER_ID],
        },
        media: {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.filepath),
        },
        fields: 'id',
      });
      const fileId = result.data.id;
      const viewUrl = `https://drive.google.com/uc?id=${fileId}`;
      res.status(200).json({ url: viewUrl, fileId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};
