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
            listing.CheckboxLabeled("Enable debug logging", ref Settings.debugLogging,
                "Logs ring selection scoring and other framework internals.");
            listing.CheckboxLabeled("Enable debug gizmos", ref Settings.debugGizmos,
                "Adds debug-only gizmos on rings (refill charge, etc.).");
            listing.End();
            Settings.Write();
        }
    }
}

