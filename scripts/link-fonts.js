const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../assets/fonts');
const androidDestDir = path.join(__dirname, '../android/app/src/main/assets/fonts');
const iosDestDir = path.join(__dirname, '../ios/Kaikaio/Fonts');
const infoPlistPath = path.join(__dirname, '../ios/Kaikaio/Info.plist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

console.log('Linking fonts...');

if (!fs.existsSync(srcDir)) {
  console.error('assets/fonts directory not found! Please add iconfont.ttf and iconfont.json to assets/fonts.');
  process.exit(1);
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.ttf'));
if (files.length === 0) {
  console.log('No .ttf files found in assets/fonts. Please download iconfont.ttf first.');
  process.exit(0);
}

// Android
ensureDir(androidDestDir);
files.forEach(file => {
  fs.copyFileSync(path.join(srcDir, file), path.join(androidDestDir, file));
  console.log(`Copied ${file} to ${androidDestDir}`);
});
console.log(`Successfully linked ${files.length} font files to Android.`);

// iOS - copy into ios project folder
ensureDir(iosDestDir);
files.forEach(file => {
  fs.copyFileSync(path.join(srcDir, file), path.join(iosDestDir, file));
  console.log(`Copied ${file} to ${iosDestDir}`);
});

// Update Info.plist UIAppFonts entries (normalize to just filenames)
if (fs.existsSync(infoPlistPath)) {
  let plist = fs.readFileSync(infoPlistPath, 'utf8');
  const fontStrings = files.map(f => `\t\t<string>${f}</string>`).join('\n');
  if (/<key>UIAppFonts<\/key>\s*<array>[\s\S]*?<\/array>/m.test(plist)) {
    plist = plist.replace(/<key>UIAppFonts<\/key>\s*<array>[\s\S]*?<\/array>/m, `<key>UIAppFonts</key>\n\t<array>\n${fontStrings}\n\t</array>`);
    console.log('Updated UIAppFonts entries in Info.plist');
  } else {
    // Insert before closing </dict>
    plist = plist.replace(/<\/dict>/, `\t<key>UIAppFonts</key>\n\t<array>\n${fontStrings}\n\t</array>\n</dict>`);
    console.log('Inserted UIAppFonts entries into Info.plist');
  }
  fs.writeFileSync(infoPlistPath, plist, 'utf8');
} else {
  console.warn(`Info.plist not found at ${infoPlistPath}. You'll need to add UIAppFonts entries manually in Xcode.`);
}

console.log('\nDone.');
