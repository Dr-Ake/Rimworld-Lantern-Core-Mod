using Verse;

namespace DrAke.LanternsFramework
{
    public class LanternCoreSettings : ModSettings
    {
        public bool debugLogging = false;
        public bool debugGizmos = false;

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Values.Look(ref debugLogging, "debugLogging", false);
            Scribe_Values.Look(ref debugGizmos, "debugGizmos", false);
        }
    }
}

