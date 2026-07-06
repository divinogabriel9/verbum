"""QR codes for choir practice share links."""

from __future__ import annotations

import base64
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def practice_qr_data_url(url: str) -> Optional[str]:
    """Return a data URL (SVG or PNG) for embedding in the share modal."""
    target = (url or "").strip()
    if not target:
        return None
    try:
        import qrcode
        from qrcode.image.svg import SvgPathImage

        qr = qrcode.QRCode(box_size=6, border=2)
        qr.add_data(target)
        qr.make(fit=True)
        img = qr.make_image(image_factory=SvgPathImage)
        buf = io.BytesIO()
        img.save(buf)
        encoded = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/svg+xml;base64,{encoded}"
    except Exception as exc:
        logger.warning("SVG QR failed (%s); trying PNG.", exc)
    try:
        import qrcode

        img = qrcode.make(target)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"
    except Exception as exc:
        logger.warning("PNG QR unavailable (%s).", exc)
        return None
