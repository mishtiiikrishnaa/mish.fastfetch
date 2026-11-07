# mish.fastfetch

a starship-style powerline prompt and a `fastfetch`-style summary of your vault, living in the [obsidian](https://obsidian.md) sidebar.

<!--
screenshot: drag a png into any github issue or pull request comment box (do not submit it), copy the
https://github.com/user-attachments/... link it makes, and paste it on the next line as ![the panel](that-link)
no image file needs to live in this repository.
-->

desktop only.

## what it runs on your computer

**no commands, and no network.**

- it does **not** run `fastfetch`, `date`, `node` or any other command. the `❯ fastfetch` and `❯ date` lines are just drawn text. no process is ever started, and there is no `child_process`, `exec` or `spawn` anywhere in `main.js`.
- it makes **no network requests** and has no telemetry. even the fonts are embedded in `styles.css`, so nothing is downloaded.
- it never modifies your notes.

what it does read, and how:

| what | how | why |
| --- | --- | --- |
| file list, sizes, links and embeds | obsidian's own vault and metadata cache | the counts and size rows |
| the vault's folder path | obsidian's file adapter | the vault row (can be hidden in settings) |
| your username and computer name | node's `os` module (`os.userInfo()` and `os.hostname()`) | the first pill and the user row (both can be overridden in settings) |
| your operating system | obsidian's `Platform` flags | the os row and the logo in the first pill |
| the clock | the browser's `Date` | the date line, the time pill and uptime |
| names of installed fonts | the browser's Local Font Access API, **only when you press Scan** | to list your monospace fonts in the font menu. the names stay in memory and are not saved or sent anywhere |

the only thing it writes is its own settings file, `data.json`, inside its plugin folder.

you can check the "no commands, no network" claim yourself. this finds nothing:

```sh
grep -nE "child_process|exec\(|spawn|fetch\(|XMLHttpRequest|requestUrl|WebSocket" main.js
```

because it uses node's `os` module, the plugin is **desktop only**.

## what it shows

| row | meaning |
| --- | --- |
| prompt pills | your name, the vault, and the time obsidian was opened (hover the time pill for the full date and how long it has been running) |
| user | your username and computer name |
| os | macOS, windows or linux |
| vault | where the vault lives on disk |
| notes | markdown notes |
| links | `[[links]]` and embeds across every note |
| folders | folders in the vault (the root isn't counted) |
| files | every file: notes, images, pdfs, everything |
| size | total size of all those files |
| uptime | how long obsidian has been open |
| date | the current time, printed the way `date` would |

the counts update by themselves when the vault changes. the `? info` button at the bottom of the panel explains each row inside obsidian.

## install

**community plugins** (once it is listed): settings → community plugins → browse → search for `mish.fastfetch`.

**with [brat](https://github.com/TfTHacker/obsidian42-brat):** add the beta plugin `mishtiiikrishnaa/mish.fastfetch`.

**by hand:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/mishtiiikrishnaa/mish.fastfetch/releases/latest), put them in `<your vault>/.obsidian/plugins/mish-fastfetch/`, reload obsidian and enable the plugin.

## use

click the terminal icon in the ribbon, or run **Open fetch in sidebar** from the command palette. on first run the panel opens in the left sidebar without stealing focus.

## settings

everything has a sensible default, and nothing needs configuring.

- **identity:** a user name and host name of your own (leave them empty and your system's are used), and a switch to hide the full vault path, handy before a screenshot.
- **prompt:** show or hide the user pill, the vault pill and the time pill.
- **rows:** show or hide each fastfetch row, the colour swatches and the date line.
- **appearance:** pick the font (see below).

## fonts

**nothing needs installing.** the panel ships with its own copy of cmu typewriter text, embedded under the name "mish mono", plus the few icons it draws (the operating system logos, the clock and the prompt chevrons, embedded as "mish icons"). both live in `styles.css`, so it looks the same on every machine.

if you'd rather use another font, open the **font** menu in settings:

- **CMU Typewriter (bundled)** is the default.
- **Obsidian's monospace font** follows the monospace font you chose under settings → appearance.
- **System monospace** uses your operating system's default.
- **installed fonts:** the menu lists common monospace fonts it finds on your machine. press **Scan** to list every monospace font you have installed (obsidian may ask permission first; if your version can't, use a custom font).
- **Custom** accepts any css `font-family` list.

a theme or snippet can also restyle the panel with css variables, each of which has a default: `--vf-mono`, `--vf-fg`, `--vf-line`, `--vf-black`, `--vf-pink`, `--vf-pink-hi`, `--vf-peach`, `--vf-yellow`, `--vf-green`, `--vf-blue`, `--vf-lilac`, `--vf-cyan`, `--vf-dim`. a `--vf-mono` set by a theme is used whenever the font menu is left on its default.

## credits and licences

the embedded fonts are subsets of cmu typewriter text (SIL Open Font License 1.1) and of the nerd fonts symbols font (MIT and OFL 1.1; the icons come from Font Awesome, CC BY 4.0, and Octicons, MIT). full details are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), and the licence texts are in the [`licenses/`](licenses) folder.

## licence

the plugin's own code is [MIT](LICENSE), (c) 2026 mishti. the embedded fonts keep their own licences.
