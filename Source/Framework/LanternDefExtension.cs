using System.Collections.Generic;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class LanternDefExtension : DefModExtension
    {
        // UI & Visuals
        public Color ringColor = Color.green;
        public string resourceLabel = "Willpower";

        // Charge
        // Max "capacity" for this ring. Most XML settings use fractions (0..1) of this max.
        public float maxCharge = 1f;

        // Charge gizmo text colors (optional overrides).
        // If override flags are false, label uses ringColor and percent uses white.
        public bool chargeUseLabelColorOverride = false;
        public Color chargeLabelColorOverride = Color.white;
        public bool chargeUsePercentColorOverride = false;
        public Color chargePercentColorOverride = Color.white;

        // Passive charge model (rates are fractions of maxCharge per day).
        public float passiveRegenPerDay = 0f;
        public float passiveDrainPerDay = 0f;

        // Conditional charge regen (optional).
        public bool regenFromMood = false;
        public float moodMin = 0.80f;
        public float moodRegenPerDay = 0.10f;
        public bool moodRegenScale = true;

        public bool regenFromPain = false;
        public float painMin = 0.20f;
        public float painRegenPerDay = 0.10f;
        public bool painRegenScale = true;

        public bool regenFromSunlight = false;
        public float sunlightMinGlow = 0.50f;
        public float sunlightRegenPerDay = 0.10f;
        public bool sunlightRegenScale = true;

        public bool regenFromPsyfocus = false;
        public float psyfocusMin = 0.50f;
        public float psyfocusRegenPerDay = 0.10f;
        public bool psyfocusRegenScale = true;

        public bool regenFromNearbyAllies = false;
        public int alliesRadius = 10;
        public int alliesMaxCount = 5;
        public float alliesRegenPerDayEach = 0.02f;

        // Mechanics
        public HediffDef associatedHediff;
        // Optional additional hediffs to apply while worn (stackable with associatedHediff).
        public List<HediffDef> hediffsWhileWorn = new List<HediffDef>();
        public bool allowBatteryManifest = false;
        public ThingDef batteryDef;
        // Manifested battery settings (optional).
        public float batteryManifestCost = 0.5f; // fraction of charge consumed
        // Maximum manifested batteries of this batteryDef that may exist globally. 0 = unlimited.
        public int batteryManifestMaxGlobal = 0;
        // Maximum manifested batteries of this batteryDef that may exist per map. 0 = unlimited.
        public int batteryManifestMaxPerMap = 0;

        // Transformation
        // If set, these items are equipped when the ring is worn.
        // Conflicting items are stored inside the ring comp and restored upon unequip.
        public List<ThingDef> transformationApparel = new List<ThingDef>();

        // Transformation conditions (optional).
        // If true, the transformation only applies while the pawn is drafted (and reverts when undrafted).
        public bool transformationOnlyWhenDrafted = false;
        // If true, the transformation will not remove conflicting apparel; instead it skips any piece it can't wear.
        // This lets add-ons do "partial" transformations without forcibly stripping hats/armor/etc.
        public bool transformationSkipConflictingApparel = false;
        // If true, adds a gizmo to toggle the transformation (costume/body swap) on/off without removing the gear.
        public bool transformationToggleGizmo = false;
        // Default state for the toggle when the gear is first created/spawned.
        public bool transformationToggleDefaultOn = true;
        // If true, the transformation is skipped entirely if any transformation apparel cannot resolve a worn graphic
        // for the pawn's current body type (prevents "invisible body" visuals). Does not apply if body type override is enabled.
        public bool transformationSkipIfMissingWornGraphic = false;

        // Optional filters for who may receive the transformation.
        public bool transformationAllowMaleGender = true;
        public bool transformationAllowFemaleGender = true;
        public bool transformationAllowNoneGender = true;
        // If non-empty, only these body types may transform.
        public List<BodyTypeDef> transformationAllowedBodyTypes = new List<BodyTypeDef>();
        // If non-empty, these body types will never transform.
        public List<BodyTypeDef> transformationDisallowedBodyTypes = new List<BodyTypeDef>();
        // Optional body type override while transformed.
        // Useful when the add-on only provides worn textures for a single body type (e.g. Male) and wants to "force" that shape during the costume.
        // On revert/unequip, the pawn's original body type is restored.
        public bool transformationOverrideBodyType = false;
        // If true, the override is only applied if the transformation apparel cannot resolve a worn graphic for the pawn's current body type.
        // If false, the body type is always forced while transformed.
        public bool transformationOverrideBodyTypeOnlyIfMissing = true;
        public BodyTypeDef transformationBodyTypeOverride;

        // Generic Abilities
        public List<AbilityDef> abilities = new List<AbilityDef>();
        
        // Generic Combat
        public int blastDamage = 10;
        public DamageDef blastDamageType; // Defaults to Burn if null

        // Optional blast visuals (used if the blast ability doesn't override them).
        public FleckDef blastBeamFleckDef;
        public float blastBeamFleckScale = 1f;
        public int blastBeamFleckCount = 0; // 0 = auto based on distance
        public bool blastTintBeamToRingColor = true;
        public bool blastUseBeamColorOverride = false;
        public Color blastBeamColorOverride = Color.white;

        // Protection (opt-in per ring; framework defaults to off).
        // These are intended for "environmental" threats (vacuum, hypoxia, etc.) and optional damage absorption.
        public bool blockEnvironmentalHediffs = false;
        // Charge fraction consumed each time a blocked hediff would be applied (0 = free).
        public float blockEnvironmentalHediffsCost = 0f;
        // Optional allowlist of specific hediffs to block. If empty, keyword matching is used.
        public List<HediffDef> blockedHediffs = new List<HediffDef>();
        // Optional keyword matching against hediff.defName (case-insensitive).
        public List<string> blockedHediffDefNameKeywords = new List<string>();

        public bool absorbEnvironmentalDamage = false;
        public float absorbEnvironmentalDamageCost = 0f;
        public List<DamageDef> environmentalDamageDefs = new List<DamageDef>();
        public List<string> environmentalDamageDefNameKeywords = new List<string>();

        public bool absorbCombatDamage = false;
        // Charge fraction consumed each time combat damage is absorbed.
        public float absorbCombatDamageCost = 0.02f;
        // Optional allowlist of combat damage defs to absorb. If empty, any non-environmental damage may be absorbed.
        public List<DamageDef> combatDamageDefs = new List<DamageDef>();
    }
}
