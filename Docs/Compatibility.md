# Compatibility / API Stability

LanternsCore is meant to be a dependency/framework. This document describes what other mods can safely depend on.

## Stable surfaces (intended to stay compatible)

- XML `DefModExtension`: `DrAke.LanternsFramework.LanternDefExtension`
- XML ring comp: `DrAke.LanternsFramework.CompProperties_LanternRing`
- XML selection def: `DrAke.LanternsFramework.RingSelectionDef`
- XML selection conditions in `Source/Framework/RingSelectionDef.cs`
- Generic ability comps in `DrAke.LanternsFramework.Abilities`:
  - `CompProperties_LanternCost` (+ legacy `CompProperties_RingCost`)
  - `CompProperties_LanternHeal`
  - `CompProperties_LanternStun`
  - `CompProperties_LanternShieldAbility`
  - `CompProperties_LanternConstructSpawn`
  - `CompProperties_LanternSummon`
  - `CompProperties_LanternBuffAura`
  - `CompProperties_LanternChargeRequirement`
  - `CompProperties_LanternApplyHediff`
  - `CompProperties_LanternRemoveHediff`
  - `CompProperties_LanternStartMentalState`
  - `CompProperties_LanternEndMentalState`
  - `CompProperties_LanternTeleport`
  - `CompProperties_LanternDisplace`
- Hediff comps in `DrAke.LanternsFramework.Abilities`:
  - `HediffCompProperties_LanternShield`
  - `HediffCompProperties_LanternAuraVfx`
  - `HediffCompProperties_LanternChargeDrain`

## Deprecation policy (practical)

- Fields/classes may be **added** freely.
- Existing XML class names and field names should not be removed.
- If something must be replaced, it will be kept as a legacy alias for at least one major RimWorld version cycle and documented in `Docs/HowTo_CreateLanterns.md`.

