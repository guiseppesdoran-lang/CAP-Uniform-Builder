// One image with every rank insignia asset, grouped by section, grades as rows and forms as columns, at one common scale.
// OCP-square assets carry no blue, so the preview draws the 2 in blank square (#142347) behind them.
// usage: node make-rank-matrix.js out.png [pxPerIn=60]
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const OUTF=process.argv[2]||'rank-insignia-matrix.png',PPI=+(process.argv[3]||60);
const dir=path.join(__dirname,'insignia'),have=new Set(fs.readdirSync(dir).filter(f=>f.endsWith('.svg')).map(f=>f.replace('.svg','')));
const load=id=>{const s=fs.readFileSync(path.join(dir,id+'.svg'),'utf8');
  return {id,w:parseFloat(s.match(/width="([\d.]+)in"/)[1]),h:parseFloat(s.match(/height="([\d.]+)in"/)[1]),
    inner:s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<metadata>[\s\S]*?<\/metadata>/,'').replace(/<title>[\s\S]*?<\/title>/,'')};};
const CLOTH='#142347',BG='#2a2e36',TXT='#e6e9ee',pad=18,gapX=16,gapY=14,rowLab=170,secGap=40;
const S=[];
const cn=[['airman','Airman'],['airman-first-class','Airman 1st Class'],['senior-airman','Senior Airman'],['staff-sergeant','Staff Sergeant'],['technical-sergeant','Technical Sergeant'],
  ['master-sergeant','Master Sergeant'],['master-sergeant-first-sergeant','  + first sergeant'],['senior-master-sergeant','Senior Master Sgt'],['senior-master-sergeant-first-sergeant','  + first sergeant'],
  ['chief-master-sergeant','Chief Master Sgt'],['chief-master-sergeant-first-sergeant','  + first sergeant']];
const fsFix=k=>k.replace(/-first-sergeant$/,'');          // ids are rank-cadet-nco-<grade>-first-sergeant-<form>
S.push({title:'CADET NCO / AIRMAN',cols:[['metal','metal'],['cloth-bordered','cloth 1/8 in'],['ocp-square','OCP square']],
  rows:cn.map(([k,l])=>({label:l,id:c=>k.endsWith('-first-sergeant')?`rank-cadet-nco-${fsFix(k)}-first-sergeant-${c}`:`rank-cadet-nco-${k}-${c}`}))});
const co=[['second-lieutenant','2d Lt'],['first-lieutenant','1st Lt'],['captain','Captain'],['major','Major'],['lieutenant-colonel','Lt Col'],['colonel','Colonel']];
S.push({title:'CADET OFFICER',cols:[['metal-regular','metal'],['metal-miniature','metal mini'],['thread-regular-row','thread'],['thread-miniature-row','thread mini'],['cloth-bordered-regular','cloth'],['cloth-bordered-miniature','cloth mini'],['ocp-square','OCP square']],
  rows:co.map(([k,l])=>({label:l,id:c=>`rank-cadet-officer-${k}-${c}`}))});
const so=[['flight-officer','Flight Officer'],['technical-flight-officer','Technical Flight Off'],['senior-flight-officer','Senior Flight Off'],['second-lieutenant','2d Lt'],['first-lieutenant','1st Lt'],
  ['captain','Captain'],['major','Major'],['lieutenant-colonel','Lt Col'],['colonel','Colonel'],['brigadier-general-1in','Brig Gen 1 in'],['brigadier-general-3-4in','Brig Gen 3/4 in'],
  ['major-general-1in-horizontal','Maj Gen 1 in horiz'],['major-general-1in-vertical','Maj Gen 1 in vert'],['major-general-3-4in-horizontal','Maj Gen 3/4 horiz'],['major-general-3-4in-vertical','Maj Gen 3/4 vert']];
S.push({title:'SENIOR OFFICER',cols:[['thread','thread'],['cloth-bordered','cloth, 1/8 in'],['ocp-square','OCP square']],rows:so.map(([k,l])=>({label:l,id:c=>`rank-senior-${k}-${c}`}))});
const sn=[['staff-sergeant','Staff Sergeant'],['technical-sergeant','Technical Sergeant'],['master-sergeant','Master Sergeant'],['senior-master-sergeant','Senior Master Sgt'],['chief-master-sergeant','Chief Master Sgt'],['command-chief','CAP Command Chief']];
S.push({title:'SENIOR NCO CHEVRONS',cols:[['chevron-3p5in','3 1/2 in'],['chevron-4in','4 in']],rows:sn.map(([k,l])=>({label:l,id:c=>`rank-senior-${k}-${c}`}))});
const galleryIds=re=>[...have].filter(i=>re.test(i)).sort();
const gal=(title,ids,per)=>({title,cols:Array.from({length:per},()=>['x','']),gallery:ids,rows:Array.from({length:Math.ceil(ids.length/per)},(_,i)=>({label:'',id:()=>null}))});
S.push(gal('EPAULET SLEEVES - gray (officers / flight officers / no grade)',galleryIds(/^rank-epaulet-sleeve-gray-/),6));
S.push(gal('EPAULET SLEEVES - blue (cadet officers)',galleryIds(/^rank-epaulet-sleeve-blue-/),7));
S.push(gal('OTHER',['rank-senior-command-chief-chevron-4in','rank-cap-patch-no-grade','rank-ocp-square-blank'],3));
S.push({title:'BLANK SQUARE',cols:[['x','2 x 2 in']],rows:[{label:'senior member, no grade',id:()=>'rank-ocp-square-blank'}]});
// lay out each section
const blocks=S.map(sec=>{
  const grid=sec.rows.map((r,i)=>sec.cols.map(([c],j)=>{const id=sec.gallery?sec.gallery[i*sec.cols.length+j]:r.id(c);return id&&have.has(id)?load(id):null;}));
  const cw=sec.cols.map((c,j)=>Math.max(60,...grid.map(r=>r[j]?(r[j].id.endsWith('ocp-square')&&!r[j].id.includes('blank')?2:r[j].w)*PPI:0)));
  const rh=grid.map(r=>(sec.gallery?14:0)+Math.max(26,...r.map(it=>it?(it.id.endsWith('ocp-square')&&!it.id.includes('blank')?2:it.h)*PPI:0)));
  const w=rowLab+cw.reduce((a,b)=>a+b+gapX,0),h=30+sec.cols.length*0+18+rh.reduce((a,b)=>a+b+gapY,0);
  let g=`<text x="0" y="14" font-family="Arial" font-size="15" font-weight="bold" fill="${TXT}">${sec.title}</text>`;
  let x=rowLab;sec.cols.forEach(([c,l],j)=>{g+=`<text x="${x}" y="34" font-family="Arial" font-size="11" fill="#9aa3ad">${l}</text>`;x+=cw[j]+gapX;});
  let y=44;
  grid.forEach((r,i)=>{g+=`<text x="0" y="${y+rh[i]/2+4}" font-family="Arial" font-size="12" fill="${TXT}">${sec.rows[i].label.replace(/&/g,'&amp;')}</text>`;
    let xx=rowLab;
    r.forEach((it,j)=>{if(it){const sq=it.id.endsWith('ocp-square')&&!it.id.includes('blank');
      const bx=xx+(cw[j]-it.w*PPI)/2,by=y+(rh[i]-it.h*PPI)/2;
      if(sq)g+=`<rect x="${xx+(cw[j]-2*PPI)/2}" y="${y+(rh[i]-2*PPI)/2}" width="${2*PPI}" height="${2*PPI}" fill="${CLOTH}" stroke="#fff" stroke-opacity=".25"/>`;
      g+=`<g transform="translate(${(sq?xx+(cw[j]-2*PPI)/2:bx).toFixed(2)} ${(sq?y+(rh[i]-2*PPI)/2:by).toFixed(2)}) scale(${PPI/100})">${it.inner}</g>`;
      if(sec.gallery)g+=`<text x="${xx}" y="${y+rh[i]-2}" font-family="Arial" font-size="9" fill="#9aa3ad">${it.id.replace('rank-epaulet-sleeve-','').replace('rank-','')}</text>`;}
      else g+=`<text x="${xx+cw[j]/2-4}" y="${y+rh[i]/2+4}" font-size="12" fill="#555c66" font-family="Arial">–</text>`;
      xx+=cw[j]+gapX;});
    y+=rh[i]+gapY;});
  return {g,w,h:y};});
// two columns, greedy by height
const colsN=3,colH=Array(colsN).fill(pad),colX=[pad],place=[];
const maxW=Array(colsN).fill(0);blocks.forEach((b,i)=>{const c=colH.indexOf(Math.min(...colH));place.push([c,colH[c]]);colH[c]+=b.h+secGap;maxW[c]=Math.max(maxW[c],b.w);});
for(let c=1;c<colsN;c++)colX[c]=colX[c-1]+maxW[c-1]+60;
const W=colX[colsN-1]+maxW[colsN-1]+pad,H=Math.max(...colH)+pad,Sz=Math.max(W,H);
let body='';blocks.forEach((b,i)=>{body+=`<g transform="translate(${colX[place[i][0]]} ${place[i][1]})">${b.g}</g>`;});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Sz} ${Sz}" width="${Sz}" height="${Sz}"><rect width="${Sz}" height="${Sz}" fill="${BG}"/>${body}</svg>`;
const tmp=path.resolve(OUTF).replace(/\.png$/,'.svg');fs.writeFileSync(tmp,svg);
execSync(`qlmanage -t -s ${Math.ceil(Sz)} -o "${path.dirname(tmp)}" "${tmp}" >/dev/null 2>&1`);fs.renameSync(tmp+'.png',path.resolve(OUTF));fs.unlinkSync(tmp);
console.log({W:Math.round(W),H:Math.round(H),S:Math.round(Sz),content:[...have].length});
