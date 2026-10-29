# PF1 Hero Points

A Foundry VTT v13 module for the Pathfinder 1e system (pf1 v11.11+) that lets players spend
[Hero Points](https://www.d20pfsrd.com/gamemastering/other-rules/hero-points/) (Advanced Player's Guide)
on their rolls, drawing from a **Hero Points** feature item on their character sheet.

## Setting up the Hero Points item

As GM, **right-click a character in the Actors sidebar → Add Hero Points**. That gives them a
ready-made **Hero Points** feature: Limited Uses set to *Charges*, max `3`, starting at `1`, with
the APG uses in its description. Characters with **Hero's Fortune** get max `5` and start at `2`.
To set up the whole table at once, run this as a macro:

```js
game.modules.get("pf1e-hero-points").api.addHeroPoints(); // every player-owned character without one
```

Characters that already have a usable item are skipped. If one has a **Hero Points** item that
doesn't track uses, it's fixed in place rather than a second one being added.

To set the item up by hand instead, give it **Limited Uses** with **Per:** *Charges*. Don't use
*Per Day*, because resting would refill it. The GM awards points by raising the value, including
the extra point per level from **Blood of Heroes**. If a character takes **Hero's Fortune** after
the item exists, raise its max to 5 by hand. The item name can be changed under *Module Settings →
Hero Points item name*.

## Spending points

**Right-click a d20 roll in chat** (skill, save, ability, CL, concentration, attack, crit
confirmation, or a plain `/r 1d20+x`):

| Menu entry | Rule | Who can use it |
|---|---|---|
| **Hero Point: Reroll** | Reroll the d20 (other dice keep their results). You must take the new result. | Owner of the roll's character |
| **Hero Point: +4 Bonus** | +4 luck bonus after the roll | Owner of the roll's character |
| **Hero Point: Aid (+2)** | +2 luck bonus to someone else's roll, after the roll | Anyone whose controlled token or assigned character has a point |

On an attack card, the entry acts on the attack (or crit confirmation) you right-clicked. If it
can't tell which one you meant, it asks. The original message is left alone. The result is posted
as a new message that shows the use, the old total, and a link back to the original (pf1's
*Focus Reference* menu entry). It goes to the same people as the original, so a blind roll stays blind and a whisper stays a whisper. A rerolled
saving throw is still recorded on the spell card that called for it.

A reroll can turn an attack into a critical threat, or stop it being one. The result message says
which, and you roll the confirmation yourself.

**+8 before the roll:** pf1's roll windows get a **Hero Point** toggle, showing how many points are
left. It's in the check dialog (skills, saves, abilities, CL, concentration) and next to Power
Attack and the other options in the attack dialog. Tick it and roll:

- A check gets +8.
- On an attack, the action's first attack roll gets +8 (one d20 roll, per the APG).

The point comes off the Hero Points item only when the roll is made, so cancelling the dialog
costs nothing, and neither does picking Take 10/20. The toggle only appears for characters who
have a point. It's greyed out if they've already spent one this round.

For rolls that skip the dialog (shift-click, or pf1's *Skip roll dialogs* setting), click the
**★ on the Hero Points item row** in the Features tab to arm the character instead. Their next d20
roll gets +8 and the star turns off. Arming is free, and clicking the star again disarms. When an
armed character opens a roll window, the toggle starts ticked. Leave it ticked to use the point on
that roll, or untick it to keep them armed for a later one. Either way, only one point is spent.

## Rules and feats handled

- **One Hero Point per combat round** (APG): enforced for characters in a started combat. This
  can be turned off in settings.
- **Luck of Heroes:** on a reroll or the +8 before the roll, a d20 is rolled and on 16+ the point isn't
  spent. The roll is shown on the result. It doesn't apply to after-the-roll bonuses or aiding. A
  kept point still counts as the round's Hero Point use.
- **Fate's Favored** (trait): the roller's Hero Point luck bonus is +1 (+5, +9, or +3 when aided).
- **Hero's Fortune / Blood of Heroes:** set the item's max and the points you award (see above).

Feats are recognised by their English item name, as pf1's compendiums name them. A feat switched
off on the sheet is ignored.

## Not covered

- Act Out of Turn, Extra Action, Inspiration, Recall, Special, and Cheat Death. These don't
  modify a roll, so the item tracks them and you spend the points by hand.
- The +4 "aid before the roll" use.
- Luck bonuses don't stack in PF1, but the module doesn't check whether a roll already had one.
- Initiative rolls: the +8 toggle and star don't apply (pf1 rolls initiative without a roll window
  or roll hook), and a reroll from chat posts a new message but doesn't update the combat tracker.
- With Dice So Nice, a +4 or Aid result may replay the unchanged d20.

## API

`game.modules.get("pf1e-hero-points").api` exposes `heroPoints(actor)`, `heroPointItem(actor)`,
`spend(actor, n)`, `addHeroPoints(actors?)`, `heroPointItemData(actor)`, `isArmed(actor)`, `setArmed(actor, bool)`, `rollTargets(message)` and
`useOnMessage(message, "reroll" | "bonus" | "aid", { target, helper, skipConfirm })`.

## Development

```sh
npm install
npm test          # vitest
npm run typecheck
npm run build     # dist/ is the module root
```

Tag `vX.Y.Z` (matching `package.json` and `static/module.json`) to publish a GitHub release.
