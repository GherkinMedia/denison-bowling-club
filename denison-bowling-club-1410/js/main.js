(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var clamp01 = function (v) { return Math.min(1, Math.max(0, v)); };

  // ---------------------------------------------------------------------------
  // Smooth scrolling (Lenis). Drives the native scroll, so the pinned hero and
  // fixed header keep working. In-page links glide and stop below the header.
  // ---------------------------------------------------------------------------
  var lenis = null;
  if (!(reduceMotion && reduceMotion.matches)) {
    if (window.Lenis) {
      lenis = new window.Lenis({
        lerp: 0.09,                 // lower = smoother / longer glide
        anchors: { offset: -82 }    // land just below the fixed header on #links
      });
      var lenisRaf = function (time) { lenis.raf(time); window.requestAnimationFrame(lenisRaf); };
      window.requestAnimationFrame(lenisRaf);
    } else {
      // Fallback if the library could not load (e.g. offline)
      document.documentElement.style.scrollBehavior = 'smooth';
    }
  }

  // ---------------------------------------------------------------------------
  // First-fold scroll sequence: while the hero is pinned, the headline block
  // moves up and fades out, then the welcome block rises in from the bottom.
  // ---------------------------------------------------------------------------
  var track = document.querySelector('.hero-track');
  var heroContent = document.querySelector('.hero__content');
  var heroMain = document.querySelector('.hero__main');
  var heroAside = document.querySelector('.hero__aside');

  function updateHeroSequence() {
    if (!track || !heroContent || !heroMain || !heroAside) return;

    // Both hero blocks show together on every screen size (no scroll swap)
    heroContent.style.removeProperty('--exit');
    heroContent.style.removeProperty('--enter');
    heroMain.classList.remove('is-hidden');
    heroAside.classList.remove('is-hidden');
  }

  // ---------------------------------------------------------------------------
  // Fixed site header
  // - Follows the bottom of the top bar, then docks at the top of the screen.
  // - Turns white (coloured logo, navy links) over light sections, and goes back
  //   to the transparent first-fold style over dark ones (e.g. Upcoming events).
  // ---------------------------------------------------------------------------
  var siteHeader = document.querySelector('.site-header');
  var utilityBar = document.querySelector('.utility-bar');
  // Sections say what the header should look like over them: data-header-theme="light" (white header)
  // or "dark" (transparent header, as on the first fold). Anything else, e.g. the hero, counts as dark.
  var themedSections = Array.prototype.slice.call(document.querySelectorAll('[data-header-theme]'));

  var headerMobile = window.matchMedia('(max-width: 1100px)');
  function updateHeader() {
    if (!siteHeader) return;
    var top = utilityBar ? Math.max(0, utilityBar.getBoundingClientRect().bottom) : 0;
    siteHeader.style.setProperty('--header-top', top + 'px');

    // White only while a light section sits behind the bottom edge of the header
    // Fixed line (not offsetHeight, which changes between states) so it can't flicker at a boundary
    var line = top + 84;
    var themeAt = function (name) {
      return themedSections.some(function (section) {
        var r = section.getBoundingClientRect();
        return section.getAttribute('data-header-theme') === name && r.top <= line && r.bottom > line;
      });
    };
    // Hamburger layout (tablet/phone): white as soon as the page is scrolled, over every section
    var solid = headerMobile.matches ? window.scrollY > 0 : themeAt('light');
    siteHeader.classList.toggle('is-deep', !solid && themeAt('deep'));
    if (solid !== siteHeader.classList.contains('is-solid')) {
      siteHeader.classList.toggle('is-solid', solid);
      if (!solid) closeAllMenus();
    }
  }

  // ---------------------------------------------------------------------------
  // Fade-in on scroll: content rises in as it enters from the bottom, and resets
  // when it drops back below the screen (scrolling up past it does not reset).
  // ---------------------------------------------------------------------------
  var reveals = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  var revealOn = reveals.length && !(reduceMotion && reduceMotion.matches);
  if (revealOn) {
    // Stagger items within the same column: 0s, 0.1s, 0.2s ...
    var groups = new Map();
    reveals.forEach(function (el) {
      var group = el.closest('.intro__heading, .intro__body, .features, .bowls__head, .functions__head, .section-head, .news__grid, .join__content') || el.parentNode;
      var i = groups.get(group) || 0;
      el.style.setProperty('--reveal-delay', (i * 0.1).toFixed(1) + 's');
      groups.set(group, i + 1);
    });
    document.documentElement.classList.add('js-reveal');
  }

  function updateReveals() {
    if (!revealOn) return;
    var vh = window.innerHeight;
    reveals.forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      var shown = el.classList.contains('is-revealed');
      if (!shown && top < vh * 0.9) el.classList.add('is-revealed');
      else if (shown && top > vh) el.classList.remove('is-revealed');
    });
  }

  // ---------------------------------------------------------------------------
  // Upcoming events: rotates automatically (6s) with previous/next arrows.
  // ---------------------------------------------------------------------------
  var eventsSection = document.querySelector('.events');
  var eventPhotos = eventsSection ? Array.prototype.slice.call(eventsSection.querySelectorAll('.events__photo')) : [];
  var eventBgs = eventsSection ? Array.prototype.slice.call(eventsSection.querySelectorAll('.events__bg')) : [];
  var eventPrev = eventsSection ? eventsSection.querySelector('.events__arrow--prev') : null;
  var eventNext = eventsSection ? eventsSection.querySelector('.events__arrow--next') : null;
  if (eventPrev) eventPrev.addEventListener('click', function () { goToEvent(activeEvent - 1); });
  if (eventNext) eventNext.addEventListener('click', function () { goToEvent(activeEvent + 1); });
  if (eventsSection) {
    ['mouseenter', 'focusin'].forEach(function (ev) { eventsSection.addEventListener(ev, function () { eventHover = true; syncEventTimer(); }); });
    ['mouseleave', 'focusout'].forEach(function (ev) { eventsSection.addEventListener(ev, function () { eventHover = false; syncEventTimer(); }); });
  }
  var eventItems = eventsSection ? Array.prototype.slice.call(eventsSection.querySelectorAll('.event')) : [];
  var eventCurrent = eventsSection ? eventsSection.querySelector('.events__current') : null;
  var activeEvent = -1;

  function setActiveEvent(index) {
    activeEvent = index;
    eventItems.forEach(function (item, i) {
      item.classList.toggle('is-active', i === index);
      item.classList.toggle('is-before', i < index);
      item.classList.toggle('is-after', i > index);
      if (i === index) item.removeAttribute('aria-hidden'); else item.setAttribute('aria-hidden', 'true');
      item.querySelectorAll('a, button').forEach(function (el) {
        if (i === index) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', '-1');
      });
    });
    eventPhotos.forEach(function (photo, i) {
      photo.classList.toggle('is-active', i === index);
      photo.classList.toggle('is-past', i < index);   // stays in place underneath
      if (i === index) photo.removeAttribute('aria-hidden'); else photo.setAttribute('aria-hidden', 'true');
    });
    eventBgs.forEach(function (img, i) { img.classList.toggle('is-active', i === index); });
    if (eventCurrent) eventCurrent.textContent = String(index + 1).padStart(2, '0');
  }

  // Arrows: step to the previous / next event (wrapping); showEvent restarts the timer bar
  function goToEvent(index) {
    showEvent(index);
  }

  // Autoplay: the progress bar under the counter is the timer. It fills over
  // 6 seconds; when full, the next event shows and the bar starts again. Paused
  // (bar freezes) on hover / keyboard focus, when the section is off screen or the
  // tab is hidden. Arrows step manually and restart it.
  var EVENT_DURATION = 6000;
  var eventHover = false, eventPaused = true, eventElapsed = 0, eventLast = 0;
  var eventFill = eventsSection ? eventsSection.querySelector('.events__fill') : null;
  var eventsAuto = !(reduceMotion && reduceMotion.matches) && eventItems.length > 1;
  if (eventsSection) eventsSection.classList.toggle('is-auto', eventsAuto);
  function eventsOnScreen() {
    var r = eventsSection.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }
  function syncEventTimer() {
    if (!eventsAuto) return;
    eventPaused = !eventsOnScreen() || eventHover || document.hidden;
  }
  function restartEventFill() {
    eventElapsed = 0;
    if (eventFill && eventsAuto) eventFill.style.transform = 'scaleX(0)';
  }
  function tickEvents(now) {
    var dt = eventLast ? Math.min(now - eventLast, 100) : 0;   // cap the step after a stall
    eventLast = now;
    if (!eventPaused) {
      eventElapsed += dt;
      if (eventElapsed >= EVENT_DURATION) showEvent(activeEvent + 1);
      else eventFill.style.transform = 'scaleX(' + (eventElapsed / EVENT_DURATION).toFixed(4) + ')';
    }
    window.requestAnimationFrame(tickEvents);
  }
  if (eventsAuto && eventFill) window.requestAnimationFrame(tickEvents);
  document.addEventListener('visibilitychange', function () { if (eventsSection) syncEventTimer(); });
  function showEvent(index) {
    var count = eventItems.length;
    index = (index + count) % count;
    setActiveEvent(index);
    // without autoplay (reduced motion) the bar shows how far through the list you are
    eventsSection.style.setProperty('--events-progress', ((index + 1) / count).toFixed(4));
    restartEventFill();
  }
  function updateEvents() {
    if (!eventsSection || !eventItems.length) return;
    if (activeEvent < 0) showEvent(0);
    syncEventTimer();
  }

  // ---------------------------------------------------------------------------
  // Bowls & Activities: vertical scroll moves the card row sideways while the
  // section is pinned. The section is made exactly tall enough for the row to
  // travel from its first card to its last.
  // ---------------------------------------------------------------------------
  var bowls = document.querySelector('.bowls');
  var bowlsPin = bowls ? bowls.querySelector('.bowls__pin') : null;
  var bowlsTrack = bowls ? bowls.querySelector('.bowls__track') : null;
  var bowlsCards = bowls ? bowls.querySelectorAll('.activity') : [];
  var bowlsCurrent = bowls ? bowls.querySelector('.bowls__current') : null;
  var bowlsDistance = 0;

  function measureBowls() {
    if (!bowls || !bowlsTrack) return;
    bowlsDistance = Math.max(0, bowlsTrack.scrollWidth - bowlsPin.clientWidth);
    bowls.style.height = (window.innerHeight + bowlsDistance) + 'px';
  }

  function updateBowls() {
    if (!bowls || !bowlsTrack) return;
    var r = bowls.getBoundingClientRect();
    var range = bowls.offsetHeight - window.innerHeight;
    var progress = range > 0 ? clamp01(-r.top / range) : 0;
    bowls.style.setProperty('--bowls-x', (progress * bowlsDistance).toFixed(1));
    bowls.style.setProperty('--bowls-progress', progress.toFixed(4));
    if (bowlsCurrent && bowlsCards.length) {
      var index = Math.round(progress * (bowlsCards.length - 1));
      var label = String(index + 1).padStart(2, '0');
      if (bowlsCurrent.textContent !== label) bowlsCurrent.textContent = label;
    }
  }

  measureBowls();
  window.addEventListener('load', function () { measureBowls(); requestUpdate(); });
  window.addEventListener('resize', measureBowls);

  // ---------------------------------------------------------------------------
  // Functions & Venue Hire slideshow: cross-fades every 5 seconds while the
  // section is on screen, with previous/next arrows. Pauses on hover/focus;
  // autoplay is off for reduced motion (arrows still work).
  // ---------------------------------------------------------------------------
  var functions = document.querySelector('.functions');
  var fnImgs = functions ? Array.prototype.slice.call(functions.querySelectorAll('.functions__img')) : [];
  var fnCaps = functions ? Array.prototype.slice.call(functions.querySelectorAll('.functions__caption')) : [];
  var fnCurrent = functions ? functions.querySelector('.functions__current') : null;
  var fnIndex = 0, fnTimer = null, fnHover = false, fnOnScreen = false;

  function showSlide(i) {
    fnIndex = (i + fnImgs.length) % fnImgs.length;
    fnImgs.forEach(function (img, k) { img.classList.toggle('is-active', k === fnIndex); });
    fnCaps.forEach(function (cap, k) {
      cap.classList.toggle('is-active', k === fnIndex);
      if (k === fnIndex) cap.removeAttribute('aria-hidden'); else cap.setAttribute('aria-hidden', 'true');
    });
    if (fnCurrent) fnCurrent.textContent = String(fnIndex + 1).padStart(2, '0');
  }

  function syncSlideshow() {
    var run = fnImgs.length > 1 && fnOnScreen && !fnHover && !(reduceMotion && reduceMotion.matches);
    if (run && !fnTimer) fnTimer = window.setInterval(function () { showSlide(fnIndex + 1); }, 5000);
    else if (!run && fnTimer) { window.clearInterval(fnTimer); fnTimer = null; }
  }

  function updateFunctions() {
    if (!functions) return;
    var r = functions.getBoundingClientRect();
    var on = r.top < window.innerHeight && r.bottom > 0;
    if (on !== fnOnScreen) { fnOnScreen = on; syncSlideshow(); }
  }

  function restartSlideshow() {
    if (fnTimer) { window.clearInterval(fnTimer); fnTimer = null; }
    syncSlideshow();
  }

  if (functions) {
    var media = functions.querySelector('.functions__media');
    var prevBtn = functions.querySelector('.functions__arrow--prev');
    var nextBtn = functions.querySelector('.functions__arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', function () { showSlide(fnIndex - 1); restartSlideshow(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { showSlide(fnIndex + 1); restartSlideshow(); });
    // Left / right arrow keys while the gallery has focus
    media.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { showSlide(fnIndex - 1); restartSlideshow(); }
      else if (e.key === 'ArrowRight') { showSlide(fnIndex + 1); restartSlideshow(); }
    });
    ['mouseenter', 'focusin'].forEach(function (ev) { media.addEventListener(ev, function () { fnHover = true; syncSlideshow(); }); });
    ['mouseleave', 'focusout'].forEach(function (ev) { media.addEventListener(ev, function () { fnHover = false; syncSlideshow(); }); });
  }

  // ---------------------------------------------------------------------------
  // Functions & Venue Hire and Visit Us: make sure the details column always
  // fits in one screen below the header.
  // ---------------------------------------------------------------------------
  // Shrinks a full-screen two-column section's scale (--fit / --fn-fit) until
  // its content column fits in the space below the header.
  function fitSection(section, contentSel, prop) {
    if (!section) return;
    var content = section.querySelector(contentSel);
    section.style.setProperty(prop, '1');
    if (window.matchMedia('(max-width: 1100px)').matches) return; // stacked layout scrolls normally
    content.style.justifyContent = 'flex-start'; // so overflow is measurable
    var fits = function () { return content.scrollHeight <= content.clientHeight + 1; };
    if (!fits()) {
      var lo = 0.5, hi = 1;
      for (var i = 0; i < 8; i++) {
        var mid = (lo + hi) / 2;
        section.style.setProperty(prop, mid.toFixed(3));
        if (fits()) lo = mid; else hi = mid;
      }
      section.style.setProperty(prop, lo.toFixed(3));
    }
    content.style.justifyContent = '';
  }
  function fitFullScreenSections() {
    fitSection(functions, '.functions__content', '--fn-fit');
    fitSection(document.querySelector('.visit'), '.visit__content', '--fit');
  }
  fitFullScreenSections();
  window.addEventListener('resize', fitFullScreenSections);
  window.addEventListener('load', fitFullScreenSections);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitFullScreenSections);

  // ---------------------------------------------------------------------------
  // Sponsors: when there are more logos than fit, slide one page every 4s
  // while the section is on screen (paused on hover, off for reduced motion).
  // ---------------------------------------------------------------------------
  var sponsors = document.querySelector('.sponsors');
  if (sponsors) {
    var spTrack = sponsors.querySelector('.sponsors__track');
    var spItems = spTrack.children;
    var spCur = sponsors.querySelector('.sponsors__current');
    var spTot = sponsors.querySelector('.sponsors__total');
    var spPage = 0, spPages = 1, spTimer = null, spHover = false;
    var spLayout = function () {
      var vp = sponsors.querySelector('.sponsors__viewport').clientWidth;
      var w = spItems[0].getBoundingClientRect().width;
      var gap = parseFloat(getComputedStyle(spTrack).columnGap) || 0;
      var perPage = Math.max(1, Math.round((vp + gap) / (w + gap)));
      spPages = Math.ceil(spItems.length / perPage);
      sponsors.classList.toggle('is-static', spPages < 2);
      spPage = Math.min(spPage, spPages - 1);
      var x = Math.min(spPage * perPage * (w + gap), spTrack.scrollWidth - vp);
      sponsors.style.setProperty('--sp-x', Math.max(0, x).toFixed(1));
      sponsors.style.setProperty('--sp-progress', ((spPage + 1) / spPages).toFixed(4));
      spCur.textContent = String(spPage + 1).padStart(2, '0');
      spTot.textContent = String(spPages).padStart(2, '0');
    };
    var spSync = function () {
      var r = sponsors.getBoundingClientRect();
      var run = spPages > 1 && !spHover && r.top < window.innerHeight && r.bottom > 0 && !(reduceMotion && reduceMotion.matches);
      if (run && !spTimer) spTimer = setInterval(function () { spPage = (spPage + 1) % spPages; spLayout(); }, 4000);
      else if (!run && spTimer) { clearInterval(spTimer); spTimer = null; }
    };
    sponsors.addEventListener('mouseenter', function () { spHover = true; spSync(); });
    sponsors.addEventListener('mouseleave', function () { spHover = false; spSync(); });
    window.addEventListener('resize', function () { spLayout(); spSync(); });
    window.addEventListener('scroll', spSync, { passive: true });
    window.addEventListener('load', function () { spLayout(); spSync(); });
    spLayout();
  }

  // ---------------------------------------------------------------------------
  // Image wipe-in (Functions gallery, Visit Us photo): reveals when 15% into view, resets once it
  // drops back below the screen so it plays again. Off for reduced motion.
  // ---------------------------------------------------------------------------
  var wipes = Array.prototype.slice.call(document.querySelectorAll('.img-reveal'));
  var wipeOn = wipes.length && !(reduceMotion && reduceMotion.matches);
  if (wipeOn) document.documentElement.classList.add('js-wipe');
  function updateWipes() {
    if (!wipeOn) return;
    var vh = window.innerHeight;
    wipes.forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      if (top < vh * 0.85) el.classList.add('is-in');
      else if (top > vh) el.classList.remove('is-in');
    });
  }

  // ---------------------------------------------------------------------------
  // Scroll / resize loop
  // ---------------------------------------------------------------------------
  var ticking = false;
  function onFrame() {
    ticking = false;
    updateHeroSequence();
    updateHeader();
    updateDrawing();
    updateReveals();
    updateEvents();
    updateWipes();
    updateBowls();
    updateFunctions();
  }
  function requestUpdate() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onFrame); }
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  if (reduceMotion && reduceMotion.addEventListener) reduceMotion.addEventListener('change', requestUpdate);

  // ---------------------------------------------------------------------------
  // Mobile navigation toggles (hero nav + fixed header nav)
  // ---------------------------------------------------------------------------
  var navs = Array.prototype.slice.call(document.querySelectorAll('.nav'));

  function setOpen(nav, open) {
    var toggle = nav.querySelector('.nav__toggle');
    if (!toggle) return;
    var label = toggle.querySelector('.sr-only');
    var icon = toggle.querySelector('i');
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close menu' : 'Open menu';
    if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
  }

  function closeAllMenus() {
    navs.forEach(function (nav) { if (nav.classList.contains('is-open')) setOpen(nav, false); });
  }

  navs.forEach(function (nav) {
    var toggle = nav.querySelector('.nav__toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      setOpen(nav, !nav.classList.contains('is-open'));
    });
    nav.querySelectorAll('.nav__links a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(nav, false); });
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    navs.forEach(function (nav) {
      if (nav.classList.contains('is-open')) {
        setOpen(nav, false);
        nav.querySelector('.nav__toggle').focus();
      }
    });
  });

  document.addEventListener('click', function (e) {
    navs.forEach(function (nav) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(nav, false);
    });
  });

  // ---------------------------------------------------------------------------
  // About illustration: draw the lines when it scrolls into view
  // ---------------------------------------------------------------------------
  var drawing = document.querySelector('.line-draw');
  var drawingArmed = false;
  if (drawing && !(reduceMotion && reduceMotion.matches)) {
    drawing.querySelectorAll('.line-draw__strokes path').forEach(function (path, i) {
      var len = Math.ceil(path.getTotalLength()) + 2;
      path.style.setProperty('--len', len);
      path.style.setProperty('--delay', (i * 0.04).toFixed(2) + 's'); // slight stagger
    });
    drawing.classList.add('is-ready');
    window.getComputedStyle(drawing.querySelector('.line-draw__strokes path')).strokeDashoffset; // flush hidden start state
    drawingArmed = true;
  }

  // Called from the scroll loop. Replays every time:
  // - draws once a third of the illustration is on screen
  // - resets to hidden once it has fully left the screen, ready to draw again
  function updateDrawing() {
    if (!drawingArmed) return;
    var r = drawing.getBoundingClientRect();
    var vh = window.innerHeight;
    var drawn = drawing.classList.contains('is-drawn');
    var inView = r.top < vh - r.height * 0.35 && r.bottom > r.height * 0.35;
    var outOfView = r.top >= vh || r.bottom <= 0;

    if (inView && !drawn) drawing.classList.add('is-drawn');
    else if (outOfView && drawn) drawing.classList.remove('is-drawn'); // instant reset, no transition
  }

  // ---------------------------------------------------------------------------
  // Hero video: respect reduced-motion preference
  // ---------------------------------------------------------------------------
  var video = document.querySelector('.hero__video');
  if (video && reduceMotion) {
    var applyMotionPref = function () {
      if (reduceMotion.matches) {
        video.pause();
        video.removeAttribute('autoplay');
      } else {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
    };
    applyMotionPref();
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', applyMotionPref);
  }

  onFrame();
  // ---------------------------------------------------------------------------
  // Footer accordion: on phones each column collapses to its heading. On larger
  // screens every column stays open and the headings are not interactive.
  // ---------------------------------------------------------------------------
  var footerToggles = Array.prototype.slice.call(document.querySelectorAll('.footer__toggle'));
  var footerMobile = window.matchMedia('(max-width: 720px)');
  function setFooterOpen(btn, open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.closest('.footer__col').classList.toggle('is-open', open);
  }
  function setFooterMode() {
    footerToggles.forEach(function (btn) {
      setFooterOpen(btn, !footerMobile.matches);
      if (footerMobile.matches) btn.removeAttribute('tabindex'); else btn.setAttribute('tabindex', '-1');
    });
  }
  footerToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!footerMobile.matches) return;
      setFooterOpen(btn, btn.getAttribute('aria-expanded') !== 'true');
    });
  });
  if (footerMobile.addEventListener) footerMobile.addEventListener('change', setFooterMode);
  setFooterMode();
})();
