# Lyrics Mechanism Backup — 2026-06-23 19:09:32

Snapshot of the lyrics mechanism taken right before adding the web-lyrics
sanitization layer (metadata/overflow fix).

## Files backed up
- `services/lyrics_fetcher.py`
- `services/mass_text_format.py`
- `services/song_catalog.py`
- `services/web_hymn_discovery.py`
- `services/hymn_library.py`
- `generators/powerpoint.py`

## How to restore
From the project root (`church_media_generator/`):

```bash
B="backups/lyrics_mechanism_20260623_190932"
cp "$B/services/lyrics_fetcher.py" services/
cp "$B/services/mass_text_format.py" services/
cp "$B/services/song_catalog.py" services/
cp "$B/services/web_hymn_discovery.py" services/
cp "$B/services/hymn_library.py" services/
cp "$B/generators/powerpoint.py" generators/
```

This reverts the lyrics mechanism to the state considered "perfect".
