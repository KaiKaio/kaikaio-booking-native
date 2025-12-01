import { createIconSet } from 'react-native-vector-icons';
import iconfontJson from '../assets/fonts/iconfont.json';

// 解析 iconfont.json 生成映射表
const glyphMap: Record<string, number> = {};

if (iconfontJson && iconfontJson.glyphs) {
  iconfontJson.glyphs.forEach((glyph: any) => {
    // 优先使用 unicode_decimal，如果没有则解析 unicode 字符串
    glyphMap[glyph.font_class] = glyph.unicode_decimal || parseInt(glyph.unicode, 16);
  });
}

// 'iconfont' 是字体名，必须与 iconfont.ttf 中的字体名一致（通常默认就是 iconfont）
// 'iconfont.ttf' 是文件名
const IconFont = createIconSet(glyphMap, 'iconfont', 'iconfont.ttf');

export default IconFont;
