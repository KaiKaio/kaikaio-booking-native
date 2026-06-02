# IconFont 使用说明

本项目已集成 Alibaba Iconfont，以下是更新图标和使用的详细步骤。

## 1. 更新图标

当你在 [Alibaba Iconfont](https://www.iconfont.cn/) 网站上添加或修改了图标后：

1.  点击 **“下载代码”**，将压缩包下载到本地。
2.  解压压缩包。
3.  找到以下两个文件，并覆盖到本目录 (`assets/fonts/`)：
    *   `iconfont.ttf`
    *   `iconfont.json`

## 2. 链接字体文件

更新完文件后，需要将字体文件同步到原生项目中：

### Android
运行以下命令自动复制字体文件到 Android 目录：
```bash
npm run link-fonts
```

### iOS
iOS 需要手动配置（如果已经配置过则无需重复操作）：
1.  将 `assets/fonts/iconfont.ttf` 文件拖入 Xcode 项目中（确保勾选 "Add to targets"）。
2.  在 `Info.plist` 文件中，添加 `Fonts provided by application` 数组，并加入 `iconfont.ttf`。

## 3. 重新编译

由于涉及原生字体资源变更，**必须重新编译 App** 才能生效：

```bash
npm run android
# 或
npm run ios
```

## 4. 在代码中使用

使用封装好的 `IconFont` 组件即可显示图标。

```tsx
import React from 'react';
import { View } from 'react-native';
import IconFont from '@/components/IconFont'; // 请根据实际路径调整引入

const Demo = () => {
  return (
    <View>
      {/* name 对应 iconfont.json 中的 font_class 字段 */}
      <IconFont name="shouye" size={30} color="#000" />
      <IconFont name="wode" size={30} color="red" />
    </View>
  );
};

export default Demo;
```
