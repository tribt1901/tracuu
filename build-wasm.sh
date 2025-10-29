#!/bin/bash
set -e

# Clone repo whisper.cpp nếu chưa có
if [ ! -d "whisper.cpp" ]; then
  git clone https://github.com/ggerganov/whisper.cpp
fi

cd whisper.cpp

# Tạo thư mục build
mkdir -p build-wasm
cd build-wasm

# Cấu hình CMake với Emscripten
emcmake cmake .. -DWHISPER_WASM_SINGLE_FILE=ON

# Build
emmake make -j$(nproc)

# Copy file sang repo chính
cp whisper.wasm ../../public/wasm/
cp whisper.js ../../public/wasm/
