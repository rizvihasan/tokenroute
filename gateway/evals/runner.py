"""Golden-set evaluation: run each question through the real RAG + lane
pipeline, then score answers with Ragas. Imported lazily by the worker so the
heavy ragas/langchain deps never load in the API process."""

from __future__ import annotations

import json
from pathlib import Path

from ..app.config import get_settings
from ..app.services import db, llm

GOLDEN_PATH = Path(__file__).parent / "golden.jsonl"


def load_golden() -> list[dict]:
    with GOLDEN_PATH.open() as f:
        return [json.loads(line) for line in f if line.strip()]


async def run_golden_set(lane: str = "local") -> dict:
    settings = get_settings()
    model_alias = settings.lane_local_alias if lane == "local" else settings.lane_cloud_alias

    items = load_golden()
    questions, answers, contexts, truths = [], [], [], []

    await db.init_schema()
    for item in items:
        [qvec] = await llm.embed([item["question"]])
        hits = await db.search(qvec, settings.rag_top_k)
        ctx = [h["content"] for h in hits]
        prompt = [
            {
                "role": "system",
                "content": "Answer using only the context below. If the context "
                "is insufficient, say so.\n\n" + "\n\n".join(ctx),
            },
            {"role": "user", "content": item["question"]},
        ]
        resp = await llm.complete_chat(prompt, model_alias)
        questions.append(item["question"])
        answers.append(resp["choices"][0]["message"]["content"])
        contexts.append(ctx)
        truths.append(item["ground_truth"])

    from datasets import Dataset
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas import evaluate
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import answer_relevancy, context_precision, faithfulness

    judge_llm = LangchainLLMWrapper(
        ChatOpenAI(
            model=settings.chat_cloud_model,
            base_url=settings.chat_cloud_base_url,
            api_key=settings.chat_cloud_api_key or settings.groq_api_key,
        )
    )
    judge_embed = LangchainEmbeddingsWrapper(
        OpenAIEmbeddings(
            model=settings.embed_model,
            base_url=settings.embed_base_url,
            api_key=settings.embed_api_key or settings.jina_api_key,
        )
    )

    dataset = Dataset.from_dict(
        {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
            "ground_truth": truths,
        }
    )
    scores = evaluate(
        dataset,
        metrics=[faithfulness, answer_relevancy, context_precision],
        llm=judge_llm,
        embeddings=judge_embed,
    )
    return {"lane": lane, "n": len(items), "scores": dict(scores)}
