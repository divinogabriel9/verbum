"""Practice share PIN + cache performance helpers."""

from __future__ import annotations

import time

from services.choir_practice_shares import (
    create_practice_share,
    fetch_practice_share,
    get_practice_share_by_token,
    invalidate_practice_cache,
    verify_practice_share_pin,
)
from services.practice_access import (
    hash_pin,
    release_unlock_slot,
    try_acquire_unlock_slot,
    verify_pin,
)


def test_hash_pin_uses_v2_prefix() -> None:
    stored = hash_pin("123456")
    assert stored.startswith("v2:")
    assert verify_pin(stored, "123456") is True
    assert verify_pin(stored, "000000") is False


def test_verify_pin_accepts_legacy_v1() -> None:
    import hashlib
    import hmac

    salt = "abcd1234"
    digest = hashlib.pbkdf2_hmac("sha256", b"654321", salt.encode("utf-8"), 40_000)
    stored = f"v1:{salt}:{digest.hex()}"
    assert verify_pin(stored, "654321") is True
    assert verify_pin(stored, "111111") is False


def test_verify_pin_cache_speeds_repeat() -> None:
    stored = hash_pin("482916")
    t0 = time.perf_counter()
    assert verify_pin(stored, "482916") is True
    first = time.perf_counter() - t0
    t1 = time.perf_counter()
    assert verify_pin(stored, "482916") is True
    second = time.perf_counter() - t1
    # Cached path should be dramatically cheaper than PBKDF2.
    assert second < first
    assert second < 0.005


def test_unlock_slot_gate_fail_fast() -> None:
    held = 0
    while try_acquire_unlock_slot():
        held += 1
        if held > 64:
            break
    assert held >= 1
    assert try_acquire_unlock_slot() is False
    for _ in range(held):
        release_unlock_slot()
    assert try_acquire_unlock_slot() is True
    release_unlock_slot()


def test_practice_row_and_shape_cache() -> None:
    from datetime import date, timedelta

    d = date.today() + timedelta(days=(6 - date.today().weekday()) % 7 or 7)
    out = create_practice_share(
        created_by_user_id="test-cache",
        parish_id=None,
        mass_date=d.isoformat(),
        mass_title="Cache Test",
        parish_name="Test",
        celebrant="Fr Test",
        songs=[
            {
                "slot_key": "entrance",
                "section": "entrance",
                "hymn_id": "t1",
                "title": "Test Song",
                "lyrics": "Verse 1\nHello\n\nChorus\nHi",
            }
        ],
        optional_pin="135790",
    )
    token = out["token"]
    row1 = get_practice_share_by_token(token)
    row2 = get_practice_share_by_token(token)
    assert row1 and row2
    assert row1["token"] == row2["token"]

    locked = fetch_practice_share(token, unlocked=False)
    assert locked.get("requires_pin") is True
    locked2 = fetch_practice_share(token, unlocked=False)
    assert locked2.get("requires_pin") is True

    ok = verify_practice_share_pin(token, "135790")
    assert ok.get("ok") is True
    assert ok.get("requires_pin") is not True
    unlocked = fetch_practice_share(token, unlocked=True)
    assert unlocked.get("requires_pin") is False
    assert unlocked.get("songs")

    invalidate_practice_cache(token)
    assert get_practice_share_by_token(token) is not None
