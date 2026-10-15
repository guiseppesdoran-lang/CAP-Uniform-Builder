// Women's flight caps: the Fig A5-9 (p.140) caps produced by assets/build-flight-caps.js under the legacy ids hat-flight-cap-{general,officer,cadet}
// are republished as hat-flight-cap-women-{...} (same geometry, new ids/names); the legacy ids stay as aliases.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const D=path.join(__dirname,'..','assets','accessories');
cp.execSync('node build-flight-caps.js',{cwd:path.join(__dirname,'..','assets'),stdio:'ignore'});
for(const v of ['general','officer','cadet']){
  const old='hat-flight-cap-'+v,nw='hat-flight-cap-women-'+v;
  let svg=fs.readFileSync(path.join(D,old+'.svg'),'utf8'),spec=JSON.parse(fs.readFileSync(path.join(D,old+'.spec.json'),'utf8'));
  const nm=spec.name.replace(/^Flight cap/,"Women's flight cap");
  spec.asset_id=nw;spec.name=nm;spec.alias_of=undefined;
  svg=svg.split(old+'__').join(nw+'__').split(`data-asset-id="${old}"`).join(`data-asset-id="${nw}"`).replace(/"asset_id":"[^"]+"/,`"asset_id":"${nw}"`).replace(/"name":"[^"]+"/,`"name":${JSON.stringify(nm)}`).replace(/<title>[^<]*<\/title>/,`<title>${nm}</title>`);
  fs.writeFileSync(path.join(D,nw+'.svg'),svg);fs.writeFileSync(path.join(D,nw+'.spec.json'),JSON.stringify(spec,null,1));
  // legacy id keeps working, documented as the women's cap
  const sp0=JSON.parse(fs.readFileSync(path.join(D,old+'.spec.json'),'utf8'));sp0.alias_of=nw;sp0.name_note="legacy id: women's flight cap (Fig A5-9, p.140); use hat-flight-cap-women-* / hat-flight-cap-men-*";
  fs.writeFileSync(path.join(D,old+'.spec.json'),JSON.stringify(sp0,null,1));
  console.log('ok',nw);}
