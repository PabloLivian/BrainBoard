const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();

const steps = [
  {
    filename: 'step1_google_studio_create.png',
    title: 'Paso 1: Entrar en Google AI Studio y pulsar "Create API key"',
    html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: #131314; color: #e3e3e3; width: 960px; height: 560px; overflow: hidden; display: flex; flex-direction: column; }
  .top-nav { height: 54px; background: #1e1f20; border-bottom: 1px solid #333538; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
  .logo-area { display: flex; align-items: center; gap: 12px; }
  .sparkle-icon { width: 24px; height: 24px; background: linear-gradient(135deg, #4285f4, #9b51e0, #ea4335); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: white; }
  .logo-text { font-size: 16px; font-weight: 600; color: #f1f3f4; letter-spacing: 0.2px; }
  .user-badge { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #9aa0a6; }
  .avatar { width: 28px; height: 28px; border-radius: 50%; background: #4285f4; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; }
  
  .content { flex: 1; padding: 36px 48px; display: flex; flex-direction: column; gap: 24px; }
  .breadcrumb { font-size: 13px; color: #8ab4f8; display: flex; align-items: center; gap: 6px; }
  .header-row { display: flex; align-items: center; justify-content: space-between; }
  .title-group h1 { font-size: 26px; font-weight: 600; color: #f1f3f4; margin-bottom: 6px; }
  .title-group p { font-size: 14px; color: #9aa0a6; }
  
  .btn-create {
    background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 24px;
    font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;
    box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.35), 0 4px 12px rgba(0,0,0,0.4);
    animation: pulse 2s infinite;
  }
  .btn-create svg { width: 18px; height: 18px; fill: currentColor; }
  
  .keys-card { background: #1e1f20; border: 1px solid #333538; border-radius: 12px; overflow: hidden; margin-top: 10px; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid #333538; display: flex; justify-content: space-between; align-items: center; }
  .card-header-title { font-size: 14px; font-weight: 600; color: #e3e3e3; }
  .tier-tag { font-size: 11px; background: rgba(52, 168, 83, 0.15); color: #34a853; padding: 4px 10px; border-radius: 12px; font-weight: 600; border: 1px solid rgba(52, 168, 83, 0.3); }
  
  .table-row { padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #282a2c; font-size: 13px; color: #c4c7c5; }
  .table-row.head { background: #18191a; font-weight: 600; color: #9aa0a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  
  .step-callout {
    position: absolute; bottom: 28px; right: 48px; background: #0b57d0; color: #ffffff;
    padding: 10px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 16px rgba(11, 87, 208, 0.5); border: 1px solid #8ab4f8;
  }
</style>
</head>
<body>
  <div class="top-nav">
    <div class="logo-area">
      <div class="sparkle-icon">✦</div>
      <div class="logo-text">Google AI Studio</div>
    </div>
    <div class="user-badge">
      <span>aistudio.google.com/app/apikey</span>
      <div class="avatar">G</div>
    </div>
  </div>
  <div class="content">
    <div class="breadcrumb">Inicio <span>›</span> Configuración de desarrollador <span>›</span> Claves de API</div>
    <div class="header-row">
      <div class="title-group">
        <h1>Claves de API de Google Gemini</h1>
        <p>Autentica tus peticiones a Gemini 2.5 Flash de forma 100% gratuita y sin tarjeta.</p>
      </div>
      <button class="btn-create">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Crear clave de API (Create API key)
      </button>
    </div>
    
    <div class="keys-card">
      <div class="card-header">
        <span class="card-header-title">Tus claves de acceso activo</span>
        <span class="tier-tag">✓ Cuota Gratuita (Free Tier - 15 RPM / 1M Tokens)</span>
      </div>
      <div class="table-row head">
        <span style="flex: 2;">Nombre de la clave</span>
        <span style="flex: 2;">Proyecto Google Cloud</span>
        <span style="flex: 1.5;">Fecha de creación</span>
        <span style="flex: 1; text-align: right;">Acciones</span>
      </div>
      <div class="table-row">
        <span style="flex: 2; font-weight: 500; color: #8ab4f8;">🔑 BrainBoard-Gemini-Key</span>
        <span style="flex: 2; color: #9aa0a6;">BrainBoard Workspace (Default)</span>
        <span style="flex: 1.5; color: #9aa0a6;">Hoy, hace unos instantes</span>
        <span style="flex: 1; text-align: right; color: #8ab4f8;">Copiar / Editar</span>
      </div>
    </div>
  </div>
  <div class="step-callout">
    <span>PASO 1</span> · Pulsa en el botón azul "Crear clave de API"
  </div>
</body>
</html>
`
  },
  {
    filename: 'step2_create_key_project.png',
    title: 'Paso 2: Seleccionar "Crear clave de API en un proyecto nuevo"',
    html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: #0f1012; color: #e3e3e3; width: 960px; height: 560px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); }
  
  .modal {
    position: relative; z-index: 10; width: 620px; background: #1e1f20; border: 1px solid #383a3d;
    border-radius: 16px; box-shadow: 0 20px 48px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column;
  }
  .modal-header { padding: 22px 26px; border-bottom: 1px solid #2d2f31; display: flex; justify-content: space-between; align-items: center; }
  .modal-title { font-size: 19px; font-weight: 600; color: #f1f3f4; }
  
  .modal-body { padding: 26px; display: flex; flex-direction: column; gap: 20px; }
  .option-card {
    border: 2px solid #8ab4f8; background: rgba(138, 180, 248, 0.08); border-radius: 12px;
    padding: 16px 20px; display: flex; gap: 16px; align-items: flex-start; cursor: pointer;
    box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.25);
  }
  .option-radio { width: 20px; height: 20px; border-radius: 50%; border: 6px solid #8ab4f8; background: #1e1f20; margin-top: 2px; }
  .option-content h4 { font-size: 15px; font-weight: 600; color: #f1f3f4; margin-bottom: 4px; }
  .option-content p { font-size: 13px; color: #9aa0a6; line-height: 1.4; }
  
  .option-card-secondary {
    border: 1px solid #383a3d; background: #18191a; border-radius: 12px;
    padding: 16px 20px; display: flex; gap: 16px; align-items: flex-start; opacity: 0.7;
  }
  .option-radio-sec { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #5f6368; background: transparent; margin-top: 2px; }
  
  .info-pill {
    background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25);
    padding: 10px 14px; border-radius: 8px; font-size: 12px; color: #7dd3fc; line-height: 1.4;
  }
  
  .modal-footer { padding: 18px 26px; border-top: 1px solid #2d2f31; background: #18191a; display: flex; justify-content: flex-end; gap: 12px; }
  .btn-cancel { background: transparent; color: #9aa0a6; border: 1px solid #383a3d; padding: 10px 18px; border-radius: 20px; font-size: 13px; font-weight: 500; }
  .btn-confirm {
    background: #1a73e8; color: white; border: none; padding: 10px 22px; border-radius: 20px;
    font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(26,115,232,0.4);
  }
  
  .step-badge {
    position: absolute; top: 22px; right: 26px; background: #0b57d0; color: #ffffff;
    font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 12px; letter-spacing: 0.5px;
  }
</style>
</head>
<body>
  <div class="backdrop"></div>
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">Crear una clave de API nueva</div>
      <div class="step-badge">PASO 2</div>
    </div>
    <div class="modal-body">
      <div class="option-card">
        <div class="option-radio"></div>
        <div class="option-content">
          <h4>Crear clave de API en un proyecto nuevo (Recomendado)</h4>
          <p>Google generará automáticamente un espacio de trabajo gratuito para Brain Board en 3 segundos sin configurar nada más.</p>
        </div>
      </div>
      
      <div class="option-card-secondary">
        <div class="option-radio-sec"></div>
        <div class="option-content">
          <h4>Seleccionar un proyecto de Google Cloud existente</h4>
          <p>Para usuarios avanzados que deseen asociar su clave a un proyecto ya creado.</p>
        </div>
      </div>
      
      <div class="info-pill">
        ⚡ <strong>Gratis al 100%:</strong> Incluye acceso ilimitado a Gemini 2.5 Flash con capacidad de generación de apuntes, resúmenes e inserción de recursos.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel">Cancelar</button>
      <button class="btn-confirm">Crear clave en proyecto nuevo →</button>
    </div>
  </div>
</body>
</html>
`
  },
  {
    filename: 'step3_copy_apikey.png',
    title: 'Paso 3: Copiar la API Key generada (AIzaSy...)',
    html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: #0f1012; color: #e3e3e3; width: 960px; height: 560px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); }
  
  .modal {
    position: relative; z-index: 10; width: 640px; background: #1e1f20; border: 1px solid #383a3d;
    border-radius: 16px; box-shadow: 0 20px 48px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column;
  }
  .modal-header { padding: 22px 26px; border-bottom: 1px solid #2d2f31; display: flex; justify-content: space-between; align-items: center; }
  .modal-title-row { display: flex; align-items: center; gap: 12px; }
  .check-circle { width: 28px; height: 28px; border-radius: 50%; background: #34a853; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; }
  .modal-title { font-size: 19px; font-weight: 600; color: #f1f3f4; }
  
  .modal-body { padding: 26px; display: flex; flex-direction: column; gap: 20px; }
  .desc { font-size: 14px; color: #9aa0a6; line-height: 1.5; }
  
  .key-box-container {
    background: #141516; border: 1.5px solid #8ab4f8; border-radius: 12px;
    padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.2);
  }
  .key-value { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 15px; color: #a8c7fa; font-weight: 600; letter-spacing: 0.5px; }
  
  .btn-copy {
    background: #1a73e8; color: white; border: none; padding: 10px 20px; border-radius: 20px;
    font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;
    box-shadow: 0 2px 10px rgba(26,115,232,0.4);
  }
  
  .security-tip {
    display: flex; gap: 12px; background: rgba(234, 67, 53, 0.1); border: 1px solid rgba(234, 67, 53, 0.25);
    padding: 12px 16px; border-radius: 10px; font-size: 12px; color: #f28b82; line-height: 1.4;
  }
  
  .modal-footer { padding: 18px 26px; border-top: 1px solid #2d2f31; background: #18191a; display: flex; justify-content: flex-end; }
  .btn-done { background: #333538; color: #e3e3e3; border: none; padding: 10px 24px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  
  .step-badge {
    background: #0b57d0; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 12px; letter-spacing: 0.5px;
  }
</style>
</head>
<body>
  <div class="backdrop"></div>
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title-row">
        <div class="check-circle">✓</div>
        <div class="modal-title">¡Clave de API de Gemini creada!</div>
      </div>
      <div class="step-badge">PASO 3</div>
    </div>
    <div class="modal-body">
      <div class="desc">Copia tu clave de acceso. Ahora solo tienes que pegarla en la ventana de configuración de Brain Board.</div>
      
      <div class="key-box-container">
        <span class="key-value">AIzaSyD8m-9qXpL2kR4tVwYz7bNmQ1aC8eF3...</span>
        <button class="btn-copy">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar Clave
        </button>
      </div>
      
      <div class="security-tip">
        <span>🔒</span>
        <span>Esta clave es privada y reside exclusivamente en tu ordenador local. Brain Board no la comparte con ningún servidor externo.</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-done">Listo</button>
    </div>
  </div>
</body>
</html>
`
  },
  {
    filename: 'step4_brainboard_setup_connected.png',
    title: 'Paso 4: Pegar en Brain Board y pulsar "Guardar Configuración"',
    html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: #0c0f14; color: #f1f5f9; width: 960px; height: 560px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); }
  
  .settings-modal {
    position: relative; z-index: 10; width: 680px; background: #131722; border: 1px solid #232b3d;
    border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,0.8); overflow: hidden; display: flex; flex-direction: column;
  }
  .modal-header { padding: 18px 24px; border-bottom: 1px solid #1e2637; display: flex; justify-content: space-between; align-items: center; background: #161b26; }
  .header-title-box { display: flex; align-items: center; gap: 10px; }
  .brain-icon { width: 26px; height: 26px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 15px; border: 1px solid rgba(56, 189, 248, 0.3); }
  .header-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .step-badge { background: #0284c7; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 12px; }
  
  .modal-body { padding: 22px 24px; display: flex; flex-direction: column; gap: 16px; }
  
  .autodetect-bar {
    background: #182030; border: 1px solid #28354d; border-radius: 10px; padding: 10px 14px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .autodetect-status { font-size: 12px; color: #38bdf8; font-weight: 500; display: flex; align-items: center; gap: 6px; }
  
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 12px; font-weight: 600; color: #cbd5e1; display: flex; justify-content: space-between; }
  .select-box, .input-box {
    background: #0d1117; border: 1px solid #232b3d; border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: #f1f5f9; outline: none;
  }
  .input-box.with-key { border-color: #10b981; font-family: monospace; color: #6ee7b7; letter-spacing: 0.5px; }
  
  .test-status-box {
    background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #34d399; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
  }
  
  .modal-footer { padding: 16px 24px; border-top: 1px solid #1e2637; background: #0f131a; display: flex; justify-content: flex-end; gap: 12px; }
  .btn-cancel { background: transparent; color: #94a3b8; border: 1px solid #232b3d; padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; }
  .btn-save {
    background: #0284c7; color: white; border: none; padding: 9px 24px; border-radius: 8px;
    font-size: 13px; font-weight: 700; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.35), 0 4px 14px rgba(2,132,199,0.4);
  }
</style>
</head>
<body>
  <div class="backdrop"></div>
  <div class="settings-modal">
    <div class="modal-header">
      <div class="header-title-box">
        <div class="brain-icon">⚙️</div>
        <div class="header-title">Configurar Motor de Cerebro IA · Brain Board</div>
      </div>
      <div class="step-badge">PASO 4: CONECTADO</div>
    </div>
    <div class="modal-body">
      <div class="autodetect-bar">
        <div class="autodetect-status">✨ Gemini 2.5 Flash (Gratis) activado por defecto</div>
        <span style="font-size: 11px; color: #94a3b8;">Motor Recomendado</span>
      </div>
      
      <div class="form-group">
        <label class="form-label"><span>Proveedor de Inteligencia Artificial</span></label>
        <div class="select-box">★ Google Gemini 2.5 Flash (Gratis con API Key de AI Studio)</div>
      </div>
      
      <div class="form-group">
        <label class="form-label">
          <span>Google AI Studio API Key</span>
          <span style="color: #10b981; font-weight: 600;">✓ Verificada</span>
        </label>
        <div class="input-box with-key">AIzaSyD8m-9qXpL2kR4tVwYz7bNmQ1aC8eF3****************</div>
      </div>
      
      <div class="test-status-box">
        <span>✓</span>
        <span>Conectado a Google gemini-2.5-flash correctamente. ¡Brain Board está listo para usar!</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel">Cancelar</button>
      <button class="btn-save">Guardar Configuración</button>
    </div>
  </div>
</body>
</html>
`
  }
];

app.whenReady().then(async () => {
  const extractedDir = path.resolve(__dirname, '../extracted_board');
  const appBundleAssetsDir = path.resolve(__dirname, '../app_bundle/assets');
  if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true });
  if (!fs.existsSync(appBundleAssetsDir)) fs.mkdirSync(appBundleAssetsDir, { recursive: true });

  const win = new BrowserWindow({
    width: 960,
    height: 560,
    show: false,
    webPreferences: { offscreen: true }
  });

  for (const step of steps) {
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(step.html);
    await win.loadURL(dataUrl);
    await new Promise(r => setTimeout(r, 400));
    const image = await win.capturePage();
    const pngBuffer = image.toPNG();
    const dest1 = path.join(extractedDir, step.filename);
    const dest2 = path.join(appBundleAssetsDir, step.filename);
    fs.writeFileSync(dest1, pngBuffer);
    fs.writeFileSync(dest2, pngBuffer);
    console.log(`Generated: ${step.filename} (${pngBuffer.length} bytes)`);
  }

  app.quit();
});
