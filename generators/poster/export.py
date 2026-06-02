"""Export composed poster masters to social and presentation sizes."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from generators.poster.types import BG_WHITE, PPT_SIZE, SOCIAL_SIZE


def letterbox_image(image: Image.Image, size: tuple[int, int], bg: tuple[int, int, int]) -> Image.Image:
    tw, th = size
    iw, ih = image.size
    scale = min(tw / max(iw, 1), th / max(ih, 1))
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = image.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), bg)
    ox = (tw - nw) // 2
    oy = (th - nh) // 2
    canvas.paste(resized, (ox, oy))
    return canvas


def landscape_to_portrait(landscape: Image.Image, target: tuple[int, int] = SOCIAL_SIZE) -> Image.Image:
    tw, th = target
    lw, lh = landscape.size
    scale = tw / lw
    nh = max(1, int(lh * scale))
    resized = landscape.resize((tw, nh), Image.Resampling.LANCZOS)
    if nh >= th:
        y0 = (nh - th) // 2
        return resized.crop((0, y0, tw, y0 + th))
    canvas = Image.new("RGB", target, BG_WHITE)
    canvas.paste(resized, (0, (th - nh) // 2))
    return canvas


def _landscape_master_for_export(master: Image.Image) -> Image.Image:
    mw, mh = master.size
    if mw < mh:
        return master.transpose(Image.Transpose.ROTATE_90)
    return master


def export_ppt_poster(
    master: Image.Image,
    output_dir: Path,
    stem: str,
    *,
    ppt_size: tuple[int, int] = PPT_SIZE,
) -> Path:
    """Write ``{stem}_16x9.png`` (1920×1080) for projection / liturgical slide."""
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_stem = (stem or "mass_poster").strip() or "mass_poster"
    ppt_path = output_dir / f"{safe_stem}_16x9.png"
    landscape = _landscape_master_for_export(master)
    if landscape.size != ppt_size:
        ppt_img = landscape.resize(ppt_size, Image.Resampling.LANCZOS)
    else:
        ppt_img = landscape
    ppt_img.save(ppt_path, format="PNG", optimize=True)
    return ppt_path


def export_primary_poster_pair(
    master: Image.Image,
    output_dir: Path,
    stem: str,
    *,
    social_size: tuple[int, int] = SOCIAL_SIZE,
    ppt_size: tuple[int, int] = PPT_SIZE,
    include_social: bool = True,
) -> tuple[Path | None, Path]:
    """Write ``{stem}_16x9.png``; optionally ``{stem}.png`` (1080×1350 Instagram feed)."""
    ppt_path = export_ppt_poster(master, output_dir, stem, ppt_size=ppt_size)
    if not include_social:
        return None, ppt_path

    output_dir.mkdir(parents=True, exist_ok=True)
    safe_stem = (stem or "mass_poster").strip() or "mass_poster"
    social_path = output_dir / f"{safe_stem}.png"
    landscape = _landscape_master_for_export(master)
    social = landscape_to_portrait(landscape, social_size)
    social.save(social_path, format="PNG", optimize=True)
    return social_path, ppt_path


def export_poster_sizes(
    master: Image.Image,
    out_dir: Path,
    *,
    instagram_post: tuple[int, int] = SOCIAL_SIZE,
    instagram_story: tuple[int, int] = (1080, 1920),
    facebook: tuple[int, int] = (1200, 630),
) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    letterbox_bg = BG_WHITE

    def save_scaled(target: tuple[int, int], name: str, letterbox: bool) -> None:
        tw, th = target
        if letterbox:
            out_img = letterbox_image(master, (tw, th), letterbox_bg)
        else:
            mw, mh = master.size
            if mw >= mh and th > tw:
                out_img = landscape_to_portrait(master, (tw, th))
            else:
                out_img = master.resize((tw, th), Image.Resampling.LANCZOS)
        p = out_dir / name
        out_img.save(p, format="PNG", optimize=True)
        key = name.replace(".png", "").replace("mass_poster_", "")
        paths[key] = p

    save_scaled(instagram_post, "mass_poster_instagram.png", letterbox=False)
    save_scaled(instagram_story, "mass_poster_story.png", letterbox=True)
    save_scaled(facebook, "mass_poster_facebook.png", letterbox=True)
    return paths
