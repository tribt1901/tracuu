import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export const config = {
  api: {
    bodyParser: false, // để upload file raw
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Lưu tạm file upload
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const tempFile = '/tmp/audio.mp3';
    fs.writeFileSync(tempFile, buffer);

    // Chạy whisper (giả sử đã cài sẵn whisper CPP/Python)
    exec(`whisper ${tempFile} --model small --language en --output_format txt`, (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({ error: stderr });
      }
      const transcript = fs.readFileSync(tempFile.replace('.mp3','.txt'),'utf-8');
      res.status(200).json({ text: transcript });
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
