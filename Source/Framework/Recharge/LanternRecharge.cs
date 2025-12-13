using System.Collections.Generic;
using RimWorld;
using UnityEngine;
using System.Linq;
using Verse;
using Verse.AI;
using DrAke.LanternsFramework;

namespace DrAke.LanternsFramework.Recharge
{
    public class CompProperties_LanternBattery : CompProperties
    {
        public string oathPrefix = "Lantern_Oath"; // Default translation generic
        // Optional raw oath lines to display while recharging.
        // If provided, these are used instead of translation keys.
        public List<string> oathLines = new List<string>();
        public CompProperties_LanternBattery()
        {
            this.compClass = typeof(CompLanternBattery);
        }
    }

    public class CompLanternBattery : ThingComp
    {
        public CompProperties_LanternBattery Props => (CompProperties_LanternBattery)props;

        public override IEnumerable<FloatMenuOption> CompFloatMenuOptions(Pawn selPawn)
        {
            // Check if pawn has ANY Lantern Ring
            var ring = LanternResources.GetRing(selPawn);
            if (ring != null)
            {
                 // Generic Label "Recharge Ring"
                 yield return new FloatMenuOption("Lantern_Command_Recharge".Translate(), () =>
                 {
                     Job job = JobMaker.MakeJob(DefDatabase<JobDef>.GetNamed("Lantern_Job_Recharge"), parent);
                     // Pass custom props via Job? Or just have Job lookup this comp?
                     // JobDriver will access TargetA (this battery)
                     selPawn.jobs.TryTakeOrderedJob(job);
                 });
            }
        }
    }

    public class JobDriver_LanternRecharge : JobDriver
    {
        private const int Duration = 720; // 12s

        public override bool TryMakePreToilReservations(bool errorOnFailed)
        {
            return pawn.Reserve(TargetA, job, 1, -1, null, errorOnFailed);
        }

        protected override IEnumerable<Toil> MakeNewToils()
        {
            this.FailOnDespawnedOrNull(TargetIndex.A);
            yield return Toils_Goto.GotoThing(TargetIndex.A, PathEndMode.Touch);

            Toil chant = new Toil();
            chant.initAction = () =>
            {
                DisplayLine(1);
            };
            chant.tickAction = () =>
            {
                int tick = pawn.jobs.curDriver.ticksLeftThisToil; 
                int elapsed = Duration - tick; 
                
                // Timing: 3s, 6s, 9s
                if (elapsed == 180) DisplayLine(2);
                if (elapsed == 360) DisplayLine(3);
                if (elapsed == 540) DisplayLine(4);
            };
            chant.defaultCompleteMode = ToilCompleteMode.Delay;
            chant.defaultDuration = Duration;
            chant.WithProgressBar(TargetIndex.A, () => 1f - ((float)ticksLeftThisToil / Duration));
            
            yield return chant;

            // Finish
            Toil finish = new Toil();
            finish.initAction = () =>
            {
                Pawn actor = GetActor();
                var ring = LanternResources.GetRing(actor);
                if (ring != null)
                {
                    ring.charge = ring.MaxCharge;
                    // TODO: Play Sound?
                }
            };
            yield return finish;
        }

        private void DisplayLine(int lineNum)
        {
            // Try to find battery prop
            string prefix = "Lantern_Oath";
            List<string> lines = null;
            if (TargetA.Thing.TryGetComp<CompLanternBattery>() is CompLanternBattery batt)
            {
                prefix = batt.Props.oathPrefix;
                lines = batt.Props.oathLines;
            }

            // Fallback for Green Lantern specifically if user hasn't updated XML yet? 
            // Better to assume XML will update.
            
            if (lines != null && lines.Count >= lineNum)
            {
                string raw = lines[lineNum - 1];
                if (!raw.NullOrEmpty())
                {
                    MoteMaker.ThrowText(pawn.DrawPos, pawn.Map, raw);
                }
                return;
            }

            string key = $"{prefix}_Line{lineNum}";
            if (key.CanTranslate())
            {
                 MoteMaker.ThrowText(pawn.DrawPos, pawn.Map, key.Translate());
            }
        }
    }
}
