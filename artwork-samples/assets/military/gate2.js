// node gate2.js <set> <design__level> : hard gates + silhouette IoU for <set>/v2/<n>.svg (flat rule checked by check-asset)
const fs=require('fs'),path=require('path'),cp=require('child_process');
const S=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts'),[set,n]=process.argv.slice(2),here=__dirname;
const ref=`${here}/${set}/ref/${n}.png`,svg=`${here}/${set}/v2/${n}.svg`;
if(!fs.existsSync(svg)){console.error('missing',svg);process.exit(2);}
const tmp='/private/tmp/v2gate_'+set+'_'+n.replace(/\W/g,'_');fs.mkdirSync(tmp,{recursive:true});
const o=cp.spawnSync('node',[`${S}/emit-asset.js`,svg,'--id','gate','--width-in','2','--size-source','estimated','--basis','gate','--out',tmp],{encoding:'utf8'});
if(o.status){console.error(o.stderr);process.exit(2);}
const g=cp.spawnSync('node',[`${S}/check-asset.js`,`${tmp}/gate.svg`,ref],{encoding:'utf8'});console.log(g.stdout.trim()||g.stderr.slice(0,400));
