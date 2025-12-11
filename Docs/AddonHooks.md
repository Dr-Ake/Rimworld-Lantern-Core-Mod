# Lantern's Light Add-on Hooks

## Trait scoring hook
- Attach `DrAke.LanternsFramework.LanternTraitScoreExtension` to any `TraitDef` to adjust how strongly that trait pushes a pawn toward (or away from) being chosen by the ring.
- If no extension is present, the legacy bonuses for Iron Will, Steadfast, and Sanguine still apply so vanilla behavior is preserved.
- Example snippet:
```xml
<TraitDef>
  <defName>MyWillfulTrait</defName>
  <modExtensions>
    <li Class="DrAke.LanternsFramework.LanternTraitScoreExtension">
      <scoreOffset>8</scoreOffset> <!-- flat bonus/penalty -->
      <scorePerDegree>1.5</scorePerDegree> <!-- scales with degree -->
      <degreeOffsets>
        <li>
          <degree>-2</degree>
          <offset>-6</offset>
        </li>
      </degreeOffsets>
    </li>
  </modExtensions>
</TraitDef>
```

## Making new rings (framework-style)
1) Create an apparel `ThingDef` and add `CompProperties_LanternRing` (or derive your own comp from it to override charge/behavior).
2) Point the ring at a hediff that grants abilities. The built-in `GL_Hediff_Powers` uses `HediffComp_GiveAbilities` to add `GL_Ability_*` defs, but you can clone that hediff and swap in your own ability list.
3) Abilities consume charge through `CompAbilityEffect_RingCost`, so reusing that comp keeps costs tied to mod settings.
4) Provide your own textures/labels as desired; the comp handles charge ticking, death handling, and scan re-triggers.

## Adding new abilities
- Follow the existing `GL_Ability_*` defs as a template. Add a `CompAbilityEffect_RingCost` entry to drain charge, plus your effect/verb (e.g., a custom `Verb`, `CompAbilityEffect_Spawn`, or a vanilla ability effect).
- If an ability should spawn things, reuse `CompAbilityEffect_Spawn` or make a new `CompAbilityEffect` in C# under the `DrAke.LanternsLight` namespace.
- Add your new `AbilityDef` to the hediff that the ring applies so pawns gain it when wearing your ring.
