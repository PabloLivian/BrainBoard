const fs = require('fs');

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

  // 2. REFERENCIAS section
  { match: (u, t) => u.includes('websitevice') || t.includes('websitevice'), src: '../extracted_board/3458764517478105021.jpg' },
  { match: (u, t) => u.includes('developer-portfolios'), src: '../extracted_board/3458764517991228105.png' },
  { match: (u, t) => u.includes('awwwards') || t.includes('awwwards'), src: '../extracted_board/3458764517873211164.jpg' },
  { match: (u, t) => u.includes('stevenolver') || t.includes('stevenolver'), src: '../extracted_board/3458764517873211164.jpg' },

  // 3. Demás herramientas y librerías
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

function fixBoard(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  const board = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let updatedCount = 0;

  board.items.forEach(it => {
    if (it.type !== 'embed' && it.type !== 'preview') return;
    const u = (it.url || '').toLowerCase();
    const t = (it.title || '').toLowerCase();

    let matched = false;
    for (const rule of embedRules) {
      if (rule.match(u, t)) {
        let changed = false;
        if (it.src !== rule.src) { it.src = rule.src; changed = true; }
        if (rule.title && it.title !== rule.title) { it.title = rule.title; changed = true; }
        if (rule.description && it.description !== rule.description) { it.description = rule.description; changed = true; }
        if (changed) {
          updatedCount++;
          console.log(`[${it.id}] Updated ${it.domain} (${it.title}) -> ${rule.src || '(no-image compact)'}`);
        }
        matched = true;
        break;
      }
    }

    // Si la tarjeta está usando la imagen de las torres de refrigeración o dinosaurios sin corresponder
    if (!matched && it.src && (it.src.includes('3458764518028914135.png') || it.src.includes('3458764517918099491.png'))) {
      it.src = '';
      updatedCount++;
      console.log(`[${it.id}] Cleared mismatched fallback image for ${it.domain} (${it.title})`);
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(board, null, 2));
  console.log(`File ${filePath} updated. Total embeds modified: ${updatedCount}\n`);
}

fixBoard('boards/DEV_AI.json');
fixBoard('c:/Users/Usuario/Desktop/DEV_AI.json');
