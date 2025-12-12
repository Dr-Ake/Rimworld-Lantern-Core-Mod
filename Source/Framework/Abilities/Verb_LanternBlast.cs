using System;
using RimWorld;
using UnityEngine;
using Verse;
using DrAke.LanternsFramework;

namespace DrAke.LanternsFramework.Abilities
{
    public class Verb_LanternBlast : Verb_Shoot
    {
        protected override bool TryCastShot()
        {
            if (currentTarget.HasThing && currentTarget.Thing.Map != caster.Map) return false;

            // Instantly hit (Laser/Beam logic)
            bool hit = true; 
            
            // Visuals: Draw beam from Caster to Target
            // In future, use flexible Mote or Effecter defined in XML properties of the Verb/Ability
            
            if (hit && currentTarget.HasThing)
            {
                int dmg = 10; // Default
                DamageDef dmgType = DamageDefOf.Burn;

                // Try to find Ring Setting
                if (caster is Pawn p)
                {
                    var ring = LanternResources.GetRing(p);
                    if (ring != null)
                    {
                        dmg = ring.GetBlastDamage();
                        dmgType = ring.GetBlastDamageType();
                    }
                }
                
                DamageInfo dinfo = new DamageInfo(dmgType, dmg, 1.0f, -1, caster, null, null);
                currentTarget.Thing.TakeDamage(dinfo);
            }

            // Standard sound
            base.TryCastShot(); 
            return true;
        }
    }
}
