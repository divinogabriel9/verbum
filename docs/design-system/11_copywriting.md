# 11 · Copywriting & Voice

> Source: UI strings in `templates/index.html`, `DESIGN.md`, `STITCH_DESIGN_BRIEF.md`, label styling
> (`label { text-transform: none }`, sentence-case rule). Where no example exists, marked `[RECOMMENDATION]`.

---

## 1. Tone of voice
- **Warm, plain, pastoral.** A helpful sacristan, not a SaaS growth team.
- **Reverent about content, casual about chrome.** Scripture references are precise; UI hints are conversational.
- **Encouraging and reassuring.** The user is often under Saturday-night time pressure — reduce anxiety.
- **Confident and brief.** Say the next step, not the manual.

## 2. Reading level
- Aim for a **~Grade 6–8** reading level for UI copy. Avoid jargon ("lectionary cycle" is fine in liturgical context; "multipart form payload" is not).
- Liturgical terms are allowed and expected (Gospel, Psalm refrain, Penitential Act, Gloria, celebrant) — the audience knows them.

## 3. Capitalization
- **Sentence case** for labels, buttons, titles, hints (`label { text-transform: none }`; `DESIGN.md`: "labels use sentence case, not uppercase micro-type").
- **Title Case** only for proper liturgical names / poster kickers (e.g., "Liturgy of the Word", "Ordinary Time").
- **No ALL-CAPS** UI text. The few uppercase group labels in code (e.g., `.song-composer-catalog-label`) are flagged as an inconsistency in [`12_ui_audit.md`](12_ui_audit.md) — prefer sentence case going forward.

## 4. Sentence length
- Buttons: 1–4 words ("Generate full Mass package", "Use this date", "Add celebrant").
- Hints/descriptions: one short sentence, ≤ ~16 words.
- Empty states: one friendly sentence + one action.

## 5. Grammar rules
- Use **active voice** and imperative for actions ("Load readings & songs", "Choose a date").
- Address the user as "you"; refer to the parish as "your parish/church".
- Oxford comma on; en dashes for ranges; curly quotes in scripture.
- Numerals for counts/dates ("3 readings", "2 columns"); spell out one–nine elsewhere only if natural.

## 6. Buttons
- Verb-first, specific outcome. Good: "Generate full Mass package", "Save lyrics", "Render actual deck", "Use this date".
- Avoid vague ("Submit", "OK") — say what happens.
- Primary = the outcome; secondary = lighter verbs ("Load…", "Refresh", "Add…").

## 7. Titles & subtitles
- **Title:** the screen/section noun ("Mass Builder", "Song Library", "Today's reflection").
- **Subtitle/description:** one line of what this does or why ("Plan Mass, generate slides and posters").
- Keep the header title + short route description aligned with the screen's job.

## 8. Descriptions / helper text
- Explain the *why* or the *next step*, not the obvious. ("We sample the first slides for backgrounds, text colors, and fonts, then map them to the generator's theme.")
- Place hints below the field, muted (`--muted`, `--type-helper`).

## 9. Validation
- Specific and kind: "Add a celebrant to continue" beats "Required field".
- Inline near the field; don't rely on a toast alone for field errors.
- Pre-empt errors with sensible defaults so validation rarely fires.

## 10. Errors
- Plain, blame-free, with a recovery path: "We couldn't load readings for that date. Try another Sunday." 
- Never expose stack traces / endpoint names to users.
- Pair with a retry action where possible.

## 11. Success
- Quietly affirm via toast or a satisfying receipt — don't over-celebrate. "Mass package ready" + download links.
- The generation receipt is the main success moment; keep it clear and scannable (grouped, with download buttons).

## 12. Warnings
- Reserve for genuine caution (quota near/at limit, irreversible delete, logo locked).
- AI quota: "Daily image limit reached — try again tomorrow or use a liturgical template." (limit-reached state).

## 13. Empty states
- Friendly + actionable: "No events yet. Create your first one." / "No saved posters yet."
- Always include the one action that resolves the emptiness.

## 14. Microcopy vocabulary (canonical terms)
- "Mass package" (the full deck bundle), "readings", "Psalm refrain", "Gospel acclamation/sentence", "celebrant" / "co-celebrant", "stewardship", "sign of peace", "liturgical season/color", "Theme Lab", "Song plan", "Collections".
- Product names: **LiturgyFlow** (product), **Verbum** (repo/deploy). Use "LiturgyFlow" in user-facing copy.

## 15. Do / Don't
| Do | Don't |
|---|---|
| "Generate full Mass package" | "SUBMIT" |
| "Use this date" | "Confirm selection" |
| "No events yet. Create your first one." | "Empty." |
| "Daily image limit reached — use a template instead." | "Quota exceeded (429)." |
| Sentence case | ALL CAPS LABELS |
| "your parish" | "the entity" |
