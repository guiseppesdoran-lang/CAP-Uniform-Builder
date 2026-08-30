'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const layout=require('../ribbon-layout.js');

test('automatic four-across rows can narrow but never widen again above',()=>{
  const counts=layout.findMonotonicRibbonRowCounts([4,4,3,2,2],11);
  assert.deepEqual(counts,[4,4,1,1,1]);
  assert.equal(layout.isMonotonicRibbonNarrowing(counts),true);
});

test('planner rejects a row sequence that would need to widen after narrowing',()=>{
  const counts=layout.findMonotonicRibbonRowCounts([4,1,3],7);
  assert.equal(counts,null);
});

test('planner preserves maximum-width lower rows when several layouts are valid',()=>{
  const counts=layout.findMonotonicRibbonRowCounts([4,4,4],9);
  assert.deepEqual(counts,[4,4,1]);
});
