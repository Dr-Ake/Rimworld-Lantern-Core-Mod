using System.Collections.Generic;
using System.Linq;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Recharge
{
    // Tracks batteries manifested by rings so add-ons can cap how many exist.
    public class ManifestBatteryManager : GameComponent
    {
        private List<ManifestBatteryEntry> entries = new List<ManifestBatteryEntry>();

        public ManifestBatteryManager(Game game)
        {
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Collections.Look(ref entries, "manifestedBatteries", LookMode.Deep);
            if (Scribe.mode == LoadSaveMode.PostLoadInit && entries == null)
            {
                entries = new List<ManifestBatteryEntry>();
            }
        }

        public void Register(ThingDef batteryDef, Thing innerThing, Map map)
        {
            if (batteryDef == null || innerThing == null) return;
            Cleanup();
            entries.Add(new ManifestBatteryEntry
            {
                batteryDef = batteryDef,
                innerThing = innerThing,
                mapId = map?.uniqueID ?? -1
            });
        }

        public int CountGlobal(ThingDef batteryDef)
        {
            if (batteryDef == null) return 0;
            Cleanup();
            return entries.Count(e => e != null && e.batteryDef == batteryDef);
        }

        public int CountOnMap(ThingDef batteryDef, Map map)
        {
            if (batteryDef == null || map == null) return 0;
            Cleanup();
            return entries.Count(e => e != null && e.batteryDef == batteryDef && e.mapId == map.uniqueID);
        }

        private void Cleanup()
        {
            if (entries.NullOrEmpty()) return;
            entries.RemoveAll(e => e == null || e.innerThing == null || e.innerThing.Destroyed);
        }
    }

    public class ManifestBatteryEntry : IExposable
    {
        public ThingDef batteryDef;
        public Thing innerThing;
        public int mapId = -1;

        public void ExposeData()
        {
            Scribe_Defs.Look(ref batteryDef, "batteryDef");
            Scribe_References.Look(ref innerThing, "innerThing");
            Scribe_Values.Look(ref mapId, "mapId", -1);
        }
    }
}

