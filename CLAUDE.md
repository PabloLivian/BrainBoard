# CLAUDE.md - Guía de Contexto, Coordenadas y Modo Cerebro de Brain Board

> **Propósito:** Este archivo dota a **Claude Code CLI** (`claude`) y agentes basados en Claude del conocimiento técnico completo sobre **Brain Board**, su sistema de fechas de colocación (`createdAt`), su motor de coordenadas 2D (`x, y, width, height, parentId`) y las directrices estéticas de [BoardInstructorAI.md](file:///c:/Users/Usuario/Desktop/DEV/BrainBoard/BoardInstructorAI.md).

---

## 1. Arquitectura de Datos de los Tableros

- **Ubicación de los tableros:**
  - `boards/<id>.json` (fuente primaria en disco)
  - `app_bundle/boards/<id>.json` (espejo sincronizado para el runtime de Electron)
- **Persistencia Dual:** Cuando se modifica un tablero desde la UI o desde el Cerebro IA, se sincroniza en `IndexedDB`, `localStorage`, `boards/<id>.json` y `app_bundle/boards/<id>.json`, marcando `"userModified": true` y `"seedVersion": 4` (o superior).

### Catálogo de Tableros Principales
- `DEV_AI.json` (id: `dev_ai`): Desarrollo, IA, modelos generativos, código, repositorios GitHub y herramientas web.
- `3d_software.json` (id: `3d_software`): Herramientas 3D, motores, plugins, escenas 3D, blockout y renderizado.
- `houdini.json` (id: `houdini`): Workflows procedurales, VEX, simulaciones y nodos en SideFX Houdini.
- `zbrush.json` (id: `zbrush`): Escultura digital, pinceles, topología y personajes.
- `impresion_3d.json` (id: `impresion_3d`): Laminadores, resinas, filamentos, calibración y hardware 3D.
- `recursos.json` (id: `recursos`): Biblioteca masiva de referencias visuales, texturas, assets y enlaces.
- `industria.json` (id: `industria`): Estudios VFX/3D, reels, ofertas y contactos de la industria.
- `ordenador.json` (id: `ordenador`): Hardware, GPUs, configuraciones de PC y benchmarks.
- `concepts.json` (id: `concepts`): Concept art, iluminación y composición.
- `graphics_design.json` (id: `graphics_design`): Diseño gráfico, tipografía y UI.
- `general.json` (id: `general`): Apuntes generales y organización.

---

## 2. Seguimiento Temporal (`createdAt` y `updatedAt`)

Cada elemento dentro de `board.items` incluye obligatoriamente:
- `"createdAt"`: Timestamp ISO 8601 exacto de cuando el objeto fue colocado por primera vez en el tablero (ej. `"2026-10-21T15:00:00.000Z"`).
- `"updatedAt"`: Timestamp ISO 8601 de su última modificación.

### Clasificación de Frescura (Mapa de Fechas)
- **Reciente (`≤ 7 días`)**: Color esmeralda (`#10b981`) — Novedades recién descubiertas.
- **Actual (`≤ 30 días`)**: Color azul (`#3b82f6`) — Conocimiento activo del último mes.
- **Intermedio (`≤ 180 días`)**: Color ámbar (`#f59e0b`) — Apuntes consolidados de los últimos 6 meses.
- **Antiguo / Obsoleto (`> 180 días`)**: Color rojo coral (`#ef4444`) — Candidato a revisión o actualización tecnológica.

---

## 3. Sistema de Coordenadas Espaciales (`x, y, width, height, parentId`)

El lienzo infinito 2D de Brain Board (`app_bundle/whiteboard/canvas_engine.js`) utiliza coordenadas absolutas en el mundo (`x, y` representan la esquina superior izquierda del elemento):

1. **Marcos Contenedores (`type: "frame"`)**:
   - Actúan como bloques temáticos. Tienen `zIndex: 0` (o el menor del grupo).
   - Dimensiones típicas para un bloque curado: `width: 820`, `height: 420`, `fillColor: "#0f141d"`.
2. **Elementos Hijos dentro de un Marco (`parentId: "<id_del_frame>"`)**:
   - **IMPORTANTE:** Aunque tengan `parentId`, sus coordenadas `x` e `y` son **coordenadas globales del mundo**, por lo que deben situarse geométricamente dentro del rectángulo `[frame.x, frame.y, frame.x + frame.width, frame.y + frame.height]`.
   - **Margen interior recomendado:** `30px` desde los bordes izquierdo y superior del marco.
   - **Disposición de Enlace/Repositorio + Apunte Técnico (Regla de Oro de `BoardInstructorAI.md`)**:
     - **Cabecera del Marco (`type: "text"`)**: `x = frame.x + 30`, `y = frame.y + 24`, `width = frame.width - 60`, `height = 54`, `fillColor: "#161b26"`, `color: "#f1f5f9"`, `fontSize: 22`, `isBold: true`.
     - **Tarjeta de Enlace / Repositorio (`type: "embed"`)**: `x = frame.x + 30`, `y = frame.y + 104`, `width = 330`, `height = 260`.
     - **Nota Técnica de Workflow (`type: "text"`)**: `x = frame.x + 390`, `y = frame.y + 104`, `width = 395`, `height = 260`, `fillColor: "#161b26"`, `color: "#e2e8f0"`, `fontSize: 16`.
   - **Prohibido usar flechas (`connector`) por defecto:** La cercanía espacial dentro del mismo marco indica la relación.

---

## 4. Las 4 Acciones Rápidas de Brain: "Apunte", "Añadir recurso", "Briefing" y "Revisar apuntes obsoletos"

### A. Botón "✍️ Apunte" con Desplegable de Modo de Resumen (`"action": "insert_knowledge"`)
Cuando el usuario solicita hacer un apunte desde Brain (eligiendo en el desplegable **Modo de resumen** entre `Desarrollado`, `Medio` o `Breve resumen`), la IA debe adaptar tanto su explicación en el chat como el contenido de `"noteText"` y el campo `"summaryMode"` dentro de `<brainboard_action>`:

1. **`Desarrollado` (`"summaryMode": "desarrollado"`)**:
   - Resumen técnico exhaustivo y profundo (6 a 9 viñetas detalladas en `"noteText"`).
   - Estructura obligatoria: **Qué es y Arquitectura**, **Workflow Paso a Paso**, **Integración en el Pipeline** (ej. Blender, Houdini, ComfyUI, código) y **Casos de Uso / Parámetros Clave**.
   - Dimensiones del bloque en lienzo: `noteRect.height` ampliado automáticamente (`360px` o más según longitud) dentro de un marco de `860x510`.
2. **`Medio` (`"summaryMode": "medio"`)**:
   - Resumen equilibrado y directo (3 a 4 viñetas claras en `"noteText"`): **Propósito**, **Flujo de trabajo** e **Integración práctica**.
   - Dimensiones estándar: `height: 260`, marco de `820x420`.
3. **`Breve resumen` (`"summaryMode": "breve"`)**:
   - Síntesis ejecutiva ultra concisa (2 a 3 viñetas cortas de una línea en `"noteText"` con la esencia y aplicación inmediata).
   - Dimensiones compactas: `height: 195`, marco de `800x350`.

### B. Botón "🔗 Añadir recurso" con Mini Descripción Debajo (`"action": "insert_resource"`)
Cuando el usuario pulsa **🔗 Añadir recurso** o pide añadir/guardar un recurso (página web, tweet / post de X, repositorio de GitHub, vídeo, plugin o herramienta):
- **NO se crea un marco grande ni una nota lateral extensa.**
- Se insertan dos elementos alineados verticalmente:
  1. **Tarjeta compacta (`type: "embed"`)**: `width: 310, height: 135, src: ""`, que muestra el icono y dominio (`github.com`, `x.com`, `youtube.com`, web), el título limpio en negrita (`embedTitle`, ej. `"scenario-labs/blender-plugin"`) y una descripción resumida de 1-2 líneas dentro de la tarjeta (`embedDescription`).
  2. **Mini descripción inferior (`type: "text"` justo debajo de la tarjeta)**: situada en `x = embed.x`, `y = embed.y + 149`, `fontSize: 20`, `fillColor: null`, `color: "#1a1a1a"`, `textAlign: "left"`, con una frase directa de **3 a 8 palabras** (`resourceCaption`, ej. `"Repositorio IA integrada en Blender"`).

### C. Botón "📋 Briefing" con Opciones de Periodo Temporal
El desplegable **Briefing** permite consultar las novedades colocadas en el cerebro filtrando por tres ventanas temporales exactas basadas en `createdAt`:
- **Últimos 7 días (`7d`)**: Resumen de todo lo colocado en la última semana (`≤ 168h`).
- **Últimos 3 días (`3d`)**: Resumen de la actividad reciente de las últimas `72h`.
- **Últimas 24 horas (`24h`)**: Resumen de lo colocado en el último día (`≤ 24h`).

---

## 5. Protocolo de Acción desde el Chat (`<brainboard_action>`)

### A. Para "Añadir recurso" (`"action": "insert_resource"`):
```xml
<brainboard_action>
{
  "action": "insert_resource",
  "boardId": "3d_software",
  "frameTitle": "",
  "url": "https://github.com/scenario-labs/blender-plugin",
  "embedTitle": "scenario-labs/blender-plugin",
  "embedDescription": "Plugin de Blender 5.0+ para generar imágenes, vídeo, 3D y materiales PBR con Scenario, con servidor MCP local para agentes.",
  "resourceCaption": "Repositorio IA integrada en Blender"
}
</brainboard_action>
```

### B. Para "Apunte" (`"action": "insert_knowledge"`):
```xml
<brainboard_action>
{
  "action": "insert_knowledge",
  "summaryMode": "desarrollado",
  "boardId": "dev_ai",
  "createNewBoardIfMissing": false,
  "newBoardTitle": "",
  "frameTitle": "Escenas 3D & Blockout IA",
  "url": "https://github.com/usuario/repositorio",
  "embedTitle": "usuario/repositorio",
  "embedDescription": "Generador de escenas 3D, blockout y renderizado rápido.",
  "noteTitle": "WORKFLOW: BLOCKOUT Y RENDERS 3D",
  "noteText": "• Propósito: Creación rápida de escenas 3D y blockout.\n• Flujo de trabajo: Definir layout base -> Exportar cámara/geometría -> Render final.\n• Integración: Ideal junto a Blender / Houdini / ComfyUI."
}
</brainboard_action>
```

Y cuando cites elementos existentes del Cerebro para que el usuario pueda navegar a ellos con un clic, utiliza:
`[[cite:boardId|itemId|Nombre del Recurso]]`
