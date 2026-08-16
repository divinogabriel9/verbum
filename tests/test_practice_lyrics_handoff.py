from __future__ import annotations

from services.practice_lyrics_handoff import (
    public_handoff_payload,
    songs_for_pptx_from_snapshot,
)


def test_songs_for_pptx_skips_disabled_blocks_and_keeps_order():
    songs = songs_for_pptx_from_snapshot(
        [
            {
                "hymn_id": "h1",
                "slot_key": "entrance",
                "section": "entrance",
                "title": "Song A",
                "blocks": [
                    {"kind": "verse", "label": "Verse 1", "body": "one\ntwo", "enabled": True},
                    {"kind": "chorus", "label": "Chorus", "body": "skip", "enabled": False},
                    {"kind": "verse", "label": "Verse 2", "body": "three", "enabled": True},
                ],
            },
            {
                "hymn_id": "h2",
                "slot_key": "communion_1",
                "section": "communion",
                "title": "Song B",
                "lyrics": "plain body",
                "blocks": [],
            },
        ]
    )
    assert len(songs) == 2
    assert songs[0]["hymn_id"] == "h1"
    assert songs[0]["lyrics"] == "Verse 1\none\ntwo\n\nVerse 2\nthree"
    assert songs[1]["section"] == "communion"
    assert "plain body" in songs[1]["lyrics"] or songs[1]["lyrics"]


def test_public_handoff_payload_shape():
    payload = public_handoff_payload(
        {
            "ok": True,
            "id": "abc",
            "mass_date": "2026-08-16",
            "mass_title": "20th Sunday",
            "parish_name": "St Test",
            "sender_label": "Choir leader",
            "song_count": 1,
            "songs": [
                {
                    "slot_key": "entrance",
                    "slot_label": "Entrance",
                    "section": "entrance",
                    "hymn_id": "h1",
                    "title": "Song",
                    "lyrics": "Verse 1\nline",
                }
            ],
        }
    )
    assert payload["ok"] is True
    assert payload["id"] == "abc"
    assert payload["songs"][0]["hymn_id"] == "h1"
    assert "lyrics" in payload["songs"][0]
