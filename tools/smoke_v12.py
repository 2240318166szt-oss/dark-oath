#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V12 静态冒烟检查（无依赖，Python 3 标准库）。

用法：
    python tools/smoke_v12.py            # 在项目根目录或任意目录运行均可
    python tools/smoke_v12.py --quiet    # 只打印失败与总结

检查项：
  1. index.html 里所有 id 与 game.js 中 $('...') 引用的差集（引用不存在的 DOM 会直接报错）
  2. V12 关键函数/常量是否已定义（levelPlan / spawnLevel / HEX_POOL / applyHex / drawPortal …）
  3. 是否把 game.wave 误改成 game.level（D9 禁止项）
  4. 海克斯池规模：42 条 / 8 条已实现机制型 / 5 条 TODO 已移出卡池
  5. 新增存档字段默认值 / 新面板 DOM / 样式是否齐全
  6. 有 node 时顺带跑 node --check

退出码：0 全部通过；1 有失败项。
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "index.html"
CSS_PATH = ROOT / "style.css"
JS_PATH = ROOT / "game.js"

# 运行时由 JS 动态创建的按钮，不需要预先存在于 index.html
RUNTIME_IDS = {"buyPotion", "buyGear"}

REQUIRED_SYMBOLS = [
    "levelPlan",       # 关卡配置纯函数
    "levelStage",      # 关内序（不动 game.wave）
    "spawnLevel",      # 分批涌入
    "updateLevelState",# combat→clearDelay→cleared→portal 状态机
    "beginPortal",     # 通道生成
    "updatePortal",    # 12s 挂机防呆
    "armPortalIdle",   # 面板关闭后才起算
    "portalTypeFor",   # 章节推进式形态映射
    "beginPortalEnter",# 进入演出开始
    "updatePortalEnter",# 进入演出推进
    "drawPortal",      # 通道绘制入口（base/glow 两层）
    "HEX_POOL",        # 42 条海克斯
    "HEX_BY_ID",
    "applyHex",
    "recalcHex",
    "drawDecals",
]

FAILS = []
OKS = []


def ok(msg):
    OKS.append(msg)


def fail(msg):
    FAILS.append(msg)


def read(p):
    return p.read_text(encoding="utf-8")


def check_dom_ids(html, js):
    # data-page-node-id="..." 的尾巴也长成 id="..."，必须用负向后顾排除
    html_ids = set(re.findall(r'(?<![\w-])id="([^"]+)"', html))
    js_ids = set(re.findall(r"\$\('([^']+)'\)", js)) | set(re.findall(r'\$\("([^"]+)"\)', js))
    missing = sorted(js_ids - html_ids - RUNTIME_IDS)
    if missing:
        fail("game.js 引用了 index.html 里不存在的 id：%s" % ", ".join(missing))
    else:
        ok("DOM id 引用一致（JS 引用 %d 个，HTML 定义 %d 个）" % (len(js_ids), len(html_ids)))
    return html_ids


def check_symbols(js):
    missing = []
    for sym in REQUIRED_SYMBOLS:
        pat = r"(?:\bfunction\s+%s\s*\(|\b(?:const|let|var)\s+%s\s*=)" % (sym, sym)
        if not re.search(pat, js):
            missing.append(sym)
    if missing:
        fail("缺少关键函数/常量定义：%s" % ", ".join(missing))
    else:
        ok("关键函数/常量齐全（%d 项）" % len(REQUIRED_SYMBOLS))


def check_level_misuse(js):
    """D9：禁止把 game.wave 改名成 game.level。game.level 是角色等级，允许但必须干净。"""
    allowed = (
        "game.level=1",
        "game.level++",
        "${game.level}",
        "game.level}",
        "LV.${game.level}",
    )
    suspects = []
    # game.levelPlan / game.levelStage 不是误用，用负向前瞻把 level 与后续标识符分开
    pat = re.compile(r"game\.level(?![A-Za-z])")
    for no, line in enumerate(js.splitlines(), 1):
        if not pat.search(line):
            continue
        if any(a in line for a in allowed):
            continue
        # 同一行出现关卡语义关键词 → 极可能是把 wave 写成了 level
        if any(k in line for k in ("wave", "关卡", "portal", "remain", "spawnLevel")):
            suspects.append("第 %d 行：%s" % (no, line.strip()[:110]))
    if suspects:
        fail("疑似把 game.wave 误用成 game.level：\n    " + "\n    ".join(suspects))
    else:
        ok("未发现 game.wave → game.level 的误用")


def check_hex_pool(js):
    ids = re.findall(r"(?:linHX|mulHX|HX)\(\s*'([a-z]{2}_[a-z_]+)'", js)
    total = len(ids)
    off = len(re.findall(r"\bnull\s*,\s*true\s*\)", js))
    if total != 42:
        fail("海克斯条目数 = %d，期望 42" % total)
    else:
        ok("海克斯池 42 条")
    if off != 5:
        fail("移出卡池（off）的条目 = %d，期望 5（D11 剩余 5 条机制型）" % off)
    else:
        ok("5 条未实现机制型已在卡池外")
    mech = ["gd_chain", "gd_burst", "gd_echo", "gd_orb", "gd_blink", "gd_volley", "gd_fork", "pr_stormheart"]
    miss = [m for m in mech if "'" + m + "'" not in js]
    if miss:
        fail("D11 优先保留的 8 条机制型缺失：%s" % ", ".join(miss))
    else:
        ok("D11 的 8 条机制型全部在池内")
    for bad in ("pr_bloodpact", "pr_nova", "pr_meteor", "pr_martyr", "pr_timeglass"):
        if "'" + bad + "'" not in js:
            fail("TODO 机制型 %s 应保留定义（标记 off），当前完全缺失" % bad)


def check_tuning(js):
    """时长与规则参数必须与定稿一致，防止后续手改漂移。"""
    want = {
        "CLEAR_T": ".60",
        "SHOW_T": "1.68",
        "SHOW_BOSS_T": "3.20",
        "GROW_T": ".90",
        "PORTAL_R": "46",
        "PORTAL_AUTO_T": "12",
        "ENTER_T": ".35",
    }
    bad = []
    for name, val in want.items():
        m = re.search(r"\b%s\s*=\s*([0-9.]+)" % name, js)
        if not m:
            bad.append("%s 未定义" % name)
        elif m.group(1) != val:
            bad.append("%s=%s（应为 %s）" % (name, m.group(1), val))
    if bad:
        fail("通道时序参数与定稿不一致：" + "；".join(bad))
    else:
        ok("通道时序参数与定稿一致（0.60/1.68/3.20/0.90 + 半径46 + 12s + 进入0.35s）")

    if "portal_lock" in js:
        fail("仍存在已删除的 portal_lock 状态")
    elif "game.state='portal_enter'" not in js:
        fail("缺少 portal_enter 进入演出状态")
    else:
        ok("状态机为 combat/clearing/cleared_show/portal_grow/portal_ready/portal_enter")

    if "RANGED_ONLY={sv_pierce:1,sv_bounce:1,gd_fork:1}" not in js.replace(" ", ""):
        fail("缺少远程专属卡过滤表 RANGED_ONLY（骑士会抽到空卡）")
    else:
        ok("远程专属卡过滤表存在（骑士不抽 sv_pierce/sv_bounce/gd_fork）")

    packed = js.replace(" ", "")
    if "constang2=Math.atan2(po.y-ey,po.x-ex)" not in packed:
        fail("边缘箭头 HUD 滑移后没有重算角度（会指错方向）")
    else:
        ok("边缘箭头滑移后重算 ang2（指向锚点而非旧射线）")

    if "functionportalHitsHud(" not in packed or "PORTAL_BOX=" not in packed:
        fail("缺少通道与 HUD 的排斥检测（门会生成在面板底下）")
    else:
        ok("通道锚点 HUD 排斥逻辑存在")

    if "Math.hypot(po.x-p.x,po.y-p.y)" in packed:
        fail("portalTier 仍在用 hypot（热路径应为平方距离）")
    else:
        ok("portalTier 使用平方距离")

    if "forced:!!forced" not in js.replace(" ", ""):
        fail("保底宝箱缺少 forced 标记（会出宝箱怪）")
    else:
        ok("保底宝箱 forced 标记存在（不出宝箱怪）")


def check_save_and_ui(html, css, js):
    for field in ("autoPortal", "crispFx", "decals"):
        if not re.search(r"\b%s\s*:" % field, js):
            fail("defaultSave().settings 缺少默认值：%s" % field)
    if "settings:{volume" in js and "autoPortal" in js:
        ok("新增存档字段有默认值（旧存档 Object.assign 兼容）")

    for dom_id in ("hexPanel", "hexChoices", "hexSub", "hexSkip"):
        if 'id="%s"' % dom_id not in html:
            fail("index.html 缺少海克斯面板节点 #%s" % dom_id)
    else:
        pass
    if all('id="%s"' % i in html for i in ("hexPanel", "hexChoices", "hexSub", "hexSkip")):
        ok("海克斯面板 DOM 齐全")

    if ".hex-panel" not in css:
        fail("style.css 缺少 .hex-panel 样式")
    missing_color = [c for c in ("#c8c8c8", "#e8c878", "#9ad8ff", "#c86aff") if c not in css.lower()]
    if missing_color:
        fail("style.css 缺少稀有度着色：%s" % ", ".join(missing_color))
    elif ".hex-panel" in css:
        ok("海克斯面板样式与四档稀有度着色齐全")


def check_syntax():
    node = shutil.which("node")
    if not node:
        ok("未找到 node，跳过 node --check（静态检查已通过）")
        return
    r = subprocess.run([node, "--check", str(JS_PATH)], capture_output=True, text=True)
    if r.returncode != 0:
        fail("node --check 失败：%s" % (r.stderr.strip() or r.stdout.strip()))
    else:
        ok("node --check game.js 通过")


def main():
    quiet = "--quiet" in sys.argv
    for p in (HTML_PATH, CSS_PATH, JS_PATH):
        if not p.exists():
            print("[FAIL] 缺少文件 %s" % p)
            return 1
    html, css, js = read(HTML_PATH), read(CSS_PATH), read(JS_PATH)

    check_syntax()
    check_dom_ids(html, js)
    check_symbols(js)
    check_level_misuse(js)
    check_hex_pool(js)
    check_tuning(js)
    check_save_and_ui(html, css, js)

    if not quiet:
        for m in OKS:
            print("[ OK ] %s" % m)
    if FAILS:
        for m in FAILS:
            print("[FAIL] %s" % m)
        print("\n结果：%d 项通过，%d 项失败" % (len(OKS), len(FAILS)))
        return 1
    print("\n结果：%d 项全部通过" % len(OKS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
