const fs = require('fs');

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

    // 1. Websitevice
    if (u.includes('websitevice') || t.includes('websitevice')) {
      if (it.src !== '../extracted_board/3458764517478105021.jpg') {
        it.src = '../extracted_board/3458764517478105021.jpg';
        updatedCount++;
        console.log(`[${it.id}] Updated Websitevice to 3458764517478105021.jpg`);
      }
    }
    // 2. Awwwards
    else if (u.includes('awwwards') || t.includes('awwwards')) {
      if (it.src !== '../extracted_board/3458764517873211164.jpg') {
        it.src = '../extracted_board/3458764517873211164.jpg';
        updatedCount++;
        console.log(`[${it.id}] Updated Awwwards to 3458764517873211164.jpg`);
      }
    }
    // 3. TradingView Lightweight charts
    else if (u.includes('tradingview.com/lightweight-charts') || t.includes('lightweight charts')) {
      if (it.src !== '../extracted_board/3458764517478079397.jpg') {
        it.src = '../extracted_board/3458764517478079397.jpg';
        updatedCount++;
        console.log(`[${it.id}] Updated Lightweight charts to 3458764517478079397.jpg`);
      }
    }
    // 4. Pexels
    else if (u.includes('pexels.com') || t.includes('pexels')) {
      if (it.src !== '../extracted_board/3458764517966736743.jpg') {
        it.src = '../extracted_board/3458764517966736743.jpg';
        updatedCount++;
        console.log(`[${it.id}] Updated Pexels to 3458764517966736743.jpg`);
      }
    }
    // 5. System Prompts
    else if (u.includes('nanobananaproprompts') || u.includes('system-prompts') || t.includes('prompts')) {
      if (it.src !== '../extracted_board/3458764517478043354.png') {
        it.src = '../extracted_board/3458764517478043354.png';
        updatedCount++;
        console.log(`[${it.id}] Updated Prompts to 3458764517478043354.png`);
      }
    }
    // 6. Any other embed mistakenly using dinosaur fallback -> replace with Miro generic preview svg!
    else if (it.src && it.src.includes('3458764517918099491.png')) {
      it.src = '../extracted_board/3458764517903244362.svg';
      updatedCount++;
      console.log(`[${it.id}] Replaced dinosaur fallback with Miro generic-preview.svg for ${it.domain} (${it.title})`);
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(board, null, 2));
  console.log(`File ${filePath} fixed successfully. Total embeds updated: ${updatedCount}\n`);
}

fixBoard('boards/DEV_AI.json');
fixBoard('c:/Users/Usuario/Desktop/DEV_AI.json');
