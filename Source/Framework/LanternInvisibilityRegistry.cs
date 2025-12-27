using System.Collections.Generic;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework
{
    [StaticConstructorOnStartup]
    public static class LanternInvisibilityRegistry
    {
        private static readonly Dictionary<HediffDef, LanternInvisibilityProfile> Profiles = new Dictionary<HediffDef, LanternInvisibilityProfile>();

        static LanternInvisibilityRegistry()
        {
            Refresh();
        }

        public static void Refresh()
        {
            Profiles.Clear();

            foreach (ThingDef def in DefDatabase<ThingDef>.AllDefsListForReading)
            {
                var ext = def.GetModExtension<LanternDefExtension>();
                if (ext == null || !ext.stealthEnabled || ext.stealthHediff == null) continue;

                LanternInvisibilityProfile profile = GetOrCreate(ext.stealthHediff);
                profile.preventTargeting |= ext.stealthPreventTargeting;
                profile.breakOnAttack |= ext.stealthBreakOnAttack;

                if (!ext.stealthSeeThroughPawnKinds.NullOrEmpty())
                {
                    for (int i = 0; i < ext.stealthSeeThroughPawnKinds.Count; i++)
                    {
                        PawnKindDef kind = ext.stealthSeeThroughPawnKinds[i];
                        if (kind != null) profile.seeThroughPawnKinds.Add(kind);
                    }
                }

                if (!ext.stealthSeeThroughHediffs.NullOrEmpty())
                {
                    for (int i = 0; i < ext.stealthSeeThroughHediffs.Count; i++)
                    {
                        HediffDef h = ext.stealthSeeThroughHediffs[i];
                        if (h != null) profile.seeThroughHediffs.Add(h);
                    }
                }
            }
        }

        public static bool TryGetProfile(Pawn pawn, out HediffDef hediffDef, out LanternInvisibilityProfile profile)
        {
            hediffDef = null;
            profile = null;
            if (pawn?.health?.hediffSet == null) return false;

            List<Hediff> hediffs = pawn.health.hediffSet.hediffs;
            if (hediffs == null) return false;

            for (int i = 0; i < hediffs.Count; i++)
            {
                Hediff h = hediffs[i];
                if (h?.def == null) continue;
                if (Profiles.TryGetValue(h.def, out profile))
                {
                    hediffDef = h.def;
                    return true;
                }
            }

            return false;
        }

        public static bool CanSeeInvisible(Pawn seer, LanternInvisibilityProfile profile)
        {
            if (seer == null || profile == null) return false;

            if (seer.kindDef != null && profile.seeThroughPawnKinds.Contains(seer.kindDef))
            {
                return true;
            }

            if (seer.health?.hediffSet != null && profile.seeThroughHediffs.Count > 0)
            {
                foreach (HediffDef def in profile.seeThroughHediffs)
                {
                    if (def != null && seer.health.hediffSet.GetFirstHediffOfDef(def) != null)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        public static void TryDisableInvisibility(Pawn pawn, HediffDef hediffDef)
        {
            if (pawn?.health?.hediffSet == null || hediffDef == null) return;

            Hediff invis = pawn.health.hediffSet.GetFirstHediffOfDef(hediffDef);
            if (invis != null)
            {
                pawn.health.RemoveHediff(invis);
            }

            CompLanternRing ring = LanternResources.GetRing(pawn);
            if (ring != null && ring.Extension?.stealthHediff == hediffDef)
            {
                ring.ForceDisableStealth(pawn);
            }
        }

        private static LanternInvisibilityProfile GetOrCreate(HediffDef def)
        {
            if (def == null) return null;

            if (!Profiles.TryGetValue(def, out LanternInvisibilityProfile profile) || profile == null)
            {
                profile = new LanternInvisibilityProfile();
                Profiles[def] = profile;
            }

            return profile;
        }
    }

    public class LanternInvisibilityProfile
    {
        public bool preventTargeting = false;
        public bool breakOnAttack = false;
        public HashSet<PawnKindDef> seeThroughPawnKinds = new HashSet<PawnKindDef>();
        public HashSet<HediffDef> seeThroughHediffs = new HashSet<HediffDef>();
    }
}
