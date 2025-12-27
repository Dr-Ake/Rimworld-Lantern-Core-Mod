using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class HediffCompProperties_LanternCorruption : HediffCompProperties
    {
        // If true, decay severity when the pawn is not wearing the matching Lantern gear.
        public bool decayWhenNotWorn = true;
        // Fraction (0..1) of severity lost per day while not worn.
        public float decayPerDay = 0.02f;
        // Optional thought when separated from the gear and severity is high enough.
        public ThoughtDef separationThought;
        public float separationMinSeverity = 0.25f;
        public int separationCheckIntervalTicks = 2000;

        public HediffCompProperties_LanternCorruption()
        {
            compClass = typeof(HediffComp_LanternCorruption);
        }
    }

    public class HediffComp_LanternCorruption : HediffComp
    {
        public HediffCompProperties_LanternCorruption Props => (HediffCompProperties_LanternCorruption)props;

        public override void CompPostTick(ref float severityAdjustment)
        {
            base.CompPostTick(ref severityAdjustment);

            Pawn pawn = Pawn;
            if (pawn == null || pawn.Dead) return;

            bool wearingSource = LanternResources.IsWearingCorruptionSource(pawn, parent.def);

            if (!wearingSource && Props.decayWhenNotWorn && Props.decayPerDay > 0f)
            {
                float perTick = Props.decayPerDay / GenDate.TicksPerDay;
                severityAdjustment -= perTick;
            }

            if (!wearingSource && Props.separationThought != null && parent.Severity >= Props.separationMinSeverity)
            {
                if (pawn.IsHashIntervalTick(Mathf.Max(1, Props.separationCheckIntervalTicks)))
                {
                    pawn.needs?.mood?.thoughts?.memories?.TryGainMemory(Props.separationThought);
                }
            }
        }
    }
}
