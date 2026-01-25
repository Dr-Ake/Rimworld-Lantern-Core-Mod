using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using RimWorld;
using RimWorld.Planet;
using UnityEngine;
using Verse;
using Verse.AI;
using DrAke.LanternsFramework;

namespace DrAke.LanternsFramework.Flight
{
    // ================== Helper Drawer (Internal) ==================
    public static class LanternPodDrawer
    {
        public static void DrawPilotPortrait(Pawn pilot, Vector3 drawLoc, bool flip = false)
        {
            if (pilot == null || pilot.Drawer == null) return;
            Rot4 rot = Rot4.South;
            if (flip) rot = Rot4.West; 
            pilot.Drawer.renderer.RenderPawnAt(drawLoc, rot, neverAimWeapon: true);
        }
    }

    // ================== Ability: Flight ==================
    public class Ability_LanternFlight : Ability
    {
        private const float MinLaunchCost = 0.05f;
        private const float MaxRangeTiles = 66f;

        public Ability_LanternFlight() { }
        public Ability_LanternFlight(Pawn pawn) : base(pawn) { }
        public Ability_LanternFlight(Pawn pawn, AbilityDef def) : base(pawn, def) { }

        public override IEnumerable<Command> GetGizmos()
        {
            if (pawn == null || pawn.Dead) yield break;
            var ringComp = LanternResources.GetRing(pawn);
            if (ringComp == null) yield break;

            Command_Action action = new Command_Action
            {
                defaultLabel = def.label,
                defaultDesc = def.description,
                icon = def.uiIcon,
                action = () => BeginFlight(ringComp)
            };

            if (!CanTakeoffNow(ringComp, out string reason))
            {
                action.Disable(reason);
            }
            yield return action;
        }

        private void BeginFlight(CompLanternRing ring)
        {
            Map map = pawn.Map;
            if (map == null) return;

            int originTile = map.Tile;
            CameraJumper.TryJump(new GlobalTargetInfo(originTile));

            Find.WorldTargeter.BeginTargeting(
                target => TryLaunchToTarget(target, ring, originTile),
                canTargetTiles: true,
                mouseAttachment: def.uiIcon,
                closeWorldTabWhenFinished: true,
                extraLabelGetter: t => BuildTargetLabel(t, originTile),
                canSelectTarget: t => CanSelectTarget(t, originTile));
        }

        private TaggedString BuildTargetLabel(GlobalTargetInfo target, int originTile)
        {
            if (!target.IsValid || target.Tile < 0) return TaggedString.Empty;
            float cost = CalculateFlightCost(originTile, target.Tile);
            return "Lantern_FlightCost".Translate(cost.ToString("P0"));
        }

        private bool CanSelectTarget(GlobalTargetInfo target, int originTile)
        {
            if (!target.IsValid || target.Tile < 0) return false;
            Tile tile = Find.WorldGrid[target.Tile];
            BiomeDef biome = GetTileBiome(tile);
            if (biome == BiomeDefOf.Ocean && Find.WorldObjects.MapParentAt(target.Tile) == null)
            {
                return false;
            }
            return true;
        }

        private static BiomeDef GetTileBiome(Tile tile)
        {
            Type tileType = typeof(Tile);

            FieldInfo field =
                tileType.GetField("biome", BindingFlags.Public | BindingFlags.Instance) ??
                tileType.GetField("biomeDef", BindingFlags.Public | BindingFlags.Instance) ??
                tileType.GetField("Biome", BindingFlags.Public | BindingFlags.Instance);

            if (field != null)
            {
                return field.GetValue(tile) as BiomeDef;
            }

            PropertyInfo prop =
                tileType.GetProperty("biome", BindingFlags.Public | BindingFlags.Instance) ??
                tileType.GetProperty("biomeDef", BindingFlags.Public | BindingFlags.Instance) ??
                tileType.GetProperty("Biome", BindingFlags.Public | BindingFlags.Instance);

            return prop?.GetValue(tile, null) as BiomeDef;
        }

        private bool TryLaunchToTarget(GlobalTargetInfo target, CompLanternRing ring, int originTile)
        {
            if (!target.IsValid || target.Tile < 0) return false;

            if (!CanTakeoffNow(ring, out string reason))
            {
                Messages.Message(reason, pawn, MessageTypeDefOf.RejectInput, historical: false);
                return false;
            }

            float cost = CalculateFlightCost(originTile, target.Tile);
            if (ring.ChargePercent < ring.GetEffectiveCostFraction(cost))
            {
                Messages.Message("Lantern_FlightFail_NotEnoughCharge".Translate(cost.ToString("P0")), pawn, MessageTypeDefOf.RejectInput, historical: false);
                return false;
            }

            MapParent targetParent = LanternFlightUtility.GetOrMakeLandingSite(target.Tile, target.WorldObject as MapParent);
            if (targetParent == null)
            {
                Messages.Message("Lantern_FlightFail_Site".Translate(), pawn, MessageTypeDefOf.RejectInput, historical: false);
                return false;
            }

            Job job = JobMaker.MakeJob(DefDatabase<JobDef>.GetNamed("Lantern_Job_Takeoff"), pawn);
            job.globalTarget = target;
            pawn.jobs.TryTakeOrderedJob(job, JobTag.Misc);
            
            CameraJumper.TryJump(pawn.Position, pawn.Map);
            return true;
        }

        public float CalculateFlightCost(int originTile, int destTile)
        {
            float distance = Find.WorldGrid.ApproxDistanceInTiles(originTile, destTile);
            float scaled = distance / MaxRangeTiles;
            return Mathf.Max(MinLaunchCost, scaled * 0.5f);
        }

        private bool CanTakeoffNow(CompLanternRing ring, out string reason)
        {
            reason = null;
            if (pawn.Map == null) { reason = "Lantern_FlightFail_Map".Translate(); return false; }
            if (pawn.Downed) { reason = "Lantern_FlightFail_Downed".Translate(); return false; }
            if (pawn.Position.Roofed(pawn.Map)) { reason = "Lantern_FlightFail_Roof".Translate(); return false; }
            if (ring.ChargePercent <= 0f) { reason = "Lantern_FlightFail_NoCharge".Translate(); return false; }
            return true;
        }
    }

    // ================== JobDriver ==================
    public class JobDriver_LanternFlightTakeoff : JobDriver
    {
        private const int WarmupTicks = 120;

        public override bool TryMakePreToilReservations(bool errorOnFailed) => true;

        protected override IEnumerable<Toil> MakeNewToils()
        {
            Toil prepare = Toils_General.Wait(WarmupTicks);
            prepare.WithProgressBarToilDelay(TargetIndex.A);
            yield return prepare;

            Toil takeoff = new Toil();
            takeoff.initAction = () =>
            {
                FleckMaker.ThrowDustPuff(pawn.Position, pawn.Map, 2f);
                
                var ability = pawn.abilities?.abilities?.OfType<Ability_LanternFlight>().FirstOrDefault();
                var ring = LanternResources.GetRing(pawn);
                
                if (ability != null && ring != null)
                {
                    GlobalTargetInfo target = job.globalTarget;
                    int originTile = pawn.Map.Tile;
                    float cost = ability.CalculateFlightCost(originTile, target.Tile);
                    
                    ring.TryConsumeCharge(cost); 

                    ThingDef leavingDef = DefDatabase<ThingDef>.GetNamed("Lantern_Leaving");
                    LanternLeaving leaving = (LanternLeaving)ThingMaker.MakeThing(leavingDef);
                    
                    leaving.target = target;
                    leaving.cost = cost;
                    leaving.originTile = originTile;
                    
                    GenSpawn.Spawn(leaving, pawn.Position, pawn.Map);
                    pawn.DeSpawn(DestroyMode.Vanish);
                    leaving.innerContainer.TryAdd(pawn);
                    
                    CameraJumper.TryJump(leaving);
                }
            };
            yield return takeoff;
        }
    }

    // ================== Skyfaller: Leaving ==================
    public class LanternLeaving : Skyfaller, IThingHolder
    {
        public GlobalTargetInfo target;
        public float cost;
        public int originTile;

        public LanternLeaving()
        {
            // Skyfaller likely handles initialization, but safe to init logic if needed.
        }
        
        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_TargetInfo.Look(ref target, "target");
            Scribe_Values.Look(ref cost, "cost");
            Scribe_Values.Look(ref originTile, "originTile");
            // Skyfaller base implementation usually scribes innerContainer? 
            // If we access it, we rely on base.
            // But we must assume Skyfaller saves 'innerContainer'.
            // If not, we need to save it. RimWorld Skyfaller saves it.
        }

        protected override void DrawAt(Vector3 drawLoc, bool flip = false)
        {
            DrawDropSpotShadow();
            if (innerContainer != null)
            {
                foreach (Thing t in innerContainer)
                {
                    if (t is Pawn p) LanternPodDrawer.DrawPilotPortrait(p, drawLoc, flip);
                }
            }
        }

        protected override void LeaveMap()
        {
            Map map = Map; 
            if (map != null && target.IsValid && innerContainer.Any)
            {
                 WorldObjectDef travelDef = DefDatabase<WorldObjectDef>.GetNamed("Lantern_WorldObject_FlightTravel");
                 var travel = (WorldObject_LanternFlightTravel)WorldObjectMaker.MakeWorldObject(travelDef);
                 
                 float dist = Find.WorldGrid.ApproxDistanceInTiles(originTile, target.Tile);
                 int ticks = Mathf.Max(120, Mathf.RoundToInt(dist * 200)); 
                 
                 travel.Tile = originTile;
                 Find.WorldObjects.Add(travel);
                 
                 List<Pawn> pawns = new List<Pawn>();
                 foreach (Thing t in innerContainer) if (t is Pawn p) pawns.Add(p);
                 
                 travel.Initialize(pawns.FirstOrDefault(), originTile, target.Tile, ticks, target.WorldObject as MapParent);
                 innerContainer.TryTransferAllToContainer(travel.innerContainer);
                 
                Find.WorldSelector.Select(travel);
                CameraJumper.TryJump(travel);

                // Map Cleanup
                 if (map.mapPawns.FreeColonistsSpawnedCount == 0 && map.Parent.def.defName == "Lantern_LandingStub")
                 {
                     MapParent parent = map.Parent;
                     LongEventHandler.QueueLongEvent(() =>
                     {
                         if (!parent.Destroyed && parent.Map != null && parent.Map.mapPawns.FreeColonistsSpawnedCount == 0)
                         {
                             Current.Game.DeinitAndRemoveMap(parent.Map, false);
                             parent.Destroy();
                         }
                     }, "CleaningUpMap", false, null);
                 }
            }
            if (!this.Destroyed) base.LeaveMap();
        }
    }
    
    // ================== World Object ==================
    [StaticConstructorOnStartup]
    public class WorldObject_LanternFlightTravel : WorldObject, IThingHolder
    {
        public ThingOwner innerContainer;
        public int destinationTile;
        public int ticksToArrive;
        public int initialTicks;
        public int originTile;
        public MapParent specificTarget;
        
        // Removed static FlightMat to allow XML to define texture via WorldObjectDef
        
        public int DestinationTile => destinationTile;

        public WorldObject_LanternFlightTravel()
        {
            innerContainer = new ThingOwner<Thing>(this);
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Values.Look(ref destinationTile, "destinationTile");
            Scribe_Values.Look(ref ticksToArrive, "ticksToArrive");
            Scribe_Values.Look(ref initialTicks, "initialTicks");
            Scribe_Values.Look(ref originTile, "originTile");
            Scribe_References.Look(ref specificTarget, "specificTarget");
            Scribe_Deep.Look(ref innerContainer, "innerContainer", this);
        }

        public void Initialize(Pawn pawn, int origin, int dest, int ticks, MapParent target = null)
        {
            originTile = origin;
            destinationTile = dest;
            ticksToArrive = ticks;
            initialTicks = ticks;
            specificTarget = target;
            Tile = origin;
        }

        protected override void Tick()
        {
            base.Tick();
            ticksToArrive--;
            if (initialTicks > 0)
            {
                 float t = 1f - (float)ticksToArrive / initialTicks;
                 Vector3 start = Find.WorldGrid.GetTileCenter(originTile);
                 Vector3 end = Find.WorldGrid.GetTileCenter(destinationTile);
                 Vector3 cur = Vector3.Slerp(start, end, t);
                 
                 int nextTile = GenWorld.TileAt(cur);
                 if (nextTile >= 0) Tile = nextTile;
            }

            if (ticksToArrive <= 0) Arrive();
        }
        
        private void Arrive()
        {
            MapParent mp = Find.WorldObjects.MapParentAt(destinationTile);
            if (specificTarget != null) mp = specificTarget;
            if (mp == null) mp = LanternFlightUtility.GetOrMakeLandingSite(destinationTile);
            
            if (mp != null)
            {
                if (mp.HasMap) StartLandingSelection(mp.Map);
                else
                {
                    try
                    {
                        // Use robust utility for map generation (handles threat points etc)
                        Map map = GetOrGenerateMapUtility.GetOrGenerateMap(mp.Tile, Find.World.info.initialMapSize, mp.def);
                            
                        if (map != null) StartLandingSelection(map);
                        else
                        {
                            LongEventHandler.QueueLongEvent(() => 
                            {
                                 var m = GetOrGenerateMapUtility.GetOrGenerateMap(mp.Tile, Find.World.info.initialMapSize, mp.def);
                                 if (m != null) StartLandingSelection(m);
                            }, "GeneratingMap", false, null);
                        }
                    }
                    catch (Exception ex)
                    {
                        Log.Error($"LanternFlight: Map generation failed: {ex}");
                        Messages.Message("Lantern_FlightFail_Gen".Translate(), MessageTypeDefOf.RejectInput, historical: false);
                    }
                }
            }
        }

        private void StartLandingSelection(Map map)
        {
             IntVec3 bestSpot = DropCellFinder.GetBestShuttleLandingSpot(map, Faction.OfPlayer);
             Find.TickManager.Pause();
             
             LongEventHandler.ExecuteWhenFinished(() =>
             {
                 if (map == null) return;
                 CameraJumper.TryJump(new GlobalTargetInfo(bestSpot, map));
                 Find.WorldSelector.ClearSelection();
                 Find.WorldTargeter.StopTargeting();
                 if (Find.Selector != null) Find.Selector.ClearSelection();
                 Find.MainTabsRoot.EscapeCurrentTab(false);
                 
                 Messages.Message("Lantern_Flight_Arrive".Translate(), MessageTypeDefOf.PositiveEvent, historical: false);
                 
                 TargetingParameters parms = new TargetingParameters { canTargetLocations = true, canTargetSelf = false, canTargetBuildings = false, canTargetPawns = false };

                 Find.Targeter.BeginTargeting(parms, targetInfo =>
                 {
                     IntVec3 cell = targetInfo.Cell;
                     if (!cell.IsValid || !cell.InBounds(map) || !cell.Standable(map))
                     {
                         Messages.Message("Lantern_FlightFail_InvalidSpot".Translate(), MessageTypeDefOf.RejectInput, historical: false);
                         return;
                     }
                     Land(cell, map);
                     Find.TickManager.CurTimeSpeed = TimeSpeed.Normal;
                 }, null, null, null, false);
             });
        }

        private void Land(IntVec3 spot, Map map)
        {
            ThingDef incomingDef = DefDatabase<ThingDef>.GetNamed("Lantern_Incoming");
            LanternIncoming incoming = (LanternIncoming)ThingMaker.MakeThing(incomingDef);
            innerContainer.TryTransferAllToContainer(incoming.innerContainer);
            GenSpawn.Spawn(incoming, spot, map);
            Find.WorldObjects.Remove(this);
            CameraJumper.TryJump(spot, map);
        }

        public override Vector3 DrawPos
        {
            get
            {
                if (originTile < 0 || destinationTile < 0 || initialTicks <= 0) return base.DrawPos;
                float t = 1f - (float)ticksToArrive / initialTicks;
                Vector3 start = Find.WorldGrid.GetTileCenter(originTile);
                Vector3 end = Find.WorldGrid.GetTileCenter(destinationTile);
                Vector3 pos = Vector3.Slerp(start, end, t);
                return pos.normalized * (100f + 0.5f);
            }
        }

        public override void Draw()
        {
             if (originTile < 0 || destinationTile < 0 || initialTicks <= 0) return;
             Vector3 currentPos = this.DrawPos;
             Vector3 start = Find.WorldGrid.GetTileCenter(originTile);
             Vector3 end = Find.WorldGrid.GetTileCenter(destinationTile);
             Vector3 direction = (end - start).normalized;
             
              if (direction != Vector3.zero && currentPos != Vector3.zero)
             {
                  Quaternion rotation = Quaternion.LookRotation(direction, currentPos.normalized);
                  Matrix4x4 matrix = Matrix4x4.TRS(currentPos, rotation, Vector3.one * 0.4f);
                  Graphics.DrawMesh(MeshPool.plane10, matrix, this.Material, WorldCameraManager.WorldLayer);
             }
        }

        public ThingOwner GetDirectlyHeldThings() => innerContainer;
        public void GetChildHolders(List<IThingHolder> outChildren) { ThingOwnerUtility.AppendThingHoldersFromThings(outChildren, innerContainer); }
    }
    
    public static class LanternFlightUtility
    {
         public static MapParent GetOrMakeLandingSite(int tile, MapParent specific = null)
         {
             if (specific != null) return specific;
             var existing = Find.WorldObjects.MapParentAt(tile);
             if (existing != null) return existing;
             
             // Generic Stub Def
             var def = DefDatabase<WorldObjectDef>.GetNamed("Lantern_LandingStub");
             var mp = (MapParent)WorldObjectMaker.MakeWorldObject(def);
             mp.Tile = tile;
             Find.WorldObjects.Add(mp);
             return mp;
         }
    }
    
    public class LanternIncoming : Skyfaller, IThingHolder
    {
        public LanternIncoming()
        {
            if (innerContainer == null) innerContainer = new ThingOwner<Thing>(this);
        }

        protected override void DrawAt(Vector3 drawLoc, bool flip = false)
        {
             DrawDropSpotShadow();
             if (innerContainer != null)
             {
                 foreach (Thing t in innerContainer)
                 {
                     if (t is Pawn p) LanternPodDrawer.DrawPilotPortrait(p, drawLoc, flip);
                 }
             }
        }
        
        protected override void Impact()
        {
             for (int i = innerContainer.Count - 1; i >= 0; i--)
             {
                 Thing t = innerContainer[i];
                 GenPlace.TryPlaceThing(t, Position, Map, ThingPlaceMode.Near);
             }
             innerContainer.ClearAndDestroyContents();
             base.Impact();
        }
        
        // Use default Skyfaller handling for IThingHolder if compatible, or new keywords if needed. 
        // Here we just let Skyfaller do its thing, assuming it serializes innerContainer. 
        // NOTE: We don't expose GetDirectlyHeldThings here to avoid override errors.
    }
}
