using RimWorld;
using UnityEngine;
using Verse;
using Verse.Sound;

namespace DrAke.LanternsFramework.Abilities
{
    public static class LanternVfx
    {
        public static void PlayCast(Pawn caster, IntVec3 cell, Map map, FleckDef castFleckDef, float castFleckScale, SoundDef soundCastOverride)
        {
            if (map == null) return;
            if (castFleckDef != null)
            {
                float scale = castFleckScale > 0f ? castFleckScale : 1f;
                FleckMaker.Static(cell, map, castFleckDef, scale);
            }
            if (soundCastOverride != null)
            {
                soundCastOverride.PlayOneShot(new TargetInfo(cell, map));
            }
        }

        public static void PlayImpact(LocalTargetInfo target, IntVec3 cell, Map map, FleckDef impactFleckDef, float impactFleckScale,
            ThingDef moteDefOnTarget, float moteScaleOnTarget, bool attachMoteToTarget)
        {
            if (map == null) return;

            if (impactFleckDef != null)
            {
                float scale = impactFleckScale > 0f ? impactFleckScale : 1f;
                FleckMaker.Static(cell, map, impactFleckDef, scale);
            }

            if (moteDefOnTarget != null)
            {
                float scale = moteScaleOnTarget > 0f ? moteScaleOnTarget : 1f;
                if (attachMoteToTarget && target.HasThing)
                {
                    MoteMaker.MakeAttachedOverlay(target.Thing, moteDefOnTarget, Vector3.zero, scale);
                }
                else
                {
                    MoteMaker.MakeStaticMote(cell, map, moteDefOnTarget, scale);
                }
            }
        }
    }
}
