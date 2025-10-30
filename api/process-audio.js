/**
 * /api/process-audio.js
 * 
 * Serverless API trên Vercel – xử lý file MP3, tạo transcript bằng Google Gemini Pro.
 * 
 * Hướng dẫn:
 * 1. Đặt GOOGLE_API_KEY trong Environment Variables trên Vercel.
 * 2. Frontend (enghelper.html) gửi FormData có key 'audio' chứa file MP3.
 * 3. API trả về JSON dạng:
 *    { ok: true, transcript: "Nội dung transcript" }
 */

import fs from "fs";
import formidable from "formidable";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Cho phép upload file binary (formidable sẽ tự xử lý)
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // Chỉ cho phép POST
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ Thiếu GOOGLE_API_KEY trong môi trường!");
    return res.status(500).json({ error: "Server chưa cấu hình GOOGLE_API_KEY." });
  }

  // Khởi tạo SDK Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

  try {
    // Dùng formidable để đọc file upload
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Lỗi đọc form:", err);
        return res.status(500).json({ error: "Lỗi khi đọc dữ liệu upload." });
      }

      const audioFile = files.audio?.[0];
      if (!audioFile) {
        return res.status(400).json({ error: "Không tìm thấy file âm thanh (key 'audio')." });
      }

      try {
        // Đọc file vào buffer
        const audioBuffer = await fs.promises.readFile(audioFile.filepath);
        const audioBase64 = audioBuffer.toString("base64");

        // Gọi Gemini để xử lý âm thanh
        const prompt = "Hãy tạo transcript tiếng Anh chi tiết từ tệp âm thanh sau:";

        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: "audio/mp3",
              data: audioBase64
            }
          }
        ]);

        const response = await result.response;
        const transcript = response.text();

        return res.status(200).json({ ok: true, transcript });

      } catch (error) {
        console.error("Lỗi khi gọi Gemini API:", error);
        return res.status(500).json({
          error: "Không thể xử lý file âm thanh.",
          details: error.message
        });
      }
    });
  } catch (error) {
    console.error("Lỗi nghiêm trọng:", error);
    return res.status(500).json({ error: "Lỗi máy chủ nội bộ.", details: error.message });
  }
}
