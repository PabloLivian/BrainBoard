# 🏗️ Arquitectura del Sistema - Brain Board

Este documento describe la arquitectura técnica, los componentes clave y el flujo de datos de **Brain Board**, una aplicación de pizarra infinita de alto rendimiento 100% offline y local.

---

## 1. Visión General de la Arquitectura

Brain Board está desarrollada sobre **Electron** y desacoplada en tres capas principales:

```
+-------------------------------------------------------------------+
|                        Electron Main Process                      |
|                        (app_bundle/main.js)                       |
|   - Creación de Ventana Principal (BrowserWindow)                 |
|   - Gestión de Ciclo de Vida y Atajos Nativos                     |
|   - Políticas de Seguridad de Red (CSP & webSecurity)             |
+---------------------------------+---------------------------------+
                                  |
               IPC / Preload Bridge (app_bundle/preload/preload.js)
                                  |
                                  v
+---------------------------------+---------------------------------+
|                      Renderer Process (UI / DOM)                  |
|                      (app_bundle/whiteboard/board_app.js)         |
|   - Dashboard Home (Lista de tableros, búsqueda, categorías)     |
|   - Sistema de Pestañas Horizontales Multitablero                 |
|   - Portapapeles Inteligente (Imágenes, Enlaces, Widgets)        |
|   - Gestor de Persistencia Dual (IndexedDB + JSON en Disco)       |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|                   Motor Gráfico Canvas 2D                         |
|                   (app_bundle/whiteboard/canvas_engine.js)        |
|   - Renderizado acelerado a 60+ FPS                               |
|   - Culling visual y Frustum culling                              |
|   - Cuadrícula de puntos adaptativa multinivel                     |
|   - Interacción espacial (Zoom infinito, Paneo, Selección)        |
+-------------------------------------------------------------------+
```

---

## 2. Componentes Principales

### A. Proceso Principal (`app_bundle/main.js`)
* Configura la ventana principal con aceleración por hardware.
* Define los permisos de seguridad y encabezados de política de contenidos (Content Security Policy) para permitir la carga segura de recursos multimedia locales y remotos.
* Enlaza la ejecución del script de precarga seguro.

### B. Puente de Precarga (`app_bundle/preload/preload.js`)
* Expone de manera aislada (`contextBridge.exposeInMainWorld`) la API de Brain Board (`window.brainBoard`).
* **Portapapeles Nativo del Sistema:** Lectura síncrona y directa de imágenes en mapa de bits y texto mediante `electron.clipboard`.
* **Extractor de Metadatos Web:** Módulo asíncrono para consultar metadatos Open Graph (`og:image`, `og:title`) y descargar portadas web a Base64 sin problemas de CORS.

### C. Controlador de la Aplicación (`app_bundle/whiteboard/board_app.js`)
* **Gestión del Dashboard de Inicio:** Búsqueda en tiempo real, categorización de tableros, exportación e importación en formato JSON.
* **Barra de Pestañas Multitablero:** Permite mantener abiertos varios tableros a la vez y alternar entre ellos sin recargar la aplicación.
* **Pipeline de Portapapeles:** Detecta inteligentemente si lo que se pega es una imagen (PNG/JPEG/DataURL), un enlace web (tarjeta widget enriquecida) o texto formateado.

### D. Motor Gráfico 2D (`app_bundle/whiteboard/canvas_engine.js`)
* **Canvas Infinito de Alto Rendimiento:** Transforma coordenadas de pantalla a espacio de mundo (`screenToWorld` / `worldToScreen`) gestionando escalas de zoom fluidas.
* **Culling Visual:** Filtra y descarta elementos fuera del campo visual para garantizar 60 FPS incluso con miles de elementos en pantalla.
* **Cuadrícula Adaptativa:** Calcula la densidad de puntos según el factor de zoom de la cámara, garantizando que el fondo punteado nunca desaparezca ni se sature.
* **Renderizado de Elementos:**
  * Tarjetas de enlace (`embed`) con soporte para previsualizaciones multimedia.
  * Notas adhesivas (`sticky_note`) con autoajuste de tipografía.
  * Bloques de código con fondo oscuro.
  * Formas geométricas (`shape`), líneas y conectores imantados (`connector`).
  * Trazos vectoriales a mano alzada (`pen`).

---

## 3. Arquitectura de Persistencia de Datos

Para garantizar la máxima integridad y velocidad de acceso, Brain Board utiliza un sistema de **Persistencia Dual**:

1. **IndexedDB (Caché Ultrarrápida):** Guarda inmediatamente cada acción o modificación del usuario en el almacenamiento local del navegador para una carga instantánea.
2. **Archivos Físicos JSON (`boards/*.json`):** Al guardar un tablero, el motor escribe de inmediato el estado del tablero directamente en disco. De este modo, los tableros son archivos JSON portables, respaldables y versionables mediante Git.
3. **Bandera de Modificación de Usuario (`userModified`):** Los tableros modificados por el usuario quedan protegidos de sobreescrituras accidentales de plantillas o semillas iniciales.
