---
name: emil-design-eng
description: Emil Kowalski design engineering — UI polish, animation decisions, easing, and interaction feel. Use when refining motion, transitions, micro-interactions, or reviewing animation code in Verbum.
---

# Design Engineering (Emil Kowalski)

Verbum loads motion tokens and rules from `static/css/emil-motion.css`.

## Quick rules

- UI animations **≤300ms**; exits ~20% faster than enter
- **Never `ease-in`** on enter/exit UI — use custom **ease-out** `cubic-bezier(0.23, 1, 0.32, 1)`
- Enter from **`scale(0.95)` + opacity**, not `scale(0)`
- **`transform` + `opacity` only** — avoid animating width/height
- Buttons: **`scale(0.97)` on `:active`**
- Popovers: **`transform-origin` at trigger**; modals stay centered
- High-frequency actions (keyboard, constant nav): **no or minimal** animation

## Tokens (in `:root`)

| Token | Use |
|-------|-----|
| `--motion-duration-micro` | Press feedback (100ms) |
| `--motion-duration-fast` | Hovers, chips (150ms) |
| `--motion-duration-base` | Pages, dropdowns (200ms) |
| `--motion-duration-exit` | Leave transitions (120ms) |
| `--motion-duration-modal` | Modals, overlays (260ms) |
| `--motion-ease-out` | Enter / exit viewport |
| `--motion-ease-in-out` | On-screen morph |
| `--motion-ease-hover` | Color / background |

Full framework: [emilkowal.ski/ui/7-practical-animation-tips](https://emilkowal.ski/ui/7-practical-animation-tips) · [animations.dev](https://animations.dev/)
