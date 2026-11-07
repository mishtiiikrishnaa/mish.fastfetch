# third-party notices

two small fonts are embedded (as base64 woff2) at the top of `styles.css`. both are subsets that contain only the characters the panel draws, and both are renamed so they can never replace a font you have installed.

## CMU Typewriter Text → embedded as "Mish Typewriter"

- licence: SIL Open Font License, Version 1.1 (full text: `licenses/OFL-CMU-Typewriter.txt`)
- copyright: (C) 2003-2009 Andrey V. Panov, with Reserved Font Family Name "Computer Modern Unicode fonts"; based on the Computer Modern fonts by Donald E. Knuth (and the other authors named in the licence file)
- changes made: cut down to basic Latin, Latin-1 and a few punctuation and arrow characters; layout features and hinting removed; converted to woff2; the font family was renamed to "Mish Typewriter" so that the Reserved Font Name is not used
- obtained from the `computer-modern` npm package, which repackages the CMU fonts

## Nerd Fonts "Symbols Nerd Font Mono" → embedded as "Mish Symbols"

- licence: MIT, (c) 2014 Ryan L McIntyre (full text: `licenses/NERD-FONTS-MIT.txt`)
- the glyphs kept are `fa-apple`, `fa-windows` and `fa-linux` (Font Awesome), `oct-clock` (Octicons) and the heavy chevron U+276F. the licences of the individual icon sets are listed in the Nerd Fonts repository: https://github.com/ryanoasis/nerd-fonts
- changes made: cut down to those five characters, renamed to "Mish Symbols", converted to woff2
- the operating system logos remain trademarks of their respective owners, and are used here only to indicate which system you are on
