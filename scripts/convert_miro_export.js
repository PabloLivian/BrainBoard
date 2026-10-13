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

const embedRules = [
  // 1. RECURSOS section
  { match: (u, t) => u.includes('scrollxui') || t.includes('scrollx'), src: '../extracted_board/3458764517509523994.png', title: 'ScrollX UI - Interactive React Components...', description: 'ScrollX UI is an open-source library with customizable, animated, interactive React components to help developers build first, visually appealing UIs.' },
  { match: (u, t) => u.includes('reactbits') || t.includes('react bits'), src: '../extracted_board/3458764517509519997.png', title: 'React Bits', description: 'An open source collection of high quality, animated, interactive & fully customizable React components for building stunning, memorable u...' },
  { match: (u, t) => u.includes('untitledui'), src: '../extracted_board/3458764517477372552.jpg', title: 'Untitled UI - Figma UI Kit and React Compon...', description: "Is billed as the 'world's largest Figma UI kit and React component library'. Kickstart any project with everything you need to design and develop stun..." },
  { match: (u, t) => u.includes('system-prompts') || u.includes('nanobananaproprompts'), src: '../extracted_board/3458764517478043354.png', title: 'GitHub - x1xhlol/system-prompts-and-models-of-ai-tools', description: 'Full, Approved Code, Clever Code, Quality Code, Redundancy, Clutter, Curves, Tables AI, Jamovi, Miro, Unleashed, Unleash, Manuals, Hidden AI, Directives...' },
  { match: (u, t) => u.includes('swapy') || t.includes('swapy'), src: '../extracted_board/3458764517480665009.png', title: 'Swapy, a simple JavaScript tool for converting...', description: 'A simple JavaScript tool for converting any layout you have to drag-to-swap layout.' },
  { match: (u, t) => u.includes('npmtrends') || t.includes('npm trends') || t.includes('npmtrends'), src: '../extracted_board/3458764517492930057.png', title: 'npm trends: Compare NPM package downloads', description: 'Which NPM package should you use? Compare packages: download stats, bundle sizes, github stars and more. Spot trends, pick the winner.' },
  { match: (u, t) => u.includes('unavatar') || t.includes('unavatar'), src: '../extracted_board/3458764517492598138.png', title: 'unavatar', description: 'The universal avatar service that offers everything you need to easily retrieve user avatars' },
  { match: (u, t) => u.includes('allsvgicons') || t.includes('allsvgicons'), src: '../extracted_board/3458764517480685287.png', title: 'All SVG Icons - Free and Open Source SVG Vec...', description: 'Browse and download 250,000+ free SVG icons for your projects. Use as Web Fonts and customize, Copy Raw SVG code or download as PNG, SVG...' },
  { match: (u, t) => u.includes('profile-readme-generator'), src: '../extracted_board/3458764517509492692.png', title: 'Profile Readme Generator', description: 'Beautify your github profile with this amazing tool, creating the readme your profile deserves! Feel free to visit the profile readme generator you will find...' },
  { match: (u, t) => u.includes('gitdocify'), src: '', title: 'GitDocify', description: 'Instant, Professional, Code Documentation. Document your code in seconds with AI.' },
  { match: (u, t) => u.includes('daisyui'), src: '', title: 'daisyUI — Tailwind CSS Components', description: 'The most popular, free and open-source Tailwind CSS component library.' },
  { match: (u, t) => u.includes('animejs') || t.includes('anime.js'), src: '../extracted_board/3458764517509516195.png', title: 'Anime.js | JavaScript Animation Engine', description: 'A fast and versatile JavaScript animation library' },
  { match: (u, t) => u.includes('stitch.withgoogle.com'), src: '../extracted_board/3458764517494401517.png', title: 'Stitch - Design with AI', description: 'Stitch generates UIs for mobile and web applications, mixing design intention fast and easy.' },
  { match: (u, t) => u.includes('hologram-particles'), src: '../extracted_board/3458764517967499097.png', title: 'GitHub - cortiz2894/hologram-particles', description: 'A webgl/three.js hologram particle effect built with Three.js/WebGL, Noise Shaders, and WebGL. This repository is a free open-source resource for...' },
  { match: (u, t) => u.includes('websitevice') || t.includes('websitevice'), src: '../extracted_board/3458764517478105021.jpg' },
  { match: (u, t) => u.includes('developer-portfolios'), src: '../extracted_board/3458764517991228105.png' },
  { match: (u, t) => u.includes('awwwards') || t.includes('awwwards'), src: '../extracted_board/3458764517873211164.jpg' },
  { match: (u, t) => u.includes('stevenolver') || t.includes('stevenolver'), src: '../extracted_board/3458764517873211164.jpg' },
  { match: (u, t) => u.includes('tradingview.com/lightweight-charts') || t.includes('lightweight charts'), src: '../extracted_board/3458764517478079397.jpg' },
  { match: (u, t) => u.includes('pexels.com') || t.includes('pexels'), src: '../extracted_board/3458764517966736743.jpg' },
  { match: (u, t) => u.includes('tweakcn.com') || t.includes('tweakcn'), src: '../extracted_board/3458764517540044281.png' },
  { match: (u, t) => u.includes('tailframes.com') || t.includes('tailframes'), src: '../extracted_board/3458764517480618703.jpg' },
  { match: (u, t) => u.includes('100vibecoding'), src: '../extracted_board/3458764517478108959.png' },
  { match: (u, t) => u.includes('midudev/jscamp'), src: '../extracted_board/3458764517485645384.jpg' },
  { match: (u, t) => u.includes('shotdeck.com') || t.includes('shotdeck'), src: '../extracted_board/3458764517966720474.jpg' },
  { match: (u, t) => u.includes('michaeltanzillo'), src: '../extracted_board/3458764517991339081.png' },
  { match: (u, t) => u.includes('hashgraphvc'), src: '../extracted_board/3458764517991203410.png' },
  { match: (u, t) => u.includes('devdocs.io') || t.includes('devdocs'), src: '../extracted_board/3458764517478090111.png' },
  { match: (u, t) => u.includes('database.build') || t.includes('database'), src: '../extracted_board/3458764517477378523.png' },
  { match: (u, t) => u.includes('codecademy.com'), src: '../extracted_board/3458764516866751278.png' },
  { match: (u, t) => u.includes('top-100-comfyui'), src: '../extracted_board/3458764517940451934.png' },
  { match: (u, t) => u.includes('flux-lora-portrait-trainer'), src: '../extracted_board/3458764518239369352.png' },
  { match: (u, t) => u.includes('learngitbranching'), src: '../extracted_board/3458764517478046803.png' },
  { match: (u, t) => u.includes('openmodeldb'), src: '../extracted_board/3458764517503661529.png' }
];

function findResourceForEmbed(it) {
  const u = it.url || '';
  const pu = it.previewUrl || '';
  const uLower = u.toLowerCase();
  const tLower = (it.title || '').toLowerCase();

  for (const rule of embedRules) {
    if (rule.match(uLower, tLower)) {
      return { src: rule.src, title: rule.title, description: rule.description };
    }
  }

  // 2. Coincidencia directa con previewUrl por filename o name
  if (pu) {
    const direct = fileDims.find(r => pu.includes(r.filename) || (r.name && pu.includes(r.name)));
    if (direct) {
      assignedImageFiles.add(direct.id);
      return { src: direct.localPath };
    }
  }
  // 3. Coincidencia específica para YouTube
  if (u.includes('youtube.com')) {
    const ytMatch = fileDims.find(r => !assignedImageFiles.has(r.id) && (r.filename.includes('=s900') || r.filename.includes('default.jpg') || (r.name && r.name.includes('default.jpg'))));
    if (ytMatch) {
      assignedImageFiles.add(ytMatch.id);
      return { src: ytMatch.localPath };
    }
  }
  return { src: '' };
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
    const res = findResourceForEmbed(it);
    let src = res.src || '';

    convertedItems.push({
      id: it.id,
      type: 'embed',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      title: res.title || it.title || info.title,
      domain: info.domain,
      url: uStr,
      src,
      description: res.description || it.description || ''
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
