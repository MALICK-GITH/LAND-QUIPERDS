import sharp from 'sharp';

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
    
    // Générer le favicon
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
    console.log('Generated favicon sizes');
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
