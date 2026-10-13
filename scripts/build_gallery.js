const fs = require('fs');
const path = require('path');

const dir = 'extracted_board';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Extracted Board Images</title>
<style>
  body { background: #181818; color: #eee; font-family: sans-serif; padding: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .card { background: #262626; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; }
  img { max-width: 100%; max-height: 150px; object-fit: contain; background: #111; border-radius: 4px; }
  .name { font-size: 11px; margin-top: 8px; word-break: break-all; color: #aaa; text-align: center; }
</style>
</head>
<body>
<h2>Total images: ${files.length}</h2>
<div class="grid">
`;

files.forEach(f => {
  html += `  <div class="card">
    <img src="${f}">
    <div class="name">${f}</div>
  </div>\n`;
});

html += `</div>
</body>
</html>`;

fs.writeFileSync(path.join(dir, 'gallery.html'), html);
console.log('Gallery written with', files.length, 'images.');
