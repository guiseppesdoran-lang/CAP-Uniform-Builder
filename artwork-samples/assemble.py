import json,sys,os,re,zlib,struct,subprocess;sys.path.insert(0,'tools')
import pdfobjs as P
OUT='/Users/ethan/UniformBuilder/artwork-samples/cap-ribbons/specs.json'
spec=json.load(open('cap_ribbon_specs.json'))['ribbons']
by={s['id']:s for s in spec}
src=open('/Users/ethan/UniformBuilder/js/catalog.js').read()
blk=src[src.index('const RIBBON_DISPLAY_NAMES'):src.index('const MILITARY_RIBBON_PREFIX')]
names={m.group(1):m.group(3).replace('\\u201c','\u201c').replace('\\u201d','\u201d') for m in re.finditer(r"^\s+(\w+):\s*(['\"])(.*?)\2,?\s*$",blk,re.M)}
ids=[l.strip() for l in open('ribbon_ids.txt') if l.strip()]
d,objs=P.load('capr393.pdf')
raw=P.stream(objs,209);dic=objs[209][0]
cs=objs[int(re.search(rb'/ColorSpace\s+(\d+)\s+0\s+R',dic).group(1))][0]
m=re.search(rb'\[/Indexed\s+\d+\s+0\s+R\s+(\d+)\s+(\d+)\s+0\s+R\]',cs);pal=P.stream(objs,int(m.group(2)))
W,H=160,48;row=raw[(H//2)*W:(H//2+1)*W]
CLEAN={'ff0000':(255,0,0),'0080ff':(0,128,255),'008000':(0,128,0),'ffff00':(255,255,0)}
snap=lambda c:min(CLEAN,key=lambda k:sum((c[i]-CLEAN[k][i])**2 for i in range(3)))
sn=[snap(tuple(pal[row[x]*3:row[x]*3+3])) for x in range(W)]
runs=[]
for s in sn:
    if runs and runs[-1][0]==s: runs[-1][1]+=1
    else: runs.append([s,1])
m2=[]
for c,n in runs:
    if n<=2 and m2: m2[-1][1]+=n
    elif m2 and m2[-1][0]==c: m2[-1][1]+=n
    else: m2.append([c,n])
by['homeland_security_ribbon']={'id':'homeland_security_ribbon','name':'Homeland Security Ribbon','pdfObject':209,'stripes':[{'hex':c,'px':n} for c,n in m2]}
by['silver_medal_of_valor']['stripes']=by['bronze_medal_of_valor']['stripes']
by['silver_medal_of_valor']['note']='PDF depiction has the three stars baked in; the ribbon is identical to the Bronze Medal of Valor (stars are devices).'
def read_png(path,retry=True):
    b=open(path,'rb').read();p=8;idat=b'';ct=2
    while p<len(b):
        l=struct.unpack('>I',b[p:p+4])[0];t=b[p+4:p+8];dd=b[p+8:p+8+l]
        if t==b'IHDR':W,H=struct.unpack('>II',dd[:8]);ct=dd[9];bd=dd[8]
        elif t==b'IDAT':idat+=dd
        p+=12+l
    if ct not in (2,6) or bd!=8:
        tmp='tmp_png/'+os.path.basename(path)
        subprocess.run(['sips','-s','format','jpeg',path,'--out',tmp+'.jpg'],capture_output=True)
        subprocess.run(['sips','-s','format','png',tmp+'.jpg','--out',tmp],capture_output=True)
        return read_png(tmp,False)
    raw=zlib.decompress(idat);ch={2:3,6:4}[ct];st=W*ch;out=bytearray(H*st)
    for y in range(H):
        f=raw[y*(st+1)]
        for x in range(st):
            v=raw[y*(st+1)+1+x];a=out[y*st+x-ch] if x>=ch else 0;u=out[(y-1)*st+x] if y else 0;c=out[(y-1)*st+x-ch] if x>=ch and y else 0
            if f==1:r=v+a
            elif f==2:r=v+u
            elif f==3:r=v+((a+u)>>1)
            elif f==4:
                pp=a+u-c;pa,pb,pc=abs(pp-a),abs(pp-u),abs(pp-c);r=v+(a if pa<=pb and pa<=pc else u if pb<=pc else c)
            else:r=v
            out[y*st+x]=r&255
    return W,H,ch,out
def repo_runs(path,tol=45,minw=3):
    W,H,ch,px=read_png(path);row=H//2
    cols=[tuple(px[(row*W+x)*ch:(row*W+x)*ch+3]) for x in range(2,W-2)]
    r=[]
    for c in cols:
        if r and max(abs(c[i]-r[-1][0][i]) for i in range(3))<=tol: r[-1][1]+=1;r[-1][2].append(c)
        else: r.append([c,1,[c]])
    out=[]
    for c,n,cs_ in r:
        if n<minw and out: out[-1][1]+=n;out[-1][2]+=cs_
        else: out.append([c,n,cs_])
    res=[]
    for c,n,cs_ in out:
        a=tuple(round(sum(v[i] for v in cs_)/len(cs_)) for i in range(3))
        if a[0]>=0xa0 and a[1]>=0xa0 and a[2]>=0xf0 and abs(a[0]-a[1])<10 and a[2]-a[0]>=0x20: a=(255,255,255)   # repo art tints white lilac
        res.append({'hex':'%02x%02x%02x'%a,'px':n})
    return res
final=[];flag=[]
for rid in ids:
    if rid in by:
        s=by[rid];final.append({'id':rid,'name':names.get(rid,s['name']),'source':'CAPR 39-3 (28 Dec 2012) Attachment 3, embedded ribbon image (PDF object %d)'%s['pdfObject'],'stripes':s['stripes'],'note':s.get('note','')})
    else:
        p=f'/Users/ethan/UniformBuilder/images/ribbons/{rid}.png'
        if os.path.exists(p):
            final.append({'id':rid,'name':names.get(rid,rid),'source':'repo art images/ribbons/%s.png (not depicted in CAPR 39-3 Att.3; unverified)'%rid,'stripes':repo_runs(p),'note':''})
        else: flag.append(rid)
for r in final:
    tot=sum(s['px'] for s in r['stripes']);m=[]
    for s in r['stripes']:
        if m and m[-1]['hex']==s['hex']: m[-1]['px']+=s['px']
        else: m.append(dict(s))
    r['stripes']=[{'hex':s['hex'],'frac':round(s['px']/tot,5)} for s in m]
json.dump({'physicalSize':'1 3/8 in x 3/8 in (11:3)','source':'CAPR 39-3, 28 Dec 2012, plus interim changes','ribbons':final},open(OUT,'w'),indent=1)
print(len(final),'ribbons; no data:',flag)
print('repo-derived:',[r['id'] for r in final if r['source'].startswith('repo')])
