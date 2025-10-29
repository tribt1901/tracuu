// whisper.js
export default async function initWhisper(modelUrl) {
  const wasmModule = await WebAssembly.instantiateStreaming(fetch('whisper.wasm'));
  // giả lập API đơn giản
  return {
    transcribe: async (samples) => {
      // ở đây bạn dùng API WASM để chuyển samples → text
      // ví dụ: wasmModule.instance.exports.transcribe(...)
      // Trả về text tạm thời demo
      return "Transcription demo: chưa implement WASM thật.";
    }
  };
}
