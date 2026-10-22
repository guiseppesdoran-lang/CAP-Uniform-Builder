'use strict';
// FIX-R-OTHER-r2 review round 4 findings (engine side). One block per finding.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images', 'MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'images', p), 'utf8'))));
const compose = b => P.composeUniform(b, store);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const NAME = { first: 'Pat', last: 'Doe', show: true };
const PILOT = 'CAPPilot1_FA9D33EA587D8';
// A harness build (the same ids the page and the critique set use).
const hb = (uniform, gender, membership, rank, o) => HARNESS.makeBuild(Object.assign({ uniform, gender, membership, rank, name: NAME, opt: { rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' } }, o || {}));
const byKey = (scene, key) => scene.layers.find(l => l.key === key);
const badgeLayers = scene => scene.layers.filter(l => l.role === 'badge' && l.figure !== 2);

// ---- 3. Women's badge pair over the nametag: the first badge is nearest the collar ----------------------------

test('women\'s Class A and Class B: the first badge over the nametag is nearest the collar, the second to the wearer\'s right (4.1.9.4.4.2, 4.1.12.2.5.2)', async () => {
  for(const uniform of ['blues_a', 'blues_b']){
    const scene = await compose(hb(uniform, 'female', 'senior', 'Capt', { badgeIds: [PILOT, 'emergency_services_badge', 'communications_technician_badge'] }));
    const es = byKey(scene, 'badge:emergency_services_badge'), comms = byKey(scene, 'badge:communications_technician_badge');
    assert.ok(es && comms, `${uniform}: both specialty badges drawn`);
    // The wearer's right is the picture's left: the second badge has the smaller x.
    assert.ok(es.x > comms.x, `${uniform}: first badge (ES, x ${es.x}) is on the collar side of the second (Comms, x ${comms.x})`);
    near(es.x - (comms.x + comms.w), 0.5, 0.005, `${uniform}: 1/2 in apart`);
  }
});

test('women\'s pair: a CAP service badge is closest to the collar and National Staff to the wearer\'s right of a second badge, whatever the order the member listed (4.1.9.4.4.2, 4.1.12.2.5.2)', async () => {
  for(const uniform of ['blues_a', 'blues_b']){
    for(const order of [['emergency_services_badge', 'volunteer_university_instructor_badge'], ['volunteer_university_instructor_badge', 'emergency_services_badge']]){
      const scene = await compose(hb(uniform, 'female', 'senior', 'Capt', { badgeIds: order }));
      const vu = byKey(scene, 'badge:volunteer_university_instructor_badge'), es = byKey(scene, 'badge:emergency_services_badge');
      assert.ok(vu && es, `${uniform} ${order}: both drawn`);
      assert.ok(vu.x > es.x, `${uniform} ${order}: the service badge is the collar side`);
    }
    const scene = await compose(hb(uniform, 'female', 'senior', 'Capt', { badgeIds: ['emergency_services_badge', 'national_staff_badge'] }));
    const ns = byKey(scene, 'badge:national_staff_badge'), es = byKey(scene, 'badge:emergency_services_badge');
    assert.ok(ns && es && ns.x < es.x, `${uniform}: National Staff is to the wearer's right of the second badge`);
  }
});
