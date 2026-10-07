// Hemlo Tools · Repair receipt & warranty card
// Everything runs in the browser. The business profile is shared with the invoice maker, so it is filled in once.
(function () {
  'use strict';

  // ---------- text ----------
  const UI = {
    ar: {
      appTitle: 'وصل التصليح وكارت الضمان', newJob: 'جديد', whatsapp: 'واتساب', print: 'حفظ PDF',
      tabEdit: 'تعديل', tabPreview: 'معاينة',
      secDoc: 'المستند', receipt: 'وصل الاستلام', warranty: 'كارت الضمان',
      paperA5: 'ورق A5', paperThermal: 'طابعة 80 مم', number: 'رقم الوصل', date: 'التاريخ',
      readyDate: 'التسليم المتوقع', warrantyFor: 'مدة الضمان', warrantyUnit: 'الوحدة', warrantyExpiry: 'يُحسب تاريخ انتهاء الضمان تلقائياً من تاريخ المستند.',
      secBiz: 'معلومات المحل', bizHint: 'مشتركة مع صانع الفواتير: تُكتب مرة واحدة وتظهر في كل مستند.', logo: 'الشعار', stamp: 'الختم / التوقيع',
      bizName: 'اسم المحل أو الشركة', phone: 'الهاتف', extra: 'معلومة إضافية (اختياري)', address: 'العنوان',
      secCust: 'الزبون', custName: 'اسم الزبون',
      secDevice: 'الجهاز', deviceType: 'النوع', brand: 'الماركة', model: 'الموديل', serial: 'الرقم التسلسلي / IMEI',
      secFault: 'العطل والعمل', reported: 'العطل كما وصفه الزبون', diagnosis: 'التشخيص', workDone: 'العمل المنجز',
      secCondition: 'حالة الجهاز عند الاستلام', conditionHint: 'ضع علامة على ما هو موجود مسبقاً على الجهاز، حتى لا يكون هناك خلاف لاحقاً.', conditionNote: 'ملاحظة على الحالة (اختياري)',
      secAcc: 'المرفقات المستلمة مع الجهاز', accOther: 'أخرى (اكتبها)',
      secItems: 'القطع والأجور', desc: 'البيان', qty: 'الكمية', price: 'السعر', addItem: '+ إضافة سطر', showWords: 'كتابة المبلغ بالحروف (تفقيط)',
      secWarranty: 'شروط الضمان', warrantyTerms: 'الشروط',
      secNotes: 'ملاحظات', notes: 'ملاحظات إضافية',
      upsellL: 'للورش التي تريد أكثر من وصل', upsellB: 'كل التصليحات في مكان واحد',
      upsellN: 'هذا الوصل يوثّق تصليحاً واحداً. هيملو للأنظمة يتابع كل الأجهزة في ورشتك: حالتها، وموعد التسليم، والقطع المستعملة، ومن لم يدفع، وينبهك قبل الموعد — ويطبع نفس هذا الوصل والكارت آلياً لكل زبون.',
      upsellA: 'شاهد هيملو لأنظمة الورش ←',
      b1: 'شاشة هاتف — بانتظار قطعة', b2: 'مكيف ٢٤٬٠٠٠ — قيد التصليح', b3: 'لابتوب — تم التسليم',
      privacy: 'لا نرسل بياناتك إلى أي مكان: كل شيء يُحفظ ويُعالج على جهازك.',
      confirmNew: 'بدء وصل جديد؟ ستبقى معلومات محلك محفوظة.', waNeedsName: 'اكتب اسم الزبون أولاً.',
    },
    en: {
      appTitle: 'Repair receipt & warranty card', newJob: 'New', whatsapp: 'WhatsApp', print: 'Save PDF',
      tabEdit: 'Edit', tabPreview: 'Preview',
      secDoc: 'Document', receipt: 'Receipt', warranty: 'Warranty card',
      paperA5: 'A5 paper', paperThermal: '80 mm printer', number: 'Receipt no.', date: 'Date',
      readyDate: 'Expected delivery', warrantyFor: 'Warranty period', warrantyUnit: 'Unit', warrantyExpiry: 'The expiry date is worked out from the document date.',
      secBiz: 'Your workshop', bizHint: 'Shared with the invoice maker: fill it in once and it appears on every document.', logo: 'Logo', stamp: 'Stamp / signature',
      bizName: 'Business name', phone: 'Phone', extra: 'Extra line (optional)', address: 'Address',
      secCust: 'Customer', custName: 'Customer name',
      secDevice: 'Device', deviceType: 'Type', brand: 'Brand', model: 'Model', serial: 'Serial / IMEI',
      secFault: 'Fault and work', reported: 'Fault as reported by the customer', diagnosis: 'Diagnosis', workDone: 'Work carried out',
      secCondition: 'Condition of the device on arrival', conditionHint: 'Tick what was already on the device, so there is no argument later.', conditionNote: 'Note on the condition (optional)',
      secAcc: 'Accessories taken in with the device', accOther: 'Others (write them)',
      secItems: 'Parts and labour', desc: 'Description', qty: 'Qty', price: 'Price', addItem: '+ Add line', showWords: 'Write the amount in words',
      secWarranty: 'Warranty terms', warrantyTerms: 'Terms',
      secNotes: 'Notes', notes: 'Extra notes',
      upsellL: 'For workshops that want more than a receipt', upsellB: 'Every repair in one place',
      upsellN: 'This receipt documents one repair. Hemlo Systems tracks every device in your workshop: its status, the due date, the parts used, who has not paid, and it warns you before the deadline — and it prints this same receipt and warranty card automatically for every customer.',
      upsellA: 'See Hemlo Systems →',
      b1: 'Phone screen — awaiting part', b2: 'AC 24,000 — in progress', b3: 'Laptop — delivered',
      privacy: 'Nothing is sent anywhere: your data stays and is processed on this device.',
      confirmNew: 'Start a new receipt? Your business details stay saved.', waNeedsName: 'Enter the customer name first.',
    },
  };
  const DOC = {
    ar: { receipt: 'وصل استلام وتصليح', warranty: 'كارت ضمان', no: 'الرقم', date: 'التاريخ', ready: 'التسليم المتوقع',
      cust: 'الزبون', tel: 'هاتف', device: 'الجهاز', type: 'النوع', brand: 'الماركة', model: 'الموديل', serial: 'الرقم التسلسلي',
      reported: 'العطل كما وصفه الزبون', diagnosis: 'التشخيص', done: 'العمل المنجز', condition: 'حالة الجهاز عند الاستلام', acc: 'المرفقات المستلمة',
      parts: 'القطع والأجور', desc: 'البيان', qty: 'الكمية', price: 'السعر', amount: 'المبلغ', total: 'الإجمالي', words: 'المبلغ كتابةً',
      notes: 'ملاحظات', terms: 'شروط الضمان', forPeriod: 'مدة الضمان', expires: 'ينتهي الضمان في', custSign: 'توقيع الزبون', shopSign: 'ختم المحل' },
    en: { receipt: 'Repair receipt', warranty: 'Warranty card', no: 'No.', date: 'Date', ready: 'Expected delivery',
      cust: 'Customer', tel: 'Tel', device: 'Device', type: 'Type', brand: 'Brand', model: 'Model', serial: 'Serial',
      reported: 'Fault as reported', diagnosis: 'Diagnosis', done: 'Work carried out', condition: 'Condition on arrival', acc: 'Accessories taken in',
      parts: 'Parts and labour', desc: 'Description', qty: 'Qty', price: 'Price', amount: 'Amount', total: 'Total', words: 'Amount in words',
      notes: 'Notes', terms: 'Warranty terms', forPeriod: 'Warranty period', expires: 'Warranty expires on', custSign: 'Customer signature', shopSign: 'Shop stamp' },
  };
  const DEVTYPE = {
    ar: { phone: 'هاتف', laptop: 'لابتوب', ac: 'مكيف', tv: 'تلفاز', car: 'سيارة', other: 'أخرى' },
    en: { phone: 'Phone', laptop: 'Laptop', ac: 'AC', tv: 'TV', car: 'Car', other: 'Other' },
  };
  const ACC = [
    { k: 'charger', ar: 'شاحن', en: 'Charger' }, { k: 'battery', ar: 'بطارية', en: 'Battery' },
    { k: 'case', ar: 'غلاف / كفر', en: 'Case' }, { k: 'sim', ar: 'شريحة ذاكرة', en: 'SIM' },
    { k: 'memcard', ar: 'كرت ذاكرة', en: 'Memory card' }, { k: 'box', ar: 'علبة', en: 'Box' },
    { k: 'cable', ar: 'كابل', en: 'Cable' }, { k: 'headset', ar: 'سماعة', en: 'Headset' },
  ];
  const COND = [
    { k: 'none', ar: 'بدون خدوش', en: 'No damage' }, { k: 'scratches', ar: 'خدوشات على الهيكل', en: 'Scratches on body' },
    { k: 'screen', ar: 'شاشة مكسورة', en: 'Cracked screen' }, { k: 'back', ar: 'خدوش أو كسر بالظهر', en: 'Damaged back' },
    { k: 'water', ar: 'أثر دخول ماء', en: 'Water damage signs' }, { k: 'prev', ar: 'تعديل أو لحام سابق', en: 'Previous repair' },
    { k: 'missing', ar: 'قطع ناقصة', en: 'Missing parts' },
  ];
  const TERMS_AR = 'يشمل الضمان العمل المُنجز والقطع المُركّبة، ولا يشمل سوء الاستخدام أو الكسر أو الصدمات أو دخول السوائل أو الفقد، ولا يشمل الصيانة الدورية.\nهذا الكارت هو إثبات الصيانة، يُرجى الاحتفاظ به.';
  const TERMS_EN = 'The warranty covers the work carried out and the parts fitted. It does not cover misuse, drops, liquid damage, loss, or routine maintenance.\nThis card is the proof of service; please keep it.';

  // ---------- state ----------
  const K_JOB = 'hemlo.repair.job.v1', K_BIZ = 'hemlo.invoice.business.v1', K_SEQ = 'hemlo.repair.seq.v1';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked: keep working */ } },
  };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const nextNumber = () => {
    const seq = store.get(K_SEQ, { n: 0 }); seq.n = (seq.n || 0) + 1; store.set(K_SEQ, seq);
    return 'J-' + String(seq.n).padStart(4, '0');
  };
  const blankJob = () => ({
    docType: 'receipt', paper: 'a5', number: nextNumber(), date: today(), ready: '',
    warrantyVal: 90, warrantyUnit: 'd', warrantyTerms: TERMS_AR,
    cust: { name: '', phone: '' },
    device: { type: '', brand: '', model: '', serial: '' },
    fault: { reported: '', diagnosis: '', done: '' },
    condition: ['none'], conditionNote: '', acc: [], accOther: '',
    items: [{ d: '', q: 1, p: '' }], words: true, notes: '',
  });

  let uiLang = store.get('hemlo.uiLang', 'ar');
  let job = store.get(K_JOB, null) || blankJob();
  let biz = store.get(K_BIZ, { name: '', phone: '', address: '', extra: '', logo: '', stamp: '' });
  if (!job.warrantyTerms) job.warrantyTerms = uiLang === 'en' ? TERMS_EN : TERMS_AR;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const curLabel = L => (L === 'ar' ? 'د.ع' : 'IQD');
  const money = (n, L) => `<bdi dir="ltr">${fmt(n)}</bdi> ${curLabel(L)}`;
  const pick = list => list.map(c => `<span>${esc(c[uiLang])}</span>`).join('');
  const devType = () => (job.device.type ? DEVTYPE[uiLang][job.device.type] || '' : '');

  // ---------- totals ----------
  function totals() {
    const lines = job.items.map(it => num(it.q) * num(it.p));
    return { lines, total: lines.reduce((a, b) => a + b, 0) };
  }
  function fmtDate(d) {
    if (!d) return '';
    const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  }
  function addPeriod(dateStr, val, unit) {
    if (!dateStr || !val) return '';
    const d = new Date(dateStr + 'T00:00:00'); if (isNaN(d)) return '';
    if (unit === 'm') d.setMonth(d.getMonth() + val); else d.setDate(d.getDate() + val);
    return iso(d);
  }
  function periodText() {
    const v = num(job.warrantyVal); if (!v) return '';
    if (job.warrantyUnit === 'm') return v + (uiLang === 'ar' ? ' شهراً' : (v === 1 ? ' month' : ' months'));
    return v + (uiLang === 'ar' ? ' يوماً' : (v === 1 ? ' day' : ' days'));
  }

  // ---------- print page size (set at runtime so the same sheet serves A5 and thermal) ----------
  const ps = document.createElement('style');
  document.head.appendChild(ps);
  const setPageSize = () => { ps.textContent = docSize(); };
  const docSize = () => (job.paper === 'a5' ? '@media print{@page{size:A5;margin:0}}' : '@media print{@page{size:80mm auto;margin:0}}');

  // ---------- UI text ----------
  function applyUI() {
    const T = UI[uiLang];
    document.documentElement.lang = uiLang;
    document.documentElement.dir = uiLang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-t]').forEach(el => { const k = el.getAttribute('data-t'); if (T[k]) el.textContent = T[k]; });
    $('#lang').textContent = uiLang === 'ar' ? 'EN' : 'عربي';
    document.title = T.appTitle + ' · Hemlo Tools';
    renderChips(); renderItems(); renderOnly();
  }

  // ---------- form binding ----------
  function getPath(o, path) { return path.split('.').reduce((a, k) => (a ? a[k] : undefined), o); }
  function setPath(o, path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
  const target = key => (key.startsWith('biz.') ? { o: biz, k: key.slice(4) } : { o: job, k: key });

  function fillForm() {
    $$('[data-k]').forEach(el => {
      const { o, k } = target(el.dataset.k); const v = getPath(o, k);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
    });
    ['docType', 'paper'].forEach(s => $$('[data-seg="' + s + '"] button').forEach(b => b.classList.toggle('on', b.dataset.v === job[s])));
    ['logo', 'stamp'].forEach(showImg);
  }
  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.k) return;
    const { o, k } = target(el.dataset.k);
    setPath(o, k, el.type === 'checkbox' ? el.checked : el.value);
    save(); queueRender();
  });
  document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.k) { save(); queueRender(); } });
  $$('[data-seg] button').forEach(b => b.addEventListener('click', () => {
    const seg = b.parentElement.dataset.seg; if (job[seg] === b.dataset.v) return;
    job[seg] = b.dataset.v; fillForm(); renderOnly(); setPageSize(); save(); queueRender();
  }));

  // show only the fields that belong to the selected document
  function renderOnly() {
    $$('[data-only]').forEach(el => { el.hidden = el.dataset.only !== job.docType; });
  }

  // ---------- checklist chips ----------
  function renderChips() {
    $('#condition').innerHTML = COND.map(c => `<label class="chip"><input type="checkbox" data-c="condition" value="${c.k}"${job.condition.includes(c.k) ? ' checked' : ''}><span>${esc(c[uiLang])}</span></label>`).join('');
    $('#acc').innerHTML = ACC.map(c => `<label class="chip"><input type="checkbox" data-c="acc" value="${c.k}"${job.acc.includes(c.k) ? ' checked' : ''}><span>${esc(c[uiLang])}</span></label>`).join('');
  }
  document.addEventListener('change', e => {
    const c = e.target.dataset && e.target.dataset.c; if (!c) return;
    const set = new Set(job[c]); if (e.target.checked) set.add(e.target.value); else set.delete(e.target.value);
    job[c] = [...set];
    if (c === 'condition' && e.target.checked && e.target.value === 'none') {   // "no damage" excludes the rest
      job.condition = ['none'];
      $$('#condition input').forEach(i => { i.checked = i.value === 'none'; });
    }
    save(); queueRender();
  });

  // ---------- items ----------
  function renderItems() {
    const T = UI[uiLang];
    $('#items').innerHTML = job.items.map((it, i) => `
      <div class="item" data-i="${i}">
        <label><span>${T.desc}</span><input data-f="d" value="${esc(it.d)}"></label>
        <label><span>${T.qty}</span><input data-f="q" type="number" inputmode="decimal" min="0" step="any" value="${esc(it.q)}"></label>
        <label><span>${T.price}</span><input data-f="p" type="number" inputmode="decimal" min="0" step="any" value="${esc(it.p)}"></label>
        <button type="button" class="rm" aria-label="Remove line"${job.items.length < 2 ? ' disabled style="visibility:hidden"' : ''}>×</button>
      </div>`).join('');
  }
  $('#items').addEventListener('input', e => {
    const row = e.target.closest('.item'); if (!row || !e.target.dataset.f) return;
    job.items[+row.dataset.i][e.target.dataset.f] = e.target.value; save(); queueRender();
  });
  $('#items').addEventListener('click', e => {
    if (!e.target.classList.contains('rm')) return;
    job.items.splice(+e.target.closest('.item').dataset.i, 1); renderItems(); save(); queueRender();
  });
  $('#addItem').addEventListener('click', () => {
    job.items.push({ d: '', q: 1, p: '' }); renderItems(); save(); queueRender();
    const rows = $$('#items .item'); rows[rows.length - 1].querySelector('input').focus();
  });

  // ---------- images (resized before saving, to keep storage small) ----------
  function showImg(kind) {
    const box = $('.up[data-img="' + kind + '"]'); const src = biz[kind];
    box.classList.toggle('has', !!src);
    box.querySelector('.up-prev').innerHTML = src ? '<img src="' + src + '" alt="">' : '';
  }
  $$('.up').forEach(box => {
    const kind = box.dataset.img;
    box.querySelector('input').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 600, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        biz[kind] = c.toDataURL('image/png'); URL.revokeObjectURL(url);
        showImg(kind); save(); queueRender();
      };
      img.src = url; e.target.value = '';
    });
    box.querySelector('.x').addEventListener('click', e => { e.preventDefault(); biz[kind] = ''; showImg(kind); save(); queueRender(); });
  });

  // ---------- the document ----------
  // Every document is drawn once from a label set (D) plus a language flag, so Arabic and English cannot drift apart.
  function head(D, ar) {
    const O = ar ? DOC.en : DOC.ar;
    const meta = [biz.phone && D.tel + ': <span dir="ltr">' + esc(biz.phone) + '</span>', esc(biz.address), esc(biz.extra)].filter(Boolean).join('<br>');
    return `<header class="d-head">
      <div class="d-biz">
        ${biz.logo ? '<img class="d-logo" src="${biz.logo}" alt="">' : ''}
        <div><div class="d-bizname">${esc(biz.name) || '<span class="empty">' + (ar ? 'اسم محلك' : 'Your workshop') + '</span>'}</div>${meta ? '<div class="d-bizmeta">${meta}</div>' : ''}</div>
      </div>
      <div class="d-title">
        <h2>${D[job.docType]}</h2>
        ${ar ? '' : `<div class="sub" dir="rtl">${O[job.docType]}</div>`}
        <dl class="d-meta">
          <dt>${D.no}</dt><dd>${esc(job.number)}</dd>
          <dt>${D.date}</dt><dd>${fmtDate(job.date)}</dd>
          ${job.docType === 'receipt' && job.ready ? `<dt>${D.ready}</dt><dd>${fmtDate(job.ready)}</dd>` : ''}
        </dl>
      </div>
    </header><div class="d-rule"></div>`;
  }
  const sec = (lbl, body) => body ? '<div class="r-sec"><div class="r-lbl">' + lbl + '</div>' + body + '</div>' : '';
  const kv = rows => '<dl class="r-kv">' + rows.filter(Boolean).join('') + '</dl>';
  const row = (k, v, cls) => v ? '<dt>' + k + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(v) + '</dd>' : '';
  const block = txt => txt ? '<div class="r-tx">' + esc(txt) + '</div>' : '';
  const plain = items => '<div class="r-list">' + items.map(p => `<span>${esc(p)}</span>`).join('') + '</div>';

  // ticked checklists
  function condBody(D) {
    const on = job.condition.filter(k => k !== 'none');
    let out = '';
    if (!on.length && job.condition.indexOf('none') >= 0) out = '<div class="r-chips">' + pick([COND[0]]) + '</div>';
    else if (on.length) out = '<div class="r-chips">' + pick(COND.filter(c => on.indexOf(c.k) >= 0)) + '</div>';
    if (job.conditionNote) out += '<div class="r-note">' + esc(job.conditionNote) + '</div>';
    return out;
  }
  function accBody() {
    const on = ACC.filter(a => job.acc.indexOf(a.k) >= 0);
    if (!on.length && !job.accOther) return '';
    let out = on.length ? '<div class="r-chips">' + pick(on) + '</div>' : '';
    if (job.accOther) out += '<div class="r-note">' + esc(job.accOther) + '</div>';
    return out;
  }
  const deviceKV = D => kv([
    row(D.type, devType()),
    row(D.brand, job.device.brand), row(D.model, job.device.model),
    row(D.serial, job.device.serial, 'num'),
  ]);
  const custKV = D => kv([row(D.cust, job.cust.name), row(D.tel, job.cust.phone, 'num')]);

  function receipt(D, ar) {
    const t = totals();
    const rows = job.items.map((it, i) => {
      if (!(it.d || it.p !== '')) return '';
      return '<tr><td class="idx num">' + (i + 1) + '</td><td class="desc">' + (esc(it.d) || '<span class="empty">—</span>') + '</td><td class="num">' + esc(it.q) + '</td><td class="num">' + (it.p === '' ? '' : fmt(num(it.p))) + '</td><td class="num">' + fmt(t.lines[i]) + '</td></tr>';
    }).join('');
    const words = job.words && t.total > 0
      ? '<div class="d-words"><div class="lbl">' + D.words + '</div><div class="w">' + (ar ? Tafqit.ar(t.total, 'IQD') : Tafqit.en(t.total, 'IQD')) + '</div></div>'
      : '<div class="d-words"></div>';
    return head(D, ar) +
      sec(D.cust, custKV(D)) +
      sec(D.device, deviceKV(D)) +
      sec(D.reported, block(job.fault.reported)) +
      sec(D.diagnosis, block(job.fault.diagnosis)) +
      sec(D.done, block(job.fault.done)) +
      sec(D.condition, condBody(D)) +
      sec(D.acc, accBody()) +
      sec(D.parts, rows
        ? '<table class="r-t"><thead><tr><th class="idx num">#</th><th>' + D.desc + '</th><th class="num">' + D.qty + '</th><th class="num">' + D.price + '</th><th class="num">' + D.amount + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
          '<div class="r-sum">' + words + '<div class="r-total"><span>' + D.total + '</span><span>' + money(t.total, ar ? 'ar' : 'en') + '</span></div></div>'
        : '') +
      sec(D.notes, block(job.notes)) +
      sign(D) + foot();
  }

  function warranty(D, ar) {
    const expiry = addPeriod(job.date, num(job.warrantyVal), job.warrantyUnit);
    const parts = job.items.filter(i => i.d).map(i => i.d);
    const box = '<div class="w-expiry"><span>' + D.forPeriod + ': ' + esc(periodText() || '—') +
      '</span><span>' + D.expires + ' <b>' + fmtDate(expiry) + '</b></span></div>';
    return head(D, ar) +
      sec(D.cust, custKV(D)) +
      sec(D.device, deviceKV(D)) +
      sec(D.done, block(job.fault.done)) +
      (parts.length ? sec(D.parts, plain(parts)) : '') +
      box +
      sec(D.terms, job.warrantyTerms ? '<div class="r-terms">' + esc(job.warrantyTerms) + '</div>' : '') +
      (job.notes ? sec(D.notes, block(job.notes)) : '') +
      sign(D) + foot();
  }

  function sign(D) {
    return '<div class="d-sign">' +
      '<div class="box"><div style="height:18mm"></div><div class="line">' + D.custSign + '</div></div>' +
      '<div class="box">' + (biz.stamp ? '<img src="' + biz.stamp + '" alt="">' : '<div style="height:18mm"></div>') + '<div class="line">' + D.shopSign + '</div></div>' +
      '</div>';
  }
  const foot = () => '<footer class="d-foot"><span>' + esc(job.number) + '</span><span class="made"><img src="../shared/hemlo-mark.svg" alt="">Made with Hemlo Tools · tools.hemlohq.com</span></footer>';

  function render() {
    const ar = uiLang === 'ar', D = ar ? DOC.ar : DOC.en;
    const page = $('#page');
    page.lang = ar ? 'ar' : 'en'; page.dir = ar ? 'rtl' : 'ltr';
    page.className = 'page ' + job.paper;
    page.innerHTML = job.docType === 'receipt' ? receipt(D, ar) : warranty(D, ar);
    fit();
  }
  // scale the sheet to the preview width
  function fit() {
    const wrap = $('#pageWrap'), page = $('#page'), box = $('.preview');
    if (!box.offsetParent) return;
    const cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = page.offsetWidth, h = page.offsetHeight; if (!w || avail <= 0) return;
    const s = Math.min(1, avail / w);
    page.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    wrap.style.width = w * s + 'px'; wrap.style.height = h * s + 'px';
  }
  window.addEventListener('resize', fit);

  let rq = 0;
  function queueRender() { if (!rq) rq = requestAnimationFrame(() => { rq = 0; render(); }); }

  // ---------- save ----------
  let t0;
  function save() { clearTimeout(t0); t0 = setTimeout(() => { store.set(K_JOB, job); store.set(K_BIZ, biz); }, 250); }

  // ---------- actions ----------
  $('#lang').addEventListener('click', () => {
    uiLang = uiLang === 'ar' ? 'en' : 'ar'; store.set('hemlo.uiLang', uiLang);
    if (job.warrantyTerms === TERMS_AR || job.warrantyTerms === TERMS_EN) job.warrantyTerms = uiLang === 'en' ? TERMS_EN : TERMS_AR;
    applyUI(); fillForm(); render();
  });
  $('#new').addEventListener('click', () => {
    if (!confirm(UI[uiLang].confirmNew)) return;
    const keep = { paper: job.paper, docType: job.docType, warrantyUnit: job.warrantyUnit, warrantyTerms: job.warrantyTerms };
    job = Object.assign(blankJob(), keep);
    applyUI(); fillForm(); render(); save();
  });
  $('#print').addEventListener('click', () => {
    const name = (job.number || 'receipt').replace(/[^\w-]+/g, '_');
    const prev = document.title;
    const go = () => { setPageSize(); render(); document.title = name; window.print(); setTimeout(() => (document.title = prev), 500); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
  });
  $('#wa').addEventListener('click', () => {
    if (!job.cust.name) { alert(UI[uiLang].waNeedsName); return; }
    const ar = uiLang === 'ar', D = ar ? DOC.ar : DOC.en, t = totals();
    const lines = [
      (job.docType === 'receipt' ? D.receipt : D.warranty) + ' ' + job.number + (biz.name ? ' · ' + biz.name : ''),
      D.cust + ': ' + job.cust.name,
      job.device.model ? D.device + ': ' + [job.device.brand, job.device.model].filter(Boolean).join(' ') : '',
      job.fault.reported ? D.reported + ': ' + job.fault.reported : '',
      job.fault.done ? D.done + ': ' + job.fault.done : '',
      t.total > 0 ? D.total + ': ' + fmt(t.total) + ' ' + curLabel(ar ? 'ar' : 'en') : '',
      t.total > 0 && job.words ? (ar ? Tafqit.ar(t.total, 'IQD') : Tafqit.en(t.total, 'IQD')) : '',
      job.docType === 'warranty' ? D.expires + ' ' + fmtDate(addPeriod(job.date, num(job.warrantyVal), job.warrantyUnit)) : '',
      ar ? 'شكراً لثقتكم بنا.' : 'Thank you for your trust.',
    ].filter(Boolean).join('\n');
    let phone = (job.cust.phone || '').replace(/[^\d]/g, '');
    if (phone.startsWith('07')) phone = '964' + phone.slice(1);
    else if (phone.startsWith('00')) phone = phone.slice(2);
    const url = 'https://wa.me/' + (phone.length >= 11 ? phone : '') + '?text=' + encodeURIComponent(lines);
    window.open(url, '_blank', 'noopener');
  });
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    document.body.dataset.view = b.dataset.view;
    $$('.tab').forEach(x => x.classList.toggle('on', x === b));
    if (b.dataset.view === 'preview') requestAnimationFrame(fit);
  }));

  // ---------- demo (tools.hemlohq.com/repair-receipt/#demo): sample data, not saved ----------
  if (location.hash === '#demo' || location.hash === '#demo-en') {
    const en = location.hash === '#demo-en';
    if (en) uiLang = 'en';
    biz = { name: en ? 'Al-Karama Phone & AC Repair' : 'محلات الكرمه لتصليح الهواتف والمكيفات', phone: '0770 123 4567', address: en ? 'Baghdad, Al-Karada, near 14 Ramadan St' : 'بغداد، الكرادة،靠近 شارع 14 رمضان', extra: en ? 'Since 2009' : 'منذ 2009', logo: '', stamp: '' };
    job = Object.assign(blankJob(), en ? {
      docType: 'receipt', paper: 'a5', number: 'J-0142', date: '2026-09-28', ready: '2026-10-02',
      cust: { name: 'M. Al-Saadi', phone: '0781 555 0199' },
      device: { type: 'phone', brand: 'Samsung', model: 'A52', serial: 'RF8M20ABCDE' },
      fault: { reported: 'The screen was dropped and cracked; the touch sometimes does not respond.', diagnosis: 'Display assembly broken. Motherboard and touch IC are fine.', done: 'Replaced the display assembly and tested touch, speakers, and charging.' },
      condition: ['scratches', 'screen'], conditionNote: 'Small dent on the back near the camera.',
      acc: ['charger', 'case'], accOther: 'SIM tray',
      items: [{ d: 'Display assembly (A52)', q: 1, p: 78000 }, { d: 'Adhesive + labour', q: 1, p: 20000 }],
      words: true, notes: 'Not water resistant after repair. 30-day warranty on the screen.',
    } : {
      docType: 'receipt', paper: 'a5', number: 'J-0142', date: '2026-09-28', ready: '2026-10-02',
      cust: { name: 'السعدي', phone: '0781 555 0199' },
      device: { type: 'phone', brand: 'سامسونج', model: 'A52', serial: 'RF8M20ABCDE' },
      fault: { reported: 'وقع من اليد، الشاشة مكسورة، واللمس أحياناً لا يستجيب.', diagnosis: 'الشاشة مكسورة بالكامل. اللوحة الأم واللمس سليمة.', done: 'تم تركيب شاشة جديدة واختبار اللمس والسماعات والشحن.' },
      condition: ['scratches', 'screen'], conditionNote: 'خدش صغير على الظهر قرب الكاميرا.',
      acc: ['charger', 'case'], accOther: 'درج الشريحة',
      items: [{ d: 'شاشة كاملة (A52)', q: 1, p: 78000 }, { d: 'لاصق + أجور', q: 1, p: 20000 }],
      words: true, notes: 'الجهاز غير مقاوم للماء بعد التصليح. ضمان 30 يوماً على الشاشة.',
    });
    if (en) job.warrantyTerms = TERMS_EN;
    save = () => {};
  }

  // ---------- start ----------
  document.body.dataset.view = new URLSearchParams(location.search).get('view') === 'preview' ? 'preview' : 'edit';
  $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.view === document.body.dataset.view));
  setPageSize(); applyUI(); fillForm(); render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();