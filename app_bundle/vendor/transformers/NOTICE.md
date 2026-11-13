# Terceros: transcripción de voz local (micrófono del Cerebro)

Archivos copiados tal cual de sus paquetes de npm, sin modificar:

| Archivo | Paquete | Versión | Licencia |
| :--- | :--- | :--- | :--- |
| `transformers.min.js` | `@huggingface/transformers` | 3.8.1 | Apache-2.0 (`LICENSE-transformers.js.txt`) |
| `ort-wasm-simd-threaded.jsep.mjs`, `ort-wasm-simd-threaded.jsep.wasm` | `onnxruntime-web` (incluido en Transformers.js) | 1.22.0-dev.20250409-89f8206ba4 | MIT (abajo) |

El modelo de voz (`onnx-community/whisper-base`, licencia MIT de OpenAI Whisper) no va en la app: se descarga de Hugging Face la primera vez que se usa el micrófono y queda guardado en la caché de la app. El audio se transcribe en el propio ordenador y no se envía a ningún sitio.

## Licencia de ONNX Runtime

MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
