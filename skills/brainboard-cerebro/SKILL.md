---
name: brainboard-cerebro
description: Skill de gestión del Segundo Cerebro de Brain Board. Úsala para consultar apuntes por fecha de colocación (createdAt), generar briefings de los últimos repositorios/enlaces añadidos, detectar apuntes obsoletos, hacer apuntes por modo de resumen y añadir recursos (web, tweet, repositorio, vídeo) con su tarjeta compacta y mini descripción debajo calculando coordenadas (x, y, width, height, parentId) sin colisiones.
---

# Brain Board — Skill de Modo Cerebro y Coordenadas Espaciales

Esta skill proporciona las reglas exactas para operar sobre los tableros de **Brain Board** (`boards/*.json` y `app_bundle/boards/*.json`), analizar fechas de colocación (`createdAt`) e insertar nuevos recursos, repositorios, enlaces y apuntes con precisión geométrica.

## 1. Estructura de un Elemento con Fecha y Coordenadas

Todo elemento en `board.items` debe poseer:
```json
{
  "id": "embed_1792591200000_a1b2",
  "type": "embed",
  "parentId": null,
  "createdAt": "2026-10-21T15:00:00.000Z",
  "updatedAt": "2026-10-21T15:00:00.000Z",
  "x": 1240,
  "y": 180,
  "width": 310,
  "height": 135,
  "title": "scenario-labs/blender-plugin",
  "domain": "GITHUB.COM",
  "url": "https://github.com/scenario-labs/blender-plugin",
  "src": "",
  "description": "Plugin de Blender 5.0+ para generar imágenes, vídeo, 3D y materiales PBR con Scenario, con servidor MCP local para agentes.",
  "zIndex": 25
}
```

## 2. Reglas de Coordenadas para Evitar Solapamientos

1. **Inspeccionar primero el Bounding Box del Tablero:**
   - Para cada elemento existente en `board.items`, calcula `right = item.x + (item.width || 200)` y `bottom = item.y + (item.height || 100)`.
   - Si vas a añadir un **nuevo Marco de Apunte (`type: "frame"`)**, colócalo a `x = Math.round(maxRight + 120)`, `y = Math.round(minTop)` con `width: 820, height: 420`.
2. **Si vas a insertar dentro de un Marco existente (`frame`)**:
   - Busca todos los hijos donde `child.parentId === frame.id` o cuyo centro caiga dentro del marco.
   - Calcula `maxChildBottom = Math.max(...children.map(c => c.y + (c.height || 100)), frame.y + 80)`.
   - Coloca la nueva fila en `newY = Math.round(maxChildBottom + 28)`:
     - `embed` (izquierda): `x = frame.x + 30`, `y = newY`, `width = 330`, `height = 240`.
     - `text` (derecha, nota de workflow): `x = frame.x + 390`, `y = newY`, `width = 395`, `height = 240`.
   - Si `newY + 240 + 35 > frame.y + frame.height`, amplía `frame.height = (newY + 240 + 35) - frame.y`.
3. **Estética Obligatoria (`BoardInstructorAI.md`)**:
   - Paleta sobria: fondos `#161b26` / `#0f141d`, textos `#f1f5f9` / `#e2e8f0`, acentos `#38bdf8`.
   - **Cero flechas (`connector`) por defecto.**
   - Sincronizar siempre tanto `boards/<id>.json` como `app_bundle/boards/<id>.json` y mantener `"userModified": true`.

## 3. Las 4 Acciones Rápidas de Brain: "Apunte", "Añadir recurso", "Briefing" y "Revisar apuntes obsoletos"

1. **✍️ Apunte (con desplegable de Modo de resumen — `"action": "insert_knowledge"`)**:
   - **Desarrollado (`desarrollado`)**: Explicación profunda y exhaustiva (6-9 viñetas técnicas con arquitectura, workflow paso a paso, integración en pipeline y casos de uso). Altura base del bloque `360px` (ampliable dinámicamente según líneas) en un marco de `860x510`.
   - **Medio (`medio`)**: Resumen equilibrado (3-4 viñetas: propósito, flujo de trabajo e integración). Altura base `260px` en un marco de `820x420`.
   - **Breve resumen (`breve`)**: Síntesis ejecutiva directa (2-3 puntos concisos de una línea). Altura base `195px` en un marco de `800x350`.
2. **🔗 Añadir recurso (`"action": "insert_resource"`)**:
   - Diseñado para añadir cualquier **página web, tweet / post de X, repositorio de GitHub, vídeo o herramienta** sin crear un marco gigante ni una nota de texto extensa.
   - Coloca dos elementos alineados verticalmente:
     1. **Tarjeta compacta (`type: "embed"`)**: `width: 310, height: 135, src: ""`, con su insignia de dominio (`github.com`, `x.com`, `youtube.com`, web), título en negrita (`embedTitle`) y descripción resumida de 1-2 líneas dentro de la tarjeta (`embedDescription`).
     2. **Mini descripción inferior (`type: "text"` justo debajo de la tarjeta)**: situada en `x = embed.x`, `y = embed.y + 149`, `width: 330, height: 34`, `fontSize: 20`, `fillColor: null`, `color: "#1a1a1a"`, `textAlign: "left"`, con una frase corta de **3 a 8 palabras** (`resourceCaption`, ej. `"Repositorio IA integrada en Blender"`, `"Tweet sobre workflow de retopología"`, `"Web de materiales PBR gratuitos"`).
   - Estructura del bloque `<brainboard_action>` para **Añadir recurso**:
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
3. **📋 Briefing (con desplegable de Periodo temporal por `createdAt`)**:
   - **Últimos 7 días (`7d`)**: Filtra y resume los elementos colocados en los últimos 7 días (`≤ 168h`).
   - **Últimos 3 días (`3d`)**: Filtra y resume los elementos colocados en los últimos 3 días (`≤ 72h`).
   - **Últimas 24 horas (`24h`)**: Filtra y resume los elementos colocados en las últimas 24 horas (`≤ 24h`).
4. **🕰️ Revisar apuntes obsoletos**:
   - Analiza los elementos más antiguos (`> 180 días`) según `createdAt` para sugerir actualizaciones o limpieza.
