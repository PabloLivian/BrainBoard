const fs = require('fs');
const path = require('path');

function generateSpaceBoard() {
  const items = [];
  let idCounter = 1000;
  const nextId = (prefix) => `${prefix}_${Date.now()}_${idCounter++}`;

  // ==========================================
  // 1. HERO BANNER: ODYSSEY CÓSMICA
  // ==========================================
  const heroFrameId = nextId('frame_hero');
  items.push({
    id: heroFrameId,
    type: 'frame',
    x: 0,
    y: 0,
    width: 4800,
    height: 520,
    title: '🌌 ODYSSEY: ENCICLOPEDIA CÓSMICA & EXPLORACIÓN ESPACIAL',
    fillColor: '#161922'
  });

  // Título principal
  items.push({
    id: nextId('text_hero_title'),
    type: 'text',
    parentId: heroFrameId,
    x: 40,
    y: 50,
    width: 1400,
    height: 90,
    text: 'EXPEDICIÓN COSMOS: DE LA TIERRA A LAS ESTRELLAS',
    fontSize: 34,
    color: '#38bdf8',
    fontWeight: 'bold'
  });

  // Subtítulo
  items.push({
    id: nextId('text_hero_sub'),
    type: 'text',
    parentId: heroFrameId,
    x: 40,
    y: 140,
    width: 1300,
    height: 70,
    text: 'Un recorrido visual exhaustivo por la astrofísica moderna, las próximas misiones tripuladas, los observatorios de nueva generación y los documentales indispensables para comprender nuestro lugar en el Universo.',
    fontSize: 16,
    color: '#94a3b8'
  });

  // Citas célebres en notas adhesivas
  items.push({
    id: nextId('sticky_sagan'),
    type: 'sticky_note',
    parentId: heroFrameId,
    x: 1480,
    y: 60,
    width: 280,
    height: 200,
    text: '«El cosmos está dentro de nosotros. Estamos hechos de materia estelar. Somos el medio para que el cosmos se conozca a sí mismo.»\n\n— Carl Sagan',
    color: '#d0f0fd'
  });

  items.push({
    id: nextId('sticky_tsiolkovsky'),
    type: 'sticky_note',
    parentId: heroFrameId,
    x: 1800,
    y: 60,
    width: 280,
    height: 200,
    text: '«La Tierra es la cuna de la humanidad, pero no se puede vivir en la cuna para siempre.»\n\n— Konstantin Tsiolkovsky (1911)',
    color: '#fff9b1'
  });

  items.push({
    id: nextId('sticky_hawking'),
    type: 'sticky_note',
    parentId: heroFrameId,
    x: 2120,
    y: 60,
    width: 280,
    height: 200,
    text: '«Recuerda mirar hacia arriba a las estrellas y no hacia abajo a tus pies. Intenta encontrar sentido a lo que ves y pregúntate qué hace que el universo exista.»\n\n— Stephen Hawking',
    color: '#f3d9fa'
  });

  // Métricas cósmicas en Shapes
  const metrics = [
    { title: 'EDAD DEL UNIVERSO', val: '13.787 ± 0.020 Ga', desc: 'Medido por satélite Planck', color: '#1e293b', border: '#38bdf8' },
    { title: 'VELOCIDAD DE LA LUZ', val: '299.792.458 m/s', desc: 'Constante cósmica (c)', color: '#1e293b', border: '#10b981' },
    { title: 'UNIVERSO OBSERVABLE', val: '93.000 Millones AL', desc: 'Radio aparente por expansión métrica', color: '#1e293b', border: '#f59e0b' },
    { title: 'GALAXIAS ESTIMADAS', val: '2 × 10¹² Galaxias', desc: '2 billones en el volumen observable', color: '#1e293b', border: '#ec4899' },
    { title: 'FONDO CÓSMICO (CMB)', val: '2.725 Kelvin', desc: 'Eco remanente del Big Bang', color: '#1e293b', border: '#8b5cf6' },
    { title: 'DISTANCIA A PROXIMA CENTAURI', val: '4.246 Años-Luz', desc: 'Nuestra estrella vecina más próxima', color: '#1e293b', border: '#06b6d4' }
  ];

  metrics.forEach((m, idx) => {
    const mx = 40 + idx * 460;
    const my = 290;
    items.push({
      id: nextId('shape_metric_' + idx),
      type: 'shape',
      shape: 'rectangle',
      parentId: heroFrameId,
      x: mx,
      y: my,
      width: 430,
      height: 180,
      fillColor: m.color,
      strokeColor: m.border,
      strokeWidth: 2,
      text: `${m.title}\n\n${m.val}\n${m.desc}`,
      textColor: '#ffffff',
      fontSize: 14
    });
  });

  // ==========================================
  // 2. COLUMNA 1: 🚀 PRÓXIMAS MISIONES (X: 0 a 1550)
  // ==========================================
  const missionsFrameId = nextId('frame_missions');
  items.push({
    id: missionsFrameId,
    type: 'frame',
    x: 0,
    y: 570,
    width: 1550,
    height: 2900,
    title: '🚀 LA NUEVA FRONTERA: MISIONES TRIPULADAS Y EXPLORACIÓN (2025-2035)',
    fillColor: '#181b24'
  });

  // Subtítulo de Artemis
  items.push({
    id: nextId('text_artemis_header'),
    type: 'text',
    parentId: missionsFrameId,
    x: 40,
    y: 620,
    width: 1470,
    height: 40,
    text: '🌙 PROGRAMA ARTEMIS: EL REGRESO TRIPULADO A LA LUNA Y EL POLO SUR',
    fontSize: 22,
    color: '#60a5fa',
    fontWeight: 'bold'
  });

  items.push({
    id: nextId('text_artemis_body'),
    type: 'text',
    parentId: missionsFrameId,
    x: 40,
    y: 670,
    width: 1470,
    height: 80,
    text: 'El programa internacional liderado por NASA y ESA busca establecer presencia sostenible en la Luna. El objetivo clave es el cráter Shackleton en el Polo Sur lunar, donde existen depósitos masivos de hielo de agua en sombra permanente, recurso esencial para producir oxígeno y combustible de hidrógeno.',
    fontSize: 14,
    color: '#cbd5e1'
  });

  // Embed Vídeo Artemis
  items.push({
    id: nextId('embed_artemis_yt'),
    type: 'embed',
    parentId: missionsFrameId,
    x: 40,
    y: 770,
    width: 340,
    height: 270,
    title: 'NASA | Artemis I Launch to Splashdown (Highlights)',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=aG_j8p1wPJE',
    src: 'https://img.youtube.com/vi/aG_j8p1wPJE/hqdefault.jpg',
    description: 'Resumen en vídeo del vuelo de prueba del cohete SLS y la nave Orion recorriendo 2.2 millones de kilómetros.'
  });

  // Embed Web Artemis Oficial
  items.push({
    id: nextId('embed_artemis_web'),
    type: 'embed',
    parentId: missionsFrameId,
    x: 410,
    y: 770,
    width: 340,
    height: 270,
    title: 'NASA Artemis Program Official Portal',
    domain: 'NASA.GOV',
    url: 'https://www.nasa.gov/specials/artemis/',
    src: '',
    description: 'Portal oficial con la arquitectura de misión, trajes AxEMU y planes de la estación Gateway.'
  });

  // Imagen física de Artemis extraída
  items.push({
    id: nextId('img_artemis_diagram'),
    type: 'image',
    parentId: missionsFrameId,
    x: 780,
    y: 770,
    width: 720,
    height: 405,
    src: '../extracted_board/3458764515586134432.png',
    url: 'https://www.nasa.gov/specials/artemis/'
  });

  // Hitos Artemis en shapes secuenciales con conectores
  const artemisSteps = [
    { title: 'Artemis I', sub: 'Completado (2022)\nTest sin tripulación\nEscudo térmico superado', color: '#065f46' },
    { title: 'Artemis II', sub: 'Programado 2025/26\n4 Astronautas en Orion\nVuelo libre circumlunar', color: '#1e40af' },
    { title: 'Artemis III', sub: 'Alunizaje Polar Sur\nPrimera mujer en la Luna\nStarship Lunar HLS', color: '#3730a3' },
    { title: 'Lunar Gateway', sub: 'Estación en órbita lunar\nMódulo HALO y PPE\nHub de paso a Marte', color: '#581c87' }
  ];

  const stepIds = [];
  artemisSteps.forEach((st, sIdx) => {
    const sId = nextId('shape_artemis_' + sIdx);
    stepIds.push(sId);
    items.push({
      id: sId,
      type: 'shape',
      shape: 'rectangle',
      parentId: missionsFrameId,
      x: 40 + sIdx * 370,
      y: 1210,
      width: 320,
      height: 120,
      fillColor: st.color,
      strokeColor: '#60a5fa',
      strokeWidth: 1.5,
      text: `${st.title}\n\n${st.sub}`,
      textColor: '#ffffff',
      fontSize: 13
    });
  });

  // Conectores entre hitos
  for (let i = 0; i < stepIds.length - 1; i++) {
    items.push({
      id: nextId('conn_artemis_' + i),
      type: 'connector',
      start: { item: stepIds[i], position: { x: 1, y: 0.5 } },
      end: { item: stepIds[i+1], position: { x: 0, y: 0.5 } },
      style: 'straight',
      color: '#38bdf8',
      width: 2.5,
      startArrow: false,
      endArrow: true
    });
  }

  // Sección Starship
  items.push({
    id: nextId('text_starship_header'),
    type: 'text',
    parentId: missionsFrameId,
    x: 40,
    y: 1380,
    width: 1470,
    height: 40,
    text: '🔥 SPACEX STARSHIP & SUPER HEAVY: TRANSPORTE MULTIPLANETARIO REUTILIZABLE',
    fontSize: 22,
    color: '#f97316',
    fontWeight: 'bold'
  });

  items.push({
    id: nextId('text_starship_body'),
    type: 'text',
    parentId: missionsFrameId,
    x: 40,
    y: 1430,
    width: 1470,
    height: 70,
    text: 'Con 121 metros de altura y un empuje de despegue de 74 MegaNewtons (el doble que el Saturno V), Starship es el sistema de lanzamiento más potente jamás construido. Su arquitectura 100% reutilizable de metano y oxígeno líquido reduce drásticamente el coste por kg puesto en órbita.',
    fontSize: 14,
    color: '#cbd5e1'
  });

  // Embed Starship YouTube
  items.push({
    id: nextId('embed_starship_yt'),
    type: 'embed',
    parentId: missionsFrameId,
    x: 40,
    y: 1520,
    width: 340,
    height: 270,
    title: 'SpaceX Starship Integrated Flight Test',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=13Q193M_e-0',
    src: 'https://img.youtube.com/vi/13Q193M_e-0/hqdefault.jpg',
    description: 'Lanzamiento, captura del booster Super Heavy con los brazos mecánicos Mechazilla y amerizaje controlado.'
  });

  items.push({
    id: nextId('embed_starship_web'),
    type: 'embed',
    parentId: missionsFrameId,
    x: 410,
    y: 1520,
    width: 340,
    height: 270,
    title: 'SpaceX Starship Official Specs',
    domain: 'SPACEX.COM',
    url: 'https://www.spacex.com/vehicles/starship/',
    src: '',
    description: 'Especificaciones técnicas de motores Raptor V3, losetas de protección térmica y versiones cisterna orbital.'
  });

  items.push({
    id: nextId('sticky_starship_specs'),
    type: 'sticky_note',
    parentId: missionsFrameId,
    x: 780,
    y: 1520,
    width: 340,
    height: 270,
    text: '🚀 DATOS CLAVE DE STARSHIP:\n\n• Altura total: 121 m\n• Diámetro: 9 m\n• Carga a LEO: 150-250 toneladas\n• Motores Booster: 33 Raptor 3\n• Combustible: CH₄ (Metano) + LOX\n• Temperatura Reentrada: 1.400 °C\n• Atrapada: Mechazilla Chopsticks',
    color: '#ffe2cc'
  });

  items.push({
    id: nextId('img_space_poster'),
    type: 'image',
    parentId: missionsFrameId,
    x: 1150,
    y: 1480,
    width: 360,
    height: 640,
    src: '../extracted_board/3458764515586048295.png'
  });

  // Sección Europa Clipper & JWST
  items.push({
    id: nextId('text_europa_header'),
    type: 'text',
    parentId: missionsFrameId,
    x: 40,
    y: 2180,
    width: 1470,
    height: 40,
    text: '❄️ EUROPA CLIPPER & TELESCOPIO ESPACIAL JAMES WEBB (JWST)',
    fontSize: 22,
    color: '#a855f7',
    fontWeight: 'bold'
  });

  items.push({
    id: nextId('embed_europa_clipper'),
    type: 'embed',
    parentId: missionsFrameId,
    x: 40,
    y: 2250,
    width: 340,
    height: 270,
    title: 'NASA Europa Clipper Mission Portal',
    domain: 'EUROPA.NASA.GOV',
    url: 'https://europa.nasa.gov/',
    src: '',
    description: 'Exploración de la luna helada Europa y su océano subsuperficial con el doble de agua que todos los océanos terrestres.'
  });

  items.push({
    id: nextId('embed_jwst_yt'),
    type: 'embed',
    parentId: missionsFrameId,
    x: 410,
    y: 2250,
    width: 340,
    height: 270,
    title: 'How James Webb Changed Astronomy Forever',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=4P8hxYp56_s',
    src: 'https://img.youtube.com/vi/4P8hxYp56_s/hqdefault.jpg',
    description: 'El observatorio infrarrojo que observa las primeras estrellas tras el Big Bang y atmósferas de exoplanetas.'
  });

  items.push({
    id: nextId('embed_jwst_web'),
    type: 'embed',
    parentId: missionsFrameId,
    x: 780,
    y: 2250,
    width: 340,
    height: 270,
    title: 'Webb Space Telescope Gallery & Discoveries',
    domain: 'WEBBTELESCOPE.ORG',
    url: 'https://webbtelescope.org/',
    src: '',
    description: 'Imágenes oficiales de cielo profundo, Pilares de la Creación y espectroscopía de transmisión de K2-18b.'
  });

  items.push({
    id: nextId('img_space_landscape'),
    type: 'image',
    parentId: missionsFrameId,
    x: 40,
    y: 2560,
    width: 600,
    height: 337,
    src: '../extracted_board/3458764515585993688.png'
  });

  items.push({
    id: nextId('sticky_jwst_facts'),
    type: 'sticky_note',
    parentId: missionsFrameId,
    x: 680,
    y: 2560,
    width: 440,
    height: 300,
    text: '🔭 HITOS DEL TELESCOPIO JAMES WEBB:\n\n• Ubicación: Punto de Lagrange L2 (1.5 millones km)\n• Espejo primario: 6.5 metros de berilio dorado\n• Parasol: 5 capas de Kapton del tamaño de una cancha de tenis\n• Temperatura de operación: -233 °C (MIRI a -266 °C)\n• Galaxia más lejana: JADES-GS-z14-0 (nacida solo 290 millones de años tras el Big Bang)',
    color: '#d5fcdb'
  });

  items.push({
    id: nextId('comment_jwst'),
    type: 'comment',
    parentId: missionsFrameId,
    x: 1160,
    y: 2600,
    text: 'La capacidad del Webb de penetrar el polvo interestelar en infrarrojo medio nos ha mostrado guarderías estelares que eran completamente invisibles para Hubble.',
    author: 'Astrofísico invitado',
    resolved: false
  });

  // ==========================================
  // 3. COLUMNA 2: 🎬 DOCUMENTALES & VÍDEOS (X: 1600 a 3150)
  // ==========================================
  const mediaFrameId = nextId('frame_media');
  items.push({
    id: mediaFrameId,
    type: 'frame',
    x: 1600,
    y: 570,
    width: 1550,
    height: 2900,
    title: '🎬 DOCUMENTALES MAESTROS & DIVULGACIÓN CIENTÍFICA INDISPENSABLE',
    fillColor: '#1a1824'
  });

  items.push({
    id: nextId('text_media_header'),
    type: 'text',
    parentId: mediaFrameId,
    x: 1640,
    y: 620,
    width: 1470,
    height: 40,
    text: '🌌 OBRAS MAESTRAS AUDIOVISUALES: DEL BIG BANG AL FIN DE LOS TIEMPOS',
    fontSize: 22,
    color: '#ec4899',
    fontWeight: 'bold'
  });

  items.push({
    id: nextId('text_media_sub'),
    type: 'text',
    parentId: mediaFrameId,
    x: 1640,
    y: 670,
    width: 1470,
    height: 70,
    text: 'Una selección curada de las producciones más fascinantes de la historia sobre astrofísica, relatividad y cosmología. Cada widget contiene acceso directo al contenido con portada en alta resolución.',
    fontSize: 14,
    color: '#cbd5e1'
  });

  // Melodysheep Timelapse of the Future
  items.push({
    id: nextId('embed_future_yt'),
    type: 'embed',
    parentId: mediaFrameId,
    x: 1640,
    y: 770,
    width: 340,
    height: 270,
    title: 'TIMELAPSE OF THE FUTURE: A Journey to the End of Time (4K)',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=uD4izuDMUQA',
    src: 'https://img.youtube.com/vi/uD4izuDMUQA/hqdefault.jpg',
    description: 'Una de las obras maestras de YouTube: viaje sonoro y visual desde el presente hasta la evaporación del último agujero negro.'
  });

  // Melodysheep Timelapse of the Universe
  items.push({
    id: nextId('embed_universe_yt'),
    type: 'embed',
    parentId: mediaFrameId,
    x: 2010,
    y: 770,
    width: 340,
    height: 270,
    title: 'TIMELAPSE OF THE ENTIRE UNIVERSE (10 Mins = 13.8 Billion Years)',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=tbh7S6WWdMc',
    src: 'https://img.youtube.com/vi/tbh7S6WWdMc/hqdefault.jpg',
    description: 'Cada segundo representa 22 millones de años de evolución cósmica. La humanidad aparece en la última fracción de segundo.'
  });

  items.push({
    id: nextId('sticky_future_summary'),
    type: 'sticky_note',
    parentId: mediaFrameId,
    x: 2380,
    y: 770,
    width: 340,
    height: 270,
    text: '⏳ LAS ERAS CÓSMICAS DEL FUTURO:\n\n1. Era Estelífera (Presente - 100 Trillones de años): Las estrellas brillan y se forman planetas.\n2. Era de la Degeneración: Solo enanas blancas, estrellas de neutrones y agujeros negros.\n3. Era de los Agujeros Negros: La radiación de Hawking los disuelve lentamente.\n4. Era Oscura: Solo fotones y electrones a cero absoluto. Muerte térmica.',
    color: '#d0f0fd'
  });

  // Kurzgesagt videos
  items.push({
    id: nextId('text_kurz_header'),
    type: 'text',
    parentId: mediaFrameId,
    x: 1640,
    y: 1100,
    width: 1470,
    height: 40,
    text: '💥 KURZGESAGT: FÍSICA EXTREMA, ESTRELLAS DE NEUTRONES Y AGUJEROS NEGROS',
    fontSize: 20,
    color: '#fbbf24',
    fontWeight: 'bold'
  });

  items.push({
    id: nextId('embed_neutron_yt'),
    type: 'embed',
    parentId: mediaFrameId,
    x: 1640,
    y: 1160,
    width: 340,
    height: 270,
    title: 'Neutron Stars – The Most Extreme Objects in the Universe',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=udFxKZRyQt4',
    src: 'https://img.youtube.com/vi/udFxKZRyQt4/hqdefault.jpg',
    description: 'Explicación visual de estrellas con la masa del Sol comprimida en una esfera de 20 km de diámetro.'
  });

  items.push({
    id: nextId('embed_blackhole_yt'),
    type: 'embed',
    parentId: mediaFrameId,
    x: 2010,
    y: 1160,
    width: 340,
    height: 270,
    title: 'The Black Hole Bomb and Cosmic Destruction',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=ulCdoCfw-bY',
    src: 'https://img.youtube.com/vi/ulCdoCfw-bY/hqdefault.jpg',
    description: 'El fenómeno de la superradiancia y cómo extraer energía rotacional de la ergosfera de un agujero negro de Kerr.'
  });

  items.push({
    id: nextId('embed_fermi_yt'),
    type: 'embed',
    parentId: mediaFrameId,
    x: 2380,
    y: 1160,
    width: 340,
    height: 270,
    title: 'The Fermi Paradox – Where Are All The Aliens?',
    domain: 'YOUTUBE.COM',
    url: 'https://www.youtube.com/watch?v=sNhhvQGsMEc',
    src: 'https://img.youtube.com/vi/sNhhvQGsMEc/hqdefault.jpg',
    description: 'Las hipótesis del Gran Filtro, civilizaciones de Tipo II y la soledad de la humanidad en la Vía Láctea.'
  });

  items.push({
    id: nextId('sticky_fermi_paradox'),
    type: 'sticky_note',
    parentId: mediaFrameId,
    x: 2750,
    y: 1160,
    width: 340,
    height: 270,
    text: '👽 LA PARADOJA DE FERMI:\n\n«Si existen miles de millones de estrellas miles de millones de años más antiguas que el Sol con planetas habitables... ¿Dónde está todo el mundo?»\n\nPosibles respuestas:\n1. El Gran Filtro está detrás de nosotros (somos extraordinariamente raros).\n2. El Gran Filtro está por delante.\n3. Hipótesis del Bosque Oscuro.',
    color: '#fff9b1'
  });

  // Más documentales recomendados en tarjetas y formas
  items.push({
    id: nextId('text_classics_header'),
    type: 'text',
    parentId: mediaFrameId,
    x: 1640,
    y: 1500,
    width: 1470,
    height: 40,
    text: '🎞️ GRANDES OBRAS CLÁSICAS Y SERIES DE DIVULGACIÓN',
    fontSize: 20,
    color: '#34d399',
    fontWeight: 'bold'
  });

  const classicDocs = [
    { title: 'COSMOS: A PERSONAL VOYAGE (1980)', author: 'Carl Sagan', desc: 'La serie seminal de 13 episodios que inspiró a generaciones enteras a mirar el cielo nocturno con asombro y método científico.', color: '#064e3b' },
    { title: 'APOLLO 11 (2019)', author: 'Todd Douglas Miller', desc: 'Documental cinematográfico creado exclusivamente con metraje en 70mm y audios de control de misión desclasificados.', color: '#1e3a8a' },
    { title: 'INTERSTELLAR (2014)', author: 'Christopher Nolan & Kip Thorne', desc: 'Ficción con precisión física rigurosa. Sus ecuaciones generaron la primera simulación computacional exacta de un agujero negro (Gargantua).', color: '#4c1d95' }
  ];

  classicDocs.forEach((cd, cIdx) => {
    items.push({
      id: nextId('shape_doc_' + cIdx),
      type: 'shape',
      shape: 'rectangle',
      parentId: mediaFrameId,
      x: 1640 + cIdx * 480,
      y: 1560,
      width: 440,
      height: 200,
      fillColor: cd.color,
      strokeColor: '#34d399',
      strokeWidth: 1.5,
      text: `${cd.title}\n\nDirector/Creador: ${cd.author}\n\n${cd.desc}`,
      textColor: '#ffffff',
      fontSize: 13
    });
  });

  // ==========================================
  // 4. COLUMNA 3: 📐 FÍSICA Y TEORÍA CÓSMICA (X: 3200 a 4800, Y: 570 a 1800)
  // ==========================================
  const theoryFrameId = nextId('frame_theory');
  items.push({
    id: theoryFrameId,
    type: 'frame',
    x: 3200,
    y: 570,
    width: 1600,
    height: 1250,
    title: '📐 FÍSICA DEL ESPACIO: MECÁNICA ORBITAL & RELATIVIDAD',
    fillColor: '#1a1f29'
  });

  // Código 1: Ecuación de Tsiolkovsky
  const tsiolkovskyCode = `# Ecuación del Cohete de Tsiolkovsky (1903)
# Delta-V requerida para maniobras orbitales
import math

def calculate_delta_v(isp_seconds, m_initial, m_final):
    """
    isp_seconds: Impulso específico en segundos (ej. 380s Raptor)
    m_initial: Masa total al despegue (con propelente)
    m_final: Masa seca del cohete (sin propelente)
    """
    g0 = 9.80665  # Aceleración gravitatoria estándar en m/s²
    v_exhaust = isp_seconds * g0  # Velocidad efectiva de escape
    
    # Delta-v = v_e * ln(m0 / mf)
    delta_v = v_exhaust * math.log(m_initial / m_final)
    return delta_v

# Ejemplo: Cohete a órbita baja terrestre (LEO)
delta_v_leo = calculate_delta_v(380, 5000_000, 300_000)
print(f"Delta-V alcanzada: {delta_v_leo:.2f} m/s") # ~9400 m/s`;

  items.push({
    id: nextId('code_tsiolkovsky'),
    type: 'code',
    parentId: theoryFrameId,
    x: 3240,
    y: 630,
    width: 720,
    height: 480,
    title: 'ECUACIÓN DE TSIOLKOVSKY',
    language: 'python',
    text: tsiolkovskyCode
  });

  // Código 2: Velocidades de Escape y Órbita
  const orbitalCode = `# Dinámica Orbital Newtoniana
# Cálculo de Velocidad Circular y Velocidad de Escape
import math

G = 6.67430e-11  # Constante de gravitación universal (m³ kg⁻¹ s⁻²)
M_EARTH = 5.972e24  # Masa terrestre en kg
R_EARTH = 6.371e6   # Radio terrestre en metros

def orbital_velocity(mass_body, radius):
    """Velocidad necesaria para mantener órbita circular estable"""
    return math.sqrt(G * mass_body / radius)

def escape_velocity(mass_body, radius):
    """Velocidad mínima para escapar del pozo gravitatorio sin propulsión"""
    return math.sqrt(2 * G * mass_body / radius)

# En la superficie terrestre:
v_esc = escape_velocity(M_EARTH, R_EARTH)
print(f"Velocidad de Escape Terrestre: {v_esc / 1000:.2f} km/s") # ~11.19 km/s`;

  items.push({
    id: nextId('code_orbital'),
    type: 'code',
    parentId: theoryFrameId,
    x: 4000,
    y: 630,
    width: 750,
    height: 480,
    title: 'MECÁNICA ORBITAL & ESCAPE',
    language: 'python',
    text: orbitalCode
  });

  // Código 3: Radio de Schwarzschild
  const relativityCode = `# Astrofísica Relativista: Radio de Schwarzschild (Agujero Negro)
# Radio del horizonte de sucesos donde v_esc = c
import math

G = 6.67430e-11   # Constante gravitatoria
C = 299792458     # Velocidad de la luz en el vacío (m/s)

def schwarzschild_radius(mass_kg):
    """R_s = (2 * G * M) / c²"""
    return (2 * G * mass_kg) / (C ** 2)

# Si el Sol se comprimiera en un agujero negro:
M_SUN = 1.989e30
rs_sun = schwarzschild_radius(M_SUN)
print(f"Radio del Sol como Agujero Negro: {rs_sun:.2f} metros") # ~2.95 km!

# Para Sagitario A* (agujero negro supermasivo centro Vía Láctea):
M_SAG_A = 4.15e6 * M_SUN
rs_sag = schwarzschild_radius(M_SAG_A)
print(f"Radio Sagitario A*: {rs_sag / 1e9:.2f} millones de km") # ~12.26 M km`;

  items.push({
    id: nextId('code_relativity'),
    type: 'code',
    parentId: theoryFrameId,
    x: 3240,
    y: 1140,
    width: 720,
    height: 460,
    title: 'RELATIVIDAD GENERAL & AGUJEROS NEGROS',
    language: 'python',
    text: relativityCode
  });

  // Diagrama visual de transferencia de Hohmann
  items.push({
    id: nextId('shape_hohmann_sun'),
    type: 'shape',
    shape: 'circle',
    parentId: theoryFrameId,
    x: 4100,
    y: 1250,
    width: 100,
    height: 100,
    fillColor: '#f59e0b',
    strokeColor: '#fbbf24',
    strokeWidth: 3,
    text: '☀️ SOL',
    textColor: '#18181b',
    fontSize: 14
  });

  items.push({
    id: nextId('shape_hohmann_earth'),
    type: 'shape',
    shape: 'circle',
    parentId: theoryFrameId,
    x: 4300,
    y: 1270,
    width: 60,
    height: 60,
    fillColor: '#3b82f6',
    strokeColor: '#60a5fa',
    strokeWidth: 2,
    text: '🌍 TIERRA\n(1 AU)',
    textColor: '#ffffff',
    fontSize: 11
  });

  items.push({
    id: nextId('shape_hohmann_mars'),
    type: 'shape',
    shape: 'circle',
    parentId: theoryFrameId,
    x: 4600,
    y: 1260,
    width: 50,
    height: 50,
    fillColor: '#ef4444',
    strokeColor: '#f87171',
    strokeWidth: 2,
    text: '🔴 MARTE\n(1.52 AU)',
    textColor: '#ffffff',
    fontSize: 11
  });

  // Conector de órbita elíptica de transferencia
  items.push({
    id: nextId('conn_hohmann'),
    type: 'connector',
    start: { item: items.find(i => i.text && i.text.includes('TIERRA')).id, position: { x: 1, y: 0.5 } },
    end: { item: items.find(i => i.text && i.text.includes('MARTE')).id, position: { x: 0, y: 0.5 } },
    style: 'curved',
    color: '#10b981',
    width: 3,
    startArrow: false,
    endArrow: true
  });

  items.push({
    id: nextId('sticky_hohmann_note'),
    type: 'sticky_note',
    parentId: theoryFrameId,
    x: 4100,
    y: 1400,
    width: 480,
    height: 180,
    text: '🚀 ÓRBITA DE TRANSFERENCIA DE HOHMANN:\nLa trayectoria elíptica de menor gasto energético de propelente entre dos órbitas circulares concéntricas.\n• Tiempo de viaje Tierra-Marte: ~250 días\n• Ventana de lanzamiento: Cada 26 meses (oposición)',
    color: '#d5fcdb'
  });

  // ==========================================
  // 5. COLUMNA 3 (INFERIOR): 🌐 ATLAS INTERACTIVO & ENLACES
  // ==========================================
  const atlasFrameId = nextId('frame_atlas');
  items.push({
    id: atlasFrameId,
    type: 'frame',
    x: 3200,
    y: 1860,
    width: 1600,
    height: 1610,
    title: '🌐 ATLAS DIGITAL CÓSMICO: HERRAMIENTAS, SIMULADORES Y PORTALES CIENTÍFICOS',
    fillColor: '#171e29'
  });

  // Widgets interactivos web
  items.push({
    id: nextId('embed_eyes_nasa'),
    type: 'embed',
    parentId: atlasFrameId,
    x: 3240,
    y: 1920,
    width: 360,
    height: 270,
    title: 'NASA Eyes on the Solar System (3D Realtime)',
    domain: 'EYES.NASA.GOV',
    url: 'https://eyes.nasa.gov/apps/solar-system/',
    src: '',
    description: 'Simulador 3D en tiempo real con datos de telemetría de todas las sondas espaciales de la NASA.'
  });

  items.push({
    id: nextId('embed_stellarium'),
    type: 'embed',
    parentId: atlasFrameId,
    x: 3640,
    y: 1920,
    width: 360,
    height: 270,
    title: 'Stellarium Web Online Star Map',
    domain: 'STELLARIUM-WEB.ORG',
    url: 'https://stellarium-web.org/',
    src: '',
    description: 'Planetario astronómico interactivo para identificar constelaciones, planetas y satélites desde tu ubicación.'
  });

  items.push({
    id: nextId('embed_apod'),
    type: 'embed',
    parentId: atlasFrameId,
    x: 4040,
    y: 1920,
    width: 360,
    height: 270,
    title: 'NASA Astronomy Picture of the Day (APOD)',
    domain: 'APOD.NASA.GOV',
    url: 'https://apod.nasa.gov/apod/astropix.html',
    src: '',
    description: 'Fotografía astronómica diaria comentada por astrónomos profesionales desde 1995.'
  });

  items.push({
    id: nextId('embed_esa'),
    type: 'embed',
    parentId: atlasFrameId,
    x: 4440,
    y: 1920,
    width: 320,
    height: 270,
    title: 'European Space Agency (ESA) Portal',
    domain: 'ESA.INT',
    url: 'https://www.esa.int/',
    src: '',
    description: 'Misiones Juice a las lunas de Júpiter, telescopio espacial Euclid y lanzador Ariane 6.'
  });

  // Notas de curiosidades cósmicas
  items.push({
    id: nextId('sticky_pale_blue_dot'),
    type: 'sticky_note',
    parentId: atlasFrameId,
    x: 3240,
    y: 2240,
    width: 480,
    height: 260,
    text: '🌍 UN PUNTO AZUL PÁLIDO (VOYAGER 1, 1990):\n\n«Mira otra vez ese punto. Eso es aquí. Eso es nuestro hogar. Eso somos nosotros. En él están todos los que amas, todos los que conoces, cada ser humano que ha existido vivió allí su vida... en una mota de polvo suspendida en un rayo de sol.»\n\n— Carl Sagan',
    color: '#d0f0fd'
  });

  items.push({
    id: nextId('sticky_dark_matter'),
    type: 'sticky_note',
    parentId: atlasFrameId,
    x: 3760,
    y: 2240,
    width: 480,
    height: 260,
    text: '🔮 EL 95% DEL UNIVERSO ES INVISIBLE:\n\nLa materia bariónica (átomos de los que estamos hechos tú, la Tierra y todas las estrellas) solo representa el 4.9% del cosmos.\n\n• Materia Oscura: ~26.8% (solo interactúa gravitatoriamente)\n• Energía Oscura: ~68.3% (responsable de la aceleración métrica del espacio)',
    color: '#f3d9fa'
  });

  items.push({
    id: nextId('sticky_time_dilation'),
    type: 'sticky_note',
    parentId: atlasFrameId,
    x: 4280,
    y: 2240,
    width: 480,
    height: 260,
    text: '⏳ DILATACIÓN TEMPORAL GRAVITATORIA:\n\nEl tiempo no fluye igual para todos. Cuanto más cerca estás de una masa inmensa (un agujero negro o una estrella de neutrones), más lento transcurre el tiempo respecto a un observador lejano.\n\nEn los satélites GPS terrestres, los relojes atómicos deben corregir 38 microsegundos por día debido a la relatividad.',
    color: '#fff9b1'
  });

  // Comentarios / Pins de discusión
  items.push({
    id: nextId('comment_mars'),
    type: 'comment',
    parentId: atlasFrameId,
    x: 3400,
    y: 2560,
    text: '¿Crees que la primera misión humana a Marte pisará el planeta antes del año 2035?',
    author: 'Comunidad Brain Board',
    resolved: false
  });

  items.push({
    id: nextId('comment_jwst_life'),
    type: 'comment',
    parentId: atlasFrameId,
    x: 4100,
    y: 2560,
    text: 'La detección de sulfuro de dimetilo (DMS) en exoplanetas por JWST podría ser la primera biofirma indirecta extraterrestre.',
    author: 'Astrobiología',
    resolved: false
  });

  return {
    name: 'SPACE',
    updatedAt: new Date().toISOString(),
    seedVersion: 5,
    userModified: false,
    items: items
  };
}

const spaceBoard = generateSpaceBoard();
console.log('Generados', spaceBoard.items.length, 'elementos para el tablero SPACE');

// Guardar en boards/space.json y en app_bundle/boards/space.json
fs.writeFileSync(path.join(__dirname, '..', 'boards', 'space.json'), JSON.stringify(spaceBoard, null, 2), 'utf-8');
fs.writeFileSync(path.join(__dirname, '..', 'app_bundle', 'boards', 'space.json'), JSON.stringify(spaceBoard, null, 2), 'utf-8');
console.log('Archivos space.json actualizados con éxito.');
