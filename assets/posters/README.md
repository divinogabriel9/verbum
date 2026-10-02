# Pricing posters

Customer-facing Free vs Paid comparison assets for LiturgyFlow parish outreach.

| File | Use |
|------|-----|
| `pricing-poster-free-vs-paid.png` | Shareable / print-ready PNG (1600×1000) |
| [`../docs/presentations/pricing-poster-free-vs-paid.html`](../docs/presentations/pricing-poster-free-vs-paid.html) | Editable HTML source (re-export with Chrome headless) |

Re-export:

```bash
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1600,1000 --virtual-time-budget=8000 \
  --screenshot=assets/posters/pricing-poster-free-vs-paid.png \
  "file://$(pwd)/docs/presentations/pricing-poster-free-vs-paid.html?export=1"
```
