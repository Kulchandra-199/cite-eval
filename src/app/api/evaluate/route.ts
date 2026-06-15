import { NextResponse } from "next/server";
import { evaluateFacts } from "@/lib/evaluator";

export async function POST(request: Request) {
  try {
    const { facts, evaluator } = await request.json();

    if (!facts || !Array.isArray(facts)) {
      return NextResponse.json(
        { error: "facts is required and must be an array." },
        { status: 400 },
      );
    }

    const result = await evaluateFacts(facts, evaluator);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in /api/evaluate:", error);
    return NextResponse.json(
      { error: "Evaluation failed" },
      { status: 500 },
    );
  }
}
