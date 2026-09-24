from app.services.routing import choose_lane


def test_short_prompt_stays_local():
    lane, reason = choose_lane("what is the cache threshold?")
    assert lane == "local"


def test_long_prompt_goes_cloud():
    lane, _ = choose_lane(" ".join(["word"] * 300))
    assert lane == "cloud"


def test_reasoning_marker_goes_cloud():
    lane, _ = choose_lane("Walk me through this step by step: how does the cache work?")
    assert lane == "cloud"


def test_large_rag_context_escalates():
    lane, reason = choose_lane("short question", rag_context_tokens=900)
    assert lane == "cloud"
    assert "context" in reason


def test_code_workload_escalates_only_when_nontrivial():
    assert choose_lane("what does def mean in python?")[0] == "local"
    big_code = "```python\n" + "\n".join(f"def f{i}(): pass" for i in range(40)) + "\n```"
    assert choose_lane(big_code)[0] == "cloud"
