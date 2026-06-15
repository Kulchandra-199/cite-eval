import { Fact, Report, ReportStatusType, VerdictType } from "@/lib/types";

export function buildPlaceholderFacts(
  factsList: Record<string, unknown>[],
): Fact[] {
  return factsList.map((f, i) => {
    const id = String(f.fact_id ?? f.id ?? `F${i + 1}`);
    return {
      id,
      fact: String(f.fact ?? ""),
      verdict: "NOT_SURE" as VerdictType,
      issue: null,
      reason: "Awaiting evaluation...",
      evidence_page: (f.page_no as number | null) ?? null,
      evidence_text: String(f.exact_paragraph ?? f.evidence_text ?? ""),
      source_url: String(f.source_url ?? ""),
      publisher: String(f.publisher ?? "Reference Source"),
      year: String(f.year ?? "2026"),
      page_no: (f.page_no as number | null) ?? null,
      citation_url: String(f.citation_url ?? ""),
      review_status: "PENDING",
      reviewer_notes: "",
      evaluationStatus: "PENDING",
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeStreamFact(raw: any, hasError: boolean): Fact {
  const id = String(raw.id ?? raw.fact_id ?? "");
  return {
    id,
    fact: String(raw.fact ?? ""),
    verdict: (raw.verdict ?? "NOT_SURE") as VerdictType,
    issue: raw.issue ?? null,
    reason: String(raw.reason ?? ""),
    evidence_page: raw.evidence_page ?? raw.page_no ?? null,
    evidence_text: String(raw.evidence_text ?? ""),
    source_url: String(raw.source_url ?? ""),
    publisher: String(raw.publisher ?? "Reference Source"),
    year: String(raw.year ?? "2026"),
    page_no: raw.page_no ?? null,
    citation_url: String(raw.citation_url ?? ""),
    review_status: raw.review_status ?? "PENDING",
    reviewer_notes: String(raw.reviewer_notes ?? ""),
    evaluationStatus: hasError ? "ERROR" : "EVALUATED",
  };
}

export function computeReportCounts(facts: Fact[]) {
  const evaluated = facts.filter((f) => f.evaluationStatus !== "PENDING");
  return {
    passedCount: evaluated.filter((f) => f.verdict === "PASS").length,
    failedCount: evaluated.filter((f) => f.verdict === "FAIL").length,
    evaluatedCount: evaluated.length,
    pendingCount: facts.filter((f) => f.evaluationStatus === "PENDING").length,
    sourceCount:
      Array.from(new Set(facts.map((f) => f.source_url))).filter(Boolean)
        .length || 1,
  };
}

export function applyFactToReport(
  report: Report,
  index: number,
  fact: Fact,
): Report {
  const facts = [...report.facts];
  facts[index] = fact;
  const counts = computeReportCounts(facts);
  return {
    ...report,
    facts,
    factCount: facts.length,
    passedCount: counts.passedCount,
    failedCount: counts.failedCount,
    sourceCount: counts.sourceCount,
  };
}

export function finalizeReportStatus(
  report: Report,
  status: ReportStatusType,
): Report {
  return { ...report, status };
}

export function isFactPending(fact: Fact): boolean {
  return fact.evaluationStatus === "PENDING";
}
