// node normalize-size.js : make root width/height (in) and spec width_in/height_in exactly viewBox/100 for every military final + field asset
const fs=require('fs'),path=require('path');let n=0;
for(const set of ['af','af2','army','navy','usmc','uscg','field']){const base=set==='field'?'field':set+'/final';if(!fs.existsSync(base))continue;
  for(const d of fs.readdirSync(base)){const p=`${base}/${d}/${d}`;if(!fs.existsSync(p+'.svg'))continue;let t=fs.readFileSync(p+'.svg','utf8');
    const vb=t.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number),w=+(vb[2]/100).toFixed(5),h=+(vb[3]/100).toFixed(5);
    const cw=parseFloat((t.match(/<svg\b[^>]*?\swidth="([^"]*)"/)||[])[1]),ch=parseFloat((t.match(/<svg\b[^>]*?\sheight="([^"]*)"/)||[])[1]);
    if(Math.abs(cw-w)<1e-6&&Math.abs(ch-h)<1e-6)continue;n++;
    t=t.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/,'$1 width="'+w+'in"').replace(/(<svg\b[^>]*?)\sheight="[^"]*"/,'$1 height="'+h+'in"').replace(/"width_in":[0-9.]+/,'"width_in":'+w).replace(/"height_in":[0-9.]+/,'"height_in":'+h);
    fs.writeFileSync(p+'.svg',t);const j=JSON.parse(fs.readFileSync(p+'.spec.json'));j.width_in=w;j.height_in=h;fs.writeFileSync(p+'.spec.json',JSON.stringify(j,null,1));}}
console.log('normalised',n);
