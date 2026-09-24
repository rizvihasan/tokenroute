from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    conversation_id: str = Field(default="default", max_length=128)
    messages: list[ChatMessage] = Field(min_length=1)
    use_rag: bool = True
    use_cache: bool = True
    force_lane: Literal["local", "cloud"] | None = None


class IngestRequest(BaseModel):
    doc_id: str = Field(min_length=1, max_length=256)
    text: str = Field(min_length=1)
    metadata: dict = Field(default_factory=dict)


class EvalRequest(BaseModel):
    lane: Literal["local", "cloud"] = "local"


class JobStatus(BaseModel):
    job_id: str
    status: str
    result: dict | None = None
