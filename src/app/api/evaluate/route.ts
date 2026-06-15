import { NextResponse } from "next/server";
import { evaluateFacts, evaluateFactsStream } from "@/lib/evaluator";
import { formatErrorForClient } from "@/lib/api-errors";

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
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of evaluateFactsStream(facts, evaluator)) {
              controller.enqueue(
                encoder.encode(`${JSON.stringify(event)}\n`),
              );
            }
          } catch (error) {
            console.error("Error in /api/evaluate stream:", error);
            const formatted = formatErrorForClient(error);
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({ type: "fatal", error: formatted })}\n`,
              ),
            );
          } finally {
            controller.close();
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
