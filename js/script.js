/* ==========================================================================
   Storycraft — site logic
   Everything on the Portfolio section is generated from projects.json.
   To add work you edit that file only; nothing in here needs to change.
   ========================================================================== */

(function () {
  'use strict';

  /* ---- Settings you may want to change ---------------------------------- */

  const CONFIG = {
    dataUrl: 'projects.json',

    // Paste your showreel link here — it powers the "Watch the showreel" button.
    // Leave it empty and the button explains that the reel is coming soon.
    showreelUrl: '',

    // Shown if a thumbnail file is missing or misspelled in projects.json.
    fallbackThumb: 'assets/thumbnails/lexus-timbertales.svg',

    // Used by the contact form's mail-app fallback.
    email: 'storycraftcreatives@gmail.com'
  };

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let projects = [];
  let activeFilter = 'All';

  /* ======================================================================
     1. Video URL parsing
     Paste any normal YouTube / Vimeo / .mp4 link into projects.json and
     this works out how to embed it.
     ====================================================================== */

  function parseVideo(url) {
    if (!url) return null;

    // youtube.com/watch?v=ID · youtu.be/ID · /embed/ID · /shorts/ID
    const yt = url.match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
    );
    if (yt) {
      return {
        kind: 'iframe',
        src: 'https://www.youtube-nocookie.com/embed/' + yt[1] +
             '?autoplay=1&rel=0&modestbranding=1&playsinline=1'
      };
    }

    // vimeo.com/ID · vimeo.com/channels/x/ID · player.vimeo.com/video/ID
    const vm = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
    if (vm) {
      return {
        kind: 'iframe',
        src: 'https://player.vimeo.com/video/' + vm[1] + '?autoplay=1&title=0&byline=0&portrait=0'
      };
    }

    // Google Drive — /file/d/ID/view · open?id=ID · uc?id=ID
    // The share link isn't embeddable, so swap it for the /preview form.
    const gd = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})/);
    if (gd) {
      return {
        kind: 'iframe',
        src: 'https://drive.google.com/file/d/' + gd[1] + '/preview'
      };
    }

    // a self-hosted file, e.g. assets/video/my-film.mp4
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)) {
      return { kind: 'file', src: url };
    }

    // a still image, e.g. assets/photos/shot-01.jpg
    if (/\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(url)) {
      return { kind: 'image', src: url };
    }

    // anything else — open it in a new tab rather than guessing
    return { kind: 'external', src: url };
  }

  /* ======================================================================
     1b. Photo galleries
     A project with a "photos": [...] array opens as a lightbox instead
     of a video player.
     ====================================================================== */

  let gallery = { photos: [], index: 0, title: '' };

  function mountGallery(photos, title) {
    gallery = { photos: photos, index: 0, title: title || '' };

    stage.classList.remove('is-portrait');
    stage.classList.add('is-gallery');
    stage.innerHTML = [
      '<img id="galleryImg" alt="">',
      photos.length > 1
        ? '<button class="gallery-nav prev" data-step="-1" aria-label="Previous photo">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>' +
          '</button>' +
          '<button class="gallery-nav next" data-step="1" aria-label="Next photo">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>' +
          '</button>' +
          '<span class="gallery-count"></span>'
        : ''
    ].join('');

    $$('.gallery-nav', stage).forEach(btn => {
      btn.addEventListener('click', () => stepGallery(parseInt(btn.dataset.step, 10)));
    });

    showPhoto(0);
  }

  function showPhoto(i) {
    const img = $('#galleryImg', stage);
    if (!img) return;

    gallery.index = (i + gallery.photos.length) % gallery.photos.length;
    img.src = gallery.photos[gallery.index];
    img.alt = gallery.title + ' — photo ' + (gallery.index + 1);

    const count = $('.gallery-count', stage);
    if (count) count.textContent = (gallery.index + 1) + ' / ' + gallery.photos.length;
  }

  function stepGallery(step) {
    if (gallery.photos.length > 1) showPhoto(gallery.index + step);
  }

  /* ======================================================================
     2. Building the grid
     ====================================================================== */

  const grid      = $('#grid');
  const filterBar = $('#filters');
  const emptyMsg  = $('#gridEmpty');
  const errorMsg  = $('#gridError');

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildCard(project, index) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.dataset.index = index;
    card.dataset.category = project.category || 'Uncategorised';
    card.dataset.orientation = project.orientation === 'portrait' ? 'portrait' : 'landscape';

    const meta = [project.client, project.year].filter(Boolean).join(' · ');
    const photoCount = Array.isArray(project.photos) ? project.photos.length : 0;

    // photo sets get a stack icon and a frame count; video gets a play triangle
    const icon = photoCount
      ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
          '<rect x="3" y="6" width="15" height="12" rx="2.5"/><path d="M21 8v10a2.5 2.5 0 0 1-2.5 2.5H7"/></svg>'
      : '<svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor"><path d="M0 0l14 8L0 16z"/></svg>';

    const badge = photoCount
      ? photoCount + ' photos'
      : (project.duration || '');

    card.setAttribute('aria-label',
      (photoCount ? 'View photos from ' : 'Play ') + (project.title || 'project'));

    card.innerHTML = [
      '<div class="card-frame">',
        '<img src="', escapeHtml(project.thumbnail || CONFIG.fallbackThumb), '" ',
             'alt="', escapeHtml(project.title || ''), '" loading="lazy" decoding="async" ',
             'onerror="this.onerror=null;this.src=\'', CONFIG.fallbackThumb, '\'">',
        '<div class="card-veil"></div>',
        badge ? '<span class="card-duration">' + escapeHtml(badge) + '</span>' : '',
        '<span class="card-play" aria-hidden="true">', icon, '</span>',
        '<div class="card-foot">',
          '<p class="card-title">', escapeHtml(project.title || 'Untitled'), '</p>',
          '<p class="card-sub">',
            '<span class="card-cat">', escapeHtml(project.category || ''), '</span>',
            meta ? ' &nbsp;·&nbsp; ' + escapeHtml(meta) : '',
          '</p>',
        '</div>',
      '</div>'
    ].join('');

    card.addEventListener('click', () => openModal(index));
    return card;
  }

  function renderGrid() {
    grid.innerHTML = '';
    projects.forEach((project, i) => grid.appendChild(buildCard(project, i)));
    applyFilter(activeFilter);
  }

  /* ======================================================================
     3. Filters — derived from the data, so a brand-new category in
        projects.json gets its own button automatically.
     ====================================================================== */

  function renderFilters() {
    const counts = new Map();
    projects.forEach(p => {
      const c = p.category || 'Uncategorised';
      counts.set(c, (counts.get(c) || 0) + 1);
    });

    const categories = [['All', projects.length]].concat(
      Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    );

    filterBar.innerHTML = '';
    categories.forEach(([name, count]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter';
      btn.dataset.filter = name;
      btn.setAttribute('aria-pressed', String(name === activeFilter));
      btn.innerHTML = escapeHtml(name) + '<span class="count">' + count + '</span>';
      btn.addEventListener('click', () => applyFilter(name));
      filterBar.appendChild(btn);
    });
  }

  function applyFilter(name) {
    activeFilter = name;
    let visible = 0;

    $$('.card', grid).forEach(card => {
      const match = name === 'All' || card.dataset.category === name;
      card.classList.toggle('is-hidden', !match);
      if (match) visible++;
    });

    $$('.filter', filterBar).forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === name));
    });

    emptyMsg.hidden = visible > 0;
  }

  /* ======================================================================
     4. Video modal
     ====================================================================== */

  const modal      = $('#modal');
  const stage      = $('#modalStage');
  const modalTitle = $('#modalTitle');
  const modalSub   = $('#modalSub');
  const modalDesc  = $('#modalDesc');
  let lastFocused  = null;

  function mountPlayer(video, isPortrait, emptyHint) {
    stage.innerHTML = '';
    stage.classList.toggle('is-portrait', !!isPortrait);

    const hint = emptyHint ||
      'Add this project’s YouTube, Vimeo or Instagram link to the ' +
      '<span style="color:#4DB6C4">videoUrl</span> field in projects.json.';

    // No link yet — show the project details rather than an empty black box.
    if (!video) {
      stage.innerHTML =
        '<div style="display:grid;place-items:center;height:100%;padding:2rem;text-align:center;gap:.6rem">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#4DB6C4" stroke-width="1.4">' +
            '<rect x="2" y="5" width="15" height="14" rx="3"/><path d="M17 10l5-3v10l-5-3z"/></svg>' +
          '<p style="color:#EDF2F2;font-size:15px;font-weight:600">Video coming soon</p>' +
          '<p style="color:#8C9B9D;font-size:13.5px;max-width:34ch;line-height:1.55">' + hint + '</p>' +
        '</div>';
      return;
    }

    if (video.kind === 'iframe') {
      const frame = document.createElement('iframe');
      frame.src = video.src;
      frame.title = modalTitle.textContent || 'Video player';
      frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      frame.allowFullscreen = true;
      frame.loading = 'lazy';
      stage.appendChild(frame);

    } else if (video.kind === 'file') {
      const el = document.createElement('video');
      el.src = video.src;
      el.controls = true;
      el.autoplay = true;
      el.playsInline = true;
      stage.appendChild(el);

    } else if (video.kind === 'image') {
      const img = document.createElement('img');
      img.src = video.src;
      img.alt = modalTitle.textContent || '';
      stage.classList.add('is-gallery');
      stage.appendChild(img);

    } else {
      const link = document.createElement('a');
      link.href = video.src;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open this video in a new tab';
      link.style.cssText =
        'display:grid;place-items:center;height:100%;color:#4DB6C4;font-size:15px;text-decoration:underline';
      stage.appendChild(link);
    }
  }

  function openModal(index) {
    const project = projects[index];
    if (!project) return;

    lastFocused = document.activeElement;

    modalTitle.textContent = project.title || 'Untitled';
    modalSub.textContent = [project.category, project.role, project.client, project.year]
      .filter(Boolean).join('  ·  ');
    modalDesc.textContent = project.description || '';

    if (Array.isArray(project.photos) && project.photos.length) {
      mountGallery(project.photos, project.title);
    } else {
      mountPlayer(parseVideo(project.videoUrl), project.orientation === 'portrait');
    }

    modal.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    $('#modalClose').focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('is-locked');

    window.setTimeout(() => {
      modal.hidden = true;
      stage.innerHTML = '';          // stops playback and unloads the iframe
      stage.classList.remove('is-portrait', 'is-gallery');
      gallery = { photos: [], index: 0, title: '' };
    }, 300);

    if (lastFocused) lastFocused.focus();
  }

  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();

    // arrow keys step through a photo gallery
    if (!modal.hidden && gallery.photos.length > 1) {
      if (e.key === 'ArrowRight') { e.preventDefault(); stepGallery(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); stepGallery(-1); }
    }

    // keep tabbing inside the dialog while it's open
    if (e.key === 'Tab' && !modal.hidden) {
      const focusables = $$('a[href], button, iframe, video, [tabindex]:not([tabindex="-1"])', modal)
        .filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // "Watch the showreel" in the hero
  $$('[data-reel]').forEach(btn => {
    btn.addEventListener('click', () => {
      lastFocused = btn;
      modalTitle.textContent = 'Showreel';
      modalSub.textContent = 'Anandu R Krishnan  ·  Editor, cinematographer, colourist';
      modalDesc.textContent = 'A short cut of recent work.';
      mountPlayer(parseVideo(CONFIG.showreelUrl), false,
        'Set <span style="color:#4DB6C4">CONFIG.showreelUrl</span> at the top of js/script.js to your showreel link.');
      modal.hidden = false;
      document.body.classList.add('is-locked');
      requestAnimationFrame(() => modal.classList.add('is-open'));
      $('#modalClose').focus();
    });
  });

  /* ======================================================================
     5. Navigation
     ====================================================================== */

  const nav = $('#nav');
  const menuBtn = $('#menuBtn');
  const mobileNav = $('#mobileNav');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-stuck', window.scrollY > 24);
  }, { passive: true });

  menuBtn.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
  });

  $$('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
    });
  });

  // highlight the section you're currently reading
  const sections = $$('section[id]');
  const navLinks = $$('.navlink');

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(s => spy.observe(s));
  }

  /* ======================================================================
     6. Scroll reveals + stat counters
     ====================================================================== */

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function watchReveals() {
    const items = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => io.observe(el));
  }

  function watchCounters() {
    const nums = $$('[data-count]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nums.forEach(el => { el.textContent = el.dataset.count + '+'; });
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10) || 0;
        const start = performance.now();
        const dur = 1400;

        (function step(now) {
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(target * eased).toLocaleString('en-IN') + (t === 1 ? '+' : '');
          if (t < 1) requestAnimationFrame(step);
        })(start);

        obs.unobserve(el);
      });
    }, { threshold: 0.5 });

    nums.forEach(el => io.observe(el));
  }

  /* ======================================================================
     7. Hero video — only fade it in once it's actually playing, so a
        missing file leaves the animated gradient in place.
     ====================================================================== */

  const heroVideo = $('#heroVideo');
  if (heroVideo) {
    heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'), { once: true });
    heroVideo.addEventListener('error', () => heroVideo.remove());
    if (reduceMotion) heroVideo.pause();
  }

  /* ======================================================================
     8. Contact form
     ====================================================================== */

  const form = $('#contactForm');
  const note = $('#formNote');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const required = ['#name', '#email', '#message'].map(s => $(s));
    let bad = null;

    required.forEach(field => {
      const ok = field.checkValidity() && field.value.trim() !== '';
      field.setAttribute('aria-invalid', String(!ok));
      if (!ok && !bad) bad = field;
    });

    if (bad) {
      note.textContent = 'Fill in your name, a valid email and a message.';
      bad.focus();
      return;
    }

    // Not wired up yet — fall back to the visitor's mail app.
    if (form.action.includes('FORM_ID')) {
      const subject = encodeURIComponent('Project enquiry — ' + $('#kind').value);
      const body = encodeURIComponent(
        $('#message').value + '\n\nTimeline: ' + $('#date').value +
        '\n\n' + $('#name').value + '\n' + $('#email').value
      );
      window.location.href = 'mailto:' + CONFIG.email + '?subject=' + subject + '&body=' + body;
      note.textContent = 'Opening your email app.';
      return;
    }

    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    note.textContent = 'Sending…';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error('Bad response');
      form.reset();
      note.textContent = 'Sent. I’ll reply within a day.';
    } catch (err) {
      note.textContent = 'That didn’t send. Email ' + CONFIG.email + ' instead.';
    } finally {
      btn.disabled = false;
    }
  });

  /* ======================================================================
     9. Start
     ====================================================================== */

  async function init() {
    $('#year').textContent = new Date().getFullYear();
    watchReveals();
    watchCounters();

    try {
      const res = await fetch(CONFIG.dataUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('projects.json must contain an array');

      projects = data;
      renderFilters();
      renderGrid();

    } catch (err) {
      console.error('Could not load ' + CONFIG.dataUrl + ':', err);
      grid.hidden = true;
      filterBar.hidden = true;
      errorMsg.hidden = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
