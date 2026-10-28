// V12 无头冒烟（Node，零依赖）：用最小 DOM/Canvas 桩加载 game.js，真实跑关卡状态机、
// 通道、海克斯 42 条与三职业技能，抓运行时异常与数值越界。
// 用法：node tools/smoke_v12_headless.js   （退出码 0 全过；1 有失败）
const fs = require('fs');
const vm = require('vm');
const SRC = 'C:/Users/00/Desktop/game/game.js';

let nowMs = 0;
const gradient = { addColorStop() {} };
function makeCtx() {
  const base = {
    canvas: { width: 1280, height: 720 },
    globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, font: '10px monospace', textAlign: 'left', lineCap: 'butt', lineDashOffset: 0,
    imageSmoothingEnabled: false,
    createRadialGradient: () => gradient, createLinearGradient: () => gradient,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: [] }),
  };
  return new Proxy(base, {
    get(t, k) { if (k in t) return t[k]; return () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const ctx = makeCtx();

function makeClassList(el) {
  return {
    add(c) { el._cls.add(c); },
    remove(c) { el._cls.delete(c); },
    contains(c) { return el._cls.has(c); },
    toggle(c) { if (el._cls.has(c)) el._cls.delete(c); else el._cls.add(c); },
  };
}
const els = {};
function makeEl(id, cls) {
  const el = {
    id, _cls: new Set(cls || []), children: [], style: {}, dataset: {}, value: '1', checked: true,
    textContent: '', innerHTML: '', hidden: false, clientWidth: 1280, clientHeight: 720,
    width: 1280, height: 720, options: [], selectedOptions: [], files: [],
    getContext: () => ctx,
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return makeEl(id + '-child'); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
    closest() { return null; },
    focus() {},
  };
  el.classList = makeClassList(el);
  return el;
}
function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }
// 预先给已知的面板元素加 hidden 类，模拟 index.html
['classSelect', 'campPanel', 'controlsPanel', 'settingsPanel', 'talentPanel', 'inventoryPanel', 'statsPanel', 'shopPanel', 'pausePanel', 'resultPanel', 'achPanel', 'hexPanel']
  .forEach(id => getEl(id)._cls.add('hidden'));

const document = {
  getElementById: getEl,
  querySelectorAll(sel) {
    if (sel === '.panel') return Object.values(els).filter(e => e._cls.has('panel') || true);
    return [];
  },
  querySelector() { return null; },
  createElement(tag) { const e = makeEl('created-' + tag); if (tag === 'canvas') { e.width = 1280; e.height = 720; } return e; },
  addEventListener() {}, removeEventListener() {},
  body: { appendChild() {}, removeChild() {} },
  documentElement: { requestFullscreen() {} },
  hidden: false,
  fullscreenElement: null,
};

const store = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map, Error, isNaN, parseInt, parseFloat, Infinity, NaN,
  setTimeout: () => 0, clearTimeout: () => {},
  performance: { now: () => nowMs },
  requestAnimationFrame: cb => { sandbox.__raf = cb; return 1; },
  document, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  location: { search: '?dev=1' },
  navigator: {},
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } set src(v) { this._src = v; } },
  AudioContext: undefined, webkitAudioContext: undefined,
  URLSearchParams,
  Blob: class {}, URL: { createObjectURL: () => 'blob:', revokeObjectURL() {} },
  FileReader: class {},
  ResizeObserver: undefined,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.addEventListener = () => {};
sandbox.document = document;
const context = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), context, { filename: SRC });

const O = sandbox.__oath;
if (!O) throw new Error('window.__oath 未暴露：脚本可能没跑到结尾');
const game = O.game;

// 升级会弹天赋三选一（会暂停游戏）；流程测试里自动点掉，否则关卡推进会被卡住
function clearTalent() {
  const tp = els['talentPanel'];
  if (!tp || tp._cls.has('hidden')) return;
  const root = els['talentChoices'];
  const c = root.children[root.children.length - 1];
  if (c && c.onclick) c.onclick();
}
function step(n, ms = 16.7) {
  for (let i = 0; i < n; i++) { nowMs += ms; sandbox.__raf(nowMs); if (!game.hexOpen) clearTalent(); }
}
const log = [];
function chk(name, fn) {
  try { fn(); log.push('PASS  ' + name); console.log('PASS  ' + name); }
  catch (e) { log.push('FAIL  ' + name + ' :: ' + (e && e.stack ? e.stack.split('\n')[0] : e)); throw e; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

chk('关卡数量公式符合 level-flow 采样表', () => {
  const cases = [[1, 6, 0], [5, 8, 2], [10, 11, 0], [15, 14, 4], [20, 7, 6], [25, 13, 3], [30, 17, 0],
    [35, 20, 5], [40, 9, 8], [45, 18, 5], [50, 21, 0], [55, 25, 6], [60, 11, 10], [65, 22, 6],
    [70, 26, 0], [75, 30, 6], [80, 13, 12], [85, 26, 6], [90, 31, 0], [95, 35, 6], [100, 9, 8]];
  for (const [n, total, elite] of cases) {
    const p = O.levelPlan(n);
    assert(p.total === total, `n=${n} total=${p.total} 期望 ${total}`);
    assert(p.eliteN === elite, `n=${n} eliteN=${p.eliteN} 期望 ${elite}`);
  }
});

chk('三职业开局 + 首关分批刷怪', () => {
  for (const cid of ['knight', 'hunter', 'mage']) {
    O.startRun(cid);
    step(3);
    assert(game.state === 'combat', cid + ' state=' + game.state);
    assert(game.levelPlan.total === 6, cid + ' 首关总数=' + game.levelPlan.total);
    step(120);
    assert(game.enemies.length > 0, cid + ' 120 帧后没有敌人');
  }
});

chk('清空 → 结算 → 通道 → 进入下一关', () => {
  O.startRun('knight');
  step(10);
  for (let guard = 0; guard < 400 && game.state === 'combat'; guard++) {
    for (let i = game.enemies.length - 1; i >= 0; i--) O.killEnemy(game.enemies[i]);
    step(5);
  }
  assert(game.remain <= 0, 'remain=' + game.remain);
  let portalSeen = false;
  for (let i = 0; i < 400; i++) { step(1); if (game.portal) { portalSeen = true; break; } }
  assert(portalSeen, '清空后没有生成通道，state=' + game.state);
  for (let i = 0; i < 400 && game.state !== 'portal_ready'; i++) step(1);
  assert(game.state === 'portal_ready', '通道未进入可进入状态：' + game.state);
  game.player.x = game.portal.x; game.player.y = game.portal.y;
  O.beginPortalEnter();
  assert(game.state === 'portal_enter', '按 E 后应先进入 portal_enter，实际 ' + game.state);
  const fromX = game.player.x;
  step(10);
  assert(game.player.enterAlpha < 1, '进入演出期间角色应淡出');
  step(30);
  assert(game.wave === 2, '进入演出结束后 wave=' + game.wave);
  assert(game.state === 'combat', '新关卡 state=' + game.state);
  void fromX;
});

chk('通道形态映射：1-2 章坑道 / 3-4 章石门 / 5 章与首领裂隙', () => {
  O.startRun('knight');
  const mk = (n, boss) => O.levelPlan(n);
  const typeAt = n => { const p = mk(n); return O.__portalType ? O.__portalType(p) : null; };
  void typeAt;
  // 直接验 plan 字段 + 已知映射结果：通过 beginPortal 的 type 反推
  const cases = [[5, 'trapdoor'], [25, 'trapdoor'], [45, 'stone_door'], [65, 'stone_door'], [85, 'rift'], [100, 'rift'], [20, 'rift'], [40, 'rift'], [60, 'rift'], [80, 'rift']];
  for (const [n, want] of cases) {
    game.wave = n;
    game.enemies.length = 0; game.remain = 0; game.spawnQueue.length = 0; game.pendingSpawns = 0;
    game.levelPlan = O.levelPlan(n);
    game.state = 'cleared_show'; game.clearT = 0.01;
    step(2);
    if (game.state === 'portal_ready' || game.state === 'portal_grow') {
      assert(game.portal && game.portal.type === want, `n=${n} 期望 ${want}，实际 ${game.portal && game.portal.type}`);
      assert(game.portal.r === 46, `n=${n} 进入半径应统一 46，实际 ${game.portal.r}`);
    }
    game.portal = null; game.state = 'combat';
  }
});

chk('通道锚点：最后一击坐标 + clamp + 小于 80px 推到 120px 外', () => {
  O.startRun('knight');
  const makePortal = (n) => {
    game.wave = n; game.enemies.length = 0; game.remain = 0; game.spawnQueue.length = 0; game.pendingSpawns = 0;
    game.levelPlan = O.levelPlan(n);
    game.state = 'cleared_show'; game.clearT = 0.01;
    step(2);
    return game.portal;
  };
  game.player.x = 640; game.player.y = 360;
  game.lastHitX = 5000; game.lastHitY = 9999;
  let po = makePortal(4);
  assert(Math.abs(po.x - 1120) < 1 && Math.abs(po.y - 600) < 1, `clamp 失效 (${po.x},${po.y})`);
  game.portal = null; game.state = 'combat';
  game.player.x = 600; game.player.y = 400;
  game.lastHitX = 600; game.lastHitY = 400;
  po = makePortal(4);
  const d = Math.hypot(po.x - 600, po.y - 400);
  assert(d >= 118, '距玩家 <80px 时应推到 120px 外，实际 ' + d.toFixed(1));
});

chk('时序：普通关 3.18s / 首领 4.70s / 跳过演出 1.50s', () => {
  O.startRun('knight');
  const toReady = (n) => {
    game.wave = n; O.spawnLevel();
    game.enemies.length = 0; game.remain = 0; game.spawnQueue.length = 0; game.pendingSpawns = 0;
    step(1); // combat → clearing
    let f = 0;
    while (game.state !== 'portal_ready' && f < 900) { step(1); f++; }
    return f; // clearing 起算的帧数
  };
  const normal = toReady(4);            // 0.60+1.68+0.90 = 3.18s ≈ 190 帧
  assert(normal >= 182 && normal <= 202, '普通关到 ready 帧数=' + normal);
  const boss = toReady(20);             // 0.60+3.20+0.90 = 4.70s ≈ 281 帧
  assert(boss >= 272 && boss <= 294, '首领关到 ready 帧数=' + boss);
  // 跳过演出：clearing 0.60 + grow 0.90 = 1.50s ≈ 90 帧
  game.wave = 4; O.spawnLevel();
  game.enemies.length = 0; game.remain = 0; game.spawnQueue.length = 0; game.pendingSpawns = 0;
  step(1);
  let f2 = 0;
  while (game.state !== 'cleared_show' && f2 < 200) { step(1); f2++; }
  game.skipShow = true;
  while (game.state !== 'portal_ready' && f2 < 400) { step(1); f2++; }
  assert(f2 >= 82 && f2 <= 100, '跳过演出到 ready 帧数=' + f2);
});

chk('第 3 关清空后弹海克斯且可选', () => {
  game.wave = 3; O.spawnLevel(); step(5);
  for (let guard = 0; guard < 400 && game.state === 'combat'; guard++) {
    for (let i = game.enemies.length - 1; i >= 0; i--) O.killEnemy(game.enemies[i]);
    step(5);
  }
  for (let i = 0; i < 500 && !game.hexOpen; i++) step(1);
  assert(game.hexOpen, '未弹海克斯面板 state=' + game.state);
  assert(game.paused, '面板未暂停游戏');
  assert(game.state === 'portal_ready' && game.portal, '面板应在通道就绪那一帧弹出（portal 已存在）');
  assert(game.hexOptions.length >= 1, '海克斯选项为空');
  const id = game.hexOptions[0].id;
  // 面板打开期间直接调用 enterPortal 也必须被拒（E 键会走 tryPortalEnter，这里测兜底层）
  const waveBefore = game.wave;
  O.beginPortalEnter();
  assert(game.wave === waveBefore && game.hexOpen, '面板打开时不应开始进入演出');
  O.chooseHex(id);
  assert(!game.hexOpen && !game.paused, '选择后未恢复');
  assert((game.hexLayers[id] || 0) === 1, '层数未生效');
  assert(game.state === 'portal_ready' && game.portal, '选卡后应停在 portal_ready，可立即按 E');
});

chk('全部 42 条海克斯可叠加且钩子不崩', () => {
  O.startRun('hunter'); step(2);
  game.hexEvents = 40;
  for (const h of O.HEX_POOL) {
    if (h.off) { assert((game.hexLayers[h.id] || 0) === 0, h.id + ' 不应在卡池内'); continue; }
    for (let i = 0; i < h.cap; i++) O.applyHex(h.id);
    assert(game.hexLayers[h.id] === h.cap, h.id + ' 未叠满');
  }
  // 护栏：乘区被夹紧
  assert(game.hex.atkMult <= 2.6001, 'atkMult 越界 ' + game.hex.atkMult);
  assert(game.hex.hpMult <= 2.2001, 'hpMult 越界 ' + game.hex.hpMult);
  assert(game.hex.atkSpeed <= 0.9001 && game.hex.crit <= 0.9001 && game.hex.cdr <= 0.4501 && game.hex.lifesteal <= 0.3001, '其余护栏越界');
  game.mouse.down = true;
  step(400);            // 打怪 → 雷链/齐射/分裂/风暴/环绕 全部走一遍
  O.dodge(); step(30);  // 闪避残影
  for (let i = 0; i < 3; i++) { game.player.mana = 999; O.castSkill(i); step(70); } // 技能回响 + 特效
  for (let i = game.enemies.length - 1; i >= 0; i--) O.killEnemy(game.enemies[i]); // 尸爆
  step(60);
  game.mouse.down = false;
});

chk('首领关：召唤物不参与清空判定', () => {
  game.wave = 20; O.spawnLevel(); step(3);
  assert(game.levelPlan.boss && game.remain === 7, '首领关配置异常 total=' + game.remain);
  step(300);
  const summoned = game.enemies.filter(e => e.summoned).length;
  const normal = game.enemies.filter(e => !e.summoned).length;
  assert(normal === game.remain, `remain=${game.remain} 非召唤物=${normal}`);
  for (let i = game.enemies.length - 1; i >= 0; i--) { const e = game.enemies[i]; if (e && !e.summoned) O.killEnemy(e); }
  step(30); // hitStop 0.16s 内 update 会提前返回，多跑几帧再判定
  assert(game.remain === 0, '首领关 remain=' + game.remain);
  assert(game.state !== 'combat', '首领关清空后仍停在 combat');
  step(400);
  assert(game.portal, '首领关清空后没有通道');
  assert(game.portal.type === 'rift', '首领关通道应为 rift，实际 ' + game.portal.type);
  void summoned;
});

chk('第 100 关直接结局', () => {
  game.wave = 100; O.spawnLevel(); step(3);
  for (let g = 0; g < 800 && game.running && game.state === 'combat'; g++) {
    for (let i = game.enemies.length - 1; i >= 0; i--) O.killEnemy(game.enemies[i]);
    step(6);
  }
  step(600);
  assert(!game.running, '第 100 关没有走 endRun，state=' + game.state);
  assert(!game.portal, '第 100 关不应创建通道对象');
  assert(game.showTitle === '裂境闭合', '第 100 关标题应为裂境闭合，实际 ' + game.showTitle);
});

chk('low 画质全流程无异常', () => {
  O.save.settings.quality = 'low';
  O.startRun('mage'); step(5);
  game.mouse.down = true; step(240);
  for (let i = 0; i < 3; i++) { game.player.mana = 999; O.castSkill(i); step(60); }
  game.mouse.down = false;
  O.save.settings.quality = 'high';
});

chk('旧存档缺字段读取不报错', () => {
  assert(O.save.settings.autoPortal === true, 'autoPortal 默认值缺失');
  assert(O.save.settings.crispFx === true, 'crispFx 默认值缺失');
  assert(O.save.settings.decals === true, 'decals 默认值缺失');
});

chk('通道自动进入：站门口挂机 12s 才进，离开即清零', () => {
  O.startRun('knight'); step(3);
  game.enemies.length = 0; game.remain = 0; game.spawnQueue.length = 0; game.pendingSpawns = 0;
  for (let i = 0; i < 500 && game.state !== 'portal_ready'; i++) step(1);
  assert(game.state === 'portal_ready', '未到 portal_ready：' + game.state);
  game.player.x = game.portal.x; game.player.y = game.portal.y;
  step(300);                       // 5s：不应进入
  assert(game.wave === 1, '12s 前不应自动进入，wave=' + game.wave);
  game.player.x = game.portal.x + 120; step(30);   // 离开 → 计时清零
  game.player.x = game.portal.x; game.player.y = game.portal.y;
  step(400);                       // 累计不到 12s
  assert(game.wave === 1, '离开后应重新计时，wave=' + game.wave);
  step(400);                       // 累计超过 12s
  assert(game.state === 'portal_enter' || game.wave === 2, '挂机 12s 应触发进入演出，state=' + game.state);
  step(30);                        // 0.35s 演出
  assert(game.wave === 2, '演出结束后应进入下一关，wave=' + game.wave);
});

chk('地面残留上限与海克斯抽卡不变量', () => {
  O.startRun('hunter'); step(2);
  for (let i = 0; i < 40; i++) O.addDecal('scorch', 100 + i, 100, 30, .5);
  const cap = O.save.settings.quality === 'low' ? 2 : O.save.settings.quality === 'medium' ? 5 : 8;
  assert(game.decals.length <= cap, 'decals ' + game.decals.length + ' 超过上限 ' + cap);
  for (let ev = 1; ev <= 40; ev++) {
    game.hexEvents = ev; game.wave = Math.min(100, ev * 3);
    const opts = O.rollHexOptions();
    assert(opts.length === 3, `第 ${ev} 次事件只抽到 ${opts.length} 张`);
    const ids = opts.map(o => o.id);
    assert(new Set(ids).size === 3, '同一次事件出现重复卡：' + ids.join(','));
    for (const o of opts) assert(!o.off, '卡池混入未实现条目 ' + o.id);
  }
});

chk('骑士抽不到远程专属卡', () => {
  O.startRun('knight');
  game.hexEvents = 30; game.wave = 30;
  for (let i = 0; i < 60; i++) {
    const ids = O.rollHexOptions().map(o => o.id);
    for (const bad of ['sv_pierce', 'sv_bounce', 'gd_fork']) {
      assert(ids.indexOf(bad) < 0, '骑士卡池出现了远程专属 ' + bad);
    }
  }
  O.startRun('hunter');
  game.hexEvents = 30; game.wave = 30;
  let seen = 0;
  for (let i = 0; i < 200; i++) {
    const ids = O.rollHexOptions().map(o => o.id);
    if (ids.some(id => id === 'sv_pierce' || id === 'sv_bounce' || id === 'gd_fork')) seen++;
  }
  assert(seen > 0, '猎人应当仍能抽到远程专属卡');
});

chk('通关保底箱强制为普通宝箱（不出宝箱怪）', () => {
  O.startRun('knight');
  game.props.length = 0;
  O.spawnProp('chest', 400, 300, true);
  const pr = game.props[game.props.length - 1];
  assert(pr && pr.forced === true, '宝箱未标记 forced');
  for (let i = 0; i < 80; i++) O.useProp(pr);
  assert(game.enemies.filter(e => e.mimic).length === 0, 'forced 宝箱不该生成宝箱怪');
});

chk('通道锚点避开 HUD 面板（小地图 / 角色面板 / 技能托盘 / 首领条）', () => {
  O.startRun('knight');
  const cases = [[1150, 180], [300, 90], [640, 700], [1240, 650], [900, 170], [500, 610], [1120, 600], [160, 170]];
  for (const [hx, hy] of cases) {
    for (const type of ['trapdoor', 'stone_door', 'rift']) {
      game.player.x = 640; game.player.y = 400;
      game.lastHitX = hx; game.lastHitY = hy;
      const po = O.portalAnchor(type);
      assert(!O.portalHitsHud(po.x, po.y, type), `lastHit(${hx},${hy}) ${type} → 锚点(${po.x.toFixed(0)},${po.y.toFixed(0)}) 仍被 HUD 遮挡`);
    }
  }
});

console.log('\nALL HEADLESS CHECKS PASSED (' + log.length + ' checks)');
