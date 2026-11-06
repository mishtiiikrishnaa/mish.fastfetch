'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   mish.fastfetch
   a starship prompt + fastfetch card, as its own sidebar view.
   same approach as sidebar-widgets: register an ItemView and let obsidian
   place it, instead of injecting into the file explorer's DOM.
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

const human = (bytes) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' gb';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' mb';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' kb';
  return bytes + ' b';
};

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

    const card = el('div', 'vf');
    root.appendChild(card);
    this.paint(card);

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

  paint(card) {
    const refs = this.refs;

    /* prompt bar */
    const bar = el('div', 'vf-bar');
    const pill = (cls, text) => el('span', 'vf-pill ' + cls, text);

    bar.appendChild(pill('vf-os', '\uF179'));
    bar.appendChild(pill('vf-user', 'mishti'));
    bar.appendChild(pill('vf-path', '~/' + this.app.vault.getName()));
    ['vf-deco-1', 'vf-deco-2', 'vf-deco-3']
      .forEach((c) => bar.appendChild(el('span', 'vf-pill-deco ' + c)));

    refs.clock = pill('vf-clock', '');
    bar.appendChild(refs.clock);
    bar.appendChild(el('span', 'vf-cmd', '❯ eza --tree --all'));
    bar.appendChild(el('span', 'vf-cursor'));
    card.appendChild(bar);

    /* fastfetch rows */
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
    refs.notes = row('notes', 'g');
    refs.links = row('links', 'b');
    refs.folders = row('folders', 'c');
    refs.files = row('files', 'p');
    refs.size = row('size', 'd');
    refs.date = row('date', '');
    refs.time = row('time', 'b');
    card.appendChild(rows);

    /* palette swatches, because fastfetch has them */
    const swatches = el('div', 'vf-swatches');
    for (let i = 0; i < 8; i++) swatches.appendChild(el('span'));
    card.appendChild(swatches);
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

    refs.vault.textContent = app.vault.getName();
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
    refs.clock.textContent = '\uF43A ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    refs.date.textContent = DAYS[d.getDay()] + ' ' + pad(d.getDate()) + ' ' +
                            MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    refs.time.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());

    /* periodic recount, so the numbers can't drift */
    if (++this.ticks % 15 === 0) this.refresh();
  }
}

module.exports = class TerminalVaultFetch extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new FetchView(leaf, this));

    this.addRibbonIcon('terminal', 'Open fetch', () => this.activate());
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
