import { NextResponse } from "next/server";
import { evaluateSingleFact } from "@/lib/evaluator";

export async function POST(request: Request) {
  try {
    const { fact, evaluator } = await request.json();

    if (!fact) {
      return NextResponse.json(
        { error: "fact object is required." },
        { status: 400 },
      );
    }

    const result = await evaluateSingleFact(fact, evaluator);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in /api/evaluate-single:", error);
    return NextResponse.json(
      { error: "Single fact evaluation failed" },
      { status: 500 },
    );
  }
}
