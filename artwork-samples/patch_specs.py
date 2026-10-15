# Post-process cap-ribbons/specs.json: fixes that need more than a stripe list.
#   - CAP Achievement Award: drop the JPEG's 2px edge artifact, make the stripes symmetric
#   - AFA Award: keep the lettering (exact bitmap rows from the PDF image)
#   - Silver Medal of Valor: add the three silver stars
import json,re,sys
sys.path.insert(0,'tools')
import pdfobjs as P
SPEC='/Users/ethan/UniformBuilder/artwork-samples/cap-ribbons/specs.json'
d=json.load(open(SPEC))
by={r['id']:r for r in d['ribbons']}
# 1. achievement award: tan | navy | blue | navy | tan (28 / 20.5 / 35 / 20.5 / 28 of 132px)
a=by['cap_achievment_award']
w=[28,20.5,35,20.5,28];t=sum(w)
a['stripes']=[{'hex':h,'frac':round(n/t,5)} for h,n in zip(['a08346','040590','1c54f1','040590','a08346'],w)]
a['note']='PDF image is a JPEG photo; 2px light edge artifact removed, stripes made symmetric.'
# 2. AFA lettering: the PDF image is a tiny off-centre bitmap of "AFA" (red on cyan). Redrawn as clean vector letters,
#    same colours, centred and enlarged 15%. Coordinates are in the 110x30 ribbon box.
def A(ox): return [[[ox+5,0],[ox+12,0],[ox+17,18],[ox+12.4,18],[ox+11.4,14.2],[ox+5.6,14.2],[ox+4.6,18],[ox,18]],
                   [[ox+6.7,10.8],[ox+10.3,10.8],[ox+8.5,4.4]]]
F=[[[18,0],[29,0],[29,4],[22.6,4],[22.6,7.6],[27,7.6],[27,11],[22.6,11],[22.6,18],[18,18]]]
rings=[]
for ring in A(0)+F+A(31):
    rings.append(ring)
# proportions measured from the repo's real-looking AFA art (images/ribbons/afa_award.png): lettering spans
# ~30-68% of the width and ~19-77% of the height, centred at (49%, 48%), italic ~15 degrees.
box_w=0.38*110;box_h=0.58*30;slant=0.27
sy=box_h/18;sx=(box_w-slant*box_h)/47
cx,cy=0.49*110,0.48*30
def tf(pt):
    y=(pt[1]-9)*sy              # glyph is 18 tall, centred on 9
    x=(pt[0]-23.5)*sx - slant*y # shear: tops lean right
    return [round(cx+x,2),round(cy+y,2)]
# group rings into glyph paths (A has a hole -> evenodd)
glyphs=[A(0),F,A(31)]
afa=by['afa_award']
afa['stripes']=[{'hex':'00ffff','frac':1.0}]
afa['paths']=[{'fill':'ff0000','rings':[[tf(p) for p in ring] for ring in g]} for g in glyphs]
afa.pop('bitmap',None)
afa['note']='Cyan field with red AFA lettering, redrawn as vector letters (the PDF image is a small off-centre bitmap).'
# 3. silver stars on the three blue/white/blue groups (centres from the Bronze layout, 110x30 units)
s=by['silver_medal_of_valor']
s['devices']=[{'type':'star','cx':round(c*1.1,2),'cy':15,'r':10.2,'fill':'d9dde2','stroke':'5b6168'} for c in (27,50,73)]
s['note']='Ribbon identical to the Bronze Medal of Valor; three silver stars (devices) on the blue/white/blue groups and the centre red.'
json.dump(d,open(SPEC,'w'),indent=1)

# 4. repo-derived ribbons carry the art's pale 1-3px edge highlight as a thin white stripe at each end; trim it.
d=json.load(open(SPEC))
trimmed=[]
for r in d['ribbons']:
    if not r['source'].startswith('repo art'): continue
    st=r['stripes'];changed=False
    while len(st)>2 and st[0]['hex']=='ffffff' and st[0]['frac']<=0.045: st=st[1:];changed=True
    while len(st)>2 and st[-1]['hex']=='ffffff' and st[-1]['frac']<=0.045: st=st[:-1];changed=True
    if changed:
        t=sum(s['frac'] for s in st)
        r['stripes']=[{'hex':s['hex'],'frac':round(s['frac']/t,5)} for s in st];trimmed.append(r['id'])
json.dump(d,open(SPEC,'w'),indent=1)
print('trimmed edge bars:',trimmed)


# 5. Wartime patrol ribbons carry an emblem. Coordinates traced from images/ribbons/*.png (100x30 grid), mapped to 110x30.
def P(*pts): return [[round(x*1.1,2),y] for x,y in pts]
def mir(pts): return [[100-x,y] for x,y in pts]
def rect(x0,y0,x1,y1): return [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
EMB={}
EMB['anti_submarine_coastal_patrol_ribbon']=('ffffff',[
  [P((54,6),(58,6),(58,18),(50,18),(50,12),(54,12))],
  [P((29,18),(71,18),(64,26),(36,26))]])
EMB['southern_liaison_patrol_ribbon']=('000000',[
  [P(*rect(49,2,52,26))],[P(*rect(43,14,58,16))],[P(*rect(43,8,46,14))],[P(*rect(55,6,58,14))]])
EMB['tow_target_tracking_ribbon']=('ffffff',[
  [P((35,4),(40,4),(59,26),(56,26))],[P((58,4),(63,4),(42,26),(39,26))]])
EMB['courier_ribbon']=('ffffff',[
  [P((49,3),(70,3),(71,7),(71,11),(69,13),(66,15),(63,17),(56,19),(55,21),(47,23),(38,25),(38,27),(33,27),(33,25),(34,23),(36,21),(37,19),(41,17),(42,15),(44,13),(46,11),(49,9),(48,7),(47,5))]])
tree=[]
for k,ay in enumerate((5,11,17,23)):
    reach=5+1.2*k
    tree.append([P((48.5,ay-1.6),(48.5+reach,ay+5.4),(48.5+reach-3.8,ay+7.4),(48.5,ay+3.2),(48.5-reach+3.8,ay+7.4),(48.5-reach,ay+5.4))])
tree.append([P(*rect(47.2,5,49.8,27))])
EMB['forest_patrol_ribbon']=('000000',tree)
left=[(20,8),(21,8),(21,10),(28,10),(28,12),(47,12),(47,14)]
outline=left+[(53,14),(53,12)]+mir(left[::-1])
lower_left=[(20,12),(23,12),(23,14),(27,14),(27,16),(29,16),(29,18),(28,18),(28,20),(30,20),(30,24),(49,24),(49,22)]
# full outline: top edge L->R, then right side down (mirror), bottom R->L, left side up
top=[(20,8),(21,8),(21,10),(28,10),(28,12),(47,12),(47,14),(53,14),(53,12),(72,12),(72,10),(79,10),(79,8),(80,8)]
right_side=[(80,12),(77,12),(77,14),(73,14),(73,16),(71,16),(71,18),(72,18),(72,20),(70,20),(70,24)]
bottom=[(51,24),(51,22),(49,22),(49,24)]
left_side=[(30,24),(30,20),(28,20),(28,18),(29,18),(29,16),(27,16),(27,14),(23,14),(23,12),(20,12)]
ma=[(20,8),(22,8),(30,11.5),(47,12),(47,14),(53,14),(53,12),(70,11.5),(77,8),(79,8),(79,12),(75,14),(72,16),(71,19),(70,24),(51,24),(51,22),(49,22),(49,24),(30,24),(29,19),(28,16),(25,14),(21,12)]
eyes=[[(38,16),(45,16),(47,20),(40,20)],[(62,16),(55,16),(53,20),(60,20)]]
EMB['missing_aircraft_ribbon']=('ffffff',[[P(*ma)]+[P(*e) for e in eyes]])
d=json.load(open(SPEC));by={r['id']:r for r in d['ribbons']}
for rid,(fill,glyphs) in EMB.items():
    r=by[rid]
    r['paths']=[{'fill':fill,'rings':rings} for rings in glyphs]
    # one plain background colour: the ribbon is the field plus the emblem
    r['stripes']=[{'hex':r['field'],'frac':1.0}]
    r['note']='Field colour sampled from repo art (bright scanlines); emblem traced from the same art. Unverified against an official depiction.'
json.dump(d,open(SPEC,'w'),indent=1)
print('emblems:',list(EMB))
