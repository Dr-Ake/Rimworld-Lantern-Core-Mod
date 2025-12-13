# Hero Gear Builder (offline)

This folder is a standalone, no-install HTML app for generating a hero gear add-on mod that depends on LanternsCore.

For the full, detailed instructions, read:
- `LanternsCore_ModBuilder/Guide.md`

## How to use (Windows)

1) Open `LanternsCore_ModBuilder/index.html` in Edge or Chrome.
2) (Optional) Click **Import ZIP** to load a previously generated mod ZIP so you can make quick edits and re-export.
3) (Optional) Open the **Import Defs** tab and click **Import from folder...** to load defNames from your RimWorld `Data/` or `Mods/` folders (enables autocomplete).
4) Fill out the tabs.
5) Click **Export ZIP**.
6) Unzip into your RimWorld `Mods/` folder.
7) Add your own textures at the paths listed in the export checklist (no placeholders are included).

## Notes

- This runs entirely offline from a folder on disk.
- Browsers cannot write files anywhere automatically; the app downloads a ZIP to your Downloads folder.
- The **Gear template** selector lets you output belts/suits/masks (not just rings) using LanternsCore's built-in templates.
- If you use **Import Defs**, the Builder can auto-add mod dependencies to the generated `About/About.xml` when you reference defs from other mods.
- ZIP export uses JSZip (MIT license) - see `LanternsCore_ModBuilder/vendor/JSZIP_LICENSE.txt`.
