---
name: awesome-design-md
description: >-
  Read DESIGN.md design systems from VoltAgent awesome-design-md for UI polish,
  new pages, and component styling in Verbum. Use when the user mentions
  DESIGN.md, design theme, awesome-design-md, visual consistency, or asks to
  match a reference brand (Cal, Apple, Notion, Linear, Mintlify).
---

# Awesome DESIGN.md (Verbum)

[awesome-design-md](https://github.com/voltagent/awesome-design-md) supplies brand-level `DESIGN.md` files for AI agents. Verbum wires them into this repo — **do not** guess tokens from memory.

## Workflow

1. **Read active design first:** [`DESIGN.md`](../../../DESIGN.md) (project root)
2. **Apply Verbum overrides:** [`.cursor/design-references/verbum-overrides.md`](../../design-references/verbum-overrides.md)
3. **Deep-dive reference theme** when implementing components: [`.cursor/design-references/cal/DESIGN.md`](../../design-references/cal/DESIGN.md) (active layout/color base)
4. **Typography** (scale, tracking, fonts): [`.cursor/design-references/apple/DESIGN.md`](../../design-references/apple/DESIGN.md)
5. **Pair with existing skills:**
   - Motion → `.cursor/skills/emil-design-eng/`
   - UX rules → `.cursor/skills/ui-ux-pro-max/`
   - Tokens / slides → `.cursor/skills/design-system/`
   - Brand voice → `.cursor/skills/brand/`

## Active theme

**Cal.com** — layout/color: white cards, soft grey canvas, rounded cards (~12px), dashboard density.

**Apple.com** — typography: 17px body, 14px caption, negative tracking, system font stack, antialiased UI type.

## Alternate references (switch only when user asks)

| Theme | File | When to use |
|-------|------|-------------|
| Mintlify | `design-references/mintlify/DESIGN.md` | Stronger green accent, docs/reading surfaces |
| Notion | `design-references/notion/DESIGN.md` | Warmer workspace, long-form reading cards |
| Linear | `design-references/linear.app/DESIGN.md` | Dark product UI, ultra-tight nav (not default) |

To switch active theme: update root `DESIGN.md` frontmatter `reference-theme` and tell the user.

## Rules

- **One active `DESIGN.md` at repo root** — never merge multiple full brand files into CSS at once
- Map reference tokens → existing CSS vars in `templates/index.html` and `static/css/verbum-design-system.css`
- Keep liturgical green and Mea Culpa wordmark per `verbum-overrides.md`
- Prefer layout/spacing/component patterns from DESIGN.md; keep Verbum-specific routes and content structure unchanged

## Index

Full catalog: [`.cursor/design-references/README.md`](../../design-references/README.md)
