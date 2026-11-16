'use strict';

const test=require('node:test');
const { readAppSource } = require('./helpers/app-source.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const indexSource=readAppSource();
const variantsSource=fs.readFileSync(path.join(root,'mcchord-ribbon-variants.js'),'utf8');

for(const [id,prefix] of [
  ['national_cadet_competition_ribbon','ncc'],
  ['national_color_guard_competition_ribbon','ncgc']
]){
  test(`${id} remains eligible and has all McChord device levels`,()=>{
    assert.match(indexSource,new RegExp(`['\"]${id}['\"]`));
    assert.match(variantsSource,new RegExp(`['\"]${id}['\"]\\s*:\\s*\\[`));
    const start=variantsSource.indexOf(`"${id}": [`);
    const levels=variantsSource.slice(start,variantsSource.indexOf('\n  ]',start)).match(/"value": "mcchord_/g) || [];
    assert.equal(levels.length,15);
  });
}

test('semantic competition-ribbon imports map back to McChord selector labels',()=>{
  for(const semantic of [
    'region_bronze_star','national_silver_star','two_bronze_stars',
    'silver_star_bronze_star','two_silver_stars','three_bronze_stars',
    'silver_star_two_bronze_stars','two_silver_stars_bronze_star',
    'three_silver_stars','four_bronze_stars','silver_star_three_bronze_stars',
    'two_silver_stars_two_bronze_stars','three_silver_stars_bronze_star','four_silver_stars'
  ]){
    assert.match(indexSource,new RegExp(`${semantic}:`));
  }
});

