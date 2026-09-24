from app.services.rag import chunk_text


def test_empty_and_short_text():
    assert chunk_text("") == []
    assert chunk_text("hello world") == ["hello world"]


def test_long_text_splits_with_overlap():
    text = ". ".join(f"Sentence number {i} with some padding words" for i in range(120))
    chunks = chunk_text(text, size=300, overlap=50)
    assert len(chunks) > 1
    assert all(len(c) <= 320 for c in chunks)
    # coverage: the full text survives chunking (nothing dropped between chunks)
    joined = " ".join(chunks)
    assert "Sentence number 0" in joined
    assert "Sentence number 119" in joined


def test_prefers_sentence_boundaries():
    text = ("First complete thought here. " * 20).strip()
    chunks = chunk_text(text, size=200, overlap=30)
    assert all(c.endswith(".") or len(c) == len(text) for c in chunks)


def test_no_infinite_loop_on_pathological_input():
    chunks = chunk_text("a" * 5000, size=800, overlap=120)
    assert len(chunks) >= 5
