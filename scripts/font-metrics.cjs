#!/usr/bin/env node
'use strict';
// Metrics of a bundled WOFF2 font, read from the file itself: units per em, ascender and descender (hhea and OS/2), x and cap height, and the advance
// of every capital, digit and punctuation mark the engraved lettering uses (js/engine/compose.js GLYPH_ADV, CAP_HEIGHT). LIVE13 E121: the nameplate's
// lettering is laid out from these numbers, not from a renderer's idea of a baseline, so a phone and a desktop draw the same plate.
//   node scripts/font-metrics.cjs [vendor/fonts/Ubuntu-Bold.woff2]     prints the metrics and the GLYPH_ADV table as compose.js carries it
// WOFF2 (W3C REC): a 48 byte header, a table directory whose entries carry a flags byte (the tag's index in KNOWN_TAGS, or 63 and a four byte tag,
// and the transform version in the top two bits), UIntBase128 lengths, and one Brotli stream holding every table in directory order. Only glyf and loca
// are transformed by default (version 0), and they are not read here.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -\'.,';

function base128(buf, off){ let v = 0; for(let i = 0; i < 5; i++){ const b = buf[off++]; v = v * 128 + (b & 0x7f); if(!(b & 0x80)) return [v, off]; } throw new Error('bad UIntBase128'); }

function tables(file){
  const b = fs.readFileSync(file);
  if(b.toString('ascii', 0, 4) !== 'wOF2') throw new Error(file + ' is not a WOFF2 file');
  const numTables = b.readUInt16BE(12), totalCompressed = b.readUInt32BE(20);
  let off = 48;
  const dir = [];
  for(let i = 0; i < numTables; i++){
    const flags = b[off++];
    let tag;
    if((flags & 0x3f) === 63){ tag = b.toString('ascii', off, off + 4); off += 4; } else tag = KNOWN_TAGS[flags & 0x3f];
    const version = (flags >> 6) & 3;
    let origLength, transformLength;
    [origLength, off] = base128(b, off);
    const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    if(transformed) [transformLength, off] = base128(b, off);
    dir.push({ tag, length: transformed ? transformLength : origLength });
  }
  const data = zlib.brotliDecompressSync(b.subarray(off, off + totalCompressed));
  const T = {};
  let p = 0;
  for(const t of dir){ T[t.tag] = data.subarray(p, p + t.length); p += t.length; }
  return T;
}

function metrics(file){
  const T = tables(file);
  const head = T.head, hhea = T.hhea, os2 = T['OS/2'], hmtx = T.hmtx, cmap = T.cmap, name = T.name;
  const unitsPerEm = head.readUInt16BE(18);
  const numberOfHMetrics = hhea.readUInt16BE(34);
  const os2Version = os2.readUInt16BE(0);
  // cmap: a format 4 subtable of the Unicode (0) or Windows (3) platform.
  const n = cmap.readUInt16BE(2);
  let sub = null;
  for(let i = 0; i < n; i++){ const pid = cmap.readUInt16BE(4 + i * 8), o = cmap.readUInt32BE(8 + i * 8); if(cmap.readUInt16BE(o) === 4 && (pid === 3 || pid === 0)) sub = o; }
  if(sub == null) throw new Error('no format 4 cmap');
  const glyphOf = cp => {
    const segX2 = cmap.readUInt16BE(sub + 6), segs = segX2 / 2;
    for(let s = 0; s < segs; s++){
      const end = cmap.readUInt16BE(sub + 14 + s * 2), start = cmap.readUInt16BE(sub + 16 + segX2 + s * 2), delta = cmap.readInt16BE(sub + 16 + segX2 * 2 + s * 2);
      const roAt = sub + 16 + segX2 * 3 + s * 2, ro = cmap.readUInt16BE(roAt);
      if(cp < start || cp > end) continue;
      if(ro === 0) return (cp + delta) & 0xffff;
      const g = cmap.readUInt16BE(roAt + ro + (cp - start) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
  const advance = g => hmtx.readUInt16BE(Math.min(g, numberOfHMetrics - 1) * 4);
  const advances = {};
  for(const ch of CHARS) advances[ch] = advance(glyphOf(ch.codePointAt(0)));
  const names = {};
  const nc = name.readUInt16BE(2), so = name.readUInt16BE(4);
  for(let i = 0; i < nc; i++){ const r = 6 + i * 12, pid = name.readUInt16BE(r), nid = name.readUInt16BE(r + 6), len = name.readUInt16BE(r + 8), o = name.readUInt16BE(r + 10); if(pid === 3 && (nid === 1 || nid === 4)) names[nid === 1 ? 'family' : 'full'] = Buffer.from(name.subarray(so + o, so + o + len)).swap16().toString('utf16le'); }
  return {
    file: path.basename(file), family: names.family, fullName: names.full, unitsPerEm,
    hhea: { ascender: hhea.readInt16BE(4), descender: hhea.readInt16BE(6) },
    os2: { version: os2Version, typoAscender: os2.readInt16BE(68), typoDescender: os2.readInt16BE(70), winAscent: os2.readUInt16BE(74), winDescent: os2.readUInt16BE(76), xHeight: os2Version >= 2 ? os2.readInt16BE(86) : null, capHeight: os2Version >= 2 ? os2.readInt16BE(88) : null },
    advances
  };
}

module.exports = { metrics, CHARS };
if(require.main === module){
  const file = process.argv[2] || path.join(__dirname, '..', 'vendor', 'fonts', 'Ubuntu-Bold.woff2');
  const m = metrics(file);
  console.log(`${m.fullName} (${m.file}): ${m.unitsPerEm} units per em; hhea ascender ${m.hhea.ascender} descender ${m.hhea.descender}; OS/2 cap height ${m.os2.capHeight}, x height ${m.os2.xHeight}, typo ${m.os2.typoAscender}/${m.os2.typoDescender}, win ${m.os2.winAscent}/${m.os2.winDescent}`);
  const keys = Object.keys(m.advances);
  const row = (from, to) => keys.slice(from, to).map(k => `${/^[A-Z0-9]$/.test(k) ? k : JSON.stringify(k)}: ${m.advances[k]}`).join(', ');
  console.log(`  const GLYPH_ADV = {\n    ${row(0, 13)},\n    ${row(13, 26)},\n    ${row(26, 36)},\n    ${row(36)}\n  };\n  const CAP_HEIGHT = ${m.os2.capHeight / m.unitsPerEm};`);
}
