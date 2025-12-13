using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using RimWorld;
using UnityEngine;
using Verse;
using DrAke.LanternsFramework.Recharge;

namespace DrAke.LanternsFramework
{
    public class CompProperties_LanternRing : CompProperties
    {
        public CompProperties_LanternRing()
        {
            this.compClass = typeof(CompLanternRing);
        }
    }

    public class CompLanternRing : ThingComp, IThingHolder
    {
        // Absolute stored energy. Most XML-facing APIs use fractions (0..1) of MaxCharge.
        public float charge = 1.0f;

        // Save format:
        // v1: charge stored as 0..1 fraction
        // v2: charge stored as 0..MaxCharge absolute
        private int chargeSaveVersion = 0;

        private int chargeModelTickAccumulator = 0;

        // Transformation Storage
        // Store original items that were replaced by the transformation.
        // Kept in a ThingOwner so it is saved/loaded safely.
        private ThingOwner<Apparel> storedApparel;

        public LanternDefExtension Extension => parent.def.GetModExtension<LanternDefExtension>();

        private Pawn Wearer => (parent as Apparel)?.Wearer;

        public float MaxCharge
        {
            get
            {
                float max = Extension?.maxCharge ?? 1f;
                return Mathf.Max(0.001f, max);
            }
        }

        public float ChargePercent => Mathf.Clamp01(charge / MaxCharge);

        public float EffectiveCostMultiplier => Mathf.Max(0f, LanternCoreMod.Settings?.costMultiplier ?? 1f);
        public float EffectiveRegenMultiplier => Mathf.Max(0f, LanternCoreMod.Settings?.regenMultiplier ?? 1f);
        public float EffectiveDrainMultiplier => Mathf.Max(0f, LanternCoreMod.Settings?.drainMultiplier ?? 1f);

        public float GetEffectiveCostFraction(float baseFraction) => Mathf.Max(0f, baseFraction) * EffectiveCostMultiplier;

        public bool IsActive
        {
            get
            {
                if (Wearer == null) return false;
                // Basic check: If dead/downed, usually inactive logic flows elsewhere.
                // Framework: In future, allow XML conditions for "Inert" state?
                // For now, mirroring legacy Green Lantern logic: Mental Breaks disable it unless Aggro.
                if (Wearer.InMentalState && !Wearer.MentalStateDef.IsAggro)
                {
                    return false;
                }
                return true;
            }
        }

        public override void CompTick()
        {
            base.CompTick();
            if (Wearer == null) return;

            if (Wearer.Dead)
            {
                Notify_PawnDied(Wearer);
                return;
            }

            // Passive Charge / Logic could go here.
            // Ensure Hediff
            if (IsActive && Wearer.IsColonist)
            {
                EnsureHediff(true);
            }
            else
            {
                EnsureHediff(false);
            }

            TickChargeModel();
        }

        public override void Initialize(CompProperties props)
        {
            base.Initialize(props);
            if (storedApparel == null)
            {
                storedApparel = new ThingOwner<Apparel>(this, oneStackOnly: false);
            }

            // Default new rings to full charge.
            if (chargeSaveVersion <= 0)
            {
                chargeSaveVersion = 2;
                charge = MaxCharge;
            }
        }

        private void TickChargeModel()
        {
            if (Extension == null) return;
            if (!IsActive) return;
            if (Wearer == null || Wearer.Dead) return;
            if (Wearer.Map == null || !Wearer.Spawned) return;

            chargeModelTickAccumulator++;
            if (chargeModelTickAccumulator < 60) return; // once per second
            int ticks = chargeModelTickAccumulator;
            chargeModelTickAccumulator = 0;

            float days = ticks / (float)GenDate.TicksPerDay;
            float deltaPerDay =
                Extension.passiveRegenPerDay * EffectiveRegenMultiplier -
                Extension.passiveDrainPerDay * EffectiveDrainMultiplier;

            if (Extension.regenFromMood && Wearer.needs?.mood != null)
            {
                float mood = Wearer.needs.mood.CurLevelPercentage; // 0..1
                if (mood >= Extension.moodMin)
                {
                    float t = Extension.moodMin >= 1f ? 1f : Mathf.Clamp01((mood - Extension.moodMin) / (1f - Extension.moodMin));
                    deltaPerDay += Extension.moodRegenPerDay * EffectiveRegenMultiplier * (Extension.moodRegenScale ? t : 1f);
                }
            }

            if (Extension.regenFromPain && Wearer.health?.hediffSet != null)
            {
                float pain = Wearer.health.hediffSet.PainTotal; // 0..1
                if (pain >= Extension.painMin)
                {
                    float t = Extension.painMin >= 1f ? 1f : Mathf.Clamp01((pain - Extension.painMin) / (1f - Extension.painMin));
                    deltaPerDay += Extension.painRegenPerDay * EffectiveRegenMultiplier * (Extension.painRegenScale ? t : 1f);
                }
            }

            if (Extension.regenFromSunlight && Wearer.Map?.glowGrid != null)
            {
                float glow = GetGlowAt(Wearer.Map, Wearer.Position);
                if (glow >= Extension.sunlightMinGlow)
                {
                    float t = Extension.sunlightMinGlow >= 1f ? 1f : Mathf.Clamp01((glow - Extension.sunlightMinGlow) / (1f - Extension.sunlightMinGlow));
                    deltaPerDay += Extension.sunlightRegenPerDay * EffectiveRegenMultiplier * (Extension.sunlightRegenScale ? t : 1f);
                }
            }

            if (Extension.regenFromPsyfocus && Wearer.psychicEntropy != null)
            {
                float psyfocus = Wearer.psychicEntropy.CurrentPsyfocus;
                if (psyfocus >= Extension.psyfocusMin)
                {
                    float t = Extension.psyfocusMin >= 1f ? 1f : Mathf.Clamp01((psyfocus - Extension.psyfocusMin) / (1f - Extension.psyfocusMin));
                    deltaPerDay += Extension.psyfocusRegenPerDay * EffectiveRegenMultiplier * (Extension.psyfocusRegenScale ? t : 1f);
                }
            }

            if (Extension.regenFromNearbyAllies && Extension.alliesRadius > 0 && Extension.alliesRegenPerDayEach > 0f)
            {
                int count = 0;
                Map map = Wearer.Map;
                foreach (IntVec3 cell in GenRadial.RadialCellsAround(Wearer.Position, Extension.alliesRadius, true))
                {
                    if (!cell.InBounds(map)) continue;
                    List<Thing> things = cell.GetThingList(map);
                    for (int i = 0; i < things.Count; i++)
                    {
                        if (things[i] is Pawn p && p != Wearer && !p.Dead && !p.Downed && p.Faction == Wearer.Faction)
                        {
                            count++;
                            if (Extension.alliesMaxCount > 0 && count >= Extension.alliesMaxCount) break;
                        }
                    }
                    if (Extension.alliesMaxCount > 0 && count >= Extension.alliesMaxCount) break;
                }
                deltaPerDay += Extension.alliesRegenPerDayEach * EffectiveRegenMultiplier * count;
            }

            if (deltaPerDay != 0f)
            {
                float deltaAbs = deltaPerDay * MaxCharge * days;
                charge = Mathf.Clamp(charge + deltaAbs, 0f, MaxCharge);
            }
        }

        private static MethodInfo cachedGlowMethod;
        private static float GetGlowAt(Map map, IntVec3 cell)
        {
            if (map?.glowGrid == null) return 0f;
            try
            {
                if (cachedGlowMethod == null)
                {
                    var t = map.glowGrid.GetType();
                    cachedGlowMethod =
                        t.GetMethod("GameGlowAt", new[] { typeof(IntVec3) }) ??
                        t.GetMethod("GameGlowAtFast", new[] { typeof(IntVec3) }) ??
                        t.GetMethod("GlowAt", new[] { typeof(IntVec3) }) ??
                        t.GetMethod("GroundGlowAt", new[] { typeof(IntVec3) });
                }

                if (cachedGlowMethod == null) return 0f;
                object val = cachedGlowMethod.Invoke(map.glowGrid, new object[] { cell });
                return val is float f ? f : 0f;
            }
            catch
            {
                return 0f;
            }
        }

        private void EnsureHediff(bool present)
        {
            if (Extension == null || Extension.associatedHediff == null) return;

            var hediff = Wearer.health.hediffSet.GetFirstHediffOfDef(Extension.associatedHediff);
            if (present && hediff == null)
            {
                Wearer.health.AddHediff(Extension.associatedHediff);
            }
            else if (!present && hediff != null)
            {
                Wearer.health.RemoveHediff(hediff);
            }
        }

        // ================== Transformation Logic ==================

        public override void Notify_Equipped(Pawn pawn)
        {
            base.Notify_Equipped(pawn);
            if (Extension != null)
            {
                if (!Extension.transformationApparel.NullOrEmpty())
                {
                    DoTransformation(pawn);
                }
                
                // Grant Abilities
                if (!Extension.abilities.NullOrEmpty())
                {
                    foreach (var abDef in Extension.abilities)
                    {
                        if (pawn.abilities.GetAbility(abDef) == null)
                        {
                            pawn.abilities.GainAbility(abDef);
                        }
                    }
                }
            }
        }

        public override void Notify_Unequipped(Pawn pawn)
        {
            base.Notify_Unequipped(pawn);
            // Revert transformation
            RevertTransformation(pawn);
            
            // Remove Hediff immediately
            if (Extension != null)
            {
                if (Extension.associatedHediff != null)
                {
                    var hediff = pawn.health.hediffSet.GetFirstHediffOfDef(Extension.associatedHediff);
                    if (hediff != null) pawn.health.RemoveHediff(hediff);
                }

                // Remove Abilities
                if (!Extension.abilities.NullOrEmpty())
                {
                    foreach (var abDef in Extension.abilities)
                    {
                        var ab = pawn.abilities.GetAbility(abDef);
                        if (ab != null)
                        {
                            pawn.abilities.RemoveAbility(abDef);
                        }
                    }
                }
            }
        }

        public void Notify_PawnDied(Pawn pawn)
        {
            // If ring drops, Notify_Unequipped is called? 
            // Usually yes, if the apparel is stripped/dropped. 
            // If the pawn stays as a corpse with the ring, we might need manual cleanup if they are resurrected?
            // For now, assume standard flow.
        }

        private void DoTransformation(Pawn pawn)
        {
            if (pawn.apparel == null) return;

            // 1. Identify items to add
            foreach (ThingDef uniformDef in Extension.transformationApparel)
            {
                // Check if we need to remove anything in that slot
                // Find conflicting apparel
                // We assume the uniform takes up specific layers/parts.
                
                // Simple approach: Check validation for wearing `uniformDef`.
                // If invalid, find what blocks it.
                
                // Ideally, we just look at what the uniform covers and remove anything else there.
                 List<Apparel> conflicts = new List<Apparel>();
                 
                 foreach (Apparel worn in pawn.apparel.WornApparel)
                 {
                     if (worn == parent) continue; // Don't remove the ring itself!
                     if (!ApparelUtility.CanWearTogether(uniformDef, worn.def, pawn.RaceProps.body))
                     {
                         conflicts.Add(worn);
                     }
                 }

                 // 2. Store conflicts
                 foreach (Apparel conflict in conflicts)
                 {
                     if (storedApparel.Contains(conflict)) continue;

                     pawn.apparel.Remove(conflict);
                     storedApparel.TryAdd(conflict, canMergeWithExistingStacks: false);
                 }

                 // 3. Equip new item
                 ThingDef stuff = null;
                 if (uniformDef.MadeFromStuff)
                 {
                     stuff = GenStuff.DefaultStuffFor(uniformDef);
                 }
                 Apparel newGear = (Apparel)ThingMaker.MakeThing(uniformDef, stuff);
                 pawn.apparel.Wear(newGear);
            }
        }

        private void RevertTransformation(Pawn pawn)
        {
            // 1. Remove Transformation Items
            if (pawn.apparel != null && Extension != null)
            {
                for (int i = pawn.apparel.WornApparel.Count - 1; i >= 0; i--)
                {
                    Apparel worn = pawn.apparel.WornApparel[i];
                    if (Extension.transformationApparel.Contains(worn.def))
                    {
                        // Destroy the summon/construct
                        pawn.apparel.Remove(worn);
                        worn.Destroy();
                    }
                }
            }

            // 2. Restore Stored Items
            if (storedApparel != null && pawn.apparel != null)
            {
                var snapshot = storedApparel.InnerListForReading.ToList();
                foreach (var app in snapshot)
                {
                    if (app == null || app.Destroyed) continue;
                    storedApparel.Remove(app);
                    try
                    {
                        pawn.apparel.Wear(app);
                    }
                    catch
                    {
                        if (pawn.Map != null)
                        {
                            GenPlace.TryPlaceThing(app, pawn.Position, pawn.Map, ThingPlaceMode.Near);
                        }
                    }
                }
            }
        }

        public ThingOwner GetDirectlyHeldThings()
        {
            return storedApparel;
        }

        public void GetChildHolders(List<IThingHolder> outChildren)
        {
            // Stored apparel does not contain child holders.
        }

        // ================== Gizmos ==================

        public override IEnumerable<Gizmo> CompGetWornGizmosExtra()
        {
            foreach (var g in base.CompGetWornGizmosExtra()) yield return g;

            // Log.Message($"[LanternsDebug] Checking Gizmos for {parent}: Wearer={Wearer}, Component={Wearer?.IsColonistPlayerControlled}, Ext={Extension}");

            if (Wearer != null && Wearer.IsColonistPlayerControlled)
            {
                if (Extension == null)
                {
                    Log.ErrorOnce($"[LanternsCore] Ring {parent} has no LanternDefExtension!", parent.thingIDNumber);
                    yield break;
                }

                yield return new Gizmo_LanternCharge
                {
                    ringComp = this,
                    label = Extension.resourceLabel,
                    barColor = Extension.ringColor,
                    labelTextColor = Extension.chargeUseLabelColorOverride
                        ? Extension.chargeLabelColorOverride
                        : Extension.ringColor,
                    percentTextColor = Extension.chargeUsePercentColorOverride
                        ? Extension.chargePercentColorOverride
                        : Color.white
                };

                if (Extension.allowBatteryManifest)
                {
                    string labelKey = "Lantern_Command_ManifestBattery";
                    string descKey = "Lantern_Command_ManifestBatteryDesc";
                    yield return new Command_Action
                    {
                        defaultLabel = labelKey.CanTranslate() ? labelKey.Translate() : "GL_Command_ManifestBattery".Translate(),
                        defaultDesc = descKey.CanTranslate() ? descKey.Translate() : "GL_Command_ManifestBatteryDesc".Translate(),
                        icon = TexCommand.DesirePower,
                        action = () => TryManifestBattery()
                    };
                }

                if (LanternCoreMod.Settings?.showRingInspectorGizmo == true)
                {
                    yield return new Command_Action
                    {
                        defaultLabel = "Lantern_RingInfo_Title".Translate(),
                        defaultDesc = "Lantern_RingInfo_Desc".Translate(),
                        icon = TexCommand.DesirePower,
                        action = () =>
                        {
                            Find.WindowStack.Add(new Dialog_MessageBox(BuildInspectorText()));
                        }
                    };
                }

                if (LanternDebug.GizmosEnabled)
                {
                    yield return new Command_Action
                    {
                        defaultLabel = "Debug: Refill Charge",
                        defaultDesc = "Sets ring charge to 100%.",
                        icon = TexCommand.DesirePower,
                        action = () => charge = MaxCharge
                    };
                    yield return new Command_Action
                    {
                        defaultLabel = "Debug: Drain 10%",
                        defaultDesc = "Drains 10% charge.",
                        icon = TexCommand.Attack,
                        action = () => Drain(0.10f)
                    };
                }
            }
        }

        public void TryManifestBattery()
        {
            // Logic similar to original but using Extension.batteryDef
             if (Extension.batteryDef == null) return;
             
             float cost = Extension.batteryManifestCost > 0f ? Extension.batteryManifestCost : 0.5f;
             if (Wearer?.Map == null) return;

             ManifestBatteryManager mgr = Current.Game?.GetComponent<ManifestBatteryManager>();
             if (mgr != null)
             {
                 int global = mgr.CountGlobal(Extension.batteryDef);
                 if (Extension.batteryManifestMaxGlobal > 0 && global >= Extension.batteryManifestMaxGlobal)
                 {
                     Messages.Message("Lantern_ManifestBattery_LimitGlobal".Translate(Extension.batteryManifestMaxGlobal), Wearer, MessageTypeDefOf.RejectInput);
                     return;
                 }

                 int perMap = mgr.CountOnMap(Extension.batteryDef, Wearer.Map);
                 if (Extension.batteryManifestMaxPerMap > 0 && perMap >= Extension.batteryManifestMaxPerMap)
                 {
                     Messages.Message("Lantern_ManifestBattery_LimitPerMap".Translate(Extension.batteryManifestMaxPerMap), Wearer, MessageTypeDefOf.RejectInput);
                     return;
                 }
             }

             float effective = GetEffectiveCostFraction(cost);
             if (ChargePercent < effective)
             {
                 Messages.Message("Lantern_NotEnoughWillpower".Translate(), Wearer, MessageTypeDefOf.RejectInput);
                 return;
             }

             if (!TryConsumeCharge(cost)) return;
             Thing battery = ThingMaker.MakeThing(Extension.batteryDef);
             Thing innerThing = battery;
             Thing spawnThing = battery;
             if (battery.TryMakeMinified() is MinifiedThing minified)
             {
                 innerThing = minified.InnerThing ?? battery;
                 spawnThing = minified;
             }

             GenSpawn.Spawn(spawnThing, Wearer.Position, Wearer.Map);
             mgr?.Register(Extension.batteryDef, innerThing, Wearer.Map);
        }
        
        public bool TryConsumeCharge(float amount)
        {
            if (!IsActive) return false;
            // Cheats: if (!LanternMod.settings.consumeEnergy) return true;
            float absAmount = GetEffectiveCostFraction(amount) * MaxCharge;
            if (charge >= absAmount)
            {
                charge -= absAmount;
                return true;
            }
            return false;
        }

        public void Drain(float amount)
        {
             float mult = Mathf.Max(0f, LanternCoreMod.Settings?.drainMultiplier ?? 1f);
             charge = Mathf.Max(0f, charge - Mathf.Max(0f, amount) * mult * MaxCharge);
        }

        private string BuildInspectorText()
        {
            var ext = Extension;
            if (ext == null) return "Missing LanternDefExtension.";

            string lines = $"Ring: {parent.def.defName}\n" +
                           $"Charge: {ChargePercent:P0} ({charge:0.##} / {MaxCharge:0.##})\n" +
                           $"Active: {IsActive}\n\n";

            lines += "Charge model (per day, fractions of max):\n";
            lines += $"- Passive regen: {ext.passiveRegenPerDay * EffectiveRegenMultiplier:0.###}\n";
            lines += $"- Passive drain: {ext.passiveDrainPerDay * EffectiveDrainMultiplier:0.###}\n";

            if (Wearer != null)
            {
                if (ext.regenFromMood && Wearer.needs?.mood != null)
                {
                    float mood = Wearer.needs.mood.CurLevelPercentage;
                    lines += $"- Mood regen: {(mood >= ext.moodMin ? "ON" : "off")} (mood {mood:P0}, min {ext.moodMin:P0}, rate {ext.moodRegenPerDay * EffectiveRegenMultiplier:0.###})\n";
                }
                if (ext.regenFromPain && Wearer.health?.hediffSet != null)
                {
                    float pain = Wearer.health.hediffSet.PainTotal;
                    lines += $"- Pain regen: {(pain >= ext.painMin ? "ON" : "off")} (pain {pain:P0}, min {ext.painMin:P0}, rate {ext.painRegenPerDay * EffectiveRegenMultiplier:0.###})\n";
                }
                if (ext.regenFromSunlight && Wearer.Map != null)
                {
                    float glow = GetGlowAt(Wearer.Map, Wearer.Position);
                    lines += $"- Sunlight regen: {(glow >= ext.sunlightMinGlow ? "ON" : "off")} (glow {glow:0.##}, min {ext.sunlightMinGlow:0.##}, rate {ext.sunlightRegenPerDay * EffectiveRegenMultiplier:0.###})\n";
                }
                if (ext.regenFromPsyfocus && Wearer.psychicEntropy != null)
                {
                    float psy = Wearer.psychicEntropy.CurrentPsyfocus;
                    lines += $"- Psyfocus regen: {(psy >= ext.psyfocusMin ? "ON" : "off")} (psy {psy:P0}, min {ext.psyfocusMin:P0}, rate {ext.psyfocusRegenPerDay * EffectiveRegenMultiplier:0.###})\n";
                }
                if (ext.regenFromNearbyAllies)
                {
                    lines += $"- Allies regen: radius {ext.alliesRadius}, each {ext.alliesRegenPerDayEach * EffectiveRegenMultiplier:0.###}, maxCount {(ext.alliesMaxCount <= 0 ? "unlimited" : ext.alliesMaxCount.ToString())}\n";
                }
            }

            lines += $"\nBalance settings:\n- Cost mult: {EffectiveCostMultiplier:0.##}\n- Regen mult: {EffectiveRegenMultiplier:0.##}\n- Drain mult: {EffectiveDrainMultiplier:0.##}\n";

            lines += "\nProtection:\n";
            lines += $"- Block hediffs: {ext.blockEnvironmentalHediffs} (cost {GetEffectiveCostFraction(ext.blockEnvironmentalHediffsCost):0.###})\n";
            lines += $"- Absorb env damage: {ext.absorbEnvironmentalDamage} (cost {GetEffectiveCostFraction(ext.absorbEnvironmentalDamageCost):0.###})\n";
            lines += $"- Absorb combat damage: {ext.absorbCombatDamage} (cost {GetEffectiveCostFraction(ext.absorbCombatDamageCost):0.###})\n";

            if (LanternCoreMod.Settings?.disableEnvironmentalProtectionGlobally == true)
            {
                lines += "- NOTE: Environmental protection is globally disabled in mod settings.\n";
            }
            if (LanternCoreMod.Settings?.disableCombatAbsorbGlobally == true)
            {
                lines += "- NOTE: Combat absorption is globally disabled in mod settings.\n";
            }

            return lines;
        }

        public int GetBlastDamage()
        {
            return Extension != null ? Extension.blastDamage : 10;
        }

        public DamageDef GetBlastDamageType()
        {
            if (Extension != null && Extension.blastDamageType != null)
            {
                return Extension.blastDamageType;
            }
            return DamageDefOf.Burn;
        }

        // ================== Saving ==================

        public override void PostExposeData()
        {
            base.PostExposeData();
            Scribe_Values.Look(ref chargeSaveVersion, "chargeSaveVersion", 1);
            Scribe_Values.Look(ref charge, "charge", 1.0f);
            if (Scribe.mode == LoadSaveMode.LoadingVars && chargeSaveVersion <= 1)
            {
                charge = Mathf.Clamp01(charge) * MaxCharge;
                chargeSaveVersion = 2;
            }
            if (Scribe.mode == LoadSaveMode.Saving)
            {
                chargeSaveVersion = 2;
            }
            charge = Mathf.Clamp(charge, 0f, MaxCharge);
            Scribe_Deep.Look(ref storedApparel, "storedApparel", this);
            if (storedApparel == null)
            {
                storedApparel = new ThingOwner<Apparel>(this, oneStackOnly: false);
            }
        }
    }
    
    // ================== UI Class ==================
    [StaticConstructorOnStartup]
    public class Gizmo_LanternCharge : Gizmo
    {
        public CompLanternRing ringComp;
        public string label;
        public Color barColor;
        public Color labelTextColor = Color.white;
        public Color percentTextColor = Color.white;

        private static readonly Texture2D EmptyBarTex = SolidColorMaterials.NewSolidColorTexture(Color.gray);
        private Texture2D cachedFillTex;
        private Color lastColor;

        public override float GetWidth(float maxWidth) => 140f;

        public override GizmoResult GizmoOnGUI(Vector2 topLeft, float maxWidth, GizmoRenderParms parms)
        {
            Rect rect = new Rect(topLeft.x, topLeft.y, GetWidth(maxWidth), 75f);
            Widgets.DrawWindowBackground(rect);
            
            Rect barRect = rect.ContractedBy(10f);
            barRect.height = 30f;
            barRect.y += 10f;

            if (barColor != lastColor || cachedFillTex == null)
            {
                lastColor = barColor;
                cachedFillTex = SolidColorMaterials.NewSolidColorTexture(barColor);
            }
            Widgets.FillableBar(barRect, ringComp.ChargePercent, cachedFillTex, EmptyBarTex, true);
            
            Text.Font = GameFont.Small;
            Text.Anchor = TextAnchor.MiddleCenter;
            GUI.color = percentTextColor;
            Widgets.Label(barRect, $"{ringComp.ChargePercent:P0}");
            
            Rect labelRect = new Rect(rect.x, rect.y + 5, rect.width, 20f);
            Text.Font = GameFont.Tiny;
            Text.Anchor = TextAnchor.UpperCenter;
            GUI.color = labelTextColor;
            Widgets.Label(labelRect, label);
            GUI.color = Color.white;
            Text.Anchor = TextAnchor.UpperLeft;

            return new GizmoResult(GizmoState.Clear);
        }
    }
}
