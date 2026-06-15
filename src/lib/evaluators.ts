import { EvaluatorModelId } from "@/lib/types";

export interface EvaluatorOption {
  id: EvaluatorModelId;
  label: string;
  description: string;
  recommended?: boolean;
}

export const EVALUATOR_OPTIONS: EvaluatorOption[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    description: "Fast general-purpose verification via Groq",
    recommended: true,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Strict structured JSON output via Groq",
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    description: "Structured output, best for nuanced claims",
  },
];

export const DEFAULT_EVALUATOR: EvaluatorModelId = "llama-3.3-70b-versatile";

/** Map legacy AI Studio labels stored in localStorage to real Groq model IDs */
const LEGACY_EVALUATOR_MAP: Record<string, EvaluatorModelId> = {
  Gemini: "llama-3.3-70b-versatile",
  "GPT-5.5": "openai/gpt-oss-20b",
  Claude: "meta-llama/llama-4-scout-17b-16e-instruct",
  "Custom Evaluator": "llama-3.3-70b-versatile",
};

export function normalizeEvaluatorId(value: string | null | undefined): EvaluatorModelId {
  if (!value) return DEFAULT_EVALUATOR;
  if (EVALUATOR_OPTIONS.some((o) => o.id === value)) {
    return value as EvaluatorModelId;
  }
  return LEGACY_EVALUATOR_MAP[value] ?? DEFAULT_EVALUATOR;
}

export function getEvaluatorLabel(id: string): string {
  const option = EVALUATOR_OPTIONS.find((o) => o.id === id);
  if (option) return option.label;
  return LEGACY_EVALUATOR_MAP[id] ? getEvaluatorLabel(LEGACY_EVALUATOR_MAP[id]) : id;
}

export function getEvaluatorOption(id: EvaluatorModelId): EvaluatorOption {
  return EVALUATOR_OPTIONS.find((o) => o.id === id) ?? EVALUATOR_OPTIONS[0];
}
