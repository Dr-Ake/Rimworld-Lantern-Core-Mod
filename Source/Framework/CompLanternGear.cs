using Verse;

namespace DrAke.LanternsFramework
{
    // Alias props so add-on authors can think in terms of "gear" instead of "ring".
    public class CompProperties_LanternGear : CompProperties
    {
        public CompProperties_LanternGear()
        {
            compClass = typeof(CompLanternRing);
        }
    }
}

