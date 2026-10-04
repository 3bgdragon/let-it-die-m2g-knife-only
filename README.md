# LET IT DIE M2G Knife-Only Mode

TFC edition: [separate download](https://github.com/3bgdragon/let-it-die-m2g-knife-only/releases/tag/tfc-v1.2.0-rc.1). The repository's `tfc/` is isolated; it is NOT included in the standalone ZIP. Do not mix installation modes.

Compatibility candidate **1.5.2-rc.1**: [rules and test evidence](COMPATIBILITY-VALIDATION.md).

Compatibility candidate, 2026-10-04; reviewed Steam build 25386710. Actual Nico DB Mod Manager 0.10.1 and TFC Installer 2.5.6.0 engines were tested separately from S3er0i9ng Mod Manager 1.3.20. File-copy tests passed; this update has NOT been retested through the GUI or in live gameplay. Unknown/conflicting layouts remain blocked. External managers can still overwrite files from cached originals; detected preset loss requires selected-feature reinstallation, not an old whole-file restore.

## Experimental UPK editor-compatible layout

After applying your chosen mods, run `upk-compat.bat` (Node.js 22.13+).
For English: `upk-compat.bat --lang=en`. You can also pass the installation
folder or `BrgGame-Steam.exe` path in quotes. Confirm only with the game closed.

This optional conversion packs existing LZO chunks contiguously and updates
only their EXE digest links. It does not change compressed payloads, game logic,
save data or database contents. Before conversion it creates a full shared backup
under `GAME/LID-Mod-State`; keep this folder. Use versions of **all four tools**
containing this feature. Subsequent managed edits preserve the contiguous layout.

For exact pre-conversion restoration use `upk-compat.bat --restore`.
Restoration refuses later changes. Unknown edits made by an external UPK editor
are deliberately blocked, not silently discarded. Reading/exporting a package
does not imply support for arbitrary external writes or Nico's vanilla replacement.
Actual Nico/TFC engine read/apply and recovery tests passed on disposable copies.
GUI and gameplay retesting remain pending; this is a compatibility prerelease.
Nico file-check OFF is preserved. Recorded guard/M2G preset loss can be repaired
with `upk-compat.bat "<game folder>" --reapply=guard` or `--reapply=m2g`.
Unknown edits still stop. Do not use old whole-UPK backups to repair one feature.



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

## Shared composition preview — 1.5.1-dev

Update all four tools together. The bundled Node.js composition kernel separates
verified vending in temporary copies, changes M2G, and recomposes vending while
preserving warp/JG. Keep the visible `LID-Mod-State` in the game folder. Register
old vending installs using option 8 in the new vending tool. `remove` removes M2G
only; shared full restore refuses later changes. Unknown changes remain blocked.
Composition targets build 25386710 and needs gameplay verification; legacy support remains.
Use Node.js 22.13 or newer with shared vending management (SQLite migration needs it).

[English](README.md) | [한국어](README.ko.md)

A player M2G knife-only firing mode, separate from the save multitool’s DB knife damage compensation.

## Requirements

- Steam offline edition of LET IT DIE on Windows.
- Node.js 22.13 or newer. No npm install is needed for normal use.
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
