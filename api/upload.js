const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');

const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const form = new formidable.IncomingForm({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Formidable parse error:', err);
      res.status(500).json({ error: 'Error parsing form data' });
      return;
    }

    let file = files.file;
    if (Array.isArray(file)) file = file[0];

    if (!file || !file.filepath) {
      res.status(400).json({ error: 'No file uploaded or file missing filepath' });
      return;
    }

    try {
      const fileStream = fs.createReadStream(file.filepath);

      // Upload file to Google Drive
      const response = await drive.files.create({
        requestBody: {
          name: file.originalFilename || file.newFilename || 'uploaded_file',
          parents: [FOLDER_ID],
        },
        media: {
          mimeType: file.mimetype || 'application/octet-stream',
          body: fileStream,
        },
        fields: 'id,webViewLink,webContentLink',
      });

      // Make the file public
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Clean up temporary file
      fs.unlink(file.filepath, () => {});

      // Prepare the image link (webContentLink is best for <img src>)
      const imageUrl = response.data.webContentLink || `https://drive.google.com/uc?id=${response.data.id}`;

      // Log for debugging
      console.log('Upload response:', {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        directLink: `https://drive.google.com/uc?id=${response.data.id}`,
        imageUrl,
      });

      // Return a unified url field for the frontend
      res.status(200).json({
        url: imageUrl,
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        directLink: `https://drive.google.com/uc?id=${response.data.id}`,
      });
    } catch (error) {
      console.error('Upload error:', error, error.stack);
      res.status(500).json({
        error: error.message || 'Error uploading file to Google Drive',
        detail: error.stack,
      });
    }
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};
