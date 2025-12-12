using RimWorld;
using Verse;
using System.Linq;

namespace DrAke.LanternsFramework
{
    public class RingSelectionWorker
    {
        public virtual float ScorePawn(Pawn p, RingSelectionDef def)
        {
            if (p == null || def == null) return 0f;
            if (p.Destroyed) return 0f;

            if (p.Dead && !def.allowDead) return 0f;
            if (p.Downed && !def.allowDowned) return 0f;

            // Category filters
            bool allowed =
                (p.IsColonist && def.allowColonists) ||
                (p.IsPrisonerOfColony && def.allowPrisoners) ||
                (p.IsSlaveOfColony && def.allowSlaves) ||
                ((p.GuestStatus != null) && def.allowGuests) ||
                (p.RaceProps?.Animal == true && def.allowAnimals) ||
                (p.RaceProps?.IsMechanoid == true && def.allowMechs) ||
                (p.HostileTo(Faction.OfPlayer) && def.allowHostiles);

            if (!allowed) return 0f;

            if (def.requireViolenceCapable && p.WorkTagIsDisabled(WorkTags.Violent)) return 0f;

            if (def.excludeIfHasAnyLanternRing && p.apparel != null)
            {
                if (p.apparel.WornApparel.Any(a => a.GetComp<CompLanternRing>() != null))
                {
                    return 0f;
                }
            }

            if (!def.excludedApparelTags.NullOrEmpty() && p.apparel != null)
            {
                foreach (var app in p.apparel.WornApparel)
                {
                    var tags = app.def?.apparel?.tags;
                    if (tags != null && tags.Any(t => def.excludedApparelTags.Contains(t)))
                    {
                        return 0f;
                    }
                }
            }

            float score = 0f;

            // Process Conditions defined in XML
            if (def.conditions != null)
            {
                foreach (var cond in def.conditions)
                {
                    score += cond.CalculateScore(p, def);
                }
            }

            return score;
        }
    }
}
