'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname,'..');
const awards = require('../data/import/normalized/military-awards.json');

function isSupportedImage(buffer){
  if(buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return true;
  if(buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if(buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0,6).toString('ascii'))) return true;
  if(buffer.length >= 12 && buffer.subarray(0,4).toString('ascii') === 'RIFF' && buffer.subarray(8,12).toString('ascii') === 'WEBP') return true;
  return /^(?:<\?xml[\s\S]*?\?>\s*)?<svg\b/i.test(buffer.toString('utf8',0,Math.min(buffer.length,1024)).trim());
}

test('every military ribbon has a valid local repository asset', () => {
  const ribbons=awards.filter(award=>award.type === 'RIBBON');
  assert.ok(ribbons.length>0);
  for(const award of ribbons){
    assert.ok(award.images?.ribbon,`${award.id} is missing images.ribbon`);
    assert.notEqual(award.images?.assetStatus,'SOURCE_ONLY',`${award.id} is still source-only`);
    const absolute=path.join(ROOT,...award.images.ribbon.split('/'));
    assert.ok(fs.existsSync(absolute),`${award.id} local asset does not exist: ${award.images.ribbon}`);
    const buffer=fs.readFileSync(absolute);
    assert.ok(buffer.length>0,`${award.id} local asset is empty`);
    assert.ok(isSupportedImage(buffer),`${award.id} local asset is not a supported image`);
  }
});
