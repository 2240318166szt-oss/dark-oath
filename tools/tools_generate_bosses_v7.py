# -*- coding: utf-8 -*-
"""
V7 Boss 素材重绘:5 Boss × 2 阶段 × 8 方向 × 6 帧,全新程序化像素生成器。
相比旧版(色块拼接),每个 Boss 由剪影部件 + 三阶明暗 + 装备/武器 + 呼吸/挥舞动画构成。
原图已备份于 Assets/_original/bosses/。
sheet 规格与旧版一致:行=8方向(DIRS),列=6帧;ch1-3=96×96,ch4-5=128×128。
"""
import math, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'Assets', 'bosses')
FRAMES = 6
SIZES = {'wolf_king': 96, 'bat_lord': 96, 'elder_witch': 96, 'cyclops_chief': 128, 'dark_lord': 128}
OUTLINE = (14, 10, 20, 255)


def sc(c, f):
    return (min(255, int(c[0] * f)), min(255, int(c[1] * f)), min(255, int(c[2] * f)), 255)


class Spr:
    def __init__(self, s):
        self.s = s
        self.buf = [[(0, 0, 0, 0)] * s for _ in range(s)]

    def set(self, x, y, c):
        x = int(round(x)); y = int(round(y))
        if 0 <= x < self.s and 0 <= y < self.s:
            self.buf[y][x] = c

    def ell(self, cx, cy, rx, ry, col):
        for y in range(int(math.floor(cy - ry)), int(math.ceil(cy + ry)) + 1):
            for x in range(int(math.floor(cx - rx)), int(math.ceil(cx + rx)) + 1):
                dx = (x - cx) / rx if rx > 0 else 0
                dy = (y - cy) / ry if ry > 0 else 0
                if dx * dx + dy * dy <= 1.06:
                    f = 1.16 if dy < -0.35 else (0.72 if dy > 0.44 else 1.0)
                    if abs(dx) > 0.58:
                        f *= 0.88
                    self.set(x, y, sc(col, f))

    def poly(self, pts, col):
        ys = [p[1] for p in pts]
        y0, y1 = int(min(ys)), int(max(ys))
        lo, hi = min(ys), max(ys)
        n = len(pts)
        for y in range(y0, y1 + 1):
            xs = []
            for i in range(n):
                xa, ya = pts[i]; xb, yb = pts[(i + 1) % n]
                if (ya <= y < yb) or (yb <= y < ya):
                    xs.append(xa + (y - ya) / (yb - ya) * (xb - xa))
            xs.sort()
            rel = (y - lo) / (hi - lo) if hi > lo else 0
            f = 1.14 if rel < 0.28 else (0.74 if rel > 0.78 else 1.0)
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(math.ceil(xs[i])), int(math.floor(xs[i + 1])) + 1):
                    self.set(x, y, sc(col, f))

    def bar(self, x0, y0, x1, y1, w, col):
        steps = int(max(abs(x1 - x0), abs(y1 - y0), 1)) * 3
        r = w // 2
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            f = 1.1 if i < steps * 0.25 else (0.8 if i > steps * 0.8 else 1.0)
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    self.set(x + dx, y + dy, sc(col, f))

    def outline(self):
        snap = [row[:] for row in self.buf]
        for y in range(self.s):
            for x in range(self.s):
                if snap[y][x][3] == 0:
                    hit = False
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < self.s and 0 <= ny < self.s and snap[ny][nx][3] > 0:
                                hit = True; break
                        if hit: break
                    if hit:
                        self.buf[y][x] = OUTLINE

    def image(self):
        im = Image.new('RGBA', (self.s, self.s), (0, 0, 0, 0))
        px = im.load()
        for y in range(self.s):
            for x in range(self.s):
                px[x, y] = self.buf[y][x]
        return im


# ============ 狼王:直立狼人,毛皮+獠牙+金冠 ============
def wolf(s, k, ph, t, back, lean):
    bob = math.sin(t * 6.2832) * 1.6
    arm = math.sin(t * 6.2832) * 2.6
    FUR = (98, 108, 122) if ph == 1 else (78, 86, 104)
    DFUR = (66, 74, 88) if ph == 1 else (54, 60, 76)
    BELLY = (152, 160, 168)
    SNOUT = (128, 136, 146)
    CROWN = (216, 168, 66)
    CLAW = (222, 224, 230)
    EYE = (255, 66, 48) if ph == 1 else (255, 96, 72)
    # 腿
    s.ell(40 * k, (78 + bob * .4) * k, 5 * k, 9 * k, DFUR)
    s.ell(56 * k, (78 - bob * .4) * k, 5 * k, 9 * k, DFUR)
    s.ell(38 * k, (86 + bob * .4) * k, 5 * k, 3 * k, DFUR)
    s.ell(58 * k, (86 - bob * .4) * k, 5 * k, 3 * k, DFUR)
    # 尾巴
    s.poly([(32 * k, 66 * k), (14 * k, 58 * k), (9 * k, 66 * k), (24 * k, 74 * k)], DFUR)
    # 躯干 + 腹部
    s.ell(48 * k, (52 + bob) * k, 16 * k, 19 * k, FUR)
    s.ell(48 * k, (56 + bob) * k, 9 * k, 12 * k, BELLY)
    # 鬃毛尖刺(二阶段更张扬)
    mane = 8 if ph == 1 else 11
    for i in range(5):
        a = -0.9 + i * 0.45
        sx = 48 + math.sin(a) * 15
        sy = 50 + bob - math.cos(a) * 17
        s.poly([((sx - 3) * k, (sy + 6) * k), (sx * k, (sy - mane) * k), ((sx + 3) * k, (sy + 6) * k)], DFUR)
    # 手臂 + 利爪
    for side in (-1, 1):
        ax = 48 + side * (17 + arm * .55 * side * 0 + abs(arm) * .55)
        s.ell(ax * k, (53 + bob) * k, 5.5 * k, 12 * k, FUR)
        for c in range(3):
            s.bar((ax - 3 + c * 3) * k, (63 + bob) * k, (ax - 4 + c * 3) * k, (68 + bob) * k, 1, CLAW)
    # 头
    hy = 25 + bob
    s.ell(48 * k, hy * k, 13 * k, 11 * k, FUR)
    for side in (-1, 1):
        s.poly([((48 + side * 4) * k, (hy - 8) * k), ((48 + side * 9) * k, (hy - 19) * k), ((48 + side * 11) * k, (hy - 6) * k)], FUR)
    if not back:
        s.ell((48 + lean * 1.5) * k, (hy + 4.5) * k, 7 * k, 4.5 * k, SNOUT)
        s.ell((48 + lean * 2.2) * k, (hy + 3.6) * k, 1.7 * k, 1.3 * k, (30, 32, 38))
        for side in (-1, 1):
            s.ell((48 + side * 5 + lean) * k, (hy - 1.5) * k, 1.9 * k, 1.6 * k, EYE)
            if ph == 2:
                s.set((48 + side * 5 + lean) * k, (hy - 1.5) * k, (255, 210, 200, 255))
    # 金冠
    cy = hy - 11
    s.poly([(40 * k, cy * k), (56 * k, cy * k), (56 * k, (cy + 3.5) * k), (40 * k, (cy + 3.5) * k)], CROWN)
    for sx in (42, 48, 54):
        s.poly([(sx * k, (cy + .5) * k), ((sx + 2) * k, (cy + 3.5) * k), ((sx - 2) * k, (cy + 3.5) * k)], sc(CROWN, 1.18))
    if ph == 2:
        s.ell(48 * k, (cy + 2) * k, 1.4 * k, 1.4 * k, (255, 60, 60))


# ============ 蝙蝠领主:悬浮+膜翼扇动 ============
def bat(s, k, ph, t, back, lean):
    flap = math.sin(t * 6.2832)
    bob = flap * 2.0 - 1.0
    MEM = (104, 80, 138) if ph == 1 else (86, 62, 120)
    BONE = (54, 42, 76)
    FUR = (90, 68, 122) if ph == 1 else (72, 52, 104)
    BELLY = (156, 134, 176)
    EYE = (255, 70, 54) if ph == 1 else (255, 110, 70)
    span = 44 if ph == 1 else 48
    # 双翼(扇动)
    for side in (-1, 1):
        fy = flap * 9 * side * 0 + flap * 9
        pts = [(48 * k, 44 * k), ((48 + side * 16) * k, (30 - fy * .7) * k),
               ((48 + side * 32) * k, (23 - fy) * k), ((48 + side * span) * k, (33 - fy) * k),
               ((48 + side * 31) * k, (47 - fy * .45) * k), ((48 + side * 17) * k, (51) * k),
               (48 * k, 53 * k)]
        s.poly(pts, MEM)
        for tip in (16, 32, span):
            s.bar(48 * k, 44 * k, (48 + side * tip) * k, (30 - fy * (tip / span)) * k, 1, BONE)
    # 小爪
    s.ell(44 * k, (67 + bob) * k, 2.5 * k, 4 * k, BONE)
    s.ell(52 * k, (67 + bob) * k, 2.5 * k, 4 * k, BONE)
    # 躯干
    s.ell(48 * k, (50 + bob) * k, 9 * k, 13 * k, FUR)
    s.ell(48 * k, (53 + bob) * k, 5 * k, 8 * k, BELLY)
    # 头
    hy = 30 + bob
    s.ell(48 * k, hy * k, 11 * k, 10 * k, FUR)
    for side in (-1, 1):
        s.poly([((48 + side * 3) * k, (hy - 7) * k), ((48 + side * 8) * k, (hy - 22) * k), ((48 + side * 10) * k, (hy - 5) * k)], FUR)
    if not back:
        for side in (-1, 1):
            s.ell((48 + side * 4.5 + lean) * k, (hy - 1.5) * k, 2.1 * k, 1.8 * k, EYE)
            if ph == 2:
                s.set((48 + side * 4.5 + lean) * k, (hy - 1.5) * k, (255, 220, 190, 255))
        s.bar((44 + lean) * k, (hy + 4.5) * k, (52 + lean) * k, (hy + 4.5) * k, 1, (30, 22, 40))
        s.set((45 + lean) * k, (hy + 5.5) * k, (240, 240, 236, 255))
        s.set((51 + lean) * k, (hy + 5.5) * k, (240, 240, 236, 255))
        if ph == 2:
            s.bar((46 + lean) * k, (hy + 6) * k, (50 + lean) * k, (hy + 6) * k, 1, (150, 40, 40))


# ============ 女巫长老:法袍+尖帽+发光法杖 ============
def witch(s, k, ph, t, back, lean):
    bob = math.sin(t * 6.2832) * 1.4
    sway = math.sin(t * 6.2832) * 2.2
    ROBE = (56, 80, 64) if ph == 1 else (46, 62, 56)
    TRIM = (146, 172, 124)
    SKIN = (216, 180, 152)
    HAT = (40, 54, 46)
    BAND = (186, 144, 64)
    ORB = (120, 240, 150) if ph == 1 else (255, 110, 90)
    stx = 64
    pulse = 0.85 + 0.15 * math.sin(t * 12.56)
    # 法杖(身后)
    s.bar(stx * k, 18 * k, (stx - sway * .4) * k, 82 * k, 2, (96, 70, 46))
    s.ell(stx * k, 15 * k, 4.5 * k, 4.5 * k, sc(ORB, pulse))
    for a in range(4):
        aa = t * 6.2832 + a * 1.57
        s.set((stx + math.cos(aa) * 7) * k, (15 + math.sin(aa) * 7) * k, sc(ORB, .7 * pulse))
    # 法袍(下摆随呼吸摆动,二阶段破烂边)
    hem = [(28 + sway, 82), (34, 88), (40, 80), (46, 88), (52, 80), (58, 88), (64, 80), (68 - sway, 84)] if ph == 2 \
        else [(28 + sway, 84), (68 - sway, 84)]
    pts = [(38, 46), (58, 46)] + [(68 - sway, 82)] + [(x, y) for x, y in reversed(hem)] + [(28 + sway, 82)]
    s.poly([(x * k, y * k) for x, y in pts], ROBE)
    # 袖臂
    s.bar(44 * k, (52 + bob) * k, (stx - 3) * k, (46 + bob) * k, 4, ROBE)
    s.ell((stx - 3) * k, (46 + bob) * k, 2.2 * k, 2.2 * k, SKIN)
    s.bar(52 * k, (52 + bob) * k, (58 + sway) * k, (42 + bob) * k, 4, ROBE)
    s.ell((58 + sway) * k, (41 + bob) * k, 2.2 * k, 2.2 * k, SKIN)
    # 头
    hy = 33 + bob
    s.ell(48 * k, hy * k, 9 * k, 9.5 * k, SKIN)
    if not back:
        for side in (-1, 1):
            s.ell((48 + side * 3.5 + lean * .5) * k, (hy - .5) * k, 1.5 * k, 1.3 * k, ORB)
        s.set((48 + lean * .5) * k, (hy + 2) * k, (140, 108, 88, 255))
        s.bar((46 + lean * .5) * k, (hy + 5) * k, (50 + lean * .5) * k, (hy + 5) * k, 1, (120, 84, 70))
    else:
        s.ell(48 * k, (hy + 2) * k, 6 * k, 5 * k, (188, 150, 128))
    # 尖帽
    s.poly([(32 * k, (hy - 6) * k), (64 * k, (hy - 6) * k), (62 * k, (hy - 2.5) * k), (34 * k, (hy - 2.5) * k)], HAT)
    s.poly([(37 * k, (hy - 6.5) * k), (59 * k, (hy - 6.5) * k), ((50 + sway * .5) * k, (hy - 25) * k)], HAT)
    s.bar(41 * k, (hy - 9.5) * k, 55 * k, (hy - 9.5) * k, 2, BAND)
    s.set(48 * k, (hy - 9.5) * k, (255, 220, 130, 255))


# ============ 独眼巨人首领:巨躯+独眼+骨棒 ============
def cyclops(s, k, ph, t, back, lean):
    bob = math.sin(t * 6.2832) * 2.2
    SKIN = (146, 128, 100) if ph == 1 else (132, 106, 86)
    BELLY = (172, 154, 124)
    STONE = (126, 116, 106)
    IRIS = (228, 152, 52) if ph == 1 else (255, 72, 48)
    raise_ = math.sin(t * 6.2832) * 5
    # 腿柱
    s.ell(52 * k, (104 + bob * .3) * k, 9 * k, 14 * k, SKIN)
    s.ell(76 * k, (104 - bob * .3) * k, 9 * k, 14 * k, SKIN)
    # 躯干
    s.ell(64 * k, (70 + bob) * k, 25 * k, 28 * k, SKIN)
    s.ell(64 * k, (82 + bob) * k, 14 * k, 13 * k, BELLY)
    if ph == 2:  # 熔岩裂纹
        for seg in (((52, 56), (57, 64), (53, 72)), ((76, 60), (72, 70), (78, 80)), ((64, 92), (68, 98))):
            for i in range(len(seg) - 1):
                s.bar(seg[i][0] * k, (seg[i][1] + bob) * k, seg[i + 1][0] * k, (seg[i + 1][1] + bob) * k, 1, (255, 140, 60))
    # 左臂垂下
    s.ell(37 * k, (74 + bob) * k, 8 * k, 16 * k, SKIN)
    s.ell(37 * k, (90 + bob) * k, 6.5 * k, 5 * k, SKIN)
    # 右臂举骨棒
    s.bar(88 * k, (68 + bob) * k, (97 + raise_ * .4) * k, (46 + bob) * k, 6, SKIN)
    s.bar((97 + raise_ * .4) * k, (46 + bob) * k, (102 + raise_) * k, (24 + bob) * k, 5, (112, 86, 58))
    s.ell((104 + raise_) * k, (21 + bob) * k, 9 * k, 8 * k, STONE)
    for dx in (-5, 0, 5):
        s.poly([((104 + dx + raise_) * k, (14 + bob) * k), ((105.5 + dx + raise_) * k, (8 + bob) * k), ((107 + dx + raise_) * k, (14 + bob) * k)], STONE)
    # 头
    hy = 33 + bob
    s.ell(64 * k, hy * k, 16 * k, 14 * k, SKIN)
    s.ell(64 * k, (hy + 8) * k, 10 * k, 6 * k, sc(SKIN, 1.06))
    for side in (-1, 1):
        s.poly([((64 + side * 6) * k, (hy + 9) * k), ((64 + side * 8) * k, (hy + 13) * k), ((64 + side * 9.5) * k, (hy + 8.5) * k)], (230, 226, 214))
    s.bar(52 * k, (hy - 7) * k, 76 * k, (hy - 7) * k, 3, (86, 72, 58))
    if not back:
        s.ell(64 * k, (hy - .5) * k, 7 * k, 6.5 * k, (242, 238, 228))
        s.ell((64 + lean) * k, (hy - .5) * k, 3.4 * k, 3.2 * k, IRIS)
        s.ell((64 + lean) * k, (hy - .5) * k, 1.3 * k, 1.3 * k, (24, 18, 20))
        if ph == 2:
            s.set((64 + lean) * k, (hy - 2) * k, (255, 190, 160, 255))


# ============ 黑暗魔君:重甲+披风+巨剑 ============
def darklord(s, k, ph, t, back, lean):
    bob = math.sin(t * 6.2832) * 1.8
    sway = math.sin(t * 6.2832) * 3.2
    ARMOR = (62, 62, 76) if ph == 1 else (52, 50, 66)
    ARMOR_L = (100, 102, 120)
    CAPE = (100, 24, 36) if ph == 1 else (78, 18, 32)
    BONEC = (208, 200, 188)
    BLADE = (198, 204, 216)
    EYE = (255, 70, 56) if ph == 1 else (178, 108, 255)
    swx = 98 + math.sin(t * 6.2832) * 1.5
    # 披风(身后,底摆飘动)
    pts = [(44, 50), (84, 50), (97 + sway, 106), (86, 101), (76, 108), (64, 102), (54, 108), (43, 101), (31 + sway, 106)]
    s.poly([(x * k, y * k) for x, y in pts], CAPE)
    # 腿甲
    s.bar(56 * k, 86 * k, 56 * k, 106 * k, 7, ARMOR)
    s.bar(72 * k, 86 * k, 72 * k, 106 * k, 7, ARMOR)
    s.bar(56 * k, 106 * k, 60 * k, 108 * k, 5, ARMOR_L)
    s.bar(72 * k, 106 * k, 76 * k, 108 * k, 5, ARMOR_L)
    # 躯干甲
    s.ell(64 * k, (66 + bob) * k, 21 * k, 25 * k, ARMOR)
    s.bar(64 * k, (50 + bob) * k, 64 * k, (84 + bob) * k, 2, ARMOR_L)
    if ph == 2:  # 甲裂魔光
        for seg in (((54, 58), (58, 68), (54, 78)), ((74, 56), (70, 68), (75, 80))):
            for i in range(len(seg) - 1):
                s.bar(seg[i][0] * k, (seg[i][1] + bob) * k, seg[i + 1][0] * k, (seg[i + 1][1] + bob) * k, 1, (178, 108, 255))
    # 肩甲 + 角刺
    for side in (-1, 1):
        s.ell((64 + side * 24) * k, (52 + bob) * k, 9 * k, 7 * k, ARMOR_L)
        s.poly([((64 + side * 24) * k, (46 + bob) * k), ((66 + side * 24) * k, (36 + bob) * k), ((69 + side * 24) * k, (47 + bob) * k)], BONEC)
    # 头盔
    hy = 32 + bob
    s.ell(64 * k, hy * k, 13 * k, 12 * k, ARMOR_L)
    for side in (-1, 1):
        s.poly([((64 + side * 6) * k, (hy - 8) * k), ((64 + side * 16) * k, (hy - 24) * k), ((64 + side * 11) * k, (hy - 4) * k)], BONEC)
    if not back:
        s.bar((54 + lean) * k, hy * k, (74 + lean) * k, hy * k, 4, (18, 14, 24))
        s.ell((59 + lean) * k, hy * k, 1.6 * k, 1.4 * k, EYE)
        s.ell((69 + lean) * k, hy * k, 1.6 * k, 1.4 * k, EYE)
    # 巨剑(右手侧)
    s.poly([((swx - 4) * k, 24 * k), (swx * k, 13 * k), ((swx + 4) * k, 24 * k)], BLADE)
    s.bar(swx * k, 22 * k, swx * k, 76 * k, 6, BLADE)
    s.bar((swx - 2) * k, 24 * k, (swx - 2) * k, 74 * k, 2, (232, 238, 246))
    s.bar((swx - 8) * k, 46 * k, (swx + 8) * k, 46 * k, 3, (216, 168, 66))
    s.bar(swx * k, 48 * k, swx * k, 58 * k, 3, (74, 54, 38))
    if ph == 2:
        for ry in (32, 44, 56, 68):
            s.set(swx * k, ry * k, (200, 140, 255, 255))


BOSS_FN = {'wolf_king': wolf, 'bat_lord': bat, 'elder_witch': witch, 'cyclops_chief': cyclops, 'dark_lord': darklord}
# 行序与 DIRS 一致:down, down_left, left, up_left, up, up_right, right, down_right
ROWS = [('front', 0), ('front', -2.5), ('front', -4.5), ('back', -2.5), ('back', 0), None, None, None]


def make_sheet(bid):
    sz = SIZES[bid]
    k = sz / 96.0
    fn = BOSS_FN[bid]
    sheet = Image.new('RGBA', (sz * FRAMES, sz * 8), (0, 0, 0, 0))
    for ph in (1, 2):
        for row in range(8):
            if ROWS[row] is None:  # 右侧行 = 左侧行镜像
                src_row = {5: 3, 6: 2, 7: 1}[row]
                kl, ll = ROWS[src_row]
                for f in range(FRAMES):
                    spr = Spr(sz); fn(spr, k, ph, f / FRAMES, kl == 'back', ll); spr.outline()
                    im = spr.image().transpose(Image.FLIP_LEFT_RIGHT)
                    sheet.alpha_composite(im, (f * sz, row * sz))
            else:
                kind, lean = ROWS[row]
                for f in range(FRAMES):
                    spr = Spr(sz); fn(spr, k, ph, f / FRAMES, kind == 'back', lean); spr.outline()
                    sheet.alpha_composite(spr.image(), (f * sz, row * sz))
        sheet.convert('RGBA').save(os.path.join(OUT, f'{bid}_phase{ph}.png'))
        print('generated', bid, 'phase', ph)


def preview():
    names = [('wolf_king', 1, 0, 0), ('bat_lord', 1, 0, 2), ('elder_witch', 2, 0, 0),
             ('cyclops_chief', 2, 0, 1), ('dark_lord', 2, 0, 3), ('wolf_king', 2, 0, 0)]
    cell = 140
    sh = Image.new('RGBA', (cell * len(names), cell), (30, 28, 34, 255))
    for i, (bid, ph, row, f) in enumerate(names):
        im = Image.open(os.path.join(OUT, f'{bid}_phase{ph}.png')).convert('RGBA')
        sz = SIZES[bid]
        fr = im.crop((f * sz, row * sz, (f + 1) * sz, (row + 1) * sz))
        fr = fr.resize((cell - 8, cell - 8), Image.NEAREST)
        sh.alpha_composite(fr, (i * cell + 4, 4))
    sh.save(os.path.join(ROOT, 'boss_preview_v7.png'))
    print('preview -> boss_preview_v7.png')


if __name__ == '__main__':
    for bid in BOSSES_ORDER if False else ['wolf_king', 'bat_lord', 'elder_witch', 'cyclops_chief', 'dark_lord']:
        make_sheet(bid)
    preview()
