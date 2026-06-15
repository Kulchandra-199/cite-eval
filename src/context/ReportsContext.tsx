"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { EvaluatorModelId, Fact, Report } from "@/lib/types";
import {
  DEFAULT_EVALUATOR,
  normalizeEvaluatorId,
} from "@/lib/evaluators";

const REPORTS_KEY = "CITATION_EVAL_REPORTS";
const DEFAULT_EVALUATOR_KEY = "CITATE_EVAL_DEFAULT_EVALUATOR";

interface PendingEvaluation {
  name: string;
  evaluator: EvaluatorModelId;
  facts: Record<string, unknown>[];
}

interface ReportsContextValue {
  reports: Report[];
  defaultEvaluator: EvaluatorModelId;
  setDefaultEvaluator: (evaluator: EvaluatorModelId) => void;
  handleViewReport: (id: string) => void;
  handleDeleteReport: (id: string) => void;
  handleReRunReport: (id: string) => void;
  handleCreateNewClick: () => void;
  handleEvaluationFormSubmit: (
    name: string,
    evaluator: EvaluatorModelId,
    factsList: Record<string, unknown>[],
  ) => void;
  handleEvaluateDataset: (name: string, datasetFacts: Record<string, unknown>[]) => void;
  handleProgressComplete: (processedFacts: Fact[]) => void;
  handleUpdateFact: (reportId: string, factId: string, updates: Partial<Fact>) => void;
  handleBulkUpdateFacts: (
    reportId: string,
    factIds: string[],
    updates: Partial<Fact>,
  ) => void;
  handleReRunSingleFact: (reportId: string, factId: string) => Promise<void>;
  handleClearStorage: () => void;
  getReport: (id: string) => Report | undefined;
  pendingEvaluation: PendingEvaluation | null;
}

const ReportsContext = createContext<ReportsContextValue | null>(null);

function loadReports(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(REPORTS_KEY);
    if (stored) {
      const reports = JSON.parse(stored) as Report[];
      return reports.map((r) => ({
        ...r,
        evaluator: normalizeEvaluatorId(r.evaluator),
      }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pendingEvaluation, setPendingEvaluation] =
    useState<PendingEvaluation | null>(null);
  const [defaultEvaluator, setDefaultEvaluatorState] =
    useState<EvaluatorModelId>(DEFAULT_EVALUATOR);

  useEffect(() => {
    setReports(loadReports());
    setDefaultEvaluatorState(
      normalizeEvaluatorId(localStorage.getItem(DEFAULT_EVALUATOR_KEY)),
    );
    setHydrated(true);
  }, []);

  const saveReports = useCallback((updated: Report[]) => {
    setReports(updated);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  }, []);

  const setDefaultEvaluator = useCallback((evaluator: EvaluatorModelId) => {
    setDefaultEvaluatorState(evaluator);
    localStorage.setItem(DEFAULT_EVALUATOR_KEY, evaluator);
  }, []);

  const handleViewReport = useCallback(
    (id: string) => router.push(`/reports/${id}`),
    [router],
  );

  const handleDeleteReport = useCallback(
    (id: string) => {
      if (
        !window.confirm(
          "Are you sure you want to delete this evaluation report? This operation cannot be undone.",
        )
      ) {
        return;
      }
      saveReports(reports.filter((r) => r.id !== id));
    },
    [reports, saveReports],
  );

  const handleReRunReport = useCallback(
    (id: string) => {
      const reportToRerun = reports.find((r) => r.id === id);
      if (!reportToRerun) return;

      setPendingEvaluation({
        name: reportToRerun.name,
        evaluator: reportToRerun.evaluator,
        facts: reportToRerun.facts.map((f) => ({
          ...f,
          verdict: undefined,
          issue: undefined,
          reason: undefined,
        })),
      });
      saveReports(reports.filter((r) => r.id !== id));
      router.push("/evaluations/progress");
    },
    [reports, saveReports, router],
  );

  const handleCreateNewClick = useCallback(
    () => router.push("/evaluations/new"),
    [router],
  );

  const startEvaluation = useCallback(
    (
      name: string,
      evaluator: EvaluatorModelId,
      factsList: Record<string, unknown>[],
    ) => {
      setPendingEvaluation({ name, evaluator, facts: factsList });
      router.push("/evaluations/progress");
    },
    [router],
  );

  const handleEvaluationFormSubmit = useCallback(
    (
      name: string,
      evaluator: EvaluatorModelId,
      factsList: Record<string, unknown>[],
    ) => startEvaluation(name, evaluator, factsList),
    [startEvaluation],
  );

  const handleEvaluateDataset = useCallback(
    (name: string, datasetFacts: Record<string, unknown>[]) =>
      startEvaluation(`${name || "Dataset"} Run`, defaultEvaluator, datasetFacts),
    [startEvaluation, defaultEvaluator],
  );

  const handleProgressComplete = useCallback(
    (processedFacts: Fact[]) => {
      if (!pendingEvaluation) return;

      const normalizedFacts: Fact[] = processedFacts.map((f, i) => ({
        ...f,
        id: f.id || (f as Fact & { fact_id?: string }).fact_id || `F${i + 1}`,
      }));

      const passed = normalizedFacts.filter((f) => f.verdict === "PASS").length;
      const failed = normalizedFacts.filter((f) => f.verdict === "FAIL").length;

      const newReport: Report = {
        id: `rep_${Date.now()}`,
        name: pendingEvaluation.name,
        createdAt: new Date().toISOString(),
        sourceCount:
          Array.from(
            new Set(normalizedFacts.map((f) => f.source_url)),
          ).filter(Boolean).length || 1,
        factCount: normalizedFacts.length,
        passedCount: passed,
        failedCount: failed,
        status: "COMPLETED",
        evaluator: pendingEvaluation.evaluator,
        facts: normalizedFacts,
      };

      saveReports([newReport, ...reports]);
      setPendingEvaluation(null);
      router.push(`/reports/${newReport.id}`);
    },
    [pendingEvaluation, reports, saveReports, router],
  );

  const handleUpdateFact = useCallback(
    (reportId: string, factId: string, updates: Partial<Fact>) => {
      const updated = reports.map((rep) => {
        if (rep.id !== reportId) return rep;
        const updatedFacts = rep.facts.map((fact) =>
          fact.id !== factId ? fact : { ...fact, ...updates },
        );
        return {
          ...rep,
          facts: updatedFacts,
          passedCount: updatedFacts.filter((f) => f.verdict === "PASS").length,
          failedCount: updatedFacts.filter((f) => f.verdict === "FAIL").length,
        };
      });
      saveReports(updated);
    },
    [reports, saveReports],
  );

  const handleBulkUpdateFacts = useCallback(
    (reportId: string, factIds: string[], updates: Partial<Fact>) => {
      const updated = reports.map((rep) => {
        if (rep.id !== reportId) return rep;
        const updatedFacts = rep.facts.map((fact) =>
          factIds.includes(fact.id) ? { ...fact, ...updates } : fact,
        );
        return {
          ...rep,
          facts: updatedFacts,
          passedCount: updatedFacts.filter((f) => f.verdict === "PASS").length,
          failedCount: updatedFacts.filter((f) => f.verdict === "FAIL").length,
        };
      });
      saveReports(updated);
    },
    [reports, saveReports],
  );

  const handleReRunSingleFact = useCallback(
    async (reportId: string, factId: string) => {
      const report = reports.find((r) => r.id === reportId);
      const fact = report?.facts.find((f) => f.id === factId);
      if (!report || !fact) return;

      const response = await fetch("/api/evaluate-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact, evaluator: report.evaluator }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ||
              data.errors?.[0]?.message ||
              `Server returned error status ${response.status}`;
        alert(`Re-evaluation failed for [${factId}]:\n\n${message}`);
        return;
      }

      if (data.errors?.length > 0) {
        alert(
          `Re-evaluation failed for [${factId}]:\n\n${data.errors[0].message}`,
        );
        return;
      }

      const nextFact = data.fact;

      handleUpdateFact(reportId, factId, {
        verdict: nextFact.verdict,
        issue: nextFact.issue,
        reason: nextFact.reason,
        evidence_text: nextFact.evidence_text,
        review_status:
          nextFact.verdict === "PASS" ? "REVIEWED" : fact.review_status,
      });

      if (nextFact.verdict === "PASS") {
        alert(
          `Success! [${factId}] re-evaluated. Verdict flipped to PASS.`,
        );
      } else if (nextFact.verdict === "NOT_SURE") {
        alert(
          `Re-evaluation complete: [${factId}] could not be verified.\nReason: ${nextFact.reason}`,
        );
      } else {
        alert(
          `Re-evaluation complete: [${factId}] still fails.\nReason: ${nextFact.reason}`,
        );
      }
    },
    [reports, handleUpdateFact],
  );

  const handleClearStorage = useCallback(() => {
    localStorage.removeItem(REPORTS_KEY);
    localStorage.removeItem("CITATION_CUSTOM_DATASETS");
    setReports([]);
    router.push("/");
  }, [router]);

  const getReport = useCallback(
    (id: string) => reports.find((r) => r.id === id),
    [reports],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Loading CiteEval…
      </div>
    );
  }

  return (
    <ReportsContext.Provider
      value={{
        reports,
        defaultEvaluator,
        setDefaultEvaluator,
        handleViewReport,
        handleDeleteReport,
        handleReRunReport,
        handleCreateNewClick,
        handleEvaluationFormSubmit,
        handleEvaluateDataset,
        handleProgressComplete,
        handleUpdateFact,
        handleBulkUpdateFacts,
        handleReRunSingleFact,
        handleClearStorage,
        getReport,
        pendingEvaluation,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error("useReports must be used within ReportsProvider");
  return ctx;
}
