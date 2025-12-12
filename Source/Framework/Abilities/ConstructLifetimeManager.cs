using System.Collections.Generic;
using System.Linq;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    // Tracks temporary constructs/summons and timed buffs that should vanish after a duration.
    public class ConstructLifetimeManager : GameComponent
    {
        private List<TemporaryThingEntry> temporaryThings = new List<TemporaryThingEntry>();
        private List<TemporaryBuffEntry> temporaryBuffs = new List<TemporaryBuffEntry>();

        public ConstructLifetimeManager(Game game)
        {
        }

        public override void GameComponentTick()
        {
            int now = Find.TickManager.TicksGame;
            if (now % 60 != 0) return;

            if (!temporaryThings.NullOrEmpty())
            {
                for (int i = temporaryThings.Count - 1; i >= 0; i--)
                {
                    TemporaryThingEntry entry = temporaryThings[i];
                    if (entry?.thing == null || entry.thing.Destroyed)
                    {
                        temporaryThings.RemoveAt(i);
                        continue;
                    }

                    if (now >= entry.expireTick)
                    {
                        entry.thing.Destroy(DestroyMode.Vanish);
                        temporaryThings.RemoveAt(i);
                    }
                }
            }

            if (!temporaryBuffs.NullOrEmpty())
            {
                for (int i = temporaryBuffs.Count - 1; i >= 0; i--)
                {
                    TemporaryBuffEntry entry = temporaryBuffs[i];
                    if (entry?.pawn == null || entry.pawn.Destroyed)
                    {
                        temporaryBuffs.RemoveAt(i);
                        continue;
                    }

                    if (now >= entry.expireTick)
                    {
                        Hediff h = entry.pawn.health?.hediffSet?.GetFirstHediffOfDef(entry.hediffDef);
                        if (h != null)
                        {
                            entry.pawn.health.RemoveHediff(h);
                        }
                        temporaryBuffs.RemoveAt(i);
                    }
                }
            }
        }

        public void RegisterTemporaryThing(Thing thing, int durationTicks)
        {
            if (thing == null || durationTicks <= 0) return;
            int expire = Find.TickManager.TicksGame + durationTicks;

            TemporaryThingEntry existing = temporaryThings.FirstOrDefault(e => e?.thing == thing);
            if (existing != null)
            {
                existing.expireTick = expire > existing.expireTick ? expire : existing.expireTick;
                return;
            }

            temporaryThings.Add(new TemporaryThingEntry { thing = thing, expireTick = expire });
        }

        public void RegisterTemporaryBuff(Pawn pawn, HediffDef def, int durationTicks)
        {
            if (pawn == null || def == null || durationTicks <= 0) return;
            int expire = Find.TickManager.TicksGame + durationTicks;

            TemporaryBuffEntry existing = temporaryBuffs.FirstOrDefault(e => e?.pawn == pawn && e.hediffDef == def);
            if (existing != null)
            {
                existing.expireTick = expire > existing.expireTick ? expire : existing.expireTick;
                return;
            }

            temporaryBuffs.Add(new TemporaryBuffEntry { pawn = pawn, hediffDef = def, expireTick = expire });
        }

        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Collections.Look(ref temporaryThings, "temporaryThings", LookMode.Deep);
            Scribe_Collections.Look(ref temporaryBuffs, "temporaryBuffs", LookMode.Deep);
        }
    }

    public class TemporaryThingEntry : IExposable
    {
        public Thing thing;
        public int expireTick;

        public void ExposeData()
        {
            Scribe_References.Look(ref thing, "thing");
            Scribe_Values.Look(ref expireTick, "expireTick");
        }
    }

    public class TemporaryBuffEntry : IExposable
    {
        public Pawn pawn;
        public HediffDef hediffDef;
        public int expireTick;

        public void ExposeData()
        {
            Scribe_References.Look(ref pawn, "pawn");
            Scribe_Defs.Look(ref hediffDef, "hediffDef");
            Scribe_Values.Look(ref expireTick, "expireTick");
        }
    }

    public static class LanternConstructs
    {
        public static ConstructLifetimeManager Manager => Current.Game?.GetComponent<ConstructLifetimeManager>();

        public static void RegisterTemporary(Thing thing, int durationTicks)
        {
            Manager?.RegisterTemporaryThing(thing, durationTicks);
        }

        public static void RegisterBuff(Pawn pawn, HediffDef def, int durationTicks)
        {
            Manager?.RegisterTemporaryBuff(pawn, def, durationTicks);
        }
    }
}

