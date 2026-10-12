# Miro Desktop (Reverse Engineered & Custom Modding)

Proyecto de ingeniería inversa y desarrollo de extensiones/personalizaciones para la aplicación oficial de **Miro Desktop (v0.11.168)**.

El análisis de código, dependencias, flujo de ejecución y límites arquitectónicos se realizó mediante **[REA (Reverse Engineer Anything)](https://github.com/morluto/rea)**.

---

## 📁 Estructura del Proyecto

* **`app_bundle/`**: Código fuente extraído y desempacado del paquete oficial de Miro.
  * **`main.js`**: Proceso principal de Electron. Controla la creación de ventanas, menú nativo, atajos globales, seguridad de red y ciclo de vida de la aplicación.
  * **`index.html`**: Shell HTML base que aloja la barra de pestañas y las vistas.
  * **`renderer.js`**: Proceso de renderizado del contenedor de pestañas (`electron-tabs`). Gestiona la creación de etiquetas `<webview>` para cada tablero de Miro.
  * **`preload/preload.js`**: Preload de la ventana principal. Expone la API nativa de Miro (`window.miro`) mediante `contextBridge`.
  * **`preload/webview-preload.js`**: **Punto clave de inyección.** Se ejecuta en el contexto del tablero de Miro dentro del `<webview>`, exponiendo `window._rtb_app_features_` y `window._rtb_app_actions_`.
  * **`static/css/`**: Estilos de la app (`app.css`, `electron-tabs.css`, `fonts.css`).
* **`scripts/`**:
  * **`deploy.ps1`**: Empaqueta el código actual en `app.asar` y lo instala automáticamente en tu Miro de escritorio (con backup automático del original).
  * **`restore.ps1`**: Restaura el Miro original en caso de querer revertir cambios.
* **`ARCHITECTURE.md`**: Informe técnico detallado de la ingeniería inversa, flujo de llamadas IPC y puntos para añadir/quitar funciones.

---

## 🚀 Comandos Rápidos

### 1. Probar en desarrollo local
```bash
npm start
```
*(Inicia la aplicación directamente con Electron cargando este directorio)*

### 2. Empaquetar e instalar en tu Miro de Windows
```bash
npm run deploy
```
O empaquetar y abrir Miro de inmediato:
```bash
npm run deploy:launch
```

### 3. Restaurar Miro oficial
```bash
npm run restore
```

---

## 🛠️ ¿Qué puedes personalizar?

1. **Inyectar extensiones o scripts en el tablero (`webview-preload.js`):**
   * Puedes interceptar eventos del canvas, agregar barras de herramientas flotantes, atajos de teclado personalizados, scripts de automatización o exportación.
2. **Personalizar el tema y la interfaz (`app_bundle/static/css/`):**
   * Modifica `electron-tabs.css` o `app.css` para cambiar colores, estilos de pestañas o crear un tema oscuro a medida.
3. **Desactivar telemetría y rastreo:**
   * Quita las llamadas a Sentry y OpenTelemetry en `app_bundle/main.js` y `app_bundle/preload/preload.js`.
4. **Habilitar servidores locales / redes privadas:**
   * Ajusta la función `validateUrlForSecurity` en `app_bundle/main.js` si necesitas conectar tableros o recursos alojados localmente.
