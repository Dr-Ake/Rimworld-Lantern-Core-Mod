using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class HediffCompProperties_LanternChargeDrain : HediffCompProperties
    {
        // Fraction (0..1) of ring max charge drained per day while this hediff exists.
        public float drainPerDay = 0.10f;

        // If true, the hediff removes itself when the ring can't pay the drain.
        public bool removeWhenEmpty = true;

        // If true, only drains while the ring is active.
        public bool requireRingActive = true;

        // If true, shows a small message when the drain ends due to empty charge.
        public bool messageOnEmpty = false;

        public HediffCompProperties_LanternChargeDrain()
        {
            compClass = typeof(HediffComp_LanternChargeDrain);
        }
    }

    public class HediffComp_LanternChargeDrain : HediffComp
    {
        public HediffCompProperties_LanternChargeDrain Props => (HediffCompProperties_LanternChargeDrain)props;

        private int tickAccumulator = 0;

        public override void CompPostTick(ref float severityAdjustment)
        {
            base.CompPostTick(ref severityAdjustment);

            Pawn pawn = Pawn;
            if (pawn == null || pawn.Dead) return;

            tickAccumulator++;
            if (tickAccumulator < 60) return; // once per second
            int ticks = tickAccumulator;
            tickAccumulator = 0;

            CompLanternRing ring = LanternResources.GetRing(pawn);
            if (ring == null) return;
            if (Props.requireRingActive && !ring.IsActive) return;

            float days = ticks / (float)GenDate.TicksPerDay;
            float mult = Mathf.Max(0f, LanternCoreMod.Settings?.drainMultiplier ?? 1f);
            float fraction = Mathf.Max(0f, Props.drainPerDay) * mult * days;
            if (fraction <= 0f) return;

            if (!ring.TryConsumeCharge(fraction))
            {
                if (Props.removeWhenEmpty && pawn.health != null && parent != null)
                {
                    pawn.health.RemoveHediff(parent);
                    if (Props.messageOnEmpty && pawn.Map != null)
                    {
                        Messages.Message("Lantern_ChannelEnded_NoCharge".Translate(), pawn, MessageTypeDefOf.NeutralEvent);
                    }
                }
            }
        }
    }
}
