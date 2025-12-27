using RimWorld;
using Verse;

namespace DrAke.LanternsFramework
{
    public enum LanternTimedIncidentTarget
    {
        PlayerHomeMap,
        CurrentMap,
        AnyPlayerMap,
        World
    }

    public class LanternTimedIncidentExtension : DefModExtension
    {
        public bool enabled = true;
        public bool fireOnce = true;
        public float minDays = 1f;
        public float maxDays = 2f;
        public float retryHours = 1f;
        public bool force = true;
        public LanternTimedIncidentTarget target = LanternTimedIncidentTarget.PlayerHomeMap;
    }
}
