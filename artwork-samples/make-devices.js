// Standalone vector devices: stars, propeller / clasp triangles, V, service-year numerals.
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'cap-devices');fs.mkdirSync(dir,{recursive:true});
const METAL={
  bronze:{hi:'#e0a374',mid:'#b4713f',lo:'#6f4122',edge:'#4a2a14'},
  silver:{hi:'#f4f6f8',mid:'#c3c8ce',lo:'#7d848c',edge:'#4b5057'},
  gold:{hi:'#fff2a8',mid:'#e2b21c',lo:'#9a6a05',edge:'#5f4103'},
};
const f=n=>n.toFixed(2);
const defs=m=>`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
<filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-opacity=".35"/></filter></defs>`;
function wrap(m,body,w=120,h=120){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="360" height="360">${defs(m)}<g filter="url(#s)">${body}</g></svg>`;}
// faceted star: 10 triangular facets, alternating light/dark
function star(mn){const m=METAL[mn],cx=60,cy=62,R=40,r=17,p=[];
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R;p.push([cx+rr*Math.cos(a),cy+rr*Math.sin(a)]);}
  let b='';
  for(let i=0;i<10;i++){const a=p[i],c=p[(i+1)%10];const tone=i%2?m.lo:m.hi;
    b+=`<polygon points="${cx},${cy} ${f(a[0])},${f(a[1])} ${f(c[0])},${f(c[1])}" fill="${tone}" opacity="${i%2?.55:.9}"/>`;}
  b+=`<polygon points="${p.map(q=>f(q[0])+','+f(q[1])).join(' ')}" fill="url(#g)" opacity=".55"/>`;
  b+=`<polygon points="${p.map(q=>f(q[0])+','+f(q[1])).join(' ')}" fill="none" stroke="${m.edge}" stroke-width="1.6" stroke-linejoin="round"/>`;
  for(let i=0;i<10;i+=2)b+=`<line x1="${cx}" y1="${cy}" x2="${f(p[i][0])}" y2="${f(p[i][1])}" stroke="${m.edge}" stroke-width=".9" opacity=".7"/>`;
  return wrap(m,b);}
function triangle(mn,withProp){const m=METAL[mn];
  let b=`<polygon points="60,18 108,98 12,98" fill="url(#g)" stroke="${m.edge}" stroke-width="2" stroke-linejoin="round"/>`
       +`<polygon points="60,18 108,98 96,98 60,34" fill="${m.hi}" opacity=".35"/>`
       +`<polygon points="60,18 12,98 24,98 60,34" fill="${m.lo}" opacity=".35"/>`;
  if(withProp){const hx=60,hy=70;
    for(const th of [-85,35,155]){const t=th*Math.PI/180,bx=hx+19*Math.cos(t),by=hy+19*Math.sin(t);
      b+=`<ellipse cx="${f(bx)}" cy="${f(by)}" rx="17" ry="7" fill="${m.mid}" stroke="${m.edge}" stroke-width="1.5" transform="rotate(${th} ${f(bx)} ${f(by)})"/>`
        +`<ellipse cx="${f(bx)}" cy="${f(by-1.2)}" rx="12" ry="3" fill="${m.hi}" opacity=".55" transform="rotate(${th} ${f(bx)} ${f(by-1.2)})"/>`;}
    b+=`<circle cx="${hx}" cy="${hy}" r="7.5" fill="url(#g)" stroke="${m.edge}" stroke-width="1.5"/><circle cx="${hx}" cy="${hy}" r="2.4" fill="${m.edge}"/>`;}
  return wrap(m,b);}
function vdev(){const m=METAL.silver;
  const b=`<path d="M14,22 H50 V32 H44 L60,84 L76,32 H70 V22 H106 V32 H98 L72,100 H48 L22,32 H14 Z" fill="url(#g)" stroke="${m.edge}" stroke-width="2" stroke-linejoin="round"/>`
         +`<path d="M22,32 L48,100 L52,100 L28,32 Z" fill="${m.hi}" opacity=".5"/>`;
  return wrap(m,b);}
function year(n){const m=METAL.silver;
  // just the metal numerals (no plate): dark outline, silver face, lighter bevel edge on the upper-left
  const t=(extra)=>`<text x="60" y="78" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="58" letter-spacing="-2" ${extra}>${n}</text>`;
  const b=t(`fill="${m.edge}" stroke="${m.edge}" stroke-width="5" stroke-linejoin="round"`)
        +t(`fill="url(#g)" stroke="${m.lo}" stroke-width="1.2" stroke-linejoin="round"`)
        +`<g transform="translate(-1.1 -1.1)">${t(`fill="none" stroke="${m.hi}" stroke-width="1.4" stroke-linejoin="round" opacity=".85"`)}</g>`;
  return wrap(m,b);}
const out=[];
const add=(id,name,svg)=>{fs.writeFileSync(path.join(dir,id+'.svg'),svg);out.push({id,name});};
for(const mn of ['bronze','silver','gold'])add(`star_${mn}`,`${mn[0].toUpperCase()+mn.slice(1)} Star`,star(mn));
add('propeller_bronze','Bronze Propeller',triangle('bronze',true));
add('propeller_silver','Silver Propeller',triangle('silver',true));
add('clasp_bronze','Bronze Clasp',triangle('bronze',false));
add('clasp_silver','Silver Clasp',triangle('silver',false));
add('v_device','"V" Device',vdev());
for(let y=20;y<=75;y+=5)add(`years_${y}`,`${y} Year Device`,year(y));
fs.writeFileSync(path.join(dir,'devices.json'),JSON.stringify(out,null,1));
console.log(out.length,'devices');
