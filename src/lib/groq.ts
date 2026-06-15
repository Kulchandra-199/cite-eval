import OpenAI from "openai";
import { EvaluatorModelId } from "@/lib/types";
import { DEFAULT_EVALUATOR } from "@/lib/evaluators";

const EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["PASS", "FAIL", "NOT_SURE"] },
    issue: {
      type: "string",
      enum: [
        "NUMBER_MISMATCH",
        "CLAIM_NOT_SUPPORTED",
        "WRONG_PAGE",
        "CITATION_NOT_FOUND",
        "OTHER",
        "NONE",
      ],
    },
    reason: { type: "string" },
    evidence_text: { type: "string" },
  },
  required: ["verdict", "issue", "reason", "evidence_text"],
  additionalProperties: false,
};

const JSON_SCHEMA_STRICT_MODELS = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
]);

const JSON_SCHEMA_BEST_EFFORT_MODELS = new Set([
  "openai/gpt-oss-safeguard-20b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
]);

const JSON_OBJECT_SYSTEM_PROMPT = `You are a professional citation verification engine. Compare extracted claims against ground-truth source text.

Respond with a single JSON object only (no markdown), using exactly this shape:
{
  "verdict": "PASS" | "FAIL" | "NOT_SURE",
  "issue": "NUMBER_MISMATCH" | "CLAIM_NOT_SUPPORTED" | "WRONG_PAGE" | "CITATION_NOT_FOUND" | "OTHER" | "NONE",
  "reason": "brief explanation",
  "evidence_text": "quote from ground truth"
}

Use PASS when fully supported, FAIL when clearly wrong, NOT_SURE when evidence is insufficient. Use issue "NONE" when verdict is PASS or NOT_SURE.`;

let groqClient: OpenAI | null = null;

export function getGroqClient(): OpenAI | null {
  if (groqClient) return groqClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  groqClient = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return groqClient;
}

function buildResponseFormat(model: string): OpenAI.ChatCompletionCreateParams["response_format"] {
  if (JSON_SCHEMA_STRICT_MODELS.has(model)) {
    return {
      type: "json_schema",
      json_schema: {
        name: "citation_evaluation",
        strict: true,
        schema: EVALUATION_SCHEMA,
      },
    };
  }

  if (JSON_SCHEMA_BEST_EFFORT_MODELS.has(model)) {
    return {
      type: "json_schema",
      json_schema: {
        name: "citation_evaluation",
        strict: false,
        schema: EVALUATION_SCHEMA,
      },
    };
  }

  return { type: "json_object" };
}

export interface GroqEvaluationResult {
  verdict: "PASS" | "FAIL" | "NOT_SURE";
  issue: string | null;
  reason: string;
  evidence_text: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEvaluationPrompt(fact: any): string {
  return `CLAIM (The fact to verify): "${fact.fact}"
GROUND TRUTH SEGMENT: "${fact.exact_paragraph || fact.evidence_text || "No exact paragraph context given"}"
CITATION LINK: "${fact.citation_url || fact.source_url || "N/A"}"
PUBLISHER: "${fact.publisher || "N/A"}"
YEAR: "${fact.year || "N/A"}"
PAGE: "${fact.page_no ?? "N/A"}"

Evaluate whether the CLAIM is fully supported by the GROUND TRUTH SEGMENT. Use PASS when fully supported, FAIL when clearly contradicted or unsupported, and NOT_SURE when the ground truth is missing, ambiguous, or insufficient to decide.`;
}

export async function evaluateWithGroq(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fact: any,
  model: EvaluatorModelId = DEFAULT_EVALUATOR,
): Promise<GroqEvaluationResult | null> {
  const client = getGroqClient();
  if (!client) return null;

  const usesJsonObject =
    !JSON_SCHEMA_STRICT_MODELS.has(model) &&
    !JSON_SCHEMA_BEST_EFFORT_MODELS.has(model);

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: usesJsonObject
          ? JSON_OBJECT_SYSTEM_PROMPT
          : "You are a professional citation verification engine. Compare extracted claims against ground-truth source text. Return only schema-valid JSON.",
      },
      { role: "user", content: buildEvaluationPrompt(fact) },
    ],
    response_format: buildResponseFormat(model),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  return JSON.parse(content) as GroqEvaluationResult;
}

export function normalizeGroqIssue(issue: string | null): string | null {
  if (!issue || issue === "NONE") return null;
  return issue;
}

export function getActiveProvider(): "groq" | "gemini" | "offline" {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "offline";
}
