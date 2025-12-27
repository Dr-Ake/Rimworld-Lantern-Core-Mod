using Verse;

namespace DrAke.LanternsFramework
{
    public class MapComponent_LanternDiscoverySite : MapComponent
    {
        private bool spawned;

        public MapComponent_LanternDiscoverySite(Map map) : base(map)
        {
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Values.Look(ref spawned, "lanternDiscovery_spawned", false);
        }

        public override void MapComponentTick()
        {
            base.MapComponentTick();
            if (spawned) return;

            if (map?.Parent is not LanternDiscoverySite site) return;

            spawned = true;
            site.SpawnContents(map);
        }
    }
}
