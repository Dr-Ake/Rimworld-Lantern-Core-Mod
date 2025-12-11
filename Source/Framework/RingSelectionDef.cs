using System;
using System.Collections.Generic;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework
{
    public class RingSelectionDef : Def
    {
        public ThingDef ringDef;
        public ThingDef orbDef; // The projectile/skyfaller used for delivery
        public Type workerClass = typeof(RingSelectionWorker);

        // Triggers
        public bool triggerPeriodic = false; // Checks periodically (Sector Scan)
        public int periodicInterval = 120000; // Ticks (default 2 days)
        
        public bool triggerMentalState = false; // Checks when a pawn breaks
        public List<string> mentalStates = new List<string>(); // "Berserk", "Panic", etc. Empty = Any.

        // Conditions
        // Generic score modifiers
        public List<SelectionCondition> conditions = new List<SelectionCondition>();
    }

    public abstract class SelectionCondition
    {
        public abstract float CalculateScore(Pawn p, RingSelectionDef def);
    }

    // Example Condition: Trait Match
    public class Condition_Trait : SelectionCondition
    {
        public TraitDef trait;
        public int degree = 0; // Check specific degree if needed? 
        public float scoreBonus = 10f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            Trait t = p.story.traits.GetTrait(trait);
            if (t != null) return scoreBonus;
            return 0f;
        }
    }
    
    // Example Condition: Stat Threshold (e.g. Mental Break Threshold)
    public class Condition_Stat : SelectionCondition
    {
        public StatDef stat;
        public bool lowerIsBetter = false;
        public float scoreMultiplier = 10f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            float val = p.GetStatValue(stat);
            if (lowerIsBetter)
            {
                 return (1.0f - val) * scoreMultiplier;
            }
            return val * scoreMultiplier;
        }
    }

    // Extension Condition: Checks for ModExtension on traits
    public class Condition_TraitExtensions : SelectionCondition
    {
        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            float score = 0f;
            foreach (Trait trait in p.story.traits.allTraits)
            {
                // We need to resolve reference to LanternTraitScoreExtension which is defined... where?
                // Ah, LanternTraitScoreExtension is likely also Framework logic now.
                // We should make sure we have a generic version of it.
                // For now, let's assume it's moved to Framework namespace too.
                LanternTraitScoreExtension ext = trait.def.GetModExtension<LanternTraitScoreExtension>();
                if (ext != null)
                {
                    score += ext.ScoreFor(trait);
                }
            }
            return score;
        }
    }
}
