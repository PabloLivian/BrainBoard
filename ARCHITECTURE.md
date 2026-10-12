# Arquitectura Interna de Miro Desktop (v0.11.168)

Este documento detalla la ingeniería inversa realizada sobre la aplicación oficial de Miro para escritorio, mapeando sus componentes, puntos de entrada, seguridad y áreas de extensión.

---

## 1. Visión General de la Arquitectura

Miro Desktop es una aplicación híbrida construida sobre **Electron**. No renderiza todo el tablero de forma nativa en Node, sino que crea un contenedor de escritorio con pestañas que carga la aplicación web de Miro dentro de etiquetas `<webview>` fuertemente aisladas.

```
                           +------------------------+
                           |     Proceso Main       |
                           |  (app_bundle/main.js)  |
                           +-----------+------------+
                                       |
                   IPC Channels / Lifecycle / Window State
                                       |
                                       v
                           +------------------------+
                           |    Proceso Renderer    |
                           | (app_bundle/renderer.js|
                           |    + index.html)       |
                           +-----------+------------+
                                       |
                           Gestión de Pestañas (electron-tabs)
                                       |
                                       v
                     +------------------------------------+
                     |        <webview> (Canvas Miro)     |
                     |  - Preload: webview-preload.js     |
                     |  - URL: https://miro.com/app/board |
                     +------------------------------------+
```

---

## 2. Componentes y Puntos Clave

### A. Proceso Principal (`app_bundle/main.js`)
* **Archivo de origen:** Compilado desde `app/src/main.ts` con Webpack.
* **Responsabilidades:**
  * Crea la ventana principal (`BrowserWindow`) con tamaño mínimo `880x660`.
  * Habilita `<webview>` mediante `webviewTag: true`.
  * Gestiona argumentos CLI, protocolos personalizados (deep links `rtb://` o `miro://`).
  * Restricciones de red: **Bloquea activamente** llamadas a `localhost` y rangos de red privada (`127.x`, `192.168.x`, `10.x`, `172.16-31.x`) en `validateUrlForSecurity`.
  * Telemetría: Envío de métricas y errores mediante `@sentry/electron` y `@opentelemetry`.
  * Actualizaciones automáticas: Gestionadas por `electron-updater` con configuración en `resources/app-update.yml`.

### B. Shell de la Interfaz (`app_bundle/index.html` y `app_bundle/renderer.js`)
* **`app_bundle/index.html`:** Estructura HTML mínima:
  * `.etabs-tabgroup`: Barra superior donde residen las pestañas (`.etabs-tabs`) y el botón nueva pestaña (`.etabs-buttons`).
  * `.etabs-views`: Contenedor donde se insertan dinámicamente las etiquetas `<webview>` de cada tablero.
  * `#test-environment-warning`: Cartel de aviso cuando se detecta un entorno no oficial.
* **`app_bundle/renderer.js`:**
  * Motor de pestañas basado en `electron-tabs`.
  * Control del ciclo de vida de cada pestaña (`active`, `inactive`, `closing`).
  * Inyección del preload específico de cada pestaña (`webviewAttributes.preload = './preload/webview-preload.js'`).

### C. Preload Scripts (Puntos de Inyección)
1. **Preload de la Ventana Principal (`app_bundle/preload/preload.js`):**
   * Expone a la ventana contenedora el objeto global `window.miro` (`MIRO_API`):
     * `settings`: Acceso a configuración persistente mediante `electron-store`.
     * `ipcOn`, `ipcOff`, `logger`: Comunicación con el proceso principal.
     * `clipboard`, `openExternal`, `showDialog`, etc.
   * Expone `window.process` (`platform`, `env: { NODE_ENV: 'release' }`).

2. **Preload del Tablero / Canvas (`app_bundle/preload/webview-preload.js`):**
   * Este script se ejecuta en el contexto de la página web de Miro dentro del `<webview>`.
   * Expone:
     * `window._rtb_app_features_`: Array de características activas (`['MIRO_LOADER', 'MIRO_VISIBILITY_CHANGED_EVENT', 'MIRO_STAT_TRIGGERED_EVENT']`).
     * `window._rtb_app_actions_`: Acciones nativas como `getDeviceInfo()`, `getAppConfig()`, `getScreenSharingSources()`.
   * **¡Este es el punto más potente para añadir extensiones o personalizaciones al tablero!**

### D. Estilos CSS (`app_bundle/static/css/`)
* `app.css`: Estilos globales de la aplicación de escritorio y overlays.
* `electron-tabs.css`: Aspecto visual de las pestañas (colores, bordes, animaciones, pestañas activas/inactivas).
* `fonts.css`: Tipografías del sistema (`Formular`, `OpenSans`, `Arial`).

---

## 3. Estrategia para Añadir y Quitar Cosas

1. **Quitar telemetría y rastreadores (Sentry / OpenTelemetry):**
   * Desactivar la inicialización de Sentry en `main.js`, `preload.js` y `renderer.js`.
   * Eliminar o desactivar los reportes de rendimiento y fallos.
2. **Personalización Visual (Temas / CSS Custom):**
   * Editar directamente `app_bundle/static/css/electron-tabs.css` y `app.css` para cambiar la apariencia de la barra superior.
   * Para inyectar CSS en el propio tablero de Miro: agregar una función `insertCSS` dentro de `webview-preload.js`.
3. **Nuevas Funcionalidades o Atajos:**
   * Registrar listeners de teclado en `webview-preload.js` o en `main.js` mediante `electron-localshortcut`.
   * Agregar scripts personalizados que interactúen con la API del tablero de Miro.
4. **Desbloqueo de URLs locales / servidores propios:**
   * Modificar `validateUrlForSecurity` en `main.js` para permitir hosts locales o servidores de prueba.
