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
                // Damage Logic
                // Use the Ring's defined blast damage? Or the Verb's damage?
                // Standard Verb logic uses 'verbProps.defaultProjectile' properties usually.
                // But here we want direct damage.
                
                int dmg = 10; // Default
                // Try to find Ring Setting
                if (caster is Pawn p && LanternResources.GetRing(p) is CompLanternRing ring)
                {
                     // TODO: Add generic "GetBlastDamage()" to ring or settings
                }
                
                DamageInfo dinfo = new DamageInfo(DamageDefOf.Burn, dmg, 1.0f, -1, caster, null, null);
                currentTarget.Thing.TakeDamage(dinfo);
            }

            // Standard sound
            base.TryCastShot(); 
            return true;
        }
    }
}
