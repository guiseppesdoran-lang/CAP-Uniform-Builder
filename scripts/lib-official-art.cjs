'use strict';
// Official digital artwork taken as given is the one raster the site ships (Ethan: unit and activity emblems are ingested as given, no recreations):
// images/patches/<id>/<id>.png, and only where the spec beside it, <id>.spec.json, says data_source is "official-digital-artwork-as-given". Read by
// scripts/build-site.cjs (what it publishes) and tests/helpers/no-raster.cjs (what the no-photo gate allows); the allowlist names nothing of it.
const fs = require('node:fs');
const path = require('node:path');

const PROVENANCE = 'official-digital-artwork-as-given';
const PATTERN = /^images\/patches\/([^/]+)\/\1\.png$/;

// rel: a path relative to the site's root, forward slashes.
function isOfficialRaster(root, rel){
  const m = PATTERN.exec(rel);
  if(!m) return false;
  try{
    const spec = JSON.parse(fs.readFileSync(path.join(root, 'images', 'patches', m[1], m[1] + '.spec.json'), 'utf8'));
    return spec.data_source === PROVENANCE;
  }catch(e){ return false; }
}

module.exports = { isOfficialRaster, PROVENANCE, PATTERN };
