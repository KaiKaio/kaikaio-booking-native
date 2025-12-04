# Kaikaio (Kaikaio Booking Native)

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![React Native](https://img.shields.io/badge/React%20Native-0.80.1-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

> ⚠️ **Note**: 本项目处于开发阶段 (Current Version: 0.1.0).

## 📖 项目简介 (Introduction)

**Kaikaio** 是一款基于 React Native 开发的现代化移动端记账应用。旨在为用户提供简洁、高效的个人财务管理体验。通过直观的界面和流畅的交互，帮助用户轻松记录每日收支，掌握财务状况。

无论是日常消费、固定支出还是收入记录，Kaikaio 都能帮您清晰梳理，让每一笔账目都有迹可循。

## ✨ 功能特性 (Features)

- **📝 极速记账**: 快速记录支出与收入，支持自定义金额、日期、分类及备注。
- **📊 账单明细**: 按月/日展示账单列表，清晰直观的收支流水。
- **📈 统计概览**: 自动计算每月总支出与总收入，财务状况一目了然。
- **🏷️ 多样分类**: 内置丰富的消费分类图标，支持支出/收入分类切换。
- **📅 日期选择**: 灵活的日期选择器，支持补录历史账单。
- **🔐 账户系统**: 安全的用户登录与账户管理功能。
- **🎨 现代化 UI**: 基于 React Native 的原生级流畅体验，适配深色/浅色模式（规划中）。

## 🛠 技术栈 (Tech Stack)

本项目采用最新的 React Native 技术栈构建：

- **Core**: [React Native](https://reactnative.dev/) (v0.80.1), [React](https://react.dev/) (v19)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Navigation**: [React Navigation v7](https://reactnavigation.org/) (Native Stack)
- **Storage**: [AsyncStorage](https://github.com/react-native-async-storage/async-storage)
- **Icons**: [React Native Vector Icons](https://github.com/oblador/react-native-vector-icons)
- **Security**: JSEncrypt (数据加密)

## 📸 应用截图 (Screenshots)

| 首页列表 | 记账页面 | 账户中心 |
|:---:|:---:|:---:|
| ![List](https://via.placeholder.com/300x600?text=List+Page) | ![Booking](https://via.placeholder.com/300x600?text=Booking+Page) | ![Account](https://via.placeholder.com/300x600?text=Account+Page) |

> *注：请替换上述图片链接为实际的应用截图*

## 🚀 安装指南 (Installation)

### 环境要求 (Prerequisites)

在开始之前，请确保您的开发环境已安装以下工具：

- **Node.js**: >= 18.0.0
- **npm** 或 **yarn**
- **iOS 开发环境**: macOS, Xcode, CocoaPods (仅限 iOS 构建)
- **Android 开发环境**: Android Studio, JDK 17, Android SDK

### 安装步骤 (Steps)

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-username/kaikaio-booking-native.git
   cd kaikaio-booking-native
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或者
   yarn install
   ```

3. **安装 iOS 依赖 (仅 macOS)**
   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **字体链接 (可选)**
   如果遇到图标不显示问题，请运行：
   ```bash
   npm run link-fonts
   ```

## 📖 使用说明 (Usage)

### 启动开发服务器

启动 Metro Bundler：

```bash
npm start
```

### 运行应用

**Android:**

```bash
npm run android
```

**iOS:**

```bash
npm run ios
```

### 构建发布版

**Android APK:**

```bash
npm run build:android
# 生成的 APK 位于: android/app/build/outputs/apk/release/
```

## 🤝 贡献指南 (Contributing)

非常欢迎您参与项目贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证 (License)

本项目基于 MIT 许可证开源。详情请参阅 [LICENSE](LICENSE) 文件。

## 📮 联系方式 (Contact)

- **维护者**: Kaikaio
- **Email**: kaikaiano4@gmail.com
- **GitHub**: [@KaiKaio](https://github.com/KaiKaio)

---

Made with ❤️ by Kaikaio Team
