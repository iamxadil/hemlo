// Hemlo Tools · Invoice & quotation maker
// Everything runs in the browser. The business profile and the current draft are saved on this device only.
(function () {
  'use strict';

  // ---------- text ----------
  const UI = {
    ar: {
      appTitle: 'صانع الفواتير وعروض الأسعار', newDoc: 'جديد', whatsapp: 'واتساب', print: 'حفظ PDF',
      tabEdit: 'تعديل', tabPreview: 'معاينة',
      secDoc: 'المستند', invoice: 'فاتورة', quote: 'عرض سعر', number: 'الرقم', date: 'التاريخ', dueOrValid: 'تاريخ الاستحقاق / صالح لغاية',
      docLang: 'لغة المستند', currency: 'العملة', rate: 'سعر صرف الدولار (بالدينار)', showAlt: 'إظهار المعادل بالعملة الأخرى',
      secBiz: 'معلوماتك', bizHint: 'تُحفظ على هذا الجهاز فقط، لتظهر تلقائياً في كل مستند.', logo: 'الشعار', stamp: 'الختم / التوقيع',
      bizName: 'اسم المحل أو الشركة', phone: 'الهاتف', extra: 'معلومة إضافية (اختياري)', address: 'العنوان',
      secCust: 'الزبون', custName: 'اسم الزبون أو الجهة',
      secItems: 'المواد والخدمات', desc: 'البيان', qty: 'الكمية', price: 'السعر', addItem: '+ إضافة سطر',
      secTotals: 'المجاميع والملاحظات', discount: 'الخصم (مبلغ)', tax: 'الضريبة %', paid: 'المبلغ المدفوع (اختياري)', showWords: 'كتابة المبلغ بالحروف (تفقيط)',
      notes: 'ملاحظات وشروط', privacy: 'لا نرسل بياناتك إلى أي مكان: كل شيء يُحفظ ويُعالج على جهازك.',
      confirmNew: 'بدء مستند جديد؟ ستبقى معلومات محلك محفوظة.', waNeedsTotal: 'أضف مادة واحدة على الأقل أولاً.',
    },
    en: {
      appTitle: 'Invoice & quotation maker', newDoc: 'New', whatsapp: 'WhatsApp', print: 'Save PDF',
      tabEdit: 'Edit', tabPreview: 'Preview',
      secDoc: 'Document', invoice: 'Invoice', quote: 'Quotation', number: 'Number', date: 'Date', dueOrValid: 'Due date / valid until',
      docLang: 'Document language', currency: 'Currency', rate: 'USD rate (in IQD)', showAlt: 'Show the total in the other currency too',
      secBiz: 'Your business', bizHint: 'Saved on this device only, so it appears on every document automatically.', logo: 'Logo', stamp: 'Stamp / signature',
      bizName: 'Business name', phone: 'Phone', extra: 'Extra line (optional)', address: 'Address',
      secCust: 'Customer', custName: 'Customer name',
      secItems: 'Items and services', desc: 'Description', qty: 'Qty', price: 'Price', addItem: '+ Add line',
      secTotals: 'Totals and notes', discount: 'Discount (amount)', tax: 'Tax %', paid: 'Amount paid (optional)', showWords: 'Write the amount in words',
      notes: 'Notes and terms', privacy: 'Nothing is sent anywhere: your data stays and is processed on this device.',
      confirmNew: 'Start a new document? Your business details stay saved.', waNeedsTotal: 'Add at least one item first.',
    },
  };
  const DOC = {
    ar: { invoice: 'فاتورة', quote: 'عرض سعر', no: 'الرقم', date: 'التاريخ', due: 'تاريخ الاستحقاق', valid: 'صالح لغاية', to: 'إلى', desc: 'البيان', qty: 'الكمية', price: 'السعر', amount: 'المبلغ',
      subtotal: 'المجموع', discount: 'الخصم', tax: 'الضريبة', total: 'الإجمالي', paid: 'المدفوع', balance: 'المتبقي', equiv: 'ما يعادل', words: 'المبلغ كتابةً', notes: 'ملاحظات', sign: 'الختم والتوقيع', tel: 'هاتف' },
    en: { invoice: 'Invoice', quote: 'Quotation', no: 'No.', date: 'Date', due: 'Due date', valid: 'Valid until', to: 'Bill to', desc: 'Description', qty: 'Qty', price: 'Price', amount: 'Amount',
      subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax', total: 'Total', paid: 'Paid', balance: 'Balance due', equiv: 'Equivalent', words: 'Amount in words', notes: 'Notes', sign: 'Stamp & signature', tel: 'Tel' },
  };

  // ---------- state ----------
  const K_DOC = 'hemlo.invoice.draft.v1', K_BIZ = 'hemlo.invoice.business.v1', K_SEQ = 'hemlo.invoice.seq.v1';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked: keep working */ } },
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const nextNumber = (type) => {
    const seq = store.get(K_SEQ, { invoice: 0, quote: 0 });
    seq[type] = (seq[type] || 0) + 1; store.set(K_SEQ, seq);
    return (type === 'quote' ? 'Q-' : 'INV-') + String(seq[type]).padStart(4, '0');
  };
  const blankDoc = (type = 'invoice', lang) => ({
    type, number: nextNumber(type), date: today(), due: '', docLang: lang || 'ar', currency: 'IQD', rate: 1500, showAlt: false,
    cust: { name: '', phone: '', address: '' }, items: [{ d: '', q: 1, p: '' }], discount: '', tax: '', paid: '', words: true, notes: '',
  });

  let uiLang = store.get('hemlo.uiLang', 'ar');
  let doc = store.get(K_DOC, null) || blankDoc('invoice', uiLang === 'en' ? 'en' : 'ar');
  let biz = store.get(K_BIZ, { name: '', phone: '', address: '', extra: '', logo: '', stamp: '' });

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const dec = cur => (cur === 'USD' ? 2 : 0);
  const fmt = (n, cur) => n.toLocaleString('en-US', { minimumFractionDigits: dec(cur), maximumFractionDigits: dec(cur) });
  const curLabel = (cur, L) => (cur === 'USD' ? (L === 'ar' ? 'دولار' : 'USD') : (L === 'ar' ? 'د.ع' : 'IQD'));
  const money = (n, cur, L, sign = '') => `<bdi dir="ltr">${sign}${fmt(n, cur)}</bdi> ${curLabel(cur, L)}`;

  // ---------- totals ----------
  function totals() {
    const lines = doc.items.map(it => num(it.q) * num(it.p));
    const subtotal = lines.reduce((a, b) => a + b, 0);
    const discount = Math.min(num(doc.discount), subtotal);
    const taxable = subtotal - discount;
    const tax = taxable * num(doc.tax) / 100;
    const total = taxable + tax;
    const paid = num(doc.paid);
    return { lines, subtotal, discount, tax, total, paid, balance: total - paid };
  }

  // ---------- UI text ----------
  function applyUI() {
    const T = UI[uiLang];
    document.documentElement.lang = uiLang;
    document.documentElement.dir = uiLang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-t]').forEach(el => { const k = el.getAttribute('data-t'); if (T[k]) el.textContent = T[k]; });
    $('#lang').textContent = uiLang === 'ar' ? 'EN' : 'عربي';
    document.title = T.appTitle + ' · Hemlo Tools';
    renderItems();
  }

  // ---------- form binding ----------
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj); }
  function setPath(obj, path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], obj)[last] = v; }
  const target = key => (key.startsWith('biz.') ? { o: biz, k: key.slice(4) } : { o: doc, k: key });

  function fillForm() {
    $$('[data-k]').forEach(el => {
      const { o, k } = target(el.dataset.k); const v = getPath(o, k);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
    });
    $$('[data-seg="type"] button').forEach(b => b.classList.toggle('on', b.dataset.v === doc.type));
    ['logo', 'stamp'].forEach(showImg);
  }
  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.k) return;
    const { o, k } = target(el.dataset.k);
    setPath(o, k, el.type === 'checkbox' ? el.checked : el.value);
    save(); queueRender();
  });
  document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.k) { save(); queueRender(); } });

  $$('[data-seg="type"] button').forEach(b => b.addEventListener('click', () => {
    if (doc.type === b.dataset.v) return;
    doc.type = b.dataset.v; doc.number = nextNumber(doc.type);
    fillForm(); save(); queueRender();
  }));

  // ---------- items ----------
  function renderItems() {
    const T = UI[uiLang];
    $('#items').innerHTML = doc.items.map((it, i) => `
      <div class="item" data-i="${i}">
        <label><span>${T.desc}</span><input data-f="d" value="${esc(it.d)}"></label>
        <label><span>${T.qty}</span><input data-f="q" type="number" inputmode="decimal" min="0" step="any" value="${esc(it.q)}"></label>
        <label><span>${T.price}</span><input data-f="p" type="number" inputmode="decimal" min="0" step="any" value="${esc(it.p)}"></label>
        <button type="button" class="rm" aria-label="Remove line"${doc.items.length < 2 ? ' disabled style="visibility:hidden"' : ''}>×</button>
      </div>`).join('');
  }
  $('#items').addEventListener('input', e => {
    const row = e.target.closest('.item'); if (!row || !e.target.dataset.f) return;
    doc.items[+row.dataset.i][e.target.dataset.f] = e.target.value; save(); queueRender();
  });
  $('#items').addEventListener('click', e => {
    if (!e.target.classList.contains('rm')) return;
    doc.items.splice(+e.target.closest('.item').dataset.i, 1); renderItems(); save(); queueRender();
  });
  $('#addItem').addEventListener('click', () => {
    doc.items.push({ d: '', q: 1, p: '' }); renderItems(); save(); queueRender();
    const rows = $$('#items .item'); rows[rows.length - 1].querySelector('input').focus();
  });

  // ---------- images (resized before saving, to keep storage small) ----------
  function showImg(kind) {
    const box = $(`.up[data-img="${kind}"]`); const src = biz[kind];
    box.classList.toggle('has', !!src);
    box.querySelector('.up-prev').innerHTML = src ? `<img src="${src}" alt="">` : '';
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

  // ---------- document ----------
  function lab(key) {
    if (doc.docLang === 'bi') return `${DOC.ar[key]}<span class="bi-en">${DOC.en[key]}</span>`;
    return DOC[doc.docLang][key];
  }
  function fmtDate(d) {
    if (!d) return '';
    const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`;
  }
  function render() {
    const L = doc.docLang === 'en' ? 'en' : 'ar';
    const t = totals(), cur = doc.currency;
    const page = $('#page');
    page.lang = L; page.dir = L === 'ar' ? 'rtl' : 'ltr';
    const bizMeta = [biz.phone && `${DOC[L].tel}: <span dir="ltr">${esc(biz.phone)}</span>`, esc(biz.address), esc(biz.extra)].filter(Boolean).join('<br>');
    const custMeta = [doc.cust.phone && `<span dir="ltr">${esc(doc.cust.phone)}</span>`, esc(doc.cust.address)].filter(Boolean).join('<br>');
    const rows = doc.items.map((it, i) => `<tr><td class="idx num">${i + 1}</td><td class="desc">${esc(it.d) || '<span class="empty">—</span>'}</td><td class="num">${esc(it.q)}</td><td class="num">${it.p === '' ? '' : fmt(num(it.p), cur)}</td><td class="num">${fmt(t.lines[i], cur)}</td></tr>`).join('');
    const rate = num(doc.rate);
    const alt = doc.showAlt && rate > 0 ? (cur === 'IQD' ? money(t.total / rate, 'USD', L) : money(t.total * rate, 'IQD', L)) : '';
    const words = doc.words && t.total > 0 ? `<div class="d-words"><div class="lbl">${lab('words')}</div>${L === 'ar' || doc.docLang === 'bi' ? `<div class="w">${Tafqit.ar(t.total, cur)}</div>` : ''}${L === 'en' || doc.docLang === 'bi' ? `<div class="w${doc.docLang === 'bi' ? ' w-en' : ''}">${Tafqit.en(t.total, cur)}</div>` : ''}</div>` : '<div class="d-words"></div>';
    const r = (k, v, cls = '') => `<div class="r ${cls}"><span>${lab(k)}</span><span>${v}</span></div>`;

    page.innerHTML = `
      <header class="d-head">
        <div class="d-biz">
          ${biz.logo ? `<img class="d-logo" src="${biz.logo}" alt="">` : ''}
          <div><div class="d-bizname">${esc(biz.name) || '<span class="empty">' + (L === 'ar' ? 'اسم محلك' : 'Your business') + '</span>'}</div>${bizMeta ? `<div class="d-bizmeta">${bizMeta}</div>` : ''}</div>
        </div>
        <div class="d-title">
          <h2>${doc.docLang === 'bi' ? DOC.ar[doc.type] : DOC[L][doc.type]}</h2>
          ${doc.docLang === 'bi' ? `<div class="sub">${DOC.en[doc.type]}</div>` : ''}
          <dl class="d-meta">
            <dt>${lab('no')}</dt><dd>${esc(doc.number)}</dd>
            <dt>${lab('date')}</dt><dd>${fmtDate(doc.date)}</dd>
            ${doc.due ? `<dt>${lab(doc.type === 'quote' ? 'valid' : 'due')}</dt><dd>${fmtDate(doc.due)}</dd>` : ''}
          </dl>
        </div>
      </header>
      <div class="d-rule"></div>
      <div class="d-to"><div><div class="lbl">${lab('to')}</div><div class="nm">${esc(doc.cust.name) || '<span class="empty">—</span>'}</div>${custMeta ? `<div class="mt">${custMeta}</div>` : ''}</div></div>
      <table class="d-items">
        <thead><tr><th class="idx num">#</th><th>${lab('desc')}</th><th class="num">${lab('qty')}</th><th class="num">${lab('price')}</th><th class="num">${lab('amount')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="d-sum">
        ${words}
        <div class="d-totals">
          ${t.discount || num(doc.tax) ? r('subtotal', money(t.subtotal, cur, L)) : ''}
          ${t.discount ? r('discount', money(t.discount, cur, L, '− ')) : ''}
          ${num(doc.tax) ? r('tax', `${money(t.tax, cur, L)} <bdi dir="ltr">(${num(doc.tax)}%)</bdi>`) : ''}
          ${r('total', money(t.total, cur, L), 'grand')}
          ${alt ? r('equiv', alt, 'alt') : ''}
          ${num(doc.paid) ? r('paid', money(t.paid, cur, L)) + r('balance', money(t.balance, cur, L), 'bal') : ''}
        </div>
      </div>
      ${doc.notes ? `<div class="d-notes"><div class="lbl">${lab('notes')}</div>${esc(doc.notes)}</div>` : ''}
      <div class="d-sign"><div class="box">${biz.stamp ? `<img src="${biz.stamp}" alt="">` : '<div style="height:20mm"></div>'}<div class="line">${lab('sign')}</div></div></div>
      <footer class="d-foot"><span>${esc(doc.number)}</span><span class="made"><img src="../shared/hemlo-mark.svg" alt="">Made with Hemlo Tools · tools.hemlohq.com</span></footer>`;
    fit();
  }

  // scale the A4 page to the preview width
  // The wrapper takes the page's scaled size; the page is scaled from its top-left corner inside it.
  function fit() {
    const wrap = $('#pageWrap'), page = $('#page'), box = $('.preview');
    if (!box.offsetParent) return;                       // preview hidden (phone, Edit tab)
    const cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = page.offsetWidth, h = page.offsetHeight; if (!w || avail <= 0) return;
    const s = Math.min(1, avail / w);
    page.style.transform = s < 1 ? `scale(${s})` : '';
    wrap.style.width = w * s + 'px'; wrap.style.height = h * s + 'px';
  }
  window.addEventListener('resize', fit);

  // re-render at most once per frame while the user types
  let rq = 0;
  function queueRender() { if (!rq) rq = requestAnimationFrame(() => { rq = 0; render(); }); }

  // ---------- save ----------
  let t0;
  function save() { clearTimeout(t0); t0 = setTimeout(() => { store.set(K_DOC, doc); store.set(K_BIZ, biz); }, 250); }

  // ---------- actions ----------
  $('#lang').addEventListener('click', () => {
    uiLang = uiLang === 'ar' ? 'en' : 'ar'; store.set('hemlo.uiLang', uiLang);
    if (!doc.items.some(i => i.d || i.p) && !doc.cust.name) doc.docLang = uiLang === 'en' ? 'en' : 'ar';
    applyUI(); fillForm(); render();
  });
  $('#new').addEventListener('click', () => {
    if (!confirm(UI[uiLang].confirmNew)) return;
    const keep = { docLang: doc.docLang, currency: doc.currency, rate: doc.rate, showAlt: doc.showAlt, words: doc.words, notes: doc.notes };
    doc = Object.assign(blankDoc(doc.type, doc.docLang), keep);
    renderItems(); fillForm(); save(); queueRender();
  });
  $('#print').addEventListener('click', () => {
    const name = (doc.number || 'document').replace(/[^\w-]+/g, '_');
    const prev = document.title;
    const go = () => { render(); document.title = name; window.print(); setTimeout(() => (document.title = prev), 500); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
  });
  $('#wa').addEventListener('click', () => {
    const t = totals(); if (t.total <= 0) { alert(UI[uiLang].waNeedsTotal); return; }
    const L = doc.docLang === 'en' ? 'en' : 'ar', D = DOC[L], cur = doc.currency;
    const lines = [
      `${D[doc.type]} ${doc.number}${biz.name ? ' · ' + biz.name : ''}`,
      doc.cust.name ? `${D.to}: ${doc.cust.name}` : '',
      `${D.total}: ${fmt(t.total, cur)} ${curLabel(cur, L)}`,
      doc.words ? (L === 'ar' ? Tafqit.ar(t.total, cur) : Tafqit.en(t.total, cur)) : '',
      num(doc.paid) ? `${D.balance}: ${fmt(t.balance, cur)} ${curLabel(cur, L)}` : '',
    ].filter(Boolean).join('\n');
    let phone = (doc.cust.phone || '').replace(/[^\d]/g, '');
    if (phone.startsWith('07')) phone = '964' + phone.slice(1);       // Iraqi mobile: 07xx -> 9647xx
    else if (phone.startsWith('00')) phone = phone.slice(2);
    const url = `https://wa.me/${phone.length >= 11 ? phone : ''}?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank', 'noopener');
  });
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    document.body.dataset.view = b.dataset.view;
    $$('.tab').forEach(x => x.classList.toggle('on', x === b));
    if (b.dataset.view === 'preview') requestAnimationFrame(fit);
  }));

  // ---------- demo (tools.hemlohq.com/invoice/#demo): sample data, not saved ----------
  if (location.hash === '#demo' || location.hash === '#demo-en') {
    const en = location.hash === '#demo-en';
    if (en) uiLang = 'en';
    biz = { name: en ? 'Al-Noor Auto Parts' : 'محلات النور لقطع غيار السيارات', phone: '0770 123 4567', address: en ? 'Baghdad, Al-Sinak, near Al-Jumhuriya Bridge' : 'بغداد، السنك، قرب جسر الجمهورية', extra: en ? 'Since 2009' : 'منذ 2009', logo: '', stamp: '' };
    doc = Object.assign(blankDoc('invoice', en ? 'en' : 'ar'), {
      number: 'INV-0142', date: '2026-09-28', due: '2026-10-12', rate: 1500, showAlt: true,
      cust: { name: en ? 'Al-Rafidain Workshop' : 'ورشة الرافدين', phone: '0781 555 0199', address: en ? 'Baghdad, Al-Karrada' : 'بغداد، الكرادة' },
      items: en
        ? [{ d: 'Brake pads, front (Toyota Camry 2018)', q: 4, p: 45000 }, { d: 'Engine oil 5W-30, 4 L', q: 6, p: 32000 }, { d: 'Oil filter', q: 6, p: 8500 }, { d: 'Air filter', q: 3, p: 15000 }]
        : [{ d: 'فحمات فرامل أمامية (تويوتا كامري 2018)', q: 4, p: 45000 }, { d: 'زيت محرك 5W-30 سعة 4 لتر', q: 6, p: 32000 }, { d: 'فلتر زيت', q: 6, p: 8500 }, { d: 'فلتر هواء', q: 3, p: 15000 }],
      discount: 20000, paid: 300000, notes: en ? 'Payment in cash or by FIB transfer. Goods sold are exchangeable within 7 days with the receipt.' : 'الدفع نقداً أو بتحويل عبر FIB. البضاعة المباعة تُستبدل خلال 7 أيام مع الوصل.',
    });
    save = () => {};   // never overwrite a real draft with the demo
  }

  // ---------- start ----------
  document.body.dataset.view = new URLSearchParams(location.search).get('view') === 'preview' ? 'preview' : 'edit';
  $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.view === document.body.dataset.view));
  applyUI(); fillForm(); render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  // works offline once visited (served over https only)
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
