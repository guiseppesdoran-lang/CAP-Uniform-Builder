/* CAP Uniform Builder Purchase Catalog
   Purchase prices are last-observed or budgeting estimates and should be verified before checkout.
*/
(function(){
  'use strict';
  const VANGUARD='https://www.vanguardmil.com';
  const U4U='https://www.uniforms-4u.com';
  const IRA='https://www.iragreen.com';
  const enc=q=>encodeURIComponent(String(q||'').trim());
  const vgSearch=q=>`${VANGUARD}/search?q=${enc(q)}`;
  const iraSearch=q=>`${IRA}/catalogsearch/result/?q=${enc(q)}`;
  const product=(price,url,name,priceStatus='verified',note='')=>({price,priceStatus,url,name,note});
  const verified=(price,url,name,note='')=>product(price,url,name,'verified',note);
  const estimated=(price,url,name,note='')=>product(price,url,name,'estimated',note);
  const vg=path=>`${VANGUARD}${path}`;

  const C=window.CAPUB_PURCHASE_CATALOG={
    version:'2026.08.08.1',
    priceChecked:'2026-08-08',
    currency:'USD',
    sourceRules:{
      CAP_ONLY:'CAP-specific item — do not substitute a visually similar military item.',
      MILSPEC_OK:'Standard military-spec component — an equivalent military-spec item may be used only where CAP authorizes the same component.',
      GENERIC_SPEC:'Generic item is acceptable only if it meets the required specification.',
      VERIFY:'Verify the exact authorized version before purchasing.'
    },
    vendors:{
      vanguard:{name:'Vanguard',home:VANGUARD},
      uniforms4u:{name:'Uniforms-4U',home:U4U},
      iragreen:{name:'Ira Green',home:IRA}
    },
    fallbackPrices:{
      'Base uniform':75,'Headgear':30,'Footwear':50,'CAP insignia':8,'CAP rank':12,
      'Ribbons':1.60,'Miniature medals':11.35,'Award devices':2.20,'Badges':11,'Patches':4.65,'Accessories':25,'Other':10
    },
    items:{
      blue_shirt_male:{name:"Men's USAF long-sleeve blue shirt",category:'Base uniform',sourceRule:'MILSPEC_OK',price:69.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:69.99,url:`${U4U}/p-us-air-force-long-sleeve-dress-shirt-6661.aspx`},{vendor:'iragreen',label:'Ira Green search',url:iraSearch('Air Force blue shirt male')}]},
      blue_blouse_female:{name:"Women's USAF blue blouse",category:'Base uniform',sourceRule:'MILSPEC_OK',price:69.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U female Class B',url:`${U4U}/p-us-air-force-female-enlisted-uniform-13553.aspx`},{vendor:'iragreen',label:'Ira Green search',url:iraSearch('Air Force female blue blouse')}]},
      trousers_male:{name:'USAF service dress trousers',category:'Base uniform',sourceRule:'MILSPEC_OK',price:99.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:99.99,url:`${U4U}/p-us-air-force-class-a-dress-uniform-trousers-6662.aspx`}]},
      slacks_female:{name:"Women's USAF blue slacks",category:'Base uniform',sourceRule:'MILSPEC_OK',price:99.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U female service dress',url:`${U4U}/p-usaf-female-officer-dress-uniform-5254.aspx`}]},
      blue_belt:{name:'USAF blue belt with silver tip/buckle',category:'Base uniform',sourceRule:'MILSPEC_OK',price:32.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:32.99,url:`${U4U}/p-air-force-uniform-blue-belt-3924.aspx`}]},
      blue_tie_male:{name:'USAF blue tie',category:'Base uniform',sourceRule:'MILSPEC_OK',price:26.99,priceStatus:'verified',conditional:true,links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:26.99,url:`${U4U}/p-air-force-uniform-blue-tie-four-in-hand-3925.aspx`}]},
      blue_tie_tab_female:{name:'USAF blue tie tab',category:'Base uniform',sourceRule:'MILSPEC_OK',price:23.99,priceStatus:'verified',conditional:true,links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:23.99,url:`${U4U}/p-air-force-neck-tab-with-hook-closure-11829.aspx`}]},
      flight_cap_enlisted_male:{name:'USAF enlisted flight cap — male',category:'Headgear',sourceRule:'MILSPEC_OK',price:23.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:23.99,url:`${U4U}/p-us-air-force-airmen-enlisted-garrison-cap-6855.aspx`}]},
      flight_cap_officer_male:{name:'USAF officer flight cap — male',category:'Headgear',sourceRule:'MILSPEC_OK',price:29.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:29.99,url:`${U4U}/p-us-air-force-officer-s-garrison-cap-with-blue-silver-cordedge-5579.aspx`}]},
      flight_cap_enlisted_female:{name:'USAF enlisted flight cap — female',category:'Headgear',sourceRule:'MILSPEC_OK',price:23.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/p-usaf-female-enlisted-garrison-cap-12148.aspx`}]},
      flight_cap_officer_female:{name:'USAF officer flight cap — female',category:'Headgear',sourceRule:'MILSPEC_OK',price:27.59,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:27.59,url:`${U4U}/p-usaf-female-officer-garrison-cap-12149.aspx`}]},
      service_coat_enlisted_male:{name:"Men's USAF enlisted-style service dress coat",category:'Base uniform',sourceRule:'MILSPEC_OK',price:249.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:249.99,url:`${U4U}/p-usaf-enlisted-male-service-dress-coat-14147.aspx`}]},
      service_coat_officer_male:{name:"Men's USAF officer service dress coat",category:'Base uniform',sourceRule:'MILSPEC_OK',price:259.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:259.99,url:`${U4U}/p-usaf-officer-blue-uniform-coat-3633.aspx`}]},
      service_coat_enlisted_female:{name:"Women's USAF enlisted-style service dress coat",category:'Base uniform',sourceRule:'MILSPEC_OK',price:249.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U female service dress',url:`${U4U}/p-usaf-female-enlisted-dress-uniform-18634.aspx`}]},
      service_coat_officer_female:{name:"Women's USAF officer service dress coat",category:'Base uniform',sourceRule:'MILSPEC_OK',price:259.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U female officer service dress',url:`${U4U}/p-usaf-female-officer-dress-uniform-5254.aspx`}]},
      black_dress_shoes:{name:'Black dress shoes meeting CAP/USAF specifications',category:'Footwear',sourceRule:'GENERIC_SPEC',price:100,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:U4U},{vendor:'iragreen',label:'Ira Green',url:IRA}]},
      black_socks:{name:'Black dress socks',category:'Footwear',sourceRule:'GENERIC_SPEC',price:11.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:U4U}]},
      cap_nameplate_cadet:{name:'CAP cadet blue name plate',category:'CAP insignia',sourceRule:'CAP_ONLY',price:5.10,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard',price:5.10,url:vg('/products/civil-air-patrol-cadet-name-plate')}]},
      cap_nameplate_senior:{name:'CAP senior member gray name plate',category:'CAP insignia',sourceRule:'CAP_ONLY',price:5.10,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard',price:5.10,url:vg('/products/civil-air-patrol-senior-member-name-plate')}]},
      cap_cadet_officer_boards_male:{name:'CAP cadet officer shoulder boards — male service coat',category:'CAP rank',sourceRule:'CAP_ONLY',price:41.30,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard',price:41.30,url:vg('/products/civil-air-patrol-cadet-officer-shoulder-board-for-service-coat')}]},
      cap_cadet_officer_boards_female:{name:'CAP cadet officer shoulder boards — female service coat',category:'CAP rank',sourceRule:'CAP_ONLY',price:41.30,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard',price:41.30,url:vg('/products/civil-air-patrol-shoulder-board-cadet-female-officer-wear-on-service-coat')}]},
      mess_coat_male:{name:"Men's USAF mess dress coat",category:'Base uniform',sourceRule:'MILSPEC_OK',price:229.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:229.99,url:`${U4U}/p-usaf-mess-dress-officer-uniform-11745.aspx`}]},
      mess_shirt_male:{name:"Men's mess dress shirt",category:'Base uniform',sourceRule:'MILSPEC_OK',price:89.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:89.99,url:`${U4U}/p-usaf-mess-dress-officer-uniform-11745.aspx`}]},
      mess_trousers_male:{name:'USAF mess dress trousers',category:'Base uniform',sourceRule:'MILSPEC_OK',price:99.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:99.99,url:`${U4U}/p-us-air-force-mess-dress-uniform-high-rise-trousers-8294.aspx`}]},
      mess_coat_female:{name:"Women's USAF mess dress coat",category:'Base uniform',sourceRule:'MILSPEC_OK',price:229.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:229.99,url:`${U4U}/p-usaf-female-officer-mess-dress-4020.aspx`}]},
      mess_blouse_female:{name:"Women's mess dress blouse",category:'Base uniform',sourceRule:'MILSPEC_OK',price:89.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/p-usaf-female-officer-mess-dress-4020.aspx`}]},
      mess_skirt_female:{name:"Women's mess dress skirt",category:'Base uniform',sourceRule:'MILSPEC_OK',price:99.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/p-usaf-female-officer-mess-dress-4020.aspx`}]},
      mess_cummerbund:{name:'USAF blue satin cummerbund',category:'Base uniform',sourceRule:'MILSPEC_OK',price:52.99,priceStatus:'verified',links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:52.99,url:U4U}]},
      mess_bow_tie:{name:'USAF blue satin bow tie',category:'Base uniform',sourceRule:'MILSPEC_OK',price:24.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:U4U}]},
      white_dress_shirt:{name:'White dress shirt',category:'Base uniform',sourceRule:'GENERIC_SPEC',price:39.99,priceStatus:'estimated',links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:U4U}]},
      gray_slacks:{name:'CAP-authorized gray slacks',category:'Base uniform',sourceRule:'GENERIC_SPEC',price:54.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol gray slacks')}]},
      black_belt:{name:'Black belt and buckle',category:'Base uniform',sourceRule:'GENERIC_SPEC',price:24.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol black belt buckle')}]},
      corporate_blazer:{name:'CAP corporate blazer',category:'Base uniform',sourceRule:'CAP_ONLY',price:149.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol corporate blazer')}]},
      corporate_field_shirt:{name:'CAP corporate field uniform shirt',category:'Base uniform',sourceRule:'CAP_ONLY',price:49.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol corporate field uniform shirt')}]},
      corporate_field_trousers:{name:'CAP corporate field uniform trousers',category:'Base uniform',sourceRule:'CAP_ONLY',price:49.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol corporate field uniform trousers')}]},
      abu_coat:{name:'ABU coat',category:'Base uniform',sourceRule:'MILSPEC_OK',price:49.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('ABU coat')}]},
      abu_trousers:{name:'ABU trousers',category:'Base uniform',sourceRule:'MILSPEC_OK',price:49.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('ABU trousers')}]},
      ocp_coat:{name:'OCP coat',category:'Base uniform',sourceRule:'MILSPEC_OK',price:69,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard search',price:69,url:vgSearch('OCP coat')}]},
      ocp_trousers:{name:'OCP trousers',category:'Base uniform',sourceRule:'MILSPEC_OK',price:69,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard search',price:69,url:vgSearch('OCP trousers')}]},
      ocp_cap:{name:'OCP patrol cap',category:'Headgear',sourceRule:'MILSPEC_OK',price:14.45,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard search',price:14.45,url:vgSearch('OCP patrol cap')}]},
      tan_shirt:{name:'Tan CAP T-shirt',category:'Base uniform',sourceRule:'CAP_ONLY',price:9.40,priceStatus:'verified',links:[{vendor:'vanguard',label:'Vanguard search',price:9.40,url:vgSearch('Civil Air Patrol tan T shirt')}]},
      flight_suit:{name:'Flight suit',category:'Base uniform',sourceRule:'MILSPEC_OK',price:199.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('flight suit')}]},
      corporate_polo:{name:'CAP corporate polo shirt',category:'Base uniform',sourceRule:'CAP_ONLY',price:34.99,priceStatus:'estimated',links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol polo shirt')}]}
    },
    recipes:{
      blues_a:{male:['blue_shirt_male','trousers_male','blue_belt','blue_tie_male','black_dress_shoes','black_socks'],female:['blue_blouse_female','slacks_female','blue_belt','blue_tie_tab_female','black_dress_shoes']},
      blues_b:{male:['blue_shirt_male','trousers_male','blue_belt','blue_tie_male','black_dress_shoes','black_socks'],female:['blue_blouse_female','slacks_female','blue_belt','blue_tie_tab_female','black_dress_shoes']},
      mess_dress:{male:['mess_coat_male','mess_shirt_male','mess_trousers_male','mess_cummerbund','mess_bow_tie','black_dress_shoes'],female:['mess_coat_female','mess_blouse_female','mess_skirt_female','mess_cummerbund','black_dress_shoes']},
      semi_formal:{male:['white_dress_shirt','trousers_male','blue_belt','blue_tie_male','black_dress_shoes'],female:['white_dress_shirt','slacks_female','blue_belt','blue_tie_tab_female','black_dress_shoes']},
      aviator:{male:['white_dress_shirt','gray_slacks','black_belt','black_dress_shoes'],female:['white_dress_shirt','gray_slacks','black_belt','black_dress_shoes']},
      aviator_blazer:{male:['white_dress_shirt','gray_slacks','black_belt','corporate_blazer','black_dress_shoes'],female:['white_dress_shirt','gray_slacks','black_belt','corporate_blazer','black_dress_shoes']},
      corporate_field:{male:['corporate_field_shirt','corporate_field_trousers','black_belt'],female:['corporate_field_shirt','corporate_field_trousers','black_belt']},
      abu:{male:['abu_coat','abu_trousers'],female:['abu_coat','abu_trousers']},
      ocp:{male:['ocp_coat','ocp_trousers','ocp_cap','tan_shirt'],female:['ocp_coat','ocp_trousers','ocp_cap','tan_shirt']},
      flight_suit:{male:['flight_suit'],female:['flight_suit']},
      polo:{male:['corporate_polo','gray_slacks','black_belt'],female:['corporate_polo','gray_slacks','black_belt']}
    },
    helpers:{vgSearch,iraSearch}
  };

  C.ribbonProducts={};
  C.miniMedalProducts={
    air_force_aerial_achievement_medal:verified(10.10,vg('/products/usaf-aerial-achievement-miniature-medal'),'Air Force Aerial Achievement miniature medal'),
    air_medal:verified(10.10,vg('/products/air-medal-miniature-medal'),'Air Medal miniature medal'),
    distinguished_service_award:verified(12.20,vg('/products/civil-air-patrol-distinguished-service-miniature-medal'),'CAP Distinguished Service miniature medal'),
    cap_membership_ribbon:verified(11.35,vgSearch('Civil Air Patrol Membership miniature medal'),'CAP Membership miniature medal'),
    spaatz_award:verified(11.35,vgSearch('Civil Air Patrol Spaatz miniature medal'),'CAP Spaatz miniature medal'),
    encampment_ribbon:verified(11.35,vgSearch('Civil Air Patrol Encampment miniature medal'),'CAP Encampment miniature medal')
  };

  C.deviceProducts={
    bronze_clasp:{
      1:verified(1.00,vg('/products/civil-air-patrol-award-triangle-ribbon-clasp-in-bronze'),'1 3/16-inch bronze triangle clasp'),
      2:verified(1.95,vg('/products/civil-air-patrol-award-two-triangle-cluster-in-bronze'),'2 3/16-inch bronze triangle cluster'),
      3:verified(2.25,vg('/products/civil-air-patrol-award-three-triangle-cluster-in-bronze'),'3 3/16-inch bronze triangle cluster'),
      4:estimated(2.35,vgSearch('Civil Air Patrol 4 Triangle Cluster bronze'),'4 3/16-inch bronze triangle cluster')
    },
    silver_clasp:{
      1:verified(1.00,vg('/products/civil-air-patrol-award-triangle-clasp-in-silver'),'1 3/16-inch silver triangle clasp'),
      2:estimated(1.95,vgSearch('Civil Air Patrol Two Triangle Cluster silver'),'2 3/16-inch silver triangle cluster'),
      3:estimated(2.25,vgSearch('Civil Air Patrol Three Triangle Cluster silver'),'3 3/16-inch silver triangle cluster'),
      4:estimated(2.35,vgSearch('Civil Air Patrol 4 Triangle Cluster silver'),'4 3/16-inch silver triangle cluster')
    },
    bronze_star_ribbon:verified(2.20,vgSearch('Ribbon Attachment 3/16 Bronze Star'),'3/16-inch bronze star pair','Package contains two stars.'),
    silver_star_ribbon:verified(2.20,vgSearch('Ribbon Attachment 3/16 Silver Star'),'3/16-inch silver star pair','Package contains two stars.'),
    gold_star_ribbon:verified(2.20,vgSearch('Ribbon Attachment 3/16 Gold Star'),'3/16-inch gold star pair','Package contains two stars.'),
    bronze_star_mini:verified(2.20,vgSearch('Ribbon Attachment 3/16 Bronze Star'),'3/16-inch bronze star pair','Same 3/16-inch device used for ribbons and miniature medals.'),
    silver_star_mini:verified(2.20,vgSearch('Ribbon Attachment 3/16 Silver Star'),'3/16-inch silver star pair','Same 3/16-inch device used for ribbons and miniature medals.'),
    gold_star_mini:verified(2.20,vgSearch('Ribbon Attachment 3/16 Gold Star'),'3/16-inch gold star pair','Same 3/16-inch device used for ribbons and miniature medals.'),
    bronze_propeller:verified(1.35,vg('/products/civil-air-patrol-award-propeller-clasp-in-bronze'),'3/16-inch bronze propeller clasp'),
    silver_v:estimated(4.80,vgSearch('Ribbon Attachment Silver V'),'Silver V attachment'),
    longevity:estimated(2.65,vgSearch('Civil Air Patrol longevity service device'),'CAP longevity service device')
  };

  C.cadetEnlistedRank={
    'C/Amn':estimated(8.75,vgSearch('Civil Air Patrol Cadet Airman chevron'),'Cadet Airman chevrons'),
    'C/A1C':estimated(9.95,vgSearch('Civil Air Patrol Cadet Airman First Class chevron'),'Cadet Airman First Class chevrons'),
    'C/SrA':estimated(9.95,vgSearch('Civil Air Patrol Cadet Senior Airman chevron'),'Cadet Senior Airman chevrons'),
    'C/SSgt':estimated(10.40,vgSearch('Civil Air Patrol Cadet Staff Sergeant chevron'),'Cadet Staff Sergeant chevrons'),
    'C/TSgt':estimated(10.70,vgSearch('Civil Air Patrol Cadet Technical Sergeant chevron'),'Cadet Technical Sergeant chevrons'),
    'C/MSgt':estimated(11.70,vgSearch('Civil Air Patrol Cadet Master Sergeant chevron'),'Cadet Master Sergeant chevrons'),
    'C/SMSgt':estimated(12.75,vgSearch('Civil Air Patrol Cadet Senior Master Sergeant chevron'),'Cadet Senior Master Sergeant chevrons'),
    'C/CMSgt':estimated(15.20,vgSearch('Civil Air Patrol Cadet Chief Master Sergeant chevron'),'Cadet Chief Master Sergeant chevrons')
  };
  C.cadetOfficerRank={};
  ['C/2d Lt','C/1st Lt','C/Capt','C/Maj','C/Lt Col','C/Col'].forEach(r=>C.cadetOfficerRank[r]=estimated(11.90,vgSearch(`Civil Air Patrol ${r} cadet grade insignia`),`${r} CAP cadet officer insignia`));
  C.seniorNcoRank={};
  ['SSgt','TSgt','MSgt','SMSgt','CMSgt'].forEach(r=>C.seniorNcoRank[r]=estimated(14.95,vgSearch(`Civil Air Patrol senior ${r} grade insignia`),`CAP senior ${r} insignia`));
  C.seniorEpaulet={}; C.seniorServiceCoatRank={}; C.seniorMessBoard={};
  ['2d Lt','1st Lt','Capt','Maj','Lt Col','Col','Brig Gen','Maj Gen'].forEach(r=>{
    C.seniorEpaulet[r]=estimated(12.80,vgSearch(`Civil Air Patrol ${r} gray epaulet shoulder mark`),`CAP ${r} gray epaulets`);
    C.seniorServiceCoatRank[r]=estimated(14.00,vgSearch(`Civil Air Patrol ${r} service coat grade insignia`),`CAP ${r} service-coat grade insignia`);
    C.seniorMessBoard[r]=estimated(51.05,vgSearch(`Civil Air Patrol ${r} mess dress shoulder board`),`CAP ${r} mess-dress shoulder boards`);
  });

  C.badgeProducts={};
  C.badgeFallback=id=>estimated(11.00,vgSearch(`Civil Air Patrol ${String(id||'').replace(/_/g,' ')} badge`),String(id||'').replace(/_/g,' '),'Budget estimate; exact badge product should be verified.');
  C.patchProducts={};
  C.patchFallback=id=>estimated(4.65,vgSearch(`Civil Air Patrol ${String(id||'').replace(/_/g,' ')} patch`),String(id||'').replace(/_/g,' '),'Budget estimate; exact patch product should be verified.');
  C.cordProducts={
    honor_guard:estimated(19.20,vgSearch('Civil Air Patrol Honor Guard shoulder cord'),'CAP Honor Guard shoulder cord'),
    color_guard:estimated(35.00,vgSearch('Civil Air Patrol Color Guard shoulder cord'),'CAP Color Guard shoulder cord'),
    group:estimated(35.00,vgSearch('Civil Air Patrol Group CAC shoulder cord'),'Group CAC shoulder cord'),
    wing:estimated(35.00,vgSearch('Civil Air Patrol Wing CAC shoulder cord'),'Wing CAC shoulder cord'),
    region:estimated(35.00,vgSearch('Civil Air Patrol Region CAC shoulder cord'),'Region CAC shoulder cord'),
    national:estimated(35.00,vgSearch('Civil Air Patrol National CAC shoulder cord'),'National CAC shoulder cord')
  };
  C.fieldInsignia={
    ocp_name:estimated(4.65,vgSearch('CAP OCP embroidered name tape'),'OCP embroidered last-name tape'),
    ocp_cap:estimated(4.15,vgSearch('Civil Air Patrol OCP tape'),'OCP CIVIL AIR PATROL tape'),
    abu_name:estimated(5.70,vgSearch('CAP ABU embroidered name tape'),'ABU embroidered last-name tape'),
    abu_cap:estimated(2.10,vgSearch('Civil Air Patrol ABU tape'),'ABU CIVIL AIR PATROL tape')
  };
})();