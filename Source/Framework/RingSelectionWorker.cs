using RimWorld;
using Verse;
using System.Linq;

namespace DrAke.LanternsFramework
{
    public class RingSelectionWorker
    {
        public virtual float ScorePawn(Pawn p, RingSelectionDef def)
        {
            if (p.Dead || p.Downed || p.Destroyed) return 0f;
            if (!p.IsColonist) return 0f; // Usually for players only?
            if (p.WorkTagIsDisabled(WorkTags.Violent)) return 0f; // Lore accuracy?

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
