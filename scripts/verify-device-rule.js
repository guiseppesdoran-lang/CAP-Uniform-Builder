/*
  Proves that CAP device arithmetic reproduces McChord's pre-rendered ribbon
  artwork, so the 422 baked variants can be replaced by runtime compositing
  without guessing at what the images mean.

  Run:  node scripts/verify-device-rule.js

  The rule
  --------
  CAPR 39-3: each additional award adds a bronze star, and a silver star
  replaces five bronze. CAPR 39-1 11.4.2 caps one ribbon at four devices, so
  only some award counts fit on a single ribbon. Anything larger is worn as
  additional ribbons.

  The convention that matters
  ---------------------------
  The baked data counts EACH ribbon's base as one award. A 10th award is
  AA09 (1 silver + 3 bronze = 9) plus AA01 (1), not AA09 plus a bronze star.
  ribbonDevicesFromAdditionalAwards() in index.html uses the other convention -
  second ribbon as a pure continuation carrying leftover devices - so wiring
  the cutover straight to that function would silently change the meaning of
  every overflow level. Hence this file: the split below is the one the
  artwork actually encodes.
*/

'use strict';

const path = require('path');

require(path.join(__dirname, '..', 'mcchord-ribbon-variants.js'));
const VARIANTS = globalThis.MCCHORD_RIBBON_VARIANTS;

const MAX_DEVICES_PER_RIBBON = 4; // CAPR 39-1 11.4.2

/** Devices representing `additional` awards beyond the first. */
function devicesForAdditionalAwards(additional) {
  return { silver: Math.floor(additional / 5), bronze: additional % 5 };
}

function deviceCount(additional) {
  const d = devicesForAdditionalAwards(additional);
  return d.silver + d.bronze;
}

/** Award totals that fit on one ribbon within the four-device limit. */
const REPRESENTABLE = [];
for (let count = 1; count <= 21; count++) {
  if (deviceCount(count - 1) <= MAX_DEVICES_PER_RIBBON) REPRESENTABLE.push(count);
}

/**
 * Split a total award count across ribbons, largest representable first.
 * Each returned entry is the number of awards that ribbon stands for,
 * including its own base.
 */
function splitAwardsAcrossRibbons(total) {
  const ribbons = [];
  let remaining = total;
  while (remaining > 0) {
    let pick = 0;
    for (const count of REPRESENTABLE) if (count <= remaining) pick = count;
    if (!pick) { ribbons.push(remaining); break; }
    ribbons.push(pick);
    remaining -= pick;
  }
  return ribbons;
}

// Families whose levels are a plain "Nth Award" progression.
const AWARD_COUNT_FAMILIES = [
  'air_force_aerial_achievement_medal',
  'cadet_special_activity_ribbon',
  'cap_achievment_award',
  'distinguished_service_award',
  'encampment_ribbon',
  'exceptional_service_award',
  'meritorious_service_award',
  'national_commander_unit_citation_award',
  'unit_citation_award',
];

const trailingNumber = (file) => {
  const m = String(file || '').match(/(\d+)\.(png|webp)$/);
  return m ? parseInt(m[1], 10) : null;
};

function main() {
  console.log('single-ribbon representable award counts:', REPRESENTABLE.join(', '));
  console.log('(these are exactly the distinct images baked per family)\n');

  let checked = 0;
  const mismatches = [];

  for (const family of AWARD_COUNT_FAMILIES) {
    for (const [index, option] of (VARIANTS[family] || []).entries()) {
      const awards = index + 1;
      const baked = [option.image, ...(option.duplicates || []).map((d) => d.image)]
        .map(trailingNumber)
        .filter((n) => n !== null);
      if (!baked.length) continue; // family uses a non-numeric filename scheme
      const computed = splitAwardsAcrossRibbons(awards);
      checked++;
      if (JSON.stringify(baked) !== JSON.stringify(computed)) {
        mismatches.push({ family, awards, label: option.label, baked, computed });
      }
    }
  }

  console.log(`checked ${checked} award levels across ${AWARD_COUNT_FAMILIES.length} families`);
  console.log(`matched  ${checked - mismatches.length}`);
  console.log(`mismatch ${mismatches.length}`);
  for (const m of mismatches.slice(0, 20)) {
    console.log(`  ${m.family} ${m.label}: baked=[${m.baked}] computed=[${m.computed}]`);
  }
  return mismatches.length === 0 ? 0 : 1;
}

module.exports = { devicesForAdditionalAwards, splitAwardsAcrossRibbons, REPRESENTABLE };

if (require.main === module) process.exit(main());
