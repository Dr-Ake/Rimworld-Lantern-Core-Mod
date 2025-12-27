using System.Collections.Generic;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class GameComponent_LanternTimedIncidents : GameComponent
    {
        private List<LanternTimedIncidentState> states = new List<LanternTimedIncidentState>();
        private List<IncidentDef> timedDefs;

        public GameComponent_LanternTimedIncidents(Game game)
        {
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Collections.Look(ref states, "lanternTimedIncidentStates", LookMode.Deep);
            if (Scribe.mode == LoadSaveMode.PostLoadInit && states == null)
            {
                states = new List<LanternTimedIncidentState>();
            }
        }

        public override void FinalizeInit()
        {
            base.FinalizeInit();
            EnsureScheduled();
        }

        public override void GameComponentTick()
        {
            base.GameComponentTick();

            List<IncidentDef> defs = TimedDefs;
            if (defs.Count == 0 || Find.TickManager == null) return;

            EnsureScheduled();

            int now = Find.TickManager.TicksGame;
            for (int i = 0; i < defs.Count; i++)
            {
                IncidentDef def = defs[i];
                if (def == null) continue;
                LanternTimedIncidentExtension ext = def.GetModExtension<LanternTimedIncidentExtension>();
                if (ext == null || !ext.enabled) continue;

                LanternTimedIncidentState state = GetOrCreateState(def.defName);
                if (ext.fireOnce && state.fired) continue;
                if (state.nextTick <= 0) state.nextTick = ScheduleTick(ext, now);

                if (now < state.nextTick) continue;

                if (TryExecuteIncident(def, ext))
                {
                    state.fired = true;
                    if (!ext.fireOnce)
                    {
                        state.nextTick = ScheduleTick(ext, now);
                    }
                }
                else
                {
                    state.nextTick = now + RetryTicks(ext);
                }
            }
        }

        private List<IncidentDef> TimedDefs
        {
            get
            {
                if (timedDefs == null)
                {
                    timedDefs = new List<IncidentDef>();
                    List<IncidentDef> defs = DefDatabase<IncidentDef>.AllDefsListForReading;
                    for (int i = 0; i < defs.Count; i++)
                    {
                        IncidentDef def = defs[i];
                        if (def == null) continue;
                        if (def.GetModExtension<LanternTimedIncidentExtension>() != null)
                        {
                            timedDefs.Add(def);
                        }
                    }
                }
                return timedDefs;
            }
        }

        private void EnsureScheduled()
        {
            List<IncidentDef> defs = TimedDefs;
            if (defs.Count == 0) return;

            HashSet<string> defNames = new HashSet<string>();
            for (int i = 0; i < defs.Count; i++)
            {
                IncidentDef def = defs[i];
                if (def == null) continue;
                defNames.Add(def.defName);
            }

            for (int i = states.Count - 1; i >= 0; i--)
            {
                LanternTimedIncidentState state = states[i];
                if (state == null || state.defName.NullOrEmpty() || !defNames.Contains(state.defName))
                {
                    states.RemoveAt(i);
                }
            }

            int now = Find.TickManager?.TicksGame ?? 0;
            for (int i = 0; i < defs.Count; i++)
            {
                IncidentDef def = defs[i];
                if (def == null) continue;
                LanternTimedIncidentExtension ext = def.GetModExtension<LanternTimedIncidentExtension>();
                if (ext == null || !ext.enabled) continue;

                LanternTimedIncidentState state = GetOrCreateState(def.defName);
                if (ext.fireOnce && state.fired) continue;
                if (state.nextTick <= 0)
                {
                    state.nextTick = ScheduleTick(ext, now);
                }
            }
        }

        private LanternTimedIncidentState GetOrCreateState(string defName)
        {
            for (int i = 0; i < states.Count; i++)
            {
                LanternTimedIncidentState state = states[i];
                if (state != null && state.defName == defName) return state;
            }

            LanternTimedIncidentState created = new LanternTimedIncidentState { defName = defName };
            states.Add(created);
            return created;
        }

        private static int ScheduleTick(LanternTimedIncidentExtension ext, int now)
        {
            float minDays = Mathf.Max(0.1f, ext.minDays);
            float maxDays = Mathf.Max(minDays, ext.maxDays);
            int minTicks = (int)(minDays * GenDate.TicksPerDay);
            int maxTicks = (int)(maxDays * GenDate.TicksPerDay);
            return now + Rand.RangeInclusive(minTicks, maxTicks);
        }

        private static int RetryTicks(LanternTimedIncidentExtension ext)
        {
            float hours = Mathf.Max(0.1f, ext.retryHours);
            return (int)(hours * GenDate.TicksPerHour);
        }

        private static bool TryExecuteIncident(IncidentDef def, LanternTimedIncidentExtension ext)
        {
            if (def == null || ext == null) return false;
            if (!TryGetTarget(ext, out IIncidentTarget target)) return false;

            IncidentParms parms = StorytellerUtility.DefaultParmsNow(def.category, target);
            parms.forced = ext.force;
            return def.Worker.TryExecute(parms);
        }

        private static bool TryGetTarget(LanternTimedIncidentExtension ext, out IIncidentTarget target)
        {
            target = null;
            if (ext == null) return false;

            switch (ext.target)
            {
                case LanternTimedIncidentTarget.PlayerHomeMap:
                    target = Find.Maps.Find(m => m.IsPlayerHome);
                    break;
                case LanternTimedIncidentTarget.CurrentMap:
                    target = Find.CurrentMap ?? Find.Maps.Find(m => m.IsPlayerHome);
                    break;
                case LanternTimedIncidentTarget.AnyPlayerMap:
                    target = Find.Maps.Find(m => m.IsPlayerHome) ?? (Find.Maps.Count > 0 ? Find.Maps[0] : null);
                    break;
                case LanternTimedIncidentTarget.World:
                    target = Find.World;
                    break;
            }

            return target != null;
        }
    }

    public class LanternTimedIncidentState : IExposable
    {
        public string defName;
        public int nextTick;
        public bool fired;

        public void ExposeData()
        {
            Scribe_Values.Look(ref defName, "defName");
            Scribe_Values.Look(ref nextTick, "nextTick", 0);
            Scribe_Values.Look(ref fired, "fired", false);
        }
    }
}
