// Extracted verbatim from index.html: the CAP Member Search report importer.
// Loaded as a classic script between the two halves of the inline app script,
// so it shares the same global scope and runs in the same order as before.

/* ===========================
   CAP MEMBER SEARCH REPORT IMPORTER
   =========================== */
const MEMBER_REPORT_IMPORT_BADGE_PRIORITY = [
  // Aviation / aeronautical
  // Highest-value aviation family order: Pilot > Observer > Aircrew.
  'CAPMasterPilot1_621A0E2ED15DA','CAPSeniorPilot1_D9725AE959752','CAPPilot1_FA9D33EA587D8',
  'GliderPilot1_7BFB287379918','BalloonPilot1_442D89C94185B','solo_badge','pre_solo_badge',
  'MasterObserver1_1B88D5071FD5C','SeniorObserver1_0E35802A29801','observer_badge',
  'MasterAirCrew1_72AC4CAE7A310','SeniorAirCrew1_B289BAE6E515C','AirCrew1_DB3F0FCC3650F',
  'uas_pilot_master_badge','uas_pilot_senior_badge','uas_pilot_basic_badge',

  // Occupational / over-ribbon
  // Incident Commander is intentionally higher value than Ground Team because
  // Master Ground Team is required for the Basic Incident Commander Badge.
  'basic_incident_commander_badge',
  'master_ground_team_badge','senior_ground_team_badge','ground_team_basic_badge',
  'emt_paramedic','emt_intermediate','emt_basic_badge',

  // Pocket/flexible specialty
  'model_rocketry_badge',
  'master_emergency_services_badge','senior_emergency_services_badge','emergency_services_badge',
  'communications_master_badge','communications_senior_badge','communications_technician_badge','information_technology_technician_badge','historian_technicianIbadge',
  'cyber_badges','stem_badges','volunteer_university_instructor_badge','cadet_programs_badge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge',
  'administration_technician_badge','administration_senior_badge','administration_master_badge','aerospace_education_technician_badge','aerospace_education_senior_badge','aerospace_education_master_badge','finance_technician_badge','finance_senior_badge','finance_master_badge',
  'nra_marksman_badge'
];

// The panel's lines. A line is a sentence, or { heading } for a group's title, or { item } for a row of a group, or { fold, items } for a closed
// fold under the panel (a details element: the summary is `fold`, the rows are `items`). Everything reaches the page as text: a file name or a
// row of the report with markup in it is shown as it is written and never run.
function setMemberReportImportStatus(lines, type='info'){
  const el = by('memberReportImportStatus');
  if(!el) return;
  const arr = Array.isArray(lines) ? lines : [lines];
  el.style.color = type === 'error' ? 'var(--danger)' : type === 'ok' ? 'var(--ok)' : 'var(--muted)';
  el.style.overflowWrap = 'anywhere';
  el.textContent = '';
  for(const line of arr){
    const row = document.createElement('div');
    if(line && typeof line === 'object' && 'heading' in line){
      row.textContent = String(line.heading);
      row.style.fontWeight = '700';
      row.style.marginTop = '6px';
    }else if(line && typeof line === 'object' && 'item' in line){
      row.textContent = `– ${line.item}`;
      row.style.paddingLeft = '10px';
    }else if(line && typeof line === 'object' && 'fold' in line){
      const fold = document.createElement('details'), summary = document.createElement('summary');
      summary.textContent = String(line.fold);
      summary.style.cursor = 'pointer';
      summary.style.fontWeight = '700';
      fold.style.marginTop = '8px';
      fold.appendChild(summary);
      for(const item of line.items || []){
        const note = document.createElement('div');
        note.textContent = `– ${item}`;
        note.style.paddingLeft = '10px';
        fold.appendChild(note);
      }
      el.appendChild(fold);
      continue;
    }else{
      row.textContent = String(line);
    }
    el.appendChild(row);
  }
}

// The panel describes the build the import left, and the badge picker lists the badges the report authorized. When the build changes afterwards the
// panel says so at its top, once; when Undo takes the import back (the build is the one it replaced) the panel says that and the picker drops the
// report's list; when Redo brings it back the panel and the list return. A tick or a rank changed by hand keeps the list.
let memberReportShown = null;   // { pre, post, authorized, row } of the last import
function memberReportBuildSignature(){
  const ribbons = Object.entries(State.ribbonSelections || {}).filter(([, sel]) => sel && sel.checked).map(([id, sel]) => `${id}=${sel.awardValue || ''}`).sort();
  return JSON.stringify([State.membership, State.rank, State.gender, ribbons, [...(State.badges || [])].sort(), [...(State.patches || [])].sort()]);
}
function memberReportRememberImport(result){
  if(memberReportShown && memberReportShown.row && memberReportShown.row.parentNode) memberReportShown.row.parentNode.removeChild(memberReportShown.row);
  memberReportShown = { pre:result.preImport, post:memberReportBuildSignature(), authorized:result.authorized || [], row:null, state:'current' };
}
function markMemberReportPanelStale(){
  if(!memberReportShown) return;
  const shown = memberReportShown, now = memberReportBuildSignature();
  const state = now === shown.post ? 'current' : now === shown.pre ? 'undone' : 'changed';
  if(state === shown.state) return;
  shown.state = state;
  const el = by('memberReportImportStatus');
  if(el && shown.row && shown.row.parentNode) el.removeChild(shown.row);
  shown.row = null;
  const authorized = state === 'undone' ? null : shown.authorized;
  if(State.reportAuthorizedBadgeIds !== authorized){
    State.reportAuthorizedBadgeIds = authorized && authorized.length ? [...authorized] : (authorized ? [] : null);
    if(typeof buildBadgeGallery === 'function') buildBadgeGallery();
  }
  if(!el || state === 'current') return;
  const row = document.createElement('div');
  row.textContent = state === 'undone' ? 'This import has been undone; the lines below describe the report that was imported.' : 'The build has changed since this import, so the lines below may no longer match it.';
  row.style.fontWeight = '700';
  el.insertBefore(row, el.firstChild);
  shown.row = row;
}

// The notes an import leaves, as the member reads them: one per line, no note twice, no internal id, no eServices capitals.
// The parsers push a note at each stage they run (the Cadet Advisory Council ribbon and cord are said three times, the last a restatement
// of the first), so the lines are tidied here, where they are shown.
const CAPUB_NOTE_CAPS_KEEP = new Set(['CAP', 'CAC', 'NCSA', 'USAF', 'ABU', 'OCP', 'PDF', 'STEM', 'NHQ', 'HQ', 'CAPR']);
const CAPUB_NOTE_LEVELS = new Set(['WING', 'GROUP']);
function capubImportNoteLines(notes){
  let list = [...new Set((notes || []).map(n => String(n || '').trim()).filter(Boolean))];
  // "CAC final check: ..." restates the notes before it.
  list = list.filter(n => !/^CAC final check:/.test(n));
  // Of the lines that say the Cadet Advisory Council ribbon was imported, the last (it gives the reason) is the one kept.
  const ribbonLines = list.filter(n => /^CAC ribbon imported/.test(n));
  if(ribbonLines.length > 1) list = list.filter(n => !/^CAC ribbon imported/.test(n) || n === ribbonLines[ribbonLines.length - 1]);
  // A line that is the opening of a longer one says less: only the longer is kept.
  list = list.filter(n => { const stem = n.replace(/\.$/, ''); return !list.some(m => m !== n && m.startsWith(stem) && m.length > n.length); });
  const cac = { group: 'Group CAC / Basic Ribbon', wing_bronze_star: 'Wing CAC / Bronze Star', region_silver_star: 'Region CAC / Silver Star', national_gold_star: 'National CAC / Gold Star' };
  const title = w => w.charAt(0) + w.slice(1).toLowerCase();
  return list.map(n => n
    .replace(/\b(wing_bronze_star|region_silver_star|national_gold_star)\b/g, id => cac[id])
    .replace(/\bas group([.:])/g, (m, end) => `as ${cac.group}${end}`)
    .replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, id => id.split('_').map((w, i) => i ? w : title(w)).join(' '))
    // eServices prints names in capitals; a charter (GLR-IL-049) and the abbreviations keep theirs.
    // A run of capital words ("CADET PROGRAMS TECHNICIAN") or a long single one ("WING") is a name in capitals; a short single one ("PJOC") is an abbreviation.
    .replace(/(?<![A-Za-z0-9-])[A-Z]{3,}(?: [A-Z]{3,})*(?![A-Za-z0-9-])/g, run => {
      const words = run.split(' ');
      if(words.length === 1 && (CAPUB_NOTE_CAPS_KEEP.has(run) || run.length < 5 && !CAPUB_NOTE_LEVELS.has(run))) return run;
      return words.map(w => CAPUB_NOTE_CAPS_KEEP.has(w) ? w : title(w)).join(' ');
    })
    .replace(/\s+/g, ' '));
}

// PDF.js is only needed when a member imports a PDF report, so it is fetched on
// first use instead of blocking every page load.
// Vendored (pdfjs-dist 3.11.174, Apache-2.0; see vendor/pdfjs/LICENSE) so no third-party code loads at runtime.
const PDFJS_URL = 'vendor/pdfjs/pdf.min.js';
let pdfJsLoading = null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(!pdfJsLoading){
    pdfJsLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_URL;
      script.onload = () => window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error('The PDF reader loaded but is unavailable.'));
      script.onerror = () => { pdfJsLoading = null; script.remove(); reject(new Error('The PDF reader did not load. Check your internet connection or upload a .txt export instead.')); };
      document.head.appendChild(script);
    });
  }
  return pdfJsLoading;
}

// What a report file may be: a PDF (the page's Print to PDF of Printer Friendly View) or its text copied into a .txt file. The limits are far
// above a real report (a few pages, under 100 KB of text) and keep a wrong file from locking the page.
const MEMBER_REPORT_LIMITS = Object.freeze({ textBytes:2 * 1024 * 1024, pdfBytes:12 * 1024 * 1024, pdfPages:60, textChars:600000 });

// How pdf.js opens a member's PDF. Nothing in a report needs scripts, fonts, forms or images, so none run: isEvalSupported false is the setting
// that keeps a hostile PDF from compiling code in the page (pdf.js 3.11 builds font programs with new Function when it is allowed).
const MEMBER_REPORT_PDF_OPTIONS = Object.freeze({
  isEvalSupported:false, enableXfa:false, disableFontFace:true, useSystemFonts:false, disableAutoFetch:true, disableStream:true,
  disableRange:true, maxImageSize:1024 * 1024, stopAtErrors:false, verbosity:0
});

// An error whose message is the sentence the member reads.
function memberReportError(code, message){
  const error = new Error(message);
  error.memberReportCode = code;
  return error;
}

function memberReportFileKind(file){
  const name = String(file?.name || '').toLowerCase(), type = String(file?.type || '').toLowerCase();
  if(/\.pdf$/.test(name) || type === 'application/pdf') return 'pdf';
  if(/\.te?xt$/.test(name) || type === 'text/plain') return 'text';
  return null;
}

// A page's text two ways. In the order the PDF draws it: right for a table drawn row by row (a browser's print), wrong for one drawn
// column by column (the names, then the dates). By line: the items grouped by their height on the page and read left to right, right
// for both, wrong for a cell that wraps onto a second line beside its neighbour's. Items without a position are read in order only.
function memberReportPageText(items){
  const shown = (items || []).filter(item => item && item.str);
  const inOrder = shown.map(item => item.str).join(' ');
  if(!shown.length || !shown.every(item => Array.isArray(item.transform))) return { inOrder, byLine:inOrder };
  const lines = [];
  for(const item of [...shown].sort((a, b) => b.transform[5] - a.transform[5])){
    const line = lines.find(l => Math.abs(l.y - item.transform[5]) <= Math.max(2, (item.height || 0) / 2));
    if(line) line.items.push(item);
    else lines.push({ y:item.transform[5], items:[item] });
  }
  const byLine = lines.map(l => l.items.sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ')).join(' ');
  return { inOrder, byLine };
}

// How well a reading of the report holds its rows: the dates that follow words of their own (a row is its words and then its date), plus
// the grade row and the section headings. A reading that lost its rows (the names, then all the dates) scores lower than the same text by line.
function memberReportReadingScore(text){
  const t = normalizeMemberReportText(text);
  let rows = 0, previousEnd = 0, m;
  const re = new RegExp(MEMBER_REPORT_DATE, 'gi');
  while((m = re.exec(t))){
    if(/[A-Za-z]{3}/.test(t.slice(previousEnd, m.index).replace(MEMBER_REPORT_TABLE_HEADINGS, ''))) rows++;
    previousEnd = m.index + m[0].length;
  }
  return rows + (getCurrentProfileFromMemberReport(t) ? 20 : 0) + MEMBER_REPORT_HEADINGS.filter(h => h.test(t)).length;
}
function memberReportPickReading(inOrder, byLine){
  return inOrder === byLine || memberReportReadingScore(byLine) <= memberReportReadingScore(inOrder) ? inOrder : byLine;
}

async function extractMemberReportText(file){
  const kind = memberReportFileKind(file);
  if(!kind) throw memberReportError('type', 'That file is not a PDF or a text file. Save the member report as a PDF, or copy its text into a .txt file.');
  const limit = kind === 'pdf' ? MEMBER_REPORT_LIMITS.pdfBytes : MEMBER_REPORT_LIMITS.textBytes;
  if(Number(file.size) > limit) throw memberReportError('size', `That file is too large to be a member report (the limit is ${Math.round(limit / 1048576)} MB).`);

  if(kind === 'text'){
    const text = await file.text();
    if(text.length > MEMBER_REPORT_LIMITS.textChars) throw memberReportError('size', 'That file holds too much text to be a member report.');
    return text;
  }

  try{
    await loadPdfJs();
  }catch(err){
    throw memberReportError('pdfjs', 'The PDF reader did not load. Check your connection and try again, or copy the report text into a .txt file.');
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfjsLib.GlobalWorkerOptions.workerSrc ||
    'vendor/pdfjs/pdf.worker.min.js';

  let pdf = null;
  try{
    const data = new Uint8Array(await file.arrayBuffer());
    pdf = await pdfjsLib.getDocument({ data, ...MEMBER_REPORT_PDF_OPTIONS }).promise;
    if(pdf.numPages > MEMBER_REPORT_LIMITS.pdfPages) throw memberReportError('size', `That PDF has more than ${MEMBER_REPORT_LIMITS.pdfPages} pages, too many for a member report.`);
    const inOrder = [], byLine = [];
    let chars = 0;
    for(let p=1; p<=pdf.numPages; p++){
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageText = memberReportPageText(content.items);
      chars += pageText.inOrder.length;
      if(chars > MEMBER_REPORT_LIMITS.textChars) throw memberReportError('size', 'That PDF holds too much text to be a member report.');
      inOrder.push(pageText.inOrder);
      byLine.push(pageText.byLine);
    }
    return memberReportPickReading(inOrder.join('\n'), byLine.join('\n'));
  }catch(err){
    if(err && err.memberReportCode) throw err;
    throw memberReportError('pdf', /password/i.test(String(err && (err.name || err.message))) ? 'That PDF is locked with a password, so it cannot be read. Save an unlocked copy of the member report.' : 'That PDF could not be opened. Save the member report as a PDF again, or copy its text into a .txt file.');
  }finally{
    try{ if(pdf) await pdf.destroy(); }catch(err){ /* nothing to release */ }
  }
}

// The report as one clean line. A PDF or a copy adds what is not the report: zero-width and soft-hyphen characters, a browser's print header and
// footer (its address and page count, its time stamp, "Page 2 of 3", the title again on every page), dates in another notation, a row printed twice.
// Every parser reads this line, so each of those is taken out here once. Running it again on its own result changes nothing.
const MEMBER_REPORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MEMBER_REPORT_DATE = '\\d{1,2}\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{4}';
const MEMBER_REPORT_MONTH_WORD = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

// The date notations other than "18 Dec 2025", each as "18 Dec 2025": 2025-12-18 (with or without a time), 12/18/2025 (month first; day first when
// the first number is above 12), Dec 18, 2025 and 18-Dec-2025. A number that is no date (a month above 12, a day above 31) is left as it is.
function normalizeMemberReportDates(text){
  const date = (d, month, y) => `${String(Number(d)).padStart(2, '0')} ${month} ${y}`;
  const valid = (d, m) => m >= 1 && m <= 12 && d >= 1 && d <= 31;
  const abbreviation = word => MEMBER_REPORT_MONTHS.find(m => m.toLowerCase() === word.slice(0, 3).toLowerCase());
  return String(text || '')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?\b/g, (m, y, mo, d) => valid(Number(d), Number(mo)) ? date(d, MEMBER_REPORT_MONTHS[Number(mo) - 1], y) : m)
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m, a, b, y) => {
      const [mo, d] = Number(a) > 12 ? [Number(b), Number(a)] : [Number(a), Number(b)];
      return valid(d, mo) ? date(d, MEMBER_REPORT_MONTHS[mo - 1], y) : m;
    })
    .replace(new RegExp(`\\b${MEMBER_REPORT_MONTH_WORD}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'), (m, word, d, y) => valid(Number(d), 1) ? date(d, abbreviation(word), y) : m)
    .replace(new RegExp(`\\b(\\d{1,2})-${MEMBER_REPORT_MONTH_WORD}\\.?-(\\d{4})\\b`, 'gi'), (m, d, word, y) => date(d, abbreviation(word), y))
    // Two-digit years: 12/18/25, 18-Dec-25, 18 Dec 25 (a year up to 50 is 20xx, above it 19xx).
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/g, (m, a, b, y) => {
      const [mo, d] = Number(a) > 12 ? [Number(b), Number(a)] : [Number(a), Number(b)];
      return valid(d, mo) ? date(d, MEMBER_REPORT_MONTHS[mo - 1], `${Number(y) <= 50 ? 20 : 19}${y}`) : m;
    })
    .replace(new RegExp(`\\b(\\d{1,2})[- ]${MEMBER_REPORT_MONTH_WORD}\\.?[- ](\\d{2})(?![\\d:])(?!\\s+${MEMBER_REPORT_MONTH_WORD}\\b)`, 'gi'), (m, d, word, y) => valid(Number(d), 1) ? date(d, abbreviation(word), `${Number(y) <= 50 ? 20 : 19}${y}`) : m);
}

// What a browser prints around the pages of a report and the report never says: the address with its page count, the time stamp
// ("11/10/26, 4:02 PM"; a PDF may set the colon apart, "11 : 09 AM"), "Page 2 of 3", and the report's title again on every page after the first.
// A PDF cuts the address at its first space and leaves the end of it, "? CAPID=123456", behind.
function stripMemberReportPageFurniture(text){
  let titles = 0;
  return String(text || '')
    .replace(/\bhttps?:\/\/\S+(?:\s+\d{1,3}\s*\/\s*\d{1,3}(?=\s|$))?/gi, ' ')
    .replace(/\?\s*CAPID\s*=\s*\d+/gi, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?(?:\s*[AP]\.?M\.?)?/gi, ' ')
    .replace(/\bPage\s+\d{1,3}\s+of\s+\d{1,3}\b/gi, ' ')
    .replace(/Printer\s+Friendly\s+View\s*[-–]\s*Member\s+Details/gi, title => ++titles > 1 ? ' ' : title)
    .replace(/\s+/g, ' ')
    .trim();
}

// A row printed twice (the same words and the same date or dates) is one record: a duplicated entry must not read as a later award with a
// clasp. A row is the words since the previous date, less a table heading before it. Rows too short to be a record ("2d Lt") are left alone.
const MEMBER_REPORT_TABLE_HEADINGS = new RegExp('^(?:.*\\b(?:' + [
  'Printer Friendly View - Member Details', 'General Information', 'CAPID Name Gender Type Rank Date of Rank Joined Expires Status Unit',
  '(?:Cadet |Current |Past )?(?:Cadet Past )?Duty Positions', 'Duty Position Unit Echelon Asst Start Date End Date', 'Professional Development',
  'Course Date Completed', 'Specialty Tracks?', 'Specialty Track Level Completed', 'Cadet Training', 'Activity Date Completed', 'Encampments',
  'Encampment Date Completed', 'Orientation Flights', 'Cadet Achievements', 'Achievement Date Completed Test Score', 'Awards', 'Promotions', 'Date Rank',
  'Decorations', 'Activity\\s*\\/\\s*Service Ribbon', 'Emergency Services Qualifications', 'Qualification Status Expiration', 'Transfer History', 'Current Committees'
].join('|') + '))(?:\\s+|$)', 'i');
function memberReportDuplicateCuts(source){
  // A row's dates are up to three that follow its words: a decoration prints "from to to" and then the date it was approved, so that two awards of one
  // name that began on one day, and were approved on two, are two rows.
  const re = new RegExp(`(${MEMBER_REPORT_DATE})(?:\\s+(?:to\\s+)?(${MEMBER_REPORT_DATE}))?(?:\\s+(${MEMBER_REPORT_DATE}))?`, 'gi');
  const seen = new Set(), cuts = [];
  let previousEnd = 0, m;
  while((m = re.exec(source))){
    const segmentStart = previousEnd;
    const segment = source.slice(segmentStart, m.index);
    previousEnd = m.index + m[0].length;
    const from = (MEMBER_REPORT_TABLE_HEADINGS.exec(segment) || [''])[0].length;
    const rest = segment.slice(from);
    const words = rest.trim();
    if(words.length < 8 || !/[A-Za-z]{3}/.test(words)) continue;
    const key = `${words.toLowerCase()}|${m[1].toLowerCase()}|${(m[2] || '').toLowerCase()}|${(m[3] || '').toLowerCase()}`;
    if(seen.has(key)) cuts.push([segmentStart + from + (rest.length - rest.trimStart().length), previousEnd]);
    else seen.add(key);
  }
  return cuts;
}

function dedupeMemberReportRows(text){
  const source = String(text || '');
  const cuts = memberReportDuplicateCuts(source);
  if(!cuts.length) return source;
  let out = '', at = 0;
  for(const [start, end] of cuts){ out += source.slice(at, Math.max(at, start)); at = end; }
  return (out + source.slice(at)).replace(/\s+/g, ' ').trim();
}

// Everything but the removal of repeated rows, so the rows removed can be counted and said.
function memberReportCleanBeforeDedupe(text){
  // NFKC writes a ligature ("Certificate" with the fi joined, U+FB01) as its letters and joins a letter with its accent.
  const cleaned = String(text || '').normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '')
    .replace(/[\u2010-\u2012\u2212]/g, '-')
    .replace(/\uFFFE|\uFFFD|\uF0BE/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizeMemberReportDates(stripMemberReportPageFurniture(removeLocalActivitiesFromMemberReport(cleaned)));
}

function normalizeMemberReportText(text){
  return dedupeMemberReportRows(memberReportCleanBeforeDedupe(text));
}


function removeLocalActivitiesFromMemberReport(text){
  const source = String(text || '');
  const start = source.search(/Local\s+Activities/i);
  if(start < 0) return source;

  // Local Activities is the final member-report section. Do not try to locate
  // a later heading by label: activity descriptions themselves commonly contain
  // words such as "Professional Development", "Awards", and "Promotions".
  // Treating those cells as headings ended the exclusion early and allowed an
  // activity such as "Spaatz Award Presentation" to award a ribbon.
  return source.slice(0, start).trim();
}

// A grade as the report prints it ("C/1st Lt", "C/1stLt", "Lt Col", "2nd Lt", "MAJ GEN") as the setup's rank list
// (js/state.js RANKS) spells it, or the text unchanged when it is no CAP grade.
function normalizeImportedRank(raw){
  const key = s => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/2ndlt$/, '2dlt');
  const k = key(raw);
  return [...RANKS.cadet, ...RANKS.senior].find(rank => key(rank) === k) || String(raw || '').trim();
}

// Every CAP grade as a pattern, longest first, so "Maj Gen" is not read as "Maj", "C/1st Lt" as "C/1st",
// "C/Lt Col" as "C/Lt" or "TFO" as "FO". Spaces inside a grade may be missing ("C/LtCol") and "2nd Lt" is
// read as "2d Lt".
function importedRankPattern(){
  return [...RANKS.cadet, ...RANKS.senior, '2nd Lt', 'C/2nd Lt']
    .sort((a, b) => b.length - a.length)
    .map(rank => rank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*').replace(/\//g, '/\\s*'))
    .join('|');
}

// Without the General Information row: the grade in the report heading ("Member Details C/Col Guiseppe
// Mitchell"), else the highest grade the text names (the Promotions table lists every grade held).
function getHighestImportedRank(text){
  const t = normalizeMemberReportText(text);
  const pattern = importedRankPattern();
  const heading = t.match(new RegExp(`Member\\s+Details\\s+(${pattern})(?=\\s)`, 'i'));
  if(heading) return normalizeImportedRank(heading[1]);
  const order = [...RANKS.cadet, ...RANKS.senior];
  const hits = [...t.matchAll(new RegExp(`(?:^|[\\s(])(${pattern})(?=$|[\\s),])`, 'gi'))]
    .map(m => normalizeImportedRank(m[1])).filter(rank => order.includes(rank));
  if(!hits.length) return null;
  // A cadet grade and a senior grade both present: the senior grade is the later one (cadets become seniors).
  const pool = hits.some(rank => RANKS.senior.includes(rank)) ? hits.filter(rank => RANKS.senior.includes(rank)) : hits;
  return pool.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0];
}

function countOccurrences(text, pattern){
  const m = text.match(pattern);
  return m ? m.length : 0;
}

// The award count a semantic import value stands for: "find_3", "hours_120", or the clasps/stars it names
// beyond the first award ("bronze_clasp_3" is the 4th award, "silver_star_1_bronze_star_2" the 8th).
// Level stars (the Commander's Commendation region/National star) carry no digit and so add nothing.
function importedAwardCountFromValue(value){
  const v = String(value || '');
  let m;
  if((m = /^find_(\d+)$/i.exec(v))) return Number(m[1]);
  if((m = /^hours_(\d+)$/i.exec(v))) return Math.max(1, Math.round(Number(m[1]) / 60));
  if((m = /^capub_total_(\d+)$/i.exec(v))) return Number(m[1]);
  // The Silver Medal of Valor's value from before its later awards were a clasp: "silver_valor_3" is three awards.
  if((m = /^silver_valor_(\d+)$/i.exec(v))) return Math.max(1, Number(m[1]));
  let additional = 0;
  const re = /(silver|bronze)_(?:clasp|star)_(\d+)/gi;
  while((m = re.exec(v))) additional += (m[1].toLowerCase() === 'silver' ? 5 : 1) * Number(m[2]);
  return 1 + additional;
}

// The clasps (or stars) that mark `count` awards, as a value suffix: '' for one award, "bronze_clasp_3"
// for four, "silver_clasp_1_bronze_clasp_1" for seven (CAPR 39-3 6b: five bronze become one silver).
// The picker offers at most 84 awards of a clasp or star ribbon: a longer list (15 000 rows is no member's record) is 84, which is also what the
// engine can draw without freezing the page.
const IMPORTED_MOST_AWARDS = 84;
function importedAdditionalAwardValue(count, kind='clasp'){
  const additional = Math.max(0, Math.min(IMPORTED_MOST_AWARDS, Math.floor(Number(count) || 1)) - 1);
  const silver = Math.floor(additional / 5), bronze = additional % 5;
  return [silver ? `silver_${kind}_${silver}` : '', bronze ? `bronze_${kind}_${bronze}` : ''].filter(Boolean).join('_');
}

// Import values whose ribbon option is named by level rather than by count.
const IMPORTED_RIBBON_VALUE_ALIASES = {
  // The CAC level values (js/patches.js CAC_RIBBON_VALUE_BY_LEVEL) predate the 39-3 21j options, which
  // are cac_group / cac_wing / cac_region / cac_national; without this every level fell back to Group.
  cadet_advisory_council_ribbon: {
    group:'cac_group', earned:'cac_group', wing_bronze_star:'cac_wing', region_silver_star:'cac_region', national_gold_star:'cac_national'
  },
  cap_command_service_ribbon: {
    earned:/^Squadron\/CC$/i, group_bronze_star:/^Group\/CC$/i, wing_silver_star:/^Wing\/CC$/i,
    region_gold_star:/^Region\/CC$/i, national_two_gold_stars:/^National\/CC$/i
  }
};

// The modifiers an option label shows besides the count: the Presidential "V", the aircrew propeller,
// the lifesaving star and the Commander's Commendation level stars.
function importedOptionModifiers(id, text){
  const t = String(text || '');
  const out = [];
  if(id === 'disaster_relief_ribbon' && /silver[_ ]v\b|silver_v|v[-_ ]device|w\/v\b/i.test(t)) out.push('v');
  if(['search_find_ribbon','air_search_and_rescue_ribbon'].includes(id) && /prop|aircrew/i.test(t)) out.push('prop');
  if(id === 'lifesaving_award' && /star/i.test(t)) out.push('star');
  if(id === 'commander_commendation_award'){
    if(/national|natl/i.test(t)) out.push('national');
    if(/region/i.test(t)) out.push('region');
  }
  return out.sort().join('+');
}

// The real picker option an import value lands on. The picker's options are the McChord catalog
// (mcchord_* values labelled "4th Award", "2nd with V-Device", "3rd Award (Region Cmdr)", "120 Hours"),
// so a semantic value is matched by the award count and modifiers it stands for. An import value that
// matched no option used to fall back to the basic ribbon, silently dropping its devices.
function findImportedRibbonOption(id, value){
  const options = typeof getRibbonAwardOptions === 'function' ? (getRibbonAwardOptions(id) || []) : [];
  const usable = options.filter(o => o && o.value);
  const exact = usable.find(o => o.value === value);
  if(exact) return exact;
  const alias = IMPORTED_RIBBON_VALUE_ALIASES[id]?.[value];
  if(alias){
    const found = usable.find(o => alias instanceof RegExp ? alias.test(String(o.label || '')) : o.value === alias);
    if(found) return found;
  }
  const RA = globalThis.CAPUBRibbonAwards;
  const semantic = String(value || '');
  if(RA?.readCount && RA.FAMILIES?.[id] && !/^years_/.test(semantic)){
    const count = importedAwardCountFromValue(semantic);
    const wanted = importedOptionModifiers(id, semantic);
    const found = usable.find(o => RA.readCount(id, o.value, String(o.label || '')) === count &&
      importedOptionModifiers(id, String(o.label || '')) === wanted &&
      !/additional ribbon/i.test(String(o.label || '')));
    if(found) return found;
  }
  return typeof getRibbonSelectionOption === 'function' ? getRibbonSelectionOption(id, value) : null;
}

function selectImportedRibbon(id, value='earned'){
  if(!id) return;
  if(!State.ribbonSelections[id]) State.ribbonSelections[id] = { checked:false, devices:{}, awardValue:'', awardLabel:'' };
  const option = findImportedRibbonOption(id, value);
  State.ribbonSelections[id].checked = true;
  State.ribbonSelections[id].awardValue = option?.value || value || 'earned';
  State.ribbonSelections[id].awardLabel = option?.label || 'Earned';
  State.ribbonSelections[id].devices = { ...(option?.devices || {}) };
  enforceRibbonExclusions(id);
}

// A plain clasp ribbon: one bronze clasp per award after the first, five bronze becoming one silver
// (CAPR 39-3 6b). The value names the clasps, so it resolves to the picker's "Nth Award" option for any count.
function chooseSpecialRibbonValueByAwardCount(id, count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'clasp');
}

function chooseCommunityServiceValue(count){
  if(count <= 1) return 'hours_60';
  if(count === 2) return 'bronze_clasp_1';
  if(count === 3) return 'bronze_clasp_2';
  if(count === 4) return 'bronze_clasp_3';
  if(count === 5) return 'bronze_clasp_4';
  if(count === 6) return 'silver_clasp_1';
  if(count === 7) return 'silver_clasp_1_bronze_clasp_1';
  return 'silver_clasp_1_bronze_clasp_2';
}


// CAPR 39-3 21g (data/ribbon-awards.js: the V marks a Presidentially declared disaster): one silver V on
// the ribbon, the bronze clasps for the later awards beside it. `hasV` is true when any report row says V.
function chooseDisasterReliefValue(count, hasV=false){
  const clasps = importedAdditionalAwardValue(count, 'clasp');
  if(hasV === true) return clasps ? `silver_v_${clasps}` : 'silver_v';
  return clasps || 'earned';
}

// One Disaster Relief Ribbon row per award. A row says V in whatever words the record uses: "with V",
// "w/V", "V Device", "V-Device", "(V)", "Silver V", or names the Presidential declaration the V stands for.
// The row is read up to its date, so a V or "Presidential" elsewhere in the report does not count.
function extractDisasterReliefFromReport(text){
  const source = String(text || '');
  const rowRe = /Disaster\s+Relief\s+Ribbon([\s\S]{0,60}?)(?=\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b|Disaster\s+Relief\s+Ribbon|$)/gi;
  const vRe = /(?:^|[\s(\/\-,])V(?:[\s\-]*Device)?(?=$|[\s),\-])|Silver\s+V\b|Presidential/i;
  let count = 0, hasV = false, m;
  while((m = rowRe.exec(source))){
    count++;
    const before = source.slice(Math.max(0, m.index - 14), m.index);
    if(vRe.test(m[1]) || /(?:Silver\s+V|Presidential)\s*$/i.test(before)) hasV = true;
    if(m[0].length === 0) rowRe.lastIndex++;
  }
  return count ? { count, hasV, value:chooseDisasterReliefValue(count, hasV) } : null;
}

// CAPR 39-3 20d (data/ribbon-awards.js: stars, one per activity): a bronze star for each activity after the
// first, five bronze becoming one silver. The value names the stars, so it resolves for any count (it used to
// stop at eight, and its seven- and eight-activity values matched no picker option and showed a bare ribbon).
function chooseCadetSpecialActivityValue(count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'star');
}

// CAPR 39-3 9f (data/ribbon-awards.js levelStars): a bronze clasp for each award after the first, five
// bronze becoming one silver (6b); a bronze star when an award was authorized by a region commander and
// a silver star when by the National Commander, to the wearer's right of the clasps. `level` is the
// highest level among the awards, or 'national_region' when both stars are earned.
function chooseCommandersCommendationValue(level, count=1){
  const normalizedLevel = String(level || 'wing').toLowerCase();
  const awardCount = Math.max(1, Math.floor(Number(count) || 1));
  const clasps = importedAdditionalAwardValue(awardCount, 'clasp');
  const prefix = normalizedLevel === 'national_region' ? 'national_silver_star_region_bronze_star'
    : normalizedLevel === 'national' ? 'national_silver_star'
    : normalizedLevel === 'region' ? 'region_bronze_star'
    : '';
  if(!prefix) return clasps ? `wing_${clasps}` : 'earned';
  return clasps ? `${prefix}_${clasps}` : prefix;
}

function extractCommandersCommendationFromReport(text){
  const decorations = getReportSectionUntilAny(text, 'Decorations', [
    'Ribbons', 'Local Activities', 'Professional Development', 'Cadet Training'
  ]);
  const scope = decorations || String(text || '');
  // One row per award. The apostrophe is straight in an HTML copy and curly in a PDF export, and may be
  // missing or doubled ("Commanders Commendation", "Commanders' Commendation"); the level may be printed
  // in parentheses, after a dash, with "Level" or "Commander", or not at all (a wing award).
  const rowRe = /\bCommanders?(?:\s*['‘’ʼ`´]\s*s?)?\s+Commendation(?:\s+(?:Award|Ribbon))?(?:\s*[(\-–:,]?\s*(National|Region|Wing)\b(?:\s+(?:Level|Commander|Cmdr|CC))?\s*\)?)?/gi;
  const rows = [];
  let match;
  while((match = rowRe.exec(scope))){
    rows.push({ level:(match[1] || 'wing').toLowerCase() });
  }
  if(!rows.length) return null;
  // Every row is one award of the same ribbon, so all of them count toward the clasps; the level of the
  // highest approving commander sets the star (both stars when region and National awards are on record).
  const hasNational = rows.some(row => row.level === 'national');
  const hasRegion = rows.some(row => row.level === 'region');
  const level = hasNational && hasRegion ? 'national_region' : hasNational ? 'national' : hasRegion ? 'region' : 'wing';
  const count = rows.length;
  return { level, count, value:chooseCommandersCommendationValue(level, count) };
}

// CAPR 39-3 9h: the Certificate of Recognition for Lifesaving carries the Lifesaving Award ribbon (Attachment 2:
// "Lifesaving Award"). A save in a blood or organ transport mission earns the basic ribbon; a save of any other
// kind adds the silver star. Later awards add bronze clasps, five bronze become one silver clasp. The report row
// names neither kind, so the import selects the ribbon and the clasps and leaves the star to the member.
function chooseLifesavingValue(count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'clasp');
}

function chooseEncampmentValue(count){
  if(count <= 1) return 'earned';
  return importedAdditionalAwardValue(count, 'clasp');
}

function importedBadgePriority(id){
  const specialtyPriority = getImportedSpecialtyBadgePriority(id);
  if(specialtyPriority !== null){
    // Keep rated specialty-track badges after aviation/qualification badges,
    // but order the specialty badges themselves by rating and duty family.
    return 100 + specialtyPriority;
  }
  const i = MEMBER_REPORT_IMPORT_BADGE_PRIORITY.indexOf(id);
  if(i === -1) return 9999;
  const legacySpecialtyStart = MEMBER_REPORT_IMPORT_BADGE_PRIORITY.indexOf('master_emergency_services_badge');
  return legacySpecialtyStart >= 0 && i >= legacySpecialtyStart ? 5000 + i : i;
}



function parseCapReportDate(dateText){
  const m = String(dateText || '').match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if(!m) return null;
  const months = {
    jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3,
    may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8,
    oct:9, october:9, nov:10, november:10, dec:11, december:11
  };
  const monthKey = m[2].toLowerCase();
  if(!(monthKey in months)) return null;
  const d = new Date(Number(m[3]), months[monthKey], Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// The dates of the General Information row: from the first CAPID (five to seven digits) after the heading, up to the status word or the third date.
function memberReportGeneralRowDates(t){
  const info = t.search(/General\s+Information/i);
  if(info < 0) return [];
  const row = /\b\d{5,7}\b/.exec(t.slice(info));
  if(!row) return [];
  const rest = t.slice(info + row.index + row[0].length, info + row.index + row[0].length + 220);
  const status = rest.search(/\b(?:ACTIVE|EXPIRED|SUSPENDED|TERMINATED|INACTIVE|PENDING|LAPSED|DROPPED)\b/i);
  const dates = [...(status >= 0 ? rest.slice(0, status) : rest).matchAll(new RegExp(MEMBER_REPORT_DATE, 'gi'))].slice(0, 3).map(m => parseCapReportDate(m[0]));
  return dates;
}

function extractJoinDateFromMemberReport(text){
  const t = normalizeMemberReportText(text);

  // Normal report header shape, read with the grade (getCurrentProfileFromMemberReport):
  // Gender Type Rank Date of Rank Joined Expires ...
  // MALE CADET C/Maj 18 Dec 2025 24 Sep 2020 30 Sep 2026 ...
  // It used to require a letter first in the grade, so a 1st Lt or 2d Lt had no join date and no Red Service Ribbon.
  const profile = getCurrentProfileFromMemberReport(t);
  if(profile?.joined) return profile.joined;

  // The grade row did not parse (a part of it is missing or not a word this reads): its dates are still the Date of Rank, Joined and Expires
  // after the CAPID, so the join date is read from them.
  const rowDates = memberReportGeneralRowDates(t);
  if(rowDates.length >= 2) return rowDates.length >= 3 ? rowDates[1] : (rowDates[0] && rowDates[1] && rowDates[0] > rowDates[1] ? rowDates[1] : rowDates[0]);

  // Fallbacks for copied or alternate report text.
  const explicitMatch = t.match(/\b(?:Joined|Join Date|Date Joined)\s*:?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/i);
  if(explicitMatch) return parseCapReportDate(explicitMatch[1]);

  return null;
}

function getFullYearsBetween(startDate, endDate = new Date()){
  if(!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return 0;
  let years = endDate.getFullYear() - startDate.getFullYear();
  const beforeAnniversary =
    endDate.getMonth() < startDate.getMonth() ||
    (endDate.getMonth() === startDate.getMonth() && endDate.getDate() < startDate.getDate());
  if(beforeAnniversary) years--;
  return Math.max(0, years);
}

function chooseRedServiceValueFromYears(years){
  // The picker offers 2, 5 and every five years to 65.
  if(years >= 40) return `years_${Math.min(65, Math.floor(years / 5) * 5)}`;
  if(years >= 35) return 'years_35';
  if(years >= 30) return 'years_30';
  if(years >= 25) return 'years_25';
  if(years >= 20) return 'years_20';
  if(years >= 15) return 'years_15';
  if(years >= 10) return 'years_10';
  if(years >= 5) return 'years_5';
  if(years >= 2) return 'years_2';
  return null;
}


function getReportSection(text, startLabel, endLabel){
  const source = String(text || '');
  const start = source.search(new RegExp(startLabel, 'i'));
  if(start < 0) return '';
  const rest = source.slice(start);
  const end = rest.search(new RegExp(endLabel, 'i'));
  return end >= 0 ? rest.slice(0, end) : rest;
}

function getReportSectionUntilAny(text, startLabel, endLabels=[]){
  const source = String(text || '');
  const start = source.search(new RegExp(startLabel, 'i'));
  if(start < 0) return '';
  const rest = source.slice(start);
  let bestEnd = -1;
  for(const label of endLabels){
    const idx = rest.search(new RegExp(label, 'i'));
    if(idx > 0 && (bestEnd < 0 || idx < bestEnd)) bestEnd = idx;
  }
  return bestEnd >= 0 ? rest.slice(0, bestEnd) : rest;
}


function extractEncampmentCountFromReport(text){
  const source = String(text || '');

  // Prefer the actual Encampments table only. PDF text extraction can split headings
  // across lines/pages, so the end-marker regex intentionally allows a small amount
  // of any text between words like "Orientation" and "Flights".
  const startMatch = /\bEncampments\b/i.exec(source);
  if(!startMatch) return 0;

  const rest = source.slice(startMatch.index);
  const endRe = /\b(?:In-Person[\s\S]{0,30}Required[\s\S]{0,30}Staff[\s\S]{0,30}Training|Required[\s\S]{0,30}Staff[\s\S]{0,30}Training|Orientation[\s\S]{0,30}Flights|Cadet[\s\S]{0,30}Achievements|Awards|Promotions|Decorations|Ribbons|Local[\s\S]{0,30}Activities|Professional[\s\S]{0,30}Development|Specialty[\s\S]{0,30}Tracks)\b/i;
  const afterHeading = rest.slice('Encampments'.length);
  const endMatch = endRe.exec(afterHeading);
  const section = endMatch
    ? rest.slice(0, 'Encampments'.length + endMatch.index)
    : rest;

  // Count only CAP-style dates in that section: one per encampment. The picker's options run well past
  // nine (the McChord catalog), so the count is not capped.
  const dates = section.match(/\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\b/gi) || [];
  return dates.length;
}

// "MITCHELL, GUISEPPE" -> "Mitchell", "Guiseppe": each word, and each part after a hyphen or apostrophe,
// capitalised; "MCDONALD" -> "McDonald". The nameplates and tapes uppercase the name again.
function titleCaseImportedName(raw){
  // Letters with accents are letters (CAPR 39-1 Attachment 6: a name may carry diacritical accents, PEÑA, MÜLLER).
  return String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/(^|[\s\-'’])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (m, ch) => 'Mc' + ch.toUpperCase());
}

// The member's name, in the three places a report prints it. The General Information row is authoritative: "CAPID Name Gender ..." then
// "123456 MITCHELL, GUISEPPE MALE CADET ...". The last name is everything before the comma (so "SMITH JR" and "VAN DYKE" stay whole); the first
// name is the first given name (a middle name or initial is not worn on the nameplate). A report without that row prints the name in a
// heading, with no comma: "Personnel Information For: C/Col Guiseppe Mitchell 123456" (the print of the member search today, whose first
// table is headed "General Info") or "Member Details C/Col Guiseppe Mitchell General Information". There the grade is removed, the first
// word is the first name and the last word is the last name; a suffix (Jr, Sr, II, III, IV) stays with the last name, as in the row.
function memberReportNameFromHeading(raw){
  let rest = String(raw || '').trim();
  const ranks = (typeof RANKS === 'object' ? [...(RANKS.cadet || []), ...(RANKS.senior || [])] : [])
    .sort((a, b) => b.length - a.length);
  for(const rank of ranks){
    const re = new RegExp('^' + rank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*').replace(/\//g, '/\\s*') + '\\s+', 'i');
    if(re.test(rest)){ rest = rest.replace(re, ''); break; }
  }
  const comma = rest.match(/^(\p{L}[\p{L}'’.\- ]*?)\s*,\s*(\p{L}[\p{L}'’.\-]*)/u);
  if(comma) return { firstName:titleCaseImportedName(comma[2]), lastName:titleCaseImportedName(comma[1]) };
  const words = rest.split(' ').filter(w => /^\p{L}[\p{L}'’.\-]*$/u.test(w));
  if(words.length < 2) return null;
  const suffix = words.length > 2 && /^(?:Jr|Sr|II|III|IV)\.?$/i.test(words[words.length - 1]);
  const last = titleCaseImportedName(words.slice(suffix ? -2 : -1).join(' ')).replace(/\b(?:Ii|Iii|Iv)\b/g, roman => roman.toUpperCase());
  return { firstName:titleCaseImportedName(words[0]), lastName:last };
}

function extractMemberNameFromReport(text){
  const t = normalizeMemberReportText(text);
  const row = t.match(/\b\d{5,7}\s+(\p{L}[\p{L}'’.\- ]*?)\s*,\s*(\p{L}[\p{L}'’.\-]*)(?:\s+\p{L}[\p{L}'’.\-]*)*?\s+(?:MALE|FEMALE)\b/iu);
  if(row){
    const lastName = titleCaseImportedName(row[1]);
    const firstName = titleCaseImportedName(row[2]);
    if(firstName && lastName) return { firstName, lastName };
  }
  const heading = t.match(/Personnel\s+Information\s+For\s*:?\s+([^:]{1,80}?)\s+\d{5,7}\b/i) || t.match(/Member\s+Details\s+(.+?)\s+General\s+Information/i);
  return heading ? memberReportNameFromHeading(heading[1]) : null;
}

// The General Information row: "... MALE CADET C/Col 18 Dec 2025 24 Sep 2019 30 Sep 2027 ACTIVE ...", columns
// Gender, Type, Rank, Date of Rank, Joined, Expires. The grade is any CAP grade, longest first (it used to stop
// at "C/1st", "C/2d", "C/Lt" and read "Maj Gen" as "Maj", and knew no flight officer grade). The membership is
// the grade's (a "C/" grade is a cadet's); the Type column is read only if it says CADET or SENIOR and the grade
// agrees, so a "SENIOR MEMBER" or "LIFE" type reads the same. Joined is the second date after the grade, or the
// first when the Date of Rank is blank (two dates, the first not after the second).
function getCurrentProfileFromMemberReport(text){
  const t = normalizeMemberReportText(text);
  const date = '\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4}';
  const re = new RegExp(`\\b(MALE|FEMALE)\\s+((?:[A-Z][A-Z\\-]*\\s+){1,3}?)(${importedRankPattern()})(?=$|\\s)((?:\\s+${date}){0,3})`, 'i');
  const m = t.match(re);
  if(!m) return null;
  const rank = normalizeImportedRank(m[3]);
  const type = m[2].trim().toUpperCase();
  const membership = RANKS.cadet.includes(rank) ? 'cadet'
    : RANKS.senior.includes(rank) ? 'senior'
    : /^CADET\b/.test(type) ? 'cadet' : 'senior';
  const dates = (m[4].match(new RegExp(date, 'g')) || []).map(parseCapReportDate);
  let joined = null;
  if(dates.length >= 3) joined = dates[1];
  else if(dates.length === 2) joined = dates[0] && dates[1] && dates[0] > dates[1] ? dates[1] : dates[0];
  return {
    gender: m[1].toLowerCase() === 'female' ? 'female' : 'male',
    membership,
    type,
    rank,
    joined: joined || null
  };
}

// The Cadet Training table: from its heading to the next section. The end is any of the headings that can
// follow it, so a report without an Encampments section (or one whose PDF text runs the headings together)
// does not read on into the awards.
function getCadetTrainingSection(text){
  return getReportSectionUntilAny(text, 'Cadet\\s+Training', [
    'Encampments', 'Orientation\\s+Flights', 'Cadet\\s+Achievements', 'Decorations', 'Activity\\s*\\/\\s*Service\\s+Ribbon', 'Local\\s+Activities'
  ]);
}

// The National Cadet Special Activities are the ones on National Headquarters' list (CAPUBMemberReportRules.NCSA_ACTIVITY_LIST, member-report-rules.js,
// generated from that list by scripts/generate-ncsa-activity-list.cjs): a row that names one of them, by the name the list prints or one of the
// other names it goes by, is a credit for that activity. Each entry names the activity it counts for, so the places of one activity (a student row
// and a staff row, or two flight academies) are one credit in a year.
const importedNcsaListEntry = title => (typeof window !== 'undefined' && window.CAPUBMemberReportRules?.ncsaActivityForTitle?.(title)) || null;
// A row the list does not have earns a credit only when the record itself calls it a National Cadet Special Activity.
const IMPORTED_NCSA_NAMED = /\bNCSA\b|National\s+Cadet\s+Special\s+Activit/i;

// The Cadet Training table lists what a cadet has completed: its Type, Location and Date Completed (an older print: Activity and Date Completed).
// A row of it is one National Cadet Special Activity credit, for that activity in that year, when it names an activity on the list above (or the
// record calls it a National Cadet Special Activity itself) and is not a kind of row that earns none. The kinds that earn none are checked first:
// the region and wing schools (RCLS and NCOLS, and the schools the supplements name: data/supplements.js), Required Staff Training, an
// encampment, an orientation flight, and the International Air Cadet Exchange, which has its own ribbon. A row the list does not have earns none
// and is told to the member as a row not understood.
const IMPORTED_TRAINING_NO_CREDIT = [
  ['a region or wing school', /\bRCLS\b|Region(?:al)?\s+Cadet\s+Leadership\s+School|\bNCOLS\b|Non-?\s?commissioned\s+Officer\s+Leadership\s+(?:School|Academy)|(?<![A-Za-z])NCO\s+Leadership\s+Academy|\bSNCO\s+Leadership\s+Academy|\bCCC\s+Leadership\s+Academy|Cadet\s+Command(?:er)?(?:'?s)?\s+(?:Course|Leadership\s+Academy)|Pathfinders?\s+Technical\s+School|Medical\s+Orientation\s+Training|Honor\s+Guard\s+College/i],
  ['Required Staff Training', /Required\s+Staff\s+Training|\bRST\b/i],
  ['an encampment', /Encampment/i],
  ['an orientation flight', /Orientation\s+Flights?/i],
  ['the exchange, which has its own ribbon', /\bIACE\b|International\s+Air\s+Cadet\s+Exchange/i]
];
const IMPORTED_TRAINING_DESCRIPTORS = /\b(?:Cadet|Student|Staff|Cadre|Air Staff|Graduate|Distinguished|Dist\.?|Senior|Participant)\b/gi;

// The activity a credit is of, so that a student row and a staff row, or two sessions, of one activity in one year are one credit.
function importedTrainingActivity(title){
  const entry = importedNcsaListEntry(title);
  if(entry) return entry.activity;
  const ncsa = title.search(IMPORTED_NCSA_NAMED);
  // Keyed on the text from the NCSA word on, so table headings run into the first row do not split one activity into two credits.
  return title.slice(Math.max(0, ncsa)).replace(IMPORTED_TRAINING_DESCRIPTORS, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

// The rows of the Cadet Training table as read: the words of the row, its year, whether it is a credit and why, and the activity it is a credit of.
function memberReportCadetTrainingRows(text){
  const section = getCadetTrainingSection(text).replace(/^\s*Cadet\s+Training\b(?:\s+(?:Type|Activity|Location|Description|Date(?:\s+Completed)?|Completed))*\s*/i, '');
  const re = new RegExp(MEMBER_REPORT_DATE, 'gi');
  const rows = [];
  let previousEnd = 0, m;
  while((m = re.exec(section))){
    // A page break may repeat the column headings in front of the next row, and a PDF leaves what is left of the page's print header in front of it
    // ("11 : 09 AM ? CAPID=123456": the time stamp, its colon set apart, and the end of the address).
    const title = section.slice(previousEnd, m.index).replace(/^[,\s]*\d{1,2}\s*:\s*\d{2}\s*[AP]\.?M\.?(?=\s|$)/i, '').replace(/^\s*\??\s*CAPID\s*=\s*\d+/i, '')
      .replace(/^\s*(?:(?:Type|Activity|Location|Description)\s+)*Date\s+Completed\b/i, '').replace(/\s+/g, ' ').trim();
    previousEnd = m.index + m[0].length;
    if(!/[A-Za-z]{2}/.test(title)) continue;
    const year = /\d{4}$/.exec(m[0])[0];
    const none = IMPORTED_TRAINING_NO_CREDIT.find(([, kind]) => kind.test(title));
    const date = m[0];
    if(none) rows.push({ title, year, date, credit:false, why:`${none[0]}: no credit` });
    else if(importedNcsaListEntry(title)) rows.push({ title, year, date, credit:true, activity:importedTrainingActivity(title), why:'an activity on the list of National Cadet Special Activities' });
    else if(IMPORTED_NCSA_NAMED.test(title)) rows.push({ title, year, date, credit:true, activity:importedTrainingActivity(title), why:'the record calls it a National Cadet Special Activity' });
    else rows.push({ title, year, date, credit:false, unlisted:true, why:'not on the list of National Cadet Special Activities: no credit' });
  }
  return rows;
}

function extractCadetSpecialActivityCountFromReport(text){
  return new Set(memberReportCadetTrainingRows(text).filter(row => row.credit).map(row => `${row.activity}:${row.year}`)).size;
}

// The highest CAC echelon among the PAST duty positions: the council named in the title ("Cadet WCAC Representative", "Region CAC Chair",
// "National Cadet Advisory Council ...") or the row's Echelon column after a CAC title. CAPR 39-3 21j: wing bronze star, region silver, national
// gold. The ribbon and its star are for a term that has been served, so a position held now (the current table) is not read here: it gives the
// shoulder cord and never the ribbon's star. (js/patches.js re-derives the ribbon from the same past rows, and the current table's rows whose End
// Date has passed.)
function importedCacLevelFromDutyPositions(text){
  const duty = getReportSectionUntilAny(text, 'Past\\s+Duty\\s+Positions', [
    'Professional Development', 'Specialty Tracks', 'Cadet Training', 'Encampments', 'Cadet Achievements', 'Decorations', 'Transfer History',
    'Current\\s+Duty\\s+Positions', 'Cadet\\s+Duty\\s+Positions', 'Current\\s+Committees'
  ]);
  if(!duty) return null;
  const levels = [];
  const named = /\b(?:(N|R|W|G)CAC\b|(National|Region|Wing|Group)\s+(?:CAC\b|Cadet\s+Advisory\s+Council))/gi;
  let m;
  while((m = named.exec(duty))){
    const key = (m[1] || m[2]).charAt(0).toUpperCase();
    levels.push({ N:'national', R:'region', W:'wing', G:'group' }[key]);
  }
  const echelon = /(?:\bCAC\b|Cadet\s+Advisory\s+Council)[^\d]{0,80}?\b(NATIONAL|REGION|WING|GROUP)\b/g;
  while((m = echelon.exec(duty))) levels.push(m[1].toLowerCase());
  const order = ['national', 'region', 'wing', 'group'];
  return order.find(level => levels.includes(level)) || null;
}

// A senior member wears one cadet program award ribbon, the highest earned (js/catalog.js
// SENIOR_HIGHEST_CADET_AWARD_RIBBONS), but may wear every cadet milestone medal earned as a miniature medal on the mess dress and the
// corporate semi-formal (CAPR 39-1 11.1.4, js/galleries.js enforceSeniorSingleCadetAwardRibbon). So when the report shows milestones
// (Wright Brothers, Mitchell, Earhart, Eaker, Spaatz) they are all kept, each as the report gives it (the Cadet Officer School star stays
// on the Mitchell; the rack moves it onto the highest ribbon, CAPR 39-3 14j, js/uniform-view.js buildRibbons); the eight achievement
// ribbons stay out, since a milestone outranks them. A report with achievements only keeps the highest.
function keepOnlyHighestCadetMilestoneForSenior(ribbons, membership, text='', notes=null){
  if(membership !== 'senior') return ribbons;
  const cadetAwards = typeof SENIOR_HIGHEST_CADET_AWARD_RIBBONS !== 'undefined' ? SENIOR_HIGHEST_CADET_AWARD_RIBBONS
    : new Set(['wright_brothers_award','mitchell_award','earhart_award','eaker_award','spaatz_award']);
  const milestoneIds = typeof CADET_MILESTONES !== 'undefined' ? CADET_MILESTONES
    : new Set(['wright_brothers_award','mitchell_award','earhart_award','eaker_award','spaatz_award']);
  const held = ribbons.filter(r => cadetAwards.has(r?.id));
  if(held.length === 0) return ribbons;
  const milestones = held.filter(r => milestoneIds.has(r.id));
  const keep = new Set(milestones.length ? milestones : [held.slice().sort((a, b) => precedence(a.id) - precedence(b.id))[0]]);
  const left = held.filter(r => !keep.has(r));
  if(left.length && Array.isArray(notes)){
    notes.push(`${left.length === 1 ? '1 cadet award ribbon is' : `${left.length} cadet award ribbons are`} left off: a senior member wears one cadet award ribbon, the highest, and may wear every milestone medal earned as a miniature (CAPR 39-1, 11.1.4).`);
  }
  const cos = milestones.length && (ribbons.some(r => r?.id === 'mitchell_award' && r.value === 'earned_cos_star') || (text && hasCosGraduateCreditFromReport(text) && held.some(r => r.id === 'mitchell_award')));
  return ribbons.filter(r => !cadetAwards.has(r?.id) || keep.has(r)).map(r => cos && r.id === 'mitchell_award' && keep.has(r) && r.value !== 'earned_cos_star'
    ? { ...r, value:'earned_cos_star', reason:`${r.reason || r.id} + COS graduate star` } : r);
}

// The highest of Achievements 1-8 the Cadet Achievements table shows, and the honor credits. A row is read by
// the achievement or milestone it names when it names one ("Achievement 4 - Wright Brothers" is the Wright
// Brothers milestone, after Achievement 3, not Achievement 4), else by its number; a row that names an
// achievement without a number ("Gen J.F. Curry Achievement 12 Jan 2020") counts too. Achievements are earned
// in order, so the highest one awards the ribbons below it; the Wright Brothers Award follows Achievement 3 and
// the Mitchell Award (and every milestone after it) Achievement 8.
const IMPORTED_ACHIEVEMENT_NAMES = [null, /\bCurry\b/i, /\bArnold\b/i, /\bFeik\b/i, /\bRickenbacker\b/i, /\bLindbergh\b/i, /\bDoolittle\b/i, /\bGoddard\b/i, /\bArmstrong\b/i];
const IMPORTED_MILESTONE_AFTER_ACHIEVEMENT = [[/Wright\s+Brothers/i, 3], [/\bMitchell\b/i, 8], [/\bEarhart\b/i, 8], [/\bEaker\b/i, 8], [/\bSpaatz\b/i, 8]];
function readCadetAchievementRows(section){
  const source = String(section || '');
  const named = row => {
    const index = IMPORTED_ACHIEVEMENT_NAMES.findIndex(re => re && re.test(row));
    if(index > 0) return { index, milestone:false };
    const milestone = IMPORTED_MILESTONE_AFTER_ACHIEVEMENT.find(([re]) => re.test(row));
    return milestone ? { index:milestone[1], milestone:true } : null;
  };
  const rows = [];
  const numbered = '(?!\\s+[A-Za-z]{3,9}\\s+\\d{4})'; // "Achievement 12 Jan 2020" is a date, not Achievement 12
  const rowRe = new RegExp(`Achievement\\s+(\\d+)\\b${numbered}([\\s\\S]*?)(?=Achievement\\s+\\d+\\b${numbered}|$)`, 'gi');
  let m;
  while((m = rowRe.exec(source))){
    const known = named(m[2]);
    const honor = /Honor\s+Credit|With\s+Honou?rs?|Honou?rs?\s+Credit/i.test(m[2]);
    rows.push(known ? { ...known, honor } : { index:Math.min(Number(m[1]), 8), milestone:Number(m[1]) > 8, honor });
  }
  // Names without an "Achievement N" row.
  const bare = source.replace(new RegExp(`Achievement\\s+\\d+\\b${numbered}[^\\d]*`, 'gi'), ' ');
  // A bare row's honor credit is printed on the row, before or just after its date.
  const honorOnRow = at => /^[^\d]{0,80}?\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:\s+\d{1,3}%?)?\s+(?:Honor\s+Credit|With\s+Honou?rs?|Honou?rs?\s+Credit)|^[^\d]{0,60}?(?:Honor\s+Credit|With\s+Honou?rs?)/i.test(bare.slice(at));
  IMPORTED_ACHIEVEMENT_NAMES.forEach((re, index) => {
    const m = re && re.exec(bare);
    if(m) rows.push({ index, milestone:false, honor:honorOnRow(m.index + m[0].length) });
  });
  IMPORTED_MILESTONE_AFTER_ACHIEVEMENT.forEach(([re, index]) => { if(re.test(bare)) rows.push({ index, milestone:true, honor:false }); });
  return rows;
}

function hasCosGraduateCreditFromReport(text){
  const cadetTraining = getCadetTrainingSection(text);
  const activityLines = cadetTraining || String(text || '');
  return /\bCOS\b|Cadet\s+Officers?\s+School/i.test(activityLines);
}

function applyCosStarToHighestCadetMilestone(ribbons, text){
  if(!hasCosGraduateCreditFromReport(text)) return ribbons;

  // COS credit belongs on the Mitchell ribbon itself, even when the cadet has
  // subsequently earned a higher milestone award.
  return ribbons.map(r => r?.id === 'mitchell_award'
    ? { ...r, value:'earned_cos_star', reason:`${r.reason || 'Mitchell Award'} + COS graduate star` }
    : r
  );
}

// Whether a qualification the pattern names is on record other than in training. Each row is read on its own:
// from the previous row's date to the qualification's own date. The window used to be 80 characters before and
// 220 after the first mention, so on the one-line text every report becomes, a "Cadet Training" or "Required
// Staff Training" heading or a neighbouring row's TRAINING status nearby hid a qualified GTM3 or GTL; and only
// the first mention was read.
// A row that names a badge or a qualification without being it: a course, a class, a workshop, an academy, a camp, an exam; or a status that
// says the member is in training or never held it. (EXPIRED is not here: the Ground Team, Incident Commander and EMT badges are for current
// or previous holders, CAPR 39-1 10.4.5 to 10.4.7.)
const MEMBER_REPORT_NOT_HELD = /\b(?:Course|Class|Workshop|Academy|Seminar|Camp|Exam|Refresher|Briefing|Clinic|Symposium|School|TRAIN(?:ING|EE)|NOT\s+QUALIFIED|UNQUALIFIED|DISQUALIFIED|NOT\s+ELIGIBLE|DENIED|DECLINED|FAILED|INCOMPLETE|PENDING|IN\s+PROGRESS)\b/i;
// Whether the report names the badge in a row that is the badge: a match whose row (up to the next date) is no course and no status of never held.
function memberReportNamesBadge(text, pattern){
  const source = String(text || '');
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let m;
  while((m = re.exec(source))){
    if(m[0].length === 0){ re.lastIndex++; continue; }
    const after = source.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const date = after.search(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/);
    if(!MEMBER_REPORT_NOT_HELD.test(date >= 0 ? after.slice(0, date) : after.slice(0, 40))) return true;
  }
  return false;
}

// The status of a qualification row that says the member never held it (not qualified, denied, failed, pending), as a sentence; '' when no row does.
function memberReportNeverHeldNote(text, labelPattern, name){
  const source = String(text || '');
  const re = new RegExp(labelPattern, 'gi');
  let m;
  while((m = re.exec(source))){
    if(m[0].length === 0){ re.lastIndex++; continue; }
    const after = source.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const date = after.search(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/);
    const status = /\b(?:NOT\s+QUALIFIED|UNQUALIFIED|DISQUALIFIED|NOT\s+ELIGIBLE|DENIED|DECLINED|FAILED|INCOMPLETE|PENDING|IN\s+PROGRESS)\b/i.exec(date >= 0 ? after.slice(0, date) : after.slice(0, 40));
    if(status) return `${name} is listed as ${status[0].toLowerCase().replace(/\s+/g, ' ')}, so no badge was imported.`;
  }
  return '';
}

function hasNonTrainingQualification(text, labelPattern){
  const source = String(text || '');
  const re = new RegExp(labelPattern, 'gi');
  const dateRe = /\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g;
  let m;
  while((m = re.exec(source))){
    if(m[0].length === 0){ re.lastIndex++; continue; }
    const from = Math.max(0, m.index - 60);
    const lastDate = [...source.slice(from, m.index).matchAll(dateRe)].pop();
    const start = lastDate ? from + lastDate.index + lastDate[0].length : from;
    const afterLabel = m.index + m[0].length;
    const ownDate = /\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/.exec(source.slice(afterLabel, afterLabel + 120));
    const end = ownDate ? afterLabel + ownDate.index + ownDate[0].length : Math.min(source.length, afterLabel + 60);
    if(!MEMBER_REPORT_NOT_HELD.test(source.slice(start, end))) return true;
  }
  return false;
}

function extractAwardCountFromAwardsTable(text, awardPattern){
  const awards = getReportSection(text, 'Awards', 'Promotions');
  const decs = getReportSection(text, 'Decorations', 'Local Activities');
  const scope = `${awards} ${decs}`;
  const re = new RegExp(awardPattern, 'gi');
  const m = scope.match(re);
  return m ? m.length : 0;
}




const CAPUB_SPECIALTY_TRACK_TO_BADGE = {
  "ADMINISTRATION": {
    TECHNICIAN: "administration_technician_badge",
    SENIOR: "administration_senior_badge",
    MASTER: "administration_master_badge"
  },
  "AEROSPACE": {
    TECHNICIAN: "aerospace_education_technician_badge",
    SENIOR: "aerospace_education_senior_badge",
    MASTER: "aerospace_education_master_badge"
  },
  "AEROSPACE EDUCATION": {
    TECHNICIAN: "aerospace_education_technician_badge",
    SENIOR: "aerospace_education_senior_badge",
    MASTER: "aerospace_education_master_badge"
  },
  "CADET PROGRAMS": {
    TECHNICIAN: "cadet_programs_technician_badge",
    SENIOR: "cadet_programs_senior_badge",
    MASTER: "cadet_programs_master_badge"
  },
  "COMMUNICATIONS": {
    TECHNICIAN: "communications_technician_badge",
    SENIOR: "communications_senior_badge",
    MASTER: "communications_master_badge"
  },
  "EMERGENCY SERVICES": {
    TECHNICIAN: "emergency_services_badge",
    SENIOR: "senior_emergency_services_badge",
    MASTER: "master_emergency_services_badge"
  },
  "FINANCE": {
    TECHNICIAN: "finance_technician_badge",
    SENIOR: "finance_senior_badge",
    MASTER: "finance_master_badge"
  },
  "HISTORIAN": {
    TECHNICIAN: "historian_technicianIbadge",
    SENIOR: "historian_senior_badge",
    MASTER: "historian_master_badge"
  },
  "INFORMATION TECHNOLOGY": {
    TECHNICIAN: "information_technology_technician_badge",
    SENIOR: "information_technology_senior_badge",
    MASTER: "information_technology_master_badge"
  },
  "IT": {
    TECHNICIAN: "information_technology_technician_badge",
    SENIOR: "information_technology_senior_badge",
    MASTER: "information_technology_master_badge"
  },
  "LOGISTICS": {
    TECHNICIAN: "logistics_technician_badge",
    SENIOR: "logistics_senior_badge",
    MASTER: "logistics_master_badge"
  },
  "OPERATIONS": {
    TECHNICIAN: "operations_technician_badge",
    SENIOR: "operations_senior_badge",
    MASTER: "operations_master_badge"
  },
  "PERSONNEL": {
    TECHNICIAN: "personnel_technician_badge",
    SENIOR: "personnel_senior_badge",
    MASTER: "personnel_master_badge"
  },
  "PROFESSIONAL DEVELOPMENT": {
    TECHNICIAN: "professional_development_technician_badge",
    SENIOR: "professional_development_senior_badge",
    MASTER: "professional_development_master_badge"
  },
  "PUBLIC AFFAIRS": {
    TECHNICIAN: "public_affairs_technician_badge",
    SENIOR: "public_affairs_senior_badge",
    MASTER: "public_affairs_master_badge"
  },
  "RECRUITING AND RETENTION OFFICER": {
    TECHNICIAN: "recruiting_retention_technician_badge",
    SENIOR: "recruiting_retention_senior_badge",
    MASTER: "recruiting_retention_master_badge"
  },
  "RECRUITING AND RETENTION": {
    TECHNICIAN: "recruiting_retention_technician_badge",
    SENIOR: "recruiting_retention_senior_badge",
    MASTER: "recruiting_retention_master_badge"
  },
  "SAFETY": {
    TECHNICIAN: "safety_technician_badge",
    SENIOR: "safety_senior_badge",
    MASTER: "safety_master_badge"
  },
  "INSPECTOR GENERAL": {
    TECHNICIAN: "inspector_general_technician_badge",
    SENIOR: "inspector_general_senior_badge",
    MASTER: "inspector_general_master_badge"
  },
  "DRUG DEMAND REDUCTION": {
    TECHNICIAN: "drug_demand_reduction_technician_badge",
    SENIOR: "drug_demand_reduction_senior_badge",
    MASTER: "drug_demand_reduction_master_badge"
  },
  "DDR": {
    TECHNICIAN: "drug_demand_reduction_technician_badge",
    SENIOR: "drug_demand_reduction_senior_badge",
    MASTER: "drug_demand_reduction_master_badge"
  },
  "STANDARDIZATION AND EVALUATION": {
    TECHNICIAN: "stan_eval_tech_badge",
    SENIOR: "stan_eval_senior_badge",
    MASTER: "stan_eval_master_badge"
  },
  "STANDARDIZATION EVALUATION": {
    TECHNICIAN: "stan_eval_tech_badge",
    SENIOR: "stan_eval_senior_badge",
    MASTER: "stan_eval_master_badge"
  },
  "STAN EVAL": {
    TECHNICIAN: "stan_eval_tech_badge",
    SENIOR: "stan_eval_senior_badge",
    MASTER: "stan_eval_master_badge"
  },
  "CDI": {
    TECHNICIAN: "cdi_technician_badge",
    SENIOR: "cdi_senior_badge",
    MASTER: "cdi_master_badge"
  },
  "CHARACTER DEVELOPMENT INSTRUCTOR": {
    TECHNICIAN: "cdi_technician_badge",
    SENIOR: "cdi_senior_badge",
    MASTER: "cdi_master_badge"
  }
};

// Automatic member-report specialty-badge preference:
//   1. Highest rating first: Master, Senior, Technician.
//   2. At the same rating: operations, CP/AE, then personnel/support.
// The order inside each family makes otherwise equal selections deterministic.
const CAPUB_SPECIALTY_TRACK_FAMILY_ORDER = {
  operations: [
    'OPERATIONS','EMERGENCY SERVICES','COMMUNICATIONS','INFORMATION TECHNOLOGY','IT',
    'LOGISTICS','SAFETY','STANDARDIZATION AND EVALUATION','STANDARDIZATION EVALUATION','STAN EVAL'
  ],
  cadetProgramsAerospace: ['CADET PROGRAMS','AEROSPACE EDUCATION','AEROSPACE'],
  personnel: [
    'PERSONNEL','ADMINISTRATION','FINANCE','RECRUITING AND RETENTION OFFICER',
    'RECRUITING AND RETENTION','PROFESSIONAL DEVELOPMENT','PUBLIC AFFAIRS','HISTORIAN',
    'INSPECTOR GENERAL','DRUG DEMAND REDUCTION','DDR','CDI','CHARACTER DEVELOPMENT INSTRUCTOR'
  ]
};

const CAPUB_SPECIALTY_BADGE_IMPORT_PRIORITY = (() => {
  const result = new Map();
  // Governance/service precedence: Command Council and Senior Advisory Group
  // outrank National Staff; National Staff outranks every rated specialty.
  result.set('command_council_badge', -300);
  result.set('senior_advisory_group_badge', -300);
  result.set('national_staff_badge', -200);
  const ratingOrder = { MASTER:0, SENIOR:1, TECHNICIAN:2 };
  const families = [
    CAPUB_SPECIALTY_TRACK_FAMILY_ORDER.operations,
    CAPUB_SPECIALTY_TRACK_FAMILY_ORDER.cadetProgramsAerospace,
    CAPUB_SPECIALTY_TRACK_FAMILY_ORDER.personnel
  ];

  families.forEach((tracks, familyIndex) => {
    tracks.forEach((track, trackIndex) => {
      const levels = CAPUB_SPECIALTY_TRACK_TO_BADGE[track] || {};
      Object.entries(levels).forEach(([level, badgeId]) => {
        if(!badgeId || ratingOrder[level] === undefined) return;
        const priority = ratingOrder[level] * 100 + familyIndex * 30 + trackIndex;
        const previous = result.get(badgeId);
        if(previous === undefined || priority < previous) result.set(badgeId, priority);
      });
    });
  });
  return result;
})();

function getImportedSpecialtyBadgePriority(id){
  return CAPUB_SPECIALTY_BADGE_IMPORT_PRIORITY.has(id)
    ? CAPUB_SPECIALTY_BADGE_IMPORT_PRIORITY.get(id)
    : null;
}

function getHighestImportedSpecialtyBadgeIds(ids, limit = 2){
  return [...new Set((ids || []).filter(id => getImportedSpecialtyBadgePriority(id) !== null))]
    .sort((a, b) => getImportedSpecialtyBadgePriority(a) - getImportedSpecialtyBadgePriority(b))
    .slice(0, Math.max(0, Number(limit) || 0));
}

function normalizeSpecialtyTrackName(name){
  return String(name || '')
    .toUpperCase()
    // "STANDARDIZATION/EVALUATION", "STAN/EVAL" (the catalog's own spelling) read as the spaced name.
    .replace(/\s*\/\s*/g, ' ')
    .replace(/&/g, ' AND ')
    .replace(/\bR\s*&\s*R\b/g, 'RECRUITING AND RETENTION')
    .replace(/RECRUITING\s+&\s+RETENTION/g, 'RECRUITING AND RETENTION')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpecialtyTrackLevel(level){
  return String(level || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function getMemberReportSpecialtyTracksSection(text){
  return getReportSectionUntilAny(text, 'Specialty Tracks', [
    'Encampments', 'Cadet Training', 'Awards', 'Promotions', 'Decorations',
    'Current Duty Positions', 'Past Duty Positions', 'Professional Development',
    'Local Activities', 'Transfer History', 'Cadet Achievements'
  ]);
}

// The specialty a track row names. The first row of the table is read with the section and column headings
// run into it ("SPECIALTY TRACKS SPECIALTY TRACK RATING DATE CADET PROGRAMS"), which matched no specialty, so
// the member's first rated specialty was dropped and never offered (LIVE12 E47). The row's name is the longest
// known specialty it ends with; a trailing "Officer", "Specialty" or "Track" is ignored.
const CAPUB_SPECIALTY_TRACK_NAMES_LONGEST_FIRST = Object.keys(CAPUB_SPECIALTY_TRACK_TO_BADGE).sort((a, b) => b.length - a.length);
function resolveSpecialtyTrackName(name){
  let n = normalizeSpecialtyTrackName(name);
  while(/\s(?:OFFICER|SPECIALTY|TRACKS?|RATING)$/.test(n)) n = n.replace(/\s(?:OFFICER|SPECIALTY|TRACKS?|RATING)$/, '');
  const known = CAPUB_SPECIALTY_TRACK_NAMES_LONGEST_FIRST.find(key => n === key || n.endsWith(' ' + key));
  return known || n;
}

function parseMemberReportSpecialtyTracks(text){
  const tracksSection = getMemberReportSpecialtyTracksSection(text);
  if(!tracksSection) return [];

  const rows = [];
  const rowRe = /([A-Z][A-Z\s\/,\.\-&]{1,90}?)\s+(TECHNICIAN|SENIOR|MASTER|NONE)(?:\s+RATING)?\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/gi;
  let m;
  while((m = rowRe.exec(tracksSection))){
    let name = normalizeSpecialtyTrackName(m[1])
      .replace(/\bSPECIALTY TRACK\b|\bLEVEL\b|\bCOMPLETED\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    name = resolveSpecialtyTrackName(name);
    const level = normalizeSpecialtyTrackLevel(m[2]);
    const completed = m[3];
    if(!name) continue;

    // This is the authoritative row, including explicit NONE values.
    rows.push({ name, level, completed, eligible: level !== 'NONE' });
  }
  return rows;
}


function badgeIdForSpecialtyTrack(row, family){
  if(!row || !row.eligible) return null;
  const level = normalizeSpecialtyTrackLevel(row.level);
  if(family === 'communications') return CAPUB_SPECIALTY_TRACK_TO_BADGE.COMMUNICATIONS?.[level] || null;
  if(family === 'emergencyServices') return CAPUB_SPECIALTY_TRACK_TO_BADGE['EMERGENCY SERVICES']?.[level] || null;

  const key = normalizeSpecialtyTrackName(row.name);
  return CAPUB_SPECIALTY_TRACK_TO_BADGE[key]?.[level] || null;
}

function getSpecialtyBadgesFromTracks(text){
  const rows = parseMemberReportSpecialtyTracks(text);
  const out = [];
  const notes = [];

  for(const row of rows){
    const key = normalizeSpecialtyTrackName(row.name);
    if(row.level === 'NONE'){
      notes.push(`${key} is rated NONE, so it earns no specialty badge.`);
      continue;
    }

    const badgeId = badgeIdForSpecialtyTrack(row);
    if(!badgeId){
      notes.push(`${key} ${row.level} is in Specialty Tracks, but the builder has no badge for that specialty.`);
      continue;
    }

    out.push({
      id: badgeId,
      specialty: key,
      level: row.level,
      completed: row.completed
    });
  }

  return { badges: out, notes };
}


function getCommandServiceRibbonValueForCommanderEchelon(echelon){
  switch(String(echelon || '').toUpperCase()){
    case 'NATIONAL': return 'national_two_gold_stars';
    case 'REGION': return 'region_gold_star';
    case 'WING': return 'wing_silver_star';
    case 'GROUP': return 'group_bronze_star';
    case 'UNIT':
    default: return 'earned';
  }
}

function showCommandInsigniaRankWarning(){
  capubNotify('The command insignia pin is worn in the grade of lieutenant colonel and below (CAPR 39-1, 10.2.5).', 4500);
}

function canSelectCommandInsigniaForCurrentRank(showWarning=false){
  const ok = isCommandInsigniaGradeEligible(State.rank);
  if(!ok && showWarning) showCommandInsigniaRankWarning();
  return ok;
}

function getCommandServiceRibbonLabelForValue(value){
  const option = getRibbonSelectionOption(COMMAND_SERVICE_RIBBON_ID, value || 'earned');
  return option?.label || 'Command Service Ribbon';
}


function getCommandServiceRibbonFromDutyAssignments(text){
  const rows = extractCommandServiceCommanderAssignments(text)
    .filter(row => row.days >= 365);
  if(!rows.length) return null;

  const priority = { UNIT:1, GROUP:2, WING:3, REGION:4, NATIONAL:5 };
  rows.sort((a,b) => (priority[b.echelon] || 0) - (priority[a.echelon] || 0));
  const best = rows[0];
  const value = getCommandServiceRibbonValueForCommanderEchelon(best.echelon);
  return {
    id:COMMAND_SERVICE_RIBBON_ID,
    value,
    reason:`Commander duty of at least 365 days at the ${best.echelon.toLowerCase()} level`
  };
}

// The pin a current commander wears is the one "appropriate to their current assignment" (CAPR 39-1, 10.2.5): the group pin for a commander
// of a group, the squadron pin for any other unit. Only one pin is worn, so a member who commands both wears the group's. A graduated
// commander's pin is not named by the regulation, and stays the squadron's.
function getImportedCommandPinId(text, status){
  if(status === 'current'){
    const rows = typeof capubExtractCommanderDutyWindows === 'function' && typeof capubCurrentDutySection === 'function'
      ? capubExtractCommanderDutyWindows(capubCurrentDutySection(text)).filter(row => !row.end || row.end > new Date()) : [];
    if(rows.some(row => row.echelon === 'GROUP')) return 'group_commander_badge';
  }
  return 'squadron_commander_badge';
}

function getCommandInsigniaStatusForMember(text, result){
  const currentCommander = hasCurrentCommanderDutyPosition(text);
  const graduatedCommander = hasGraduatedCommanderDutyPosition(text);

  if(!currentCommander && !graduatedCommander) return null;

  if(!isCommandInsigniaGradeEligible(result?.rank)){
    if(Array.isArray(result?.notes)){
      const status = currentCommander ? 'Current Commander duty' : 'Past Commander duty';
      result.notes.push(`${status} found, but the command insignia pin is worn in the grade of lieutenant colonel and below, so it was not chosen (CAPR 39-1, 10.2.5).`);
    }
    return null;
  }

  // Current command takes precedence over graduated/past command for pin placement.
  return currentCommander ? 'current' : 'graduated';
}



// The current duty table only. The cadet table used to be read up to Professional Development, which takes in
// the Cadet Past Duty Positions table after it, so a past First Sergeant tour set the diamond.
const MEMBER_REPORT_AFTER_CURRENT_DUTY = ['Cadet\\s+Past\\s+Duty\\s+Positions', 'Past\\s+Duty\\s+Positions', 'Current\\s+Committees',
  'Professional\\s+Development', 'Specialty\\s+Tracks', 'Cadet\\s+Training', 'Encampments', 'Cadet\\s+Achievements', 'Awards'];
function hasCurrentFirstSergeantDutyPosition(text){
  const sections = [
    getReportSectionUntilAny(text, 'Cadet\\s+Duty\\s+Positions', MEMBER_REPORT_AFTER_CURRENT_DUTY),
    getReportSectionUntilAny(text, 'Current\\s+Duty\\s+Positions', MEMBER_REPORT_AFTER_CURRENT_DUTY)
  ];

  const current = sections
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

  if(!current) return false;

  // Exact current-duty match only. This intentionally does NOT match
  // "Cadet Flight Sergeant", "Safety NCO", or other cadet NCO duty titles.
  // A row with an End Date that has passed is a past tour, whichever table prints it.
  const firstSergeantRowRe = new RegExp(`\\b(?:Cadet\\s+)?(?:First|1st)\\s+(?:Sergeant|Sgt)\\b(?:\\s+\\S+\\s+(?:UNIT|GROUP|WING|REGION|NATIONAL)\\s+(?:Yes|No)\\s+(${MEMBER_REPORT_DATE})(?:\\s+(${MEMBER_REPORT_DATE}))?)?`, 'gi');
  let m, found = false;
  while((m = firstSergeantRowRe.exec(current))){
    const end = m[2] ? parseCapReportDate(m[2]) : null;
    if(!end || end > new Date()) found = true;
  }
  return found;
}

// The report less its heading and General Information row, for the awards named by a person ("Wilson", "Davis",
// "Yeager", "Garber", "Loening", "Crossfield"): a member whose own name is one of them was given that award.
function memberReportTextWithoutMemberRow(text){
  const source = String(text || '');
  const info = source.search(/General\s+Information/i);
  if(info < 0) return source;
  const rest = source.slice(info);
  const next = rest.search(/\b(?:Cadet\s+Duty\s+Positions|Current\s+Duty\s+Positions|Duty\s+Positions|Professional\s+Development|Specialty\s+Tracks|Cadet\s+Training|Encampments|Cadet\s+Achievements|Awards|Decorations)\b/i);
  return next > 0 ? rest.slice(next) : '';
}

// The rows of one award: each printed line names the award once, so the count is the number of times its name
// appears. `skipAfter` names the words that, just before the name, make it another award ("Aerospace Education
// Achievement Award" is the Yeager award, not a CAP Achievement Award; "National Commander's Unit Citation" is
// not the Unit Citation).
function countMemberReportAwardRows(text, pattern, skipAfter=null){
  const source = String(text || '');
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  let count = 0, m;
  while((m = re.exec(source))){
    if(m[0].length === 0){ re.lastIndex++; continue; }
    if(skipAfter && skipAfter.test(source.slice(Math.max(0, m.index - 40), m.index))) continue;
    count++;
  }
  return count;
}

// Whether any row of an award says it was earned as aircrew (the propeller, CAPR 39-3 21c and 21d): the row is read
// from the award's name up to its date.
function memberReportAwardRowSays(text, pattern, says){
  const source = String(text || '');
  const re = new RegExp(`(?:${pattern.source})([\\s\\S]{0,60}?)(?=\\b\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4}\\b|$)`, 'gi');
  let m;
  while((m = re.exec(source))){
    if(says.test(m[m.length - 1] || '') || says.test(m[0])) return true;
    if(m[0].length === 0) re.lastIndex++;
  }
  return false;
}

// Count ribbons the report lists one row per award, the award with its CAPR 39-3 devices: a bronze clasp for each
// later award (6b), the Medals of Valor included. Ribbons earned once (`once`) carry no clasp.
// `aircrew` adds the propeller when a row says aircrew or propeller.
// The ribbons earned for a number of sorties or recruits. A row of the report may stand for one award or for one sortie or recruit, and CAPR
// 39-3 (21e, 21k, 21l) does not say; the build counts a repeated row as it always did, and the report says it is not sure.
const MEMBER_REPORT_ROW_MEANING_UNSURE = new Set(['cap_counterdrug_ribbon', 'homeland_security_ribbon', 'air_search_and_rescue_ribbon']);
const memberReportRepeatedRowNote = (name, rows) => `The report lists the ${name} ${rows} times and does not say what a repeated row stands for: check its device under Ribbons.`;
const MEMBER_REPORT_COUNTED_AWARDS = [
  { id:'silver_medal_of_valor', name:'Silver Medal of Valor', re:/\bSilver\s+Medal\s+of\s+Valor\b/i },
  { id:'bronze_medal_of_valor', name:'Bronze Medal of Valor', re:/\bBronze\s+Medal\s+of\s+Valor\b/i },
  { id:'distinguished_service_award', name:'Distinguished Service Award', re:/\bDistinguished\s+Service\s+Award\b/i },
  { id:'national_commander_unit_citation_award', name:"National Commander's Unit Citation Award", re:/\bNational\s+Commander[’'‘`´]?s?[’']?\s+Unit\s+Citation\b/i },
  { id:'unit_citation_award', name:'Unit Citation Award', re:/\bUnit\s+Citation\b/i, skipAfter:/Commander[’'‘`´]?s?[’']?\s+$/i },
  { id:'national_commanders_citation', name:"National Commander's Citation", re:/\bNational\s+Commander[’'‘`´]?s?[’']?\s+Citation\b/i, once:true },
  { id:'air_force_aerial_achievement_medal', name:'Air Force Aerial Achievement Medal', re:/\bAerial\s+Achievement\s+Medal\b/i },
  { id:'air_search_and_rescue_ribbon', name:'Air Search and Rescue Ribbon', re:/\b(?:Air\s+)?Search\s+and\s+Rescue\s+Ribbon\b/i, aircrew:true },
  { id:'cap_counterdrug_ribbon', name:'Counterdrug Ribbon', re:/\bCounter[\s-]?drug\s+Ribbon\b/i },
  { id:'homeland_security_ribbon', name:'Homeland Security Ribbon', re:/\bHomeland\s+Security\s+Ribbon\b/i },
  // The CAP Member Search Report prints "Crisis Service Award": a row for each service period, the later ones a bronze clasp (ICL 21-03, 2).
  { id:'crisis_ribbon', name:'Crisis Service Ribbon', re:/\bCrisis\s+Service\s+(?:Award|Ribbon)\b|\bCrisis\s+Ribbon\b/i },
  { id:'cap_cadet_orientation_pilot_ribbon', name:'Cadet Orientation Pilot Ribbon', re:/\b(?:Cadet\s+)?Orientation\s+Pilot\s+Ribbon\b/i },
  { id:'national_cadet_competition_ribbon', name:'National Cadet Competition Ribbon', re:/\bNational\s+Cadet\s+Competition\s+Ribbon\b/i, once:true,
    note:'National Cadet Competition Ribbon: the report does not say whether the team won its region (bronze star) or the national sweepstakes (silver star), so no star is added; add it under Ribbons if it applies.' },
  { id:'national_color_guard_competition_ribbon', name:'National Color Guard Competition Ribbon', re:/\bNational\s+Color\s+Guard\s+Competition\s+Ribbon\b/i, once:true,
    note:'National Color Guard Competition Ribbon: the report does not say whether the team won its region (bronze star) or the national sweepstakes (silver star), so no star is added; add it under Ribbons if it applies.' },
  { id:'afa_award', name:'AFA Award to Unit Cadet of the Year', re:/\bAFA\s+Award\b|\bAir\s+Force\s+Association\s+Award\b/i, once:true },
  { id:'afsa_award', name:'AFSA Award to Unit Cadet NCO of the Year', re:/\bAFSA\s+Award\b|\bAir\s+Force\s+Sergeants\s+Association\s+Award\b/i, once:true },
  { id:'vfw_officer_award', name:'VFW Outstanding Cadet Officer of the Year Award', re:/\bVFW\b[^\d]{0,40}?\bCadet\s+Officer\b/i, once:true },
  { id:'vfw_nco_award', name:'VFW Outstanding Cadet NCO of the Year Award', re:/\bVFW\b[^\d]{0,40}?\bCadet\s+NCO\b/i, once:true },
  { id:'cap_a_scott_crossfield_ribbon', name:'A. Scott Crossfield Award', re:/\bScott\s+Crossfield\b|\bCrossfield\s+(?:Aerospace\s+Education\s+)?(?:Award|Ribbon)\b/i, once:true },
  { id:'frank_borman_falcon_award', name:'Frank Borman Falcon Award', re:/\bFrank\s+Borman\b|\bFalcon\s+Award\b/i, once:true }
];

// The most awards the ribbon picker offers for a ribbon (three Medals of Valor), so a longer record lands on the
// last option instead of on no option and a bare ribbon.
function importedMaxAwardCount(id){
  const RA = globalThis.CAPUBRibbonAwards;
  const options = typeof getRibbonAwardOptions === 'function' ? (getRibbonAwardOptions(id) || []) : [];
  if(!RA?.readCount) return Infinity;
  const counts = options.filter(o => o && o.value).map(o => RA.readCount(id, o.value, String(o.label || ''))).filter(Number.isFinite);
  return counts.length ? Math.max(...counts) : Infinity;
}

function importedCountedAwardValue(count, aircrew=false){
  const clasps = importedAdditionalAwardValue(count, 'clasp');
  if(aircrew) return clasps ? `prop_${clasps}` : 'prop';
  return clasps || 'earned';
}

// IACE: the ribbon's own rows, or one exchange per year in the Cadet Training table (IACE is not counted as a
// cadet special activity there; it has its own ribbon, CAPR 39-3).
function extractIaceCountFromReport(text){
  const rows = countMemberReportAwardRows(text, /\bIACE\s+Ribbon\b|\bInternational\s+Air\s+Cadet\s+Exchange\s+Ribbon\b/i);
  const years = new Set();
  const training = getCadetTrainingSection(text);
  const re = /(?:\bIACE\b|International\s+Air\s+Cadet\s+Exchange)(?!\s+Ribbon)[^\d]{0,80}?\d{1,2}\s+[A-Za-z]{3,9}\s+(\d{4})/gi;
  let m;
  while((m = re.exec(training))) years.add(m[1]);
  return Math.max(rows, years.size);
}

// The senior professional development awards (CAPR 39-3: Membership Award for Level I, Leadership Award for
// Level II, Grover Loening Aerospace Award for Level III, Paul E. Garber Award for Level IV, Gill Robb Wilson
// Award for Level V). The award is read by its name, or from a "Level N" completion row: a level is completed in
// order, so the highest level completed awards the lower ones too. A level row is "Level II 01 Jan 2017" or
// "Level II - Name 01 Jan 2017" right after the table's headings or the previous row's date; "Ground Team Member
// Level 2" and "Level I Orientation Course" are not level rows. The bare names (a member called Wilson or Davis,
// "Level 2" anywhere) used to award these.
const MEMBER_REPORT_PD_AWARDS = [
  { id:'cap_membership_ribbon', level:1, name:'Membership Award / Level I', re:/\bMBRRBN\b|\bMembership\s+(?:Award|Ribbon)\b/i },
  { id:'cap_leadership_ribbon', level:2, name:'Leadership Award / Level II', re:/\bLeadership\s+(?:Award|Ribbon)\b|\bDavis\s+Award\b|\bBenjamin\s+O\.?\s+Davis\b|\bLV2\b/i },
  { id:'cap_grover_loening_aerospace_ribbon', level:3, name:'Grover Loening Aerospace Award / Level III', re:/\bGrover\s+Loening\b|\bLoening\s+(?:Aerospace\s+)?(?:Award|Ribbon)\b/i },
  { id:'cap_paul_e_garber_ribbon', level:4, name:'Paul E. Garber Award / Level IV', re:/\bPaul\s+E\.?\s+Garber\b|\bGarber\s+(?:Award|Ribbon)\b/i },
  { id:'cap_gill_robb_wilson_ribbon', level:5, name:'Gill Robb Wilson Award / Level V', re:/\bGill\s+Robb\s+Wilson\b|\bWilson\s+(?:Award|Ribbon)\b/i }
];

function highestProfessionalDevelopmentLevelFromReport(text){
  const source = String(text || '');
  const re = /\bLevel\s+(V|IV|III|II|I|[1-5])\b(?:\s*[-–:]\s*[A-Za-z][A-Za-z.'’ ]{0,40}?)?\s+(?:Complete(?:d)?\s+)?\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/gi;
  const value = { I:1, II:2, III:3, IV:4, V:5 };
  let highest = 0, m;
  while((m = re.exec(source))){
    const before = source.slice(Math.max(0, m.index - 30), m.index);
    if(!/(?:^|\d{4}|Completed?|Development|Date|Level|Rating)\s*$/i.test(before)) continue;
    highest = Math.max(highest, value[m[1].toUpperCase()] || Number(m[1]) || 0);
  }
  return highest;
}

// The duty tables under the names a report may give them. A table headed "Duty Positions" or "Duty Assignments"
// alone (as the cadet one is "Cadet Duty Positions") is read as "Current Duty Positions", the heading the commander
// rules (js/patches.js) look for; a past, previous, prior, former or historical table is "Past Duty Positions", so
// its rows are never read as current; "Cadet", "Current" and "Past" headings are left as they are.
function labelCurrentDutyPositionsHeading(text){
  return String(text || '')
    .replace(/\b(Past|Previous|Prior|Former|Historical|Completed|Ended)\s+Duty\s+(?:Positions|Assignments)\b/gi, '$1 Duty Positions')
    .replace(/\b(Previous|Prior|Former|Historical|Completed|Ended)\s+Duty\s+Positions\b/gi, 'Past Duty Positions')
    .replace(/\bDuty\s+Assignments\b/gi, 'Duty Positions')
    .replace(/(^|[^A-Za-z])(Duty\s+Positions)\b/gi, (match, pre, heading, offset, source) => {
      const before = source.slice(Math.max(0, offset - 12), offset + pre.length);
      return /(?:Cadet|Current|Past)\s*$/i.test(before) ? match : `${pre}Current ${heading}`;
    });
}

// The CAP aviation badges (CAPR 39-1 Figure A7-1) and the words a report row names them by. A row names the kind of badge
// (Pilot, Observer, Air Crew, Glider Pilot, Balloon Pilot, sUAS Pilot, sUAS Technician, Solo, Pre-Solo), may name its level
// (Senior; Master, which the pilot's top badge calls Command) and says what it is: Badge, Rating or Wings ("Master Observer
// Badge", "CAP Senior Air Crew Rating", "Observer Wings"). A table of ratings prints the kind, the level and a date
// ("OBSERVER SENIOR 10 Jan 2019"), which is read too; a `plain` kind is read with no level at all ("Solo 01 Jun 2023").
// ids run basic, senior, master.
//   not        the word that, just before the kind, makes the row another badge or no badge: a sUAS, glider or balloon pilot, a
//              mission, check, instructor or orientation pilot, an FAA certificate; a Pre-Solo is not a Solo.
//   capRating  a bare "Pilot Rating" may be an FAA one, so it is the CAP pilot's only with "CAP" or a level before it.
//   datedWord  a table row must spell the kind in full ("Glider Pilot 01 Jan 2020", not "Glider 01 Jan 2020").
// A qualification (Mission Scanner, Mission Observer, Airborne Photographer) is not a badge and is not read here.
const IMPORTED_AVIATION_BADGES = [
  { word:'Pilot', ids:['CAPPilot1_FA9D33EA587D8','CAPSeniorPilot1_D9725AE959752','CAPMasterPilot1_621A0E2ED15DA'], capRating:true,
    not:/^(?:s?uas|glider|balloon|mission|instructor|check|orientation|transport|solo|private|commercial|student|recreational|sport|airline|remote)$/ },
  { word:'Glider(?:\\s+Pilot)?', ids:['GliderPilot1_7BFB287379918'], plain:true, datedWord:/Pilot/i },
  { word:'Balloon(?:\\s+Pilot)?', ids:['BalloonPilot1_442D89C94185B'], plain:true, datedWord:/Pilot/i },
  { word:'Solo(?:\\s+Pilot)?', ids:['solo_badge'], plain:true, not:/^(?:pre|s?uas)$/ },
  { word:'Pre[\\s-]*Solo', ids:['pre_solo_badge'], plain:true, not:/^s?uas$/ },
  { word:'Air[\\s-]?crew', ids:['AirCrew1_DB3F0FCC3650F','SeniorAirCrew1_B289BAE6E515C','MasterAirCrew1_72AC4CAE7A310'], plain:true },
  { word:'s?UAS\\s+Pilot', ids:['uas_pilot_basic_badge','uas_pilot_senior_badge','uas_pilot_master_badge'], plain:true },
  { word:'s?UAS\\s+Technician', ids:['uas_technician_basic_badge','uas_technician_senior_badge','uas_technician_master_badge'], plain:true },
  { word:'(?:Mission\\s+)?Observer', ids:['observer_badge','SeniorObserver1_0E35802A29801','MasterObserver1_1B88D5071FD5C'], plain:true }
];
const IMPORTED_AVIATION_LEVEL_WORDS = { basic:0, senior:1, master:2, command:2 };

// The words of the row before `index`, nearest first, back to the previous row's date (or 60 characters), and the row's text.
function importedWordsBefore(source, index){
  const head = source.slice(Math.max(0, index - 60), index);
  const lastDate = [...head.matchAll(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g)].pop();
  const row = lastDate ? head.slice(lastDate.index + lastDate[0].length) : head;
  return { row, words:row.split(/[\s(]+/).map(w => w.replace(/[^A-Za-z]/g, '').toLowerCase()).filter(Boolean).reverse() };
}

// The aviation badge ids a report names, the highest level of each kind (CAPR 39-1 10.3.1: awarded under CAPR 35-6, so
// a badge or rating row is the only evidence read; an Exam, Course or Training row is not the rating).
function importedAviationBadgesFromReport(text){
  const source = String(text || '');
  const dateAhead = /^\s*\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/;
  const out = [];
  for(const kind of IMPORTED_AVIATION_BADGES){
    let best = -1;
    const re = new RegExp(`(?<![A-Za-z])(${kind.word})(?![A-Za-z])`, 'gi');
    let m;
    while((m = re.exec(source))){
      const before = importedWordsBefore(source, m.index);
      // The level and "CAP" just before the kind ("CAP Senior Pilot"); the first other word names another badge or none.
      let level = -1, cap = false, i = 0;
      for(; i < before.words.length; i++){
        const w = before.words[i];
        if(w in IMPORTED_AVIATION_LEVEL_WORDS) level = Math.max(level, IMPORTED_AVIATION_LEVEL_WORDS[w]);
        else if(w === 'cap') cap = true;
        else if(w !== 'cadet') break;
      }
      if(kind.not && kind.not.test(before.words[i] || '')) continue;
      let rest = source.slice(m.index + m[0].length);
      // A level between the kind and the word that says what it is ("Observer Senior Wings", "Observer (Senior) Badge").
      const middle = /^\s*[-–:,(]?\s*(Basic|Senior|Master|Command)\b\)?/i.exec(rest);
      if(middle){ level = Math.max(level, IMPORTED_AVIATION_LEVEL_WORDS[middle[1].toLowerCase()]); rest = rest.slice(middle[0].length); }
      const named = /^\s*(Badge|Rating|Wings)\b(?!\s+(?:Exam|Test|Course|Class|Training|Trainee|Ceremony|Presentation))/i.exec(rest);
      if(named){
        if(kind.capRating && /^rating$/i.test(named[1]) && !cap && level < 0) continue;
        const after = /^\s*[-–:(]\s*(Basic|Senior|Master|Command)\b/i.exec(rest.slice(named[0].length));
        if(after) level = Math.max(level, IMPORTED_AVIATION_LEVEL_WORDS[after[1].toLowerCase()]);
      }else if(dateAhead.test(rest)){
        // A table row of the rating and its date: not a qualification ("Mission Observer"), not an award's, exam's or course's row ("... Ribbon Aircrew").
        if(/^mission/i.test(m[1]) || (kind.datedWord && !kind.datedWord.test(m[1])) || /\b(?:Ribbon|Medal|Award|Exam|Test|Course|Training)\b/i.test(before.row)) continue;
        if(level < 0 && !kind.plain) continue;
      }else continue;
      best = Math.max(best, level < 0 ? 0 : level);
    }
    if(best >= 0) out.push(kind.ids[Math.min(best, kind.ids.length - 1)]);
  }
  return out;
}

// The aircrew qualifications a report lists as held (not in training), and the basic aviation badge each brings when the report names no aviation
// badge of that family (the owner, 2026-11-12: "it didnt give me any air crew wings"). A Mission Observer brings the Observer badge; a Mission
// Scanner or an Airborne Photographer who is not also a Mission Observer, the Air Crew badge. A Mission Pilot brings none: pilot wings are the
// pilot rating's, as the report names it. Basic level only: the report shows neither the years nor the hours a senior or master level needs.
// `ids` are a family's three levels (basic, senior, master), `word` how the panel names it.
const IMPORTED_AVIATION_FAMILIES = {
  pilot: { word:'pilot', ids:['CAPPilot1_FA9D33EA587D8', 'CAPSeniorPilot1_D9725AE959752', 'CAPMasterPilot1_621A0E2ED15DA'] },
  observer: { word:'observer', ids:['observer_badge', 'SeniorObserver1_0E35802A29801', 'MasterObserver1_1B88D5071FD5C'] },
  aircrew: { word:'air crew', ids:['AirCrew1_DB3F0FCC3650F', 'SeniorAirCrew1_B289BAE6E515C', 'MasterAirCrew1_72AC4CAE7A310'] }
};
const IMPORTED_AIRCREW_QUALIFICATIONS = [
  { name:'Mission Pilot', label:'\\bMission\\s+Pilot\\b', family:'pilot', badge:null },
  { name:'Mission Observer', label:'\\bMission\\s+Observer\\b', family:'observer', badge:'observer_badge' },
  { name:'Mission Scanner', label:'\\bMission\\s+Scanner\\b', family:'aircrew', badge:'AirCrew1_DB3F0FCC3650F' },
  { name:'Airborne Photographer', label:'\\b(?:Airborne|Aerial)\\s+Photographer\\b', family:'aircrew', badge:'AirCrew1_DB3F0FCC3650F' }
];

// The aircrew qualifications held, and the badges they bring: [{ id, family, qualifications: [names] }], one per badge, for each family the report names
// no badge of (`named`, the aviation badge ids the report names).
function importedAviationBadgesFromQualifications(text, named){
  const held = IMPORTED_AIRCREW_QUALIFICATIONS.filter(q => hasNonTrainingQualification(text, q.label));
  const brought = [];
  for(const q of held){
    if(!q.badge || named.some(id => IMPORTED_AVIATION_FAMILIES[q.family].ids.includes(id))) continue;
    // The observer's badge is the one that outranks the Air Crew badge: a scanner who is also an observer is worn as the observer.
    if(q.family === 'aircrew' && held.some(h => h.family === 'observer')) continue;
    const have = brought.find(b => b.id === q.badge);
    if(have) have.qualifications.push(q.name);
    else brought.push({ id:q.badge, family:q.family, qualifications:[q.name] });
  }
  return { held:held.map(q => q.name), brought };
}

// The rows of the Decorations and Activity/Service Ribbon tables that no reader above recognizes, as "name date". A row the report prints that
// earns nothing here is told to the member, not dropped. A row is the words since the previous date, less a table heading; the words of the
// last row, with no date after them, are read too. The Professional Development, Cadet Training and Orientation Flights tables are not in this
// list: most of their rows (courses, flights, activities) earn no ribbon by design.
const MEMBER_REPORT_KNOWN_ROWS = [
  ...MEMBER_REPORT_COUNTED_AWARDS.map(award => award.re), ...MEMBER_REPORT_PD_AWARDS.map(award => award.re),
  /\bAchievement\s+Award\b/i, /\bCommanders?(?:\s*['‘’ʼ`´]\s*s?)?\s+Commendation\b/i, /Certificate\s+of\s+Recognition\s+for\s+Life[\s-]?saving|\bLife[\s-]?saving\s+Award\b/i,
  /Air Force Organizational Excellence Award/i, /Exceptional\s+Service\s+Award/i, /Meritorious\s+Service\s+(?:Award|Medal)/i,
  /\bYeager\b/i, /\b(?:Senior|Cadet)\s+Recruiter\s+Ribbon\b/i, /Crisis\s+Service\s+Award|\bCrisis\s+Ribbon\b/i, /Community\s+Service\s+Ribbon/i,
  /Search\s*[‘’“”"'`]?\s*Find/i, /\bIACE\b|International\s+Air\s+Cadet\s+Exchange/i, /Disaster\s+Relief\s+Ribbon/i, /Cadet\s+Advisory\s+Council\s+Ribbon/i,
  /Encampment\s+Ribbon|Piney\s+Creek\s+Camp/i, /Cadet\s+Special\s+Activit(?:y|ies)\s+Ribbon/i, /\bMedal\s+of\s+Valor\b/i, /\bModel\s+Rocketry\b/i,
  /\b(?:Cadet\s+)?(?:STEM|Cyber)\s+Badge\b/i, /\bNRA\s+Marksman/i
];
// The Cadet Training words that need no telling when they have no date after them (a row is read by memberReportCadetTrainingRows when it has one):
// the national activities, Cadet Officers School, the IACE, and what is left out on purpose (the region schools and Required Staff Training, which
// earn no ribbon of their own, the encampments and orientation flights, which have their own tables).
const MEMBER_REPORT_TRAINING_KNOWN_ROWS = [
  { test: words => !!importedNcsaListEntry(words) }, /Hawk\s+Mountain|\bHMRS\b|\bHawk\s+Cadet\s+Cadre\b/i, /Civic\s+Leadership\s+Academy|\bCLA\b/i,
  /Air Force Civil Engineering Academy|\bAFCEA\b/i, /Cadet\s+Officers?\s+School|\bCOS\b/i, /Military\s+Operations\s+Training\s+School|\bMOTS\b/i,
  /\bNCSA\b|National\s+Cadet\s+Special\s+Activit/i, /\bRCLS\b|Required\s+Staff\s+Training|\bRST\b|Region(?:al)?\s+Cadet\s+Leadership\s+School/i,
  /\bIACE\b|International\s+Air\s+Cadet\s+Exchange/i, /Encampment/i, /Orientation\s+Flights?/i, /Cadet\s+Special\s+Activit(?:y|ies)/i
];
// Rows that belong to a table whose heading is not in the report (a heading lost in the copy): the rows are not counted without it, so the report says so.
function memberReportMissingHeadingLines(text){
  const t = normalizeMemberReportText(text);
  const date = MEMBER_REPORT_DATE;
  const lines = [];
  if(!/\bEncampments\b/i.test(t) && new RegExp(`\\bEncampment\\b(?!\\s+Ribbon)[^\\d]{0,60}${date}`, 'i').test(t)) lines.push('Rows that look like encampments were found with no Encampments heading, so they were not counted.');
  if(!/Specialty\s+Tracks/i.test(t) && new RegExp(`\\b[A-Z][A-Z/&-]+(?: [A-Z/&-]+)* (?:TECHNICIAN|SENIOR|MASTER) ${date}`).test(t)) lines.push('Rows that look like specialty track ratings were found with no Specialty Tracks heading, so no badge was imported from them.');
  if(!/Cadet\s+Training/i.test(t) && new RegExp(`\\b(?:NCSA|National\\s+Cadet\\s+Special|Cadet\\s+Officers?\\s+School|Pararescue|Hawk\\s+Mountain|Civic\\s+Leadership)\\b[^\\d]{0,60}${date}`, 'i').test(t)) lines.push('Rows that look like cadet activities were found with no Cadet Training heading, so they were not counted.');
  return lines;
}
function memberReportUnreadRows(text){
  const source = normalizeMemberReportText(text);
  const rows = [];
  // `datedRowsRead`: every dated row of the section is read by its own reader (the Cadet Training table: memberReportCadetTrainingRows), so only the
  // words with no date after them are left to be listed.
  const scan = (section, known, datedRowsRead = false) => {
    if(!section) return;
    const check = (segment, date) => {
      if(datedRowsRead && date) return;
      const from = (MEMBER_REPORT_TABLE_HEADINGS.exec(segment) || [''])[0].length;
      const words = segment.slice(from).trim();
      if(words.length < 8 || !/[A-Za-z]{4}/.test(words) || known.some(re => re.test(words))) return;
      const row = `${words.slice(0, 90)}${date ? ` ${date}` : ''}`;
      if(!rows.includes(row)) rows.push(row);
    };
    const re = new RegExp(MEMBER_REPORT_DATE, 'gi');
    let previousEnd = 0, m;
    while((m = re.exec(section))){
      check(section.slice(previousEnd, m.index), m[0]);
      previousEnd = m.index + m[0].length;
    }
    check(section.slice(previousEnd), '');
  };
  scan(getReportSectionUntilAny(source, 'Decorations', ['Local\\s+Activities']), MEMBER_REPORT_KNOWN_ROWS);
  scan(getCadetTrainingSection(source), MEMBER_REPORT_TRAINING_KNOWN_ROWS, true);
  // A dated row of the Cadet Training table that is on no list earns nothing, and the member is told which it was.
  for(const row of memberReportCadetTrainingRows(source).filter(r => r.unlisted)){
    const words = `${row.title.slice(0, 90)} ${row.date}`;
    if(!rows.includes(words)) rows.push(words);
  }
  return rows.slice(0, 200);
}

// The text without its rating exam rows ("Technician Rating Exam: Communications LMS 19 Aug 2023": the words up to the row's date).
const memberReportWithoutExamRows = text => String(text || '').replace(/\b(?:(?:Technician|Senior|Master)\s+)?Rating\s+Exam\b[^\d]{0,100}/gi, ' ');

function parseCapMemberReport(textRaw){
  const text = labelCurrentDutyPositionsHeading(normalizeMemberReportText(removeLocalActivitiesFromMemberReport(textRaw)));
  const result = {
    membership:null,
    gender:null,
    rank:null,
    cadetFirstSergeant:false,
    ribbons:[],
    badges:[],
    authorizedBadges:[],
    patches:[],
    notes:[]
  };

  const memberName = extractMemberNameFromReport(text);
  if(memberName){
    result.firstName = memberName.firstName;
    result.lastName = memberName.lastName;
  }

  // A row the report lists twice is one record (normalizeMemberReportText): say how many were joined.
  const repeatedRows = memberReportDuplicateCuts(memberReportCleanBeforeDedupe(textRaw)).length;
  if(repeatedRows) result.notes.push(`${repeatedRows} row${repeatedRows === 1 ? '' : 's'} listed twice in the report ${repeatedRows === 1 ? 'was' : 'were'} counted once.`);

  const currentProfile = getCurrentProfileFromMemberReport(text);
  result.profileFound = !!currentProfile;
  result.joinDateFound = !!extractJoinDateFromMemberReport(text);
  result.unreadRows = memberReportUnreadRows(text);
  // The activities the Cadet Training table credits, for the panel to say which have no patch (the patches are js/patches.js's).
  result.activities = memberReportCadetTrainingRows(text).filter(row => row.credit).map(row => ({ title:row.title, year:row.year, activity:row.activity }));
  if(currentProfile){
    result.membership = currentProfile.membership;
    result.gender = currentProfile.gender;
    result.rank = currentProfile.rank;
  }else{
    if(/\bSENIOR(?:\s+MEMBER)?\b/i.test(text)) result.membership = 'senior';
    else if(/\bCADET\b/i.test(text)) result.membership = 'cadet';
    if(/\bFEMALE\b/i.test(text)) result.gender = 'female';
    else if(/\bMALE\b/i.test(text)) result.gender = 'male';
    result.rank = getHighestImportedRank(text);
  }

  if(result.membership === 'cadet' && hasCurrentFirstSergeantDutyPosition(text)){
    result.cadetFirstSergeant = true;
    if(CADET_FIRST_SERGEANT_CLASSB_RANKS.has(result.rank)){
      result.notes.push('Current First Sergeant duty found, so the Cadet First Sergeant diamond is chosen for the Class B shirt (CAPR 39-1, 10.10.4).');
    }else{
      result.notes.push('Current First Sergeant duty found, but only cadet master sergeants, senior master sergeants and chief master sergeants wear the diamond, so it was not chosen (CAPR 39-1, 10.10.4).');
    }
  }

  // Cadet milestone ribbons must come only from the Cadet Achievements table.
  // A milestone name elsewhere in the report (for example, attendance at a
  // "Spaatz Award Presentation") is not evidence that the member earned it.
  let cadetAchievements = getReportSection(text, 'Cadet\\s+Achievements', 'Awards');
  // The heading is missing but the rows are there ("Achievement 4 - Wright Brothers 12 Jun 2021"): they are read, and the report says so.
  const achievementRowStart = text.search(/Achievement\s+\d+\s*[-–]/i);
  if(!cadetAchievements && achievementRowStart >= 0){
    cadetAchievements = getReportSectionUntilAny(text.slice(achievementRowStart), 'Achievement', ['Awards', 'Promotions', 'Decorations', 'Activity\\s*\\/\\s*Service']);
    result.notes.push('The Cadet Achievements heading was not found; its Achievement rows were read without it.');
  }
  result.missingHeadings = memberReportMissingHeadingLines(text);
  const achievementRows = readCadetAchievementRows(cadetAchievements);
  const maxAchievement = achievementRows.length ? Math.max(...achievementRows.map(row => row.index)) : 0;
  const achievementMap = [
    null,
    'curry_achievement',
    'hap_arnold_achievement',
    'mary_feik_achievement',
    'rickenbacker_achievement',
    'lindbergh_achievement',
    'doolittle_achievement',
    'goddard_achievement',
    'armstrong_achievement'
  ];
  for(let i=1; i<=Math.min(maxAchievement, 8); i++){
    if(!achievementMap[i]) continue;
    const honorCredit = achievementRows.some(row => row.index === i && !row.milestone && row.honor);
    let value = honorCredit ? 'honor_credit' : 'earned';

    // Goddard uses the same one-star ribbon for either Honor Credit or Model
    // Rocketry, and the supplied two-star ribbon when both were earned.
    if(i === 7){
      const modelRocketry = memberReportNamesBadge(text, /Model\s+Rocketry/i);
      const hasMitchell = /\bMitchell\b/i.test(cadetAchievements);
      const rocketryCredit = modelRocketry && hasMitchell;
      if(honorCredit && rocketryCredit) value = 'honor_credit_and_rocketry';
      else if(honorCredit) value = 'honor_credit';
      else if(rocketryCredit) value = 'rocketry_star';
    }

    result.ribbons.push({
      id:achievementMap[i],
      value,
      reason:`Achievement ${i}${honorCredit ? ' with Honor Credit' : ''}`
    });
  }
  if(/Wright\s+Brothers/i.test(cadetAchievements)) result.ribbons.push({ id:'wright_brothers_award', value:'earned', reason:'Wright Brothers' });
  if(/\bMitchell\b/i.test(cadetAchievements)) result.ribbons.push({ id:'mitchell_award', value:'earned', reason:'Billy Mitchell' });
  if(/\bEarhart\b/i.test(cadetAchievements)) result.ribbons.push({ id:'earhart_award', value:'earned', reason:'Amelia Earhart' });
  if(/\bEaker\b/i.test(cadetAchievements)) result.ribbons.push({ id:'eaker_award', value:'earned', reason:'Eaker' });
  if(/\bSpaatz\b/i.test(cadetAchievements)) result.ribbons.push({ id:'spaatz_award', value:'earned', reason:'Spaatz' });

  // Decorations / service ribbons.
  // Every listed line is one award, dated or not. The Yeager award's full name ("Brig Gen Charles E. Yeager
  // Aerospace Education Achievement Award") is not a CAP Achievement Award row.
  const awardText = memberReportTextWithoutMemberRow(text);
  const achievementAwardCount = countMemberReportAwardRows(awardText, /\bAchievement\s+Award\b/i, /(?:Education|Aerospace|Yeager|AE)\s+$/i);
  if(achievementAwardCount > 0){
    result.ribbons.push({
      id:'cap_achievment_award',
      value:chooseSpecialRibbonValueByAwardCount('cap_achievment_award', achievementAwardCount),
      reason:`${achievementAwardCount} Achievement Award record(s)`
    });
  }

  const commandersCommendation = extractCommandersCommendationFromReport(text);
  if(commandersCommendation){
    result.ribbons.push({
      id:'commander_commendation_award',
      value:commandersCommendation.value,
      reason:`${commandersCommendation.count} Commander's Commendation Award record(s), highest level ${commandersCommendation.level.replace('national_region', 'National and Region')}`
    });
  }

  // The eServices row reads "Certificate of Recognition for Lifesaving"; older records read "Lifesaving Award".
  const lifesavingCount = countOccurrences(text, /Certificate\s+of\s+Recognition\s+for\s+Life[\s-]?saving|\bLife[\s-]?saving\s+Award\b/gi);
  if(lifesavingCount > 0){
    result.ribbons.push({
      id:'lifesaving_award',
      value:chooseLifesavingValue(lifesavingCount),
      reason:`${lifesavingCount} Certificate of Recognition for Lifesaving record(s)`
    });
    result.notes.push(`The Certificate of Recognition for Lifesaving is the Lifesaving Award ribbon${lifesavingCount > 1 ? ` with ${lifesavingCount - 1} bronze clasp${lifesavingCount > 2 ? 's' : ''}` : ''}. The report does not say whether the save was a blood or organ transport, so the silver star for a save of another kind is not added; add it under Ribbons if it applies (CAPR 39-3, 9h).`);
  }

  if(/Air Force Organizational Excellence Award/i.test(text)){
    result.ribbons.push({ id:'Air_Force_Organizational_Excellence_Award', value:'earned', reason:'Air Force Organizational Excellence Award' });
  }
  const exceptionalServiceCount = extractAwardCountFromAwardsTable(text, 'Exceptional\\s+Service\\s+Award') || countOccurrences(text, /Exceptional Service Award/gi);
  if(exceptionalServiceCount > 0){
    result.ribbons.push({ id:'exceptional_service_award', value:chooseSpecialRibbonValueByAwardCount('exceptional_service_award', exceptionalServiceCount), reason:`${exceptionalServiceCount} Exceptional Service Award record(s)` });
  }
  const meritoriousServiceCount = extractAwardCountFromAwardsTable(text, 'Meritorious\\s+Service\\s+(?:Award|Medal)') || countOccurrences(text, /Meritorious Service (?:Award|Medal)/gi);
  if(meritoriousServiceCount > 0){
    result.ribbons.push({ id:'meritorious_service_award', value:chooseSpecialRibbonValueByAwardCount('meritorious_service_award', meritoriousServiceCount), reason:`${meritoriousServiceCount} Meritorious Service Award record(s)` });
  }

  const pdLevel = highestProfessionalDevelopmentLevelFromReport(awardText);
  for(const award of MEMBER_REPORT_PD_AWARDS){
    const named = award.re.test(awardText);
    if(named || pdLevel >= award.level){
      result.ribbons.push({ id:award.id, value:'earned', reason:named ? award.name : `${award.name} (Level ${pdLevel} completed)` });
    }
  }
  if(/\bYeager\s+(?:Aerospace|Award|AE|Ribbon)\b|\bCharles\s+E\.?\s+(?:["“”]?Chuck["“”]?\s+)?Yeager\b|\bChuck\s+Yeager\b/i.test(awardText)){
    result.ribbons.push({ id:'cap_bridgadier_general_charles_yaeger_ribbon', value:'earned', reason:'Yeager Award' });
  }
  if(result.ribbons.some(r => r.id === 'cap_leadership_ribbon') && parseMemberReportSpecialtyTracks(text).some(row => /^(?:SENIOR|MASTER)$/.test(row.level))){
    result.notes.push('Leadership Award: a senior or master specialty rating earns a star (bronze for senior, silver for master), which is not added; add it under Ribbons if it applies.');
  }
  if(result.ribbons.some(r => r.id === 'cap_gill_robb_wilson_ribbon' || r.id === 'cap_paul_e_garber_ribbon')){
    result.notes.push('Garber and Gill Robb Wilson Awards: the report does not show Squadron Officer School, Air Command and Staff College or Air War College, so no star is added; add it under Ribbons if it applies.');
  }

  for(const award of MEMBER_REPORT_COUNTED_AWARDS){
    const rows = countMemberReportAwardRows(awardText, award.re, award.skipAfter || null);
    if(!rows) continue;
    // An award earned once is one row however many of the names in its pattern the row prints ("Frank Borman Falcon Award" is both).
    const count = award.once ? 1 : Math.min(rows, importedMaxAwardCount(award.id));
    if(count < rows && !award.once) result.notes.push(`${rows} ${award.name} records found; the ribbon picker offers at most ${count}, so ${count} are used.`);
    const aircrew = !!award.aircrew && memberReportAwardRowSays(awardText, award.re, /Aircrew|Air\s+crew|Prop(?:eller)?\b/i);
    result.ribbons.push({
      id:award.id,
      value:award.once ? 'earned' : importedCountedAwardValue(count, aircrew),
      reason:`${count} ${award.name} record(s)${aircrew ? ' (aircrew)' : ''}`
    });
    if(award.note) result.notes.push(award.note);
    if(rows > 1 && MEMBER_REPORT_ROW_MEANING_UNSURE.has(award.id)) result.notes.push(memberReportRepeatedRowNote(award.name, rows));
  }

  // Recruiter ribbons are membership-specific. Senior reports often retain a
  // prior cadet-history entry, so "Cadet Recruiter Ribbon" must never be
  // interpreted as the senior ribbon. The senior ribbon requires its exact
  // report label.
  if(result.membership === 'senior'){
    if(/\b(?:CAP\s+)?Senior\s+Recruiter\s+Ribbon\b/i.test(text)){
      result.ribbons.push({ id:'cap_senior_recruiter_ribbon', value:'earned', reason:'Senior Recruiter Ribbon' });
      const rows = countMemberReportAwardRows(text, /\bSenior\s+Recruiter\s+Ribbon\b/i);
      if(rows > 1) result.notes.push(memberReportRepeatedRowNote('Senior Recruiter Ribbon', rows));
    }
    if(/\bCadet\s+Recruiter\s+Ribbon\b/i.test(text)){
      result.notes.push('A Cadet Recruiter Ribbon row was not used: a senior member wears the Senior Recruiter Ribbon only.');
    }
  }else if(result.membership === 'cadet' && /\bCadet\s+Recruiter\s+Ribbon\b/i.test(text)){
    result.ribbons.push({ id:'cadet_recruiter_ribbon', value:'earned', reason:'Cadet Recruiter Ribbon' });
    const rows = countMemberReportAwardRows(text, /\bCadet\s+Recruiter\s+Ribbon\b/i);
    if(rows > 1) result.notes.push(memberReportRepeatedRowNote('Cadet Recruiter Ribbon', rows));
  }

  const joinDate = extractJoinDateFromMemberReport(text);
  if(joinDate){
    const serviceYears = getFullYearsBetween(joinDate, new Date());
    const redServiceValue = chooseRedServiceValueFromYears(serviceYears);
    if(redServiceValue){
      result.ribbons.push({
        id:'red_service_ribbon',
        value:redServiceValue,
        reason:`${serviceYears} full years since join date`
      });
    }
  }

  const communityServiceCount = Math.max(1, countOccurrences(text, /Community Service Ribbon/gi));
  if(/Community Service Ribbon/i.test(text)){
    result.ribbons.push({
      id:'community_service_ribbon',
      value:chooseCommunityServiceValue(communityServiceCount),
      reason:`${communityServiceCount} Community Service Ribbon record(s)`
    });
  }

  // The quotes around Find are straight, curly double or curly single in a PDF ("Search ‘Find’ Ribbon").
  const searchFindRe = /Search\s*[‘’“”\"'`]?\s*Find\s*[‘’“”\"'`]?\s+Ribbon/i;
  const searchFindCount = countMemberReportAwardRows(text, searchFindRe);
  if(searchFindCount){
    const aircrew = memberReportAwardRowSays(text, searchFindRe, /Aircrew|Air\s+crew|Prop(?:eller)?\b/i);
    result.ribbons.push({
      id:'search_find_ribbon',
      value:aircrew ? importedCountedAwardValue(searchFindCount, true) : `find_${Math.min(searchFindCount, importedMaxAwardCount('search_find_ribbon'))}`,
      reason:`${searchFindCount} Search Find Ribbon record(s)${aircrew ? ' (aircrew)' : ''}`
    });
  }

  const iaceCount = extractIaceCountFromReport(text);
  if(iaceCount){
    result.ribbons.push({ id:'iace_ribbon', value:importedCountedAwardValue(iaceCount), reason:`${iaceCount} IACE record(s)` });
  }


  const disasterRelief = extractDisasterReliefFromReport(text);
  if(disasterRelief){
    result.ribbons.push({
      id:'disaster_relief_ribbon',
      value:disasterRelief.value,
      reason:`${disasterRelief.count} Disaster Relief Ribbon record(s)${disasterRelief.hasV ? ' with the V (Presidentially declared disaster)' : ''}`
    });
  }

  // The CAC level comes from the CAC duty rows, never from "Wing" anywhere in the report (an "Illinois Wing
  // Encampment" row is not Wing CAC service). js/patches.js re-derives this ribbon from the duty rows with its
  // term rules and replaces this entry; the level here only has to be right on its own.
  const cacLevel = importedCacLevelFromDutyPositions(text);
  if(/Cadet Advisory Council Ribbon/i.test(text) || cacLevel){
    const cacValue = { national:'national_gold_star', region:'region_silver_star', wing:'wing_bronze_star' }[cacLevel] || 'group';
    result.ribbons.push({ id:'cadet_advisory_council_ribbon', value:cacValue, reason:`Cadet Advisory Council${cacLevel ? ` (${cacLevel} duty)` : ''}` });
  }

  const encampmentCount = extractEncampmentCountFromReport(text) || countOccurrences(text, /Encampment Ribbon/gi);
  if(encampmentCount > 0 || /Encampment Ribbon|Piney Creek Camp/i.test(text)){
    result.ribbons.push({
      id:'encampment_ribbon',
      value:chooseEncampmentValue(Math.max(1, encampmentCount)),
      reason:`${Math.max(1, encampmentCount)} encampment record(s)`
    });
  }

  // The activities in the Cadet Training table, or the ribbon's own rows when the table does not list them.
  const cadetSpecialActivityCount = Math.max(extractCadetSpecialActivityCountFromReport(text),
    countMemberReportAwardRows(text, /\bCadet\s+Special\s+Activit(?:y|ies)\s+Ribbon\b/i));
  if(cadetSpecialActivityCount > 0){
    result.ribbons.push({
      id:'cadet_special_activity_ribbon',
      value:chooseCadetSpecialActivityValue(cadetSpecialActivityCount),
      reason:`${cadetSpecialActivityCount} cadet special activity record(s)`
    });
  }

  // Duty-position badge mapping. Look at both current and past duty positions.
  // Current commanders wear the current command pin. Past commanders only import as
  // graduated commanders if they served at least one year, and only Lt Col and below.
  const commandStatus = getCommandInsigniaStatusForMember(text, result);
  if(commandStatus){
    const pin = getImportedCommandPinId(text, commandStatus);
    result.badges.push(pin);
    // Applied by applyCapMemberReportImport, after it clears the previous member's status.
    result.commandStatus = commandStatus;
    result.commandPin = pin;
    const pinName = pin === 'group_commander_badge' ? 'Group Commander' : 'Squadron Commander';
    result.notes.push(commandStatus === 'current'
      ? `Current commander duty found: the ${pinName} command insignia pin is worn over the name tag (CAPR 39-1, 10.2.5).`
      : `Past commander duty of a year or more found: the ${pinName} command insignia pin is worn under the name tag, as a graduated commander's (CAPR 39-1, 10.2.5).`);
  }

  const commandServiceRibbon = getCommandServiceRibbonFromDutyAssignments(text);
  if(commandServiceRibbon){
    result.ribbons.push(commandServiceRibbon);
    const level = { earned:'Squadron level', group_bronze_star:'Group level, bronze star', wing_silver_star:'Wing level, silver star', region_gold_star:'Region level, gold star', national_two_gold_stars:'National level, two gold stars' }[commandServiceRibbon.value] || 'the level of the command';
    result.notes.push(`Command Service Ribbon: ${level}, from commander duty of 365 days or more.`);
  }

  // Specialty-track badges: the Specialty Tracks table is the ONLY authority.
  // Left column = specialty area, middle column = level, right column = completion date.
  // Level NONE = ineligible, even if the member holds a duty position or completed a rating exam.
  const importedSpecialtyTracks = getSpecialtyBadgesFromTracks(text);
  for(const item of importedSpecialtyTracks.badges){
    result.badges.push(item.id);
    // A rated specialty the builder does not authorize for this membership is named, not dropped silently.
    if(!isBadgeEligibleForMembership(item.id, result.membership)){
      result.notes.push(`${item.specialty} ${item.level} is in the Specialty Tracks table, but the builder does not authorize that badge for ${result.membership || 'this'} members, so it is not offered.`);
    }
  }
  result.notes.push(...importedSpecialtyTracks.notes);

  // Field-uniform patch auto-import:
  // Communications patch renders from the Communications specialty rating only.
  // It is intentionally not authorized on OCP and will be filtered by current uniform.
  // The rating is a row of the Specialty Tracks table; a row of an exam ("Technician Rating Exam: Communications") is no rating (js/catalog.js reads the
  // words Communications and Technician near each other where the table is missing, so the exam rows are taken out of what it reads).
  if(importedSpecialtyTracks.badges.some(item => /^communications_/.test(item.id)) || memberReportHasCommunicationsTechnicianSpecialty(memberReportWithoutExamRows(text))){
    result.patches.push('comms_patch');
    result.notes.push('A Communications specialty rating was found: the Communications patch is worn on the field and flight uniforms only.');
  }

  if(/ICUT|Introductory Communications User Training|Rating Exam:\s*Communications|Mission Radio Operator|\bMRO\b/i.test(text) &&
     !importedSpecialtyTracks.badges.some(item => /^communications_/.test(item.id))){
    result.notes.push('Communications training or an exam was found, but the Communications badge comes from a rating in Specialty Tracks (CAPR 39-1, 10.5), so none was imported.');
  }
  if(/Technician Rating Exam:\s*IT|Information Technology Technician/i.test(text) &&
     !importedSpecialtyTracks.badges.some(item => /^information_technology_/.test(item.id))){
    result.notes.push('Information Technology training or an exam was found, but the badge comes from a rating in Specialty Tracks (CAPR 39-1, 10.5), so none was imported.');
  }
  if(/Technician Rating Exam:\s*Historian|Historian Technician/i.test(text) &&
     !importedSpecialtyTracks.badges.some(item => /^historian_/.test(item.id))){
    result.notes.push('Historian training or an exam was found, but the badge comes from a rating in Specialty Tracks (CAPR 39-1, 10.5), so none was imported.');
  }

  // New rule: CDI status/duty/training alone does not authorize the CDI badge.
  // Only import a CDI badge if a future report explicitly lists a CDI badge/award item.
  if(/\bCDI\b|Character Development Instructor|Character Development Facilitator/i.test(text)){
    result.notes.push('Character Development Instructor duty, status or training was found, but the badge comes from a rating in Specialty Tracks (CAPR 39-1, 10.5), so none was imported.');
  }

  // New rule: MRO and MSA are qualifications/roles; no MRO/MSA badge exists.
  if(/Mission Radio Operator|\bMRO\b|Mission Staff Assistant|\bMSA\b/i.test(text)){
    result.notes.push('Mission Radio Operator or Mission Staff Assistant training was found; there is no badge for either, so none was imported.');
  }

  // UDF is a qualification only. There is no UDF badge to render.
  if(/Urban Direction Finding Team|\bUDF\b/i.test(text)){
    result.notes.push('Urban Direction Finding training was found; there is no badge for it, so none was imported.');
  }

  // Badge / qualification mapping.
  // Aviation family priority is resolved later as: Pilot > Observer > Aircrew.
  // Governance/service badges use exact report labels. Their selection order is
  // resolved separately so Command Council / SAG outrank National Staff, while
  // National Staff outranks every other specialty badge.
  if(/\bCommand\s+Council\s+Badge\b/i.test(text)) result.badges.push('command_council_badge');
  if(/\bSenior\s+Advisory\s+Group\s+Badge\b|\bSAG\s+Badge\b/i.test(text)) result.badges.push('senior_advisory_group_badge');
  const nationalStaffEligibility = window.CAPUBMemberReportRules?.evaluateNationalStaffEligibility(text);
  if(nationalStaffEligibility?.eligible){
    result.badges.push('national_staff_badge');
    if(nationalStaffEligibility.reason === 'CURRENT_APPOINTMENT'){
      result.notes.push('A current National Staff appointment was found: the National Staff Badge may be worn (CAPR 39-1, 10.2.3).');
    }else if(nationalStaffEligibility.reason === 'PAST_APPOINTMENT_ONE_CALENDAR_YEAR'){
      result.notes.push('A National Staff appointment of one full year or more was found: the National Staff Badge is worn permanently (CAPR 39-1, 10.2.3).');
    }
  }else if(nationalStaffEligibility?.reason === 'PAST_APPOINTMENT_TOO_SHORT'){
    result.notes.push('A past National Staff appointment was found, but it ran less than one year, so the badge is not worn permanently (CAPR 39-1, 10.2.3).');
  }
  if(/\bNational\s+Executive\s+Committee\s+Badge\b|\bNEC\s+Badge\b/i.test(text)) result.badges.push('national_executive_committee_badge');
  if(/\b(?:CAP\s+)?National\s+Command\s+Board\s+Badge\b/i.test(text)) result.badges.push('cap_national_command_board_badge');

  // The aviation badges by the words a row names them in (importedAviationBadgesFromReport). CAPR 39-1 Attachment 7 calls the
  // top pilot rating Command Pilot; older text says Master. Where the report names no badge of a family, a held qualification of it brings
  // the family's basic badge (importedAviationBadgesFromQualifications): the Observer badge for a Mission Observer, the Air Crew badge for a
  // Mission Scanner or an Airborne Photographer. The member is told which badge came from which qualification, below.
  const aviationBadges = importedAviationBadgesFromReport(text);
  const qualifications = importedAviationBadgesFromQualifications(text, aviationBadges);
  result.badges.push(...aviationBadges, ...qualifications.brought.map(b => b.id));
  // The badge by name, or the qualification by its code or its name when the row does not say TRAINING (an IC3
  // trainee used to import the Incident Commander badge).
  if(/Master Incident Commander Badge|Incident Commander 1 Badge/i.test(text) || hasNonTrainingQualification(text, '\\b(?:IC1|Incident\\s+Commander\\s+(?:Level\\s+)?1)\\b(?!\\s+Badge)')) result.badges.push('incident_commander_1_badge');
  else if(/Senior Incident Commander Badge|Incident Commander 2 Badge/i.test(text) || hasNonTrainingQualification(text, '\\b(?:IC2|Incident\\s+Commander\\s+(?:Level\\s+)?2)\\b(?!\\s+Badge)')) result.badges.push('incident_commander_2_badge');
  else if(/Basic Incident Commander Badge|Incident Commander 3 Badge/i.test(text) || hasNonTrainingQualification(text, '\\b(?:IC3|Incident\\s+Commander\\s+(?:Level\\s+)?3)\\b(?!\\s+Badge)')) result.badges.push('basic_incident_commander_badge');
  else if(/\bIC[123]\b|Incident\s+Commander\s+(?:Level\s+)?[123]\b/i.test(text)) result.notes.push('Incident Commander training was found with no qualification, so no Incident Commander badge was imported (CAPR 39-1, 10.4.6).');
  if(/CAP Master Ground Team Badge/i.test(text) || hasNonTrainingQualification(text, '\\b(?:GTL|GTM1|Ground\\s+Team\\s+Leader|Ground\\s+Team\\s+Member\\s+(?:Level\\s+)?1)\\b')) result.badges.push('master_ground_team_badge');
  else if(/CAP Senior Ground Team Badge/i.test(text) || hasNonTrainingQualification(text, '\\b(?:GTM2|Ground\\s+Team\\s+Member\\s+(?:Level\\s+)?2)\\b')) result.badges.push('senior_ground_team_badge');
  else if(/CAP Basic Ground Team Badge/i.test(text) || hasNonTrainingQualification(text, '\\b(?:GTM3|Ground\\s+Team\\s+Member\\s+(?:Level\\s+)?3)\\b')) result.badges.push('ground_team_basic_badge');
  else if(/\bGTM3\b|Ground Team Member Level 3/i.test(text)) result.notes.push('Ground Team Member Level 3 was found as training or without an award, so no Ground Team badge was imported (CAPR 39-1, 10.4.5).');
  // A qualification the status says the member never held earns nothing, and the report says so.
  if(!result.badges.some(id => id.includes('ground_team'))){
    const note = memberReportNeverHeldNote(text, '\\b(?:GTL|GTM[123]|Ground\\s+Team\\s+Leader|Ground\\s+Team\\s+Member)\\b', 'A Ground Team qualification');
    if(note) result.notes.push(`${note.slice(0, -1)} (CAPR 39-1, 10.4.5).`);
  }
  if(!result.badges.some(id => id.includes('incident_commander'))){
    const note = memberReportNeverHeldNote(text, '\\b(?:IC[123]|Incident\\s+Commander\\s+(?:Level\\s+)?[123])\\b', 'An Incident Commander qualification');
    if(note) result.notes.push(`${note.slice(0, -1)} (CAPR 39-1, 10.4.6).`);
  }

  if(/CAP Master Emergency Services Qualification Badge/i.test(text)) result.badges.push('master_emergency_services_badge');
  else if(/CAP Senior Emergency Services Qualification Badge/i.test(text)) result.badges.push('senior_emergency_services_badge');
  else if(/CAP Basic Emergency Services Qualification Badge/i.test(text)) result.badges.push('emergency_services_badge');
  else if(/Technician Rating Exam:\s*Emergency Services/i.test(text)) {
    result.notes.push('An Emergency Services exam was found, but the badge comes from a rating in Specialty Tracks (CAPR 39-1, 10.5), so none was imported.');
  }

  if(memberReportNamesBadge(text, /Model\s+Rocketry/i)) result.badges.push('model_rocketry_badge');

  // CAPR 39-1 10.4.7: the EMT badges for a certified EMT-Basic, EMT-Intermediate (star) or EMT-Paramedic (star
  // and wreath), the highest certification named.
  if(memberReportNamesBadge(text, /\bEMT[\s-]*P(?:aramedic)?\b|\bParamedic\b/i)) result.badges.push('emt_paramedic');
  else if(memberReportNamesBadge(text, /\bEMT[\s-]*I(?:ntermediate)?\b/i)) result.badges.push('emt_intermediate');
  else if(memberReportNamesBadge(text, /\bEMT[\s-]*B(?:asic)?\b/i)) result.badges.push('emt_basic_badge');
  // CAPR 39-1 10.6-10.8 and 10.2.4: the badges awarded by name.
  if(memberReportNamesBadge(text, /\b(?:Cadet\s+)?STEM\s+Badge\b/i)) result.badges.push('stem_badges');
  if(memberReportNamesBadge(text, /\b(?:Cadet\s+)?Cyber\s+Badge\b/i)) result.badges.push('cyber_badges');
  if(memberReportNamesBadge(text, /\bNRA\s+Marksman(?:ship)?\b/i)) result.badges.push('nra_marksman_badge');
  if(memberReportNamesBadge(text, /\bVolunteer\s+University\s+Instructor\b/i)) result.badges.push('volunteer_university_instructor_badge');

  // Preserve every report-authorized badge for the grouped badge picker before
  // reducing the automatically worn set to the highest four selections.
  result.authorizedBadges = [...new Set(result.badges)]
    .filter(id => isBadgeEligibleForMembership(id, result.membership));

  // The aviation badges the member does not see on the uniform without being told why: one CAP aviation badge is worn
  // (CAPR 39-1, 4.1.5.2.2.4.1), and a badge the membership may not wear is not offered.
  const nameList = ids => ids.map(id => getBadgeDisplayName(id)).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const heldAviation = aviationBadges.filter(id => result.authorizedBadges.includes(id));
  for(const id of aviationBadges.filter(id => !heldAviation.includes(id))){
    result.notes.push(`${getBadgeDisplayName(id)} is in the report, but the builder does not authorize that badge for ${result.membership || 'this'} members, so it is not offered.`);
  }
  if(heldAviation.length > 1){
    result.notes.push(`The report names these aviation badges: ${nameList(heldAviation)}. One CAP aviation badge is worn at a time (CAPR 39-1, 4.1.5.2.2.4.1); the others are listed under Authorized by member report in the badge list.`);
  }
  // A Mission Pilot brings no badge: pilot wings are the pilot rating's, and the report names none.
  if(qualifications.held.includes('Mission Pilot') && !aviationBadges.some(id => IMPORTED_AVIATION_FAMILIES.pilot.ids.includes(id))){
    result.notes.push('Mission Pilot qualification found, but the report names no pilot badge or rating, and a badge is worn only when it has been awarded (CAPR 39-1, 10.3.1): none was imported. If you hold one, choose it in the badge list.');
  }
  result.badges = selectHighestWearableImportedBadges(result.badges, result.membership);
  // One line for each badge a qualification brought: which badge, from which qualification, so the member can change it. A badge the membership may
  // not wear is not offered; one that another aviation badge outranks is on the list under Authorized by member report, not worn.
  for(const b of qualifications.brought){
    const name = getBadgeDisplayName(b.id), from = memberReportNameList(b.qualifications);
    if(!result.authorizedBadges.includes(b.id)) result.notes.push(`${name}: the ${from} qualification brings it, but the builder does not authorize that badge for ${result.membership || 'this'} members, so it is not offered.`);
    else if(result.badges.includes(b.id)) result.notes.push(`${name}: taken from the ${from} qualification${b.qualifications.length > 1 ? 's' : ''}, since the report names no ${IMPORTED_AVIATION_FAMILIES[b.family].word} badge. Change it in the badge list.`);
    else result.notes.push(`${name}: taken from the ${from} qualification${b.qualifications.length > 1 ? 's' : ''}, since the report names no ${IMPORTED_AVIATION_FAMILIES[b.family].word} badge, and listed under Authorized by member report; another aviation badge is worn, as only one is at a time (CAPR 39-1, 4.1.5.2.2.4.1).`);
  }
  for(const r of result.ribbons){
    if(r && r.id && importedAwardCountFromValue(r.value) >= IMPORTED_MOST_AWARDS && /^(?:[a-z]+_)?(?:silver|bronze)_(?:clasp|star)|^wing_|^region_|^national_/.test(String(r.value))){
      result.notes.push(`${getRibbonDisplayName(r.id)}: the picker offers at most ${IMPORTED_MOST_AWARDS} awards, so ${IMPORTED_MOST_AWARDS} are used.`);
    }
  }
  result.ribbons = applyCosStarToHighestCadetMilestone(result.ribbons, text);
  result.ribbons = keepOnlyHighestCadetMilestoneForSenior(result.ribbons, result.membership, text, result.notes);
  result.ribbons = normalizeRecruiterRibbonsForMembership(result.ribbons, result.membership);
  result.ribbons = dedupeImportedRibbons(result.ribbons);

  return result;
}

function normalizeRecruiterRibbonsForMembership(ribbons, membership){
  return (ribbons || []).filter(ribbon => {
    if(ribbon?.id === 'cadet_recruiter_ribbon') return membership === 'cadet';
    if(ribbon?.id === 'cap_senior_recruiter_ribbon') return membership === 'senior';
    return true;
  });
}

function dedupeImportedRibbons(ribbons){
  const map = new Map();
  for(const r of ribbons){
    if(!r?.id) continue;
    // Later/high-level detections replace earlier basic detections for the same ribbon.
    map.set(r.id, r);
  }
  return [...map.values()];
}

function applyCapMemberReportImport(parsed){
  // As the setup's Member type and Rank selects do (js/setup.js): the adult-cadet option is cleared for a senior
  // member, a uniform the membership may not wear falls back to the first it may, and a rank the new membership
  // does not offer is cleared rather than kept from the previous member.
  if(parsed.membership){
    State.membership = parsed.membership;
    if(membershipTypeEl) membershipTypeEl.value = parsed.membership;
    if(State.membership !== 'cadet') State.adultCadet = false;
    if(typeof syncAdultCadetControl === 'function') syncAdultCadetControl();
    populateRankSetup();
    if(typeof isUniformAllowedFor === 'function' && !isUniformAllowedFor(State.uniform, State.membership)){
      State.uniform = (typeof findFirstAllowedUniform === 'function' && findFirstAllowedUniform(State.membership)) || 'blues_a';
    }
  }

  if(parsed.rank && RANKS[State.membership || 'cadet']?.includes(parsed.rank)){
    State.rank = parsed.rank;
    if(rankSetupSelect) rankSetupSelect.value = parsed.rank;
  }else if(State.rank && !RANKS[State.membership || 'cadet']?.includes(State.rank)){
    State.rank = null;
    if(rankSetupSelect) rankSetupSelect.value = '';
  }

  if(parsed.gender){
    State.gender = parsed.gender;
    if(jacketSelect) jacketSelect.value = parsed.gender;
  }

  // The name, as the setup's name fields hold it (js/wiring.js State.text, inputs capubV2FirstName and
  // capubV2LastName, "Show my name on the uniform" capubV2ShowText): the nameplates, name tapes and the polo
  // read it from State.text. An import with a name shows it.
  if(parsed.firstName || parsed.lastName){
    if(String(parsed.firstName || '').length > 40 || String(parsed.lastName || '').length > 40){
      parsed.notes = parsed.notes || [];
      parsed.notes.push('The name is longer than 40 letters, so the uniform shows the first 40 of each part.');
    }
    State.text = { ...(State.text || {}), firstName:String(parsed.firstName || '').slice(0, 40), lastName:String(parsed.lastName || '').slice(0, 40), show:true };
    const firstNameEl = by('capubV2FirstName'), lastNameEl = by('capubV2LastName'), showNameEl = by('capubV2ShowText');
    if(firstNameEl) firstNameEl.value = State.text.firstName;
    if(lastNameEl) lastNameEl.value = State.text.lastName;
    if(showNameEl) showNameEl.checked = true;
  }

  State.cadetFirstSergeant = !!parsed.cadetFirstSergeant && isCadetFirstSergeantEligible(State.rank);
  syncCadetFirstSergeantControl();

  normalizeRibbonSelections();
  normalizeBadgeSelections();

  // Clear current imported-selectable items so the report can populate a clean rack.
  for(const id of Object.keys(State.ribbonSelections)){
    State.ribbonSelections[id].checked = false;
    State.ribbonSelections[id].awardValue = '';
    State.ribbonSelections[id].awardLabel = '';
    State.ribbonSelections[id].devices = {};
  }
  for(const id of Object.keys(State.badgeSelections)){
    State.badgeSelections[id].checked = false;
  }

  normalizePatchSelections();
  for(const id of Object.keys(State.patchSelections)){
    State.patchSelections[id].checked = false;
  }
  State.patches = [];

  for(const r of parsed.ribbons || []){
    if(State.membership === 'senior' && r.id === 'cadet_recruiter_ribbon') continue;
    if(State.membership === 'cadet' && r.id === 'cap_senior_recruiter_ribbon') continue;
    if(isRibbonEligibleForMembership(r.id, State.membership)){
      selectImportedRibbon(r.id, r.value || 'earned');
    }
  }

  State.badges = [];
  // Which of the competing badges a position shows was chosen among the badges the member had; the report sets the badges anew.
  State.badgeChoices = {};
  State.reportAuthorizedBadgeIds = [...new Set(parsed.authorizedBadges || parsed.badges || [])]
    .filter(id => isBadgeEligibleForMembership(id, State.membership));
  // Reset command-insignia state on every member-report import so a previous
  // member's current/graduated commander status cannot carry over.
  if(State.commandInsignia) State.commandInsignia.graduatedCommander = false;
  const commandPins = ['squadron_commander_badge', 'group_commander_badge'];
  for(const pin of commandPins) if(State.badgeSelections?.[pin]) State.badgeSelections[pin].checked = false;
  // A past commander (one year or more) is a graduated commander: the pin under the nameplate, not over it.
  if(State.commandInsignia && (parsed.badges || []).some(id => commandPins.includes(id))) State.commandInsignia.graduatedCommander = (parsed.commandStatus === 'graduated');
  for(const id of parsed.badges || []){
    if(!isBadgeEligibleForMembership(id, State.membership)) continue;
    if(!State.badges.includes(id)) State.badges.push(id);
    if(State.badgeSelections[id]) State.badgeSelections[id].checked = true;
  }
  // Which of two badges of equal standing is worn higher stays for the badges the report keeps; a pair the report does not keep loses its choice.
  State.badgeOrder = CAPUBBadgeCatalog.pruneEqual(State.badgeOrder, State.badges);

  // Apply imported field-uniform patches. Unauthorized patches, especially
  // the Communications patch on OCPs, are kept out of State.patches.
  for(const id of parsed.patches || []){
    if(!PATCH_META[id]) continue;
    State.patchSelections[id] = State.patchSelections[id] || { checked:false };
    if(isPatchAuthorizedForUniform(id)){
      State.patchSelections[id].checked = true;
      if(!State.patches.includes(id)) State.patches.push(id);
    }else if(isCommsPatchId(id)){
      State.patchSelections[id].checked = false;
      parsed.notes = parsed.notes || [];
      parsed.notes.push('Communications patch not shown because it is not authorized on the selected OCP uniform.');
    }
  }
  clearUnauthorizedPatchesForCurrentUniform();

  applyMemberTypeToUniformOptions();
  highlightActiveUniformButton();
  buildRibbonGallery();
  rebuildRibbonsFromGallery();
  buildBadgeGallery();
  rebuildBadgesFromGallery();
  updateSetupGates();
  refreshUI();
  fullRender();
}

function confirmBeforeMemberReportUpload(){
  return window.confirm(
    'This uniform builder may make mistakes when importing a membership report.\n\n' +
    'Results can be affected by record inconsistencies, missing award entries, duplicate entries, old legacy records, or items that do not appear clearly in the report.\n\n' +
    'Some ribbons, badges, devices, or other items may not import correctly or may not appear at all, including items such as Unit Citation ribbons.\n\n' +
    'Please double-check the generated uniform against the member\'s official records and CAPR 39-1 before relying on the result.\n\n' +
    'Do you want to continue?'
  );
}

// The headings of a member report (eServices Member Search, Printer Friendly View - Member Details), in the order the report prints them. A file is
// a report when it has the General Information row with a CAPID (five to seven digits) or at least four of these headings in that order; a memo or a
// newsletter that happens to name two or three of them is not, and is not allowed to clear the member's build.
const MEMBER_REPORT_HEADINGS = [/General\s+Information/i, /Duty\s+Positions/i, /Professional\s+Development/i, /Specialty\s+Tracks/i,
  /Cadet\s+Training/i, /Encampments/i, /Orientation\s+Flights/i, /Cadet\s+Achievements/i, /\bAwards\b/i, /Promotions/i, /Decorations/i,
  /Activity\s*\/\s*Service\s+Ribbon/i, /Local\s+Activities/i];
function looksLikeMemberReport(text){
  const t = String(text || '').replace(/\s+/g, ' ');
  if(getCurrentProfileFromMemberReport(t)) return true;
  const info = t.search(/General\s+Information/i);
  if(info >= 0 && /\b\d{5,7}\b/.test(t.slice(info, info + 400))) return true;
  // Headings in order: each is looked for after the one before.
  let at = 0, inOrder = 0;
  for(const heading of MEMBER_REPORT_HEADINGS){
    const hit = heading.exec(t.slice(at));
    if(hit){ inOrder++; at += hit.index + hit[0].length; }
  }
  return inOrder >= 4;
}

function memberReportReadAnything(parsed){
  // The member type and gender alone are not read: without the grade row they come from a word such as "Cadet Training" or "MALE".
  return !!(parsed && (parsed.rank || parsed.firstName || parsed.lastName ||
    (parsed.ribbons || []).length || (parsed.badges || []).length || (parsed.authorizedBadges || []).length || (parsed.patches || []).length));
}

// The uniform as the member reads it, from its card ("Blues: Class A", "OCP").
function memberReportUniformName(id){
  const card = [...document.querySelectorAll('.uniformOption')].find(b => b.dataset.uniformId === id);
  const name = card && card.querySelector('.uName');
  return name && name.textContent.trim() ? name.textContent.trim() : String(id || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const memberReportNameList = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '';

// What the import read and could not put on the uniform, each with the reason, after the build has been applied: the patches a uniform does not
// wear, the badges beyond the four a member wears (the aviation ones are told in the notes), the badges this uniform does not wear, and the ribbons
// that were not placed because the membership is not offered them or another ribbon holds their place.
function memberReportHeldOffLines(parsed){
  const held = [];
  const uniform = memberReportUniformName(State.uniform);
  const patches = (parsed.patches || []).filter(id => !(State.patches || []).includes(id));
  const rule = (window.CAPUBUniformRules && CAPUBUniformRules.getUniformRule(State.uniform)) || {};
  if(patches.length){
    const names = memberReportNameList(patches.map(id => PATCH_META[id]?.label || id.replace(/_/g, ' ')));
    // Off a field or flight uniform the patches are for another uniform; on one, this uniform does not take them.
    held.push(rule.group === 'field' ? `${names}: not worn on ${uniform}.` : `${names}: not worn on ${uniform}. Patches are worn on the field and flight uniforms; add ${patches.length > 1 ? 'them' : 'it'} under Patches there.`);
  }
  const ribbonsChosen = Object.values(State.ribbonSelections || {}).filter(sel => sel && sel.checked).length;
  if(ribbonsChosen && rule.ribbons === 'none' && !rule.mini){
    held.push(`Ribbons: not worn on ${uniform}; the ${ribbonsChosen} are kept for the uniforms that wear them${rule.refs && rule.refs.ribbons ? ` (CAPR 39-1, ${rule.refs.ribbons})` : ''}.`);
  }
  const aviation = new Set(IMPORTED_AVIATION_BADGES.flatMap(kind => kind.ids));
  const beyond = (parsed.authorizedBadges || []).filter(id => !(parsed.badges || []).includes(id) && !aviation.has(id));
  if(beyond.length) held.push(`${memberReportNameList(beyond.map(id => getBadgeDisplayName(id)))}: only four badges are worn at a time (CAPR 39-1, 4.1.5.2.2.4); the others are listed under Authorized by member report in the badge list.`);
  const notWorn = typeof getSelectedBadgesNotWornOnCurrentUniform === 'function' ? getSelectedBadgesNotWornOnCurrentUniform(State.badges) : [];
  if(notWorn.length) held.push(`${memberReportNameList(notWorn.map(id => getBadgeDisplayName(id)))}: not worn on ${uniform}.`);
  const dropped = (parsed.ribbons || []).filter(r => r && r.id && !State.ribbonSelections[r.id]?.checked);
  const notOffered = dropped.filter(r => !isRibbonEligibleForMembership(r.id, State.membership));
  if(notOffered.length) held.push(`${memberReportNameList(notOffered.map(r => getRibbonDisplayName(r.id)))}: not offered to ${State.membership || 'these'} members.`);
  const shared = dropped.filter(r => !notOffered.includes(r));
  if(shared.length) held.push(`${memberReportNameList(shared.map(r => getRibbonDisplayName(r.id)))}: another ribbon you hold takes its place.`);
  return held;
}

// The notes js/patches.js writes (the Cadet Advisory Council ribbon and cord, the unit and activity patches) in the member's words. They are
// matched by their opening, so a note that changes there is shown as it is until it is added here. The ribbon and its star come from a council
// term that has been served, a past duty position; the shoulder cord is for a position held now (CAPR 39-3, 21j).
const MEMBER_REPORT_NO_CAC_RIBBON = 'Cadet Advisory Council Ribbon: none chosen, since no past duty position as chair, vice chair or representative of a council was found. A position held now gives the shoulder cord, not the ribbon\'s star (CAPR 39-3, 21j).';
const MEMBER_REPORT_PLAIN_NOTES = [
  [/^CAC ribbon imported as .*?: Cadet Advisory Council Ribbon listed in the report \(no level shown; basic ribbon\)\.?$/i, () => 'Cadet Advisory Council Ribbon: the basic ribbon, since no past council position shows a level.'],
  [/^CAC ribbon imported as (.*?): Highest qualifying CAC level found in duty assignments: (\w+)\.?$/i, (m, ribbon, level) => `Cadet Advisory Council Ribbon: ${level.charAt(0).toUpperCase()}${level.slice(1).toLowerCase()} level, from your past duty positions.`],
  [/^CAC ribbon imported as (.*?): (.*?)\.?$/i, (m, ribbon, why) => `Cadet Advisory Council Ribbon: ${ribbon}.`],
  [/^(.*?) shoulder cord - (\w+) imported from Current Duty Positions.*$/i, (m, cord) => `${cord.replace(/\bCAC\b/g, 'Cadet Advisory Council')} shoulder cord: the report shows a position on the council held now, which gives the cord and not the ribbon's star (CAPR 39-3, 21j).`],
  [/^CAC text found, but .*$/i, () => MEMBER_REPORT_NO_CAC_RIBBON],
  [/^Member report charter (\S+) found, but no unit patch image is mapped yet\.?$/i, (m, charter) => `No unit patch is offered for ${charter} yet.`],
  [/^Unit patch auto-selected from member report charter (\S+?)\.?$/i, (m, charter) => `The unit patch for ${charter} is chosen.`]
];
function memberReportPlainNoteLines(lines){
  return [...new Set((lines || []).map(line => {
    for(const [re, fn] of MEMBER_REPORT_PLAIN_NOTES){ const m = re.exec(line); if(m) return fn(...m); }
    return line;
  }))];
}

// Which notes stay in sight under the panel's counts and which go into the closed fold "More about this import". A note stays in sight when the import
// made a choice the member may want to change or must check: the level it gave a ribbon, a device it could not decide, a badge it took from a
// qualification or an appointment, the pin or the cord it chose, a patch a supplement requires, a name it cut. Would the member do anything differently
// after reading it? If not, it is in the fold: training that earns no badge, rows counted once, supplements brought in, a unit patch not offered yet and
// the like. A note this list does not name goes into the fold as well.
const MEMBER_REPORT_NOTES_IN_SIGHT = [
  /^(?:Cadet Advisory Council Ribbon|Command Service Ribbon): /,
  /^The report lists the .+ \d+ times and does not say what a repeated row stands for/,
  /add it under Ribbons if it applies/,
  /^.+: taken from the .+ qualifications?, since the report names no /,
  /^The report names these aviation badges: /,
  /^A (?:current )?National Staff appointment(?: of one full year or more)? was found: /,
  /^(?:Current commander duty found: the|Past commander duty of a year or more found: the) .+ command insignia pin/,
  /^Shoulder cords: (?:more than one supplement cord|the .+ cord from the report is chosen|the .+ cord is worn only at|the .+ cord \(.+\) is chosen)/,
  /^The .+ patch, which a supplement requires on this uniform, is chosen\./,
  /^The name is longer than 40 letters/,
  /^The Cadet Achievements heading was not found/
];
const memberReportNoteInSight = note => MEMBER_REPORT_NOTES_IN_SIGHT.some(re => re.test(note));

// The activities the report credits that no patch stands for, by the code each row leads with ("MKSABA"), each once: asked of js/patches.js, which holds
// the patches an activity's name matches. Nothing is said where that script is not loaded.
function memberReportActivitiesWithoutPatch(parsed){
  const detect = typeof window !== 'undefined' && window.CAPUBDetectNcsaPatches;
  if(typeof detect !== 'function') return [];
  const out = [];
  for(const row of parsed.activities || []){
    if(detect(row.title).length) continue;
    const lead = /^[A-Z][A-Z0-9]{1,9}\b/.exec(row.title);
    const name = lead && lead[0] !== 'NCSA' ? lead[0] : titleCaseImportedName(row.activity);
    if(!out.includes(name)) out.push(name);
  }
  return out;
}

// The lines the panel shows for a report that was applied: what was read, what is on the build, what was held off and why, what was not
// understood, and the notes. `replaced` is true when the member had ribbons, badges or patches that the report replaced.
function memberReportStatusLines(parsed, fileName, { replaced = false, before = {} } = {}){
  // What was read is what the build took: a grade, a name or a cut the report gave and the build did not take is not shown as read.
  const name = [State.text && State.text.firstName, State.text && State.text.lastName].filter(Boolean).join(' ');
  const tookName = !!(parsed.firstName || parsed.lastName) && State.text && State.text.firstName === String(parsed.firstName || '').slice(0, 40) && State.text.lastName === String(parsed.lastName || '').slice(0, 40);
  const read = [parsed.membership && State.membership === parsed.membership ? parsed.membership : '', parsed.gender && State.gender === parsed.gender ? parsed.gender : '',
    parsed.rank && State.rank === parsed.rank ? parsed.rank : '', tookName ? name : ''].filter(Boolean);
  const onBuild = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const ribbons = Object.values(State.ribbonSelections || {}).filter(s => s && s.checked).length;
  const lines = [
    'Imported the report.',
    `Read: ${read.length ? read.join(', ') : 'no grade, name or member type'}.`,
    `On the build: ${onBuild(ribbons, 'ribbon', 'ribbons')}, ${onBuild((State.badges || []).length, 'badge', 'badges')}, ${onBuild((State.patches || []).length, 'patch', 'patches')}.`
  ];
  const held = memberReportHeldOffLines(parsed);
  if(held.length) lines.push({ heading: 'Held off the uniform' }, ...held.map(item => ({ item })));
  const unread = [];
  const cut = g => g === 'female' ? "women's" : g === 'male' ? "men's" : '';
  // Each field the report did not give, or gave in a way the build did not take, says what the build has instead.
  if(!parsed.rank){
    unread.push(State.rank ? `The grade was not found, so the grade on the build (${State.rank}) was kept.` : 'The grade was not found, so none is chosen.');
  }else if(State.rank !== parsed.rank){
    unread.push(`The grade ${parsed.rank} was read but is not one a ${State.membership || 'this'} member holds, so ${State.rank ? `the grade on the build (${State.rank}) was kept` : 'none is chosen'}.`);
  }
  if(!parsed.gender) unread.push(cut(State.gender) ? `The gender was not found, so the ${cut(State.gender)} cut on the build was kept.` : 'The gender was not found, so no cut is chosen.');
  if(!parsed.membership) unread.push(State.membership ? `The member type was not found, so ${State.membership} was kept.` : 'The member type was not found, so none is chosen.');
  else if(!parsed.profileFound && parsed.gender) unread.push('The member type and gender come from words in the report, not from its first row. Check them.');
  if(!(parsed.firstName || parsed.lastName)) unread.push(name ? 'The name was not found, so the name on the uniform was kept.' : 'The name was not found, so the uniform has no name.');
  // The unit is the one the report's unit line names, when the builder's list has it (js/patches.js); otherwise none is chosen.
  if(!parsed.unitPatchCharter) unread.push('The unit was not found, so none is chosen.');
  if(!parsed.joinDateFound) unread.push('The join date was not found, so the Red Service Ribbon is not added.');
  unread.push(...(parsed.missingHeadings || []));
  const rows = parsed.unreadRows || [];
  unread.push(...rows.slice(0, 12).map(row => `${row}: no ribbon or badge matches this row.`));
  if(rows.length > 12) unread.push(`${rows.length - 12} more rows were not understood.`);
  if(unread.length) lines.push({ heading: 'Not understood' }, ...unread.map(item => ({ item })));
  // A Communications patch the uniform does not wear is told under Held off the uniform: its note would say it twice.
  const commsHeldOff = (parsed.patches || []).includes('comms_patch') && !(State.patches || []).includes('comms_patch');
  const notes = memberReportPlainNoteLines(capubImportNoteLines((parsed.notes || []).filter(n => !/^(?:Communications patch not shown|NCSA\/activity patch match)/.test(n))))
    .filter(n => !(commsHeldOff && /^A Communications specialty rating was found/.test(n)));
  const noPatch = memberReportActivitiesWithoutPatch(parsed);
  if(noPatch.length) notes.push(`No patch is offered yet for ${memberReportNameList(noPatch)}.`);
  const shown = notes.filter(memberReportNoteInSight);
  if(shown.length) lines.push({ heading: 'Notes' }, ...shown.map(item => ({ item })));
  if(replaced) lines.push('Your earlier ribbons, badges and patches were replaced by the report. Undo brings them back.');
  lines.push('Check the result against the member\'s record before relying on it.');
  const more = notes.filter(note => !memberReportNoteInSight(note));
  if(more.length) lines.push({ fold: 'More about this import', items: more });
  return lines;
}

// A report file in, the build changed and the lines to show out. A file that is not a report, has no text or cannot be opened ends in one
// plain sentence and leaves the build exactly as it was: nothing is cleared before the file is known to be a report with something in it.
async function importMemberReportFile(file, { isCurrent = () => true } = {}){
  const kind = memberReportFileKind(file);
  const fail = (message, code) => ({ ok:false, kind:kind || 'text', code, lines:[message] });
  let text;
  try{
    text = await extractMemberReportText(file);
  }catch(err){
    if(!(err && err.memberReportCode)) console.error(err);
    return fail(err && err.memberReportCode ? err.message : 'That file could not be read. Save the member report as a PDF, or copy its text into a .txt file.', err && err.memberReportCode || 'read');
  }
  if(!String(text).replace(/[\s\u200b-\u200d\u2060\ufeff\ufffe\ufffd]/g, '')){
    return fail(kind === 'pdf'
      ? 'That PDF has no text to read: it is a scan or a picture. Save the member report as a PDF from the browser, or copy its text into a .txt file.'
      : 'That file is empty.', 'empty');
  }
  if(!looksLikeMemberReport(text)){
    return fail('That does not look like a CAP member report: it has neither the General Information row nor the sections of a report in order. Use Printer Friendly View - Member Details from the member search.', 'notReport');
  }
  let parsed;
  try{
    parsed = parseCapMemberReport(text);
  }catch(err){
    console.error(err);
    return fail('This report could not be read, so nothing was changed.', 'parse');
  }
  if(!memberReportReadAnything(parsed)){
    return fail('The sections of a report are in the file, but nothing in them could be read, so nothing was changed.', 'nothing');
  }
  // A file chosen after this one has been read is the one the member wants: a slower PDF must not overwrite it.
  if(!isCurrent()) return { ok:false, kind:kind || 'text', code:'superseded', lines:[], superseded:true };
  const replaced = Object.values(State.ribbonSelections || {}).some(sel => sel && sel.checked) || (State.badges || []).length > 0 || (State.patches || []).length > 0;
  const preImport = memberReportBuildSignature();
  try{
    applyCapMemberReportImport(parsed);
  }catch(err){
    console.error(err);
    return fail('The report was read but could not be applied. Use Undo to go back to the build you had.', 'apply');
  }
  return { ok:true, kind:kind || 'text', parsed, preImport, authorized:[...(State.reportAuthorizedBadgeIds || [])], lines:memberReportStatusLines(parsed, file.name, { replaced }) };
}

let memberReportImportTurn = 0;
function wireMemberReportImporter(){
  const btn = by('importMemberReportBtn');
  const input = by('memberReportUpload');
  const clearBtn = by('clearImportedReportBtn');
  if(!btn || !input){ console.warn('Member report importer controls not found.'); return; }

  if(btn.dataset.memberImportWired === '1') return;
  btn.dataset.memberImportWired = '1';
  btn.addEventListener('click', () => {
    if(confirmBeforeMemberReportUpload()) input.click();
  });

  document.addEventListener('capub:rendered', markMemberReportPanelStale);
  clearBtn?.addEventListener('click', () => {
    memberReportShown = null;
    State.reportAuthorizedBadgeIds = null;
    input.value = '';
    buildBadgeGallery();
    setMemberReportImportStatus('The import notes are cleared and your build is as it was.');
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if(!file) return;

    // The change event of a file chosen later makes this one stale: whichever was chosen last is the one imported.
    const turn = ++memberReportImportTurn;
    try{
      setMemberReportImportStatus('Reading the file');
      const result = await importMemberReportFile(file, { isCurrent: () => turn === memberReportImportTurn });
      if(result.superseded) return;
      setMemberReportImportStatus(result.lines, result.ok ? 'ok' : 'error');
      if(result.ok) memberReportRememberImport(result);
      // Counts only: never the name, the file name or anything read from the report.
      const parsed = result.parsed;
      if(result.ok) window.CAPUB_TELEMETRY?.track('import', { ok: true, kind: result.kind, membership: !!parsed.membership, rank: !!parsed.rank, gender: !!parsed.gender, ribbons: parsed.ribbons.length, badges: parsed.badges.length, patches: (parsed.patches || []).length, notes: (parsed.notes || []).length });
      else window.CAPUB_TELEMETRY?.track('import', { ok: false, kind: result.kind });
    }catch(err){
      console.error(err);
      window.CAPUB_TELEMETRY?.track('import', { ok: false, kind: memberReportFileKind(file) || 'text' });
      setMemberReportImportStatus('The import stopped before it finished. Try the file again, or use Undo if the build changed.', 'error');
    }finally{
      input.value = '';
    }
  });
}
