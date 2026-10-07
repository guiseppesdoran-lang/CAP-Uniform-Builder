"""Measure bright grade components in the existing source artwork; no image edits."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parent.parent
out={}
for key in ['2d_lt','1st_lt','Capt','Maj','lt_col','col','brig_gen','maj_gen']:
    image=Image.open(root/f'images/base/CAP_male_{key}.png').convert('RGB')
    xmin,xmax,ymin,ymax=117,173,16,70
    pixels={(x,y) for y in range(ymin,ymax) for x in range(xmin,xmax) if max(image.getpixel((x,y)))>145 and min(image.getpixel((x,y)))<245}
    components=[]
    while pixels:
        point=pixels.pop();component={point};queue=[point]
        while queue:
            x,y=queue.pop()
            for dx in [-1,0,1]:
                for dy in [-1,0,1]:
                    other=x+dx,y+dy
                    if other in pixels:pixels.remove(other);component.add(other);queue.append(other)
        if not any(x in [xmin,xmax-1] or y in [ymin,ymax-1] for x,y in component) and len(component)>10:components.append(component)
    largest=max(map(len,components))
    points=set().union(*(c for c in components if len(c)>=largest*.15))
    left=min(x for x,y in points)-1;top=min(y for x,y in points)-1
    out[key]=[left,top,max(x for x,y in points)-left+2,max(y for x,y in points)-top+2]
(root/'data/officer-grade-crops.json').write_text(json.dumps(out,indent=2)+'\n')
print(out)
