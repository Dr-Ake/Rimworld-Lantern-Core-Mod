using RimWorld;
using Verse;

namespace DrAke.LanternsFramework
{
    public enum LanternDiscoveryGearPlacement
    {
        Ground,
        DropPod,
        PawnWorn,
        PawnInventory
    }

    public enum LanternDiscoveryGearReceiver
    {
        PreferAlive,
        PreferDead,
        AliveOnly,
        DeadOnly,
        AnyPawn
    }

    public enum LanternDiscoveryTargetType
    {
        WorldSite,
        ActiveMap
    }

    public class LanternDiscoveryIncidentExtension : DefModExtension
    {
        // Required: which gear to place at the site.
        public ThingDef gearDef;
        public int gearCount = 1;

        // World site display and timing.
        public WorldObjectDef siteDef;
        public string siteLabel;
        public string siteDescription;
        public string siteLabelKey = "Lantern_DiscoveryEvent_SiteLabel";
        public string siteDescriptionKey = "Lantern_DiscoveryEvent_SiteDesc";
        public float siteTimeoutDays = 15f; // 0 = never expires

        // Placement constraints (tiles from any player settlement).
        public int minDistanceFromPlayerTiles = 6;
        public int maxDistanceFromPlayerTiles = 40;

        // Target behavior.
        public LanternDiscoveryTargetType targetType = LanternDiscoveryTargetType.WorldSite;
        public float mapDropRadius = 10f;
        public bool mapDropPreferColony = true;

        // Letter settings.
        public bool sendLetter = true;
        public string letterLabel;
        public string letterText;
        public string letterLabelKey = "Lantern_DiscoveryEvent_LetterLabel";
        public string letterTextKey = "Lantern_DiscoveryEvent_LetterText";
        public LetterDef letterDef = LetterDefOf.NeutralEvent;

        // Crash flavor.
        public bool spawnCrashDebris = true;
        public ThingDef crashChunkDef; // default ShipChunk
        public ThingDef crashDebrisDef; // default ChunkSlagSteel
        public int crashDebrisCount = 6;
        public float crashDebrisRadius = 6f;

        // Pawn spawn.
        public PawnKindDef pawnKind;
        public FactionDef pawnFaction;
        public int alivePawnsMin = 0;
        public int alivePawnsMax = 0;
        public int deadPawnsMin = 1;
        public int deadPawnsMax = 1;
        public bool alivePawnsDowned = true;
        public float pawnScatterRadius = 8f;

        // Delivery.
        public bool spawnPawnsInDropPods = true;
        public float dropPodOpenDelaySeconds = 2f;

        // Gear placement.
        public LanternDiscoveryGearPlacement gearPlacement = LanternDiscoveryGearPlacement.PawnWorn;
        public LanternDiscoveryGearReceiver gearReceiver = LanternDiscoveryGearReceiver.PreferAlive;
    }
}
