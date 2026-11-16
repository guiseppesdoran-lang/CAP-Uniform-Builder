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

// The photographs also show the light on the pin's wall as a thin strip of chrome OUTSIDE the navy border, along the edge of one wing or one slope of the roof (the
// owner, 2026-11-13: "on the top of some of them theres a little silver line, which im guessing is glare"). The outside of the chevron is the navy border all the
// way round; the shield's own rim is the one piece of silver that touches the outline, and it has no free end. Measured on every asset, in user units:
// the navy border is the median distance from the outline (the navy field) to the silver's edge where that is 2.5 to 8 units (it comes out at 5.1 to 5.5, about 0.05 in).
const loopsOfGroup = (svg, name) => {
  const m = new RegExp('<g id="[^"]*__' + name + '"><path d="([^"]+)"').exec(svg);
  return m ? loops(m[1]) : [];
};
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
const distToPoly = (p, poly) => {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) m = Math.min(m, segDist(p, poly[j], poly[i]));
  return m;
};
const atArc = (p, i, s) => {
  const n = p.length, dir = s >= 0 ? 1 : -1;
  let k = i, rem = Math.abs(s), cur = p[i];
  for (let g = 0; g < n; g++) {
    const nx = p[((k + dir) % n + n) % n], l = Math.hypot(nx[0] - cur[0], nx[1] - cur[1]);
    if (l >= rem && l > 0) { const t = rem / l; return [cur[0] + (nx[0] - cur[0]) * t, cur[1] + (nx[1] - cur[1]) * t]; }
    rem -= l; cur = nx; k = ((k + dir) % n + n) % n;
  }
  return cur;
};

test('no cadet NCO chevron has silver outside its navy border: nothing lies outside the outline, no piece of silver lies wholly in the border, and no piece hugging the outline ends in a point', () => {
  for (const file of files) {
    const svg = fs.readFileSync(path.join(DIR, file), 'utf8');
    const field = loopsOfGroup(svg, 'field')[0], silver = loopsOfGroup(svg, 'silver');
    assert.ok(field && silver.length, file + ': outline and silver found');
    const d = silver.map((p) => p.map((v) => distToPoly(v, field)));
    const borders = d.flat().filter((x) => x >= 2.5 && x <= 8).sort((a, b) => a - b);
    const border = borders[borders.length >> 1];
    assert.ok(border > 4 && border < 7, file + ': the navy border measures ' + border + ' units, about 0.05 in');
    silver.forEach((p, li) => {
      // a silver vertex outside the outline would stand on the ground, past the border
      p.forEach((v, i) => {
        const outside = !(() => { let o = false; for (let a = 0, b = field.length - 1; a < field.length; b = a++) { const A = field[a], B = field[b]; if ((A[1] > v[1]) !== (B[1] > v[1]) && v[0] < (B[0] - A[0]) * (v[1] - A[1]) / (B[1] - A[1]) + A[0]) o = !o; } return o; })();
        assert.ok(!(outside && d[li][i] > 0.1), file + ': silver outside the outline at ' + v.join(','));
      });
      // a piece thinner than the border that lies wholly along the outline is glare, not a stripe
      assert.ok(!(p.length > 8 && Math.max(...d[li]) < 0.55 * border), file + ': silver loop ' + li + ' lies wholly within the border, ' + Math.max(...d[li]).toFixed(2) + ' units of the outline (border ' + border.toFixed(2) + ')');
      // a free end hugging the outline: a sharp point (under 30 degrees over 4 units each way) within 1 unit of it
      p.forEach((v, i) => {
        if (d[li][i] > 1.0) return;
        const a = atArc(p, i, -4), c = atArc(p, i, 4), u = [a[0] - v[0], a[1] - v[1]], w = [c[0] - v[0], c[1] - v[1]];
        const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w))))) * 180 / Math.PI;
        assert.ok(ang >= 30, file + ': silver ends in a point (' + ang.toFixed(0) + ' degrees) ' + d[li][i].toFixed(2) + ' units from the outline at ' + v.map((x) => x.toFixed(1)).join(','));
      });
    });
  }
});
