'use strict';
// Every control a member could use before the stepper (150643f2) is still on the page, in the step a member expects it,
// or is built by the page. The owner: "when the UI update came out that made everything separate menus, we lost a LOT of
// features". The list below is that inventory; a control that goes must be taken off the list on purpose (and, if the
// owner asked for it, named in REMOVED).

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('index.html');
const aside=html.slice(html.indexOf('<aside id="controls"'),html.indexOf('</aside>'));
const ids=[...html.matchAll(/(?<![-\w])id="([^"]+)"/g)].map(m=>m[1]);
const stepOf=id=>{
  const at=aside.indexOf(`id="${id}"`);
  if(at<0) return null;
  const groups=[...aside.matchAll(/id="stepGroup-([a-z]+)"/g)].filter(m=>m.index<at);
  return groups.length ? groups[groups.length-1][1] : null;
};
const buttonText=id=>{
  const m=new RegExp(`<button[^>]*\\bid="${id}"[^>]*>([^<]*)<`).exec(html);
  return m ? m[1].replace(/\s+/g,' ').trim() : null;
};

// [id, step it lives in, visible label for a button (or null)]
const ON_THE_PAGE=[
  ['importMemberReportBtn','profile','Import member report…'],
  ['memberReportUpload','profile',null],
  ['memberReportImportStatus','profile',null],
  ['clearImportedReportBtn','profile','Clear import notes'],
  ['membershipType','profile',null],
  ['adultCadetCheckbox','profile',null],
  ['rankSetupSelect','profile',null],
  ['cadetFirstSergeantCheckbox','profile',null],
  ['jacketSelect','profile',null],
  ['capubV2FirstName','profile',null],
  ['capubV2LastName','profile',null],
  ['capubV2PlateLine','profile',null],
  ['capubV2ShowText','profile',null],
  ['uniformList','uniform',null],
  ['shoulderCordSelect','uniform',null],
  ['garmentOptions','uniform',null],
  ['expandRibbons','items','Choose…'],
  ['clearRibbons','items','Clear'],
  ['cadetHighestOnly','items',null],
  ['removeRibbons','items',null],
  ['miniMountStyle','items',null],
  ['ribbonRackColumns','items',null],
  ['ribbonRackArrangement','items',null],
  ['ribbonRowOverrideEnabled','items',null],
  ['addRibbonOverrideRow','items','Add top row'],
  ['removeRibbonOverrideRow','items','Remove top row'],
  ['expandBadges','items','Choose…'],
  ['clearBadges','items','Clear'],
  ['expandPatches','items','Choose…'],
  ['clearPatches','items','Clear'],
  ['unitPatchSearch','items',null],
  ['unitPatchSelect','items',null],
  ['downloadImage','export','Download picture (PNG)'],
  ['capubV2ExportJson','export','Save to a file'],
  ['capubV2ImportBtn','export','Open a saved file'],
  ['capubV2ImportFile','export',null],
  ['capubV2SaveLocal','export','Save to browser'],
  ['capubV2LoadLocal','export','Load saved'],
  ['capubV2Reset','export','Reset builder'],
  ['capubV2RibbonCount','export',null],
  ['capubV2BadgeCount','export',null],
  ['capubV2PatchCount','export',null],
  ['capubV2WarningCount','export',null],
  ['capubV2Notices','export',null],
  ['purchaseListSlot','export',null]
];

test('every control of the old sidebar is on the page once, in the step it belongs to, with its label',()=>{
  for(const [id,step,label] of ON_THE_PAGE){
    assert.equal(ids.filter(x=>x===id).length,1,`id="${id}" is on the page exactly once`);
    assert.equal(stepOf(id),step,`${id} is in the ${step} step`);
    if(label) assert.equal(buttonText(id),label,`${id} reads "${label}"`);
  }
});

test('the page-level controls: header, preview toolbar, footer, windows',()=>{
  for(const id of ['hamburgerBtn','aboutOpen','aboutDialog','aboutClose','galleryModalOverlay','galleryModalCloseBtn','galleryModalDoneBtn','stepBack','stepNext','stepBody','stepFooter']){
    assert.equal(ids.filter(x=>x===id).length,1,`id="${id}"`);
  }
  assert.equal(buttonText('aboutOpen'),'About');
});

// Controls the scripts build, with the file that builds each and the words it carries.
const BUILT=[
  ['themeToggle','js/workspace-ui.js',"'Light mode'"],
  ['undoBtn','js/workspace-ui.js','>Undo<'],
  ['redoBtn','js/workspace-ui.js','>Redo<'],
  ['zoomOutBtn','js/workspace-ui.js','zoomOutBtn'],
  ['zoomInBtn','js/workspace-ui.js','zoomInBtn'],
  ['zoomFitBtn','js/workspace-ui.js','>Fit<'],
  ['measureBtn','js/workspace-ui.js','>Measurements<'],
  ['capubResumeYes','js/workspace-ui.js',"'Resume'"],
  ['capubResumeNo','js/workspace-ui.js',"'Start over'"],
  ['previewToolbar','js/workspace-ui.js','previewToolbar'],
  ['placementTemplatesOpen','js/placement-templates.js','Placement templates'],
  ['purchaseListButton','purchase-feature-core.js','Shopping list'],
  ['feedbackOpen','js/feedback.js','Feedback'],
  ['modalShowLess','js/wiring.js','Show less'],
  ['modalShowAll','js/wiring.js','Show all'],
  ['capubV2ModalSearch','js/wiring.js','by name or category']
];
test('the controls the page builds are still built',()=>{
  for(const [id,file,needle] of BUILT){
    const src=read(file);
    assert.ok(src.includes(id),`${file} builds ${id}`);
    assert.ok(src.includes(needle),`${file} carries ${needle}`);
  }
  // The preview's remove popover: Remove and Keep.
  const ui=read('js/workspace-ui.js');
  assert.match(ui,/del\.textContent='Remove'/);
  assert.match(ui,/keep\.textContent='Keep'/);
  // Undo and redo with the keyboard.
  assert.match(ui,/e\.key\.toLowerCase\(\)!=='z'/);
});

// The owner's removals: these are gone on purpose and stay gone.
const REMOVED=['quickStripBtn','quickStripPanel','quickStripHint','sheetClose','stepGroup-tools','cmdValidate','cmdRibbons','previewEmptyState'];
test('what the owner removed stays removed',()=>{
  for(const id of REMOVED) assert.ok(!ids.includes(id),`${id} is gone from the page`);
  assert.doesNotMatch(read('js/workspace-ui.js'),/id="topStatusText"|capubCommandBar/);
});

test('nothing in the panel hides a control in a fold that starts closed, apart from the uniforms a member may not wear',()=>{
  const folds=[...aside.matchAll(/<details\b([^>]*)>/g)].map(m=>m[1]);
  for(const attrs of folds){
    if(/id="lockedUniforms"/.test(attrs)) continue;
    assert.match(attrs,/\bopen\b/,`<details${attrs}> is open by default`);
  }
});

test('the controls panel can be hidden and shown on a desktop: the button, its labels and the wiring',()=>{
  const setup=read('js/setup.js');
  assert.match(html,/<button id="hamburgerBtn"[^>]*aria-controls="controls"/);
  assert.match(setup,/hamburgerBtn\.addEventListener\('click', capubToggleSidebar\)/);
  assert.match(setup,/'Hide the controls' : 'Show the controls'/);
  assert.match(read('styles/app.css'),/@media \(min-width:701px\)\{[^@]*\.hamburgerBtn\{[^}]*display:flex/);
});

test('the menu button hides the panel, says what it will do, and shows it again',()=>{
  const vm=require('node:vm');
  const setup=read('js/setup.js');
  const src=setup.slice(setup.indexOf('function capubSetSidebarOpen'),setup.indexOf('capubSetSidebarOpen(!window.matchMedia'));
  const classes=new Set(['sidebar-open']);
  const attrs={};
  const events=[];
  const ctx={
    layoutShell:{classList:{toggle:(c,on)=>{ on?classes.add(c):classes.delete(c); },contains:c=>classes.has(c)}},
    hamburgerBtn:{setAttribute:(k,v)=>{ attrs[k]=v; },title:''},
    document:{dispatchEvent:e=>events.push(e.detail.open)},
    CustomEvent:class{ constructor(type,init){ this.type=type; this.detail=init.detail; } }
  };
  vm.createContext(ctx);
  vm.runInContext(src+';this.toggle=capubToggleSidebar;this.set=capubSetSidebarOpen;',ctx);
  ctx.toggle();
  assert.ok(classes.has('sidebar-collapsed') && !classes.has('sidebar-open'));
  assert.equal(attrs['aria-expanded'],'false');
  assert.equal(attrs['aria-label'],'Show the controls');
  assert.equal(ctx.hamburgerBtn.title,'Show the controls');
  ctx.toggle();
  assert.ok(classes.has('sidebar-open'));
  assert.equal(attrs['aria-label'],'Hide the controls');
  assert.deepEqual(events,[false,true]);
});
