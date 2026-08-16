"""Lyric-phrase matching for chorus preview start times (no network)."""

from __future__ import annotations

from services.song_preview_clip import (
    match_lyric_start,
    match_words_to_lyrics,
    parse_vtt_captions,
    resolve_preview_start,
    resolve_preview_start_from_words,
)

WE_ARE_CALLED = """Verse 1
Come! Live In The Light!
Shine With The Joy And The Love Of The Lord!
We Are Called To Be Light For The Kingdom,
To Live In The Freedom Of The City Of God!

Refrain
We Are Called To Act With Justice.
We Are Called To Love Tenderly.
We Are Called To Serve One Another, To Walk Humbly With God.
"""


def test_title_card_is_not_treated_as_the_chorus():
    captions = [
        {"start": 0.0, "text": "[Music]"},
        {"start": 0.4, "text": "We Are Called — David Haas"},
        {"start": 8.0, "text": "[Music]"},
        {"start": 22.5, "text": "Come live in the light"},
        {"start": 26.0, "text": "Shine with the joy and the love of the Lord"},
    ]
    start, method = resolve_preview_start(
        captions=captions,
        lyrics=WE_ARE_CALLED,
        duration_sec=10,
    )
    assert start == 22.5
    assert method == "verse"


def test_chorus_phrase_beats_title_overlap():
    captions = [
        {"start": 0.0, "text": "We Are Called"},
        {"start": 41.0, "text": "We are called to act with justice"},
        {"start": 45.0, "text": "We are called to love tenderly"},
    ]
    hit = match_lyric_start(
        captions,
        "We Are Called To Act With Justice. We Are Called To Love Tenderly.",
        10,
    )
    assert hit == 41.0


def test_whisper_words_skip_instrumental_then_hit_verse():
    words = [
        {"start": 0.2, "text": "hmm"},
        {"start": 3.0, "text": "yeah"},
        {"start": 18.1, "text": "Come"},
        {"start": 18.4, "text": "live"},
        {"start": 18.7, "text": "in"},
        {"start": 19.0, "text": "the"},
        {"start": 19.3, "text": "light"},
    ]
    start, method = resolve_preview_start_from_words(words, WE_ARE_CALLED)
    assert start == 18.1
    assert method == "verse"


def test_match_words_requires_lyric_phrase_not_title():
    words = [
        {"start": 0.0, "text": "We"},
        {"start": 0.2, "text": "Are"},
        {"start": 0.4, "text": "Called"},
        {"start": 12.0, "text": "Come"},
        {"start": 12.3, "text": "live"},
        {"start": 12.5, "text": "in"},
        {"start": 12.8, "text": "the"},
        {"start": 13.1, "text": "light"},
    ]
    assert match_words_to_lyrics(words, "Come live in the light") == 12.0


def test_parse_vtt_strips_music_cues():
    vtt = """WEBVTT

00:00:00.000 --> 00:00:04.000
[Music]

00:00:19.200 --> 00:00:22.000
Come live in the light
"""
    captions = parse_vtt_captions(vtt)
    assert captions == [{"start": 19.2, "text": "Come live in the light"}]


def test_empty_captions_need_audio_word_detection():
    start, method = resolve_preview_start(captions=[], lyrics=WE_ARE_CALLED, duration_sec=10)
    assert start is None
    assert method == "start"
