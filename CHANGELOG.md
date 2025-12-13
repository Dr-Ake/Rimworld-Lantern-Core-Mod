# Changelog

## 1.0.0

- Added generic hero gear templates: `Lantern_GearBeltBase`, `Lantern_GearSuitBase`, `Lantern_GearMaskBase`, `Lantern_GearApparelBase`.
- Added `CompProperties_LanternGear` alias for add-ons that aren't "rings".
- Framework validation at startup (warns about bad defs).
- XML-driven charge model (`maxCharge`, regen/drain sources, capacity-safe saves).
- Opt-in per-ring protection (environmental hediff/damage) with global safety toggles.
- Global balance sliders (cost/regen/drain multipliers).
- New no-code ability building blocks: apply/remove hediff, start/end mental state, teleport, displace (push/pull), charge threshold gate, hediff-based channel drain.
- New ability comps: `CompProperties_LanternCastLimits` (cooldown/max per day) and `CompProperties_LanternTargetRules` (faction-based targeting).
- More ring selection conditions (need/thought/drafted/biome/precept).
- Optional ring inspector gizmo (toggle in settings).
- Transformation controls: `transformationOnlyWhenDrafted` and `transformationSkipConflictingApparel`.
- Costume body type override: `transformationOverrideBodyType`, `transformationOverrideBodyTypeOnlyIfMissing`, `transformationBodyTypeOverride`.
- Costume filters and missing-graphic handling: gender/body-type allow/deny lists and `transformationSkipIfMissingWornGraphic`.
- Added a transformation toggle gizmo: `transformationToggleGizmo` / `transformationToggleDefaultOn`.
- Added `hediffsWhileWorn` (stackable passive hediffs while worn).
- Builder updates: gear templates, stat buffs generator, target rules, cast limits, and better XML emission for passive features.
