using HarmonyLib;
using RimWorld;
using UnityEngine;
using Verse;
using Verse.AI;
using System;
using System.Collections.Generic;
using System.Linq;
using RimWorld.Planet;
using DrAke.LanternsFramework.Flight;
using DrAke.LanternsFramework.Abilities;

namespace DrAke.LanternsFramework.HarmonyPatches
{
    // ... existing content ...

    // ================== Flight System Fixes ==================
    
    // Fix: Game Over loop when solo pawn is flying
    [HarmonyPatch(typeof(PawnsFinder), "get_AllMapsCaravansAndTravellingTransporters_Alive_OfPlayerFaction")]
    public static class Patch_PawnsFinder_AllMapsCaravansAndTravellingTransporters_Alive_OfPlayerFaction
    {
        public static void Postfix(ref List<Pawn> __result)
        {
            try
            {
               LanternHarmonyPatchUtils.AddLanternFlightPawns(ref __result);
            }
            catch (Exception ex)
            {
               Log.ErrorOnce("[LanternsCore] Error in PawnsFinder patch (Alive_OfPlayerFaction): " + ex.Message, 934029);
            }
        }
    }

    [HarmonyPatch(typeof(PawnsFinder), "get_AllMapsCaravansAndTravellingTransporters_Alive")]
    public static class Patch_PawnsFinder_AllMapsCaravansAndTravellingTransporters_Alive
    {
        public static void Postfix(ref List<Pawn> __result)
        {
            try
            {
               LanternHarmonyPatchUtils.AddLanternFlightPawns(ref __result);
            }
            catch (Exception ex)
            {
               Log.ErrorOnce("[LanternsCore] Error in PawnsFinder patch (Alive): " + ex.Message, 934030);
            }
        }
    }

    // Fix: Settlement Destroyed immediately upon generating map for arrival
    [HarmonyPatch(typeof(SettlementDefeatUtility), "CheckDefeated")]
    public static class Patch_SettlementDefeatUtility_CheckDefeated
    {
        public static bool Prefix(Settlement factionBase)
        {
            if (factionBase == null || factionBase.Map == null) return true;

            // Fix for Neutral settlements being destroyed instantly because friendly pawns aren't "Threats"
            if (!factionBase.Faction.HostileTo(Faction.OfPlayer))
            {
                return false;
            }

            // Check if any lantern flight is targeting this tile
            List<WorldObject> worldObjects = Find.WorldObjects.AllWorldObjects;
            for (int i = 0; i < worldObjects.Count; i++)
            {
                if (worldObjects[i] is WorldObject_LanternFlightTravel flight && flight.DestinationTile == factionBase.Tile)
                {
                    return false; // Suppress defeat check
                }
            }

            // Check if any lantern incoming pod is on the map
            ThingDef incomingDef = DefDatabase<ThingDef>.GetNamedSilentFail("Lantern_Incoming");
            if (incomingDef != null)
            {
                if (factionBase.Map.listerThings.ThingsOfDef(incomingDef).Count > 0)
                {
                    return false; // Suppress defeat check
                }
            }
            
            return true;
        }
    }

    public static class LanternHarmonyPatchUtils
    {
        public static void AddLanternFlightPawns(ref List<Pawn> list)
        {
            if (list == null) return;
            List<WorldObject> worldObjects = Find.WorldObjects.AllWorldObjects;
            for (int i = 0; i < worldObjects.Count; i++)
            {
                if (worldObjects[i] is WorldObject_LanternFlightTravel flight)
                {
                    ThingOwner inner = flight.GetDirectlyHeldThings();
                    for (int j = 0; j < inner.Count; j++)
                    {
                        if (inner[j] is Pawn p && !p.Dead)
                        {
                            if (!list.Contains(p))
                            {
                                list.Add(p);
                            }
                        }
                    }
                }
            }

            // Check for pawns inside LanternIncoming pods
            ThingDef incomingDef = DefDatabase<ThingDef>.GetNamedSilentFail("Lantern_Incoming");
            if (incomingDef != null)
            {
                List<Map> maps = Find.Maps;
                for (int m = 0; m < maps.Count; m++)
                {
                    List<Thing> pods = maps[m].listerThings.ThingsOfDef(incomingDef);
                    if (pods != null)
                    {
                        for (int i = 0; i < pods.Count; i++)
                        {
                            if (pods[i] is LanternIncoming pod)
                            {
                                ThingOwner inner = ((IThingHolder)pod).GetDirectlyHeldThings(); // Cast needed? LanternIncoming implies IThingHolder via inheritance? 
                                // Actually LanternIncoming inherits Skyfaller, which implements IThingHolder.
                                // However, LanternIncoming.innerContainer is protected in Skyfaller base usually? 
                                // Checked LanternFlight.cs: LanternIncoming : Skyfaller, IThingHolder.
                                // But Skyfaller usually has innerContainer.
                                // I should check access.
                                // Wait, in my previous view_file of LanternFlight.cs, LanternIncoming had its own innerContainer init but inherited from Skyfaller?
                                // Actually Skyfaller has "public ThingOwner innerContainer" in vanilla.
                                // Let's just cast to IThingHolder to be safe or access innerContainer if public.
                                if (pod.innerContainer != null) // innerContainer is public in Skyfaller
                                {
                                     inner = pod.innerContainer;
                                     for (int j = 0; j < inner.Count; j++)
                                     {
                                         if (inner[j] is Pawn p && !p.Dead)
                                         {
                                             if (!list.Contains(p)) list.Add(p);
                                         }
                                     }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    [StaticConstructorOnStartup]
    public static class FrameworkPatches
    {
        static FrameworkPatches()
        {
            var harmony = new Harmony("DrAke.LanternsCore");
            harmony.PatchAll();
        }
    }

    [HarmonyPatch(typeof(Pawn_HealthTracker), "AddHediff", new Type[] { typeof(Hediff), typeof(BodyPartRecord), typeof(DamageInfo?), typeof(DamageWorker.DamageResult) })]
    public static class Patch_PreventSpaceDamage
    {
        private static readonly HashSet<string> DefaultBlockedHediffKeywords = new HashSet<string>
        {
            "vacuum", "hypoxia", "decompression", "suffocation", 
            "oxygen", "breath", "hypothermia", "heatstroke", "toxic"
        };

        private static bool Prefix(Pawn_HealthTracker __instance, Hediff hediff, Pawn ___pawn)
        {
            if (hediff == null || ___pawn == null) return true;

            CompLanternRing ring = LanternResources.GetRing(___pawn);
            if (ring == null) return true;

            if (!ring.IsActive || ring.charge <= 0f) return true;

            var ext = ring.Extension;
            if (ext == null || !ext.blockEnvironmentalHediffs) return true;
            if (LanternCoreMod.Settings?.disableEnvironmentalProtectionGlobally == true) return true;

            if (hediff.def != null)
            {
                if (!ShouldBlockHediff(hediff.def, ext)) return true;

                float cost = Mathf.Max(0f, ext.blockEnvironmentalHediffsCost);
                if (cost > 0f && !ring.TryConsumeCharge(cost)) return true;

                return false;
            }
            return true; 
        }

        private static bool ShouldBlockHediff(HediffDef def, LanternDefExtension ext)
        {
            if (def == null) return false;

            if (ext.blockedHediffs != null && ext.blockedHediffs.Count > 0)
            {
                return ext.blockedHediffs.Contains(def);
            }

            string defName = def.defName?.ToLowerInvariant() ?? string.Empty;

            if (ext.blockedHediffDefNameKeywords != null && ext.blockedHediffDefNameKeywords.Count > 0)
            {
                for (int i = 0; i < ext.blockedHediffDefNameKeywords.Count; i++)
                {
                    string kw = ext.blockedHediffDefNameKeywords[i];
                    if (kw.NullOrEmpty()) continue;
                    if (defName.Contains(kw.ToLowerInvariant())) return true;
                }
                return false;
            }

            if (def == HediffDefOf.Hypothermia || def == HediffDefOf.Heatstroke || def == HediffDefOf.ToxicBuildup)
            {
                return true;
            }

            foreach (var keyword in DefaultBlockedHediffKeywords)
            {
                if (defName.Contains(keyword)) return true;
            }
            return false;
        }

        private static void Postfix(Hediff hediff, Pawn ___pawn)
        {
            if (hediff == null || ___pawn == null) return;
            if (___pawn.health?.hediffSet == null) return;
            if (!___pawn.health.hediffSet.hediffs.Contains(hediff)) return; // not actually applied

            Current.Game?.GetComponent<RingSelectionManager>()?.Notify_HediffAdded(___pawn, hediff);
        }
    }

    [HarmonyPatch(typeof(Pawn_HealthTracker), "PreApplyDamage")]
    public static class Patch_PreventSpacePhysicalDamage
    {
        private static readonly HashSet<string> DefaultBlockedDamageKeywords = new HashSet<string>
        {
            "vacuum", "decompression", "hypoxia", "suffocation"
        };

        private static bool Prefix(Pawn_HealthTracker __instance, DamageInfo dinfo, out bool absorbed, Pawn ___pawn)
        {
            absorbed = false;
            Pawn pawn = ___pawn;
            if (pawn == null) return true;

            CompLanternRing ring = LanternResources.GetRing(pawn);
            if (ring == null) return true;
            if (!ring.IsActive || ring.charge <= 0f) return true;

            var ext = ring.Extension;
            if (ext == null) return true;
            if (LanternCoreMod.Settings?.disableEnvironmentalProtectionGlobally == true)
            {
                // Also implies no combat absorption override; handled below.
            }

            bool isSpaceDamage = false;

            if (dinfo.Def != null)
            {
                if (IsEnvironmentalDamage(dinfo.Def, ext))
                {
                    isSpaceDamage = true;
                }

                if (isSpaceDamage && ext.absorbEnvironmentalDamage && LanternCoreMod.Settings?.disableEnvironmentalProtectionGlobally != true)
                {
                    float cost = Mathf.Max(0f, ext.absorbEnvironmentalDamageCost);
                    if (cost <= 0f || ring.TryConsumeCharge(cost))
                    {
                        absorbed = true;
                        return false;
                    }
                }
                
                // Non-environmental damage: optional combat absorption (opt-in).
                if (!isSpaceDamage && ext.absorbCombatDamage && LanternCoreMod.Settings?.disableCombatAbsorbGlobally != true)
                {
                    if (ext.combatDamageDefs != null && ext.combatDamageDefs.Count > 0 && !ext.combatDamageDefs.Contains(dinfo.Def))
                    {
                        return true;
                    }

                    float cost = Mathf.Max(0f, ext.absorbCombatDamageCost);
                    if (cost <= 0f || ring.TryConsumeCharge(cost))
                    {
                        absorbed = true;
                        return false;
                    }
                }
            }

            return true;
        }

        private static bool IsEnvironmentalDamage(DamageDef def, LanternDefExtension ext)
        {
            if (def == null) return false;

            if (ext.environmentalDamageDefs != null && ext.environmentalDamageDefs.Count > 0)
            {
                return ext.environmentalDamageDefs.Contains(def);
            }

            string defName = def.defName ?? string.Empty;
            if (ext.environmentalDamageDefNameKeywords != null && ext.environmentalDamageDefNameKeywords.Count > 0)
            {
                string lower = defName.ToLowerInvariant();
                for (int i = 0; i < ext.environmentalDamageDefNameKeywords.Count; i++)
                {
                    string kw = ext.environmentalDamageDefNameKeywords[i];
                    if (kw.NullOrEmpty()) continue;
                    if (lower.Contains(kw.ToLowerInvariant())) return true;
                }
                return false;
            }

            if (defName == "VacuumBurn") return true;

            string lowerName = defName.ToLowerInvariant();
            foreach (var keyword in DefaultBlockedDamageKeywords)
            {
                if (lowerName.Contains(keyword)) return true;
            }
            return false;
        }
    }

    [HarmonyPatch(typeof(MentalState), "PostStart")]
    public static class Patch_MentalState_PostStart
    {
        static void Postfix(MentalState __instance, string reason)
        {
            if (__instance.pawn == null) return;
            // Notify Manager
            Current.Game.GetComponent<RingSelectionManager>()?.Notify_MentalStateStarted(__instance.pawn, __instance.def);
        }
    }

    // Trigger ring selection when a pawn joins the player's faction.
    [HarmonyPatch(typeof(Pawn), "SetFaction", new Type[] { typeof(Faction), typeof(Pawn) })]
    public static class Patch_Pawn_SetFaction
    {
        static void Prefix(Pawn __instance, out Faction __state)
        {
            __state = __instance?.Faction;
        }

        static void Postfix(Pawn __instance, Faction newFaction, Pawn recruiter, Faction __state)
        {
            if (__instance == null || Current.Game == null) return;
            Current.Game.GetComponent<RingSelectionManager>()?.Notify_PawnJoinedFaction(__instance, __state, newFaction);
        }
    }

    // Trigger ring selection when a pawn spawns on a player home map.
    [HarmonyPatch(typeof(Pawn), "SpawnSetup")]
    public static class Patch_Pawn_SpawnSetup
    {
        static void Postfix(Pawn __instance, Map map, bool respawningAfterLoad)
        {
            Current.Game?.GetComponent<RingSelectionManager>()?.Notify_PawnSpawned(__instance, map, respawningAfterLoad);
        }
    }

    // Trigger ring selection when a pawn is downed.
    [HarmonyPatch(typeof(Pawn_HealthTracker), "MakeDowned")]
    public static class Patch_Pawn_HealthTracker_MakeDowned
    {
        static void Postfix(Pawn ___pawn)
        {
            if (___pawn != null && ___pawn.Downed)
            {
                Current.Game?.GetComponent<RingSelectionManager>()?.Notify_PawnDowned(___pawn);
            }
        }
    }

    // Trigger ring selection when a pawn kills another pawn.
    [HarmonyPatch(typeof(Pawn), "Kill")]
    public static class Patch_Pawn_Kill
    {
        static void Postfix(Pawn __instance, object[] __args)
        {
            if (__instance == null) return;

            Pawn killer = null;
            if (__args != null)
            {
                foreach (object arg in __args)
                {
                    if (arg is DamageInfo dinfo)
                    {
                        killer = dinfo.Instigator as Pawn;
                        if (killer != null) break;
                    }
                }
            }

            if (killer == null || killer == __instance) return;
            Current.Game?.GetComponent<RingSelectionManager>()?.Notify_PawnKilled(killer, __instance);
        }
    }

    // Optional: pause the game when certain ability gizmos are clicked.
    [HarmonyPatch(typeof(Command_Ability), "ProcessInput", new Type[] { typeof(Event) })]
    public static class Patch_CommandAbility_PauseOnInput
    {
        static void Prefix(Command_Ability __instance)
        {
            Ability ability = __instance?.Ability;
            if (ability?.def?.comps == null) return;

            for (int i = 0; i < ability.def.comps.Count; i++)
            {
                if (ability.def.comps[i] is CompProperties_LanternPauseOnInput pause && pause.pause)
                {
                    if (Find.TickManager?.Paused != true)
                    {
                        Find.TickManager?.Pause();
                        LanternPauseOnInputRegistry.RecordPaused(ability);
                    }
                    return;
                }
            }
        }
    }

    // Reactive projectile evasion: cancels the impact and consumes charge if enabled on the worn gear.
    [HarmonyPatch(typeof(Projectile), "Impact", new Type[] { typeof(Thing), typeof(bool) })]
    public static class Patch_Projectile_Impact_ReactiveEvade
    {
        static bool Prefix(Projectile __instance, Thing hitThing, bool blockedByShield)
        {
            if (blockedByShield) return true;
            if (hitThing is not Pawn pawn) return true;

            CompLanternRing ring = LanternResources.GetRing(pawn);
            if (ring == null) return true;

            if (ring.TryReactiveEvadeProjectile(__instance, pawn))
            {
                __instance.Destroy(DestroyMode.Vanish);
                return false;
            }

            return true;
        }
    }

    // ================== Autonomy / Temptation ==================
    [HarmonyPatch(typeof(JobGiver_OptimizeApparel), "ApparelScoreRaw")]
    public static class Patch_ApparelScoreRaw_LanternAutonomy
    {
        static void Postfix(Pawn pawn, Apparel ap, ref float __result)
        {
            if (pawn == null || ap == null) return;
            var comp = ap.TryGetComp<CompLanternRing>();
            var ext = comp?.Extension;
            if (ext == null || !ext.autoEquipEnabled) return;

            if (!ext.autoEquipAllowDrafted && pawn.Drafted) return;

            float chance = Mathf.Clamp01(ext.autoEquipChance);
            if (chance <= 0f) return;

            float bonus = ext.autoEquipScoreBonus;

            if (!ext.autoEquipTraitBonuses.NullOrEmpty() && pawn.story?.traits != null)
            {
                for (int i = 0; i < ext.autoEquipTraitBonuses.Count; i++)
                {
                    LanternAutoEquipTraitModifier mod = ext.autoEquipTraitBonuses[i];
                    if (mod?.trait == null) continue;
                    Trait t = pawn.story.traits.GetTrait(mod.trait);
                    if (t == null) continue;
                    if (mod.degree != 0 && t.Degree != mod.degree) continue;
                    bonus += mod.scoreOffset;
                }
            }

            if (!ext.autoEquipHediffBonuses.NullOrEmpty() && pawn.health?.hediffSet != null)
            {
                for (int i = 0; i < ext.autoEquipHediffBonuses.Count; i++)
                {
                    LanternAutoEquipHediffModifier mod = ext.autoEquipHediffBonuses[i];
                    if (mod?.hediff == null) continue;
                    Hediff h = pawn.health.hediffSet.GetFirstHediffOfDef(mod.hediff);
                    if (h == null) continue;
                    if (h.Severity < mod.minSeverity || h.Severity > mod.maxSeverity) continue;
                    bonus += mod.scoreOffset;
                    if (mod.severityMultiplier != 0f) bonus += h.Severity * mod.severityMultiplier;
                }
            }

            if (bonus != 0f)
            {
                __result += bonus * chance;
            }
        }
    }

    // ================== Refuse removal ==================
    [HarmonyPatch(typeof(Pawn_ApparelTracker), "TryDrop", new Type[] { typeof(Apparel), typeof(Apparel), typeof(IntVec3), typeof(bool) }, new ArgumentType[] { ArgumentType.Normal, ArgumentType.Out, ArgumentType.Normal, ArgumentType.Normal })]
    public static class Patch_PawnApparelTracker_TryDrop_RefuseRemoval
    {
        static bool Prefix(Pawn_ApparelTracker __instance, Apparel ap, ref bool __result)
        {
            if (ap == null || __instance?.pawn == null) return true;

            Pawn pawn = __instance.pawn;
            if (pawn.Dead || pawn.Downed) return true;

            var comp = ap.TryGetComp<CompLanternRing>();
            var ext = comp?.Extension;
            if (ext == null || !ext.refuseRemoval) return true;

            HediffDef hDef = ext.refuseRemovalHediff ?? ext.corruptionHediff;
            if (hDef == null || pawn.health?.hediffSet == null) return true;

            Hediff h = pawn.health.hediffSet.GetFirstHediffOfDef(hDef);
            if (h == null || h.Severity < ext.refuseRemovalMinSeverity) return true;

            string key = ext.refuseRemovalMessageKey ?? "Lantern_RefuseRemoval";
            string text = key.CanTranslate() ? key.Translate(pawn.LabelShort) : key;
            Messages.Message(text, pawn, MessageTypeDefOf.RejectInput);
            __result = false;
            return false;
        }
    }

    // ================== Stealth interaction ==================
    [HarmonyPatch(typeof(Verb), "TryStartCastOn", new Type[] { typeof(LocalTargetInfo), typeof(bool), typeof(bool), typeof(bool), typeof(bool) })]
    public static class Patch_Verb_TryStartCastOn_StealthBreak_Single
    {
        static void Postfix(Verb __instance, bool __result)
        {
            if (!__result) return;
            Pawn caster = __instance?.CasterPawn;
            if (caster == null) return;
            if (LanternInvisibilityRegistry.TryGetProfile(caster, out HediffDef invisDef, out LanternInvisibilityProfile profile) && profile.breakOnAttack)
            {
                LanternInvisibilityRegistry.TryDisableInvisibility(caster, invisDef);
            }
        }
    }

    [HarmonyPatch(typeof(Verb), "TryStartCastOn", new Type[] { typeof(LocalTargetInfo), typeof(LocalTargetInfo), typeof(bool), typeof(bool), typeof(bool), typeof(bool) })]
    public static class Patch_Verb_TryStartCastOn_StealthBreak_Dual
    {
        static void Postfix(Verb __instance, bool __result)
        {
            if (!__result) return;
            Pawn caster = __instance?.CasterPawn;
            if (caster == null) return;
            if (LanternInvisibilityRegistry.TryGetProfile(caster, out HediffDef invisDef, out LanternInvisibilityProfile profile) && profile.breakOnAttack)
            {
                LanternInvisibilityRegistry.TryDisableInvisibility(caster, invisDef);
            }
        }
    }

    [HarmonyPatch(typeof(Verb), "CanHitTarget", new Type[] { typeof(LocalTargetInfo) })]
    public static class Patch_Verb_CanHitTarget_Stealth
    {
        static bool Prefix(Verb __instance, LocalTargetInfo targ, ref bool __result)
        {
            Pawn targetPawn = targ.Thing as Pawn;
            if (targetPawn == null) return true;

            if (!LanternInvisibilityRegistry.TryGetProfile(targetPawn, out _, out LanternInvisibilityProfile profile)) return true;
            if (!profile.preventTargeting) return true;

            Pawn caster = __instance?.CasterPawn;
            if (LanternInvisibilityRegistry.CanSeeInvisible(caster, profile)) return true;

            __result = false;
            return false;
        }
    }

    [HarmonyPatch(typeof(Verb), "CanHitTargetFrom", new Type[] { typeof(IntVec3), typeof(LocalTargetInfo) })]
    public static class Patch_Verb_CanHitTargetFrom_Stealth
    {
        static bool Prefix(Verb __instance, LocalTargetInfo targ, ref bool __result)
        {
            Pawn targetPawn = targ.Thing as Pawn;
            if (targetPawn == null) return true;

            if (!LanternInvisibilityRegistry.TryGetProfile(targetPawn, out _, out LanternInvisibilityProfile profile)) return true;
            if (!profile.preventTargeting) return true;

            Pawn caster = __instance?.CasterPawn;
            if (LanternInvisibilityRegistry.CanSeeInvisible(caster, profile)) return true;

            __result = false;
            return false;
        }
    }

    [HarmonyPatch(typeof(AttackTargetFinder), "CanSee")]
    public static class Patch_AttackTargetFinder_CanSee_Stealth
    {
        static void Postfix(Thing seer, Thing target, ref bool __result)
        {
            if (__result) return;
            Pawn targetPawn = target as Pawn;
            if (targetPawn == null) return;

            if (!LanternInvisibilityRegistry.TryGetProfile(targetPawn, out _, out LanternInvisibilityProfile profile)) return;

            Pawn seerPawn = seer as Pawn;
            if (!LanternInvisibilityRegistry.CanSeeInvisible(seerPawn, profile)) return;

            __result = true;
        }
    }

    // ================== Corpse/grave drop ==================
    [HarmonyPatch(typeof(Building_Grave), "EjectContents")]
    public static class Patch_Building_Grave_EjectContents_LanternDrop
    {
        static void Prefix(Building_Grave __instance, ref Corpse __state)
        {
            __state = __instance?.Corpse;
        }

        static void Postfix(Building_Grave __instance, Corpse __state)
        {
            if (__state == null) return;
            Map map = __instance?.Map;
            if (map == null) return;
            LanternResources.TryDropLanternGearFromCorpse(__state, map, __instance.Position, true);
        }
    }

    [HarmonyPatch(typeof(Corpse), "Destroy", new Type[] { typeof(DestroyMode) })]
    public static class Patch_Corpse_Destroy_LanternDrop
    {
        static void Prefix(Corpse __instance)
        {
            if (__instance == null) return;
            Map map = __instance.MapHeld;
            if (map == null) return;
            LanternResources.TryDropLanternGearFromCorpse(__instance, map, __instance.PositionHeld, false);
        }
    }

    [HarmonyPatch(typeof(Game), MethodType.Constructor)]
    public static class Patch_Game_Constructor
    {
        public static void Postfix(Game __instance)
        {
            if (__instance.components != null)
            {
                if (!__instance.components.Any(c => c is RingSelectionManager))
                {
                    __instance.components.Add(new RingSelectionManager(__instance));
                }
                if (!__instance.components.Any(c => c is ConstructLifetimeManager))
                {
                    __instance.components.Add(new ConstructLifetimeManager(__instance));
                }
                if (!__instance.components.Any(c => c is GameComponent_LanternInfluence))
                {
                    __instance.components.Add(new GameComponent_LanternInfluence(__instance));
                }
                if (!__instance.components.Any(c => c is GameComponent_LanternTimedIncidents))
                {
                    __instance.components.Add(new GameComponent_LanternTimedIncidents(__instance));
                }
            }
        }
    }
}
