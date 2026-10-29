# PF1 Hero Points

A Foundry VTT v13 module for the Pathfinder 1e system (pf1 v11.11+) that lets players spend
[Hero Points](https://www.d20pfsrd.com/gamemastering/other-rules/hero-points/) (Advanced Player's Guide)
on their rolls, drawing from a **Hero Points** feature item on their character sheet.

## Setting up the Hero Points item

Give each character a feature item (a feat or class feature) named **Hero Points** with
**Limited Uses**:

- **Per:** *Charges*. Don't use *Per Day*, because resting would refill it.
- **Max:** `3` (APG cap), or `5` with **Hero's Fortune**.
- **Value:** the points the character currently has.

The GM awards points by raising the value, including the extra point per level from
**Blood of Heroes**. The item name can be changed under *Module Settings → Hero Points item name*.

## Spending points

**Right-click a d20 roll in chat** (skill, save, ability, CL, concentration, attack, crit
confirmation, or a plain `/r 1d20+x`):

| Menu entry | Rule | Who can use it |
|---|---|---|
| **Hero Point: Reroll** | Reroll the d20. You must take the new result. | Owner of the roll's character |
| **Hero Point: +4 Bonus** | +4 luck bonus after the roll | Owner of the roll's character |
| **Hero Point: Aid (+2)** | +2 luck bonus to someone else's roll, after the roll | Anyone whose controlled token or assigned character has a point |

On an attack card, the entry acts on the attack (or crit confirmation) you right-clicked. If it
can't tell which one you meant, it asks. The original message is left alone. The result is posted
as a new message that shows the use, the old total, and a link back to the original (pf1's
*Focus Reference* menu entry). Roll visibility is kept, so a blind roll stays blind. A rerolled
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
  spent. The roll is shown on the result. It doesn't apply to after-the-roll bonuses or aiding.
- **Fate's Favored** (trait): the roller's Hero Point luck bonus is +1 (+5, +9, or +3 when aided).
- **Hero's Fortune / Blood of Heroes:** set the item's max and the points you award (see above).

Feats are recognised by item name. A feat switched off on the sheet is ignored.

## Not covered

- Act Out of Turn, Extra Action, Inspiration, Recall, Special, and Cheat Death. These don't
  modify a roll, so the item tracks them and you spend the points by hand.
- The +4 "aid before the roll" use.
- Luck bonuses don't stack in PF1, but the module doesn't check whether a roll already had one.
- Initiative rolls: a reroll posts a new message but doesn't update the combat tracker.

## API

`game.modules.get("pf1e-hero-points").api` exposes `heroPoints(actor)`, `heroPointItem(actor)`,
`spend(actor, n)`, `isArmed(actor)`, `setArmed(actor, bool)`, `rollTargets(message)` and
`useOnMessage(message, "reroll" | "bonus" | "aid", { target, helper, skipConfirm })`.

## Development

```sh
npm install
npm test          # vitest
npm run typecheck
npm run build     # dist/ is the module root
```

Tag `vX.Y.Z` (matching `package.json` and `static/module.json`) to publish a GitHub release.
