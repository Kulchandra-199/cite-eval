import { EvaluationStreamEvent } from "@/lib/evaluation-config";

export async function readEvaluationStream(
  response: Response,
  onEvent: (event: EvaluationStreamEvent) => void,
  signal?: AbortSignal,
) {
  if (!response.body) {
    throw new Error("No response body from evaluation server.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Evaluation aborted.", "AbortError");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as EvaluationStreamEvent);
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as EvaluationStreamEvent);
  }
}
