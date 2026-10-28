(() => {
'use strict';
const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W = canvas.width, H = canvas.height;
const SAVE_KEY = 'dark_oath_roguelike_v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function inAoe(target,x,y,r){const rr=r+(target.r||0),dx=target.x-x,dy=target.y-y;return dx*dx+dy*dy<=rr*rr;}
// 绘制裁剪：屏幕外（含 70px 余量）的实体一律跳过，省掉 drawImage 与矢量构造
function onScreen(x,y,m=70){return x>-m&&x<W+m&&y>-m&&y<H+m;}

const DIRS=['down','down_left','left','up_left','up','up_right','right','down_right'];
const CHAR_ACTIONS={idle:6,walk:8,attack:6,hit:3,death:8,skill1:8,skill2:10,skill3:12};
const MONSTER_IDS=['ratman','werewolf','witch','cyclops','cultist'];
const BOSS_IDS=['wolf_king','bat_lord','elder_witch','cyclops_chief','dark_lord'];
const TILE_IDS=['dungeon','forest','swamp','ruins','temple'];
const ART={img:{},ready:0,total:0};
let artRefreshT=0;
function scheduleArtRefresh(){if(artRefreshT)return;artRefreshT=setTimeout(()=>{artRefreshT=0;if(game.screen==='menu')updateSaveSummary();},260);}
function assetImage(key,src){const im=new Image();ART.total++;im.onload=()=>{ART.ready++;scheduleArtRefresh();};im.onerror=()=>console.warn('asset missing',src);im.src=src;ART.img[key]=im;}
function loadArt(){
 ['knight','hunter','mage'].forEach(cid=>Object.keys(CHAR_ACTIONS).forEach(a=>assetImage(`char:${cid}:${a}`,`Assets/characters/${cid}/${a}.png`)));
 MONSTER_IDS.forEach(mid=>['idle','walk','attack','hit','death'].forEach(a=>assetImage(`mon:${mid}:${a}`,`Assets/monsters/common/${mid}_${a}.png`)));
 BOSS_IDS.forEach(bid=>[1,2].forEach(ph=>assetImage(`boss:${bid}:${ph}`,`Assets/bosses/${bid}_phase${ph}.png`)));
 TILE_IDS.forEach(t=>assetImage(`tile:${t}`,`Assets/tilesets/${t}.png`));
 ['knight','hunter','mage'].forEach(cid=>['weapon','armor','shoes','amulet','ring'].forEach(slot=>assetImage(`icon:${cid}:${slot}`,`Assets/icons/equipment/${cid}_${slot}.png`)));
 ['common','uncommon','rare','epic','legendary'].forEach(q=>assetImage(`quality:${q}`,`Assets/icons/quality/${q}.png`));
}
function artReady(k){const im=ART.img[k];return !!(im&&im.complete&&im.naturalWidth);}
function dir8FromAngle(a){let n=Math.round((a-Math.PI/2)/(Math.PI/4));return (n%8+8)%8;}
function animFrame(frames,fps=10,offset=0){return (Math.floor((game.elapsed+offset)*fps)%frames+frames)%frames;}
function drawSheetFrame(im,sx,sy,sw,sh,dx,dy,dw,dh){ctx.drawImage(im,Math.round(sx),Math.round(sy),sw,sh,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));}
function drawAnimSheet(key,frameW,frameH,frames,row,dx,dy,dw=frameW,dh=frameH,fps=10,offset=0){const im=ART.img[key];if(!artReady(key))return false;const f=animFrame(frames,fps,offset);drawSheetFrame(im,f*frameW,row*frameH,frameW,frameH,dx,dy,dw,dh);return true;}


const DIFF={
 easy:{name:'简单',m:0.7,drop:1.25,elite:1,affix:false},normal:{name:'普通',m:1,drop:1,elite:1,affix:false},
 hard:{name:'困难',m:1.3,drop:1.15,elite:1.3,affix:false},nightmare:{name:'噩梦',m:1.8,drop:1.3,elite:1.5,affix:true},inferno:{name:'炼狱',m:2.5,drop:1.5,elite:1.8,affix:true}
};
const CHAPTERS=[
 {name:'荒废地牢',bg:'#171416',accent:'#5f4248',boss:'狼王',monster:'腐化鼠人'},
 {name:'幽暗森林',bg:'#111813',accent:'#304d3b',boss:'蝙蝠领主',monster:'饥渴狼人'},
 {name:'诅咒沼泽',bg:'#15190f',accent:'#50613a',boss:'女巫长老',monster:'沼泽尸鬼'},
 {name:'巨人废墟',bg:'#191713',accent:'#625442',boss:'独眼巨人首领',monster:'石肤巨人'},
 {name:'黑暗神殿',bg:'#160f18',accent:'#58375d',boss:'黑暗魔君',monster:'虚空信徒'}
];
const CLASS={
 knight:{name:'圣殿骑士',icon:'⚔',desc:'高血量、高护甲、近战续航。容错最高，适合新手。',base:{hp:150,atk:18,armor:12,speed:2.8,crit:.05,interval:.8,mana:0,manaRegen:0},skills:[['冲锋斩',8],['圣光护体',12],['裁决旋风',20]],traits:['扇形近战挥砍','冲锋控制','百分比回复与护甲强化','持续范围旋风']},
 hunter:{name:'猎魔人',icon:'➹',desc:'高移速、高攻速、高暴击。远程拉扯与单体爆发出色。',base:{hp:90,atk:14,armor:5,speed:3.8,crit:.20,interval:.4,mana:0,manaRegen:0},skills:[['闪避射击',6],['冰霜陷阱',10],['箭雨倾泻',18]],traits:['快速直线射箭','后撤穿透箭','陷阱减速易伤','指定区域箭雨']},
 mage:{name:'暗影法师',icon:'✦',desc:'超高群体爆发与范围控制，技能依赖蓝量管理。',base:{hp:75,atk:22,armor:3,speed:3.0,crit:.10,interval:.6,mana:100,manaRegen:1.5},skills:[['寒霜爆裂',7,15],['法力涌泉',15,0],['陨石坠落',25,40]],traits:['追踪魔法弹','指定位置寒霜爆裂','回蓝+法强爆发窗','大范围陨石灼烧']}
};
const TALENTS={
 knight:[['钢铁意志','最大生命 +20%','hp',.20],['圣血汲取','吸血 +5%','lifesteal',.05],['重刃','攻击 +18%','atk',.18],['扩张刃域','攻击范围 +18%','range',.18],['荆棘誓约','反伤 +12%','thorns',.12],['不屈','护甲 +20%','armor',.20]],
 hunter:[['疾风连射','攻速 +18%','atkSpeed',.18],['致命准星','暴击伤害 +35%','critDmg',.35],['穿心','穿透 +1','pierce',1],['折射箭','弹射 +1','bounce',1],['鹰眼','暴击率 +8%','crit',.08],['轻盈步','移速 +12%','speed',.12]],
 mage:[['禁忌学识','法强 +20%','atk',.20],['领域扩张','技能范围 +20%','range',.20],['时间窃取','冷却缩减 +10%','cdr',.10],['灵泉','蓝量回复 +50%','manaRegen',.50],['寒霜烙印','冰冻伤害 +25%','ice',.25],['天火烙印','陨石伤害 +30%','meteor',.30]]
};
const SLOT=['weapon','armor','shoes','amulet','ring'];
const SLOT_NAME={weapon:'武器',armor:'防具',shoes:'鞋子',amulet:'饰品',ring:'戒指'};
const QUAL=[{id:'common',name:'普通',m:1},{id:'uncommon',name:'优秀',m:1.2},{id:'rare',name:'稀有',m:1.5},{id:'epic',name:'史诗',m:1.9},{id:'legendary',name:'传说',m:2.5}];
// 骑士三段普攻：挥砍 → 横扫 → 突刺。每段刀光形状、伤害、位移、后坐都不同。
const KNIGHT_COMBO=[
 {type:'swing', dmg:.92,range:80,arc:1.6,dur:.20,lunge:0, shake:3,label:'挥砍'},
 {type:'sweep', dmg:1.06,range:88,arc:2.5,dur:.24,lunge:7, shake:4,label:'横扫'},
 {type:'thrust',dmg:1.55,range:96,arc:.70,dur:.26,lunge:24,shake:6,label:'突刺'}
];

const STAT_META={
 hp:{name:'最大生命',unit:'数值',desc:'决定角色可承受的总伤害。'},
 atk:{name:'攻击力',unit:'数值',desc:'提高普通攻击与大部分技能的基础伤害。'},
 armor:{name:'护甲',unit:'数值',desc:'降低受到的直接伤害。'},
 speed:{name:'移动速度',unit:'数值',desc:'提高角色移动速度。'},
 crit:{name:'暴击率',unit:'百分比',desc:'攻击触发暴击的概率。'},
 critDmg:{name:'暴击伤害',unit:'倍率',desc:'暴击时造成的伤害倍率。'},
 atkSpeed:{name:'攻击速度',unit:'百分比',desc:'缩短普通攻击间隔。'},
 lifesteal:{name:'生命汲取',unit:'百分比',desc:'造成伤害后按比例恢复生命。'},
 thorns:{name:'反伤',unit:'百分比',desc:'受击时向附近敌人返还部分伤害。'},
 pierce:{name:'穿透',unit:'次数',desc:'远程投射物可额外穿过敌人的次数。'},
 bounce:{name:'弹射',unit:'次数',desc:'投射物命中后可继续弹向其他敌人。'},
 manaRegen:{name:'法力回复',unit:'每秒',desc:'每秒自动恢复的法力值。'},
 cdr:{name:'冷却缩减',unit:'百分比',desc:'缩短职业技能的冷却时间。'},
 range:{name:'攻击/技能范围',unit:'百分比',desc:'扩大近战攻击或范围技能的有效半径。'},
 ice:{name:'寒霜增伤',unit:'百分比',desc:'提高寒霜类技能造成的伤害。'},
 meteor:{name:'陨石增伤',unit:'百分比',desc:'提高陨石技能造成的伤害。'}
};
const ITEM_BASE_NAME={
 knight:{weapon:'誓约长剑',armor:'圣殿重甲',shoes:'铁卫战靴',amulet:'守誓护符',ring:'裁决指环'},
 hunter:{weapon:'猎魔长弓',armor:'夜行皮甲',shoes:'疾风长靴',amulet:'鹰眼护符',ring:'追猎指环'},
 mage:{weapon:'秘法权杖',armor:'暗影法袍',shoes:'灵行法靴',amulet:'星辉护符',ring:'奥术指环'}
};
const ITEM_SLOT_DESC={
 weapon:'主攻装备，主要强化攻击能力。',armor:'防御装备，主要提高生存能力。',shoes:'机动装备，主要改善走位与移动。',amulet:'辅助装备，主要提供生命或职业强化。',ring:'精密装备，主要强化暴击与特殊属性。'
};
function formatStatValue(k,v){
 const m=STAT_META[k]||{name:k,unit:'数值'};
 if(m.unit==='百分比')return `${m.name} +${Math.round(v*100)}%`;
 if(m.unit==='倍率')return `${m.name} +${v.toFixed(2)}倍`;
 if(m.unit==='次数')return `${m.name} +${Math.round(v)}次`;
 if(m.unit==='每秒')return `${m.name} +${Number(v).toFixed(2)}/秒`;
 if(k==='speed')return `${m.name} +${Number(v).toFixed(2)}`;
 return `${m.name} +${Number.isInteger(v)?v:Number(v).toFixed(2)}`;
}


function defaultSave(){return {souls:0,upgrades:{hp:0,atk:0,armor:0,speed:0,potion:0,killHeal:0,startGold:0,eliteDrop:0},skill:{knight:[0,0,0],hunter:[0,0,0],mage:[0,0,0]},unlocks:{hard:false,nightmare:false,inferno:false},settings:{volume:.7,quality:'high',screenShake:true,damageNumbers:true,scanlines:true,lighting:true,integerScale:true,autoPortal:true,crispFx:true,decals:true},bestWave:0,runs:0,stats:{totalKills:0,bossKills:0,mimicKills:0,maxCombo:0,legendaryFound:0,soulsEarned:0},achievements:{},daily:{date:'',best:0}};}
let save;
try{save=Object.assign(defaultSave(),JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));save.upgrades=Object.assign(defaultSave().upgrades,save.upgrades||{});save.settings=Object.assign(defaultSave().settings,save.settings||{});save.stats=Object.assign(defaultSave().stats,save.stats||{});save.daily=Object.assign(defaultSave().daily,save.daily||{});save.achievements=save.achievements||{};}catch(e){save=defaultSave();}
const persist=()=>localStorage.setItem(SAVE_KEY,JSON.stringify(save));

// ---- 成就系统 ----
const ACH_DEFS=[
 ['first_kill','初试锋芒','累计击杀 1 个怪物',s=>s.stats.totalKills>=1],
 ['kill_100','百人斩','累计击杀 100 个怪物',s=>s.stats.totalKills>=100],
 ['kill_1000','千人斩','累计击杀 1000 个怪物',s=>s.stats.totalKills>=1000],
 ['boss_1','弑君者','击败 1 个首领',s=>s.stats.bossKills>=1],
 ['boss_5','五章终焉','累计击败 5 个首领',s=>s.stats.bossKills>=5],
 ['combo_50','连击大师','单局连击达到 50',s=>s.stats.maxCombo>=50],
 ['combo_100','极限连击','单局连击达到 100',s=>s.stats.maxCombo>=100],
 ['wave_10','小有所成','历史最高达到第 10 波',s=>s.bestWave>=10],
 ['wave_30','深渊行者','历史最高达到第 30 波',s=>s.bestWave>=30],
 ['wave_50','裂境半神','历史最高达到第 50 波',s=>s.bestWave>=50],
 ['wave_100','裂境之主','通关全部 100 波',s=>s.bestWave>=100],
 ['legendary','传说收藏家','获得一件传说品质装备',s=>s.stats.legendaryFound>=1],
 ['mimic','潜箱猎手','制服一只宝箱怪',s=>s.stats.mimicKills>=1],
 ['souls_1000','灵魂富翁','累计获得 1000 灵魂碎片',s=>s.stats.soulsEarned>=1000]
];
function bumpStat(k,v=1){save.stats[k]=(save.stats[k]||0)+v;}
function checkAch(){let unlocked=false;for(const [id,name,,cond] of ACH_DEFS){if(!save.achievements[id]&&cond(save)){save.achievements[id]=1;SFX.play('ach');toast(`🏆 成就解锁：${name}`);unlocked=true;}}if(unlocked)persist();}

// ---- 每日挑战：按日期种子固定两条词缀 ----
function dailyInfo(){const d=new Date();const key=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;let h=2166136261;for(const c of key){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
 const pool=[['elite','精英增生','精英怪出现率大增'],['speed','狂暴裂境','怪物移速 +15%'],['gold','黄金潮','金币获取 +50%'],['drop','猎宝时刻','装备掉率 +40%'],['fragile','脆弱之躯','最大生命 -20%'],['power','嗜血狂攻','攻击 +25%']];
 const i1=h%pool.length;let i2=(Math.floor(h/6)+2)%pool.length;if(i2===i1)i2=(i2+1)%pool.length;
 return {key,mods:[pool[i1],pool[i2]],best:(save.daily&&save.daily.date===key)?save.daily.best:0};}

const game={screen:'menu',running:false,paused:false,difficulty:'normal',classId:null,player:null,enemies:[],projectiles:[],enemyProjectiles:[],effects:[],drops:[],props:[],floats:[],particles:[],ambient:[],milestones:{},wave:1,waveState:'idle',rest:0,kills:0,gold:0,potions:0,inventory:[],equipped:{},level:1,xp:0,xpNeed:45,combo:0,comboT:0,elapsed:0,mouse:{x:W/2,y:H/2,down:false},keys:{},cameraShake:0,hitStop:0,damageMult:1,pendingDaily:false,isDaily:false,dailyMods:[],zoomT:0,zoomMax:.24,zoomX:W/2,zoomY:H/2,goldFlash:0,phaseFlash:0,bossIntro:0,soulFlash:0,
// V12：关卡状态机 / 通道 / 海克斯聚合 / 地面残留 全部挂在 game 上，便于调试面板和 ?dev=1 钩子直接读
state:'idle',levelPlan:null,remain:0,remainMax:0,lastHitX:null,lastHitY:null,pendingSpawns:0,spawnQueue:[],spawnT:0,spawnHold:false,clearT:0,clearFx:0,clearFxMax:0,showTitle:'',skipShow:false,portalIdleArmed:false,warpFlash:0,holyFlash:0,portal:null,decals:[],hexLayers:{},hexCool:{},hexEvents:0,hexSchool:{},hexOpen:false,hex:null,chainCd:0,blinkCd:0,burstN:0,stormN:0,volleyCombo:0,orbs:[],jsMs:0};

// ---- 音频系统：WebAudio 程序化合成，零外部资源 ----
const SFX={
 ac:null,master:null,ok:true,last:{},
 init(){
  if(this.ac||!this.ok)return;
  try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC){this.ok=false;return;}
   this.ac=new AC();this.master=this.ac.createGain();this.master.gain.value=save.settings.volume??.7;this.master.connect(this.ac.destination);
  }catch(e){this.ok=false;}
 },
 resume(){if(this.ac&&this.ac.state==='suspended')this.ac.resume().catch(()=>{});},
 vol(v){if(this.master)this.master.gain.setTargetAtTime(clamp(v,0,1),this.ac.currentTime,.02);},
 // 乐音：频率从 f1 滑到 f2
 tone(f1,f2,dur,type='square',vol=.18,delay=0,detune=0){
  if(!this.ac)return;const t0=this.ac.currentTime+delay;
  const o=this.ac.createOscillator(),g=this.ac.createGain();
  o.type=type;o.frequency.setValueAtTime(f1,t0);
  if(f2&&f2!==f1)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t0+dur);
  if(detune)o.detune.value=detune;
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+Math.min(.008,dur*.25));
  g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  o.connect(g);g.connect(this.master);o.start(t0);o.stop(t0+dur+.02);
 },
 // 噪声：短暂滤波爆破，用于打击与风声
 noise(dur,vol=.16,freq=1200,q=1,delay=0,type='lowpass'){
  if(!this.ac)return;const t0=this.ac.currentTime+delay;
  const n=Math.max(1,Math.floor(this.ac.sampleRate*dur));
  const buf=this.ac.createBuffer(1,n,this.ac.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  const s=this.ac.createBufferSource();s.buffer=buf;
  const f=this.ac.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
  const g=this.ac.createGain();g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  s.connect(f);f.connect(g);g.connect(this.master);s.start(t0);s.stop(t0+dur+.02);
 },
 // 节流：同类音效最小间隔（毫秒），避免每帧命中把音频打爆
 gate(k,ms){const n=performance.now();if(this.last[k]&&n-this.last[k]<ms)return false;this.last[k]=n;return true;},
 play(k){
  if(!this.ac||this.ac.state!=='running')return;
  switch(k){
   case 'hit': if(!this.gate('hit',34))return; this.noise(.06,.13,1800,1);this.tone(180,110,.06,'square',.07);break;
   case 'crit': if(!this.gate('crit',60))return; this.noise(.09,.2,2600,1);this.tone(420,180,.11,'sawtooth',.13);break;
   case 'hurt': if(!this.gate('hurt',140))return; this.noise(.16,.22,700,1);this.tone(150,55,.2,'sawtooth',.16);break;
   case 'dodge': if(!this.gate('dodge',120))return; this.noise(.2,.13,900,.8,0,'bandpass');break;
   case 'skill1': this.tone(320,760,.16,'square',.15);this.noise(.1,.09,2200,1);break;
   case 'skill2': this.tone(520,300,.22,'triangle',.15);this.tone(780,460,.22,'triangle',.08,.02);break;
   case 'skill3': this.tone(180,620,.34,'sawtooth',.14);this.noise(.3,.14,1500,.9);break;
   case 'cast': this.tone(640,900,.09,'triangle',.08);break;
   case 'levelup': [0,4,7,12].forEach((s,i)=>this.tone(523.25*Math.pow(2,s/12),0,.34,'triangle',.13,i*.075));break;
   case 'drop': this.tone(880,1320,.09,'square',.09);this.tone(1180,1560,.12,'square',.07,.06);break;
   case 'legendary': [0,4,7,12,16].forEach((s,i)=>this.tone(659.25*Math.pow(2,s/12),0,.42,'triangle',.14,i*.06));this.noise(.5,.07,3000,1);break;
   case 'gold': if(!this.gate('gold',180))return; this.tone(1046,1568,.07,'square',.07);break;
   case 'potion': this.tone(300,900,.2,'sine',.13);this.tone(450,1200,.16,'sine',.08,.06);break;
   case 'boss': this.tone(120,48,.75,'sawtooth',.2);this.noise(.8,.2,400,.9);break;
   case 'phase': this.tone(90,42,.6,'sawtooth',.22);this.noise(.5,.24,1200,.8);break;
  case 'frost': this.tone(1500,320,.5,'triangle',.13);this.noise(.45,.18,3200,.9);this.tone(2400,900,.35,'sine',.06,.05);break;
  case 'meteor': this.tone(160,40,.85,'sawtooth',.22);this.noise(.9,.26,600,.9);this.tone(90,30,.6,'sine',.16,.02);break;
  case 'bossdie': this.tone(200,40,.9,'sawtooth',.2);this.noise(1,.22,900,.8);break;
   case 'ach': [0,7,12].forEach((s,i)=>this.tone(659.25*Math.pow(2,s/12),0,.4,'triangle',.12,i*.1));break;
   case 'ui': if(!this.gate('ui',40))return; this.tone(760,900,.045,'square',.07);break;
   case 'portal': this.tone(220,880,.42,'triangle',.14);this.noise(.4,.10,1500,.9);this.tone(660,1320,.3,'sine',.06,.08);break;
   case 'deny': this.tone(200,140,.1,'square',.1);break;
   case 'reroll': this.noise(.12,.1,2400,1);this.tone(500,900,.1,'triangle',.07);break;
  }
 }
};
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1500)}
function show(id){document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));$(id).classList.remove('hidden')}
function hide(id){$(id).classList.add('hidden')}
function showMenu(){game.running=false;game.screen='menu';game.pendingDaily=false;show('mainMenu');updateSaveSummary();}
function updateSaveSummary(){$('saveSummary').textContent=`灵魂碎片：${save.souls}　历史最高：${save.bestWave}/100　累计冒险：${save.runs} 次　美术资源 ${ART.ready}/${ART.total}`;const di=dailyInfo();$('dailyLine').textContent=`今日每日挑战：${di.mods.map(m=>m[1]).join(' · ')}　通关灵魂 +30%${di.best?`　·　今日最佳 ${di.best} 波`:''}`;refreshDifficulty();}
// 难度解锁：未达成的难度在下拉框中灰显并标注解锁条件
function refreshDifficulty(){
 const sel=$('difficultySelect');if(!sel)return;const u=save.unlocks||{};
 const base={hard:'困难 ×1.3',nightmare:'噩梦 ×1.8',inferno:'炼狱 ×2.5'};
 const need={hard:'通关任意难度解锁',nightmare:'通关困难解锁',inferno:'通关噩梦解锁'};
 [...sel.options].forEach(o=>{
  if(o.value==='easy'||o.value==='normal'){o.disabled=false;o.textContent={'easy':'简单 ×0.7','normal':'普通 ×1.0'}[o.value];return;}
  const open=!!u[o.value];o.disabled=!open;o.textContent=open?base[o.value]:`🔒 ${base[o.value]}（${need[o.value]}）`;
 });
 if(sel.selectedOptions[0]&&sel.selectedOptions[0].disabled)sel.value='normal';
}
function buildAch(){$('achCount').textContent=`已解锁 ${Object.keys(save.achievements).length} / ${ACH_DEFS.length} 项成就`;const g=$('achGrid');g.innerHTML='';ACH_DEFS.forEach(([id,name,desc])=>{const u=!!save.achievements[id];const d=document.createElement('div');d.className='ach-card'+(u?' unlocked':'');d.innerHTML=`<div class="ach-medal">${u?'★':'☆'}</div><div class="ach-body"><h3>${name}</h3><p>${desc}</p><small>${u?'已解锁':'未解锁'}</small></div>`;g.appendChild(d);});}

function buildClassCards(){
 const c=$('classCards');c.innerHTML='';Object.entries(CLASS).forEach(([id,v])=>{const d=document.createElement('div');d.className='class-card';d.innerHTML=`<div class="class-art"><div class="class-sprite"><img src="Assets/characters/${id}/idle.png" alt="${v.name}"></div><div class="class-glyph">${v.icon}</div></div><h3>${v.name}</h3><p>${v.desc}</p><div class="statline">生命 ${v.base.hp} · 攻击 ${v.base.atk} · 护甲 ${v.base.armor} · 移速 ${v.base.speed}</div><ul>${v.traits.map(x=>`<li>${x}</li>`).join('')}</ul><button class="primary">选择 ${v.name}</button>`;d.querySelector('button').onclick=()=>startRun(id);c.appendChild(d);});
}
function buildCamp(){
 $('campCurrency').textContent=`灵魂碎片：${save.souls}`;
 const defs=[['hp','体魄锻造','全职业生命 +5%/级',10,30],['atk','战斗训练','全职业攻击 +4%/级',10,35],['armor','铁壁训练','全职业护甲 +5%/级',10,30],['speed','迅捷训练','全职业移速 +2%/级',8,45],['potion','补给准备','开局药水 +1',3,100],['killHeal','噬魂恢复','击杀有概率回复2%生命',5,90],['startGold','军需储备','初始金币 +50',5,80],['eliteDrop','猎宝者','精英高品质掉率 +8%',5,120]];
 const root=$('campUpgrades');root.innerHTML='';defs.forEach(([id,n,desc,max,base])=>{const lv=save.upgrades[id]||0,cost=Math.floor(base*Math.pow(1.45,lv));const el=document.createElement('div');el.className='upgrade-card';el.innerHTML=`<h3>${n}</h3><p>${desc}</p><div>等级 ${lv}/${max}</div><button ${lv>=max?'disabled':''}>${lv>=max?'已满级':`升级 · ${cost}碎片`}</button>`;el.querySelector('button').onclick=()=>{if(lv>=max)return;if(save.souls<cost)return toast('灵魂碎片不足');save.souls-=cost;save.upgrades[id]++;persist();buildCamp();updateSaveSummary();};root.appendChild(el)});
 ['knight','hunter','mage'].forEach(cid=>{CLASS[cid].skills.forEach((s,i)=>{const lv=(save.skill[cid]||[0,0,0])[i],cost=140+lv*120;const el=document.createElement('div');el.className='upgrade-card';el.innerHTML=`<h3>${CLASS[cid].name} · ${s[0]}</h3><p>伤害/效果 +8%，冷却 -3%/级</p><div>等级 ${lv}/5</div><button ${lv>=5?'disabled':''}>${lv>=5?'已满级':`升级 · ${cost}碎片`}</button>`;el.querySelector('button').onclick=()=>{if(save.souls<cost)return toast('灵魂碎片不足');save.souls-=cost;save.skill[cid][i]++;persist();buildCamp();};root.appendChild(el);});});
}

function startRun(classId){
 document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
 game.running=true;game.paused=false;game.screen='game';game.classId=classId;game.wave=1;game.waveState='idle';game.zoomT=0;game.goldFlash=0;game.phaseFlash=0;game.bossIntro=0;game.soulFlash=0;game.zoomMax=.24;game.rest=.8;game.kills=0;game.gold=save.upgrades.startGold*50;game.potions=2+save.upgrades.potion;game.inventory=[];game.equipped={};game.level=1;game.xp=0;game.xpNeed=45;game.combo=0;game.comboT=0;game.elapsed=0;game.damageMult=1;game.enemies=[];game.projectiles=[];game.enemyProjectiles=[];game.effects=[];game.drops=[];game.props=[];game.floats=[];game.milestones={};game.decals=[];game.hexLayers={};game.hexCool={};game.hexEvents=0;game.hexSchool={};game.hex=null;game.hexOpen=false;game.state='idle';game.portal=null;game.burstN=0;game.chainCd=0;game.stormN=0;game.isDaily=!!game.pendingDaily;game.pendingDaily=false;game.dailyMods=game.isDaily?dailyInfo().mods.map(m=>m[0]):[];initAmbient();
 const b=CLASS[classId].base;const hp=b.hp*(1+save.upgrades.hp*.05);const atk=b.atk*(1+save.upgrades.atk*.04);const armor=b.armor*(1+save.upgrades.armor*.05);const speed=b.speed*(1+save.upgrades.speed*.02);
 game.player={x:W/2,y:H/2,r:17,hp,maxHp:hp,hpBase:hp,mana:b.mana,maxMana:b.mana,maxManaBase:b.mana,manaRegen:b.manaRegen,atk,armor,speed,crit:b.crit,critDmg:1.75,interval:b.interval,attackCd:0,dodgeCd:0,skillCd:[0,0,0],range:1,lifesteal:0,thorns:0,pierce:0,bounce:0,cdr:0,ice:0,meteor:0,atkSpeed:0,buffArmor:0,buffPower:0,buffT:0,invuln:0,hitStun:0,slow:0,slowT:0,spin:0,gear:{},dashTrail:0,animAttackT:0,animSkillT:0,animAction:'idle',faceAngle:Math.PI/2,combo3:0,combo3T:0,swing:null};
 if(game.isDaily){const dp=game.player;if(game.dailyMods.includes('fragile')){dp.hpBase*=.8;dp.maxHp=dp.hpBase;dp.hp=dp.maxHp;}if(game.dailyMods.includes('power'))dp.atk*=1.25;}
 spawnWave();toast(game.isDaily?`每日挑战：${dailyInfo().mods.map(m=>m[1]).join(' · ')}`:`${CLASS[classId].name} 踏入裂境`);
}
// 关号不变时 waveInfo 是纯值，缓存掉每帧十几次的对象分配
let wiCacheWave=-1,wiCacheVal=null;
function waveInfo(){if(wiCacheWave===game.wave&&wiCacheVal)return wiCacheVal;const ch=Math.floor((game.wave-1)/20),stage=levelStage();wiCacheVal={ch,stage,boss:stage===20,elite:[5,15].includes(stage),blood:stage===10};wiCacheWave=game.wave;return wiCacheVal;}
// ---- V12 关卡制：进关一次算定固定数量，再分 4 批涌入（design/gdd/level-flow.md §1-2）----
const LEVEL_B=[6,11,15,19,23],LEVEL_K=[.55,.62,.70,.78,.86];
const KIND_MIX=[['brute','runner'],['runner','archer','brute'],['caster','brute','runner'],['tank','brute','archer'],['caster','tank','runner','archer']];
const KIND_PCT=[[60,40],[40,30,30],[30,35,35],[25,40,35],[28,24,26,22]];
// 关内序只给数量公式用；spawnEnemy 里的成长底数仍取绝对关号 game.wave，旧平衡一根都不动
function levelStage(){return (game.wave-1)%20+1;}
// 纯函数：同一个 n 永远得到同一份配置，便于写测试与调试跳关
function levelPlan(n){
 const ch=Math.floor((n-1)/20),stage=(n-1)%20+1,regular=Math.round(LEVEL_B[ch]+LEVEL_K[ch]*(stage-1));
 const boss=stage===20,elite=stage===5||stage===15,blood=stage===10;
 let total=regular,eliteN=0;
 if(boss){const guard=n===100?8:Math.min(Math.round(regular*.35),12);total=1+guard;eliteN=guard;}
 else if(elite)eliteN=clamp(Math.round(regular*.25),2,6);
 return {n,ch,stage,total,eliteN,batchSize:clamp(Math.ceil(total/4),4,10),boss,blood,elite,final:n===100};
}
// 按生成顺序轮转取样：比例均匀摊在整关上，不会出现"前 10 只全是 runner"
function kindFor(ch,i,total){const pct=KIND_PCT[ch],mix=KIND_MIX[ch],pos=((i%total)+.5)/total*100;let acc=0;for(let k=0;k<mix.length;k++){acc+=pct[k];if(pos<acc)return mix[k];}return 'brute';}
function spawnLevel(){
 const plan=levelPlan(game.wave);game.levelPlan=plan;game.waveState='combat';game.state='combat';game.clearT=0;game.portal=null;game.hexOpen=false;
 game.portalIdleArmed=false;if(game.player)game.player.enterAlpha=1;game.remain=plan.total;game.remainMax=plan.total;game.waveBanner=1.35;game.decals.length=0;game.spawnT=0;game.spawnHold=false;
 // 分批表：0.85s 一批、批内错峰 0.12s；精英只落前两批，防清空瞬间冒精英打断结算
 const q=[];if(plan.boss)q.push({t:0,elite:false,idx:-1,boss:true});
 const rest=plan.total-(plan.boss?1:0);
 for(let i=0;i<rest;i++)q.push({t:Math.floor(i/plan.batchSize)*.85+(i%plan.batchSize)*.12,elite:false,idx:i});
 const cap=Math.min(q.length,plan.batchSize*2),start=plan.boss?1:0;
 for(let k=start;k<plan.eliteN+start&&k<cap;k++)q[k].elite=true;
 game.spawnQueue=q;game.pendingSpawns=q.length;
 if(plan.boss){game.bossIntro=1.1;SFX.play('boss');toast(`首领：${CHAPTERS[plan.ch].boss}`);}
 if(plan.blood){spawnProp('chest');toast('血月侵袭：怪物狂暴，本关奖励 +50%');}
 else if(plan.stage%3===0&&Math.random()<.55)spawnRandomProp();
}
function spawnWave(){spawnLevel();}
function updateSpawns(dt){
 if(!game.spawnQueue.length){game.pendingSpawns=0;return;}
 // 同屏 22 只背压：超过就整批挂起，降到 16 以下再放，避免一帧涌入 30 只把帧时间拉爆
 if(game.enemies.length>22)game.spawnHold=true;
 if(game.spawnHold){if(game.enemies.length>16)return;game.spawnHold=false;}
 game.spawnT+=dt;
 while(game.spawnQueue.length&&game.spawnQueue[0].t<=game.spawnT){const s=game.spawnQueue.shift();spawnEnemy(!!s.boss,s.elite,game.levelPlan.ch,s.idx);game.pendingSpawns--;}
}
// ---- 清场结算 / 通道 · A1–A7 定稿 ----
// clearing 0.60 → cleared_show 1.68/3.20（可跳）→ portal_grow 0.90 → portal_ready（同帧弹海克斯）
// 到 ready：普通 3.18s / 首领 4.70s；跳过演出：1.50s。clearing 不用 0.12s：分裂词缀与首领
// summonCd 的延迟生成可能晚于 0.12s，太短会出现"已结算又冒怪"。
const CLEAR_T=.60,SHOW_T=1.68,SHOW_BOSS_T=3.20,GROW_T=.90,PORTAL_R=46,PORTAL_AUTO_T=12,ENTER_T=.35;
const PORTAL_ENTER={trapdoor:.45,stone_door:.50,rift:.60};
function portalTypeFor(plan){if(plan.boss||plan.final)return 'rift';return plan.ch<=1?'trapdoor':plan.ch<=3?'stone_door':'rift';}
function spawnClearParticles(){const q=save.settings.quality,n=q==='low'?0:q==='medium'?14:24;for(let i=0;i<n;i++)spawnParticles(rand(W*.22,W*.78),H*.5+rand(40,80),1,{colors:['#ffd700','#ffe9a8','#a8863a'],speed:26,life:1.25,size:2+Math.random()*2,gravity:-60,spread:.6});}
// 演出开始就发钱：玩家在演出里就能看到金币涨，不用等通道
function beginClearShow(){
 const plan=game.levelPlan,n=game.wave;
 game.state='cleared_show';
 game.clearT=plan.boss?SHOW_BOSS_T:SHOW_T;game.clearFx=game.clearT;game.clearFxMax=game.clearT;game.skipShow=false;
 game.showTitle=plan.final?'裂境闭合':`关卡 ${n} 清除`;
 const g=Math.round(Math.round(20+2.5*n)*(1+hexOf('goldMult')));
 game.gold+=g;
 game.floats.push({x:game.player.x,y:game.player.y-42,t:1.6,text:`+${g} 金币`,gold:true});
 SFX.play(plan.boss?'bossdie':'levelup');spawnClearParticles();
 if(plan.boss){for(let k=0;k<2;k++)dropEquipment(game.player.x+rand(-40,40),game.player.y+rand(-34,34),3);game.potions++;}
}
// 通道锚点 = 最后一击坐标，clamp 到 x∈[160,1120] / y∈[170,600]（y 下限 170：裂隙向上长 150px 会顶破画面上沿）
// 通道体的包围盒（锚点是地面接触点，本体向上长）——用于避开 HUD
const PORTAL_BOX={trapdoor:{w:100,h:64},stone_door:{w:124,h:148},rift:{w:58,h:158}};
function portalHitsHud(x,y,type){
 const b=PORTAL_BOX[type]||PORTAL_BOX.trapdoor;
 const px0=x-b.w/2-4,px1=x+b.w/2+4,py0=y-b.h-4,py1=y+8;
 // 左上角色面板 / 右上章节+小地图 / 底部技能托盘 / 首领血条
 const rs=[[8,8,410,140],[W-200,8,W-4,216],[484,H-94,796,H-8],[W/2-240,10,W/2+240,74]];
 for(let i=0;i<rs.length;i++){const r=rs[i];if(px0<r[2]&&px1>r[0]&&py0<r[3]&&py1>r[1])return true;}
 return false;
}
function portalAnchor(type){
 const p=game.player;
 let x=game.lastHitX!=null?game.lastHitX:p.x,y=game.lastHitY!=null?game.lastHitY:p.y;
 x=clamp(x,160,W-160);y=clamp(y,170,H-120);
 // 防呆：压在脚下 <80px 时沿 玩家→锚点 方向推到 120px 外，避免门直接开在脚底
 const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);
 if(d<80){const a=d>.5?Math.atan2(dy,dx):p.faceAngle;x=p.x+Math.cos(a)*120;y=p.y+Math.sin(a)*120;}
 // HUD 排斥：看不见门比位置不自然更糟 → 以 24px 步长朝场地中心回退，最多 200px；仍冲突就强制落中下方
 const cx=W/2,cy=H*.62;
 for(let i=0;i<9&&portalHitsHud(x,y,type);i++){
  const ax=cx-x,ay=cy-y,dd=Math.hypot(ax,ay)||1;
  x=clamp(x+ax/dd*24,160,W-160);y=clamp(y+ay/dd*24,170,H-120);
 }
 if(portalHitsHud(x,y,type)){x=W/2;y=H*.62;}
 return {x,y};
}
function beginPortal(){
 const plan=game.levelPlan;
 if(plan.final)return;
 const type=portalTypeFor(plan),{x,y}=portalAnchor(type);
 // 通道是单例：不塞进 effects，避免每关一次分配和一次 GC
 game.portal={x,y,type,r:PORTAL_R,enterT:PORTAL_ENTER[type],idleT:0,openK:0,t:0};
 game.state='portal_grow';game.clearT=GROW_T;game.portalIdleArmed=false;
 game.cameraShake=save.settings.screenShake===false?0:3;SFX.play('portal');
 // 关卡保底：n>=5 起通道旁必出 1 件装备；forced=true → 必是普通宝箱，不会变宝箱怪
 if(plan.n>=5)spawnProp('chest',clamp(x+58,160,W-60),clamp(y+10,170,H-75),true);
}
// 12s 挂机防呆的起算闸门：通道就绪且面板关闭后才起算
function armPortalIdle(){game.portalIdleArmed=true;if(game.portal)game.portal.idleT=0;}
function dropNearPlayer(r){const p=game.player,r2=r*r;for(let i=0;i<game.drops.length;i++){const d=game.drops[i];if(d.type!=='equip'&&d.type!=='gold')continue;if((d.x-p.x)*(d.x-p.x)+(d.y-p.y)*(d.y-p.y)<r2)return true;}return false;}
// 进入演出（简化统一版 0.35s）：朝锚点 easeIn 位移 ≤26px + 淡出 + 末 0.12s 白闪，结束后才 wave++
function beginPortalEnter(){
 const po=game.portal,p=game.player;
 if(!po||game.state!=='portal_ready'||game.paused||game.hexOpen)return;
 game.state='portal_enter';game.clearT=ENTER_T;game.enterMax=ENTER_T;
 const dx=po.x-p.x,dy=po.y-p.y,d=Math.hypot(dx,dy)||1;
 game.enterFrom={x:p.x,y:p.y};game.enterStep={x:dx/d*26,y:dy/d*26};
 p.invuln=Math.max(p.invuln,.45);
 SFX.play('portal');
}
function updatePortalEnter(dt){
 const p=game.player;
 game.clearT-=dt;
 const k=clamp(1-game.clearT/game.enterMax,0,1),ease=k*k;
 p.x=game.enterFrom.x+game.enterStep.x*ease;
 p.y=game.enterFrom.y+game.enterStep.y*ease;
 p.enterAlpha=clamp(1-ease,0,1);
 if(game.clearT<=.12)game.warpFlash=Math.max(game.warpFlash,.5);
 if(game.clearT>0)return;
 const et=game.portal?game.portal.enterT||.45:.45;
 game.portal=null;p.enterAlpha=1;game.warpFlash=Math.max(game.warpFlash,et);
 game.state='warp';game.wave++;
 if(game.wave>100){game.wave=100;endRun(true);return;}
 game.enemies.length=0;game.enemyProjectiles.length=0;game.decals.length=0;game.effects.length=0;game.projectiles.length=0;
 spawnLevel();
}
function updatePortal(dt){
 const po=game.portal,p=game.player;if(!po||!p)return;
 po.t+=dt;
 if(game.state!=='portal_ready')return;
 po.openK=Math.min(1,(po.openK||0)+dt/.48);
 const d2=(p.x-po.x)*(p.x-po.x)+(p.y-po.y)*(p.y-po.y);
 if(d2>po.r*po.r){po.idleT=0;return;}
 if(!game.portalIdleArmed||save.settings.autoPortal===false)return;
 // 门口还有没捡的掉落时不自动：挂机保护不该把玩家和战利品分开
 if(dropNearPlayer(120)){po.idleT=0;return;}
 po.idleT=(po.idleT||0)+dt;
 if(po.idleT>=PORTAL_AUTO_T)beginPortalEnter();
}
function tryPortalEnter(){
 if(game.paused||game.hexOpen)return false;
 const po=game.portal,p=game.player;if(!po||game.state!=='portal_ready'||!p)return false;
 if((p.x-po.x)*(p.x-po.x)+(p.y-po.y)*(p.y-po.y)>po.r*po.r)return false;
 beginPortalEnter();return true;
}
// 任意输入：清零挂机计时；键盘/左键同时可以跳过清场演出（mousemove 只清计时，不跳演出）
function noteInput(skip){
 if(game.portal)game.portal.idleT=0;
 if(skip&&game.state==='cleared_show')game.skipShow=true;
}
function updateLevelState(dt){
 const plan=game.levelPlan;
 if(game.state==='combat'){
  if(game.remain<=0&&game.pendingSpawns<=0&&!game.spawnQueue.length){
   game.state='clearing';game.clearT=CLEAR_T;
   if(plan&&plan.boss){game.hitStop=Math.max(game.hitStop,.16);game.cameraShake=save.settings.screenShake===false?0:16;triggerZoom(game.player.x,game.player.y,.34);}
  }
 } else if(game.state==='clearing'){
  game.clearT-=dt;
  if(game.clearT<=0)beginClearShow();
 } else if(game.state==='cleared_show'){
  if(game.skipShow){game.skipShow=false;game.clearT=0;game.clearFx=0;}
  game.clearT-=dt;
  if(game.clearT<=0){
   if(plan&&plan.final)endRun(true);   // 第 100 关：不建通道、不弹海克斯
   else beginPortal();
  }
 } else if(game.state==='portal_grow'){
  game.clearT-=dt;
  if(game.clearT<=0){
   game.state='portal_ready';
   // 通道就绪那一帧弹海克斯（若 n%3===0）；面板关闭后才开始 12s 挂机计时
   if(game.wave%3===0)openHex();else armPortalIdle();
   SFX.play('ui');
  }
 } else if(game.state==='portal_ready'){
  updatePortal(dt);
 } else if(game.state==='portal_enter'){
  updatePortalEnter(dt);
 }
}
// 分裂 / 召唤产生新敌时把结算打断回 combat；召唤物不参与清空判定，所以不打断（主理人裁决 D1）
function interruptClear(){if(game.state==='clearing'||game.state==='cleared_show'){game.state='combat';game.clearT=0;game.clearFx=0;game.skipShow=false;}}
function spawnEnemy(isBoss,isElite,ch,idx,summoned){
 const angle=Math.random()*Math.PI*2, rad=rand(330,510), stage=game.wave, diff=DIFF[game.difficulty];
 let hp=34*Math.pow(1.05,stage-1)*diff.m, atk=7*Math.pow(1.03,stage-1)*diff.m, speed=1.15*Math.pow(1.02,stage-1);
 if(!isBoss&&stage<=3)atk*=.8;
 if(game.isDaily&&game.dailyMods.includes('speed'))speed*=1.15;
 let kind=isBoss?'boss':kindFor(ch,idx|0,game.levelPlan?game.levelPlan.total:12);
 // 每日挑战「精英增生」：常规怪有 30% 概率升格为精英，保留旧词缀的体感
 if(!isBoss&&!isElite&&game.isDaily&&game.dailyMods.includes('elite')&&Math.random()<.3)isElite=true;
 if(isElite){hp*=3.15;atk*=1.65;speed*=1.06;} if(isBoss){hp*=15.5;atk*=2.35;speed*=.88;}
 if(kind==='runner'){hp*=.72;speed*=1.48;atk*=.86;}
 if(kind==='archer'){hp*=.82;speed*=.93;atk*=1.04;}
 if(kind==='caster'){hp*=.9;speed*=.78;atk*=1.15;}
 if(kind==='tank'){hp*=1.55;speed*=.72;atk*=1.12;}
 if(!isBoss&&waveInfo().blood){atk*=1.15;speed*=1.18;}
 const maxShield=(isElite||isBoss||kind==='tank')?hp*(isBoss?.38:kind==='tank'?.2:.25):0;
 let affix=null;if(diff.affix && (isElite||Math.random()<.13)) affix=pick(['加速','吸血','护盾','爆炸','分裂','冰霜']);
 if(affix==='加速')speed*=game.difficulty==='inferno'?1.45:1.25;if(affix==='护盾')hp*=1.12;
 game.enemies.push({x:clamp(W/2+Math.cos(angle)*rad,35,W-35),y:clamp(H/2+Math.sin(angle)*rad,55,H-35),r:isBoss?40:isElite?25:kind==='tank'?21:kind==='runner'?13:16,hp,maxHp:hp,shield:maxShield,maxShield,atk,speed,isBoss,isElite,ch,kind,affix,summoned:!!summoned,attackCd:rand(.35,1.1),specialCd:rand(1.2,3),hitStun:0,slow:0,slowT:0,vulnerable:0,vulnT:0,phase:1,shieldRegenT:0,summonCd:4,burn:0,burnT:0,chargeT:0,chargeVX:0,chargeVY:0,animAttackT:0,animSeed:Math.random()*10});
 if(!summoned)interruptClear();
}
// ---- 场景互动装置：宝箱/宝箱怪/符文祭坛/血祭坛/石像/铁匠 ----
const PROP_PROMPT={chest:'打开宝箱',altar:'触摸符文祭坛',blood:'献祭血祭坛',statue:'供奉石像（30金）',smith:'请求铁匠强化'};
// forced=true 的箱子必定是普通宝箱：通关保底箱不能变成宝箱怪，否则玩家会以为关卡没清完
function spawnProp(type,x,y,forced){const p=game.player||{x:W/2,y:H/2};if(x==null){const a=Math.random()*Math.PI*2,d=rand(95,175);x=clamp(p.x+Math.cos(a)*d,60,W-60);y=clamp(p.y+Math.sin(a)*d,75,H-75);}
 game.props.push({type,x,y,used:false,openT:0,forced:!!forced,seed:Math.random()*10,life:type==='smith'?22:Infinity});}
function spawnRandomProp(){const r=Math.random();spawnProp(r<.3?'chest':r<.5?'altar':r<.65?'blood':r<.8?'statue':'smith');}
function interactNearest(){if(!game.running||game.paused)return;const p=game.player;for(const pr of game.props){if(!pr.used&&dist(p,pr)<46){useProp(pr);return true;}}return false;}
function useProp(pr){const p=game.player;pr.used=true;pr.openT=.5;
 if(pr.type==='chest'){
  if(!pr.forced&&Math.random()<.28){SFX.play('phase');toast('是宝箱怪！');spawnMimic(pr.x,pr.y);game.props=game.props.filter(x=>x!==pr);return;}
  const g=60+game.wave*5;game.gold+=g;game.floats.push({x:pr.x,y:pr.y-18,t:1,text:`+${g}`,gold:true});
  if(Math.random()<.6)dropEquipment(pr.x,pr.y-6,1);else SFX.play('drop');
  toast('宝箱开启！');spawnParticles(pr.x,pr.y,18,{colors:['#ffd700','#a8863a','#d6d0c8'],speed:150,life:.6,size:3,gravity:60});}
 if(pr.type==='altar'){p.atk*=1.12;p.hpBase*=.94;p.maxHp=Math.max(1,p.hpBase*hexOf('hpMult'));p.hp=Math.min(p.hp,p.maxHp);markStatsDirty();SFX.play('cast');toast('符文祭坛：攻击 +12%，最大生命 -6%');spawnParticles(pr.x,pr.y,14,{colors:['#6b3fa0','#9a5aca'],speed:120,life:.5,size:3,gravity:-40});}
 if(pr.type==='blood'){const cost=Math.max(1,Math.round(p.hp*.2));p.hp=Math.max(1,p.hp-cost);SFX.play('phase');const r=pick([['atk',0],['crit',0],['heal',0]]);
  if(r[0]==='atk'){p.atk*=1.15;toast(`血祭坛：支付 ${cost} 生命，攻击 +15%`);}
  if(r[0]==='crit'){p.crit+=.10;toast(`血祭坛：支付 ${cost} 生命，暴击率 +10%`);}
  if(r[0]==='heal'){p.hp=p.maxHp;game.potions++;toast(`血祭坛：支付 ${cost} 生命，伤势痊愈并获赠药水`);}
  spawnParticles(pr.x,pr.y,20,{colors:['#a11f1f','#5a0a0a','#8b1010'],speed:160,life:.6,size:3,gravity:-30});game.cameraShake=Math.max(game.cameraShake,5);}
 if(pr.type==='statue'){if(game.gold<30){SFX.play('deny');pr.used=false;pr.openT=0;return toast('金币不足（需要 30）');}game.gold-=30;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.3);SFX.play('potion');toast('石像被供奉：恢复 30% 生命');spawnParticles(pr.x,pr.y,14,{colors:['#d6d0c8','#ffd700'],speed:110,life:.5,size:2,gravity:-50});}
 if(pr.type==='smith'){const cost=60+game.wave*2,slots=SLOT.filter(s=>game.equipped[s]);
  if(!slots.length){SFX.play('deny');pr.used=false;pr.openT=0;return toast('没有可强化的装备');}
  // 强化上限 8 级：到顶后提示但不扣金币（主理人裁决 D3）
  if(!slots.some(s=>game.equipped[s].level<8)){SFX.play('deny');pr.used=false;pr.openT=0;return toast('已达强化上限');}
  if(game.gold<cost){SFX.play('deny');pr.used=false;pr.openT=0;return toast(`金币不足（需要 ${cost}）`);}
  game.gold-=cost;SFX.play('skill2');const it=game.equipped[pick(slots.filter(s=>game.equipped[s].level<8))];it.level++;Object.entries(it.stats).forEach(([k,v])=>{it.stats[k]=k==='pierce'?v+1:+(v*1.18).toFixed(k==='crit'?3:2);});
  recalcGear();toast(`铁匠强化成功：${it.name} → 等级 ${it.level}`);renderInventory();spawnParticles(pr.x,pr.y,16,{colors:['#ffd700','#a8863a','#d6d0c8'],speed:140,life:.5,size:3,gravity:80});}
}
function spawnMimic(x,y){const ch=waveInfo().ch;spawnEnemy(false,true,ch);const m=game.enemies[game.enemies.length-1];if(m){m.x=clamp(x,35,W-35);m.y=clamp(y,55,H-35);m.mimic=true;m.speed*=1.25;m.hp*=1.15;m.maxHp=m.hp;
 // 宝箱怪是计划外的第 N+1 只：计入目标数，否则它活着也会满足"清空"（裁决：宝箱怪不破坏判定）
 game.remain++;game.remainMax++;}return m;}
function updateProps(dt){for(let i=game.props.length-1;i>=0;i--){const pr=game.props[i];pr.openT=Math.max(0,(pr.openT||0)-dt);if(pr.type==='smith'&&!pr.used)pr.life-=dt;if(pr.life<=0||(pr.used&&pr.openT<=0))game.props.splice(i,1);}}

function update(dt){
 if(!game.running||game.paused||game.screen!=='game')return;if(game.hitStop>0){game.hitStop=Math.max(0,game.hitStop-dt);updateParticles(dt*.25);updateFloats(dt*.25);return;}const p=game.player;game.elapsed+=dt;game.waveBanner=Math.max(0,(game.waveBanner||0)-dt);game.burstN=0;game.chainCd=Math.max(0,game.chainCd-dt);game.blinkCd=Math.max(0,(game.blinkCd||0)-dt);game.holyFlash=Math.max(0,(game.holyFlash||0)-dt);game.warpFlash=Math.max(0,(game.warpFlash||0)-dt);game.clearFx=Math.max(0,(game.clearFx||0)-dt);
 updateSpawns(dt);
 p.attackCd=Math.max(0,p.attackCd-dt);p.hitFlash=Math.max(0,(p.hitFlash||0)-dt);p.dodgeCd=Math.max(0,p.dodgeCd-dt);p.skillCd=p.skillCd.map(x=>Math.max(0,x-dt));p.invuln=Math.max(0,p.invuln-dt);p.hitStun=Math.max(0,p.hitStun-dt);p.animAttackT=Math.max(0,(p.animAttackT||0)-dt);p.animSkillT=Math.max(0,(p.animSkillT||0)-dt);p.slowT=Math.max(0,(p.slowT||0)-dt);if(p.slowT<=0)p.slow=0;if(p.buffT>0){p.buffT-=dt;if(p.buffT<=0){p.buffArmor=0;p.buffPower=0;}}p.mana=Math.min(p.maxMana,p.mana+(stat('manaRegen')+hexOf('manaRegen'))*dt);
 game.comboT-=dt;if(game.comboT<=0)game.combo=0;
 if(p.spin>0){p.spin-=dt;for(const e of game.enemies)if(dist(p,e)<95*p.range)damageEnemy(e,stat('atk')*1.05*dt*4,'physical');}
 if(p.hitStun<=0&&game.state!=='portal_enter'){let dx=(game.keys.KeyD?1:0)-(game.keys.KeyA?1:0),dy=(game.keys.KeyS?1:0)-(game.keys.KeyW?1:0);if(dx||dy){const l=Math.hypot(dx,dy);p.faceAngle=Math.atan2(dy,dx);const sp=p.speed*(1+hexOf('speedPct'))*95*dt*(1-(p.slow||0));p.x=clamp(p.x+dx/l*sp,30,W-30);p.y=clamp(p.y+dy/l*sp,45,H-30);}}
 if(game.mouse.down&&game.state!=='portal_enter')basicAttack();
 updateEnemies(dt);updateProjectiles(dt);updateEnemyProjectiles(dt);updateEffects(dt);updateProps(dt);updateDrops();updateFloats(dt);updateParticles(dt);
 updateOrbs(dt);updateDecals(dt);updateLevelState(dt);
}
function basicAttack(){const p=game.player;if(p.attackCd>0)return;p.attackCd=p.interval/(1+stat('atkSpeed')+hexOf('atkSpeed')+(game.combo>=30?.12:0));
 const ang=Math.atan2(game.mouse.y-p.y,game.mouse.x-p.x);p.faceAngle=ang;
 // 骑士三段连击：0.68 秒内连续攻击会沿「挥砍 → 横扫 → 突刺」推进，手感与刀光逐段加强
 let hit=null;
 if(game.classId==='knight'){p.combo3=p.combo3T>0?(p.combo3+1)%3:0;p.combo3T=.68;hit=KNIGHT_COMBO[p.combo3];}
 p.animAttackT=(hit?hit.dur:.2)+.12;
 if(game.combo>=30)spawnParticles(p.x+rand(-12,12),p.y+rand(-4,12),1,{colors:['#ff9a3c','#ffd700'],speed:45,life:.4,size:2,gravity:-70});
 if(game.classId==='knight'){
   const rng=hit.range*stat('range')*(1+hexOf('rangePct')),spread=hit.arc/2;
   if(hit.lunge){p.x=clamp(p.x+Math.cos(ang)*hit.lunge,30,W-30);p.y=clamp(p.y+Math.sin(ang)*hit.lunge,45,H-30);}
   // 手里那把剑：绘制与判定共用同一组参数，保证"看到的弧线"就是"打到人的范围"
   p.swing={a:ang,arc:hit.arc,rng,kind:hit.type,t:hit.dur,maxT:hit.dur,combo:p.combo3,dir:hit.type==='sweep'?-1:1};
   let hitAny=false;
   for(const e of game.enemies){const d=dist(p,e),a=Math.atan2(e.y-p.y,e.x-p.x),da=Math.atan2(Math.sin(a-ang),Math.cos(a-ang));if(d<rng+e.r&&Math.abs(da)<spread){damageEnemy(e,stat('atk')*hit.dmg,'physical');hitAny=true;spawnParticles(e.x,e.y,hit.type==='thrust'?10:7,{colors:['#d6d0c8','#a8863a','#ffd700','#fff3d0'],speed:hit.type==='thrust'?260:190,life:.38,size:hit.type==='thrust'?4:3,baseAngle:ang,spread:1.1});}}
   game.effects.push({type:'swing',x:p.x,y:p.y,a:ang,arc:hit.arc,r0:rng*.30,r1:rng,kind:hit.type,dir:hit.type==='sweep'?-1:1,t:hit.dur,maxT:hit.dur});
   spawnParticles(p.x+Math.cos(ang)*rng*.55,p.y+Math.sin(ang)*rng*.55,hit.type==='thrust'?7:4,{colors:['#d6d0c8','#a8863a','#fff3d0'],speed:120,life:.26,size:2,baseAngle:ang,spread:.7,drag:.9});
   if(hitAny)game.cameraShake=Math.max(game.cameraShake,hit.shake);
 } else {const speed=game.classId==='hunter'?720:520;const isMagic=game.classId==='mage';game.projectiles.push({x:p.x,y:p.y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,r:isMagic?7:5,damage:stat('atk'),type:isMagic?'magic':'arrow',life:2,pierce:p.pierce+hexOf('pierce'),bounce:p.bounce+hexOf('bounce'),target:null,trail:isMagic?8:4,isBasic:true,forked:false});if(isMagic){spawnParticles(p.x+Math.cos(ang)*20,p.y+Math.sin(ang)*20,5,{colors:['#6b3fa0','#9a5aca','#ca8afa'],speed:80,life:.3,size:3,baseAngle:ang,spread:1});}else{spawnParticles(p.x+Math.cos(ang)*15,p.y+Math.sin(ang)*15,3,{colors:['#d6d0c8','#a8863a'],speed:60,life:.2,size:2,baseAngle:ang,spread:.6});}}
 // 风暴之心：每 3 次普攻放一次环形闪电，计数器独立于 combo，避免连击断档丢触发
 game.stormN=(game.stormN||0)+1;
 if(hexOf('stormN')&&game.stormN%3===0)stormHeart();
}
function updateEnemies(dt){const p=game.player;for(let i=game.enemies.length-1;i>=0;i--){const e=game.enemies[i];if(!e)continue;e.hitStun=Math.max(0,e.hitStun-dt);e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);e.animAttackT=Math.max(0,(e.animAttackT||0)-dt);e.attackCd-=dt;e.specialCd-=dt;e.slowT-=dt;e.vulnT-=dt;e.shieldRegenT-=dt;e.frozen=Math.max(0,(e.frozen||0)-dt);e.invulnPhase=Math.max(0,(e.invulnPhase||0)-dt);e.sigilCd=Math.max(0,(e.sigilCd||0)-dt);if(e.slowT<=0)e.slow=0;if(e.vulnT<=0)e.vulnerable=0;if(e.maxShield&&e.shield<e.maxShield&&e.shieldRegenT<=0)e.shield=Math.min(e.maxShield,e.shield+e.maxShield*.025*dt);
 if(e.burnT>0){e.burnT-=dt;damageEnemy(e,e.burn*dt,'dot',true);}
 const d=dist(e,p), dx=p.x-e.x,dy=p.y-e.y,l=Math.max(1,d),sm=e.speed*(1-e.slow)*(e.frozen>0?0:1);
 if(e.isBoss){const ratio=e.hp/e.maxHp,oldVisual=e.visualPhase||1;e.phase=ratio<.35?3:ratio<.7?2:1;e.visualPhase=ratio<.7?2:1;if(e.visualPhase!==oldVisual){e.hitStun=Math.max(e.hitStun,.55);e.invulnPhase=.28;game.cameraShake=Math.max(game.cameraShake,12);game.phaseFlash=.62;game.hitStop=Math.max(game.hitStop,.12);triggerZoom(e.x,e.y,.3);SFX.play('phase');spawnParticles(e.x,e.y,36,{colors:['#a11f1f','#a8863a','#d6d0c8','#6b3fa0'],speed:300,life:.7,size:5,gravity:-30});game.effects.push({type:'shockwave',x:e.x,y:e.y,r:e.r*2.8,t:.65,maxT:.65,color:'#a11f1f'});toast(`${CHAPTERS[e.ch].boss} 进入二阶段！`);}e.summonCd-=dt;if(e.specialCd<=0){e.specialCd=Math.max(1.4,3.7-e.phase*.65);const shots=e.phase;for(let k=0;k<shots;k++){const a=Math.atan2(dy,dx)+(k-(shots-1)/2)*.28;game.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*(250+e.phase*45),vy:Math.sin(a)*(250+e.phase*45),r:8,damage:e.atk*.72,life:4,type:'boss'});}game.effects.push({type:'danger',x:p.x,y:p.y,r:58+e.phase*12,t:.78,damage:e.atk*(.9+e.phase*.16),hostile:true});}
   // 召唤物上限 6 只，且计入独立标记：不清空判定、不减 remain（裁决 D1）
   if(e.summonCd<=0){e.summonCd=6.5/e.phase;let live=0;for(let si=0;si<game.enemies.length;si++)if(game.enemies[si].summoned)live++;for(let k=0;k<e.phase-1&&live<6;k++){spawnEnemy(false,false,e.ch,0,true);live++;}}
 }
 if(e.kind==='runner'&&!e.isBoss&&e.specialCd<=0&&d<300&&d>80){e.specialCd=3.1;e.chargeT=.38;e.chargeVX=dx/l*e.speed*250;e.chargeVY=dy/l*e.speed*250;game.effects.push({type:'charge',x:e.x,y:e.y,tx:p.x,ty:p.y,t:.28});}
 if(e.affix==='冰霜'&&e.specialCd<=0&&d<320){e.specialCd=4.4;game.effects.push({type:'danger',x:e.x,y:e.y,r:62,t:.7,damage:e.atk*.8,hostile:true,slowOnHit:true});}
 if(e.chargeT>0){e.chargeT-=dt;e.x+=e.chargeVX*dt;e.y+=e.chargeVY*dt;}else if(e.hitStun<=0){
   if(e.kind==='archer'&&!e.isBoss){const ideal=235;if(d<ideal-35){e.x-=dx/l*sm*55*dt;e.y-=dy/l*sm*55*dt;}else if(d>ideal+45){e.x+=dx/l*sm*52*dt;e.y+=dy/l*sm*52*dt;}if(e.attackCd<=0&&d<420){e.attackCd=1.55;e.animAttackT=.45;const a=Math.atan2(dy,dx);game.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*310,vy:Math.sin(a)*310,r:5,damage:e.atk,life:3,type:'arrow'});}}
   else if(e.kind==='caster'&&!e.isBoss){if(d<180){e.x-=dx/l*sm*42*dt;e.y-=dy/l*sm*42*dt;}else if(d>300){e.x+=dx/l*sm*34*dt;e.y+=dy/l*sm*34*dt;}if(e.specialCd<=0&&d<500){e.specialCd=2.6;game.effects.push({type:'danger',x:p.x,y:p.y,r:46,t:.72,damage:e.atk*1.25,hostile:true});}}
   else {e.x+=dx/l*sm*62*dt;e.y+=dy/l*sm*62*dt;}
 }
 e.x=clamp(e.x,25,W-25);e.y=clamp(e.y,45,H-25);
 if(dist(e,p)<e.r+p.r+3&&e.attackCd<=0){e.animAttackT=.4;e.attackCd=e.isBoss?.72:e.kind==='runner'?.72:1.05;const clawAng=Math.atan2(p.y-e.y,p.x-e.x);game.effects.push({type:'claw',x:e.x+Math.cos(clawAng)*e.r,y:e.y+Math.sin(clawAng)*e.r,a:clawAng,t:.2});hurtPlayer(e.atk*(e.chargeT>0?1.35:1));if(e.affix==='吸血')e.hp=Math.min(e.maxHp,e.hp+e.atk*2);}
 }}
// 弹道更新：命中判定走平方距离（每帧上百次 hypot 是纯浪费）；弹射改手写最近扫描，避免 filter+sort 每帧新建数组
function updateProjectiles(dt){
 for(let i=game.projectiles.length-1;i>=0;i--){
  const q=game.projectiles[i];q.life-=dt;
  if(q.target&&game.enemies.includes(q.target)){const a=Math.atan2(q.target.y-q.y,q.target.x-q.x),sp=Math.hypot(q.vx,q.vy);q.vx=q.vx*.88+Math.cos(a)*sp*.12;q.vy=q.vy*.88+Math.sin(a)*sp*.12;}
  q.x+=q.vx*dt;q.y+=q.vy*dt;
  if(q.trail&&Math.random()<.7){const tc=q.type==='magic'?['#6b3fa0','#9a5aca','#ca8afa']:['#d6d0c8','#a8863a'];spawnParticles(q.x,q.y,1,{colors:tc,speed:30,life:.25,size:q.type==='magic'?3:2});}
  let hit=false;
  for(let j=0;j<game.enemies.length;j++){
   const e=game.enemies[j];if(q.hit===e)continue;
   const rr=q.r+e.r,dx=q.x-e.x,dy=q.y-e.y;
   if(dx*dx+dy*dy>=rr*rr)continue;
   damageEnemy(e,q.damage,q.type);q.hit=e;
   const hc=q.type==='magic'?['#6b3fa0','#9a5aca','#ca8afa','#d6d0c8']:['#d6d0c8','#a8863a','#ffd700'];
   spawnParticles(q.x,q.y,q.type==='magic'?10:6,{colors:hc,speed:q.type==='magic'?200:150,life:.4,size:3,baseAngle:Math.atan2(q.vy,q.vx)+Math.PI,spread:1.5});
   // ★ 分裂弹：只在"远程普攻"的首次命中触发，分裂弹自己不再分裂
   if(q.isBasic&&!q.forked&&hexOf('forkN')){q.forked=true;forkShot(q,e);}
   if(q.type==='magic'){game.cameraShake=Math.max(game.cameraShake,2);game.effects.push({type:'shockwave',x:q.x,y:q.y,r:34,t:.28,maxT:.28,color:'#9a5aca'});}
   else if(q.type==='arrow'){game.effects.push({type:'impact',x:q.x,y:q.y,a:Math.atan2(q.vy,q.vx),t:.18});}
   if(q.pierce>0){q.pierce--;continue;}
   if(q.bounce>0){q.bounce--;let n=null,bd=1e12;for(let k=0;k<game.enemies.length;k++){const c=game.enemies[k];if(c===e)continue;const d2=(c.x-e.x)*(c.x-e.x)+(c.y-e.y)*(c.y-e.y);if(d2<bd){bd=d2;n=c;}}if(n){q.target=n;const a=Math.atan2(n.y-q.y,n.x-q.x),sp=Math.hypot(q.vx,q.vy);q.vx=Math.cos(a)*sp;q.vy=Math.sin(a)*sp;continue;}}
   hit=true;break;
  }
  if(hit||q.life<=0||q.x<-40||q.y<-40||q.x>W+40||q.y>H+40)game.projectiles.splice(i,1);
 }
}
function forkShot(q,src){
 const n=Math.max(1,hexOf('forkN')||1);
 for(let k=0;k<n;k++){
  let best=null,bd=1e12;
  for(let i=0;i<game.enemies.length;i++){const e=game.enemies[i];if(e===src)continue;const d2=(e.x-q.x)*(e.x-q.x)+(e.y-q.y)*(e.y-q.y);if(d2<bd){bd=d2;best=e;}}
  const a=best?Math.atan2(best.y-q.y,best.x-q.x):Math.atan2(q.vy,q.vx)+(k-(n-1)/2)*.4;
  game.projectiles.push({x:q.x,y:q.y,vx:Math.cos(a)*560,vy:Math.sin(a)*560,r:4,damage:stat('atk')*.40,type:'arrow',life:1,pierce:0,bounce:0,trail:2});
 }
}
function updateEnemyProjectiles(dt){const p=game.player;for(let i=game.enemyProjectiles.length-1;i>=0;i--){const q=game.enemyProjectiles[i];q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;const rr=q.r+p.r,dx=q.x-p.x,dy=q.y-p.y;if(dx*dx+dy*dy<rr*rr){hurtPlayer(q.damage);game.enemyProjectiles.splice(i,1);continue;}if(q.life<=0||q.x<-20||q.y<-20||q.x>W+20||q.y>H+20)game.enemyProjectiles.splice(i,1);}}

function updateEffects(dt){
 for(let i=game.effects.length-1;i>=0;i--){
  const e=game.effects[i];e.t-=dt;
  if(e.type==='rain'){
   e.tick=(e.tick||0)-dt;
   if(e.tick<=0){
    e.tick=.22;
    for(let k=game.enemies.length-1;k>=0;k--){const n=game.enemies[k];if(!n)continue;if(inAoe(n,e.x,e.y,e.r))damageEnemy(n,e.damage,'arrowrain');}
    // 残留：每 2 个 tick 在落点撒一片尘土（decals 上限内部自动淘汰，不会无限增长）
    if(save.settings.decals!==false){e.dust=(e.dust||0)+1;if(e.dust%2===0)addDecal('dust',e.x+rand(-e.r*.7,e.r*.7),e.y+rand(-e.r*.5,e.r*.5),e.r*.45,.16);}
   }
  }
 if(e.type==='danger'&&e.t<=0&&!e.done){e.done=true;if(dist(game.player,e)<e.r+game.player.r){hurtPlayer(e.damage);if(e.slowOnHit){const pp=game.player;pp.slow=.4;pp.slowT=1.6;spawnParticles(pp.x,pp.y,10,{colors:['#d8f4ff','#9bdcff'],speed:100,life:.45,size:2,gravity:-40});}}}
 if(e.type==='meteorMark'&&e.t<=0&&!e.done){e.done=true;SFX.play('meteor');game.effects.push({type:'meteorFall',x:e.x,y:e.y,r:e.r,t:.32,maxT:.32,damage:e.damage});}
 if(e.type==='meteorFall'&&e.t<=0&&!e.done){e.done=true;spawnParticles(e.x,e.y,34,{colors:['#ffb347','#a11f1f','#ffd700','#5a1f1f'],speed:330,life:.65,size:4,gravity:130});game.effects.push({type:'meteorImpact',x:e.x,y:e.y,r:e.r,t:.9,maxT:.9});game.cameraShake=Math.max(game.cameraShake,15);game.hitStop=Math.max(game.hitStop,.07);game.phaseFlash=Math.max(game.phaseFlash,.22);
  for(let k=game.enemies.length-1;k>=0;k--){const n=game.enemies[k];if(!n)continue;if(inAoe(n,e.x,e.y,e.r)){damageEnemy(n,e.damage,'magic');if(game.enemies.includes(n)){n.burn=e.damage*.18;n.burnT=4;}}}
  addDecal('scorch',e.x,e.y,e.r,.55); // 陨石灼痕：0.9s 冲击坑消失后地面仍有痕
 }
 if(e.type==='frost'&&e.t<=e.maxT-.36&&!e.done){e.done=true;SFX.play('frost');spawnParticles(e.x,e.y,26,{colors:['#d8f4ff','#9bdcff','#6ea8d8','#ffffff'],speed:230,life:.55,size:3,gravity:-20});game.effects.push({type:'shockwave',x:e.x,y:e.y,r:e.r,t:.4,maxT:.4,color:'#9bdcff'});game.cameraShake=Math.max(game.cameraShake,5);
  for(let k=game.enemies.length-1;k>=0;k--){const n=game.enemies[k];if(!n)continue;if(inAoe(n,e.x,e.y,e.r)){damageEnemy(n,e.damage,'magic');if(game.enemies.includes(n)){n.hitStun=Math.max(n.hitStun,.8);n.slow=Math.max(n.slow,.5);n.slowT=Math.max(n.slowT,4);n.frozen=Math.max(n.frozen||0,n.isBoss?0.7:1.4);}}}
  addDecal('frost',e.x,e.y,e.r*.9,.50);
 }
 if(e.type==='trap'){
  e.armedT=(e.armedT||0)+dt;
  if(!e.triggered)for(let k=0;k<game.enemies.length;k++){const n=game.enemies[k],dx=n.x-e.x,dy=n.y-e.y;if(dx*dx+dy*dy<784){e.triggered=true;e.t=3;n.slow=.6;n.slowT=3;n.vulnerable=.2;n.vulnT=3;addDecal('frost',e.x,e.y,40,.45);break;}}
 }
 if(e.type==='wardShell'||e.type==='manaPillar'){if(game.player){e.x=game.player.x;e.y=game.player.y;}}
 if(e.type==='npc'){e.shot-=dt;if(e.shot<=0&&game.enemies.length){e.shot=.8;const n=game.enemies.reduce((a,b)=>dist(e,a)<dist(e,b)?a:b);const a=Math.atan2(n.y-e.y,n.x-e.x);game.projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*650,vy:Math.sin(a)*650,r:4,damage:stat('atk')*.55,type:'npc',life:2,pierce:0,bounce:0});}e.x+=(game.player.x+35-e.x)*dt*2;e.y+=(game.player.y+15-e.y)*dt*2;}
 if(e.t<=0)game.effects.splice(i,1);}}

function updateDrops(){for(let i=game.drops.length-1;i>=0;i--){const d=game.drops[i],dd=dist(game.player,d);
 if(d.type==='gold'){if(dd<110){d.x+=(game.player.x-d.x)*.08;d.y+=(game.player.y-d.y)*.08;}if(dd<26){game.gold+=d.value;game.floats.push({x:d.x,y:d.y-14,t:.6,text:`+${d.value}`,gold:true});SFX.play('gold');game.drops.splice(i,1);}continue;}
 if(d.type==='equip'&&dd<42&&game.keys.KeyE){game.inventory.push(d.item);game.drops.splice(i,1);SFX.play('ui');toast(`拾取：${d.item.name}`);renderInventory();}}}
function updateFloats(dt){for(let i=game.floats.length-1;i>=0;i--){const f=game.floats[i];f.t-=dt;f.y-=24*dt;if(f.t<=0)game.floats.splice(i,1);}}
function particleBudget(){return save.settings.quality==='low'?70:save.settings.quality==='medium'?130:200;}
function particleScale(){return save.settings.quality==='low'?.45:save.settings.quality==='medium'?.72:1;}
// 粒子对象池：战斗里每秒会产生几十个粒子，旧版 splice 搬移 + 每颗 new 是 GC 尖峰的来源
const pPool=[];
function spawnParticles(x,y,count,opts={}){const colors=opts.colors||['#d6d0c8','#a8863a'];const speed=opts.speed||120;const life=opts.life||.5;const size=opts.size||3;const gravity=opts.gravity||0;const spread=opts.spread||Math.PI*2;const baseAngle=opts.baseAngle||0;const scaled=Math.max(1,Math.ceil(count*particleScale())),room=Math.max(0,particleBudget()-game.particles.length),n=Math.min(scaled,room);for(let i=0;i<n;i++){const a=baseAngle+rand(-spread/2,spread/2);const sp=rand(speed*.4,speed);const o=pPool.pop()||{};o.x=x;o.y=y;o.vx=Math.cos(a)*sp;o.vy=Math.sin(a)*sp;o.life=rand(life*.6,life);o.maxLife=life;o.color=pick(colors);o.size=rand(size*.7,size*1.3)|0;o.gravity=gravity;o.drag=opts.drag??.96;o.shrink=opts.shrink??0;game.particles.push(o);}}
// 前向写指针压缩：一次遍历完成更新与删除，不产生临时数组
function updateParticles(dt){const arr=game.particles;let n=0;for(let i=0;i<arr.length;i++){const p=arr[i];p.life-=dt;p.vy+=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=p.drag??.96;p.vy*=p.drag??.96;if(p.shrink)p.size=Math.max(1,p.size-p.shrink*dt);if(p.life>0)arr[n++]=p;else if(pPool.length<320)pPool.push(p);}arr.length=n;}
function drawParticles(){
 for(let i=0;i<game.particles.length;i++){
  const p=game.particles[i];const alpha=clamp(p.life/p.maxLife,0,1),sz=p.size;
  // size<=2 跳过外晕层：3 次 fillRect 降到 2 次，远看没有区别
  if(sz>2){ctx.globalAlpha=alpha*.42;pxRect(p.x-sz*.85,p.y-sz*.85,sz*1.7,sz*1.7,p.color);}
  ctx.globalAlpha=alpha;pxRect(p.x-sz*.45,p.y-sz*.45,sz*.9,sz*.9,p.color);
  if(sz<=4){ctx.globalAlpha=alpha*.85;ctx.fillStyle='#ffffff';
   ctx.fillRect(Math.round(p.x-sz*.16),Math.round(p.y-sz*.16),Math.max(1,Math.round(sz*.32)),Math.max(1,Math.round(sz*.32)));}
 }
 ctx.globalAlpha=1;
}

// ---- 静态背景离屏烘焙：章节切换时烘焙一次，之后每帧只 drawImage ----
// 背景（8px 颗粒/32px 结构/装饰/地表细节/符文阵/火把/边缘暗墙/渐变压暗）内容完全静态，
// 原先每帧要跑 ~16000 次 fillRect；烘焙后降到 1 次 drawImage。
const bgCv=document.createElement('canvas');bgCv.width=W;bgCv.height=H;const bgx=bgCv.getContext('2d');bgx.imageSmoothingEnabled=false;
let bgBakedChapter=-1;
function bakeBackground(ch){const real=ctx;ctx=bgx;bgx.imageSmoothingEnabled=false;drawBackground();ctx=real;bgBakedChapter=ch;}

// ---- 动态光照：低分辨率光照图 + multiply 合成，角色/技能/掉落/火把都是光源 ----
// 分辨率按画质分档（high 640×360 / medium 320×180 / low 160×90），low 档再隔帧更新：
// 全屏 multiply 是最大的单项 GPU/CPU 成本，但完全关掉会把氛围一起关掉。
const lightCv=document.createElement('canvas');const lctx=lightCv.getContext('2d');
let lightDen=0,lightFrame=0;
function ensureLightCv(){const q=save.settings.quality,den=q==='low'?8:q==='medium'?4:2;if(lightDen===den)return;lightDen=den;lightCv.width=Math.max(8,Math.round(W/den));lightCv.height=Math.max(8,Math.round(H/den));}
const AMBIENT=[['146,149,178','19,16,20'],['122,150,126','12,18,14'],['132,152,102','16,20,10'],['162,146,120','20,18,14'],['142,110,182','16,10,20']];
function addLight(x,y,r,col,a){if(r<=2||a<=0)return;const p=game.player;
 // 光源剔除：离玩家 >900px 或整块在屏幕外（留 120px 余量）的光源不参与，视觉上看不到
 if(p&&(x-p.x)*(x-p.x)+(y-p.y)*(y-p.y)>810000)return;
 if(!onScreen(x,y,120))return;
 const s=lightCv.width/W;lctx.save();const rr=Math.max(2,r*s);const g=lctx.createRadialGradient(x*s,y*s,0,x*s,y*s,rr);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(.55,`rgba(${col},${a*.45})`);g.addColorStop(1,`rgba(${col},0)`);lctx.fillStyle=g;
 const x0=Math.round(x*s-rr),y0=Math.round(y*s-rr),w0=Math.round(rr*2),h0=Math.round(rr*2);lctx.fillRect(x0,y0,w0,h0);lctx.restore();}
function ambientFor(){if(!game.running)return '58,56,72';const wi=waveInfo();let c=AMBIENT[wi.ch][0];if(wi.blood)c='118,36,40';return c;}
function dropLightColor(d){return {common:'200,200,200',uncommon:'110,190,110',rare:'110,150,220',epic:'190,110,255',legendary:'255,200,90'}[d.item?.q]||'200,200,200';}
function lightColorOf(c){const m={'#9bdcff':'140,200,255','#a11f1f':'255,90,60','#d6d0c8':'255,240,220','#ffd700':'255,210,100','#9a5aca':'180,110,255'};return m[c]||'255,255,255';}
function drawLighting(){
 if(!save.settings.lighting)return;
 ensureLightCv();
 const lw=lightCv.width,lh=lightCv.height,q=save.settings.quality;
 lightFrame++;
 // low 档隔帧更新：本帧直接复用上一帧光照图，省掉整层重绘（仍是 1 次全屏 multiply）
 if(q==='low'&&(lightFrame&1)===0){ctx.globalCompositeOperation='multiply';ctx.imageSmoothingEnabled=false;ctx.drawImage(lightCv,0,0,W,H);ctx.globalCompositeOperation='source-over';return;}
 lctx.globalCompositeOperation='source-over';lctx.fillStyle=`rgb(${ambientFor()})`;lctx.fillRect(0,0,lw,lh);lctx.globalCompositeOperation='lighter';const now=performance.now()*.006;
 for(const t of (game._torches||[])){const fl=.82+.18*Math.sin(now*9+t.x);addLight(t.x,t.y,q==='low'?70:95,t.c,.5*fl);}
 if(game.running&&game.player){const p=game.player;const cc=game.classId==='mage'?'190,150,255':game.classId==='hunter'?'190,220,255':'255,225,175';addLight(p.x,p.y-10,215,cc,.62);if(game.combo>=30)addLight(p.x,p.y-8,90,'255,150,60',.28);
  for(const d of game.drops)addLight(d.x,d.y,d.type==='gold'?38:36,d.type==='gold'?'255,200,90':dropLightColor(d),.42);
  for(const q2 of game.projectiles){if(q2.type==='magic')addLight(q2.x,q2.y,72,'160,95,255',.55);else if(q2.type==='arrow')addLight(q2.x,q2.y,26,'255,220,160',.3);else addLight(q2.x,q2.y,44,'170,120,255',.4);}
  for(const q2 of game.enemyProjectiles)addLight(q2.x,q2.y,52,'255,70,60',.5);
  for(const e of game.enemies){if(e.isBoss)addLight(e.x,e.y-10,120+Math.sin(now*5)*10,'255,60,50',.42);else if(e.isElite)addLight(e.x,e.y,60,'255,190,90',.28);}
  for(const e of game.effects){
   if(e.type==='meteorMark')addLight(e.x,e.y,e.r*1.1,'255,90,50',.30+.14*Math.sin(now*.02));
   else if(e.type==='meteorFall')addLight(e.x,e.y,e.r*2.0,'255,110,45',.62);
   else if(e.type==='meteorImpact')addLight(e.x,e.y,e.r*2.2,'255,120,45',.70*clamp(e.t/e.maxT,0,1));
   else if(e.type==='frost')addLight(e.x,e.y,140,'140,200,255',.5);
   else if(e.type==='cast')addLight(e.x,e.y,66,e.classId==='mage'?'170,110,255':e.classId==='hunter'?'120,170,230':'230,180,100',.42);
   else if(e.type==='shockwave')addLight(e.x,e.y,(e.r||40)*2.2,lightColorOf(e.color),.45);
   else if(e.type==='rain')addLight(e.x,e.y,100,'180,200,255',.28);
   else if(e.type==='skillArc'||e.type==='spinAura')addLight(e.x,e.y,(e.r||80)*1.6,'255,206,132',.34*(e.maxT?clamp(e.t/e.maxT,0,1):1));
   else if(e.type==='trap'&&!e.triggered)addLight(e.x,e.y,50,'120,190,240',.22);
   else if(e.type==='danger')addLight(e.x,e.y,e.r*1.5,'255,70,50',.30);
  }
  for(const pr of game.props){if(pr.used)continue;const c={chest:'255,200,90',altar:'170,110,255',blood:'255,60,60',statue:'255,240,200',smith:'255,190,110'}[pr.type];addLight(pr.x,pr.y-8,pr.type==='chest'?55:70,c,.42+.1*Math.sin(now*7+pr.seed));}
  // 通道光源：三种形态各 1 个，写一次就够（spec §3 光源表）
  if(game.portal){const po=game.portal;if(po.type==='trapdoor')addLight(po.x,po.y-18,88,'90,150,220',.34);else if(po.type==='stone_door')addLight(po.x,po.y-46,110,'255,210,120',.42);else addLight(po.x,po.y-60,130,'180,110,255',.50);}
  // 环绕符文：每枚一颗小冷光，数量随层数（上限 6）
  if(hexOf('orbN')&&game.player){const n=hexOf('orbN'),pp=game.player;for(let k=0;k<n;k++){const a=game.elapsed*1.6+k*Math.PI*2/n;addLight(pp.x+Math.cos(a)*58,pp.y-12+Math.sin(a)*58*.62,34,'150,215,255',.30);}}
 } else {addLight(W/2,H/2-40,300,'255,230,190',.22);}
 // high/medium 走平滑放大（柔化层）；low 关掉插值，省一次双线性采样
 ctx.globalCompositeOperation='multiply';ctx.imageSmoothingEnabled=q!=='low';ctx.drawImage(lightCv,0,0,W,H);ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation='source-over';}

// ---- 氛围粒子：按章节飘浮的尘埃/萤火/孢子/余烬/灵光 ----
function initAmbient(){const ch=game.running?waveInfo().ch:0;const cols=[['#6a6a72','#8a8a92'],['#a8d878','#d8e8a0'],['#8aa84e','#b8c86e'],['#c8a05a','#e8c88a'],['#9a6aca','#c89aea']][ch];game.ambient=[];for(let i=0;i<22;i++)game.ambient.push({x:rand(0,W),y:rand(0,H),vx:rand(-6,6),vy:rand(-14,-4),ph:rand(0,7),c:pick(cols),s:Math.max(1,rand(1,2.4)|0)});}
function updateAmbient(dt){for(const a of game.ambient){a.ph+=dt;a.x+=a.vx*dt+Math.sin(a.ph*1.3)*8*dt;a.y+=a.vy*dt;if(a.y<-8){a.y=H+8;a.x=rand(0,W);}if(a.x<-8)a.x=W+8;if(a.x>W+8)a.x=-8;}}
function drawAmbient(){if(!game.ambient.length)return;for(const a of game.ambient){ctx.globalAlpha=.2+.3*Math.abs(Math.sin(a.ph*2));pxRect(a.x,a.y,a.s,a.s,a.c);}ctx.globalAlpha=1;}

function damageEnemy(e,amount,type='physical',silent=false){if(!game.enemies.includes(e))return;if(e.invulnPhase>0)return;const p=game.player;
 // 海克斯乘区在这里结算（不进 p.atk）：铁匠每级把装备 ×1.18，若与海克斯复利相乘会绕过 ×2.60 夹紧
 let crit=Math.random()<clamp(stat('crit')+hexOf('crit'),0,.90), dmg=amount*(1+p.buffPower)*(1+Math.min(game.combo,30)*.012)*game.damageMult*hexOf('atkMult');if(crit)dmg*=(p.critDmg+hexOf('critDmg'));if(e.vulnerable)dmg*=1+e.vulnerable;if(type==='magic'&&game.classId==='mage')dmg*=1; if(type==='physical'&&game.classId==='knight')dmg*=1;dmg=Math.max(1,dmg);
 if(e.shield>0){const absorb=Math.min(e.shield,dmg);e.shield-=absorb;dmg-=absorb;e.shieldRegenT=3;spawnParticles(e.x,e.y-e.r*.5,4,{colors:['#3e5870','#5a7a90','#d6d0c8'],speed:120,life:.3,size:2});}
 if(dmg>0)e.hp-=dmg;if(!silent){e.hitStun=.09;e.hitFlash=.11;game.hitStop=Math.max(game.hitStop,crit?.06:.03);game.combo++;SFX.play(crit?'crit':'hit');game.comboT=1.8;if(game.combo>(save.stats.maxCombo||0))save.stats.maxCombo=game.combo;if(save.settings.damageNumbers)game.floats.push({x:e.x,y:e.y-15,t:.7,text:`${crit?'✦ ':''}${Math.round(dmg)}`,crit});for(const th of [25,50,75,100])if(game.combo>=th&&!game.milestones[th]){game.milestones[th]=1;const heal=p.maxHp*(th>=75?.08:.04);p.hp=Math.min(p.maxHp,p.hp+heal);const g=20+th;game.gold+=g;game.effects.push({type:'shockwave',x:p.x,y:p.y,r:60+th*.8,t:.5,maxT:.5,color:'#ffd700'});if(save.settings.damageNumbers)game.floats.push({x:p.x,y:p.y-34,t:1,text:`${th} 连击！`,crit:true});toast(`连击 x${th}：恢复生命并奖励 ${g} 金币`);checkAch();}spawnParticles(e.x,e.y-e.r*.3,crit?10:6,{colors:['#8b1010','#a11f1f','#5a0a0a','#d6d0c8'],speed:crit?220:160,life:.45,size:3,gravity:300,baseAngle:Math.atan2(p.y-e.y,p.x-e.x)+Math.PI,spread:1.8});if(stat('lifesteal')+hexOf('lifesteal'))p.hp=Math.min(p.maxHp,p.hp+amount*Math.min(.30,stat('lifesteal')+hexOf('lifesteal')));}
 // ★ 雷链 / 连击齐射：挂在"普攻命中"事件上；机制触发次数受单帧护栏约束
 if(!silent&&type!=='dot'&&type!=='corpse'){
  if(hexOf('chainP')&&game.chainCd<=0&&Math.random()<hexOf('chainP')){game.chainCd=.30;chainLightning(e);}
  if(hexOf('volleyN')&&game.combo>0&&game.combo%10===0&&game.volleyCombo!==game.combo){game.volleyCombo=game.combo;comboVolley();}
 }
 if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){const idx=game.enemies.indexOf(e);if(idx<0)return;game.enemies.splice(idx,1);game.lastHitX=e.x;game.lastHitY=e.y;game.kills++;bumpStat('totalKills');if(e.isBoss)bumpStat('bossKills');if(e.mimic)bumpStat('mimicKills');
 // 清空判定只认非召唤物：首领召唤的杂兵不参与计数（主理人裁决 D1）
 if(!e.summoned)game.remain=Math.max(0,game.remain-1);
 if(e.isBoss){game.hitStop=Math.max(game.hitStop,.16);game.cameraShake=save.settings.screenShake===false?0:16;triggerZoom(e.x,e.y,.34);game.goldFlash=Math.max(game.goldFlash,.4);SFX.play('bossdie');}
 else if(e.isElite){game.hitStop=Math.max(game.hitStop,.09);triggerZoom(e.x,e.y,.18);}const bm=(waveInfo().blood?1.5:1)*(game.isDaily&&game.dailyMods.includes('gold')?1.5:1);const xp=Math.floor((e.isBoss?120:e.isElite?45:12)*bm);gainXp(xp);game.gold+=Math.floor((e.isBoss?140:e.isElite?45:Math.floor(rand(3,9)))*bm*(1+hexOf('goldMult')));if(Math.random()<.25)game.drops.push({type:'gold',x:e.x+rand(-8,8),y:e.y+rand(-8,8),value:Math.floor(rand(5,18)*(waveInfo().blood?1.5:1))});
 if(e.mimic){game.gold+=120;dropEquipment(e.x,e.y,2);toast('宝箱怪被制服！战利品掉落');}
 if(e.affix==='爆炸'){game.effects.push({type:'danger',x:e.x,y:e.y,r:64,t:.4,damage:e.atk*1.6,hostile:true});game.effects.push({type:'shockwave',x:e.x,y:e.y,r:74,t:.4,maxT:.4,color:'#ff8c00'});spawnParticles(e.x,e.y,18,{colors:['#ff8c00','#a11f1f','#ffd700'],speed:220,life:.5,size:3,gravity:120});}
 if(e.affix==='分裂'&&!e.noSplit){for(let k2=0;k2<2;k2++){const mx=clamp(e.x+(k2?16:-16),25,W-25),my=clamp(e.y+rand(-8,8),45,H-25);game.enemies.push({x:mx,y:my,r:11,hp:e.maxHp*.22,maxHp:e.maxHp*.22,shield:0,maxShield:0,atk:e.atk*.55,speed:e.speed*1.2,isBoss:false,isElite:false,ch:e.ch,kind:'runner',affix:null,attackCd:rand(.4,1),specialCd:rand(1,3),hitStun:0,slow:0,slowT:0,vulnerable:0,vulnT:0,phase:1,shieldRegenT:0,summonCd:4,burn:0,burnT:0,chargeT:0,chargeVX:0,chargeVY:0,animAttackT:0,animSeed:Math.random()*10,noSplit:true,noBurst:true});spawnParticles(mx,my,8,{colors:['#b06aff','#6b3fa0'],speed:130,life:.4,size:2});}
  // 分裂产物计入清空目标数（否则计数到 0 时场上还有活怪），并打断结算回 combat
  game.remain+=2;game.remainMax+=2;interruptClear();}
 checkAch();
 const healChance=save.upgrades.killHeal*.03;if(Math.random()<healChance)game.player.hp=Math.min(game.player.maxHp,game.player.hp+game.player.maxHp*.02);
 const dropChance=(e.isBoss?.95:e.isElite?.48:.06)*DIFF[game.difficulty].drop*(1+save.upgrades.eliteDrop*.08)*(game.isDaily&&game.dailyMods.includes('drop')?1.4:1);if(Math.random()<dropChance)dropEquipment(e.x,e.y,e.isBoss?3:e.isElite?2:0);
 // ★ 尸爆：单帧最多 3 次，且被爆死的不再连锁，防"尸爆→击杀→尸爆"递归
 if(hexOf('burstMult')&&game.burstN<3&&!e.noBurst){
  game.burstN++;const bx=e.x,by=e.y,br=55,br2=(br+16)*(br+16);
  game.effects.push({type:'shockwave',x:bx,y:by,r:br,t:.32,maxT:.32,color:'#a11f1f'});
  spawnParticles(bx,by,12,{colors:['#a11f1f','#5a0a0a','#ff8c42'],speed:180,life:.4,size:3});
  for(let i=game.enemies.length-1;i>=0;i--){const n=game.enemies[i];if(!n||n===e)continue;if((n.x-bx)*(n.x-bx)+(n.y-by)*(n.y-by)<br2){n.noBurst=true;damageEnemy(n,stat('atk')*hexOf('burstMult'),'corpse',true);}}
 }
 // 灵魂收割：击杀回血回蓝
 if(hexOf('soulHeal')){const p2=game.player;p2.hp=Math.min(p2.maxHp,p2.hp+p2.maxHp*hexOf('soulHeal'));p2.mana=Math.min(p2.maxMana,p2.mana+hexOf('soulMana'));}
}
function hurtPlayer(raw){const p=game.player;if(p.invuln>0)return;const armor=(stat('armor')+hexOf('armor'))*(1+p.buffArmor),dmg=raw*100/(100+armor*5)*(1+hexOf('dmgTaken'));p.hp-=dmg;p.hitStun=.07;p.hitFlash=.12;p.invuln=.12;game.hitStop=Math.max(game.hitStop,.05);SFX.play('hurt');game.cameraShake=save.settings.screenShake===false?0:9;if(save.settings.damageNumbers)game.floats.push({x:p.x,y:p.y-20,t:.7,text:`-${Math.round(dmg)}`,hurt:true});spawnParticles(p.x,p.y-5,8,{colors:['#8b1010','#a11f1f','#5a0a0a'],speed:180,life:.5,size:3,gravity:400,spread:Math.PI*2});if(p.thorns+hexOf('thorns')){const th=p.thorns+hexOf('thorns'),near=game.enemies.filter(e=>dist(e,p)<55);near.forEach(e=>damageEnemy(e,dmg*th,'thorns'));}if(p.hp<=0)endRun(false);}
function gainXp(v){game.xp+=v;while(game.xp>=game.xpNeed){game.xp-=game.xpNeed;game.level++;game.xpNeed=Math.floor(game.xpNeed*1.28);openTalent();break;}}
function openTalent(){game.paused=true;SFX.play('levelup');const opts=[...TALENTS[game.classId]].sort(()=>Math.random()-.5).slice(0,3);const root=$('talentChoices');root.innerHTML='';opts.forEach(t=>{const d=document.createElement('div');d.className='talent-card';d.innerHTML=`<h3>${t[0]}</h3><p>${t[1]}</p><small>选择后本局永久生效</small>`;d.onclick=()=>{applyTalent(t);hide('talentPanel');game.paused=false;};root.appendChild(d);});$('talentPanel').classList.remove('hidden');}
function applyTalent(t){const p=game.player,key=t[2],v=t[3];if(['hp','atk','armor','speed','range','manaRegen'].includes(key)){if(key==='hp'){p.hpBase*=1+v;p.maxHp=p.hpBase*hexOf('hpMult');p.hp+=p.maxHp*v*.5;}else p[key]*=1+v;}else if(key==='atkSpeed')p.atkSpeed+=v;else p[key]+=v;markStatsDirty();toast(`获得天赋：${t[0]}`);}

// ================= V12 海克斯裂境增益池（design/gdd/hex-augments.md · 42 条）=================
// 结构：eff(n) 返回"该来源在 n 层时的贡献"。mult 键按乘区合并、其余按加值合并，
// 每次选取后整体重算一次 —— 比逐次累加更容易夹紧、也不会因浮点误差漂移。
const HEX_SCHOOL={li:'力',xue:'血',ying:'影',lei:'雷',shuang:'霜陨'};
const HEX_RAR_NAME={white:'白银',gold:'黄金',prism:'棱彩',forbid:'禁忌'};
const HEX_RAR_ORDER={white:0,gold:1,prism:2,forbid:3};
const HX=(id,name,school,tier,cap,desc,eff,off)=>({id,name,school,tier,cap,desc,eff,off:!!off});
function hxPct(v){return `${Math.round(v*100)}%`;}
function linHX(id,name,school,tier,cap,k,per,label,unit){const desc=[];for(let i=1;i<=cap;i++)desc.push(`${label} +${unit==='%'?hxPct(per*i):Math.round(per*i*10)/10}`);return HX(id,name,school,tier,cap,desc,n=>({[k]:per*n}));}
function mulHX(id,name,school,tier,cap,k,per,label){const desc=[];for(let i=1;i<=cap;i++)desc.push(`${label} +${hxPct(per*i)}`);return HX(id,name,school,tier,cap,desc,n=>({[k]:1+per*n}));}
const HEX_POOL=[];
// —— 白银 15 条（cap 5 · 线性）——
HEX_POOL.push(
 mulHX('sv_atk','蛮力印记','li','white',5,'atkMult',.08,'攻击力'),
 mulHX('sv_hp','韧骨','li','white',5,'hpMult',.10,'最大生命'),
 linHX('sv_armor','铁鳞','li','white',5,'armor',12,'护甲',''),
 linHX('sv_haste','迅捷','li','white',5,'atkSpeed',.09,'攻速','%'),
 linHX('sv_cdr','凝神','li','white',5,'cdr',.06,'冷却缩减','%'),
 linHX('sv_gold','贪欲','li','white',5,'goldMult',.12,'金币获取','%'),
 linHX('sv_speed','疾行','ying','white',5,'speedPct',.07,'移速','%'),
 linHX('sv_crit','鹰视','ying','white',5,'crit',.04,'暴击率','%'),
 linHX('sv_critdmg','锋锐','ying','white',5,'critDmg',.18,'暴击伤害','%'),
 linHX('sv_pierce','穿甲','ying','white',5,'pierce',1,'穿透',''),
 linHX('sv_bounce','折跃','lei','white',5,'bounce',1,'弹射',''),
 linHX('sv_leech','汲取','xue','white',5,'lifesteal',.03,'生命汲取','%'),
 linHX('sv_thorn','棘甲','xue','white',5,'thorns',.08,'反伤','%'),
 linHX('sv_range','延展','shuang','white',5,'rangePct',.10,'范围','%'),
 linHX('sv_mana','灵泉','shuang','white',5,'manaRegen',.35,'法力回复','')
);
// —— 黄金 12 条（cap 5 · 含 7 条机制型 ★）——
HEX_POOL.push(
 mulHX('gd_atk','巨力符文','li','gold',5,'atkMult',.13,'攻击力'),
 linHX('gd_armor','壁垒','li','gold',5,'armor',20,'护甲',''),
 mulHX('gd_hp','血脉膨胀','xue','gold',5,'hpMult',.16,'最大生命'),
 linHX('gd_haste','追击','lei','gold',5,'atkSpeed',.14,'攻速','%'),
 linHX('gd_crit','猎杀本能','ying','gold',5,'crit',.07,'暴击率','%'),
 HX('gd_chain','雷链','lei','gold',5,['普攻 30% 触发闪电，跳 1 个目标','42% 触发，跳 1 个目标','54% 触发，跳 2 个目标','66% 触发，跳 2 个目标','78% 触发，跳 3 个目标'],n=>({chainP:.30+.12*(n-1),chainJumps:1+Math.floor(n/2)})),
 HX('gd_burst','尸爆','xue','gold',5,['击杀爆开 55 半径，伤害 攻击×0.60','×0.75','×0.90','×1.05','×1.20'],n=>({burstMult:.45+.15*n})),
 HX('gd_echo','技能回响','lei','gold',5,['技能后 1 枚追踪弹（×0.35）','2 枚','2 枚','3 枚','3 枚'],n=>({echoN:1+Math.floor(n/2)})),
 HX('gd_blink','闪避残影','ying','gold',5,['闪避原地爆 90 半径（×0.60）','×0.80','×1.00','×1.20','×1.40'],n=>({blinkMult:.40+.20*n})),
 HX('gd_volley','连击齐射','lei','gold',5,['连击跨 10 射 4 枚扇形弹（×0.30）','5 枚','6 枚','7 枚','8 枚'],n=>({volleyN:3+n})),
 HX('gd_fork','分裂弹','ying','gold',5,['远程命中分裂 1 枚（×0.40）','2 枚','2 枚','3 枚','3 枚'],n=>({forkN:1+Math.floor(n/2)})),
 HX('gd_orb','环绕符文','shuang','gold',5,['2 枚符文环绕（×0.30）','3 枚','4 枚','5 枚','6 枚'],n=>({orbN:1+n}))
);
// —— 棱彩 9 条（cap 3）——
HEX_POOL.push(
 mulHX('pr_might','战意喷薄','li','prism',3,'atkMult',.18,'攻击力'),
 HX('pr_titan','巨人心脏','xue','prism',3,['最大生命 +25%，护甲 +15','最大生命 +50%，护甲 +30','最大生命 +75%，护甲 +45'],n=>({hpMult:1+.25*n,armor:15*n})),
 HX('pr_stormheart','风暴之心','lei','prism',3,['每 3 次普攻放环形闪电（r130，×1.2）','r150，×1.4','r170，×1.6'],n=>({stormN:1,stormR:110+20*n,stormMult:1+.2*n})),
 // 以下 5 条机制型为 TODO：先移出卡池，避免玩家选到"没有效果"的卡（裁决 D11）
 HX('pr_bloodpact','血契','xue','prism',3,['每损失 10% 生命，伤害 +4%','+8%','+12%'],null,true),
 HX('pr_nova','霜爆新星','shuang','prism',3,['累计命中 10 次触发霜爆（冻结 0.6s）','冻结 0.7s','冻结 0.8s'],null,true),
 HX('pr_meteor','陨星标记','shuang','prism',3,['敌人死亡 30% 落小陨星（×1.4）','40%','50%'],null,true),
 HX('pr_martyr','殉道反甲','xue','prism',3,['受伤 -10%，放 4 枚反伤弹','受伤 -20%，5 枚','受伤 -30%，6 枚'],null,true),
 HX('pr_timeglass','时之沙漏','li','prism',3,['每 12 击杀，全技能冷却 -1.5s','-3.0s','-4.5s'],null,true),
 HX('pr_soulharvest','灵魂收割','xue','prism',3,['击杀回 1.2% 生命、2 蓝','回 2.4%、4 蓝','回 3.6%、6 蓝'],n=>({soulHeal:.012*n,soulMana:2*n}))
);
// —— 禁忌 6 条（cap 2 · 第 41 关起解锁）——
HEX_POOL.push(
 HX('fb_soul_debt','灵魂债务','xue','forbid',2,['攻击 ×1.25，最大生命 ×0.88','攻击 ×1.50，最大生命 ×0.77'],n=>({atkMult:1+.25*n,hpMult:1-.115*n})),
 HX('fb_glass','琉璃之躯','ying','forbid',2,['暴击率 +15%、暴击伤害 +40%，承受伤害 +18%','暴击率 +30%、暴击伤害 +80%，承受伤害 +36%'],n=>({crit:.15*n,critDmg:.40*n,dmgTaken:.18*n})),
 HX('fb_berserk','狂血','li','forbid',2,['攻速 +25%，护甲 ×0.60','攻速 +50%，护甲 ×0.36'],n=>({atkSpeed:.25*n})),
 HX('fb_greed','贪婪之誓','li','forbid',2,['金币 +60%，敌人攻击 +10%','金币 +120%，敌人攻击 +20%'],n=>({goldMult:.60*n,enemyAtk:.10*n})),
 HX('fb_void','虚空回响','shuang','forbid',2,['寒霜/陨石 +35%，攻击 ×1.10，蓝上限 ×0.70','各 +70%，攻击 ×1.20，蓝上限 ×0.49'],n=>({ice:.35*n,meteor:.35*n,atkMult:1+.10*n,maxManaMult:1-.30*n})),
 HX('fb_lastbreath','最后一息','xue','forbid',2,['生命低于 30% 时伤害 +30%，治疗效率 -35%','伤害 +60%，治疗效率 -70%'],n=>({lastBreath:.30*n,healMult:1-.35*n}))
);
const HEX_BY_ID={};HEX_POOL.forEach(h=>{HEX_BY_ID[h.id]=h;});
// 远程专属：骑士（近战）抽到等于空卡，抽卡阶段直接过滤掉，不靠玩家自己识别
const RANGED_ONLY={sv_pierce:1,sv_bounce:1,gd_fork:1};
Object.keys(RANGED_ONLY).forEach(id=>{if(HEX_BY_ID[id])HEX_BY_ID[id].rangedOnly=true;});
function hexAvail(){const ev=game.hexEvents,out=[],melee=game.classId==='knight';
 for(let i=0;i<HEX_POOL.length;i++){const h=HEX_POOL[i];if(h.off)continue;
  if(melee&&h.rangedOnly)continue;if((game.hexLayers[h.id]||0)>=h.cap)continue;if((game.hexCool[h.id]??-1)>ev)continue;out.push(h);}return out;}
function hexWeights(n){
 const row=[[.62,.28,.10,0],[.46,.34,.20,0],[.32,.36,.24,.08],[.22,.34,.30,.14],[.14,.28,.36,.22]][clamp(Math.floor((n-1)/20),0,4)];
 const w={white:row[0],gold:row[1],prism:row[2],forbid:row[3]};
 // 第 60 关同时是首领关与海克斯事件：棱彩/禁忌 加权，从白银扣
 if(n===60){w.white=Math.max(0,w.white-.15);w.prism+=.10;w.forbid+=.05;}
 return w;
}
function rollHexTier(pool,w){
 let total=0;for(const h of pool)total+=w[h.tier]||0;
 if(total<=0)return pick(pool);
 let r=Math.random()*total;
 for(const h of pool){r-=w[h.tier]||0;if(r<=0)return h;}
 return pool[pool.length-1];
}
function dominantSchool(){let best=null,bestN=0;for(const s in HEX_SCHOOL){const n=game.hexSchool[s]||0;if(n>bestN){bestN=n;best=s;}}return best;}
function rollHexOptions(){
 let avail=hexAvail();
 // 满层导致的空池：免费重掷最多 2 次，仍空就只给"跳过"
 for(let k=0;k<2&&!avail.length;k++)avail=hexAvail();
 const w=hexWeights(game.wave),picked=[];
 const take=h=>{avail=avail.filter(x=>x!==h);picked.push(h);};
 // ① 主导系保底：第 1 张必来自累计层数最高的系
 const dom=dominantSchool();
 if(dom){const c=avail.filter(h=>h.school===dom);if(c.length)take(rollHexTier(c,w));}
 // ② 系核心保底：每 5 次事件、主导系 ≥4 层、且该系还有未持有的机制型
 if(game.hexEvents%5===0&&dom&&(game.hexSchool[dom]||0)>=4){
  const core=avail.find(h=>h.school===dom&&h.tier!=='white'&&!game.hexLayers[h.id]);
  if(core)take(core);
 }
 while(picked.length<3&&avail.length)take(rollHexTier(avail,w));
 return picked;
}
function hexDotHtml(h){const n=game.hexLayers[h.id]||0;let s='';for(let i=0;i<h.cap;i++)s+=`<i class="${i<n?'on':''}"></i>`;return s;}
function openHex(){
 game.hexEvents++;game.paused=true;game.hexOpen=true;
 const opts=rollHexOptions();game.hexOptions=opts;
 $('hexSub').textContent=`第 ${game.wave} 关清除 · 第 ${game.hexEvents} 次裂境馈赠 · 三选一`;
 const root=$('hexChoices');root.innerHTML='';
 opts.forEach(h=>{
  const n=(game.hexLayers[h.id]||0)+1;
  const d=document.createElement('div');d.className=`hex-card hex-${h.tier}`;
  d.innerHTML=`<div class="hex-top"><span class="hex-rar">${HEX_RAR_NAME[h.tier]}</span><span class="hex-school">${HEX_SCHOOL[h.school]}系</span></div><h3>${h.name}</h3><p>${h.desc[n-1]}</p><div class="hex-foot"><span class="hex-dots">${hexDotHtml(h)}</span><small>已叠 ${n-1} / ${h.cap} 层</small></div>`;
  d.onclick=()=>chooseHex(h.id);root.appendChild(d);
 });
 if(!opts.length){const d=document.createElement('div');d.className='hex-empty';d.textContent='本池已全部满层，领取补偿金币';root.appendChild(d);}
 $('hexPanel').classList.remove('hidden');
 SFX.play('levelup');
}
function chooseHex(id){
 if(!game.hexOpen)return;
 if(id)applyHex(id);else{game.gold+=40;toast('放弃增益，获得 40 金币');}
 hide('hexPanel');game.hexOpen=false;game.paused=false;armPortalIdle();
}
// 允许被上限丢弃的层数（护栏 §8）：超出部分直接不生效，不报错
function recalcHex(){
 const h={atkMult:1,hpMult:1,maxManaMult:1,healMult:1,atkSpeed:0,crit:0,critDmg:0,cdr:0,lifesteal:0,thorns:0,pierce:0,bounce:0,rangePct:0,manaRegen:0,armor:0,speedPct:0,goldMult:0,dmgTaken:0,enemyAtk:0,ice:0,meteor:0,soulHeal:0,soulMana:0,lastBreath:0,chainP:0,chainJumps:0,burstMult:0,echoN:0,forkN:0,blinkMult:0,volleyN:0,orbN:0,stormN:0,stormR:0,stormMult:0};
 game.hexSchool={};
 for(const id in game.hexLayers){const e=HEX_BY_ID[id];if(!e||!e.eff)continue;const n=game.hexLayers[id];if(n<=0)continue;
  game.hexSchool[e.school]=(game.hexSchool[e.school]||0)+n;
  const d=e.eff(n);for(const k in d){if(HX_MULT[k]!==undefined)h[k]*=d[k];else h[k]+=d[k];}
 }
 h.atkMult=Math.min(h.atkMult,2.60);h.hpMult=Math.min(h.hpMult,2.20);h.atkSpeed=Math.min(h.atkSpeed,.90);
 h.crit=Math.min(h.crit,.90);h.critDmg=Math.min(h.critDmg,4.20);h.cdr=Math.min(h.cdr,.45);h.lifesteal=Math.min(h.lifesteal,.30);
 game.hex=h;markStatsDirty();
 const p=game.player;if(p&&p.hpBase){p.maxHp=Math.max(1,p.hpBase*h.hpMult);p.hp=Math.min(p.hp,p.maxHp);}
 if(p&&p.maxManaBase){p.maxMana=Math.max(10,p.maxManaBase*h.maxManaMult);p.mana=Math.min(p.mana,p.maxMana);}
}
function applyHex(id){
 const h=HEX_BY_ID[id];if(!h)return false;
 const n=(game.hexLayers[id]||0)+1;if(n>h.cap)return false;
 game.hexLayers[id]=n;game.hexCool[id]=game.hexEvents+3; // 轮转冷却 3 次事件
 // 护甲是派生前的绝对值，没法走乘区合并；狂血按"每层 ×0.60"直接压底，和文档一致
 if(id==='fb_berserk'&&game.player)game.player.armor*=.60;
 recalcHex();
 toast(`获得海克斯：${h.name}（${n}/${h.cap} 层）`);SFX.play('ach');
 return true;
}
// —— 机制型钩子：全部收在这里，避免在 update/伤害链路里到处塞 if ——
function chainLightning(src){
 if(!game.enemies.length)return;
 const jumps=Math.min(3,hexOf('chainJumps')||1),dmg=stat('atk')*.30;
 let from=src,done=0;
 for(let j=0;j<jumps&&done<3;j++){
  let best=null,bd=220*220;
  for(let i=0;i<game.enemies.length;i++){const e=game.enemies[i];if(e===from)continue;const d2=(e.x-from.x)*(e.x-from.x)+(e.y-from.y)*(e.y-from.y);if(d2<bd){bd=d2;best=e;}}
  if(!best)break;
  game.effects.push({type:'chain',x:from.x,y:from.y,tx:best.x,ty:best.y,t:.22,maxT:.22});
  damageEnemy(best,dmg,'magic',true);from=best;done++;
 }
 SFX.play('crit');
}
function comboVolley(){
 const p=game.player,n=Math.max(4,hexOf('volleyN')||4),base=Math.atan2(game.mouse.y-p.y,game.mouse.x-p.x);
 for(let k=0;k<n;k++){const a=base+(k-(n-1)/2)*.16;game.projectiles.push({x:p.x,y:p.y,vx:Math.cos(a)*640,vy:Math.sin(a)*640,r:4,damage:stat('atk')*.30,type:'arrow',life:1.2,pierce:0,bounce:0,trail:3});}
 game.cameraShake=save.settings.screenShake===false?0:3;
}
function hexEcho(){
 const p=game.player,n=Math.max(1,hexOf('echoN')||1);
 for(let k=0;k<n;k++){
  let best=null,bd=1e9;
  for(let i=0;i<game.enemies.length;i++){const e=game.enemies[i],d2=(e.x-p.x)*(e.x-p.x)+(e.y-p.y)*(e.y-p.y);if(d2<bd){bd=d2;best=e;}}
  const a=best?Math.atan2(best.y-p.y,best.x-p.x):game.player.faceAngle;
  game.projectiles.push({x:p.x,y:p.y,vx:Math.cos(a)*420,vy:Math.sin(a)*420,r:6,damage:stat('atk')*.35,type:'magic',life:2,pierce:0,bounce:0,target:best,trail:6});
 }
}
function stormHeart(){
 const p=game.player,R=hexOf('stormR')||130;
 game.effects.push({type:'stormRing',x:p.x,y:p.y,r:R,t:.42,maxT:.42});
 for(let i=game.enemies.length-1;i>=0;i--){const e=game.enemies[i];if(!e)continue;if((e.x-p.x)*(e.x-p.x)+(e.y-p.y)*(e.y-p.y)<(R+e.r)*(R+e.r))damageEnemy(e,stat('atk')*(hexOf('stormMult')||1),'magic');}
 game.cameraShake=save.settings.screenShake===false?0:4;SFX.play('crit');
}
// 环绕符文：不生成实体，直接按层数在玩家周围判定；每个敌人 0.6s ICD
function updateOrbs(dt){
 const n=hexOf('orbN');
 if(!n||!game.player)return;
 const p=game.player,sp=1.6;
 for(let k=0;k<n;k++){
  const a=game.elapsed*sp+k*Math.PI*2/n,ox=p.x+Math.cos(a)*58,oy=p.y-12+Math.sin(a)*58*.62;
  for(let i=0;i<game.enemies.length;i++){
   const e=game.enemies[i];if(!e)continue;if((e.sigilCd||0)>0)continue;
   if((e.x-ox)*(e.x-ox)+(e.y-oy)*(e.y-oy)<(22+e.r)*(22+e.r)){e.sigilCd=.6;damageEnemy(e,stat('atk')*.30,'magic',true);spawnParticles(ox,oy,3,{colors:['#d8f4ff','#9bdcff'],speed:80,life:.3,size:2});}
  }
 }
}
function castSkill(i){
 if(!game.running||game.paused||game.state==='portal_enter')return;const p=game.player,s=CLASS[game.classId].skills[i];if(p.skillCd[i]>0)return;
 const mana=s[2]||0;if(p.mana<mana){SFX.play('deny');return toast('蓝量不足');}
 p.mana-=mana;SFX.play('skill'+(i+1));const lv=save.skill[game.classId][i]||0;
 const cdr=Math.min(.45,stat('cdr')+hexOf('cdr')),cd=s[1]*(1-cdr)*(1-lv*.03);
 p.skillCd[i]=Math.max(.5,cd);(p.skillCdMax=p.skillCdMax||[])[i]=p.skillCd[i];
 const skillPower=1+lv*.08,ang=Math.atan2(game.mouse.y-p.y,game.mouse.x-p.x);
 p.faceAngle=ang;p.animAction=`skill${i+1}`;p.animSkillT=i===2?1.1:.72;
 game.effects.push({type:'cast',x:p.x,y:p.y,a:ang,t:.28,maxT:.28,classId:game.classId,skill:i});
 if(game.classId==='knight'){
  if(i===0){
   game.effects.push({type:'skillArc',x:p.x,y:p.y,a:ang,r:92,t:.36,maxT:.36,color:'#d6d0c8'});
   const dx=Math.cos(ang),dy=Math.sin(ang);
   for(let t=0;t<8;t++){p.x=clamp(p.x+dx*15,30,W-30);p.y=clamp(p.y+dy*15,40,H-30);for(const e of game.enemies)if(dist(p,e)<42){damageEnemy(e,stat('atk')*1.7*skillPower);e.hitStun=1.5;}}
   game.cameraShake=save.settings.screenShake===false?0:6;
   game.effects.push({type:'shockwave',x:p.x,y:p.y,r:40,t:.3,maxT:.3,color:'#e8c878'});
   addDecal('slash',p.x,p.y,68,.35);
  }
  if(i===1){
   p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.25*skillPower);p.buffArmor=.5;p.buffT=3;
   // 圣光护体原先只有血条跳一下；补六棱壳 + 十字光芒（禁圆形，与寒霜圆环区分）
   game.effects.push({type:'wardShell',x:p.x,y:p.y,t:3.4,maxT:3.4});
   game.effects.push({type:'shockwave',x:p.x,y:p.y,r:60,t:.3,maxT:.3,color:'#ffd700'});
   game.holyFlash=.28;spawnParticles(p.x,p.y-10,16,{colors:['#ffd700','#ffe9a8'],speed:18,life:1.2,size:3,gravity:-40});triggerZoom(p.x,p.y,.08);
  }
  if(i===2){p.spin=3*skillPower;game.effects.push({type:'spinAura',x:p.x,y:p.y,r:96*stat('range')*(1+hexOf('rangePct')),t:3*skillPower,maxT:3*skillPower});spawnParticles(p.x,p.y,30,{colors:['#ffd700','#ffecb4'],speed:200,life:.28,size:4,gravity:120});}
 } else if(game.classId==='hunter'){
  if(i===0){
   const sx=p.x,sy=p.y;p.x=clamp(p.x-Math.cos(ang)*115,30,W-30);p.y=clamp(p.y-Math.sin(ang)*115,40,H-30);
   game.projectiles.push({x:p.x,y:p.y,vx:Math.cos(ang)*900,vy:Math.sin(ang)*900,r:7,damage:stat('atk')*2.8*skillPower,type:'arrow',life:1.5,pierce:8,bounce:0});
   p.invuln=.25;addDecal('dust',sx,sy,16,.22);
  }
  if(i===1){game.effects.push({type:'trap',x:p.x,y:p.y,t:18,triggered:false,armedT:0});}
  if(i===2){const R=105*stat('range')*(1+hexOf('rangePct'));game.effects.push({type:'telegraph',x:game.mouse.x,y:game.mouse.y,r:R,t:.38,maxT:.38,color:'#d6d0c8'});game.effects.push({type:'rain',x:game.mouse.x,y:game.mouse.y,r:R,t:2,damage:stat('atk')*.72*skillPower,tick:0,dust:0});}
 } else {
  if(i===0){const r=115*stat('range')*(1+hexOf('rangePct')),tx=clamp(game.mouse.x,r,W-r),ty=clamp(game.mouse.y,r,H-r);p.faceAngle=Math.atan2(ty-p.y,tx-p.x);game.effects.push({type:'telegraph',x:tx,y:ty,r,t:.30,maxT:.30,color:'#9bdcff'});game.effects.push({type:'frost',x:tx,y:ty,r,t:.88,maxT:.88,damage:stat('atk')*.9*(1+p.ice+hexOf('ice'))*skillPower});}
  if(i===1){
   p.mana=Math.min(p.maxMana,p.mana+50);p.buffPower=.5*skillPower;p.buffT=4;
   // 法力涌泉原先只有蓝条上涨；补脚底向上的光柱 + 环形符文（与圣光"罩住身体"区分）
   game.effects.push({type:'manaPillar',x:p.x,y:p.y,t:4.4,maxT:4.4});
   spawnParticles(p.x,p.y-12,14,{colors:['#f0dcff','#b06aff','#6b3fa0'],speed:22,life:1.4,size:2,gravity:-70});
  }
  if(i===2){const r=125*stat('range')*(1+hexOf('rangePct')),tx=clamp(game.mouse.x,r,W-r),ty=clamp(game.mouse.y,r+50,H-r);p.faceAngle=Math.atan2(ty-p.y,tx-p.x);game.effects.push({type:'meteorMark',x:tx,y:ty,r,t:.60,maxT:.60,damage:stat('atk')*5.2*(1+p.meteor+hexOf('meteor'))*skillPower,sky:1});}
 }
 // ★ 技能回响：技能释放后生成追踪弹，三职业共用同一钩子
 if(hexOf('echoN'))hexEcho();
}
function dodge(){
 const p=game.player;if(!game.running||game.paused||game.state==='portal_enter'||p.dodgeCd>0)return;
 const ox=p.x,oy=p.y;
 let dx=(game.keys.KeyD?1:0)-(game.keys.KeyA?1:0),dy=(game.keys.KeyS?1:0)-(game.keys.KeyW?1:0);
 if(!dx&&!dy){const a=Math.atan2(game.mouse.y-p.y,game.mouse.x-p.x);dx=Math.cos(a);dy=Math.sin(a);}
 const l=Math.max(1,Math.hypot(dx,dy));p.x=clamp(p.x+dx/l*95,30,W-30);p.y=clamp(p.y+dy/l*95,40,H-30);
 p.dodgeCd=1.5;p.invuln=.28;SFX.play('dodge');
 game.effects.push({type:'dash',x:p.x,y:p.y,t:.22,a:Math.atan2(dy,dx)});
 addDecal('dust',ox,oy,18,.20);
 // ★ 闪避残影：原地爆一圈，ICD 1s
 if(hexOf('blinkMult')&&(game.blinkCd||0)<=0){
  game.blinkCd=1.0;game.effects.push({type:'shockwave',x:ox,y:oy,r:90,t:.4,maxT:.4,color:'#9a5aca'});
  for(let i=game.enemies.length-1;i>=0;i--){const e=game.enemies[i];if(!e)continue;if((e.x-ox)*(e.x-ox)+(e.y-oy)*(e.y-oy)<(90+e.r)*(90+e.r))damageEnemy(e,stat('atk')*hexOf('blinkMult'),'magic');}
 }
}
function usePotion(){if(game.potions<=0){SFX.play('deny');return toast('没有回血药水');}const p=game.player;if(p.hp>=p.maxHp){SFX.play('deny');return;}game.potions--;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.38*hexOf('healMult'));SFX.play('potion');toast('使用回血药水');}

function makeEquipment(bonus=0){const qroll=Math.random()+bonus*.15+game.wave/600;let qi=qroll>.98?4:qroll>.82?3:qroll>.58?2:qroll>.3?1:0;if(game.difficulty==='inferno'&&Math.random()<.06)qi=Math.max(qi,4);if(qi===4){bumpStat('legendaryFound');checkAch();}const q=QUAL[qi],slot=pick(SLOT),lv=Math.max(1,Math.ceil(game.wave/4));const item={id:Date.now()+Math.random(),classId:game.classId,slot,q:q.id,qName:q.name,name:`${q.name}·${ITEM_BASE_NAME[game.classId][slot]}`,stats:{},level:lv};
 const m=q.m*(1+lv*.055);if(slot==='weapon')item.stats.atk=Math.round(3*m);if(slot==='armor')item.stats.armor=Math.round(2*m);if(slot==='shoes')item.stats.speed=+(.08*m).toFixed(2);if(slot==='amulet')item.stats.hp=Math.round(10*m);if(slot==='ring')item.stats.crit=+(.012*m).toFixed(3);
 const pool=game.classId==='knight'?['hp','armor','lifesteal','atk']:game.classId==='hunter'?['atkSpeed','crit','pierce','atk']:['atk','manaRegen','cdr','range'];const extras=qi>=2?Math.min(3,qi-1):0;for(let i=0;i<extras;i++){const k=pick(pool);item.stats[k]=(item.stats[k]||0)+(k==='pierce'?1:(k==='hp'?Math.round(7*m):k==='atk'?Math.round(2*m):+(.02*m).toFixed(3)));}return item;}
function dropEquipment(x,y,bonus=0){const it=makeEquipment(bonus);game.drops.push({type:'equip',x,y,item:it});
 if(it.q==='legendary'){game.goldFlash=Math.max(game.goldFlash,.42);SFX.play('legendary');toast('✦ 传说装备降临！');}
 else if(it.q==='epic'){game.soulFlash=Math.max(game.soulFlash,.3);SFX.play('drop');}
 else SFX.play('drop');}
function equipItem(item){if(game.equipped[item.slot])game.inventory.push(game.equipped[item.slot]);game.equipped[item.slot]=item;game.inventory=game.inventory.filter(x=>x.id!==item.id);recalcGear();renderInventory();}
function dismantle(item){game.inventory=game.inventory.filter(x=>x.id!==item.id);game.gold+=15+item.level*4+QUAL.findIndex(q=>q.id===item.q)*15;renderInventory();}
function recalcGear(){const p=game.player;if(!p)return;const old=p.gear||{},bonus={atk:0,armor:0,speed:0,hp:0,crit:0,lifesteal:0,atkSpeed:0,pierce:0,manaRegen:0,cdr:0,range:0};Object.values(game.equipped).forEach(it=>Object.entries(it.stats).forEach(([k,v])=>bonus[k]=(bonus[k]||0)+v));const hpDelta=(bonus.hp||0)-(old.hp||0);p.hpBase=Math.max(1,(p.hpBase||p.maxHp)+hpDelta);p.maxHp=Math.max(1,p.hpBase*hexOf('hpMult'));p.hp=clamp(p.hp+Math.max(0,hpDelta),0,p.maxHp);p.gear=bonus;markStatsDirty();}
function gearVal(k){return game.player?.gear?.[k]||0;}
// 海克斯聚合值：mult 类缺省 1、其余缺省 0，避免每次调用都判空
const HX_MULT={atkMult:1,hpMult:1,maxManaMult:1,healMult:1};
function hexOf(k){const h=game.hex;if(h&&h[k]!=null)return h[k];return HX_MULT[k]??0;}
// stat() 每帧只算一次：同一帧里连击/多段命中会调它几十次，缓存后省掉重复的 gear 查表
let statCache={};
function markStatsDirty(){statCache={};}
function stat(k){const p=game.player;if(!p)return 0;if(k==='hp')return p.maxHp;const c=statCache[k];if(c!==undefined)return c;const v=(p[k]||0)+gearVal(k);statCache[k]=v;return v;}
function statDeltaText(k,d){const m=STAT_META[k]||{name:k,unit:'数值'};const a=Math.abs(d);if(m.unit==='百分比')return `${m.name} ${d>0?'↑':'↓'} ${Math.round(a*100)}%`;if(m.unit==='次数')return `${m.name} ${d>0?'↑':'↓'} ${Math.round(a)}次`;if(m.unit==='每秒')return `${m.name} ${d>0?'↑':'↓'} ${a.toFixed(2)}/秒`;return `${m.name} ${d>0?'↑':'↓'} ${Number.isInteger(a)?a:a.toFixed(2)}`;}
function compareItem(candidate){const cur=game.equipped[candidate.slot];if(!cur)return {current:null,up:Object.keys(candidate.stats).length,down:0,same:0,rows:Object.entries(candidate.stats).map(([k,v])=>({k,d:v}))};const keys=[...new Set([...Object.keys(candidate.stats),...Object.keys(cur.stats)])];const rows=keys.map(k=>({k,d:(candidate.stats[k]||0)-(cur.stats[k]||0)}));return {current:cur,up:rows.filter(x=>x.d>1e-9).length,down:rows.filter(x=>x.d<-1e-9).length,same:rows.filter(x=>Math.abs(x.d)<=1e-9).length,rows};}
function comparisonHtml(it){const c=compareItem(it);if(!c.current)return `<div class="gear-compare compare-up"><b>↑ 可直接装备</b><span>当前${SLOT_NAME[it.slot]}为空，全部属性均为新增。</span></div>`;const changes=c.rows.filter(x=>Math.abs(x.d)>1e-9).map(x=>`<span class="${x.d>0?'delta-up':'delta-down'}">${statDeltaText(x.k,x.d)}</span>`).join('');const verdict=c.down===0&&c.up>0?'整体提升':c.up===0&&c.down>0?'整体下降':c.up>c.down?'偏向提升':c.down>c.up?'偏向下降':'属性取舍';const cls=c.down===0&&c.up>0?'compare-up':c.up===0&&c.down>0?'compare-down':'compare-mixed';return `<div class="gear-compare ${cls}"><b>${c.down===0&&c.up>0?'↑':c.up===0&&c.down>0?'↓':'↕'} ${verdict}</b><span>对比当前：${c.current.name}</span><div class="compare-deltas">${changes||'<span class="delta-same">属性无变化</span>'}</div></div>`;}
function renderInventory(){if(!game.player)return;const eq=$('equippedList'),inv=$('inventoryList');eq.innerHTML='';inv.innerHTML='';SLOT.forEach(s=>{const it=game.equipped[s],d=document.createElement('div');d.className='item-card equipped-card';d.innerHTML=`<b>${SLOT_NAME[s]}</b><div>${it?itemHtml(it):'— 空 —'}</div>`;eq.appendChild(d)});game.inventory.forEach(it=>{const d=document.createElement('div');d.className='item-card';d.innerHTML=itemHtml(it)+comparisonHtml(it)+`<div><button>装备</button> <button class="dismantle">分解</button></div>`;d.querySelector('button').onclick=()=>equipItem(it);d.querySelector('.dismantle').onclick=()=>dismantle(it);inv.appendChild(d)});}
function itemIconSrc(it){return `Assets/icons/equipment/${it.classId||game.classId}_${it.slot}.png`;}
function itemHtml(it){const attrs=Object.entries(it.stats).map(([k,v])=>`<li><b>${formatStatValue(k,v)}</b><span>${(STAT_META[k]||{}).desc||''}</span></li>`).join('');return `<div class="item-row"><span class="gear-icon q-border-${it.q}"><img src="${itemIconSrc(it)}" alt="${it.name}"></span><div class="item-main"><div class="item-title q-${it.q}">${it.name}</div><div class="item-meta">${it.qName||QUAL.find(q=>q.id===it.q)?.name||'普通'}品质 · 装备等级 ${it.level} · ${SLOT_NAME[it.slot]}</div><div class="item-desc">${ITEM_SLOT_DESC[it.slot]}</div><ul class="item-stats">${attrs}</ul></div></div>`;}
function renderStats(){if(!game.player)return;const p=game.player,g=p.gear||{},cls=CLASS[game.classId];$('statsHeader').innerHTML=`<div class="stats-portrait"><img src="Assets/characters/${game.classId}/idle.png" alt="${cls.name}"></div><div><h3>${cls.name} · 等级 ${game.level}</h3><p>${cls.desc}</p><span>当前装备 ${Object.keys(game.equipped).length} / ${SLOT.length} 件</span></div>`;const armor=stat('armor'),reduction=armor*5/(100+armor*5)*100;const attackInterval=p.interval/(1+stat('atkSpeed'));const rows=[['最大生命',stat('hp'),g.hp||0,'角色生命上限'],['当前生命',Math.max(0,p.hp),0,'当前剩余生命'],...(p.maxMana?[['最大法力',p.maxMana,0,'施放法师技能所需资源'],['法力回复',stat('manaRegen'),g.manaRegen||0,'每秒自动回复法力']]:[]),['攻击力',stat('atk'),g.atk||0,'普通攻击与技能的核心伤害属性'],['护甲',armor,g.armor||0,`预计减伤 ${reduction.toFixed(1)}%`],['移动速度',stat('speed'),g.speed||0,'影响角色移动与走位'],['暴击率',`${(stat('crit')*100).toFixed(1)}%`,g.crit||0,'普通攻击和伤害事件触发暴击的概率'],['暴击伤害',`${(p.critDmg*100).toFixed(0)}%`,0,'暴击时的伤害倍率'],['攻击速度',`${(stat('atkSpeed')*100).toFixed(1)}%`,g.atkSpeed||0,`当前攻击间隔约 ${attackInterval.toFixed(2)} 秒`],['生命汲取',`${(stat('lifesteal')*100).toFixed(1)}%`,g.lifesteal||0,'造成伤害后恢复生命'],['冷却缩减',`${(stat('cdr')*100).toFixed(1)}%`,g.cdr||0,'缩短技能冷却'],['范围加成',`${((stat('range')-1)*100).toFixed(1)}%`,g.range||0,'扩大近战和范围技能判定'],['穿透',Math.round(stat('pierce')),g.pierce||0,'投射物可额外穿过的敌人数'],['弹射',Math.round(stat('bounce')),g.bounce||0,'投射物可额外弹射次数']];$('statsGrid').innerHTML=rows.map(([n,v,b,d])=>`<div class="stat-card"><div class="stat-card-top"><b>${n}</b><strong>${typeof v==='number'?(Number.isInteger(v)?v:v.toFixed(2)):v}</strong></div>${b?`<div class="gear-bonus">装备加成：${['暴击率','攻击速度','生命汲取','冷却缩减','范围加成'].includes(n)?'+'+Math.round(b*100)+'%':'+'+(Number.isInteger(b)?b:Number(b).toFixed(2))}</div>`:''}<small>${d}</small></div>`).join('');}
function openStats(){if(!game.running||game.hexOpen)return;hide('inventoryPanel');hide('shopPanel');hide('pausePanel');game.paused=true;renderStats();$('statsPanel').classList.remove('hidden');}
function closeStats(){hide('statsPanel');game.paused=false;}

function buyShop(type){if(type==='potion'){if(game.gold<45)return toast('金币不足');game.gold-=45;game.potions++;}else{if(game.gold<120)return toast('金币不足');game.gold-=120;game.inventory.push(makeEquipment(1));renderInventory();}openShop();}
function openShop(){if(!game.running||game.hexOpen)return;game.paused=true;$('shopGold').textContent=`金币：${game.gold}`;$('shopItems').innerHTML=`<div class="item-card"><b>回血药水</b><p>恢复38%最大生命</p><button id="buyPotion">购买 · 45金币</button></div><div class="item-card"><b>随机职业装备</b><p>至少提高一次品质判定</p><button id="buyGear">购买 · 120金币</button></div>`;$('buyPotion').onclick=()=>buyShop('potion');$('buyGear').onclick=()=>buyShop('gear');$('shopPanel').classList.remove('hidden');}

function endRun(win){if(!game.running)return;game.running=false;SFX.play(win?'levelup':'hurt');game.props=[];save.runs++;save.bestWave=Math.max(save.bestWave,game.wave);let souls=Math.floor(game.kills*.7+game.wave*3+(win?220:0));souls=Math.floor(souls*(game.difficulty==='easy'?.8:game.difficulty==='normal'?1:game.difficulty==='hard'?1.2:game.difficulty==='nightmare'?1.5:2));if(game.isDaily)souls=Math.floor(souls*1.3);save.souls+=souls;bumpStat('soulsEarned',souls);let dailyLine='';if(game.isDaily){const di=dailyInfo();if(save.daily.date!==di.key)save.daily={date:di.key,best:0};save.daily.best=Math.max(save.daily.best,game.wave);dailyLine=`<br>每日挑战最佳：${save.daily.best} 波（灵魂 +30%）`;}if(win){save.unlocks.hard=true;if(game.difficulty==='hard')save.unlocks.nightmare=true;if(game.difficulty==='nightmare')save.unlocks.inferno=true;}checkAch();persist();$('resultTitle').textContent=win?'裂境暂时沉寂':'灵魂回归营地';$('resultStats').innerHTML=`关卡：${game.wave}/100<br>击杀：${game.kills}<br>等级：${game.level}<br>金币：${game.gold}<br>获得灵魂碎片：<b>${souls}</b>${dailyLine}`;$('resultPanel').classList.remove('hidden');}

function pxRect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function pxLine(x1,y1,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(Math.round(x1),Math.round(y1));ctx.lineTo(Math.round(x2),Math.round(y2));ctx.stroke();}

// ==== 精细绘制原语 ====
// 原先特效全是 lineWidth 5~7 的纯色圆弧 + 8×8 方块，所以看起来"粗、假"。
// 下面这些原语用渐变扇面 / 多边形 / 多层描边替代，同样分辨率下细节密度高得多。
const easeOut=t=>1-Math.pow(1-clamp(t,0,1),3);
const easeIn=t=>clamp(t,0,1)*clamp(t,0,1);
const easeInOut=t=>{t=clamp(t,0,1);return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;};
function polyFill(pts,c){if(pts.length<3)return;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fillStyle=c;ctx.fill();}
function glowSpot(x,y,r,rgb,a=1){if(r<=0||a<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${rgb},${a})`);g.addColorStop(.45,`rgba(${rgb},${a*.4})`);g.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
// 环形扇面（刀光/冲击环的基础形状）：从 r0 到 r1、角度 a0→a1
function ringSector(cx,cy,r0,r1,a0,a1,inner,outer){
  r0=Math.max(r0,.4);r1=Math.max(r1,r0+.6);
  if(a1-a0<.004)return;
  const g=ctx.createRadialGradient(cx,cy,r0,cx,cy,r1);
  g.addColorStop(0,inner);g.addColorStop(1,outer);
  ctx.beginPath();ctx.arc(cx,cy,r1,a0,a1);ctx.arc(cx,cy,r0,a1,a0,true);ctx.closePath();
  ctx.fillStyle=g;ctx.fill();
}
// 月牙形光带：内圈透明、外缘锐利、中间最亮 → 读起来才像"刀锋扫过"而不是"扇形色块"
function crescentSector(cx,cy,rIn,rOut,a0,a1,rgb,alphaB){
  rIn=Math.max(rIn,.4);rOut=Math.max(rOut,rIn+2);
  const g=ctx.createRadialGradient(cx,cy,rIn,cx,cy,rOut);
  g.addColorStop(0,`rgba(${rgb},0)`);
  g.addColorStop(.50,`rgba(${rgb},${alphaB*.34})`);
  g.addColorStop(.86,`rgba(${rgb},${alphaB})`);
  g.addColorStop(1,`rgba(${rgb},${alphaB*.45})`);
  ctx.beginPath();ctx.arc(cx,cy,rOut,a0,a1);ctx.arc(cx,cy,rIn,a1,a0,true);ctx.closePath();
  ctx.fillStyle=g;ctx.fill();
}
// 沿角度方向渐隐的扫掠带：越靠近前沿越亮，尾部细而淡 → 彗尾状刀光
function cometSector(cx,cy,r0,r1,aFrom,aTo,rgb,n=13,alpha=1){
  if(Math.abs(aTo-aFrom)<.012)return;
  for(let i=0;i<n;i++){
    const f0=i/n,f1=(i+1)/n;
    const al=alpha*Math.pow(f0,2.2);
    if(al<=.01)continue;
    ctx.globalAlpha=al;
    const s0=aFrom+(aTo-aFrom)*f0,s1=aFrom+(aTo-aFrom)*f1;
    crescentSector(cx,cy,Math.max(r0*(1.5-.95*f0),r0*.3),r1,Math.min(s0,s1),Math.max(s0,s1),rgb,1);
  }
  ctx.globalAlpha=1;
}
// 多边形描边（冰锥、爪痕、箭矢等需要非圆形的轮廓）
function polyStroke(pts,c,w=1.5,close=true){if(pts.length<2)return;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);if(close)ctx.closePath();ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();}
// 确定性伪随机（特效每帧稳定，不会闪烁抖动）
function frand(seed){const s=Math.sin(seed*127.1+311.7)*43758.5453;return s-Math.floor(s);}
// ---- 屏幕级演出：击杀推镜 / 传说金闪 / 阶段红闪 / 首领降临 ----
function triggerZoom(x,y,strength){if(save.settings.screenShake===false)return;game.zoomX=x??game.player?.x??W/2;game.zoomY=y??game.player?.y??H/2;game.zoomT=strength??game.zoomMax;game.zoomMax=game.zoomT;}
function updateFx(dt){
 if(game.zoomT>0)game.zoomT=Math.max(0,game.zoomT-dt);
 if(game.goldFlash>0)game.goldFlash=Math.max(0,game.goldFlash-dt);
 if(game.phaseFlash>0)game.phaseFlash=Math.max(0,game.phaseFlash-dt);
 if(game.bossIntro>0)game.bossIntro=Math.max(0,game.bossIntro-dt);
 if(game.soulFlash>0)game.soulFlash=Math.max(0,game.soulFlash-dt);
}
function drawScreenFx(){
 if(!game.running)return;
 // 同帧只允许 1 次全屏合成（render-budget §5 硬红线）：白闪 > 阶段红闪 > 首领黑罩 > 清场暗角 > 圣光/金币/灵魂
 let ov=null;
 if(game.warpFlash>0)ov={c:'#ffffff',a:clamp(game.warpFlash/.35,0,1)*.55};
 else if(game.phaseFlash>0)ov={c:'#a11f1f',a:clamp(game.phaseFlash/.55,0,1)*.26};
 else if(game.bossIntro>0){const k=1-game.bossIntro/1.1;ov={c:'#000',a:.68*Math.min(1,k*2.2)*(1-Math.max(0,k-.75)*4)};}
 else if(game.clearFx>0)ov={c:'#000',a:.16*clamp(game.clearFx/.35,0,1)};
 else if(game.holyFlash>0)ov={c:'#fff8e8',a:clamp(game.holyFlash/.28,0,1)*.10};
 else if(game.goldFlash>0)ov={c:'#ffd700',a:clamp(game.goldFlash/.34,0,1)*.30};
 else if(game.soulFlash>0)ov={c:'#ca8afa',a:clamp(game.soulFlash/.5,0,1)*.22};
 if(ov&&ov.a>0){ctx.globalAlpha=ov.a;ctx.fillStyle=ov.c;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
 // 首领降临：名字 + 副标题（文字不是全屏合成，可以叠在上面）
 if(game.bossIntro>0){const k=1-game.bossIntro/1.1;
  const b=game.enemies.find(e=>e.isBoss);if(b){ctx.save();ctx.textAlign='center';
   ctx.globalAlpha=Math.min(1,k*3)*(1-Math.max(0,k-.7)*3.3);ctx.fillStyle='#a11f1f';ctx.font='bold 36px monospace';ctx.fillText(CHAPTERS[b.ch].boss,W/2,H/2-34);
   ctx.globalAlpha*=.7;ctx.fillStyle='#d6d0c8';ctx.font='13px monospace';ctx.fillText('— 首领降临 —',W/2,H/2+2);ctx.restore();}}
 // 清场结算：金色描边大字（low 档也保留，只是没有外发光）。演出时长由 clearFxMax 决定，文字在最后 0.28s 淡出
 if(game.clearFx>0&&game.state==='cleared_show'){
  const max=game.clearFxMax||SHOW_T,elapsed=max-game.clearFx;
  const a=clamp(Math.min(elapsed/.14,1)*Math.min(game.clearFx/.28,1),0,1);
  const title=game.showTitle||`关卡 ${game.wave} 清除`;
  ctx.save();ctx.textAlign='center';ctx.globalAlpha=a;
  if(save.settings.quality!=='low'){ctx.globalCompositeOperation='lighter';glowSpot(W/2,H/2-8,90,'255,210,100',.10);ctx.globalCompositeOperation='source-over';}
  ctx.font='bold 30px monospace';ctx.lineWidth=4;ctx.strokeStyle='#000';ctx.strokeText(title,W/2,H/2-4);
  ctx.fillStyle='#ffd700';ctx.fillText(title,W/2,H/2-4);
  ctx.globalAlpha=a*.8;ctx.font='13px monospace';ctx.fillStyle='#d6d0c8';
  const sub=game.levelPlan&&game.levelPlan.final?'深渊归于寂静':`${game.levelPlan?game.levelPlan.total:0} 只全部肃清`;
  ctx.fillText(sub,W/2,H/2+24);
  ctx.restore();
 }
 // 通道生长：只画生长中的本体（灰罩在 FxLayer），文字提示留到就绪后由脉冲 + [E] 承担
 if(game.portal&&game.state==='portal_grow'){
  const a=Math.min(1,clamp(1-game.clearT/GROW_T,0,1)*2.5);
  ctx.save();ctx.textAlign='center';ctx.globalAlpha=clamp(a,0,1);
  ctx.font='bold 24px monospace';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText('通道开启',W/2,H/2-6);
  ctx.fillStyle='#ffd700';ctx.fillText('通道开启',W/2,H/2-6);
  ctx.restore();
 }
}
function draw(){
 ctx.imageSmoothingEnabled=false;
 const bch=game.running?waveInfo().ch:0;
 if(bch!==bgBakedChapter){bakeBackground(bch);initAmbient();}
 ctx.drawImage(bgCv,0,0);
 drawAmbient();
 ctx.save();
 if(game.cameraShake>0){const sh=save.settings.screenShake===false?0:game.cameraShake;ctx.translate(Math.round(rand(-sh,sh)),Math.round(rand(-sh,sh)));game.cameraShake*=.86;if(game.cameraShake<.2)game.cameraShake=0;}
 if(game.zoomT>0){const k=clamp(game.zoomT/game.zoomMax,0,1),z=1+.055*Math.sin(k*Math.PI);ctx.translate(game.zoomX,game.zoomY);ctx.scale(z,z);ctx.translate(-game.zoomX,-game.zoomY);}
 if(game.running){drawWorld();drawLighting();drawFxLayer();drawHUD();}else{drawLighting();}
 ctx.restore();
 drawScreenFx();
}
let last=performance.now();let fpsAcc=0,fpsN=0,fpsVal=0,jsAcc=0,jsN=0;
// 每帧清一次 stat 缓存：同一帧内重复调用（多段命中/多处绘制）直接命中缓存，跨帧一定重算
function loop(now){
 const t0=performance.now();
 const dt=Math.min(.033,(now-last)/1000);last=now;statCache={};
 update(dt);updateAmbient(dt);updateFx(dt);
 fpsAcc+=dt;fpsN++;if(fpsAcc>=.5){fpsVal=Math.round(fpsN/fpsAcc);fpsAcc=0;fpsN=0;}
 draw();
 const cost=performance.now()-t0;jsAcc+=cost;jsN++;
 if(jsN>=30){game.jsMs=jsAcc/jsN;jsAcc=0;jsN=0;}
 requestAnimationFrame(loop);
}
function hash2(x,y,s=0){let n=(x*374761393+y*668265263+s*1442695041)|0;n=(n^(n>>>13))*1274126177;return ((n^(n>>>16))>>>0)/4294967295;}
function drawBackground(){const wi=waveInfo(),ch=game.running?wi.ch:0;const palettes=[['#1a1719','#2a2325','#5b343a'],['#141c15','#232e25','#3a5a42'],['#171c11','#28321e','#4c6140'],['#1d1b17','#332e28','#635544'],['#18111b','#2a1e2e','#5b3663']];const [base,mid,accent]=palettes[ch];pxRect(0,0,W,H,base);
 // 8px 像素颗粒 + 32px 大块地面结构：刻意不画完整网格，避免“表格地板”观感。
 for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4){const h=hash2(x>>2,y>>2,ch);if(h>.80)pxRect(x,y,4,4,mid);else if(h<.09)pxRect(x,y,4,4,'rgba(0,0,0,.16)');else if(h>.53&&h<.545)pxRect(x,y,2,2,'rgba(214,208,200,.05)');}
 for(let y=16;y<H;y+=32)for(let x=16;x<W;x+=32){const h=hash2(x>>5,y>>5,ch+17);if(h>.72){const w=h>.91?56:40,hh=h>.86?24:16;pxRect(x-(w>>1),y-(hh>>1),w,hh,'rgba(214,208,200,.025)');if(h>.82){pxLine(x-w/2,y+hh/2,x+w*.1,y+hh/2,accent,1);pxLine(x+w*.1,y+hh/2,x+w*.32,y+hh/2-8,accent,1);}}}
 // 章节装饰：只稀疏使用图集中的墙/道具块，不再把整张地图铺成规则 tile 网格。
 // 地面裂纹与碎石：极细的深色折线，让地表不再是"纯色噪声"
 for(let i=0;i<30;i++){const h1=hash2(i,91,ch*5+3),h2=hash2(i,97,ch*5+4);const x=30+h1*(W-60),y=40+h2*(H-80);
  const a1=h1*6.283,len=20+h2*52;
  ctx.globalAlpha=.13;ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);
  ctx.lineTo(x+Math.cos(a1)*len*.5,y+Math.sin(a1)*len*.5);
  ctx.lineTo(x+Math.cos(a1+.55)*len,y+Math.sin(a1+.55)*len);ctx.stroke();ctx.globalAlpha=1;}
 for(let i=0;i<46;i++){const h1=hash2(i,131,ch*7+5),h2=hash2(i,137,ch*7+6),h3=hash2(i,139,ch*7+7);
  ctx.globalAlpha=.05+h3*.05;pxRect(20+h1*(W-40),40+h2*(H-80),2+h3*3|0,2+h1*2|0,'#d6d0c8');ctx.globalAlpha=1;}
 const key=`tile:${TILE_IDS[ch]}`
 // 章节地表细节：血迹/骸骨/草丛/裂纹，哈希定位，每帧稳定
 const hasBlood=[1,0,0,0,1][ch],hasPlants=[0,1,1,0,0][ch],hasBones=[1,0,0,1,0][ch];
 for(let i=0;i<14;i++){const h1=hash2(i,7,ch*3+1),h2=hash2(i,13,ch*3+2);const x=60+h1*(W-120),y=70+h2*(H-140);
  if(hasBlood&&h1>.5){pxRect(x,y,14,6,'rgba(90,16,16,.20)');pxRect(x+4,y-3,6,4,'rgba(90,16,16,.14)');pxRect(x-3,y+4,5,3,'rgba(90,16,16,.12)');}
  if(hasPlants&&h2>.55){pxRect(x,y,2,6,'rgba(96,148,86,.32)');pxRect(x+3,y+1,2,5,'rgba(96,148,86,.26)');pxRect(x-2,y+2,2,4,'rgba(96,148,86,.20)');}
  if(hasBones&&h2>.6&&h2<.72){pxRect(x,y,6,2,'rgba(214,208,200,.14)');pxRect(x+5,y-2,2,2,'rgba(214,208,200,.17)');pxRect(x-2,y+1,2,2,'rgba(214,208,200,.11)');}}
 // 章节符文魔法阵（地牢/神殿）
 if(ch===0||ch===4){ctx.save();ctx.globalAlpha=.10;ctx.strokeStyle='#a8863a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2,150,0,Math.PI*2);ctx.stroke();ctx.setLineDash([10,14]);ctx.beginPath();ctx.arc(W/2,H/2,118,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let k=0;k<8;k++){const a=k*Math.PI/4;pxRect(W/2+Math.cos(a)*134-2,H/2+Math.sin(a)*134-2,4,4,'#a8863a');}ctx.restore();}
 // 墙边火把：场景装饰兼动态光源
 game._torches=[];[[24,140],[24,H-170],[W-24,140],[W-24,H-170]].forEach(([tx,ty],i)=>{const j=Math.floor(hash2(i,77,ch)*10)-5,x=tx+j,y=ty;game._torches.push({x,y:y-16,c:i%2?'190,160,110':'255,190,120'});pxRect(x-2,y-12,4,14,'#3a3128');pxRect(x-3,y-14,6,3,'#5a4a38');const fl=Math.sin(game.elapsed*9+i*2.1)>0;pxRect(x-1,y-18+(fl?1:0),3,4,fl?'#ffb347':'#ff8c42');pxRect(x,y-19,1,2,'#ffe9a8');});
 // 场地边缘做成不规则暗墙，强化“房间”而不是无限网格。
 for(let x=0;x<W;x+=32){const d=8+Math.floor(hash2(x>>5,3,ch)*20);pxRect(x,0,32,d,'rgba(0,0,0,.42)');const d2=9+Math.floor(hash2(x>>5,9,ch)*18);pxRect(x,H-d2,32,d2,'rgba(0,0,0,.32)');}
 // V12 细节层：细石粒 + 章节色微光斑。全部在烘焙阶段画进离屏画布，每帧成本仍是 0
 for(let i=0;i<120;i++){const h1=hash2(i,211,ch*11+1),h2=hash2(i,223,ch*11+2),h3=hash2(i,227,ch*11+3);
  pxRect(10+h1*(W-20),20+h2*(H-40),1+((h3*2)|0),1+((h1*2)|0),h3>.5?'rgba(0,0,0,.18)':'rgba(214,208,200,.05)');}
 for(let i=0;i<7;i++){const h1=hash2(i,233,ch*13+5),h2=hash2(i,239,ch*13+6);
  ctx.globalAlpha=.05;glowSpot(60+h1*(W-120),80+h2*(H-160),70+h1*90,'168,134,58',.5);ctx.globalAlpha=1;}
 const g=ctx.createRadialGradient(W/2,H/2,80,W/2,H/2,720);g.addColorStop(0,'rgba(214,208,200,.10)');g.addColorStop(.55,'rgba(20,20,20,.07)');g.addColorStop(1,'rgba(0,0,0,.66)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
const DROP_QC={common:'#707070',uncommon:'#467a46',rare:'#3e5870',epic:'#6b3fa0',legendary:'#a8863a'};
// 地面预警类特效画在角色之下、光照之前；其余发光特效走 drawFxLayer
const GROUND_FX={telegraph:1,danger:1,rain:1,trap:1,charge:1,meteorMark:1};
// ---- 地面残留层：灼痕/划痕/霜环/尘土，独立于 effects，随关卡切换清空（上限 8/5/2）----
function decalCap(){const q=save.settings.quality;return q==='low'?2:q==='medium'?5:8;}
function addDecal(type,x,y,r,a){
 if(save.settings.decals===false)return;
 game.decals.push({type,x,y,r,a:a??1,t:0,life:type==='scorch'?3.4:type==='frost'?2.0:type==='slash'?1.4:1.1,seed:Math.random()*10});
 while(game.decals.length>decalCap())game.decals.shift();
}
function updateDecals(dt){for(let i=game.decals.length-1;i>=0;i--){const d=game.decals[i];d.t+=dt;if(d.t>=d.life)game.decals.splice(i,1);}}
function drawDecals(){
 for(let i=0;i<game.decals.length;i++){
  const d=game.decals[i],k=clamp(1-d.t/d.life,0,1);ctx.globalAlpha=k*(d.a||1);
  if(d.type==='scorch'){
   for(let j=0;j<5;j++){const sd=frand(j*3.3+d.seed),ang=j*1.256+sd,r=d.r*.42*sd,px2=d.x+Math.cos(ang)*r,py2=d.y+Math.sin(ang)*r*.6;
    polyFill([[px2-8,py2-3],[px2+7,py2-4],[px2+9,py2+4],[px2-6,py2+3]],'#241412');}
   ctx.globalAlpha=k*.55;ctx.strokeStyle='#ff5a20';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(d.x,d.y,d.r*.5,d.r*.3,0,0,7);ctx.stroke();
  } else if(d.type==='slash'){
   ctx.strokeStyle='#a8863a';ctx.lineWidth=2;
   for(let j=-1;j<=1;j++){ctx.beginPath();ctx.moveTo(d.x-d.r*.4,d.y+j*6);ctx.lineTo(d.x+d.r*.4,d.y+j*6-3);ctx.stroke();}
  } else if(d.type==='frost'){
   ctx.strokeStyle='#8fd6ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(d.x,d.y,d.r*.8,d.r*.45,0,0,7);ctx.stroke();
   for(let j=0;j<6;j++){const ang=j*1.047+d.seed,cx2=d.x+Math.cos(ang)*d.r*.55,cy2=d.y+Math.sin(ang)*d.r*.33;
    polyFill([[cx2,cy2],[cx2+4,cy2-5],[cx2+5,cy2+2]],'#8fd6ff');}
  } else {
   ctx.fillStyle='#8fa4bc';ctx.beginPath();ctx.ellipse(d.x,d.y,d.r,d.r*.42,0,0,7);ctx.fill();
  }
 }
 ctx.globalAlpha=1;
}
// ---- V12 通道：结构走 World（被光照压暗＝正确）｜前景柱在角色之后｜发光走 FxLayer ----
function portalGrowK(){return game.state==='portal_grow'?easeOut(clamp(1-game.clearT/GROW_T,0,1)):1;}
// 提示元件只有两个：屏幕边缘箭头（>400px）与本体脉冲（≤400px）。一次分档，不写三套绘制
function portalTier(){const po=game.portal,p=game.player;if(!po||!p)return 2;const dx=po.x-p.x,dy=po.y-p.y,d2=dx*dx+dy*dy;return d2>160000?2:d2>po.r*po.r?1:0;}
function drawPortalBase(){
 const po=game.portal;if(!po)return;
 const q=save.settings.quality,sy=portalGrowK(),ph=game.elapsed,push=44*easeOut(po.openK||0);
 ctx.save();ctx.translate(Math.round(po.x),Math.round(po.y));
 pxRect(-44,-4,88,7,'rgba(0,0,0,.45)');
 if(po.type==='trapdoor'){
  const h=56*sy;pxRect(-48,-h,96,h,'#0d0b12');
  const steps=q==='low'?4:6;
  for(let i=0;i<steps;i++){const y=-12-i*8;if(y<-h)break;pxRect(-48,y-6,96,6,i%2?'#241f28':'#2e2833');pxRect(-48,y-7,96,1,'#463d4a');}
  if(q!=='low')for(let i=0;i<3;i++){const y=-16-i*13;if(y<-h)break;pxRect(-34,y,68,1,'#6a90b8');}
  ctx.strokeStyle='#3a3340';ctx.lineWidth=4;ctx.strokeRect(-48,-h,96,h);
  ctx.strokeStyle='#5a5060';ctx.lineWidth=1;ctx.strokeRect(-50,-h-2,100,h+4);
 } else if(po.type==='stone_door'){
  const h=140*sy;
  pxRect(-60,-h,120,h,'#38312a');ctx.strokeStyle='#6b5c46';ctx.lineWidth=1;ctx.strokeRect(-60,-h,120,h);
  pxRect(-56-push,-h+6,52,Math.max(0,h-16),'#4a3b2c');pxRect(4+push,-h+6,52,Math.max(0,h-16),'#4a3b2c');
  if(q!=='low')for(let k=0;k<4;k++){pxRect(-52-push+k*13,-h+8,1,Math.max(0,h-20),'#3a2e22');pxRect(6+push+k*13,-h+8,1,Math.max(0,h-20),'#3a2e22');}
  pxRect(-56,-10,112,8,'#5a4a38');pxRect(-56,-10,112,1,'#7a6650');
  if(q!=='low'){ctx.fillStyle='#6b5c46';for(let r=0;r<3;r++){pxRect(-48-push,-h+22+r*22,3,3);pxRect(-4-push,-h+22+r*22,3,3);pxRect(-8+push,-h+22+r*22,3,3);pxRect(38+push,-h+22+r*22,3,3);}}
 } else {
  const w=8+36*sy,h=150*sy,pts=[];
  for(let i=0;i<=8;i++){const yy=-h+(h/8)*i,wob=1+.5*Math.sin(i*1.7+ph*2);pts.push([Math.round((i%2?1:-1)*w*.55*wob),Math.round(yy)]);}
  pts.push([w,-2]);pts.push([-w,-2]);
  // 吸光暗环画在 World 层：随后被 multiply 再压一次，天然比周围更黑
  if(q!=='low'){ctx.globalAlpha=.5;glowSpot(0,-60,70,'5,3,8',.55);ctx.globalAlpha=1;}
  polyFill(pts,'#050308');polyStroke(pts,'#8a4fd0',2,true);
  const pts2=pts.map(([x,y])=>[Math.round(x*.62),Math.round(y*.96)]);
  polyFill(pts2,'rgba(58,31,82,.90)');polyStroke(pts2,'#ca8afa',3,false);
 }
 ctx.restore();
}
// 前景柱：只画在角色之后，且只在 portal_ready 之后 —— 生长中途画会"门没长完柱子先压人"
function drawPortalFront(){
 const po=game.portal;if(!po||game.state!=='portal_ready'||po.type==='rift')return;
 ctx.save();ctx.translate(Math.round(po.x),Math.round(po.y));
 if(po.type==='trapdoor'){
  pxRect(-48,-56,6,56,'#3a3340');pxRect(42,-56,6,56,'#3a3340');
  pxRect(-48,-56,6,2,'#5a5060');pxRect(42,-56,6,2,'#5a5060');
 } else {
  pxRect(-60,-140,8,140,'#4a4034');pxRect(52,-140,8,140,'#4a4034');
  pxRect(-60,-140,8,2,'#7a6650');pxRect(52,-140,8,2,'#7a6650');
 }
 ctx.restore();
}
// 屏幕边缘金色大箭头：锚点 >400px 时唯一的指路元件（不做地面小箭头，脉冲已足够）
// 注意：内缩框避让 HUD —— 底边内缩 158px，否则朝下的箭头会正好被技能托盘盖住
function drawPortalArrow(po){
 const p=game.player;if(!p)return;
 const padL=60,padR=W-60,padT=60,padB=H-158;
 // 起点用玩家而不是屏幕中心：中心射线在玩家偏离中心时会和真实方位差出几十度（这就是上一版指错的根因）
 const ox=clamp(p.x,padL,padR),oy=clamp(p.y,padT,padB);
 const dxp=po.x-ox,dyp=po.y-oy,dp=Math.hypot(dxp,dyp)||1;
 const ca=dxp/dp,sa=dyp/dp;
 const tx=ca>1e-4?(padR-ox)/ca:ca<-1e-4?(padL-ox)/ca:1e9;
 const ty=sa>1e-4?(padB-oy)/sa:sa<-1e-4?(padT-oy)/sa:1e9;
 // 锚点还在屏内时不要让箭头越过它：停在门前 58px，箭头才永远指向门而不是从门后面回指
 let t=Math.max(0,Math.min(tx,ty));
 t=Math.min(t,Math.max(58,dp-58));
 let ex=clamp(ox+ca*t,padL,padR),ey=clamp(oy+sa*t,padT,padB);
 // HUD 安全区：命中三个面板就沿边滑出（滑移后必须重算角度，否则指针会指错）
 if(ex>W-206&&ey<232)ey=232;
 if(ex<414&&ey<152)ey=152;
 if(ey>H-112&&ex>372&&ex<906)ey=H-176;
 if(ey<86&&ex>372&&ex<906)ey=86;
 const ang2=Math.atan2(po.y-ey,po.x-ex);
 const pu=.55+.45*Math.sin(game.elapsed*4);
 ctx.save();ctx.translate(ex,ey);ctx.rotate(ang2);
 // 先垫一层深色底盘：箭头可能落在明亮的地面特效上，没有底盘会读不清
 polyFill([[26,0],[-11,-17],[-5,0],[-11,17]],'rgba(0,0,0,.55)');
 glowSpot(0,0,58,'255,210,100',.26*pu);
 polyFill([[22,0],[-9,-14],[-3,0],[-9,14]],`rgba(255,215,0,${.62+.28*pu})`);
 polyStroke([[22,0],[-9,-14],[-3,0],[-9,14]],'#fff8e8',1.5,true);
 ctx.restore();
}
function drawPortalGlow(){
 const po=game.portal;if(!po)return;
 const q=save.settings.quality,sy=portalGrowK(),pulse=.5+.5*Math.sin(game.elapsed*2.2);
 ctx.save();ctx.translate(Math.round(po.x),Math.round(po.y));
 if(po.type==='trapdoor'){
  glowSpot(0,-34*sy,62*sy,'90,150,220',.30+.08*pulse);
  if(q!=='low')for(let i=0;i<7;i++){const ph2=(game.elapsed*24+i*7)%56;ctx.globalAlpha=.10+.22*frand(i*3.1);pxRect(-44+i*14,-14-ph2*sy,2,12+ph2*.2,'#5a8ac8');}
 } else if(po.type==='stone_door'){
  glowSpot(0,-74*sy,58*sy,'255,210,120',.34+.12*pulse);
  pxRect(-3,-134*sy,6,118*sy,`rgba(255,210,122,${.22+.45*pulse})`);
  for(let k=0;k<5;k++){const on=((game.elapsed*.32+k*.2)%1)>.5;pxRect(-24+k*12,-132*sy,4,4,on?'#a8863a':'#4a3a22');}
 } else {
  glowSpot(0,-60,130*sy,'180,110,255',.40+.10*pulse);
  if(q!=='low'){
   for(let i=0;i<14;i++){const sd=frand(i*7.7),yy=-140*sy+(game.elapsed*26+sd*150)%150;ctx.globalAlpha=clamp(.35*(1-(yy+150)/150),0,1);pxRect((sd>.5?1:-1)*(12+sd*16),yy,2,2,'#b06aff');}
   ctx.globalAlpha=.18;for(let i=0;i<8;i++){const a=game.elapsed*.4+i*.785;pxLine(0,-60,Math.cos(a)*(30+frand(i)*24),-60+Math.sin(a)*(30+frand(i)*24),'#8a4fd0',1.5);}
  }
 }
 ctx.globalAlpha=1;ctx.restore();
 // 生长期间：只有本体 + 灰罩（表示暂不可用），不画脉冲/箭头/[E]
 const veil=(col)=>{const h=po.type==='trapdoor'?58:po.type==='stone_door'?142:152;pxRect(po.x-(po.type==='trapdoor'?50:60),po.y-h,po.type==='trapdoor'?100:120,h,col);};
 if(game.state==='portal_grow'){veil('rgba(120,120,130,.34)');return;}
 // 面板打开（paused）：门还在发光会抢面板的注意力，叠一层深色罩，两个提示元件都不画
 if(game.state==='portal_ready'&&game.paused){veil('rgba(10,10,12,.42)');return;}
 if(game.state!=='portal_ready')return;
 const tier=portalTier();
 if(tier===2){drawPortalArrow(po);return;}
 // 中间档把脉冲画响：46~400px 是玩家最常停留的区间，原参数太弱会让人以为通道没开
 const prm=tier===1?{rx:52,peak:.70,period:.9,outer:.34}:{rx:46,peak:.55,period:1.2,outer:.22};
 const al=prm.peak*(.75+.25*Math.sin(game.elapsed*Math.PI*2/prm.period));
 ctx.save();ctx.translate(Math.round(po.x),Math.round(po.y));
 ctx.globalAlpha=clamp(al,0,1);ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
 ctx.beginPath();ctx.ellipse(0,0,prm.rx,prm.rx*.36,0,0,7);ctx.stroke();
 if(q!=='low'){ctx.globalAlpha=clamp(al*prm.outer/(prm.peak||1),0,1);ctx.beginPath();ctx.ellipse(0,0,prm.rx+10,(prm.rx+10)*.36,0,0,7);ctx.stroke();}
 ctx.globalAlpha=1;ctx.restore();
}
function drawOrbs(){
 const n=hexOf('orbN');if(!n||!game.player)return;
 const p=game.player;
 for(let k=0;k<n;k++){
  const a=game.elapsed*1.6+k*Math.PI*2/n,x=p.x+Math.cos(a)*58,y=p.y-12+Math.sin(a)*58*.62;
  glowSpot(x,y,18,'150,215,255',.40);
  const pts=[];for(let j=0;j<6;j++){const ang=a+j*Math.PI/3;pts.push([x+Math.cos(ang)*6,y+Math.sin(ang)*6]);}
  polyFill(pts,'rgba(216,244,255,.85)');polyStroke(pts,'#fff8e8',1.2,true);
 }
}
// 通道分两层：结构走 World（被光照压暗＝正确），发光走 FxLayer（不被压暗）。统一入口便于按层调用
function drawPortal(layer){if(layer==='glow')drawPortalGlow();else if(layer==='front')drawPortalFront();else drawPortalBase();}
function drawWorld(){
 drawDecals();
 for(let i=0;i<game.drops.length;i++){const d=game.drops[i];if(!onScreen(d.x,d.y))continue;const bobY=Math.round(Math.sin(game.elapsed*3+d.x*.1)*2);
  if(d.type==='gold'){pxRect(d.x-5,d.y-5+bobY,10,10,'#a8863a');pxRect(d.x-2,d.y-7+bobY,4,2,'#d6d0c8');pxRect(d.x-3,d.y-3+bobY,3,3,'#ffd700');}
  else{const qc=DROP_QC[d.item.q]||'#707070';ctx.globalAlpha=.14+.05*Math.sin(game.elapsed*4+d.x);pxRect(d.x-6,d.y-52,12,48,qc);ctx.globalAlpha=1;pxRect(d.x-8,d.y-8+bobY,16,16,'#1b1b1b');ctx.strokeStyle=qc;ctx.lineWidth=2;ctx.strokeRect(d.x-8,d.y-8+bobY,16,16);pxRect(d.x-2,d.y-5+bobY,4,10,'#d6d0c8');}}
 drawPortal('base');
 for(let i=0;i<game.props.length;i++){const pr=game.props[i];if(onScreen(pr.x,pr.y))drawProp(pr);}
 for(let i=0;i<game.effects.length;i++){const e=game.effects[i];if(GROUND_FX[e.type])drawEffect(e);}
 // 屏幕外实体只跳过绘制（逻辑照跑），省下 drawImage 与矢量构造
 for(let i=0;i<game.enemies.length;i++){const e=game.enemies[i];if(onScreen(e.x,e.y,e.isBoss?140:80))drawEnemy(e);}
 drawPlayer(game.player);
 // 前景柱压住角色：只有把门画在角色之后，进门才有纵深
 drawPortal('front');
}
// 发光层：在光照合成之后绘制，不再被 multiply 压暗 —— 刀光/冰锥/陨石/弹道/粒子才有真正的"发光"观感
function drawFxLayer(){
 drawPortal('glow');
 drawOrbs();
 for(let i=0;i<game.effects.length;i++){const e=game.effects[i];if(!GROUND_FX[e.type])drawEffect(e);}
 for(let i=0;i<game.effects.length;i++){const e=game.effects[i];if(e.type==='rain')drawRainArrows(e);}
 drawFrozenOverlays();
 for(let i=0;i<game.projectiles.length;i++){const q=game.projectiles[i];if(onScreen(q.x,q.y,40))drawProjectile(q);}
 for(let i=0;i<game.enemyProjectiles.length;i++){const q=game.enemyProjectiles[i];if(onScreen(q.x,q.y,40))drawEnemyProjectile(q);}
 drawParticles();for(const f of game.floats){ctx.globalAlpha=clamp(f.t*1.4,0,1);ctx.font=f.crit?'bold 20px monospace':'bold 15px monospace';ctx.textAlign='center';ctx.fillStyle='#000';ctx.fillText(f.text,f.x+2,f.y+2);ctx.fillStyle=f.hurt?'#ff6b5a':f.crit?'#ffd700':f.gold?'#ffd700':'#d6d0c8';ctx.fillText(f.text,f.x,f.y);ctx.globalAlpha=1;}}
// 箭雨箭矢：落点在上层（不被光照压暗），每支箭带箭杆/箭簇/尾羽与落地尘
function drawRainArrows(e){
 const R=e.r,nw=performance.now();
 ctx.save();ctx.lineCap='round';
 for(let i=0;i<13;i++){
  const sd=frand(i*7.7),sd2=frand(i*17.3);
  const ox=((i*53)%97)/97*R*2-R+(sd-.5)*12;
  const top=e.y-R*.72,bot=e.y+R*.72;
  const span=bot-top;
  const cyc=(nw*.0014+sd)%1;
  const ay=top-span*.85+cyc*span*1.9;
  if(ay<e.y-R*.80||ay>e.y+R*.80)continue;
  const dx=-7*sd2-4,dy=15;
  ctx.globalAlpha=.30;ctx.fillStyle='rgba(206,224,255,.30)';
  ctx.beginPath();ctx.ellipse(e.x+ox,ay+3,4+sd*3,2+sd*2,0,0,7);ctx.fill();
  ctx.globalAlpha=.90;
  ctx.strokeStyle='#6f5230';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(e.x+ox,ay);ctx.lineTo(e.x+ox-dx,ay-dy);ctx.stroke();
  ctx.strokeStyle='#e8e2d6';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(e.x+ox+dx*.85,ay+dy*.85);ctx.lineTo(e.x+ox-dx*.15,ay-dy*.15);ctx.stroke();
  polyFill([[e.x+ox,ay],[e.x+ox-3,ay-7],[e.x+ox+3,ay-7]],'#e8e2d6');
  ctx.globalAlpha=.60;
  polyFill([[e.x+ox-dx,ay-dy],[e.x+ox-dx+4,ay-dy-3],[e.x+ox-dx-4,ay-dy-3]],'#c8a05a');
  if(ay>e.y+R*.55){
   ctx.globalAlpha=(ay-(e.y+R*.55))/(R*.25)*.7;
   ctx.strokeStyle='#d6e6ff';ctx.lineWidth=1.4;
   ctx.beginPath();ctx.arc(e.x+ox,ay+4,4+sd*5,0,7);ctx.stroke();
  }
 }
 ctx.globalAlpha=1;ctx.restore();
}
// 弹道重绘：拖尾 + 核心 + 高光，取代原来的纯色方块
function drawProjectile(q){
 const ang=Math.atan2(q.vy,q.vx),ca=Math.cos(ang),sa=Math.sin(ang);
 ctx.lineCap='round';
 if(q.type==='magic'){
  const pu=.5+.5*Math.sin(game.elapsed*14);
  glowSpot(q.x,q.y,q.r*3.4,'150,90,235',.26+pu*.14);
  ctx.globalAlpha=.22;ctx.strokeStyle='#8a4fd0';ctx.lineWidth=q.r*2.4;
  ctx.beginPath();ctx.moveTo(q.x-ca*q.r*3.2,q.y-sa*q.r*3.2);ctx.lineTo(q.x,q.y);ctx.stroke();
  ctx.globalAlpha=.55;ctx.strokeStyle='#b06aff';ctx.lineWidth=q.r*1.2;
  ctx.beginPath();ctx.moveTo(q.x-ca*q.r*2.6,q.y-sa*q.r*2.6);ctx.lineTo(q.x,q.y);ctx.stroke();
  ctx.globalAlpha=1;
  ctx.fillStyle='#6b3fa0';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,7);ctx.fill();
  ctx.fillStyle='#b070e8';ctx.beginPath();ctx.arc(q.x,q.y,q.r*.70,0,7);ctx.fill();
  ctx.fillStyle='#f0dcff';ctx.beginPath();ctx.arc(q.x-q.r*.2,q.y-q.r*.2,q.r*.34,0,7);ctx.fill();
  for(let k=0;k<3;k++){const a=game.elapsed*7+k*2.09;ctx.fillStyle='#ca8afa';ctx.beginPath();ctx.arc(q.x+Math.cos(a)*q.r*1.75,q.y+Math.sin(a)*q.r*1.75,1.4,0,7);ctx.fill();}
 } else if(q.type==='arrow'){
  ctx.globalAlpha=.26;ctx.strokeStyle='#ffe6b0';ctx.lineWidth=4.5;
  ctx.beginPath();ctx.moveTo(q.x-ca*q.r*4.6,q.y-sa*q.r*4.6);ctx.lineTo(q.x-ca*q.r*.5,q.y-sa*q.r*.5);ctx.stroke();
  ctx.globalAlpha=1;
  ctx.strokeStyle='#7a5a34';ctx.lineWidth=2.2;
  ctx.beginPath();ctx.moveTo(q.x-ca*q.r*1.9,q.y-sa*q.r*1.9);ctx.lineTo(q.x+ca*q.r*1.2,q.y+sa*q.r*1.2);ctx.stroke();
  ctx.strokeStyle='#a8863a';ctx.lineWidth=.9;
  ctx.beginPath();ctx.moveTo(q.x-ca*q.r*1.9,q.y-sa*q.r*1.9);ctx.lineTo(q.x+ca*q.r*1.2,q.y+sa*q.r*1.2);ctx.stroke();
  polyFill([[q.x-ca*q.r*1.9-sa*3.2,q.y-sa*q.r*1.9+ca*3.2],[q.x-ca*q.r*1.9+sa*3.2,q.y-sa*q.r*1.9-ca*3.2],[q.x-ca*q.r*3.6,q.y-sa*q.r*3.6]],'#c8a05a');
  polyFill([[q.x+ca*q.r*2.6,q.y+sa*q.r*2.6],[q.x+ca*q.r*.7-sa*2.8,q.y+sa*q.r*.7+ca*2.8],[q.x+ca*q.r*.7+sa*2.8,q.y+sa*q.r*.7-ca*2.8]],'#e8e2d6');
  glowSpot(q.x+ca*q.r*2,q.y+sa*q.r*2,7,'255,236,190',.30);
 } else if(q.type==='npc'){
  glowSpot(q.x,q.y,q.r*3,'120,200,255',.32);
  ctx.fillStyle='#3f7fd0';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,7);ctx.fill();
  ctx.fillStyle='#9fd8ff';ctx.beginPath();ctx.arc(q.x,q.y,q.r*.55,0,7);ctx.fill();
 } else {
  glowSpot(q.x,q.y,q.r*2.8,'200,150,70',.34);
  ctx.fillStyle='#a8863a';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,7);ctx.fill();
  ctx.fillStyle='#ffd76a';ctx.beginPath();ctx.arc(q.x,q.y,q.r*.58,0,7);ctx.fill();
 }
 ctx.lineCap='butt';
}
function drawEnemyProjectile(q){
 const rgb=q.type==='boss'?'255,80,58':(q.type==='arrow'?'210,170,120':'160,90,220');
 const ang=Math.atan2(q.vy,q.vx);
 glowSpot(q.x,q.y,q.r*2.6,rgb,.36);
 if(q.type==='arrow'){
  ctx.strokeStyle='#7a5a34';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(q.x-Math.cos(ang)*q.r*1.8,q.y-Math.sin(ang)*q.r*1.8);ctx.lineTo(q.x+Math.cos(ang)*q.r*1.4,q.y+Math.sin(ang)*q.r*1.4);ctx.stroke();
  polyFill([[q.x+Math.cos(ang)*q.r*2.6,q.y+Math.sin(ang)*q.r*2.6],[q.x+Math.cos(ang)*q.r*.8-Math.sin(ang)*2.4,q.y+Math.sin(ang)*q.r*.8+Math.cos(ang)*2.4],[q.x+Math.cos(ang)*q.r*.8+Math.sin(ang)*2.4,q.y+Math.sin(ang)*q.r*.8-Math.cos(ang)*2.4]],'#e0d8c8');
 }else{
  ctx.fillStyle=q.type==='boss'?'#a11f1f':'#6b3fa0';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,7);ctx.fill();
  ctx.fillStyle=q.type==='boss'?'#ff8a6a':'#c08ae8';ctx.beginPath();ctx.arc(q.x,q.y,q.r*.55,0,7);ctx.fill();
 }
}
// 冻结包裹：敌人被冰封时覆盖一层半透明冰壳 + 冰刺
function drawFrozenOverlays(){
 for(const e of game.enemies){
  if(!(e.frozen>0))continue;
  const a=clamp(e.frozen/1.2,0,1),hw=e.r*1.06,ht=e.r*1.34,cy0=e.y-e.r*.32;
  ctx.globalAlpha=.46*a;ctx.fillStyle='rgba(128,198,255,.52)';
  ctx.fillRect(e.x-hw,cy0-ht,hw*2,ht*2);
  ctx.globalAlpha=.40*a;ctx.fillStyle='rgba(238,251,255,.55)';
  ctx.beginPath();ctx.moveTo(e.x-hw,cy0-ht);ctx.lineTo(e.x-hw*.1,cy0-ht);ctx.lineTo(e.x+hw*.55,cy0+ht);ctx.lineTo(e.x-hw,cy0+ht);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(e.x+hw,cy0-ht);ctx.lineTo(e.x+hw,cy0-ht*.15);ctx.lineTo(e.x+hw*.3,cy0+ht);ctx.lineTo(e.x+hw*.02,cy0+ht);ctx.closePath();ctx.fill();
  ctx.globalAlpha=.55*a;ctx.strokeStyle='#bfe6ff';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(e.x-hw*.1,cy0-ht);ctx.lineTo(e.x+hw*.55,cy0+ht);ctx.stroke();
  ctx.globalAlpha=.9*a;ctx.strokeStyle='#ecfaff';ctx.lineWidth=1.3;
  ctx.strokeRect(e.x-hw,cy0-ht,hw*2,ht*2);
  ctx.globalAlpha=a;
  for(let k=0;k<4;k++){const bx=e.x-hw*.8+k*hw*.55,hh2=6+((k*7)%10);
   polyFill([[bx,cy0-ht],[bx+4.5,cy0-ht],[bx+2.2,cy0-ht-hh2]],'rgba(205,242,255,.92)');}
  glowSpot(e.x,cy0-ht*.3,e.r*1.8,'150,215,255',.22*a);
  ctx.globalAlpha=1;
 }
}
function drawProp(pr){const bob=Math.sin(game.elapsed*2.5+pr.seed)*1.5;const shiver=(!pr.used&&pr.type==='chest'&&Math.sin(game.elapsed*18+pr.seed)>.97)?1:0;ctx.save();ctx.translate(Math.round(pr.x+shiver),Math.round(pr.y+(pr.used?0:bob*.4)));
 pxRect(-13,2,26,5,'rgba(0,0,0,.45)');
 if(pr.type==='chest'){const open=pr.used;pxRect(-11,-10,22,14,'#5a3a22');pxRect(-11,-10,22,3,'#6b4a2e');pxRect(-11,-2,22,2,'#3a2515');pxRect(-2,-6,4,5,'#ffd700');pxRect(-3,-6,1,5,'#a8863a');pxRect(2,-6,1,5,'#a8863a');if(open){pxRect(-11,-18,22,8,'#6b4a2e');pxRect(-11,-18,22,2,'#8a6a42');pxRect(-2,-16,4,3,'#2a1a0e');}else{pxRect(-11,-13,22,3,'#7a5a36');}
  if(!pr.used&&Math.floor(performance.now()/400)%2){pxRect(-14,-14,2,2,'#ffd700');pxRect(12,-8,2,2,'#ffd700');}}
 if(pr.type==='altar'){pxRect(-12,-4,24,8,'#3a3642');pxRect(-9,-12,18,8,'#4a4656');pxRect(-3,-20,6,8,'#6b3fa0');pxRect(-2,-22,4,3,'#9a5aca');pxRect(-10,-11,4,2,'#9a5aca');pxRect(6,-11,4,2,'#9a5aca');}
 if(pr.type==='blood'){pxRect(-12,-4,24,8,'#3a2226');pxRect(-9,-12,18,8,'#4a2a30');pxRect(-2,-18,4,6,'#a11f1f');pxRect(-1,-22,2,4,'#d6d0c8');const pulse=Math.floor(performance.now()/300)%2;pxRect(-8,-3,16,3,pulse?'#a11f1f':'#7a1616');}
 if(pr.type==='statue'){pxRect(-8,-24,16,10,'#c8c2b8');pxRect(-5,-14,10,12,'#b8b2a8');pxRect(-10,-2,20,4,'#a8a298');pxRect(-4,-22,3,3,'#8a847a');pxRect(1,-22,3,3,'#8a847a');pxRect(-2,-18,4,2,'#8a847a');}
 if(pr.type==='smith'){pxRect(-7,-20,14,20,'#467a46');pxRect(-5,-26,10,7,'#d6b088');pxRect(-9,-14,4,10,'#386038');pxRect(5,-14,4,10,'#386038');pxRect(6,-22,8,3,'#5a4a38');pxRect(12,-22,3,4,'#707070');ctx.fillStyle='#d6d0c8';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('铁匠',0,-30);if(pr.life<5&&Math.floor(performance.now()/300)%2){ctx.globalAlpha=.7;}}
 ctx.restore();}
function drawPlayer(p){const aim=Math.atan2(game.mouse.y-p.y,game.mouse.x-p.x);ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));
 // 进门演出用 enterAlpha 整只淡出：这里统一下调 alpha，内部几处闪白/光环也跟着乘
 const EA=p.enterAlpha??1;ctx.globalAlpha=EA;
 // 职业色脚下光晕：让主角从暗色地面里"浮"出来
 const gc=game.classId==='mage'?'154,90,220':game.classId==='hunter'?'110,160,220':'220,170,90';
 const g=ctx.createRadialGradient(0,24,4,0,24,44);g.addColorStop(0,`rgba(${gc},.40)`);g.addColorStop(1,`rgba(${gc},0)`);ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.fillRect(-44,-20,88,88);ctx.globalCompositeOperation='source-over';
 // 更大的接地阴影与角色环，让 48×64 原生像素人物在 720p 场景里更有存在感。
 pxRect(-22,20,44,6,'rgba(0,0,0,.55)');pxRect(-14,24,28,3,'rgba(0,0,0,.42)');ctx.strokeStyle='rgba(168,134,58,.28)';ctx.lineWidth=2;ctx.strokeRect(-20,16,40,12);
 let action='idle';if(p.hitStun>0)action='hit';else if(p.animSkillT>0)action=p.animAction;else if(p.animAttackT>0)action='attack';else if(game.keys.KeyW||game.keys.KeyA||game.keys.KeyS||game.keys.KeyD)action='walk';
 const bobY=action==='idle'?Math.round(Math.sin(game.elapsed*2.6)*1.5):action==='walk'?-Math.round(Math.abs(Math.sin(game.elapsed*11))*2):0;
 const frames=CHAR_ACTIONS[action]||6,row=dir8FromAngle(action==='walk'?(p.faceAngle??aim):aim),key=`char:${game.classId}:${action}`;
 // 挥砍时身体前倾扭转 → 动作有重量感
 const sw=p.swing,swq=sw?clamp(1-sw.t/sw.maxT,0,1):0;
 const lean=sw?Math.sin(swq*Math.PI)*.12*(sw.dir||1):0;
 ctx.save();ctx.rotate(lean);
 if(!drawAnimSheet(key,48,64,frames,row,-30,-56+bobY,60,80,10,0)){pxRect(-11,-19,22,31,game.classId==='mage'?'#1b1b1b':'#303030');pxRect(-9,-24,18,9,game.classId==='knight'?'#707070':'#303030');}
 // 武器完全由角色贴图自带（骑士长剑 / 猎人弓 / 法师法杖），此处不再叠加第二把
 ctx.restore();
 if((p.hitFlash>0||p.invuln>0)&&Math.floor(performance.now()/50)%2===0){ctx.globalAlpha=.32*EA;pxRect(-24,-56+bobY,48,80,'#d6d0c8');ctx.globalAlpha=EA;}
 // 暴走光环：连击≥30 时显示
 if(game.combo>=30){ctx.globalAlpha=.5*EA;ctx.setLineDash([6,8]);ctx.strokeStyle='#ff9a3c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,6,30,game.elapsed*3,game.elapsed*3+Math.PI*1.6);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=EA;}
 // 冰霜减速指示
 if(p.slow>0){ctx.globalAlpha=.55*EA;ctx.strokeStyle='#9bdcff';ctx.lineWidth=2;ctx.strokeRect(-18,-24,36,48);}ctx.restore();}
const AFFIX_COLOR={'加速':'#ffb347','吸血':'#ff5a4a','护盾':'#5a90d0','爆炸':'#ff8c00','分裂':'#b06aff','冰霜':'#9bdcff','宝箱怪':'#ffd700'};
function drawEnemy(e){const ch=e.ch,dx=game.player?game.player.x-e.x:0,dy=game.player?game.player.y-e.y:1,row=dir8FromAngle(Math.atan2(dy,dx));ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));if(e.animAttackT>0&&!e.isBoss){const wind=clamp(e.animAttackT/.4,0,1);ctx.scale(1+.12*wind,1-.16*wind);ctx.translate(0,e.r*.12*wind);}pxRect(-e.r*.9,e.r*.62,e.r*1.8,5,'rgba(0,0,0,.5)');let drawn=false;
 if(e.isBoss){const bid=BOSS_IDS[ch],ph=(e.visualPhase||e.phase)>1?2:1,sz=ch>=3?128:96;drawn=drawAnimSheet(`boss:${bid}:${ph}`,sz,sz,6,row,-sz*.58,-sz*.78,sz*1.16,sz*1.16,8,e.animSeed||0);}
 else{const mid=MONSTER_IDS[ch],action=e.hitStun>0?'hit':e.animAttackT>0?'attack':'walk',frames={idle:4,walk:6,attack:5,hit:2,death:6}[action],sz=ch===3?64:48;drawn=drawAnimSheet(`mon:${mid}:${action}`,sz,sz,frames,row,-sz*.56,-sz*.76,sz*1.12,sz*1.12,9,e.animSeed||0);}
 if(!drawn)pxRect(-e.r*.55,-e.r*.55,e.r*1.1,e.r*1.35,ch===2?'#1b1b1b':ch===3?'#707070':'#303030');if(e.hitFlash>0&&Math.floor(performance.now()/35)%2===0){ctx.globalAlpha=.62;pxRect(-e.r,-e.r*1.25,e.r*2,e.r*2.4,'#ffffff');ctx.globalAlpha=1;}
 if(e.isElite){ctx.globalAlpha=.5+.4*Math.sin(performance.now()*.006+(e.animSeed||0));ctx.strokeStyle='#ffd700';ctx.lineWidth=2;ctx.strokeRect(-e.r-2,-e.r-2,e.r*2+4,e.r*2+4);ctx.globalAlpha=1;}if(e.affix){ctx.strokeStyle=AFFIX_COLOR[e.affix]||'#5a90d0';ctx.strokeRect(-e.r-5,-e.r-5,e.r*2+10,e.r*2+10);}ctx.restore();
 if(!e.isBoss){const w=e.isElite?64:48,x=e.x-w/2,y=e.y-e.r*1.35-18;pxRect(x,y,w,6,'#1b1b1b');pxRect(x,y,w*clamp(e.hp/e.maxHp,0,1),6,'#a11f1f');ctx.strokeStyle='#707070';ctx.strokeRect(x,y,w,6);if(e.maxShield)pxRect(x,y-5,w*clamp(e.shield/e.maxShield,0,1),3,'#3e5870');if(e.affix){ctx.fillStyle=AFFIX_COLOR[e.affix]||'#5a90d0';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText(`[${e.affix}]`,e.x,y-4);}}else{ctx.fillStyle='#d6d0c8';ctx.textAlign='center';ctx.font='bold 11px monospace';ctx.fillText(`${CHAPTERS[e.ch].boss}`,e.x,e.y-e.r*2.25-16);}}
// 骑士刀光：挥砍/横扫走"扫掠扇面 + 前沿亮弧 + 刃尖火花"，突刺走"高速枪影 + 尖端冲击环"
function drawSwingFx(e){
 const q=clamp(1-e.t/e.maxT,0,1),dir=e.dir||1;
 const a0=e.a-e.arc/2*dir,lead=a0+(e.a+e.arc/2*dir-a0)*easeOut(q);
 const fade=1-Math.max(0,(q-.68)/.32);
 if(e.kind==='thrust'){
  const ca=Math.cos(e.a),sa=Math.sin(e.a),nx=-sa,ny=ca,tipX=e.x+ca*e.r1,tipY=e.y+sa*e.r1;
  ctx.globalAlpha=.9*fade;ctx.lineCap='round';
  const g2=ctx.createLinearGradient(e.x,e.y,tipX,tipY);
  g2.addColorStop(0,'rgba(255,244,214,0)');g2.addColorStop(.45,'rgba(255,244,214,.30)');g2.addColorStop(1,'rgba(255,255,246,.92)');
  ctx.strokeStyle=g2;ctx.lineWidth=9*(1-q*.35);
  ctx.beginPath();ctx.moveTo(e.x+ca*6,e.y+sa*6);ctx.lineTo(tipX,tipY);ctx.stroke();
  ctx.strokeStyle='#fffaf0';ctx.lineWidth=2.2;
  ctx.beginPath();ctx.moveTo(e.x+ca*12,e.y+sa*12);ctx.lineTo(tipX,tipY);ctx.stroke();
  ctx.globalAlpha=.32*fade;ctx.strokeStyle='#e8c878';ctx.lineWidth=1;
  for(let k=-3;k<=3;k++){if(!k)continue;ctx.beginPath();ctx.moveTo(e.x+ca*22+nx*k*11,e.y+sa*22+ny*k*11);ctx.lineTo(e.x+ca*e.r1*.88+nx*k*6,e.y+sa*e.r1*.88+ny*k*6);ctx.stroke();}
  glowSpot(e.x+ca*e.r1*.5,e.y+sa*e.r1*.5,e.r1*.55,'255,210,140',.30*(1-q));
  if(q>.42){const k2=(q-.42)/.58;ctx.globalAlpha=(1-k2)*fade;ctx.strokeStyle='#fff3d0';ctx.lineWidth=2.6-1.8*k2;ctx.beginPath();ctx.arc(tipX,tipY,5+24*k2,0,Math.PI*2);ctx.stroke();
   ctx.globalAlpha=(1-k2)*fade*.6;ctx.strokeStyle='#e8c878';ctx.lineWidth=1;ctx.beginPath();ctx.arc(tipX,tipY,10+34*k2,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=1;return;
 }
 const lo=Math.min(a0,lead),hi=Math.max(a0,lead),span=hi-lo,RR=e.r1*1.12;
 ctx.globalAlpha=.30*fade;glowSpot(e.x,e.y,RR*1.05,'255,206,132',.30);     // 起手辉光
 cometSector(e.x,e.y,e.r0,RR,lo,hi,'255,244,214',13,1.05*fade);            // 彗尾状月牙刀光
 ctx.globalAlpha=.7*fade;ctx.lineCap='round';
 ctx.strokeStyle='#ffd98a';ctx.lineWidth=6.5;ctx.beginPath();ctx.arc(e.x,e.y,RR*.90,lo,hi);ctx.stroke();  // 外层暖光
 ctx.strokeStyle='#ffffff';ctx.lineWidth=2.6;ctx.beginPath();ctx.arc(e.x,e.y,RR*.90,hi-Math.min(.85,span),hi);ctx.stroke(); // 白热核
 ctx.globalAlpha=.6*fade;ctx.strokeStyle='#e8c878';ctx.lineWidth=1.2;
 ctx.beginPath();ctx.arc(e.x,e.y,RR*1.02,lo,hi);ctx.stroke();              // 外缘金边
 // 沿扫掠方向的放射速度线
 ctx.globalAlpha=.34*fade;ctx.strokeStyle='#ffe6b0';ctx.lineWidth=1.1;
 for(let k=0;k<7;k++){const t=frand(k*2.3+e.r1*.17),aa=lo+span*t,ri=e.r0*(1.3-.1*k%3);
  ctx.beginPath();ctx.moveTo(e.x+Math.cos(aa)*ri,e.y+Math.sin(aa)*ri);ctx.lineTo(e.x+Math.cos(aa)*RR*.96,e.y+Math.sin(aa)*RR*.96);ctx.stroke();}
 for(let k=0;k<6;k++){const s=frand(k*3.7+e.r1*.11),aa=lead-s*Math.min(1.6,span);
   glowSpot(e.x+Math.cos(aa)*RR*(.72+s*.26),e.y+Math.sin(aa)*RR*(.72+s*.26),3+s*4,'255,222,150',.7*fade*(1-s*.5));}
 ctx.globalAlpha=1;
}
function drawEffect(e){ctx.save();const now=performance.now();if(e.type==='swing')drawSwingFx(e);
 if(e.type==='frost'){
  const age=e.maxT-e.t,a=1-clamp((age-.60)/.26,0,1);
  const grow=easeOut(clamp(age/.30,0,1)),shatter=clamp((age-.60)/.26,0,1),R=e.r;
  ctx.globalAlpha=.34*a;glowSpot(e.x,e.y,R*.95,'110,190,255',.34);
  ctx.globalAlpha=.55*a*grow;ctx.strokeStyle='#bfe9ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,R*.98,0,7);ctx.stroke();
  ctx.globalAlpha=.30*a*grow;ctx.strokeStyle='#8fd6ff';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(e.x,e.y,R*.66,0,7);ctx.stroke();
  for(let k=0;k<9;k++){
   const sd=frand(k*4.1+R*.07),ang=k*(Math.PI*2/9)+sd*.55;
   const bx=e.x+Math.cos(ang)*R*(.18+.62*frand(k*7.3)),by=e.y+Math.sin(ang)*R*(.18+.62*frand(k*7.3));
   const hh=(36+sd*32)*easeOut(clamp((age-k*.045)/.30,0,1)),ww=(7+sd*5);
   if(hh<2)continue;
   const ty2=by-hh;
   polyFill([[bx-ww,by+4],[bx+ww,by+4],[bx,ty2]],'rgba(146,212,255,.92)');
   polyFill([[bx-ww*.15,by+4],[bx+ww,by+4],[bx,ty2]],'rgba(92,166,224,.95)');
   polyFill([[bx-ww,by+4],[bx-ww*.15,by+4],[bx-ww*.05,ty2+hh*.2]],'rgba(228,247,255,.8)');
   ctx.globalAlpha=a;polyStroke([[bx-ww,by+4],[bx+ww,by+4],[bx,ty2]],'#eaf8ff',1,true);
   glowSpot(bx,ty2,6+sd*5,'190,235,255',.5*a);
  }
  const ch2=54*grow;
  if(ch2>3){
   polyFill([[e.x-11,e.y+6],[e.x+11,e.y+6],[e.x+2,e.y-ch2],[e.x-4,e.y-ch2*.86]],'rgba(168,224,255,.9)');
   polyFill([[e.x-2,e.y+6],[e.x+11,e.y+6],[e.x+2,e.y-ch2]],'rgba(108,178,228,.95)');
   polyStroke([[e.x-11,e.y+6],[e.x+11,e.y+6],[e.x+2,e.y-ch2],[e.x-4,e.y-ch2*.86]],'#f0fbff',1.2,true);
  }
  if(shatter>0){for(let k=0;k<18;k++){const sd=frand(k*9.1+R*.03),ang=k*(Math.PI*2/18)+sd;
   const d=R*(.3+1.15*shatter)*(.5+sd),sz=3+sd*4,ry=-easeIn(shatter)*(.4+sd)*R*.55;
   ctx.globalAlpha=(1-shatter)*.9;
   polyFill([[e.x+Math.cos(ang)*d,e.y+Math.sin(ang)*d*.6+ry-sz],[e.x+Math.cos(ang)*d+sz*.7,e.y+Math.sin(ang)*d*.6+ry+sz*.5],[e.x+Math.cos(ang)*d-sz*.7,e.y+Math.sin(ang)*d*.6+ry+sz*.5]],'#d8f4ff');}}
  ctx.globalAlpha=1;
 }
 if(e.type==='ring'){ctx.strokeStyle='#3e5870';ctx.lineWidth=6;ctx.beginPath();ctx.arc(e.x,e.y,e.r*(1-e.t*.45),0,Math.PI*2);ctx.stroke();}
 if(e.type==='trap'){
  const nw=performance.now(),trig=!!e.triggered;
  const fadeT=trig?clamp(1-e.t/3,0,1):0;
  const rgb=trig?'150,215,255':'110,170,215';
  ctx.globalAlpha=trig?.34:.20+.10*Math.sin(nw*.004);
  glowSpot(e.x,e.y,34,rgb,.55);
  ctx.globalAlpha=trig?.70:.50;ctx.strokeStyle=trig?'#d8f4ff':'#5f86a8';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(e.x,e.y,21,0,7);ctx.stroke();
  ctx.globalAlpha=trig?.40:.26;ctx.strokeStyle=trig?'#9bdcff':'#4a6b88';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.arc(e.x,e.y,13.5,0,7);ctx.stroke();
  const ra=trig?nw*.006:nw*.0011;
  for(let k=0;k<6;k++){
   const a=ra+k*Math.PI/3,sx=e.x+Math.cos(a)*17,sy=e.y+Math.sin(a)*17;
   ctx.globalAlpha=trig?.95:.68;
   polyFill([[sx,sy-3.6],[sx+2.6,sy],[sx,sy+3.6],[sx-2.6,sy]],trig?'#eaf8ff':'#7fb4d8');
  }
  const cs=trig?11:7;
  polyFill([[e.x,e.y-cs],[e.x+cs*.5,e.y],[e.x,e.y+cs],[e.x-cs*.5,e.y]],'rgba(204,240,255,.92)');
  polyFill([[e.x,e.y-cs],[e.x+cs*.5,e.y],[e.x,e.y+cs*.35]],'rgba(120,190,240,.95)');
  polyStroke([[e.x,e.y-cs],[e.x+cs*.5,e.y],[e.x,e.y+cs],[e.x-cs*.5,e.y]],'#f0fbff',1,true);
  if(trig){
   for(let k=0;k<8;k++){
    const sd=frand(k*3.3),a=k*Math.PI/4+sd*.4;
    const bx=e.x+Math.cos(a)*22,by=e.y+Math.sin(a)*22,h=(16+sd*14)*(1-fadeT*.35);
    if(h<2)continue;
    ctx.globalAlpha=(1-fadeT)*.9;
    polyFill([[bx-4,by+2],[bx+4,by+2],[bx,by-h]],'rgba(160,220,255,.9)');
    polyFill([[bx+1,by+2],[bx+4,by+2],[bx,by-h]],'rgba(96,168,220,.92)');
    polyStroke([[bx-4,by+2],[bx+4,by+2],[bx,by-h]],'#e6f7ff',1,true);
   }
  }
  ctx.globalAlpha=1;
 }
 if(e.type==='rain'){
  const R=e.r,nw=performance.now();
  const lg=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,R);
  lg.addColorStop(0,'rgba(196,212,232,.40)');lg.addColorStop(.7,'rgba(180,198,224,.16)');lg.addColorStop(1,'rgba(180,198,224,0)');
  ctx.globalAlpha=.22+.06*Math.sin(nw*.008);ctx.fillStyle=lg;ctx.fillRect(e.x-R,e.y-R,R*2,R*2);
  ctx.globalAlpha=.42;ctx.setLineDash([9,7]);ctx.lineDashOffset=-nw*.03;
  ctx.strokeStyle='#8fa4bc';ctx.lineWidth=1.6;
  ctx.strokeRect(e.x-R,e.y-R*.7,R*2,R*1.4);
  ctx.setLineDash([]);ctx.lineDashOffset=0;
  ctx.globalAlpha=.55;ctx.strokeStyle='#c6d6ea';ctx.lineWidth=2;
  const c=R*.10,xx=e.x-R,xe=e.x+R,yy=e.y-R*.7,ye=e.y+R*.7;
  for(const sx of [xx,xe])for(const sy of [yy,ye]){
   ctx.beginPath();
   ctx.moveTo(sx+(sx<e.x?0:-c),sy);ctx.lineTo(sx,sy);ctx.lineTo(sx,sy+(sy<e.y?0:-c));ctx.stroke();
  }
  ctx.globalAlpha=.30;ctx.strokeStyle='#7d8ea6';ctx.lineWidth=1;
  for(let i=1;i<4;i++){const ly=yy+(ye-yy)*i/4;ctx.beginPath();ctx.moveTo(xx,ly);ctx.lineTo(xe,ly);ctx.stroke();}
  ctx.globalAlpha=1;
 }
 if(e.type==='meteorMark'){
  const pr=clamp(1-e.t/e.maxT,0,1),R=e.r,nw=performance.now();
  // 落点压暗：画在 World 层会被光照 multiply 再压一次 = 天然的"越来越暗"
  if(e.sky&&save.settings.quality!=='low'){const dg=ctx.createRadialGradient(e.x,e.y,R*.2,e.x,e.y,R);dg.addColorStop(0,`rgba(16,10,8,${.18+.16*pr})`);dg.addColorStop(1,'rgba(16,10,8,0)');ctx.fillStyle=dg;ctx.beginPath();ctx.arc(e.x,e.y,R,0,7);ctx.fill();}
  ctx.globalAlpha=.45;glowSpot(e.x,e.y,R*.85,'255,90,40',.20+.12*Math.sin(nw*.02));
  ctx.globalAlpha=.55;ctx.strokeStyle='#a11f1f';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(e.x,e.y,R*(.55+.45*pr),0,7);ctx.stroke();
  ctx.globalAlpha=.32;ctx.strokeStyle='#ff8c42';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(e.x,e.y,R*.88,0,7);ctx.stroke();
  ctx.globalAlpha=.45;ctx.strokeStyle='#e8a050';ctx.lineWidth=1.6;ctx.setLineDash([7,9]);
  ctx.beginPath();ctx.arc(e.x,e.y,R*.72,nw*.0016,nw*.0016+Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.globalAlpha=.16+.22*pr;ctx.fillStyle='#a11f1f';ctx.beginPath();ctx.arc(e.x,e.y,R*.55*pr,0,7);ctx.fill();
  ctx.globalAlpha=.6;ctx.strokeStyle='#ffd0a0';ctx.lineWidth=1.4;ctx.beginPath();
  ctx.moveTo(e.x-R*.74,e.y);ctx.lineTo(e.x-R*.58,e.y);ctx.moveTo(e.x+R*.58,e.y);ctx.lineTo(e.x+R*.74,e.y);
  ctx.moveTo(e.x,e.y-R*.74);ctx.lineTo(e.x,e.y-R*.58);ctx.moveTo(e.x,e.y+R*.58);ctx.lineTo(e.x,e.y+R*.74);ctx.stroke();
  ctx.globalAlpha=1;
 }
 if(e.type==='meteorFall'){
  const pr=clamp(1-e.t/e.maxT,0,1),R=e.r,k=easeIn(pr);
  // 天空裂光 12 段 + 落点向心线：让 0.92s 的坠落等待不再是"空屏"（low 档关闭）
  if(save.settings.quality!=='low'&&save.settings.crispFx!==false){
   ctx.globalAlpha=.5*(1-k*1.6);
   for(let i=0;i<12;i++){const sd=frand(i*5.1),sx2=W*(.05+sd*.9),len=60+sd*110;
    ctx.fillStyle=i%2?'#a11f1f':'#ff8c42';ctx.fillRect(Math.round(sx2),0,Math.max(1,Math.round(6*(1-k))),Math.max(1,Math.round(len*(1-k*.5))));}
   ctx.globalAlpha=.45;ctx.strokeStyle='#ffd08a';ctx.lineWidth=1.4;
   for(let i=0;i<6;i++){const a=i*1.047;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*R*.92,e.y+Math.sin(a)*R*.92);ctx.lineTo(e.x+Math.cos(a)*R*.55,e.y+Math.sin(a)*R*.55);ctx.stroke();}
  }
  const sx=e.x+86,sy=-84,cx2=sx+(e.x-sx)*k,cy2=sy+(e.y-sy)*k;
  const dir=Math.atan2(e.y-sy,e.x-sx),ca=Math.cos(dir),sa=Math.sin(dir);
  ctx.globalAlpha=.5*k;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(e.x,e.y,R*.66*k+9,R*.32*k+5,0,0,7);ctx.fill();
  ctx.globalAlpha=.55;glowSpot(e.x,e.y,R*.95,'255,110,40',.30*k);
  for(let i=0;i<15;i++){const t2=i/15,sz=Math.max(1,(17-i)*1.7*(.5+t2));
   ctx.globalAlpha=.5*(1-t2)*(.45+.55*k);
   ctx.fillStyle=i<4?'#ffd08a':i<9?'#ff8c42':'#a11f1f';
   ctx.beginPath();ctx.arc(cx2-ca*180*t2,cy2-sa*180*t2,sz*(1-t2*.42),0,7);ctx.fill();}
  ctx.globalAlpha=1;
  for(let k=0;k<7;k++){const sd=frand(k*6.1),off=(sd-.5)*R*1.1,len=R*(.5+.9*sd);
   ctx.globalAlpha=.30*(1-k/7);ctx.fillStyle=k%2?'#ff8c42':'#ffcf7a';
   ctx.beginPath();ctx.arc(cx2-ca*len+ -sa*off,cy2-sa*len+ ca*off,Math.max(1,7-k*.7),0,7);ctx.fill();}
  ctx.globalAlpha=1;
  glowSpot(cx2,cy2,R*2.0,'255,110,30',.58);
  glowSpot(cx2,cy2,R*.9,'255,220,150',.5);
  ctx.fillStyle='#a11f1f';ctx.beginPath();ctx.arc(cx2,cy2,R*.64,0,7);ctx.fill();
  ctx.fillStyle='#ff8c42';ctx.beginPath();ctx.arc(cx2,cy2,R*.46,0,7);ctx.fill();
  ctx.fillStyle='#ffd08a';ctx.beginPath();ctx.arc(cx2,cy2,R*.28,0,7);ctx.fill();
  ctx.fillStyle='#fff8e0';ctx.beginPath();ctx.arc(cx2-R*.06,cy2-R*.06,R*.12,0,7);ctx.fill();
 }
 if(e.type==='meteorImpact'){
  const pr=clamp(1-e.t/e.maxT,0,1),R=e.r,a=1-pr;
  ctx.globalAlpha=.55;glowSpot(e.x,e.y,R*1.15,'255,120,45',.34*(1-pr*.6));
  ctx.globalAlpha=a*.9;ctx.strokeStyle='#ffd08a';ctx.lineWidth=6*(1-pr)+1.5;ctx.beginPath();ctx.arc(e.x,e.y,R*(.2+1.15*easeOut(pr)),0,7);ctx.stroke();
  ctx.globalAlpha=a*.5;ctx.strokeStyle='#a11f1f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,R*(.1+.88*easeOut(pr)),0,7);ctx.stroke();
  ctx.globalAlpha=.78*Math.min(1,a*2);ctx.fillStyle='#241412';ctx.beginPath();ctx.ellipse(e.x,e.y,R*.66,R*.40,0,0,7);ctx.fill();
  ctx.globalAlpha=.55*Math.min(1,a*2);ctx.strokeStyle='#ff5a20';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,R*.62,R*.37,0,0,7);ctx.stroke();
  for(let k=0;k<9;k++){const sd=frand(k*5.7+R),ang=k*(Math.PI*2/9)+sd*.6;
   const L=R*(.5+.55*sd)*Math.min(1,pr*2.2)*(1-pr*.35);
   ctx.globalAlpha=a*.8;ctx.strokeStyle=k%2?'#ff8c42':'#ffd08a';ctx.lineWidth=Math.max(.6,1.6-pr);
   ctx.beginPath();ctx.moveTo(e.x+Math.cos(ang)*R*.2,e.y+Math.sin(ang)*R*.2);
   ctx.lineTo(e.x+Math.cos(ang+.18*sd)*L*.6,e.y+Math.sin(ang+.18*sd)*L*.6);
   ctx.lineTo(e.x+Math.cos(ang)*L,e.y+Math.sin(ang)*L);ctx.stroke();}
  for(let k=0;k<15;k++){const sd=frand(k*11.3+R*.05),ang=k*(Math.PI*2/15)+sd;
   const d=R*(.25+.85*sd)*(.4+pr*1.2),ry=-easeIn(pr)*(.6+sd)*R*.95;
   ctx.globalAlpha=a*.85;glowSpot(e.x+Math.cos(ang)*d,e.y+Math.sin(ang)*d*.6+ry,2.2+sd*3.4,k%3===0?'255,210,120':'255,120,50',.7);}
  ctx.globalAlpha=1;
 }
 if(e.type==='danger'){
  const pct=clamp(1-e.t/(e.maxT||.78),0,1),R=e.r,pulse=.5+.5*Math.sin(now*.018);
  ctx.globalAlpha=.12+.08*pulse;ctx.fillStyle='#a11f1f';ctx.fillRect(e.x-R,e.y-R,R*2,R*2);
  ctx.globalAlpha=.26+.10*pulse;ctx.fillStyle='#d63a2a';ctx.fillRect(e.x-R,e.y-R,R*2*easeOut(pct),R*2);
  ctx.save();ctx.globalAlpha=.20;ctx.strokeStyle='#ff9a8a';ctx.lineWidth=1;
  ctx.beginPath();ctx.rect(e.x-R,e.y-R,R*2,R*2);ctx.clip();
  for(let k=-R*2;k<R*2;k+=13){ctx.beginPath();ctx.moveTo(e.x+k,e.y-R);ctx.lineTo(e.x+k+R*2,e.y+R);ctx.stroke();}
  ctx.restore();
  ctx.globalAlpha=.72+.28*pulse;ctx.strokeStyle=pulse>.5?'#e04a34':'#a11f1f';ctx.lineWidth=2.6;
  ctx.strokeRect(e.x-R,e.y-R,R*2,R*2);
  ctx.globalAlpha=.9;ctx.strokeStyle='#ffd0a0';ctx.lineWidth=2;
  const c=Math.min(12,R*.22);
  for(const sx of [e.x-R,e.x+R])for(const sy of [e.y-R,e.y+R]){
   ctx.beginPath();
   ctx.moveTo(sx+(sx<e.x?0:-c),sy);ctx.lineTo(sx,sy);ctx.lineTo(sx,sy+(sy<e.y?0:-c));ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 if(e.type==='cast'){
  const pct=clamp(1-e.t/(e.maxT||.28),0,1);
  const C=e.classId==='mage'?'154,90,220':e.classId==='hunter'?'110,160,220':'220,170,90';
  const rr=10+easeOut(pct)*26;
  ctx.globalAlpha=.52*(1-pct*.35);glowSpot(e.x,e.y,rr*1.5,C,.42);
  ctx.globalAlpha=.9*(1-pct*.5);ctx.strokeStyle='rgb('+C+')';ctx.lineWidth=2.4;
  ctx.beginPath();ctx.arc(e.x,e.y,rr,0,7);ctx.stroke();
  ctx.globalAlpha=.45*(1-pct);ctx.strokeStyle='#ffffff';ctx.lineWidth=1.1;
  ctx.beginPath();ctx.arc(e.x,e.y,rr*1.13,0,7);ctx.stroke();
  for(let k=0;k<8;k++){
   const a=e.a+k*Math.PI/4+pct*1.4,d=rr*2.1*(1-pct*.55),sz=3.4*(1-pct*.5);
   if(sz<.6)continue;
   ctx.globalAlpha=.95*(1-pct*.35);ctx.fillStyle='rgb('+C+')';
   polyFill([[e.x+Math.cos(a)*d,e.y+Math.sin(a)*d-sz],[e.x+Math.cos(a)*d+sz*.8,e.y+Math.sin(a)*d+sz*.8],[e.x+Math.cos(a)*d-sz*.8,e.y+Math.sin(a)*d+sz*.8]],'rgb('+C+')');
  }
  ctx.globalAlpha=.6*(1-pct);ctx.strokeStyle='#fff8e8';ctx.lineWidth=1.6;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(e.x+Math.cos(e.a)*rr,e.y+Math.sin(e.a)*rr);
  ctx.lineTo(e.x+Math.cos(e.a)*(rr+13),e.y+Math.sin(e.a)*(rr+13));ctx.stroke();
  ctx.globalAlpha=1;
}if(e.type==='telegraph'){
  const left=clamp(e.t/(e.maxT||1),0,1),R=e.r,col=e.color||'#a11f1f';
  ctx.globalAlpha=.13+.07*Math.sin(now*.02);ctx.fillStyle=col;
  ctx.beginPath();ctx.arc(e.x,e.y,R,0,7);ctx.fill();
  ctx.globalAlpha=.30;ctx.strokeStyle=col;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(e.x,e.y,R*(.70+.30*left),0,7);ctx.stroke();
  ctx.globalAlpha=.55+.30*left;ctx.strokeStyle=col;ctx.lineWidth=2.6;
  ctx.beginPath();ctx.arc(e.x,e.y,R,0,7);ctx.stroke();
  ctx.globalAlpha=.7;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.4;
  for(let k=0;k<12;k++){
   const a=k*Math.PI/6;
   ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*R*.90,e.y+Math.sin(a)*R*.90);
   ctx.lineTo(e.x+Math.cos(a)*R,e.y+Math.sin(a)*R);ctx.stroke();
  }
  ctx.globalAlpha=.55*left;ctx.strokeStyle='#fff4d6';ctx.lineWidth=3;ctx.lineCap='round';
  ctx.beginPath();ctx.arc(e.x,e.y,R*.94,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-left));ctx.stroke();
  ctx.globalAlpha=1;
}if(e.type==='shockwave'){
  const pct=clamp(1-e.t/(e.maxT||.3),0,1),R=e.r||42,a=1-pct,col=e.color||'#d6d0c8';
  const rgb=lightColorOf(col),rad=6+R*easeOut(pct);
  ctx.save();ctx.globalCompositeOperation='lighter';
  glowSpot(e.x,e.y,rad*1.18,rgb,.30*a);
  ctx.restore();
  ctx.globalAlpha=a;ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,6*(1-pct));
  ctx.beginPath();ctx.arc(e.x,e.y,rad,0,7);ctx.stroke();
  ctx.globalAlpha=a*.75;ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(.6,2*(1-pct));
  ctx.beginPath();ctx.arc(e.x,e.y,rad*.965,0,7);ctx.stroke();
  ctx.globalAlpha=a*.32;ctx.strokeStyle=col;ctx.lineWidth=1.2;
  ctx.beginPath();ctx.arc(e.x,e.y,rad*1.15,0,7);ctx.stroke();
  for(let k=0;k<10;k++){
   const sd=frand(k*5.5+R),ang=k*Math.PI/5+sd*.5,d=rad*(.86+sd*.22);
   ctx.globalAlpha=a*.55;
   glowSpot(e.x+Math.cos(ang)*d,e.y+Math.sin(ang)*d*.72,2+sd*3,rgb,.60);
  }
  ctx.globalAlpha=1;
}if(e.type==='impact'){
  const a=clamp(e.t/.18,0,1),q=1-a;
  ctx.save();ctx.globalCompositeOperation='lighter';
  glowSpot(e.x,e.y,10+15*q,'255,240,200',.50*a);
  ctx.restore();
  const L=8+22*easeOut(q);
  ctx.globalAlpha=a;ctx.lineCap='round';
  for(let k=-2;k<=2;k++){
   const ang=e.a+Math.PI+(k*.24);
   ctx.strokeStyle=k===0?'#fff8e8':'#e8c878';ctx.lineWidth=k===0?3:1.6;
   ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(ang)*L*(k===0?1:.72),e.y+Math.sin(ang)*L*(k===0?1:.72));ctx.stroke();
  }
  ctx.globalAlpha=a*.7;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.arc(e.x,e.y,L*.35,0,7);ctx.stroke();
  ctx.globalAlpha=1;
}if(e.type==='skillArc'){
  const pct=clamp(1-e.t/(e.maxT||.36),0,1),a=1-pct,R=e.r,col=e.color||'#d6d0c8';
  const spread=.9+pct*.22,rr=R*(.72+easeOut(pct)*.46);
  ctx.save();ctx.globalCompositeOperation='lighter';
  glowSpot(e.x+Math.cos(e.a)*rr*.5,e.y+Math.sin(e.a)*rr*.5,rr*.85,'255,236,190',.28*a);
  ctx.restore();
  cometSector(e.x,e.y,rr*.34,rr,e.a-spread,e.a+spread,'255,244,214',11,.9*a);
  ctx.globalAlpha=a;ctx.lineCap='round';
  ctx.strokeStyle='#ffd98a';ctx.lineWidth=Math.max(1,6*(1-pct));
  ctx.beginPath();ctx.arc(e.x,e.y,rr*.94,e.a-spread,e.a+spread);ctx.stroke();
  ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(.7,2.4*(1-pct));
  ctx.beginPath();ctx.arc(e.x,e.y,rr*.94,e.a-.42,e.a+.42);ctx.stroke();
  ctx.globalAlpha=a*.45;ctx.strokeStyle=col;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.a)*R*1.15,e.y+Math.sin(e.a)*R*1.15);ctx.stroke();
  for(let k=0;k<8;k++){
   const sd=frand(k*9.3+R),ang=e.a+(sd-.5)*spread*1.5,d=R*(.5+sd*.7)*(.4+pct*.9);
   ctx.globalAlpha=a*.75;
   glowSpot(e.x+Math.cos(ang)*d,e.y+Math.sin(ang)*d,2+sd*3.4,k%2?'255,210,130':'255,160,70',.65);
  }
  ctx.globalAlpha=1;
}if(e.type==='spinAura'){
  e.x=game.player.x;e.y=game.player.y;
  const nw=performance.now(),R=e.r;
  const a=Math.min(1,(e.maxT-e.t)/.18)*Math.min(1,e.t/.25);
  if(a>0){
   const dg=ctx.createRadialGradient(e.x,e.y,R*.52,e.x,e.y,R*1.06);
   dg.addColorStop(0,'rgba(190,178,152,0)');dg.addColorStop(.72,'rgba(196,184,158,.20)');dg.addColorStop(1,'rgba(196,184,158,0)');
   ctx.globalAlpha=a*.5;ctx.fillStyle=dg;ctx.beginPath();ctx.arc(e.x,e.y,R*1.06,0,7);ctx.fill();
   ctx.globalAlpha=a*.28;
   glowSpot(e.x,e.y,R*1.02,'255,206,132',.30);
   const base=nw*.011;
   for(let k=0;k<3;k++){
    const a0=base+k*Math.PI*2/3,sw=1.9;
    cometSector(e.x,e.y,R*.30,R,a0-sw*.18,a0+sw,'255,236,180',7,.85*a);
    ctx.globalAlpha=a;ctx.lineCap='round';
    ctx.strokeStyle='#ffe6b0';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(e.x,e.y,R*.92,a0+.10,a0+sw*.62);ctx.stroke();
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(e.x,e.y,R*.92,a0+sw*.42,a0+sw*.62);ctx.stroke();
    glowSpot(e.x+Math.cos(a0+sw*.62)*R*.92,e.y+Math.sin(a0+sw*.62)*R*.92,7,'255,236,170',.55*a);
   }
   // 第 4 层反向微光：角速度 -0.35×，3 秒里画面不再"零变化"
   cometSector(e.x,e.y,R*.44,R*.96,base*-.35-1.2,base*-.35+1.2,'214,208,200',5,.20*a);
   ctx.globalAlpha=a*.30;ctx.strokeStyle='#e8d8b0';ctx.lineWidth=1;
   for(let k=0;k<10;k++){
    const sd=frand(k*4.7),ang=base*.6+k*Math.PI/5+sd;
    ctx.beginPath();
    ctx.moveTo(e.x+Math.cos(ang)*R*(.55+sd*.2),e.y+Math.sin(ang)*R*(.55+sd*.2));
    ctx.lineTo(e.x+Math.cos(ang)*R*(.95+sd*.1),e.y+Math.sin(ang)*R*(.95+sd*.1));ctx.stroke();
   }
   // 结束时把三道同心弧刮痕留在场上：旋风的"落点"从此可读
   if(e.t<.18&&!e.done){e.done=true;addDecal('slash',e.x,e.y,R*.8,.30);addDecal('slash',e.x,e.y,R*.55,.24);}
  }
  ctx.globalAlpha=1;
}if(e.type==='charge'){ctx.setLineDash([8,6]);pxLine(e.x,e.y,e.tx,e.ty,'#a11f1f',2);ctx.setLineDash([]);}if(e.type==='claw'){
  const q=clamp(1-e.t/(e.maxT||.2),0,1),a=1-q;
  for(let k=0;k<3;k++){const off=(k-1)*.30,aa=e.a+off,ca=Math.cos(aa),sa=Math.sin(aa),nx=-sa,ny=ca;
   const r0=12,r1=34+9*Math.sin(q*Math.PI);
   ctx.globalAlpha=a*.8;
   polyFill([[e.x+ca*r0+nx*3.4,e.y+sa*r0+ny*3.4],[e.x+ca*r1,e.y+sa*r1],[e.x+ca*r0-nx*3.4,e.y+sa*r0-ny*3.4]],'rgba(255,116,86,.8)');
   ctx.strokeStyle='#ffe2d2';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(e.x+ca*r0,e.y+sa*r0);ctx.lineTo(e.x+ca*r1,e.y+sa*r1);ctx.stroke();}
  ctx.globalAlpha=1;glowSpot(e.x+Math.cos(e.a)*24,e.y+Math.sin(e.a)*24,28,'255,80,50',.30*a);
 }if(e.type==='dash'){
  const pct=clamp(1-e.t/.22,0,1),a=1-pct,ang=e.a||0;
  const ca=Math.cos(ang),sa=Math.sin(ang),nx=-sa,ny=ca;
  const lg=ctx.createLinearGradient(e.x-ca*54,e.y-sa*54,e.x,e.y);
  lg.addColorStop(0,'rgba(200,215,240,0)');lg.addColorStop(1,'rgba(222,236,255,.30)');
  ctx.save();ctx.globalAlpha=a;ctx.fillStyle=lg;ctx.beginPath();
  ctx.moveTo(e.x-ca*54+nx*7,e.y-sa*54+ny*7);ctx.lineTo(e.x+nx*13,e.y+ny*13);
  ctx.lineTo(e.x-nx*13,e.y-ny*13);ctx.lineTo(e.x-ca*54-nx*7,e.y-sa*54-ny*7);ctx.closePath();ctx.fill();
  ctx.restore();
  for(let k=1;k<=3;k++){
   ctx.globalAlpha=a*.15/k;ctx.fillStyle='#d6d0c8';
   ctx.fillRect(Math.round(e.x-ca*16*k-11),Math.round(e.y-sa*14*k-11),22,26);
  }
  ctx.globalAlpha=a*.45;ctx.strokeStyle='#eaf2ff';ctx.lineWidth=1.1;
  for(let k=-2;k<=2;k++){
   const off=k*7;
   ctx.beginPath();ctx.moveTo(e.x-ca*58+nx*off,e.y-sa*58+ny*off);
   ctx.lineTo(e.x-ca*22+nx*off,e.y-sa*22+ny*off);ctx.stroke();
  }
  ctx.globalAlpha=1;
}
// ---- V12 新增：圣光护体 六棱壳 / 法力涌泉 光柱 / 雷链 / 风暴之环 ----
if(e.type==='wardShell'){
 const age=e.maxT-e.t,R=Math.min(48,16+age*38),a=Math.min(1,e.t/.5),cy=e.y-14;
 const pts=[];for(let k=0;k<6;k++){const ang=-Math.PI/2+k*Math.PI/3;pts.push([e.x+Math.cos(ang)*R,cy+Math.sin(ang)*R*1.12]);}
 glowSpot(e.x,cy,R*1.7,'255,215,120',.20*a);
 ctx.globalAlpha=a*.10;polyFill(pts,'rgba(255,215,120,.10)');
 ctx.globalAlpha=a*.72;polyStroke(pts,'#ffe9a8',1.5,true);
 // 白热核：内侧再收 8% 画一条 1.2px 的近白线，边缘立刻"从糊到利"
 ctx.globalAlpha=a*.55;polyStroke(pts.map(([x,y])=>[e.x+(x-e.x)*.92,cy+(y-cy)*.92]),'#fff8e8',1.2,true);
 const fl=.65+.35*Math.sin(game.elapsed*8);
 ctx.globalAlpha=a*.45*fl;pxRect(e.x-1.5,cy-R*1.22,3,R*2.44,'#fff8e8');pxRect(e.x-R*1.22,cy-1.5,R*2.44,3,'#fff8e8');
 // 末 0.5s 罩体闪烁提示即将结束
 if(e.t<.5)ctx.globalAlpha=a*(Math.floor(game.elapsed*12)%2?.55:.15);
 ctx.globalAlpha=a*.3;ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(e.x,e.y+2,40,14,0,0,7);ctx.stroke();
 ctx.globalAlpha=1;
}
if(e.type==='manaPillar'){
 const age=e.maxT-e.t,a=Math.min(1,age/.3)*Math.min(1,e.t/.6),pu=.30+.12*Math.sin(age*Math.PI*2/1.1);
 // 三条交叠纵带：宽→窄、暗→亮，读作"向上喷涌"的光柱
 for(let i=0;i<3;i++){const w=[18,10,4][i],c=['#6b3fa0','#b06aff','#f0dcff'][i];ctx.globalAlpha=a*(pu+(i===2?.35:0));pxRect(e.x-w/2,e.y-140,w,140,c);}
 for(let k=0;k<8;k++){
  const ang=k*Math.PI/4+age*1.2,lit=age*10>k;
  ctx.globalAlpha=a*(lit?.9:.22);
  glowSpot(e.x+Math.cos(ang)*26,e.y+Math.sin(ang)*26*.45,5,'176,106,255',.7);
 }
 if(e.t<.5)ctx.globalAlpha=a*(Math.floor(game.elapsed*16)%2?.5:.15);
 glowSpot(e.x,e.y-40,60,'150,90,220',.30*a);ctx.globalAlpha=1;
}
if(e.type==='chain'){
 const a=clamp(e.t/(e.maxT||.22),0,1),seg=6;
 ctx.globalAlpha=a;ctx.strokeStyle='#9ad8ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x,e.y);
 for(let k=1;k<=seg;k++){const t2=k/seg,jx=(frand(k*3.1+e.x)-.5)*18,jy=(frand(k*7.7+e.y)-.5)*18;ctx.lineTo(e.x+(e.tx-e.x)*t2+jx,e.y+(e.ty-e.y)*t2+jy);}
 ctx.stroke();
 ctx.globalAlpha=a*.8;ctx.strokeStyle='#fff8e8';ctx.lineWidth=1;ctx.stroke();
 glowSpot(e.tx,e.ty,16,'150,215,255',.5*a);ctx.globalAlpha=1;
}
if(e.type==='stormRing'){
 const pr=clamp(1-e.t/(e.maxT||.42),0,1),a=1-pr,R=e.r,rad=20+R*easeOut(pr);
 ctx.globalAlpha=a;ctx.strokeStyle='#9ad8ff';ctx.lineWidth=4*(1-pr)+1;
 ctx.beginPath();ctx.arc(e.x,e.y,rad,0,7);ctx.stroke();
 // 环上再插 8 段折线闪电，避免看起来只是普通冲击环
 ctx.strokeStyle='#fff8e8';ctx.lineWidth=1.4;
 for(let k=0;k<8;k++){const ang=k*Math.PI/4+pr*2;ctx.beginPath();ctx.moveTo(e.x+Math.cos(ang)*rad*.72,e.y+Math.sin(ang)*rad*.72);ctx.lineTo(e.x+Math.cos(ang+.1)*rad,e.y+Math.sin(ang+.1)*rad);ctx.stroke();}
 ctx.globalAlpha=1;
}
if(e.type==='npc'){pxRect(e.x-8,e.y-12,16,24,'#467a46');ctx.strokeStyle='#a8863a';ctx.strokeRect(e.x-8,e.y-12,16,24);}ctx.restore();}
function panelBox(x,y,w,h){pxRect(x,y,w,h,'rgba(20,20,20,.90)');ctx.strokeStyle='#4a433c';ctx.lineWidth=4;ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#a8863a';ctx.lineWidth=1;ctx.strokeRect(x+6,y+6,w-12,h-12);}
function bar(x,y,w,h,pct,bg,fg){pxRect(x,y,w,h,bg);pxRect(x+1,y+1,(w-2)*clamp(pct,0,1),h-2,fg);ctx.strokeStyle='#707070';ctx.strokeRect(x+.5,y+.5,w-1,h-1);}
function drawPortrait(x,y,id){pxRect(x,y,48,48,'#1b1b1b');ctx.strokeStyle='#a8863a';ctx.lineWidth=2;ctx.strokeRect(x,y,48,48);const key=`char:${id}:idle`,im=ART.img[key];if(artReady(key)){drawSheetFrame(im,0,0,48,64,Math.round(x+6),Math.round(y-3),36,48);return;}if(id==='knight'){pxRect(x+13,y+11,22,25,'#707070');pxRect(x+17,y+7,14,7,'#d6d0c8');pxRect(x+15,y+29,18,8,'#5a1f1f');}else if(id==='hunter'){pxRect(x+12,y+13,24,24,'#303030');pxRect(x+8,y+8,32,12,'#1b1b1b');pxRect(x+18,y+17,5,3,'#d6d0c8');}else{pxRect(x+13,y+10,22,29,'#1b1b1b');pxRect(x+9,y+7,30,12,'#303030');pxRect(x+21,y+16,6,4,'#6b3fa0');}}
function drawMiniMap(x,y,w,h){pxRect(x,y,w,h,'#111');ctx.strokeStyle='#4a433c';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);const sx=w/W,sy=h/H;pxRect(x+game.player.x*sx-2,y+game.player.y*sy-2,5,5,'#d6d0c8');for(const e of game.enemies){pxRect(x+e.x*sx-1,y+e.y*sy-1,e.isBoss?4:3,e.isBoss?4:3,e.isBoss?'#a8863a':'#a11f1f');}}
function skillIcon(x,y,i){const id=game.classId;pxRect(x,y,48,48,'#161616');ctx.strokeStyle='#665b4d';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,47,47);const c=id==='knight'?'#e8c878':id==='hunter'?'#7ab0d8':'#b58ae0';const c2=id==='knight'?'#a8863a':id==='hunter'?'#3e5870':'#6b3fa0';
 if(i===0){pxLine(x+10,y+38,x+38,y+10,c,5);pxLine(x+10,y+38,x+38,y+10,'#fff8e8',1);pxRect(x+34,y+6,6,6,c2);pxRect(x+8,y+36,4,4,c2);}
 if(i===1){ctx.strokeStyle=c;ctx.lineWidth=3;ctx.strokeRect(x+15,y+15,18,18);pxRect(x+21,y+7,6,7,c2);pxRect(x+21,y+34,6,7,c2);pxRect(x+7,y+21,7,6,c2);pxRect(x+34,y+21,7,6,c2);}
 if(i===2){ctx.strokeStyle=c;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+24,y+24,11,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=c2;ctx.beginPath();ctx.arc(x+24,y+24,17,0,Math.PI*2);ctx.stroke();pxRect(x+22,y+3,4,4,c);pxRect(x+22,y+41,4,4,c);}}
function cdPie(x,y,cell,frac){if(frac<=0)return;ctx.fillStyle='rgba(8,8,8,.78)';ctx.beginPath();ctx.moveTo(x+cell/2,y+cell/2);ctx.arc(x+cell/2,y+cell/2,cell*.62,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(frac,0,1));ctx.closePath();ctx.fill();}
// ---- HUD 静态层：面板框 / 头像 / 技能图标 / 固定键位文字烘一次，之后每帧只 1 次 drawImage ----
const hudCv=document.createElement('canvas');hudCv.width=W;hudCv.height=H;const hudx=hudCv.getContext('2d');
let hudKey='';
function hudTray(){const cell=52,gap=8,slots=5,tw=slots*cell+(slots-1)*gap;return {cell,gap,tw,tx0:(W-tw)/2,ty:H-84};}
function bakeHud(){
 const real=ctx;ctx=hudx;hudx.imageSmoothingEnabled=false;hudx.clearRect(0,0,W,H);
 panelBox(14,14,390,118);drawPortrait(27,29,game.classId);
 panelBox(W-190,14,176,196);
 const t=hudTray();
 panelBox(t.tx0-10,t.ty-10,t.tw+20,t.cell+32);
 for(let i=0;i<3;i++){const x=t.tx0+i*(t.cell+t.gap);skillIcon(x+2,t.ty+2,i);}
 const ddx=t.tx0+3*(t.cell+t.gap);
 pxRect(ddx+2,t.ty+2,t.cell-4,t.cell-4,'#161616');
 pxLine(ddx+15,t.ty+27,ddx+t.cell-15,t.ty+27,'#d6d0c8',3);pxLine(ddx+t.cell-22,t.ty+19,ddx+t.cell-14,t.ty+27,'#d6d0c8',3);pxLine(ddx+t.cell-22,t.ty+35,ddx+t.cell-14,t.ty+27,'#d6d0c8',3);
 const qx=t.tx0+4*(t.cell+t.gap);
 pxRect(qx+2,t.ty+2,t.cell-4,t.cell-4,'#161616');pxRect(qx+21,t.ty+13,10,4,'#7a4a2a');pxRect(qx+17,t.ty+17,18,17,'#a11f1f');pxRect(qx+19,t.ty+19,6,6,'#ff8a7a');
 ctx.fillStyle='#8b837a';ctx.font='10px monospace';ctx.textAlign='center';
 for(let i=0;i<3;i++)ctx.fillText(`${i+1}`,t.tx0+i*(t.cell+t.gap)+t.cell/2,t.ty+t.cell+13);
 ctx.fillText('空格',ddx+t.cell/2,t.ty+t.cell+13);ctx.fillText('Q',qx+t.cell/2,t.ty+t.cell+13);
 ctx.fillStyle='#707070';ctx.font='11px monospace';ctx.textAlign='right';ctx.fillText('Tab 背包 · C 属性 · B 商店',W-28,H-29);
 ctx=real;hudKey=`${game.classId}|${waveInfo().ch}|${save.settings.quality}`;
}
function drawHUD(){const p=game.player,wi=waveInfo(),t=hudTray();
 // —— 首领横幅血条（顶部居中，带阶段刻度与护盾条）——
 const boss=game.enemies.find(e=>e.isBoss);
 if(boss){const bw=470,x=W/2-bw/2,y=16;panelBox(x,y,bw,52);ctx.fillStyle='#d6d0c8';ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText(`${CHAPTERS[boss.ch].boss}${(boss.visualPhase||1)>1?' · 二阶段':''}`,W/2,y+20);bar(x+14,y+27,bw-28,12,clamp(boss.hp/boss.maxHp,0,1),'#3a1212','#a11f1f');if(boss.maxShield)pxRect(x+14,y+27,(bw-28)*clamp(boss.shield/boss.maxShield,0,1),4,'#5a90d0');for(let k=0;k<2;k++)pxRect(W/2-14+k*18,y+43,10,4,(boss.visualPhase||1)>k?'#ffd700':'#4a433c');}
 const key=`${game.classId}|${wi.ch}|${save.settings.quality}`;
 if(key!==hudKey)bakeHud();
 ctx.drawImage(hudCv,0,0);
 // —— 左侧：等级 / 生命 / 法力 / 经验 ——
 ctx.fillStyle='#d6d0c8';ctx.font='bold 13px monospace';ctx.textAlign='left';ctx.fillText(`${CLASS[game.classId].name}  LV.${game.level}`,85,39);
 bar(85,49,220,12,p.hp/p.maxHp,'#5a1f1f','#a11f1f');ctx.fillStyle='#d6d0c8';ctx.fillText(`${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`,313,59);
 let yy=67;if(p.maxMana){bar(85,yy,220,9,p.mana/p.maxMana,'#303030','#6b3fa0');yy+=15;}bar(85,yy,220,7,game.xp/game.xpNeed,'#303030','#6b3fa0');
 ctx.fillStyle='#707070';ctx.font='11px monospace';ctx.fillText(`经验 ${game.xp}/${game.xpNeed}`,85,yy+20);
 ctx.fillStyle='#a8863a';ctx.fillText(`护甲 ${Math.round(stat('armor')+hexOf('armor'))}   暴击 ${Math.round(clamp(stat('crit')+hexOf('crit'),0,.9)*100)}%`,215,yy+20);
 // —— 右侧：章节 / 关型 / 本关进度 / 小地图 ——
 const done=Math.max(0,game.remainMax-game.remain);
 ctx.textAlign='right';ctx.fillStyle='#d6d0c8';ctx.font='bold 14px monospace';ctx.fillText(`第${wi.ch+1}章 ${CHAPTERS[wi.ch].name}`,W-27,38);
 ctx.fillStyle=wi.blood?'#ff5a4a':wi.boss?'#a11f1f':wi.elite?'#3e5870':'#707070';ctx.fillText(`${wi.ch+1}-${wi.stage} ${wi.blood?'血月':wi.boss?'首领':wi.elite?'精英':'普通'}`,W-27,57);
 ctx.font='bold 12px monospace';ctx.fillStyle=game.remain<=0?'#7ad87a':'#a8863a';ctx.fillText(`本关 ${done}/${game.remainMax}`,W-27,75);
 drawMiniMap(W-174,84,144,104);
 // —— 底部托盘动态层：蓝量遮挡 / 冷却扇形 / 计时 ——
 for(let i=0;i<3;i++){const x=t.tx0+i*(t.cell+t.gap);const cost=CLASS[game.classId].skills[i][2]||0;if(cost&&p.mana<cost){ctx.fillStyle='rgba(20,30,70,.55)';ctx.fillRect(x+2,t.ty+2,t.cell-4,t.cell-4);}const frac=p.skillCd[i]>0?clamp(p.skillCd[i]/((p.skillCdMax||[])[i]||1),0,1):0;cdPie(x,t.ty,t.cell,frac);if(p.skillCd[i]>0){ctx.fillStyle='#d6d0c8';ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText(p.skillCd[i].toFixed(1),x+t.cell/2,t.ty+t.cell/2+5);}}
 const ddx=t.tx0+3*(t.cell+t.gap),qx=t.tx0+4*(t.cell+t.gap);
 ctx.strokeStyle=p.dodgeCd>0?'#5a544c':'#a8863a';ctx.lineWidth=2;ctx.strokeRect(ddx+2,t.ty+2,t.cell-4,t.cell-4);
 cdPie(ddx,t.ty,t.cell,p.dodgeCd>0?p.dodgeCd/1.5:0);
 ctx.strokeStyle=game.potions>0?'#a8863a':'#5a544c';ctx.lineWidth=2;ctx.strokeRect(qx+2,t.ty+2,t.cell-4,t.cell-4);
 ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(`${game.potions}`,qx+t.cell-9,t.ty+15);
 // —— 连击与金币 ——
 ctx.textAlign='left';ctx.fillStyle=game.combo>=30?'#ff9a3c':'#a8863a';ctx.font=`bold ${Math.min(24,14+game.combo/4)}px monospace`;ctx.fillText(`连击 ${game.combo}`,20,H-48);ctx.font='11px monospace';ctx.fillStyle='#d6d0c8';ctx.fillText(`伤害 +${Math.round(Math.min(game.combo,30)*1.2)}%${game.combo>=30?' · 暴走中':''}`,20,H-30);ctx.textAlign='right';ctx.fillStyle='#a8863a';ctx.font='bold 14px monospace';ctx.fillText(`◆ ${game.gold}`,W-28,H-49);
 // —— 交互提示：通道优先（同位置只显示一条，避免文字叠字）——
 const po=game.portal,pd=po?(p.x-po.x)*(p.x-po.x)+(p.y-po.y)*(p.y-po.y):1e9;
 if(po&&game.state==='portal_ready'&&!game.paused&&pd<=po.r*po.r){
  panelBox(W/2-110,H-146,220,32);ctx.textAlign='center';ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.fillText('[ E ] 进入下一关',W/2,H-124);
 }else{
  const nearProp=game.props.find(pr=>!pr.used&&dist(p,pr)<46),nearDrop=game.drops.find(d=>d.type==='equip'&&dist(p,d)<42);
  if(nearProp||nearDrop){panelBox(W/2-110,H-146,220,32);ctx.textAlign='center';ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.fillText(nearProp?`[ E ] ${PROP_PROMPT[nearProp.type]}`:'[ E ] 拾取装备',W/2,H-124);}
 }
 if(game.waveBanner>0){ctx.textAlign='center';ctx.font='bold 26px monospace';ctx.fillStyle=wi.blood?'#ff5a4a':wi.boss?'#a11f1f':wi.elite?'#3e5870':'#d6d0c8';ctx.fillText(wi.blood?'× 血月侵袭 ×':wi.boss?`首领 · ${CHAPTERS[wi.ch].boss}`:wi.elite?'精英来袭':`关卡 ${wi.ch+1}-${wi.stage}`,W/2,165);}
 if(showPerf){ctx.textAlign='left';ctx.font='11px monospace';ctx.fillStyle=fpsVal>=55?'#7ad87a':fpsVal>=40?'#e8c878':'#ff6b5a';ctx.fillText(`FPS ${fpsVal} · JS ${game.jsMs.toFixed(2)}ms`,20,H-148);ctx.fillStyle='#8b837a';ctx.fillText(`粒子 ${game.particles.length}/${particleBudget()} · 敌 ${game.enemies.length} · 弹 ${game.projectiles.length+game.enemyProjectiles.length} · 特效 ${game.effects.length} · 残留 ${game.decals.length}`,20,H-134);}
}

function togglePause(){if(!game.running||game.hexOpen)return;game.paused=!game.paused;if(game.paused)$('pausePanel').classList.remove('hidden');else hide('pausePanel');}
function openInventory(){if(!game.running||game.hexOpen)return;game.paused=true;renderInventory();$('inventoryPanel').classList.remove('hidden');}

let showPerf=false;
window.addEventListener('keydown',e=>{game.keys[e.code]=true;if(e.repeat)return;noteInput(true);if(e.code==='Space'){e.preventDefault();dodge();}if(e.code==='Digit1')castSkill(0);if(e.code==='Digit2')castSkill(1);if(e.code==='Digit3')castSkill(2);if(e.code==='KeyQ')usePotion();if(e.code==='KeyE'){if(!tryPortalEnter())interactNearest();}if(e.code==='Tab'){e.preventDefault();if($('inventoryPanel').classList.contains('hidden'))openInventory();else{$('inventoryPanel').classList.add('hidden');game.paused=false;}}if(e.code==='Escape')togglePause();if(e.code==='KeyB')openShop();if(e.code==='KeyC'){e.preventDefault();if($('statsPanel').classList.contains('hidden'))openStats();else closeStats();}if(e.code==='F2')$('debugPanel').classList.toggle('hidden');if(e.code==='F3'){e.preventDefault();showPerf=!showPerf;}});
window.addEventListener('keyup',e=>game.keys[e.code]=false);
// 鼠标移动也算有效输入：清零 12s 挂机计时，但不跳过清场演出（否则鼠标一晃演出就没了）
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();game.mouse.x=(e.clientX-r.left)*W/r.width;game.mouse.y=(e.clientY-r.top)*H/r.height;noteInput(false);});canvas.addEventListener('mousedown',e=>{if(e.button===0){game.mouse.down=true;noteInput(true);}});window.addEventListener('mouseup',e=>{if(e.button===0)game.mouse.down=false});
// 屏蔽右键菜单（战斗中误触右键会打断操作）
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('contextmenu',e=>{if(game.running&&game.screen==='game')e.preventDefault();});

// ---- 音频解锁：浏览器要求首次用户手势后才能播放 ----
function unlockAudio(){SFX.init();SFX.resume();}
window.addEventListener('pointerdown',unlockAudio,{passive:true});
window.addEventListener('keydown',unlockAudio,{passive:true});

// ---- 失焦自动暂停：alt-tab 回来不再"人已经死了" ----
window.addEventListener('blur',()=>{if(game.running&&game.screen==='game'&&!game.paused){game.keys={};game.mouse.down=false;togglePause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.running&&game.screen==='game'&&!game.paused){game.keys={};game.mouse.down=false;togglePause();}});

// ---- 整数倍缩放：像素游戏只在整数倍下才锐利，小数倍会出现像素格大小不均 ----
function fitCanvas(){
 const app=$('app');const aw=app.clientWidth||window.innerWidth,ah=app.clientHeight||window.innerHeight;
 const raw=Math.min(aw/W,ah/H);
 let s=raw;
 if(save.settings.integerScale!==false){
  if(raw>=1)s=Math.floor(raw);              // ≥1 时取整数倍，四周留黑边
  else s=raw;                                // 窗口比画布还小时只能铺满
 }
 canvas.style.position='absolute';canvas.style.left='50%';canvas.style.top='50%';
 canvas.style.transform='translate(-50%,-50%)';
 canvas.style.width=Math.round(W*s)+'px';canvas.style.height=Math.round(H*s)+'px';
}
window.addEventListener('resize',fitCanvas);
window.addEventListener('orientationchange',fitCanvas);
window.addEventListener('load',fitCanvas);
// 容器尺寸变化时自动重算（全屏切换 / 布局变动 / 首次布局稳定后）
try{if(window.ResizeObserver)new ResizeObserver(()=>fitCanvas()).observe($('app'));}catch(e){}

$('startBtn').onclick=()=>show('classSelect');$('campBtn').onclick=()=>{buildCamp();show('campPanel')};$('achBtn').onclick=()=>{buildAch();show('achPanel')};$('dailyBtn').onclick=()=>{game.pendingDaily=true;show('classSelect')};$('controlsBtn').onclick=()=>show('controlsPanel');$('settingsBtn').onclick=()=>show('settingsPanel');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>showMenu());$('difficultySelect').onchange=e=>game.difficulty=e.target.value;$('volumeInput').value=save.settings.volume;$('qualitySelect').value=save.settings.quality;$('volumeInput').oninput=e=>{save.settings.volume=+e.target.value;SFX.vol(save.settings.volume);persist()};$('qualitySelect').onchange=e=>{save.settings.quality=e.target.value;persist()};function applyScanlines(){document.getElementById('app').classList.toggle('no-scan',save.settings.scanlines===false);}function bindToggle(id,key,after){const el=$(id);if(!el)return;el.checked=save.settings[key]!==false;el.onchange=()=>{save.settings[key]=el.checked;SFX.play('ui');persist();after&&after();};}
function syncToggles(){['shakeToggle|screenShake','dmgToggle|damageNumbers','lightToggle|lighting','scanToggle|scanlines','scaleToggle|integerScale'].forEach(s=>{const [id,key]=s.split('|'),el=$(id);if(el)el.checked=save.settings[key]!==false;});}
bindToggle('shakeToggle','screenShake');bindToggle('dmgToggle','damageNumbers');bindToggle('lightToggle','lighting');bindToggle('scanToggle','scanlines',applyScanlines);bindToggle('scaleToggle','integerScale',fitCanvas);applyScanlines();syncToggles();

// ---- 存档导出 / 导入 ----
function exportSave(){
 const data=JSON.stringify(save);
 try{navigator.clipboard&&navigator.clipboard.writeText(data).catch(()=>{});}catch(e){}
 try{const blob=new Blob([data],{type:'application/json'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`dark_oath_save_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(a.href),1500);}catch(e){}
 SFX.play('ui');toast('存档已导出（并复制到剪贴板）');
}
function importSave(file){
 const r=new FileReader();
 r.onload=()=>{try{
  const o=JSON.parse(r.result);
  if(!o||typeof o!=='object'||Array.isArray(o))throw new Error('bad');
  save=Object.assign(defaultSave(),o);
  save.upgrades=Object.assign(defaultSave().upgrades,save.upgrades||{});
  save.settings=Object.assign(defaultSave().settings,save.settings||{});
  save.stats=Object.assign(defaultSave().stats,save.stats||{});
  save.daily=Object.assign(defaultSave().daily,save.daily||{});
  save.achievements=save.achievements||{};
  persist();
  $('volumeInput').value=save.settings.volume;$('qualitySelect').value=save.settings.quality;
  applyScanlines();syncToggles();buildCamp();updateSaveSummary();fitCanvas();
  SFX.vol(save.settings.volume);SFX.play('ach');toast('存档导入成功');
 }catch(e){SFX.play('deny');toast('存档文件无效');}};
 r.onerror=()=>{SFX.play('deny');toast('读取文件失败');};
 r.readAsText(file);
}
if($('exportSaveBtn'))$('exportSaveBtn').onclick=exportSave;
if($('importSaveFile'))$('importSaveFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)importSave(f);e.target.value='';};
if($('fullscreenBtn'))$('fullscreenBtn').onclick=()=>{
 const el=document.documentElement;
 if(!document.fullscreenElement){(el.requestFullscreen||el.webkitRequestFullscreen||(()=>{})).call(el);}
 else{(document.exitFullscreen||document.webkitExitFullscreen||(()=>{})).call(document);}
 SFX.play('ui');
};
// 所有按钮统一 UI 音效
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('button'))SFX.play('ui');},true);$('closeInventory').onclick=()=>{hide('inventoryPanel');game.paused=false};$('inventoryStatsBtn').onclick=openStats;$('closeStats').onclick=closeStats;$('closeShop').onclick=()=>{hide('shopPanel');game.paused=false};$('resumeBtn').onclick=()=>{hide('pausePanel');game.paused=false};$('quitBtn').onclick=()=>{hide('pausePanel');endRun(false)};$('resultMenuBtn').onclick=()=>{hide('resultPanel');showMenu()};
$('debugJump').onclick=()=>{if(!game.running||game.hexOpen)return;game.wave=clamp(+$('debugWave').value||1,1,100);game.enemies=[];game.effects=[];game.projectiles=[];game.enemyProjectiles=[];game.portal=null;game.waveState='idle';spawnLevel();};$('debugHeal').onclick=()=>{if(game.player){game.player.hp=game.player.maxHp;game.player.mana=game.player.maxMana;}};$('debugGold').onclick=()=>game.gold+=1000;$('debugDamage').onclick=()=>game.damageMult*=2;$('debugKill').onclick=()=>{for(let i=game.enemies.length-1;i>=0;i--)killEnemy(game.enemies[i]);};

// ---- 开发调试钩子：仅当 URL 带 ?dev=1 时暴露，正常游玩不受影响 ----
if(new URLSearchParams(location.search).has('dev'))window.__oath={game,save,startRun,castSkill,basicAttack,dodge,usePotion,spawnEnemy,spawnWave,spawnLevel,levelPlan,levelStage,spawnProp,useProp,waveInfo,damageEnemy,killEnemy,spawnParticles,triggerZoom,HEX_POOL,HEX_BY_ID,applyHex,recalcHex,rollHexOptions,openHex,chooseHex,beginPortal,portalAnchor,portalHitsHud,beginPortalEnter,updatePortalEnter,tryPortalEnter,addDecal,hexOf,W,H,CLASS,QUAL,SLOT,makeEquipment,dropEquipment};

loadArt();buildClassCards();updateSaveSummary();initAmbient();fitCanvas();SFX.init();showMenu();requestAnimationFrame(loop);
})();
