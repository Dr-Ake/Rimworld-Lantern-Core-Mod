# How to Create a Custom Lantern Ring

The Lantern Framework allows you to create new Lantern Corps (e.g., Red, Blue, Indigo) purely through XML, without writing C# code.

## 1. Create the Ring Def
Create a new XML file in your mod's `Defs` folder. Use `ThingDef` inheriting from `ApparelNoQualityBase`.

### Critical Components
You must include the following `comps` and `modExtensions`.

```xml
<ThingDef ParentName="ApparelNoQualityBase">
  <defName>MyCustom_Ring</defName>
  <label>My Custom Ring</label>
  
  <!-- Standard Apparel Config -->
  <graphicData>...</graphicData>
  <statBases>...</statBases>
  
  <!-- FRAMEWORK COMPONENT -->
  <comps>
     <li Class="DrAke.LanternsFramework.CompProperties_LanternRing" />
  </comps>
  
  <!-- FRAMEWORK CONFIGURATION -->
  <modExtensions>
     <li Class="DrAke.LanternsFramework.LanternDefExtension">
        <!-- Visuals -->
        <ringColor>(1, 0, 0, 1)</ringColor> <!-- RGBA -->
        <resourceLabel>Rage</resourceLabel>
        
        <!-- Combat Stats -->
        <blastDamage>20</blastDamage>
        <blastDamageType>Burn</blastDamageType>
        
        <!-- Abilities Granted -->
        <abilities>
            <li>MyCustom_Ability_Blast</li>
        </abilities>
     </li>
  </modExtensions>
</ThingDef>
```

## 2. Create Abilities
Define abilities using standard RimWorld `AbilityDef`. To make them consume Ring Charge, add `CompProperties_LanternCost`.

```xml
<AbilityDef>
  <defName>MyCustom_Ability_Blast</defName>
  <!-- ... standard ability props ... -->
  
  <comps>
    <!-- COST COMPONENT -->
    <li Class="DrAke.LanternsFramework.Abilities.CompProperties_LanternCost">
      <cost>0.05</cost> <!-- Consumes 5% charge -->
    </li>
  </comps>
</AbilityDef>
```

## 3. Verify
Load your mod after `LanternsCore`. Your ring should now function with a resource bar, customized abilities, and combat stats.
