# LET IT DIE M2G Knife-Only Mode


## EXE validation and manual installation paths

The tool does not require an unchanged whole-file EXE hash for guard/M2G
package relinking: the old package hash entries must match the current UPK,
and only the owned links are rewritten. Package validation and full-backup
restore safeguards remain enabled.

The bundled vending native builder also supports a reviewed build-25386710
fallback using PE layout and native dependency bytes instead of a whole-file
EXE hash. Unrelated edits in that layout survive; hook/dependency conflicts,
changed sections, overlays and unknown structures are still rejected.

If discovery fails, interactive mode accepts the installation folder or
BrgGame-Steam.exe path, retries invalid paths, and lets Enter cancel.
Non-interactive CLI use requires a valid --game path. This is not a blanket
no-validation mode or a guarantee of compatibility with every EXE mod.

## Shared composition preview — 1.5.0-dev

Update all four tools together. The bundled Node.js composition kernel separates
verified vending in temporary copies, changes M2G, and recomposes vending while
preserving warp/JG. Keep the visible `LID-Mod-State` in the game folder. Register
old vending installs using option 8 in the new vending tool. `remove` removes M2G
only; shared full restore refuses later changes. Unknown changes remain blocked.
Composition targets build 25386710 and needs gameplay verification; legacy support remains.
Use Node.js 22.5 or newer with shared vending management (SQLite migration needs it).

[English](README.md) | [한국어](README.ko.md)

A player M2G knife-only firing mode, separate from the save multitool’s DB knife damage compensation.

## Requirements

- Steam offline edition of LET IT DIE on Windows.
- Node.js 22.5 or newer. No npm install is needed for normal use.
- Support is determined by file/schema checks, not just the displayed game version. Never bypass an unsupported-file error.

## Installation

1. Use **Code → Download ZIP**, then extract the archive.
2. Back up your save separately and close the game completely.
3. Run `run-en.bat` for English, or use `run.bat --lang ko` for Korean. If Windows denies Steam-folder write access, run the launcher as administrator.
4. Read confirmations carefully and keep every backup created by the tool.

English: `run.bat --lang en` or `node tool.js --lang en`.
Korean: `run.bat --lang ko`.
Without an explicit language, the tool reads `let-it-die-tool-settings.json` in its parent folder (if present), then defaults to Korean. An explicit language does not change patch settings or write a preference file.

## Important behavior

Changes game package code and executable hash links. Use selective removal where offered. Full-backup restoration is refused when another tool or game update has changed the files.

## Backups and compatibility

Do not delete an older tool folder until its backups have been preserved. Backups are local files, not stored on GitHub. Restoring game files does not undo purchased items, spent currency or subsequent save changes. Compatibility with every other mod or installation order is not guaranteed.

## Translation status

The CLI menus, confirmations and tool-generated runtime errors support English and Korean. File paths, hashes and command names are never translated. System errors use the language supplied by Windows or Node.js. This mod does not add an in-game menu or translate the game itself. Full historical release notes remain in the [Korean guide](README.ko.md). Translation does not add support for new game builds.

For support, include tool version, game build, exact error and relevant logs. Avoid publishing your entire save or unnecessary account identifiers.
