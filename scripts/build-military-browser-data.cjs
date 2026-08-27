#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const awards=JSON.parse(fs.readFileSync(path.join(ROOT,'data/import/normalized/military-awards.json'),'utf8'));
const devices=JSON.parse(fs.readFileSync(path.join(ROOT,'data/rules/verified/device-definitions.json'),'utf8'));
const payload=`(function(root){ root.CAPUBMilitaryData = Object.freeze(${JSON.stringify({awards,devices})}); })(typeof globalThis !== 'undefined' ? globalThis : window);\n`;
fs.writeFileSync(path.join(ROOT,'military','military-data.js'),payload);
console.log(`Wrote ${awards.length} awards and ${devices.length} devices to military/military-data.js`);
