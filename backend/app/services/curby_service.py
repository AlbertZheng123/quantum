from __future__ import annotations

import hashlib
import os
from datetime import UTC, datetime
from typing import Any

import httpx

from app.models.schemas import EntropyPayload

DEFAULT_CURBY_RESULT_URL = "https://random.colorado.edu/api/curbyq/round/latest/result"


class CurbyService:
    """
    Fetches entropy for the session bootstrap.

    Defaults to CURBy's official latest complete round result endpoint and allows
    overriding that URL via CURBY_RANDOMNESS_URL for testing.
    """

    def __init__(self) -> None:
        self.randomness_url = os.getenv("CURBY_RANDOMNESS_URL", DEFAULT_CURBY_RESULT_URL).strip()
        self.timeout = float(os.getenv("CURBY_TIMEOUT_SECONDS", "6"))

    async def fetch_latest_entropy(self) -> EntropyPayload:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.randomness_url)
                response.raise_for_status()
            payload = response.json()
            round_id, seed_material = self._extract_payload(payload)
            return EntropyPayload(
                source="curby",
                round_id=round_id,
                seed_material=seed_material,
                fetched_at=datetime.now(UTC),
            )
        except Exception as exc:  # pragma: no cover - network failures are expected locally
            return self._fallback_entropy(
                f"Live CURBy fetch failed; using deterministic fallback seed. Detail: {exc}"
            )

    def _extract_payload(self, payload: dict[str, Any]) -> tuple[str, str]:
        result_payload = payload
        if isinstance(payload.get("data"), dict):
            result_payload = payload["data"]
        if isinstance(result_payload.get("content"), dict):
            result_payload = result_payload["content"]
        if isinstance(result_payload.get("payload"), dict):
            result_payload = result_payload["payload"]

        randomness_bytes = self._extract_randomness_bytes(result_payload.get("randomness"))
        round_candidates = [
            result_payload.get("round"),
            result_payload.get("roundId"),
            result_payload.get("id"),
            result_payload.get("pulse", {}).get("round") if isinstance(result_payload.get("pulse"), dict) else None,
            payload.get("round"),
            payload.get("roundId"),
        ]
        seed_candidates = [
            randomness_bytes,
            result_payload.get("randomness"),
            result_payload.get("signature"),
            result_payload.get("hash"),
            result_payload.get("pulse", {}).get("randomness") if isinstance(result_payload.get("pulse"), dict) else None,
            payload.get("signature"),
            payload.get("hash"),
        ]

        round_id = next((str(value) for value in round_candidates if value is not None), None)
        seed_material = next((str(value) for value in seed_candidates if value), None)

        if not round_id or not seed_material:
            canonical = hashlib.sha256(repr(payload).encode("utf-8")).hexdigest()
            return round_id or "unknown-round", canonical

        return round_id, seed_material

    def _extract_randomness_bytes(self, randomness: Any) -> str | None:
        if isinstance(randomness, str):
            return randomness
        if isinstance(randomness, dict):
            slash_value = randomness.get("/")
            if isinstance(slash_value, dict):
                bytes_value = slash_value.get("bytes")
                if bytes_value:
                    return str(bytes_value)
            bytes_value = randomness.get("bytes")
            if bytes_value:
                return str(bytes_value)
        return None

    def _fallback_entropy(self, warning: str) -> EntropyPayload:
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        seed_material = hashlib.sha256(f"quantum-fallback:{today}".encode("utf-8")).hexdigest()
        return EntropyPayload(
            source="fallback",
            round_id=f"fallback-{today}",
            seed_material=seed_material,
            fetched_at=datetime.now(UTC),
            warning=warning,
        )
