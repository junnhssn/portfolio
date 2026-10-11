/* ==========================================================================
   Saranyaa Ramesh — portfolio behaviour
   Theme toggle, accessibility panel, image lightbox, hash routing between the
   home page and the case studies, the email composer, and the motion layer
   (parallax + magnetic cards).
   No frameworks, no build step, no third-party requests.
   ========================================================================== */

(function () {
  'use strict';

  var THEME_KEY = 'sr_theme';
  var A11Y_KEY = 'sr_a11y';

  var html = document.documentElement;
  var body = document.body;

  /* ── Theme ─────────────────────────────────────────────────────────── */
  function preferredTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeBtn');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#15131c' : '#f7f6fb');
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  applyTheme(preferredTheme());

  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ── Accessibility panel ───────────────────────────────────────────── */
  // Each key maps to a body class defined in styles.css.
  var A11Y_CLASSES = {
    contrast: 'a11y-contrast',
    dyslexia: 'a11y-dyslexia',
    motion: 'a11y-motion',
    links: 'a11y-links',
    spacing: 'a11y-spacing',
    cursor: 'a11y-cursor'
  };

  var DEFAULT_A11Y = { textSize: 0, contrast: false, dyslexia: false, motion: false, links: false, spacing: false, cursor: false };
  var TEXT_STEPS = ['17px', '18.5px', '20px', '22px'];

  var a11y;
  try {
    a11y = Object.assign({}, DEFAULT_A11Y, JSON.parse(localStorage.getItem(A11Y_KEY) || '{}'));
  } catch (e) {
    a11y = Object.assign({}, DEFAULT_A11Y);
  }

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Single source of truth for the motion layer: the OS setting or the toggle.
  function motionOff() {
    return a11y.motion || prefersReduced.matches;
  }

  function applyA11y() {
    Object.keys(A11Y_CLASSES).forEach(function (key) {
      body.classList.toggle(A11Y_CLASSES[key], !!a11y[key]);
    });

    var step = Math.min(Math.max(parseInt(a11y.textSize, 10) || 0, 0), TEXT_STEPS.length - 1);
    html.style.setProperty('--fs-base', TEXT_STEPS[step]);

    Object.keys(A11Y_CLASSES).forEach(function (key) {
      var input = document.getElementById('a11y-' + key);
      if (input) input.checked = !!a11y[key];
    });
    var range = document.getElementById('a11y-textSize');
    if (range) range.value = step;

    if (motionOff()) clearMotion();
    else updateParallax();

    try { localStorage.setItem(A11Y_KEY, JSON.stringify(a11y)); } catch (e) { /* ignore */ }
  }

  Object.keys(A11Y_CLASSES).forEach(function (key) {
    var input = document.getElementById('a11y-' + key);
    if (!input) return;
    input.addEventListener('change', function () {
      a11y[key] = input.checked;
      applyA11y();
    });
  });

  var textRange = document.getElementById('a11y-textSize');
  if (textRange) {
    textRange.addEventListener('input', function () {
      a11y.textSize = parseInt(textRange.value, 10);
      applyA11y();
    });
  }

  var resetBtn = document.getElementById('a11yReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      a11y = Object.assign({}, DEFAULT_A11Y);
      applyA11y();
    });
  }

  var a11yFab = document.getElementById('a11yFab');
  var a11yPanel = document.getElementById('a11yPanel');

  function setPanel(open) {
    if (!a11yPanel || !a11yFab) return;
    if (open) a11yPanel.setAttribute('open', '');
    else a11yPanel.removeAttribute('open');
    a11yFab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (a11yFab && a11yPanel) {
    a11yFab.addEventListener('click', function (event) {
      event.stopPropagation();
      setPanel(!a11yPanel.hasAttribute('open'));
    });
    a11yPanel.addEventListener('click', function (event) { event.stopPropagation(); });
    document.addEventListener('click', function () { setPanel(false); });
  }

  /* ── Motion: parallax shapes, the work stack, the counting numbers ──── */
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('.parallax'));
  var stackItems = Array.prototype.slice.call(document.querySelectorAll('.stack-item'));
  var parallaxQueued = false;

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  // Each card reports how far it still has to travel before it sticks
  // (--enter, which the brand mark lags behind) and how much of it the next
  // card has covered (--cover, which shrinks and dims it). All rects are read
  // before any style is written so the browser lays out once per frame.
  function updateStack() {
    if (!stackItems.length) return;
    if (getComputedStyle(stackItems[0]).position !== 'sticky') { clearStack(); return; }
    var vh = window.innerHeight;
    var rects = stackItems.map(function (item) { return item.getBoundingClientRect(); });
    var sticks = stackItems.map(function (item) { return parseFloat(getComputedStyle(item).top) || 0; });
    stackItems.forEach(function (item, i) {
      var card = item.firstElementChild;
      var enter = clamp01((rects[i].top - sticks[i]) / Math.max(vh - sticks[i], 1));
      var cover = i < stackItems.length - 1
        ? clamp01(1 - (rects[i + 1].top - sticks[i]) / rects[i].height)
        : 0;
      card.style.setProperty('--enter', enter.toFixed(3));
      card.style.setProperty('--cover', cover.toFixed(3));
    });
  }

  function clearStack() {
    stackItems.forEach(function (item) {
      item.firstElementChild.style.removeProperty('--enter');
      item.firstElementChild.style.removeProperty('--cover');
    });
  }

  // Cards with more copy run taller, and a taller card underneath would
  // show its bottom edge below the one stacked on top of it.
  var stackList = document.querySelector('.stack');
  function syncStackHeights() {
    if (!stackList) return;
    stackList.style.removeProperty('--card-h');
    var tallest = 0;
    stackItems.forEach(function (item) { tallest = Math.max(tallest, item.firstElementChild.offsetHeight); });
    if (tallest) stackList.style.setProperty('--card-h', tallest + 'px');
  }
  if (stackList) {
    syncStackHeights();
    window.addEventListener('load', syncStackHeights);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncStackHeights);
  }

  // The numbers run up from zero once the band is properly in view. Timed
  // rather than tied to scroll position: a mouse wheel moves the page in
  // ~100px steps, so scroll-keyed numbers jumped in visible steps, and a
  // reader who stopped mid-band was left looking at a half-counted figure.
  // The real figure stays in the markup for screen readers and is what shows
  // with motion off.
  var countBand = document.querySelector('.stats');
  var counters = [];
  var countDone = false;
  var countStart = 0;
  var COUNT_MS = 1600;

  function formatCount(c, value) {
    if (c.unit && value < 1e3) return Math.round(value) + c.plus;
    if (c.unit === 'M') return (value >= 1e6 ? Math.round(value / 1e6) + 'M' : Math.round(value / 1e3) + 'K') + c.plus;
    if (c.unit === 'K') return Math.round(value / 1e3) + 'K' + c.plus;
    return (c.comma ? Math.round(value).toLocaleString('en-US') : String(Math.round(value))) + c.plus;
  }

  function setupCounters() {
    if (!countBand || motionOff()) return;
    countBand.querySelectorAll('.stat b').forEach(function (b) {
      var text = b.textContent.trim();
      var m = /^([\d,]+)([KM]?)(\+?)$/.exec(text);
      if (!m) return;
      var unit = m[2];
      var target = parseInt(m[1].replace(/,/g, ''), 10) * (unit === 'M' ? 1e6 : unit === 'K' ? 1e3 : 1);
      b.innerHTML = '';
      var shown = document.createElement('span');
      shown.setAttribute('aria-hidden', 'true');
      var real = document.createElement('span');
      real.className = 'visually-hidden';
      real.textContent = text;
      b.appendChild(shown);
      b.appendChild(real);
      var c = { el: shown, text: text, target: target, unit: unit, plus: m[3], comma: m[1].indexOf(',') > -1 };
      shown.textContent = formatCount(c, 0);
      counters.push(c);
    });
  }

  function finishCounts() {
    countDone = true;
    counters.forEach(function (c) { c.el.textContent = c.text; });
  }

  function tickCounts(now) {
    if (countDone) return;
    if (motionOff()) { finishCounts(); return; }
    var t = clamp01((now - countStart) / COUNT_MS);
    var eased = 1 - Math.pow(1 - t, 4);
    counters.forEach(function (c) { c.el.textContent = formatCount(c, c.target * eased); });
    if (t >= 1) finishCounts();
    else requestAnimationFrame(tickCounts);
  }

  function updateCounts() {
    if (countDone || countStart || !counters.length) return;
    if (motionOff()) { finishCounts(); return; }
    var r = countBand.getBoundingClientRect();
    // Already scrolled past (a deep link, or a jump from the nav): no one is
    // watching, so show the real figures rather than count off-screen.
    if (r.bottom < 0) { finishCounts(); return; }
    if (r.top > window.innerHeight * 0.85) return;
    countStart = performance.now();
    requestAnimationFrame(tickCounts);
  }

  function updateParallax() {
    parallaxQueued = false;
    updateCounts();
    if (motionOff()) return;
    var y = window.pageYOffset;
    parallaxEls.forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-speed')) || 0.1;
      el.style.transform = 'translate3d(0,' + (y * speed).toFixed(1) + 'px,0)';
    });
    updateStack();
  }

  function clearMotion() {
    parallaxEls.forEach(function (el) { el.style.transform = ''; });
    clearStack();
    if (counters.length) finishCounts();
  }

  setupCounters();

  window.addEventListener('scroll', function () {
    if (parallaxQueued) return;
    parallaxQueued = true;
    requestAnimationFrame(updateParallax);
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (parallaxQueued) return;
    parallaxQueued = true;
    requestAnimationFrame(function () { syncStackHeights(); updateParallax(); });
  });

  /* ── Cursor glow ───────────────────────────────────────────────────── */
  // One listener, rAF-throttled like the parallax above, moving a fixed layer
  // with translate3d so the work stays on the compositor.
  var glow = document.querySelector('.cursor-glow');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (glow && finePointer.matches) {
    var gx = 0, gy = 0, glowQueued = false;

    function paintGlow() {
      glowQueued = false;
      glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
    }

    document.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch' || motionOff()) return;
      gx = event.clientX; gy = event.clientY;
      if (!glow.classList.contains('is-on')) glow.classList.add('is-on');
      if (glowQueued) return;
      glowQueued = true;
      requestAnimationFrame(paintGlow);
    }, { passive: true });

    // Fade out when the pointer leaves the window rather than leaving a
    // stranded light in the last known position.
    document.addEventListener('pointerleave', function () { glow.classList.remove('is-on'); });
  }

  /* ── Other work: cursor preview ────────────────────────────────────── */
  // One shared image that trails the pointer over the index rows. It eases
  // toward the cursor; with motion off it simply sits beside it. Touch and
  // narrow screens get inline thumbnails from the CSS instead.
  var preview = document.querySelector('.wi-preview');
  var workIndex = document.querySelector('.work-index');
  if (preview && workIndex && finePointer.matches) {
    var pImg = preview.querySelector('img');
    var tx = 0, ty = 0, px = 0, py = 0, previewRunning = false, preloaded = false;

    function paintPreview() {
      var snap = motionOff();
      px = snap ? tx : px + (tx - px) * 0.18;
      py = snap ? ty : py + (ty - py) * 0.18;
      preview.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)';
      if (!snap && (Math.abs(tx - px) > 0.5 || Math.abs(ty - py) > 0.5)) {
        requestAnimationFrame(paintPreview);
      } else {
        previewRunning = false;
      }
    }

    function aimPreview(event) {
      // Above the cursor, so it never covers the row being read; below it
      // only when there is no room at the top of the screen.
      var w = preview.offsetWidth, h = pImg.offsetHeight || 200;
      tx = Math.max(16, Math.min(event.clientX - w * 0.35, window.innerWidth - w - 16));
      ty = event.clientY - h - 48;
      if (ty < 72) ty = Math.min(event.clientY + 36, window.innerHeight - h - 16);
      if (!previewRunning) { previewRunning = true; requestAnimationFrame(paintPreview); }
    }

    workIndex.querySelectorAll('.wi-row[data-preview]').forEach(function (row) {
      row.addEventListener('pointerenter', function (event) {
        if (event.pointerType === 'touch') return;
        if (!preloaded) {
          preloaded = true;
          workIndex.querySelectorAll('.wi-row[data-preview]').forEach(function (r) {
            new Image().src = r.getAttribute('data-preview');
          });
        }
        var thumb = row.querySelector('.wi-thumb');
        pImg.src = row.getAttribute('data-preview');
        preview.classList.toggle('is-left', !!thumb && thumb.classList.contains('wi-thumb--left'));
        preview.classList.toggle('is-whole', !!thumb && thumb.classList.contains('wi-thumb--whole'));
        aimPreview(event);
        // Appear at the cursor rather than flying in from the last position.
        if (!preview.classList.contains('is-on')) { px = tx; py = ty; }
        preview.classList.add('is-on');
      });
      row.addEventListener('pointermove', aimPreview);
    });
    workIndex.addEventListener('pointerleave', function () { preview.classList.remove('is-on'); });
  }

  /* ── Name entrance ─────────────────────────────────────────────────── */
  // The hold and its release live in the inline head script, so that a
  // failure in this file cannot leave the name hidden. Only the replay,
  // which is purely additive, lives here.
  //
  // Replaying on return means the entrance is not a single moment you can
  // miss by looking away while the page loads.
  function replayNameEntrance() {
    if (motionOff()) return;
    document.querySelectorAll('.hero-name .n1, .hero-name .n2').forEach(function (el) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  }

  /* ── Horizontal strips: keyboard reach ─────────────────────────────── */
  // The capsule strip scrolls sideways on narrow screens. Its items are
  // plain list items with no anchor at all, so a keyboard user had no way to
  // scroll it and simply never reached the items past the fold. Measured at
  // 390px: three of five capsules were unreachable.
  //
  // A scroll container must be focusable to be arrow-scrollable, but only
  // while it actually scrolls, otherwise desktop picks up a tab stop that
  // does nothing. So this is re-evaluated on resize rather than set once.
  var strips = Array.prototype.slice.call(
    document.querySelectorAll('[data-scroll-label]')
  );

  function syncStripReach() {
    strips.forEach(function (strip) {
      var scrolls = strip.scrollWidth > strip.clientWidth + 2;
      if (scrolls === (strip.getAttribute('tabindex') === '0')) return;
      if (scrolls) {
        strip.setAttribute('tabindex', '0');
        strip.setAttribute('role', 'group');
        strip.setAttribute('aria-label', strip.dataset.scrollLabel + ', scrollable row');
      } else {
        strip.removeAttribute('tabindex');
        strip.removeAttribute('role');
        strip.removeAttribute('aria-label');
      }
    });
  }

  if (strips.length) {
    syncStripReach();
    window.addEventListener('load', syncStripReach);
    var stripQueued = false;
    window.addEventListener('resize', function () {
      if (stripQueued) return;
      stripQueued = true;
      requestAnimationFrame(function () {
        stripQueued = false;
        syncStripReach();
      });
    });
  }

  if (prefersReduced.addEventListener) {
    prefersReduced.addEventListener('change', function () {
      if (motionOff()) clearMotion();
      else updateParallax();
    });
  }

  applyA11y();

  /* ── Lightbox ──────────────────────────────────────────────────────── */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lastFocus = null;

  function openLightbox(source) {
    if (!lightbox || !lightboxImg) return;
    lastFocus = document.activeElement;
    lightboxImg.src = source.currentSrc || source.src;
    lightboxImg.alt = source.alt || '';
    lightbox.setAttribute('open', '');
    body.style.overflow = 'hidden';
    var close = document.getElementById('lightboxClose');
    if (close) close.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.removeAttribute('open');
    lightboxImg.removeAttribute('src');
    body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ── Name flip ─────────────────────────────────────────────────────── */
  var logoFirst = document.querySelector('.nav-logo-first');
  if (logoFirst) {
    var startFlip = function () { logoFirst.classList.add('is-flipping'); };
    var logoLink = logoFirst.closest('.nav-logo');
    logoLink.addEventListener('pointerenter', startFlip);
    logoLink.addEventListener('focus', startFlip);
    logoFirst.addEventListener('animationend', function () { logoFirst.classList.remove('is-flipping'); });
  }

  // Delegated so images added to the HTML later need no extra wiring. The
  // decorative SVG shapes are excluded because they have no alt text.
  document.addEventListener('click', function (event) {
    var zoomable = event.target.closest('.shot, .community-card img');
    if (zoomable && !zoomable.closest('.work-card-blank, a') && !zoomable.classList.contains('decor')) {
      openLightbox(zoomable);
      return;
    }
    if (event.target.closest('#lightboxClose') || event.target.id === 'lightbox') {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (lightbox && lightbox.hasAttribute('open')) closeLightbox();
    else setPanel(false);
  });

  /* ── Routing ───────────────────────────────────────────────────────── */
  // Case studies are real HTML in the page rather than JS-rendered, so search
  // engines and link previews can read them. Routing just shows and hides.
  var homeView = document.getElementById('home');
  var cases = Array.prototype.slice.call(document.querySelectorAll('.case'));
  var BASE_TITLE = document.title;

  var currentView = null;

  function route() {
    var slug = (location.hash || '').replace(/^#\/?/, '');
    var target = slug ? document.getElementById('case-' + slug) : null;
    var view = target ? target.id : 'home';
    var viewChanged = view !== currentView;
    currentView = view;

    if (target) {
      if (homeView) homeView.hidden = true;
      cases.forEach(function (node) { node.hidden = node !== target; });
      // The heading is split across two typefaces; the first half is the name.
      var name = target.querySelector('.dsplit-a');
      document.title = (name ? name.textContent.trim() + ' — ' : '') + BASE_TITLE;
    } else {
      if (homeView) homeView.hidden = false;
      cases.forEach(function (node) { node.hidden = true; });
      document.title = BASE_TITLE;
    }

    requestAnimationFrame(observeReveals);
    return viewChanged;
  }

  window.addEventListener('hashchange', function () {
    var viewChanged = route();
    var slug = (location.hash || '').replace(/^#\/?/, '');
    var section = slug ? document.getElementById(slug) : null;

    if (section) {
      // A plain in-page anchor such as #work. Scrolling to top here would
      // override the browser's own jump, which is what broke the nav links.
      section.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'start' });
    } else if (viewChanged) {
      // Entering or leaving a case study starts at the top.
      window.scrollTo(0, 0);
      if (currentView === 'home') replayNameEntrance();
    }
  });

  /* ── Scroll reveal ─────────────────────────────────────────────────── */
  var observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
      // Fires just before a section scrolls in, not once it is well inside:
      // waiting left a visibly empty gap during a slow scroll.
    }, { rootMargin: '0px 0px 60px 0px', threshold: 0 });
  }

  function observeReveals() {
    var pending = document.querySelectorAll('.reveal:not(.is-visible)');
    Array.prototype.forEach.call(pending, function (node) {
      // Anything inside a hidden view has no box; leave it for the next pass.
      if (!node.getClientRects().length) return;
      if (observer) observer.observe(node);
      else node.classList.add('is-visible');
    });
  }

  route();

  // Images settling can change what is on screen, so sweep again once loaded.
  window.addEventListener('load', observeReveals);

  /* ── Pause on the hero ─────────────────────────────────────────────── */
  // Hold still on the opening line for a couple of seconds and a pen circles
  // "overthink" and leaves a note beside it. Once per visit. Pointer movement
  // does not reset the wait, because people move the mouse while they read.
  var ponder = document.querySelector('.ponder');
  var ponderWord = ponder && [].filter.call(
    document.querySelectorAll('.hero-hook em'),
    function (em) { return em.textContent.trim() === 'overthink'; }
  )[0];

  if (ponder && ponderWord) {
    var ponderTimer = null;
    var ponderShown = false;
    var loop = ponder.querySelector('.ponder-loop');
    var arrowPath = ponder.querySelector('.ponder-arrow path');
    var note = ponder.querySelector('.ponder-note');
    var hook = ponderWord.closest('.hero-hook');
    var portrait = document.querySelector('.portrait-frame');

    var placePonder = function () {
      var box = ponder.getBoundingClientRect();
      var w = ponderWord.getBoundingClientRect();
      // An ellipse only clears a word's corners when it is drawn well outside
      // the word's box, and italic letters overhang that box on both sides.
      var lw = w.width + 26, lh = w.height + 16;
      var lx = w.left - box.left - 13, ly = w.top - box.top - 8;
      loop.style.cssText = 'left:' + lx + 'px;top:' + ly + 'px;width:' + lw + 'px;height:' + lh + 'px';

      // The note goes after the end of the word's line, so find where that
      // line actually stops.
      var range = document.createRange();
      range.selectNodeContents(hook);
      var lineEnd = w.right;
      [].forEach.call(range.getClientRects(), function (r) {
        var mid = r.top + r.height / 2;
        if (mid > w.top && mid < w.bottom) lineEnd = Math.max(lineEnd, r.right);
      });

      var limit = window.innerWidth - 16;
      if (portrait) {
        var p = portrait.getBoundingClientRect();
        if (p.left > w.right && p.top < w.bottom && p.bottom > w.top) limit = p.left - 24;
      }
      var nw = note.offsetWidth, nh = note.offsetHeight;
      var nx = lineEnd + 40;
      var room = nx + nw <= limit;
      ponder.classList.toggle('no-room', !room);
      if (!room) return;

      var ny = w.top - box.top + (w.height - nh) / 2 - 6;
      note.style.left = (nx - box.left) + 'px';
      note.style.top = ny + 'px';

      // An arc from the note, up over the rest of the line, into the circle.
      var x1 = nx - box.left - 6, y1 = ny + nh * 0.45;
      var x2 = lx + lw - 6, y2 = ly + lh * 0.18;
      var cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 12;
      var dx = x2 - cx, dy = y2 - cy, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len, head = 8;
      var hx1 = x2 - head * (ux * 0.88 - uy * 0.47), hy1 = y2 - head * (uy * 0.88 + ux * 0.47);
      var hx2 = x2 - head * (ux * 0.88 + uy * 0.47), hy2 = y2 - head * (uy * 0.88 - ux * 0.47);
      arrowPath.setAttribute('d',
        'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
        'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
        'M' + hx1.toFixed(1) + ' ' + hy1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
        'L' + hx2.toFixed(1) + ' ' + hy2.toFixed(1));
    };

    var heroInView = function () {
      var r = hook.getBoundingClientRect();
      return currentView === 'home' && r.bottom > 60 && r.top < window.innerHeight;
    };

    var showPonder = function () {
      if (!heroInView()) { armPonder(); return; }
      placePonder();
      ponder.classList.add('is-on');
      ponderShown = true;
    };

    var armPonder = function () {
      if (ponderShown) return;
      clearTimeout(ponderTimer);
      ponderTimer = setTimeout(showPonder, 2400);
    };

    ['scroll', 'keydown', 'touchmove', 'wheel'].forEach(function (type) {
      window.addEventListener(type, armPonder, { passive: true });
    });
    window.addEventListener('resize', function () { if (ponderShown) placePonder(); });
    if (document.readyState === 'complete') armPonder();
    else window.addEventListener('load', armPonder);
  }

  /* ── Email composer ────────────────────────────────────────────────── */
  // GitHub Pages serves static files only, so there is no server to post to.
  // This opens the visitor's own mail client with the message pre-filled.
  var composer = document.getElementById('composer');
  if (composer) {
    composer.addEventListener('submit', function (event) {
      event.preventDefault();
      var nameField = document.getElementById('cName');
      var noteField = document.getElementById('cNote');
      var noteError = document.getElementById('cNoteError');
      var name = (nameField.value || '').trim();
      var note = (noteField.value || '').trim();

      // Without this an empty form opened a blank email, which looks broken
      // to the sender and tells Saranyaa nothing.
      if (!note) {
        if (noteError) noteError.hidden = false;
        noteField.setAttribute('aria-invalid', 'true');
        noteField.focus();
        return;
      }
      if (noteError) noteError.hidden = true;
      noteField.removeAttribute('aria-invalid');
      var subject = name ? 'Portfolio enquiry from ' + name : 'Portfolio enquiry';
      var lines = note ? [note] : [];
      if (name) lines.push('', '— ' + name);
      location.href =
        'mailto:' + composer.dataset.email +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\n'));
    });
  }

  /* ── Footer year ───────────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ── Active section in the nav ───────────────────────────────────────── */
  // The nav previously gave no clue where you were on the page.
  var navLinks = [].slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
  var spied = navLinks
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if (spied.length && 'IntersectionObserver' in window) {
    var mark = function (id) {
      navLinks.forEach(function (a) {
        if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spied.forEach(function (s) { spy.observe(s); });
  }

})();
