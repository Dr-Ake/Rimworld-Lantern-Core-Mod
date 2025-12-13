using System;
using System.Collections.Generic;
using System.Linq;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework
{
    public enum SelectionMode
    {
        HighestScore,
        WeightedRandom,
        RandomAboveThreshold
    }

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

        // Fires when a pawn joins the player's faction (recruited/rescued/converted).
        public bool triggerOnJoinPlayerFaction = false;

        // Fires when a pawn spawns on a player home map.
        public bool triggerOnSpawnedOnMap = false;

        // Fires when a pawn is downed.
        public bool triggerOnDowned = false;

        // Fires when a pawn kills another pawn.
        public bool triggerOnKillAny = false;
        // Fires only when the victim was hostile to the player at time of death.
        public bool triggerOnKillHostile = false;

        // Fires when a hediff is added to a pawn.
        public bool triggerOnHediffAdded = false;
        // If non-empty, only these hediffs trigger. Empty = any hediff.
        public List<HediffDef> hediffsToTriggerOn = new List<HediffDef>();

        // Candidate filters (defaults preserve legacy Green Lantern behavior)
        public bool allowColonists = true;
        public bool allowPrisoners = false;
        public bool allowSlaves = false;
        public bool allowGuests = false;
        public bool allowAnimals = false;
        public bool allowMechs = false;
        public bool allowHostiles = false;
        public bool allowDead = false;
        public bool allowDowned = false;
        public bool requireViolenceCapable = true;

        // If true, pawns already wearing any Lantern ring are excluded.
        public bool excludeIfHasAnyLanternRing = false;
        // Optional apparel tags that, if present on any worn apparel, exclude the pawn.
        public List<string> excludedApparelTags = new List<string>();

        // Selection behavior
        public SelectionMode selectionMode = SelectionMode.HighestScore;
        public float minScoreToSelect = 0.01f;

        // Run/limit behavior (optional)
        // If true, this selection def stops triggering after it runs once (success or not).
        public bool runOnlyOnce = false;
        // If true, this selection def stops triggering after the first successful ring assignment.
        public bool stopAfterFirstSuccess = false;
        // Maximum number of rings this def may assign total for the colony/game. 0 = unlimited.
        public int maxRingsTotal = 0;
        // Maximum number of active (currently worn) rings of ringDef allowed in the colony at once. 0 = unlimited.
        public int maxActiveRingsInColony = 0;

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
            if (t != null)
            {
                if (degree != 0 && t.Degree != degree) return 0f;
                return scoreBonus;
            }
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

    // Skill-based condition.
    public class Condition_Skill : SelectionCondition
    {
        public SkillDef skill;
        public int minLevel = 0;
        public float scoreMultiplier = 1f;
        public float flatBonus = 0f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (skill == null || p.skills == null) return 0f;
            int level = p.skills.GetSkill(skill)?.Level ?? 0;
            if (level < minLevel) return 0f;
            return flatBonus + level * scoreMultiplier;
        }
    }

    // Mood condition (higher or lower mood can be favored).
    public class Condition_Mood : SelectionCondition
    {
        public bool lowerIsBetter = false;
        public float scoreMultiplier = 10f;
        public float flatBonus = 0f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (p.needs?.mood == null) return 0f;
            float mood = p.needs.mood.CurLevelPercentage; // 0..1
            float val = lowerIsBetter ? (1f - mood) : mood;
            return flatBonus + val * scoreMultiplier;
        }
    }

    // Age window condition.
    public class Condition_Age : SelectionCondition
    {
        public float minAge = 0f;
        public float maxAge = 999f;
        public float scoreBonus = 5f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            float age = p.ageTracker?.AgeBiologicalYearsFloat ?? 0f;
            if (age < minAge || age > maxAge) return 0f;
            return scoreBonus;
        }
    }

    // Gender preference condition.
    public class Condition_Gender : SelectionCondition
    {
        public Gender gender = Gender.None;
        public float scoreBonus = 5f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (gender == Gender.None) return 0f;
            return p.gender == gender ? scoreBonus : 0f;
        }
    }

    // Hediff presence/severity condition.
    public class Condition_Hediff : SelectionCondition
    {
        public HediffDef hediff;
        public float minSeverity = 0f;
        public float maxSeverity = 9999f;
        public float scoreBonus = 5f;
        public bool scaleBySeverity = false;
        public float severityMultiplier = 1f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (hediff == null || p.health == null) return 0f;
            Hediff h = p.health.hediffSet.GetFirstHediffOfDef(hediff);
            if (h == null) return 0f;
            if (h.Severity < minSeverity || h.Severity > maxSeverity) return 0f;
            if (scaleBySeverity) return scoreBonus + h.Severity * severityMultiplier;
            return scoreBonus;
        }
    }

    // Gene presence condition (Biotech). Safe no-op if genes not present.
    public class Condition_Gene : SelectionCondition
    {
        public GeneDef gene;
        public float scoreBonus = 5f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (gene == null || p.genes == null) return 0f;
            return p.genes.HasActiveGene(gene) ? scoreBonus : 0f;
        }
    }

    // Ideology meme condition (Ideology). Safe no-op if no ideo.
    public class Condition_Meme : SelectionCondition
    {
        public MemeDef meme;
        public float scoreBonus = 5f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (meme == null || p.Ideo == null) return 0f;
            return p.Ideo.HasMeme(meme) ? scoreBonus : 0f;
        }
    }

    // Passion-based condition. Scores pawns with passion in a given skill.
    public class Condition_Passion : SelectionCondition
    {
        public SkillDef skill;
        public Passion minPassion = Passion.Minor;
        public float minorBonus = 5f;
        public float majorBonus = 10f;
        public float flatBonus = 0f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (skill == null || p.skills == null) return 0f;
            var s = p.skills.GetSkill(skill);
            if (s == null) return 0f;
            Passion passion = s.passion;
            if (passion < minPassion) return 0f;
            float bonus = passion switch
            {
                Passion.Major => majorBonus,
                Passion.Minor => minorBonus,
                _ => 0f
            };
            return flatBonus + bonus;
        }
    }

    // Generic record-based condition (kills, downed, etc.).
    public class Condition_Record : SelectionCondition
    {
        public RecordDef record;
        public float minValue = 0f;
        public float maxValue = 999999f;
        public bool lowerIsBetter = false;
        public float scoreMultiplier = 1f;
        public float flatBonus = 0f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (record == null || p.records == null) return 0f;
            float val = p.records.GetValue(record);
            if (val < minValue || val > maxValue) return 0f;
            float scoreVal = lowerIsBetter ? (1f / (1f + val)) : val;
            return flatBonus + scoreVal * scoreMultiplier;
        }
    }

    // Needs condition (food, rest, joy, etc.).
    public class Condition_Need : SelectionCondition
    {
        public NeedDef need;
        public float minLevel = 0f; // 0..1
        public float maxLevel = 1f; // 0..1
        public bool lowerIsBetter = false;
        public float scoreMultiplier = 10f;
        public float flatBonus = 0f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (need == null || p.needs == null) return 0f;
            Need n = p.needs.TryGetNeed(need);
            if (n == null) return 0f;
            float lvl = n.CurLevelPercentage;
            if (lvl < minLevel || lvl > maxLevel) return 0f;
            float val = lowerIsBetter ? (1f - lvl) : lvl;
            return flatBonus + val * scoreMultiplier;
        }
    }

    // Thought/memory condition (Mood memories).
    public class Condition_Thought : SelectionCondition
    {
        public ThoughtDef thought;
        public float scoreBonus = 10f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (thought == null) return 0f;
            if (p.needs?.mood?.thoughts?.memories == null) return 0f;
            return p.needs.mood.thoughts.memories.GetFirstMemoryOfDef(thought) != null ? scoreBonus : 0f;
        }
    }

    // Drafted/undrafted condition.
    public class Condition_Drafted : SelectionCondition
    {
        public bool mustBeDrafted = true;
        public float scoreBonus = 5f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (p?.drafter == null) return 0f;
            if (p.drafter.Drafted != mustBeDrafted) return 0f;
            return scoreBonus;
        }
    }

    // Biome condition (map-only).
    public class Condition_Biome : SelectionCondition
    {
        public BiomeDef biome;
        public float scoreBonus = 5f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (biome == null) return 0f;
            if (p?.Map == null) return 0f;
            return p.Map.Biome == biome ? scoreBonus : 0f;
        }
    }

    // Ideology precept condition (Ideology).
    public class Condition_Precept : SelectionCondition
    {
        public PreceptDef precept;
        public float scoreBonus = 5f;

        public override float CalculateScore(Pawn p, RingSelectionDef def)
        {
            if (precept == null) return 0f;
            if (p?.Ideo == null) return 0f;
            return p.Ideo.HasPrecept(precept) ? scoreBonus : 0f;
        }
    }
}
