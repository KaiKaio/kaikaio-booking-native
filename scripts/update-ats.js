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

content = content.replace(
  /<key>NSAppTransportSecurity<\/key>[\s\S]*?<\/dict>\n/,
  atsConfig + '\n'
);

fs.writeFileSync(infoPlistPath, content);
console.log(`已配置 ATS 允许访问 ${ip}`);