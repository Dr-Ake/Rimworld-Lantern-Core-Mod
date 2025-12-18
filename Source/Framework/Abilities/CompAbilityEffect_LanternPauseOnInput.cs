using RimWorld;
using Verse;

namespace DrAke.LanternsFramework.Abilities
{
    // Marker ability comp: used by a Harmony patch to pause the game when the ability gizmo is clicked.
    // The effect itself is intentionally empty.
    public class CompAbilityEffect_LanternPauseOnInput : CompAbilityEffect
    {
        public new CompProperties_LanternPauseOnInput Props => (CompProperties_LanternPauseOnInput)props;

        public override void Apply(LocalTargetInfo target, LocalTargetInfo dest)
        {
            base.Apply(target, dest);

            if (!Props.unpauseAfterCast) return;
            if (!LanternPauseOnInputRegistry.Consume(parent)) return;

            if (Find.TickManager?.Paused == true)
            {
                Find.TickManager.TogglePaused();
            }
        }
    }

    public class CompProperties_LanternPauseOnInput : CompProperties_AbilityEffect
    {
        public bool pause = true;
        // If true, the game will unpause when the ability successfully casts.
        public bool unpauseAfterCast = true;

        public CompProperties_LanternPauseOnInput()
        {
            compClass = typeof(CompAbilityEffect_LanternPauseOnInput);
        }
    }

    internal static class LanternPauseOnInputRegistry
    {
        private sealed class RefEqualityComparer<T> : System.Collections.Generic.IEqualityComparer<T> where T : class
        {
            public static readonly RefEqualityComparer<T> Instance = new RefEqualityComparer<T>();
            public bool Equals(T x, T y) => ReferenceEquals(x, y);
            public int GetHashCode(T obj) => System.Runtime.CompilerServices.RuntimeHelpers.GetHashCode(obj);
        }

        private static readonly System.Collections.Generic.HashSet<Ability> PausedByThisComp =
            new System.Collections.Generic.HashSet<Ability>(RefEqualityComparer<Ability>.Instance);

        public static void RecordPaused(Ability ability)
        {
            if (ability != null) PausedByThisComp.Add(ability);
        }

        public static bool Consume(Ability ability)
        {
            if (ability == null) return false;
            return PausedByThisComp.Remove(ability);
        }
    }
}
