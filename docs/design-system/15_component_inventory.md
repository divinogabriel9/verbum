# 15 · Component Inventory (detected)

> Auto-detected reusable UI from `static/css/*.css` + markup in `templates/*.html`. The app is
> **CSS-class + id based** (vanilla JS), not a JS component framework — so "Props" = the CSS
> modifiers / `data-*` / `id` hooks that parameterize each component.
> Columns: Component · File(s) · "Props" (modifiers/hooks) · Variants · Dependencies · Where used · Reuse? · Split? · Merge?

| Component | File | Props (modifiers / hooks) | Variants | Dependencies | Where used | Reuse? | Split? | Merge? |
|---|---|---|---|---|---|---|---|---|
| **Button** | `verbum-design-system.css` | `.primary/.secondary/.ghost/.mini/.danger`, `.btn-xl` | 5 + xl | tokens, emil-motion | everywhere | ✅ | — | Merge `.uiverse-btn` in |
| **Uiverse button (legacy)** | `verbum-design-system.css` | `.uiverse-btn` + `--orange/--generate/--sm/.btn-xl/.is-disabled` | 4 | nested markup | song plan, generate | ⚠️ | — | ➡️ Merge into Button (retire) |
| **Create CTA** | `verbum-design-system.css` | `.btn-create` | 1 | tokens | header | ✅ | — | Could be Button `--cta` |
| **Pill / filter chip** | `verbum-design-system.css` | `.pill`, `.song-filter-row button.active` | 2 | tokens | song filters | ✅ | — | with Tabs family |
| **Card (base)** | `verbum-design-system.css` | `.panel/.tool-card/.admin-card/.metric` | many | tokens, apple hover | all screens | ✅ | — | ➡️ Merge to one `.card` |
| **Bento cell** | inline `index.html` | `.flow-bento-cell`, `.home-bento-cell` (`__head`) | 2 | grid, hover | Home, Builder | ✅ | — | with Card |
| **Content cards** | inline + DS | reading/theme/template/song-plan/cal-reading | ~8 | Card | Home, Builder, Calendar, Library | ✅ | — | layout variants of Card |
| **Tabs (segmented)** | `verbum-design-system.css` | `.flow-builder-tabs button[aria-selected]`, `data-flow-tab/panel` | 1 | tokens | Mass Builder | ✅ | — | — |
| **Settings sub-nav** | `verbum-design-system.css` | `.settings-sidebar-link.active`, `data-settings-panel` | 1 | tokens | Settings | ✅ | — | — |
| **Input / textarea** | `verbum-design-system.css` | type attr, `.field`, `.field-grid` | text/date/file/search/color/textarea | tokens | forms | ✅ | — | — |
| **Custom select** | `verbum-design-system.css` | `.vb-select` + `--sm/--pill/--drop-up/--wide/--right`; `.vb-select__trigger/value/chevron/panel` | 5 | dropdown panel | Builder, Library, Posters, Settings | ✅ | — | — |
| **Dropdown / menu list** | `verbum-design-system.css` | `.vb-dropdown-*`, `.global-search-*`, `.app-menu-*` | 3 co-styled | tokens | search, account, create, selects | ✅ | — | ➡️ one Menu component |
| **Checkbox** | inline (`accent-color`) | native + `data-nav-tab-toggle` | branding/news/nav | tokens | Settings, Builder | ✅ | — | — |
| **Radio** | inline | `name="theme-preference/visual-style/flow-hymn-layout"`, `.theme-pref-option` | groups | tokens | Settings, Builder | ✅ | — | — |
| **Switch** | Tailwind peer (`landing`/wizard) | `peer-checked:*`, `after:` knob | 1 | Tailwind | toggles | ⚠️ | — | ➡️ build System-A switch |
| **Date input** | inline | native `input[type=date]` (`mass-date`, `poster-mass-date`) | 1 | tokens | Builder, Posters | ✅ | — | — |
| **Event date popover** | inline | `home-event-date-*`, `.event-date-popover/-cal` | 1 | calendar grid | Home event modal | ✅ | — | with Calendar |
| **Calendar month grid** | inline | `cal-grid/-cell/-dow-row`, `cal-prev/next` | 1 | readings API | Calendar | ✅ | — | — |
| **Stepper** | inline | `mass-builder-stepper(-list)`, `data-mass-step-target`, `--stepper-active` | 1 | tokens | Mass Builder | ✅ | — | — |
| **Progress meter** | inline | `mass-summary-progress/-fill`, `flow-song-count` | 1 | tokens | Builder song plan | ✅ | — | — |
| **Full-screen loader** | DS + inline | `mass-gen-loader(-msg)` | 1 | scrim, aria-live | generation | ✅ | — | — |
| **Skeleton / shimmer** | `emil-motion.css` | `.emil-skeleton`, `.emil-stagger-enter`, `.is-refreshing` | 1 | reduced-motion | Home, song plan, recs | ✅ | — | — |
| **Toast** | DS + emil-motion | `.toast`, `.toast--visible`, `.toast__close`, `#toast-stack` | 1 | aria-live | global | ✅ | — | — |
| **Banner** | inline | `home-membership-banner` | states | auth/me | Home | ✅ | — | — |
| **Modal / dialog** | DS + emil-motion + inline | `.modal/.modal-box`, `.ui-overlay/.ui-card`, `--ui-card-width*` | 3 sizes | scrim, focus trap | many | ✅ | — | — |
| **Bottom sheet / drawer** | inline + DS | mobile More sheet, `.song-preview-panel__sheet` | 2 | `--ease-drawer` | mobile nav, song preview | ✅ | — | — |
| **Avatar** | inline | `church-logo-avatar(-img/-placeholder)`, `btn-upload-logo` | 1 | upload API | Settings | ✅ | — | — |
| **Search (global)** | DS + inline | `app-global-search`, `global-search-panel/list/item/empty` | 1 | search index | header | ✅ | — | with Menu |
| **Search (inline)** | DS | `.song-composer-search-wrap`, `song-catalog-search`, `collections-catalog-search` | 1 | tokens | Library, Collections | ✅ | — | — |
| **Liturgical indicator** | inline | `liturgical-indicator(--ordinary)`, `liturgical-indicator-panel` | 2 | season state | header | ✅ | — | — |
| **Radio pill player** | inline | `live-radio-*` (pill/play/prev/next/art/panel) | 1 | EWTN API | header | ✅ | ➡️ Split out a `/radio` page | — |
| **Song composer** | DS + emil-motion | `.song-composer-*` (panel/rail/toolbar/recent/expandable, `--deflated`) | 1 complex | vb-select, search | Library | ✅ | ⚠️ very large — consider splitting | — |
| **Lyric block** | DS | `.lyric-block.type-*`, `data-action`, `data-add-type`, `.vb-select--pill` | 4 types | vb-select | Library | ✅ | — | tokenize colors |
| **Food-sponsor chips** | inline | `flow-food-sponsors(-list)`, `flow-food-sponsor-input` | 1 | tokens | Builder | ✅ | — | with Chip |
| **Poster picker** | inline | `data-poster-picker`, `data-target=flow-lotw/lote-poster` | 1 | poster images | Builder | ✅ | — | with Template card |
| **Wizard (System B)** | `mass_builder_wizard.css/html/js` | Tailwind utility classes | parallel | Tailwind config | standalone wizard | ❌ | — | ➡️ Rebuild in System A |

---

## Reuse / split / merge summary

**Highly reusable (keep, document):** Button, Card, Tabs, Input, Custom select, Dropdown/menu, Modal, Toast, Skeleton, Stepper, Calendar, Search.

**Should be split:**
- **Radio pill player** → also needs a full `/radio` page (IDs already specced).
- **Song composer** → decompose into smaller sub-components (search bar, recent list, structured editor) for maintainability.
- **`index.html`** → extract inline JS into `static/js/` modules and CSS into token/component files.

**Should be merged / retired:**
- `.uiverse-btn` → Button.
- `.panel/.tool-card/.admin-card/.metric/...` → one `.card` base + modifiers.
- `.vb-dropdown-*` / `.global-search-*` / `.app-menu-*` → one Menu/Dropdown component.
- System B wizard → rebuild in System A (or retire).
- Danger token aliases (`--danger/--design-error/--bad`) → one token.

**Needs tokenizing (not merge/split):** lyric-block type colors, raw-px spacing in component CSS, switch component.
