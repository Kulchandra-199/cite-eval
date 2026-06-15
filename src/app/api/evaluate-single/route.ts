import { NextResponse } from "next/server";
import { evaluateSingleFact } from "@/lib/evaluator";
import { formatErrorForClient } from "@/lib/api-errors";
import { normalizeEvaluatorId } from "@/lib/evaluators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;
export const preferredRegion = ["iad1", "sfo1", "cle1"];

export async function POST(request: Request) {
  try {
    const { fact, evaluator: rawEvaluator } = await request.json();
    const evaluator = normalizeEvaluatorId(rawEvaluator);

    if (!fact) {
      return NextResponse.json(
        { error: { code: "unknown", message: "fact object is required." } },
        { status: 400 },
      );
    }

    const result = await evaluateSingleFact(fact, evaluator);

    if (result.errors.length > 0) {
      return NextResponse.json(result, { status: 503 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in /api/evaluate-single:", error);
    const formatted = formatErrorForClient(error);
    return NextResponse.json({ error: formatted }, { status: formatted.status ?? 500 });
  }
}
