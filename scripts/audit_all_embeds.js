const fs = require('fs');

const b = JSON.parse(fs.readFileSync('boards/DEV_AI.json', 'utf8'));
const embeds = b.items.filter(it => it.type === 'embed' || it.type === 'preview');

console.log('Total embeds in DEV_AI.json:', embeds.length);

const correctMappings = [
  // 1. RECURSOS section
  { match: 'scrollxui.dev', src: '../extracted_board/3458764517509523994.png', title: 'ScrollX UI' },
  { match: 'reactbits.dev', src: '../extracted_board/3458764517509519997.png', title: 'React Bits' },
  { match: 'untitledui.com', src: '../extracted_board/3458764517477372552.jpg', title: 'Untitled UI' },
  { match: 'system-prompts-and-models-of-ai-tools', src: '../extracted_board/3458764517478043354.png', title: 'system-prompts' },
  { match: 'swapy.tahazsh.com', src: '../extracted_board/3458764517480665009.png', title: 'Swapy' },
  { match: 'npmtrends.com', src: '../extracted_board/3458764517492930057.png', title: 'npm trends' },
  { match: 'unavatar.io', src: '../extracted_board/3458764517492598138.png', title: 'unavatar' },
  { match: 'allsvgicons.com', src: '../extracted_board/3458764517480685287.png', title: 'All SVG Icons' },
  { match: 'profile-readme-generator.com', src: '../extracted_board/3458764517509492692.png', title: 'Profile Readme Generator' },
  { match: 'gitdocify.com', src: '', title: 'GitDocify', description: 'Instant, Professional, Code Documentation. Document your code in seconds with AI.' },
  { match: 'animejs.com', src: '../extracted_board/3458764517509516195.png', title: 'Anime.js' },
  { match: 'stitch.withgoogle.com', src: '../extracted_board/3458764517494401517.png', title: 'Stitch' },
  { match: 'hologram-particles', src: '../extracted_board/3458764517967499097.png', title: 'hologram-particles' },
  { match: 'daisyui.com', src: '', title: 'Daisyui' },

  // 2. REFERENCIAS section
  { match: 'websitevice.com', src: '../extracted_board/3458764517478105021.jpg', title: 'Websitevice' },
  { match: 'developer-portfolios', src: '../extracted_board/3458764517991228105.png', title: 'developer-portfolios' },
  { match: 'awwwards.com', src: '../extracted_board/3458764517873211164.jpg', title: 'Awwwards' },
  { match: 'stevenolver.com', src: '../extracted_board/3458764517873211164.jpg', title: 'Stevenolver' },

  // 3. Other known items
  { match: 'tradingview.com/lightweight-charts', src: '../extracted_board/3458764517478079397.jpg', title: 'Lightweight charts' },
  { match: 'pexels.com', src: '../extracted_board/3458764517966736743.jpg', title: 'Pexels' },
  { match: 'tweakcn.com', src: '../extracted_board/3458764517540044281.png', title: 'Tweakcn' },
  { match: 'tailframes.com', src: '../extracted_board/3458764517480618703.jpg', title: 'Tailframes' },
  { match: '100vibecoding.com', src: '../extracted_board/3458764517478108959.png', title: '100 Vibe Coding' },
  { match: 'github.com/midudev/jscamp', src: '../extracted_board/3458764517485645384.jpg', title: 'midudev/jscamp' },
  { match: 'shotdeck.com', src: '../extracted_board/3458764517966720474.jpg', title: 'Shotdeck' },
  { match: 'michaeltanzillo.com', src: '../extracted_board/3458764517991339081.png', title: 'Michael Tanzillo' },
  { match: 'hashgraphvc.com', src: '../extracted_board/3458764517991203410.png', title: 'Hashgraph Ventures' },
  { match: 'devdocs.io', src: '../extracted_board/3458764517478090111.png', title: 'Devdocs' },
  { match: 'database.build', src: '../extracted_board/3458764517477378523.png', title: 'database.build' },
  { match: 'codecademy.com', src: '../extracted_board/3458764516866751278.png', title: 'Codecademy' },
  { match: 'top-100-comfyui', src: '../extracted_board/3458764517940451934.png', title: 'top-100-comfyui' },
  { match: 'flux-lora-portrait-trainer', src: '../extracted_board/3458764518239369352.png', title: 'fal.ai flux-lora' },
  { match: 'learngitbranching.js.org', src: '../extracted_board/3458764517478046803.png', title: 'Learn Git Branching' },
  { match: 'openmodeldb.info', src: '../extracted_board/3458764517503661529.png', title: 'OpenModelDB' }
];

console.log('Verifying mappings against actual files on disk...');
correctMappings.forEach(m => {
  if (m.src) {
    const local = m.src.replace('../', '');
    if (!fs.existsSync(local)) {
      console.error('MISSING FILE ON DISK:', local, 'for', m.match);
    } else {
      console.log('✓ OK:', m.match, '->', local);
    }
  }
});
