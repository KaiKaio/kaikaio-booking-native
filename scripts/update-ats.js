const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ip = process.env.EXPO_PUBLIC_API_BASE_URL?.match(/https?:\/\/([^:/]+)/)?.[1];

if (!ip) {
  console.log('未找到 IP 地址，跳过 ATS 配置');
  process.exit(0);
}

const infoPlistPath = path.join(__dirname, '../ios/Kaikaio/Info.plist');
let content = fs.readFileSync(infoPlistPath, 'utf8');

const atsConfig = `    <key>NSAppTransportSecurity</key>
    <dict>
      <key>NSAllowsArbitraryLoads</key>
      <true/>
      <key>NSAllowsLocalNetworking</key>
      <true/>
      <key>NSExceptionDomains</key>
      <dict>
        <key>${ip}</key>
        <dict>
          <key>NSExceptionAllowsInsecureHTTPLoads</key>
          <true/>
          <key>NSIncludesSubdomains</key>
          <true/>
        </dict>
      </dict>
    </dict>`;

const startMarker = '<key>NSAppTransportSecurity</key>';
const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.log('未找到 NSAppTransportSecurity 配置');
  process.exit(1);
}

let depth = 0;
let endIndex = startIndex;
let foundStart = false;

for (let i = startIndex; i < content.length; i++) {
  if (content.substring(i, i + 6) === '<dict>') {
    if (!foundStart) foundStart = true;
    depth++;
  } else if (content.substring(i, i + 7) === '</dict>') {
    if (foundStart) {
      depth--;
      if (depth === 0) {
        endIndex = i + 7;
        break;
      }
    }
  }
}

const newContent = content.substring(0, startIndex) + atsConfig + content.substring(endIndex);
fs.writeFileSync(infoPlistPath, newContent);
console.log(`已配置 ATS 允许访问 ${ip}`);