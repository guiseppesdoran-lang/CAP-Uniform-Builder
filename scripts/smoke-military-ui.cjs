'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

let browser;
(async()=>{
  browser=await chromium.launch({
    headless:true,
    executablePath:process.env.CAPUB_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(30000);
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{
    if(message.type()!=='error') return;
    const text=message.text();
    if(/ERR_NETWORK_ACCESS_DENIED|favicon.*404|status of 404/i.test(text)) return;
    errors.push(text);
  });
  await page.goto(process.env.CAPUB_URL || 'http://127.0.0.1:8765/',{waitUntil:'networkidle',timeout:30000});
  if(errors.length) throw new Error(`Initial browser errors:\n${errors.join('\n')}`);
  assert.equal(await page.evaluate(()=>!!window.State),true,'builder State was not initialized');

  await page.evaluate(()=>{
    window.State.membership='senior';
    window.State.gender='male';
    window.State.ribbonGalleryExpanded=true;
    buildRibbonGallery();
  });
  await page.locator('#expandRibbons').click();
  const root=page.locator('#galleryModalHost details[data-military-section="military-root"]');
  await root.evaluate(element=>element.open=true);
  const gallerySearch=page.locator('#galleryModalHost .militaryRibbonCatalogSearch');
  await gallerySearch.fill('air force cross');
  await page.locator('#galleryModalHost .militaryRibbonCatalogService').selectOption('AIR_FORCE');
  await page.waitForFunction(()=>document.querySelectorAll('#galleryModalHost .rbAwardSelect').length>=1);
  await page.locator('#capubV2ModalSearch').fill('air force cross');
  const filteredSelect=page.locator('#galleryModalHost .galleryTile:not(.isFilteredOut) .rbAwardSelect').first();
  await root.evaluate(element=>element.open=true);
  await filteredSelect.locator('xpath=ancestor::details[1]').evaluate(element=>element.open=true);
  await filteredSelect.selectOption(await filteredSelect.locator('option').nth(1).getAttribute('value'));
  assert.equal(await page.locator('#capubV2ModalSearch').inputValue(),'air force cross','main modal search reset after changing an award attribute');
  assert.equal(await page.locator('#galleryModalHost .militaryRibbonCatalogSearch').inputValue(),'air force cross','gallery search reset after changing an award attribute');
  assert.equal(await page.locator('#galleryModalHost .militaryRibbonCatalogService').inputValue(),'AIR_FORCE','gallery service filter reset after changing an award attribute');
  await page.locator('#galleryModalHost .militaryRibbonCatalogSearch').fill('');
  await page.locator('#galleryModalHost .militaryRibbonCatalogService').selectOption('ALL');
  await page.locator('#capubV2ModalSearch').fill('');
  await page.waitForTimeout(250);
  await page.waitForFunction(()=>document.querySelector('#galleryModalHost .militaryRibbonCatalogSearch')?.value==='');
  const branch=page.locator('#galleryModalHost details[data-military-section^="military-branch-"]').first();
  await branch.evaluate(element=>element.open=true);
  await branch.locator('.rbAwardSelect').first().waitFor();
  const select=branch.locator('.rbAwardSelect').first();
  await select.scrollIntoViewIfNeeded();
  await page.locator('#galleryModalHost').evaluate(element=>element.parentElement.scrollTop=180);
  const option=await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(option);
  assert.equal(await root.evaluate(element=>element.open),true,'military root collapsed after selection');
  const sameBranch=page.locator(`#galleryModalHost details[data-military-section="${await branch.getAttribute('data-military-section')}"]`);
  assert.equal(await sameBranch.evaluate(element=>element.open),true,'service accordion collapsed after selection');
  assert.ok(await page.locator('#galleryModalHost').evaluate(element=>element.parentElement.scrollTop)>0,'modal scroll position reset');

  await page.locator('#galleryModalCloseBtn').click();
  await page.locator('#organizationSelect').selectOption('AIR_FORCE');
  await page.locator('#militaryAwardSearch').fill('medal');
  await page.locator('#militaryAwardServiceFilter').selectOption('NAVY');
  const results=page.locator('#militaryAwardResults');
  const checkbox=results.locator('.militaryAwardOption input[type="checkbox"]').nth(6);
  await checkbox.scrollIntoViewIfNeeded();
  await results.evaluate(element=>element.scrollTop=Math.max(1,element.scrollTop));
  const before=await results.evaluate(element=>element.scrollTop);
  assert.ok(before>0,'catalog did not have a testable scroll position');
  await checkbox.check();
  assert.equal(await page.locator('#militaryAwardSearch').inputValue(),'medal');
  assert.equal(await page.locator('#militaryAwardServiceFilter').inputValue(),'NAVY');
  assert.equal(await results.evaluate(element=>element.scrollTop),before,'catalog scroll position changed');
  assert.equal(await checkbox.isChecked(),true,'award selection did not persist');
  assert.equal(await page.locator('#militarySelectedAwards .militarySelectedAward').count(),1,'selected-awards panel was not updated');
  await page.evaluate(()=>{
    window.State.organization='AIR_FORCE';
    window.State.militaryAwards={air_and_space_commendation_medal:{awardCount:7}};
    window.State.militaryRepresentation='RIBBON';
    fullRender();
  });
  const rackDiagnostic=await page.evaluate(()=>({
    organization:window.State.organization,
    representation:window.State.militaryRepresentation,
    awards:window.State.militaryAwards,
    selected:typeof getSelectedMilitaryAwards==='function' ? getSelectedMilitaryAwards().map(award=>award.id) : null,
    tiles:document.querySelectorAll('.militaryRackTile').length,
    note:document.querySelector('.militaryPreviewNote')?.textContent || '',
    errors:window.__capubErrors || []
  }));
  assert.ok(rackDiagnostic.tiles>0,`military ribbon rack did not render: ${JSON.stringify({rackDiagnostic,errors})}`);
  const composed=page.locator('.militaryRackTile').first();
  await composed.waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.militaryRackTile')?.src.startsWith('data:image/png;base64,'));
  assert.deepEqual(await composed.evaluate(image=>[image.naturalWidth,image.naturalHeight]),[100,30]);
  await page.locator('#militaryRepresentationMode').selectOption('MINIATURE_MEDAL');
  assert.match(await page.locator('.militaryPreviewNote').innerText(),/No selected award has a reviewed local miniature medal representation/);
  await page.locator('#militaryAwardServiceFilter').selectOption('ALL');
  await page.locator('#militaryAwardSearch').fill('');
  await page.locator('#militaryRenderableOnly').check();
  assert.equal(await page.locator('#militaryAwardResults .militaryAwardOption').count(),2,'miniature-medal availability filter did not use representation status');

  await page.evaluate(()=>{
    window.State.organization='AIR_FORCE';
    window.State.militaryAwards={air_medal:{awardCount:2}};
    window.State.militaryRepresentation='MINIATURE_MEDAL';
    fullRender();
  });
  const miniature=page.locator('.militaryMedalTile').first();
  await miniature.waitFor({state:'visible'});
  assert.match(await miniature.getAttribute('src'),/^data:image\/png;base64,/,'reviewed miniature was not flattened for preview/export');
  assert.equal(await page.evaluate(()=>{
    const awards=window.CAPUBMilitary.canonicalizeAwards(window.CAPUBMilitaryData.awards);
    return window.CAPUBMilitary.getAwardRepresentation(awards.find(award=>award.id==='air_medal'),'MINIATURE_MEDAL').asset;
  }),'images/mini_medals/mcchord/m_airmedal.png');

  await page.locator('#organizationSelect').selectOption('SPACE_FORCE');
  await page.locator('#militaryBadgeSection').evaluate(element=>element.open=true);
  const badgeResults=page.locator('#militaryBadgeResults');
  assert.ok(await badgeResults.locator('.militaryAwardOption').count()>=12,'Space Force official badge families were not listed');
  const badgeCheckbox=badgeResults.locator('input[type="checkbox"]').first();
  await badgeCheckbox.check();
  assert.equal(await badgeCheckbox.isChecked(),true,'military badge selection did not persist');
  assert.equal(await page.evaluate(()=>Object.keys(window.State.militaryBadges || {}).length),1,'military badge state was not updated');
  assert.match(await page.locator('.militaryPreviewNote').innerText(),/selected badge\(s\) have no approved local artwork and were not fabricated/);
  assert.equal(await page.locator('.militaryBadgeTile').count(),0,'missing military badge artwork was fabricated');

  await page.locator('#organizationSelect').selectOption('ARMY');
  await page.locator('#militaryBadgeSection').evaluate(element=>element.open=true);
  assert.ok(await badgeResults.locator('.militaryAwardOption').count()>=30,'official Army badge families were not listed');
  const aviatorRow=badgeResults.locator('[data-badge-id="army_aviator_badge"]');
  await aviatorRow.locator('.militaryBadgeVariant').selectOption('master');
  assert.deepEqual(await page.evaluate(()=>window.State.militaryBadges.army_aviator_badge),{selected:true,variant:'master'});
  const armyBadgeTile=page.locator('.militaryBadgeTile').first();
  await armyBadgeTile.waitFor({state:'visible'});
  assert.match(await armyBadgeTile.getAttribute('src'),/images\/military-badges\/army\/army_aviator_badge\/master\.png$/);
  assert.deepEqual(await armyBadgeTile.evaluate(image=>[image.naturalWidth,image.naturalHeight]),[256,160]);
  const armySelectorPreview=aviatorRow.locator('.militaryBadgeSelectorPreview');
  assert.equal(await armySelectorPreview.count(),1,'reviewed Army badge thumbnail was not shown');

  await page.locator('#organizationSelect').selectOption('NAVY');
  await page.locator('#militaryBadgeSection').evaluate(element=>element.open=true);
  assert.ok(await badgeResults.locator('.militaryAwardOption').count()>=37,'official Navy badge families were not listed');
  const swccRow=badgeResults.locator('[data-badge-id="navy_special_warfare_combatant_craft_crewman_insignia"]');
  await swccRow.locator('.militaryBadgeVariant').selectOption('master');
  assert.deepEqual(await page.evaluate(()=>window.State.militaryBadges.navy_special_warfare_combatant_craft_crewman_insignia),{selected:true,variant:'master'});

  await page.locator('#organizationSelect').selectOption('MARINE_CORPS');
  await page.locator('#militaryBadgeSection').evaluate(element=>element.open=true);
  assert.ok(await badgeResults.locator('.militaryAwardOption').count()>=17,'official Marine Corps badge families were not listed');
  const uasRow=badgeResults.locator('[data-badge-id="marine_corps_unmanned_aircraft_system_insignia"]');
  await uasRow.locator('.militaryBadgeVariant').selectOption('officer');
  assert.deepEqual(await page.evaluate(()=>window.State.militaryBadges.marine_corps_unmanned_aircraft_system_insignia),{selected:true,variant:'officer'});

  await page.locator('#organizationSelect').selectOption('AIR_FORCE');
  await page.locator('#militaryBadgeSection').evaluate(element=>element.open=true);
  assert.ok(await badgeResults.locator('.militaryAwardOption').count()>=36,'official Air Force badge families were not listed');
  const pilotRow=badgeResults.locator('[data-badge-id="air_force_pilot_badge"]');
  await pilotRow.locator('.militaryBadgeVariant').selectOption('command_pilot');
  assert.deepEqual(await page.evaluate(()=>window.State.militaryBadges.air_force_pilot_badge),{selected:true,variant:'command_pilot'});

  await page.locator('#organizationSelect').selectOption('CAP');
  await page.evaluate(()=>{
    window.State.membership='senior'; window.State.gender='male'; window.State.rank='capt'; window.State.uniform='blues_a';
    window.State.militaryBadges={}; refreshUI(); fullRender();
  });
  await page.locator('#expandBadges').click();
  const capMilitaryRoot=page.locator('#galleryModalHost details[data-military-badge-catalog="true"]');
  await capMilitaryRoot.evaluate(element=>element.open=true);
  const capArmyBadge=page.locator('#galleryModalHost [data-military-badge-id="army_aviator_badge"]');
  await capArmyBadge.locator('xpath=ancestor::details[1]').evaluate(element=>element.open=true);
  await capArmyBadge.locator('.militaryBadgeCatalogCheck').check();
  assert.equal(await page.evaluate(()=>!!window.State.militaryBadges.army_aviator_badge),true,'CAP badge picker did not retain the military badge selection');
  assert.equal(await page.locator('.capMilitaryBadge').count(),1,'selected military badge did not render on the CAP uniform');
  assert.deepEqual(errors,[],'browser errors were reported');
  process.stdout.write(JSON.stringify({modalAccordionPreserved:true,modalScrollPreserved:true,searchPreserved:true,gallerySearchPreserved:true,filterPreserved:true,catalogScrollPreserved:true,selectedPanel:true,representationAvailabilityFilter:true,flattenedRibbonPng:true,missingMiniatureNotFabricated:true,reviewedMiniatureRendered:true,officialBadgeCatalogListed:true,badgeSelectionPersisted:true,capMilitaryBadgeSelection:true,capMilitaryBadgeRendered:true,missingBadgeNotFabricated:true,armyBadgeFamiliesListed:true,armyBadgeArtworkRendered:true,navyBadgeFamiliesListed:true,marineCorpsBadgeFamiliesListed:true,airForceBadgeFamiliesListed:true,spaceForceBadgeFamiliesListed:true,badgeVariantSelectionPersisted:true},null,2)+'\n');
})().catch(error=>{ console.error(error); process.exitCode=1; }).finally(async()=>{ if(browser) await browser.close(); });
