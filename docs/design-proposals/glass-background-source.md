# 雾白玻璃背景素材来源

日期：2026-10-05

## 用途与范围

素材 `src/renderer/src/assets/research-glass-atmosphere.webp` 是 D「雾白玻璃」方向的抽象背景，用于真实界面玻璃面板后方，为 CSS `backdrop-filter` 提供可见的冷灰明暗、薄片折光与材质层次。

素材只包含背景，不包含 UI、文字、字母、数字、标志、卡片、窗口或可辨识物体。导航、阅读区域、按钮与其他控件由实际界面代码渲染；本素材不是渲染整个 UI 的图片，也不承载交互内容或业务数据。

## 生成与文件信息

- 生成工具：内置 `image_gen`，新图生成模式，非 CLI/API 回退模式。
- 背景设置：`transparent_background: false`。
- 参考方式：先目视查看用户选定的 D 概念图，再根据其背景特征编写提示词；本次生成未传入参考图片。
- 原始生成结果：PNG，1586 × 992 像素，sRGB，无透明通道。
- 最终交付：WebP，1586 × 992 像素，76,600 bytes（约 74.8 KiB）。
- 转换方式：使用项目已有的 Sharp，参数为 `webp({ quality: 88, effort: 6 })`；仅转换格式和压缩，未缩放、裁剪、重绘或叠加内容。
- 目视检查：已检查原始 PNG 与最终 WebP，确认保留冷灰明暗与斜向折光，未生成界面元素或文字。

生成属于非确定性过程。下列提示词记录了本次生成要求，可以用于后续制作同方向素材，但重新生成不保证得到相同像素。

## 最终提示词

```text
Use case: stylized-concept. Asset type: production background image for an academic desktop research application. Generate ONLY a standalone wide 16:10 abstract atmospheric background, edge-to-edge, no interface. The image should feel like luminous frosted architectural glass and fine translucent silk sheets folding through space. Layer a few large sweeping translucent blue-silver-gray planes with soft architectural creases and bright diagonal bands of refracted daylight traveling from upper left toward lower right. Color palette strictly low-saturation cool silver, blue-gray, smoke gray, and medium slate gray; preserve conspicuous medium-gray shadow areas across the upper center and lower left so white translucent panels later placed over this background will show real glass contrast. A calm academic mood, refined realistic studio material rendering, airy but NOT an almost-white wash. Bright silky folds occupy parts of the left edge and lower right; quieter broad gray regions in the middle, with depth, feathered shadows, restrained caustics, and a very subtle grain. Glass planes are abstract flowing layered backdrops with no recognizable manufactured object. No saturated blue, no neon, no rainbow, no blobs, no glowing orbs, no liquid chrome, no excessive sharp shards. Absolutely no text, letters, numbers, logos, watermark, UI, cards, rectangles resembling windows, buttons, panels, screenshots, furniture, books, people, or objects. Output one clean backdrop only.
```
