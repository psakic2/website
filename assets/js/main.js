// Oblivion Rooms — Shared site JS
(function () {
  // Mobile nav toggle (with X icon, backdrop, tap-outside-to-close)
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle && links) {
    // Inject backdrop element once
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    const setOpen = (open) => {
      links.classList.toggle('open', open);
      backdrop.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.textContent = open ? '✕' : '☰';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    backdrop.addEventListener('click', () => setOpen(false));
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => setOpen(false));
    });
    // Close on Escape (handy on iPad with keyboard)
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  }

  // Subtle nav background change on scroll
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 40) nav.style.background = 'rgba(13, 9, 5, 0.95)';
      else nav.style.background = 'rgba(13, 9, 5, 0.85)';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Set active nav link by current page
  const path = (window.location.pathname || '').split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href === path || (href === 'index.html' && (path === '' || path === '/'))) {
      a.classList.add('active');
    }
  });

  // ─── Scroll spy for sticky sub-nav ───
  const subnav = document.querySelector('.subnav');
  if (subnav) {
    const subLinks = subnav.querySelectorAll('a[href^="#"]');
    const targets  = Array.from(subLinks).map(l => document.getElementById(l.getAttribute('href').slice(1))).filter(Boolean);
    let prevActiveId = null;
    const onSpy = () => {
      const threshold = 160;  // px from top of viewport
      let activeId = targets[0] && targets[0].id;
      targets.forEach(t => {
        const top = t.getBoundingClientRect().top;
        if (top <= threshold) activeId = t.id;
      });
      subLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + activeId));

      // When the active section changes, auto-scroll the sub-nav horizontally
      // to keep the active link visible (mobile fix — bar may be wider than viewport).
      if (activeId !== prevActiveId) {
        prevActiveId = activeId;
        const activeLink = subnav.querySelector('a.active');
        if (activeLink) {
          const linkCenter = activeLink.offsetLeft + (activeLink.offsetWidth / 2);
          const targetLeft = linkCenter - (subnav.clientWidth / 2);
          subnav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
        }
      }
    };
    window.addEventListener('scroll', onSpy, { passive: true });
    onSpy();
  }

  // ─── Reveal on scroll (gentle fade-up) ───
  if ('IntersectionObserver' in window) {
    const revealTargets = document.querySelectorAll('.section, .section-tight, .room-block, .tile, .dish-card');
    revealTargets.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(el => io.observe(el));
  }

  // ─── Lightbox ───
  const galleryItems = document.querySelectorAll('.gallery-item');
  if (galleryItems.length === 0) return;

  // Build a single lightbox in the page
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <button class="lightbox-close" aria-label="Close">✕</button>
    <button class="lightbox-prev" aria-label="Previous">‹</button>
    <button class="lightbox-next" aria-label="Next">›</button>
    <img alt="Photo">
    <div class="lightbox-counter"></div>
  `;
  document.body.appendChild(lb);

  const lbImg     = lb.querySelector('img');
  const lbCounter = lb.querySelector('.lightbox-counter');
  const lbClose   = lb.querySelector('.lightbox-close');
  const lbPrev    = lb.querySelector('.lightbox-prev');
  const lbNext    = lb.querySelector('.lightbox-next');

  // Group lightbox images per gallery (parent .gallery)
  function getGroup(item) {
    const gallery = item.closest('.gallery');
    return gallery ? Array.from(gallery.querySelectorAll('.gallery-item img')) : [item.querySelector('img')];
  }

  let group = [];
  let idx   = 0;

  function show() {
    const img = group[idx];
    lbImg.src = img.dataset.full || img.src;
    lbImg.alt = img.alt || '';
    lbCounter.textContent = `${idx + 1} / ${group.length}`;
  }
  function open(item) {
    group = getGroup(item);
    idx = group.findIndex(g => g === item.querySelector('img'));
    if (idx < 0) idx = 0;
    show();
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }
  function prev() { idx = (idx - 1 + group.length) % group.length; show(); }
  function next() { idx = (idx + 1) % group.length; show(); }

  galleryItems.forEach(item => item.addEventListener('click', () => open(item)));
  lbClose.addEventListener('click', close);
  lbPrev .addEventListener('click', prev);
  lbNext .addEventListener('click', next);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });
})();
