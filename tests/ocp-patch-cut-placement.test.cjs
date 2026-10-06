const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('shared OCP artwork uses the same sleeve sprite geometry for both cuts',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../ocp-patch-variants.js'),'utf8');
 const context={variantIds:new Set(['nywg_ocp_patch','chest']),PATCH_META:{nywg_ocp_patch:{slotHint:'L_SHOULDER'},chest:{slotHint:'CHEST_LEFT'}},DEFAULT_CALIBRATION_BY_UNIFORM:{}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('  const ocpMaleHigherHeadquartersLocation'),source.indexOf('  const previousResolver')),context);
 const male=context.DEFAULT_CALIBRATION_BY_UNIFORM.ocp_male['patch:nywg_ocp_patch:L_SHOULDER:0'];
 const female=context.DEFAULT_CALIBRATION_BY_UNIFORM.ocp_female['patch:nywg_ocp_patch:L_SHOULDER:0'];
 assert.deepEqual(male,female);
 assert.equal(female.x,690);assert.equal(female.y,212);assert.equal(female.w,200);assert.equal(female.h,100);
 assert.equal(Object.keys(context.DEFAULT_CALIBRATION_BY_UNIFORM.ocp_female).length,1);
});
