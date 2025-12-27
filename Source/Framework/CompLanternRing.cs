using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using RimWorld;
using UnityEngine;
using Verse;
using DrAke.LanternsFramework.Recharge;
using DrAke.LanternsFramework.Abilities;

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

        private bool transformationApplied = false;
        private bool bodyTypeOverridden = false;
        private BodyTypeDef originalBodyType;
        private bool transformationManualEnabled = true;
        private bool transformationManualInitialized = false;

        private bool reactiveEvadeEnabled = true;
        private bool reactiveEvadeInitialized = false;
        private int lastReactiveEvadeTick = -999999;

        // Stealth / Veil state
        private float stealthEnergy = 1.0f;
        private bool stealthActive = false;
        private bool stealthInitialized = false;
        private int stealthEnergyTickAccumulator = 0;

        // Corruption / attention
        private int corruptionTickAccumulator = 0;
        private float attentionLevel = 0f;

        private Dictionary<string, AbilityCastTracker> abilityCastRecords = new Dictionary<string, AbilityCastTracker>();

        private int wornGraphicCheckTick = -999999;
        private BodyTypeDef wornGraphicCheckBodyType;
        private bool wornGraphicCheckOk = true;

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

        public float StealthEnergyMax => Mathf.Max(0.001f, Extension?.stealthEnergyMax ?? 1f);
        public float StealthEnergyPercent => Mathf.Clamp01(stealthEnergy / StealthEnergyMax);
        public bool StealthActive => stealthActive;
        public float AttentionLevel => attentionLevel;

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

            TickCorruptionModel();

            TickStealthModel();

            TickTransformationConditions();
        }

        public override void Initialize(CompProperties props)
        {
            base.Initialize(props);
            if (storedApparel == null)
            {
                storedApparel = new ThingOwner<Apparel>(this, oneStackOnly: false);
            }

            if (!transformationManualInitialized)
            {
                transformationManualInitialized = true;
                transformationManualEnabled = Extension?.transformationToggleDefaultOn ?? true;
            }

            if (!reactiveEvadeInitialized)
            {
                reactiveEvadeInitialized = true;
                reactiveEvadeEnabled = Extension?.reactiveEvadeDefaultEnabled ?? true;
            }

            if (!stealthInitialized)
            {
                stealthInitialized = true;
                float startPct = Mathf.Clamp01(Extension?.stealthEnergyStartPercent ?? 1f);
                stealthEnergy = StealthEnergyMax * startPct;
                stealthActive = Extension?.stealthDefaultOn ?? false;
                if (Extension?.stealthEnabled != true) stealthActive = false;
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

        private void TickCorruptionModel()
        {
            var ext = Extension;
            if (ext == null || ext.corruptionHediff == null) return;
            Pawn wearer = Wearer;
            if (wearer == null || wearer.Dead || wearer.health?.hediffSet == null)
            {
                attentionLevel = 0f;
                return;
            }

            int intervalTicks = Mathf.Max(1, (int)(Mathf.Max(0.1f, ext.corruptionTickIntervalSeconds) * 60f));
            corruptionTickAccumulator++;
            if (corruptionTickAccumulator < intervalTicks)
            {
                UpdateAttentionFromCorruption(wearer);
                return;
            }

            int ticks = corruptionTickAccumulator;
            corruptionTickAccumulator = 0;

            Hediff corruption = wearer.health.hediffSet.GetFirstHediffOfDef(ext.corruptionHediff);
            if (corruption == null)
            {
                corruption = wearer.health.AddHediff(ext.corruptionHediff);
                corruption.Severity = Mathf.Clamp01(ext.corruptionInitialSeverity);
            }

            float perDay = Mathf.Max(0f, ext.corruptionGainPerDay);
            if (stealthActive && ext.corruptionStealthMultiplier != 1f)
            {
                perDay *= ext.corruptionStealthMultiplier;
            }

            if (perDay > 0f)
            {
                float delta = perDay * (ticks / (float)GenDate.TicksPerDay);
                corruption.Severity = Mathf.Clamp01(corruption.Severity + delta);
            }

            UpdateAttentionFromCorruption(wearer, corruption);
            TryCorruptionMentalStates(wearer, corruption.Severity);
        }

        private void UpdateAttentionFromCorruption(Pawn wearer, Hediff corruption = null)
        {
            if (wearer == null || Extension == null)
            {
                attentionLevel = 0f;
                return;
            }

            if (corruption == null && Extension.corruptionHediff != null && wearer.health?.hediffSet != null)
            {
                corruption = wearer.health.hediffSet.GetFirstHediffOfDef(Extension.corruptionHediff);
            }

            if (corruption == null)
            {
                attentionLevel = 0f;
                return;
            }

            float mult = Mathf.Max(0f, Extension.attentionMultiplier);
            float level = corruption.Severity * mult;
            if (stealthActive && Extension.corruptionStealthMultiplier != 1f)
            {
                level *= Extension.corruptionStealthMultiplier;
            }
            attentionLevel = Mathf.Clamp01(level);
        }

        private void TryCorruptionMentalStates(Pawn wearer, float severity)
        {
            if (Extension == null || Extension.corruptionMentalStates.NullOrEmpty()) return;
            if (wearer?.mindState?.mentalStateHandler == null) return;

            for (int i = 0; i < Extension.corruptionMentalStates.Count; i++)
            {
                LanternMentalStateTrigger trigger = Extension.corruptionMentalStates[i];
                if (trigger?.mentalState == null) continue;
                if (severity < trigger.minSeverity || severity > trigger.maxSeverity) continue;

                int interval = Mathf.Max(1, trigger.checkIntervalTicks);
                if (!wearer.IsHashIntervalTick(interval)) continue;

                if (trigger.requireNotAlreadyInState && wearer.mindState.mentalStateHandler.CurStateDef == trigger.mentalState)
                {
                    continue;
                }

                if (Rand.Value < Mathf.Clamp01(trigger.chancePerCheck))
                {
                    wearer.mindState.mentalStateHandler.TryStartMentalState(trigger.mentalState, null, true);
                }
            }
        }

        private void TickStealthModel()
        {
            var ext = Extension;
            if (ext == null || !ext.stealthEnabled || ext.stealthHediff == null)
            {
                if (stealthActive)
                {
                    ForceDisableStealth(Wearer);
                }
                return;
            }

            Pawn wearer = Wearer;
            if (wearer == null || wearer.Dead || wearer.health?.hediffSet == null)
            {
                if (stealthActive)
                {
                    ForceDisableStealth(wearer);
                }
                return;
            }

            if (!IsActive)
            {
                if (stealthActive)
                {
                    ForceDisableStealth(wearer);
                }
                return;
            }

            bool hasHediff = wearer.health.hediffSet.GetFirstHediffOfDef(ext.stealthHediff) != null;

            if (!ext.stealthToggleGizmo)
            {
                bool shouldBeActive = stealthEnergy > 0f;
                if (shouldBeActive && !stealthActive)
                {
                    SetStealthActive(wearer, true);
                }
                else if (!shouldBeActive && stealthActive)
                {
                    ForceDisableStealth(wearer);
                }
            }

            if (stealthActive && !hasHediff)
            {
                ApplyStealthHediff(wearer);
            }
            else if (!stealthActive && hasHediff && ext.stealthToggleGizmo)
            {
                stealthActive = true;
            }

            stealthEnergyTickAccumulator++;
            if (stealthEnergyTickAccumulator < 60) return;
            int ticks = stealthEnergyTickAccumulator;
            stealthEnergyTickAccumulator = 0;

            if (stealthActive)
            {
                float drainPerSecond = Mathf.Max(0f, ext.stealthEnergyDrainPerSecond);
                if (drainPerSecond > 0f)
                {
                    float seconds = ticks / 60f;
                    float delta = drainPerSecond * seconds * StealthEnergyMax;
                    stealthEnergy = Mathf.Max(0f, stealthEnergy - delta);
                }

                if (stealthEnergy <= 0f)
                {
                    ForceDisableStealth(wearer);
                    Messages.Message("Lantern_StealthEnded_NoEnergy".Translate(), wearer, MessageTypeDefOf.NeutralEvent);
                }
            }
            else
            {
                float regenPerDay = Mathf.Max(0f, ext.stealthEnergyRegenPerDay);
                if (regenPerDay > 0f)
                {
                    float days = ticks / (float)GenDate.TicksPerDay;
                    float delta = regenPerDay * days * StealthEnergyMax;
                    stealthEnergy = Mathf.Min(StealthEnergyMax, stealthEnergy + delta);
                }
            }

            stealthEnergy = Mathf.Clamp(stealthEnergy, 0f, StealthEnergyMax);
        }

        private void SetStealthActive(Pawn pawn, bool active)
        {
            if (Extension == null || !Extension.stealthEnabled || Extension.stealthHediff == null) return;
            if (active && stealthEnergy <= 0f) return;

            stealthActive = active;
            if (active)
            {
                ApplyStealthHediff(pawn);
            }
            else
            {
                RemoveStealthHediff(pawn);
            }
        }

        private void ApplyStealthHediff(Pawn pawn)
        {
            if (pawn?.health?.hediffSet == null || Extension?.stealthHediff == null) return;
            if (pawn.health.hediffSet.GetFirstHediffOfDef(Extension.stealthHediff) != null) return;
            pawn.health.AddHediff(Extension.stealthHediff);
        }

        private void RemoveStealthHediff(Pawn pawn)
        {
            if (pawn?.health?.hediffSet == null || Extension?.stealthHediff == null) return;
            Hediff invis = pawn.health.hediffSet.GetFirstHediffOfDef(Extension.stealthHediff);
            if (invis != null)
            {
                pawn.health.RemoveHediff(invis);
            }
        }

        public void ForceDisableStealth(Pawn pawn)
        {
            stealthActive = false;
            RemoveStealthHediff(pawn);
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
            if (Extension == null) return;
            if (Wearer?.health?.hediffSet == null) return;

            IEnumerable<HediffDef> defs = GetWornHediffs();
            foreach (var def in defs)
            {
                if (def == null) continue;
                var hediff = Wearer.health.hediffSet.GetFirstHediffOfDef(def);
                if (present && hediff == null)
                {
                    Wearer.health.AddHediff(def);
                }
                else if (!present && hediff != null)
                {
                    Wearer.health.RemoveHediff(hediff);
                }
            }
        }

        private IEnumerable<HediffDef> GetWornHediffs()
        {
            if (Extension == null) yield break;
            if (Extension.associatedHediff != null) yield return Extension.associatedHediff;
            if (!Extension.hediffsWhileWorn.NullOrEmpty())
            {
                foreach (var h in Extension.hediffsWhileWorn)
                {
                    if (h != null) yield return h;
                }
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
                    if (ShouldApplyTransformation(pawn))
                    {
                        DoTransformation(pawn);
                        transformationApplied = true;
                    }
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

                if (Extension.stealthEnabled && Extension.stealthHediff != null)
                {
                    if (!Extension.stealthToggleGizmo)
                    {
                        SetStealthActive(pawn, true);
                    }
                    else if (stealthActive)
                    {
                        SetStealthActive(pawn, true);
                    }
                }
            }
        }

        public override void Notify_Unequipped(Pawn pawn)
        {
            base.Notify_Unequipped(pawn);
            // Revert transformation
            RevertTransformation(pawn);
            transformationApplied = false;

            ForceDisableStealth(pawn);
            attentionLevel = 0f;
            
            // Remove Hediff immediately
            if (Extension != null)
            {
                if (pawn.health?.hediffSet != null)
                {
                    foreach (var def in GetWornHediffs())
                    {
                        if (def == null) continue;
                        var hediff = pawn.health.hediffSet.GetFirstHediffOfDef(def);
                        if (hediff != null) pawn.health.RemoveHediff(hediff);
                    }
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

        public override void Notify_WearerDied()
        {
            base.Notify_WearerDied();

            if (Extension?.forceDropOnWearerDeath != true) return;

            Apparel ring = parent as Apparel;
            Pawn pawn = ring?.Wearer;
            if (pawn == null || pawn.apparel == null) return;

            pawn.apparel.TryDrop(ring, out _, pawn.PositionHeld, false);
        }

        private void DoTransformation(Pawn pawn)
        {
            if (pawn.apparel == null) return;
            TryApplyBodyTypeOverride(pawn);

            // 1. Identify items to add
            foreach (ThingDef uniformDef in Extension.transformationApparel)
            {
                if (uniformDef == null) continue;

                if (Extension.transformationSkipConflictingApparel)
                {
                    if (!pawn.apparel.CanWearWithoutDroppingAnything(uniformDef))
                    {
                        continue;
                    }
                }

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
                     if (!Extension.transformationSkipConflictingApparel && !ApparelUtility.CanWearTogether(uniformDef, worn.def, pawn.RaceProps.body))
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

            // Restore body type before we put original apparel back on.
            TryRestoreBodyTypeOverride(pawn);

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

        private void TickTransformationConditions()
        {
            if (Wearer == null) return;
            if (Extension == null) return;
            if (Extension.transformationApparel.NullOrEmpty()) return;

            if (Extension.transformationToggleGizmo && !transformationManualEnabled)
            {
                if (transformationApplied)
                {
                    RevertTransformation(Wearer);
                    transformationApplied = false;
                }
                return;
            }

            bool should = ShouldApplyTransformation(Wearer);
            if (should && !transformationApplied)
            {
                DoTransformation(Wearer);
                transformationApplied = true;
            }
            else if (!should && transformationApplied)
            {
                RevertTransformation(Wearer);
                transformationApplied = false;
            }
        }

        private bool ShouldApplyTransformation(Pawn pawn)
        {
            if (pawn == null) return false;
            if (pawn.Dead) return false;
            if (pawn.apparel == null) return false;

            if (Extension != null)
            {
                // Gender filter
                if (pawn.gender == Gender.Male && !Extension.transformationAllowMaleGender) return false;
                if (pawn.gender == Gender.Female && !Extension.transformationAllowFemaleGender) return false;
                if (pawn.gender == Gender.None && !Extension.transformationAllowNoneGender) return false;

                // Body type filters
                var bt = pawn.story?.bodyType;
                if (bt != null)
                {
                    if (!Extension.transformationAllowedBodyTypes.NullOrEmpty() && !Extension.transformationAllowedBodyTypes.Contains(bt)) return false;
                    if (!Extension.transformationDisallowedBodyTypes.NullOrEmpty() && Extension.transformationDisallowedBodyTypes.Contains(bt)) return false;
                }

                // If the add-on wants to avoid "missing worn graphic" visuals and is NOT using the body type override, skip transforming.
                if (!Extension.transformationOverrideBodyType && Extension.transformationSkipIfMissingWornGraphic)
                {
                    if (bt != null && !CachedTransformationGraphicsWorkForBodyType(pawn, bt))
                    {
                        return false;
                    }
                }
            }

            if (Extension != null && Extension.transformationOnlyWhenDrafted)
            {
                if (pawn.drafter == null) return false;
                if (!pawn.drafter.Drafted) return false;
            }
            return true;
        }

        private bool CachedTransformationGraphicsWorkForBodyType(Pawn pawn, BodyTypeDef bodyType)
        {
            int now = Find.TickManager?.TicksGame ?? 0;
            if (wornGraphicCheckBodyType == bodyType && now - wornGraphicCheckTick < 600)
            {
                return wornGraphicCheckOk;
            }

            wornGraphicCheckTick = now;
            wornGraphicCheckBodyType = bodyType;
            wornGraphicCheckOk = TransformationGraphicsWorkForBodyType(pawn, bodyType);
            return wornGraphicCheckOk;
        }

        private void TryApplyBodyTypeOverride(Pawn pawn)
        {
            if (pawn?.story == null) return;
            if (Extension == null) return;
            if (!Extension.transformationOverrideBodyType) return;
            if (Extension.transformationBodyTypeOverride == null) return;

            if (Extension.transformationOverrideBodyTypeOnlyIfMissing)
            {
                var current = pawn.story.bodyType;
                if (current != null && TransformationGraphicsWorkForBodyType(pawn, current))
                {
                    return;
                }
            }

            if (!bodyTypeOverridden)
            {
                originalBodyType = pawn.story.bodyType;
                bodyTypeOverridden = true;
            }

            if (pawn.story.bodyType != Extension.transformationBodyTypeOverride)
            {
                pawn.story.bodyType = Extension.transformationBodyTypeOverride;
                pawn.Drawer?.renderer?.SetAllGraphicsDirty();
            }
        }

        private bool TransformationGraphicsWorkForBodyType(Pawn pawn, BodyTypeDef bodyType)
        {
            if (pawn == null || bodyType == null) return true;
            if (Extension == null) return true;
            if (Extension.transformationApparel.NullOrEmpty()) return true;

            foreach (var def in Extension.transformationApparel)
            {
                if (def == null) continue;
                if (!ApparelHasGraphicForBodyType(pawn, def, bodyType))
                {
                    return false;
                }
            }
            return true;
        }

        private static bool ApparelHasGraphicForBodyType(Pawn pawn, ThingDef apparelDef, BodyTypeDef bodyType)
        {
            if (pawn == null || apparelDef == null || bodyType == null) return true;
            if (apparelDef.thingClass == null || !typeof(Apparel).IsAssignableFrom(apparelDef.thingClass)) return true;

            ThingDef stuff = null;
            if (apparelDef.MadeFromStuff)
            {
                stuff = GenStuff.DefaultStuffFor(apparelDef);
            }

            Apparel apparel = null;
            try
            {
                apparel = ThingMaker.MakeThing(apparelDef, stuff) as Apparel;
                if (apparel == null) return true;
                ApparelGraphicRecord rec;
                return ApparelGraphicRecordGetter.TryGetGraphicApparel(apparel, bodyType, true, out rec);
            }
            catch
            {
                // If graphics probing fails for any reason, do not block transformation.
                return true;
            }
            finally
            {
                apparel?.Destroy();
            }
        }

        private void TryRestoreBodyTypeOverride(Pawn pawn)
        {
            if (!bodyTypeOverridden) return;
            if (pawn?.story == null) return;

            if (originalBodyType != null && pawn.story.bodyType != originalBodyType)
            {
                pawn.story.bodyType = originalBodyType;
                pawn.Drawer?.renderer?.SetAllGraphicsDirty();
            }

            bodyTypeOverridden = false;
            originalBodyType = null;
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

                if (Extension.showChargeGizmo)
                {
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
                }

                if (Extension.stealthEnabled && Extension.stealthShowEnergyGizmo)
                {
                    yield return new Gizmo_LanternMeter
                    {
                        label = Extension.stealthEnergyLabel,
                        barColor = Extension.stealthEnergyColor,
                        labelTextColor = Extension.stealthEnergyColor,
                        percentTextColor = Color.white,
                        percentGetter = () => StealthEnergyPercent
                    };
                }

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

                if (Extension.transformationToggleGizmo && !Extension.transformationApparel.NullOrEmpty())
                {
                    yield return new Command_Toggle
                    {
                        defaultLabel = "Lantern_Command_ToggleTransformation".Translate(),
                        defaultDesc = "Lantern_Command_ToggleTransformationDesc".Translate(),
                        icon = TexCommand.DesirePower,
                        isActive = () => transformationManualEnabled,
                        toggleAction = () =>
                        {
                            transformationManualEnabled = !transformationManualEnabled;
                            if (!transformationManualEnabled)
                            {
                                if (transformationApplied)
                                {
                                    RevertTransformation(Wearer);
                                    transformationApplied = false;
                                }
                            }
                            else
                            {
                                if (ShouldApplyTransformation(Wearer) && !transformationApplied)
                                {
                                    DoTransformation(Wearer);
                                    transformationApplied = true;
                                }
                            }
                        }
                    };
                }

                if (Extension.stealthEnabled && Extension.stealthHediff != null && Extension.stealthToggleGizmo)
                {
                    string labelKey = Extension.stealthGizmoLabelKey.NullOrEmpty() ? "Lantern_Command_ToggleStealth" : Extension.stealthGizmoLabelKey;
                    string descKey = Extension.stealthGizmoDescKey.NullOrEmpty() ? "Lantern_Command_ToggleStealthDesc" : Extension.stealthGizmoDescKey;
                    Texture2D icon = !Extension.stealthGizmoIconPath.NullOrEmpty()
                        ? ContentFinder<Texture2D>.Get(Extension.stealthGizmoIconPath, true)
                        : TexCommand.DesirePower;

                    yield return new Command_Toggle
                    {
                        defaultLabel = labelKey.CanTranslate() ? labelKey.Translate() : labelKey,
                        defaultDesc = descKey.CanTranslate() ? descKey.Translate() : descKey,
                        icon = icon,
                        isActive = () => stealthActive,
                        toggleAction = () => SetStealthActive(Wearer, !stealthActive),
                        Disabled = !stealthActive && stealthEnergy <= 0f,
                        disabledReason = "Lantern_Command_ToggleStealth_Disabled".Translate()
                    };
                }

                if (Extension.reactiveEvadeToggleGizmo && Extension.reactiveEvadeProjectiles)
                {
                    yield return new Command_Toggle
                    {
                        defaultLabel = "Lantern_Command_ToggleReactiveEvade".Translate(),
                        defaultDesc = "Lantern_Command_ToggleReactiveEvadeDesc".Translate(),
                        icon = TexCommand.DesirePower,
                        isActive = () => reactiveEvadeEnabled,
                        toggleAction = () => reactiveEvadeEnabled = !reactiveEvadeEnabled
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

            if (ext.stealthEnabled)
            {
                lines += "\nStealth:\n";
                lines += $"- Active: {stealthActive}\n";
                lines += $"- Energy: {StealthEnergyPercent:P0} ({stealthEnergy:0.##} / {StealthEnergyMax:0.##})\n";
            }

            if (ext.corruptionHediff != null && Wearer?.health?.hediffSet != null)
            {
                Hediff corr = Wearer.health.hediffSet.GetFirstHediffOfDef(ext.corruptionHediff);
                float sev = corr?.Severity ?? 0f;
                lines += "\nCorruption:\n";
                lines += $"- Severity: {sev:P0}\n";
                lines += $"- Attention: {attentionLevel:P0}\n";
            }

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
            Scribe_Values.Look(ref chargeModelTickAccumulator, "chargeModelTickAccumulator", 0);
            Scribe_Values.Look(ref transformationApplied, "transformationApplied", false);
            Scribe_Values.Look(ref bodyTypeOverridden, "bodyTypeOverridden", false);
            Scribe_Defs.Look(ref originalBodyType, "originalBodyType");
            Scribe_Values.Look(ref transformationManualEnabled, "transformationManualEnabled", true);
            Scribe_Values.Look(ref transformationManualInitialized, "transformationManualInitialized", false);
            Scribe_Collections.Look(ref abilityCastRecords, "abilityCastRecords", LookMode.Value, LookMode.Deep);
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
            if (abilityCastRecords == null)
            {
                abilityCastRecords = new Dictionary<string, AbilityCastTracker>();
            }
            Scribe_Values.Look(ref reactiveEvadeEnabled, "reactiveEvadeEnabled", true);
            Scribe_Values.Look(ref reactiveEvadeInitialized, "reactiveEvadeInitialized", false);
            Scribe_Values.Look(ref lastReactiveEvadeTick, "lastReactiveEvadeTick", -999999);
            Scribe_Values.Look(ref stealthEnergy, "stealthEnergy", 1.0f);
            Scribe_Values.Look(ref stealthActive, "stealthActive", false);
            Scribe_Values.Look(ref stealthInitialized, "stealthInitialized", false);
            Scribe_Values.Look(ref stealthEnergyTickAccumulator, "stealthEnergyTickAccumulator", 0);
            Scribe_Values.Look(ref corruptionTickAccumulator, "corruptionTickAccumulator", 0);
            Scribe_Values.Look(ref attentionLevel, "attentionLevel", 0f);

            if (Scribe.mode == LoadSaveMode.PostLoadInit)
            {
                stealthEnergy = Mathf.Clamp(stealthEnergy, 0f, StealthEnergyMax);
                attentionLevel = Mathf.Clamp01(attentionLevel);
            }
        }

        public bool CanCastWithLimits(AbilityDef abilityDef, int cooldownTicks, int maxCastsPerDay, out string reason)
        {
            reason = null;
            if (abilityDef == null) return true;
            if (cooldownTicks <= 0 && maxCastsPerDay <= 0) return true;

            int now = Find.TickManager?.TicksGame ?? 0;
            int day = GenDate.DayOfYear(Find.TickManager?.TicksAbs ?? 0L, 0f);

            AbilityCastTracker tr = GetOrCreateTracker(abilityDef.defName);
            tr.ResetIfNewDay(day);

            if (cooldownTicks > 0 && now < tr.nextAllowedTick)
            {
                int ticksLeft = tr.nextAllowedTick - now;
                float seconds = ticksLeft / 60f;
                reason = $"On cooldown ({seconds:0.#}s).";
                return false;
            }

            if (maxCastsPerDay > 0 && tr.castsToday >= maxCastsPerDay)
            {
                reason = "Daily cast limit reached.";
                return false;
            }

            return true;
        }

        public void RecordCast(AbilityDef abilityDef, int cooldownTicks, int maxCastsPerDay)
        {
            if (abilityDef == null) return;
            if (cooldownTicks <= 0 && maxCastsPerDay <= 0) return;

            int now = Find.TickManager?.TicksGame ?? 0;
            int day = GenDate.DayOfYear(Find.TickManager?.TicksAbs ?? 0L, 0f);

            AbilityCastTracker tr = GetOrCreateTracker(abilityDef.defName);
            tr.ResetIfNewDay(day);

            if (maxCastsPerDay > 0)
            {
                tr.castsToday++;
            }
            if (cooldownTicks > 0)
            {
                tr.nextAllowedTick = now + cooldownTicks;
            }
        }

        private AbilityCastTracker GetOrCreateTracker(string abilityDefName)
        {
            if (abilityCastRecords == null) abilityCastRecords = new Dictionary<string, AbilityCastTracker>();
            if (abilityDefName.NullOrEmpty()) abilityDefName = "UnknownAbility";
            if (!abilityCastRecords.TryGetValue(abilityDefName, out var tr) || tr == null)
            {
                tr = new AbilityCastTracker();
                abilityCastRecords[abilityDefName] = tr;
            }
            return tr;
        }

        public bool TryReactiveEvadeProjectile(Projectile projectile, Pawn hitPawn)
        {
            if (hitPawn == null || hitPawn.Dead) return false;
            if (Wearer != hitPawn) return false;
            if (!IsActive) return false;

            var ext = Extension;
            if (ext == null || !ext.reactiveEvadeProjectiles) return false;
            if (ext.reactiveEvadeToggleGizmo && !reactiveEvadeEnabled) return false;

            if (projectile?.def?.projectile != null)
            {
                if (!ext.reactiveEvadeAllowExplosiveProjectiles && projectile.def.projectile.explosionRadius > 0f)
                {
                    return false;
                }
            }

            int now = Find.TickManager?.TicksGame ?? 0;
            int cooldown = Mathf.Max(0, ext.reactiveEvadeProjectilesCooldownTicks);
            if (cooldown > 0 && now < lastReactiveEvadeTick + cooldown) return false;

            float cost = Mathf.Max(0f, ext.reactiveEvadeProjectilesCost);
            if (cost > 0f && !TryConsumeCharge(cost)) return false;

            lastReactiveEvadeTick = now;

            if (Wearer?.Map != null)
            {
                float radius = Mathf.Max(0f, ext.reactiveEvadeGasRadius);
                int amount = Mathf.Clamp(ext.reactiveEvadeGasAmount, 0, 1000);
                if (radius > 0f && amount > 0)
                {
                    GenExplosion.DoExplosion(
                        Wearer.Position,
                        Wearer.Map,
                        radius,
                        DamageDefOf.Smoke,
                        Wearer,
                        postExplosionGasType: ext.reactiveEvadeGasType,
                        postExplosionGasAmount: amount);
                }
            }

            return true;
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

    // Generic meter for secondary resources (stealth/veil energy, etc.).
    [StaticConstructorOnStartup]
    public class Gizmo_LanternMeter : Gizmo
    {
        public Func<float> percentGetter;
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
            float percent = percentGetter != null ? Mathf.Clamp01(percentGetter()) : 0f;
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
            Widgets.FillableBar(barRect, percent, cachedFillTex, EmptyBarTex, true);

            Text.Font = GameFont.Small;
            Text.Anchor = TextAnchor.MiddleCenter;
            GUI.color = percentTextColor;
            Widgets.Label(barRect, $"{percent:P0}");

            Rect labelRect = new Rect(rect.x, rect.y + 5, rect.width, 20f);
            Text.Font = GameFont.Tiny;
            Text.Anchor = TextAnchor.UpperCenter;
            GUI.color = labelTextColor;
            Widgets.Label(labelRect, label ?? string.Empty);
            GUI.color = Color.white;
            Text.Anchor = TextAnchor.UpperLeft;

            return new GizmoResult(GizmoState.Clear);
        }
    }
}
