# LanternsCore Community Test Plan (RimWorld 1.6)

This checklist is for testers helping find bugs, errors, and rough edges in LanternsCore (the framework) and the Hero Gear Builder (the offline mod generator).

If you only have time for a little testing, do:
- Section A (install/startup)
- Section B (gear equip + charge)
- Section C (one or two abilities)
- Section D (costume transform)
- Section H (report)

## A) Install and startup

1) Start RimWorld 1.6.
2) Enable:
   - Harmony
   - Lantern Core Framework (LanternsCore)
3) Restart the game when prompted.
4) From the main menu, open the log and confirm:
   - No red errors on startup.
   - No missing texture spam from LanternsCore itself.
5) Open Mod Settings for LanternsCore and confirm:
   - Sliders and toggles work.
   - No errors appear when opening/closing settings.

What to watch for:
- Red errors (exceptions)
- Repeating warnings every tick
- UI elements that do nothing or flicker

## B) Basic gear behavior (dev mode recommended)

Enable Dev Mode in RimWorld options so you can spawn items.

1) Spawn any LanternsCore-based gear (ring/belt/suit) from a test add-on OR use the Hero Gear Builder export (Section G).
2) Equip the gear on a pawn.
3) Confirm:
   - The charge gizmo shows up (if enabled in settings).
   - The resource label and bar color look correct.
   - The pawn gains the configured abilities.
4) Unequip the gear.
5) Confirm:
   - Abilities are removed.
   - Any passive hediffs (if used) are removed.

Edge cases:
- Equip/unequip repeatedly.
- Swap between two different LanternsCore gear items.
- Save and reload with the gear equipped.

## C) Abilities (core functionality)

For each ability you test, confirm:
- Casting works and targets are valid.
- Charge cost is consumed correctly.
- "Not enough charge" prevents casting (no charge goes negative).

Suggested minimum coverage:
- Blast (simple target)
- Heal (self + ally + location AOE if used)
- Barrier (self and ally; AOE if used)
- Stun/Bind (hostile and non-hostile if allowed)
- Teleport (roofed and occupied toggles)
- Displace (push and pull, LOS on/off)

### New ability controls to test (if the add-on uses them)

1) Cast limits:
   - Extra cooldown ticks blocks rapid recasting.
   - Max casts per day blocks after N casts.
   - Save/reload does not reset cooldown improperly.
2) Target rules:
   - "Hostiles only" blocks allies/neutrals.
   - "Allies only" blocks hostiles.
   - "Self only" blocks other targets.

## D) Costume / transformation

If the gear has `transformationApparel` configured:

1) Equip the gear and confirm the costume pieces equip.
2) Unequip the gear and confirm:
   - Costume pieces are removed.
   - The pawn's original apparel is restored (as much as possible).

### New transformation controls to test

1) Draft-only:
   - When undrafted: no costume (or it reverts).
   - When drafted: costume applies.
   - Toggle drafted/undrafted multiple times.
2) Skip-conflicts:
   - If a costume piece would force stripping another item, it should skip that piece (not strip).

Edge cases:
- Pawn is downed.
- Pawn dies while transformed (loot/strip).
- Save/reload while transformed.

## E) Charge model and settings

If the add-on uses charge regen/drain:

1) Let time pass and confirm passive drain/regen changes charge.
2) If using mood/pain/sunlight/psyfocus/allies sources:
   - Change the condition and confirm regen starts/stops.
3) Change LanternsCore settings:
   - Cost multiplier
   - Regen multiplier
   - Drain multiplier
4) Confirm multipliers apply immediately (or after a short delay) and do not break saves.

## F) Protection features (if enabled by the gear)

If the gear uses environmental hediff blocking or damage absorption:

1) Trigger a relevant hediff/damage type (dev tools or natural gameplay).
2) Confirm the gear blocks/absorbs it only when configured.
3) Confirm charge cost is applied when a block/absorb happens.
4) Toggle the global "disable protection" settings and confirm:
   - The gear stops blocking/absorbing when globally disabled.

## G) Hero Gear Builder (offline HTML app)

File: `LanternsCore_ModBuilder/index.html`

1) Open in Edge or Chrome.
2) Optional import:
   - Import RimWorld `Data` folder.
   - Import your `Mods` folder (or a single mod folder).
   - Confirm counts appear and autocomplete works.
3) Create a mod:
   - Choose a gear template (ring/belt/suit/mask).
   - Add at least 1 ability with an iconPath.
   - Optional: add costume and a stat buff.
4) Export ZIP, unzip to RimWorld `Mods`, enable it, restart.
5) Confirm the generated mod loads without errors.

What to watch for:
- Builder UI errors (buttons not working, lists not updating).
- Exported XML missing fields or having invalid defNames.
- The texture checklist is wrong (missing required paths or listing nonsense paths).

## H) What to send in your final report

Please send ONE message/report that includes:

1) Summary
   - What you tested (which sections above)
   - What worked
   - What failed

2) Your environment
   - RimWorld version (1.6.x)
   - DLCs enabled (Royalty/Ideology/Biotech/Anomaly)
   - OS (Windows version)
   - Full mod list and load order (screenshot or text)

3) For each bug / issue (copy this block per issue)
   - Title:
   - Severity: Crash / Red error / Gameplay break / Balance / UI / Minor
   - Steps to reproduce (numbered):
   - Expected result:
   - Actual result:
   - Frequency: Always / Often / Sometimes / Once
   - Does it happen after reload? Yes/No
   - Screenshots/video (if any):

4) Attachments (if possible)
   - `Player.log` (Windows path):
     `%USERPROFILE%\\AppData\\LocalLow\\Ludeon Studios\\RimWorld by Ludeon Studios\\Player.log`
   - A save file that reproduces the issue (best).
   - If the issue is from the Builder: the exported ZIP or at least the generated XML file.

