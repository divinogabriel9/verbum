# 10 · Motion

> Source: `static/css/emil-motion.css`, motion tokens in `verbum-design-system.css` + inline `:root`.
> Philosophy follows Emil Kowalski's animation principles (referenced directly in code comments).

---

## 1. Animation philosophy
- **Calm, fast, purposeful.** Durations ≤ 300ms. Motion confirms an action or reveals content — never decoration.
- **Ease-out on enter and exit** (`cubic-bezier(0.23, 1, 0.32, 1)`). **No ease-in on UI.**
- **Scale from 0.95–0.98, never 0.** Things grow/settle, they don't pop from nothing.
- **Animate opacity + transform only** (and explicit properties). **Never `transition: all`.**
- **Origin matters:** popovers/menus scale from their trigger; modals from center.
- **Reduced motion is sacred:** everything collapses under `prefers-reduced-motion`.

## 2. Timing tokens
| Token | Value | Use |
|---|---|---|
| `--motion-duration-micro` | 100ms | Press / active scale |
| `--motion-duration-fast` | 150ms | Hover, color/border transitions |
| `--motion-duration-base` | 200ms | Dropdowns, content enter, toasts |
| `--motion-duration-modal` | 260ms | Modal enter |
| `--motion-duration-exit` | 120ms | Collapse / exit |
| `--motion-duration-slow` | 280ms | Slow transitions |
| `--apple-card-hover-duration` | 320ms | Card hover lift |

## 3. Curves
| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | Default enter/exit |
| `--ease-in-out` | `cubic-bezier(0.77,0,0.175,1)` | Symmetric morphs (composer) |
| `--ease-drawer` | `cubic-bezier(0.32,0.72,0,1)` | Drawers/sheets |
| `--ease-hover` | `cubic-bezier(0.25,0.1,0.25,1)` | Hover color/bg + card lift |

## 4. Patterns by component

| Pattern | Behavior |
|---|---|
| **Page transition** | SPA route swap toggles `.active`; content uses stagger/`emil-content-enter` (opacity + `scale(0.98) translateY(4px)`), 200ms ease-out |
| **Hover (card)** | `translateY(-4px) scale(1.006)`, border tint, shadow→hover, 320ms `--ease-hover`; `z-index 1` |
| **Hover (button)** | neutral `translateY(-1px)`; primary bg → active color, 150ms |
| **Press** | `scale(0.97)` buttons / `scale(0.99)` menu items, 100ms |
| **Expand / Collapse** | grid-template-rows `1fr↔0fr` (song composer), content opacity+translate, base/exit timing |
| **Dialog** | center-origin `scale(0.95) translateY(8px) → scale(1)`, 260ms ease-out; backdrop fade + blur |
| **Bottom sheet / drawer** | `--ease-drawer`, slide + `scale(0.96)` |
| **Popover/menu** | scale from trigger origin (`top right`/`top left`), `scale(0.98) translateY(-4px) → 1`, 200ms |
| **Progress** | linear meter fill transition; full-screen loader with live status |
| **Skeleton** | `emil-shimmer` opacity 0.5→0.82→0.5, 1.1s `--ease-in-out` loop; `--radius-sm` |
| **Refresh** | `emil-refresh-spin` 0.75s linear; refreshing panels drop to `opacity 0.94` + `pointer-events:none` |
| **Toast** | `translateY(8px) scale(0.96) → 0`, 200ms `--ease-hover`; `--toast--visible` |
| **Chevron** | rotate 180° on `aria-expanded`, 200ms ease-out |

## 5. Duration guidance
- Micro feedback (press, toggle): 100ms.
- Hover/state: 150ms.
- Reveal/enter (dropdown, content, toast): 200ms.
- Modal: 260ms. Card lift: 320ms (intentionally slower, premium).
- Anything > 320ms is off-system (except looped skeleton/spin).

## 6. Reduced-motion contract
Under `prefers-reduced-motion: reduce`:
- Card/hero/metric hover transforms → `none`.
- Skeleton/stagger/refresh-spin animations → `none`.
- Refreshing panels stay `opacity 1`.
- Button press transform → `none`; composer transitions → `none`.
- `scroll-behavior: auto`.

> **Rule:** every new animated component must add a reduced-motion fallback in the same commit.
