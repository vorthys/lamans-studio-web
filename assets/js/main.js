/* --------------------------------------------------------------------------
   La Manš — chování stránky
   Vanilla JS, žádné závislosti.
   -------------------------------------------------------------------------- */
(function () {
  'use strict';

  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ===================================================== jazyk / překlady */

  const STORE_KEY = 'lamans.lang';
  let lang = 'cs';

  function t(key) {
    const dict = I18N[lang] || I18N.cs;
    return dict[key] !== undefined ? dict[key] : (I18N.cs[key] || '');
  }

  function applyLang(next) {
    lang = I18N[next] ? next : 'cs';

    const meta = LANGS.find(l => l.code === lang) || LANGS[0];
    document.documentElement.lang = meta.htmlLang;

    // textové uzly označené data-i18n
    $$('[data-i18n]').forEach(el => {
      const val = t(el.dataset.i18n);
      if (val) el.textContent = val;
    });

    // hlavička dokumentu
    document.title = t('meta.title');
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.desc'));

    // stav přepínače
    $$('.langs__btn').forEach(b => b.classList.toggle('is-active', b.dataset.lang === lang));

    // dynamicky vykreslené bloky
    renderPrice();
    renderGallery();
    syncLightboxLabels();

    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* private mode */ }
  }

  $$('.langs__btn').forEach(btn => {
    btn.addEventListener('click', () => applyLang(btn.dataset.lang));
  });

  /* ============================================================== hlavička */

  const header = $('#header');
  const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------- mobilní menu */

  const burger = $('#burger');
  const nav    = $('#nav');

  function closeNav() {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }

  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });

  $$('a', nav).forEach(a => a.addEventListener('click', closeNav));

  document.addEventListener('click', e => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !burger.contains(e.target)) closeNav();
  });

  /* ------------------------------------------- aktivní položka navigace */

  const sections = ['services', 'price', 'gallery', 'about', 'contact']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const navSpy = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      $$('.nav a').forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  sections.forEach(s => navSpy.observe(s));

  /* ================================================== odhalení při scrollu */

  const revealer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  function observeReveals() {
    $$('.reveal:not(.is-in)').forEach((el, i) => {
      el.style.transitionDelay = Math.min(i % 6, 5) * 70 + 'ms';
      revealer.observe(el);
    });
  }
  observeReveals();

  /* ------------------------------------------------- počítadlo u statistik */

  const counters = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.textContent.trim().endsWith('+') ? '+' : '';
      const start  = performance.now();
      const dur    = 1400;

      const step = now => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('cs-CZ') + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.6 });

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('[data-count]').forEach(el => counters.observe(el));
  }

  /* ==================================================== ceník — taby a řádky */

  const tabsBox   = $('#priceTabs');
  const panelsBox = $('#pricePanels');
  let activeCat   = PRICE_LIST[0].id;

  function priceCell(p) {
    const free = !/\d/.test(p);
    if (free) return `<span class="prow__p is-free">${p}</span>`;
    return `<span class="prow__p">${p}<span class="cur">Kč</span></span>`;
  }

  function renderPrice() {
    if (!tabsBox || !panelsBox) return;

    tabsBox.innerHTML = PRICE_LIST.map(cat => `
      <button type="button" role="tab" class="tab${cat.id === activeCat ? ' is-active' : ''}"
              data-cat="${cat.id}" aria-selected="${cat.id === activeCat}" aria-controls="panel-${cat.id}">
        ${t('cat.' + cat.id)}
      </button>`).join('');

    panelsBox.innerHTML = PRICE_LIST.map(cat => `
      <div class="panel${cat.id === activeCat ? ' is-active' : ''}" id="panel-${cat.id}" role="tabpanel">
        <div class="plist">
          ${cat.items.map(it => `
            <div class="prow">
              <span class="prow__n">${it.n}${it.tag ? `<span class="prow__tag">${it.tag}</span>` : ''}</span>
              <span class="prow__d">${it.d}</span>
              ${priceCell(it.p)}
            </div>`).join('')}
        </div>
        <aside class="pside">
          <figure class="pside__img"><img src="${cat.photo}" alt="${t('cat.' + cat.id)} — La Manš" loading="lazy"></figure>
          <div>
            <p class="pside__cap">${t('price.eyebrow')}</p>
            <p class="pside__n">${t('cat.' + cat.id)}</p>
          </div>
        </aside>
      </div>`).join('');

    $$('.tab', tabsBox).forEach(btn => {
      btn.addEventListener('click', () => selectCat(btn.dataset.cat));
    });
  }

  function selectCat(id) {
    if (!PRICE_LIST.some(c => c.id === id)) return;
    activeCat = id;

    $$('.tab', tabsBox).forEach(b => {
      const on = b.dataset.cat === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$('.panel', panelsBox).forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + id));
  }

  // odkazy "Zobrazit ceník" na kartách služeb přepnou rovnou správnou kategorii
  $$('[data-price-tab]').forEach(a => {
    a.addEventListener('click', () => selectCat(a.dataset.priceTab));
  });

  /* ======================================================== galerie + lupa */

  const gridBox = $('#galleryGrid');

  function renderGallery() {
    if (!gridBox) return;
    gridBox.innerHTML = GALLERY.map((item, i) => `
      <figure class="gitem reveal" data-i="${i}" tabindex="0" role="button"
              aria-label="${t('cat.' + item.cat)}">
        <img src="${item.src}" alt="${t('cat.' + item.cat)} — La Manš Plzeň" loading="lazy">
        <figcaption class="gitem__tag">${t('cat.' + item.cat)}</figcaption>
      </figure>`).join('');

    $$('.gitem', gridBox).forEach(fig => {
      fig.addEventListener('click', () => openLb(+fig.dataset.i));
      fig.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(+fig.dataset.i); }
      });
    });

    observeReveals();
  }

  const lb      = $('#lightbox');
  const lbImg   = $('#lbImg');
  const lbCount = $('#lbCount');
  let lbIndex   = 0;

  function syncLightboxLabels() {
    $('#lbClose').setAttribute('aria-label', t('gallery.close'));
    $('#lbPrev').setAttribute('aria-label', t('gallery.prev'));
    $('#lbNext').setAttribute('aria-label', t('gallery.next'));
  }

  function showLb(i) {
    lbIndex = (i + GALLERY.length) % GALLERY.length;
    const item = GALLERY[lbIndex];
    lbImg.src = item.src;
    lbImg.alt = t('cat.' + item.cat) + ' — La Manš Plzeň';
    lbCount.textContent = (lbIndex + 1) + ' / ' + GALLERY.length;
  }

  function openLb(i) {
    showLb(i);
    lb.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => lb.classList.add('is-open'));
    $('#lbClose').focus();
  }

  function closeLb() {
    lb.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    setTimeout(() => { lb.hidden = true; }, 320);
  }

  $('#lbClose').addEventListener('click', closeLb);
  $('#lbPrev').addEventListener('click', () => showLb(lbIndex - 1));
  $('#lbNext').addEventListener('click', () => showLb(lbIndex + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });

  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape')     closeLb();
    if (e.key === 'ArrowLeft')  showLb(lbIndex - 1);
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
  });

  /* ============================================================== drobnosti */

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ================================================================= start */

  let saved = 'cs';
  try { saved = localStorage.getItem(STORE_KEY) || 'cs'; } catch (e) { /* private mode */ }
  applyLang(saved);

})();
