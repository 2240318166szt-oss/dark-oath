from PIL import Image, ImageDraw, ImageFilter, ImageChops
from pathlib import Path
import math, json
ROOT=Path(__file__).parent.parent/'Assets'/'bosses'
ROOT.mkdir(parents=True,exist_ok=True)
P={'outline':'#171717','bone':'#d6d0c8','gold':'#a8863a','red':'#a11f1f','darkred':'#5a1f1f','purple':'#6b3fa0','violet':'#9a5aca','blue':'#3e5870','ice':'#9bdcff','green':'#467a46','ash':'#707070','iron':'#303030','silver':'#a8a8b0','white':'#eee9df','brown':'#6b4423','tan':'#9b7653'}

def rect(d,x,y,w,h,c): d.rectangle((round(x),round(y),round(x+w-1),round(y+h-1)),fill=c)
def poly(d,pts,c): d.polygon([(round(x),round(y)) for x,y in pts],fill=c)
def line(d,a,b,c,w=1): d.line([tuple(map(round,a)),tuple(map(round,b))],fill=c,width=w)
def outline(im):
 a=im.getchannel('A'); exp=a.filter(ImageFilter.MaxFilter(3)); ring=ImageChops.subtract(exp,a); lay=Image.new('RGBA',im.size,(23,23,23,255)); lay.putalpha(ring); return Image.alpha_composite(lay,im)
def dirv(di):
 a=math.pi/2+di*math.pi/4; return math.cos(a),math.sin(a)
def bob(fi): return [0,-1,-2,-1,0,1][fi%6]

def aura(d,cx,cy,phase,fi,r,c):
 if phase<2:return
 for k in range(6):
  a=fi*.55+k*math.pi/3; x=cx+math.cos(a)*r; y=cy+math.sin(a)*r*.55
  rect(d,x-2,y-2,4,4,c)

def wolf(d,cx,cy,vx,vy,phase,fi,s):
 cy+=bob(fi); sc=s/96
 fur='#696969' if phase==1 else '#4a3030'; hi='#929292' if phase==1 else '#8f4a4a'
 # legs/body
 rect(d,cx-20*sc,cy+8*sc,10*sc,20*sc,P['iron']); rect(d,cx+10*sc,cy+8*sc,10*sc,20*sc,P['iron'])
 poly(d,[(cx-26*sc,cy-12*sc),(cx+26*sc,cy-12*sc),(cx+22*sc,cy+18*sc),(cx-22*sc,cy+18*sc)],fur)
 # shoulder mane
 for sx in (-1,1): poly(d,[(cx+sx*18*sc,cy-15*sc),(cx+sx*34*sc,cy-5*sc),(cx+sx*24*sc,cy+4*sc)],hi)
 # head/muzzle
 poly(d,[(cx-22*sc,cy-36*sc),(cx+22*sc,cy-36*sc),(cx+18*sc,cy-10*sc),(cx-18*sc,cy-10*sc)],fur)
 poly(d,[(cx-21*sc,cy-35*sc),(cx-11*sc,cy-54*sc),(cx-5*sc,cy-34*sc)],fur); poly(d,[(cx+21*sc,cy-35*sc),(cx+11*sc,cy-54*sc),(cx+5*sc,cy-34*sc)],fur)
 rect(d,cx-9*sc,cy-22*sc,18*sc,10*sc,'#3b3030'); rect(d,cx-3*sc,cy-18*sc,6*sc,4*sc,P['outline'])
 rect(d,cx-13*sc,cy-29*sc,5*sc,3*sc,P['red']); rect(d,cx+8*sc,cy-29*sc,5*sc,3*sc,P['red'])
 # crown
 poly(d,[(cx-15*sc,cy-42*sc),(cx-10*sc,cy-55*sc),(cx-3*sc,cy-45*sc),(cx,cy-58*sc),(cx+5*sc,cy-45*sc),(cx+12*sc,cy-55*sc),(cx+15*sc,cy-42*sc)],P['gold'])
 # claws
 reach=(24+8*math.sin(fi/5*math.pi))*sc
 for side in (-1,1):
  hx=cx+side*30*sc+vx*reach*.25; hy=cy+4*sc+vy*reach*.2
  rect(d,hx-5*sc,hy-5*sc,10*sc,12*sc,fur)
  for q in (-1,0,1): line(d,(hx+side*3*sc,hy+q*3*sc),(hx+side*11*sc,hy+q*4*sc),P['bone'],max(1,round(2*sc)))
 if phase==2:
  for side in (-1,1): poly(d,[(cx+side*20*sc,cy-8*sc),(cx+side*38*sc,cy-19*sc),(cx+side*30*sc,cy+1*sc)],P['darkred'])
  aura(d,cx,cy-12*sc,phase,fi,35*sc,P['red'])

def bat(d,cx,cy,vx,vy,phase,fi,s):
 cy+=bob(fi)*1.4; sc=s/96; wing=28+6*math.sin(fi/5*math.pi)
 wc='#514061' if phase==1 else '#472060'; edge=P['purple'] if phase==1 else P['violet']
 # wings
 for side in (-1,1):
  poly(d,[(cx+side*12*sc,cy-14*sc),(cx+side*wing*sc,cy-32*sc),(cx+side*43*sc,cy-5*sc),(cx+side*30*sc,cy+17*sc),(cx+side*13*sc,cy+7*sc)],wc)
  line(d,(cx+side*13*sc,cy-8*sc),(cx+side*40*sc,cy-4*sc),edge,max(1,round(2*sc)))
 # body/head
 poly(d,[(cx-14*sc,cy-20*sc),(cx+14*sc,cy-20*sc),(cx+18*sc,cy+18*sc),(cx-18*sc,cy+18*sc)],'#343039')
 poly(d,[(cx-15*sc,cy-27*sc),(cx-8*sc,cy-45*sc),(cx-2*sc,cy-26*sc)],'#343039'); poly(d,[(cx+15*sc,cy-27*sc),(cx+8*sc,cy-45*sc),(cx+2*sc,cy-26*sc)],'#343039')
 rect(d,cx-10*sc,cy-18*sc,5*sc,3*sc,P['red']); rect(d,cx+5*sc,cy-18*sc,5*sc,3*sc,P['red'])
 # collar/gem
 poly(d,[(cx-14*sc,cy-2*sc),(cx,cy+13*sc),(cx+14*sc,cy-2*sc),(cx,cy+3*sc)],P['darkred']); rect(d,cx-3*sc,cy+1*sc,6*sc,6*sc,P['gold'])
 if phase==2:
  # energy crown and elongated wing tips
  for side in (-1,1): line(d,(cx+side*35*sc,cy-20*sc),(cx+side*52*sc,cy-34*sc),P['violet'],max(1,round(3*sc)))
  poly(d,[(cx-12*sc,cy-34*sc),(cx,cy-52*sc),(cx+12*sc,cy-34*sc),(cx,cy-40*sc)],P['violet'])
  aura(d,cx,cy-5*sc,phase,fi,34*sc,P['violet'])

def witch(d,cx,cy,vx,vy,phase,fi,s):
 cy+=bob(fi); sc=s/96
 robe='#3e2b50' if phase==1 else '#28163d'
 # robe
 poly(d,[(cx-18*sc,cy-8*sc),(cx+18*sc,cy-8*sc),(cx+27*sc,cy+28*sc),(cx-27*sc,cy+28*sc)],robe)
 rect(d,cx-11*sc,cy-24*sc,22*sc,19*sc,'#6d8150'); rect(d,cx-7*sc,cy-18*sc,4*sc,3*sc,P['violet']); rect(d,cx+3*sc,cy-18*sc,4*sc,3*sc,P['violet'])
 # hat oversized
 poly(d,[(cx-34*sc,cy-28*sc),(cx+34*sc,cy-28*sc),(cx+17*sc,cy-20*sc),(cx-20*sc,cy-20*sc)],P['purple'])
 poly(d,[(cx-18*sc,cy-29*sc),(cx-5*sc,cy-60*sc),(cx+15*sc,cy-38*sc),(cx+7*sc,cy-28*sc)],'#4d2d70')
 rect(d,cx-15*sc,cy-30*sc,30*sc,5*sc,P['gold'])
 # staff
 sx=cx+29*sc; line(d,(sx,cy-5*sc),(sx+vx*5*sc,cy+31*sc),P['brown'],max(2,round(4*sc))); rect(d,sx-5*sc,cy-13*sc,10*sc,10*sc,P['violet'])
 if phase==2:
  # split hat / rune halo
  line(d,(cx-8*sc,cy-53*sc),(cx+2*sc,cy-42*sc),P['red'],max(1,round(2*sc)))
  for k in range(5):
   a=fi*.45+k*1.256; x=cx+math.cos(a)*34*sc; y=cy-10*sc+math.sin(a)*18*sc
   rect(d,x-3*sc,y-3*sc,6*sc,6*sc,P['violet']); rect(d,x-1*sc,y-1*sc,2*sc,2*sc,P['bone'])
  rect(d,sx-7*sc,cy-15*sc,14*sc,14*sc,P['red'])

def cyclops(d,cx,cy,vx,vy,phase,fi,s):
 cy+=bob(fi); sc=s/128
 skin='#7a6a55' if phase==1 else '#5a4a3d'; armor='#55535a'
 # legs and massive torso
 rect(d,cx-27*sc,cy+18*sc,18*sc,29*sc,P['iron']); rect(d,cx+9*sc,cy+18*sc,18*sc,29*sc,P['iron'])
 poly(d,[(cx-40*sc,cy-24*sc),(cx+40*sc,cy-24*sc),(cx+34*sc,cy+27*sc),(cx-34*sc,cy+27*sc)],skin)
 # shoulder plates
 for side in (-1,1): poly(d,[(cx+side*27*sc,cy-23*sc),(cx+side*48*sc,cy-12*sc),(cx+side*38*sc,cy+5*sc)],armor)
 # head
 rect(d,cx-28*sc,cy-52*sc,56*sc,31*sc,skin); rect(d,cx-13*sc,cy-41*sc,26*sc,10*sc,P['outline']); rect(d,cx-8*sc,cy-39*sc,16*sc,6*sc,P['gold'] if phase==1 else P['red'])
 # tusks
 poly(d,[(cx-20*sc,cy-25*sc),(cx-30*sc,cy-13*sc),(cx-18*sc,cy-18*sc)],P['bone']); poly(d,[(cx+20*sc,cy-25*sc),(cx+30*sc,cy-13*sc),(cx+18*sc,cy-18*sc)],P['bone'])
 # huge club
 hx=cx+42*sc; line(d,(hx,cy-12*sc),(hx+vx*8*sc,cy+38*sc),P['brown'],max(3,round(7*sc))); rect(d,hx-11*sc,cy-31*sc,23*sc,26*sc,armor)
 if phase==2:
  # cracks + fiery eye + spikes
  for ox,oy in [(-18,-7),(12,5),(-4,17)]: line(d,(cx+ox*sc,cy+oy*sc),(cx+(ox+8)*sc,cy+(oy+7)*sc),P['red'],max(1,round(2*sc)))
  for side in (-1,1): poly(d,[(cx+side*38*sc,cy-18*sc),(cx+side*53*sc,cy-29*sc),(cx+side*45*sc,cy-8*sc)],P['silver'])
  aura(d,cx,cy-8*sc,phase,fi,48*sc,P['red'])

def darklord(d,cx,cy,vx,vy,phase,fi,s):
 cy+=bob(fi); sc=s/128
 armor='#292733'; cape='#4e1822' if phase==1 else '#351027'
 # cape/wings back
 if phase==2:
  for side in (-1,1): poly(d,[(cx+side*18*sc,cy-25*sc),(cx+side*58*sc,cy-48*sc),(cx+side*46*sc,cy+8*sc),(cx+side*24*sc,cy+22*sc)],'#38204d')
 poly(d,[(cx-30*sc,cy-25*sc),(cx+30*sc,cy-25*sc),(cx+37*sc,cy+35*sc),(cx-37*sc,cy+35*sc)],cape)
 rect(d,cx-28*sc,cy-22*sc,56*sc,44*sc,armor)
 # head/helmet horns
 rect(d,cx-24*sc,cy-54*sc,48*sc,31*sc,'#363440'); poly(d,[(cx-22*sc,cy-50*sc),(cx-43*sc,cy-67*sc),(cx-29*sc,cy-42*sc)],P['iron']); poly(d,[(cx+22*sc,cy-50*sc),(cx+43*sc,cy-67*sc),(cx+29*sc,cy-42*sc)],P['iron'])
 rect(d,cx-14*sc,cy-42*sc,28*sc,7*sc,P['outline']); rect(d,cx-11*sc,cy-40*sc,8*sc,3*sc,P['red']); rect(d,cx+3*sc,cy-40*sc,8*sc,3*sc,P['red'])
 # chest rune
 rect(d,cx-5*sc,cy-10*sc,10*sc,16*sc,P['gold']); rect(d,cx-2*sc,cy-7*sc,4*sc,10*sc,P['red'])
 # sword
 sx=cx+36*sc; line(d,(sx,cy-7*sc),(sx+vx*12*sc,cy+48*sc),P['silver'],max(2,round(5*sc))); line(d,(sx-8*sc,cy-4*sc),(sx+8*sc,cy-4*sc),P['gold'],max(2,round(4*sc)))
 if phase==2:
  rect(d,sx-2*sc,cy+2*sc,4*sc,33*sc,P['violet']); aura(d,cx,cy-9*sc,phase,fi,50*sc,P['violet'])
  poly(d,[(cx-16*sc,cy-57*sc),(cx,cy-76*sc),(cx+16*sc,cy-57*sc),(cx,cy-64*sc)],P['gold'])

def frame(bid,phase,di,fi,size):
 im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); vx,vy=dirv(di); cx=size/2; cy=size*.56
 # shadow
 d.ellipse((size*.26,size*.78,size*.74,size*.87),fill=(0,0,0,115))
 {'wolf_king':wolf,'bat_lord':bat,'elder_witch':witch,'cyclops_chief':cyclops,'dark_lord':darklord}[bid](d,cx,cy,vx,vy,phase,fi,size)
 return outline(im)

def save(bid,size):
 for phase in (1,2):
  sh=Image.new('RGBA',(size*6,size*8),(0,0,0,0))
  for di in range(8):
   for fi in range(6): sh.alpha_composite(frame(bid,phase,di,fi,size),(fi*size,di*size))
  sh.save(ROOT/f'{bid}_phase{phase}.png')
  print('saved',bid,phase,sh.size)

if __name__=='__main__':
 for bid,size in [('wolf_king',96),('bat_lord',96),('elder_witch',96),('cyclops_chief',128),('dark_lord',128)]: save(bid,size)
