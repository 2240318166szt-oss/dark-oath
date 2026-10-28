"""
Q版俯视动作肉鸽像素精灵生成器 v4
- 角色：五官清晰、服装分层、明暗高光、大幅度攻击动作
- 怪物：独特轮廓、细节纹理、攻击前摇姿态
- 硬边像素，无抗锯齿，nearest-neighbor 渲染
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math, json, random

ROOT = Path(__file__).parent.parent / 'Assets'

# 扩展调色板：增加高光和阴影层次
P = {
    'black': '#1B1B1B', 'iron': '#303030', 'darkred': '#5A1F1F',
    'red': '#A11F1F', 'bone': '#D6D0C8', 'gold': '#A8863A',
    'purple': '#6B3FA0', 'blue': '#3E5870', 'green': '#467A46',
    'ash': '#707070',
    # 新增高光/阴影/肤色/材质
    'skin': '#E8B89A', 'skin_shadow': '#C89878', 'skin_dark': '#A07858',
    'hair_brown': '#6B4423', 'hair_blond': '#C9A86A', 'hair_white': '#E8E0D0',
    'silver': '#A8A8B0', 'silver_light': '#D0D0D8', 'silver_dark': '#686870',
    'steel': '#5A5A68', 'steel_dark': '#3A3A48',
    'leather': '#8B6332', 'leather_dark': '#5E3F1E', 'leather_light': '#B08050',
    'cloth_red': '#8B2020', 'cloth_red_dark': '#5E1414', 'cloth_red_light': '#B03030',
    'cloth_purple': '#5A2A7A', 'cloth_purple_dark': '#3A1A5A', 'cloth_purple_light': '#7A4A9A',
    'cloth_green': '#2A5A3A', 'cloth_green_dark': '#1A3A2A',
    'fur_gray': '#7A7A7A', 'fur_gray_dark': '#5A5A5A', 'fur_gray_light': '#9A9A9A',
    'fur_brown': '#8B6B4A', 'fur_brown_dark': '#6B4B2A',
    'monster_skin': '#8A8A7A', 'monster_skin_dark': '#5A5A4A',
    'witch_skin': '#7A9A5A', 'witch_skin_dark': '#5A7A3A',
    'magic_purple': '#9A5ACA', 'magic_purple_light': '#CA8AFA',
    'magic_green': '#5ACA7A', 'magic_green_light': '#8AFA9A',
    'blood': '#8B1010', 'blood_dark': '#5E0A0A',
    'wood': '#6B4423', 'wood_dark': '#4A2E15',
}

DIRS = ['down', 'down_left', 'left', 'up_left', 'up', 'up_right', 'right', 'down_right']
ACTIONS = {'idle': 6, 'walk': 8, 'attack': 6, 'hit': 3, 'death': 8,
           'skill1': 8, 'skill2': 10, 'skill3': 12}


def dir_vec(i):
    a = math.pi / 2 + i * math.pi / 4
    return math.cos(a), math.sin(a)


def px(d, x, y, c, w=1, h=1):
    """画一个像素块"""
    d.rectangle((round(x), round(y), round(x + w - 1), round(y + h - 1)), fill=c)


def px_line(d, x1, y1, x2, y2, c, thick=1):
    """像素线（用 PIL 原生 C 实现，硬边无抗锯齿）"""
    d.line([(round(x1), round(y1)), (round(x2), round(y2))], fill=c, width=thick)


def px_poly(d, pts, c):
    """像素多边形填充（用 PIL 原生 C 实现，硬边无抗锯齿）"""
    d.polygon([(round(x), round(y)) for x, y in pts], fill=c)


def add_pixel_outline(im, color=(27, 27, 27, 255)):
    """给非透明像素增加 1px 硬边外轮廓，提高俯视战斗中的辨识度。"""
    from PIL import ImageFilter
    alpha = im.getchannel('A')
    expanded = alpha.filter(ImageFilter.MaxFilter(3))
    outline_alpha = expanded.point(lambda a: 255 if a else 0)
    base_alpha = alpha.point(lambda a: 255 if a else 0)
    # 仅保留原图之外的一圈
    import PIL.ImageChops as ImageChops
    ring = ImageChops.subtract(outline_alpha, base_alpha)
    layer = Image.new('RGBA', im.size, color)
    layer.putalpha(ring)
    return Image.alpha_composite(layer, im)


# ============================================================
#  角色绘制
# ============================================================

def draw_knight(d, cx, cy, vx, vy, px_, py_, action, fi, frames):
    """圣殿骑士：银灰板甲+红色披风+长剑+盾"""
    bob = 0
    if action == 'idle':
        bob = [0, 0, -1, -1, 0, 0][fi % 6]
    elif action == 'walk':
        bob = [0, -1, -2, -1, 0, 1, 0, -1][fi % 8]
    cy += bob

    # 攻击时身体前倾
    lean = 0
    if action in ('attack', 'skill1', 'skill3'):
        t = fi / max(1, frames - 1)
        lean = int(math.sin(t * math.pi) * 4)

    body_cx = cx + int(vx * lean)
    body_cy = cy

    # --- 披风（在身体后面，朝反方向飘动）---
    cape_x = body_cx - int(vx * 5)
    cape_y = body_cy - int(vy * 2)
    cape_wave = int(math.sin(fi * 0.8) * 2) if action in ('walk', 'idle') else 0
    px_poly(d, [
        (cape_x - 8, cape_y - 10), (cape_x + 8, cape_y - 10),
        (cape_x + 6 + cape_wave, cape_y + 12),
        (cape_x - 6 + cape_wave, cape_y + 10)
    ], P['cloth_red_dark'])
    px_poly(d, [
        (cape_x - 6, cape_y - 8), (cape_x + 6, cape_y - 8),
        (cape_x + 4 + cape_wave, cape_y + 8),
        (cape_x - 4 + cape_wave, cape_y + 7)
    ], P['cloth_red'])

    # --- 腿 ---
    leg_swing = 0
    if action == 'walk':
        leg_swing = int(math.sin(fi * math.pi / 4) * 3)
    # 左腿
    px(d, body_cx - 5 + int(px_ * leg_swing), body_cy + 6, P['steel_dark'], 4, 6)
    px(d, body_cx - 5 + int(px_ * leg_swing), body_cy + 11, P['iron'], 4, 3)
    # 右腿
    px(d, body_cx + 1 - int(px_ * leg_swing), body_cy + 6, P['steel'], 4, 6)
    px(d, body_cx + 1 - int(px_ * leg_swing), body_cy + 11, P['iron'], 4, 3)

    # --- 身体（板甲）---
    # 主体
    px_poly(d, [
        (body_cx - 8, body_cy - 8), (body_cx + 8, body_cy - 8),
        (body_cx + 9, body_cy + 7), (body_cx - 9, body_cy + 7)
    ], P['steel'])
    # 胸甲高光
    px(d, body_cx - 6, body_cy - 6, P['silver'], 5, 8)
    px(d, body_cx - 5, body_cy - 5, P['silver_light'], 3, 3)
    # 胸甲阴影
    px(d, body_cx + 2, body_cy - 4, P['steel_dark'], 5, 9)
    # 金色胸甲十字
    px(d, body_cx - 1, body_cy - 5, P['gold'], 3, 8)
    px(d, body_cx - 3, body_cy - 3, P['gold'], 7, 2)
    # 腰带
    px(d, body_cx - 8, body_cy + 4, P['leather_dark'], 16, 3)
    px(d, body_cx - 1, body_cy + 4, P['gold'], 3, 3)

    # --- 盾牌（左手 = 朝向的左侧）---
    shield_x = body_cx + int(px_ * 10) + int(vx * 1)
    shield_y = body_cy + int(py_ * 8)
    px_poly(d, [
        (shield_x - 5, shield_y - 7), (shield_x + 5, shield_y - 7),
        (shield_x + 6, shield_y + 2), (shield_x, shield_y + 8),
        (shield_x - 6, shield_y + 2)
    ], P['steel_dark'])
    px_poly(d, [
        (shield_x - 4, shield_y - 6), (shield_x + 4, shield_y - 6),
        (shield_x + 5, shield_y + 1), (shield_x, shield_y + 6),
        (shield_x - 5, shield_y + 1)
    ], P['silver'])
    # 盾面纹章
    px(d, shield_x - 2, shield_y - 4, P['cloth_red'], 5, 5)
    px(d, shield_x - 1, shield_y - 3, P['gold'], 3, 3)
    px_line(d, shield_x, shield_y - 5, shield_x, shield_y + 4, P['gold'], 1)

    # --- 头（头盔）---
    head_x = body_cx
    head_y = body_cy - 16
    # 头盔主体
    px_poly(d, [
        (head_x - 9, head_y - 7), (head_x + 9, head_y - 7),
        (head_x + 8, head_y + 6), (head_x - 8, head_y + 6)
    ], P['steel'])
    # 头盔高光
    px(d, head_x - 5, head_y - 5, P['silver'], 4, 5)
    px(d, head_x - 4, head_y - 4, P['silver_light'], 2, 2)
    # 头盔阴影
    px(d, head_x + 2, head_y - 3, P['steel_dark'], 4, 7)
    # 面甲
    px(d, head_x - 5, head_y - 1, P['iron'], 10, 4)
    # 眼缝（红色发光）
    eye_glow = P['red'] if action in ('attack', 'skill1', 'skill2', 'skill3') else P['darkred']
    px(d, head_x - 4, head_y, eye_glow, 3, 1)
    px(d, head_x + 1, head_y, eye_glow, 3, 1)
    # 头盔顶部羽饰
    px(d, head_x - 1, head_y - 9, P['cloth_red'], 3, 4)
    px(d, head_x, head_y - 11, P['cloth_red_light'], 2, 3)
    # 头盔护颈
    px(d, head_x - 6, head_y + 4, P['steel_dark'], 12, 2)

    # --- 右臂 + 剑（攻击时挥动）---
    arm_x = body_cx - int(px_ * 9)
    arm_y = body_cy - int(py_ * 4)

    # 基础角度（朝面向方向）
    base_ang = math.atan2(vy, vx)
    sword_ang = base_ang

    if action in ('attack', 'skill1', 'skill3'):
        # 挥剑：从后下方 -> 前上方（大幅度）
        t = fi / max(1, frames - 1)
        swing = (t - 0.5) * 2.2  # -1.1 ~ +1.1 弧度
        sword_ang = base_ang + swing
        # 攻击时手臂前伸
        arm_x = body_cx - int(px_ * 7) + int(vx * 3)
        arm_y = body_cy - int(py_ * 3) + int(vy * 2)
    elif action == 'skill2':
        sword_ang = base_ang - 0.3  # 举剑格挡

    # 手臂
    hand_x = arm_x + int(math.cos(sword_ang) * 8)
    hand_y = arm_y + int(math.sin(sword_ang) * 8)
    px_line(d, arm_x, arm_y, hand_x, hand_y, P['steel'], 3)
    px(d, hand_x - 1, hand_y - 1, P['steel_dark'], 3, 3)

    # 剑（从手延伸）
    sword_len = 25
    tip_x = hand_x + int(math.cos(sword_ang) * sword_len)
    tip_y = hand_y + int(math.sin(sword_ang) * sword_len)
    mid_x = hand_x + int(math.cos(sword_ang) * (sword_len * 0.5))
    mid_y = hand_y + int(math.sin(sword_ang) * (sword_len * 0.5))
    # 剑身（双刃：主色+高光）
    px_line(d, hand_x, hand_y, tip_x, tip_y, P['silver'], 3)
    px_line(d, hand_x + int(-math.sin(sword_ang)), hand_y + int(math.cos(sword_ang)),
             tip_x + int(-math.sin(sword_ang)), tip_y + int(math.cos(sword_ang)),
             P['silver_light'], 1)
    # 剑尖
    px(d, tip_x - 1, tip_y - 1, P['bone'], 2, 2)
    # 护手（垂直于剑身）
    guard_x1 = hand_x + int(-math.sin(sword_ang) * 4)
    guard_y1 = hand_y + int(math.cos(sword_ang) * 4)
    guard_x2 = hand_x - int(-math.sin(sword_ang) * 4)
    guard_y2 = hand_y - int(math.cos(sword_ang) * 4)
    px_line(d, guard_x1, guard_y1, guard_x2, guard_y2, P['gold'], 2)
    # 剑柄
    grip_x = hand_x - int(math.cos(sword_ang) * 4)
    grip_y = hand_y - int(math.sin(sword_ang) * 4)
    px_line(d, hand_x, hand_y, grip_x, grip_y, P['leather_dark'], 2)
    px(d, grip_x - 1, grip_y - 1, P['gold'], 2, 2)

    # 攻击挥砍残影（skill3 旋风时更明显）
    if action in ('attack', 'skill1', 'skill3') and fi >= 1 and fi <= frames - 2:
        trail_ang1 = sword_ang - 0.4
        trail_ang2 = sword_ang + 0.4
        tx1 = hand_x + int(math.cos(trail_ang1) * sword_len * 0.7)
        ty1 = hand_y + int(math.sin(trail_ang1) * sword_len * 0.7)
        tx2 = hand_x + int(math.cos(trail_ang2) * sword_len * 0.7)
        ty2 = hand_y + int(math.sin(trail_ang2) * sword_len * 0.7)
        px_line(d, tx1, ty1, tx2, ty2, P['bone'], 1)

    # skill2: 圣光护体光环
    if action == 'skill2':
        rr = 12 + (fi % 5) * 2
        for a in range(0, 360, 30):
            ox = body_cx + int(math.cos(math.radians(a)) * rr)
            oy = body_cy + int(math.sin(math.radians(a)) * rr)
            px(d, ox - 1, oy - 1, P['gold'], 2, 2)

    # skill3: 旋风斩
    if action == 'skill3':
        for a_off in (-60, 0, 60):
            a = sword_ang + math.radians(a_off + fi * 30)
            sx = body_cx + int(math.cos(a) * 18)
            sy = body_cy + int(math.sin(a) * 18)
            px_line(d, body_cx, body_cy, sx, sy, P['silver_light'], 2)


def draw_hunter(d, cx, cy, vx, vy, px_, py_, action, fi, frames):
    """猎魔人：兜帽+皮甲+双持手枪/弓"""
    bob = 0
    if action == 'idle':
        bob = [0, 0, -1, -1, 0, 0][fi % 6]
    elif action == 'walk':
        bob = [0, -1, -2, -1, 0, 1, 0, -1][fi % 8]
    cy += bob

    lean = 0
    if action in ('attack', 'skill1'):
        t = fi / max(1, frames - 1)
        lean = int(math.sin(t * math.pi) * 3)
    body_cx = cx + int(vx * lean)
    body_cy = cy

    # --- 腿 ---
    leg_swing = int(math.sin(fi * math.pi / 4) * 3) if action == 'walk' else 0
    px(d, body_cx - 5 + int(px_ * leg_swing), body_cy + 6, P['leather_dark'], 4, 6)
    px(d, body_cx - 5 + int(px_ * leg_swing), body_cy + 11, P['iron'], 4, 3)
    px(d, body_cx + 1 - int(px_ * leg_swing), body_cy + 6, P['leather'], 4, 6)
    px(d, body_cx + 1 - int(px_ * leg_swing), body_cy + 11, P['iron'], 4, 3)

    # --- 身体（皮甲）---
    px_poly(d, [
        (body_cx - 7, body_cy - 8), (body_cx + 7, body_cy - 8),
        (body_cx + 8, body_cy + 7), (body_cx - 8, body_cy + 7)
    ], P['leather'])
    # 皮甲高光
    px(d, body_cx - 5, body_cy - 6, P['leather_light'], 4, 7)
    # 皮甲阴影
    px(d, body_cx + 2, body_cy - 4, P['leather_dark'], 5, 9)
    # 皮带
    px(d, body_cx - 7, body_cy + 1, P['leather_dark'], 14, 2)
    px(d, body_cx - 1, body_cy + 1, P['gold'], 3, 2)
    # 箭袋（背后右侧）
    qx = body_cx - int(px_ * 8) - int(vx * 2)
    qy = body_cy - int(py_ * 2)
    px(d, qx - 2, qy - 6, P['leather_dark'], 4, 10)
    px(d, qx - 1, qy - 8, P['bone'], 1, 3)
    px(d, qx + 1, qy - 9, P['bone'], 1, 4)

    # --- 头（兜帽）---
    head_x = body_cx
    head_y = body_cy - 15
    # 兜帽
    px_poly(d, [
        (head_x - 10, head_y - 5), (head_x + 10, head_y - 5),
        (head_x + 9, head_y + 6), (head_x - 9, head_y + 6)
    ], P['cloth_green_dark'])
    px_poly(d, [
        (head_x - 7, head_y - 5), (head_x + 7, head_y - 5),
        (head_x + 5, head_y - 1), (head_x - 5, head_y - 1)
    ], P['cloth_green'])
    # 脸（阴影中的脸）
    px(d, head_x - 4, head_y, P['skin_dark'], 8, 4)
    # 眼睛（锐利）
    eye_c = P['gold'] if action in ('attack', 'skill1', 'skill3') else P['bone']
    px(d, head_x - 3, head_y + 1, eye_c, 2, 1)
    px(d, head_x + 1, head_y + 1, eye_c, 2, 1)
    # 围巾
    scarf_wave = int(math.sin(fi * 0.6) * 2) if action in ('walk', 'idle') else 0
    px(d, head_x - 6, head_y + 4, P['cloth_red_dark'], 12, 2)
    px(d, head_x + int(vx * 4) + scarf_wave, head_y + 5, P['cloth_red'], 4, 3)

    # --- 双臂 + 武器 ---
    # 左手：弓
    bow_x = body_cx + int(px_ * 9)
    bow_y = body_cy + int(py_ * 2)
    px_line(d, body_cx + int(px_ * 4), body_cy - 2, bow_x, bow_y, P['leather'], 2)

    # 弓的弧度
    bow_ang = math.atan2(vy, vx)
    bow_top_x = bow_x + int(math.cos(bow_ang + math.pi / 2) * 13)
    bow_top_y = bow_y + int(math.sin(bow_ang + math.pi / 2) * 10)
    bow_bot_x = bow_x - int(math.cos(bow_ang + math.pi / 2) * 13)
    bow_bot_y = bow_y - int(math.sin(bow_ang + math.pi / 2) * 10)
    px_line(d, bow_top_x, bow_top_y, bow_x, bow_y, P['wood'], 2)
    px_line(d, bow_bot_x, bow_bot_y, bow_x, bow_y, P['wood'], 2)
    px_line(d, bow_top_x, bow_top_y, bow_bot_x, bow_bot_y, P['bone'], 1)

    # 右手：拉弦
    pull_back = 0
    if action in ('attack', 'skill1'):
        t = fi / max(1, frames - 1)
        pull_back = int(math.sin(t * math.pi) * 5)
    hand_x = body_cx - int(px_ * 6) - int(vx * pull_back)
    hand_y = body_cy - int(py_ * 2) - int(vy * pull_back)
    px_line(d, body_cx - int(px_ * 3), body_cy - 2, hand_x, hand_y, P['leather'], 2)
    px(d, hand_x - 1, hand_y - 1, P['skin'], 3, 3)

    # 箭（攻击时搭在弦上）
    if action in ('attack', 'skill1') and fi >= 1:
        arrow_x = hand_x + int(vx * 2)
        arrow_y = hand_y + int(vy * 2)
        arrow_tip_x = arrow_x + int(vx * 18)
        arrow_tip_y = arrow_y + int(vy * 18)
        px_line(d, arrow_x, arrow_y, arrow_tip_x, arrow_tip_y, P['wood'], 1)
        px(d, arrow_tip_x - 1, arrow_tip_y - 1, P['bone'], 2, 2)
        # 羽毛
        fx = arrow_x - int(vx * 2)
        fy = arrow_y - int(vy * 2)
        px(d, fx - 1, fy - 1, P['cloth_red'], 2, 2)

    # 攻击时枪口火光（skill1 闪避射击）
    if action == 'attack' and fi in (2, 3):
        mx = bow_x + int(vx * 8)
        my = bow_y + int(vy * 8)
        px(d, mx - 2, my - 2, P['gold'], 4, 4)
        px(d, mx - 1, my - 1, P['bone'], 2, 2)

    # skill1: 闪避射击 - 多支箭残影
    if action == 'skill1':
        for k in range(3):
            ax = body_cx + int(vx * (8 + k * 5))
            ay = body_cy + int(vy * (8 + k * 5))
            px(d, ax - 1, ay - 1, P['bone'], 2, 2)

    # skill2: 冰霜陷阱
    if action == 'skill2':
        px(d, body_cx - 10, body_cy + 8, P['blue'], 20, 4)
        for ox in (-8, -4, 0, 4, 8):
            px(d, body_cx + ox, body_cy + 6, P['silver_light'], 2, 2)

    # skill3: 箭雨
    if action == 'skill3':
        for k in range(5):
            ax = body_cx - 12 + k * 6
            ay = body_cy - 20 - (k % 3) * 4
            px_line(d, ax, ay, ax - 3, ay + 8, P['wood'], 1)
            px(d, ax - 4, ay + 7, P['bone'], 2, 2)


def draw_mage(d, cx, cy, vx, vy, px_, py_, action, fi, frames):
    """暗影法师：尖顶帽+长袍+法杖"""
    bob = 0
    if action == 'idle':
        bob = [0, 0, -1, -1, 0, 0][fi % 6]
    elif action == 'walk':
        bob = [0, -1, -2, -1, 0, 1, 0, -1][fi % 8]
    cy += bob

    lean = 0
    if action in ('attack', 'skill1', 'skill3'):
        t = fi / max(1, frames - 1)
        lean = int(math.sin(t * math.pi) * 3)
    body_cx = cx + int(vx * lean)
    body_cy = cy

    # --- 长袍下摆（宽大）---
    robe_wave = int(math.sin(fi * 0.5) * 2) if action in ('walk', 'idle') else 0
    px_poly(d, [
        (body_cx - 10, body_cy - 2), (body_cx + 10, body_cy - 2),
        (body_cx + 12 + robe_wave, body_cy + 13),
        (body_cx - 12 + robe_wave, body_cy + 13)
    ], P['cloth_purple_dark'])
    px_poly(d, [
        (body_cx - 8, body_cy), (body_cx + 8, body_cy),
        (body_cx + 10 + robe_wave, body_cy + 12),
        (body_cx - 10 + robe_wave, body_cy + 12)
    ], P['cloth_purple'])
    # 长袍符文
    for yy, col in [(body_cy + 2, P['magic_purple']), (body_cy + 6, P['magic_purple_light']),
                     (body_cy + 10, P['magic_purple'])]:
        px(d, body_cx - 2, yy, col, 4, 1)
        px(d, body_cx - 1, yy - 1, col, 2, 1)

    # --- 身体（长袍上半）---
    px_poly(d, [
        (body_cx - 8, body_cy - 10), (body_cx + 8, body_cy - 10),
        (body_cx + 9, body_cy - 1), (body_cx - 9, body_cy - 1)
    ], P['cloth_purple'])
    # 高光
    px(d, body_cx - 6, body_cy - 8, P['cloth_purple_light'], 4, 6)
    # 阴影
    px(d, body_cx + 3, body_cy - 7, P['cloth_purple_dark'], 5, 7)
    # 宽袖子
    sleeve_flare = 2 if action in ('attack', 'skill1', 'skill3') else 0
    # 左袖
    px_poly(d, [
        (body_cx - 8, body_cy - 8), (body_cx - 12 - sleeve_flare, body_cy - 4),
        (body_cx - 11 - sleeve_flare, body_cy + 2), (body_cx - 7, body_cy)
    ], P['cloth_purple_dark'])
    # 右袖
    px_poly(d, [
        (body_cx + 8, body_cy - 8), (body_cx + 12 + sleeve_flare, body_cy - 4),
        (body_cx + 11 + sleeve_flare, body_cy + 2), (body_cx + 7, body_cy)
    ], P['cloth_purple'])

    # --- 头 ---
    head_x = body_cx
    head_y = body_cy - 16
    # 脸
    px(d, head_x - 5, head_y - 3, P['skin'], 10, 8)
    px(d, head_x - 4, head_y + 2, P['skin_shadow'], 8, 2)
    # 眼睛（发光）
    eye_c = P['magic_purple_light'] if action in ('attack', 'skill1', 'skill2', 'skill3') else P['purple']
    px(d, head_x - 3, head_y, eye_c, 2, 2)
    px(d, head_x + 1, head_y, eye_c, 2, 2)
    # 胡子（白胡子老法师）
    px(d, head_x - 3, head_y + 3, P['hair_white'], 6, 4)
    px(d, head_x - 2, head_y + 6, P['hair_white'], 4, 3)
    px(d, head_x - 1, head_y + 8, P['silver'], 2, 2)

    # --- 尖顶法帽 ---
    hat_tilt = int(math.sin(fi * 0.4) * 1) if action == 'idle' else 0
    px_poly(d, [
        (head_x - 7, head_y - 3), (head_x + 7, head_y - 3),
        (head_x + 5 + hat_tilt, head_y - 6), (head_x - 5 + hat_tilt, head_y - 6)
    ], P['cloth_purple_dark'])
    px_poly(d, [
        (head_x - 5 + hat_tilt, head_y - 6), (head_x + 5 + hat_tilt, head_y - 6),
        (head_x + 1 + hat_tilt, head_y - 14), (head_x - 1 + hat_tilt, head_y - 14)
    ], P['cloth_purple'])
    px_poly(d, [
        (head_x - 3 + hat_tilt, head_y - 10), (head_x + 1 + hat_tilt, head_y - 10),
        (head_x + hat_tilt, head_y - 13)
    ], P['cloth_purple_light'])
    # 帽子金色饰带
    px(d, head_x - 6, head_y - 4, P['gold'], 12, 1)
    # 帽子顶部宝石
    px(d, head_x + hat_tilt - 1, head_y - 15, P['magic_purple'], 2, 2)

    # --- 法杖（右手）---
    staff_x = body_cx + int(px_ * 10)
    staff_y = body_cy + int(py_ * 4)
    staff_top_x = staff_x + int(vx * 2)
    staff_top_y = staff_y - 19
    # 杖身
    px_line(d, staff_x, staff_y + 6, staff_top_x, staff_top_y, P['wood'], 2)
    px_line(d, staff_x + 1, staff_y + 6, staff_top_x + 1, staff_top_y, P['wood_dark'], 1)
    # 杖身缠绕
    for k in range(3):
        wy = staff_y + 2 - k * 5
        px(d, staff_x - 1, wy, P['gold'], 3, 1)
    # 顶部宝石（发光）
    gem_glow = P['magic_purple_light'] if action in ('attack', 'skill1', 'skill2', 'skill3') else P['magic_purple']
    gem_size = 4 if action in ('attack', 'skill1', 'skill2', 'skill3') else 3
    px(d, staff_top_x - gem_size // 2, staff_top_y - gem_size // 2, gem_glow, gem_size, gem_size)
    px(d, staff_top_x - 1, staff_top_y - 1, P['bone'], 2, 2)
    # 宝石光晕（施法时）
    if action in ('attack', 'skill1', 'skill3') and fi % 2 == 0:
        px(d, staff_top_x - 3, staff_top_y - 3, P['magic_purple'], 6, 1)
        px(d, staff_top_x - 3, staff_top_y + 2, P['magic_purple'], 6, 1)
        px(d, staff_top_x - 3, staff_top_y - 2, P['magic_purple'], 1, 5)
        px(d, staff_top_x + 2, staff_top_y - 2, P['magic_purple'], 1, 5)

    # --- 左手：施法聚集 ---
    cast_x = body_cx - int(px_ * 9)
    cast_y = body_cy + int(py_ * 2)
    px_line(d, body_cx - int(px_ * 4), body_cy - 3, cast_x, cast_y, P['cloth_purple'], 2)
    px(d, cast_x - 1, cast_y - 1, P['skin'], 3, 3)

    # 攻击时左手聚集魔法球
    if action in ('attack', 'skill1', 'skill3'):
        t = fi / max(1, frames - 1)
        orb_size = int(2 + t * 4)
        orb_x = cast_x + int(vx * (4 + t * 8))
        orb_y = cast_y + int(vy * (4 + t * 8))
        px(d, orb_x - orb_size, orb_y - orb_size, P['magic_purple'], orb_size * 2, orb_size * 2)
        px(d, orb_x - orb_size + 1, orb_y - orb_size + 1, P['magic_purple_light'], orb_size * 2 - 2, orb_size * 2 - 2)
        px(d, orb_x - 1, orb_y - 1, P['bone'], 2, 2)
        # 魔法粒子
        for k in range(3):
            ang = fi * 0.5 + k * 2.1
            pr = 6 + k * 2
            ppx = orb_x + int(math.cos(ang) * pr)
            ppy = orb_y + int(math.sin(ang) * pr)
            px(d, ppx, ppy, P['magic_purple_light'], 1, 1)

    # skill1: 寒冰环
    if action == 'skill1':
        rr = 10 + fi * 2
        for a in range(0, 360, 45):
            ox = body_cx + int(math.cos(math.radians(a)) * rr)
            oy = body_cy + int(math.sin(math.radians(a)) * rr)
            px(d, ox - 1, oy - 1, P['silver_light'], 2, 2)

    # skill2: 法力涌泉
    if action == 'skill2':
        for k in range(4):
            oy = body_cy - 4 - k * 4 - (fi % 2) * 2
            px(d, body_cx - 2, oy, P['magic_purple_light'], 4, 2)

    # skill3: 陨石
    if action == 'skill3':
        px(d, body_cx - 4, body_cy - 22 + fi % 3, P['red'], 8, 5)
        px(d, body_cx - 2, body_cy - 20 + fi % 3, P['gold'], 4, 3)
        # 尾焰
        for k in range(3):
            px(d, body_cx - 3 + k, body_cy - 17 + fi % 3 + k, P['darkred'], 2, 2)


def draw_char_frame(cid, di, action, fi, fw=48, fh=64):
    im = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    vx, vy = dir_vec(di)
    px_, py_ = -vy, vx

    cx, cy = 24, 38
    frames = ACTIONS.get(action, 6)

    # 接地阴影
    shadow_w = 14
    d.ellipse((cx - shadow_w, cy + 14, cx + shadow_w, cy + 18), fill=(27, 27, 27, 140))

    death = action == 'death'
    hit = action == 'hit'

    if death:
        t = fi / max(1, frames - 1)
        cx += int(8 * t)
        cy += int(6 * t)

    # 绘制角色
    if cid == 'knight':
        draw_knight(d, cx, cy, vx, vy, px_, py_, action, fi, frames)
    elif cid == 'hunter':
        draw_hunter(d, cx, cy, vx, vy, px_, py_, action, fi, frames)
    else:
        draw_mage(d, cx, cy, vx, vy, px_, py_, action, fi, frames)

    im = add_pixel_outline(im)

    # 受击闪白（用原图 alpha 做蒙版，高效合成）
    if hit and fi == 0:
        white = Image.new('RGBA', im.size, (214, 208, 200, 200))
        mask = im.getchannel('A')
        im = Image.composite(white, im, mask)

    # 死亡淡出
    if death:
        alpha = max(0, 255 - int(220 * fi / (frames - 1)))
        im.putalpha(Image.eval(im.getchannel('A'), lambda a: min(a, alpha)))

    return im


def save_char(cid):
    out = ROOT / 'characters' / cid
    out.mkdir(parents=True, exist_ok=True)
    for action, frames in ACTIONS.items():
        sheet = Image.new('RGBA', (48 * frames, 64 * 8), (0, 0, 0, 0))
        for di in range(8):
            for fi in range(frames):
                sheet.alpha_composite(draw_char_frame(cid, di, action, fi), (fi * 48, di * 64))
        sheet.save(out / f'{action}.png')
    print(f'  character {cid}: done')


# ============================================================
#  怪物绘制
# ============================================================

def draw_ratman(d, c, cy, vx, vy, px_, py_, action, fi, size):
    """腐化鼠人：尖嘴+红眼睛+尾巴+匕首"""
    s = size / 48
    bob = -1 if action == 'walk' and fi % 2 else 0
    cy += bob

    # 攻击前扑
    lunge = 0
    if action == 'attack':
        t = fi / 4
        lunge = int(math.sin(t * math.pi) * 5 * s)
    bx = c + int(vx * lunge)
    by = cy

    # 尾巴（身后，弯曲）
    tail_x = c - int(vx * 8 * s)
    tail_y = cy + int(vy * 2 * s)
    tail_wag = int(math.sin(fi * 0.7) * 3 * s) if action in ('walk', 'idle') else 0
    px_line(d, tail_x, tail_y, tail_x - int(vx * 6 * s) + tail_wag, tail_y - 4 * s, P['fur_gray_dark'], max(1, int(2 * s)))
    px_line(d, tail_x - int(vx * 6 * s) + tail_wag, tail_y - 4 * s,
             tail_x - int(vx * 10 * s) + tail_wag * 2, tail_y + 2 * s, P['fur_gray_dark'], max(1, int(2 * s)))

    # 腿
    leg_swing = int(math.sin(fi * math.pi / 3) * 2 * s) if action == 'walk' else 0
    px(d, bx - 4 * s, by + 5 * s, P['fur_gray_dark'], int(3 * s), int(5 * s))
    px(d, bx + 1 * s, by + 5 * s, P['fur_gray'], int(3 * s), int(5 * s))

    # 身体
    px_poly(d, [
        (bx - 6 * s, by - 6 * s), (bx + 6 * s, by - 6 * s),
        (bx + 5 * s, by + 6 * s), (bx - 5 * s, by + 6 * s)
    ], P['fur_gray'])
    # 肚子（浅色）
    px(d, bx - 3 * s, by - 2 * s, P['monster_skin'], int(6 * s), int(6 * s))
    # 背部毛发纹理
    px(d, bx - 4 * s, by - 5 * s, P['fur_gray_dark'], int(8 * s), int(1 * s))

    # 头（尖嘴鼠头）
    head_x = bx + int(vx * 3 * s)
    head_y = by - 10 * s
    # 大耳朵
    px_poly(d, [(head_x - 6 * s, head_y - 2 * s), (head_x - 3 * s, head_y - 7 * s),
                (head_x - 1 * s, head_y - 2 * s)], P['fur_gray_dark'])
    px_poly(d, [(head_x + 1 * s, head_y - 2 * s), (head_x + 3 * s, head_y - 7 * s),
                (head_x + 6 * s, head_y - 2 * s)], P['fur_gray_dark'])
    px(d, head_x - 4 * s, head_y - 4 * s, P['skin_dark'], int(2 * s), int(2 * s))
    px(d, head_x + 2 * s, head_y - 4 * s, P['skin_dark'], int(2 * s), int(2 * s))
    # 头主体
    px_poly(d, [
        (head_x - 5 * s, head_y - 3 * s), (head_x + 5 * s, head_y - 3 * s),
        (head_x + 7 * s, head_y + 2 * s), (head_x + 4 * s, head_y + 4 * s),
        (head_x - 4 * s, head_y + 4 * s), (head_x - 7 * s, head_y + 2 * s)
    ], P['fur_gray'])
    # 尖嘴
    snout_x = head_x + int(vx * 5 * s)
    snout_y = head_y + 2 * s
    px_poly(d, [
        (snout_x - 2 * s, snout_y - 1 * s), (snout_x + 4 * s, snout_y),
        (snout_x + 5 * s, snout_y + 2 * s), (snout_x - 2 * s, snout_y + 2 * s)
    ], P['monster_skin'])
    # 鼻子
    px(d, snout_x + 4 * s, snout_y, P['black'], int(2 * s), int(2 * s))
    # 红眼睛（发光）
    eye_c = P['red'] if action == 'attack' else P['darkred']
    px(d, head_x - 3 * s, head_y - 1 * s, eye_c, int(2 * s), int(2 * s))
    px(d, head_x + 1 * s, head_y - 1 * s, eye_c, int(2 * s), int(2 * s))
    # 胡须
    px_line(d, snout_x, snout_y + 1 * s, snout_x - 5 * s, snout_y - 1 * s, P['bone'], 1)
    px_line(d, snout_x, snout_y + 1 * s, snout_x - 5 * s, snout_y + 3 * s, P['bone'], 1)

    # 手臂 + 匕首
    arm_x = bx + int(px_ * 7 * s)
    arm_y = by + int(py_ * 2 * s)
    # 攻击时手臂前伸
    if action == 'attack':
        arm_x += int(vx * 4 * s)
        arm_y += int(vy * 2 * s)
    hand_x = arm_x + int(vx * 5 * s)
    hand_y = arm_y + int(vy * 3 * s)
    px_line(d, bx + int(px_ * 4 * s), by, arm_x, arm_y, P['fur_gray_dark'], max(1, int(2 * s)))
    px(d, hand_x - 1, hand_y - 1, P['skin_dark'], int(3 * s), int(3 * s))
    # 匕首
    dag_tip_x = hand_x + int(vx * 8 * s)
    dag_tip_y = hand_y + int(vy * 8 * s)
    px_line(d, hand_x, hand_y, dag_tip_x, dag_tip_y, P['silver'], max(1, int(2 * s)))
    px(d, dag_tip_x - 1, dag_tip_y - 1, P['bone'], int(2 * s), int(2 * s))
    # 匕首柄
    px_line(d, hand_x, hand_y, hand_x - int(vx * 3 * s), hand_y - int(vy * 3 * s), P['wood_dark'], max(1, int(2 * s)))


def draw_werewolf(d, c, cy, vx, vy, px_, py_, action, fi, size):
    """饥渴狼人：狼头+獠牙+利爪+健壮身体"""
    s = size / 48
    bob = -1 if action == 'walk' and fi % 2 else 0
    cy += bob

    lunge = 0
    if action == 'attack':
        t = fi / 4
        lunge = int(math.sin(t * math.pi) * 6 * s)
    bx = c + int(vx * lunge)
    by = cy

    # 腿（粗壮）
    leg_swing = int(math.sin(fi * math.pi / 3) * 3 * s) if action == 'walk' else 0
    px(d, bx - 5 * s, by + 4 * s, P['fur_brown_dark'], int(4 * s), int(7 * s))
    px(d, bx + 1 * s, by + 4 * s, P['fur_brown'], int(4 * s), int(7 * s))
    # 爪子
    px(d, bx - 5 * s, by + 10 * s, P['bone'], int(4 * s), int(2 * s))
    px(d, bx + 1 * s, by + 10 * s, P['bone'], int(4 * s), int(2 * s))

    # 身体（健壮）
    px_poly(d, [
        (bx - 8 * s, by - 8 * s), (bx + 8 * s, by - 8 * s),
        (bx + 9 * s, by + 5 * s), (bx - 9 * s, by + 5 * s)
    ], P['fur_brown'])
    # 胸肌高光
    px(d, bx - 6 * s, by - 6 * s, P['fur_gray_light'], int(5 * s), int(6 * s))
    px(d, bx + 1 * s, by - 5 * s, P['fur_brown_dark'], int(6 * s), int(7 * s))
    # 腹部
    px(d, bx - 4 * s, by, P['monster_skin'], int(8 * s), int(4 * s))
    # 背部毛发
    for k in range(3):
        px(d, bx - 6 * s + k * 4 * s, by - 8 * s, P['fur_brown_dark'], int(2 * s), int(1 * s))

    # 头（狼头）
    head_x = bx + int(vx * 4 * s)
    head_y = by - 13 * s
    # 尖耳朵
    ear_tilt = int(math.sin(fi * 0.5) * 1) if action == 'idle' else 0
    px_poly(d, [(head_x - 7 * s, head_y - 2 * s), (head_x - 4 * s, head_y - 9 * s + ear_tilt),
                (head_x - 1 * s, head_y - 3 * s)], P['fur_brown_dark'])
    px_poly(d, [(head_x + 1 * s, head_y - 3 * s), (head_x + 4 * s, head_y - 9 * s + ear_tilt),
                (head_x + 7 * s, head_y - 2 * s)], P['fur_brown_dark'])
    px(d, head_x - 5 * s, head_y - 5 * s, P['skin_dark'], int(2 * s), int(3 * s))
    px(d, head_x + 3 * s, head_y - 5 * s, P['skin_dark'], int(2 * s), int(3 * s))
    # 头主体
    px_poly(d, [
        (head_x - 6 * s, head_y - 3 * s), (head_x + 6 * s, head_y - 3 * s),
        (head_x + 7 * s, head_y + 3 * s), (head_x + 5 * s, head_y + 5 * s),
        (head_x - 5 * s, head_y + 5 * s), (head_x - 7 * s, head_y + 3 * s)
    ], P['fur_brown'])
    # 嘴部（突出）
    muzzle_x = head_x + int(vx * 5 * s)
    muzzle_y = head_y + 2 * s
    px_poly(d, [
        (muzzle_x - 3 * s, muzzle_y - 1 * s), (muzzle_x + 5 * s, muzzle_y),
        (muzzle_x + 4 * s, muzzle_y + 3 * s), (muzzle_x - 3 * s, muzzle_y + 3 * s)
    ], P['fur_gray'])
    # 鼻子
    px(d, muzzle_x + 4 * s, muzzle_y, P['black'], int(2 * s), int(2 * s))
    # 獠牙（攻击时更明显）
    fang_size = int(3 * s) if action == 'attack' else int(2 * s)
    px(d, muzzle_x, muzzle_y + 2 * s, P['bone'], int(1 * s), fang_size)
    px(d, muzzle_x + 2 * s, muzzle_y + 2 * s, P['bone'], int(1 * s), fang_size)
    # 红眼睛
    eye_c = P['red'] if action == 'attack' else P['darkred']
    px(d, head_x - 4 * s, head_y - 1 * s, eye_c, int(2 * s), int(2 * s))
    px(d, head_x + 2 * s, head_y - 1 * s, eye_c, int(2 * s), int(2 * s))
    # 眼睛高光
    px(d, head_x - 3 * s, head_y - 1 * s, P['bone'], 1, 1)
    px(d, head_x + 3 * s, head_y - 1 * s, P['bone'], 1, 1)

    # 双臂 + 利爪（攻击时前伸）
    for side, sign in [('left', 1), ('right', -1)]:
        arm_x = bx + int(px_ * 8 * s * sign)
        arm_y = by + int(py_ * 3 * s * sign)
        if action == 'attack':
            arm_x += int(vx * 5 * s)
            arm_y += int(vy * 3 * s)
        hand_x = arm_x + int(vx * 6 * s)
        hand_y = arm_y + int(vy * 4 * s)
        px_line(d, bx + int(px_ * 5 * s * sign), by - 2 * s, arm_x, arm_y, P['fur_brown_dark'], max(1, int(3 * s)))
        # 爪子（攻击时张开）
        claw_spread = int(3 * s) if action == 'attack' else int(1 * s)
        for k in range(3):
            cang = math.atan2(vy, vx) + (k - 1) * 0.4
            cx_ = hand_x + int(math.cos(cang) * claw_spread)
            cy_ = hand_y + int(math.sin(cang) * claw_spread)
            px_line(d, hand_x, hand_y, cx_ + int(math.cos(cang) * 4 * s), cy_ + int(math.sin(cang) * 4 * s), P['bone'], max(1, int(2 * s)))


def draw_witch(d, c, cy, vx, vy, px_, py_, action, fi, size):
    """沼泽女巫：尖帽+绿脸+长鼻+法杖+毒雾"""
    s = size / 48
    bob = -1 if action == 'walk' and fi % 2 else 0
    cy += bob

    lean = 0
    if action == 'attack':
        t = fi / 4
        lean = int(math.sin(t * math.pi) * 3 * s)
    bx = c + int(vx * lean)
    by = cy

    # 长袍下摆
    robe_wave = int(math.sin(fi * 0.5) * 2 * s) if action in ('walk', 'idle') else 0
    px_poly(d, [
        (bx - 9 * s, by - 2 * s), (bx + 9 * s, by - 2 * s),
        (bx + 11 * s + robe_wave, by + 11 * s),
        (bx - 11 * s + robe_wave, by + 11 * s)
    ], P['cloth_purple_dark'])
    px_poly(d, [
        (bx - 7 * s, by), (bx + 7 * s, by),
        (bx + 9 * s + robe_wave, by + 10 * s),
        (bx - 9 * s + robe_wave, by + 10 * s)
    ], P['cloth_purple'])
    # 长袍补丁
    px(d, bx - 4 * s, by + 3 * s, P['cloth_green_dark'], int(3 * s), int(3 * s))
    px(d, bx + 2 * s, by + 6 * s, P['cloth_red_dark'], int(3 * s), int(2 * s))

    # 身体
    px_poly(d, [
        (bx - 7 * s, by - 9 * s), (bx + 7 * s, by - 9 * s),
        (bx + 8 * s, by - 1 * s), (bx - 8 * s, by - 1 * s)
    ], P['cloth_purple'])
    px(d, bx - 5 * s, by - 7 * s, P['cloth_purple_light'], int(4 * s), int(5 * s))

    # 头（绿色皱脸）
    head_x = bx
    head_y = by - 14 * s
    # 脸
    px(d, head_x - 4 * s, head_y - 2 * s, P['witch_skin'], int(8 * s), int(6 * s))
    px(d, head_x - 4 * s, head_y + 2 * s, P['witch_skin_dark'], int(8 * s), int(2 * s))
    # 皱纹
    px_line(d, head_x - 3 * s, head_y, head_x - 1 * s, head_y + 1 * s, P['witch_skin_dark'], 1)
    px_line(d, head_x + 1 * s, head_y, head_x + 3 * s, head_y + 1 * s, P['witch_skin_dark'], 1)
    # 长鼻子
    nose_x = head_x + int(vx * 3 * s)
    px_poly(d, [
        (nose_x - 1 * s, head_y + 1 * s), (nose_x + 4 * s, head_y + 2 * s),
        (nose_x + 3 * s, head_y + 4 * s), (nose_x - 1 * s, head_y + 3 * s)
    ], P['witch_skin'])
    px(d, nose_x + 3 * s, head_y + 3 * s, P['witch_skin_dark'], int(1 * s), int(1 * s))
    # 邪恶眼睛（黄色发光）
    eye_c = P['gold'] if action == 'attack' else P['green']
    px(d, head_x - 3 * s, head_y, eye_c, int(2 * s), int(2 * s))
    px(d, head_x + 1 * s, head_y, eye_c, int(2 * s), int(2 * s))
    px(d, head_x - 2 * s, head_y, P['black'], 1, 1)
    px(d, head_x + 2 * s, head_y, P['black'], 1, 1)
    # 邪恶笑容（缺牙）
    px_line(d, head_x - 2 * s, head_y + 4 * s, head_x + 2 * s, head_y + 4 * s, P['black'], 1)
    px(d, head_x - 1 * s, head_y + 4 * s, P['bone'], 1, 1)
    px(d, head_x + 1 * s, head_y + 4 * s, P['bone'], 1, 1)
    # 下巴痣
    px(d, head_x + 2 * s, head_y + 5 * s, P['black'], 1, 1)

    # 尖顶帽（歪的）
    hat_tilt = int(math.sin(fi * 0.4) * 2 * s)
    px_poly(d, [
        (head_x - 7 * s, head_y - 3 * s), (head_x + 7 * s, head_y - 3 * s),
        (head_x + 5 * s, head_y - 5 * s), (head_x - 5 * s, head_y - 5 * s)
    ], P['black'])
    px_poly(d, [
        (head_x - 5 * s + hat_tilt, head_y - 5 * s),
        (head_x + 5 * s + hat_tilt, head_y - 5 * s),
        (head_x + 2 * s + hat_tilt, head_y - 13 * s),
        (head_x - 2 * s + hat_tilt, head_y - 13 * s)
    ], P['cloth_purple_dark'])
    px_poly(d, [
        (head_x - 3 * s + hat_tilt, head_y - 9 * s),
        (head_x + 1 * s + hat_tilt, head_y - 9 * s),
        (head_x + hat_tilt, head_y - 12 * s)
    ], P['cloth_purple'])
    # 帽子带子
    px(d, head_x - 6 * s, head_y - 4 * s, P['gold'], int(12 * s), int(1 * s))

    # 法杖
    staff_x = bx + int(px_ * 9 * s)
    staff_y = by + int(py_ * 3 * s)
    staff_top_x = staff_x + int(vx * 1 * s)
    staff_top_y = staff_y - 12 * s
    px_line(d, staff_x, staff_y + 5 * s, staff_top_x, staff_top_y, P['wood'], max(1, int(2 * s)))
    # 顶部毒雾宝石
    gem_c = P['magic_green_light'] if action == 'attack' else P['magic_green']
    gs = int(4 * s) if action == 'attack' else int(3 * s)
    px(d, staff_top_x - gs // 2, staff_top_y - gs // 2, gem_c, gs, gs)
    px(d, staff_top_x - 1, staff_top_y - 1, P['bone'], 2, 2)
    # 毒雾粒子
    if action == 'attack' or fi % 3 == 0:
        for k in range(3):
            ang = fi * 0.4 + k * 2.1
            pr = 4 + k * 2
            ppx = staff_top_x + int(math.cos(ang) * pr * s)
            ppy = staff_top_y + int(math.sin(ang) * pr * s) - k
            px(d, ppx, ppy, P['magic_green'], 1, 1)

    # 左手（施法）
    cast_x = bx - int(px_ * 8 * s)
    cast_y = by + int(py_ * 2 * s)
    px_line(d, bx - int(px_ * 4 * s), by - 3 * s, cast_x, cast_y, P['cloth_purple'], max(1, int(2 * s)))
    px(d, cast_x - 1, cast_y - 1, P['witch_skin'], int(3 * s), int(3 * s))

    # 攻击时左手毒雾
    if action == 'attack':
        t = fi / 4
        orb_x = cast_x + int(vx * (3 + t * 6) * s)
        orb_y = cast_y + int(vy * (3 + t * 6) * s)
        os = int(2 + t * 3)
        px(d, orb_x - os, orb_y - os, P['magic_green'], os * 2, os * 2)
        px(d, orb_x - os + 1, orb_y - os + 1, P['magic_green_light'], os * 2 - 2, os * 2 - 2)


def draw_cyclops(d, c, cy, vx, vy, px_, py_, action, fi, size):
    """石肤巨人/独眼巨人：巨眼+獠牙+大木棒"""
    s = size / 48
    bob = -1 if action == 'walk' and fi % 2 else 0
    cy += bob

    # 攻击时高举木棒砸下
    raise_anim = 0
    if action == 'attack':
        t = fi / 4
        raise_anim = math.sin(t * math.pi)  # 0->1->0
    bx = c + int(vx * raise_anim * 3 * s)
    by = cy

    # 腿（极粗壮）
    leg_swing = int(math.sin(fi * math.pi / 3) * 2 * s) if action == 'walk' else 0
    px(d, bx - 6 * s, by + 6 * s, P['monster_skin_dark'], int(5 * s), int(8 * s))
    px(d, bx + 1 * s, by + 6 * s, P['monster_skin'], int(5 * s), int(8 * s))
    # 脚
    px(d, bx - 7 * s, by + 13 * s, P['monster_skin_dark'], int(6 * s), int(3 * s))
    px(d, bx + 1 * s, by + 13 * s, P['monster_skin'], int(6 * s), int(3 * s))

    # 身体（极其健壮）
    px_poly(d, [
        (bx - 11 * s, by - 10 * s), (bx + 11 * s, by - 10 * s),
        (bx + 13 * s, by + 7 * s), (bx - 13 * s, by + 7 * s)
    ], P['monster_skin'])
    # 肌肉高光
    px(d, bx - 9 * s, by - 8 * s, P['monster_skin'], int(6 * s), int(8 * s))
    px(d, bx - 8 * s, by - 7 * s, P['fur_gray_light'], int(4 * s), int(4 * s))
    # 肌肉阴影
    px(d, bx + 3 * s, by - 7 * s, P['monster_skin_dark'], int(8 * s), int(10 * s))
    # 腹肌
    for k in range(2):
        px(d, bx - 4 * s, by - 2 * s + k * 4 * s, P['monster_skin_dark'], int(8 * s), int(1 * s))
    # 伤疤
    px_line(d, bx - 6 * s, by - 5 * s, bx - 2 * s, by - 1 * s, P['darkred'], 1)
    px_line(d, bx + 2 * s, by + 2 * s, bx + 6 * s, by + 5 * s, P['darkred'], 1)

    # 头（巨大，一只大眼）
    head_x = bx + int(vx * 2 * s)
    head_y = by - 17 * s
    # 头主体
    px_poly(d, [
        (head_x - 9 * s, head_y - 6 * s), (head_x + 9 * s, head_y - 6 * s),
        (head_x + 10 * s, head_y + 5 * s), (head_x - 10 * s, head_y + 5 * s)
    ], P['monster_skin'])
    # 高光
    px(d, head_x - 7 * s, head_y - 4 * s, P['fur_gray_light'], int(5 * s), int(4 * s))
    # 阴影
    px(d, head_x + 3 * s, head_y - 3 * s, P['monster_skin_dark'], int(6 * s), int(6 * s))
    # 额头角/瘤
    px(d, head_x - 5 * s, head_y - 8 * s, P['monster_skin_dark'], int(3 * s), int(3 * s))
    px(d, head_x + 2 * s, head_y - 9 * s, P['monster_skin_dark'], int(4 * s), int(4 * s))
    # 巨大独眼
    eye_size = int(7 * s)
    eye_y = head_y - 1 * s
    # 眼白（黄色）
    px(d, head_x - eye_size, eye_y - eye_size // 2, P['gold'], eye_size * 2, eye_size)
    # 瞳孔（黑色，攻击时收缩/放大）
    pupil_size = int(3 * s) if action == 'attack' else int(4 * s)
    px(d, head_x - pupil_size, eye_y - pupil_size // 2, P['black'], pupil_size * 2, pupil_size)
    # 瞳孔高光
    px(d, head_x - pupil_size + 1, eye_y - pupil_size // 2 + 1, P['bone'], 1, 1)
    # 眼眶
    px_line(d, head_x - eye_size - 1, eye_y - eye_size // 2 - 1,
             head_x + eye_size + 1, eye_y - eye_size // 2 - 1, P['monster_skin_dark'], 1)
    # 眉毛（愤怒）
    brow_ang = 2 if action == 'attack' else 1
    px_line(d, head_x - eye_size, eye_y - eye_size // 2 - 2,
             head_x - 2 * s, eye_y - eye_size // 2 - 2 - brow_ang, P['monster_skin_dark'], max(1, int(2 * s)))
    px_line(d, head_x + 2 * s, eye_y - eye_size // 2 - 2 - brow_ang,
             head_x + eye_size, eye_y - eye_size // 2 - 2, P['monster_skin_dark'], max(1, int(2 * s)))
    # 嘴 + 獠牙
    mouth_w = int(6 * s) if action == 'attack' else int(4 * s)
    px(d, head_x - mouth_w, head_y + 3 * s, P['black'], mouth_w * 2, int(2 * s))
    # 獠牙
    fang_h = int(4 * s) if action == 'attack' else int(2 * s)
    px(d, head_x - 3 * s, head_y + 4 * s, P['bone'], int(2 * s), fang_h)
    px(d, head_x + 1 * s, head_y + 4 * s, P['bone'], int(2 * s), fang_h)

    # 手臂 + 大木棒（攻击时高举砸下）
    arm_x = bx + int(px_ * 11 * s)
    arm_y = by + int(py_ * 4 * s)
    if action == 'attack':
        # 高举
        arm_y -= int(raise_anim * 8 * s)
        arm_x += int(vx * raise_anim * 3 * s)
    hand_x = arm_x + int(vx * 4 * s)
    hand_y = arm_y + int(vy * 2 * s)
    px_line(d, bx + int(px_ * 7 * s), by - 4 * s, arm_x, arm_y, P['monster_skin'], max(1, int(4 * s)))
    px(d, hand_x - 2, hand_y - 2, P['monster_skin_dark'], int(4 * s), int(4 * s))

    # 大木棒（带钉子）
    club_ang = math.atan2(vy, vx)
    if action == 'attack':
        # 攻击时木棒从上方砸下
        club_ang += -1.2 + raise_anim * 2.0
    club_len = int(18 * s)
    club_tip_x = hand_x + int(math.cos(club_ang) * club_len)
    club_tip_y = hand_y + int(math.sin(club_ang) * club_len)
    # 木棒主体
    px_line(d, hand_x, hand_y, club_tip_x, club_tip_y, P['wood'], max(1, int(5 * s)))
    px_line(d, hand_x + 1, hand_y + 1, club_tip_x + 1, club_tip_y + 1, P['wood_dark'], max(1, int(2 * s)))
    # 木棒头部（更大）
    head_r = int(4 * s)
    px(d, club_tip_x - head_r, club_tip_y - head_r, P['wood'], head_r * 2, head_r * 2)
    px(d, club_tip_x - head_r + 1, club_tip_y - head_r + 1, P['wood_dark'], head_r * 2 - 2, head_r * 2 - 2)
    # 钉子
    for k in range(4):
        na = club_ang + k * 1.5
        nx = club_tip_x + int(math.cos(na) * head_r)
        ny = club_tip_y + int(math.sin(na) * head_r)
        px(d, nx - 1, ny - 1, P['silver'], int(2 * s), int(2 * s))


def draw_cultist(d, c, cy, vx, vy, px_, py_, action, fi, size):
    """虚空信徒：兜帽+红眼+符文长袍+黑暗能量"""
    s = size / 48
    bob = -1 if action == 'walk' and fi % 2 else 0
    cy += bob

    lean = 0
    if action == 'attack':
        t = fi / 4
        lean = int(math.sin(t * math.pi) * 3 * s)
    bx = c + int(vx * lean)
    by = cy

    # 长袍下摆（飘动的布条）
    robe_wave = int(math.sin(fi * 0.5) * 3 * s) if action in ('walk', 'idle') else 0
    px_poly(d, [
        (bx - 9 * s, by - 2 * s), (bx + 9 * s, by - 2 * s),
        (bx + 11 * s + robe_wave, by + 11 * s),
        (bx - 11 * s + robe_wave, by + 11 * s)
    ], P['black'])
    px_poly(d, [
        (bx - 7 * s, by), (bx + 7 * s, by),
        (bx + 9 * s + robe_wave, by + 10 * s),
        (bx - 9 * s + robe_wave, by + 10 * s)
    ], P['iron'])
    # 飘动布条
    for k in range(3):
        strip_x = bx - 6 * s + k * 5 * s + robe_wave
        px(d, strip_x, by + 8 * s, P['black'], int(2 * s), int(4 * s + k))

    # 身体
    px_poly(d, [
        (bx - 7 * s, by - 9 * s), (bx + 7 * s, by - 9 * s),
        (bx + 8 * s, by - 1 * s), (bx - 8 * s, by - 1 * s)
    ], P['iron'])
    # 胸口符文（紫色发光）
    rune_c = P['magic_purple_light'] if action in ('attack',) or fi % 4 < 2 else P['magic_purple']
    px(d, bx - 2 * s, by - 6 * s, rune_c, int(4 * s), int(1 * s))
    px(d, bx - 1 * s, by - 5 * s, rune_c, int(2 * s), int(4 * s))
    px(d, bx - 3 * s, by - 3 * s, rune_c, int(6 * s), int(1 * s))
    # 符文光晕
    if action == 'attack' or fi % 6 < 2:
        px(d, bx - 4 * s, by - 7 * s, P['magic_purple'], int(8 * s), int(1 * s))
        px(d, bx - 4 * s, by + 1 * s, P['magic_purple'], int(8 * s), int(1 * s))

    # 头（完全被兜帽遮住，只有红眼）
    head_x = bx
    head_y = by - 14 * s
    # 兜帽
    px_poly(d, [
        (head_x - 8 * s, head_y - 5 * s), (head_x + 8 * s, head_y - 5 * s),
        (head_x + 7 * s, head_y + 5 * s), (head_x - 7 * s, head_y + 5 * s)
    ], P['black'])
    px_poly(d, [
        (head_x - 6 * s, head_y - 6 * s), (head_x + 6 * s, head_y - 6 * s),
        (head_x + 4 * s, head_y - 2 * s), (head_x - 4 * s, head_y - 2 * s)
    ], P['iron'])
    # 兜帽内部（纯黑虚空）
    px(d, head_x - 5 * s, head_y - 1 * s, P['black'], int(10 * s), int(5 * s))
    # 红色发光眼睛
    eye_bright = P['red'] if action == 'attack' else P['darkred']
    eye_glow = P['blood'] if action == 'attack' else P['red']
    px(d, head_x - 4 * s, head_y + 1 * s, eye_glow, int(3 * s), int(2 * s))
    px(d, head_x + 1 * s, head_y + 1 * s, eye_glow, int(3 * s), int(2 * s))
    px(d, head_x - 3 * s, head_y + 1 * s, eye_bright, int(1 * s), int(1 * s))
    px(d, head_x + 2 * s, head_y + 1 * s, eye_bright, int(1 * s), int(1 * s))
    # 兜帽顶部尖角
    px_poly(d, [
        (head_x - 4 * s, head_y - 6 * s), (head_x + 4 * s, head_y - 6 * s),
        (head_x + 1 * s, head_y - 11 * s), (head_x - 1 * s, head_y - 11 * s)
    ], P['black'])

    # 双手在胸前聚集黑暗能量
    hand_y = by - 2 * s
    left_hand_x = bx - int(px_ * 5 * s)
    right_hand_x = bx + int(px_ * 5 * s)
    # 手臂
    px_line(d, bx - int(px_ * 6 * s), by - 5 * s, left_hand_x, hand_y, P['black'], max(1, int(3 * s)))
    px_line(d, bx + int(px_ * 6 * s), by - 5 * s, right_hand_x, hand_y, P['black'], max(1, int(3 * s)))
    # 手（骷髅手）
    px(d, left_hand_x - 1, hand_y - 1, P['bone'], int(3 * s), int(3 * s))
    px(d, right_hand_x - 1, hand_y - 1, P['bone'], int(3 * s), int(3 * s))

    # 双手之间的黑暗能量球
    if action == 'attack' or fi % 3 == 0:
        t = fi / 4 if action == 'attack' else fi / 6
        orb_size = int(2 + t * 4)
        orb_x = bx
        orb_y = hand_y
        px(d, orb_x - orb_size, orb_y - orb_size, P['magic_purple'], orb_size * 2, orb_size * 2)
        px(d, orb_x - orb_size + 1, orb_y - orb_size + 1, P['magic_purple_light'], orb_size * 2 - 2, orb_size * 2 - 2)
        px(d, orb_x - 1, orb_y - 1, P['bone'], 2, 2)
        # 环绕粒子
        for k in range(4):
            ang = fi * 0.6 + k * 1.57
            pr = 5 + k
            ppx = orb_x + int(math.cos(ang) * pr * s)
            ppy = orb_y + int(math.sin(ang) * pr * s)
            px(d, ppx, ppy, P['magic_purple_light'], 1, 1)

    # 攻击时能量向前发射
    if action == 'attack' and fi >= 2:
        for k in range(3):
            ex = bx + int(vx * (6 + k * 4) * s)
            ey = hand_y + int(vy * (2 + k * 3) * s)
            px(d, ex - 1, ey - 1, P['magic_purple_light'], int(3 * s), int(3 * s))


def draw_monster_frame(mid, di, action, fi, size=48):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    vx, vy = dir_vec(di)
    px_, py_ = -vy, vx

    c = size // 2
    cy = int(size * 0.56)

    # 接地阴影
    shadow_w = int(size * 0.22)
    d.ellipse((c - shadow_w, cy + int(size * 0.28), c + shadow_w, cy + int(size * 0.34)),
              fill=(27, 27, 27, 140))

    if mid == 'ratman':
        draw_ratman(d, c, cy, vx, vy, px_, py_, action, fi, size)
    elif mid == 'werewolf':
        draw_werewolf(d, c, cy, vx, vy, px_, py_, action, fi, size)
    elif mid == 'witch':
        draw_witch(d, c, cy, vx, vy, px_, py_, action, fi, size)
    elif mid == 'cyclops':
        draw_cyclops(d, c, cy, vx, vy, px_, py_, action, fi, size)
    else:
        draw_cultist(d, c, cy, vx, vy, px_, py_, action, fi, size)

    im = add_pixel_outline(im)

    # 受击闪白
    if action == 'hit' and fi == 0:
        white = Image.new('RGBA', im.size, (214, 208, 200, 200))
        mask = im.getchannel('A')
        im = Image.composite(white, im, mask)

    # 死亡：像素消散
    if action == 'death':
        for k in range(fi + 2):
            xx = (k * 11 + di * 3) % max(2, size - 8)
            yy = (k * 7 + fi * 5) % max(2, size - 8)
            for dy_ in range(3):
                for dx_ in range(3):
                    if 0 <= xx + dx_ < size and 0 <= yy + dy_ < size:
                        im.putpixel((xx + dx_, yy + dy_), (0, 0, 0, 0))

    return im


def save_mon(mid, size):
    out = ROOT / 'monsters' / 'common'
    out.mkdir(parents=True, exist_ok=True)
    frames = {'idle': 4, 'walk': 6, 'attack': 5, 'hit': 2, 'death': 6}
    for action, n in frames.items():
        sh = Image.new('RGBA', (size * n, size * 8), (0, 0, 0, 0))
        for di in range(8):
            for fi in range(n):
                sh.alpha_composite(draw_monster_frame(mid, di, action, fi, size), (fi * size, di * size))
        sh.save(out / f'{mid}_{action}.png')
    print(f'  monster {mid}: done')


# ============================================================
#  主程序
# ============================================================

if __name__ == '__main__':
    print('=== Q版俯视动作肉鸽像素精灵生成 v4 ===')
    print(f'输出目录: {ROOT}')

    print('\n[1/3] 生成角色精灵...')
    for cid in ('knight', 'hunter', 'mage'):
        save_char(cid)

    print('\n[2/3] 生成怪物精灵...')
    for mid, size in [('ratman', 48), ('werewolf', 48), ('witch', 48),
                       ('cyclops', 64), ('cultist', 48)]:
        save_mon(mid, size)

    print('\n[3/3] 更新 manifest...')
    manifest = {
        'version': '4.0-chibi-action',
        'palette': {k: v for k, v in P.items() if k in [
            'black', 'iron', 'darkred', 'red', 'bone', 'gold',
            'purple', 'blue', 'green', 'ash']},
        'characters': {c: list(ACTIONS.keys()) for c in ('knight', 'hunter', 'mage')},
        'bosses': ['wolf_king', 'bat_lord', 'elder_witch', 'cyclops_chief', 'dark_lord'],
        'monsters': ['ratman', 'werewolf', 'witch', 'cyclops', 'cultist'],
        'tilesets': ['dungeon', 'forest', 'swamp', 'ruins', 'temple'],
        'note': 'Chibi top-down action roguelike sprites: oversized heads/weapons, hard outlines, exaggerated attack readability'
    }
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2),
                                          encoding='utf-8')

    total = sum(1 for _ in ROOT.rglob('*.png'))
    print(f'\n完成！共生成/更新 {total} 个 PNG 资源')
    print('提示：角色与普通怪完成 Q 版动作化升级；Boss 保持兼容原资源。')
