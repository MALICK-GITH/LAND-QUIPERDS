import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  try {
    for (const size of sizes) {
      await sharp('public/logo-source.jpg')
        .resize(size, size, { fit: 'cover', position: 'center' })
        .png()
        .toFile(`public/icon-${size}x${size}.png`);
      console.log(`Generated icon-${size}x${size}.png`);
    }
    
    // Générer le favicon PNG
    await sharp('public/logo-source.jpg')
      .resize(32, 32, { fit: 'cover', position: 'center' })
      .png()
      .toFile('public/favicon.png');
    console.log('Generated favicon.png');
    
    // Générer favicon.ico (multiple sizes)
    await sharp('public/logo-source.jpg')
      .resize(16, 16, { fit: 'cover', position: 'center' })
      .toFile('public/favicon-16x16.png');
    await sharp('public/logo-source.jpg')
      .resize(32, 32, { fit: 'cover', position: 'center' })
      .toFile('public/favicon-32x32.png');
    await sharp('public/logo-source.jpg')
      .resize(48, 48, { fit: 'cover', position: 'center' })
      .toFile('public/favicon-48x48.png');
    console.log('Generated favicon PNG sizes');
    
    // Générer le fichier .ico
    const icoBuffer = await pngToIco([
      'public/favicon-16x16.png',
      'public/favicon-32x32.png',
      'public/favicon-48x48.png'
    ]);
    
    // Écrire le fichier .ico
    const fs = await import('fs');
    fs.writeFileSync('public/favicon.ico', icoBuffer);
    console.log('Generated favicon.ico');
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
