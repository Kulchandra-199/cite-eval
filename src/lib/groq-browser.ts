import { parseProviderError } from "@/lib/api-errors";
import { GroqEvaluationResult, buildEvaluationPrompt } from "@/lib/groq";
import { EvaluatorModelId, VerdictType } from "@/lib/types";
import { DEFAULT_EVALUATOR } from "@/lib/evaluators";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const BROWSER_GROQ_TIMEOUT_MS = 25_000;

const JSON_OBJECT_SYSTEM_PROMPT = `You are a professional citation verification engine. Compare extracted claims against ground-truth source text.

Respond with a single JSON object only (no markdown), using exactly this shape:
{
  "verdict": "PASS" | "FAIL" | "NOT_SURE",
  "issue": "NUMBER_MISMATCH" | "CLAIM_NOT_SUPPORTED" | "WRONG_PAGE" | "CITATION_NOT_FOUND" | "OTHER" | "NONE",
  "reason": "brief explanation",
  "evidence_text": "quote from ground truth"
}

Use PASS when fully supported, FAIL when clearly wrong, NOT_SURE when evidence is insufficient. Use issue "NONE" when verdict is PASS or NOT_SURE.`;

function normalizeVerdict(verdict: string | undefined): VerdictType {
  if (verdict === "PASS" || verdict === "FAIL" || verdict === "NOT_SURE") {
    return verdict;
  }
  return "NOT_SURE";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatBrowserFactResult(
  fact: any,
  factId: string,
  evaluation: GroqEvaluationResult,
) {
  return {
    id: factId,
    fact: String(fact.fact ?? ""),
    verdict: normalizeVerdict(evaluation.verdict),
    issue: evaluation.issue === "NONE" ? null : evaluation.issue,
    reason: evaluation.reason || "Evaluation completed.",
    evidence_page: fact.page_no ?? null,
    evidence_text:
      evaluation.evidence_text ||
      fact.exact_paragraph ||
      fact.evidence_text ||
      "Segment evaluated.",
    source_url: fact.source_url || "",
    publisher: fact.publisher || "Reference Source",
    year: fact.year || "2026",
    page_no: fact.page_no ?? null,
    citation_url: fact.citation_url || "",
    review_status: "PENDING",
    reviewer_notes: fact.reviewer_notes || "",
  };
}

export async function evaluateFactWithBrowserGroq(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fact: any,
  apiKey: string,
  model: EvaluatorModelId = DEFAULT_EVALUATOR,
): Promise<GroqEvaluationResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), BROWSER_GROQ_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: JSON_OBJECT_SYSTEM_PROMPT },
          { role: "user", content: buildEvaluationPrompt(fact) },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    if (!response.ok) {
      throw {
        status: response.status,
        message: payload.error?.message,
        code: payload.error?.code,
        headers: response.headers,
        error: payload.error,
      };
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq returned an empty response.");
    }

    try {
      return JSON.parse(content) as GroqEvaluationResult;
    } catch {
      throw new Error("Groq returned invalid JSON.");
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw parseProviderError(
        new Error("Groq request timed out in the browser."),
      );
    }
    throw parseProviderError(err);
  } finally {
    window.clearTimeout(timeout);
  }
}
