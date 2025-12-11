using System;
using System.Collections.Generic;
using RimWorld;
using UnityEngine;
using Verse;
using DrAke.LanternsFramework;

namespace DrAke.LanternsFramework.Abilities
{
    // ================== Cost Comp ==================
    public class CompProperties_RingCost : CompProperties_AbilityEffect
    {
        public float costPercent = 0.05f;
        public CompProperties_RingCost()
        {
            this.compClass = typeof(CompAbilityEffect_RingCost);
        }
    }

    public class CompAbilityEffect_RingCost : CompAbilityEffect
    {
        public new CompProperties_RingCost Props => (CompProperties_RingCost)props;

        public override bool GizmoDisabled(out string reason)
        {
            if (GetRingComp(out var ring))
            {
                // TODO: Add generic Settings access to Core if needed, or rely on Props
                float cost = Props.costPercent; 
                if (ring.charge < cost)
                {
                    reason = "Lantern_NotEnoughWillpower".Translate(); // Generic Translation Key
                    return true;
                }
                if (!ring.IsActive)
                {
                    reason = "Lantern_RingInert".Translate();
                    return true;
                }
            }
            else
            {
                reason = "Lantern_NoRing".Translate();
                return true;
            }
            reason = null;
            return false;
        }

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            if (GetRingComp(out var ring))
            {
                ring.TryConsumeCharge(Props.costPercent);
            }
        }

        private bool GetRingComp(out CompLanternRing ring)
        {
            ring = null;
            Pawn pawn = parent.pawn;
            if (pawn == null || pawn.apparel == null) return false;
            
            // Check for generic CompLanternRing
            var ringComp = LanternResources.GetRing(pawn);
            if (ringComp != null)
            {
                ring = ringComp;
                return true;
            }
            return false;
        }
    }

    // ================== Shield Ability (Applies Hediff) ==================
    public class CompProperties_LanternShieldAbility : CompProperties_AbilityEffect
    {
        public HediffDef shieldHediffDef;
        public CompProperties_LanternShieldAbility()
        {
            this.compClass = typeof(CompAbilityEffect_LanternShield);
        }
    }

    public class CompAbilityEffect_LanternShield : CompAbilityEffect
    {
        public new CompProperties_LanternShieldAbility Props => (CompProperties_LanternShieldAbility)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            Pawn p = parent.pawn;
            // Fallback if not set in XML, try finding by name or assume standard
            HediffDef def = Props.shieldHediffDef;
            if (def == null) def = HediffDef.Named("GL_Hediff_Shield"); // Fallback for GL, or error?

            if (def == null)
            {
                Log.Error("[LanternsCore] Shield Ability missing shieldHediffDef in props.");
                return;
            }
            
            // Toggle
            var hediff = p.health.hediffSet.GetFirstHediffOfDef(def);
            if (hediff != null)
            {
                MoteMaker.ThrowText(p.DrawPos, p.Map, "Lantern_ShieldOff".Translate(), Color.red);
                p.health.RemoveHediff(hediff);
            }
            else
            {
                MoteMaker.ThrowText(p.DrawPos, p.Map, "Lantern_ShieldOn".Translate(), Color.green);
                p.health.AddHediff(def);
            }
        }
    }
    
    // Note: The Hediff Comp Props are in LanternShield.cs. This is the Ability Comp Props.

    // ================== Spawn Generic ==================
    public class CompProperties_AbilitySpawn : CompProperties_AbilityEffect
    {
        public ThingDef thingDef;
        public CompProperties_AbilitySpawn()
        {
            this.compClass = typeof(CompAbilityEffect_Spawn);
        }
    }

    public class CompAbilityEffect_Spawn : CompAbilityEffect
    {
        public new CompProperties_AbilitySpawn Props => (CompProperties_AbilitySpawn)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);
            if (target.Cell.IsValid && Props.thingDef != null)
            {
                Thing thing = GenSpawn.Spawn(Props.thingDef, target.Cell, parent.pawn.Map);
                thing.SetFaction(parent.pawn.Faction);
            }
        }
    }

    // ================== Shuttle Spawn ==================
    // Can basically use the same Spawn Effect, but specific props class for XML compatibility
    public class CompProperties_AbilitySpawnShuttle : CompProperties_AbilityEffect
    {
        public ThingDef thingDef; // Or specific shuttle def?
        public CompProperties_AbilitySpawnShuttle()
        {
            this.compClass = typeof(CompAbilityEffect_SpawnShuttle);
        }
    }

    public class CompAbilityEffect_SpawnShuttle : CompAbilityEffect
    {
         // Logic for shuttle might be identical to Spawn, or have extra initialization (like assigning pilot?)
         // For now, simple spawn.
         public new CompProperties_AbilitySpawnShuttle Props => (CompProperties_AbilitySpawnShuttle)props;
         
         public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
         {
             base.Apply(target, dest);
             // Logic
             if (target.Cell.IsValid)
             {
                 ThingDef def = Props.thingDef ?? DefDatabase<ThingDef>.GetNamed("GL_Shuttle_Construct", false);
                 if (def != null)
                 {
                      GenSpawn.Spawn(def, target.Cell, parent.pawn.Map).SetFaction(parent.pawn.Faction);
                 }
             }
         }
    }
}
