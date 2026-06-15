import { NextResponse } from "next/server";
import { evaluateFacts, evaluateFactsStream } from "@/lib/evaluator";
import { formatErrorForClient } from "@/lib/api-errors";

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export async function POST(request: Request) {
  try {
    const { facts, evaluator, stream } = await request.json();

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
