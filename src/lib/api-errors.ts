export type EvaluationErrorCode =
  | "rate_limit"
  | "auth"
  | "network"
  | "parse"
  | "api_error"
  | "unknown";

export interface EvaluationIssue {
  factId: string;
  code: EvaluationErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export class EvaluationApiError extends Error {
  code: EvaluationErrorCode;
  retryAfterSeconds?: number;
  status?: number;

  constructor(
    message: string,
    code: EvaluationErrorCode = "unknown",
    options?: { retryAfterSeconds?: number; status?: number },
  ) {
    super(message);
    this.name = "EvaluationApiError";
    this.code = code;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.status = options?.status;
  }
}

function readRetryAfterSeconds(headers: Headers | undefined): number | undefined {
  if (!headers) return undefined;
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

/** Normalize OpenAI SDK / Groq errors into a consistent shape. */
export function parseProviderError(err: unknown): EvaluationApiError {
  if (err instanceof EvaluationApiError) return err;

  const apiErr = err as {
    status?: number;
    message?: string;
    code?: string;
    error?: { message?: string; code?: string; type?: string };
    headers?: Headers;
  };

  const status = apiErr.status;
  const message =
    apiErr.error?.message ||
    apiErr.message ||
    (err instanceof Error ? err.message : "Unknown evaluation error");

  const retryAfterSeconds = readRetryAfterSeconds(apiErr.headers);

  if (status === 429 || apiErr.code === "rate_limit_exceeded") {
    return new EvaluationApiError(
      message.includes("Rate limit")
        ? message
        : `Groq rate limit reached. Try again${retryAfterSeconds ? ` in ${retryAfterSeconds}s` : " shortly"}.`,
      "rate_limit",
      { retryAfterSeconds, status },
    );
  }

  if (status === 401 || status === 403) {
    return new EvaluationApiError(
      "Invalid or missing Groq API key. Check GROQ_API_KEY in .env.local.",
      "auth",
      { status },
    );
  }

  if (status && status >= 500) {
    return new EvaluationApiError(message, "api_error", { status });
  }

  return new EvaluationApiError(message, "unknown", { status });
}

export function toEvaluationIssue(
  factId: string,
  err: unknown,
): EvaluationIssue {
  const parsed = parseProviderError(err);
  return {
    factId,
    code: parsed.code,
    message: parsed.message,
    retryAfterSeconds: parsed.retryAfterSeconds,
  };
}

export function formatErrorForClient(err: unknown): {
  code: EvaluationErrorCode;
  message: string;
  retryAfterSeconds?: number;
  status?: number;
} {
  const parsed = parseProviderError(err);
  return {
    code: parsed.code,
    message: parsed.message,
    retryAfterSeconds: parsed.retryAfterSeconds,
    status: parsed.status,
  };
}
