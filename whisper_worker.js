// whisper_worker.js
// WebWorker cho offline transcription — Whisper.cpp Web build hoặc mô phỏng.

let engine = null;
let modelLoaded = false;

// Cấu hình: thay đổi nếu bạn build whisper web riêng
const WHISPER_JS_PATH = '/whisper/whisper.js';
const MODEL_URL = '/whisper/ggml-small.en.bin';

async function loadWhisperEngine(modelUrl) {
  postMessage({ type: 'progress', message: '🔄 Đang tải engine Whisper (WASM)...' });
  try {
    importScripts(WHISPER_JS_PATH);
    // Giả lập khởi tạo (nếu chưa có whisper.js)
    if (typeof Whisper === 'undefined') {
      postMessage({ type: 'error', message: 'Không tìm thấy whisper.js — cần build whisper.cpp web trước.' });
      throw new Error('Thiếu whisper.js');
    }

    const w = await Whisper.create({ modelUrl });
    engine = w;
    modelLoaded = true;
    postMessage({ type: 'ready', engine: 'whisper.cpp (WASM)' });
  } catch (e) {
    postMessage({ type: 'error', message: 'Lỗi khi tải engine: ' + e.message });
  }
}

async function transcribeAudio(int16Array, sampleRate) {
  if (!engine || !modelLoaded) {
    postMessage({ type: 'error', message: 'Model chưa sẵn sàng.' });
    return;
  }
  try {
    postMessage({ type: 'progress', message: '🎧 Đang nhận dạng...' });
    const text = await engine.transcribe(int16Array, sampleRate);
    postMessage({ type: 'result', text });
  } catch (err) {
    postMessage({ type: 'error', message: 'Transcribe error: ' + err.message });
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || !msg.cmd) return;
  if (msg.cmd === 'init') {
    await loadWhisperEngine(msg.modelUrl || MODEL_URL);
  } else if (msg.cmd === 'transcribe') {
    const audio = new Int16Array(msg.audioBuffer);
    await transcribeAudio(audio, msg.sampleRate);
  } else {
    postMessage({ type: 'error', message: 'Lệnh không hợp lệ: ' + msg.cmd });
  }
};
