'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   mish.fastfetch
   powerline starship prompt + `fastfetch` + macOS `date`, as a sidebar view.
   uptime = time since obsidian was opened.
   ═══════════════════════════════════════════════════════════════════════ */

const { Plugin, ItemView, PluginSettingTab, Setting, Notice, Platform, FileSystemAdapter } = require('obsidian');

/* node's `os` module is how the panel finds your username and hostname.
   it only exists on desktop, which is why the manifest says isDesktopOnly. */
let nodeOs = null;
try { nodeOs = require('os'); } catch (e) { nodeOs = null; }

/* the fastfetch rows, in order */
const ROWS = ['user', 'os', 'vault', 'notes', 'links', 'folders', 'files', 'size', 'uptime'];

const ROW_NAMES = {
  user: 'user', os: 'operating system', vault: 'vault path', notes: 'notes', links: 'links',
  folders: 'folders', files: 'files', size: 'size', uptime: 'uptime',
};

const DEFAULT_SETTINGS = {
  username: '',          /* empty = auto-detect */
  hostname: '',          /* empty = auto-detect */
  showFullPath: true,
  font: 'bundled',       /* bundled | obsidian | system | family:<name> | custom */
  customFont: '',
  pills: { user: true, vault: true, time: true },
  show: {
    user: true, os: true, vault: true, notes: true, links: true, folders: true,
    files: true, size: true, uptime: true, swatches: true, date: true,
  },
};

/* who and where, as the operating system reports it */
const detectIdentity = () => {
  let user = 'user';
  let host = 'localhost';
  try { user = nodeOs.userInfo().username || user; } catch (e) { /* keep the fallback */ }
  try { host = nodeOs.hostname().replace(/\.local$/i, '') || host; } catch (e) { /* keep the fallback */ }
  return { user: user.toLowerCase(), host: host.toLowerCase() };
};

const osLabel = () => {
  if (Platform.isMacOS) return 'macOS';
  if (Platform.isWin) return 'windows';
  if (Platform.isLinux) return 'linux';
  return 'unknown';
};

/* nerd font logos: apple / windows / linux */
const osGlyph = () => {
  if (Platform.isMacOS) return '\uF179';
  if (Platform.isWin) return '\uF17A';
  return '\uF17C';
};

/* ── fonts ───────────────────────────────────────────────────────────────
   the panel ships its own typewriter face (embedded in styles.css), so the
   default needs nothing installed. the settings can swap it for a font from
   the user's own machine. */

/* well-known monospace fonts, checked quietly with no permission needed */
const CANDIDATE_FONTS = [
  'SF Mono', 'Menlo', 'Monaco', 'Andale Mono', 'Consolas', 'Lucida Console', 'Cascadia Code',
  'Cascadia Mono', 'Courier New', 'JetBrains Mono', 'Fira Code', 'Fira Mono', 'Source Code Pro',
  'IBM Plex Mono', 'Roboto Mono', 'Hack', 'Inconsolata', 'Ubuntu Mono', 'DejaVu Sans Mono',
  'Liberation Mono', 'Noto Sans Mono', 'Iosevka', 'Victor Mono', 'Space Mono', 'CMU Typewriter Text',
  'MesloLGS NF',
];

const quoteFont = (name) => '"' + String(name).replace(/["\\]/g, '') + '"';

let measureCtx = null;
const textWidth = (family, text) => {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = '64px ' + family;
  return measureCtx.measureText(text).width;
};

/* installed = drawing with it differs from every plain fallback */
const isInstalled = (name) => ['monospace', 'serif', 'sans-serif'].some(
  (base) => textWidth(quoteFont(name) + ', ' + base, 'mmmmmmmmmmlli') !== textWidth(base, 'mmmmmmmmmmlli')
);

/* monospace = narrow and wide letters take the same room */
const isMono = (name) => {
  const f = quoteFont(name) + ', monospace';
  return Math.abs(textWidth(f, 'iiiiiiiiii') - textWidth(f, 'mmmmmmmmmm')) < 0.5 &&
    Math.abs(textWidth(f, 'llllllllll') - textWidth(f, 'WWWWWWWWWW')) < 0.5;
};

/* asks chromium for every installed family (it may ask permission first) and
   keeps the monospace ones. returns null when this version can't do it. */
const scanSystemFonts = async () => {
  if (typeof window.queryLocalFonts !== 'function') return null;
  const fonts = await window.queryLocalFonts();
  const families = Array.from(new Set(fonts.map((f) => f.family)));
  return families
    .filter((name) => !/symbols|emoji|icons|dingbats|wingdings|webdings/i.test(name))
    .filter((name) => isInstalled(name) && isMono(name))
    .sort((a, b) => a.localeCompare(b));
};

/* the font-family to put in --vf-mono, or null to leave the css default
   (the bundled face, or whatever a theme sets) alone */
const fontStack = (cfg) => {
  switch (cfg.font) {
    case 'obsidian': return 'var(--font-monospace), ui-monospace, monospace';
    case 'system': return 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    case 'custom': return cfg.customFont.trim() || null;
    default:
      return cfg.font.indexOf('family:') === 0
        ? quoteFont(cfg.font.slice(7)) + ', ui-monospace, monospace'
        : null;
  }
};

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
      stop.style.stopColor = 'var(' + name + ', var(' + name.replace('--vf-', '--mz-') + ', ' + fallback + '))';
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
   and is re-fitted whenever the pane resizes. (the card is as wide as this bar,
   so normally it fits at full size and the card just moves when the sidebar
   resizes; this only kicks in when the pane is narrower than the bar.) only below half size does the
   pill start to ellipsise instead. */
const fitBar = (bar, watch) => {
  const FLOOR = 0.5;
  let queued = false;

  const fit = () => {
    bar.classList.remove('is-squeezed');
    bar.style.zoom = '';                       /* measure at natural size */
    const have = bar.clientWidth;
    const need = bar.scrollWidth;
    if (!have || need <= have + 1) return;     /* fits (or is hidden): leave it alone */
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
  return () => ro.disconnect();
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

const buildPrompt = (vaultName, user, pills) => {
  const bar = el('div', 'vf-bar');
  const segs = [];
  if (pills.user) segs.push(['vf-user', osGlyph() + ' ' + user]);
  if (pills.vault) segs.push(['vf-path', '~/' + vaultName]);
  if (pills.time) {
    /* the chevrons only make sense as a bridge to the time pill */
    if (pills.user || pills.vault) segs.push(['vf-ch vf-ch1', ''], ['vf-ch vf-ch2', ''], ['vf-ch vf-ch3', '']);
    segs.push(['vf-clock', '']);
  }

  const nodes = segs.map(([cls, text], i) => {
    const seg = el('span', 'vf-seg ' + cls, text);
    seg.style.zIndex = String(segs.length - i);   /* each arrow tip sits over the next segment */
    bar.appendChild(seg);
    return seg;
  });

  const find = (cls) => nodes.find((n) => n.classList.contains(cls)) || null;
  bar.hidden = nodes.length === 0;
  return { bar, user: find('vf-user'), clock: find('vf-clock') };
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

/* what each thing in the card means (shown by the "? info" button) */
const INFO = [
  ['pills', 'your name · this vault · the time obsidian was opened (hover it)'],
  ['user', 'who you are, on which machine'],
  ['os', 'what obsidian is running on'],
  ['vault', 'where this vault lives on your disk'],
  ['notes', 'markdown notes (.md files)'],
  ['links', '[[links]] and embeds, counted across every note'],
  ['folders', 'folders in the vault (the root isn\'t counted)'],
  ['files', 'every file: notes, images, pdfs, everything'],
  ['size', 'total size of all those files'],
  ['uptime', 'how long obsidian has been open'],
  ['date', 'the time right now'],
];

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
    if (this.refs.disposeFit) this.refs.disposeFit();
  }

  /* ── drawing ─────────────────────────────────────────────────────── */

  paint(card, scroll) {
    const refs = this.refs;
    refs.card = card;
    refs.scroll = scroll;
    refs.rowEls = {};
    refs.infoEls = {};
    const who = this.plugin.identity();

    /* prompt + fastfetch (the prompt is redrawn whenever the pill toggles change) */
    this.drawPrompt();
    card.appendChild(buildCmd('fastfetch'));

    /* hover card for the time pill (a native tooltip can't show here: the pill
       is redrawn every second, which keeps cancelling it) */
    const tip = el('div', 'vf-tip');
    tip.hidden = true;
    refs.tipOpened = el('div', 'vf-tip-v');
    refs.tipUp = el('div', 'vf-tip-v');
    tip.appendChild(el('div', 'vf-tip-k', 'obsidian opened'));
    tip.appendChild(refs.tipOpened);
    tip.appendChild(el('div', 'vf-tip-k', 'running for'));
    tip.appendChild(refs.tipUp);
    card.appendChild(tip);
    refs.tip = tip;

    const rows = el('div', 'vf-rows');
    refs.rowsEl = rows;
    const hints = Object.fromEntries(INFO);
    const row = (key, cls) => {
      const k = el('div', 'vf-k', key);
      if (hints[key]) k.title = hints[key];
      rows.appendChild(k);
      const value = el('div', 'vf-v ' + (cls || ''));
      rows.appendChild(value);
      refs.rowEls[key] = [k, value];
      return value;
    };

    refs.userRow = row('user', 'p');
    refs.userRow.textContent = who.user + '@' + who.host;
    row('os', 'd').textContent = osLabel() + ' · obsidian';
    refs.vault = row('vault', 'h');
    /* the full path is long: let it wrap so the vault name at the end stays visible */
    refs.vault.addClass('vf-wrap');
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
    refs.swatches = swatches;

    /* the date line: drawn text, nothing is executed */
    refs.dateCmd = buildCmd('date');
    card.appendChild(refs.dateCmd);
    refs.date = el('div', 'vf-out b');
    card.appendChild(refs.date);

    /* the "what is all this" card: toggled by the button on the last prompt */
    const info = el('div', 'vf-info');
    info.hidden = true;
    info.appendChild(buildCmd('fastfetch', '--info'));
    const grid = el('div', 'vf-info-grid');
    INFO.forEach(([key, text]) => {
      const k = el('div', 'vf-k', key);
      const d = el('div', 'vf-info-d', text);
      grid.appendChild(k);
      grid.appendChild(d);
      refs.infoEls[key] = [k, d];
    });
    info.appendChild(grid);
    card.appendChild(info);

    /* fresh prompt, blinking cursor, and the info button on the right */
    const last = buildCmd('', '', true);
    last.classList.add('vf-last');
    const btn = el('span', 'vf-info-btn', '? info');
    btn.title = 'what do these rows mean?';
    btn.addEventListener('click', () => {
      info.hidden = !info.hidden;
      btn.textContent = info.hidden ? '? info' : '× close';
    });
    last.appendChild(btn);
    card.appendChild(last);

    this.applyFont();
    this.applyVisibility();
  }

  /* the powerline bar, built from the pill toggles; safe to call again */
  drawPrompt() {
    const { refs, plugin } = this;
    const who = plugin.identity();

    if (refs.disposeFit) refs.disposeFit();
    const prompt = buildPrompt(this.app.vault.getName(), who.user, plugin.settings.pills);
    if (refs.bar) refs.bar.replaceWith(prompt.bar);
    else refs.card.prepend(prompt.bar);
    refs.bar = prompt.bar;
    refs.clock = prompt.clock;
    refs.disposeFit = fitBar(prompt.bar, [refs.card, refs.scroll]);   /* keeps the full vault name on screen */

    if (refs.tip) refs.tip.hidden = true;
    if (refs.clock) {
      refs.clock.classList.add('vf-hover');
      refs.clock.addEventListener('mouseenter', () => this.showTip());
      refs.clock.addEventListener('mouseleave', () => { refs.tip.hidden = true; });
    }
  }

  showTip() {
    const { refs } = this;
    if (!refs.clock || !refs.tip) return;
    this.tick();
    refs.tip.hidden = false;
    const c = refs.card.getBoundingClientRect();
    const p = refs.clock.getBoundingClientRect();
    const w = refs.tip.offsetWidth;
    let left = p.right - c.left - w;                       /* right edges line up */
    left = Math.max(8, Math.min(left, c.width - w - 8));   /* stay inside the card */
    refs.tip.style.left = left + 'px';
    refs.tip.style.top = (p.bottom - c.top + 6) + 'px';
  }

  /* font choice: sets --vf-mono on the card, or clears it for the default */
  applyFont() {
    const stack = fontStack(this.plugin.settings);
    if (stack) this.refs.card.style.setProperty('--vf-mono', stack);
    else this.refs.card.style.removeProperty('--vf-mono');
  }

  /* row and section toggles */
  applyVisibility() {
    const { refs } = this;
    const { show, pills } = this.plugin.settings;
    let anyRow = false;

    ROWS.forEach((key) => {
      const on = Boolean(show[key]);
      anyRow = anyRow || on;
      refs.rowEls[key].forEach((n) => { n.hidden = !on; });
      refs.infoEls[key].forEach((n) => { n.hidden = !on; });
    });
    refs.rowsEl.hidden = !anyRow;
    refs.swatches.hidden = !show.swatches;
    refs.dateCmd.hidden = !show.date;
    refs.date.hidden = !show.date;
    refs.infoEls.date.forEach((n) => { n.hidden = !show.date; });
    refs.infoEls.pills.forEach((n) => { n.hidden = !(pills.user || pills.vault || pills.time); });
  }

  /* settings changed: redraw what depends on them, in place */
  applySettings() {
    const { refs, plugin } = this;
    if (!refs.card) return;
    const who = plugin.identity();
    this.drawPrompt();
    refs.userRow.textContent = who.user + '@' + who.host;
    this.applyFont();
    this.applyVisibility();
    this.refresh();
    this.tick();
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
    refs.vault.textContent = this.plugin.settings.showFullPath && adapter instanceof FileSystemAdapter
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
    if (!refs.date) return;

    const d = new Date();
    const hms = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());

    /* prompt pill: when obsidian was opened (fixed, not a live clock).
       a different day gets the date too, e.g. "6 nov 20:59".
       only written when it actually changes, so hovering isn't disturbed */
    const o = new Date(this.plugin.openedAt);
    const sameDay = o.toDateString() === d.toDateString();
    const label = '\uF43A ' + (sameDay ? '' : o.getDate() + ' ' + MONTHS[o.getMonth()] + ' ') +
      pad(o.getHours()) + ':' + pad(o.getMinutes());
    if (refs.clock && refs.clock.textContent !== label) refs.clock.textContent = label;

    if (refs.tip && !refs.tip.hidden) {
      refs.tipOpened.textContent = DAYS[o.getDay()] + ' ' + o.getDate() + ' ' + MONTHS[o.getMonth()] +
        ' · ' + pad(o.getHours()) + ':' + pad(o.getMinutes()) + ':' + pad(o.getSeconds());
      refs.tipUp.textContent = formatUptime(Date.now() - this.plugin.openedAt);
    }

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

class FetchSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.scanned = [];
  }

  display() {
    const { containerEl, plugin } = this;
    const s = plugin.settings;
    containerEl.empty();
    const found = plugin.detected;
    const hints = Object.fromEntries(INFO);

    const flag = (group, key, name, desc) => new Setting(containerEl)
      .setName(name)
      .setDesc(desc || '')
      .addToggle((toggle) => toggle
        .setValue(Boolean(s[group][key]))
        .onChange(async (value) => {
          s[group][key] = value;
          await plugin.saveSettings();
        }));

    /* ── who you are ── */
    new Setting(containerEl).setName('identity').setHeading();

    new Setting(containerEl)
      .setName('user name')
      .setDesc('shown in the first pill and the user row. leave empty to use the name your system reports.')
      .addText((text) => text
        .setPlaceholder(found.user)
        .setValue(s.username)
        .onChange(async (value) => {
          s.username = value.trim();
          await plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('host name')
      .setDesc("shown after the @ in the user row. leave empty to use your computer's name.")
      .addText((text) => text
        .setPlaceholder(found.host)
        .setValue(s.hostname)
        .onChange(async (value) => {
          s.hostname = value.trim();
          await plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('show full vault path')
      .setDesc('turn this off to show only the vault name, handy before taking a screenshot.')
      .addToggle((toggle) => toggle
        .setValue(s.showFullPath)
        .onChange(async (value) => {
          s.showFullPath = value;
          await plugin.saveSettings();
        }));

    /* ── what the prompt shows ── */
    new Setting(containerEl).setName('prompt').setHeading();
    flag('pills', 'user', 'user pill', 'your name, with a logo for your operating system.');
    flag('pills', 'vault', 'vault pill', 'the name of this vault.');
    flag('pills', 'time', 'time pill', 'when obsidian was opened. hover it for the full date and uptime.');

    /* ── what the panel shows ── */
    new Setting(containerEl).setName('rows').setHeading();
    ROWS.forEach((key) => flag('show', key, ROW_NAMES[key], hints[key]));
    flag('show', 'swatches', 'colour swatches', 'the strip of colour blocks under the rows.');
    flag('show', 'date', 'date line', 'the date line at the bottom of the panel.');

    /* ── font ── */
    new Setting(containerEl).setName('appearance').setHeading();

    const choices = () => {
      const opts = {
        bundled: 'cmu typewriter (bundled)',
        obsidian: "obsidian's monospace font",
        system: 'system monospace',
      };
      const names = new Set(CANDIDATE_FONTS.filter((n) => isInstalled(n)));
      this.scanned.forEach((n) => names.add(n));
      if (s.font.indexOf('family:') === 0) names.add(s.font.slice(7));
      Array.from(names)
        .sort((a, b) => a.localeCompare(b))
        .forEach((n) => { opts['family:' + n] = n; });
      opts.custom = 'custom…';
      return opts;
    };

    let custom = null;

    new Setting(containerEl)
      .setName('font')
      .setDesc('the default font is bundled with the plugin, so nothing needs installing. or pick a monospace font from this computer.')
      .addDropdown((dropdown) => {
        this.fontDropdown = dropdown;
        dropdown
          .addOptions(choices())
          .setValue(s.font)
          .onChange(async (value) => {
            s.font = value;
            if (custom) custom.settingEl.hidden = value !== 'custom';
            await plugin.saveSettings();
          });
      });

    custom = new Setting(containerEl)
      .setName('custom font')
      .setDesc('any css font-family list, such as "JetBrains Mono", monospace')
      .addText((text) => text
        .setPlaceholder('"JetBrains Mono", monospace')
        .setValue(s.customFont)
        .onChange(async (value) => {
          s.customFont = value;
          await plugin.saveSettings();
        }));
    custom.settingEl.hidden = s.font !== 'custom';

    new Setting(containerEl)
      .setName('find monospace fonts')
      .setDesc("adds every monospace font installed on this computer to the menu above. obsidian may ask for permission first. if this version can't do it, the menu still lists the common fonts it finds.")
      .addButton((button) => button
        .setButtonText('scan')
        .onClick(async () => {
          button.setDisabled(true);
          try {
            const list = await scanSystemFonts();
            if (!list) {
              new Notice("this version of obsidian can't list system fonts. use a custom font instead.");
            } else {
              this.scanned = list;
              this.fontDropdown.selectEl.empty();
              this.fontDropdown.addOptions(choices());
              this.fontDropdown.setValue(s.font);
              new Notice('found ' + list.length + ' monospace fonts.');
            }
          } catch (e) {
            new Notice('could not read the font list. use a custom font instead.');
          }
          button.setDisabled(false);
        }));
  }
}

module.exports = class MishFastfetch extends Plugin {
  async onload() {
    await this.loadSettings();
    this.detected = detectIdentity();

    /* the renderer's time origin is when this obsidian window started */
    this.openedAt = (typeof performance !== 'undefined' && performance.timeOrigin)
      ? performance.timeOrigin
      : Date.now();

    mountRainbow();
    this.addSettingTab(new FetchSettingTab(this.app, this));

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

  async loadSettings() {
    const saved = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved, {
      pills: Object.assign({}, DEFAULT_SETTINGS.pills, saved.pills),
      show: Object.assign({}, DEFAULT_SETTINGS.show, saved.show),
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshViews();
  }

  /* what the settings say, falling back to what the system says */
  identity() {
    return {
      user: this.settings.username || this.detected.user,
      host: this.settings.hostname || this.detected.host,
    };
  }

  refreshViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof FetchView) leaf.view.applySettings();
    });
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
