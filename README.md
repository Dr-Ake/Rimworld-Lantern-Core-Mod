# LanternsCore (RimWorld 1.6)

LanternsCore is a framework mod that powers "hero gear" such as rings, belts, suits, and artifacts. It supplies reusable comps, XML templates, incidents, and a no-code builder so add-on mods can ship complete gear packs without writing C#.

## Feature overview

### Gear and charge system
- Provides `CompLanternRing`/`CompLanternGear` for powered apparel, including configurable maximum charge, passive regen/drain, and multiple conditional regen sources (mood, pain, sunlight, psyfocus, nearby allies).【F:Source/Framework/LanternDefExtension.cs†L14-L77】
- Tracks charge consumption for ability casts and ambient drains, applying global player-tunable multipliers for cost/regen/drain.【F:Source/Framework/CompLanternRing.cs†L33-L93】【F:Source/LanternCoreSettings.cs†L9-L44】
- Optional battery manifest system with per-map/global limits and a recharge job that restores charge after a short oath chant (sound effect not yet implemented).【F:Source/Framework/LanternDefExtension.cs†L79-L94】【F:Source/Framework/Recharge/LanternRecharge.cs†L12-L93】【F:Source/Framework/Recharge/LanternRecharge.cs†L68-L88】
- Customizable resource labeling and gizmo colors for charge/stealth pools.【F:Source/Framework/LanternDefExtension.cs†L10-L28】【F:Source/Framework/LanternDefExtension.cs†L120-L131】

### Abilities and effects
- XML bases for blast, heal, stun/bind, barrier (shield), construct spawn, summon, aura, flight, teleport, displace (push/pull), conditional down/kill, and generic pawn-effect abilities, all wired to drain charge by default.【F:Defs/Framework/Lantern_Framework_BaseDefs.xml†L73-L164】【F:Defs/Framework/Lantern_Framework_BaseDefs.xml†L165-L260】
- Ability comps for charge costs, cast limits, target rules, healing, stun, teleport, displacement, summons/constructs, buff auras, mental states, conditional pawn outcomes, and charge requirements; includes VFX helpers for casts/impacts.【F:Source/Framework/Abilities/CompAbilityEffect_LanternCost.cs†L10-L63】【F:Source/Framework/Abilities/LanternVfx.cs†L8-L59】【F:Source/Framework/Abilities/CompAbilityEffect_LanternDisplace.cs†L10-L87】【F:Source/Framework/Abilities/CompAbilityEffect_LanternTeleport.cs†L10-L56】【F:Source/Framework/Abilities/CompAbilityEffect_LanternHeal.cs†L9-L51】【F:Source/Framework/Abilities/CompAbilityEffect_LanternConditionalPawnOutcome.cs†L8-L78】
- Shield ability comp toggles Hediff shields in an area or single target with optional VFX/SFX, usable as a barrier template.【F:Source/Framework/Abilities/LanternAbilityComponents.cs†L31-L139】
- Blast verb/verb properties support colored beam flecks and projectile handling; includes projectile class for beam travel and damage.【F:Source/Framework/Abilities/VerbProperties_LanternBlast.cs†L8-L67】【F:Source/Framework/Abilities/Projectile_LanternBlast.cs†L8-L52】

### Stealth / veil mechanics
- Toggleable stealth mode uses a separate energy pool, applies a Hediff, can prevent targeting, and optionally breaks on attack; energy drains while active and regenerates when idle.【F:Source/Framework/LanternDefExtension.cs†L104-L142】【F:Source/Framework/CompLanternRing.cs†L53-L73】【F:Source/Framework/CompLanternRing.cs†L202-L279】
- Supports see-through allowlists for pawn kinds and hediffs, UI gizmo toggles, and custom labels/icons for the stealth pool.【F:Source/Framework/LanternDefExtension.cs†L120-L139】

### Corruption and influence
- Optional corruption Hediff accrues while worn, feeds an "attention" value, and can trigger mental states at severity thresholds.【F:Source/Framework/LanternDefExtension.cs†L144-L167】【F:Source/Framework/CompLanternRing.cs†L265-L332】
- Ambient influence applies hediffs/mental breaks around unworn gear (optionally only when buried); wearer influence radiates effects and trait-modified severity while worn.【F:Source/Framework/LanternDefExtension.cs†L169-L211】【F:Source/Framework/CompLanternRing.cs†L333-L402】

### Autonomy and refusal
- Apparel optimization bias makes pawns more likely to equip the gear, with trait/hediff-based score offsets and optional drafted allowance.【F:Source/Framework/LanternDefExtension.cs†L213-L224】【F:Source/Framework/LanternHarmonyPatch.cs†L10-L74】
- Refuse-removal rules stop pawns from unequipping when a Hediff is above a threshold, with optional forced drops on death/corpse destruction/grave eject.【F:Source/Framework/LanternDefExtension.cs†L226-L235】【F:Source/Framework/CompLanternRing.cs†L151-L199】

### Transformation / costume system
- Wearing gear can auto-equip a set of transformation apparel, store conflicting items safely, and restore them on removal; supports filters by gender/body type and optional body-type overrides when graphics are missing.【F:Source/Framework/LanternDefExtension.cs†L96-L119】【F:Source/Framework/CompLanternRing.cs†L105-L196】
- Gizmo toggle and drafted-only modes allow manual or conditional costume activation; can skip items that lack graphics for the current body type.【F:Source/Framework/LanternDefExtension.cs†L108-L118】【F:Source/Framework/CompLanternRing.cs†L105-L175】

### Defensive utilities
- Environmental/corrosion handling: blocks hediffs and absorbs environmental or combat damage by spending charge, with optional allowlists and filters for lava/radiation/rotting gas, etc.【F:Source/Framework/LanternAbilityComponents.cs†L141-L228】【F:Source/Framework/CompLanternRing.cs†L424-L510】
- Reactive projectile evasion consumes charge to cancel projectiles and spawn configurable gas clouds, with cooldowns and toggle gizmo support.【F:Source/Framework/LanternDefExtension.cs†L39-L66】【F:Source/Framework/CompLanternRing.cs†L73-L104】

### Flight and teleportation
- World-tile flight ability uses custom jobs, skyfallers, and world objects to launch, travel, and land pawns; includes takeoff/landing effects.【F:Defs/Framework/Lantern_Framework_BaseDefs.xml†L183-L206】【F:Defs/Flight/Lantern_Flight_Defs.xml†L1-L44】
- Teleport/displace abilities move pawns within a map with optional pull/push distances and target validation.【F:Defs/Framework/Lantern_Framework_BaseDefs.xml†L207-L241】【F:Source/Framework/Abilities/CompAbilityEffect_LanternDisplace.cs†L10-L87】

### Delivery, selection, and events
- Ring selection system auto-delivers gear via delivery orb on pawn join/spawn/mental break or periodic checks, with scoring conditions and validation to avoid misconfiguration.【F:Source/Framework/RingSelectionManager.cs†L12-L118】【F:Source/Framework/RingSelectionDef.cs†L8-L122】【F:Source/Framework/LanternFrameworkValidator.cs†L21-L83】
- Discovery incidents generate sites or map events that place the gear on pawns, in inventory, on the ground, or via drop pods; supports survivors/dead pawns, crash debris, letters, and distance constraints.【F:Source/Framework/Incidents/IncidentWorker_LanternDiscovery.cs†L10-L158】【F:Source/Framework/LanternDiscoveryIncidentExtension.cs†L8-L142】
- Timed incidents allow delayed or repeating triggers for gear-related events after configurable day ranges, with retry intervals.【F:Source/Framework/LanternTimedIncidentExtension.cs†L8-L45】【F:Source/Framework/GameComponent_LanternTimedIncidents.cs†L10-L83】

### Influence tracking and debug tools
- Map/world components track ambient influence, discovery sites, delivery orbs, and timed incidents; debug helper logs aid validation and troubleshooting.【F:Source/Framework/MapComponent_LanternInfluence.cs†L8-L105】【F:Source/Framework/MapComponent_LanternDiscoverySite.cs†L8-L73】【F:Source/Framework/LanternDebug.cs†L8-L87】

### Templates and XML bases
- Base ThingDefs for rings, belts, suits, and masks with the framework comp pre-wired, plus delivery orb and job defs for recharge and flight.【F:Defs/Framework/Lantern_Framework_BaseDefs.xml†L1-L71】【F:Defs/Framework/Lantern_Framework_OrbDefs.xml†L1-L21】【F:Defs/Flight/Lantern_Flight_Defs.xml†L1-L23】
- Abstract AbilityDefs cover charge-draining blasts, buffs, teleport/displace, pawn-effect hooks, and more, ready for add-ons to inherit.【F:Defs/Framework/Lantern_Framework_BaseDefs.xml†L73-L241】

### Tools for add-on authors
- Hero Gear Builder (`LanternsCore_ModBuilder/index.html`) builds complete add-on mods without C#: import defs for autocomplete, validate configs, export ready-to-use ZIPs, and re-import existing mods for editing.【F:LanternsCore_ModBuilder/Guide.md†L1-L154】
- Documentation includes a full creation guide, advanced hooks, compatibility guidance, smoke tests, community playtest checklist, bug report template, and an example add-on XML.【F:Docs/HowTo_CreateLanterns.md†L1-L212】【F:Docs/AddonHooks.md†L1-L196】【F:Docs/Compatibility.md†L1-L92】【F:Docs/SmokeTest.md†L1-L66】【F:Docs/CommunityTestPlan.md†L1-L93】【F:Docs/BugReportTemplate.md†L1-L29】【F:Docs/Example_Addon_YellowLantern.xml†L1-L81】

### Known gaps / work in progress
- Recharge job sets rings to full charge but does not yet play a completion sound (noted TODO).【F:Source/Framework/Recharge/LanternRecharge.cs†L68-L88】
- Ability cost comp references a potential future settings hook for global cost tuning, currently relying on per-ability props instead.【F:Source/Framework/Abilities/LanternAbilityComponents.cs†L20-L47】

## For players
LanternsCore itself mostly supplies systems and templates; add-on mods provide the specific gear, art, abilities, and incidents. Load Harmony before this mod. Settings expose global multipliers for charge costs, regen, and drains.【F:About/About.xml†L3-L22】【F:Source/LanternCoreSettings.cs†L9-L44】

