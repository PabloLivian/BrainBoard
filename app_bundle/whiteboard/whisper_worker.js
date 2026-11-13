// Transcripción de voz local con Whisper (Transformers.js + ONNX Runtime en WebAssembly).
// Corre en un worker para no congelar la app mientras transcribe. El modelo se descarga de Hugging Face
// la primera vez y queda en la caché de la app; el audio no sale del ordenador.

// Electron da `process` de Node también a los workers: Transformers.js creería que está en Node y buscaría
// onnxruntime-node, que no va en la app. Se oculta antes de cargar la librería (por eso el import es dinámico).
try { delete globalThis.process; } catch (e) { }
if (typeof process !== 'undefined') globalThis.process = undefined;

const MODEL = 'onnx-community/whisper-base';

const libPromise = import('../vendor/transformers/transformers.min.js').then(({ pipeline, env }) => {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.wasmPaths = new URL('../vendor/transformers/', import.meta.url).href;
  // La página no está aislada entre orígenes: sin memoria compartida, un solo hilo
  env.backends.onnx.wasm.numThreads = 1;
  return pipeline;
});

let asrPromise = null;

async function getTranscriber(onProgress) {
  if (!asrPromise) {
    asrPromise = libPromise.then(pipeline => pipeline('automatic-speech-recognition', MODEL, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: onProgress
    }));
  }
  return asrPromise;
}

// El manejador se pone al momento para no perder mensajes mientras carga la librería
self.onmessage = async (e) => {
  const { id, audio } = e.data || {};
  try {
    const transcriber = await getTranscriber((p) => self.postMessage({ type: 'progress', id, progress: p }));
    if (!audio) {
      self.postMessage({ type: 'ready', id });
      return;
    }
    const out = await transcriber(audio, { language: 'spanish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
    const text = Array.isArray(out) ? out.map(o => o.text).join(' ') : out?.text;
    self.postMessage({ type: 'result', id, text: String(text || '').trim() });
  } catch (err) {
    asrPromise = null;
    self.postMessage({ type: 'error', id, error: String(err?.message || err) });
  }
};
