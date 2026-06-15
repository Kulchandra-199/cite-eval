/** Facts sent per /api/evaluate request from the client. Keep small for Vercel serverless timeouts. */
export const CLIENT_BATCH_SIZE = 2;

/** Max parallel Groq calls within one server batch. */
export const SERVER_BATCH_CONCURRENCY = 2;

/** Minimum gap between Groq API calls (30 RPM ≈ 1 req / 2s). */
export const GROQ_MIN_INTERVAL_MS = 1200;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface EvaluationIssuePayload {
  factId: string;
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

export type EvaluationStreamEvent =
  | {
      type: "meta";
      provider: "groq" | "gemini" | "offline";
      total: number;
    }
  | {
      type: "fact";
      index: number;
      fact: Record<string, unknown>;
      error: EvaluationIssuePayload | null;
    }
  | {
      type: "done";
      usingFallback: boolean;
      provider: "groq" | "gemini" | "offline";
      errors: EvaluationIssuePayload[];
    }
  | {
      type: "fatal";
      error: { code: string; message: string; retryAfterSeconds?: number };
    };
