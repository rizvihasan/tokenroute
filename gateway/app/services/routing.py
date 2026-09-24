"""Lane selection: decide whether a query goes to the local model or the cloud.

The heuristic is deliberately simple and inspectable. Cheap, short, or
retrieval-grounded prompts stay on the quantized local model; long or
reasoning-heavy prompts escalate. LiteLLM's router-level fallbacks cover the
failure case (local down / timeout) independently of this choice.
"""

from __future__ import annotations

_REASONING_MARKERS = (
    "step by step",
    "prove",
    "derive",
    "why does",
    "explain the tradeoff",
    "compare and contrast",
    "design a system",
    "architect",
    "debug",
    "stack trace",
    "traceback",
)

_CODE_MARKERS = ("```", "def ", "class ", "SELECT ", "import ", "function ")


def choose_lane(prompt: str, rag_context_tokens: int = 0) -> tuple[str, str]:
    """Return (lane, reason). Lane is 'local' or 'cloud'."""
    words = len(prompt.split())
    lowered = prompt.lower()

    if words > 220:
        return "cloud", "prompt too long for comfortable local context"
    if any(m in lowered for m in _REASONING_MARKERS):
        return "cloud", "reasoning marker matched"
    if any(m in prompt for m in _CODE_MARKERS) and words > 60:
        return "cloud", "code workload beyond trivial size"
    if rag_context_tokens > 600:
        return "cloud", "large retrieved context"
    return "local", "default: cheap lane"
