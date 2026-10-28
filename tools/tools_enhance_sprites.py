# -*- coding: utf-8 -*-
"""
像素资源批量增强 v7:
1. 备份原图到 Assets/_original/<相对路径>
2. 深色 1px 外描边 —— 轮廓更清晰,与暗色地面分离
3. 饱和度/对比度/亮度提升 —— 颜色更鲜明
4. 顶部边缘暖色高光(rim light)—— 立体感
5. 暗部偏冷、亮部偏暖的轻微调色 —— 像素画的经典 grade
仅处理 characters/ monsters/common/ bosses/ 下的 sprite sheet。
"""
import os, shutil
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'Assets')
BACKUP = os.path.join(ASSETS, '_original')

TARGETS = []
for sub in ('characters', 'monsters/common', 'bosses'):
    d = os.path.join(ASSETS, sub)
    for dirpath, _dirs, files in os.walk(d):
        for f in sorted(files):
            if f.lower().endswith('.png'):
                TARGETS.append(os.path.relpath(os.path.join(dirpath, f), ASSETS))
TARGETS.sort()

OUTLINE = np.array([14, 10, 20], dtype=np.float32)  # 近黑微紫的描边色


def enhance_array(a):
    """a: HxWx4 int16 -> enhanced int16"""
    alpha = a[..., 3]
    opaque = alpha > 8

    # --- 1px 外描边:对不透明区域做 8 邻域膨胀,画在原透明像素上 ---
    pad = np.pad(opaque, 1)
    neigh = np.zeros_like(opaque)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            neigh |= pad[1 + dy:1 + dy + opaque.shape[0], 1 + dx:1 + dx + opaque.shape[1]]
    outline_mask = neigh & ~opaque

    # --- 顶部边缘 rim light:不透明且上方为透明 ---
    above = np.roll(opaque, 1, axis=0)
    above[0, :] = False
    rim = opaque & ~above

    rgb = a[..., :3].astype(np.float32)

    # --- 饱和度 +33% ---
    gray = rgb.mean(axis=-1, keepdims=True)
    rgb = gray + (rgb - gray) * 1.33

    # --- 对比度 +10% / 亮度 +4% ---
    rgb = (rgb - 118.0) * 1.10 + 118.0
    rgb *= 1.04

    # --- 暗部偏冷、亮部偏暖 ---
    lum = rgb.mean(axis=-1)
    dark = (lum < 74) & opaque
    bright = (lum > 176) & opaque
    rgb[dark, 2] += 7                      # 阴影加蓝
    rgb[bright, 0] += 9                    # 高光偏暖
    rgb[bright, 1] += 4

    # --- rim light:顶部边缘提亮且偏暖 ---
    r0 = rgb[rim]
    rgb[rim, 0] = np.minimum(255, r0[:, 0] * 1.42 + 14)
    rgb[rim, 1] = np.minimum(255, r0[:, 1] * 1.30 + 10)
    rgb[rim, 2] = np.minimum(255, r0[:, 2] * 1.16 + 6)

    # --- 描边像素 ---
    rgb[outline_mask] = OUTLINE

    out = np.empty_like(a)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.int16)
    out[..., 3] = np.where(outline_mask, 255, alpha)
    return out


def contact_sheet(paths, out_path, cell=110, cols=6):
    """增强前后对比预览图"""
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * cell * 2 + 8), (24, 22, 26, 255))
    for i, rel in enumerate(paths):
        before = Image.open(os.path.join(BACKUP, rel)).convert('RGBA')
        after = Image.open(os.path.join(ASSETS, rel)).convert('RGBA')
        r, c = divmod(i, cols)
        for j, im in enumerate((before, after)):
            im.thumbnail((cell - 8, cell - 8))
            x = c * cell + (cell - im.width) // 2
            y = j * (rows * cell) + r * cell + 4
            sheet.alpha_composite(im, (x, y))
    sheet.save(out_path)


def main():
    done = []
    for rel in TARGETS:
        src = os.path.join(ASSETS, rel)
        bak = os.path.join(BACKUP, rel)
        os.makedirs(os.path.dirname(bak), exist_ok=True)
        if not os.path.exists(bak):
            shutil.copy2(src, bak)
        im = Image.open(bak).convert('RGBA')
        arr = enhance_array(np.array(im).astype(np.int16))
        Image.fromarray(arr.astype(np.uint8), 'RGBA').save(src)
        done.append(rel)
        print('enhanced', rel)
    preview = os.path.join(ROOT, 'enhanced_preview.png')
    contact_sheet(done[:18], preview)
    print('total:', len(done), '| preview ->', preview)


if __name__ == '__main__':
    main()
