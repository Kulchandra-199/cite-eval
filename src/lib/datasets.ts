export const CUSTOM_DATASETS_KEY = "CITATION_CUSTOM_DATASETS";

export interface SavedDataset {
  id: string;
  name: string;
  description: string;
  publisher: string;
  year: string;
  factsCount: number;
  facts: Record<string, unknown>[];
  isCustom?: boolean;
}

export function loadCustomDatasets(): SavedDataset[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CUSTOM_DATASETS_KEY);
    if (stored) return JSON.parse(stored) as SavedDataset[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveCustomDatasets(datasets: SavedDataset[]) {
  localStorage.setItem(CUSTOM_DATASETS_KEY, JSON.stringify(datasets));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseFactsFromJson(parsed: any): Record<string, unknown>[] {
  let targetFacts: Record<string, unknown>[] = [];

  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && Array.isArray(parsed[0]?.facts)) {
      parsed.forEach((src: Record<string, unknown>) => {
        const sourceMeta = {
          source_url: src.source_url || "",
          publisher: src.publisher || "",
          year: src.year || "",
          source_format: src.source_format || "",
          discovered_via: src.discovered_via || "",
          reason: src.reason || "",
        };
        const facts = src.facts as Record<string, unknown>[];
        if (Array.isArray(facts)) {
          facts.forEach((f) => {
            targetFacts.push({
              ...sourceMeta,
              ...f,
              id: f.fact_id || f.id,
            });
          });
        }
      });
    } else {
      targetFacts = parsed;
    }
  } else if (parsed.facts && Array.isArray(parsed.facts)) {
    const sourceMeta = {
      source_url: parsed.source_url || "",
      publisher: parsed.publisher || "",
      year: parsed.year || "",
    };
    targetFacts = parsed.facts.map((f: Record<string, unknown>) => ({
      ...sourceMeta,
      ...f,
    }));
  } else if (Array.isArray(parsed.sources)) {
    parsed.sources.forEach((src: Record<string, unknown>) => {
      const sourceMeta = {
        source_url: src.source_url || "",
        publisher: src.publisher || "",
        year: src.year || "",
      };
      const facts = src.facts as Record<string, unknown>[];
      if (Array.isArray(facts)) {
        facts.forEach((f) => {
          targetFacts.push({ ...sourceMeta, ...f });
        });
      }
    });
  } else if (parsed && typeof parsed === "object") {
    const firstKey = Object.keys(parsed)[0];
    const firstVal = firstKey
      ? (parsed as Record<string, unknown>)[firstKey]
      : null;
    if (
      firstVal &&
      typeof firstVal === "object" &&
      Array.isArray((firstVal as { facts?: unknown[] }).facts)
    ) {
      Object.values(parsed).forEach((src) => {
        const s = src as Record<string, unknown>;
        const sourceMeta = {
          source_url: s.source_url || "",
          publisher: s.publisher || "",
          year: s.year || "",
        };
        const facts = s.facts as Record<string, unknown>[];
        if (Array.isArray(facts)) {
          facts.forEach((f) => {
            targetFacts.push({ ...sourceMeta, ...f });
          });
        }
      });
    } else {
      targetFacts = [parsed];
    }
  }

  return targetFacts;
}
