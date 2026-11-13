const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// The cadet NCO chevrons are traced from photographs. The chrome shows glints in them, neutral
// highlights that became tiny silver islands along the edges of the stripes. On the grade tiles
// those read as a thin light line at the top of some chevrons. A silver piece under 3 square user
// units (0.0003 sq in, 1 user unit = 0.01 in) that is not a hole in a larger silver piece is a glint.
const DIR = path.join(__dirname, '..', 'images', 'insignia');
const GLINT_UNITS2 = 3;

const area = (poly) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const q = poly[(i + 1) % poly.length];
    a += poly[i][0] * q[1] - q[0] * poly[i][1];
  }
  return Math.abs(a / 2);
};
const centroid = (poly) => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length
];
const inside = (pt, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
const loops = (d) => d.split('M').filter(Boolean).map((s) =>
  s.replace(/Z.*$/i, '').split('L').map((p) => p.split(',').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)));
const silverPaths = (svg) => [...svg.matchAll(/<path d="([^"]+)"[^>]*fill="#d3d6d7"[^>]*>/g)].map((m) => m[1]);

const files = fs.readdirSync(DIR).filter((f) => /^rank-cadet-nco-.*\.svg$/.test(f));

test('every cadet NCO chevron asset is present', () => {
  assert.equal(files.length, 33);
});

test('no cadet NCO chevron carries a chrome glint, a silver island under 3 square units', () => {
  for (const file of files) {
    const svg = fs.readFileSync(path.join(DIR, file), 'utf8');
    const paths = silverPaths(svg);
    assert.ok(paths.length >= 1, file + ': silver path found');
    for (const d of paths) {
      const ps = loops(d);
      ps.forEach((p, i) => {
        if (area(p) >= GLINT_UNITS2) return;
        const c = centroid(p);
        const nested = ps.reduce((t, q, j) => t + (j !== i && area(q) > area(p) * 4 && inside(c, q) ? 1 : 0), 0);
        assert.ok(nested % 2 === 1, file + ': silver island of ' + area(p).toFixed(2) + ' square units near ' + c.map((v) => v.toFixed(1)).join(',') + ' is a glint');
      });
    }
  }
});
