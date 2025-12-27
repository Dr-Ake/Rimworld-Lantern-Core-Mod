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
        public bool showChargeGizmo = true;

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

        // Reactive Defense (opt-in)
        // Cancels incoming non-explosive projectiles by consuming charge and spawning a gas cloud (e.g. BlindSmoke).
        public bool reactiveEvadeProjectiles = false;
        // Charge fraction consumed each time an evade triggers.
        public float reactiveEvadeProjectilesCost = 0.02f;
        // Minimum time between evades (ticks). 0 = no cooldown.
        public int reactiveEvadeProjectilesCooldownTicks = 60;
        // If true, can also cancel explosive projectiles (default false because it prevents explosions).
        public bool reactiveEvadeAllowExplosiveProjectiles = false;

        // Optional toggle gizmo (on/off) without removing the gear.
        public bool reactiveEvadeToggleGizmo = false;
        public bool reactiveEvadeDefaultEnabled = true;

        // Gas spawned when evasion triggers.
        public GasType reactiveEvadeGasType = GasType.BlindSmoke;
        public float reactiveEvadeGasRadius = 2.4f;
        // Lower values dissipate faster; higher values last longer.
        public int reactiveEvadeGasAmount = 60;

        // ================== Stealth / Veil (optional) ==================
        // Toggleable "stealth" mode that applies a hediff and can drain its own energy pool.
        public bool stealthEnabled = false;
        public HediffDef stealthHediff;
        public bool stealthToggleGizmo = true;
        public bool stealthDefaultOn = false;
        public string stealthGizmoLabelKey = "Lantern_Command_ToggleStealth";
        public string stealthGizmoDescKey = "Lantern_Command_ToggleStealthDesc";
        public string stealthGizmoIconPath;

        public bool stealthShowEnergyGizmo = false;
        public string stealthEnergyLabel = "Stealth";
        public Color stealthEnergyColor = new Color(0.2f, 0.6f, 0.8f, 1f);
        public float stealthEnergyMax = 1f;
        // Fraction (0..1) of max energy drained per second while active.
        public float stealthEnergyDrainPerSecond = 0f;
        // Fraction (0..1) of max energy regenerated per day while inactive.
        public float stealthEnergyRegenPerDay = 1f;
        // Starting fraction (0..1) of max energy for newly created gear.
        public float stealthEnergyStartPercent = 1f;
        public bool stealthBreakOnAttack = false;
        public bool stealthPreventTargeting = true;
        public List<PawnKindDef> stealthSeeThroughPawnKinds = new List<PawnKindDef>();
        public List<HediffDef> stealthSeeThroughHediffs = new List<HediffDef>();

        // ================== Corruption / Influence (optional) ==================
        // Persistent corruption hediff that grows while worn.
        public HediffDef corruptionHediff;
        public float corruptionInitialSeverity = 0.01f;
        // Fraction (0..1) of severity gained per day while worn.
        public float corruptionGainPerDay = 0.05f;
        public int corruptionTickIntervalSeconds = 1;
        public float corruptionStealthMultiplier = 1f;
        public List<LanternMentalStateTrigger> corruptionMentalStates = new List<LanternMentalStateTrigger>();

        // Computes a "ring attention" level from corruption severity.
        public float attentionMultiplier = 1f;

        // Optional ambient influence applied while the gear is not worn (e.g., buried whispers).
        public bool ambientInfluenceEnabled = false;
        public HediffDef ambientInfluenceHediff;
        public bool ambientInfluenceOnlyWhenUnworn = true;
        public bool ambientInfluenceOnlyWhenBuried = false;
        public bool ambientInfluenceSkipWearers = true;
        public bool ambientInfluenceAffectsColonistsOnly = true;
        public bool ambientInfluenceAffectsHumanlikeOnly = true;
        public float ambientInfluenceRadius = 0f; // 0 = whole map
        public float ambientInfluenceIntervalSeconds = 4f;
        public float ambientInfluenceInitialSeverity = 0.02f;
        public float ambientInfluenceSeverityPerTick = 0.002f;
        public float ambientInfluenceBreakThreshold = 0.8f;
        public float ambientInfluenceBreakChance = 0.05f;
        public MentalStateDef ambientInfluenceMentalState;

        // Optional influence applied around the wearer while the gear is worn.
        public bool wearerInfluenceEnabled = false;
        public HediffDef wearerInfluenceHediff;
        public bool wearerInfluenceAffectsColonistsOnly = false;
        public bool wearerInfluenceAffectsHumanlikeOnly = true;
        public bool wearerInfluenceSkipWearer = true;
        public float wearerInfluenceRadius = 10f;
        public float wearerInfluenceIntervalSeconds = 4f;
        public float wearerInfluenceInitialSeverity = 0.05f;
        public float wearerInfluenceSeverityPerTick = 0.01f;
        public float wearerInfluenceBreakThreshold = 0.8f;
        public float wearerInfluenceBreakChance = 0.05f;
        public MentalStateDef wearerInfluenceMentalState;
        public List<LanternInfluenceTraitModifier> wearerInfluenceTraitModifiers = new List<LanternInfluenceTraitModifier>();

        // ================== Autonomy / Temptation (optional) ==================
        // Biases pawn apparel optimization to favor wearing this gear.
        public bool autoEquipEnabled = false;
        public float autoEquipChance = 1f;
        public float autoEquipScoreBonus = 0f;
        public bool autoEquipAllowDrafted = false;
        public List<LanternAutoEquipTraitModifier> autoEquipTraitBonuses = new List<LanternAutoEquipTraitModifier>();
        public List<LanternAutoEquipHediffModifier> autoEquipHediffBonuses = new List<LanternAutoEquipHediffModifier>();

        // ================== Refuse Removal / Persistence (optional) ==================
        public bool refuseRemoval = false;
        public HediffDef refuseRemovalHediff;
        public float refuseRemovalMinSeverity = 0.5f;
        public string refuseRemovalMessageKey = "Lantern_RefuseRemoval";

        // Force-drop the gear from corpses/graves so it cannot be lost.
        public bool forceDropOnWearerDeath = false;
        public bool forceDropOnCorpseDestroy = false;
        public bool forceDropOnGraveEject = false;
    }

    // ================== Helper configs ==================
    public class LanternMentalStateTrigger
    {
        public MentalStateDef mentalState;
        public float minSeverity = 0.5f;
        public float maxSeverity = 1f;
        public float chancePerCheck = 0.05f;
        public int checkIntervalTicks = 1000;
        public bool requireNotAlreadyInState = true;
    }

    public class LanternAutoEquipTraitModifier
    {
        public TraitDef trait;
        public int degree = 0;
        public float scoreOffset = 10f;
    }

    public class LanternAutoEquipHediffModifier
    {
        public HediffDef hediff;
        public float minSeverity = 0f;
        public float maxSeverity = 9999f;
        public float scoreOffset = 10f;
        public float severityMultiplier = 0f;
    }

    public class LanternInfluenceTraitModifier
    {
        public TraitDef trait;
        public int degree = 0;
        public float severityMultiplier = 1f;
        public float severityOffset = 0f;
    }
}
