#!/usr/bin/env python3
"""Build local transparent metallic device sprites at deterministic geometry.

The source shapes are rendered at 4x and downsampled for antialiasing. These
are device artwork assets, not live browser text/CSS glyphs; the rack compositor
flattens them into the final ribbon PNG.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'images'/'devices'/'military'
OUT.mkdir(parents=True,exist_ok=True)
S=4
SIZE=64

def font(size):
    candidates=[
        Path('C:/Windows/Fonts/timesbd.ttf'),
        Path('C:/Windows/Fonts/arialbd.ttf')
    ]
    for candidate in candidates:
        if candidate.exists(): return ImageFont.truetype(str(candidate),size)
    return ImageFont.load_default(size=size)

def metallic_mask(mask,name,tint=(192,195,198)):
    mask=mask.filter(ImageFilter.GaussianBlur(.35*S))
    base=Image.new('RGBA',mask.size,(0,0,0,0))
    pixels=base.load(); alpha=mask.load()
    for y in range(base.height):
        wave=0.74+0.25*((y/base.height-.5)**2*4)+0.14*__import__('math').sin(y*.18)
        for x in range(base.width):
            a=alpha[x,y]
            if not a: continue
            edge=min(x,y,base.width-1-x,base.height-1-y)
            shine=1.18 if (x/base.width+y/base.height)<.85 else .88
            value=wave*shine
            pixels[x,y]=(min(255,int(tint[0]*value)),min(255,int(tint[1]*value)),min(255,int(tint[2]*value)),a)
    shadow=Image.new('RGBA',mask.size,(0,0,0,0)); shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(1.2*S)))
    shadow_color=Image.new('RGBA',mask.size,(35,35,38,0)); shadow_color.putalpha(shadow.getchannel('A').point(lambda a:int(a*.48)))
    canvas=Image.new('RGBA',mask.size,(0,0,0,0))
    canvas.alpha_composite(shadow_color,(1*S,1*S))
    canvas.alpha_composite(base)
    canvas.resize((SIZE,SIZE),Image.Resampling.LANCZOS).save(OUT/name)

def letter_asset(text,name,point=42):
    mask=Image.new('L',(SIZE*S,SIZE*S),0); draw=ImageDraw.Draw(mask)
    f=font(point*S)
    box=draw.textbbox((0,0),text,font=f,stroke_width=1*S)
    x=(mask.width-(box[2]-box[0]))//2-box[0]
    y=(mask.height-(box[3]-box[1]))//2-box[1]
    draw.text((x,y),text,font=f,fill=255,stroke_width=1*S,stroke_fill=255)
    metallic_mask(mask,name)

def polygon_asset(points,name,tint=(192,195,198)):
    mask=Image.new('L',(SIZE*S,SIZE*S),0)
    ImageDraw.Draw(mask).polygon([(x*S,y*S) for x,y in points],fill=255)
    metallic_mask(mask,name,tint)

def star_asset(name,tint):
    import math
    points=[]
    for index in range(10):
        radius=23 if index%2==0 else 9.5
        angle=-math.pi/2+index*math.pi/5
        points.append((32+math.cos(angle)*radius,32+math.sin(angle)*radius))
    polygon_asset(points,name,tint)

for char in ('C','R','M','N','V'):
    letter_asset(char,f'{char.lower()}_device.png')
for numeral in range(2,100):
    letter_asset(str(numeral),f'numeral_{numeral}.png',point=31 if numeral<10 else 25)

for metal,tint in [('bronze',(178,116,63)),('silver',(202,205,211)),('gold',(218,176,61))]:
    # Two trapezoids meeting at a narrow waist; outline thickness survives at
    # final ribbon scale and reads as a physical hourglass attachment.
    polygon_asset([(15,12),(49,12),(38,31),(49,52),(15,52),(26,31)],f'{metal}_hourglass.png',tint)

star_asset('bronze_star.png',(178,116,63))
star_asset('silver_star.png',(202,205,211))
star_asset('gold_star.png',(218,176,61))
polygon_asset([(32,6),(53,53),(32,44),(11,53)],'arrowhead.png',(202,205,211))

# Compact oak-leaf silhouettes, paired with a short stem, replace the temporary
# SVG source with local transparent raster artwork.
for metal,tint in [('bronze',(178,116,63)),('silver',(202,205,211))]:
    mask=Image.new('L',(SIZE*S,SIZE*S),0); draw=ImageDraw.Draw(mask)
    draw.line([(8*S,42*S),(55*S,20*S)],fill=255,width=5*S)
    for x,y,flip in [(16,38,-1),(25,34,1),(34,29,-1),(43,25,1),(51,21,-1)]:
        box=[(x-8)*S,(y-5)*S,(x+8)*S,(y+5)*S]
        draw.ellipse(box,fill=255)
    metallic_mask(mask,f'{metal}_olc.png',tint)

print(f'Generated {len(list(OUT.glob("*.png")))} transparent military device assets in {OUT}')
