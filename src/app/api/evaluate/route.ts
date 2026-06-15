import { NextResponse } from "next/server";
import { evaluateFacts, evaluateFactsStream } from "@/lib/evaluator";
import { formatErrorForClient } from "@/lib/api-errors";
import { normalizeEvaluatorId } from "@/lib/evaluators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;
export const preferredRegion = ["iad1", "sfo1", "cle1"];

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function readRequestPayload(request: Request) {
  if (request.signal.aborted) {
    return null;
  }

  const raw = await request.text();
  if (!raw.trim()) {
    return null;
  }

  return JSON.parse(raw) as {
    facts?: unknown;
    evaluator?: string;
    stream?: boolean;
  };
}

export async function POST(request: Request) {
  try {
    let payload: Awaited<ReturnType<typeof readRequestPayload>>;
    try {
      payload = await readRequestPayload(request);
    } catch {
      return NextResponse.json(
        { error: { code: "unknown", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }

    if (!payload) {
      // Client aborted or disconnected before the body arrived — not a Groq failure.
      return new Response(null, { status: 499 });
    }

    const { facts, evaluator: rawEvaluator, stream } = payload;
    const evaluator = normalizeEvaluatorId(rawEvaluator);

    if (!facts || !Array.isArray(facts)) {
      return NextResponse.json(
        { error: { code: "unknown", message: "facts is required and must be an array." } },
        { status: 400 },
      );
    }

    if (stream) {
      const encoder = new TextEncoder();
      let closed = false;

      const readable = new ReadableStream({
        cancel() {
          closed = true;
        },
        async start(controller) {
          const safeEnqueue = (chunk: string): boolean => {
            if (closed || request.signal.aborted) {
              closed = true;
              return false;
            }
            try {
              controller.enqueue(encoder.encode(chunk));
              return true;
            } catch {
              closed = true;
              return false;
            }
          };

          const safeClose = () => {
            if (closed) return;
            closed = true;
            try {
              controller.close();
            } catch {
              /* already closed by client disconnect */
            }
          };

          try {
            for await (const event of evaluateFactsStream(
              facts,
              evaluator,
              request.signal,
            )) {
              if (!safeEnqueue(`${JSON.stringify(event)}\n`)) {
                break;
              }
            }
          } catch (error) {
            if (isAbortError(error) || request.signal.aborted) {
              return;
            }
            console.error("Error in /api/evaluate stream:", error);
            const formatted = formatErrorForClient(error);
            safeEnqueue(`${JSON.stringify({ type: "fatal", error: formatted })}\n`);
          } finally {
            safeClose();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const result = await evaluateFacts(facts, evaluator);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in /api/evaluate:", error);
    const formatted = formatErrorForClient(error);
    return NextResponse.json(
      { error: formatted, facts: [], errors: [], usingFallback: false },
      { status: formatted.status ?? 500 },
    );
  }
}
