const BROWSER_GROQ_KEY = "CITATE_EVAL_BROWSER_GROQ_KEY";
const API_URL_KEY = "CITATE_EVAL_API_URL";

export function getBrowserGroqApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem(BROWSER_GROQ_KEY)?.trim();
  return key || null;
}

export function setBrowserGroqApiKey(key: string) {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(BROWSER_GROQ_KEY, trimmed);
  } else {
    localStorage.removeItem(BROWSER_GROQ_KEY);
  }
}

/** Override server evaluate URL (e.g. local `npm run dev` or Railway proxy). */
export function getEvaluationApiUrl(): string {
  if (typeof window === "undefined") return "/api/evaluate";
  const custom = localStorage.getItem(API_URL_KEY)?.trim();
  return custom || "/api/evaluate";
}

export function setEvaluationApiUrl(url: string) {
  if (typeof window === "undefined") return;
  const trimmed = url.trim();
  if (trimmed) {
    localStorage.setItem(API_URL_KEY, trimmed);
  } else {
    localStorage.removeItem(API_URL_KEY);
  }
}

export function shouldUseBrowserGroq(): boolean {
  return Boolean(getBrowserGroqApiKey());
}
