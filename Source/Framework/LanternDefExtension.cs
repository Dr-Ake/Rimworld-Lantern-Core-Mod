using System.Collections.Generic;
using RimWorld;
using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class LanternDefExtension : DefModExtension
    {
        // UI & Visuals
        public Color ringColor = Color.green;
        public string resourceLabel = "Willpower";

        // Mechanics
        public HediffDef associatedHediff;
        public bool allowBatteryManifest = false;
        public ThingDef batteryDef;

        // Transformation
        // If set, these items are equipped when the ring is worn.
        // Conflicting items are stored inside the ring comp and restored upon unequip.
        public List<ThingDef> transformationApparel = new List<ThingDef>();
    }
}
