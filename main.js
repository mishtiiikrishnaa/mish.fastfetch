'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   mish.fastfetch
   powerline starship prompt + `fastfetch` + macOS `date`, as a sidebar view.
   uptime = time since obsidian was opened.
   dressed like mish.eza: the same palette presets, pill shapes and card options.
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

/* ── the rainbow ─────────────────────────────────────────────────────────
   six colours, in this order everywhere: the prompt pills, the rows, the card
   border, the scrollbar and the ribbon icon all read from them. same palette
   engine as mish.eza. a slot is a few css variables: the theme's own (vf), the
   fill this plugin ships (f: pills, border, scrollbar) and the text version
   (t: row text; darker in light mode, `dark` = how much, copied from styles.css). */
const SLOTS = [
  { name: 'pink',   vf: '--vf-pink-hi', f: '--mz-f-pink-hi', t: '--mz-pink-hi', dark: 40, used: 'user pill, the row names, the user and files rows, where the border starts' },
  { name: 'peach',  vf: '--vf-peach',   f: '--mz-f-peach',   t: '--mz-peach',   dark: 42, used: 'vault pill, the vault path row' },
  { name: 'yellow', vf: '--vf-yellow',  f: '--mz-f-yellow',  t: '--mz-yellow',  dark: 50, used: 'first arrow of the >>> bridge, colour swatches' },
  { name: 'green',  vf: '--vf-green',   f: '--mz-f-green',   t: '--mz-green',   dark: 48, used: 'commands and the prompt arrow, the notes row, second bridge arrow' },
  { name: 'blue',   vf: '--vf-blue',    f: '--mz-f-blue',    t: '--mz-blue',    dark: 40, used: 'third bridge arrow, the links and uptime rows, the date' },
  { name: 'lilac',  vf: '--vf-lilac',   f: '--mz-f-lilac',   t: '--mz-lilac',   dark: 38, used: 'time pill, the folders row, where the border ends' },
];

/* fastfetch paints two things the six slots don't cover: the row names (hot pink) and
   the folders row (cyan). with a custom palette they borrow slot `from`. */
const EXTRAS = [
  { vf: '--vf-pink', f: '--mz-f-pink', t: '--mz-pink', from: 0 },
  { vf: '--vf-cyan', f: '--mz-f-cyan', t: '--mz-cyan', from: 5 },
];

/* what the plugin draws with when "mish" is picked (the sorbet palette) */
const DARK_FILLS  = ['#ffa6c9', '#ffd6a6', '#fff1a8', '#c9ffa6', '#a6c9ff', '#c9b0ff'];
const LIGHT_FILLS = ['#ff8fb8', '#ffb27a', '#ffd54f', '#8ee07f', '#82b4ff', '#b79bff'];

const PALETTES = {
  catppuccin: ['#f5c2e7', '#fab387', '#f9e2af', '#a6e3a1', '#89b4fa', '#cba6f7'],
  dracula:    ['#ff79c6', '#ffb86c', '#f1fa8c', '#50fa7b', '#8be9fd', '#bd93f9'],
  nord:       ['#bf616a', '#d08770', '#ebcb8b', '#a3be8c', '#81a1c1', '#b48ead'],
  gruvbox:    ['#fb4934', '#fe8019', '#fabd2f', '#b8bb26', '#83a598', '#d3869b'],
  ocean:      ['#c4f1f9', '#7fe0e8', '#6fd3c2', '#7bc6f0', '#82a8ff', '#a98bff'],
  sunset:     ['#ff8fa3', '#ff9e6b', '#ffc15e', '#ff7eb6', '#e08bff', '#b794ff'],
  forest:     ['#e6c9a8', '#d9b26f', '#e3e08a', '#9fd58a', '#6fc2a0', '#7fa8c9'],
  greyscale:  ['#f5f5f5', '#dcdcdc', '#c4c4c4', '#a8a8a8', '#8c8c8c', '#707070'],
};

const HEX = /^#[0-9a-f]{6}$/i;
const SHAPES = ['arrow', 'round', 'flat'];

const lightTheme = () => document.body.classList.contains('theme-light');
const themeFills = () => (lightTheme() ? LIGHT_FILLS : DARK_FILLS).slice();

const num = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* defaults underneath, what was saved on top; nested groups merge key by key,
   so a setting added in an update never goes missing from an old data.json */
const deepMerge = (base, over) => {
  const out = Object.assign({}, base);
  if (!isPlain(over)) return out;
  for (const k of Object.keys(over)) {
    out[k] = isPlain(base[k]) && isPlain(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
};

/* a data.json from an older version, or one edited by hand, must never break the panel */
const sanitise = (cfg) => {
  const p = cfg.palette;
  if (p.preset !== 'theme' && p.preset !== 'custom' && !PALETTES[p.preset]) p.preset = 'theme';
  if (!Array.isArray(p.colours) || p.colours.length !== 6 || !p.colours.every((c) => HEX.test(c))) {
    p.colours = DARK_FILLS.slice();
  }
  if (!SHAPES.includes(cfg.pillShape)) cfg.pillShape = 'arrow';
  cfg.lowercaseUi = cfg.lowercaseUi !== false;
  return cfg;
};

/* the six colours to draw with, or null when the theme decides */
const customColours = (cfg) => {
  const p = cfg.palette;
  return p.preset !== 'theme' && Array.isArray(p.colours) && p.colours.length === 6 && p.colours.every((c) => HEX.test(c))
    ? p.colours : null;
};

/* css variables for the colours. a custom palette sets the plugin's own fills and text
   colours, and tells the theme's --vf-* to step aside (`initial` = "not set", so the
   fallbacks win). in light mode the text colour is the fill darkened, the same way
   styles.css does it for the default palette. */
const paletteVars = (cfg) => {
  const v = {};
  const colours = customColours(cfg);
  if (colours) {
    const light = lightTheme();
    const text = (hex, dark) => (light ? 'color-mix(in oklab, ' + hex + ', black ' + dark + '%)' : hex);
    SLOTS.forEach((s, i) => {
      v[s.vf] = 'initial';
      v[s.f] = colours[i];
      v[s.t] = text(colours[i], s.dark);
    });
    EXTRAS.forEach((x) => {
      v[x.vf] = 'initial';
      v[x.f] = colours[x.from];
      v[x.t] = text(colours[x.from], SLOTS[x.from].dark);
    });
  }
  if (HEX.test(cfg.inkColour)) {
    v['--vf-black'] = 'initial';
    v['--mz-ink'] = cfg.inkColour;
  }
  return v;
};

/* css variables for the card. every one has the old fixed value as its fallback in
   styles.css, so the defaults look exactly as before. */
const layoutVars = (cfg) => {
  const c = cfg.card;
  const v = {
    '--ff-radius': num(c.radius, 0, 28, 10) + 'px',
    '--ff-pad': num(c.pad, 0, 32, 10) + 'px',
    '--ff-angle': num(c.angle, 0, 360, 135) + 'deg',
    '--ff-mt': c.vAlign === 'top' ? '0' : 'auto',
    '--ff-ml': c.hAlign === 'left' ? '0' : 'auto',
  };
  const w = num(c.ringWidth, 1, 4, 1) + 'px';
  if (c.ring === 'none') {
    v['--ff-ring-w'] = '0px';
  } else if (c.ring === 'accent') {
    v['--ff-ring-w'] = w;
    v['--ff-ring-bg'] = 'var(--interactive-accent)';
  } else if (c.ring === 'subtle') {
    v['--ff-ring-w'] = w;
    v['--ff-ring-bg'] = 'var(--background-modifier-border)';
  } else {
    v['--ff-ring-w'] = w;                 /* rainbow: the gradient in styles.css */
  }
  return v;
};

/* sets the variables, and clears ones set last time that are no longer wanted */
const applyVars = (node, vars) => {
  for (const name of node.__ffVars || []) {
    if (!(name in vars)) node.style.removeProperty(name);
  }
  for (const name of Object.keys(vars)) node.style.setProperty(name, vars[name]);
  node.__ffVars = Object.keys(vars);
};

/* ── lowercase ui ────────────────────────────────────────────────────────
   the text in the settings tab is written in lowercase, to match the terminal look.
   with the "lowercase ui" setting off, ui() shows it in sentence case instead (a capital
   at the start of each sentence, plus the few names that need one). only text that
   obsidian itself shows goes through ui(): the settings tab, its tooltips and its
   messages. the terminal panel is always lowercase. */
const uiCase = { lower: true };

const PROPER = [
  [/\bcmu typewriter\b/g, 'CMU Typewriter'],
  [/\bobsidian\b/g, 'Obsidian'],
  [/\bcss\b/g, 'CSS'],
  [/\bui\b/g, 'UI'],
  [/\bpdfs\b/g, 'PDFs'],
  [/\bmish\b(?!\.[a-z])/g, 'Mish'],      /* the palette, not mish.eza / mish.fastfetch */
  [/\bpm\b/g, 'PM'],
  [/(?<![\w./-])git\b(?!\/)/g, 'Git'],      /* not the .git folder */
];

/* commands stay lowercase even at the start of a sentence */
const KEEP_LOWER = new Set(['rm', 'eza', 'mv', 'cp', 'mkdir', 'touch']);

const sentence = (text) => {
  let out = String(text);
  for (const [re, name] of PROPER) out = out.replace(re, name);
  return out.replace(/(^|[.!?]\s+)([a-z][\w-]*)/g, (m, lead, word) => (
    KEEP_LOWER.has(word) ? m : lead + word.charAt(0).toUpperCase() + word.slice(1)
  ));
};

const ui = (text) => (uiCase.lower ? text : sentence(text));

const uiOptions = (options) => Object.fromEntries(
  Object.entries(options).map(([key, label]) => [key, ui(label)])
);

/* a Setting whose name and description go through ui() */
class UiSetting extends Setting {
  setName(name) { return super.setName(typeof name === 'string' ? ui(name) : name); }
  setDesc(desc) { return super.setDesc(typeof desc === 'string' ? ui(desc) : desc); }
}

const DEFAULT_SETTINGS = {
  lowercaseUi: true,     /* settings text in lowercase (true) or sentence case (false) */
  username: '',          /* empty = auto-detect */
  hostname: '',          /* empty = auto-detect */
  showFullPath: true,
  vaultLabel: '',        /* empty = ~/<vault name> */
  pillShape: 'arrow',    /* arrow | round | flat */
  palette: { preset: 'theme', colours: DARK_FILLS.slice() },   /* preset = theme | custom | one of PALETTES */
  inkColour: '',         /* text on the pills. empty = automatic (dark ink) */
  card: {
    width: 'fit',        /* fit (the prompt decides) | full (the whole sidebar) */
    hAlign: 'centre',    /* centre | left */
    vAlign: 'centre',    /* centre | top */
    ring: 'rainbow',     /* rainbow | accent | subtle | none */
    ringWidth: 1,
    angle: 135,          /* degrees, for the rainbow border */
    radius: 10,
    pad: 10,
  },
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
   a hidden svg holds the gradient; styles.css points `stroke` at it. it is this
   plugin's own (mish.eza keeps another), so each icon follows its own palette. */
const RAINBOW_ID = 'mish-fetch-rainbow-defs';

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
    grad.id = 'mish-fetch-rainbow';
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

/* a colour as the browser sees it right now, for a css value that may hold var() or
   color-mix(). a gradient stop that only holds `var(...)` text never repaints when the
   theme flips (the text is the same string, so nothing tells the browser the icon is
   stale). a real colour does change between light and dark, so the icons follow. */
const resolveColour = (css) => {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;color:' + css;
  document.body.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out;
};

/* point the gradient's six stops at the palette, or at the theme's colours when the
   palette is the default. run again on every theme change (see onload). */
const paintRainbow = (cfg) => {
  const svg = document.getElementById(RAINBOW_ID);
  if (!svg) return;
  const colours = customColours(cfg);
  const light = lightTheme();
  svg.querySelectorAll('stop').forEach((stop, i) => {
    const sl = SLOTS[i];
    if (!sl) return;
    const css = colours
      ? (light ? 'color-mix(in oklab, ' + colours[i] + ', black ' + sl.dark + '%)' : colours[i])
      : 'var(' + sl.vf + ', var(' + sl.t + ', ' + DARK_FILLS[i] + '))';
    stop.style.stopColor = resolveColour(css) || css;
  });
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
  schedule.dispose = () => ro.disconnect();
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

const buildPrompt = (vaultLabel, user, pills) => {
  const bar = el('div', 'vf-bar');
  const segs = [];
  if (pills.user) segs.push(['vf-user', osGlyph() + ' ' + user]);
  if (pills.vault) segs.push(['vf-path', vaultLabel]);
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
  getDisplayText() { return ui('fetch'); }
  getIcon() { return 'cpu'; }

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

    this.applyLook();
    this.applyVisibility();
  }

  /* the powerline bar, built from the pill toggles; safe to call again */
  drawPrompt() {
    const { refs, plugin } = this;
    const who = plugin.identity();

    if (refs.disposeFit) refs.disposeFit();
    const label = plugin.settings.vaultLabel || '~/' + this.app.vault.getName();
    const prompt = buildPrompt(label, who.user, plugin.settings.pills);
    if (refs.bar) refs.bar.replaceWith(prompt.bar);
    else refs.card.prepend(prompt.bar);
    refs.bar = prompt.bar;
    refs.clock = prompt.clock;
    refs.fit = fitBar(prompt.bar, [refs.card, refs.scroll]);   /* keeps the full vault name on screen */
    refs.disposeFit = refs.fit.dispose;

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

  /* the look: font, colours, card, pill shape. colours and sizes are css variables on the
     view's root (so the scrollbar beside the card gets them too); shape is a class. */
  applyLook() {
    const { refs, plugin } = this;
    if (!refs.card) return;
    const cfg = plugin.settings;

    this.applyFont();
    applyVars(this.contentEl, Object.assign({}, paletteVars(cfg), layoutVars(cfg)));
    SHAPES.forEach((n) => refs.card.classList.toggle('vf-shape-' + n, cfg.pillShape === n));
    refs.card.classList.toggle('vf-full', cfg.card.width === 'full');
    if (refs.fit) refs.fit();
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
    this.applyLook();
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

    const flag = (group, key, name, desc) => new UiSetting(containerEl)
      .setName(name)
      .setDesc(desc || '')
      .addToggle((toggle) => toggle
        .setValue(Boolean(s[group][key]))
        .onChange(async (value) => {
          s[group][key] = value;
          await plugin.saveSettings();
        }));

    /* the builders below (the same ones mish.eza uses) write into the settings, repaint,
       and save a moment later. kind: 'look' = styles only (fast), 'bar' = redraw the prompt too. */
    const apply = (kind) => {
      if (kind === 'bar') plugin.refreshViews();
      else plugin.restyle();
      plugin.persist();
    };
    const holder = (group) => (group ? s[group] : s);
    const dflt = (group, key) => (group ? DEFAULT_SETTINGS[group] : DEFAULT_SETTINGS)[key];

    const drop = (group, key, name, desc, options, kind) => new UiSetting(containerEl)
      .setName(name)
      .setDesc(desc || '')
      .addDropdown((d) => d
        .addOptions(uiOptions(options))
        .setValue(String(holder(group)[key]))
        .onChange((value) => {
          holder(group)[key] = value;
          apply(kind);
        }));

    /* a slider with a little reset arrow that puts the default back */
    const slide = (group, key, name, desc, lo, hi, step, kind, unit) => {
      let comp = null;
      return new UiSetting(containerEl)
        .setName(name)
        .setDesc(desc || '')
        .addSlider((sl) => {
          comp = sl;
          sl.setLimits(lo, hi, step)
            .setValue(Number(holder(group)[key]))
            .setDynamicTooltip()
            .onChange((value) => {
              holder(group)[key] = value;
              apply(kind);
            });
        })
        .addExtraButton((b) => b
          .setIcon('rotate-ccw')
          .setTooltip(ui('back to the default (' + dflt(group, key) + (unit || '') + ')'))
          .onClick(() => {
            holder(group)[key] = dflt(group, key);
            comp.setValue(dflt(group, key));
            apply(kind);
          }));
    };

    /* ── the first setting: how the text in this tab is cased ── */
    new UiSetting(containerEl)
      .setName('lowercase ui')
      .setDesc('show the text in this tab, its tooltips and its messages in lowercase, to match the terminal look. turn it off for normal sentence case.')
      .addToggle((toggle) => toggle
        .setValue(s.lowercaseUi !== false)
        .onChange(async (value) => {
          s.lowercaseUi = value;
          uiCase.lower = value;
          await plugin.saveSettings();
          plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => { if (leaf.updateHeader) leaf.updateHeader(); });
          this.display();
        }));

    /* ── who you are ── */
    new UiSetting(containerEl).setName('identity').setHeading();

    new UiSetting(containerEl)
      .setName('user name')
      .setDesc('shown in the first pill and the user row. leave empty to use the name your system reports.')
      .addText((text) => text
        .setPlaceholder(found.user)
        .setValue(s.username)
        .onChange(async (value) => {
          s.username = value.trim();
          await plugin.saveSettings();
        }));

    new UiSetting(containerEl)
      .setName('host name')
      .setDesc("shown after the @ in the user row. leave empty to use your computer's name.")
      .addText((text) => text
        .setPlaceholder(found.host)
        .setValue(s.hostname)
        .onChange(async (value) => {
          s.hostname = value.trim();
          await plugin.saveSettings();
        }));

    new UiSetting(containerEl)
      .setName('show full vault path')
      .setDesc('turn this off to show only the vault name, handy before taking a screenshot.')
      .addToggle((toggle) => toggle
        .setValue(s.showFullPath)
        .onChange(async (value) => {
          s.showFullPath = value;
          await plugin.saveSettings();
        }));

    /* ── what the prompt shows ── */
    new UiSetting(containerEl).setName('prompt').setHeading();
    flag('pills', 'user', 'user pill', 'your name, with a logo for your operating system.');
    flag('pills', 'vault', 'vault pill', 'the name of this vault.');
    flag('pills', 'time', 'time pill', 'when obsidian was opened. hover it for the full date and uptime.');
    drop(null, 'pillShape', 'pill shape', 'arrow is the powerline look. round and flat drop the arrow tips (and the little >>> bridge before the time pill) and use gaps instead.',
      { arrow: 'arrow (powerline)', round: 'round', flat: 'flat' }, 'look');
    new UiSetting(containerEl)
      .setName('vault pill text')
      .setDesc('what the second pill says. leave it empty for ~/ and the vault name.')
      .addText((text) => text
        .setPlaceholder('~/' + plugin.app.vault.getName())
        .setValue(s.vaultLabel)
        .onChange((value) => {
          s.vaultLabel = value.trim();
          apply('bar');
        }));

    /* ── what the panel shows ── */
    new UiSetting(containerEl).setName('rows').setHeading();
    ROWS.forEach((key) => flag('show', key, ROW_NAMES[key], hints[key]));
    flag('show', 'swatches', 'colour swatches', 'the strip of colour blocks under the rows.');
    flag('show', 'date', 'date line', 'the date line at the bottom of the panel.');

    /* ── colours ── */
    new UiSetting(containerEl).setName('colours').setHeading();

    const pickers = [];
    let presetDrop = null;
    let refreshing = false;       /* setValue on a picker must not count as the user picking */
    const shown = () => (s.palette.preset === 'theme' ? themeFills() : s.palette.colours);

    const presets = { theme: ui('mish') };
    Object.keys(PALETTES).forEach((k) => { presets[k] = ui(k); });
    presets.custom = ui('custom');

    new UiSetting(containerEl)
      .setName('palette')
      .setDesc('the six colours of the rainbow. they colour the prompt pills, the rows, the card border, the scrollbar and the ribbon icon. mish is the default: the pastel rainbow this plugin ships, and it follows the colours of your obsidian theme if the theme sets them. pick a preset, then change any colour below. in light mode the text versions are darkened for you.')
      .addDropdown((d) => {
        presetDrop = d;
        d.addOptions(presets)
          .setValue(presets[s.palette.preset] ? s.palette.preset : 'theme')
          .onChange((value) => {
            const was = s.palette.preset;
            s.palette.preset = value;
            if (PALETTES[value]) s.palette.colours = PALETTES[value].slice();
            else if (value === 'custom' && was === 'theme') s.palette.colours = themeFills();
            refreshing = true;
            shown().forEach((c, i) => { if (pickers[i]) pickers[i].setValue(c); });
            refreshing = false;
            apply('look');
          });
      })
      .addExtraButton((b) => b
        .setIcon('rotate-ccw')
        .setTooltip(ui('back to mish'))
        .onClick(() => {
          s.palette.preset = 'theme';
          presetDrop.setValue('theme');
          refreshing = true;
          shown().forEach((c, i) => { if (pickers[i]) pickers[i].setValue(c); });
          refreshing = false;
          apply('look');
        }));

    SLOTS.forEach((slot, i) => {
      new UiSetting(containerEl)
        .setName('colour ' + (i + 1))
        .setDesc(slot.used)
        .addColorPicker((c) => {
          pickers[i] = c;
          c.setValue(shown()[i]).onChange((hex) => {
            if (refreshing) return;
            if (s.palette.preset === 'theme') s.palette.colours = themeFills();   /* start from what you were seeing */
            s.palette.colours[i] = String(hex).toLowerCase();
            s.palette.preset = 'custom';
            presetDrop.setValue('custom');
            apply('look');
          });
        });
    });

    let inkPicker = null;
    const autoInk = () => (lightTheme() ? '#2a2430' : '#0f0f12');
    new UiSetting(containerEl)
      .setName('pill text colour')
      .setDesc('the text on every pill. automatic = dark ink. try white with a dark palette.')
      .addColorPicker((c) => {
        inkPicker = c;
        c.setValue(HEX.test(s.inkColour) ? s.inkColour : autoInk()).onChange((hex) => {
          s.inkColour = String(hex).toLowerCase();
          apply('look');
        });
      })
      .addExtraButton((b) => b
        .setIcon('rotate-ccw')
        .setTooltip(ui('back to automatic'))
        .onClick(() => {
          s.inkColour = '';
          inkPicker.setValue(autoInk());
          apply('look');
        }));

    /* ── card and layout ── */
    new UiSetting(containerEl).setName('card and layout').setHeading();
    drop('card', 'width', 'card width', 'fit = as wide as the prompt (the same size as mish.eza). full = the whole sidebar.',
      { fit: 'fit the prompt', full: 'full width' }, 'look');
    drop('card', 'hAlign', 'horizontal position', 'only matters for the fit width.', { centre: 'centre', left: 'left' }, 'look');
    drop('card', 'vAlign', 'vertical position', 'centred when the card is shorter than the sidebar, or pinned to the top.',
      { centre: 'centre', top: 'top' }, 'look');
    drop('card', 'ring', 'border', "rainbow uses the palette. accent is obsidian's accent colour. subtle is your theme's border colour.",
      { rainbow: 'rainbow', accent: 'accent colour', subtle: 'subtle', none: 'none' }, 'look');
    slide('card', 'ringWidth', 'border thickness', '', 1, 4, 1, 'look', 'px');
    slide('card', 'angle', 'rainbow angle', 'direction of the border gradient. 135 runs top-left to bottom-right.', 0, 345, 15, 'look', '°');
    slide('card', 'radius', 'corner radius', '', 0, 28, 1, 'look', 'px');
    slide('card', 'pad', 'outer margin', 'space between the card and the edge of the sidebar.', 0, 32, 1, 'look', 'px');

    /* ── font ── */
    new UiSetting(containerEl).setName('appearance').setHeading();

    const choices = () => {
      const opts = {
        bundled: ui('cmu typewriter (bundled)'),
        obsidian: ui("obsidian's monospace font"),
        system: ui('system monospace'),
      };
      const names = new Set(CANDIDATE_FONTS.filter((n) => isInstalled(n)));
      this.scanned.forEach((n) => names.add(n));
      if (s.font.indexOf('family:') === 0) names.add(s.font.slice(7));
      Array.from(names)
        .sort((a, b) => a.localeCompare(b))
        .forEach((n) => { opts['family:' + n] = n; });
      opts.custom = ui('custom…');
      return opts;
    };

    let custom = null;

    new UiSetting(containerEl)
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

    custom = new UiSetting(containerEl)
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

    new UiSetting(containerEl)
      .setName('find monospace fonts')
      .setDesc("adds every monospace font installed on this computer to the menu above. obsidian may ask for permission first. if this version can't do it, the menu still lists the common fonts it finds.")
      .addButton((button) => button
        .setButtonText(ui('scan'))
        .onClick(async () => {
          button.setDisabled(true);
          try {
            const list = await scanSystemFonts();
            if (!list) {
              new Notice(ui("this version of obsidian can't list system fonts. use a custom font instead."));
            } else {
              this.scanned = list;
              this.fontDropdown.selectEl.empty();
              this.fontDropdown.addOptions(choices());
              this.fontDropdown.setValue(s.font);
              new Notice(ui('found ' + list.length + ' monospace fonts.'));
            }
          } catch (e) {
            new Notice(ui('could not read the font list. use a custom font instead.'));
          }
          button.setDisabled(false);
        }));

    /* ── reset ── */
    new UiSetting(containerEl).setName('reset').setHeading();
    new UiSetting(containerEl)
      .setName('reset appearance')
      .setDesc('puts every colour, shape and card option back to the default. your name, rows, font and prompt pills are not touched.')
      .addButton((button) => button
        .setButtonText(ui('reset'))
        .setWarning()
        .onClick(async () => {
          for (const k of ['palette', 'inkColour', 'pillShape', 'vaultLabel', 'card']) {
            s[k] = clone(DEFAULT_SETTINGS[k]);
          }
          await plugin.saveSettings();
          plugin.restyle();
          this.display();
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
    paintRainbow(this.settings);
    this.addSettingTab(new FetchSettingTab(this.app, this));

    /* theme changes: the ribbon and tab icons, and the darker light-mode text colours,
       are repainted. css-change fires when obsidian applies a theme; a second pass a
       moment later covers themes whose css lands just after. the body watcher catches
       the light <-> dark flip itself, e.g. when the operating system changes it. */
    const repaint = () => this.restyle();
    this.registerEvent(this.app.workspace.on('css-change', () => {
      repaint();
      window.setTimeout(repaint, 250);
    }));
    let wasLight = lightTheme();
    const watcher = new MutationObserver(() => {
      if (lightTheme() === wasLight) return;
      wasLight = lightTheme();
      repaint();
    });
    watcher.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    this.register(() => watcher.disconnect());

    this.registerView(VIEW_TYPE, (leaf) => new FetchView(leaf, this));

    /* the class lets styles.css find our ribbon icon and give it the gradient */
    const ribbon = this.addRibbonIcon('cpu', 'Open fetch', () => this.activate());
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
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveData(this.settings);       /* a change made a moment ago is not lost */
    }
    unmountRainbow();
  }

  async loadSettings() {
    const saved = (await this.loadData()) || {};
    this.settings = sanitise(deepMerge(clone(DEFAULT_SETTINGS), saved));
    uiCase.lower = this.settings.lowercaseUi;
  }

  async saveSettings() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    await this.saveData(this.settings);
    this.refreshViews();
  }

  /* slider drags and colour picks: save a moment after the last change */
  persist() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = 0;
      this.saveData(this.settings);
    }, 500);
  }

  /* styles only (colours, sizes, shape): cheaper than refreshViews, no prompt redraw */
  restyle() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof FetchView) leaf.view.applyLook();
    });
    paintRainbow(this.settings);
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
    paintRainbow(this.settings);
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
