/**
 * process-audio.js
 * =================
 * API xử lý file âm thanh (MP3/WAV) và gửi đến Google Gemini để tạo transcript.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // Bắt buộc khi dùng formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Thiếu GOOGLE_API_KEY trong biến môi trường.");
    }

    const form = new formidable.IncomingForm();
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const file = data.files?.audio;
    if (!file) {
      return res.status(400).json({ error: "Không có tệp âm thanh được gửi lên." });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const base64Audio = fileBuffer.toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
    });

    const result = await model.generateContent([
      "Hãy tạo transcript chi tiết cho đoạn âm thanh này:",
      {
        inlineData: {
          mimeType: "audio/mp3",
          data: base64Audio,
        },
      },
    ]);

    const response = await result.response;
    const transcript = response.text();

    return res.status(200).json({
      transcript,
      message: "Tạo transcript thành công.",
    });

  } catch (error) {
    console.error("Lỗi trong quá trình xử lý âm thanh:", error);
    return res.status(500).json({
      error: "Đã xảy ra lỗi trong máy chủ.",
      details: error.message,
    });
  }
}
