# BoardInstructorAI.md — Guía Maestra para la Creación de Tableros en Brain Board

> **Propósito de este documento:**  
> Este archivo sirve como directriz técnica, estética y operativa para el asistente de IA al generar, estructurar o enriquecer nuevos tableros (`boards/*.json`) en **Brain Board**. Define las reglas visuales, dimensionamiento, paletas cromáticas y estándares de contenido para garantizar siempre un resultado profesional, limpio y equilibrado.

---

## 1. Paleta Cromática y Dirección de Arte

Queda terminantemente prohibido el uso de colores saturados estridentes, marcos multicolor desconectados (verde chillón, púrpura eléctrico, azul rey desentonado) o notas adhesivas pastel estilo arcoíris (amarillo chillón, rosa pastel, menta).

### Paleta Oficial: Grises, Negros y Grises Azulados (Slate / Charcoal / Deep Space)

| Elemento | Código HEX | Descripción |
| :--- | :--- | :--- |
| **Fondo General del Lienzo** | `#0c0f14` / `#0f1316` | Negro carbón cósmico de alto contraste |
| **Fondo de Marcos Contenedores** | `#12161f` / `#131722` | Gris pizarra azulado ultra-oscuro |
| **Borde de Marcos** | `#1e2637` / `#232b3d` | Gris acero sutil (1px a 1.5px) |
| **Pestaña del Marco (`tabColor`)** | `#1a202c` | Gris grafito |
| **Texto de Pestaña del Marco** | `#cbd5e1` / `#e2e8f0` | Blanco humo legible |
| **Fondo de Tarjetas de Apuntes** | `#161b26` / `#19202e` | Gris grafito azulado |
| **Borde de Tarjetas** | `#262e40` / `#2d374d` | Ribete sutil para dar volumen |
| **Títulos de Sección / Destacados** | `#38bdf8` / `#60a5fa` | Cian tecnológico / Azul hielo suave |
| **Texto Principal de Lectura** | `#f1f5f9` | Blanco limpio de alto contraste |
| **Subtítulos y Metadatos** | `#94a3b8` / `#64748b` | Gris medio metálico |

---

## 2. Organización Espacial y Marcos Contenedores (`frames`)

1. **Agrupación Temática Estricta:**
   - Todo el contenido debe pertenecer a un marco contenedor (`frame`) con su correspondiente `parentId`.
   - **Títulos Claros en la Cabecera:** Cada marco debe llevar un título descriptivo en mayúsculas acompañado de un icono representativo (ej. `🚀 BLOQUE I: SPACEX & REUTILIZACIÓN`).
2. **Estructura en Cuadrícula Modular Simétrica:**
   - Disponer los marcos en cuadrícula limpia (ej. una cabecera Hero superior `3300 × 320 px`, seguida de una rejilla 2×2 con marcos de ancho `1620 px` y separación uniforme de `60 px`).
   - Evitar bloques asimétricos desproporcionados o columnas vacías.
3. **Márgenes y Padding Interior:**
   - Mantener un margen interior mínimo de **40 px** respecto a los bordes del marco contenedor.
   - Dejar un espacio de entre **30 px y 40 px** entre filas y columnas de tarjetas.
   - Ningún elemento puede solaparse ni salirse de las fronteras físicas de su marco.

---

## 3. Dimensionamiento y Reglas de Componentes

### 3.1. Widgets y Enlaces Web / YouTube (`type: 'embed'`)
- **Prohibido hacer tarjetas gigantes:** Los widgets de vídeo y páginas web deben tener un tamaño compacto y comedido.
- **Dimensiones recomendadas para embeds:**
  - En rejilla de 2 columnas dentro de un marco: **Ancho ~740 a 755 px** por **Alto ~360 a 390 px**.
  - En rejilla compacta o lateral: **Ancho ~360 px** por **Alto ~240 a 280 px**.
- **Propiedades obligatorias:**
  - `title`: Título claro y conciso del vídeo o recurso.
  - `domain`: Dominio en mayúsculas (ej. `YOUTUBE.COM`, `NASA.GOV`).
  - `url`: Enlace funcional directo.
  - `src`: Para YouTube, miniatura oficial verificada (`https://img.youtube.com/vi/<id>/hqdefault.jpg`).
  - `description`: Resumen de 1 o 2 líneas explicativas.

### 3.2. Imágenes (`type: 'image'`)
- **Acompañamiento Texto-Imagen:** Cada bloque temático debe combinar texto explicativo con una imagen o vídeo adyacente para facilitar la lectura visual simultánea. La imagen aporta el dato visual empírico y el texto desglosa los conceptos técnicos.
- **Proporciones Estándar:** Mantener proporciones coherentes (preferente 16:9, ej. `745 × 390 px` o `745 × 420 px`, o la proporción nativa del diagrama si es vertical). **Prohibido estirar imágenes** en formatos panorámicos deformados (ej. 1600×200 px).
- **Almacenamiento Local (100% Offline):** Para evitar fallos de red, bloqueos por hotlinking (403 Forbidden) o enlaces rotos futuros (404), las imágenes deben residir físicamente en el entorno local (ej. `../extracted_board/<archivo>` o `assets/<tablero>/<archivo>`).

### 3.3. Tarjetas de Texto y Apuntes (`type: 'text'`)
- **Jerarquía y Formato:**
  - Fondo relleno (`fillColor: '#161b26'`) con texto claro (`textColor: '#f1f5f9'`).
  - Encabezados internos con viñetas destacadas (•) y guiones descriptivos (-).
  - Títulos de tarjeta en tamaño `15-16px` negrita y cuerpo de lectura en `13-14px`.
  - **Alineación a la izquierda:** El texto de apuntes técnicos siempre debe leerse alineado a la izquierda para máxima legibilidad.

### 3.4. Flechas y Conectores (`type: 'connector'`)
- **REGLA ESTRICTA:** **NO USAR FLECHAS POR DEFECTO.**
- Las flechas cruzan el lienzo de forma caótica si hay muchos elementos. Solo se admitirán conectores locales cortos si el usuario lo solicita explícitamente para un diagrama de flujo puntual muy concreto. En caso de duda, **omitir conectores** y confiar en la cuadrícula visual.

---

## 4. Metodología de Obtención de Imágenes y Generación de Contenidos

Para garantizar tableros de máxima calidad, específicos y consistentes en cualquier área del conocimiento (sin depender de fotos genéricas de stock ni sufrir caídas de enlaces externos), se establece la siguiente metodología:

### 4.1. Flujo Preferente: Aportación de Imágenes por el Usuario + Análisis Multimodal de la IA

Este es el método estándar recomendado para crear tableros personalizados de alto valor:

1. **Recepción de Imágenes:**
   - El usuario proporciona las imágenes directamente en el chat o las deposita en una carpeta local del proyecto (ej. `app_bundle/assets/<nombre_tablero>/`).
   - Pueden ser capturas de pantalla, infografías, esquemas de arquitectura, fotos de apuntes, diagramas de flujo o ilustraciones técnicas.
2. **Análisis Multimodal con Visión Artificial:**
   - La IA examina cada imagen en detalle: lee textos incrustados, etiquetas, ecuaciones, componentes y relaciones lógicas del diagrama.
3. **Redacción de Contenido Contextual Asociado:**
   - La IA redacta notas técnicas explicativas adaptadas exactamente al contenido de cada imagen.
   - La imagen y su tarjeta de texto se colocan en disposición paralela (lado a lado o imagen arriba y texto abajo) dentro del marco temático correspondiente.
4. **Persistencia Local Garantizada:**
   - La IA guarda la imagen en la estructura local del proyecto y la referencia en el JSON con su ruta relativa. Así el tablero carga al instante y funciona **100% offline**, idéntico a los tableros importados de Miro.

### 4.2. Flujo Secundario: Búsqueda Asistida y Descarga Local por la IA

Si el usuario no dispone de imágenes y solicita que la IA las localice:

1. **Evitar Enlaces Frágiles de la Web Abierta:**
   - No usar URLs de blogs o páginas comerciales con protección Cloudflare o anti-hotlinking (que causan pantallas blancas o errores 403/404).
2. **Uso de Archivos Abiertos Estructurados:**
   - Recurrir a APIs públicas y abiertas con repositorios estables:
     - **Wikimedia Commons API:** Millones de esquemas, diagramas científicos, mapas e ilustraciones de dominio público para casi cualquier disciplina (física, historia, software, biología).
     - **Repositorios Científicos Abiertos:** Como la API oficial de la NASA (`images.nasa.gov`), arXiv o bibliotecas públicas.
3. **Descarga Física en Disco Obligatoria:**
   - La IA debe ejecutar un script en Node.js que descargue los archivos `.jpg`/`.png` físicamente al almacenamiento local antes de generar el JSON, verificando que el archivo existe y es válido.

### 4.3. Estructuración y Curación de Secciones

Todo tablero debe respetar la siguiente organización temática:
- **Hero Superior:** Resumen ejecutivo + 6 píldoras de datos, fórmulas o métricas clave.
- **Bloques Principales (2 a 4 secciones temáticas):** Marcos contenedores con títulos claros donde cada imagen va acompañada de su análisis técnico.
- **Bloque de Recursos / Divulgación:** Canales especializados, documentales y enlaces interactivos en tarjetas compactas.
- **Bloque Teórico / Fundamentos:** Leyes, principios o síntesis final del tema.

---

## 5. Especificaciones Técnicas y Ciclo de Vida del JSON

1. **Estructura Raíz Obligatoria:**
   ```json
   {
     "name": "NombreDelTablero",
     "title": "NombreDelTablero",
     "updatedAt": "2026-10-14T12:00:00.000Z",
     "seedVersion": 8,
     "userModified": false,
     "items": []
   }
   ```
2. **Incrementar siempre `seedVersion`:**
   - Al regenerar o actualizar un tablero de semilla, incrementar `seedVersion` para que `board_app.js` purgue la caché local de IndexedDB.
3. **Persistencia Dual en Disco:**
   - Escribir siempre el JSON tanto en `boards/<id>.json` como en `app_bundle/boards/<id>.json`.
4. **Registro en el Catálogo de la App (`app_bundle/whiteboard/board_app.js`):**
   - Registrar la miniatura en `DEFAULT_BOARD_THUMBNAILS['<id>']`.
   - Añadir la entrada del tablero a `defaultBoards` dentro de `loadWorkspaceBoards()`.
   - Comprobar la condición de purga en `loadInitialBoard` y `switchBoard` para el nuevo `id`.
5. **Recompilación del Paquete Distribuible:**
   - Ejecutar `npm run build` tras actualizar los archivos para refrescar `dist/app.asar`.

---

## 6. Lista de Verificación Rápida (Checklist Pre-Entrega)

- [ ] ¿Todos los colores pertenecen a la gama de grises, negros y grises azulados?
- [ ] ¿Se han eliminado por completo las notas pastel amarillo/verde/rosa y los marcos saturados?
- [ ] ¿Los marcos tienen títulos claros e identificables en la cabecera?
- [ ] ¿Las tarjetas de enlaces y vídeos de YouTube tienen un tamaño compacto y no gigante?
- [ ] ¿Las imágenes acompañan a los textos de forma balanceada con ratio 16:9 o su proporción nativa?
- [ ] ¿Las imágenes están almacenadas en local o descargadas en disco (100% offline, sin URLs rotas ni 403)?
- [ ] ¿Cada imagen ha sido analizada y cuenta con texto técnico complementario a su lado?
- [ ] ¿Se ha cumplido la regla de **NO poner flechas**?
- [ ] ¿El archivo JSON es sintácticamente válido y sin coordenadas `NaN`?
- [ ] ¿Se ha incrementado el `seedVersion` y actualizado tanto `boards/` como `app_bundle/boards/`?
