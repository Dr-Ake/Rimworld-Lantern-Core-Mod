# LanternsCore Add‑on Hooks (Advanced)

This file covers optional XML hooks and extension points for add‑on authors who want deeper control.  
For the full “no‑C#” authoring path, see `Docs/HowTo_CreateLanterns.md`.

---

## 1) Trait scoring hook

Attach `LanternTraitScoreExtension` to any `TraitDef`.  
`Condition_TraitExtensions` will automatically add these scores during ring selection.

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

---

## 2) Custom ring selection worker (C#)

If built‑in conditions aren’t enough, you can write your own worker:

```csharp
public class MyRingSelectionWorker : RingSelectionWorker
{
    public override float ScorePawn(Pawn p, RingSelectionDef def)
    {
        float baseScore = base.ScorePawn(p, def);
        if (baseScore <= 0f) return 0f;
        // Add custom logic...
        return baseScore + 5f;
    }
}
```

Then point your XML at it:

```xml
<workerClass>MyNamespace.MyRingSelectionWorker</workerClass>
```

---

## 3) Custom ability effects (C#)

All generic Lantern techniques are implemented as `CompAbilityEffect_*` with XML `CompProperties_*`.  
If you want a new technique, create a new `CompAbilityEffect` + properties class under your own namespace, and add it to an `AbilityDef` like any vanilla ability comp.

---

## 4) Legacy hediff‑based power grants

If you prefer “ring applies a hediff, hediff grants abilities,” use:

```xml
<li Class="DrAke.LanternsFramework.Abilities.HediffCompProperties_GiveAbilities">
  <abilities>
    <li>MyLantern_Ability_Blast</li>
    <li>MyLantern_Ability_Shield</li>
  </abilities>
</li>
```

Most add‑ons should list abilities directly on the ring extension instead.

