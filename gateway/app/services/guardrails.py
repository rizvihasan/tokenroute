"""Gateway-native guardrails: input injection filters + output PII redaction.

Runs inside the gateway, so every tenant/model/lane gets the same policy.
GUARDRAILS_MODE: off (default, self-host) | log (allow + record) | block.
The console shows blocked/logged requests under status="guardrail".

Patterns are deliberately high-precision: a false positive in a gateway is a
broken product, a false negative is a logged review item.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from ..config import get_settings

# prompt injection / jailbreak attempts (case-insensitive)
_INPUT_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("ignore_instructions", re.compile(
        r"ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules|directions)", re.I)),
    ("reveal_system_prompt", re.compile(
        r"(reveal|show|print|repeat|leak|display)\s+(me\s+)?(your|the)\s+(system\s+prompt|instructions|initial\s+prompt)", re.I)),
    ("jailbreak_dan", re.compile(r"\bDAN\b\s+(mode|jailbreak)|do\s+anything\s+now", re.I)),
    ("act_as_unrestricted", re.compile(
        r"act\s+as\s+(an?\s+)?(unrestricted|uncensored|jailbroken|evil)\s+(ai|assistant|model|llm)", re.I)),
]

# payment card numbers: 13-19 digits with separators, Luhn-checked
_CARD_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")
# basic email/phone shapes (used in block mode redaction only)
_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")


@dataclass
class Hit:
    rule: str
    snippet: str


def _luhn_ok(digits: str) -> bool:
    ds = [int(c) for c in digits if c.isdigit()]
    if not (13 <= len(ds) <= 19):
        return False
    total = 0
    for i, d in enumerate(reversed(ds)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def check_input(text: str) -> Hit | None:
    """Return the first injection hit in a user prompt, or None."""
    for rule, pat in _INPUT_PATTERNS:
        m = pat.search(text)
        if m:
            return Hit(rule=rule, snippet=m.group(0)[:80])
    return None


def redact_output(text: str) -> tuple[str, list[str]]:
    """Redact high-confidence PII from a completed (non-streamed) response.
    Returns (text, applied_rules). Streaming responses pass through untouched:
    redaction across token boundaries needs a buffering layer."""
    rules: list[str] = []

    def _card_sub(m: re.Match) -> str:
        if _luhn_ok(m.group(0)):
            rules.append("card_number")
            return "[REDACTED-CARD]"
        return m.group(0)

    text = _CARD_RE.sub(_card_sub, text)
    return text, sorted(set(rules))


def mode() -> str:
    return (getattr(get_settings(), "guardrails_mode", "off") or "off").lower()
