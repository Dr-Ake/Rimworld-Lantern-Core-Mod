# LanternsCore (RimWorld 1.6)

LanternsCore is a framework mod for "hero gear" style content (rings, belts, suits, artifacts, etc.).
It provides shared code, defs, and a no-code builder so add-on mods can create gear, abilities, and
events without writing C#.

## What it does

### Core gear framework
- Adds a gear base with charge/resource handling (max charge, passive regen/drain, optional regen sources).
- Tracks charge use from abilities and optional background drains.
- Supports custom resource labels and UI gizmos.

### Built-in abilities
LanternsCore can generate AbilityDefs that inherit framework bases:
- Blast, Heal, Stun/Bind, Barrier (shield), Construct spawn, Summon, Aura,
  Flight, Teleport, Displace (push/pull), Conditional down/kill.

Each ability supports:
- DefName/label/icon setup.
- Cost (fraction of max charge).
- Optional cooldown, max casts per day, and targeting restrictions.

### Stealth / Veil
- Toggleable stealth mode that applies a Hediff.
- Separate energy pool (max, start percent, drain, regen).
- Optional anti-targeting and break-on-attack rules.
- "See-through" filters for PawnKindDef and HediffDef.

### Influence systems
- Influence (persistent Hediff) that grows while worn and can trigger mental states.
- Ambient influence: applies a Hediff while the gear is unworn (area influence).
- Wearer influence: applies a Hediff to pawns near the wearer (a local aura).

### Autonomy / temptation
- Biases pawn apparel AI so pawns are more likely to wear the gear.
- Optional trait/hediff score bonuses.

### Removal rules
- Refuse removal based on a Hediff severity threshold.
- Optional forced drop on wearer death, corpse destruction, or grave eject.

### Costume / outfit transformation
- Auto-equip specified apparel while the gear is worn and restore the previous outfit on removal.
- Supports both existing apparel defs and generated apparel defs.
- Optional filters (gender/body type), and body type override for missing graphics.

### Batteries / recharge
- Optional battery manifest system with configurable cost.
- Integrates with charge handling.

## Delivery and events

### Selection (auto-delivery)
- Generates a RingSelectionDef to automatically deliver gear to a pawn.
- Triggered on join/spawn/mental break.
- Filters by pawn type and optional scoring conditions.

### Discovery incidents
- World-site or active-map discovery events that spawn the gear.
- Configurable placement (pawn worn/inventory, ground, drop pod).
- Optional survivors, dead pawns, or mixed outcomes.
- Crash debris and pod behavior options.
- Letters (label/text keys, letterDef) and incident flags (min refire days, pointsScaleable).

### Timed incidents
- Optional timed incidents that fire after a configured delay window.
- Supports one-shot or repeating behavior with retry timing.

## Tools

### Hero Gear Builder (no-code)
Located at `LanternsCore_ModBuilder/index.html`.
- Build complete add-on mods without C#.
- Import defs for autocomplete.
- Validate configs before export.
- Export a ready-to-use mod ZIP (Defs, About, and assets).
- Import an existing mod back into the builder for editing.

### Documentation for add-on authors
- `Docs/HowTo_CreateLanterns.md` - complete no-C# guide + template.
- `Docs/AddonHooks.md` - optional advanced hooks.
- `Docs/Compatibility.md` - safe dependency guidance.
- `Docs/SmokeTest.md` - quick manual verification steps.
- `Docs/CommunityTestPlan.md` - checklist for playtesters/bug reports.
- `Docs/BugReportTemplate.md` - issue template.
- `LanternsCore_ModBuilder/Guide.md` - detailed builder reference.
- `CHANGELOG.md` - release notes.

## Example
See `Docs/Example_Addon_YellowLantern.xml` for a minimal example add-on.

## For players
LanternsCore is a framework dependency. It provides the systems above, while add-on mods supply
the actual gear, abilities, art, and in-game content.
