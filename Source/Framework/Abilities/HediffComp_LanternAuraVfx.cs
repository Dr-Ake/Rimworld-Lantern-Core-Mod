using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class HediffCompProperties_LanternAuraVfx : HediffCompProperties
    {
        public EffecterDef effecterDef;
        public ThingDef moteDef;
        public float moteScale = 1f;
        public int intervalTicks = 60;
        // If true, motes are attached to the pawn so they follow movement.
        public bool attachToPawn = false;
        public Vector3 attachedOffset = Vector3.zero;

        public HediffCompProperties_LanternAuraVfx()
        {
            compClass = typeof(HediffComp_LanternAuraVfx);
        }
    }

    // Spawns a visual effect around the pawn while the hediff is present.
    public class HediffComp_LanternAuraVfx : HediffComp
    {
        public HediffCompProperties_LanternAuraVfx Props => (HediffCompProperties_LanternAuraVfx)props;

        public override void CompPostTick(ref float severityAdjustment)
        {
            base.CompPostTick(ref severityAdjustment);

            int interval = Props.intervalTicks > 0 ? Props.intervalTicks : 60;
            if (!Pawn.IsHashIntervalTick(interval)) return;

            Map map = Pawn.Map;
            if (map == null) return;

            if (Props.effecterDef != null)
            {
                Props.effecterDef.Spawn(Pawn.Position, map, 1f);
                return;
            }

            if (Props.moteDef != null)
            {
                float scale = Props.moteScale > 0f ? Props.moteScale : 1f;
                if (Props.attachToPawn)
                {
                    MoteMaker.MakeAttachedOverlay(Pawn, Props.moteDef, Props.attachedOffset, scale);
                }
                else
                {
                    MoteMaker.MakeStaticMote(Pawn.Position, map, Props.moteDef, scale);
                }
            }
        }
    }
}
