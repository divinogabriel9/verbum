# Deck fonts for LibreOffice Present (PPTX → PDF → images)

- `Poppins-Regular.ttf` / `Poppins-Bold.ttf` — OFL (Indian Type Foundry / Google Fonts)
- `Poppins-OFL.txt` — license
- `99-verbum-pptx.conf` — fontconfig aliases (`Poppins Bold`, Georgia→Liberation Serif, etc.)

These are installed into the Docker image (`Dockerfile`) so Render’s LibreOffice
slideshow matches the generated PPTX as closely as free fonts allow.
