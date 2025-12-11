using System.Collections.Generic;
using System.Linq;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class CompProperties_LanternRing : CompProperties
    {
        public CompProperties_LanternRing()
        {
            this.compClass = typeof(CompLanternRing);
        }
    }

    public class CompLanternRing : ThingComp
    {
        public float charge = 1.0f; // 0.0 to 1.0

        // Transformation Storage
        // We store the original items that were replaced by the transformation.
        // We must save this data deeply so it survives save/load.
        private List<Thing> storedApparel = new List<Thing>();

        public LanternDefExtension Extension => parent.def.GetModExtension<LanternDefExtension>();

        private Pawn Wearer => (parent as Apparel)?.Wearer;

        public bool IsActive
        {
            get
            {
                if (Wearer == null) return false;
                // Basic check: If dead/downed, usually inactive logic flows elsewhere.
                // Framework: In future, allow XML conditions for "Inert" state?
                // For now, mirroring legacy Green Lantern logic: Mental Breaks disable it unless Aggro.
                if (Wearer.InMentalState && !Wearer.MentalStateDef.IsAggro)
                {
                    return false;
                }
                return true;
            }
        }

        public override void CompTick()
        {
            base.CompTick();
            if (Wearer == null) return;

            if (Wearer.Dead)
            {
                Notify_PawnDied(Wearer);
                return;
            }

            // Passive Charge / Logic could go here.
            // Ensure Hediff
            if (IsActive && Wearer.IsColonist)
            {
                EnsureHediff(true);
            }
            else
            {
                EnsureHediff(false);
            }
        }

        private void EnsureHediff(bool present)
        {
            if (Extension == null || Extension.associatedHediff == null) return;

            var hediff = Wearer.health.hediffSet.GetFirstHediffOfDef(Extension.associatedHediff);
            if (present && hediff == null)
            {
                Wearer.health.AddHediff(Extension.associatedHediff);
            }
            else if (!present && hediff != null)
            {
                Wearer.health.RemoveHediff(hediff);
            }
        }

        // ================== Transformation Logic ==================

        public override void Notify_Equipped(Pawn pawn)
        {
            base.Notify_Equipped(pawn);
            if (Extension != null && !Extension.transformationApparel.NullOrEmpty())
            {
                DoTransformation(pawn);
            }
        }

        public override void Notify_Unequipped(Pawn pawn)
        {
            base.Notify_Unequipped(pawn);
            // Revert transformation
            RevertTransformation(pawn);
            
            // Remove Hediff immediately
            if (Extension != null && Extension.associatedHediff != null)
            {
                var hediff = pawn.health.hediffSet.GetFirstHediffOfDef(Extension.associatedHediff);
                if (hediff != null) pawn.health.RemoveHediff(hediff);
            }
        }

        public void Notify_PawnDied(Pawn pawn)
        {
            // If ring drops, Notify_Unequipped is called? 
            // Usually yes, if the apparel is stripped/dropped. 
            // If the pawn stays as a corpse with the ring, we might need manual cleanup if they are resurrected?
            // For now, assume standard flow.
        }

        private void DoTransformation(Pawn pawn)
        {
            if (pawn.apparel == null) return;

            // 1. Identify items to add
            foreach (ThingDef uniformDef in Extension.transformationApparel)
            {
                // Check if we need to remove anything in that slot
                // Find conflicting apparel
                // We assume the uniform takes up specific layers/parts.
                
                // Simple approach: Check validation for wearing `uniformDef`.
                // If invalid, find what blocks it.
                
                // Ideally, we just look at what the uniform covers and remove anything else there.
                 List<Apparel> conflicts = new List<Apparel>();
                 
                 foreach (Apparel worn in pawn.apparel.WornApparel)
                 {
                     if (worn == parent) continue; // Don't remove the ring itself!
                     if (!ApparelUtility.CanWearTogether(uniformDef, worn.def, pawn.RaceProps.body))
                     {
                         conflicts.Add(worn);
                     }
                 }

                 // 2. Store conflicts
                 foreach (Apparel conflict in conflicts)
                 {
                     if (storedApparel.Contains(conflict)) continue;

                     pawn.apparel.Remove(conflict);
                     storedApparel.Add(conflict);
                 }

                 // 3. Equip new item
                 ThingDef stuff = null;
                 if (uniformDef.MadeFromStuff)
                 {
                     stuff = GenStuff.DefaultStuffFor(uniformDef);
                 }
                 Apparel newGear = (Apparel)ThingMaker.MakeThing(uniformDef, stuff);
                 pawn.apparel.Wear(newGear);
            }
        }

        private void RevertTransformation(Pawn pawn)
        {
            // 1. Remove Transformation Items
            if (pawn.apparel != null && Extension != null)
            {
                for (int i = pawn.apparel.WornApparel.Count - 1; i >= 0; i--)
                {
                    Apparel worn = pawn.apparel.WornApparel[i];
                    if (Extension.transformationApparel.Contains(worn.def))
                    {
                        // Destroy the summon/construct
                        pawn.apparel.Remove(worn);
                        worn.Destroy();
                    }
                }
            }

            // 2. Restore Stored Items
            foreach (var thing in storedApparel)
            {
                if (thing == null || thing.Destroyed) continue;
                if (thing is Apparel app)
                {
                    pawn.apparel.Wear(app);
                }
            }
            storedApparel.Clear();
        }

        // ================== Gizmos ==================

        public override IEnumerable<Gizmo> CompGetWornGizmosExtra()
        {
            foreach (var g in base.CompGetWornGizmosExtra()) yield return g;

            // Log.Message($"[LanternsDebug] Checking Gizmos for {parent}: Wearer={Wearer}, Component={Wearer?.IsColonistPlayerControlled}, Ext={Extension}");

            if (Wearer != null && Wearer.IsColonistPlayerControlled)
            {
                if (Extension == null)
                {
                    Log.ErrorOnce($"[LanternsCore] Ring {parent} has no LanternDefExtension!", parent.thingIDNumber);
                    yield break;
                }

                yield return new Gizmo_LanternCharge
                {
                    ringComp = this,
                    label = Extension.resourceLabel,
                    barColor = Extension.ringColor
                };

                if (Extension.allowBatteryManifest)
                {
                    yield return new Command_Action
                    {
                        defaultLabel = "GL_Command_ManifestBattery".Translate(), 
                        defaultDesc = "GL_Command_ManifestBatteryDesc".Translate(),
                        icon = ContentFinder<Texture2D>.Get("LanternsLight/UI/Ability_Battery", true), 
                        action = () => TryManifestBattery()
                    };
                }
            }
        }

        public void TryManifestBattery()
        {
            // Logic similar to original but using Extension.batteryDef
             if (Extension.batteryDef == null) return;
             
             // Cost logic? Hardcoded 0.5f for now or add to extension?
             float cost = 0.5f;
             if (charge >= cost)
             {
                 charge -= cost;
                 Thing battery = ThingMaker.MakeThing(Extension.batteryDef);
                 MinifiedThing minified = (MinifiedThing)battery.TryMakeMinified();
                 GenSpawn.Spawn(minified, Wearer.Position, Wearer.Map);
             }
             else
             {
                 // Feedback: Not enough charge
             }
        }
        
        public bool TryConsumeCharge(float amount)
        {
            if (!IsActive) return false;
            // Cheats: if (!LanternMod.settings.consumeEnergy) return true;
            if (charge >= amount)
            {
                charge -= amount;
                return true;
            }
            return false;
        }

        public void Drain(float amount)
        {
             charge = Mathf.Max(0f, charge - amount);
        }

        // ================== Saving ==================

        public override void PostExposeData()
        {
            base.PostExposeData();
            Scribe_Values.Look(ref charge, "charge", 1.0f);
            Scribe_Collections.Look(ref storedApparel, "storedApparel", LookMode.Deep);
        }
    }
    
    // ================== UI Class ==================
    [StaticConstructorOnStartup]
    public class Gizmo_LanternCharge : Gizmo
    {
        public CompLanternRing ringComp;
        public string label;
        public Color barColor;

        private static readonly Texture2D EmptyBarTex = SolidColorMaterials.NewSolidColorTexture(Color.gray);
        private Texture2D cachedFillTex;
        private Color lastColor;

        public override float GetWidth(float maxWidth) => 140f;

        public override GizmoResult GizmoOnGUI(Vector2 topLeft, float maxWidth, GizmoRenderParms parms)
        {
            Rect rect = new Rect(topLeft.x, topLeft.y, GetWidth(maxWidth), 75f);
            Widgets.DrawWindowBackground(rect);
            
            Rect barRect = rect.ContractedBy(10f);
            barRect.height = 30f;
            barRect.y += 10f;

            if (barColor != lastColor || cachedFillTex == null)
            {
                lastColor = barColor;
                cachedFillTex = SolidColorMaterials.NewSolidColorTexture(barColor);
            }
            Widgets.FillableBar(barRect, ringComp.charge, cachedFillTex, EmptyBarTex, true);
            
            Text.Font = GameFont.Small;
            Text.Anchor = TextAnchor.MiddleCenter;
            GUI.color = Color.white; // Text always white? Or Black on light colors?
            Widgets.Label(barRect, $"{ringComp.charge:P0}");
            
            Rect labelRect = new Rect(rect.x, rect.y + 5, rect.width, 20f);
            Text.Font = GameFont.Tiny;
            Text.Anchor = TextAnchor.UpperCenter;
            GUI.color = barColor;
            Widgets.Label(labelRect, label);
            GUI.color = Color.white;
            Text.Anchor = TextAnchor.UpperLeft;

            return new GizmoResult(GizmoState.Clear);
        }
    }
}
