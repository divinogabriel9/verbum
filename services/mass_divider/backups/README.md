# Fine-tune prompt backups

Frozen copies of the production Mass Divider gospel prompt path.

| File | Role |
|---|---|
| `prompt_builder_og_20261018.py` | Exact `build_background_prompt` used as **OG Fine-tune** |
| `gospel_analysis_og_20261018.py` | Exact gospel visual analysis paired with that prompt |

Do not edit these files. New prompt iterations live in `prompt_iterations.py`; the live
`prompt_builder.build_background_prompt(..., iteration="og")` path must stay
byte-identical to `prompt_builder_og_20261018.build_background_prompt`.
