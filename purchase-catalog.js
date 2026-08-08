/* CAP Uniform Builder Purchase Catalog
   Prices are estimates / last-observed retail prices and are intentionally kept
   outside index.html so they can be updated without touching rendering logic.
   Last verified against vendor pages: 2026-08-07.
*/
(function(){
  const VANGUARD = 'https://www.vanguardmil.com';
  const U4U = 'https://www.uniforms-4u.com';
  const IRA = 'https://www.iragreen.com';

  const enc = q => encodeURIComponent(String(q || '').trim());
  const vgSearch = q => `${VANGUARD}/search?q=${enc(q)}`;
  const iraSearch = q => `${IRA}/catalogsearch/result/?q=${enc(q)}`;

  window.CAPUB_PURCHASE_CATALOG = {
    version: '2026.08.07.1',
    priceChecked: '2026-08-07',
    currency: 'USD',
    sourceRules: {
      CAP_ONLY: 'CAP-specific item — do not substitute a visually similar military item.',
      MILSPEC_OK: 'Standard military-spec component — an equivalent USAF/military-spec item may be used when CAPR 39-1 authorizes the same component.',
      GENERIC_SPEC: 'Generic item is acceptable only if it meets the required color, material, style, and wear specifications.',
      VERIFY: 'Verify the exact authorized version before purchasing.'
    },
    vendors: {
      vanguard: { name:'Vanguard', home:VANGUARD },
      uniforms4u: { name:'Uniforms-4U', home:U4U },
      iragreen: { name:'Ira Green', home:IRA }
    },

    // Known retail components. `priceStatus: verified` means the listed page
    // showed that price on the catalog's priceChecked date. `estimated` means
    // the value is useful for budgeting but should be rechecked before ordering.
    items: {
      blue_shirt_male: {
        name:"Men's USAF long-sleeve blue shirt", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:69.99, priceStatus:'verified',
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U', price:69.99, url:`${U4U}/p-us-air-force-long-sleeve-dress-shirt-6661.aspx`},
          {vendor:'iragreen', label:'Ira Green search', url:iraSearch('Air Force blue shirt male')}
        ],
        note:'A short-sleeve shirt may also be authorized; this entry budgets the long-sleeve shirt.'
      },
      blue_blouse_female: {
        name:"Women's USAF blue blouse", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:69.99, priceStatus:'verified',
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U female Class B builder', url:`${U4U}/p-us-air-force-female-enlisted-uniform-13553.aspx`},
          {vendor:'iragreen', label:'Ira Green search', url:iraSearch('Air Force female blue blouse')}
        ],
        note:'Budget estimate; verify sleeve style, cut, fabric, and current price.'
      },
      trousers_male: {
        name:'USAF service dress trousers', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:99.99, priceStatus:'verified',
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U', price:99.99, url:`${U4U}/p-us-air-force-class-a-dress-uniform-trousers-6662.aspx`},
          {vendor:'iragreen', label:'Ira Green search', url:iraSearch('Air Force service dress trousers')}
        ],
        note:'For Class A, match the authorized shade/fabric to the service coat.'
      },
      slacks_female: {
        name:"Women's USAF blue slacks", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:99.99, priceStatus:'estimated',
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U female service dress builder', url:`${U4U}/p-usaf-female-officer-dress-uniform-5254.aspx`},
          {vendor:'iragreen', label:'Ira Green search', url:iraSearch('Air Force female blue slacks')}
        ],
        note:'Budget estimate; verify cut, fabric, shade, and current price.'
      },
      blue_belt: {
        name:'USAF blue belt with silver tip/buckle', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:32.99, priceStatus:'verified',
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U', price:32.99, url:`${U4U}/p-air-force-uniform-blue-belt-3924.aspx`},
          {vendor:'iragreen', label:'Ira Green search', url:iraSearch('Air Force blue belt silver buckle')}
        ]
      },
      blue_tie_male: {
        name:'USAF blue herringbone tie', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:26.99, priceStatus:'verified', conditional:true,
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U', price:26.99, url:`${U4U}/p-air-force-uniform-blue-tie-four-in-hand-3925.aspx`},
          {vendor:'iragreen', label:'Ira Green search', url:iraSearch('Air Force blue herringbone tie')}
        ],
        note:'Required with Class A and with applicable long-sleeve Class B combinations.'
      },
      blue_tie_tab_female: {
        name:'USAF blue herringbone tie tab', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:23.99, priceStatus:'verified', conditional:true,
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U', price:23.99, url:`${U4U}/p-air-force-neck-tab-with-hook-closure-11829.aspx`},
          {vendor:'iragreen', label:'Ira Green search', url:iraSearch('Air Force blue tie tab herringbone')}
        ],
        note:'Required with Class A and with applicable long-sleeve Class B combinations.'
      },
      flight_cap_enlisted_male: {
        name:'USAF enlisted flight cap — male', category:'Headgear', sourceRule:'MILSPEC_OK',
        price:23.99, priceStatus:'verified',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U', price:23.99, url:`${U4U}/p-us-air-force-airmen-enlisted-garrison-cap-6855.aspx`}]
      },
      flight_cap_officer_male: {
        name:'USAF company/field-grade officer flight cap — male', category:'Headgear', sourceRule:'MILSPEC_OK',
        price:29.99, priceStatus:'verified',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U', price:29.99, url:`${U4U}/p-us-air-force-officer-s-garrison-cap-with-blue-silver-cordedge-5579.aspx`}]
      },
      flight_cap_enlisted_female: {
        name:'USAF enlisted flight cap — female', category:'Headgear', sourceRule:'MILSPEC_OK',
        price:23.99, priceStatus:'verified',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U', price:23.99, url:`${U4U}/p-usaf-female-enlisted-garrison-cap-12148.aspx`}]
      },
      flight_cap_officer_female: {
        name:'USAF officer flight cap — female', category:'Headgear', sourceRule:'MILSPEC_OK',
        price:27.59, priceStatus:'verified',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U', price:27.59, url:`${U4U}/p-usaf-female-officer-garrison-cap-12149.aspx`}]
      },
      service_coat_enlisted_male: {
        name:"Men's USAF enlisted-style service dress coat", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:249.99, priceStatus:'verified',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U', price:249.99, url:`${U4U}/p-usaf-enlisted-male-service-dress-coat-14147.aspx`}],
        note:'Used as the budgeting garment where the CAP configuration calls for the enlisted-style coat. CAP insignia/rank remain separate.'
      },
      service_coat_officer_male: {
        name:"Men's USAF officer service dress coat", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:259.99, priceStatus:'verified',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U', price:259.99, url:`${U4U}/p-usaf-officer-blue-uniform-coat-3633.aspx`}],
        note:'Coat price does not include CAP insignia, rank, ribbons, badges, or other accessories.'
      },
      service_coat_enlisted_female: {
        name:"Women's USAF enlisted-style service dress coat", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:249.99, priceStatus:'estimated',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U female service dress builder', url:`${U4U}/p-usaf-female-enlisted-dress-uniform-18634.aspx`}],
        note:'Budget estimate; verify exact coat price, fabric, and CAP-authorized configuration before ordering.'
      },
      service_coat_officer_female: {
        name:"Women's USAF officer service dress coat", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:259.99, priceStatus:'estimated',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U female officer service dress builder', url:`${U4U}/p-usaf-female-officer-dress-uniform-5254.aspx`}],
        note:'Budget estimate; verify exact coat price, fabric, and CAP-authorized configuration before ordering.'
      },
      black_dress_shoes: {
        name:'Black dress shoes meeting CAP/USAF specifications', category:'Footwear', sourceRule:'GENERIC_SPEC',
        price:100.00, priceStatus:'estimated',
        links:[
          {vendor:'uniforms4u', label:'Uniforms-4U footwear', url:`${U4U}/`},
          {vendor:'iragreen', label:'Ira Green', url:`${IRA}/`}
        ],
        note:'Budget allowance only. Any authorized shoe meeting the regulation may be used; price varies substantially.'
      },
      black_socks: {
        name:'Black dress socks', category:'Footwear', sourceRule:'GENERIC_SPEC',
        price:11.99, priceStatus:'verified',
        links:[{vendor:'uniforms4u', label:'Uniforms-4U service-dress builder', price:11.99, url:`${U4U}/p-us-air-force-officer-service-dress-uniform-9957.aspx`}]
      },

      cap_nameplate_cadet: {
        name:'CAP cadet blue name plate', category:'CAP insignia', sourceRule:'CAP_ONLY',
        price:5.10, priceStatus:'verified',
        links:[{vendor:'vanguard', label:'Vanguard', price:5.10, url:`${VANGUARD}/products/civil-air-patrol-cadet-name-plate`}],
        note:'CAP-specific name plate; do not substitute a USAF name tag.'
      },
      cap_nameplate_senior: {
        name:'CAP senior member gray name plate', category:'CAP insignia', sourceRule:'CAP_ONLY',
        price:5.10, priceStatus:'verified',
        links:[{vendor:'vanguard', label:'Vanguard', price:5.10, url:`${VANGUARD}/products/civil-air-patrol-senior-member-name-plate`}],
        note:'CAP-specific name plate; do not substitute a USAF name tag.'
      },
      cap_metal_nameplate_service_coat: {
        name:'CAP single-line brushed silver name plate', category:'CAP insignia', sourceRule:'CAP_ONLY',
        price:13.50, priceStatus:'verified',
        links:[{vendor:'vanguard', label:'Vanguard', price:13.50, url:`${VANGUARD}/products/civil-air-patrol-silver-brushed-single-line-cap-metal-name-plate`}],
        note:'Use only when required by the selected CAP service-coat configuration.'
      },
      cap_cadet_officer_boards_male: {
        name:'CAP cadet officer shoulder boards — male service coat', category:'CAP rank', sourceRule:'CAP_ONLY',
        price:41.30, priceStatus:'verified',
        links:[{vendor:'vanguard', label:'Vanguard', price:41.30, url:`${VANGUARD}/products/civil-air-patrol-cadet-officer-shoulder-board-for-service-coat`}]
      },
      cap_cadet_officer_boards_female: {
        name:'CAP cadet officer shoulder boards — female service coat', category:'CAP rank', sourceRule:'CAP_ONLY',
        price:41.30, priceStatus:'verified',
        links:[{vendor:'vanguard', label:'Vanguard', price:41.30, url:`${VANGUARD}/products/civil-air-patrol-shoulder-board-cadet-female-officer-wear-on-service-coat`}]
      },

      mess_coat_male: {
        name:"Men's USAF mess dress coat", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:229.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:229.99,url:`${U4U}/p-usaf-mess-dress-officer-uniform-11745.aspx`}]
      },
      mess_shirt_male: {
        name:"Men's military tuxedo/mess dress shirt", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:89.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:89.99,url:`${U4U}/p-usaf-mess-dress-officer-uniform-11745.aspx`}]
      },
      mess_trousers_male: {
        name:'USAF mess dress trousers', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:99.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:99.99,url:`${U4U}/p-us-air-force-mess-dress-uniform-high-rise-trousers-8294.aspx`}]
      },
      mess_coat_female: {
        name:"Women's USAF mess dress coat", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:229.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:229.99,url:`${U4U}/p-usaf-female-officer-mess-dress-4020.aspx`}]
      },
      mess_blouse_female: {
        name:"Women's mess dress blouse", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:89.99, priceStatus:'estimated', links:[{vendor:'uniforms4u',label:"Uniforms-4U women's mess dress",url:`${U4U}/p-usaf-female-officer-mess-dress-4020.aspx`}]
      },
      mess_skirt_female: {
        name:"Women's mess dress skirt", category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:99.99, priceStatus:'estimated', links:[{vendor:'uniforms4u',label:"Uniforms-4U women's mess dress",url:`${U4U}/p-usaf-female-officer-mess-dress-4020.aspx`}]
      },
      mess_cummerbund: {
        name:'USAF blue satin cummerbund', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:52.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:52.99,url:`${U4U}/p-us-air-force-blue-cummerbund-11697.aspx`},{vendor:'iragreen',label:'Ira Green accessories',url:`${IRA}/uniform-accessories.html`}]
      },
      mess_bowtie_male: {
        name:'USAF blue satin bow tie', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:15.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U',price:15.99,url:`${U4U}/p-air-force-blue-bow-tie-6667.aspx`}]
      },
      mess_tietab_female: {
        name:'USAF blue satin tie tab', category:'Base uniform', sourceRule:'MILSPEC_OK',
        price:26.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U women\'s mess dress',price:26.99,url:`${U4U}/p-usaf-female-officer-mess-dress-4020.aspx`}]
      },
      mess_cufflinks: {
        name:'Matching mess-dress cuff links', category:'Accessories', sourceRule:'MILSPEC_OK',
        price:26.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U mess dress builder',price:26.99,url:`${U4U}/p-usaf-mess-dress-officer-uniform-11745.aspx`}]
      },
      mess_studs: {
        name:'Matching mess-dress shirt studs', category:'Accessories', sourceRule:'MILSPEC_OK',
        price:28.99, priceStatus:'verified', links:[{vendor:'uniforms4u',label:'Uniforms-4U mess dress builder',price:28.99,url:`${U4U}/p-usaf-mess-dress-officer-uniform-11745.aspx`}]
      },

      white_aviator_shirt: {
        name:'White aviator shirt meeting CAP corporate-uniform specifications', category:'Base uniform', sourceRule:'GENERIC_SPEC',
        price:45.00, priceStatus:'estimated', links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol aviator shirt')},{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      },
      gray_slacks: {
        name:'Medium-gray dress slacks meeting CAP specifications', category:'Base uniform', sourceRule:'GENERIC_SPEC',
        price:55.00, priceStatus:'estimated', links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol gray slacks')},{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      },
      navy_blazer: {
        name:'CAP-authorized dark blue blazer', category:'Base uniform', sourceRule:'GENERIC_SPEC',
        price:120.00, priceStatus:'estimated', links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol blazer')},{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`}]
      },
      corporate_polo: {
        name:'CAP corporate polo shirt', category:'Base uniform', sourceRule:'CAP_ONLY',
        price:null, priceStatus:'check', links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('Civil Air Patrol polo shirt')}]
      },
      abu_blouse: {
        name:'ABU blouse', category:'Base uniform', sourceRule:'MILSPEC_OK', price:45.00, priceStatus:'estimated',
        links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      },
      abu_trousers: {
        name:'ABU trousers', category:'Base uniform', sourceRule:'MILSPEC_OK', price:45.00, priceStatus:'estimated',
        links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      },
      ocp_blouse: {
        name:'OCP coat/blouse meeting CAP specifications', category:'Base uniform', sourceRule:'MILSPEC_OK', price:69.00, priceStatus:'verified',
        links:[{vendor:'vanguard',label:'Vanguard CAP OCP search',price:69.00,url:vgSearch('Civil Air Patrol OCP Uniform Adult Shirt coat')},{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      },
      ocp_trousers: {
        name:'OCP trousers meeting CAP specifications', category:'Base uniform', sourceRule:'MILSPEC_OK', price:69.00, priceStatus:'verified',
        links:[{vendor:'vanguard',label:'Vanguard CAP OCP search',price:69.00,url:vgSearch('Civil Air Patrol OCP Uniform Adult Pants')},{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      },
      ocp_cap: {
        name:'OCP patrol cap / CAP-authorized flat-top cap', category:'Headgear', sourceRule:'MILSPEC_OK', price:14.45, priceStatus:'verified',
        links:[{vendor:'vanguard',label:'Vanguard CAP OCP search',price:14.45,url:vgSearch('Civil Air Patrol OCP Cap Flat Top')}]
      },
      ocp_tshirt: {
        name:'Tan OCP undershirt', category:'Base uniform', sourceRule:'GENERIC_SPEC', price:9.40, priceStatus:'verified',
        links:[{vendor:'vanguard',label:'Vanguard CAP tan shirt',price:9.40,url:vgSearch('Civil Air Patrol Uniform T-Shirt Tan')},{vendor:'iragreen',label:'Ira Green search',url:iraSearch('Tan 499 undershirt')}]
      },
      ocp_socks: {
        name:'Tan OCP boot socks', category:'Footwear', sourceRule:'GENERIC_SPEC', price:21.35, priceStatus:'verified',
        links:[{vendor:'vanguard',label:'Vanguard tan OCP socks',price:21.35,url:vgSearch('Boot Socks Thorlo tan 499 OCP over the calf')}]
      },
      combat_boots: {
        name:'Authorized combat boots', category:'Footwear', sourceRule:'GENERIC_SPEC', price:110.00, priceStatus:'estimated',
        links:[{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      },
      flight_suit: {
        name:'Authorized flight suit', category:'Base uniform', sourceRule:'VERIFY', price:180.00, priceStatus:'estimated',
        links:[{vendor:'vanguard',label:'Vanguard search',url:vgSearch('flight suit')},{vendor:'uniforms4u',label:'Uniforms-4U',url:`${U4U}/`},{vendor:'iragreen',label:'Ira Green',url:`${IRA}/`}]
      }
    },

    // Unit prices for dynamic selected items.
    dynamic: {
      capRibbon: {
        price:1.60, priceStatus:'verified', sourceRule:'CAP_ONLY',
        collectionUrl:`${VANGUARD}/collections/civil-air-patrol-ribbons`
      },
      capMiniMedal: {
        price:11.35, priceStatus:'verified', sourceRule:'CAP_ONLY',
        collectionUrl:`${VANGUARD}/collections/civil-air-patrol-miniature-medals`,
        note:'Most current CAP miniature medals were $11.35; some, such as Distinguished Service, were higher. Treat this as a budgeting unit price.'
      },
      capBadge: { price:null, priceStatus:'check', sourceRule:'CAP_ONLY', collectionUrl:`${VANGUARD}/collections/civil-air-patrol-insignia/metal` },
      capPatch: { price:null, priceStatus:'check', sourceRule:'CAP_ONLY', collectionUrl:`${VANGUARD}/collections/civil-air-patrol-insignia` },
      capCord: { price:null, priceStatus:'check', sourceRule:'CAP_ONLY', collectionUrl:vgSearch('Civil Air Patrol shoulder cord') }
    },

    cadetOfficerRank: {
      'C/2d Lt': {price:10.60, url:`${VANGUARD}/products/officer-rank-insignia-second-lieutenant-regulation-copy`},
      'C/1st Lt':{price:11.70, url:`${VANGUARD}/products/first-lieutenant-regulation-officer-rank-insignia`},
      'C/Capt':  {price:11.00, url:`${VANGUARD}/products/civil-air-patrol-cadet-captain-shoulder-board`},
      'C/Maj':   {price:9.90,  url:`${VANGUARD}/products/civil-air-patrol-cadet-major-rank`},
      'C/Lt Col':{price:11.90, url:`${VANGUARD}/products/lieutenant-colonel-regulation-officer-rank-insignia`},
      'C/Col':   {price:11.90, url:`${VANGUARD}/products/civil-air-patrol-cadet-colonel-shoulder-board`}
    },

    recipes: {
      blues_b: {
        male:['blue_shirt_male','trousers_male','blue_belt','blue_tie_male','black_dress_shoes','black_socks'],
        female:['blue_blouse_female','slacks_female','blue_belt','blue_tie_tab_female','black_dress_shoes']
      },
      blues_a: {
        male:['blue_shirt_male','trousers_male','blue_belt','blue_tie_male','black_dress_shoes','black_socks'],
        female:['blue_blouse_female','slacks_female','blue_belt','blue_tie_tab_female','black_dress_shoes']
      },
      mess_dress: {
        male:['mess_coat_male','mess_shirt_male','mess_trousers_male','mess_cummerbund','mess_bowtie_male','mess_cufflinks','mess_studs','black_dress_shoes','black_socks'],
        female:['mess_coat_female','mess_blouse_female','mess_skirt_female','mess_cummerbund','mess_tietab_female','mess_cufflinks','mess_studs','black_dress_shoes']
      },
      semi_formal: {
        male:['blue_shirt_male','trousers_male','blue_belt','blue_tie_male','black_dress_shoes','black_socks'],
        female:['blue_blouse_female','slacks_female','blue_belt','blue_tie_tab_female','black_dress_shoes']
      },
      aviator: {
        male:['white_aviator_shirt','gray_slacks','black_dress_shoes'],
        female:['white_aviator_shirt','gray_slacks','black_dress_shoes']
      },
      aviator_blazer: {
        male:['white_aviator_shirt','gray_slacks','navy_blazer','black_dress_shoes'],
        female:['white_aviator_shirt','gray_slacks','navy_blazer','black_dress_shoes']
      },
      corporate_field: {
        male:['white_aviator_shirt','gray_slacks','combat_boots'],
        female:['white_aviator_shirt','gray_slacks','combat_boots']
      },
      abu: {
        male:['abu_blouse','abu_trousers','combat_boots'], female:['abu_blouse','abu_trousers','combat_boots']
      },
      ocp: {
        male:['ocp_blouse','ocp_trousers','ocp_cap','ocp_tshirt','ocp_socks','combat_boots'],
        female:['ocp_blouse','ocp_trousers','ocp_cap','ocp_tshirt','ocp_socks','combat_boots']
      },
      flight_suit: {
        male:['flight_suit','combat_boots'], female:['flight_suit','combat_boots']
      },
      polo: {
        male:['corporate_polo','gray_slacks','black_dress_shoes'], female:['corporate_polo','gray_slacks','black_dress_shoes']
      }
    },

    helpers: { vgSearch, iraSearch }
  };
})();
