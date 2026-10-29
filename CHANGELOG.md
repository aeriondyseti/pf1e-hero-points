# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0]

### Added

- **Add Hero Points**: right-click a character in the Actors sidebar (GM) to give them a ready-made
  Hero Points feature (Charges, 1 of 3; 2 of 5 with Hero's Fortune). `api.addHeroPoints()` does
  every player-owned character at once. A same-named item that doesn't track uses is repaired in
  place.
- A console warning when pf1 markup the module hooks into can't be found.

### Changed

- Reroll rerolls only the d20; other dice in the formula keep their results.
- Results go to exactly the same audience as the original roll (whisper targets and blind kept).
- A Luck of Heroes save still counts as the round's Hero Point use.
- The before-roll spend, round record and disarm happen in one actor update instead of three.

### Fixed

- The Hero Point toggle in the check roll dialog appeared below the roll buttons.
- Arming the ★ while an attack dialog was open didn't tick its toggle.
- A before-roll point that was spent elsewhere in the meantime was reported as spent.
- Disabled Hero Points items were used.

## [0.1.0]

### Added

- Chat context menu entries on d20 rolls to spend a Hero Point: Reroll, +4 Bonus, and Aid (+2).
  Each posts a new linked message and leaves the original untouched.
- Works on attack cards, choosing the attack or crit confirmation under the cursor.
- A Hero Point toggle in pf1's check and attack roll dialogs that adds +8 before the roll
  (to the first attack roll of an action), plus a ★ on the Hero Points item's sheet row that
  arms the character's next roll, for rolls that skip the dialog.
- Integration with a "Hero Points" feature item that has Limited Uses (the name is configurable).
- APG one-point-per-combat-round limit (can be turned off).
- Luck of Heroes (d20 16+ keeps the point) and Fate's Favored (+1 luck) support.
