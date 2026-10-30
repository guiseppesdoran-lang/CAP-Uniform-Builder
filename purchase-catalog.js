/* CAP Uniform Builder purchase catalog.
   Every item is one piece a uniform can wear, with an offer per vendor that carries it:
     { vendor, price, status, checked, url, sku }
   An item with notSold: true has no offers: it is not sold at retail (issued or obtained through CAP), so its line has no
   price, no vendor links and no part in the totals.
   price   the last price seen on the vendor's page (status 'verified') or a budgeting estimate (status 'estimated');
           null when nothing is known, and the list then shows "no price".
   checked the date the price was seen or the estimate was made.
   url     a product page, or (no url) a search on the vendor's site for the item's own search words.
   Prices are not fetched live: the page's Content-Security-Policy (connect-src 'self') keeps it from calling vendor sites.
   Verify every price on the vendor's page before checkout.
   purchase-feature-core.js reads this file; the list it builds is derived from the drawn uniform, not from this file.
*/
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.CAPUB_PURCHASE_CATALOG = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(){
  'use strict';
  const VANGUARD = 'https://www.vanguardmil.com';
  const U4U = 'https://www.uniforms-4u.com';
  const IRA = 'https://www.iragreen.com';
  // The CAP Ranger tabs are not on Vanguard (Ethan: "the ranger tabs arent on vanguard ... they are on capranger.org with a custom
  // order form"): Hawk Mountain Ranger School's order form, linked from capranger.org's CAP Ranger grades page.
  const CAPRANGER = 'https://www.capranger.org';
  const RANGER_GRADES_PAGE = 'https://www.capranger.org/cap-ranger-grades';
  const RANGER_ORDER_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSeVDbEhuYSTmkqFqGozQNdMkUjMHjWs3xToeDFYOoFJEz4RCQ/viewform';
  const enc = q => encodeURIComponent(String(q || '').trim());
  const SEARCH = {
    vanguard: q => `${VANGUARD}/search?q=${enc(q)}`,
    uniforms4u: q => `${U4U}/search.aspx?searchterm=${enc(q)}`,
    iragreen: q => `${IRA}/catalogsearch/result/?q=${enc(q)}`
  };
  const vg = p => VANGUARD + p;
  const u4 = p => U4U + p;

  // Dates: the August catalog's observed prices and budgeting estimates, and the estimates added for the full list.
  const AUG = '2026-08-08', OCT = '2026-10-28';
  // An offer. `url` omitted: the vendor's search for the item's search words.
  const offer = (vendor, price, status, checked, url, sku) => ({ vendor, price: price == null ? null : Number(price), status: price == null ? null : (status || 'estimated'), checked: checked || null, url: url || null, sku: sku || null });
  const V = (price, status, checked, url, sku) => offer('vanguard', price, status, checked, url, sku);
  // A Uniforms-4U product page ends in its item number (p-...-6661.aspx), which is the SKU the member can search for.
  const U = (price, status, checked, url, sku) => offer('uniforms4u', price, status, checked, url, sku || (/-(\d+)\.aspx$/.exec(url || '') || [])[1]);
  const I = (price, status, checked, url, sku) => offer('iragreen', price, status, checked, url, sku);
  // The three vendors' searches with no price: the line still links everywhere the member can look.
  const searchOnly = () => [V(null), U(null), I(null)];

  // { name, group, rule, q (search words), offers, note, ref }
  const item = (name, group, rule, offers, extra) => Object.assign({ name, group, rule, q: name, offers }, extra || {});

  const items = {
    // ---- shirts, blouses, coats -------------------------------------------------------------------------------
    shirt_blue_long_male: item("Men's USAF long-sleeve blue shirt", 'Garments', 'MILSPEC_OK', [U(69.99, 'verified', AUG, u4('/p-us-air-force-long-sleeve-dress-shirt-6661.aspx')), I(null), V(null)], { q: 'Air Force long sleeve blue shirt men', ref: '4.1.11.1.1' }),
    shirt_blue_short_male: item("Men's USAF short-sleeve blue shirt", 'Garments', 'MILSPEC_OK', [U(59.99, 'estimated', OCT), I(null), V(null)], { q: 'Air Force short sleeve blue shirt men', ref: '4.1.11.1.1' }),
    blouse_blue_long_female: item("Women's USAF long-sleeve blue blouse", 'Garments', 'MILSPEC_OK', [U(69.99, 'estimated', AUG, u4('/p-us-air-force-female-enlisted-uniform-13553.aspx')), I(null), V(null)], { q: 'Air Force female long sleeve blue blouse', ref: '4.1.12.2' }),
    blouse_blue_short_female: item("Women's USAF short-sleeve blue blouse", 'Garments', 'MILSPEC_OK', [U(59.99, 'estimated', OCT), I(null), V(null)], { q: 'Air Force female short sleeve blue blouse', ref: '4.1.12.2' }),
    service_coat_enlisted_male: item("Men's USAF enlisted-style service dress coat", 'Garments', 'MILSPEC_OK', [U(249.99, 'verified', AUG, u4('/p-usaf-enlisted-male-service-dress-coat-14147.aspx')), V(null), I(null)], { ref: '4.1.5.2' }),
    service_coat_officer_male: item("Men's USAF officer service dress coat", 'Garments', 'MILSPEC_OK', [U(259.99, 'verified', AUG, u4('/p-usaf-officer-blue-uniform-coat-3633.aspx')), V(null), I(null)], { ref: '4.1.5.2' }),
    service_coat_enlisted_female: item("Women's USAF enlisted-style service dress coat", 'Garments', 'MILSPEC_OK', [U(249.99, 'estimated', AUG, u4('/p-usaf-female-enlisted-dress-uniform-18634.aspx')), V(null), I(null)], { ref: '4.1.9.2' }),
    service_coat_officer_female: item("Women's USAF officer service dress coat", 'Garments', 'MILSPEC_OK', [U(259.99, 'estimated', AUG, u4('/p-usaf-female-officer-dress-uniform-5254.aspx')), V(null), I(null)], { ref: '4.1.9.2' }),
    white_shirt_semiformal_male: item("Men's white long-sleeve dress shirt (cadet semi-formal)", 'Garments', 'GENERIC_SPEC', [U(39.99, 'estimated', AUG), V(null), I(null)], { q: 'white long sleeve dress shirt', ref: '4.1.3.2.3' }),
    white_blouse_semiformal_female: item("Women's white princess-line blouse (cadet semi-formal)", 'Garments', 'GENERIC_SPEC', [U(39.99, 'estimated', OCT), V(null), I(null)], { q: 'white dress blouse women', ref: '4.1.4.3' }),
    mess_coat_male: item("Men's USAF mess dress coat", 'Garments', 'MILSPEC_OK', [U(229.99, 'verified', AUG, u4('/p-usaf-mess-dress-officer-uniform-11745.aspx')), V(null), I(null)], { ref: '4.1.1.1' }),
    mess_shirt_male: item("Men's white mess dress shirt (French cuffs)", 'Garments', 'MILSPEC_OK', [U(89.99, 'verified', AUG, u4('/p-usaf-mess-dress-officer-uniform-11745.aspx')), V(null), I(null)], { q: 'mess dress shirt white french cuff', ref: '4.1.1.2' }),
    mess_trousers_male: item('USAF mess dress trousers (high rise, 7/8 in blue stripe)', 'Garments', 'MILSPEC_OK', [U(99.99, 'verified', AUG, u4('/p-us-air-force-mess-dress-uniform-high-rise-trousers-8294.aspx')), V(null), I(null)], { q: 'Air Force mess dress trousers', ref: '4.1.1.3' }),
    mess_coat_female: item("Women's USAF mess dress coat", 'Garments', 'MILSPEC_OK', [U(229.99, 'verified', AUG, u4('/p-usaf-female-officer-mess-dress-4020.aspx')), V(null), I(null)], { ref: '4.1.2.1' }),
    mess_blouse_female: item("Women's white mess dress blouse", 'Garments', 'MILSPEC_OK', [U(89.99, 'estimated', AUG, u4('/p-usaf-female-officer-mess-dress-4020.aspx')), V(null), I(null)], { q: 'mess dress blouse women', ref: '4.1.2.2' }),
    mess_skirt_a_line: item("Women's mess dress skirt, A-line", 'Garments', 'MILSPEC_OK', [U(99.99, 'estimated', AUG, u4('/p-usaf-female-officer-mess-dress-4020.aspx')), V(null), I(null)], { q: 'mess dress skirt', ref: '4.1.2.3' }),
    mess_skirt_straight_split: item("Women's mess dress skirt, straight with side split", 'Garments', 'MILSPEC_OK', [U(99.99, 'estimated', OCT), V(null), I(null)], { q: 'mess dress skirt straight split', ref: '4.1.2.3', note: 'Special order (CAPR 39-1, 4.1.2.3).' }),
    mess_cummerbund: item('Blue satin cummerbund', 'Accessories', 'MILSPEC_OK', [U(52.99, 'verified', AUG), V(null), I(null)], { q: 'Air Force blue satin cummerbund', ref: '4.1.1.3.2' }),
    mess_bow_tie: item('Blue satin bow tie', 'Accessories', 'MILSPEC_OK', [U(24.99, 'estimated', AUG), V(null), I(null)], { q: 'Air Force blue satin bow tie' }),
    mess_suspenders: item('Suspenders (white, dark blue or black)', 'Accessories', 'GENERIC_SPEC', [U(19.99, 'estimated', OCT), V(null), I(null)], { q: 'suspenders mess dress', ref: '4.1.1.3.1' }),
    mess_cuff_links: item('Cuff links (CAP crest, wing and star, or plain silver)', 'Accessories', 'CAP_ONLY', [V(24.95, 'estimated', OCT), U(null), I(null)], { q: 'Civil Air Patrol cuff links', ref: '4.1.1.2.1' }),
    mess_studs: item('Shirt studs (pearl or plain silver)', 'Accessories', 'GENERIC_SPEC', [U(19.99, 'estimated', OCT), V(null), I(null)], { q: 'formal shirt studs silver', ref: '4.1.1.2.2' }),
    mess_buttons_wing_star: item('Mess dress buttons, wing and star (coat set and chain closure)', 'Accessories', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'Air Force mess dress button set wing and star', ref: '4.1.1.1, 4.1.1.1.1.1' }),
    mess_buttons_cap_crest: item('Mess dress buttons, CAP coat of arms (coat set and chain closure)', 'Accessories', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol coat of arms buttons', ref: '4.1.1.1, 4.1.1.1.1.1' }),
    corporate_blazer_male: item("Men's navy blue blazer (Corporate Service Dress)", 'Garments', 'GENERIC_SPEC', [V(149.99, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol corporate blazer', ref: '4.2.3.1' }),
    corporate_blazer_female: item("Women's navy blue blazer (Corporate Service Dress)", 'Garments', 'GENERIC_SPEC', [V(149.99, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol corporate blazer women', ref: '4.2.4.1' }),
    aviator_shirt_short_male: item("Men's white aviator shirt, short sleeve", 'Garments', 'GENERIC_SPEC', [U(39.99, 'estimated', AUG), V(null), I(null)], { q: 'white aviator shirt short sleeve epaulets', ref: '4.2.5.1' }),
    aviator_shirt_long_male: item("Men's white aviator shirt, long sleeve", 'Garments', 'GENERIC_SPEC', [U(44.99, 'estimated', OCT), V(null), I(null)], { q: 'white aviator shirt long sleeve epaulets', ref: '4.2.5.1' }),
    aviator_shirt_short_female: item("Women's white aviator shirt, short sleeve", 'Garments', 'GENERIC_SPEC', [U(39.99, 'estimated', OCT), V(null), I(null)], { q: 'women white aviator shirt short sleeve', ref: '4.2.6.1' }),
    aviator_shirt_long_female: item("Women's white aviator shirt, long sleeve", 'Garments', 'GENERIC_SPEC', [U(44.99, 'estimated', OCT), V(null), I(null)], { q: 'women white aviator shirt long sleeve', ref: '4.2.6.1' }),
    overblouse_female: item("Women's white overblouse", 'Garments', 'GENERIC_SPEC', [U(null), V(null), I(null)], { q: 'women white overblouse', ref: '4.2.6.1' }),
    white_dress_shirt: item('White dress shirt, turndown collar', 'Garments', 'GENERIC_SPEC', [U(39.99, 'estimated', AUG), V(null), I(null)], { q: 'white dress shirt', ref: '4.2.1.2' }),
    turtleneck_white: item('White turtleneck', 'Garments', 'GENERIC_SPEC', [U(null), V(null), I(null)], { q: 'white turtleneck', ref: '4.2.3.2' }),
    shell_white_female: item('White shell', 'Garments', 'GENERIC_SPEC', [U(null), V(null), I(null)], { q: 'women white shell blouse', ref: '4.2.4.2' }),
    polo_knit_embroidered: item('Dark blue knit polo, CAP seal embroidered', 'Garments', 'CAP_ONLY', [V(34.99, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol polo shirt embroidered seal', ref: '5.3.1.1' }),
    polo_knit_print: item('Dark blue knit polo, CAP seal screen-printed', 'Garments', 'CAP_ONLY', [V(29.99, 'estimated', OCT), U(null), I(null)], { q: 'Civil Air Patrol polo shirt printed seal', ref: '5.3.1.2' }),
    polo_tactical: item('Dark blue tactical polo, CAP seal embroidered', 'Garments', 'CAP_ONLY', [V(39.99, 'estimated', OCT), U(null), I(null)], { q: 'Civil Air Patrol tactical polo', ref: '5.3.1.3' }),
    ocp_coat: item('OCP coat', 'Garments', 'MILSPEC_OK', [V(69, 'verified', AUG), U(null), I(null)], { ref: '7.1.1.1' }),
    abu_coat: item('ABU coat', 'Garments', 'MILSPEC_OK', [V(49.99, 'estimated', AUG), U(null), I(null)], { ref: '5.1.1.1' }),
    cfu_shirt: item('Corporate Field Uniform shirt, dark blue', 'Garments', 'CAP_ONLY', [V(49.99, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol corporate field uniform shirt', ref: '5.2.1.1' }),
    fdu_flight_suit: item('Flight Duty Uniform (sage green flight suit)', 'Garments', 'MILSPEC_OK', [V(199.99, 'estimated', AUG), U(null), I(null)], { q: 'flight suit CWU-27/P sage green', ref: '8.2' }),
    cfdu_flight_suit: item('Corporate Flight Duty Uniform (blue flight suit)', 'Garments', 'CAP_ONLY', [V(199.99, 'estimated', OCT), U(null), I(null)], { q: 'Civil Air Patrol blue flight suit', ref: '8.3.2' }),
    flight_jacket_green: item('Green flight jacket (MA-1, CWU-36/P or CWU-45/P)', 'Garments', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'CWU-36/P flight jacket sage green', ref: '8.2.7' }),
    flight_jacket_blue: item('Blue flight jacket', 'Garments', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol blue flight jacket', ref: '8.3.7' }),
    command_scarf: item('CAP command flight scarf (yellow and red)', 'Accessories', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol flight scarf', ref: '8.2.6' }),

    // ---- trousers, slacks, skirts --------------------------------------------------------------------------
    trousers_blue_male: item('USAF blue service trousers', 'Garments', 'MILSPEC_OK', [U(99.99, 'verified', AUG, u4('/p-us-air-force-class-a-dress-uniform-trousers-6662.aspx')), V(null), I(null)], { q: 'Air Force blue service trousers', ref: '4.1.6.4' }),
    slacks_blue_female: item("Women's USAF blue slacks", 'Garments', 'MILSPEC_OK', [U(99.99, 'estimated', AUG, u4('/p-usaf-female-officer-dress-uniform-5254.aspx')), V(null), I(null)], { q: 'Air Force women blue slacks', ref: '4.1.12.5' }),
    gray_trousers: item('Medium gray trousers', 'Garments', 'GENERIC_SPEC', [V(54.99, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol gray slacks', ref: '4.2.5.1.5' }),
    gray_slacks_female: item("Women's medium gray slacks", 'Garments', 'GENERIC_SPEC', [V(54.99, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol gray slacks women', ref: '4.2.6.4' }),
    ocp_trousers: item('OCP trousers', 'Garments', 'MILSPEC_OK', [V(69, 'verified', AUG), U(null), I(null)], { ref: '7.1.1.6' }),
    abu_trousers: item('ABU trousers', 'Garments', 'MILSPEC_OK', [V(49.99, 'estimated', AUG), U(null), I(null)], { ref: '5.1.1.3' }),
    cfu_trousers: item('Corporate Field Uniform trousers, dark blue', 'Garments', 'CAP_ONLY', [V(49.99, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol corporate field uniform trousers', ref: '5.2.1.2' }),

    // ---- under the shirt ------------------------------------------------------------------------------------
    undershirt_white: item('White V-neck or athletic undershirt', 'Garments', 'GENERIC_SPEC', [U(12.99, 'estimated', OCT), V(null), I(null)], { q: 'white V-neck undershirt' }),
    tshirt_coyote: item('Coyote brown (Tan 499) T-shirt', 'Garments', 'MILSPEC_OK', [V(9.40, 'verified', AUG), U(null), I(null)], { q: 'coyote brown t-shirt tan 499', ref: '7.1.1.5' }),
    tshirt_desert_tan: item('Desert tan T-shirt', 'Garments', 'MILSPEC_OK', [V(9.40, 'estimated', OCT), U(null), I(null)], { q: 'desert tan t-shirt', ref: '5.1.1.2' }),
    tshirt_black_or_tan: item('Black or tan crew-neck T-shirt', 'Garments', 'GENERIC_SPEC', [V(9.40, 'estimated', OCT), U(null), I(null)], { q: 'black crew neck t-shirt', ref: '5.2.1.3' }),

    // ---- belts ----------------------------------------------------------------------------------------------
    blue_belt: item('USAF blue web belt with silver tip and buckle', 'Accessories', 'MILSPEC_OK', [U(32.99, 'verified', AUG, u4('/p-air-force-uniform-blue-belt-3924.aspx')), V(null), I(null)], { q: 'Air Force blue belt buckle', ref: '4.1.6.5' }),
    black_belt: item('Plain black belt, gold or silver buckle (2 in or less)', 'Accessories', 'GENERIC_SPEC', [V(24.99, 'estimated', AUG), U(null), I(null)], { q: 'black leather belt silver buckle', ref: '4.2.5.1.6' }),
    tan_rigger_belt: item('Tan 499 rigger belt', 'Accessories', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'tan 499 rigger belt', ref: '7.1.1.7' }),
    desert_tan_belt: item('Desert tan web belt', 'Accessories', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'desert tan web belt', ref: '5.1.1.4' }),
    blue_black_web_belt: item('Dark blue or black web belt', 'Accessories', 'GENERIC_SPEC', [V(null), U(null), I(null)], { q: 'black web belt', ref: '5.2.1.2.1' }),

    // ---- neckwear ---------------------------------------------------------------------------------------------
    blue_tie: item('USAF blue tie (herringbone twill)', 'Accessories', 'MILSPEC_OK', [U(26.99, 'verified', AUG, u4('/p-air-force-uniform-blue-tie-four-in-hand-3925.aspx')), V(null), I(null)], { q: 'Air Force blue tie', ref: '4.1.6.3' }),
    cap_regimental_tie: item('CAP regimental tie', 'Accessories', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol regimental tie', ref: '4.2.3.4' }),
    blue_tie_tab: item('USAF blue inverted-V tie tab', 'Accessories', 'MILSPEC_OK', [U(23.99, 'verified', AUG, u4('/p-air-force-neck-tab-with-hook-closure-11829.aspx')), V(null), I(null)], { q: 'Air Force tie tab', ref: '4.1.12.4' }),
    blue_satin_tie_tab: item('Blue satin inverted-V tie tab', 'Accessories', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'Air Force satin tie tab mess dress', ref: '4.1.2.2.1' }),
    black_bow_tie: item('Black satin bow tie', 'Accessories', 'GENERIC_SPEC', [U(null), V(null), I(null)], { q: 'black satin bow tie', ref: '4.2.1.3' }),

    // ---- footwear -----------------------------------------------------------------------------------------------
    low_quarters: item('Black low quarter shoes', 'Footwear', 'GENERIC_SPEC', [U(100, 'estimated', AUG), V(null), I(null)], { q: 'black low quarter shoes' }),
    black_plain_shoes: item('Plain black shoes or boots', 'Footwear', 'GENERIC_SPEC', [U(100, 'estimated', AUG), V(null), I(null)], { q: 'black oxford dress shoes' }),
    pumps_black: item('Black pumps', 'Footwear', 'GENERIC_SPEC', [U(null), V(null), I(null)], { q: 'black pumps uniform' }),
    combat_boots_black: item('Black combat boots', 'Footwear', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'black combat boots' }),
    boots_coyote: item('Coyote brown boots (6 to 12 in)', 'Footwear', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'coyote brown boots', ref: '7.1.1.9' }),
    socks_black: item('Plain black socks', 'Footwear', 'GENERIC_SPEC', [U(11.99, 'estimated', AUG), V(null), I(null)], { q: 'black dress socks', ref: '6.4.1.1' }),
    socks_or_hosiery: item('Hosiery or plain black socks', 'Footwear', 'GENERIC_SPEC', [U(11.99, 'estimated', AUG), V(null), I(null)], { q: 'black socks', ref: '6.4.2' }),
    hosiery: item('Hosiery', 'Footwear', 'GENERIC_SPEC', [U(null), V(null), I(null)], { q: 'hosiery', ref: '6.4.2.1' }),
    socks_coyote: item('Coyote brown or sage green socks', 'Footwear', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'coyote brown socks', ref: '7.1.1.9' }),
    socks_fdu: item('Socks for the FDU (white, black, desert tan or sage green)', 'Footwear', 'GENERIC_SPEC', [V(null), U(null), I(null)], { q: 'sage green boot socks', ref: '8.2.10' }),

    // ---- headgear ---------------------------------------------------------------------------------------------
    flight_cap_enlisted_male: item('USAF enlisted flight cap, men', 'Headgear', 'MILSPEC_OK', [U(23.99, 'verified', AUG, u4('/p-us-air-force-airmen-enlisted-garrison-cap-6855.aspx')), V(null), I(null)], { q: 'Air Force enlisted flight cap' }),
    flight_cap_officer_male: item('USAF officer flight cap, men (silver and blue cord edge)', 'Headgear', 'MILSPEC_OK', [U(29.99, 'verified', AUG, u4('/p-us-air-force-officer-s-garrison-cap-with-blue-silver-cordedge-5579.aspx')), V(null), I(null)], { q: 'Air Force officer flight cap' }),
    flight_cap_enlisted_female: item('USAF enlisted flight cap, women', 'Headgear', 'MILSPEC_OK', [U(23.99, 'estimated', AUG, u4('/p-usaf-female-enlisted-garrison-cap-12148.aspx')), V(null), I(null)], { q: 'Air Force female enlisted flight cap' }),
    flight_cap_officer_female: item('USAF officer flight cap, women', 'Headgear', 'MILSPEC_OK', [U(27.59, 'verified', AUG, u4('/p-usaf-female-officer-garrison-cap-12149.aspx')), V(null), I(null)], { q: 'Air Force female officer flight cap' }),
    flight_cap_general: item('USAF general officer flight cap (silver cord edge)', 'Headgear', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'Air Force general officer flight cap' }),
    service_cap_male: item('USAF service cap, men', 'Headgear', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'Air Force service cap men' }),
    service_cap_female: item('USAF service cap, women', 'Headgear', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'Air Force service cap women' }),
    ocp_patrol_cap: item('OCP patrol cap', 'Headgear', 'MILSPEC_OK', [V(14.45, 'verified', AUG), U(null), I(null)], { ref: '7.1.1.8' }),
    ocp_tactical_cap: item('OCP tactical (ball) cap', 'Headgear', 'MILSPEC_OK', [V(null), U(null), I(null)], { ref: '7.1.1.8' }),
    abu_patrol_cap: item('ABU patrol cap', 'Headgear', 'MILSPEC_OK', [V(null), U(null), I(null)], { ref: '5.1.1.6' }),
    navy_tactical_cap: item('Navy blue tactical cap', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol navy blue tactical cap', ref: '5.1.1.6' }),
    blue_field_cap: item('Blue field (patrol) cap', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol blue field cap' }),
    boonie_hat_blue: item('Blue boonie hat', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol blue boonie hat' }),
    baseball_cap_blue: item('CAP baseball cap', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol baseball cap', ref: '8.2.8.3' }),
    cap_device_nco_flight: item('CAP cadet enlisted flight-cap device', 'Headgear', 'CAP_ONLY', [V(8.60, 'verified', AUG), U(null), I(null)], { q: 'Civil Air Patrol Cap Device Cadet Enlisted Flight' }),
    cap_device_nco_senior: item('CAP senior NCO cap device', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol senior NCO cap device' }),
    cap_device_officer_flight: item('CAP officer flight-cap device', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol officer flight cap device' }),
    cap_device_officer_service: item('CAP officer service-cap device', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol officer service cap device' }),
    cap_device_cadet_officer_service: item('CAP cadet officer service-cap device', 'Headgear', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol cadet officer service cap device' }),

    // ---- name -------------------------------------------------------------------------------------------------
    nametag_blue_cadet: item('CAP cadet nametag, blue, three-line', 'Name', 'CAP_ONLY', [V(5.10, 'verified', AUG, vg('/products/civil-air-patrol-cadet-name-plate')), U(null), I(null)], { ref: '4.1.6.2.1' }),
    nametag_gray_adult: item('CAP adult nametag, gray, three-line', 'Name', 'CAP_ONLY', [V(5.10, 'verified', AUG, vg('/products/civil-air-patrol-senior-member-name-plate')), U(null), I(null)], { ref: '4.1.6.2.1' }),
    nametag_black_blazer: item('CAP blazer nametag, black, with crest, name and state', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol corporate nametag black crest', ref: '4.2.3.1.1.2' }),
    nametag_flight_embroidered: item('Flight suit nametag, blue cloth embroidered (2 x 4 in)', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol flight suit nametag embroidered', ref: '8.2.4.1' }),
    nametag_flight_leather: item('Flight suit nametag, black leather (2 x 4 in)', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol leather flight nametag', ref: '8.2.4.1' }),
    ocp_name_tape: item('OCP name tape', 'Name', 'CAP_ONLY', [V(4.65, 'estimated', AUG), U(null), I(null)], { q: 'CAP OCP embroidered name tape', ref: '7.1.1.1.2' }),
    ocp_cap_tape: item('OCP CIVIL AIR PATROL tape', 'Name', 'CAP_ONLY', [V(4.15, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol OCP tape', ref: '7.1.1.1.2' }),
    abu_name_tape: item('ABU name tape', 'Name', 'CAP_ONLY', [V(5.70, 'estimated', AUG), U(null), I(null)], { q: 'CAP ABU embroidered name tape' }),
    abu_cap_tape: item('ABU CIVIL AIR PATROL tape', 'Name', 'CAP_ONLY', [V(2.10, 'estimated', AUG), U(null), I(null)], { q: 'Civil Air Patrol ABU tape' }),
    cfu_name_tape: item('CFU name tape', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol corporate field uniform name tape' }),
    cfu_cap_tape: item('CFU CIVIL AIR PATROL tape', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol corporate field uniform tape' }),
    cap_name_tape: item('Name tape for the cap', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'patrol cap name tape' }),
    polo_name_embroidery: item('Name embroidered on the polo (white thread)', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol polo name embroidery', ref: '5.3.2.1.1' }),
    polo_title_embroidery: item('Duty title embroidered on the polo', 'Name', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol polo embroidery', ref: '5.3.2.1.1' }),

    // ---- lapel and collar insignia --------------------------------------------------------------------------------
    us_insignia_officer: item('US lapel insignia, officer (pair)', 'Insignia', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'US lapel insignia officer', ref: '4.1.5.2.2' }),
    us_insignia_nco: item('US insignia in a ring, NCO (pair)', 'Insignia', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'US insignia with circle enlisted', ref: '4.1.5.2.2' }),
    cap_lapel_insignia: item('CAP cutout lapel insignia (pair)', 'Insignia', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol CAP cutout lapel insignia', ref: '4.1.5.2.2' }),
    // Vanguard CAP0820, a pair to the package, so the one line covers both collars (LIVE13 E79, the product Ethan sent).
    cap_collar_metal: item('Civil Air Patrol Collar Device: CAP - mirror finish', 'Insignia', 'CAP_ONLY', [V(6.10, 'verified', '2026-10-29', vg('/collections/cadet-insignia/products/civil-air-patrol-mirror-finish-cap-collar-device'), 'CAP0820'), U(null), I(null)], { q: 'Civil Air Patrol collar insignia', ref: '1.4.2.1', note: 'Sold as a pair (2 per package): one package covers both collars.' }),
    cap_collar_cloth: item('CAP collar insignia, cloth (pair)', 'Insignia', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol cloth collar insignia' }),
    // Not a vendor item (LIVE13 E79, Ethan: "the crest cannot be purchased normally"): no offers, no search links, no price; the
    // line stays so the member knows the blazer needs it, and the totals leave it out (purchase-feature-core.js notSold).
    cap_crest: item('CAP Crest (blazer pocket)', 'Insignia', 'CAP_ONLY', [], { notSold: true, ref: '4.2.3.1.1.1', note: 'Issued/obtained through CAP, not a vendor item.' }),
    cap_seal: item('CAP seal', 'Insignia', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol seal emblem' }),
    officer_sleeve_braid: item('Officer sleeve braid (service coat)', 'Insignia', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'Air Force service coat sleeve braid', ref: '4.1.5.2' }),
    mess_sleeve_braid: item('Mess dress sleeve braid', 'Insignia', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'mess dress sleeve braid', ref: '4.1.1.1' }),
    general_officer_buckle: item('General officer belt buckle', 'Accessories', 'MILSPEC_OK', [U(null), V(null), I(null)], { q: 'general officer belt buckle' }),
    tie_tack: item('Tie tack or clasp (CAP crest, wing and star, AF symbol or grade)', 'Accessories', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol tie tack', ref: '4.1.6.3' }),

    // ---- carriers for grade ---------------------------------------------------------------------------------------
    cadet_officer_boards_male: item('CAP cadet officer shoulder boards, men', 'Grade', 'CAP_ONLY', [V(41.30, 'verified', AUG, vg('/products/civil-air-patrol-cadet-officer-shoulder-board-for-service-coat')), U(null), I(null)], { ref: '4.1.5.2.1.3' }),
    cadet_officer_boards_female: item('CAP cadet officer shoulder boards, women', 'Grade', 'CAP_ONLY', [V(41.30, 'verified', AUG, vg('/products/civil-air-patrol-shoulder-board-cadet-female-officer-wear-on-service-coat')), U(null), I(null)], { ref: '4.1.9.3.4' }),
    cadet_epaulet_sleeves_blank: item('CAP cadet officer epaulet sleeves, blue (pair)', 'Grade', 'CAP_ONLY', [V(12.80, 'estimated', OCT), U(null), I(null)], { q: 'Civil Air Patrol cadet officer epaulet sleeves blue', ref: '4.1.8.1.1' }),
    ocp_rank_blank: item('OCP hook-and-loop rank patch backing', 'Grade', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'OCP blank rank patch' }),
    es_patch: item('Emergency Services patch, embroidered', 'Patches', 'CAP_ONLY', [V(4.65, 'estimated', OCT), U(null), I(null)], { q: 'Civil Air Patrol emergency services patch', ref: '8.2.4.3' }),
    command_patch: item('CAP command patch', 'Patches', 'CAP_ONLY', [V(4.65, 'estimated', OCT), U(null), I(null)], { q: 'Civil Air Patrol command patch', ref: '8.2.4.2' }),
    us_flag_patch_ocp: item('US flag patch, full color, reversed (right sleeve)', 'Patches', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'reversed US flag patch full color OCP', ref: '7.1.1.4.1.1' }),
    aux_patch_ocp: item('AUX duty identifier patch', 'Patches', 'CAP_ONLY', [V(null), U(null), I(null)], { q: 'Civil Air Patrol AUX patch OCP', ref: '7.1.1.1.2' }),
    us_flag_patch_flight: item('Cloth US flag emblem with gold border, 2 x 3 1/2 in (left sleeve)', 'Patches', 'MILSPEC_OK', [V(null), U(null), I(null)], { q: 'US flag patch gold border flight suit', ref: '8.2.4.4' }),

    // A Ranger tab, by its grade (patch-ranger-tab-<grade>, resolved by patchItem below). The custom order form is the only
    // offer: no price ("by order form") and no vendor searches (LIVE13 E79).
    ranger_tab: item('CAP Ranger tab', 'Patches', 'CAP_ONLY', [offer('capranger', null, null, null, RANGER_ORDER_FORM)], { byOrderForm: true, note: 'Ordered from Hawk Mountain Ranger School on its custom order form (linked from capranger.org, CAP Ranger grades); not sold by the uniform vendors.' }),

    // ---- racks ------------------------------------------------------------------------------------------------------
    ribbon_mount: item('Ribbon mounting bar', 'Ribbons', 'GENERIC_SPEC', [V(null), U(null), I(null)], { q: 'ribbon mounting bar', note: 'Sized for the number of ribbons on the rack.' }),
    mini_mount: item('Miniature medal mounting bar', 'Miniature medals', 'GENERIC_SPEC', [V(null), U(null), I(null)], { q: 'miniature medal mounting bar', note: 'Sized for the number of miniature medals.' })
  };

  // ---- grade insignia, by form and grade ----------------------------------------------------------------------------
  const cadetEnlistedChevrons = {
    'C/Amn': 8.75, 'C/A1C': 9.95, 'C/SrA': 9.95, 'C/SSgt': 10.40, 'C/TSgt': 10.70, 'C/MSgt': 11.70, 'C/SMSgt': 12.75, 'C/CMSgt': 15.20
  };
  const GRADE_NAMES = {
    airman: 'Amn', 'airman-first-class': 'A1C', 'senior-airman': 'SrA', 'staff-sergeant': 'SSgt', 'technical-sergeant': 'TSgt', 'master-sergeant': 'MSgt',
    'senior-master-sergeant': 'SMSgt', 'chief-master-sergeant': 'CMSgt', 'command-chief': 'CCM', 'second-lieutenant': '2d Lt', 'first-lieutenant': '1st Lt',
    captain: 'Capt', major: 'Maj', 'lieutenant-colonel': 'Lt Col', colonel: 'Col', 'brigadier-general': 'Brig Gen', 'major-general': 'Maj Gen',
    'flight-officer': 'FO', 'technical-flight-officer': 'TFO', 'senior-flight-officer': 'SFO'
  };
  // What a grade piece costs, from the August estimates: { cadet NCO metal chevrons, cadet officer metal grade, senior NCO chevrons,
  // gray epaulet sleeves, service-coat grade, mess-dress boards }; the cloth, OCP and miniature forms are October estimates.
  function gradeOffers(kind, grade, form){
    const q = `Civil Air Patrol ${grade} ${{ 'cadet-nco': 'cadet chevron', 'cadet-officer': 'cadet officer grade insignia', 'senior-nco': 'senior NCO chevron', senior: 'grade insignia' }[kind] || 'grade insignia'} ${form}`.replace(/\s+/g, ' ');
    let price = null, checked = AUG;
    if(kind === 'cadet-nco' && form === 'metal') price = cadetEnlistedChevrons[grade];
    else if(kind === 'cadet-officer' && /metal/.test(form)) price = /miniature/.test(form) ? (checked = OCT, 9.95) : 11.90;
    else if(kind === 'senior-nco' && /chevron/.test(form)) price = 14.95;
    else if(/cloth/.test(form)) { price = 5.70; checked = OCT; }
    else if(/ocp/.test(form)) { price = 4.95; checked = OCT; }
    else if(kind === 'epaulet') price = 12.80;
    else if(kind === 'mess-board') price = 51.05;
    return [V(price, 'estimated', checked, null), U(null), I(null)].map(o => Object.assign(o, { q }));
  }

  // ---- ribbons, miniature medals, devices ---------------------------------------------------------------------------
  const miniMedalProducts = {
    air_force_aerial_achievement_medal: V(10.10, 'verified', AUG, vg('/products/usaf-aerial-achievement-miniature-medal')),
    air_medal: V(10.10, 'verified', AUG, vg('/products/air-medal-miniature-medal')),
    distinguished_service_award: V(12.20, 'verified', AUG, vg('/products/civil-air-patrol-distinguished-service-miniature-medal')),
    cap_membership_ribbon: V(11.35, 'verified', AUG),
    spaatz_award: V(11.35, 'verified', AUG),
    encampment_ribbon: V(11.35, 'verified', AUG)
  };
  const MILITARY_IN_CAP_LIST = ['air_force_aerial_achievement_medal', 'Air_Force_Organizational_Excellence_Award', 'air_medal'];

  // A device on a ribbon or a miniature medal, by its artwork: { name, offers }. Counts are what the rack draws on that award.
  // Clasp clusters come as 1-4; stars as a pair per package.
  const clasp = (metal, n) => {
    const known = {
      bronze: { 1: V(1.00, 'verified', AUG, vg('/products/civil-air-patrol-award-triangle-ribbon-clasp-in-bronze')), 2: V(1.95, 'verified', AUG, vg('/products/civil-air-patrol-award-two-triangle-cluster-in-bronze')), 3: V(2.25, 'verified', AUG, vg('/products/civil-air-patrol-award-three-triangle-cluster-in-bronze')), 4: V(2.35, 'estimated', AUG) },
      silver: { 1: V(1.00, 'verified', AUG, vg('/products/civil-air-patrol-award-triangle-clasp-in-silver')), 2: V(1.95, 'estimated', AUG), 3: V(2.25, 'estimated', AUG), 4: V(2.35, 'estimated', AUG) }
    };
    return known[metal][Math.max(1, Math.min(4, n))];
  };
  const DEVICES = {
    'device-clasp-bronze': { name: 'bronze triangle clasp', size: '3/16 in', unit: 'clasp', q: 'Civil Air Patrol triangle clasp bronze', offer: n => clasp('bronze', n), cluster: 4 },
    'device-clasp-silver': { name: 'silver triangle clasp', size: '3/16 in', unit: 'clasp', q: 'Civil Air Patrol triangle clasp silver', offer: n => clasp('silver', n), cluster: 4 },
    'device-star-bronze': { name: 'bronze star', size: '3/16 in', unit: 'star', q: 'Ribbon Attachment 3/16 Bronze Star', offer: () => V(2.20, 'verified', AUG), pack: 2 },
    'device-star-silver': { name: 'silver star', size: '3/16 in', unit: 'star', q: 'Ribbon Attachment 3/16 Silver Star', offer: () => V(2.20, 'verified', AUG), pack: 2 },
    'device-star-gold': { name: 'gold star', size: '3/16 in', unit: 'star', q: 'Ribbon Attachment 3/16 Gold Star', offer: () => V(2.20, 'verified', AUG), pack: 2 },
    'device-propeller-bronze': { name: 'bronze propeller', size: '3/16 in', unit: 'propeller', q: 'Civil Air Patrol propeller clasp bronze', offer: () => V(1.35, 'verified', AUG, vg('/products/civil-air-patrol-award-propeller-clasp-in-bronze')) },
    'device-propeller-silver': { name: 'silver propeller', size: '3/16 in', unit: 'propeller', q: 'Civil Air Patrol propeller clasp silver', offer: () => V(1.35, 'estimated', OCT) },
    'device-v': { name: 'silver V', unit: 'V', q: 'Ribbon Attachment Silver V', offer: () => V(4.80, 'estimated', AUG) }
  };
  function deviceInfo(assetId){
    if(DEVICES[assetId]) return DEVICES[assetId];
    let m = /^device-years-(\d+)$/.exec(assetId);
    if(m) return { name: `${m[1]}-year longevity device`, unit: 'device', q: 'Civil Air Patrol longevity service device', offer: () => V(2.65, 'estimated', AUG) };
    m = /^mil-device-(.+)$/.exec(assetId);
    if(m){
      const words = m[1].replace(/-/g, ' ').replace(/^olc/, 'oak leaf cluster').replace(/^numeral /, 'numeral ').replace(/(bronze|silver|gold) (.*)/, '$1 $2');
      return { name: `military ${words} device`, unit: 'device', q: `${words} ribbon device`, offer: () => V(null), military: true };
    }
    return null;
  }

  // A ribbon: the CAP ribbon at Vanguard (budget $1.60), a U.S. military award's ribbon at any of the three.
  function ribbonOffers(id, name, military){
    if(military || MILITARY_IN_CAP_LIST.includes(id)) return [V(1.60, 'estimated', AUG), U(null), I(null)].map(o => Object.assign(o, { q: `${name} ribbon` }));
    return [V(1.60, 'estimated', AUG), U(null), I(null)].map(o => Object.assign(o, { q: `Civil Air Patrol ${name} ribbon` }));
  }
  function miniOffers(id, name){
    const known = miniMedalProducts[id];
    const q = `${MILITARY_IN_CAP_LIST.includes(id) ? '' : 'Civil Air Patrol '}${name} miniature medal`;
    return [known ? Object.assign({}, known) : V(11.35, 'estimated', AUG), U(null), I(null)].map(o => Object.assign(o, { q }));
  }

  // ---- badges and patches -------------------------------------------------------------------------------------------
  // form: 'dress' (regular metal/enamel), 'mini', 'field' (subdued), 'cloth' (blue embroidered), 'military'.
  const BADGE_FORM_WORDS = { dress: 'regular size', mini: 'miniature', field: 'subdued cloth', cloth: 'blue cloth', military: 'military', polo: 'embroidered' };
  function badgeOffers(id, name, form){
    const words = { dress: '', mini: 'miniature', field: 'subdued', cloth: 'embroidered', military: '', polo: 'embroidered' }[form] || '';
    const q = (form === 'military' ? `${name} badge` : `Civil Air Patrol ${name} ${words}`).replace(/\s+/g, ' ').trim();
    const price = form === 'polo' ? null : (form === 'mini' ? 9.95 : form === 'field' || form === 'cloth' ? 5.70 : 11.00);
    const checked = form === 'dress' ? AUG : OCT;
    return [V(price, 'estimated', checked), U(null), I(null)].map(o => Object.assign(o, { q }));
  }
  // A patch the drawing names that has its own catalog entry: { item, detail }, or null for an ordinary patch.
  function patchItem(id){
    const m = /^(?:patch-)?ranger[-_]tab[-_]([a-z0-9_-]+)$/i.exec(String(id || ''));
    if(m) return { item: 'ranger_tab', detail: m[1].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
    return null;
  }
  function patchOffers(name){
    return [V(4.65, 'estimated', AUG), U(null), I(null)].map(o => Object.assign(o, { q: `Civil Air Patrol ${name}` }));
  }
  const CORDS = {
    'honor-guard': ['CAP Honor Guard shoulder cord', 19.20], 'color-guard': ['CAP Color Guard shoulder cord', 35.00],
    group: ['Group CAC shoulder cord', 35.00], wing: ['Wing CAC shoulder cord', 35.00], region: ['Region CAC shoulder cord', 35.00],
    national: ['National CAC shoulder cord', 35.00], 'aide-de-camp': ['USAF Aide de Camp cord', null]
  };
  function cordInfo(key){
    const c = CORDS[key] || [`${key.replace(/-/g, ' ').replace(/^[a-z]/, ch => ch.toUpperCase())} shoulder cord`, 35.00];
    return { name: c[0], offers: [V(c[1], 'estimated', c[1] == null ? null : AUG), U(null), I(null)].map(o => Object.assign(o, { q: key === 'aide-de-camp' ? 'Air Force aide de camp cord' : `Civil Air Patrol ${c[0]}` })) };
  }

  return {
    version: '2026.10.28.1',
    priceChecked: AUG,
    estimatesMade: OCT,
    currency: 'USD',
    sourceRules: {
      CAP_ONLY: 'CAP-specific item: do not substitute a visually similar military item.',
      MILSPEC_OK: 'Standard military-spec component: an equivalent military-spec item may be used where CAP authorizes the same component.',
      GENERIC_SPEC: 'Generic item is acceptable only if it meets the required specification.',
      VERIFY: 'Verify the exact authorized version before purchasing.'
    },
    vendors: {
      vanguard: { name: 'Vanguard', home: VANGUARD },
      uniforms4u: { name: 'Uniforms-4U', home: U4U },
      iragreen: { name: 'Ira Green', home: IRA },
      capranger: { name: 'Hawk Mountain Ranger School (capranger.org)', home: CAPRANGER, info: RANGER_GRADES_PAGE }
    },
    search: (vendor, q) => (SEARCH[vendor] || SEARCH.vanguard)(q),
    items,
    GRADE_NAMES, gradeOffers, deviceInfo, ribbonOffers, miniOffers, badgeOffers, BADGE_FORM_WORDS, patchOffers, patchItem, cordInfo,
    searchOnly,
    MILITARY_IN_CAP_LIST
  };
});
