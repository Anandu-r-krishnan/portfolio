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
    showreelUrl: "https://www.dropbox.com/scl/fi/c9cqkddrxpfoxogknnib0/Thursday.mp4?rlkey=e7f7yjncbdkxa2vqozlxwp8f7&st=4ym9j95z&dl=1",

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
     Paste any normal video or cloud-drive link into projects.json and this
     works out how to embed it. Supported:

       YouTube · Vimeo · Instagram · Facebook · Dailymotion · Loom ·
       Streamable · Wistia · Google Drive · Dropbox · OneDrive / SharePoint ·
       Box · MEGA · pCloud · direct .mp4/.webm/.mov links · still images

     Anything unrecognised is still *tried* as a video file before falling
     back to a plain "open in a new tab" link, so most direct download URLs
     from other drives will just play.
     ====================================================================== */

  // Whatever a share link looks like, the share URL itself is worth keeping
  // so the fallback link can point at something a human can open.
  function video(kind, src, original) {
    return { kind: kind, src: src, original: original || src };
  }

  // OneDrive / 1drv.ms share links can be turned into a direct content URL
  // by base64url-encoding the share link itself. No API key needed.
  function onedriveDirect(url) {
    let b64;
    try {
      b64 = btoa(unescape(encodeURIComponent(url)));
    } catch (err) {
      return null;
    }
    return 'https://api.onedrive.com/v1.0/shares/u!' +
      b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') +
      '/root/content';
  }

  function addParam(url, param) {
    if (new RegExp('[?&]' + param.split('=')[0] + '=').test(url)) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + param;
  }

  // A Dropbox share link copied from the "Copy link" button always carries
  // dl=0 (opens Dropbox's preview page instead of the file itself). Swap
  // that for raw=1 — the one param that reliably serves the file directly,
  // for both current (/scl/fi/…) and legacy (/s/…) share-link formats, with
  // no domain change needed. Used for videoUrl AND fullQualityUrl, so
  // pasting a plain share link into either field in projects.json just
  // works without hand-editing the URL first.
  function dropboxRaw(url) {
    if (!url || !/dropbox\.com\//.test(url)) return url;
    return addParam(url.replace(/[?&]dl=[01]\b/g, ''), 'raw=1');
  }

  function parseVideo(url) {
    if (!url) return null;
    url = String(url).trim();
    if (!url) return null;

    /* ---- Video platforms ------------------------------------------------ */

    // youtube.com/watch?v=ID · youtu.be/ID · /embed/ID · /shorts/ID · /live/ID
    const yt = url.match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/
    );
    if (yt) {
      return video('iframe',
        'https://www.youtube-nocookie.com/embed/' + yt[1] +
        '?autoplay=1&rel=0&modestbranding=1&playsinline=1', url);
    }

    // vimeo.com/ID · vimeo.com/channels/x/ID · player.vimeo.com/video/ID
    const vm = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
    if (vm) {
      return video('iframe',
        'https://player.vimeo.com/video/' + vm[1] +
        '?autoplay=1&title=0&byline=0&portrait=0', url);
    }

    // instagram.com/p/ID · /reel/ID · /reels/ID · /tv/ID
    const ig = url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
    if (ig) {
      const type = ig[1] === 'reels' ? 'reel' : ig[1];
      return video('iframe',
        'https://www.instagram.com/' + type + '/' + ig[2] + '/embed/captioned/', url);
    }

    // facebook.com/watch/?v=ID · /videos/ID · fb.watch/ID
    if (/(?:facebook\.com\/(?:watch\/?\?|.*\/videos\/)|fb\.watch\/)/.test(url)) {
      return video('iframe',
        'https://www.facebook.com/plugins/video.php?href=' +
        encodeURIComponent(url) + '&autoplay=true&show_text=false', url);
    }

    // dailymotion.com/video/ID · dai.ly/ID
    const dm = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
    if (dm) {
      return video('iframe',
        'https://www.dailymotion.com/embed/video/' + dm[1] + '?autoplay=1', url);
    }

    // loom.com/share/ID
    const lo = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
    if (lo) {
      return video('iframe', 'https://www.loom.com/embed/' + lo[1] + '?autoplay=1', url);
    }

    // streamable.com/ID
    const st = url.match(/streamable\.com\/(?:e\/)?([\w-]+)/);
    if (st) {
      return video('iframe', 'https://streamable.com/e/' + st[1] + '?autoplay=1', url);
    }

    // wistia: /medias/ID · wi.st/medias/ID
    const wi = url.match(/(?:wistia\.com|wi\.st)\/(?:medias|embed\/medias)\/([\w-]+)/);
    if (wi) {
      return video('iframe',
        'https://fast.wistia.net/embed/iframe/' + wi[1] + '?autoPlay=true', url);
    }

    /* ---- Cloud drives --------------------------------------------------- */

    // Google Drive — /file/d/ID/view · open?id=ID · uc?id=ID
    // The share link isn't embeddable, so swap it for the /preview form.
    const gd = url.match(
      /drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)([\w-]{20,})/
    );
    if (gd) {
      const v = video('iframe', 'https://drive.google.com/file/d/' + gd[1] + '/preview', url);
      v.driveId = gd[1];   // kept for reference; not currently used for sizing
      return v;
    }

    // Dropbox — both current (/scl/fi/…, carries an rlkey token) and legacy
    // (/s/…) share-link formats work the same way: swap dl=0/dl=1 for
    // raw=1 on dropbox.com itself, no domain change needed. Applied to
    // BOTH src and original — original is what the fallback "open in a
    // new tab" link uses if the embed fails to play, so it needs raw=1
    // too, not just the playback URL.
    if (/dropbox\.com\/(scl\/|s\/)/.test(url)) {
      const raw = dropboxRaw(url);
      return video('file', raw, raw);
    }

    // OneDrive personal — 1drv.ms/… · onedrive.live.com/…
    if (/(?:1drv\.ms\/|onedrive\.live\.com\/)/.test(url)) {
      const direct = onedriveDirect(url);
      if (direct) return video('file', direct, url);
      return video('iframe', url.replace('/redir?', '/embed?'), url);
    }

    // OneDrive for Business / SharePoint — …/:v:/g/personal/…
    if (/sharepoint\.com\/|-my\.sharepoint\.com\//.test(url)) {
      return video('iframe', addParam(url, 'action=embedview'), url);
    }

    // Box — app.box.com/s/ID
    const bx = url.match(/app\.box\.com\/(?:s|shared)\/([\w!.-]+)/);
    if (bx) {
      return video('iframe', 'https://app.box.com/embed/s/' + bx[1] + '?showParentPath=false', url);
    }

    // MEGA — mega.nz/file/ID#KEY
    const mg = url.match(/mega\.nz\/(?:file|embed)\/([\w-]+#[\w-]+)/);
    if (mg) {
      return video('iframe', 'https://mega.nz/embed/' + mg[1] + '!1!0', url);
    }

    // pCloud — publink/show?code=CODE
    const pc = url.match(/pcloud\.(?:com|link)\/publink\/show\?code=([\w]+)/);
    if (pc) {
      return video('iframe', 'https://e.pcloud.link/publink/show?code=' + pc[1], url);
    }

    /* ---- Plain files ---------------------------------------------------- */

    // a self-hosted file, e.g. assets/video/my-film.mp4
    if (/\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(url)) {
      return video('file', url, url);
    }

    // a still image, e.g. assets/photos/shot-01.jpg
    if (/\.(jpe?g|png|webp|avif|gif|svg)(\?.*)?$/i.test(url)) {
      return video('image', url, url);
    }

    // Unknown host: most drives hand out a direct download URL with no file
    // extension. Try it as a video — mountPlayer swaps in a link if it fails.
    return video('file', url, url);
  }

  /* ======================================================================
     1b. Photo galleries
     A project with a "photos": [...] array opens as a lightbox instead
     of a video player. Photos turn like pages in a magazine: a "front"
     page (the photo on screen) is hinged on its left or right edge and
     rotated in 3D away from the viewer, while a "back" page underneath —
     already holding the photo being turned to — is revealed as the front
     page's reverse side turns out of view (backface-visibility: hidden).
     A soft gradient sweeps across the turning page to sell the curl.
     ====================================================================== */

  let gallery = { photos: [], index: 0, title: '', flipping: false };

  function galleryAlt(i) {
    return gallery.title + ' — photo ' + (i + 1);
  }

  function updateGalleryCount() {
    const count = $('.gallery-count', stage);
    if (count) count.textContent = (gallery.index + 1) + ' / ' + gallery.photos.length;
  }

  function mountGallery(photos, title) {
    gallery = { photos: photos, index: 0, title: title || '', flipping: false };

    stageToken++;   // invalidate any in-flight video aspect-ratio measurement
    dropPlayer();
    stage.classList.add('is-gallery');
    stage.innerHTML = [
      '<div class="flipbook">',
        '<div class="flip-page flip-back"><img id="galleryImgBack" alt="" aria-hidden="true"></div>',
        '<div class="flip-page flip-front"><img id="galleryImgFront" alt=""></div>',
      '</div>',
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

    const front = $('#galleryImgFront', stage);
    front.src = gallery.photos[0];
    front.alt = galleryAlt(0);
    updateGalleryCount();
  }

  function stepGallery(step) {
    if (gallery.flipping || gallery.photos.length < 2) return;

    const nextIndex = (gallery.index + step + gallery.photos.length) % gallery.photos.length;
    const frontPage = $('.flip-front', stage);
    const frontImg  = $('#galleryImgFront', stage);
    const backImg   = $('#galleryImgBack', stage);

    // No page element (or reduced motion stripped the animation down to
    // near-zero anyway) — either way this still ends correctly since we
    // drive the swap off 'animationend', which fires regardless of duration.
    if (!frontPage || !frontImg || !backImg) return;

    gallery.flipping = true;

    // The page being turned to sits on the back layer, already in place,
    // so it's there the instant the front page's reverse side hides.
    backImg.src = gallery.photos[nextIndex];
    backImg.alt = galleryAlt(nextIndex);

    // Pinned at the top corner being "grabbed" — top-right to go forward,
    // top-left to go back — rather than the full spine edge, so the turn
    // reads as lifting and swinging from that corner.
    const flipbook = $('.flipbook', stage);
    const forward = step > 0;
    const origin = forward ? 'top right' : 'top left';
    frontPage.style.transformOrigin = origin;
    if (flipbook) flipbook.style.perspectiveOrigin = origin;

    // Restart the animation cleanly even if a class from the previous
    // turn is still present (shouldn't be, but this makes it robust).
    frontPage.classList.remove('flip-next', 'flip-prev');
    void frontPage.offsetWidth; // force reflow
    frontPage.classList.add(forward ? 'flip-next' : 'flip-prev');

    const onFlipEnd = (e) => {
      if (e.target !== frontPage) return;
      frontPage.removeEventListener('animationend', onFlipEnd);
      frontPage.classList.remove('flip-next', 'flip-prev');
      frontImg.src = gallery.photos[nextIndex];
      frontImg.alt = galleryAlt(nextIndex);
      gallery.index = nextIndex;
      updateGalleryCount();
      gallery.flipping = false;
    };
    frontPage.addEventListener('animationend', onFlipEnd);
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
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
             'data-fallback="', escapeHtml(CONFIG.fallbackThumb), '">',
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

    // Swap in the fallback thumbnail without an inline onerror attribute.
    const img = $('img', card);
    img.addEventListener('error', function onThumbError() {
      img.removeEventListener('error', onThumbError);
      img.src = img.dataset.fallback;
    });

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

    // If the previously active category no longer exists, fall back to All.
    if (activeFilter !== 'All' && !counts.has(activeFilter)) activeFilter = 'All';

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
  const modalQuality     = $('#modalQuality');
  const modalQualityLink = $('#modalQualityLink');
  const modalQualityText = $('#modalQualityText');
  const modalQualityBtn  = $('#modalQualityBtn');
  let lastFocused  = null;

  // The custom player currently on screen (null for iframes / photos), and
  // the full-quality file the open project offers (set by openStage).
  let activePlayer = null;
  let fullQuality  = null;

  // What the note under the title says, and what its button does, in each
  // phase of the preview <-> full-quality switch. The player drives this.
  const QUALITY_UI = {
    preview: { text: 'This preview is compressed for quick playback. Full quality is the original file — much larger, so it takes a little longer to load.', btn: 'Watch full quality', action: 'full' },
    loading: { text: 'Loading the full-quality original in the background — your preview keeps playing meanwhile.', btn: 'Cancel', action: 'cancel' },
    back:    { text: 'Switching back to the lighter preview…', btn: 'Cancel', action: 'cancel' },
    full:    { text: 'You’re watching the full-quality original.', btn: 'Back to preview', action: 'preview' },
    error:   { text: 'Full quality couldn’t load inside the player.', btn: 'Try again', action: 'full', link: true }
  };

  function setQualityUi(state) {
    const ui = QUALITY_UI[state];
    if (!ui) { modalQuality.hidden = true; return; }
    modalQualityText.textContent = ui.text;
    modalQualityBtn.textContent = ui.btn;
    modalQualityBtn.dataset.action = ui.action;
    modalQualityBtn.hidden = false;
    modalQualityLink.hidden = !ui.link;
    modalQualityLink.textContent = 'Open in a new tab ↗';
    modalQuality.hidden = false;
  }

  modalQualityBtn.addEventListener('click', () => {
    if (activePlayer) activePlayer.act(modalQualityBtn.dataset.action);
  });

  function dropPlayer() {
    if (activePlayer) { activePlayer.destroy(); activePlayer = null; }
  }

  // Bumped every time the modal opens something new, so a slow-arriving
  // aspect-ratio measurement from a *previous* video can't overwrite the
  // box after the person has already moved on.
  let stageToken = 0;

  // Sets the box's real shape once we know it. Falls back to a guess
  // (from project.orientation) until the true ratio is measured, so
  // there's a sane box on screen immediately rather than a layout jump.
  function setStageRatio(ratio) {
    if (ratio && isFinite(ratio) && ratio > 0) {
      stage.style.setProperty('--ratio', ratio);
    }
  }

  // A single unified sizing rule (see CSS) fits the box to --ratio,
  // capped by both the panel's width and the viewport's height — no
  // separate "portrait" vs "landscape" box needed once the real ratio
  // is known. This function only supplies the *starting* guess.
  function primeStageRatio(isPortrait) {
    stage.style.removeProperty('--ratio');
    setStageRatio(isPortrait ? 9 / 16 : 16 / 9);
  }

  // NOTE: Drive's public thumbnail endpoint was tried here to measure a
  // Drive video's real aspect ratio, but DevTools showed it silently
  // returning a generic placeholder icon for at least one file rather
  // than an actual frame — which meant it could override a correct
  // manual `orientation` value with a wrong automatic one. Removed for
  // reliability: Drive videos fall back to `orientation` in
  // projects.json, same as before. If you want exact, verified sizing
  // for Drive files too, the Drive API's `files.get` with
  // `fields=videoMediaMetadata` returns the real width/height — that
  // needs a (free, read-only) Google Cloud API key, ask if you'd like
  // that wired in.

  // For our own <video> element the browser already knows the exact
  // pixel dimensions the moment metadata loads — no guessing needed.
  function measureFileRatio(videoEl, token) {
    videoEl.addEventListener('loadedmetadata', () => {
      if (token !== stageToken) return;
      if (videoEl.videoWidth && videoEl.videoHeight) {
        setStageRatio(videoEl.videoWidth / videoEl.videoHeight);
      }
    }, { once: true });
  }

  // A link the visitor can open if an embed can't play in the page.
  function externalLink(href, label) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label || 'Open this video in a new tab';
    link.style.cssText =
      'display:grid;place-items:center;height:100%;padding:2rem;text-align:center;' +
      'color:#4DB6C4;font-size:15px;text-decoration:underline';
    return link;
  }

  /* ======================================================================
     4b. Custom video player
     Only used for kind === 'file' — a real <video> element we can fully
     control (self-hosted files, Dropbox, OneDrive-direct). Iframe embeds
     (YouTube, Vimeo, Instagram, Drive, …) keep their own native player;
     there's no way to reach inside those from the page.

     Frame preview while scrubbing: a second, invisible <video> pointed at
     the same source is seeked to whatever time the pointer is over, and
     its current frame is drawn onto a small canvas. No crossOrigin is set
     (same reasoning as the main video), so the canvas is "tainted" for
     pixel readback — but we only ever draw it, never read it back, which
     works regardless of the source host sending CORS headers.
     ====================================================================== */

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
  }

  const CP_ICON = {
    play:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    fwd:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
    vol:   '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.4 8.6a5 5 0 0 1 0 6.8M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    volLow:'<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.4 8.6a5 5 0 0 1 0 6.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    mute:  '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    cam:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="19" height="13" rx="2.6"/><path d="M8 7l1.7-2.5h4.6L16 7"/><circle class="cp-cam-lens" cx="12" cy="13.6" r="3.5"/></svg>',
    pip:   '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="12.5" y="12" width="7" height="5" rx="1" fill="currentColor"/></svg>',
    fs:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    fsx:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'
  };

  function createCustomPlayer(videoInfo, token) {
    // A full-quality twin of this video, if the project has one that the
    // custom player can stream (and that isn't just the same file again).
    let fullInfo = null;
    if (fullQuality) {
      const fi = parseVideo(fullQuality.url);
      if (fi && fi.kind === 'file' && fi.src !== videoInfo.src) {
        fi.size = fullQuality.size || '';
        fullInfo = fi;
      }
    }

    const wrap = document.createElement('div');
    wrap.className = 'cp is-paused';
    wrap.innerHTML = [
      '<video class="cp-video" playsinline preload="metadata"></video>',
      '<button type="button" class="cp-tap" aria-label="Show or hide controls"></button>',

      '<div class="cp-center">',
        '<button type="button" class="cp-center-btn" aria-label="Play">',
          '<span class="ic-play">', CP_ICON.play, '</span>',
          '<span class="ic-pause" hidden>', CP_ICON.pause, '</span>',
        '</button>',
      '</div>',

      '<div class="cp-spinner" hidden>',
        '<div class="cp-spin-inner">',
          '<span class="cp-spin-ring"></span>',
          '<div class="cp-spin-slow" hidden>',
            '<svg class="cp-spin-cam" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
              '<rect x="2.5" y="7" width="19" height="13" rx="2.6"/>',
              '<path d="M8 7l1.7-2.5h4.6L16 7"/>',
              '<circle class="cp-spin-lens" cx="12" cy="13.6" r="3.5"/>',
            '</svg>',
            '<span class="cp-spin-text">Slow internet speed…<br>Trying to optimise..</span>',
            '<button type="button" class="cp-spin-fallback" hidden>Switch to lighter preview</button>',
          '</div>',
        '</div>',
      '</div>',

      '<div class="cp-topbar">',
        '<button type="button" class="cp-q" hidden>', CP_ICON.cam, '<span class="cp-q-label">Preview</span></button>',
      '</div>',

      // Background "developing" loader — the preview keeps playing under it.
      '<div class="cp-hud" hidden>',
        '<span class="cp-hud-cam">', CP_ICON.cam, '</span>',
        '<div class="cp-hud-body">',
          '<p class="cp-hud-title">Developing full quality…</p>',
          '<p class="cp-hud-sub"></p>',
          '<div class="cp-frames" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
          '<div class="cp-hud-actions">',
            '<button type="button" class="cp-hud-pause" hidden>Pause &amp; load faster</button>',
            '<button type="button" class="cp-hud-cancel">Cancel</button>',
          '</div>',
        '</div>',
      '</div>',

      // Disclaimer shown before the big file starts downloading.
      '<div class="cp-confirm" role="dialog" aria-label="Switch to full quality" hidden>',
        '<div class="cp-confirm-card">',
          '<span class="cp-confirm-ic">', CP_ICON.cam, '</span>',
          '<p class="cp-confirm-title">Switch to full quality?</p>',
          '<p class="cp-confirm-text">This is the original, uncompressed file — much larger than the preview, so it takes longer to load and uses more data.<span class="cp-confirm-size"></span></p>',
          '<p class="cp-confirm-text">Your preview keeps playing while it loads, and we’ll switch over the moment it’s ready.</p>',
          '<div class="cp-confirm-actions">',
            '<button type="button" class="cp-confirm-go">Load full quality</button>',
            '<button type="button" class="cp-confirm-no">Not now</button>',
          '</div>',
        '</div>',
      '</div>',

      '<div class="cp-flash" aria-hidden="true"></div>',

      '<div class="cp-scrub" hidden>',
        '<canvas class="cp-scrub-canvas"></canvas>',
        '<span class="cp-scrub-time">0:00</span>',
      '</div>',

      '<div class="cp-controls">',
        '<div class="cp-progress">',
          '<div class="cp-track">',
            '<div class="cp-buffered"></div>',
            '<div class="cp-played"></div>',
            '<div class="cp-knob"></div>',
          '</div>',
          '<input type="range" class="cp-seek" min="0" max="1000" step="0.1" value="0" aria-label="Seek">',
        '</div>',

        '<div class="cp-row">',
          '<button type="button" class="cp-btn cp-play" aria-label="Play">',
            '<span class="ic-play">', CP_ICON.play, '</span>',
            '<span class="ic-pause" hidden>', CP_ICON.pause, '</span>',
          '</button>',
          '<button type="button" class="cp-btn cp-back" aria-label="Back 10 seconds" hidden>', CP_ICON.back, '<em>10</em></button>',
          '<button type="button" class="cp-btn cp-fwd" aria-label="Forward 10 seconds" hidden>', CP_ICON.fwd, '<em>10</em></button>',
          '<span class="cp-time"><span class="cp-cur">0:00</span><span class="cp-sep">/</span><span class="cp-dur">0:00</span></span>',
          '<span class="cp-row-spacer"></span>',
          '<div class="cp-vol">',
            '<button type="button" class="cp-btn cp-mute" aria-label="Mute">',
              '<span class="ic-vol">', CP_ICON.vol, '</span>',
              '<span class="ic-low" hidden>', CP_ICON.volLow, '</span>',
              '<span class="ic-mute" hidden>', CP_ICON.mute, '</span>',
            '</button>',
            '<input type="range" class="cp-vol-range" min="0" max="1" step="0.01" value="1" aria-label="Volume">',
          '</div>',
          '<button type="button" class="cp-btn cp-pip" aria-label="Picture in picture" hidden>', CP_ICON.pip, '</button>',
          '<button type="button" class="cp-btn cp-fs" aria-label="Full screen">',
            '<span class="ic-fs">', CP_ICON.fs, '</span>',
            '<span class="ic-fsx" hidden>', CP_ICON.fsx, '</span>',
          '</button>',
        '</div>',
      '</div>'
    ].join('');

    const el = $('.cp-video', wrap);
    el.src = videoInfo.src;
    el.autoplay = true;
    el.preload = 'metadata';
    // No crossOrigin attribute — see the note on the plain-file branch
    // this replaces: forcing CORS mode breaks playback on hosts (like
    // Dropbox's raw-content host) that don't send CORS headers.
    el._info = videoInfo;
    measureFileRatio(el, token);

    wireCustomPlayer(wrap, el, videoInfo, fullInfo);
    return wrap;
  }

  function wireCustomPlayer(wrap, el, videoInfo, fullInfo) {
    const tap       = $('.cp-tap', wrap);
    const centerBtn = $('.cp-center-btn', wrap);
    const spinner   = $('.cp-spinner', wrap);
    const controls  = $('.cp-controls', wrap);
    const seek      = $('.cp-seek', wrap);
    const track     = $('.cp-track', wrap);
    const bufferedEl= $('.cp-buffered', wrap);
    const playedEl  = $('.cp-played', wrap);
    const knob      = $('.cp-knob', wrap);
    const scrubBox  = $('.cp-scrub', wrap);
    const scrubCanvas = $('.cp-scrub-canvas', wrap);
    const scrubTime = $('.cp-scrub-time', wrap);
    const playBtn   = $('.cp-play', wrap);
    const backBtn   = $('.cp-back', wrap);
    const fwdBtn    = $('.cp-fwd', wrap);
    const curEl     = $('.cp-cur', wrap);
    const durEl     = $('.cp-dur', wrap);
    const muteBtn   = $('.cp-mute', wrap);
    const pipBtn    = $('.cp-pip', wrap);
    const fsBtn     = $('.cp-fs', wrap);
    const scrubCtx  = scrubCanvas.getContext('2d');

    let scrubbing = false;
    let hideTimer = null;
    let previewVideo = null;
    let previewReady = false;
    let previewBusy = false;
    let pendingPreviewTime = null;

    // Quality switching state. `el` is always the video on screen; a second,
    // hidden "standby" video loads the other version in the background.
    let mode = 'preview';           // which source is on screen
    let switching = null;           // the in-flight switch, if any
    let swapping = false;           // true for the instant of the hand-off
    let lastVolume = 0.7;
    let fallbackTimer = null;
    const mediaHandlers = {};

    // Media events are routed by type, and only the video that's on screen
    // gets to act on them — so the standby video can buffer silently.
    function onMedia(type, fn) { mediaHandlers[type] = fn; }
    function bindMedia(v) {
      Object.keys(mediaHandlers).forEach(type => {
        v.addEventListener(type, e => {
          if (v !== el) return;
          if (swapping && (type === 'pause' || type === 'play' || type === 'ended')) return;
          mediaHandlers[type](e);
        });
      });
      // A file that refuses to stream (private, login wall, unsupported
      // codec) falls back to opening the original share link.
      v.addEventListener('error', () => {
        if (v !== el || !stage.contains(wrap)) return;
        const info = v._info || videoInfo;
        dropPlayer();
        setQualityUi(null);
        stage.innerHTML = '';
        stage.appendChild(externalLink(info.original, 'This file can’t play here — open it in a new tab'));
      });
    }

    function setPauseIcons(host, isPaused) {
      $('.ic-play', host).hidden = !isPaused;
      $('.ic-pause', host).hidden = isPaused;
    }

    function syncPlayState() {
      if (swapping) return;
      const paused = el.paused || el.ended;
      wrap.classList.toggle('is-paused', paused);
      setPauseIcons(centerBtn, paused);
      setPauseIcons(playBtn, paused);
    }

    function play() { el.play().catch(() => {}); }
    function togglePlay() { (el.paused || el.ended) ? play() : el.pause(); }

    function showControls(keep) {
      controls.classList.add('is-visible');
      wrap.classList.add('cp-active');
      window.clearTimeout(hideTimer);
      if (!keep && !el.paused) {
        hideTimer = window.setTimeout(() => {
          if (!el.paused && !scrubbing) hideControlsNow();
        }, 2600);
      }
    }
    function hideControlsNow() {
      window.clearTimeout(hideTimer);
      controls.classList.remove('is-visible');
      wrap.classList.remove('cp-active');
      hideScrub();
    }

    tap.addEventListener('click', () => showControls());
    wrap.addEventListener('mousemove', () => showControls());
    wrap.addEventListener('mouseleave', () => { if (!el.paused) hideControlsNow(); });
    // Mobile: a touch anywhere on the player brings the controls back,
    // whatever it lands on (video surface, a button, the progress bar…).
    wrap.addEventListener('touchstart', () => showControls(), { passive: true });

    centerBtn.addEventListener('click', () => { togglePlay(); showControls(); });
    playBtn.addEventListener('click',   () => { togglePlay(); showControls(); });

    onMedia('play',  () => { if (switching) switching.pausedByUs = false; syncPlayState(); showControls(); });
    onMedia('pause', () => { syncPlayState(); showControls(true); });
    onMedia('ended', () => { syncPlayState(); showControls(true); });

    let slowTimer = null;
    const spinSlow = $('.cp-spin-slow', wrap);
    const spinFallback = $('.cp-spin-fallback', wrap);
    function startBuffering() {
      if (swapping) return;
      spinner.hidden = false;
      window.clearTimeout(slowTimer);
      slowTimer = window.setTimeout(() => { spinSlow.hidden = false; }, 2000);
      // Stuck on the big file for 5s+? Offer the light preview instead.
      window.clearTimeout(fallbackTimer);
      if (mode === 'full' && fullInfo && !switching) {
        fallbackTimer = window.setTimeout(() => { spinFallback.hidden = false; }, 5000);
      }
    }
    function stopBuffering() {
      spinner.hidden = true;
      spinSlow.hidden = true;
      spinFallback.hidden = true;
      window.clearTimeout(slowTimer);
      window.clearTimeout(fallbackTimer);
    }
    onMedia('waiting', startBuffering);
    onMedia('stalled', startBuffering);
    onMedia('playing', stopBuffering);
    onMedia('canplay', stopBuffering);

    function updateDuration() {
      if (isFinite(el.duration)) durEl.textContent = formatTime(el.duration);
    }
    onMedia('loadedmetadata', updateDuration);
    onMedia('durationchange', updateDuration);

    function updateProgress() {
      if (scrubbing || !isFinite(el.duration) || el.duration <= 0) return;
      const pct = (el.currentTime / el.duration) * 100;
      playedEl.style.width = pct + '%';
      knob.style.left = pct + '%';
      seek.value = String(pct * 10);
      curEl.textContent = formatTime(el.currentTime);
    }
    onMedia('timeupdate', updateProgress);

    function updateBuffered() {
      if (!el.buffered.length || !isFinite(el.duration) || el.duration <= 0) return;
      let end = 0;
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.buffered.start(i) <= el.currentTime + 0.5) end = Math.max(end, el.buffered.end(i));
      }
      bufferedEl.style.width = Math.min(100, (end / el.duration) * 100) + '%';
    }
    onMedia('progress', updateBuffered);

    function skip(delta) {
      if (!isFinite(el.duration)) return;
      el.currentTime = Math.min(Math.max(el.currentTime + delta, 0), el.duration);
      showControls();
    }
    backBtn.addEventListener('click', () => skip(-10));
    fwdBtn.addEventListener('click',  () => skip(10));

    function seekFromInput() {
      if (!isFinite(el.duration)) return;
      const pct = parseFloat(seek.value) / 10;
      const t = (pct / 100) * el.duration;
      el.currentTime = t;
      playedEl.style.width = pct + '%';
      knob.style.left = pct + '%';
      curEl.textContent = formatTime(t);
    }
    seek.addEventListener('input', () => { scrubbing = true; seekFromInput(); showControls(true); });

    /* --- Frame preview while scrubbing ---------------------------------- */

    function ensurePreviewVideo() {
      if (previewVideo) return previewVideo;
      const pv = document.createElement('video');
      pv.src = videoInfo.src;
      pv.muted = true;
      pv.preload = 'auto';
      pv.playsInline = true;
      pv.setAttribute('aria-hidden', 'true');
      pv.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
      pv.addEventListener('loadedmetadata', () => {
        previewReady = true;
        if (pendingPreviewTime !== null) {
          const t = pendingPreviewTime;
          pendingPreviewTime = null;
          requestPreviewFrame(t);
        }
      });
      pv.addEventListener('seeked', () => {
        previewBusy = false;
        try {
          const aspect = (pv.videoWidth && pv.videoHeight) ? (pv.videoWidth / pv.videoHeight) : (16 / 9);
          const maxW = 170, maxH = 120;
          let w = maxW, h = Math.round(maxW / aspect);
          if (h > maxH) { h = maxH; w = Math.round(maxH * aspect); }
          scrubCanvas.width = w;
          scrubCanvas.height = h;
          scrubCanvas.style.width = w + 'px';
          scrubCanvas.style.height = h + 'px';
          scrubCtx.drawImage(pv, 0, 0, w, h);
        } catch (err) { /* not decodable yet — keep whatever's already drawn */ }
        if (pendingPreviewTime !== null) {
          const t = pendingPreviewTime;
          pendingPreviewTime = null;
          requestPreviewFrame(t);
        }
      });
      pv.addEventListener('error', () => { previewVideo = null; previewReady = false; });
      wrap.appendChild(pv);
      previewVideo = pv;
      return pv;
    }

    function requestPreviewFrame(t) {
      const pv = ensurePreviewVideo();
      if (!previewReady) { pendingPreviewTime = t; return; }
      if (previewBusy) { pendingPreviewTime = t; return; }
      previewBusy = true;
      try { pv.currentTime = t; } catch (err) { previewBusy = false; }
      // Safety net: some browsers skip 'seeked' when the target time
      // rounds to the frame already showing — don't let that wedge the lock.
      window.setTimeout(() => { previewBusy = false; }, 260);
    }

    function showScrubAt(clientX) {
      if (!isFinite(el.duration) || el.duration <= 0) return;
      const rect = track.getBoundingClientRect();
      if (!rect.width) return;
      let x = clientX - rect.left;
      x = Math.min(Math.max(x, 0), rect.width);
      const t = (x / rect.width) * el.duration;

      scrubBox.hidden = false;
      const boxWidth = scrubBox.offsetWidth || 90;
      let left = x - boxWidth / 2;
      left = Math.min(Math.max(left, 0), Math.max(0, rect.width - boxWidth));
      scrubBox.style.left = left + 'px';
      scrubTime.textContent = formatTime(t);

      requestPreviewFrame(t);
    }
    function hideScrub() { scrubBox.hidden = true; }

    seek.addEventListener('pointerdown', e => { scrubbing = true; showScrubAt(e.clientX); showControls(true); });
    track.addEventListener('mousemove', e => { if (!scrubbing) showScrubAt(e.clientX); });
    seek.addEventListener('mousemove', e => showScrubAt(e.clientX));
    track.addEventListener('mouseleave', () => { if (!scrubbing) hideScrub(); });
    seek.addEventListener('touchstart', e => {
      if (e.touches && e.touches[0]) { scrubbing = true; showScrubAt(e.touches[0].clientX); showControls(true); }
    }, { passive: true });
    seek.addEventListener('touchmove', e => {
      if (e.touches && e.touches[0]) showScrubAt(e.touches[0].clientX);
    }, { passive: true });
    seek.addEventListener('touchend', () => { scrubbing = false; hideScrub(); showControls(); });
    window.addEventListener('pointerup', () => {
      if (scrubbing) { scrubbing = false; hideScrub(); showControls(); }
    });

    /* --- Volume: mute button + slider ------------------------------------ */
    const volRange = $('.cp-vol-range', wrap);

    // iOS Safari keeps video.volume read-only (the hardware buttons rule),
    // so there the slider is hidden and only the mute button remains.
    const canSetVolume = (() => {
      try { const t = document.createElement('video'); t.volume = 0.5; return t.volume === 0.5; }
      catch (err) { return false; }
    })();
    if (!canSetVolume) volRange.hidden = true;

    function syncMute() {
      const level = el.muted ? 0 : el.volume;
      $('.ic-vol',  muteBtn).hidden = !(level > 0.5);
      $('.ic-low',  muteBtn).hidden = !(level > 0 && level <= 0.5);
      $('.ic-mute', muteBtn).hidden = level > 0;
      muteBtn.setAttribute('aria-label', level === 0 ? 'Unmute' : 'Mute');
      volRange.value = String(level);
      volRange.style.setProperty('--v', (level * 100) + '%');
    }
    function toggleMute() {
      if (el.muted || el.volume === 0) {
        el.muted = false;
        if (el.volume === 0) el.volume = lastVolume || 0.7;
      } else {
        lastVolume = el.volume;
        el.muted = true;
      }
      syncMute();
    }
    function nudgeVolume(delta) {
      const next = Math.min(1, Math.max(0, (el.muted ? 0 : el.volume) + delta));
      if (next > 0) lastVolume = next;
      el.volume = next;
      el.muted = next === 0;
      syncMute();
    }
    muteBtn.addEventListener('click', () => { toggleMute(); showControls(); });
    volRange.addEventListener('input', () => {
      const v = parseFloat(volRange.value);
      if (v > 0) lastVolume = v;
      el.volume = v;
      el.muted = v === 0;
      syncMute();
      showControls();
    });
    onMedia('volumechange', syncMute);
    syncMute();

    /* --- Picture-in-picture --------------------------------------------- */
    const pipSupported =
      (document.pictureInPictureEnabled && !!el.requestPictureInPicture) ||
      (typeof el.webkitSupportsPresentationMode === 'function' && el.webkitSupportsPresentationMode('picture-in-picture'));

    if (pipSupported) {
      pipBtn.hidden = false;
      pipBtn.addEventListener('click', async () => {
        try {
          if (document.pictureInPictureElement === el) {
            await document.exitPictureInPicture();
          } else if (el.requestPictureInPicture) {
            await el.requestPictureInPicture();
          } else if (el.webkitSetPresentationMode) {
            el.webkitSetPresentationMode(
              el.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'
            );
          }
        } catch (err) { /* blocked — e.g. no user gesture registered — ignore */ }
      });
    }

    /* --- Fullscreen ------------------------------------------------------ */
    // The 10s skip buttons only show up in fullscreen — kept out of the
    // way in the small inline player, one tap away once it matters.
    function inFullscreen() {
      return document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap;
    }
    function syncFsIcons() {
      const fs = inFullscreen();
      $('.ic-fs', fsBtn).hidden = fs;
      $('.ic-fsx', fsBtn).hidden = !fs;
      backBtn.hidden = !fs;
      fwdBtn.hidden = !fs;
    }
    fsBtn.addEventListener('click', () => {
      if (inFullscreen()) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (wrap.requestFullscreen) {
        wrap.requestFullscreen().catch(() => {});
      } else if (wrap.webkitRequestFullscreen) {
        wrap.webkitRequestFullscreen();
      } else if (el.webkitEnterFullscreen) {
        // iOS Safari: arbitrary elements can't go fullscreen, only <video>.
        el.webkitEnterFullscreen();
      }
      showControls();
    });
    document.addEventListener('fullscreenchange', syncFsIcons);
    document.addEventListener('webkitfullscreenchange', syncFsIcons);

    syncPlayState();
    syncFsIcons();
    showControls();

    /* --- Preview <-> full quality ----------------------------------------
       The other version loads in a hidden standby <video> while the current
       one keeps playing. Once the standby has enough buffered *ahead of the
       playhead*, playback hands over at the exact same frame, with a shutter
       flash. Nothing ever freezes or restarts while the big file downloads. */

    const READY_AHEAD = 6;    // seconds that must be buffered before the swap
    const FRAMES = 10;

    const chip       = $('.cp-q', wrap);
    const chipLabel  = $('.cp-q-label', wrap);
    const hud        = $('.cp-hud', wrap);
    const hudTitle   = $('.cp-hud-title', wrap);
    const hudSub     = $('.cp-hud-sub', wrap);
    const hudPause   = $('.cp-hud-pause', wrap);
    const hudCancel  = $('.cp-hud-cancel', wrap);
    const frames     = $$('.cp-frames i', wrap);
    const confirmEl  = $('.cp-confirm', wrap);
    const confirmGo  = $('.cp-confirm-go', wrap);
    const confirmNo  = $('.cp-confirm-no', wrap);
    let flashTimer = null;

    function fmtEta(sec) {
      return sec < 60 ? Math.max(1, Math.ceil(sec)) + 's' : Math.ceil(sec / 60) + ' min';
    }

    function rangeAt(v, t) {
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= t + 0.25 && v.buffered.end(i) > t) {
          return [v.buffered.start(i), v.buffered.end(i)];
        }
      }
      return null;
    }

    function updateChip() {
      if (!fullInfo) return;
      chip.hidden = false;
      chip.dataset.mode = switching ? 'loading' : mode;
      chipLabel.textContent = switching ? 'Loading…' : (mode === 'full' ? 'Full quality' : 'Preview');
      chip.title = mode === 'full' ? 'Switch back to the lighter preview' : 'Switch to full quality';
      wrap.classList.toggle('is-loading', !!switching);
    }

    function paintFrames(progress) {
      const lit = Math.floor(progress * FRAMES + 0.001);
      frames.forEach((f, i) => {
        f.classList.toggle('is-lit', i < lit);
        f.classList.toggle('is-next', i === lit);
      });
    }

    function paintHud(s, eta, slow) {
      const toFull = s.target === 'full';
      const pct = Math.round(s.progress * 100);
      const ready = s.anchor !== null && isFinite(s.video.duration);
      let title = toFull ? 'Developing full quality…' : 'Switching to preview…';
      let sub;

      if (!ready)              sub = toFull ? 'Contacting the original file. Your preview keeps playing.' : 'Just a moment.';
      else if (s.pausedByUs)   sub = pct + '% developed · preview resumes automatically';
      else if (slow)         { title = 'Slow lab today…'; sub = 'Full quality is arriving slower than the preview plays.'; }
      else                     sub = pct + '% developed' + (eta ? ' · about ' + fmtEta(eta) + ' left' : '') + ' · preview keeps playing';

      hudTitle.textContent = title;
      hudSub.textContent = sub;
      hudPause.hidden = !(slow && !s.pausedByUs);
      paintFrames(s.progress);
    }

    function showHud(s) {
      hud.hidden = false;
      paintFrames(0);
      paintHud(s, null, false);
      showControls(true);
    }
    function hideHud() { hud.hidden = true; }

    function anchorAt(s, t) {
      const v = s.video;
      s.anchor = Math.max(0, Math.min(t, (v.duration || t) - 0.5));
      s.lastAnchorAt = performance.now();
      s.anchorT = s.lastAnchorAt;
      s.samples = [];
      try { v.currentTime = s.anchor; } catch (err) { /* not seekable yet */ }
    }

    function startSwitch(target) {
      if (switching || swapping || target === mode) return;
      const info = target === 'full' ? fullInfo : videoInfo;
      if (!info) return;

      const next = document.createElement('video');
      next.className = 'cp-video cp-video--standby';
      next.playsInline = true;
      next.muted = true;
      next.preload = 'auto';
      next.setAttribute('aria-hidden', 'true');
      next._info = info;
      next.src = info.src;
      el.after(next);
      bindMedia(next);

      const s = {
        target: target, video: next, anchor: null, lastAnchorAt: 0,
        progress: 0, samples: [], startedAt: performance.now(),
        pausedByUs: false, committing: false, timer: null
      };
      switching = s;

      next.addEventListener('loadedmetadata', () => {
        if (switching !== s) return;
        anchorAt(s, el.currentTime + (!el.paused ? 1.5 : 0));
      });
      next.addEventListener('error', () => { if (switching === s) failSwitch(s); });
      // how long a seek takes on this connection — used to time the hand-off
      next.addEventListener('seeked', () => {
        if (s.anchorT) { s.seekMs = performance.now() - s.anchorT; s.anchorT = 0; }
      });

      s.timer = window.setInterval(() => tickSwitch(s), 400);
      setQualityUi(target === 'full' ? 'loading' : 'back');
      updateChip();
      showHud(s);
    }

    function disposeVideo(v) {
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (err) {}
      if (v.parentNode) v.remove();
    }

    function endSwitch(s) {
      window.clearInterval(s.timer);
      window.clearInterval(s.poll);
      window.clearTimeout(s.guard);
      if (switching === s) switching = null;
      hideHud();
    }

    function cancelSwitch(s) {
      if (!s) return;
      endSwitch(s);
      disposeVideo(s.video);
      if (s.pausedByUs) play();
      setQualityUi(mode);
      updateChip();
    }

    function failSwitch(s) {
      const target = s.target;
      endSwitch(s);
      disposeVideo(s.video);
      if (s.pausedByUs) play();
      setQualityUi(target === 'full' ? 'error' : mode);
      if (target === 'full') modalQualityLink.href = fullInfo.original;
      updateChip();
    }

    function tickSwitch(s) {
      if (switching !== s || s.committing) return;
      if (!stage.contains(wrap)) { cancelSwitch(s); return; }

      const v = s.video;
      const now = performance.now();
      if (s.anchor === null || !isFinite(v.duration)) { paintHud(s, null, false); return; }

      const pos = el.currentTime;
      const playing = !el.paused && !el.ended;
      const need = Math.max(0.5, Math.min(READY_AHEAD, v.duration - pos));
      const cover = rangeAt(v, pos);

      // Browsers only prefetch a limited window ahead of a *paused* video's
      // own position, then go idle. If the standby hit that ceiling before the
      // playhead has enough runway, nudge it up to the playhead so it resumes.
      if (cover && !v.seeking && v.networkState === 1 && cover[1] - pos < need &&
          now - (s.lastRescueAt || 0) > 3000) {
        s.lastRescueAt = now;
        try { v.currentTime = pos; } catch (err) { /* ignore */ }
      }

      // Ready: the standby covers the playhead with enough runway ahead.
      if (cover && (cover[1] - pos >= need - 0.05 || cover[1] >= v.duration - 0.15)) {
        commitSwitch(s);
        return;
      }

      // The playhead ran past whatever the standby has buffered (or the
      // viewer scrubbed): re-aim the download at where they are now.
      if (!cover && now - s.lastAnchorAt > (playing ? 6000 : 1500)) {
        anchorAt(s, pos + (playing ? 3 : 0));
      }

      const anchorRange = rangeAt(v, s.anchor);
      const bufLen = anchorRange ? anchorRange[1] - s.anchor : 0;
      const required = Math.max(need, pos + need - s.anchor);
      s.progress = Math.max(s.progress, Math.min(0.98, bufLen / required));

      s.samples.push({ t: now, len: bufLen });
      while (s.samples.length > 2 && now - s.samples[0].t > 6000) s.samples.shift();

      // ETA = remaining runway ÷ how fast the buffer outruns the playhead.
      let eta = null;
      const first = s.samples[0], last = s.samples[s.samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt >= 1.5) {
        const rate = (last.len - first.len) / dt;
        const closing = rate - (playing ? 1 : 0);
        if (closing > 0.05) eta = Math.max(0, required - bufLen) / closing;
        if (eta !== null && eta > 300) eta = null;
      }

      const slow = playing && !s.pausedByUs && s.progress < 0.9 &&
                   now - s.startedAt > 10000 && (eta === null || eta > 40);
      paintHud(s, eta, slow);
    }

    /* Hand-off. The standby seeks to a point just *ahead* of the playhead
       (far enough to cover however long a seek takes here) while the current
       video keeps playing. When the playhead reaches that point, the two swap
       on the same frame — no freeze, no restart. */
    function commitSwitch(s) {
      if (switching !== s || s.committing) return;
      s.committing = true;
      window.clearInterval(s.timer);
      handOver(s, 0);
    }

    function handOver(s, attempt) {
      if (switching !== s) return;
      const old = el, next = s.video;
      const playing = !old.paused && !old.ended;
      const lead = playing ? Math.min(0.5 + ((s.seekMs || 600) / 1000) * 1.4 + attempt * 0.8, 5) : 0;
      const T = Math.max(0, Math.min(old.currentTime + lead, (next.duration || 1e9) - 0.05));
      const t0 = performance.now();

      window.clearTimeout(s.guard);
      s.guard = window.setTimeout(() => { if (switching === s) failSwitch(s); }, 10000);

      function ready() {
        window.clearTimeout(s.guard);
        s.seekMs = performance.now() - t0;
        rendezvous(s, T, attempt);
      }
      if (!next.seeking && Math.abs(next.currentTime - T) < 0.05 && next.readyState >= 3) {
        ready();
      } else {
        next.addEventListener('seeked', ready, { once: true });
        try { next.currentTime = T; } catch (err) { failSwitch(s); }
      }
    }

    function rendezvous(s, T, attempt) {
      const next = s.video;
      window.clearInterval(s.poll);

      function check() {
        if (switching !== s) { window.clearInterval(s.poll); return; }
        const now = el.currentTime;
        const playing = !el.paused && !el.ended;

        if (!playing) {
          // paused (by the viewer, or by us): swap at the exact paused frame
          window.clearInterval(s.poll);
          if (Math.abs(next.currentTime - now) < 0.1) finishSwitch(s, s.pausedByUs);
          else handOver(s, attempt);
          return;
        }
        if (now >= T - 0.05) {
          window.clearInterval(s.poll);
          // seek took longer than planned and the playhead overshot: aim further out
          if (now - T > 0.25 && attempt < 3) handOver(s, attempt + 1);
          else finishSwitch(s, true);
        }
      }
      s.poll = window.setInterval(check, 25);
      check();
    }

    function finishSwitch(s, resume) {
      const old = el, next = s.video;
      window.clearInterval(s.poll);
      window.clearTimeout(s.guard);

      swapping = true;
      next.volume = old.volume;
      next.muted = old.muted;
      next.classList.remove('cp-video--standby');
      next.removeAttribute('aria-hidden');
      el = next;
      mode = s.target;
      switching = null;
      if (resume) play();          // start the new one first, then drop the old
      disposeVideo(old);
      swapping = false;

      hideHud();
      stopBuffering();
      flash();
      setQualityUi(mode);
      updateChip();
      updateDuration(); updateProgress(); updateBuffered(); syncMute(); syncPlayState();
      showControls();
    }

    // A quick shutter flash to hide the swap and mark the moment.
    function flash() {
      wrap.classList.remove('is-flash');
      void wrap.offsetWidth;
      wrap.classList.add('is-flash');
      chip.classList.add('is-pop');
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => {
        wrap.classList.remove('is-flash');
        chip.classList.remove('is-pop');
      }, 700);
    }

    /* Disclaimer step ------------------------------------------------- */
    function openConfirm() {
      if (!fullInfo || switching || mode === 'full') return;
      const sizeEl = $('.cp-confirm-size', wrap);
      sizeEl.textContent = fullInfo.size ? ' Original file size: about ' + fullInfo.size + '.' : '';
      confirmEl.hidden = false;
      showControls(true);
      confirmGo.focus();
    }
    function closeConfirm() {
      if (confirmEl.hidden) return false;
      confirmEl.hidden = true;
      return true;
    }
    confirmGo.addEventListener('click', () => { closeConfirm(); startSwitch('full'); });
    confirmNo.addEventListener('click', closeConfirm);

    chip.addEventListener('click', () => {
      if (switching) return;
      if (mode === 'full') startSwitch('preview'); else openConfirm();
    });
    hudCancel.addEventListener('click', () => cancelSwitch(switching));
    hudPause.addEventListener('click', () => {
      if (!switching) return;
      switching.pausedByUs = true;
      el.pause();
      paintHud(switching, null, false);
    });
    spinFallback.addEventListener('click', () => { stopBuffering(); startSwitch('preview'); });

    /* Public handle for the note under the title + keyboard shortcuts --- */
    activePlayer = {
      hasFull: !!fullInfo,
      video: () => el,
      act(action) {
        if (action === 'full') openConfirm();
        else if (action === 'preview') startSwitch('preview');
        else if (action === 'cancel') cancelSwitch(switching);
      },
      closeConfirm: closeConfirm,
      toggleMute: toggleMute,
      nudgeVolume: nudgeVolume,
      destroy() {
        if (switching) { window.clearInterval(switching.timer); switching = null; }
        window.clearTimeout(hideTimer);
        window.clearTimeout(slowTimer);
        window.clearTimeout(fallbackTimer);
        window.clearTimeout(flashTimer);
        $$('video', wrap).forEach(v => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (err) {} });
      }
    };

    bindMedia(el);
    updateChip();
  }

  function mountPlayer(video, isPortrait, emptyHint) {
    const token = ++stageToken;

    dropPlayer();
    stage.innerHTML = '';
    stage.classList.remove('is-gallery');   // in case a photo set was shown last
    primeStageRatio(!!isPortrait);          // best guess until we can measure

    const hint = emptyHint ||
      'Add this project’s YouTube, Vimeo, Instagram or drive link to the ' +
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
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      stage.appendChild(frame);
      // Drive: no reliable way to measure the real ratio without an API
      // key (see note above) — the orientation-based guess stands.

    } else if (video.kind === 'file') {
      stage.appendChild(createCustomPlayer(video, token));

    } else if (video.kind === 'image') {
      const img = document.createElement('img');
      img.src = video.src;
      img.alt = modalTitle.textContent || '';
      stage.classList.add('is-gallery');
      stage.appendChild(img);

    } else {
      stage.appendChild(externalLink(video.original));
    }
  }

  // Shared by project cards and the showreel button.
  function openStage(title, sub, desc, mount, fullQualityUrl, fullQualitySize) {
    modalTitle.textContent = title;
    modalSub.textContent = sub;
    modalDesc.textContent = desc;

    // Same dl=0 → raw=1 fix as videoUrl — a plain pasted Dropbox share
    // link works here too, no manual editing needed in projects.json.
    fullQuality = fullQualityUrl
      ? { url: dropboxRaw(fullQualityUrl), size: fullQualitySize || '' }
      : null;
    modalQuality.hidden = true;
    modalQualityLink.hidden = true;
    modalQualityLink.removeAttribute('href');

    mount();

    if (fullQuality) {
      if (activePlayer && activePlayer.hasFull) {
        // in-player switching — the player drives the note from here
        setQualityUi('preview');
      } else {
        // Preview isn't a streamable file (e.g. a Drive embed): keep the
        // old behaviour — a link that opens the original in a new tab.
        modalQualityText.textContent = 'This preview is compressed for faster web playback.';
        modalQualityBtn.hidden = true;
        modalQualityLink.href = fullQuality.url;
        modalQualityLink.textContent = 'Watch full quality ↗';
        modalQualityLink.hidden = false;
        modalQuality.hidden = false;
      }
    }

    modal.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    $('#modalClose').focus();
  }

  function openModal(index) {
    const project = projects[index];
    if (!project) return;

    lastFocused = document.activeElement;

    openStage(
      project.title || 'Untitled',
      [project.category, project.role, project.client, project.year].filter(Boolean).join('  ·  '),
      project.description || '',
      () => {
        if (Array.isArray(project.photos) && project.photos.length) {
          mountGallery(project.photos, project.title);
        } else {
          mountPlayer(parseVideo(project.videoUrl), project.orientation === 'portrait');
        }
      },
      // Only meaningful for video — a photo set has no "quality" tradeoff.
      // Also skipped when it's just the same file as the preview.
      (Array.isArray(project.photos) && project.photos.length) ||
        !project.fullQualityUrl ||
        dropboxRaw(project.fullQualityUrl) === dropboxRaw(project.videoUrl)
          ? null : project.fullQualityUrl,
      project.fullQualitySize
    );
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('is-locked');

    window.setTimeout(() => {
      modal.hidden = true;
      dropPlayer();                  // stops both videos and any background load
      stage.innerHTML = '';          // stops playback and unloads the iframe
      stage.classList.remove('is-gallery');
      stage.style.removeProperty('--ratio');
      gallery = { photos: [], index: 0, title: '' };

      // Restore focus only once the dialog is out of the flow, otherwise
      // some browsers jump the page while it's still on screen.
      if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
      lastFocused = null;
    }, 300);
  }

  // Visible, focusable elements inside the dialog. offsetParent is null for
  // anything inside a position:fixed panel, so measure boxes instead.
  function focusableInModal() {
    return $$(
      'a[href], button:not([disabled]), iframe, video[controls], ' +
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])',
      modal
    ).filter(el => el.getClientRects().length > 0);
  }

  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (modal.hidden) return;

    if (e.key === 'Escape') {
      // Esc first dismisses the "switch to full quality?" prompt, if open.
      if (activePlayer && activePlayer.closeConfirm()) return;
      closeModal();
      return;
    }

    // arrow keys step through a photo gallery
    if (gallery.photos.length > 1) {
      if (e.key === 'ArrowRight') { e.preventDefault(); stepGallery(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); stepGallery(-1); }
    }

    // arrow/space/M/F shortcuts for the custom video player
    const cpVideo = activePlayer ? activePlayer.video() : null;
    if (cpVideo && !gallery.photos.length) {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      const onVolume = document.activeElement && document.activeElement.classList.contains('cp-vol-range');
      if (e.key === 'ArrowUp' && !onVolume) {
        e.preventDefault(); activePlayer.nudgeVolume(0.1);
      } else if (e.key === 'ArrowDown' && !onVolume) {
        e.preventDefault(); activePlayer.nudgeVolume(-0.1);
      } else if (onVolume && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        /* let the slider handle its own arrows */
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        cpVideo.currentTime = Math.min(cpVideo.currentTime + 10, cpVideo.duration || 1e9);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cpVideo.currentTime = Math.max(cpVideo.currentTime - 10, 0);
      } else if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') {
        e.preventDefault();
        cpVideo.paused ? cpVideo.play().catch(() => {}) : cpVideo.pause();
      } else if (e.key === 'm' || e.key === 'M') {
        activePlayer.toggleMute();
      }
    }

    // keep tabbing inside the dialog while it's open
    if (e.key === 'Tab') {
      const focusables = focusableInModal();
      if (!focusables.length) { e.preventDefault(); return; }

      const first = focusables[0];
      const last  = focusables[focusables.length - 1];

      // focus escaped the dialog (or never entered it) — pull it back
      if (!modal.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  // "Watch the showreel" in the hero
  $$('[data-reel]').forEach(btn => {
    btn.addEventListener('click', () => {
      lastFocused = btn;
      openStage(
        'Showreel',
        'Anandu R Krishnan  ·  Editor, cinematographer, colourist',
        'A short cut of recent work.',
        () => mountPlayer(parseVideo(CONFIG.showreelUrl), false,
          'Set <span style="color:#4DB6C4">CONFIG.showreelUrl</span> at the top of js/script.js to your showreel link.')
      );
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
        const dur = 1400;
        let start = null;

        requestAnimationFrame(function step(now) {
          if (start === null) start = now;
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(target * eased).toLocaleString('en-IN') + (t === 1 ? '+' : '');
          if (t < 1) requestAnimationFrame(step);
        });

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

    // <source> children fire error on themselves, not on the <video>, so
    // listen during the capture phase to catch both.
    heroVideo.addEventListener('error', () => {
      if (heroVideo.parentNode) heroVideo.remove();
    }, true);

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
