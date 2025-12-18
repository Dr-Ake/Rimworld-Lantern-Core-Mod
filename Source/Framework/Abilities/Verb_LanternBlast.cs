using System;
using System.Linq;
using System.Reflection;
using RimWorld;
using UnityEngine;
using Verse;
using DrAke.LanternsFramework;

namespace DrAke.LanternsFramework.Abilities
{
    public class Verb_LanternBlast : Verb_CastAbility
    {
        protected override bool TryCastShot()
        {
            VerbProperties_LanternBlast customProps = verbProps as VerbProperties_LanternBlast;

            // Optional sound override/mute for non-laser blasts (e.g. thrown batarangs).
            SoundDef originalSoundCast = null;
            bool restoreSound = false;
            if (customProps != null && (customProps.muteSoundCast || customProps.soundCastOverride != null))
            {
                originalSoundCast = verbProps.soundCast;
                restoreSound = true;
                verbProps.soundCast = customProps.muteSoundCast ? null : customProps.soundCastOverride;
            }

            // Let base handle cooldown/cost/effects; only add damage.
            bool baseResult;
            try
            {
                baseResult = base.TryCastShot();
            }
            finally
            {
                if (restoreSound) verbProps.soundCast = originalSoundCast;
            }

            if (!baseResult) return false;

            int dmg = 10; // Default
            DamageDef dmgType = DamageDefOf.Burn;
            CompLanternRing ringComp = null;

            // First, pull defaults from the ring.
            if (caster is Pawn p)
            {
                ringComp = LanternResources.GetRing(p);
                if (ringComp != null)
                {
                    dmg = ringComp.GetBlastDamage();
                    dmgType = ringComp.GetBlastDamageType();
                }
            }

            // Then allow ability XML to override via custom verbProperties.
            if (customProps != null)
            {
                if (customProps.damageOverride > 0)
                {
                    dmg = customProps.damageOverride;
                }
                if (customProps.damageTypeOverride != null)
                {
                    dmgType = customProps.damageTypeOverride;
                }
                if (customProps.damageMultiplier > 0f && !Mathf.Approximately(customProps.damageMultiplier, 1f))
                {
                    dmg = Mathf.Max(0, Mathf.RoundToInt(dmg * customProps.damageMultiplier));
                }
            }

            // Optional beam VFX.
            if (customProps?.projectileDef != null)
            {
                TryLaunchProjectile(ringComp, customProps, dmg, dmgType);
                return true;
            }

            TrySpawnBeamVfx(ringComp, customProps);

            if (currentTarget.HasThing)
            {
                DamageInfo dinfo = MakeDamageInfo(dmgType, dmg, 1.0f, -1f, caster, currentTarget.Thing);
                currentTarget.Thing.TakeDamage(dinfo);
            }

            return true;
        }

        private void TryLaunchProjectile(CompLanternRing ringComp, VerbProperties_LanternBlast customProps, int dmg, DamageDef dmgType)
        {
            if (caster is not Pawn pawn) return;
            Map map = pawn.Map;
            if (map == null) return;

            ThingDef projDef = customProps.projectileDef;
            Thing thing = ThingMaker.MakeThing(projDef);
            if (thing is not Projectile projectile) return;

            GenSpawn.Spawn(projectile, pawn.Position, map);

            // If it's our custom projectile, pass ring-based damage and optional beam-to-projectile settings.
            if (projectile is Projectile_LanternBlast lanternProj)
            {
                lanternProj.damageAmountOverride = dmg;
                lanternProj.damageDefOverride = dmgType;

                lanternProj.beamMoteDef = customProps.projectileBeamMoteDef;
                lanternProj.beamOffsetA = customProps.projectileBeamOffsetA;
                lanternProj.beamOffsetB = customProps.projectileBeamOffsetB;
                lanternProj.beamScale = customProps.projectileBeamScale;

                if (customProps.projectileBeamUseColorOverride)
                {
                    lanternProj.beamColorOverride = customProps.projectileBeamColorOverride;
                    lanternProj.tintBeamToRingColor = false;
                }
                else
                {
                    lanternProj.tintBeamToRingColor = customProps.projectileBeamTintToRingColor;
                    lanternProj.ringColor = ringComp?.Extension?.ringColor ?? Color.white;
                }
            }
            else
            {
                // For vanilla projectiles, we can only override the damage type.
                if (dmgType != null)
                {
                    projectile.damageDefOverride = dmgType;
                }
            }

            projectile.Launch(pawn, pawn.DrawPos, currentTarget, currentTarget, ProjectileHitFlags.All, preventFriendlyFire: false, equipment: null);
        }

        private void TrySpawnBeamVfx(CompLanternRing ringComp, VerbProperties_LanternBlast customProps)
        {
            if (caster is not Pawn pawn) return;
            Map map = pawn.Map;
            if (map == null) return;

            Vector3 from = pawn.DrawPos;
            Vector3 to = currentTarget.HasThing
                ? currentTarget.Thing.DrawPos
                : currentTarget.Cell.ToVector3Shifted();

            FleckDef beamDef = customProps?.beamFleckDef ?? ringComp?.Extension?.blastBeamFleckDef;
            if (beamDef == null) return;

            Vector3 dir = to - from;
            dir.y = 0f;
            float dist = Mathf.Sqrt(dir.x * dir.x + dir.z * dir.z);
            if (dist < 0.01f) return;

            float rotation = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg;

            float scale = customProps?.beamFleckScale ?? ringComp?.Extension?.blastBeamFleckScale ?? 1f;
            if (scale <= 0f) scale = 1f;

            int count = customProps?.beamFleckCount ?? ringComp?.Extension?.blastBeamFleckCount ?? 0;
            if (count <= 0)
            {
                count = Mathf.Clamp(Mathf.CeilToInt(dist / 2f), 1, 12);
            }

            Color color = Color.white;
            bool setColor = false;
            bool tintToRing = customProps?.tintBeamToRingColor ?? ringComp?.Extension?.blastTintBeamToRingColor ?? true;

            if (customProps != null && customProps.useBeamColorOverride)
            {
                color = customProps.beamColorOverride;
                setColor = true;
            }
            else if (ringComp?.Extension != null && ringComp.Extension.blastUseBeamColorOverride)
            {
                color = ringComp.Extension.blastBeamColorOverride;
                setColor = true;
            }
            else if (tintToRing && ringComp?.Extension != null)
            {
                color = ringComp.Extension.ringColor;
                setColor = true;
            }

            for (int i = 0; i < count; i++)
            {
                float t = (i + 0.5f) / count;
                Vector3 pos = Vector3.Lerp(from, to, t);
                FleckCreationData data = FleckMaker.GetDataStatic(pos, map, beamDef, scale);
                data.rotation = rotation;
                if (setColor) data.instanceColor = color;
                map.flecks.CreateFleck(data);
            }

            if (customProps?.impactFleckDef != null)
            {
                float impactScale = customProps.impactFleckScale > 0f ? customProps.impactFleckScale : 1f;
                FleckCreationData impact = FleckMaker.GetDataStatic(to, map, customProps.impactFleckDef, impactScale);
                if (customProps.useImpactColorOverride)
                {
                    impact.instanceColor = customProps.impactColorOverride;
                }
                else if (tintToRing && ringComp?.Extension != null)
                {
                    impact.instanceColor = ringComp.Extension.ringColor;
                }
                map.flecks.CreateFleck(impact);
            }
        }

        // Cross-version safe DamageInfo creation. Never call constructors directly.
        private static ConstructorInfo cachedDamageInfoCtor;
        private static ParameterInfo[] cachedDamageInfoParams;

        private static FieldInfo fieldDefInt;
        private static FieldInfo fieldAmountInt;
        private static FieldInfo fieldArmorPenetrationInt;
        private static FieldInfo fieldAngleInt;
        private static FieldInfo fieldInstigatorInt;
        private static FieldInfo fieldIntendedTargetInt;
        private static FieldInfo fieldCategoryInt;

        private static DamageInfo MakeDamageInfo(DamageDef def, float amount, float armorPenetration, float angle, Thing instigator, Thing intendedTarget)
        {
            EnsureDamageInfoCtor();
            if (cachedDamageInfoCtor != null && cachedDamageInfoParams != null)
            {
                try
                {
                    object[] args = new object[cachedDamageInfoParams.Length];
                    for (int i = 0; i < cachedDamageInfoParams.Length; i++)
                    {
                        ParameterInfo p = cachedDamageInfoParams[i];
                        string name = p.Name ?? string.Empty;

                        if (i == 0) args[i] = def;
                        else if (i == 1) args[i] = amount;
                        else if (name.Equals("armorPenetration", StringComparison.OrdinalIgnoreCase) ||
                                 name.Equals("armorPen", StringComparison.OrdinalIgnoreCase) ||
                                 name.IndexOf("armor", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            args[i] = armorPenetration;
                        }
                        else if (name.Equals("angle", StringComparison.OrdinalIgnoreCase))
                        {
                            args[i] = angle;
                        }
                        else if (name.Equals("instigator", StringComparison.OrdinalIgnoreCase))
                        {
                            args[i] = instigator;
                        }
                        else if (name.Equals("intendedTarget", StringComparison.OrdinalIgnoreCase))
                        {
                            args[i] = intendedTarget;
                        }
                        else if (p.HasDefaultValue)
                        {
                            args[i] = p.DefaultValue;
                        }
                        else
                        {
                            args[i] = GetDefault(p.ParameterType);
                        }
                    }

                    return (DamageInfo)cachedDamageInfoCtor.Invoke(args);
                }
                catch (Exception e)
                {
                    Log.ErrorOnce($"[LanternsCore] DamageInfo ctor invoke failed, falling back to field set: {e}", 93451291);
                }
            }

            return MakeDamageInfoByFields(def, amount, armorPenetration, angle, instigator, intendedTarget);
        }

        private static DamageInfo MakeDamageInfoByFields(DamageDef def, float amount, float armorPenetration, float angle, Thing instigator, Thing intendedTarget)
        {
            object boxed = Activator.CreateInstance(typeof(DamageInfo));
            EnsureDamageInfoFields();

            fieldDefInt?.SetValue(boxed, def);
            fieldAmountInt?.SetValue(boxed, amount);
            fieldArmorPenetrationInt?.SetValue(boxed, armorPenetration);
            fieldAngleInt?.SetValue(boxed, angle);
            fieldInstigatorInt?.SetValue(boxed, instigator);
            fieldIntendedTargetInt?.SetValue(boxed, intendedTarget);
            fieldCategoryInt?.SetValue(boxed, DamageInfo.SourceCategory.ThingOrUnknown);

            return (DamageInfo)boxed;
        }

        private static void EnsureDamageInfoCtor()
        {
            if (cachedDamageInfoCtor != null) return;

            var ctors = typeof(DamageInfo).GetConstructors(BindingFlags.Public | BindingFlags.Instance)
                .Select(c => new { Ctor = c, Params = c.GetParameters() })
                .Where(x => x.Params.Length >= 2 &&
                            x.Params[0].ParameterType == typeof(DamageDef) &&
                            x.Params[1].ParameterType == typeof(float))
                .OrderByDescending(x => x.Params.Length)
                .ToList();

            var best = ctors.FirstOrDefault();
            cachedDamageInfoCtor = best?.Ctor;
            cachedDamageInfoParams = best?.Params;
        }

        private static void EnsureDamageInfoFields()
        {
            if (fieldDefInt != null) return;

            BindingFlags flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;
            Type t = typeof(DamageInfo);
            fieldDefInt = t.GetField("defInt", flags);
            fieldAmountInt = t.GetField("amountInt", flags);
            fieldArmorPenetrationInt = t.GetField("armorPenetrationInt", flags);
            fieldAngleInt = t.GetField("angleInt", flags);
            fieldInstigatorInt = t.GetField("instigatorInt", flags);
            fieldIntendedTargetInt = t.GetField("intendedTargetInt", flags);
            fieldCategoryInt = t.GetField("categoryInt", flags);
        }

        private static object GetDefault(Type t)
        {
            return t.IsValueType ? Activator.CreateInstance(t) : null;
        }
    }
}
