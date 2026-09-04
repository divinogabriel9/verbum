# Deck fonts for LibreOffice Present (PPTX → PDF → images)

Bundled OFL faces (installed into a throwaway LibreOffice profile on every convert):

- `Poppins-Regular.ttf` / `Poppins-Bold.ttf` — hymn body
- `Arimo.ttf` — Arial stand-in
- `Gelasio.ttf` — Georgia stand-in
- `Carlito-Regular.ttf` / `Carlito-Bold.ttf` — Calibri stand-in
- `*-OFL.txt` — licenses
- `99-verbum-pptx.conf` — fontconfig aliases

`services/ppt_preview_render.py` rewrites PPTX typefaces to these names before
LibreOffice converts, so **localhost and Render Present look the same**.
The downloaded PPTX is unchanged (still Georgia / Arial / Poppins Bold for PowerPoint).
