// whisper_worker.js — WebWorker cho Whisper.cpp (WASM)
// Cần có thư mục /whisper chứa whisper.wasm, whisper.js và model (ggml-small.en.bin)
// Tham khảo: https://github.com/ggerganov/whisper.cpp/tree/master/examples/whisper.wasm

let whisper = null;
let modelLoaded = false;
let ctx = null;
let modelUrlGlobal = null;

self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    if (msg.cmd === 'init') {
      modelUrlGlobal = msg.modelUrl;
      postMessage({ type: 'progress', message: 'Khởi tạo Whisper WASM...' });
      await loadWhisper(modelUrlGlobal);
      modelLoaded = true;
      postMessage({ type: 'ready', engine: 'whisper.cpp-wasm' });

    } else if (msg.cmd === 'transcribe') {
      if (!modelLoaded || !ctx) {
        postMessage({ type: 'error', message: 'Model chưa sẵn sàng.' });
        return;
      }
      const int16 = new Int16Array(msg.audioBuffer);
      const sampleRate = msg.sampleRate || 16000;
      postMessage({ type: 'progress', message: 'Bắt đầu nhận dạng (' + int16.length + ' mẫu)...' });

      const text = await transcribe(int16, sampleRate);
      postMessage({ type: 'result', text });
    }
  } catch (err) {
    console.error(err);
    postMessage({ type: 'error', message: err.message || String(err) });
  }
};

async function loadWhisper(modelUrl) {
  postMessage({ type: 'progress', message: 'Tải thư viện whisper.js...' });

  // Tải whisper.cpp web build
  importScripts('/whisper/whisper.js');

  postMessage({ type: 'progress', message: 'Khởi tạo WASM engine...' });

  // WhisperFactory được export từ whisper.js
  whisper = await WhisperFactory.create({ 
    wasmPath: '/whisper/whisper.wasm',
    printProgress: (p) => postMessage({ type: 'progress', message: p })
  });

  postMessage({ type: 'progress', message: 'Đang tải model từ ' + modelUrl + ' ...' });
  ctx = await whisper.createContext({ modelUrl });

  if (!ctx) throw new Error('Không thể load model Whisper.');
  postMessage({ type: 'log', message: 'Đã load model Whisper thành công.' });
}

async function transcribe(int16Array, sampleRate) {
  postMessage({ type: 'progress', message: 'Đang xử lý audio...' });
  const result = await ctx.transcribe(int16Array, sampleRate);
  postMessage({ type: 'log', message: 'Nhận dạng hoàn tất.' });
  return result.text || '(Không có kết quả)';
}
