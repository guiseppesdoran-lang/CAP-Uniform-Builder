// node sbs2.js <set> <design__level> [scale] -> <set>/v2sbs/<n>.png : reference LEFT, v2 redraw RIGHT (reads <set>/v2/<n>.svg)
const cp=require('child_process'),fs=require('fs'),path=require('path');
const [set,n,sc='3']=process.argv.slice(2),here=__dirname,S=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts');
fs.mkdirSync(`${here}/${set}/v2sbs`,{recursive:true});
const o=cp.spawnSync('node',[`${S}/sidebyside.js`,`${here}/${set}/ref/${n}.png`,`${here}/${set}/v2/${n}.svg`,`${here}/${set}/v2sbs/${n}.png`,'--scale',sc],{encoding:'utf8'});
console.log((o.stdout+o.stderr).trim().slice(-300));
