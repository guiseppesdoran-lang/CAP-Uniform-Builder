const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=source.slice(source.indexOf('function capubInstallImageFallback('),source.indexOf('// Catch image elements created'));
test('exhausted global image retries resume renderer recovery exactly once',()=>{
 const context={window:{},console:{warn(){}},ASSET:p=>'images/'+p,capubImagePathCandidates:p=>[p,p.replace('.png','.jpg')],capubPushAssetCandidate:(list,p)=>{if(!list.includes(p))list.push(p);},capubAssetRelativeFromUrl:p=>p};
 vm.createContext(context);vm.runInContext(code,context);
 let recovered=0;
 const image={dataset:{},onerror(){assert.equal(this,image);recovered++;}};
 context.capubInstallImageFallback(image,'missing.png');
 // The capture-phase global handler can reinstall extension retries.
 context.capubInstallImageFallback(image,'missing.png');
 image.onerror();assert.equal(image.src,'images/missing.jpg');assert.equal(recovered,0);
 image.onerror();assert.equal(recovered,1);assert.equal(image.dataset.missing,'true');
});
