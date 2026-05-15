import sys
from typing import Optional

from pipeline import generate_mass_media

_PICK_SENTENCE_FLAGS = frozenset(("-p", "--pick-sentence"))


def _argv_positional() -> list[str]:
    skip = False
    out: list[str] = []
    for a in sys.argv[1:]:
        if skip:
            skip = False
            continue
        if a == "--poster":
            skip = True
            continue
        if a == "--style":
            skip = True
            continue
        if a in _PICK_SENTENCE_FLAGS or a.startswith("-"):
            continue
        out.append(a)
    return out


def _poster_date_from_argv() -> Optional[str]:
    raw = sys.argv[1:]
    for i, a in enumerate(raw):
        if a == "--poster" and i + 1 < len(raw):
            return raw[i + 1].strip()
    return None


def _poster_style_from_argv() -> Optional[str]:
    raw = sys.argv[1:]
    for i, a in enumerate(raw):
        if a == "--style" and i + 1 < len(raw):
            return raw[i + 1].strip()
    return None


def _prompt_line(msg: str) -> str:
    print(msg, end="", flush=True)
    return input()


def _run_ai_poster_only(date: str, style: Optional[str] = None) -> None:
    """CLI: ``python main.py --poster YYYY-MM-DD [--style KEY]`` → AI posters under ``outputs/posters/``."""
    from generators.ai_poster_generator import create_mass_poster
    from services.ai_styles import resolve_ai_image_style

    print("================================", flush=True)
    print("   AI MASS POSTER (CLI MODE)    ", flush=True)
    print("================================", flush=True)
    resolved = resolve_ai_image_style(style)
    print(f"Style: {resolved}", flush=True)
    try:
        paths = create_mass_poster(date, style=style or "cinematic")
    except ValueError as exc:
        print("❌", exc)
        raise SystemExit(1) from exc
    print("\nWritten:", flush=True)
    for label, p in sorted(paths.items()):
        print(f"  • {label}: {p}", flush=True)
    print("\n✅ AI poster export complete (see outputs/posters/).", flush=True)


poster_only = _poster_date_from_argv()
if poster_only:
    _run_ai_poster_only(poster_only, style=_poster_style_from_argv())
    raise SystemExit(0)

pick_sentence_mode = bool(_PICK_SENTENCE_FLAGS & set(sys.argv[1:]))

print("================================", flush=True)
print("     CHURCH MEDIA GENERATOR     ", flush=True)
print("================================", flush=True)

positional = _argv_positional()
if len(positional) >= 2:
    date, celebrant = positional[0], positional[1]
    print(f"Date: {date}\nCelebrant: {celebrant}\n", flush=True)
else:
    print(
        "Tip: run non-interactively — python3 main.py YYYY-MM-DD \"Celebrant Name\"\n"
        "     AI posters only — python3 main.py --poster YYYY-MM-DD [--style cinematic|renaissance|...]\n",
        flush=True,
    )
    if len(positional) == 1:
        date = positional[0]
        celebrant = _prompt_line("Enter Celebrant Name: ")
    else:
        date = _prompt_line("Enter Mass Date (YYYY-MM-DD): ")
        celebrant = _prompt_line("Enter Celebrant Name: ")

print("Working: fetching readings and building PowerPoint + poster…", flush=True)

result = generate_mass_media(
    date,
    celebrant,
    interactive_pick=pick_sentence_mode,
)

if not result.ok:
    print("❌", result.error or "Generation failed.")
    raise SystemExit(1)

print("\nGospel Reference:", result.gospel_reference)
if result.gospel_text_length:
    print("Gospel text loaded:", result.gospel_text_length, "characters.")
else:
    print("⚠️ Gospel full text not available; slides will show a fallback note.")
if result.liturgical_color_name:
    print(
        "Liturgical color:",
        result.liturgical_color_name,
        f"({result.liturgical_season_label})" if result.liturgical_season_label else "",
        result.liturgical_color_hex,
    )
if result.slide_line_preview:
    print("Title / deck excerpt:", result.slide_line_preview)
if result.gospel_quote:
    print(
        "Gospel quote (slides / poster):",
        (result.gospel_quote[:200] + "…") if len(result.gospel_quote) > 200 else result.gospel_quote,
    )
if result.slide_count:
    print("Slide count:", result.slide_count)
if result.export_stem:
    print("Export stem:", result.export_stem)

print("✅ PowerPoint generated:", result.pptx_path)
print("✅ Poster (social):", result.poster_path)
if result.poster_ppt_path:
    print("✅ Poster (16×9 for projection):", result.poster_ppt_path)
