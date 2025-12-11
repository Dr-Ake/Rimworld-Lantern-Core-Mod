using RimWorld;
using UnityEngine;
using Verse;
using DrAke.LanternsFramework;

namespace DrAke.LanternsFramework.Abilities
{
    public class HediffCompProperties_LanternShield : HediffCompProperties
    {
        public float defaultMaxHp = 200f;
        public HediffCompProperties_LanternShield()
        {
            this.compClass = typeof(HediffComp_LanternShield);
        }
    }

    public class HediffComp_LanternShield : HediffComp
    {
        public HediffCompProperties_LanternShield Props => (HediffCompProperties_LanternShield)props;
        public float hp;
        public float maxHp;

        public override void CompPostPostAdd(DamageInfo? dinfo)
        {
            base.CompPostPostAdd(dinfo);
            maxHp = Props.defaultMaxHp; // Default from XML
            hp = maxHp;
        }

        public override void CompExposeData()
        {
            base.CompExposeData();
            Scribe_Values.Look(ref hp, "hp", 200f);
            Scribe_Values.Look(ref maxHp, "maxHp", 200f);
        }

        public override void CompPostTick(ref float severityAdjustment)
        {
            base.CompPostTick(ref severityAdjustment);
            if (hp <= 0)
            {
                Pawn.health.RemoveHediff(parent);
                EffecterDefOf.Shield_Break.Spawn(Pawn.Position, Pawn.Map, 1f);
            }
        }
        
        // Hook for Patches to call
        public bool TryAbsorbDamage(DamageInfo dinfo)
        {
            if (hp <= 0) return false;
            // Blocks Incoming Damage (Bullets/Melee/Explosive)
            if (dinfo.Def.isExplosive || dinfo.Weapon != null || dinfo.Amount > 0)
            {
                hp -= dinfo.Amount;
                // MoteMaker.ThrowText(Pawn.DrawPos, Pawn.Map, "Block", Color.green);
                return true;
            }
            return false;
        }
    }
}
