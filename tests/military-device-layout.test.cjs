'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const layout=require('../military/military-device-layout.js');

test('ribbon layouts use purpose-configured one through five device slots',()=>{
  for(let count=1;count<=5;count++){
    const devices=Array.from({length:count},(_,index)=>`D${index}`);
    const positioned=layout.layoutDevices(devices,{context:'ribbon'});
    assert.equal(positioned.length,count);
    assert.ok(positioned.every(item=>item.y>=0 && item.y+item.height<=30));
  }
});

test('miniature medal devices use a separate suspension-ribbon context',()=>{
  const ribbon=layout.layoutDevices(['A','B'],{context:'ribbon'});
  const miniature=layout.layoutDevices(['A','B'],{context:'miniatureMedal'});
  assert.notEqual(ribbon[0].y,miniature[0].y);
  assert.equal(miniature[0].context,'miniatureMedal');
  assert.equal(miniature[0].x,miniature[1].x,'miniature devices stack on one vertical centerline');
  assert.ok(miniature[0].y<miniature[1].y,'miniature devices stack from top to bottom');
  assert.ok(miniature.every(item=>item.y+item.height<116),'devices must remain on the suspension ribbon');
  assert.equal(layout.DEFAULT_CONTEXTS.miniatureMedal.width,50);
  assert.equal(layout.DEFAULT_CONTEXTS.miniatureMedal.height,176);
});

test('full-size medal devices also stack vertically on the suspension ribbon',()=>{
  const positioned=layout.layoutDevices(['A','B','C'],{context:'fullSizeMedal'});
  assert.ok(positioned.every(item=>item.x===positioned[0].x));
  assert.ok(positioned[0].y<positioned[1].y && positioned[1].y<positioned[2].y);
  assert.equal(layout.DEFAULT_CONTEXTS.fullSizeMedal.width,100);
  assert.equal(layout.DEFAULT_CONTEXTS.fullSizeMedal.height,220);
});

test('award-specific placement can override the normal slots',()=>{
  const positioned=layout.layoutDevices(['V_DEVICE','BRONZE_OLC'],{
    context:'ribbon',awardOverride:{slots:{2:[0.43,0.66]},centerY:0.48}
  });
  assert.ok(positioned[0].x<positioned[1].x);
  assert.equal(positioned[0].y,6);
});
