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
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function savedTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
    return saved === 'light' || saved === 'dark' ? saved : null;
  }

  function preferredTheme() {
    return savedTheme() || (systemDark.matches ? 'dark' : 'light');
  }

  // Only an explicit choice is remembered. Until the visitor makes one, the
  // page keeps following the system setting, including changes to it.
  function applyTheme(theme, remember) {
    html.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeBtn');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#15131c' : '#f7f6fb');
    if (!remember) return;
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }

  applyTheme(preferredTheme(), false);

  if (systemDark.addEventListener) {
    systemDark.addEventListener('change', function () {
      if (!savedTheme()) applyTheme(systemDark.matches ? 'dark' : 'light', false);
    });
  }

  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
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
  var TEXT_STEP_NAMES = ['Default', 'Large', 'Larger', 'Largest'];

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
    if (range) {
      range.value = step;
      // A screen reader would otherwise announce a bare "0" to "3".
      range.setAttribute('aria-valuetext', TEXT_STEP_NAMES[step]);
    }

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

  // Opening moves focus into the panel so a keyboard user does not have to
  // tab the whole page to reach it. Closing hides the panel, so focus that
  // was inside it goes back to the button rather than dropping to the page.
  function setPanel(open) {
    if (!a11yPanel || !a11yFab) return;
    var wasOpen = a11yPanel.hasAttribute('open');
    if (open === wasOpen) return;
    var hadFocus = a11yPanel.contains(document.activeElement);
    if (open) a11yPanel.setAttribute('open', '');
    else a11yPanel.removeAttribute('open');
    a11yFab.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var first = a11yPanel.querySelector('input, button');
      if (first) first.focus();
    } else if (hadFocus) {
      a11yFab.focus();
    }
  }

  if (a11yFab && a11yPanel) {
    a11yFab.addEventListener('click', function (event) {
      event.stopPropagation();
      setPanel(!a11yPanel.hasAttribute('open'));
    });
    a11yPanel.addEventListener('click', function (event) { event.stopPropagation(); });
    document.addEventListener('click', function () { setPanel(false); });
  }

  /* ── Motion: parallax shapes, the work stack, the numbers ribbon ──── */
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

  // The numbers ribbon slides sideways as its band crosses the viewport, the
  // echo behind it the other way. One variable, 0 as the band enters at the
  // bottom and 1 as it leaves at the top; the CSS turns it into distance.
  var ribbonBand = document.querySelector('.ribbon-band');
  function updateRibbon() {
    if (!ribbonBand) return;
    var r = ribbonBand.getBoundingClientRect();
    var vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    ribbonBand.style.setProperty('--slide', clamp01((vh - r.top) / (vh + r.height)).toFixed(4));
  }

  function updateParallax() {
    parallaxQueued = false;
    if (motionOff()) return;
    var y = window.pageYOffset;
    parallaxEls.forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-speed')) || 0.1;
      el.style.transform = 'translate3d(0,' + (y * speed).toFixed(1) + 'px,0)';
    });
    updateStack();
    updateRibbon();
    updateOrbit();
  }

  // The contact orbit turns with the page, and the aster against it.
  var orbitEl = document.querySelector('.cx .mo');
  function updateOrbit() {
    if (!orbitEl) return;
    var r = orbitEl.getBoundingClientRect();
    var vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    var p = (vh - r.top) / (vh + r.height);
    orbitEl.style.setProperty('--spin', ((p - 0.5) * 100).toFixed(2) + 'deg');
  }

  function clearMotion() {
    parallaxEls.forEach(function (el) { el.style.transform = ''; });
    clearStack();
    if (ribbonBand) ribbonBand.style.removeProperty('--slide');
    if (orbitEl) orbitEl.style.removeProperty('--spin');
    finishChat();
  }

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

  /* ── Other work panels ─────────────────────────────────────────────── */
  // The panel under the pointer or keyboard focus opens, and stays open
  // after the pointer leaves. Hover waits a beat, so sweeping across the
  // row on the way somewhere else does not set every panel moving.
  var panels = document.querySelector('.panels');
  if (panels) {
    var panelTimer = null;
    var openPanel = function (li) {
      clearTimeout(panelTimer);
      [].forEach.call(panels.children, function (p) { p.classList.toggle('is-open', p === li); });
    };
    [].forEach.call(panels.children, function (li) {
      li.addEventListener('pointerenter', function (event) {
        if (event.pointerType === 'touch') return;
        clearTimeout(panelTimer);
        panelTimer = setTimeout(function () { openPanel(li); }, 110);
      });
      li.addEventListener('pointerleave', function () { clearTimeout(panelTimer); });
      li.addEventListener('focusin', function () { openPanel(li); });
    });
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
  var ZOOMABLE = '.shot, .community-card img';
  function zoomableFrom(node) {
    var img = node.closest && node.closest(ZOOMABLE);
    if (!img || img.closest('.work-card-blank, a') || img.classList.contains('decor')) return null;
    return img;
  }

  // An image is not focusable, so without this the enlarged view was
  // reachable by mouse only. Each one becomes a button that names its image.
  document.querySelectorAll(ZOOMABLE).forEach(function (img) {
    if (!zoomableFrom(img)) return;
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Enlarge image' + (img.alt ? ': ' + img.alt : ''));
  });

  document.addEventListener('click', function (event) {
    var zoomable = zoomableFrom(event.target);
    if (zoomable) {
      openLightbox(zoomable);
      return;
    }
    if (event.target.closest('#lightboxClose') || event.target.id === 'lightbox') {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (event) {
    var lightboxOpen = lightbox && lightbox.hasAttribute('open');

    if (event.key === 'Escape') {
      if (lightboxOpen) closeLightbox();
      else setPanel(false);
      return;
    }
    // The close button is the only control in the lightbox, so Tab stays on it
    // rather than wandering into the page behind.
    if (event.key === 'Tab' && lightboxOpen) {
      event.preventDefault();
      var close = document.getElementById('lightboxClose');
      if (close) close.focus();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && !lightboxOpen) {
      var zoomable = zoomableFrom(event.target);
      if (!zoomable) return;
      event.preventDefault();
      openLightbox(zoomable);
    }
  });

  /* ── Routing ───────────────────────────────────────────────────────── */
  // Case studies are real HTML in the page rather than JS-rendered, so search
  // engines and link previews can read them. Routing just shows and hides.
  var homeView = document.getElementById('home');
  var cases = Array.prototype.slice.call(document.querySelectorAll('.case'));
  var BASE_TITLE = document.title;

  var currentView = null;

  // A plain anchor that wraps or sits inside the open case study, such as the
  // skip link's #main, keeps that case open instead of falling back to home.
  function anchorKeepsCase(slug) {
    var open = currentView && currentView !== 'home' ? document.getElementById(currentView) : null;
    var anchor = document.getElementById(slug);
    if (!open || !anchor) return null;
    return anchor.contains(open) || open.contains(anchor) ? open : null;
  }

  function route() {
    var slug = (location.hash || '').replace(/^#\/?/, '');
    var target = slug ? document.getElementById('case-' + slug) || anchorKeepsCase(slug) : null;
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

  // The link that started a route change. The logo means "back to top", so
  // only it skips the return to the case study's card on the way home.
  var routeTrigger = null;
  document.addEventListener('click', function (event) {
    routeTrigger = event.target.closest('a[href^="#"]');
  }, true);

  // Opening a case study hides the card that was clicked, which would drop
  // keyboard focus to the top of the document. Focus goes to the case
  // study's heading instead, so a screen reader announces where you are.
  function focusCaseHeading(caseEl) {
    var heading = caseEl.querySelector('h1');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  // Leaving a case study returns to its card, so you keep your place in the work list.
  function returnToCard(caseId) {
    var card = homeView && homeView.querySelector('a[href="#/' + caseId.replace(/^case-/, '') + '"]');
    if (!card) return false;
    card.scrollIntoView({ block: 'center' });
    card.focus({ preventScroll: true });
    return true;
  }

  window.addEventListener('hashchange', function () {
    var previousView = currentView;
    var viewChanged = route();
    var slug = (location.hash || '').replace(/^#\/?/, '');
    var section = slug ? document.getElementById(slug) : null;
    var toTop = routeTrigger && routeTrigger.classList.contains('nav-logo');
    routeTrigger = null;

    if (section && !section.classList.contains('case')) {
      // A plain in-page anchor such as #work. Scrolling to top here would
      // override the browser's own jump, which is what broke the nav links.
      section.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'start' });
    } else if (viewChanged && currentView !== 'home') {
      // Entering a case study starts at the top.
      window.scrollTo(0, 0);
      focusCaseHeading(document.getElementById(currentView));
    } else if (viewChanged) {
      if (toTop || !returnToCard(previousView)) {
        window.scrollTo(0, 0);
        replayNameEntrance();
      }
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
    // Text reflows after a late font, a zoom or a resize; measure again or
    // the drawing is left pinned to where the word used to be.
    var replace = function () { if (ponderShown) placePonder(); };
    window.addEventListener('resize', replace);
    if (document.fonts) document.fonts.ready.then(replace);
    if ('ResizeObserver' in window) new ResizeObserver(replace).observe(hook);
    if (document.readyState === 'complete') armPonder();
    else window.addEventListener('load', armPonder);
  }

  /* ── Contact chat ──────────────────────────────────────────────────── */
  // The conversation plays once, the first time the card is properly in
  // view: typing dots, a bubble, typing dots, the next. The cue bubble sends
  // the channels out of the aster. Without the script, or with motion off,
  // the conversation is simply already finished.
  var chat = document.querySelector('.cx');
  var chatTimers = [];
  function finishChat() {
    if (!chat) return;
    chatTimers.forEach(clearTimeout);
    chatTimers = [];
    chat.classList.remove('is-armed');
    chat.classList.add('is-out');
    chat.querySelector('.cx-thread').style.minHeight = '';
  }

  if (chat && !motionOff() && 'IntersectionObserver' in window) {
    var bubbles = [].slice.call(chat.querySelectorAll('.cx-b'));
    var dots = chat.querySelector('.cx-typing');
    var thread = chat.querySelector('.cx-thread');
    // Hold the finished thread's height, so the card does not grow under
    // the reader as each bubble arrives.
    thread.style.minHeight = thread.offsetHeight + 'px';
    chat.classList.add('is-armed');

    var later = function (fn, ms) { chatTimers.push(setTimeout(fn, ms)); };
    var playChat = function () {
      var t = 250;
      bubbles.forEach(function (bubble, n) {
        later(function () { dots.classList.add('is-in'); }, t);
        t += n ? 1000 : 650;
        later(function () {
          dots.classList.remove('is-in');
          bubble.classList.add('is-in');
          if (bubble.classList.contains('cx-b--cue')) chat.classList.add('is-out');
        }, t);
        t += 300;
      });
      // The dots come back as an open invitation to reply.
      later(function () {
        dots.classList.add('is-in');
        chat.classList.remove('is-armed');
        thread.style.minHeight = '';
      }, t + 1500);
    };

    var chatSeen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      chatSeen.disconnect();
      if (motionOff()) finishChat();
      else playChat();
    }, { threshold: 0.3 });
    chatSeen.observe(chat);
  }

  // One channel is picked at a time, Email until the visitor points at
  // another. The aster turns the short way round toward the pick and leans
  // in its direction, then settles back to the centre when the pointer goes.
  var planets = orbitEl ? [].slice.call(orbitEl.querySelectorAll('.mo-b')) : [];
  var aimTotal = 0;
  var aimFrom = -90;
  function pickPlanet(li) {
    planets.forEach(function (p) { p.classList.toggle('is-sel', p === li); });
    var spin = parseFloat(orbitEl.style.getPropertyValue('--spin')) || 0;
    var deg = planets.indexOf(li) * 60 - 90 + spin;
    var turn = ((deg - aimFrom) % 360 + 540) % 360 - 180;
    aimTotal += turn;
    aimFrom = deg;
    var lean = orbitEl.offsetWidth * 0.05;
    var rad = deg * Math.PI / 180;
    orbitEl.style.setProperty('--aim', aimTotal.toFixed(1) + 'deg');
    orbitEl.style.setProperty('--ax', (Math.cos(rad) * lean).toFixed(1) + 'px');
    orbitEl.style.setProperty('--ay', (Math.sin(rad) * lean).toFixed(1) + 'px');
  }
  planets.forEach(function (li) {
    li.addEventListener('pointerenter', function () { pickPlanet(li); });
    li.addEventListener('focusin', function () { pickPlanet(li); });
  });
  if (orbitEl) {
    orbitEl.addEventListener('pointerleave', function () {
      orbitEl.style.removeProperty('--ax');
      orbitEl.style.removeProperty('--ay');
    });
  }

  // Send leans toward a nearby pointer, so the one action here feels ready.
  var sendBtn = chat && chat.querySelector('.cx-send');
  var composeRow = chat && chat.querySelector('.cx-row');
  if (sendBtn && composeRow && finePointer.matches) {
    composeRow.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch' || motionOff() || sendBtn.getAttribute('aria-disabled') === 'true') return;
      var r = sendBtn.getBoundingClientRect();
      var dx = event.clientX - (r.left + r.width / 2);
      var dy = event.clientY - (r.top + r.height / 2);
      sendBtn.style.translate = Math.hypot(dx, dy) > 120 ? '' : (dx * 0.28).toFixed(1) + 'px ' + (dy * 0.28).toFixed(1) + 'px';
    });
    composeRow.addEventListener('pointerleave', function () { sendBtn.style.translate = ''; });
  }

  // The message box starts as one line and grows with what is typed.
  var noteBox = document.getElementById('cNote');
  if (noteBox) {
    noteBox.addEventListener('input', function () {
      noteBox.style.height = '';
      if (noteBox.scrollHeight > noteBox.clientHeight) noteBox.style.height = (noteBox.scrollHeight + 2) + 'px';
    });
  }

  /* ── Copy the email address ────────────────────────────────────────── */
  // Every other channel opens a page or a file. Email copies instead, since
  // plenty of visitors have no mail app wired to mailto links. If the
  // clipboard is unavailable the link falls back to opening the mail app.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* unsupported */ }
      area.remove();
      if (ok) resolve(); else reject();
    });
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-copy]');
    if (!link) return;
    event.preventDefault();
    copyText(link.dataset.copy).then(function () {
      // The orbit swaps its address line for the confirmation; an inline
      // address stays readable and gets a tag beside it.
      var label = link.querySelector('[data-copy-label]');
      var flag = null;
      if (label) {
        if (!link.dataset.copyHtml) link.dataset.copyHtml = label.innerHTML;
        label.textContent = 'Copied!';
      } else if (!link.nextElementSibling || !link.nextElementSibling.classList.contains('copy-flag')) {
        flag = document.createElement('span');
        flag.className = 'copy-flag';
        flag.setAttribute('aria-hidden', 'true');
        flag.textContent = 'Copied!';
        link.after(flag);
      }
      link.classList.add('is-copied');
      var note = document.getElementById('copyNote');
      if (note) note.textContent = 'Email address copied to your clipboard.';
      clearTimeout(link.copyTimer);
      link.copyTimer = setTimeout(function () {
        if (label) label.innerHTML = link.dataset.copyHtml;
        var tag = link.nextElementSibling;
        if (tag && tag.classList.contains('copy-flag')) tag.remove();
        link.classList.remove('is-copied');
        if (note) note.textContent = '';
      }, 1600);
    }, function () {
      location.href = link.href;
    });
  });

  /* ── Email composer ────────────────────────────────────────────────── */
  // GitHub Pages serves static files only, so there is no server of our own.
  // With a Web3Forms access key in the form, the message is posted there and
  // lands in Saranyaa's inbox. Without one, the visitor's own mail app opens
  // with the message pre-filled.
  var composer = document.getElementById('composer');
  if (composer) {
    var keyField = composer.querySelector('[name="access_key"]');
    var accessKey = keyField ? keyField.value.trim() : '';
    var nameField = document.getElementById('cName');
    var emailField = document.getElementById('cEmail');
    var noteField = document.getElementById('cNote');
    var noteError = document.getElementById('cNoteError');
    var emailError = document.getElementById('cEmailError');
    var sendError = document.getElementById('cSendError');
    var sendButton = composer.querySelector('.cx-send');
    var hint = document.getElementById('cHint');
    var thread = document.querySelector('.cx-thread');

    // The form's own action posts to Web3Forms for visitors without the
    // script. With it, the checks below replace the browser's validation
    // bubbles with the inline errors.
    composer.noValidate = true;

    if (accessKey) {
      composer.classList.add('is-direct');
    } else {
      emailField.required = false;
      if (hint) hint.textContent = 'Opens your own email app with the message ready to send.';
    }

    // The bubbles and receipt are visual. A screen reader hears the same
    // progress through the page's polite live region. It sits after this
    // script in the markup, so it is looked up when needed, not at load.
    var announce = function (text) {
      var liveNote = document.getElementById('copyNote');
      if (liveNote) liveNote.textContent = text;
    };

    var isBusy = function () {
      return sendButton.getAttribute('aria-disabled') === 'true';
    };

    var flagField = function (field, error, bad) {
      if (error) error.hidden = !bad;
      if (bad) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    };

    var copyLink = function () {
      var link = document.createElement('a');
      link.href = 'mailto:' + composer.dataset.email;
      link.textContent = composer.dataset.email;
      link.dataset.copy = composer.dataset.email;
      link.title = 'Copy email address';
      return link;
    };

    // One message, then the chat closes: there is nobody on the other end
    // to answer, so the typing dots go and a receipt says where it went.
    var postBubble = function (note, receiptText) {
      if (!thread) return null;
      finishChat();
      var typing = thread.querySelector('.cx-typing');
      if (typing) typing.remove();
      var mine = document.createElement('li');
      mine.className = 'cx-b cx-b--me is-in';
      mine.textContent = note;
      var receipt = document.createElement('li');
      receipt.className = 'cx-receipt';
      receipt.textContent = receiptText;
      thread.appendChild(mine);
      thread.appendChild(receipt);
      return { mine: mine, receipt: receipt };
    };

    // aria-disabled rather than disabled: a disabled button drops the focus
    // of the visitor who just pressed it.
    var setButton = function (label, disabled) {
      sendButton.firstChild.textContent = label;
      if (disabled) sendButton.setAttribute('aria-disabled', 'true');
      else sendButton.removeAttribute('aria-disabled');
      sendButton.style.translate = '';
    };

    var closeChat = function (hintText) {
      composer.dataset.sent = 'true';
      [nameField, emailField, noteField].forEach(function (field) { field.readOnly = true; });
      setButton('Sent', true);
      if (hint) {
        hint.textContent = hintText;
        hint.appendChild(copyLink());
      }
    };

    var sendByMailApp = function (name, note) {
      var subject = name ? 'Portfolio enquiry from ' + name : 'Portfolio enquiry';
      var lines = [note];
      if (name) lines.push('', '— ' + name);
      var mailto =
        'mailto:' + composer.dataset.email +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\n'));
      if (!thread) { location.href = mailto; return; }
      postBubble(note, 'Drafted in your email app. Hit send there and it reaches me.');
      announce('Opening your email app with the message drafted.');
      closeChat('Nothing opened? Click to copy my address: ');
      setTimeout(function () { location.href = mailto; }, motionOff() ? 0 : 550);
    };

    var sendDirect = function (name, email, note) {
      var posted = postBubble(note, 'Sending…');
      setButton('Sending', true);
      announce('Sending your message…');
      if (sendError) sendError.hidden = true;

      var payload = {
        access_key: accessKey,
        subject: name ? 'Portfolio enquiry from ' + name : 'Portfolio enquiry',
        from_name: name || 'Portfolio visitor',
        name: name,
        email: email,
        message: note
      };
      var abort = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (abort) abort.abort(); }, 15000);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: abort ? abort.signal : undefined
      })
        .then(function (response) { return response.json(); })
        .then(function (result) {
          clearTimeout(timer);
          if (!result || !result.success) throw new Error('rejected');
          if (posted) posted.receipt.textContent = 'Delivered. I’ll reply to ' + email + '.';
          announce('Message delivered. Saranyaa will reply to ' + email + '.');
          closeChat('Sent. If you need my address too, click to copy it: ');
        })
        .catch(function () {
          clearTimeout(timer);
          // Nothing reached her, so the bubble comes back out of the thread
          // and the message stays in the box to try again.
          if (posted) { posted.mine.remove(); posted.receipt.remove(); }
          setButton('Send', false);
          announce('');
          if (sendError) {
            sendError.textContent = 'That didn’t go through. Try again, or copy my address: ';
            sendError.appendChild(copyLink());
            sendError.hidden = false;
          }
        });
    };

    composer.addEventListener('submit', function (event) {
      event.preventDefault();
      if (composer.dataset.sent || isBusy()) return;
      var name = (nameField.value || '').trim();
      var email = (emailField.value || '').trim();
      var note = (noteField.value || '').trim();

      // Without this an empty form sent a blank message, which looks broken
      // to the sender and tells Saranyaa nothing.
      flagField(noteField, noteError, !note);
      var badEmail = !!accessKey && (!email || !emailField.checkValidity());
      flagField(emailField, emailError, badEmail);
      if (!note || badEmail) {
        (badEmail ? emailField : noteField).focus();
        return;
      }

      // Bots tick the hidden box; they get the same receipt and nothing is sent.
      var trap = composer.querySelector('[name="botcheck"]');
      if (trap && trap.checked) {
        postBubble(note, 'Delivered.');
        closeChat('Sent. ');
        return;
      }

      if (accessKey) sendDirect(name, email, note);
      else sendByMailApp(name, note);
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
