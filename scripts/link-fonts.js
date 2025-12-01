const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../assets/fonts');
const androidDestDir = path.join(__dirname, '../android/app/src/main/assets/fonts');

// Android Link
console.log('Linking fonts for Android...');
if (!fs.existsSync(androidDestDir)) {
  fs.mkdirSync(androidDestDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  let linkedCount = 0;
  files.forEach(file => {
    if (file.endsWith('.ttf')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(androidDestDir, file));
      console.log(`Copied ${file} to ${androidDestDir}`);
      linkedCount++;
    }
  });
  if (linkedCount === 0) {
    console.log('No .ttf files found in assets/fonts. Please download iconfont.ttf first.');
  } else {
    console.log(`Successfully linked ${linkedCount} font files to Android.`);
  }
} else {
  console.error('assets/fonts directory not found!');
}

console.log('\nFor iOS, please manually add the fonts to your Xcode project and Info.plist.');
