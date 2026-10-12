const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('extracted_board/resources.json', 'utf8');
const map = {};
const regex = /"id":\s*(\d+),\s*"name":\s*"([^"]*)",\s*"extension":\s*"([^"]*)"/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const [_, id, name, ext] = match;
  const filename = `${id}.${ext}`;
  if (fs.existsSync(path.join('extracted_board', filename))) {
    map[id] = {
      localPath: `../extracted_board/${filename}`,
      name,
      filename,
      ext
    };
  }
}

fs.writeFileSync('app_bundle/whiteboard/resources_map.json', JSON.stringify(map, null, 2));
console.log('Successfully mapped resources with exact 64-bit string IDs:', Object.keys(map).length);
