# LET IT DIE M2G Knife-Only Mode

[English](README.md) | [한국어](README.ko.md)

A player M2G knife-only firing mode, separate from the save multitool’s DB knife damage compensation.

## Requirements

- Steam offline edition of LET IT DIE on Windows.
- Node.js 22 or newer. No npm install is needed for normal use.
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
