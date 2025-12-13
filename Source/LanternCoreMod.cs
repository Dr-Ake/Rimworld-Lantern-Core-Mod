using UnityEngine;
using Verse;

namespace DrAke.LanternsFramework
{
    public class LanternCoreMod : Mod
    {
        public static LanternCoreSettings Settings;

        public LanternCoreMod(ModContentPack content) : base(content)
        {
            Settings = GetSettings<LanternCoreSettings>();
        }

        public override string SettingsCategory() => "Lantern Core Framework";

        public override void DoSettingsWindowContents(Rect inRect)
        {
            var listing = new Listing_Standard();
            listing.Begin(inRect);
            listing.CheckboxLabeled("Lantern_Settings_EnableDebugLogging_Label".Translate(), ref Settings.debugLogging,
                "Lantern_Settings_EnableDebugLogging_Desc".Translate());
            listing.CheckboxLabeled("Lantern_Settings_EnableDebugGizmos_Label".Translate(), ref Settings.debugGizmos,
                "Lantern_Settings_EnableDebugGizmos_Desc".Translate());
            listing.CheckboxLabeled("Lantern_Settings_ShowRingInspector_Label".Translate(), ref Settings.showRingInspectorGizmo,
                "Lantern_Settings_ShowRingInspector_Desc".Translate());

            listing.GapLine();
            listing.Label("Lantern_Settings_Balance_Header".Translate());
            listing.Label("Lantern_Settings_CostMultiplier".Translate(Settings.costMultiplier.ToString("0.00")));
            Settings.costMultiplier = listing.Slider(Settings.costMultiplier, 0f, 5f);
            listing.Label("Lantern_Settings_RegenMultiplier".Translate(Settings.regenMultiplier.ToString("0.00")));
            Settings.regenMultiplier = listing.Slider(Settings.regenMultiplier, 0f, 5f);
            listing.Label("Lantern_Settings_DrainMultiplier".Translate(Settings.drainMultiplier.ToString("0.00")));
            Settings.drainMultiplier = listing.Slider(Settings.drainMultiplier, 0f, 5f);

            listing.GapLine();
            listing.Label("Lantern_Settings_Safety_Header".Translate());
            listing.CheckboxLabeled("Lantern_Settings_DisableCombatAbsorb_Label".Translate(), ref Settings.disableCombatAbsorbGlobally,
                "Lantern_Settings_DisableCombatAbsorb_Desc".Translate());
            listing.CheckboxLabeled("Lantern_Settings_DisableEnvProtection_Label".Translate(), ref Settings.disableEnvironmentalProtectionGlobally,
                "Lantern_Settings_DisableEnvProtection_Desc".Translate());
            listing.End();
            Settings.Write();
        }
    }
}
