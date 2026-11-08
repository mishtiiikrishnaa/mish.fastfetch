<div align="center">

# mish.fastfetch

**A starship prompt and a fastfetch summary of your vault, living in your Obsidian sidebar.**

Live note counts. A ticking uptime. A pastel rainbow that follows your theme.

![Version](https://img.shields.io/github/v/release/mishtiiikrishnaa/mish-fastfetch?style=flat-square&color=ffa6c9&label=version)
![Downloads](https://img.shields.io/github/downloads/mishtiiikrishnaa/mish-fastfetch/total?style=flat-square&color=c9b0ff)
![License](https://img.shields.io/github/license/mishtiiikrishnaa/mish-fastfetch?style=flat-square&color=a6c9ff)
![Platform](https://img.shields.io/badge/desktop-only-c9ffa6?style=flat-square)

<!-- Add your screenshots to an `assets/` folder and these will show up. -->
<img src="assets/screenshot-dark.png" alt="mish.fastfetch in dark mode" width="45%"> <img src="assets/screenshot-light.png" alt="mish.fastfetch in light mode" width="45%">

</div>

---

## What it is

If you've ever run `fastfetch` in a terminal just to look at it, this is that, for your vault.

mish.fastfetch adds a small panel to your sidebar that looks like a terminal session: a powerline prompt on top, a `fastfetch` readout of your vault underneath, and a `date` line at the bottom. The numbers are real and they update as you work. Everything is drawn text. Nothing is ever executed.

```
 mishti   ~/my-vault   >>>   14:32
❯ fastfetch

user        mishti@macbook
os          macOS · obsidian
vault       /Users/mishti/Documents/my-vault
notes       1,284
links       5,310
folders     87
files       1,902
size        412 mb
uptime      2d 03h 14m 52s

████ ████ ████ ████ ████ ████ ████ ████

❯ date
sat 8 nov 14:32:07 ist 2026
❯ █                                  ? info
```

## Features

- **Starship-style prompt.** Three pills: your name (with a logo for your operating system), your vault, and the time Obsidian was opened. Hover the time pill for the exact date and how long Obsidian has been running.
- **Live vault stats.** Notes, links and embeds, folders, files and total size. Counts refresh when files are created, deleted or renamed, when Obsidian finishes resolving links, and every 15 seconds as a safety net.
- **Real uptime.** The time since this Obsidian window was opened, ticking every second.
- **A palette that follows your theme.** Light and dark mode both work, and the colours are darkened in light mode so text stays readable on a pale sidebar. If your theme defines its own `--vf-*` colours, they take over.
- **Icons that follow the theme too.** The ribbon icon and the sidebar tab icon use the same rainbow, and they repaint when you switch theme or flip between light and dark.
- **Eight palette presets,** or pick all six colours yourself.
- **Three pill shapes:** powerline arrows, rounded, or flat.
- **A card you can shape.** Width, position, border style and thickness, rainbow angle, corner radius and outer margin.
- **Looks the same everywhere.** The font (CMU Typewriter) and the icons are bundled inside the plugin. You don't need a Nerd Font installed.
- **Your choice of font** if you'd rather use a monospace font from your own machine.
- **A thin rainbow scrollbar** that looks the same whatever theme or snippet is styling scrollbars.
- **Screenshot-friendly.** One toggle hides your full vault path.

## Installation

### From the community plugin list

> Once the plugin has been approved. Until then, use BRAT or install it manually below.

1. Open **Settings → Community plugins** and turn off Restricted mode.
2. Click **Browse** and search for **mish.fastfetch**.
3. Click **Install**, then **Enable**.

### With BRAT (to try it before it's listed)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. Run the command **BRAT: Add a beta plugin for testing**.
3. Paste `mishtiiikrishnaa/mish-fastfetch` and confirm.
4. Enable **mish.fastfetch** under **Settings → Community plugins**.

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/mishtiiikrishnaa/mish-fastfetch/releases/latest).
2. Create a folder called `mish-fastfetch` inside `<your vault>/.obsidian/plugins/`.
3. Put the three files in it.
4. Restart Obsidian (or reload plugins), then enable **mish.fastfetch** under **Settings → Community plugins**.

> **Desktop only.** The plugin reads your username and computer name through Node's `os` module, which only exists in the desktop app. It requires Obsidian **1.15.0** or newer.

## Using it

The first time you enable the plugin, the panel appears in your **left sidebar** without stealing focus. After that Obsidian remembers where you put it, so you can drag it anywhere.

To open it again:

- Click the **chip icon** in the ribbon, or
- Open the command palette and run **Open fetch in sidebar**.

Click **? info** at the bottom right of the card to see a short explanation of every row. Click **× close** to hide it again.

## What each row means

| Row | What it shows |
| --- | --- |
| **user** | Who you are and on which machine, as `name@host`. |
| **operating system** | macOS, windows or linux, plus Obsidian. |
| **vault path** | Where this vault lives on your disk (or just its name, if you turn the full path off). |
| **notes** | Markdown notes, meaning `.md` files. |
| **links** | `[[links]]` and embeds, counted across every note. |
| **folders** | Folders in the vault. The vault root isn't counted. |
| **files** | Every file: notes, images, PDFs, everything. |
| **size** | The total size of all those files. |
| **uptime** | How long Obsidian has been open. |
| **date** | The current time, formatted the way the `date` command prints it. |

## Settings

Everything lives under **Settings → mish.fastfetch**. Colour, shape and layout changes apply to the open panel straight away.

### Identity

| Setting | What it does |
| --- | --- |
| **User name** | Overrides the name your system reports. Leave empty to auto-detect. |
| **Host name** | Overrides your computer's name in the `user@host` row. Leave empty to auto-detect. |
| **Show full vault path** | Turn off to show only the vault name. Handy before taking a screenshot. |

### Prompt

| Setting | What it does |
| --- | --- |
| **User pill / Vault pill / Time pill** | Show or hide each pill. |
| **Pill shape** | `arrow` (powerline), `round` or `flat`. Round and flat drop the arrow tips and the little `>>>` bridge, and use gaps instead. |
| **Vault pill text** | Custom text for the second pill. Empty means `~/` and the vault name. |

### Rows

A toggle for every row above, plus **colour swatches** (the strip of colour blocks) and the **date line**. If you turn every row off, the whole block disappears.

### Colours

The palette is six colours, always in the same order: pink, peach, yellow, green, blue, lilac. They colour the prompt pills, the row text, the card border, the scrollbar and the icons. Each of the six colour pickers tells you where its colour is used.

| Preset | Notes |
| --- | --- |
| **mish** *(default)* | The pastel sorbet rainbow this plugin ships. Follows your theme's colours if the theme sets them. |
| **catppuccin**, **dracula**, **nord**, **gruvbox** | Familiar editor palettes. |
| **ocean**, **sunset**, **forest** | Cool, warm and earthy rainbows. |
| **greyscale** | For a monochrome look. |
| **custom** | Appears as soon as you change any of the six pickers yourself. |

Pick a preset, then tweak any colour you like. You can also set the **pill text colour**: automatic uses dark ink, but white works well on a dark palette. In light mode, the text versions of your colours are darkened for you automatically.

### Card and layout

| Setting | Options |
| --- | --- |
| **Card width** | `fit` (as wide as the prompt) or `full` (the whole sidebar). |
| **Horizontal position** | `centre` or `left`. Only matters for the fit width. |
| **Vertical position** | `centre` or `top`. |
| **Border** | `rainbow`, `accent` (Obsidian's accent colour), `subtle` (your theme's border colour) or `none`. |
| **Border thickness** | 1 to 4 px. |
| **Rainbow angle** | 0° to 345°, in steps of 15°. 135° runs top-left to bottom-right. |
| **Corner radius** | 0 to 28 px. |
| **Outer margin** | 0 to 32 px of space between the card and the sidebar edge. |

### Appearance

- **Font:** the bundled CMU Typewriter (default), Obsidian's monospace font, your system's monospace font, any common monospace font found on your machine, or a **custom** CSS `font-family` list such as `"JetBrains Mono", monospace`.
- **Find monospace fonts:** click **scan** to add every monospace font installed on your computer to the menu. Obsidian may ask for permission first.

### Reset

**Reset appearance** puts every colour, shape and card option back to the default. Your name, rows, font and prompt pills are left alone.

## Themes

mish.fastfetch is designed to look right in any theme, in light or dark mode.

- It reads Obsidian's light/dark setting and switches its colours with it.
- The panel has no background of its own, so your sidebar colour shows through.
- The tooltip and the info card use your theme's own background and border colours.
- If your theme defines `--vf-*` colour variables (as the **mish.shell** theme does), the plugin uses them instead of its defaults. Choosing any palette other than **mish** in the settings overrides them.
- The ribbon and tab icons are repainted whenever the theme or light/dark mode changes.

## Privacy

- **No network access.** The plugin makes no requests and sends nothing anywhere.
- **Nothing is executed.** The prompt, the `fastfetch` output and the `date` line are drawn text, not shell commands.
- **What it reads:** file names, sizes and link counts from Obsidian's own index (never the contents of your notes), plus your username and computer name from your operating system, which stay on your machine.
- **What it stores:** your settings, in `data.json` inside the plugin's folder.

## FAQ

**Does it work on mobile?**
No. It needs Node's `os` module to find your username and computer name, so it's desktop only.

**The icons look wrong after I changed my theme.**
They repaint automatically. If one ever gets stuck, toggling the plugin off and on will reset it. Please open an issue with the theme's name so it can be fixed properly.

**Why does the uptime say "since Obsidian was opened"?**
It's the age of the current Obsidian window, not of your computer. Closing and reopening Obsidian starts it again from zero.

**The vault name is too long and the prompt is cut off.**
The bar shrinks to fit the sidebar, down to half size. Past that, the vault pill starts to truncate. You can also set your own **vault pill text**, or make the sidebar wider.

**Can I hide my username or vault path before sharing a screenshot?**
Yes. Set a different **user name** and **host name**, and turn off **Show full vault path**.

**Do I need a Nerd Font?**
No. The operating system logos, the clock and the prompt chevron are bundled in a tiny subset font inside the plugin.

## Development

There is no build step. The plugin is plain JavaScript, so `main.js`, `styles.css` and `manifest.json` are the plugin.

```bash
# clone straight into a test vault's plugin folder
git clone https://github.com/mishtiiikrishnaa/mish-fastfetch.git \
  "<your vault>/.obsidian/plugins/mish-fastfetch"
```

Edit `main.js` or `styles.css`, then reload the plugin (or use the Hot Reload plugin) to see your changes.

### Releasing

1. Bump `version` in `manifest.json`, and add the same version to `versions.json` with its minimum Obsidian version.
2. Commit, then tag with exactly the version number (no `v`): `git tag 1.0.1 && git push --tags`.
3. The workflow in `.github/workflows/release.yml` creates the GitHub release and attaches `main.js`, `manifest.json` and `styles.css`.

## Credits

- **Font:** [CMU Typewriter Text](https://www.cm-unicode.org/), from the Computer Modern fonts by Donald E. Knuth, Copyright © 2003–2009 Andrey V. Panov. Licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/). A subset is bundled and renamed `mish mono`.
- **Icons:** the operating system logos, clock and chevron come from the [Nerd Fonts](https://www.nerdfonts.com/) symbols font (glyphs from Font Awesome and Octicons), bundled as a subset called `mish icons`.
- Full licence texts are in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) and the `licenses/` folder.
- Inspired by [fastfetch](https://github.com/fastfetch-cli/fastfetch) and [starship](https://starship.rs/).
- Pairs nicely with **mish.eza** and the **mish.shell** theme, which share the same palette.

## Support

Found a bug or have an idea? [Open an issue](https://github.com/mishtiiikrishnaa/mish-fastfetch/issues). If you're reporting a visual problem, please include your theme, whether you're in light or dark mode, and a screenshot.

## License

[MIT](LICENSE) © mishti
