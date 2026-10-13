const fs = require('fs');
const path = require('path');

async function run() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.title.includes('Brain Board') || t.url.includes('index.html'));

  if (!pageTarget) {
    console.error('Target not found:', targets);
    process.exit(1);
  }

  console.log('Connecting to:', pageTarget.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  ws.onopen = async () => {
    try {
      console.log('Connected! Enabling Page and Runtime...');
      await send('Page.enable');
      await send('Runtime.enable');

      console.log('Reloading page to get fresh bundle...');
      await send('Page.reload');

      // Esperar 2.5s a que recargue la página
      await new Promise(r => setTimeout(r, 2500));

      console.log('Reloading board items from DEV_AI.json and focusing RECURSOS section...');
      const evalResult = await send('Runtime.evaluate', {
        expression: `(async () => {
          try {
            const res = await fetch('../boards/DEV_AI.json');
            const data = await res.json();
            window.engine.items = data.items;
            // Asegurar que las miniaturas no se queden sin recargar
            window.engine.items.forEach(it => {
              if (it.imgElement) delete it.imgElement;
            });
            
            const cx = 9233;
            const cy = 5300;
            const zoom = 0.44;

            window.engine.camera.zoom = zoom;
            window.engine.camera.x = -cx;
            window.engine.camera.y = -cy;
            window.engine.render();

            if (typeof autoSaveBoardImmediately === 'function') {
              autoSaveBoardImmediately('dev_ai');
            }

            return {
              ok: true,
              cx, cy, zoom
            };
          } catch(e) {
            return { error: e.message };
          }
        })()`,
        awaitPromise: true,
        returnByValue: true
      });

      console.log('Evaluation result:', evalResult.result.value);

      // Esperar 2 segundos para que todas las imágenes del canvas carguen
      console.log('Waiting for images to render on canvas...');
      await new Promise(r => setTimeout(r, 2000));

      // Forzar un render extra
      await send('Runtime.evaluate', { expression: `window.engine.render();` });
      await new Promise(r => setTimeout(r, 500));

      console.log('Capturing screenshot...');
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      const imgBuffer = Buffer.from(screenshot.data, 'base64');

      const outPath = path.resolve('C:/Users/Usuario/.gemini/antigravity/brain/a3427221-a4fc-4f0f-98a1-61ca2f188d63/tarjetas_recursos_final_verificadas.png');
      fs.writeFileSync(outPath, imgBuffer);
      console.log('Screenshot saved to:', outPath);

      ws.close();
      process.exit(0);
    } catch (e) {
      console.error('Error during CDP run:', e);
      ws.close();
      process.exit(1);
    }
  };
}

run();
