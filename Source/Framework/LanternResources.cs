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
    }
}
