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
        name: r.name || '',
        width: dim.width,
        height: dim.height,
        ratio: dim.width / dim.height
      });
    }
  }
}

function cleanText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
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

// Extraer info formateada de URL para widgets de enlaces (Web Bookmark Cards)
function getUrlWidgetInfo(urlStr) {
  if (!urlStr) return { domain: 'ENLACE', title: 'Enlace web' };
  try {
    const u = new URL(urlStr);
    let domain = u.hostname.replace(/^www\./, '').toUpperCase();
    let title = '';

    if (domain.includes('YOUTUBE')) {
      const match = u.pathname.match(/@([^\/\?]+)/);
      if (match) {
        title = `@${match[1]}`;
      } else {
        const v = u.searchParams.get('v');
        title = v ? `Video: ${v}` : 'YouTube';
      }
    } else if (domain.includes('GITHUB')) {
      const parts = u.pathname.split('/').filter(Boolean);
      title = parts.length > 0 ? parts.join('/') : 'GitHub';
    } else {
      const pathClean = decodeURIComponent(u.pathname.replace(/^\/|\/$/g, ''));
      if (pathClean) {
        const parts = pathClean.split('/');
        let t = parts[parts.length - 1].replace(/[-_]/g, ' ');
        title = t.charAt(0).toUpperCase() + t.slice(1);
      } else {
        const parts = domain.split('.');
        const siteName = parts[0];
        title = siteName.charAt(0).toUpperCase() + siteName.slice(1).toLowerCase();
      }
    }
    return { domain, title };
  } catch (e) {
    return { domain: 'ENLACE', title: urlStr };
  }
}

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
      const cx = pBounds.x + (it.x || 0);
      const cy = pBounds.y + (it.y || 0);
      if (it.origin === 'center') {
        return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
      } else {
        return { x: cx, y: cy, width: w, height: h };
      }
    }
  }

  if (it.origin === 'center') {
    return { x: (it.x || 0) - w / 2, y: (it.y || 0) - h / 2, width: w, height: h };
  } else {
    return { x: it.x || 0, y: it.y || 0, width: w, height: h };
  }
}

// 5. Convertir todos los elementos
const convertedItems = [];
const assignedImageFiles = new Set();

function findResourceForEmbed(it) {
  const u = it.url || '';
  const pu = it.previewUrl || '';
  // 1. Coincidencia directa con previewUrl por filename o name
  if (pu) {
    const direct = fileDims.find(r => pu.includes(r.filename) || (r.name && pu.includes(r.name)));
    if (direct) {
      assignedImageFiles.add(direct.id);
      return direct.localPath;
    }
  }
  // 2. Coincidencia específica para YouTube
  if (u.includes('youtube.com')) {
    const ytMatch = fileDims.find(r => !assignedImageFiles.has(r.id) && (r.filename.includes('=s900') || r.filename.includes('default.jpg') || (r.name && r.name.includes('default.jpg'))));
    if (ytMatch) {
      assignedImageFiles.add(ytMatch.id);
      return ytMatch.localPath;
    }
  }
  // 3. Coincidencia por dominio o nombre
  if (u) {
    try {
      const host = new URL(u).hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
      if (host.length > 2) {
        const m = fileDims.find(r => !assignedImageFiles.has(r.id) && ((r.name && r.name.toLowerCase().includes(host)) || (r.filename && r.filename.toLowerCase().includes(host))));
        if (m) {
          assignedImageFiles.add(m.id);
          return m.localPath;
        }
      }
    } catch (err) {}
  }
  return '';
}

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

  // MARCOS / FRAMES (Columnas y secciones con fondo)
  if (it.type === 'frame') {
    convertedItems.push({
      id: it.id,
      type: 'frame',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      title: it.title || '',
      fillColor: mapColor(it.style?.fillColor || '#bbcbd2')
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

  // TEXTOS (text y table_text: incluye cabeceras, tarjetas y bloques con fondo)
  if (it.type === 'text' || it.type === 'table_text') {
    const hasFill = Boolean(it.style?.fillColor && it.style.fillColor !== 'transparent');
    convertedItems.push({
      id: it.id,
      type: 'text',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      text: cleanText(it.content),
      fontSize: Math.round(it.style?.fontSize || 16),
      fillColor: hasFill ? mapColor(it.style.fillColor) : null,
      color: mapColor(it.style?.color || (hasFill ? '#ffffff' : '#1a1a1a')),
      textAlign: it.style?.textAlign || (hasFill ? 'center' : 'left')
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

  // EMBEDS Y PREVIEWS (Web Bookmark Widgets)
  if (it.type === 'embed' || it.type === 'preview') {
    const uStr = it.url || it.previewUrl || '';
    const info = getUrlWidgetInfo(uStr);
    let src = findResourceForEmbed(it);

    if (!src) {
      const ratio = bounds.width / bounds.height;
      const candidate = fileDims.find(f => !assignedImageFiles.has(f.id) && Math.abs(f.ratio - ratio) < 0.05);
      if (candidate) {
        src = candidate.localPath;
        assignedImageFiles.add(candidate.id);
      }
    }

    convertedItems.push({
      id: it.id,
      type: 'embed',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      title: it.title || info.title,
      domain: info.domain,
      url: uStr,
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
