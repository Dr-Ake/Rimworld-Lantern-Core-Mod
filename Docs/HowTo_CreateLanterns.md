# LanternsCore Add-on Authoring Guide

This guide is written so you can make a fully-working Lantern ring mod with **only XML and textures**.  
Anything marked "optional" can be skipped without errors.

The framework lives in `DrAke.LanternsCore` / `LanternsCore.dll`. Your mod should load after it.

---

## Folder Setup (minimal)

In your add-on mod:

- `About/About.xml` (normal RimWorld mod metadata)
- `Defs/` for your XML
- `Textures/` for your art

No C# required unless you want brand-new logic.

---

## 1) Create the Ring (ThingDef)

### Easiest way: inherit the core base

`Lantern_RingBase` already:
- uses the **Belt** layer (waist slot),
- includes the required `CompProperties_LanternRing`,
- tags it as a Lantern ring.

```xml
<ThingDef ParentName="Lantern_RingBase">
  <defName>MyLantern_Ring</defName>
  <label>my lantern ring</label>
  <description>A power ring fueled by emotion.</description>

  <graphicData>
    <texPath>MyLantern/Items/MyRing</texPath>
    <graphicClass>Graphic_Single</graphicClass>
    <color>(1, 0, 0, 1)</color>
  </graphicData>

  <statBases>
    <MarketValue>5000</MarketValue>
    <Mass>0.1</Mass>
  </statBases>

  <!-- REQUIRED: framework config -->
  <modExtensions>
    <li Class="DrAke.LanternsFramework.LanternDefExtension">
      <ringColor>(1, 0, 0, 1)</ringColor>
      <resourceLabel>Rage</resourceLabel>

      <blastDamage>20</blastDamage>
      <blastDamageType>Burn</blastDamageType>

      <abilities>
        <li>MyLantern_Ability_Blast</li>
      </abilities>

      <!-- optional fields shown later -->
    </li>
  </modExtensions>
</ThingDef>
```

### LanternDefExtension fields

Required:
- `ringColor` - UI bar color (RGBA).
- `resourceLabel` - text on the charge bar.
- `abilities` - list of `AbilityDef` defNames you want the ring to grant.

Optional:
- `blastDamage` / `blastDamageType` - defaults used by blast abilities.
- `associatedHediff` - hediff to add while worn (for passive effects).
- `allowBatteryManifest` - adds a gizmo to manifest a battery at the wearer.
- `batteryDef` - what battery to manifest.
- `batteryManifestCost` - charge fraction consumed when manifesting (default `0.5`).
- `batteryManifestMaxGlobal` - max manifested batteries total across all maps for this ring's `batteryDef` (0 = unlimited).
- `batteryManifestMaxPerMap` - max manifested batteries per map for this ring's `batteryDef` (0 = unlimited).
- `transformationApparel` - costume/uniform pieces to auto-equip while worn (restores original apparel on unequip).
- `chargeUseLabelColorOverride` / `chargeLabelColorOverride` - optionally override the **label text** color on the charge bar.
- `chargeUsePercentColorOverride` / `chargePercentColorOverride` - optionally override the **percent text** color on the charge bar.

Notes:
- Battery manifest defaults to **50% charge** unless overridden.
- If `blastDamageType` is omitted, Burn is used.
- If you don't set charge text overrides, label uses `ringColor` and percent text is white.

---

## Crafting (optional)

Rings are **not craftable by default**. To make a ring craftable using only XML, add a vanilla `<recipeMaker>` block to your ring `ThingDef` and a `<costList>`. RimWorld will auto‑generate a `RecipeDef` for you.

Example:

```xml
<ThingDef ParentName="Lantern_RingBase">
  <defName>MyLantern_Ring</defName>
  ...
  <recipeMaker>
    <researchPrerequisite>Smithing</researchPrerequisite>
    <recipeUsers>
      <li>ElectricSmithy</li>
      <!-- or FabricationBench, CraftingSpot, etc -->
    </recipeUsers>
    <workAmount>2000</workAmount>
    <workSkill>Crafting</workSkill>
    <skillRequirements>
      <Crafting>6</Crafting>
    </skillRequirements>
  </recipeMaker>
  <costList>
    <Jade>20</Jade>
    <ComponentIndustrial>2</ComponentIndustrial>
  </costList>
</ThingDef>
```

To make a ring **uncraftable**, omit the `<recipeMaker>` block.

---

## 2) Create Abilities (AbilityDef)

You can make abilities however you want, but the framework provides **generic Lantern technique comps** so most add-ons don't need C#.

### Always add a cost comp

```xml
<li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
  <cost>0.05</cost> <!-- 5% charge -->
</li>
```

Legacy alias still supported:
```xml
<li Class="DrAke.LanternsFramework.Abilities.CompProperties_RingCost">
  <costPercent>0.05</costPercent>
</li>
```

### Inherit the abstract bases

Core bases live in `Defs/Framework/Lantern_Framework_BaseDefs.xml`:

- `Lantern_Ability_BlastBase`
- `Lantern_Ability_HealBase`
- `Lantern_Ability_StunBase`
- `Lantern_Ability_BarrierBase`
- `Lantern_Ability_ConstructBase`
- `Lantern_Ability_SummonBase`
- `Lantern_Ability_AuraBase`
- `Lantern_Ability_FlightBase`

They already set sane targeting defaults. You can override any `verbProperties` if you need different targeting.

If you override a base's `<comps>` block, add `Inherit="False"` to avoid duplicate comps.

### UI AOE preview ring

If your Lantern comp uses a radius (`heal/stun/barrier/aura`), set the same value as a stat so the game draws a mouse radius circle:

```xml
<statBases>
  <Ability_EffectRadius>5</Ability_EffectRadius>
</statBases>
```

---

### Generic technique comps (fields)

**Blast (hard-light beam / bolt)**  
Base handles targeting and cost. Damage comes from ring defaults unless overridden.  
You can also add beam visuals via `VerbProperties_LanternBlast` (or set ring-level defaults).

Optional per-ability override:
```xml
<verbProperties Class="DrAke.LanternsFramework.Abilities.VerbProperties_LanternBlast">
  <verbClass>DrAke.LanternsFramework.Abilities.Verb_LanternBlast</verbClass>
  <range>25</range>
  <damageOverride>18</damageOverride> <!-- optional -->
  <damageTypeOverride>Burn</damageTypeOverride> <!-- optional -->
  <damageMultiplier>1.0</damageMultiplier> <!-- optional -->
  <!-- optional beam visuals -->
  <beamFleckDef>LightningGlow</beamFleckDef>
  <beamFleckScale>0.7</beamFleckScale>
  <beamFleckCount>0</beamFleckCount> <!-- 0 = auto based on distance -->
  <tintBeamToRingColor>true</tintBeamToRingColor>
  <!-- optional impact fleck -->
  <!-- <impactFleckDef>MicroSparks</impactFleckDef> -->
  <!-- optional projectile mode -->
  <!-- <projectileDef>MyLantern_BlastProjectile</projectileDef> -->
  <!-- optional beam that stretches to the flying projectile -->
  <!-- <projectileBeamMoteDef>MyLantern_BeamMote</projectileBeamMoteDef> -->
  <!-- <projectileBeamOffsetA>(0,0,0)</projectileBeamOffsetA> -->
  <!-- <projectileBeamOffsetB>(0,0,0)</projectileBeamOffsetB> -->
  <!-- <projectileBeamScale>0.5</projectileBeamScale> -->
</verbProperties>
```

Ring-level blast visual defaults (used when the ability does not override):
```xml
<blastBeamFleckDef>LightningGlow</blastBeamFleckDef>
<blastBeamFleckScale>0.7</blastBeamFleckScale>
<blastBeamFleckCount>0</blastBeamFleckCount>
<blastTintBeamToRingColor>true</blastTintBeamToRingColor>
<!-- or force a specific color -->
<!--
<blastUseBeamColorOverride>true</blastUseBeamColorOverride>
<blastBeamColorOverride>(0,1,0,1)</blastBeamColorOverride>
-->
```

**Projectile blast (travels across the map)**
1) Define a projectile (inherit the core base so damage comes from the ring):
```xml
<ThingDef ParentName="Lantern_Projectile_BlastBase">
  <defName>MyLantern_BlastProjectile</defName>
  <graphicData>
    <texPath>MyLantern/Projectiles/MyBlast</texPath>
    <graphicClass>Graphic_Single</graphicClass>
    <drawSize>0.6</drawSize>
  </graphicData>
  <projectile>
    <speed>65</speed>
  </projectile>
</ThingDef>
```
2) In your blast ability, set `projectileDef` to that defName. The verb will launch it instead of instant damage.

**Cartoon laser (one end anchored, other end zips out)**
Set both `projectileDef` and `projectileBeamMoteDef`. While the projectile is flying, a `MoteDualAttached` beam will connect caster -> projectile and stretch as it moves. Use any mote def with `scaleToConnectTargets=true` and your beam PNG.

**Heal construct (`CompProperties_LanternHeal`)**
- `healAmount` (float) - total healing to distribute to injuries.
- `radius` (float) - `0` = single target, `>0` = AOE around target cell.
- `affectAlliesOnly` (bool)
- `affectSelf` (bool)
- `affectAnimals` (bool)
- `healPermanentInjuries` (bool) - if true, also heals scars/permanent injuries.
- `healNonNaturalInjuries` (bool) - if true, also heals injuries that can't heal naturally.
- `hediffsToRemove` (list of HediffDef) - optional.
- `effecterDef` (EffecterDef) - optional VFX.

**Bind/stun construct (`CompProperties_LanternStun`)**
- `stunTicks` (int)
- `radius` (float) - `0` single, `>0` AOE.
- `affectHostilesOnly` (bool)
- `affectAnimals` (bool)
- `effecterDef` (optional)

**Common VFX/SFX fields (all Lantern comps, optional)**
- `castFleckDef` / `castFleckScale` - VFX at cast point.
- `impactFleckDef` / `impactFleckScale` - VFX at each affected target/cell.
- `moteDefOnTarget` / `moteScaleOnTarget` / `attachMoteToTarget` - optional mote on targets.
- `soundCastOverride` - plays an extra sound when cast.

**Barrier / shield (`CompProperties_LanternShieldAbility`)**
- `shieldHediffDef` (HediffDef) - **required unless you rely on legacy GL shield**.
- `radius` (float) - `0` single target toggle; `>0` AOE bubble.
- `affectAlliesOnly` (bool)
- `affectSelf` (bool)
- `alsoShieldCaster` (bool) - if targeting others/locations, also shields caster.

**Hard-light constructs (`CompProperties_LanternConstructSpawn`)**
- `thingDef` (ThingDef) - what to spawn.
- `spawnCount` (int)
- `spreadRadius` (float) - `0` places exactly on click, otherwise random within radius.
- `durationTicks` (int) - `0` = permanent, `>0` auto-vanish.
- `setFaction` (bool) - sets spawned thing to caster faction if possible.
- `replaceExisting` (bool) - destroys same-def thing at cell first.
- `stuffDef` (ThingDef) - optional stuff to use if `thingDef` is made-from-stuff.
- `spawnPattern` (enum) - `Single`, `Scatter` (default), `Line`, `Wall`, `Ring`.
- `requireStandableCell` (bool) - skip non-standable cells.
- `lineLength` (int) - for `Line`/`Wall`, 0 = use `spawnCount`.
- `ringRadius` / `ringThickness` (float) - for `Ring` pattern; if `ringRadius` is 0, `spreadRadius` is used.
- `effecterDef` (optional)

**Summon projections/minions (`CompProperties_LanternSummon`)**
- `pawnKind` (PawnKindDef)
- `count` (int)
- `spawnRadius` (float) - `0` exact click, otherwise random nearby.
- `durationTicks` (int) - `0` permanent; `>0` auto-despawn.
- `setFactionToCaster` (bool)
- `factionDefOverride` (FactionDef) - optional override.
- `effecterDef` (optional)

**Emotional aura buff (`CompProperties_LanternBuffAura`)**
- `hediffDef` (HediffDef) - what buff to apply.
- `severity` (float) - how much severity per cast.
- `radius` (float)
- `durationTicks` (int) - if `removeOnExpire=true`, buff is removed later.
- `removeOnExpire` (bool)
- `affectAlliesOnly` (bool)
- `affectSelf` (bool)
- `affectAnimals` (bool)
- `effecterDef` (optional)

### Cookbook examples (copy/paste)

**Anchored beam blast**
```xml
<AbilityDef ParentName="Lantern_Ability_BlastBase">
  <defName>MyLantern_Ability_Blast</defName>
  <iconPath>MyLantern/UI/Blast</iconPath>
  <verbProperties Class="DrAke.LanternsFramework.Abilities.VerbProperties_LanternBlast">
    <projectileDef>MyLantern_Projectile_Blast</projectileDef>
    <projectileBeamMoteDef>MyLantern_Mote_BeamLine</projectileBeamMoteDef>
    <projectileBeamScale>0.6</projectileBeamScale>
  </verbProperties>
</AbilityDef>
```

**Wall/line construct**
```xml
<li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternConstructSpawn">
  <thingDef>Sandbags</thingDef>
  <spawnPattern>Wall</spawnPattern>
  <lineLength>8</lineLength>
  <durationTicks>1800</durationTicks>
  <replaceExisting>true</replaceExisting>
</li>
```

**Ring construct around a spot**
```xml
<li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternConstructSpawn">
  <thingDef>WoodLog</thingDef>
  <spawnPattern>Ring</spawnPattern>
  <ringRadius>5</ringRadius>
  <ringThickness>1</ringThickness>
  <spawnCount>0</spawnCount> <!-- 0 = fill all ring cells -->
</li>
```

**Shield that follows the pawn**
```xml
<HediffDef>
  <defName>MyLantern_Hediff_Shield</defName>
  <hediffClass>HediffWithComps</hediffClass>
  <comps>
    <li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternShield"/>
    <li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternAuraVfx">
      <moteDef>MyLantern_Mote_ShieldBubble</moteDef>
      <attachToPawn>true</attachToPawn>
    </li>
  </comps>
</HediffDef>
```

**Simple spawn (legacy utility)**

If you just want "spawn one thing permanently at click":

```xml
<li Class="DrAke.LanternsFramework.Abilities.CompProperties_AbilitySpawn">
  <thingDef>MyThing</thingDef>
</li>
```

There is also `CompProperties_AbilitySpawnShuttle` for simple shuttle constructs.

---

## 3) Define Buff / Shield Hediffs

### Shield Hediff (for barrier abilities)

Create your own shield hediff and add the Lantern shield comp:

```xml
<HediffDef>
  <defName>MyLantern_Hediff_Shield</defName>
  <label>lantern shield</label>
  <hediffClass>HediffWithComps</hediffClass>
  <comps>
    <li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternShield">
      <defaultMaxHp>200</defaultMaxHp>
    </li>
  </comps>
</HediffDef>
```

### Aura visuals that follow pawns (optional)

Add to any hediff you want to "glow" or show a mote while active:

```xml
<li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternAuraVfx">
  <effecterDef>MyLantern_Effecter_Glow</effecterDef> <!-- or use moteDef -->
  <moteDef>MyLantern_Mote_Glow</moteDef>
  <moteScale>1.2</moteScale>
  <intervalTicks>60</intervalTicks>
  <attachToPawn>true</attachToPawn> <!-- optional: follows pawn movement -->
  <!-- <attachedOffset>(0,0,0)</attachedOffset> -->
</li>
```
Note: if you use `attachToPawn=true`, your `moteDef` should use a mote class that supports attachments (e.g. `thingClass>MoteDualAttached</thingClass>` or `MoteBubble`). Plain `MoteThrown` motes will trail behind.

### Legacy/advanced: hediff-granted abilities

You can also grant abilities from a hediff using:

```xml
<li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_GiveAbilities">
  <abilities>
    <li>MyLantern_Ability_Blast</li>
  </abilities>
</li>
```

Most add-ons should prefer listing abilities directly on the ring extension.

---

## 4) Recharge Battery (optional)

### Battery building with recharge menu

```xml
<ThingDef ParentName="BuildingBase">
  <defName>MyLantern_ChargeBattery</defName>
  <label>charge battery</label>
  <thingClass>Building</thingClass>
  <graphicData>...</graphicData>
  <comps>
    <li Class="DrAke.LanternsFramework.Recharge.CompProperties_LanternBattery">
      <oathPrefix>MyLantern_Oath</oathPrefix> <!-- uses MyLantern_Oath_Line1..4 if present -->
      <!-- optional raw lines instead of translations -->
      <!--
      <oathLines>
        <li>My oath line 1</li>
        <li>My oath line 2</li>
        <li>My oath line 3</li>
        <li>My oath line 4</li>
      </oathLines>
      -->
    </li>
  </comps>
</ThingDef>
```

When a pawn wearing any Lantern ring right-clicks this battery, they get a **Recharge Ring** float-menu option.

### Ring-manifested batteries

If your ring should spawn a battery via gizmo:

```xml
<allowBatteryManifest>true</allowBatteryManifest>
<batteryDef>MyLantern_ChargeBattery</batteryDef>
<!-- optional tuning -->
<batteryManifestCost>0.5</batteryManifestCost>
<batteryManifestMaxPerMap>1</batteryManifestMaxPerMap> <!-- allow one per map -->
<batteryManifestMaxGlobal>0</batteryManifestMaxGlobal> <!-- 0 = unlimited across maps -->
```

---

## 5) Ring Selection (auto-choosing bearers) (optional)

Create a `RingSelectionDef` to let rings seek out a bearer.

```xml
<DrAke.LanternsFramework.RingSelectionDef>
  <defName>MyLantern_Selection</defName>
  <ringDef>MyLantern_Ring</ringDef>

  <!-- Optional delivery orb (flies to pawn then equips ring).
       If omitted, core `Lantern_RingDeliveryOrb` is used. -->
  <!-- <orbDef>Lantern_RingDeliveryOrb</orbDef> -->

  <!-- Triggers (any combination) -->
  <triggerPeriodic>true</triggerPeriodic>
  <periodicInterval>120000</periodicInterval>

  <triggerMentalState>true</triggerMentalState>
  <mentalStates>
    <li>MurderousRage</li>
  </mentalStates>

  <triggerOnJoinPlayerFaction>false</triggerOnJoinPlayerFaction>
  <triggerOnSpawnedOnMap>false</triggerOnSpawnedOnMap>
  <triggerOnDowned>false</triggerOnDowned>
  <triggerOnKillAny>false</triggerOnKillAny>
  <triggerOnKillHostile>false</triggerOnKillHostile>
  <triggerOnHediffAdded>false</triggerOnHediffAdded>
  <!--
  <hediffsToTriggerOn>
    <li>PsychicShock</li>
  </hediffsToTriggerOn>
  -->

  <!-- Candidate filters -->
  <allowColonists>true</allowColonists>
  <allowPrisoners>false</allowPrisoners>
  <allowSlaves>false</allowSlaves>
  <allowGuests>false</allowGuests>
  <allowAnimals>false</allowAnimals>
  <allowMechs>false</allowMechs>
  <allowHostiles>false</allowHostiles>
  <allowDead>false</allowDead>
  <allowDowned>true</allowDowned>
  <requireViolenceCapable>true</requireViolenceCapable>

  <excludeIfHasAnyLanternRing>true</excludeIfHasAnyLanternRing>
  <!-- optional apparel tag blockers -->
  <!--
  <excludedApparelTags>
    <li>PowerArmor</li>
  </excludedApparelTags>
  -->

  <!-- Selection behavior -->
  <selectionMode>HighestScore</selectionMode>
  <minScoreToSelect>0.01</minScoreToSelect>

  <!-- Run/limit behavior (optional) -->
  <!-- If true, this selection def stops after it runs once (success or not). -->
  <!-- <runOnlyOnce>false</runOnlyOnce> -->
  <!-- If true, this selection def stops after the first successful ring assignment. -->
  <!-- <stopAfterFirstSuccess>false</stopAfterFirstSuccess> -->
  <!-- Total rings this def may assign. 0 = unlimited. -->
  <!-- <maxRingsTotal>0</maxRingsTotal> -->

  <!-- Scoring conditions -->
  <conditions>
    <li Class="DrAke.LanternsFramework.Condition_Trait">
      <trait>IronWill</trait>
      <scoreBonus>10</scoreBonus>
    </li>
    <li Class="DrAke.LanternsFramework.Condition_Mood">
      <lowerIsBetter>true</lowerIsBetter>
      <scoreMultiplier>8</scoreMultiplier>
    </li>
  </conditions>
</DrAke.LanternsFramework.RingSelectionDef>
```

**Run/limit options**
- `runOnlyOnce`: disables this selection def after its first trigger attempt (even if no pawn qualifies).
- `stopAfterFirstSuccess`: keeps trying on triggers until it successfully gives a ring once, then disables.
- `maxRingsTotal`: hard cap on how many rings this selection def can ever give; set to `1` to mimic Lantern's Light behavior.
- `maxActiveRingsInColony`: caps how many pawns can *currently wear* this ring at once; selection pauses when at cap.

### Built-in condition classes

Use any number:
- `Condition_Trait` (`trait`, optional `degree`, `scoreBonus`)
- `Condition_Stat` (`stat`, `lowerIsBetter`, `scoreMultiplier`)
- `Condition_Skill` (`skill`, `minLevel`, `scoreMultiplier`, `flatBonus`)
- `Condition_Mood` (`lowerIsBetter`, `scoreMultiplier`, `flatBonus`)
- `Condition_Age` (`minAge`, `maxAge`, `scoreBonus`)
- `Condition_Gender` (`gender`, `scoreBonus`)
- `Condition_Hediff` (`hediff`, `minSeverity`, `maxSeverity`, `scoreBonus`, `scaleBySeverity`, `severityMultiplier`)
- `Condition_Gene` (`gene`, `scoreBonus`)
- `Condition_Meme` (`meme`, `scoreBonus`)
- `Condition_Passion` (`skill`, `minPassion`, `minorBonus`, `majorBonus`, `flatBonus`)
- `Condition_Record` (`record`, `minValue`, `maxValue`, `lowerIsBetter`, `scoreMultiplier`, `flatBonus`)
- `Condition_TraitExtensions` (scores traits using `LanternTraitScoreExtension`)

### Trait score extension (optional)

Attach to any `TraitDef`:

```xml
<li Class="DrAke.LanternsFramework.LanternTraitScoreExtension">
  <scoreOffset>8</scoreOffset>
  <scorePerDegree>1.5</scorePerDegree>
  <degreeOffsets>
    <li><degree>-2</degree><offset>-6</offset></li>
  </degreeOffsets>
</li>
```

---

## 6) Flight (optional built-in ability)

Core includes Lantern flight systems and defs (job/world travel/skyfallers).  
To give flight to a ring, define an ability like:

```xml
<AbilityDef ParentName="Lantern_Ability_FlightBase">
  <defName>MyLantern_Ability_Flight</defName>
  <label>flight</label>
  <description>Fly across the world using ring power.</description>
  <iconPath>LanternsLight/UI/Flight</iconPath>
</AbilityDef>
```

Add its defName to the ring's `abilities` list.

---

# Full End-to-End Example (copy/paste template)

This example includes **every required field and every optional field**.  
Delete what you don't need.

```xml
<?xml version="1.0" encoding="utf-8"?>
<Defs>

  <!-- ========================= -->
  <!-- 1. RING THINGDEF          -->
  <!-- ========================= -->
  <ThingDef ParentName="Lantern_RingBase">
    <defName>EX_Ring</defName>
    <label>example spectrum ring</label>
    <description>An example add-on ring showing every option.</description>

    <graphicData>
      <texPath>ExampleLantern/Items/EX_Ring</texPath>
      <graphicClass>Graphic_Single</graphicClass>
      <color>(0.8, 0.2, 1, 1)</color>
    </graphicData>

    <statBases>
      <MarketValue>5000</MarketValue>
      <Mass>0.1</Mass>
      <EquipDelay>0.1</EquipDelay>
    </statBases>

    <modExtensions>
      <li Class="DrAke.LanternsFramework.LanternDefExtension">
        <!-- REQUIRED -->
        <ringColor>(0.8, 0.2, 1, 1)</ringColor>
        <resourceLabel>Example Energy</resourceLabel>
        <abilities>
          <li>EX_Ability_Blast</li>
          <li>EX_Ability_Heal</li>
          <li>EX_Ability_StunBind</li>
          <li>EX_Ability_Barrier</li>
          <li>EX_Ability_Construct</li>
          <li>EX_Ability_Summon</li>
          <li>EX_Ability_Aura</li>
          <li>EX_Ability_Flight</li>
        </abilities>

        <!-- OPTIONAL combat defaults -->
        <blastDamage>20</blastDamage>
        <blastDamageType>Burn</blastDamageType>

        <!-- OPTIONAL passive hediff while worn -->
        <!-- <associatedHediff>EX_Hediff_Passive</associatedHediff> -->

        <!-- OPTIONAL battery manifest -->
        <allowBatteryManifest>true</allowBatteryManifest>
        <batteryDef>EX_ChargeBattery</batteryDef>

        <!-- OPTIONAL costume transform -->
        <transformationApparel>
          <li>EX_Uniform</li>
          <li>EX_Mask</li>
        </transformationApparel>
      </li>
    </modExtensions>
  </ThingDef>


  <!-- ========================= -->
  <!-- 2. ABILITIES              -->
  <!-- ========================= -->

  <!-- Blast -->
  <AbilityDef ParentName="Lantern_Ability_BlastBase">
    <defName>EX_Ability_Blast</defName>
    <label>example blast</label>
    <iconPath>ExampleLantern/UI/Blast</iconPath>
    <!-- optional per-ability blast override -->
    <verbProperties Class="DrAke.LanternsFramework.Abilities.VerbProperties_LanternBlast">
      <verbClass>DrAke.LanternsFramework.Abilities.Verb_LanternBlast</verbClass>
      <range>25</range>
      <warmupTime>0.6</warmupTime>
      <damageOverride>14</damageOverride>
      <damageTypeOverride>Burn</damageTypeOverride>
      <damageMultiplier>1.0</damageMultiplier>
    </verbProperties>
  </AbilityDef>

  <!-- Heal -->
  <AbilityDef ParentName="Lantern_Ability_HealBase">
    <defName>EX_Ability_Heal</defName>
    <label>example heal field</label>
    <iconPath>ExampleLantern/UI/Heal</iconPath>
    <statBases>
      <Ability_EffectRadius>4.5</Ability_EffectRadius>
    </statBases>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternHeal">
        <healAmount>12</healAmount>
        <radius>4.5</radius>
        <affectAlliesOnly>false</affectAlliesOnly>
        <affectSelf>true</affectSelf>
        <affectAnimals>true</affectAnimals>
        <hediffsToRemove>
          <li>Flu</li>
        </hediffsToRemove>
        <!-- <effecterDef>HealEffecter</effecterDef> -->
      </li>
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.06</cost>
      </li>
    </comps>
  </AbilityDef>

  <!-- Stun / bind -->
  <AbilityDef ParentName="Lantern_Ability_StunBase">
    <defName>EX_Ability_StunBind</defName>
    <label>example bind</label>
    <iconPath>ExampleLantern/UI/Bind</iconPath>
    <statBases>
      <Ability_EffectRadius>3</Ability_EffectRadius>
    </statBases>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternStun">
        <stunTicks>240</stunTicks>
        <radius>3</radius>
        <affectHostilesOnly>true</affectHostilesOnly>
        <affectAnimals>true</affectAnimals>
        <!-- <effecterDef>BindEffecter</effecterDef> -->
      </li>
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.06</cost>
      </li>
    </comps>
  </AbilityDef>

  <!-- Barrier -->
  <AbilityDef ParentName="Lantern_Ability_BarrierBase">
    <defName>EX_Ability_Barrier</defName>
    <label>example barrier</label>
    <iconPath>ExampleLantern/UI/Barrier</iconPath>
    <statBases>
      <Ability_EffectRadius>5</Ability_EffectRadius>
    </statBases>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternShieldAbility">
        <shieldHediffDef>EX_Hediff_Shield</shieldHediffDef>
        <radius>5</radius>
        <affectAlliesOnly>true</affectAlliesOnly>
        <affectSelf>true</affectSelf>
        <alsoShieldCaster>false</alsoShieldCaster>
      </li>
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.05</cost>
      </li>
    </comps>
  </AbilityDef>

  <!-- Construct spawn -->
  <AbilityDef ParentName="Lantern_Ability_ConstructBase">
    <defName>EX_Ability_Construct</defName>
    <label>example construct</label>
    <iconPath>ExampleLantern/UI/Construct</iconPath>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternConstructSpawn">
        <thingDef>Sandbags</thingDef>
        <spawnCount>4</spawnCount>
        <spreadRadius>2</spreadRadius>
        <durationTicks>2000</durationTicks>
        <setFaction>true</setFaction>
        <replaceExisting>true</replaceExisting>
      </li>
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.05</cost>
      </li>
    </comps>
  </AbilityDef>

  <!-- Summon -->
  <AbilityDef ParentName="Lantern_Ability_SummonBase">
    <defName>EX_Ability_Summon</defName>
    <label>example projection</label>
    <iconPath>ExampleLantern/UI/Summon</iconPath>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternSummon">
        <pawnKind>Muffalo</pawnKind>
        <count>1</count>
        <spawnRadius>2</spawnRadius>
        <durationTicks>4000</durationTicks>
        <setFactionToCaster>true</setFactionToCaster>
        <!-- <factionDefOverride>Ancients</factionDefOverride> -->
      </li>
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.10</cost>
      </li>
    </comps>
  </AbilityDef>

  <!-- Aura -->
  <AbilityDef ParentName="Lantern_Ability_AuraBase">
    <defName>EX_Ability_Aura</defName>
    <label>example aura</label>
    <iconPath>ExampleLantern/UI/Aura</iconPath>
    <statBases>
      <Ability_EffectRadius>6</Ability_EffectRadius>
    </statBases>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternBuffAura">
        <hediffDef>EX_Hediff_AuraBuff</hediffDef>
        <severity>0.10</severity>
        <radius>6</radius>
        <durationTicks>3000</durationTicks>
        <removeOnExpire>true</removeOnExpire>
        <affectAlliesOnly>true</affectAlliesOnly>
        <affectSelf>true</affectSelf>
        <affectAnimals>false</affectAnimals>
      </li>
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.05</cost>
      </li>
    </comps>
  </AbilityDef>

  <!-- Flight -->
  <AbilityDef ParentName="Lantern_Ability_FlightBase">
    <defName>EX_Ability_Flight</defName>
    <label>flight</label>
    <description>Fly across the world using ring power.</description>
    <iconPath>LanternsLight/UI/Flight</iconPath>
  </AbilityDef>


  <!-- ========================= -->
  <!-- 3. HEDIFFS                -->
  <!-- ========================= -->

  <!-- Shield hediff -->
  <HediffDef>
    <defName>EX_Hediff_Shield</defName>
    <label>example shield</label>
    <hediffClass>HediffWithComps</hediffClass>
    <comps>
      <li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternShield">
        <defaultMaxHp>200</defaultMaxHp>
      </li>
    </comps>
  </HediffDef>

  <!-- Aura buff hediff -->
  <HediffDef>
    <defName>EX_Hediff_AuraBuff</defName>
    <label>example aura buff</label>
    <hediffClass>HediffWithComps</hediffClass>
    <comps>
      <!-- optional visual follow -->
      <!--
      <li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_LanternAuraVfx">
        <moteDef>ExampleLantern_Mote_Glow</moteDef>
        <intervalTicks>60</intervalTicks>
      </li>
      -->
      <li Class="HediffCompProperties_Disappears">
        <disappearsAfterTicks>3000</disappearsAfterTicks>
      </li>
    </comps>
  </HediffDef>


  <!-- ========================= -->
  <!-- 4. RECHARGE BATTERY        -->
  <!-- ========================= -->
  <ThingDef ParentName="BuildingBase">
    <defName>EX_ChargeBattery</defName>
    <label>example charge battery</label>
    <thingClass>Building</thingClass>
    <graphicData>
      <texPath>ExampleLantern/Buildings/EX_Battery</texPath>
      <graphicClass>Graphic_Single</graphicClass>
    </graphicData>
    <comps>
      <li Class="DrAke.LanternsFramework.Recharge.CompProperties_LanternBattery">
        <oathPrefix>EX_Oath</oathPrefix>
        <!-- or raw oath lines -->
        <!--
        <oathLines>
          <li>Line 1</li>
          <li>Line 2</li>
          <li>Line 3</li>
          <li>Line 4</li>
        </oathLines>
        -->
      </li>
    </comps>
  </ThingDef>


  <!-- ========================= -->
  <!-- 5. COSTUME APPAREL        -->
  <!-- ========================= -->
  <ThingDef ParentName="ApparelBase">
    <defName>EX_Uniform</defName>
    <label>example uniform</label>
    <apparel>
      <layers>
        <li>Middle</li>
      </layers>
      <bodyPartGroups>
        <li>Torso</li>
        <li>Legs</li>
      </bodyPartGroups>
    </apparel>
    <graphicData>
      <texPath>ExampleLantern/Apparel/EX_Uniform</texPath>
      <graphicClass>Graphic_Multi</graphicClass>
    </graphicData>
  </ThingDef>

  <ThingDef ParentName="ApparelBase">
    <defName>EX_Mask</defName>
    <label>example mask</label>
    <apparel>
      <layers><li>Overhead</li></layers>
      <bodyPartGroups><li>FullHead</li></bodyPartGroups>
    </apparel>
    <graphicData>
      <texPath>ExampleLantern/Apparel/EX_Mask</texPath>
      <graphicClass>Graphic_Multi</graphicClass>
    </graphicData>
  </ThingDef>


  <!-- ========================= -->
  <!-- 6. RING SELECTION DEF     -->
  <!-- ========================= -->
  <DrAke.LanternsFramework.RingSelectionDef>
    <defName>EX_Selection</defName>
    <ringDef>EX_Ring</ringDef>
    <orbDef>Lantern_RingDeliveryOrb</orbDef>

    <triggerPeriodic>true</triggerPeriodic>
    <periodicInterval>120000</periodicInterval>
    <triggerMentalState>true</triggerMentalState>
    <mentalStates><li>MurderousRage</li></mentalStates>
    <triggerOnJoinPlayerFaction>true</triggerOnJoinPlayerFaction>
    <triggerOnSpawnedOnMap>true</triggerOnSpawnedOnMap>
    <triggerOnDowned>false</triggerOnDowned>
    <triggerOnKillAny>false</triggerOnKillAny>
    <triggerOnKillHostile>false</triggerOnKillHostile>
    <triggerOnHediffAdded>false</triggerOnHediffAdded>
    <!-- <hediffsToTriggerOn><li>PsychicShock</li></hediffsToTriggerOn> -->

    <allowColonists>true</allowColonists>
    <allowPrisoners>false</allowPrisoners>
    <allowSlaves>false</allowSlaves>
    <allowGuests>false</allowGuests>
    <allowAnimals>false</allowAnimals>
    <allowMechs>false</allowMechs>
    <allowHostiles>false</allowHostiles>
    <allowDead>false</allowDead>
    <allowDowned>true</allowDowned>
    <requireViolenceCapable>true</requireViolenceCapable>
    <excludeIfHasAnyLanternRing>true</excludeIfHasAnyLanternRing>

    <selectionMode>WeightedRandom</selectionMode>
    <minScoreToSelect>5</minScoreToSelect>

    <conditions>
      <li Class="DrAke.LanternsFramework.Condition_Trait">
        <trait>IronWill</trait>
        <scoreBonus>10</scoreBonus>
      </li>
      <li Class="DrAke.LanternsFramework.Condition_Skill">
        <skill>Shooting</skill>
        <minLevel>6</minLevel>
        <scoreMultiplier>1.5</scoreMultiplier>
      </li>
      <li Class="DrAke.LanternsFramework.Condition_Mood">
        <lowerIsBetter>true</lowerIsBetter>
        <scoreMultiplier>6</scoreMultiplier>
      </li>
    </conditions>
  </DrAke.LanternsFramework.RingSelectionDef>

</Defs>
```
