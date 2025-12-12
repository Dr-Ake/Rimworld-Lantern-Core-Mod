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
            // Let base handle cooldown/cost/effects; only add damage.
            if (!base.TryCastShot()) return false;

            // Instantly hit (beam logic).
            if (currentTarget.HasThing)
            {
                int dmg = 10; // Default
                DamageDef dmgType = DamageDefOf.Burn;

                // First, try to pull defaults from the ring.
                if (caster is Pawn p)
                {
                    var ring = LanternResources.GetRing(p);
                    if (ring != null)
                    {
                        dmg = ring.GetBlastDamage();
                        dmgType = ring.GetBlastDamageType();
                    }
                }

                // Then allow ability XML to override via custom verbProperties.
                if (verbProps is VerbProperties_LanternBlast custom)
                {
                    if (custom.damageOverride > 0)
                    {
                        dmg = custom.damageOverride;
                    }
                    if (custom.damageTypeOverride != null)
                    {
                        dmgType = custom.damageTypeOverride;
                    }
                    if (custom.damageMultiplier > 0f && !Mathf.Approximately(custom.damageMultiplier, 1f))
                    {
                        dmg = Mathf.Max(0, Mathf.RoundToInt(dmg * custom.damageMultiplier));
                    }
                }

                DamageInfo dinfo = MakeDamageInfo(dmgType, dmg, 1.0f, -1f, caster, currentTarget.Thing);
                currentTarget.Thing.TakeDamage(dinfo);
            }

            return true;
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
