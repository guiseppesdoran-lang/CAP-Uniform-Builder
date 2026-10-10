# Fonts

Self-hosted so the page loads nothing from other origins (see `scripts/csp.cjs`).

| File | Family | Designer | License |
|---|---|---|---|
| `Rajdhani-Bold.woff2` | Rajdhani Bold | Indian Type Foundry | SIL Open Font License 1.1 (`OFL-Rajdhani.txt`) |
| `Ubuntu-Regular.woff2`, `Ubuntu-Italic.woff2`, `Ubuntu-Bold.woff2` | Ubuntu | Dalton Maag for Canonical | Ubuntu Font Licence 1.0 (`UFL-Ubuntu.txt`) |

Source: the Fonts.zip kit in the Civil Air Patrol Brand Guide (Typography page),
https://civilairpatrol.frontify.com. The license named above is the one recorded in each font file's
name table; the license texts here were taken from the upstream font projects.

The files are the kit's TrueType fonts, subset to Latin (Basic Latin, Latin-1, Latin Extended-A and
common punctuation and arrows) and converted to WOFF2 with fontTools (`pyftsubset --flavor=woff2`).
Both licenses allow this; the Ubuntu licence asks that modified versions are not sold under the
reserved name, and these are not sold.
