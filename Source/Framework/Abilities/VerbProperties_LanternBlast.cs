using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    // Optional verbProperties class for XML-defined blast tuning.
    // If not used, Verb_LanternBlast falls back to ring extension values.
    public class VerbProperties_LanternBlast : VerbProperties
    {
        // When > 0, overrides ring blastDamage.
        public int damageOverride = 0;

        // When set, overrides ring blastDamageType.
        public DamageDef damageTypeOverride;

        // Multiplies final damage after override selection.
        public float damageMultiplier = 1f;
    }
}

