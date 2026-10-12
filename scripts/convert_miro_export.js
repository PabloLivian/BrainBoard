const fs = require('fs');
const path = require('path');

// Cargar mapa de recursos y JSON exportado por el usuario
const resourcesMap = JSON.parse(fs.readFileSync('app_bundle/whiteboard/resources_map.json', 'utf8'));
const rawData = JSON.parse(fs.readFileSync('c:/Users/Usuario/Desktop/DEV_AI.json', 'utf8'));

// 1. Obtener dimensiones físicas de las imágenes extraídas
function getDimensions(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (filePath.endsWith('.png')) {
      if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504E47) {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      }
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] === 0xFF && (buf[offset + 1] === 0xC0 || buf[offset + 1] === 0xC2)) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        }
        offset += 1;
      }
    }
  } catch (e) {}
  return null;
}

const fileDims = [];
for (const [id, r] of Object.entries(resourcesMap)) {
  const full = path.join('extracted_board', r.filename);
  if (fs.existsSync(full)) {
    const dim = getDimensions(full);
    if (dim) {
      fileDims.push({
        id,
        filename: r.filename,
        localPath: r.localPath,
        width: dim.width,
        height: dim.height,
        ratio: dim.width / dim.height
      });
    }
  }
}

// 2. Limpiador de HTML
function cleanText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#43;/g, '+')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// 3. Mapeo de colores Miro
const colorMap = {
  light_yellow: '#fff9b0', yellow: '#ffec3d',
  light_green: '#d5f692', green: '#73d13d',
  light_blue: '#cbf3f9', blue: '#40a9ff',
  light_pink: '#ffcce1', pink: '#ff85c0',
  violet: '#e1d4f9', gray: '#e5e5e5',
  black: '#1a1a1a', white: '#ffffff',
  transparent: 'transparent'
};
const mapColor = (col) => colorMap[col] || col || '#ffffff';

// 4. Indexar items por ID para resolver coordenadas jerárquicas
const itemsById = new Map();
rawData.items.forEach(it => itemsById.set(it.id, it));

// Cálculo de coordenadas absolutas en el lienzo
function getWorldBounds(it) {
  const w = it.width || 100;
  const h = it.height || 40;

  if (it.relativeTo === 'parent_top_left' && it.parentId) {
    const parent = itemsById.get(it.parentId);
    if (parent) {
      const pBounds = getWorldBounds(parent);
      const cx = pBounds.x + it.x;
      const cy = pBounds.y + it.y;
      if (it.origin === 'center') {
        return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
      } else {
        return { x: cx, y: cy, width: w, height: h };
      }
    }
  }

  if (it.origin === 'center') {
    return { x: it.x - w / 2, y: it.y - h / 2, width: w, height: h };
  } else {
    return { x: it.x || 0, y: it.y || 0, width: w, height: h };
  }
}

// 5. Convertir todos los elementos
const convertedItems = [];
const assignedImageFiles = new Set();

rawData.items.forEach(it => {
  const bounds = getWorldBounds(it);

  // NOTAS ADHESIVAS
  if (it.type === 'sticky_note') {
    convertedItems.push({
      id: it.id,
      type: 'sticky_note',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      text: cleanText(it.content),
      color: mapColor(it.style?.fillColor)
    });
    return;
  }

  // MARCOS / FRAMES
  if (it.type === 'frame') {
    convertedItems.push({
      id: it.id,
      type: 'frame',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      title: it.title || ''
    });
    return;
  }

  // FORMAS / SHAPES
  if (it.type === 'shape') {
    let shapeType = 'rectangle';
    if (it.shape === 'round_rectangle') shapeType = 'rounded';
    else if (it.shape === 'circle') shapeType = 'circle';
    else if (it.shape === 'rhombus') shapeType = 'diamond';
    else if (it.shape === 'triangle') shapeType = 'triangle';

    convertedItems.push({
      id: it.id,
      type: 'shape',
      shape: shapeType,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      text: cleanText(it.content),
      fillColor: mapColor(it.style?.fillColor),
      strokeColor: mapColor(it.style?.borderColor || it.style?.color || '#1a1a1a'),
      strokeWidth: it.style?.borderWidth || 1
    });
    return;
  }

  // TEXTOS (text y table_text)
  if (it.type === 'text' || it.type === 'table_text') {
    convertedItems.push({
      id: it.id,
      type: 'text',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      text: cleanText(it.content),
      fontSize: Math.round(it.style?.fontSize || 16),
      color: mapColor(it.style?.color || '#1a1a1a')
    });
    return;
  }

  // BLOQUES DE CÓDIGO
  if (it.type === 'code') {
    convertedItems.push({
      id: it.id,
      type: 'code',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      title: it.title || 'Code',
      text: cleanText(it.content)
    });
    return;
  }

  // IMÁGENES
  if (it.type === 'image') {
    let src = '';
    const ratio = bounds.width / bounds.height;
    // Buscar el mejor archivo por relación de aspecto
    const candidate = fileDims.find(f => !assignedImageFiles.has(f.id) && Math.abs(f.ratio - ratio) < 0.04);
    if (candidate) {
      src = candidate.localPath;
      assignedImageFiles.add(candidate.id);
    } else {
      // Si no encuentra por ratio exacto, buscar cualquier archivo no asignado cercano
      const fallback = fileDims.find(f => !assignedImageFiles.has(f.id));
      if (fallback) {
        src = fallback.localPath;
        assignedImageFiles.add(fallback.id);
      }
    }

    convertedItems.push({
      id: it.id,
      type: 'image',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      src
    });
    return;
  }

  // EMBEDS Y PREVIEWS
  if (it.type === 'embed' || it.type === 'preview') {
    let src = '';
    const ratio = bounds.width / bounds.height;
    const candidate = fileDims.find(f => !assignedImageFiles.has(f.id) && Math.abs(f.ratio - ratio) < 0.05);
    if (candidate) {
      src = candidate.localPath;
      assignedImageFiles.add(candidate.id);
    }

    convertedItems.push({
      id: it.id,
      type: 'embed',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      title: it.title || '',
      url: it.url || it.previewUrl || '',
      src
    });
    return;
  }

  // CONECTORES Y CURVAS
  if (it.type === 'connector' || it.type === 'curve') {
    let startPoint = { x: bounds.x, y: bounds.y };
    let endPoint = { x: bounds.x + bounds.width, y: bounds.y + bounds.height };

    if (it.start?.item && itemsById.has(it.start.item)) {
      const startItem = getWorldBounds(itemsById.get(it.start.item));
      const pos = it.start.position || { x: 0.5, y: 0.5 };
      startPoint = { x: startItem.x + startItem.width * pos.x, y: startItem.y + startItem.height * pos.y };
    } else if (it.start?.point) {
      startPoint = it.start.point;
    }

    if (it.end?.item && itemsById.has(it.end.item)) {
      const endItem = getWorldBounds(itemsById.get(it.end.item));
      const pos = it.end.position || { x: 0.5, y: 0.5 };
      endPoint = { x: endItem.x + endItem.width * pos.x, y: endItem.y + endItem.height * pos.y };
    } else if (it.end?.point) {
      endPoint = it.end.point;
    }

    convertedItems.push({
      id: it.id,
      type: 'connector',
      start: startPoint,
      end: endPoint,
      color: mapColor(it.style?.strokeColor || '#1a1a1a'),
      strokeWidth: it.style?.strokeWidth || 2
    });
    return;
  }

  // TABLAS
  if (it.type === 'table') {
    convertedItems.push({
      id: it.id,
      type: 'shape',
      shape: 'rectangle',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fillColor: '#ffffff',
      strokeColor: '#cbd5e1',
      strokeWidth: 1
    });
    return;
  }
});

console.log('Total items procesados con coordenadas exactas:', convertedItems.length);

const outputBoard = {
  name: 'DEV / AI',
  updatedAt: new Date().toISOString(),
  items: convertedItems
};

fs.writeFileSync('boards/DEV_AI.json', JSON.stringify(outputBoard, null, 2));
console.log('boards/DEV_AI.json guardado con éxito.');
