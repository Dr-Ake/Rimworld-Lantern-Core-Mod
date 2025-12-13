using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    public class AbilityCastTracker : IExposable
    {
        public int dayOfYear = -1;
        public int castsToday = 0;
        public int nextAllowedTick = 0;

        public void ResetIfNewDay(int currentDayOfYear)
        {
            if (dayOfYear != currentDayOfYear)
            {
                dayOfYear = currentDayOfYear;
                castsToday = 0;
            }
        }

        public void ExposeData()
        {
            Scribe_Values.Look(ref dayOfYear, "dayOfYear", -1);
            Scribe_Values.Look(ref castsToday, "castsToday", 0);
            Scribe_Values.Look(ref nextAllowedTick, "nextAllowedTick", 0);
        }
    }
}

