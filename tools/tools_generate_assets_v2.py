from PIL import Image, ImageDraw
from pathlib import Path
import math, json, random
ROOT=Path(__file__).parent.parent/'Assets'
P={'black':'#1B1B1B','iron':'#303030','darkred':'#5A1F1F','red':'#A11F1F','bone':'#D6D0C8','gold':'#A8863A','purple':'#6B3FA0','blue':'#3E5870','green':'#467A46','ash':'#707070'}
DIRS=['down','down_left','left','up_left','up','up_right','right','down_right']
ACTIONS={'idle':6,'walk':8,'attack':6,'hit':3,'death':8,'skill1':8,'skill2':10,'skill3':12}

def dir_vec(i):
    a=math.pi/2+i*math.pi/4
    return math.cos(a),math.sin(a)

def poly(d, pts, fill): d.polygon([(round(x),round(y)) for x,y in pts], fill=fill)
def rect(d, box, fill): d.rectangle(tuple(round(v) for v in box), fill=fill)
def line(d, pts, fill, w=1): d.line([(round(x),round(y)) for x,y in pts], fill=fill, width=w)

def draw_char_frame(cid, di, action, fi, fw=48, fh=64):
    im=Image.new('RGBA',(fw,fh),(0,0,0,0)); d=ImageDraw.Draw(im)
    vx,vy=dir_vec(di); px,py=-vy,vx
    bob=0
    if action=='idle': bob=[0,0,-1,-1,0,0][fi%6]
    if action=='walk': bob=[0,-1,-2,-1,0,1,0,-1][fi%8]
    cx,cy=24,39+bob
    # shadow
    d.ellipse((15,52,33,57), fill=(27,27,27,150))
    death = action=='death'
    hit = action=='hit'
    if death:
        t=fi/max(1,ACTIONS[action]-1); cx+=int(8*t); cy+=int(8*t)
    # cloak/body silhouette
    if cid=='knight':
        body=P['iron']; hi=P['ash']; accent=P['darkred']; skin=P['bone']
        poly(d,[(cx-7,cy-14),(cx+7,cy-14),(cx+9,cy+9),(cx-9,cy+9)],body)
        rect(d,(cx-8,cy-6,cx+8,cy-2),hi)
        # helmet
        poly(d,[(cx-7,cy-23),(cx+7,cy-23),(cx+6,cy-13),(cx-6,cy-13)],hi)
        poly(d,[(cx,cy-28),(cx-5,cy-22),(cx+5,cy-22)],skin)
        rect(d,(cx-5,cy-19,cx+5,cy-17),P['black']); rect(d,(cx-4,cy-19,cx-2,cy-18),P['red'])
        # cape opposite facing
        ox=-vx*5; oy=-vy*3
        poly(d,[(cx-5+ox,cy-9+oy),(cx+5+ox,cy-9+oy),(cx+4+ox,cy+10+oy),(cx-6+ox,cy+8+oy)],accent)
        # shield left side relative to facing
        sx=cx+px*10+vx*1; sy=cy+py*10+vy*1
        poly(d,[(sx-5,sy-7),(sx+5,sy-7),(sx+6,sy+3),(sx,sy+9),(sx-6,sy+3)],P['ash'])
        line(d,[(sx,sy-5),(sx,sy+6)],P['gold'],1); line(d,[(sx-4,sy),(sx+4,sy)],P['gold'],1)
        # sword swing/orientation
        ang=math.atan2(vy,vx)
        if action in ('attack','skill1','skill3'):
            swing=((fi/(max(1,ACTIONS[action]-1)))-.5)*1.8
            ang+=swing
        wx=cx-px*9; wy=cy-py*9
        ex=wx+math.cos(ang)*18; ey=wy+math.sin(ang)*18
        line(d,[(wx,wy),(ex,ey)],P['bone'],3); line(d,[(wx,wy),(wx-px*4,wy-py*4)],P['gold'],2)
        if action=='skill2':
            rr=10+(fi%5)*2; d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),outline=P['gold'],width=2)
        if action=='skill3':
            d.arc((cx-19,cy-19,cx+19,cy+19),start=fi*28,end=fi*28+230,fill=P['bone'],width=2)
    elif cid=='hunter':
        poly(d,[(cx-7,cy-14),(cx+7,cy-14),(cx+8,cy+9),(cx-8,cy+9)],P['iron'])
        poly(d,[(cx-11,cy-21),(cx+11,cy-21),(cx+7,cy-11),(cx-7,cy-11)],P['black'])
        rect(d,(cx-3,cy-17,cx+3,cy-15),P['bone'])
        # belt
        rect(d,(cx-8,cy-3,cx+8,cy),P['gold'])
        # dual pistols
        for s in (-1,1):
            ox=px*8*s; oy=py*8*s; wx=cx+ox+vx*2; wy=cy+oy+vy*2
            ex=wx+vx*15; ey=wy+vy*15
            line(d,[(wx,wy),(ex,ey)],P['ash'],3); rect(d,(wx-2,wy-2,wx+2,wy+2),P['gold'])
            if action=='attack' and fi in (2,3): rect(d,(ex-2,ey-2,ex+3,ey+3),P['gold'])
        if action=='skill1':
            for k in range(3): rect(d,(cx-int(vx*(8+6*k))-2,cy-int(vy*(8+6*k))-2,cx-int(vx*(8+6*k))+2,cy-int(vy*(8+6*k))+2),P['ash'])
        if action=='skill2':
            d.rectangle((cx-12,cy+5,cx+12,cy+17),outline=P['blue'],width=2)
        if action=='skill3':
            for k in range(4): line(d,[(cx-16+k*10,cy-26),(cx-20+k*10,cy+5)],P['bone'],1)
    else:
        # mage
        poly(d,[(cx,cy-24),(cx-11,cy-10),(cx-9,cy+12),(cx+9,cy+12),(cx+11,cy-10)],P['black'])
        poly(d,[(cx,cy-24),(cx-10,cy-14),(cx+10,cy-14)],P['iron'])
        rect(d,(cx-3,cy-17,cx+3,cy-15),P['purple'])
        # robe runes
        for yy in (cy-6,cy+1,cy+7): rect(d,(cx-2,yy,cx+2,yy+1),P['purple'])
        # staff to side
        sx=cx+px*10; sy=cy+py*10
        line(d,[(sx,sy+8),(sx+vx*2,sy-15)],P['ash'],2)
        rr=3+(1 if action in ('attack','skill2','skill3') else 0)
        d.ellipse((sx+vx*2-rr,sy-15-rr,sx+vx*2+rr,sy-15+rr),fill=P['purple'])
        if action=='attack':
            bx=cx+vx*(10+fi*2); by=cy+vy*(10+fi*2); d.ellipse((bx-3,by-3,bx+3,by+3),fill=P['purple'])
        if action=='skill1': d.ellipse((cx-12-fi,cy-12-fi,cx+12+fi,cy+12+fi),outline=P['blue'],width=2)
        if action=='skill2': d.ellipse((cx-10,cy-18,cx+10,cy+2),outline=P['purple'],width=2)
        if action=='skill3':
            rect(d,(cx-5,cy-30+fi%4,cx+5,cy-20+fi%4),P['red']); rect(d,(cx-2,cy-27+fi%4,cx+2,cy-22+fi%4),P['gold'])
    if hit and fi==0:
        # white flash hard pixels
        d.rectangle((18,18,30,44),outline=P['bone'],width=2)
    if death:
        alpha=max(0,255-int(210*fi/(ACTIONS[action]-1))); im.putalpha(Image.eval(im.getchannel('A'),lambda a: min(a,alpha)))
    return im

def save_char(cid):
    out=ROOT/'characters'/cid; out.mkdir(parents=True,exist_ok=True)
    for action,frames in ACTIONS.items():
        sheet=Image.new('RGBA',(48*frames,64*8),(0,0,0,0))
        for di in range(8):
            for fi in range(frames): sheet.alpha_composite(draw_char_frame(cid,di,action,fi),(fi*48,di*64))
        sheet.save(out/f'{action}.png')

def draw_monster_frame(mid,di,action,fi,size=48):
    im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); vx,vy=dir_vec(di); px,py=-vy,vx
    c=size//2; cy=int(size*.58); bob=-1 if action=='walk' and fi%2 else 0; cy+=bob
    d.ellipse((c-size*.18,cy+size*.18,c+size*.18,cy+size*.26),fill=(27,27,27,150))
    scale=size/48
    def R(x1,y1,x2,y2,col): rect(d,(c+x1*scale,cy+y1*scale,c+x2*scale,cy+y2*scale),col)
    if mid=='ratman':
        poly(d,[(c-7*scale,cy-8*scale),(c+7*scale,cy-8*scale),(c+6*scale,cy+8*scale),(c-6*scale,cy+8*scale)],P['iron']);
        poly(d,[(c-7*scale,cy-11*scale),(c-2*scale,cy-17*scale),(c,cy-10*scale)],P['ash']); poly(d,[(c+7*scale,cy-11*scale),(c+2*scale,cy-17*scale),(c,cy-10*scale)],P['ash']);
        R(-4,-10,-2,-8,P['red']); R(2,-10,4,-8,P['red']); line(d,[(c+px*5,cy+py*5),(c+px*5+vx*13,cy+py*5+vy*13)],P['bone'],2)
    elif mid=='werewolf':
        poly(d,[(c,cy-20*scale),(c-10*scale,cy-10*scale),(c-8*scale,cy+10*scale),(c+8*scale,cy+10*scale),(c+10*scale,cy-10*scale)],P['ash']);
        poly(d,[(c-8*scale,cy-17*scale),(c-3*scale,cy-25*scale),(c,cy-17*scale)],P['iron']); poly(d,[(c+8*scale,cy-17*scale),(c+3*scale,cy-25*scale),(c,cy-17*scale)],P['iron']);
        R(-5,-16,-2,-13,P['red']);R(2,-16,5,-13,P['red'])
        # claws
        for s in (-1,1):
            bx=c+px*12*s; by=cy+py*12*s; line(d,[(bx,by),(bx+vx*12,by+vy*12)],P['bone'],2)
    elif mid=='witch':
        poly(d,[(c,cy-24*scale),(c-11*scale,cy-7*scale),(c-8*scale,cy+12*scale),(c+8*scale,cy+12*scale),(c+11*scale,cy-7*scale)],P['black']);
        poly(d,[(c,cy-28*scale),(c-12*scale,cy-16*scale),(c+9*scale,cy-17*scale)],P['iron']); R(-3,-15,3,-12,P['green']);
        sx=c+px*10;sy=cy+py*10; line(d,[(sx,sy+9),(sx+vx*2,sy-16)],P['ash'],2); d.ellipse((sx+vx*2-3,sy-19,sx+vx*2+3,sy-13),fill=P['green'])
    elif mid=='cyclops':
        poly(d,[(c-13*scale,cy-15*scale),(c+13*scale,cy-15*scale),(c+16*scale,cy+13*scale),(c-16*scale,cy+13*scale)],P['ash']);
        d.ellipse((c-6*scale,cy-13*scale,c+6*scale,cy-3*scale),fill=P['gold']);R(-2,-10,2,-6,P['black']);
        # club
        bx=c+px*14;by=cy+py*14; line(d,[(bx,by),(bx+vx*20,by+vy*20)],P['iron'],5)
    else: # cultist
        poly(d,[(c,cy-22*scale),(c-10*scale,cy-8*scale),(c-8*scale,cy+11*scale),(c+8*scale,cy+11*scale),(c+10*scale,cy-8*scale)],P['black']);
        poly(d,[(c,cy-22*scale),(c-9*scale,cy-13*scale),(c+9*scale,cy-13*scale)],P['purple']); R(-4,-14,-1,-12,P['red']);R(1,-14,4,-12,P['red'])
    if action=='attack':
        # forward motion
        pass
    if action=='hit': d.rectangle((int(size*.28),int(size*.2),int(size*.72),int(size*.75)),outline=P['bone'],width=max(1,int(scale)))
    if action=='death':
        # pixel dissolve blocks
        for k in range(fi+1):
            xx=(k*11+di*3)%max(2,size-8); yy=(k*7+fi*5)%max(2,size-8); rect(d,(xx,yy,xx+3,yy+3),(0,0,0,0))
    return im

def save_mon(mid,size):
    out=ROOT/'monsters/common';out.mkdir(parents=True,exist_ok=True)
    frames={'idle':4,'walk':6,'attack':5,'hit':2,'death':6}
    for action,n in frames.items():
        sh=Image.new('RGBA',(size*n,size*8),(0,0,0,0))
        for di in range(8):
            for fi in range(n): sh.alpha_composite(draw_monster_frame(mid,di,action,fi,size),(fi*size,di*size))
        sh.save(out/f'{mid}_{action}.png')

def boss_shape(bid,di,fi,size,phase):
    im=Image.new('RGBA',(size,size),(0,0,0,0));d=ImageDraw.Draw(im);vx,vy=dir_vec(di);px,py=-vy,vx;c=size//2;cy=int(size*.58)+(fi%2)
    d.ellipse((size*.22,size*.72,size*.78,size*.83),fill=(27,27,27,170))
    s=size/96
    if bid=='wolf_king':
        col=P['ash'] if phase==1 else P['darkred']; poly(d,[(c,cy-34*s),(c-24*s,cy-12*s),(c-20*s,cy+22*s),(c+20*s,cy+22*s),(c+24*s,cy-12*s)],col)
        poly(d,[(c-18*s,cy-24*s),(c-8*s,cy-39*s),(c-2*s,cy-24*s)],P['iron']);poly(d,[(c+18*s,cy-24*s),(c+8*s,cy-39*s),(c+2*s,cy-24*s)],P['iron'])
        rect(d,(c-11*s,cy-21*s,c-5*s,cy-16*s),P['red']);rect(d,(c+5*s,cy-21*s,c+11*s,cy-16*s),P['red'])
        for sg in (-1,1):
            bx=c+px*25*sg;by=cy+py*25*sg; line(d,[(bx,by),(bx+vx*22,by+vy*22)],P['bone'],max(2,int(3*s)))
        if phase==2:d.ellipse((c-34*s,cy-36*s,c+34*s,cy+30*s),outline=P['red'],width=max(2,int(2*s)))
    elif bid=='bat_lord':
        col=P['purple'] if phase==2 else P['iron'];
        # wings
        poly(d,[(c,cy-5*s),(c-38*s,cy-28*s),(c-45*s,cy+4*s),(c-22*s,cy-2*s),(c-32*s,cy+24*s),(c,cy+8*s)],col)
        poly(d,[(c,cy-5*s),(c+38*s,cy-28*s),(c+45*s,cy+4*s),(c+22*s,cy-2*s),(c+32*s,cy+24*s),(c,cy+8*s)],col)
        d.ellipse((c-13*s,cy-25*s,c+13*s,cy+14*s),fill=P['black']);rect(d,(c-8*s,cy-15*s,c-4*s,cy-11*s),P['red']);rect(d,(c+4*s,cy-15*s,c+8*s,cy-11*s),P['red'])
        poly(d,[(c-5*s,cy+6*s),(c,cy+15*s),(c+5*s,cy+6*s)],P['bone'])
    elif bid=='elder_witch':
        poly(d,[(c,cy-38*s),(c-25*s,cy-12*s),(c-17*s,cy+28*s),(c+17*s,cy+28*s),(c+25*s,cy-12*s)],P['black']);poly(d,[(c,cy-43*s),(c-24*s,cy-23*s),(c+18*s,cy-26*s)],P['iron']);
        face=P['green'] if phase==2 else P['bone'];rect(d,(c-7*s,cy-23*s,c+7*s,cy-13*s),face);sx=c+px*25;sy=cy+py*25;line(d,[(sx,sy+18*s),(sx+vx*3,sy-30*s)],P['ash'],max(2,int(3*s)));d.ellipse((sx+vx*3-7*s,sy-37*s,sx+vx*3+7*s,sy-23*s),fill=P['green'])
        if phase==2:
            for a in range(0,360,60):x=c+math.cos(math.radians(a))*34*s;y=cy+math.sin(math.radians(a))*28*s;rect(d,(x-3*s,y-3*s,x+3*s,y+3*s),P['green'])
    elif bid=='cyclops_chief':
        col=P['ash'] if phase==1 else P['darkred'];poly(d,[(c-34*s,cy-30*s),(c+34*s,cy-30*s),(c+42*s,cy+34*s),(c-42*s,cy+34*s)],col);d.ellipse((c-14*s,cy-22*s,c+14*s,cy+2*s),fill=P['gold']);rect(d,(c-4*s,cy-15*s,c+4*s,cy-7*s),P['black'])
        bx=c+px*38;by=cy+py*38;line(d,[(bx,by),(bx+vx*42,by+vy*42)],P['iron'],max(5,int(8*s)))
        if phase==2:
            for off in (-20,-7,8,22): line(d,[(c+off*s,cy-25*s),(c+(off+8)*s,cy+18*s)],P['red'],max(1,int(2*s)))
    else:
        poly(d,[(c,cy-42*s),(c-31*s,cy-19*s),(c-24*s,cy+30*s),(c+24*s,cy+30*s),(c+31*s,cy-19*s)],P['black']);
        # armor shoulders
        d.ellipse((c-37*s,cy-22*s,c-13*s,cy+3*s),fill=P['iron']);d.ellipse((c+13*s,cy-22*s,c+37*s,cy+3*s),fill=P['iron']);rect(d,(c-9*s,cy-29*s,c+9*s,cy-12*s),P['purple']);
        sx=c-px*25;sy=cy-py*25;line(d,[(sx,sy),(sx+vx*28,sy+vy*28)],P['purple'],max(3,int(4*s)))
        if phase==2:
            d.ellipse((c-42*s,cy-43*s,c+42*s,cy+34*s),outline=P['purple'],width=max(2,int(3*s)))
            for a in range(0,360,45):x=c+math.cos(math.radians(a))*40*s;y=cy+math.sin(math.radians(a))*34*s;rect(d,(x-3*s,y-3*s,x+3*s,y+3*s),P['purple'])
    return im

def save_boss(bid,size):
    out=ROOT/'bosses';out.mkdir(parents=True,exist_ok=True)
    for ph in (1,2):
        sh=Image.new('RGBA',(size*6,size*8),(0,0,0,0))
        for di in range(8):
            for fi in range(6): sh.alpha_composite(boss_shape(bid,di,fi,size,ph),(fi*size,di*size))
        sh.save(out/f'{bid}_phase{ph}.png')

def tile_floor(d,x,y,ch,v):
    cols={
    'dungeon':(P['iron'],P['ash'],P['darkred']), 'forest':(P['black'],P['green'],P['iron']), 'swamp':(P['black'],P['green'],P['purple']), 'ruins':(P['iron'],P['ash'],P['gold']), 'temple':(P['black'],P['iron'],P['darkred'])}
    a,b,c=cols[ch];rect(d,(x,y,x+31,y+31),a)
    # block/organic pattern
    if ch in ('dungeon','ruins','temple'):
        line(d,[(x,y+15),(x+31,y+15)],b,1);line(d,[(x+15,y),(x+15,y+15)],b,1);line(d,[(x+7,y+15),(x+7,y+31)],b,1)
    else:
        for k in range(7):
            xx=x+((k*11+v*5)%28)+2;yy=y+((k*7+v*3)%26)+3;rect(d,(xx,yy,xx+2,yy+2),b)
    if v%5==0: line(d,[(x+4,y+25),(x+14,y+20),(x+23,y+23)],c,2)

def tile_prop(d,x,y,ch,v):
    cx=x+16;cy=y+18
    if ch=='dungeon':
        if v%4==0: rect(d,(cx-5,cy-12,cx+5,cy+9),P['ash']);rect(d,(cx-2,cy-16,cx+2,cy-10),P['gold'])
        elif v%4==1: rect(d,(cx-9,cy-6,cx+9,cy+8),P['darkred']);line(d,[(cx-9,cy),(cx+9,cy)],P['gold'],1)
        elif v%4==2: d.ellipse((cx-8,cy-6,cx+8,cy+8),outline=P['bone'],width=2);rect(d,(cx-2,cy+7,cx+2,cy+12),P['bone'])
        else: rect(d,(cx-10,cy-13,cx+10,cy+13),P['iron']);line(d,[(cx-7,cy-13),(cx-7,cy+13)],P['ash'],2);line(d,[(cx+7,cy-13),(cx+7,cy+13)],P['ash'],2)
    elif ch=='forest':
        if v%3==0: rect(d,(cx-3,cy-12,cx+3,cy+10),P['ash']);poly(d,[(cx,cy-15),(cx-11,cy-4),(cx+11,cy-4)],P['green'])
        elif v%3==1: d.ellipse((cx-11,cy-5,cx+11,cy+8),fill=P['green']);rect(d,(cx-2,cy+6,cx+2,cy+12),P['iron'])
        else: d.ellipse((cx-6,cy-2,cx+6,cy+8),fill=P['darkred']);rect(d,(cx-1,cy+7,cx+1,cy+11),P['bone'])
    elif ch=='swamp':
        if v%3==0: d.ellipse((cx-11,cy-4,cx+11,cy+8),outline=P['green'],width=2);d.ellipse((cx-3,cy-7,cx+3,cy-1),outline=P['purple'],width=1)
        elif v%3==1: rect(d,(cx-4,cy-13,cx+4,cy+10),P['iron']);line(d,[(cx-8,cy-8),(cx+7,cy-2)],P['green'],2)
        else: rect(d,(cx-6,cy-8,cx+6,cy+8),P['ash']);rect(d,(cx-2,cy-13,cx+2,cy-8),P['gold'])
    elif ch=='ruins':
        if v%3==0: rect(d,(cx-7,cy-14,cx+7,cy+12),P['ash']);line(d,[(cx-7,cy-4),(cx+7,cy-4)],P['iron'],2)
        elif v%3==1: poly(d,[(cx-12,cy+8),(cx-6,cy-5),(cx+2,cy+1),(cx+10,cy-7),(cx+12,cy+9)],P['iron'])
        else: d.ellipse((cx-10,cy-9,cx+10,cy+9),outline=P['bone'],width=2);rect(d,(cx-2,cy+7,cx+2,cy+13),P['bone'])
    else:
        if v%3==0: rect(d,(cx-5,cy-13,cx+5,cy+10),P['iron']);rect(d,(cx-2,cy-18,cx+2,cy-13),P['red'])
        elif v%3==1: d.ellipse((cx-11,cy-9,cx+11,cy+11),outline=P['purple'],width=2);line(d,[(cx-9,cy),(cx+9,cy)],P['darkred'],1);line(d,[(cx,cy-8),(cx,cy+8)],P['darkred'],1)
        else: poly(d,[(cx-11,cy+10),(cx-6,cy-10),(cx+6,cy-10),(cx+11,cy+10)],P['darkred']);rect(d,(cx-4,cy-15,cx+4,cy-10),P['gold'])

def save_tiles(ch):
    im=Image.new('RGBA',(256,256),(0,0,0,0));d=ImageDraw.Draw(im)
    for idx in range(64):
        x=(idx%8)*32;y=(idx//8)*32
        if idx<32: tile_floor(d,x,y,ch,idx)
        else: tile_prop(d,x,y,ch,idx-32)
    out=ROOT/'tilesets';out.mkdir(parents=True,exist_ok=True);im.save(out/f'{ch}.png')

def save_icon(cid,slot):
    im=Image.new('RGBA',(32,32),(0,0,0,0));d=ImageDraw.Draw(im);c=16
    accent={'knight':P['bone'],'hunter':P['gold'],'mage':P['purple']}[cid]
    if slot=='weapon':
        if cid=='knight': line(d,[(8,24),(23,9)],accent,3);line(d,[(9,21),(14,26)],P['gold'],2)
        elif cid=='hunter': line(d,[(7,19),(24,12)],P['ash'],4);rect(d,(10,18,15,23),P['gold']);rect(d,(21,10,26,14),P['bone'])
        else: line(d,[(10,26),(20,8)],P['ash'],3);d.ellipse((16,4,24,12),fill=P['purple'])
    elif slot=='armor': poly(d,[(8,9),(13,6),(19,6),(24,9),(22,25),(10,25)],P['iron']);rect(d,(12,10,20,22),accent)
    elif slot=='shoes': rect(d,(7,16,13,25),P['iron']);rect(d,(18,16,24,25),P['iron']);rect(d,(5,23,13,27),accent);rect(d,(18,23,26,27),accent)
    elif slot=='amulet': d.ellipse((9,7,23,22),outline=P['gold'],width=2);d.ellipse((13,18,19,25),fill=accent)
    else: d.ellipse((8,8,24,24),outline=accent,width=3);d.ellipse((13,13,19,19),fill=P['black'])
    out=ROOT/'icons/equipment';out.mkdir(parents=True,exist_ok=True);im.save(out/f'{cid}_{slot}.png')

def save_quality(q,col):
    im=Image.new('RGBA',(40,40),(0,0,0,0));d=ImageDraw.Draw(im);d.rectangle((1,1,38,38),outline=P['iron'],width=3);d.rectangle((4,4,35,35),outline=col,width=2);d.rectangle((7,7,32,32),outline=P['black'],width=1);(ROOT/'icons/quality').mkdir(parents=True,exist_ok=True);im.save(ROOT/'icons/quality'/f'{q}.png')

for cid in ('knight','hunter','mage'): save_char(cid)
for mid,size in [('ratman',48),('werewolf',48),('witch',48),('cyclops',64),('cultist',48)]: save_mon(mid,size)
for bid,size in [('wolf_king',96),('bat_lord',96),('elder_witch',96),('cyclops_chief',128),('dark_lord',128)]: save_boss(bid,size)
for ch in ('dungeon','forest','swamp','ruins','temple'): save_tiles(ch)
for cid in ('knight','hunter','mage'):
    for slot in ('weapon','armor','shoes','amulet','ring'): save_icon(cid,slot)
for q,col in [('common',P['ash']),('uncommon',P['green']),('rare',P['blue']),('epic',P['purple']),('legendary',P['gold'])]: save_quality(q,col)
manifest={'version':'2.1','palette':P,'characters':{c:list(ACTIONS.keys()) for c in ('knight','hunter','mage')},'bosses':['wolf_king','bat_lord','elder_witch','cyclops_chief','dark_lord'],'monsters':['ratman','werewolf','witch','cyclops','cultist'],'tilesets':['dungeon','forest','swamp','ruins','temple']}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('generated',sum(1 for _ in ROOT.rglob('*.png')),'png assets')
