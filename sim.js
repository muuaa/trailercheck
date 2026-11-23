/* Group chat simulator: truck groups with scripted teams, a trailer-check ticket and scoring. */
(function () {
  const root = document.getElementById('sim');
  if (!root) return;
  const UGL = window.UGL || { store: { get: (k, d) => d, set() {} }, markDone() {}, zoom() {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- dates ---------- */
  const today = new Date();
  const mdy = d => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const monthsAgo = n => { const d = new Date(today); d.setMonth(d.getMonth() - n); return d; };
  const my = d => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  /* ---------- people ---------- */
  const TEAMS = {
    fuel: { name: 'Fuel Team', handle: '@fuelteam23', color: '#b38b1d' },
    eld: { name: '𝙴𝙻𝙳 𝚃𝙴𝙰𝙼 6', handle: '@eld_team_6', color: '#6d7f8f' },
    pti: { name: 'PTI Team', handle: '@pti_team', color: '#8e6fd8' },
    maintenance: { name: 'Maintenance Management', handle: '@maintenance_leader', color: '#d0559a' },
    safety: { name: 'Adam Safety', handle: '@safetyassistant', color: '#e0843a' }
  };
  const ME = { name: 'You', team: 'Trailer Check', handle: '@trailercheck' };

  /* ---------- training documents (generated) ---------- */
  const DOC = {
    inspection: d => `<div class="sdoc"><h4>ANNUAL VEHICLE INSPECTION REPORT</h4><div class="sub">Periodic inspection · 49 CFR 396.17</div>
      <table><tr><th>Date</th><th>Unit #</th><th>Plate</th></tr><tr><td>${d.date}</td><td>${d.unit}</td><td>${d.plate}</td></tr>
      <tr><th colspan="3">VIN</th></tr><tr><td colspan="3">${d.vin}</td></tr>
      <tr><th>Vehicle type</th><th>Inspector</th><th>Result</th></tr><tr><td>Semi-trailer</td><td>Certified inspector</td><td><b>${d.result}</b></td></tr></table>
      <div class="stamp">${d.result}</div><div class="train">Training sample</div></div>`,
    sticker: d => `<div class="sticker"><b>ANNUAL INSPECTION</b><div class="big">${d.result === 'PASSED' ? '✔' : '✖'}</div><b>${d.result}</b><small>Inspected ${d.date}</small><small>Unit ${d.unit}</small><small>VIN …${d.vin.slice(-6)}</small><small style="color:#7a1d1d">TRAINING SAMPLE</small></div>`,
    bol: d => `<div class="sdoc"><h4>STRAIGHT BILL OF LADING</h4><div class="sub">BOL # ${d.no} · Date ${d.date}</div>
      <table><tr><th>Ship from</th><th>Ship to (consignee)</th></tr><tr><td>${d.from}</td><td><b>${d.to}</b></td></tr>
      <tr><th>Trailer #</th><th>Seal #</th></tr><tr><td>${d.trailer}</td><td>${d.seal}</td></tr></table><br>
      <table><tr><th>Qty</th><th>HM</th><th>Description</th><th>Weight (lb)</th></tr>
      <tr><td>${d.qty}</td><td>${d.hm ? 'X' : ''}</td><td>${d.desc}</td><td>${d.weight}</td></tr>
      <tr><td></td><td></td><td><b>TOTAL</b></td><td><b>${d.weight}</b></td></tr></table>
      <div class="train">Training sample</div></div>`,
    reg: d => `<div class="sdoc"><h4>${d.state} REGISTRATION</h4><div class="sub">Apportioned · Original</div>
      <table><tr><th>Unit No.</th><th>VIN</th><th>Plate No.</th></tr><tr><td>${d.unit}</td><td>${d.vin}</td><td>${d.plate}</td></tr>
      <tr><th>Year / Make</th><th>Vehicle type</th><th>Validity period</th></tr><tr><td>${d.year}</td><td>Semi-trailer</td><td><b>${d.validity}</b></td></tr></table>
      <div class="train">Training sample</div></div>`
  };

  /* ---------- scenarios ---------- */
  const T = (from, text, att, delay) => ({ from, text, att, delay });
  const img = (src, label) => ({ kind: 'img', src, label });
  const vid = (src, label) => ({ kind: 'video', src, label });
  const doc = (type, data, label) => ({ kind: 'doc', type, data, label });
  const reMeasure = /(king ?pin|kpra|last axle|measure|distance)/i;
  const reReg = /(registration|cab ?card|expir|\breg\b)/i;

  const trip = (id, pu, puWhen, puAddr, del, delWhen, delAddr, rate, miles) =>
    `🗺 Trip ID : ${id}\n\n📍1#: ${id}\nLoaded - Preloaded\n${puWhen}\n ${pu}\n ${puAddr}\n—————————————\n📍2#: ${id}\nLoaded - Drop\n${delWhen}\n ${del}\n ${delAddr}\n—————————————\n💰 Rate: $${rate}\n🚛 Trip: ${miles}mi\n\n❌Late PU: $1000\n❌Late DEL: $700\n❌No Update: $200\n❌No PU, DEL trailer photos: $200`;
  const fuelStop = (n, pilot, addr, hwy, drv) => `Fuel stop #${n}⛽️\nPilot #${pilot}\nAddress: ${addr}\nInterstate: ${hwy}\nAmount: Full Tank ${drv}\n\nPlease ensure that the correct mileage is entered in the Relay app each time you refuel. Thank you ⚠️`;
  const photos = (list) => list.map(a => T('driver', '', [a], 700));

  const SC = [
    {
      id: '2308', title: 'NOVA 2308 James / Peter', members: 45,
      driver: { name: 'James Carter', handle: '@james_c', color: '#d9534f' },
      people: { dispatch: { name: 'Kamron (Leo)', handle: '@leo_disp2', color: '#4fae4e' }, updaters: { name: 'Nova Update', handle: '@nova_update', color: '#3f8fd2' } },
      pin: 'Trip 1173KQ9P2 · Columbus, OH → Newark, NJ',
      hint: 'Look at the trip: the drop is in New Jersey, which has a 41 ft KPRA limit, so ask the driver to measure. Check the BOL weight: over 30,000 lb means a certified scale. And there is only a sticker, so ask the dispatcher for the inspection paper.',
      intro: [
        T('dispatch', trip('1173KQ9P2', 'CMH4', 'Thu, 01:30 PM EST', '6050 Gateway Ct, Groveport, OH 43125', 'EWR9', 'Fri, 04:10 AM EST', '8003 Industrial Ave, Newark, NJ 07114', '1520.00', '536.20')),
        T('dispatch', '@fuelteam23'),
        T('fuel', fuelStop(1, 312, '7735 Pleasant Valley Rd, Hebron, OH 43025', 'I-70, Exit 126', '@james_c')),
        ...photos([img('img/reg-indiana.jpg', 'photo'), doc('sticker', { unit: 'SV2200663', vin: '1DW1A5326NBA85270', date: my(monthsAgo(5)), result: 'PASSED' }), doc('bol', { no: 'TRN-55120', date: mdy(today), from: 'Sample Distribution Center, Columbus, OH', to: 'Sample Retail DC, Newark, NJ', trailer: 'SV2200663', seal: '4471902', qty: '24 PLT', hm: false, desc: 'General merchandise', weight: '36,400' })]),
        T('eld', 'copy'),
        T('driver', '', [vid('video/ex-light-test.mp4', 'video')]),
        T('dispatch', '@trailercheck')
      ],
      triggers: [
        { re: reMeasure, flag: 'askedKpra', reply: [T('driver', '42 ft 3 in', null, 3200)] },
        { re: /(slide|slid|tandem|move.{0,12}axle)/i, need: 'askedKpra', flag: 'slid', reply: [T('driver', 'slid it 3 holes, now 40 ft 8 in', null, 4200)] },
        { re: /(scale|\bcat\b|weigh)/i, flag: 'askedScale', reply: [T('driver', 'ok I will stop at the cat scale', null, 2600)] }
      ],
      required: [
        { flag: 'askedPaper', label: 'Asked the dispatcher or updater for the inspection paper', why: 'Only a sticker: it can roll, but the paper is still needed from the broker.' },
        { flag: 'askedKpra', label: 'Asked the driver to measure KPRA', why: 'The drop is in Newark, NJ: 41 ft limit.' },
        { flag: 'askedScale', label: 'Told the driver to go to a CAT scale', why: '36,400 lb is over 30,000 lb.' }
      ],
      issues: true
    },
    {
      id: '1146', title: 'BLUE LINE 1146 Ahmed', members: 38,
      driver: { name: 'Ahmed Hassan', handle: '@ahmed_h', color: '#c0392b' },
      people: { dispatch: { name: 'Bekzod (Ryan)', handle: '@ryan_disp', color: '#4fae4e' }, updaters: { name: 'Blue Line Update', handle: '@blueline_upd', color: '#3f8fd2' } },
      pin: 'Trip 11Q7H3XZ8 · Topeka, KS → Fargo, ND',
      hint: 'Open the BOL carefully: look at the HM column and the UN numbers, and find the real total weight. Also check the print date. Hazmat has to be reported right away.',
      intro: [
        T('dispatch', trip('11Q7H3XZ8', 'Home Depot 3701', 'Thu, 09:00 AM CST', '1250 SW Lower Silver Lake Rd, Topeka, KS 66615', 'Home Depot Fargo', 'Fri, 06:30 AM CST', '4440 13th Ave S, Fargo, ND 58103', '1790.00', '689.40')),
        T('dispatch', '@fuelteam23'),
        T('fuel', fuelStop(1, 905, '2310 N 3rd St, Atchison, KS 66002', 'US-59', '@ahmed_h')),
        ...photos([img('img/reg-tennessee.jpg', 'photo'), doc('inspection', { date: mdy(monthsAgo(8)), unit: '204242', plate: '247605T', vin: '3H3V532K3PS037248', result: 'PASSED' }), img('img/bol-homedepot.jpg', 'photo')]),
        T('eld', 'copy'),
        T('driver', '', [vid('video/walkaround.mp4', 'video')]),
        T('updaters', '@trailercheck')
      ],
      triggers: [
        { re: /(date|today|11\/16|printed|old)/i, flag: 'askedDate', reply: [T('driver', 'they gave me this one today', null, 2800)] },
        { re: /(hazmat|hazard|acetone|un ?1090|un ?3266|placard)/i, flag: 'mentionHaz', reply: [T('driver', 'yes they said few small boxes hazmat', null, 2600)] },
        { re: /(light|video|again|show|clear|dark|brake|suspension)/i, flag: 'askedVideo', reply: [T('driver', '', [vid('video/ex-light-test.mp4', 'video')], 4800)] }
      ],
      required: [
        { flag: 'informedHaz', label: 'Told the dispatcher or updater it is a hazmat load', why: 'X in the HM column and UN numbers on the BOL. Hazmat is reported right away.' },
        { flag: 'informedDate', label: 'Mentioned the BOL date is not today', why: 'The BOL was printed 11/16.' },
        { flag: 'askedVideo', label: 'Asked for a clearer video', why: 'The night video is too dark to see the lights and tires.' }
      ],
      issues: true
    },
    {
      id: '5170', title: 'EAGLE 5170 Mike / Tom', members: 41,
      driver: { name: 'Mike Ross', handle: '@mikeross_77', color: '#b03a2e' },
      people: { dispatch: { name: 'Sardor (Alex)', handle: '@alex_disp7', color: '#4fae4e' }, updaters: { name: 'Eagle Update', handle: '@eagle_upd1', color: '#3f8fd2' } },
      pin: 'Trip 114PZ8RW1 · Jacksonville, FL → Atlanta, GA',
      hint: 'This registration has no expiry date: that is valid. Check the video: is anything missing?',
      intro: [
        T('dispatch', trip('114PZ8RW1', 'JAX3', 'Thu, 11:15 AM EST', '13333 103rd St, Jacksonville, FL 32221', 'ATL6', 'Thu, 11:40 PM EST', '4200 N Commerce Dr, East Point, GA 30344', '980.00', '346.80')),
        T('dispatch', '@fuelteam23'),
        ...photos([img('img/reg-mississippi.jpg', 'photo'), doc('inspection', { date: mdy(monthsAgo(3)), unit: '536290', plate: '166148A', vin: '1UYVS2535S3489027', result: 'PASSED' }), img('img/bol-amazon.jpg', 'photo')]),
        T('fuel', fuelStop(1, 87, '1650 GA-155, McDonough, GA 30253', 'I-75, Exit 216', '@mikeross_77')),
        T('driver', '', [vid('video/ex-light-test.mp4', 'video')]),
        T('eld', 'copy'),
        T('dispatch', '@trailercheck')
      ],
      triggers: [
        { re: reReg, flag: 'askedReg', reply: [T('driver', 'thats the only one i have in the truck', null, 3000)] },
        { re: /(brake|suspension|under|tread|gauge|tire)/i, flag: 'askedUnder', reply: [T('driver', '', [vid('video/ex-underneath.mp4', 'video')], 5200), T('driver', '', [vid('video/ex-tires-gauge.mp4', 'video')], 3000)] }
      ],
      required: [
        { flag: 'askedUnder', label: 'Asked for brakes, suspension and tread', why: 'The video shows no underneath and no tread gauge.' }
      ],
      issues: true
    },
    {
      id: '3021', title: 'EAGLE 3021 Carlos', members: 37,
      driver: { name: 'Carlos Diaz', handle: '@carlos_dz', color: '#a93226' },
      people: { dispatch: { name: 'Sardor (Alex)', handle: '@alex_disp7', color: '#4fae4e' }, updaters: { name: 'Eagle Update', handle: '@eagle_upd1', color: '#3f8fd2' } },
      pin: 'Empty move · Indianapolis, IN → yard',
      hint: 'Watch the video. Can you see every light working? If not, ask for the light test. There is only a sticker too, so ask the dispatcher for the inspection paper.',
      intro: [
        T('dispatch', 'empty move to the yard 🚛\nIND9 → Plainfield yard\npick up empty trailer and drop at the yard'),
        ...photos([doc('reg', { state: 'INDIANA', unit: 'GV2201175', vin: '1DW1A5329PBA70421', plate: 'PE98411', year: '2023 STO', validity: '01-MAR-2023 TO NO EXPIRY' }), doc('sticker', { unit: 'GV2201175', vin: '1DW1A5329PBA70421', date: my(monthsAgo(2)), result: 'PASSED' })]),
        T('driver', 'empty'),
        T('driver', '', [vid('video/walkaround.mp4', 'video')]),
        T('eld', 'copy'),
        T('updaters', '@trailercheck')
      ],
      triggers: [
        { re: /(light|video|again|side|show|retake|flash|clear|dark|test)/i, flag: 'askedLights', reply: [T('driver', '', [vid('video/ex-light-test.mp4', 'video')], 4500), T('driver', '', [vid('video/abs-light.mp4', 'video')], 2200)] }
      ],
      required: [
        { flag: 'askedLights', label: 'Asked for the light test video', why: 'The night video is too dark and fast to see every light.' },
        { flag: 'askedPaper', label: 'Asked the dispatcher or updater for the inspection paper', why: 'Only a sticker: it can roll, but the paper is still needed.' }
      ],
      issues: false
    },
    {
      id: '4521', title: 'ACME 4521 Daniel / Joe', members: 44,
      driver: { name: 'Daniel Kim', handle: '@daniel_kim', color: '#c0392b' },
      people: { dispatch: { name: 'Jasur (Mark)', handle: '@mark_disp3', color: '#4fae4e' }, updaters: { name: 'Acme Update', handle: '@acme_update', color: '#3f8fd2' } },
      pin: 'Trip 113RC5KD9 · Joliet, IL → Fresno, CA',
      hint: 'The application receipt is accepted as the registration. The drop is in California (40 ft KPRA). Check the sides in the video for skirts, and there is only a sticker.',
      intro: [
        T('dispatch', trip('113RC5KD9', 'MDW2', 'Thu, 07:00 AM CST', '250 Emerald Dr, Joliet, IL 60433', 'FAT1', 'Sat, 02:20 PM PST', '3575 S Orange Ave, Fresno, CA 93725', '5480.00', '2108.70')),
        T('dispatch', '@fuelteam23'),
        T('fuel', fuelStop(1, 263, '3001 E 4th St, Ottawa, IL 61350', 'I-80, Exit 93', '@daniel_kim')),
        ...photos([img('img/reg-illinois.jpg', 'photo'), doc('sticker', { unit: '—', vin: '1DW1A5322TBC10617', date: my(monthsAgo(6)), result: 'PASSED' }), doc('bol', { no: 'TRN-80433', date: mdy(today), from: 'Sample Warehouse, Joliet, IL', to: 'Sample Grocery DC, Fresno, CA', trailer: 'STO-10617', seal: '9902117', qty: '20 PLT', hm: false, desc: 'Packaged food', weight: '22,800' })]),
        T('driver', '', [vid('video/ex-sides-rear.mp4', 'video')]),
        T('eld', 'copy'),
        T('dispatch', '@trailercheck')
      ],
      triggers: [
        { re: reReg, flag: 'askedReg', reply: [T('driver', 'office said the real one coming by mail', null, 3000)] },
        { re: reMeasure, flag: 'askedKpra', reply: [T('driver', '39 ft 6 in', null, 3400)] },
        { re: /skirt/i, flag: 'askedSkirts', reply: [T('driver', 'no skirts on this one', null, 2200)] }
      ],
      required: [
        { flag: 'askedKpra', label: 'Asked the driver to measure KPRA', why: 'California has a 40 ft limit.' },
        { flag: 'informedSkirts', label: 'Told the dispatcher or updater: no side skirts, going to CA', why: 'A 53 ft box trailer going to California without side skirts: inform.' },
        { flag: 'askedPaper', label: 'Asked the dispatcher or updater for the inspection paper', why: 'Only a sticker: it can roll, but the paper is still needed.' }
      ],
      issues: true
    },
    {
      id: '7742', title: 'PRIME 7742 Yusuf', members: 40,
      driver: { name: 'Yusuf Ahmed', handle: '@yusuf_a', color: '#b9472f' },
      people: { dispatch: { name: 'Otabek (Chris)', handle: '@chris_disp5', color: '#4fae4e' }, updaters: { name: 'Prime Update', handle: '@prime_upd', color: '#3f8fd2' } },
      pin: 'Empty move · rental trailer → Amazon yard',
      hint: 'Compare the driver’s video with the full PTI video. What is missing? Ask for exactly that, the way the team does.',
      intro: [
        T('dispatch', 'empty rental trailer to the amazon yard\npapers are saved on the website'),
        T('driver', '', [vid('video/ex-full-daytime.mp4', 'video')]),
        T('eld', 'copy'),
        T('dispatch', '@trailercheck')
      ],
      triggers: [
        { re: /(light|abs|acc)/i, flag: 'askedLights', reply: [T('driver', '', [vid('video/ex-light-test.mp4', 'video')], 4800), T('driver', '', [vid('video/abs-light.mp4', 'video')], 2400)] },
        { re: /(brake|suspension|under|beneath)/i, flag: 'askedBrakes', reply: [T('driver', '', [vid('video/ex-underneath.mp4', 'video')], 5200)] },
        { re: /(tread|gauge)/i, flag: 'askedTread', reply: [T('driver', '', [vid('video/ex-tires-gauge.mp4', 'video')], 4600)] }
      ],
      required: [
        { flag: 'askedLights', label: 'Asked for the light test and ABS', why: 'The daytime video shows no lights at all.' },
        { flag: 'askedBrakes', label: 'Asked to see brakes and suspension', why: 'Nothing underneath the trailer is shown.' }
      ],
      issues: false
    }
  ];

  const LIM = { CA: '40 ft', MI: '40 ft 6 in (min 37 ft 6 in)', IL: '42 ft 6 in (Class III)', CT: '43 ft', IN: '43 ft', ME: '43 ft', MN: '43 ft', NY: '43 ft', WI: '43 ft' };
  'AL DC FL MD NC NH NJ PA RI SC TN VA VT'.split(' ').forEach(s => LIM[s] = '41 ft');

  /* ---------- runtime state ---------- */
  const results = UGL.store.get('ugl-sim', {});
  window.addEventListener('ugl-reset', () => { Object.keys(results).forEach(k => delete results[k]); try { renderList(); } catch (e) {} });
  const S = {};
  SC.forEach(sc => S[sc.id] = { msgs: [], flags: {}, fired: {}, result: null, unread: sc.intro.length, started: false, timers: [], tipped: false });
  let cur = SC[0].id;

  /* ---------- shell ---------- */
  root.innerHTML = `
    <aside class="s-list"><div class="s-search"><div>Search</div></div><div class="s-chats" id="sChats"></div></aside>
    <section class="s-main">
      <div class="s-top"><div class="av sm" id="sAv"></div><div><b id="sTitle"></b><small id="sSub"></small></div><button class="btn ghost" id="sHelp" title="Get a hint">Hint</button></div>
      <div class="s-pin"><b>Pinned message</b><span id="sPin"></span></div>
      <div class="s-msgs" id="sMsgs" aria-live="polite"></div>
      <div class="typing" id="sTyping"></div>
      <div class="s-compose">
        <div class="s-mention" id="sMention" hidden></div>
        <div class="s-row"><textarea id="sInput" aria-label="Message" placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"></textarea><button class="s-send" id="sSend" aria-label="Send">➤</button></div>
      </div>
    </section>
    <aside class="s-side"><div class="s-side-h"><b id="sSideT">Your job</b><button class="btn ghost" id="sReset" title="Start this truck over">Restart</button></div><div class="s-form" id="sForm"></div><div class="s-foot" id="sFoot"></div></aside>`;
  const $ = id => document.getElementById(id);

  const who = (from, x) => from === 'driver' ? null : ((x || sc()).people[from] || TEAMS[from]);
  const sc = () => SC.find(x => x.id === cur);
  const initials = t => t.replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  function renderList() {
    $('sChats').innerHTML = SC.map(x => {
      const st = S[x.id], last = st.msgs[st.msgs.length - 1], r = results[x.id];
      const prev = last ? (last.from === 'me' ? 'You: ' : '') + (last.text || (last.att ? '📎 Attachment' : '')) : (x.intro[0] ? x.intro[0].text.split('\n')[0] : '');
      const badge = r != null ? `<span class="s-badge ${r >= 80 ? 'ok' : 'mid'}">${r}%</span>` : (st.unread ? `<span class="s-badge">${st.unread}</span>` : '');
      return `<button class="s-chat ${x.id === cur ? 'on' : ''}" data-id="${x.id}"><span class="av" style="background:${x.driver.color}">${x.id.slice(0, 2)}</span><span class="s-name">${esc(x.title)}</span><span class="s-time">${last ? last.time : ''}</span><span class="s-prev">${esc(prev)}</span>${badge}</button>`;
    }).join('');
    root.querySelectorAll('.s-chat').forEach(b => b.onclick = () => open(b.dataset.id));
  }

  function fmtText(t) {
    return esc(t).replace(/(@[a-z0-9_]+)/gi, '<span class="at">$1</span>');
  }
  function attHTML(a, mi, ai) {
    const k = `${mi}-${ai}`;
    if (a.kind === 'img') return `<button data-att="${k}"><img src="${a.src}" alt="${esc(a.label)}"></button>`;
    if (a.kind === 'video') return `<button data-att="${k}"><video src="${a.src}" muted preload="metadata"></video><span class="play">▶</span></button>`;
    return `<button class="doc-thumb" data-att="${k}"><span class="doc-in">${DOC[a.type](a.data)}</span></button>`;
  }
  function msgHTML(m, i) {
    if (m.from === 'sys') return `<div class="m sys"><span>${esc(m.text)}</span></div>`;
    if (m.from === 'tip') return `<div class="m sys tip"><span>💡 ${esc(m.text)}</span></div>`;
    const x = sc();
    if (m.from === 'me') return `<div class="m out"><div class="bub">${m.att ? `<div class="att">${m.att.map((a, j) => attHTML(a, i, j)).join('')}</div>` : ''}<div class="txt">${fmtText(m.text)}</div><span class="meta">${m.time} ✓✓</span></div></div>`;
    const p = m.from === 'driver' ? { name: x.driver.name, color: x.driver.color } : who(m.from, x);
    return `<div class="m"><span class="av sm" style="background:${p.color}">${initials(p.name)}</span><div class="bub"><span class="who" style="color:${p.color}">${esc(p.name)}</span>${m.att ? `<div class="att">${m.att.map((a, j) => attHTML(a, i, j)).join('')}</div>` : ''}${m.text ? `<div class="txt">${fmtText(m.text)}</div>` : ''}<span class="meta">${m.time}</span></div></div>`;
  }
  function renderMsgs() {
    const st = S[cur], box = $('sMsgs');
    box.innerHTML = st.msgs.map(msgHTML).join('');
    box.querySelectorAll('[data-att]').forEach(b => b.onclick = () => { const [mi, ai] = b.dataset.att.split('-').map(Number); view(st.msgs[mi].att[ai]); });
    box.scrollTop = box.scrollHeight;
  }

  function view(a) {
    const m = document.createElement('div'); m.className = 'modal';
    let inner = '';
    if (a.kind === 'img') inner = `<img src="${a.src}" alt="${esc(a.label)}">`;
    else if (a.kind === 'video') inner = `<video src="${a.src}" controls autoplay muted playsinline></video>`;
    else inner = DOC[a.type](a.data);
    m.innerHTML = `<button class="x" aria-label="Close">✕</button><div class="inner">${inner}</div>`;
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    m.onclick = e => { if (e.target === m || e.target.classList.contains('x')) close(); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(m);
  }

  /* ---------- message queue ---------- */
  function push(id, m) {
    const st = S[id];
    st.msgs.push({ ...m, time: clock() });
    if (id === cur) renderMsgs(); else st.unread++;
    renderList();
  }
  function play(id, list, base = 0) {
    const st = S[id], x = SC.find(s => s.id === id);
    let t = base;
    list.forEach(m => {
      t += m.delay != null ? m.delay : (m.from === 'sys' ? 300 : 900 + Math.min(1600, (m.text || '').length * 18) + (m.att ? 500 : 0));
      const name = m.from === 'driver' ? x.driver.name : (who(m.from, x) || {}).name;
      if (m.from !== 'sys' && m.from !== 'tip') st.timers.push(setTimeout(() => { if (id === cur) $('sTyping').textContent = `${name} is ${m.att ? 'sending a file' : 'typing'}…`; }, Math.max(base, t - 700)));
      st.timers.push(setTimeout(() => { if (id === cur) $('sTyping').textContent = ''; push(id, m); }, t));
    });
    return t;
  }

  /* ---------- trainee messages ---------- */
  function send() {
    const inp = $('sInput'), text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    const id = cur, st = S[id], x = sc();
    push(id, { from: 'me', text });
    const lower = text.toLowerCase();
    const has = h => lower.includes(h.toLowerCase());
    const replies = [];
    let driverAnswered = false;

    x.triggers.forEach((tr, i) => {
      if (st.fired[i] || !tr.re.test(text) || (tr.need && !st.flags[tr.need])) return;
      st.fired[i] = true; st.flags[tr.flag] = true; replies.push(...tr.reply); driverAnswered = true;
    });

    const P = x.people, first = n => n.toLowerCase().replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 2 && w !== 'update');
    const named = q => has(q.handle) || first(q.name).some(w => new RegExp('\\b' + w + '\\b', 'i').test(text));
    const tagD = named(P.dispatch), tagU = named(P.updaters), tagDr = has(x.driver.handle);
    if ((tagD || tagU) && /(paper|inspection)/i.test(text) && /(request|broker|need|send|ask)/i.test(text)) st.flags.askedPaper = true;
    if (tagD || tagU) {
      st.flags.informed = true;
      if (/hazmat|hazard/i.test(text)) st.flags.informedHaz = true;
      if (/skirt/i.test(text)) st.flags.informedSkirts = true;
      if (/(date|today|11\/16|printed)/i.test(text)) st.flags.informedDate = true;
      if (tagD) replies.push(T('dispatch', st.flags.askedPaper ? 'Working on it' : 'ok informing ROC', null, 2200)); else replies.push(T('updaters', 'noted', null, 1800));
    }
    if (tagDr && !driverAnswered && !(tagD || tagU)) replies.push(T('driver', 'ok', null, 2200));
    if (has(TEAMS.safety.handle)) replies.push(T('safety', 'ty', null, 2400));
    if (has(TEAMS.maintenance.handle)) replies.push(T('maintenance', 'Okay', null, 2400));
    if (has(TEAMS.pti.handle)) replies.push(T('pti', 'copy', null, 2000));
    if (/\bhelp\b/i.test(text)) replies.push(T('tip', x.hint, null, 600));
    if (/\b(g2g|gtg|good to go)\b/i.test(text)) {
      st.flags.saidGtg = true;
      replies.push(T('tip', 'Trailer Check never writes gtg in the group: the dispatcher does. Issues or not, you create the ticket on the Trailer Check website.', null, 600));
    }
    if (replies.length) play(id, replies);
  }

  /* ---------- side panel ---------- */
  function renderForm() {
    const st = S[cur];
    $('sSideT').textContent = `Truck ${cur}`;
    $('sForm').innerHTML = `<div class="stack">
      <p>The driver sends photos of whatever papers they have. Check every one, and the trailer video.</p>
      <ol class="todo">
        <li>Open every photo, document and video.</li>
        <li>Missing or unclear? <b>Ask the driver</b> for exactly that.</li>
        <li>Not sure? Ask in the group: the other teams will help.</li>
        <li>Sure there's an issue? Tell the <b>dispatcher</b> or an <b>updater</b> exactly what is wrong. Nothing rolls with an open issue.</li>
        <li>Type <b>@</b> to mention someone. Work out who is who from what they write.</li>
        <li>Issues or not, <b>create the ticket</b> on the Trailer Check website. Never write <b>gtg</b> (good to go) in the group.</li>
        <li>Press <b>Finish truck</b> to see your score.</li>
      </ol>
      <p class="hint">You create the ticket on the Trailer Check website, not here. This is chat practice only.</p>
      <details><summary>KPRA limits</summary><p class="hint">40 ft CA · 40 ft 6 in MI (min 37 ft 6 in) · 41 ft AL DC FL MD NC NH NJ PA RI SC TN VA VT · 42 ft 6 in IL · 43 ft CT IN ME MN NY WI. Measure kingpin to the center of the last axle.</p></details>
    </div>`;
    $('sFoot').innerHTML = `<button class="btn" id="sSubmit">Finish truck</button>`;
    $('sSubmit').onclick = grade;
    if (st.result) showResult();
  }

  /* ---------- grading (chat actions only) ---------- */
  function grade() {
    const st = S[cur], x = sc(), f = st.flags;
    const rows = x.required.map(r => ({ ok: !!f[r.flag], label: r.label, why: f[r.flag] ? '' : r.why }));
    rows.push({ ok: !f.saidGtg, label: 'Did not write “good to go” (gtg) in the group', why: f.saidGtg ? 'We never say gtg. Issues or not, create the ticket on the Trailer Check website.' : '' });
    const score = Math.round(rows.filter(r => r.ok).length / rows.length * 100);
    st.result = { score, rows };
    results[cur] = Math.max(results[cur] || 0, score);
    UGL.store.set('ugl-sim', results);
    if (SC.every(s => (results[s.id] || 0) >= 80)) UGL.markDone('simulator');
    push(cur, { from: 'sys', text: `Truck ${x.id} finished. Score ${score}%` });
    showResult();
  }
  function showResult() {
    const r = S[cur].result;
    const li = x => `<li><span class="mk ${x.ok ? 'y' : 'n'}">${x.ok ? '✓' : '✕'}</span><span><b>${esc(x.label)}</b>${x.why ? `<span class="why">${esc(x.why)}</span>` : ''}</span></li>`;
    $('sForm').innerHTML = `<div class="s-result"><div class="qnum">Your score</div><div class="score">${r.score}%</div>
      <div class="result ${r.score >= 80 ? 'good' : 'warn'}"><strong>${r.score >= 80 ? 'Passed' : 'Not yet'}</strong>${r.score >= 80 ? 'Good work. Try the next truck.' : 'Read the feedback, then press Restart to try this truck again. Stuck? Press Ask lead.'}</div>
      <ul>${r.rows.map(li).join('')}</ul></div>`;
    const next = SC.find(s => !S[s.id].result && s.id !== cur);
    $('sFoot').innerHTML = next ? `<button class="btn" id="sNext">Next truck: ${esc(next.id)} →</button>` : '';
    if (next) $('sNext').onclick = () => open(next.id);
  }

  /* ---------- open / reset ---------- */
  function open(id) {
    cur = id;
    const x = sc(), st = S[id];
    st.unread = 0;
    $('sAv').textContent = x.id.slice(0, 2); $('sAv').style.background = x.driver.color;
    $('sTitle').textContent = x.title;
    $('sSub').textContent = `${x.members} members`;
    $('sPin').textContent = '🗺 ' + x.pin;
    $('sTyping').textContent = '';
    renderList(); renderMsgs(); renderForm();
    if (!st.started) { st.started = true; play(id, x.intro, 200); }
  }
  function reset() {
    const st = S[cur];
    st.timers.forEach(clearTimeout);
    S[cur] = { msgs: [], flags: {}, fired: {}, result: null, unread: 0, started: false, timers: [], tipped: false };
    open(cur);
  }

  function members() { const x = sc(); return [{ name: x.driver.name, handle: x.driver.handle, color: x.driver.color }, x.people.dispatch, x.people.updaters, ...Object.values(TEAMS)]; }
  function mention() {
    const inp = $('sInput'), box = $('sMention'), m = inp.value.slice(0, inp.selectionStart).match(/@(\w*)$/);
    if (!m) { box.hidden = true; return; }
    const q = m[1].toLowerCase(), list = members().filter(u => !q || u.name.toLowerCase().includes(q) || u.handle.slice(1).toLowerCase().startsWith(q));
    if (!list.length) { box.hidden = true; return; }
    box.innerHTML = list.map(u => `<button data-h="${u.handle}"><span class="av sm" style="background:${u.color}">${initials(u.name)}</span><span><b>${esc(u.name)}</b><small>${u.handle}</small></span></button>`).join('');
    box.hidden = false;
    box.querySelectorAll('button').forEach(b => b.onmousedown = e => { e.preventDefault(); const pos = inp.selectionStart, before = inp.value.slice(0, pos).replace(/@\w*$/, b.dataset.h + ' '); inp.value = before + inp.value.slice(pos); inp.focus(); inp.selectionStart = inp.selectionEnd = before.length; box.hidden = true; });
  }
  $('sInput').addEventListener('input', mention);
  $('sInput').addEventListener('blur', () => setTimeout(() => $('sMention').hidden = true, 150));
  $('sSend').onclick = send;
  $('sInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $('sHelp').onclick = () => play(cur, [T('tip', sc().hint, null, 300)]);
  $('sReset').onclick = reset;

  let booted = false;
  const boot = () => { if (!booted && !document.getElementById('v-simulator').hidden) { booted = true; open(cur); } };
  window.addEventListener('hashchange', boot);
  renderList();
  boot();
})();
