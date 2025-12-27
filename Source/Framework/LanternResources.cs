using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    [StaticConstructorOnStartup]
    public static class LanternResources
    {
        // Beam for Projectiles - Keep generic or move to Content?
        // Let's keep a Generic Beam available
        // public static readonly Material BeamMat = MaterialPool.MatFrom("LanternsLight/Projectiles/GL_Beam", ShaderDatabase.Transparent);
        
        // Shield Bubble - Generic
        // public static readonly Material ShieldBubbleMat = MaterialPool.MatFrom("LanternsLight/Effects/GL_ShieldBubble", ShaderDatabase.MoteGlow);

        static LanternResources()
        {
            if (LanternDebug.LoggingEnabled)
            {
                Log.Message("[LanternsCore] Resources Initialized.");
            }
        }

        public static CompLanternRing GetRing(Pawn pawn)
        {
            if (pawn == null || pawn.apparel == null) return null;
            foreach (var app in pawn.apparel.WornApparel)
            {
                var comp = app.GetComp<CompLanternRing>();
                if (comp != null) return comp;
            }
            return null;
        }

        public static bool IsWearingCorruptionSource(Pawn pawn, HediffDef hediffDef)
        {
            if (pawn?.apparel == null || hediffDef == null) return false;
            foreach (var app in pawn.apparel.WornApparel)
            {
                if (app == null) continue;
                var comp = app.GetComp<CompLanternRing>();
                if (comp?.Extension?.corruptionHediff == hediffDef)
                {
                    return true;
                }
            }
            return false;
        }

        public static float GetMapAttention(Map map)
        {
            if (map == null) return 0f;
            float max = 0f;
            foreach (Pawn p in map.mapPawns.AllPawnsSpawned)
            {
                if (p?.apparel == null) continue;
                foreach (Apparel app in p.apparel.WornApparel)
                {
                    var comp = app?.GetComp<CompLanternRing>();
                    if (comp == null) continue;
                    if (comp.AttentionLevel > max) max = comp.AttentionLevel;
                }
            }
            return Mathf.Clamp01(max);
        }

        public static bool TryDropLanternGearFromCorpse(Corpse corpse, Map map, IntVec3 dropCell, bool fromGrave)
        {
            if (corpse?.InnerPawn == null || map == null) return false;
            Pawn pawn = corpse.InnerPawn;
            bool dropped = false;

            if (pawn.apparel != null)
            {
                for (int i = pawn.apparel.WornApparel.Count - 1; i >= 0; i--)
                {
                    Apparel app = pawn.apparel.WornApparel[i];
                    if (!ShouldForceDrop(app, fromGrave)) continue;
                    dropped |= pawn.apparel.TryDrop(app, out _, dropCell, false);
                }
            }

            if (pawn.inventory != null)
            {
                for (int i = pawn.inventory.innerContainer.Count - 1; i >= 0; i--)
                {
                    Thing t = pawn.inventory.innerContainer[i];
                    if (!ShouldForceDrop(t, fromGrave)) continue;
                    dropped |= pawn.inventory.innerContainer.TryDrop(t, dropCell, map, ThingPlaceMode.Near, out _);
                }
            }

            return dropped;
        }

        private static bool ShouldForceDrop(Thing thing, bool fromGrave)
        {
            var comp = thing?.TryGetComp<CompLanternRing>();
            var ext = comp?.Extension;
            if (ext == null) return false;
            if (fromGrave && ext.forceDropOnGraveEject) return true;
            return ext.forceDropOnCorpseDestroy;
        }
    }
}
