import formidable from "formidable";
import fs from "fs";
import { TextServiceClient } from "@google/generative-ai"; // Google Gemini

// Vercel config: tắt bodyParser mặc định
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Chỉ cho phép POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Kiểm tra API key
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing API key" });
  }

  // Parse file audio
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Form parse error", details: err });

    try {
      const audioFile = files.audio; // frontend phải gửi field "audio"
      if (!audioFile) return res.status(400).json({ error: "Missing audio file" });

      // Đọc file audio thành buffer
      const audioBuffer = fs.readFileSync(audioFile.filepath);

      // Tạo client Gemini
      const client = new TextServiceClient({ apiKey });

      // Đây là ví dụ gọi Gemini; tuỳ API thật bạn chỉnh lại
      const response = await client.generateText({
        model: "gemini-text-1.0",
        prompt: `Transcribe the following audio to text: [binary audio data]`,
        // Trong thực tế bạn gửi audioBuffer hoặc upload audio theo Gemini docs
      });

      res.status(200).json({
        success: true,
        transcription: response.output_text || "No transcription returned",
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to process audio", details: e.message });
    }
  });
}
