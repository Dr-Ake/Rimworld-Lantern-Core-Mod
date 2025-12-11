using System.Collections.Generic;
using RimWorld;
using Verse;

namespace DrAke.LanternsFramework
{
    public class LanternTraitScoreExtension : DefModExtension
    {
        public float scoreOffset;
        public float scorePerDegree;
        public List<DegreeScoreOffset> degreeOffsets;

        public float ScoreFor(Trait trait)
        {
            float score = scoreOffset;
            score += scorePerDegree * trait.Degree;

            if (degreeOffsets != null)
            {
                foreach (var deg in degreeOffsets)
                {
                    if (deg.degree == trait.Degree)
                    {
                        score += deg.offset;
                    }
                }
            }
            return score;
        }
    }

    public class DegreeScoreOffset
    {
        public int degree;
        public float offset;
    }
}
