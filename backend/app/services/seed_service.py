from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import TypeVar

T = TypeVar("T")


def derive_hex(seed: str, label: str) -> str:
    return hashlib.sha256(f"{seed}:{label}".encode("utf-8")).hexdigest()


def derive_int(seed: str, label: str, minimum: int, maximum: int) -> int:
    if minimum > maximum:
        raise ValueError("minimum must not exceed maximum")
    digest = derive_hex(seed, label)
    span = maximum - minimum + 1
    return minimum + (int(digest[:12], 16) % span)


def derive_choice(seed: str, label: str, choices: list[T]) -> T:
    if not choices:
        raise ValueError("choices must not be empty")
    index = derive_int(seed, label, 0, len(choices) - 1)
    return choices[index]


@dataclass(frozen=True)
class SeedSnapshot:
    entropy_seed: str
    starting_controller: str
    starting_chaos: int
    initial_phase: str


def build_session_seed(seed_material: str, session_id: str) -> SeedSnapshot:
    entropy_seed = derive_hex(seed_material, f"session:{session_id}")
    starting_controller = derive_choice(entropy_seed, "controller", ["ruin", "solace"])
    starting_chaos = derive_int(entropy_seed, "starting-chaos", 35, 45)
    initial_phase = derive_choice(
        entropy_seed,
        f"initial-phase:{starting_controller}",
        ["ruin_orbs", "ruin_beams"] if starting_controller == "ruin" else ["solace_nodes", "solace_shards"],
    )
    return SeedSnapshot(
        entropy_seed=entropy_seed,
        starting_controller=starting_controller,
        starting_chaos=starting_chaos,
        initial_phase=initial_phase,
    )
