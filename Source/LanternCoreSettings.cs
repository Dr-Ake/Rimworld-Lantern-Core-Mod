using Verse;

namespace DrAke.LanternsFramework
{
    public class LanternCoreSettings : ModSettings
    {
        public bool debugLogging = false;
        public bool debugGizmos = false;
        public bool showRingInspectorGizmo = false;

        // Balance
        public float costMultiplier = 1f;
        public float regenMultiplier = 1f;
        public float drainMultiplier = 1f;

        // Safety toggles
        public bool disableCombatAbsorbGlobally = false;
        public bool disableEnvironmentalProtectionGlobally = false;

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Values.Look(ref debugLogging, "debugLogging", false);
            Scribe_Values.Look(ref debugGizmos, "debugGizmos", false);
            Scribe_Values.Look(ref showRingInspectorGizmo, "showRingInspectorGizmo", false);

            Scribe_Values.Look(ref costMultiplier, "costMultiplier", 1f);
            Scribe_Values.Look(ref regenMultiplier, "regenMultiplier", 1f);
            Scribe_Values.Look(ref drainMultiplier, "drainMultiplier", 1f);

            Scribe_Values.Look(ref disableCombatAbsorbGlobally, "disableCombatAbsorbGlobally", false);
            Scribe_Values.Look(ref disableEnvironmentalProtectionGlobally, "disableEnvironmentalProtectionGlobally", false);
        }
    }
}
