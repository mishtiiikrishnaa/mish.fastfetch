# releasing mish.fastfetch

this file is for you, the maintainer. it is not shown to plugin users.

obsidian plugins are not npm packages. the "package" is **three files attached to a github release**: `main.js`, `manifest.json` and `styles.css`. nothing else is uploaded to anywhere.

## before every release

1. **bump the version** in `manifest.json`, and add the same version to `versions.json` (`"1.0.1": "1.5.0"`, the minimum obsidian version it needs).
2. run `bash scripts/check.sh`. it must end with "all good."
3. do the manual tests below, in a **scratch vault** (never your real ones).
4. commit, push, and tag.

## the tests

### from a clean install (the one that matters most)

- [ ] make a brand-new empty vault. copy only `main.js`, `manifest.json`, `styles.css` into `.obsidian/plugins/mish-fastfetch/`. enable the plugin. it works with nothing else around.
- [ ] open developer tools (cmd + option + i): the console shows **no errors** while you use the plugin.
- [ ] the network tab stays **empty** while you use the plugin (this is the "no network" claim in the readme).
- [ ] disable then enable the plugin; then reload obsidian: no duplicated panels, nothing stuck.
- [ ] delete `data.json` from the plugin folder and reload: it starts with defaults.
- [ ] turn the plugin **off**, then uninstall it: the native file explorer is back and nothing is left hidden.

### the vault shapes

- [ ] an empty vault.
- [ ] a vault with about 5,000 notes (make them with a loop in the terminal): opening, folding, and typing stay smooth.
- [ ] folders and files with spaces, emoji, accents, tamil or hindi script, a leading dot, and very long names.
- [ ] deeply nested folders (10 levels).
- [ ] a vault path with spaces and unicode in it.

### looks

- [ ] obsidian's default theme, light and dark.
- [ ] one popular community theme, light and dark.
- [ ] your own pink theme/snippet on top.
- [ ] a machine or user account **without** cmu fonts installed: the panel still looks right (the font is embedded).
- [ ] font menu: bundled, obsidian monospace, system monospace, a custom css list, and **scan** (try pressing "deny" on the permission prompt: nothing breaks).
- [ ] resize the sidebar very narrow and very wide.

### mish-fastfetch specific

- [ ] **the counts are true.** compare `notes`, `folders`, `files` and `size` with the terminal: `find . -name "*.md" | wc -l` etc. (remember the root and the `.obsidian` folder rules you chose).
- [ ] counts update by themselves: create, delete, rename and move a note; add an image; add a link.
- [ ] `links` counts both `[[links]]` and embeds; an empty vault shows zeros, not `NaN`.
- [ ] uptime ticks and resets after an obsidian restart; the time pill tooltip shows the full date.
- [ ] the `date` line prints in the format the readme promises.
- [ ] settings: set a user name and host name; hide the vault path; hide each row; hide the swatches and the date line; hide each pill. everything applies live.
- [ ] leave the user name empty: the system's is used.
- [ ] the os row and logo are right on macOS (and on windows/linux if you can borrow one).
- [ ] the `? info` button opens, explains every row, and closes.
- [ ] a vault path with spaces and unicode.
- [ ] **privacy before you screenshot**: with "hide full path" on, no home folder or real name appears anywhere in the panel.
- [ ] opens in the left sidebar on first run **without stealing focus**; re-running the command does not duplicate the view.


### the repository

- [ ] fresh clone into a temp folder (`git clone ... /tmp/x`), run `bash scripts/check.sh` there.
- [ ] the readme renders on github: every link works, no broken images.
- [ ] `LICENSE`, `THIRD-PARTY-NOTICES.md` and `licenses/` are all present.
- [ ] the minimum version: either install obsidian 1.5.x and test on it, or raise `minAppVersion` to the oldest version you actually tested. a promise you haven't tested is a fib.

## cutting the release

```sh
git add -A && git commit -m "release 1.0.0"
git push
git tag 1.0.0          # exactly the manifest version, no "v"
git push origin 1.0.0
```

github actions makes a **draft** release with the three files. open it on github, read the notes, and press **publish release**.

## after publishing

- [ ] in another scratch vault install with **brat** (`mishtiiikrishnaa/mish.fastfetch`) and check it works from the real release.
- [ ] download the three assets from the release page and diff them against your repo files: they must be identical.
- [ ] optional, later: submit to the community plugin list (see below).

## community plugins (optional, slow)

1. fork https://github.com/obsidianmd/obsidian-releases.
2. add this to the end of `community-plugins.json`, and open a pull request:

```json
{
  "id": "mish-fastfetch",
  "name": "mish.fastfetch",
  "author": "mishti",
  "description": "Show a starship-style prompt and a fastfetch-style summary of your vault in the sidebar, with live counts and uptime.",
  "repo": "mishtiiikrishnaa/mish.fastfetch"
}
```

3. the `id`, `name`, `author` and `description` must match `manifest.json` exactly.
4. a bot checks the entry, then a human reviews the code. the queue is long. read obsidian's plugin guidelines first: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
