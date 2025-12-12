using RimWorld;
using UnityEngine;
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

        // Optional beam visuals. If beamFleckDef is set, flecks are spawned along the line
        // between caster and target. If not set, Verb_LanternBlast will fall back to ring defaults.
        public FleckDef beamFleckDef;
        public float beamFleckScale = 1f;
        public int beamFleckCount = 0; // 0 = auto based on distance
        public bool tintBeamToRingColor = true;
        public bool useBeamColorOverride = false;
        public Color beamColorOverride = Color.white;

        // Optional impact fleck at the target.
        public FleckDef impactFleckDef;
        public float impactFleckScale = 1f;
        public bool useImpactColorOverride = false;
        public Color impactColorOverride = Color.white;

        // Optional projectile mode. If projectileDef is set, the blast launches a traveling projectile
        // instead of dealing instant damage.
        public ThingDef projectileDef;

        // Optional beam that connects caster -> projectile while it flies (cartoon laser effect).
        public ThingDef projectileBeamMoteDef;
        public Vector3 projectileBeamOffsetA = Vector3.zero;
        public Vector3 projectileBeamOffsetB = Vector3.zero;
        public float projectileBeamScale = 0.5f;
        public bool projectileBeamTintToRingColor = true;
        public bool projectileBeamUseColorOverride = false;
        public Color projectileBeamColorOverride = Color.white;
    }
}
