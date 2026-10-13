const fs = require('fs');
const b = JSON.parse(fs.readFileSync('boards/DEV_AI.json', 'utf8'));

const areaItems = b.items.filter(it => it.x >= 7000 && it.x <= 12500 && it.y >= 4500 && it.y <= 6200 && (it.type === 'embed' || it.type === 'preview'));
console.log('Total embeds in Recursos area:', areaItems.length);

areaItems.sort((a, b) => a.y - b.y || a.x - b.x);

areaItems.forEach(it => {
  console.log(`[${it.id}] ${it.domain} | ${it.title} | ${it.url}`);
  console.log(`   x: ${Math.round(it.x)}, y: ${Math.round(it.y)}, w: ${it.width}, h: ${it.height}`);
  console.log(`   src: ${it.src}\n`);
});
