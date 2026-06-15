export type IssueType =
  | "NUMBER_MISMATCH"
  | "CITATION_NOT_FOUND"
  | "WRONG_PAGE"
  | "CLAIM_NOT_SUPPORTED"
  | "OTHER";

export type VerdictType = "PASS" | "FAIL" | "NOT_SURE";

export type ReviewStatusType = "PENDING" | "REVIEWED";

/** Whether Groq has finished evaluating this claim. */
export type FactEvaluationStatus = "PENDING" | "EVALUATED" | "ERROR";

/** Groq model ID used for citation evaluation */
export type EvaluatorModelId =
  | "llama-3.3-70b-versatile"
  | "openai/gpt-oss-20b"
  | "meta-llama/llama-4-scout-17b-16e-instruct";

export type ReportStatusType = "PROCESSING" | "COMPLETED" | "FAILED";

export interface Fact {
  id: string;
  fact: string;
  verdict: VerdictType;
  issue: IssueType | null;
  reason: string;
  evidence_page: number | null;
  evidence_text: string;
  source_url: string;
  publisher: string;
  year: string;
  page_no: number | null;
  citation_url: string;
  review_status: ReviewStatusType;
  reviewer_notes: string;
  evaluationStatus?: FactEvaluationStatus;
}

export interface Report {
  id: string;
  name: string;
  createdAt: string;
  sourceCount: number;
  factCount: number;
  passedCount: number;
  failedCount: number;
  status: ReportStatusType;
  evaluator: EvaluatorModelId;
  facts: Fact[];
}
