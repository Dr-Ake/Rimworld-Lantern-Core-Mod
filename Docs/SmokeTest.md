# Smoke Test (manual)

This is a quick, practical checklist to confirm the framework works in-game after changes.

## Prereqs

- RimWorld 1.6
- Harmony loaded (dependency)
- Dev mode enabled (Options → Development mode)

## Steps

1) Enable settings toggles
- Mod Settings → Lantern Core Framework:
  - Turn on **Show ring inspector gizmo**
  - (Optional) Turn on **Enable debug logging** if you want selection logs

2) Spawn and equip a ring
- Start any colony
- Open the Dev menu → **Spawn thing** → spawn your ring (from any dependent mod or the smoke-test XML below)
- Equip it on a colonist
- Confirm the ring shows:
  - Charge gizmo (bar + percent)
  - Ring Info gizmo (if enabled in settings)

3) Sanity check charge + recharge
- Use an ability with a `CompProperties_LanternCost` and confirm charge decreases.
- If the ring supports `allowBatteryManifest`, confirm the gizmo works and respects limits/costs.
- Interact with a battery building using `CompProperties_LanternBattery` and confirm recharge sets ring to 100%.

4) Sanity check the new generic comps
- Apply/remove hediff: `CompProperties_LanternApplyHediff`, `CompProperties_LanternRemoveHediff`
- Mental state start/end: `CompProperties_LanternStartMentalState`, `CompProperties_LanternEndMentalState`
- Teleport: `CompProperties_LanternTeleport`
- Displace (push/pull): `CompProperties_LanternDisplace`
- Channel drain: apply a hediff with `HediffCompProperties_LanternChargeDrain` and confirm charge drains over time.

5) Sanity check ring selection (optional)
- Add a `RingSelectionDef` with a trigger you can easily reproduce (spawn/join/mental state).
- Confirm the delivery orb equips the ring (and doesn’t spam logs when debug logging is off).

## Minimal smoke-test XML (put this in a separate local test mod)

Create a local mod folder (not meant for release) and add:

`About/About.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<ModMetaData>
  <name>LanternsCore Smoke Test</name>
  <author>local</author>
  <packageId>local.lanternscore.smoketest</packageId>
  <supportedVersions>
    <li>1.6</li>
  </supportedVersions>
  <modDependencies>
    <li>
      <packageId>DrAke.LanternsCore</packageId>
      <displayName>Lantern Core Framework</displayName>
    </li>
  </modDependencies>
  <loadAfter>
    <li>DrAke.LanternsCore</li>
  </loadAfter>
</ModMetaData>
```

`Defs/SmokeTest_Lantern.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<Defs>

  <ThingDef ParentName="Lantern_RingBase">
    <defName>SMOKE_Ring</defName>
    <label>smoke test ring</label>
    <description>A small test ring for verifying LanternsCore.</description>
    <graphicData>
      <texPath>UI/Things/Item/Resource/Steel</texPath>
      <graphicClass>Graphic_Single</graphicClass>
      <drawSize>0.6</drawSize>
      <color>(0.2, 0.9, 0.9, 1)</color>
    </graphicData>

    <modExtensions>
      <li Class="DrAke.LanternsFramework.LanternDefExtension">
        <ringColor>(0.2, 0.9, 0.9, 1)</ringColor>
        <resourceLabel>Test Charge</resourceLabel>
        <maxCharge>1</maxCharge>

        <passiveRegenPerDay>0.20</passiveRegenPerDay>
        <passiveDrainPerDay>0.00</passiveDrainPerDay>

        <abilities>
          <li>SMOKE_Ability_Teleport</li>
          <li>SMOKE_Ability_Push</li>
        </abilities>
      </li>
    </modExtensions>
  </ThingDef>

  <AbilityDef ParentName="Lantern_Ability_TeleportBase">
    <defName>SMOKE_Ability_Teleport</defName>
    <label>teleport</label>
    <iconPath>UI/Commands/JumpToTarget</iconPath>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternTeleport" />
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.08</cost>
      </li>
    </comps>
  </AbilityDef>

  <AbilityDef ParentName="Lantern_Ability_DisplaceBase">
    <defName>SMOKE_Ability_Push</defName>
    <label>push</label>
    <iconPath>UI/Commands/Forbid</iconPath>
    <comps Inherit="False">
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternDisplace">
        <pullTowardsCaster>false</pullTowardsCaster>
        <distance>4</distance>
        <radius>0</radius>
        <requireLineOfSight>true</requireLineOfSight>
      </li>
      <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
        <cost>0.05</cost>
      </li>
    </comps>
  </AbilityDef>

</Defs>
```

