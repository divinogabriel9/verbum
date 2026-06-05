"""Layout presets for parish posters."""

from generators.poster.presets import gfcc_flat

PRESET_IDS = ("gfcc_flat",)

_RENDERERS = {
    "gfcc_flat": gfcc_flat.render,
}


def get_renderer(preset_id: str):
    key = (preset_id or "gfcc_flat").strip().lower()
    if key not in _RENDERERS:
        raise ValueError(f"Unknown poster preset: {preset_id!r}. Choose from: {', '.join(PRESET_IDS)}")
    return _RENDERERS[key]
