# Hero Gear Builder (offline)

This folder is a standalone, no-install HTML app for generating a hero gear add-on mod that depends on LanternsCore.

## How to use (Windows)

1) Open `LanternsCore_ModBuilder/index.html` in Edge or Chrome.
2) (Optional) Open the **Import Defs** tab and click **Import from folder...** to load defNames from your RimWorld `Data/` or `Mods/` folders (enables autocomplete).
3) Fill out the tabs.
4) Click **Export ZIP**.
5) Unzip into your RimWorld `Mods/` folder.
6) Add your own textures at the paths listed in the export checklist (no placeholders are included).

## Notes

- This runs entirely offline from a folder on disk.
- Browsers cannot write files anywhere automatically; the app downloads a ZIP to your Downloads folder.
- The **Gear template** selector lets you output belts/suits/masks (not just rings) using LanternsCore's built-in templates.
- ZIP export uses JSZip (MIT license) - see `LanternsCore_ModBuilder/vendor/JSZIP_LICENSE.txt`.
