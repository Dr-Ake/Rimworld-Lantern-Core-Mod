using RimWorld;
using RimWorld.Planet;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class IncidentWorker_LanternDiscovery : IncidentWorker
    {
        protected override bool CanFireNowSub(IncidentParms parms)
        {
            var ext = def?.GetModExtension<LanternDiscoveryIncidentExtension>();
            if (ext == null || ext.gearDef == null) return false;
            if (ext.targetType == LanternDiscoveryTargetType.ActiveMap)
            {
                Map map = parms?.target as Map ?? Find.Maps.Find(m => m.IsPlayerHome);
                return map != null;
            }

            return TryFindTile(ext, out _);
        }

        protected override bool TryExecuteWorker(IncidentParms parms)
        {
            var ext = def?.GetModExtension<LanternDiscoveryIncidentExtension>();
            if (ext == null || ext.gearDef == null) return false;

            if (ext.targetType == LanternDiscoveryTargetType.ActiveMap)
            {
                Map map = parms?.target as Map ?? Find.Maps.Find(m => m.IsPlayerHome);
                if (map == null) return false;

                LanternDiscoverySpawnInfo info = LanternDiscoverySpawner.CreateFromExtension(ext);
                IntVec3 center = LanternDiscoverySpawner.SpawnAtMap(map, info);

                if (ext.sendLetter)
                {
                    string label = ResolveText(ext.letterLabel, ext.letterLabelKey, "Lantern_DiscoveryEvent_LetterLabel");
                    string text = ResolveTextWithArg(ext.letterText, ext.letterTextKey, "Lantern_DiscoveryEvent_LetterText", ext.gearDef.LabelCap);
                    if (label.NullOrEmpty()) label = "Lantern_DiscoveryEvent_LetterLabel".Translate();
                    if (text.NullOrEmpty()) text = "Lantern_DiscoveryEvent_LetterText".Translate(ext.gearDef.LabelCap);
                    Find.LetterStack.ReceiveLetter(label, text, ext.letterDef ?? LetterDefOf.NeutralEvent, new TargetInfo(center, map));
                }

                return true;
            }

            if (!TryFindTile(ext, out PlanetTile tile)) return false;

            WorldObjectDef siteDef =
                ext.siteDef ??
                DefDatabase<WorldObjectDef>.GetNamedSilentFail("Lantern_DiscoverySite");

            if (siteDef == null)
            {
                Log.Error("[LanternsCore] Lantern discovery incident failed: missing WorldObjectDef 'Lantern_DiscoverySite'.");
                return false;
            }

            LanternDiscoverySite site = WorldObjectMaker.MakeWorldObject(siteDef) as LanternDiscoverySite;
            if (site == null)
            {
                Log.Error("[LanternsCore] Lantern discovery incident failed: siteDef is not a LanternDiscoverySite.");
                return false;
            }

            site.Tile = tile;
            site.ConfigureFromExtension(ext);
            Find.WorldObjects.Add(site);

            if (ext.sendLetter)
            {
                string label = ResolveText(ext.letterLabel, ext.letterLabelKey, "Lantern_DiscoveryEvent_LetterLabel");
                string text = ResolveTextWithArg(ext.letterText, ext.letterTextKey, "Lantern_DiscoveryEvent_LetterText", site.GearLabelCap);
                if (label.NullOrEmpty()) label = "Lantern_DiscoveryEvent_LetterLabel".Translate();
                if (text.NullOrEmpty()) text = "Lantern_DiscoveryEvent_LetterText".Translate(site.GearLabelCap);

                Find.LetterStack.ReceiveLetter(label, text, ext.letterDef ?? LetterDefOf.NeutralEvent, new GlobalTargetInfo(tile));
            }

            return true;
        }

        private static bool TryFindTile(LanternDiscoveryIncidentExtension ext, out PlanetTile tile)
        {
            int minDist = Mathf.Max(0, ext.minDistanceFromPlayerTiles);
            int maxDist = Mathf.Max(minDist, ext.maxDistanceFromPlayerTiles);

            if (TileFinder.TryFindNewSiteTile(out tile, minDist, maxDist, true))
            {
                return true;
            }

            // Fallback: any passable tile near a player settlement.
            if (TileFinder.TryFindRandomPlayerTile(out tile, true))
            {
                return true;
            }

            tile = PlanetTile.Invalid;
            return false;
        }

        private static string ResolveText(string literal, string key, string fallbackKey)
        {
            if (!literal.NullOrEmpty()) return literal;
            if (!key.NullOrEmpty() && key.CanTranslate()) return key.Translate();
            if (!fallbackKey.NullOrEmpty() && fallbackKey.CanTranslate()) return fallbackKey.Translate();
            return string.Empty;
        }

        private static string ResolveTextWithArg(string literal, string key, string fallbackKey, string arg)
        {
            if (!literal.NullOrEmpty()) return literal;
            if (!key.NullOrEmpty() && key.CanTranslate()) return key.Translate(arg);
            if (!fallbackKey.NullOrEmpty() && fallbackKey.CanTranslate()) return fallbackKey.Translate(arg);
            return string.Empty;
        }
    }
}
