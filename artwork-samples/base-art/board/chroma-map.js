// class map by chroma: navy (blue-dominant, dark), chrome (neutral), red, bg. usage: node chroma-map.js in.png out.svg
const fs=require('fs'),dec=require('./dec.js');const d=dec(process.argv[2]),W=d.W,H=d.H;
let g='';const col={n:'#010066',c:'#c8cccc',r:'#d03638',b:null};
const cls=(x,y)=>{const p=d.px(x,y),l=0.3*p[0]+0.59*p[1]+0.11*p[2];if(Math.min(p[0],p[1],p[2])>238)return 'b';
  if(p[0]-p[1]>70&&p[0]>150&&p[0]-p[2]>50)return 'r';
  if(p[2]-p[0]>28&&l<110)return 'n';
  if(l<28)return 'n';
  return 'c';};
for(let y=0;y<H;y++){let run=null,st=0;for(let x=0;x<=W;x++){const c=x<W?cls(x,y):'b';if(c!==run){if(run&&run!=='b')g+=`<rect x="${st}" y="${y}" width="${x-st}" height="1" fill="${col[run]}"/>`;run=c;st=x;}}}
fs.writeFileSync(process.argv[3],`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W*2}" height="${H*2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${g}</svg>`);
