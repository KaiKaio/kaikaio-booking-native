const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Syncing version ${version} to native projects...`);

// 1. Update Android build.gradle
const androidBuildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (fs.existsSync(androidBuildGradlePath)) {
  let gradleContent = fs.readFileSync(androidBuildGradlePath, 'utf8');
  // Regex to match versionName "..."
  const versionNameRegex = /versionName\s+"[^"]+"/g;
  
  if (versionNameRegex.test(gradleContent)) {
    gradleContent = gradleContent.replace(versionNameRegex, `versionName "${version}"`);
    fs.writeFileSync(androidBuildGradlePath, gradleContent, 'utf8');
    console.log(`✅ Updated Android versionName to ${version}`);
  } else {
    console.warn('⚠️  Could not find versionName in android/app/build.gradle');
  }
} else {
  console.error('❌ android/app/build.gradle not found');
}

// 2. Update iOS project.pbxproj
// We look for MARKETING_VERSION = ...;
const iosProjectPath = path.join(__dirname, '..', 'ios', 'AwesomeProject.xcodeproj', 'project.pbxproj');
if (fs.existsSync(iosProjectPath)) {
  let pbxContent = fs.readFileSync(iosProjectPath, 'utf8');
  // Regex to match MARKETING_VERSION = ...;
  const marketingVersionRegex = /MARKETING_VERSION = [^;]+;/g;
  
  if (marketingVersionRegex.test(pbxContent)) {
    pbxContent = pbxContent.replace(marketingVersionRegex, `MARKETING_VERSION = ${version};`);
    fs.writeFileSync(iosProjectPath, pbxContent, 'utf8');
    console.log(`✅ Updated iOS MARKETING_VERSION to ${version}`);
  } else {
    console.warn('⚠️  Could not find MARKETING_VERSION in project.pbxproj');
  }
} else {
  console.error('❌ ios/AwesomeProject.xcodeproj/project.pbxproj not found');
}
