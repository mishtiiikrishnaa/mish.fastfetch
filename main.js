'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   mish.fastfetch
   powerline starship prompt + `fastfetch` + macOS `date`, as a sidebar view.
   uptime = time since obsidian was opened.
   ═══════════════════════════════════════════════════════════════════════ */

const { Plugin, ItemView } = require('obsidian');

const VIEW_TYPE = 'tv-fetch-view';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n) => String(n).padStart(2, '0');

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

/* ── rainbow gradient for our own icons ──────────────────────────────────
   a hidden svg holds the gradient; styles.css points `stroke` at it.
   mish.eza does the same, whoever loads first creates it. */
const RAINBOW_ID = 'mish-rainbow-defs';

const mountRainbow = () => {
  let svg = document.getElementById(RAINBOW_ID);
  if (!svg) {
    const NS = 'http://www.w3.org/2000/svg';
    svg = document.createElementNS(NS, 'svg');
    svg.id = RAINBOW_ID;
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';

    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.id = 'mish-rainbow';
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');   /* lucide icons live in a 24x24 box */
    grad.setAttribute('x1', '2');
    grad.setAttribute('y1', '2');
    grad.setAttribute('x2', '22');
    grad.setAttribute('y2', '22');

    const stops = [
      ['--vf-pink-hi', '#ffa6c9'], ['--vf-peach', '#ffd6a6'], ['--vf-yellow', '#fff1a8'],
      ['--vf-green', '#c9ffa6'], ['--vf-blue', '#a6c9ff'], ['--vf-lilac', '#c9b0ff'],
    ];
    stops.forEach(([name, fallback], i) => {
      const stop = document.createElementNS(NS, 'stop');
      stop.setAttribute('offset', String(i / (stops.length - 1)));
      stop.style.stopColor = 'var(' + name + ', ' + fallback + ')';
      grad.appendChild(stop);
    });

    defs.appendChild(grad);
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }
  svg.dataset.users = String(Number(svg.dataset.users || 0) + 1);
};

const unmountRainbow = () => {
  const svg = document.getElementById(RAINBOW_ID);
  if (!svg) return;
  const left = Number(svg.dataset.users || 1) - 1;
  if (left <= 0) svg.remove();
  else svg.dataset.users = String(left);
};

/* ── keep the whole vault name visible ───────────────────────────────────
   the orange path pill never truncates. when the prompt is wider than the
   room it has, the whole bar is scaled down just enough to fit (css zoom),
   and is re-fitted whenever the pane resizes. only below half size does the
   pill start to ellipsise instead. */
const fitBar = (bar, watch) => {
  const FLOOR = 0.5;
  let queued = false;

  const fit = () => {
    bar.classList.remove('is-squeezed');
    bar.style.zoom = '';                       /* measure at natural size */
    const have = bar.clientWidth;
    const need = bar.scrollWidth;
    if (!have || need <= have) return;         /* fits (or is hidden): leave it alone */
    let k = have / need;
    if (k < FLOOR) { k = FLOOR; bar.classList.add('is-squeezed'); }
    bar.style.zoom = String(k);
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fit(); });
  };

  const ro = new ResizeObserver(schedule);
  watch.forEach((node) => ro.observe(node));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
  return schedule;
};

/* ── rainbow scrollbar ──────────────────────────────────────────────────
   the native scrollbar is hidden (see styles.css) and this draws a thin
   rainbow thumb in its place, so it looks the same whatever theme or snippet
   is styling scrollbars. wheel / trackpad scrolling is untouched; the thumb
   can also be dragged. the scroller's parent must be position: relative. */
const rainbowBar = (scroller) => {
  const parent = scroller.parentElement;
  const sb = el('div', 'tv-sb');
  const thumb = el('div', 'tv-sb-thumb');
  sb.appendChild(thumb);
  parent.appendChild(sb);

  const update = () => {
    const { scrollHeight, clientHeight, scrollTop, offsetTop, offsetHeight } = scroller;
    if (!offsetHeight || scrollHeight <= clientHeight + 1) {
      sb.style.display = 'none';
      return;
    }
    sb.style.display = 'block';
    sb.style.top = offsetTop + 'px';
    sb.style.height = clientHeight + 'px';
    const h = Math.max(24, (clientHeight * clientHeight) / scrollHeight);
    const y = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - h);
    thumb.style.height = h + 'px';
    thumb.style.transform = 'translateY(' + y + 'px)';
  };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  };

  scroller.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(scroller);
  new MutationObserver(schedule).observe(scroller, { childList: true, subtree: true, characterData: true });

  /* drag the thumb */
  sb.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startTop = scroller.scrollTop;
    const ratio = (scroller.scrollHeight - scroller.clientHeight) /
      Math.max(1, scroller.clientHeight - thumb.offsetHeight);
    sb.setPointerCapture(e.pointerId);
    const move = (ev) => { scroller.scrollTop = startTop + (ev.clientY - startY) * ratio; };
    const up = () => {
      sb.removeEventListener('pointermove', move);
      sb.removeEventListener('pointerup', up);
      sb.removeEventListener('pointercancel', up);
    };
    sb.addEventListener('pointermove', move);
    sb.addEventListener('pointerup', up);
    sb.addEventListener('pointercancel', up);
  });

  schedule();
};

const human = (bytes) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' gb';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' mb';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' kb';
  return bytes + ' b';
};

/* timezone abbreviation, the way `date` prints it */
const TZ_ABBR = { 'Asia/Kolkata': 'ist', 'Asia/Calcutta': 'ist' };

const tzName = (d) => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ_ABBR[zone]) return TZ_ABBR[zone];
    const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName');
    return part ? part.value.toLowerCase() : '';
  } catch (e) {
    return '';
  }
};

/* 1d 02h 14m 05s, dropping the units that are still zero */
const formatUptime = (ms) => {
  let s = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(s / 86400); s %= 86400;
  const hours = Math.floor(s / 3600); s %= 3600;
  const mins = Math.floor(s / 60); s %= 60;

  if (days) return days + 'd ' + pad(hours) + 'h ' + pad(mins) + 'm ' + pad(s) + 's';
  if (hours) return hours + 'h ' + pad(mins) + 'm ' + pad(s) + 's';
  return mins + 'm ' + pad(s) + 's';
};

/* ── starship-style powerline prompt ─────────────────────────────────── */

const buildPrompt = (vaultName) => {
  const bar = el('div', 'vf-bar');
  const segs = [
    ['vf-user', '\uF179 mishti'],
    ['vf-path', '~/' + vaultName],
    ['vf-ch vf-ch1', ''],
    ['vf-ch vf-ch2', ''],
    ['vf-ch vf-ch3', ''],
    ['vf-clock', ''],
  ];

  const nodes = segs.map(([cls, text], i) => {
    const seg = el('span', 'vf-seg ' + cls, text);
    seg.style.zIndex = String(segs.length - i);   /* each arrow tip sits over the next segment */
    bar.appendChild(seg);
    return seg;
  });

  return { bar, clock: nodes[nodes.length - 1] };
};

const buildCmd = (exe, args, cursor) => {
  const line = el('div', 'vf-cmd');
  line.appendChild(el('span', 'vf-chev', '❯'));
  if (exe) {
    line.appendChild(document.createTextNode(' '));
    line.appendChild(el('span', 'vf-exe', exe));
  }
  if (args) {
    line.appendChild(document.createTextNode(' '));
    line.appendChild(el('span', 'vf-arg', args));
  }
  if (cursor) line.appendChild(el('span', 'vf-cursor'));
  return line;
};

/* ── the view ────────────────────────────────────────────────────────── */

class FetchView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.refs = {};
    this.ticks = 0;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'fetch'; }
  getIcon() { return 'terminal'; }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('tv-root');

    /* .tv-scroll scrolls and centres the card; the rainbow thumb lives beside it */
    const scroll = el('div', 'tv-scroll');
    root.appendChild(scroll);

    const card = el('div', 'vf');
    scroll.appendChild(card);
    this.paint(card, scroll);
    rainbowBar(scroll);

    this.refresh();
    this.tick();

    this.registerInterval(window.setInterval(() => this.tick(), 1000));

    /* recount when the vault changes */
    const bump = () => {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => this.refresh(), 400);
    };
    const { vault, metadataCache } = this.app;
    this.registerEvent(vault.on('create', bump));
    this.registerEvent(vault.on('delete', bump));
    this.registerEvent(vault.on('rename', bump));
    this.registerEvent(metadataCache.on('resolved', bump));
  }

  async onClose() {
    window.clearTimeout(this.refreshTimer);
  }

  /* ── drawing ─────────────────────────────────────────────────────── */

  paint(card, scroll) {
    const refs = this.refs;

    /* prompt + fastfetch */
    const prompt = buildPrompt(this.app.vault.getName());
    refs.clock = prompt.clock;
    card.appendChild(prompt.bar);
    fitBar(prompt.bar, [card, scroll]);   /* keeps the full vault name on screen */
    card.appendChild(buildCmd('fastfetch'));

    const rows = el('div', 'vf-rows');
    const row = (key, cls) => {
      rows.appendChild(el('div', 'vf-k', key));
      const value = el('div', 'vf-v ' + (cls || ''));
      rows.appendChild(value);
      return value;
    };

    row('user', 'p').textContent = 'mishti@macbook';
    row('os', 'd').textContent = 'macOS · obsidian';
    refs.vault = row('vault', 'h');
    /* the full path is long: let it wrap so the vault name at the end stays visible */
    refs.vault.style.whiteSpace = 'normal';
    refs.vault.style.overflowWrap = 'anywhere';
    refs.notes = row('notes', 'g');
    refs.links = row('links', 'b');
    refs.folders = row('folders', 'c');
    refs.files = row('files', 'p');
    refs.size = row('size', 'd');
    refs.uptime = row('uptime', 'b');
    card.appendChild(rows);

    /* palette swatches, because fastfetch has them */
    const swatches = el('div', 'vf-swatches');
    for (let i = 0; i < 8; i++) swatches.appendChild(el('span'));
    card.appendChild(swatches);

    /* macOS date commands */
    card.appendChild(buildCmd('date'));
    refs.date = el('div', 'vf-out b');
    card.appendChild(refs.date);

    /* fresh prompt, blinking cursor */
    card.appendChild(buildCmd('', '', true));
  }

  /* ── numbers ─────────────────────────────────────────────────────── */

  refresh() {
    const { app, refs } = this;
    if (!refs.vault) return;

    const files = app.vault.getFiles();
    let notes = 0;
    let links = 0;
    let bytes = 0;

    for (const file of files) {
      if (file.extension === 'md') notes++;
      bytes += file.stat?.size || 0;

      const cache = app.metadataCache.getFileCache(file);
      if (!cache) continue;
      links += (cache.links?.length || 0) + (cache.embeds?.length || 0);
    }

    /* folders, not counting the vault root itself */
    const folders = app.vault
      .getAllLoadedFiles()
      .filter((item) => Array.isArray(item.children) && item.path !== '/')
      .length;

    const adapter = app.vault.adapter;
    refs.vault.textContent = adapter && typeof adapter.getBasePath === 'function'
      ? adapter.getBasePath()
      : app.vault.getName();
    refs.notes.textContent = notes.toLocaleString();
    refs.links.textContent = links.toLocaleString();
    refs.folders.textContent = folders.toLocaleString();
    refs.files.textContent = files.length.toLocaleString();
    refs.size.textContent = human(bytes);
  }

  /* ── the clock ───────────────────────────────────────────────────── */

  tick() {
    const refs = this.refs;
    if (!refs.clock) return;

    const d = new Date();
    const hms = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());

    /* prompt clock */
    refs.clock.textContent = '\uF43A ' + pad(d.getHours()) + ':' + pad(d.getMinutes());

    /* `date`  →  fri 6 nov 20:59:47 ist 2026 */
    refs.date.textContent = [
      DAYS[d.getDay()], d.getDate(), MONTHS[d.getMonth()],
      hms, tzName(d), d.getFullYear(),
    ].filter(Boolean).join(' ');

    /* time since obsidian was opened */
    refs.uptime.textContent = formatUptime(Date.now() - this.plugin.openedAt);

    /* periodic recount, so the numbers can't drift */
    if (++this.ticks % 15 === 0) this.refresh();
  }
}

module.exports = class TerminalVaultFetch extends Plugin {
  async onload() {
    /* the renderer's time origin is when this obsidian window started */
    this.openedAt = (typeof performance !== 'undefined' && performance.timeOrigin)
      ? performance.timeOrigin
      : Date.now();

    mountRainbow();

    this.registerView(VIEW_TYPE, (leaf) => new FetchView(leaf, this));

    /* the class lets styles.css find our ribbon icon and give it the gradient */
    const ribbon = this.addRibbonIcon('terminal', 'Open fetch', () => this.activate());
    ribbon.addClass('mish-fetch-ribbon');
    this.addCommand({
      id: 'open-fetch',
      name: 'Open fetch in sidebar',
      callback: () => this.activate()
    });

    /* first run: put it in the left sidebar without stealing focus.
       after that, obsidian restores it from the saved layout. */
    this.app.workspace.onLayoutReady(async () => {
      if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length) return;
      const leaf = this.app.workspace.getLeftLeaf(false);
      if (leaf) await leaf.setViewState({ type: VIEW_TYPE, active: false });
    });
  }

  onunload() {
    unmountRainbow();
  }

  async activate() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeftLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
};
