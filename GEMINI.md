# GEMINI.md - Documentación Técnica y Contexto de Brain Board

> **Propósito de este documento:**  
> Este archivo sirve como memoria técnica y guía contextual completa del proyecto **Brain Board** para asistentes de IA (Antigravity / Gemini) y desarrolladores. Contiene la arquitectura, soluciones a problemas críticos resueltos, lecciones aprendidas y directrices operativas para mantener la integridad del proyecto entre distintas sesiones de desarrollo.

---

## 1. Visión General del Proyecto

* **Nombre de la Aplicación:** Brain Board (anteriormente bifurcado de RealtimeBoard / Miro Desktop).
* **Directorio Raíz:** `c:\Users\Usuario\Desktop\DEV\BrainBoard` (trabajar SIEMPRE en este directorio; no confundir con `DEV\Miro`).
* **Objetivo:** Cliente de pizarra infinita de escritorio **100% offline**, rápido y local, capaz de importar con máxima fidelidad tableros existentes de Miro (incluyendo textos, conectores, formas, marcos, notas adhesivas y galerías de imágenes multimedia).
* **Stack Tecnológico:**
  * **Runtime:** Electron (ejecutado con `npx electron .` vía `npm start`).
  * **Motor Gráfico:** Canvas 2D personalizado de alto rendimiento (`app_bundle/whiteboard/canvas_engine.js`) con zoom, pan, culling visual y selección múltiple.
  * **Lógica de la Aplicación:** Vanilla JavaScript / DOM (`app_bundle/whiteboard/board_app.js`).
  * **Persistencia Local:** `IndexedDB` en el almacenamiento de usuario de Electron (`%APPDATA%\BrainBoard`), con respaldo secundario en `localStorage`.
  * **Empaquetado:** `@electron/asar` (`scripts/pack_asar.js` $\rightarrow$ `dist/app.asar`).

---

## 2. Estructura del Proyecto

```
BrainBoard/
├── app_bundle/                 # Frontend y proceso principal de Electron (descomprimido)
│   ├── main.js                 # Proceso principal de Electron (configuración de ventanas, webSecurity, CSP)
│   ├── index.html              # Shell HTML principal (Dashboard Home y vista Canvas)
│   ├── boards/                 # Copia sincronizada de los archivos seed de tableros
│   └── whiteboard/
│       ├── board_app.js        # Controlador de la UI, gestión de tableros, IndexedDB y eventos
│       ├── canvas_engine.js    # Motor de renderizado en Canvas 2D
│       └── whiteboard.css      # Estilos de la aplicación
├── boards/                     # Archivos fuente JSON de los 15 tableros con versión seed
├── extracted_board/            # Banco físico de imágenes extraídas de los backups .rtb (1.450+ archivos)
├── CopiasSeguridadRTB/         # Archivos originales .rtb exportados de Miro
├── JSONCopias/                 # Archivos originales .json exportados de Miro (REST API / Web SDK)
├── mapping_images/             # Archivos JSON de mapeo con huellas base64 generados desde Chrome
├── scripts/                    # Scripts de automatización y mantenimiento:
│   ├── apply_all_mappings.js   # Mapeador binario inteligente por huella (resuelve duplicados y seedVersion)
│   ├── convert_all_boards.js   # Conversor inicial JSONCopias -> Brain Board con aislamiento por RTB
│   ├── list_rtb_media.js       # Indexador de archivos multimedia por RTB
│   ├── rtb_files_by_board.json # Catálogo de qué archivos multimedia pertenecen a qué tablero
│   └── pack_asar.js            # Empaquetador de app_bundle/ en dist/app.asar
├── dist/
│   └── app.asar                # Archivo empaquetado para distribución (aprox. 561 MB)
├── package.json
└── GEMINI.md                   # Este archivo de contexto
```

---

## 3. Arquitectura de Datos y Ciclo de Vida (CRÍTICO)

### Persistencia Robusta y Protección del Trabajo del Usuario
Brain Board utiliza una arquitectura de persistencia dual garantizada:
* **Persistencia Dual (IndexedDB + Disco Físico JSON):**
  1. Cada cambio realizado por el usuario (crear, editar, mover o eliminar elementos) activa `autoSaveBoardImmediately()`.
  2. Guarda de inmediato en `IndexedDB` y `localStorage` para acceso ultra-rápido.
  3. **Guarda directamente en los archivos JSON en disco:** Mediante Node.js `fs` (`saveBoardToDisk`), escribe de inmediato en `boards/<id>.json` y `app_bundle/boards/<id>.json`. Así los cambios del usuario quedan permanentemente grabados en los archivos físicos.
* **Protección Sagrada de las Modificaciones del Usuario (`userModified`):**
  1. Cuando el usuario modifica un tablero, se marca la propiedad `userModified: true` y se actualiza `updatedAt`.
  2. Tanto `loadInitialBoard()` como `switchBoard()` respetan esta bandera: si un tablero ha sido modificado por el usuario (`userModified: true`), **NUNCA se sobreescribirá con una plantilla de semilla**, protegiendo al 100% el trabajo del usuario.
  3. `engine.currentSeedVersion` se propaga siempre con la versión máxima (`Math.max(..., 3)`), evitando bugs de degradación de versiones.
  4. Los archivos de plantilla `boards/*.json` solo se usan como punto de partida inicial cuando se abre un tablero por primera vez sin datos previos.

---

## 4. El Gran Desafío del Mapeo de Imágenes de Miro

### Diagnóstico de fallos iniciales
1. **Falta de URLs:** En la exportación estándar de Miro, las imágenes subidas no incluyen URL pública (`url: ""`).
2. **Colisiones por Relación de Aspecto:** En tableros grandes (como *Recursos*, con más de 800 imágenes, o *Impresión 3D*, con 120+), emparejar imágenes comparando ancho/alto con los archivos del RTB genera fallos masivos porque cientos de imágenes comparten relaciones estándar (16:9, 1:1, etc.).
3. **Contaminación Cruzada:** Mezclar los archivos extraídos de todos los `.rtb` en una carpeta común provocaba que imágenes de un tablero aparecieran en otros tableros.
4. **Imágenes Duplicadas / Compartidas:** Si un tablero utiliza el mismo logotipo o icono en varias tarjetas, el archivo `.rtb` almacena una **única copia física**. Los algoritmos que forzaban una asignación 1-a-1 (`assignedFiles.has()`) impedían que las tarjetas secundarias recibieran el archivo, dejándolas con imágenes erróneas.

### La Solución Definitiva (Huellas Binarias + Extracción RTB)
1. **Anatomía del `.rtb`:**
   * Un archivo `.rtb` de Miro es en realidad un archivo comprimido en formato **TAR**.
   * Contiene los archivos multimedia físicos nombrados por su Resource ID (`<id>.jpg`, `<id>.png`).
   * Contiene `resources.json` (JSON plano descifrado) con el catálogo que mapea cada Resource ID a su nombre original de archivo (ej. `Panel_01.jpg`, `vent_72.jpg`, `cable_40.jpg`).
   * Contiene `canvas.json` (cifrado con el formato propietario de Miro).
2. **Aislamiento Estricto por Tablero (`rtb_files_by_board.json`):**
   * Cada tablero solo puede utilizar los archivos multimedia contenidos en su propio archivo `.rtb`.
3. **Mapeo por Huella Binaria Profunda (Script en Chrome Console):**
   * Desde la consola de Chrome en Miro Web, se ejecuta el extractor de imágenes que obtiene `miro.board.get({ type: 'image' })` junto con los primeros 500 caracteres de su `dataUrl` (`img.getDataUrl()`).
   * `scripts/apply_all_mappings.js` decodifica la cabecera en Base64 y la compara byte a byte (hasta 300 bytes de coincidencia exacta) contra las cabeceras de los archivos físicos del RTB correspondiente.
   * **Soporte de duplicados:** Se permite que múltiples elementos del tablero referencien el mismo archivo físico si comparten la misma huella binaria.
   * **Detección Automática por IDs:** Si un archivo de mapeo tiene un nombre inesperado, el script compara los IDs de los widgets contra `JSONCopias/` para identificar infaliblemente a qué tablero pertenece.

---

## 5. Tableros del Proyecto (Catálogo de los 15 Tableros)

| ID / Archivo | Nombre en Miro | Archivo RTB | Imágenes | Estado de Mapeo |
| :--- | :--- | :--- | :---: | :--- |
| `recursos.json` | Recursos | `Recursos.rtb` | 826 | Mapeo binario 100% exacto (826/826) |
| `3d_software.json` | 3D SOFTWARE | `3D SOFTWARE.rtb` | 79 | Mapeo binario 100% exacto (79/79) |
| `impresion_3d.json` | Impresión 3D | `Impresión 3D.rtb` | 129 | Mapeo binario 100% exacto (129/129) |
| `dev_ai.json` (`DEV_AI.json`) | DEV / AI | `DEV  AI ultimo.rtb` | 98 | Mapeo binario 100% exacto (98/98) |
| `industria.json` | INDUSTRIA | `INDUSTRIA.rtb` | 58 | Mapeo binario 100% exacto (58/58) |
| `ordenador.json` | Ordena | `Ordena.rtb` | 40 | Mapeo binario 100% exacto (40/40) |
| `concepts.json` | Concepts | `Concepts.rtb` | 38 | Mapeo binario 100% exacto (38/38) |
| `trips.json` | TRIPS | `TRIPS.rtb` | 20 | Mapeo binario 100% exacto (20/20) |
| `houdini.json` | Houdini | `Houdini.rtb` | 17 | Mapeo binario 100% exacto (17/17) |
| `zbrush.json` | ZBRUSH | `ZBRUSH.rtb` | 16 | Mapeo binario 100% exacto (16/16) |
| `olalla_light_slu.json` | Olalla Light SLU | `Olalla Light SLU.rtb` | 9 | Mapeo binario 100% exacto (9/9) |
| `space.json` | SPACE | `SPACE.rtb` | 3 | Mapeo binario 100% exacto (3/3) |
| `graphics_design.json` | Graphics Design | `Graphics Design.rtb` | 3 | Aislamiento RTB exclusivo |
| `general.json` | General | `General.rtb` | 19 | Aislamiento RTB exclusivo |
| `baile.json` | Baile | `Baile.rtb` | 0 | Sin imágenes |

---

## 6. Procedimientos y Flujo de Trabajo Operativo

### Ejecutar la Aplicación en Desarrollo
```powershell
# En c:\Users\Usuario\Desktop\DEV\BrainBoard
npm start
```
*Electron carga directamente desde `app_bundle/main.js` y `app_bundle/index.html`.*

### Reempaquetar el Paquete Distribuible (`app.asar`)
```powershell
npm run build
```
*Genera `dist/app.asar` (aprox. 561 MB) empaquetando todo `app_bundle/` con soporte para rutas de imágenes relativas.*

### Reejecutar el Mapeador de Imágenes (si se añade o actualiza algún tablero)
1. Colocar el archivo de mapeo JSON en `mapping_images/`.
2. Ejecutar:
   ```powershell
   node scripts/apply_all_mappings.js
   ```
3. Reconstruir el paquete ASAR:
   ```powershell
   npm run build
   ```

---

## 7. Directrices Clave para Futuras Conversaciones con el Asistente

1. **Humildad y Verificación Empírica:** Nunca declarar que un resultado está "100% perfecto" o "matemáticamente infalible" sin haber verificado los datos reales o sin confirmación visual del usuario.
2. **No romper el aislamiento RTB:** Bajo ninguna circunstancia asignar imágenes de un archivo `.rtb` a otro tablero distinto.
3. **Mantener `seedVersion`:** Si se modifica la estructura o el contenido de los tableros en disco, incrementar `seedVersion` en `boards/*.json` y en `board_app.js` para asegurar que las instalaciones locales purguen su caché de IndexedDB automáticamente.
4. **Workspace Directorio:** Todas las rutas relativas deben ejecutarse teniendo como directorio de trabajo `c:\Users\Usuario\Desktop\DEV\BrainBoard`.

---

## 8. Exportación e Importación Autónoma de Tableros (.RTB)

Para garantizar la portabilidad total entre ordenadores y copias de seguridad sin perder imágenes locales:
* **Formato Contenedor (.rtb):** Paquete comprimido en formato **TAR** estándar (compatible con la utilidad `tar` del sistema operativo).
* **Estructura del paquete:**
  * `canvas.json` / `board.json`: Datos completos del tablero, widgets y estructura.
  * `resources.json`: Catálogo de recursos multimedia empaquetados.
  * Archivos de imagen reales (`.jpg`, `.png`, etc.) pertenecientes exclusivamente a ese tablero.
* **Exportación (`exportBoardToRTB`):**
  * Detecta los recursos físicos usados en los elementos del tablero.
  * Genera el archivo `.rtb` mediante diálogo nativo `showSaveDialog` o descarga directa.
* **Importación (`handleImportFile`):**
  * Acepta `.rtb`, `.brainboard` y `.json`.
  * Si es `.rtb`, descomprime automáticamente las imágenes y las copia al almacén local (`extracted_board` / `%APPDATA%\BrainBoard\extracted_board`), lee el JSON e inicializa el tablero en el workspace inmediatamente.

---

## 9. Protocolo Obligatorio para "Hacer Release"

Cuando el usuario solicite **"haz una release"**, **"hacer release"**, o **"prepara una release"**, el asistente debe ejecutar obligatoriamente y sin omitir pasos el siguiente protocolo:

### Paso 1: Incrementar la versión
1. Incrementar el número de versión en `package.json` (`version` y `appBaseVersion.desktop`).
2. Sincronizar el badge y las menciones de la versión en `app_bundle/index.html` (`#badge-version`, `#whats-new-version-badge`, `#btn-home-whats-new`).
3. Añadir la nueva funcionalidad o cambios destacados al inicio de la lista de novedades (`whats-new-feature-list`) en `app_bundle/index.html`.

### Paso 2: Reconstruir el paquete ASAR
```powershell
npm run build
```
*Genera `dist/app.asar` actualizado con todo el código del frontend, estilos y scripts.*

### Paso 3: Compilar instalador y artefactos con Electron Builder
```powershell
npm run pack:installer
```
*Ejecuta `electron-builder` con la configuración `oneClick: true` y genera en `dist_setup/`:*
* `Brain Board Setup X.Y.Z.exe`
* `Brain Board Setup X.Y.Z.exe.blockmap`
* `latest.yml` (con los hashes sha512 y tamaño exactos para electron-updater)

### Paso 4: Duplicar binario con nombre hyphenated (requisito estricto de latest.yml)
`latest.yml` referencia el binario como `Brain-Board-Setup-X.Y.Z.exe` (con guiones). Es indispensable generar la copia idéntica:
```powershell
Copy-Item "dist_setup\Brain Board Setup X.Y.Z.exe" -Destination "dist_setup\Brain-Board-Setup-X.Y.Z.exe" -Force
```

### Paso 5: Sincronizar Git y Crear Tag
1. Hacer commit de los archivos modificados y hacer push a `main`:
   ```powershell
   git add app_bundle/ package.json electron-builder.yml GEMINI.md
   git commit -m "release: vX.Y.Z"
   git push origin main
   ```
2. Crear y subir la etiqueta de versión:
   ```powershell
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

### Paso 6: Facilitar la publicación al usuario
1. Abrir la carpeta `dist_setup` en el explorador de Windows:
   ```powershell
   Start-Process explorer.exe (Resolve-Path "dist_setup")
   ```
2. Proporcionar al usuario el enlace directo de creación de Release en GitHub:  
   `https://github.com/PabloLivian/BrainBoard/releases/new?tag=vX.Y.Z`
3. Indicarle claramente que debe arrastrar a la casilla de adjuntos los **3 archivos esenciales**:
   * `latest.yml`
   * `Brain-Board-Setup-X.Y.Z.exe`
   * `Brain Board Setup X.Y.Z.exe.blockmap`
4. Al publicar la release, las instalaciones existentes detectarán la actualización, descargarán en segundo plano, mostrarán la pantalla de carga con spinner y reiniciarán automáticamente de forma 100% silenciosa en la nueva versión con el modal de novedades.

