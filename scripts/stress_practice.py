#!/usr/bin/env python3
"""Stress-test choir practice viewing with N concurrent unlocked clients.

Creates a local practice share, then simulates choir members unlocking with a PIN
and polling GET /api/practice/{token} on the same cadence as the live page (4s).

Each virtual user sends a unique X-Forwarded-For so local middleware rate limits
(do not treat all clients as one NAT IP).

Usage (server must already be running on BASE_URL):

  .venv/bin/python scripts/stress_practice.py
  .venv/bin/python scripts/stress_practice.py --users 100 --duration 60
  .venv/bin/python scripts/stress_practice.py --base-url http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@dataclass
class Stats:
    statuses: Counter[int] = field(default_factory=Counter)
    latencies_ms: list[float] = field(default_factory=list)
    unlock_ok: int = 0
    unlock_fail: int = 0
    errors: Counter[str] = field(default_factory=Counter)

    def add_status(self, code: int, ms: float) -> None:
        self.statuses[code] += 1
        self.latencies_ms.append(ms)


def _create_share(pin: str) -> dict[str, Any]:
    from services.choir_practice_shares import create_practice_share

    mass_date = (date.today() + timedelta(days=(6 - date.today().weekday()) % 7)).isoformat()
    return create_practice_share(
        created_by_user_id=None,
        parish_id=None,
        mass_date=mass_date,
        mass_title="Stress test Mass",
        parish_name="Stress Parish",
        celebrant="",
        songs=[
            {
                "hymn_id": "stress_entrance",
                "title": "Stress Entrance",
                "lyrics": "Verse 1\nPraise the Lord\n\nChorus\nSing forever",
                "slot_key": "entrance",
                "slot_label": "Entrance",
                "section": "entrance",
            },
            {
                "hymn_id": "stress_communion",
                "title": "Stress Communion",
                "lyrics": "Verse\nBread of life\n\nChorus\nCome to the table",
                "slot_key": "communion_1",
                "slot_label": "Communion",
                "section": "communion",
            },
        ],
        optional_pin=pin,
    )


async def _unlock(
    session: Any,
    base_url: str,
    token: str,
    pin: str,
    fake_ip: str,
    stats: Stats,
) -> Optional[str]:
    url = f"{base_url.rstrip('/')}/api/practice/{token}/unlock"
    t0 = time.perf_counter()
    try:
        async with session.post(
            url,
            json={"pin": pin},
            headers={"X-Forwarded-For": fake_ip},
        ) as res:
            ms = (time.perf_counter() - t0) * 1000
            stats.add_status(res.status, ms)
            body = await res.json(content_type=None)
            if res.status >= 400 or not body.get("ok", True):
                stats.unlock_fail += 1
                stats.errors[f"unlock:{res.status}:{body.get('detail') or body.get('error') or '?'}"] += 1
                return None
            stats.unlock_ok += 1
            # Cookie is set on response; aiohttp jar keeps it per session.
            return "ok"
    except Exception as exc:
        stats.unlock_fail += 1
        stats.errors[f"unlock_exc:{type(exc).__name__}"] += 1
        return None


async def _poll_loop(
    session: Any,
    base_url: str,
    token: str,
    fake_ip: str,
    stats: Stats,
    duration_s: float,
    interval_s: float,
) -> None:
    url = f"{base_url.rstrip('/')}/api/practice/{token}"
    end = time.perf_counter() + duration_s
    while time.perf_counter() < end:
        t0 = time.perf_counter()
        try:
            async with session.get(url, headers={"X-Forwarded-For": fake_ip}) as res:
                ms = (time.perf_counter() - t0) * 1000
                stats.add_status(res.status, ms)
                if res.status >= 400:
                    body = await res.text()
                    snippet = (body or "")[:80].replace("\n", " ")
                    stats.errors[f"poll:{res.status}:{snippet}"] += 1
                else:
                    data = await res.json(content_type=None)
                    if data.get("requires_pin"):
                        stats.errors["poll:requires_pin"] += 1
        except Exception as exc:
            stats.errors[f"poll_exc:{type(exc).__name__}"] += 1
        await asyncio.sleep(interval_s)


async def _user(
    base_url: str,
    token: str,
    pin: str,
    user_id: int,
    stats: Stats,
    duration_s: float,
    interval_s: float,
    stagger_s: float,
) -> None:
    import aiohttp

    fake_ip = f"203.0.113.{(user_id % 250) + 1}"
    if user_id >= 250:
        fake_ip = f"198.51.100.{(user_id % 250) + 1}"
    await asyncio.sleep(stagger_s * user_id)
    timeout = aiohttp.ClientTimeout(total=30)
    jar = aiohttp.CookieJar(unsafe=True)
    async with aiohttp.ClientSession(timeout=timeout, cookie_jar=jar) as session:
        ok = await _unlock(session, base_url, token, pin, fake_ip, stats)
        if not ok:
            return
        await _poll_loop(session, base_url, token, fake_ip, stats, duration_s, interval_s)


def _pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(round((p / 100) * (len(ordered) - 1)))))
    return ordered[idx]


async def _run(args: argparse.Namespace) -> int:
    try:
        import aiohttp  # noqa: F401
    except ImportError:
        print("Missing dependency: aiohttp. Install with: .venv/bin/pip install aiohttp")
        return 2

    pin = args.pin
    print(f"Creating practice share (PIN {pin})…")
    created = _create_share(pin)
    token = str(created.get("token") or "")
    if not token:
        print("Failed to create practice share.")
        return 1
    print(f"Token: {token}")
    print(f"Users: {args.users}  duration: {args.duration}s  poll: every {args.interval}s")
    print(f"Target: {args.base_url}/api/practice/{token}")
    print("Running…")

    stats = Stats()
    t0 = time.perf_counter()
    await asyncio.gather(
        *[
            _user(
                args.base_url,
                token,
                pin,
                i,
                stats,
                args.duration,
                args.interval,
                args.stagger,
            )
            for i in range(args.users)
        ]
    )
    elapsed = time.perf_counter() - t0

    total = sum(stats.statuses.values())
    ok = stats.statuses.get(200, 0)
    limited = stats.statuses.get(429, 0)
    print("\n=== Choir practice stress result ===")
    print(f"Elapsed: {elapsed:.1f}s")
    print(f"Unlock ok/fail: {stats.unlock_ok}/{stats.unlock_fail}")
    print(f"HTTP totals: {total}  200={ok}  429={limited}  other={total - ok - limited}")
    print(f"Status breakdown: {dict(stats.statuses)}")
    if stats.latencies_ms:
        print(
            "Latency ms: "
            f"avg={statistics.mean(stats.latencies_ms):.1f} "
            f"p50={_pct(stats.latencies_ms, 50):.1f} "
            f"p95={_pct(stats.latencies_ms, 95):.1f} "
            f"p99={_pct(stats.latencies_ms, 99):.1f} "
            f"max={max(stats.latencies_ms):.1f}"
        )
    if stats.errors:
        print("Top errors:")
        for key, count in stats.errors.most_common(8):
            print(f"  {count}× {key}")
    rps = total / elapsed if elapsed else 0
    print(f"Approx RPS: {rps:.1f}")
    if limited:
        print("NOTE: saw 429s — middleware per-IP practice limit may still be binding.")
        return 1
    if stats.unlock_fail:
        print("NOTE: some unlocks failed.")
        return 1
    print("OK — no 429s; unlocks succeeded.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Stress-test choir practice viewing")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--users", type=int, default=100)
    parser.add_argument("--duration", type=float, default=60.0, help="Poll duration seconds per user")
    parser.add_argument("--interval", type=float, default=4.0, help="Poll interval seconds")
    parser.add_argument("--stagger", type=float, default=0.02, help="Start delay between users")
    parser.add_argument("--pin", default="246810", help="6-digit PIN for the generated share")
    args = parser.parse_args()
    pin = "".join(ch for ch in str(args.pin) if ch.isdigit())
    if len(pin) != 6:
        raise SystemExit("--pin must be 6 digits")
    args.pin = pin
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
