import { NextResponse } from "next/server";
import { evaluateSingleFact } from "@/lib/evaluator";
import { formatErrorForClient } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const { fact, evaluator } = await request.json();

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
