import OpenAI from "openai";
import { parseProviderError } from "@/lib/api-errors";
import { GROQ_MIN_INTERVAL_MS } from "@/lib/evaluation-config";
import { EvaluatorModelId } from "@/lib/types";
import { DEFAULT_EVALUATOR } from "@/lib/evaluators";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TIMEOUT_MS = process.env.VERCEL ? 8_000 : 20_000;
const MAX_RETRIES = 4;
const VERCEL_FAST_MODEL: EvaluatorModelId = "llama-3.1-8b-instant";

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

type GroqResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict: boolean;
        schema: typeof EVALUATION_SCHEMA;
      };
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
let groqQueue: Promise<void> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serialize Groq calls with spacing to respect RPM limits. */
async function runThroughGroqQueue<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const slot = new Promise<void>((resolve) => {
    release = resolve;
  });

  const previous = groqQueue;
  groqQueue = previous.then(() => slot);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    groqQueue = groqQueue.then(() => sleep(GROQ_MIN_INTERVAL_MS)).then(() => undefined);
  }
}

export function getGroqClient(): OpenAI | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (groqClient) return groqClient;
  groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: GROQ_TIMEOUT_MS,
    maxRetries: 0,
  });
  return groqClient;
}

function buildResponseFormat(model: string): GroqResponseFormat {
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

async function requestGroqCompletion(
  model: EvaluatorModelId,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw parseProviderError(new Error("GROQ_API_KEY is not configured."));
  }

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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: buildResponseFormat(model),
    }),
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string; type?: string };
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

  return content;
}

export async function evaluateWithGroq(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fact: any,
  model: EvaluatorModelId = DEFAULT_EVALUATOR,
): Promise<GroqEvaluationResult> {
  if (!process.env.GROQ_API_KEY) {
    throw parseProviderError(new Error("GROQ_API_KEY is not configured."));
  }

  const resolvedModel = resolveGroqModelForServer(model);

  const usesJsonObject =
    !JSON_SCHEMA_STRICT_MODELS.has(resolvedModel) &&
    !JSON_SCHEMA_BEST_EFFORT_MODELS.has(resolvedModel);

  const systemPrompt = usesJsonObject
    ? JSON_OBJECT_SYSTEM_PROMPT
    : "You are a professional citation verification engine. Compare extracted claims against ground-truth source text. Return only schema-valid JSON.";

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await runThroughGroqQueue(async () => {
        const content = await requestGroqCompletion(
          resolvedModel,
          systemPrompt,
          buildEvaluationPrompt(fact),
        );

        try {
          return JSON.parse(content) as GroqEvaluationResult;
        } catch {
          throw new Error("Groq returned invalid JSON.");
        }
      });
    } catch (err) {
      lastError = err;
      const parsed = parseProviderError(err);

      if (parsed.code === "rate_limit" && attempt < MAX_RETRIES) {
        const waitMs =
          (parsed.retryAfterSeconds ?? 2) * 1000 + attempt * 500;
        await sleep(waitMs);
        continue;
      }

      throw parsed;
    }
  }

  throw parseProviderError(lastError);
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

/** On Vercel Hobby, large models exceed the 10s function cap — use a fast model. */
export function resolveGroqModelForServer(
  requested: EvaluatorModelId = DEFAULT_EVALUATOR,
): EvaluatorModelId {
  if (!process.env.VERCEL) return requested;
  if (
    requested === "llama-3.3-70b-versatile" ||
    requested === "openai/gpt-oss-20b"
  ) {
    return VERCEL_FAST_MODEL;
  }
  return requested;
}
