export type SSEEvent =
  | { type: "meta"; data: MetaEvent }
  | { type: "token"; data: { token: string } }
  | { type: "done"; data: DoneEvent }
  | { type: "error"; data: { message: string } };

export interface MetaEvent {
  cached: boolean;
  lane: "local" | "cloud" | "cache";
  model: string;
  route_reason?: string;
  similarity?: number;
  contexts?: { doc_id: string; score: number }[];
}

export interface DoneEvent {
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  tokens_per_sec?: number;
  ttft_ms: number | null;
  elapsed_s?: number;
}

/** Parse an SSE stream from the gateway into typed events. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        yield { type: eventName, data: JSON.parse(data) } as SSEEvent;
      } catch {
        // skip malformed frames; the stream continues
      }
      eventName = "message";
    }
  }
}
