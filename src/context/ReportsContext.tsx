"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { EvaluatorModelId, Fact, Report, ReportStatusType } from "@/lib/types";
import {
  DEFAULT_EVALUATOR,
  normalizeEvaluatorId,
} from "@/lib/evaluators";
import {
  applyFactToReport,
  buildPlaceholderFacts,
  computeReportCounts,
  countErrorFacts,
  countNotSureFacts,
  factsToInputPayload,
  finalizeReportStatus,
} from "@/lib/report-utils";

const REPORTS_KEY = "CITATION_EVAL_REPORTS";
const DEFAULT_EVALUATOR_KEY = "CITATE_EVAL_DEFAULT_EVALUATOR";
const ACTIVE_EVAL_KEY = "CITATION_ACTIVE_EVALUATION";
const PENDING_EVAL_KEY = "CITATION_PENDING_EVALUATION";

export interface EvalLogEntry {
  id: string;
  type: "info" | "pass" | "fail" | "unsure" | "error";
  text: string;
}

export interface ActiveEvaluation {
  reportId: string;
  name: string;
  evaluator: EvaluatorModelId;
  inputFacts: Record<string, unknown>[];
  fromIndex: number;
  currentIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  isWaitingForFirst: boolean;
  fatalError: string | null;
  statusLine: string;
  logs: EvalLogEntry[];
  passedCount: number;
  failedCount: number;
  notSureCount: number;
  errorCount: number;
}

interface PendingEvaluation {
  name: string;
  evaluator: EvaluatorModelId;
  facts: Record<string, unknown>[];
  reportId: string;
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
  handleProgressComplete: () => void;
  activeEvaluation: ActiveEvaluation | null;
  pauseEvaluation: () => void;
  resumeEvaluation: () => void;
  resumeInterruptedReport: (reportId: string) => void;
  registerEvalAbort: (abort: (() => void) | null) => void;
  syncEvaluatedFact: (
    reportId: string,
    index: number,
    fact: Fact,
    error: { factId: string; code: string; message: string } | null,
  ) => void;
  finishActiveEvaluation: (status: ReportStatusType) => void;
  failActiveEvaluation: (message: string) => void;
  pauseActiveEvaluation: (pausedAt: number) => void;
  appendEvalLog: (entry: EvalLogEntry) => void;
  setActiveEvalStatus: (
    statusLine: string,
    options?: { isWaitingForFirst?: boolean },
  ) => void;
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

function buildActiveEvaluationFromReport(
  report: Report,
  options?: { resumeAfterReload?: boolean },
): ActiveEvaluation | null {
  const counts = computeReportCounts(report.facts);
  if (report.status !== "PROCESSING" || counts.pendingCount === 0) {
    return null;
  }

  const inputFacts = factsToInputPayload(report.facts);
  const resumeAfterReload = options?.resumeAfterReload ?? false;

  return {
    reportId: report.id,
    name: report.name,
    evaluator: report.evaluator,
    inputFacts,
    fromIndex: counts.evaluatedCount,
    currentIndex: counts.evaluatedCount,
    isRunning: true,
    isPaused: false,
    isComplete: false,
    isWaitingForFirst: counts.evaluatedCount === 0,
    fatalError: null,
    statusLine: resumeAfterReload
      ? `Resuming after reload — ${counts.pendingCount} claim(s) remaining...`
      : `Resuming interrupted evaluation — ${counts.pendingCount} claim(s) remaining...`,
    logs: resumeAfterReload
      ? [
          {
            id: `reload-resume-${Date.now()}`,
            type: "info" as const,
            text: `▶ Resumed after page reload — ${counts.pendingCount} claim(s) remaining.`,
          },
        ]
      : [],
    passedCount: report.passedCount,
    failedCount: report.failedCount,
    notSureCount: countNotSureFacts(report.facts),
    errorCount: countErrorFacts(report.facts),
  };
}

function restoreActiveEvaluation(reports: Report[]): ActiveEvaluation | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(ACTIVE_EVAL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ActiveEvaluation;
      const report = reports.find((r) => r.id === parsed.reportId);
      if (!report) {
        localStorage.removeItem(ACTIVE_EVAL_KEY);
        localStorage.removeItem(PENDING_EVAL_KEY);
      } else if (parsed.isComplete || parsed.fatalError || parsed.isPaused) {
        return {
          ...parsed,
          evaluator: normalizeEvaluatorId(parsed.evaluator),
        };
      } else {
        const currentIndex = Math.max(
          parsed.currentIndex,
          computeReportCounts(report.facts).evaluatedCount,
        );
        if (currentIndex >= parsed.inputFacts.length) {
          return {
            ...parsed,
            evaluator: normalizeEvaluatorId(parsed.evaluator),
            currentIndex: parsed.inputFacts.length,
            isRunning: false,
            isComplete: true,
            isPaused: false,
            isWaitingForFirst: false,
            statusLine: `All ${parsed.inputFacts.length} claims processed.`,
          };
        }

        const remaining = parsed.inputFacts.length - currentIndex;
        return {
          ...parsed,
          evaluator: normalizeEvaluatorId(parsed.evaluator),
          currentIndex,
          fromIndex: currentIndex,
          isRunning: true,
          isPaused: false,
          isWaitingForFirst: false,
          statusLine: `Resuming after reload — ${remaining} claim(s) remaining...`,
          logs: [
            {
              id: `reload-resume-${Date.now()}`,
              type: "info" as const,
              text: `▶ Resumed after page reload — ${remaining} claim(s) remaining.`,
            },
            ...parsed.logs,
          ].slice(0, 30),
          passedCount: report.passedCount,
          failedCount: report.failedCount,
          notSureCount: countNotSureFacts(report.facts),
          errorCount: countErrorFacts(report.facts),
        };
      }
    }
  } catch {
    localStorage.removeItem(ACTIVE_EVAL_KEY);
  }

  const processingReport = reports.find((r) => r.status === "PROCESSING");
  if (processingReport) {
    return buildActiveEvaluationFromReport(processingReport);
  }

  return null;
}

function restorePendingEvaluation(
  active: ActiveEvaluation | null,
): PendingEvaluation | null {
  if (!active || active.isComplete) return null;
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(PENDING_EVAL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PendingEvaluation;
      if (parsed.reportId === active.reportId) {
        return parsed;
      }
    }
  } catch {
    localStorage.removeItem(PENDING_EVAL_KEY);
  }

  return {
    name: active.name,
    evaluator: active.evaluator,
    facts: active.inputFacts,
    reportId: active.reportId,
  };
}

function persistActiveEvaluation(active: ActiveEvaluation | null) {
  if (typeof window === "undefined") return;
  if (active) {
    localStorage.setItem(ACTIVE_EVAL_KEY, JSON.stringify(active));
  } else {
    localStorage.removeItem(ACTIVE_EVAL_KEY);
  }
}

function persistPendingEvaluation(pending: PendingEvaluation | null) {
  if (typeof window === "undefined") return;
  if (pending) {
    localStorage.setItem(PENDING_EVAL_KEY, JSON.stringify(pending));
  } else {
    localStorage.removeItem(PENDING_EVAL_KEY);
  }
}

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pendingEvaluation, setPendingEvaluation] =
    useState<PendingEvaluation | null>(null);
  const [defaultEvaluator, setDefaultEvaluatorState] =
    useState<EvaluatorModelId>(DEFAULT_EVALUATOR);
  const [activeEvaluation, setActiveEvaluation] =
    useState<ActiveEvaluation | null>(null);
  const reportsRef = useRef<Report[]>([]);
  const abortEvalRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    const loadedReports = loadReports();
    let restoredActive = restoreActiveEvaluation(loadedReports);
    let finalReports = loadedReports;

    if (restoredActive?.isComplete) {
      const report = loadedReports.find((r) => r.id === restoredActive!.reportId);
      if (report?.status === "PROCESSING") {
        finalReports = loadedReports.map((r) =>
          r.id === restoredActive!.reportId
            ? finalizeReportStatus(r, "COMPLETED")
            : r,
        );
        localStorage.setItem(REPORTS_KEY, JSON.stringify(finalReports));
      }
    } else if (restoredActive?.fatalError) {
      const report = loadedReports.find((r) => r.id === restoredActive!.reportId);
      if (report?.status === "PROCESSING") {
        finalReports = loadedReports.map((r) =>
          r.id === restoredActive!.reportId
            ? finalizeReportStatus(r, "FAILED")
            : r,
        );
        localStorage.setItem(REPORTS_KEY, JSON.stringify(finalReports));
      }
    }

    setReports(finalReports);
    setDefaultEvaluatorState(
      normalizeEvaluatorId(localStorage.getItem(DEFAULT_EVALUATOR_KEY)),
    );
    setActiveEvaluation(restoredActive);
    setPendingEvaluation(restorePendingEvaluation(restoredActive));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistActiveEvaluation(activeEvaluation);
  }, [activeEvaluation, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    persistPendingEvaluation(pendingEvaluation);
  }, [pendingEvaluation, hydrated]);

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
      if (activeEvaluation?.reportId === id) {
        setActiveEvaluation(null);
        setPendingEvaluation(null);
      }
    },
    [reports, saveReports, activeEvaluation?.reportId],
  );

  const handleCreateNewClick = useCallback(
    () => router.push("/evaluations/new"),
    [router],
  );

  const registerEvalAbort = useCallback((abort: (() => void) | null) => {
    abortEvalRef.current = abort;
  }, []);

  const updateReportInStore = useCallback(
    (reportId: string, updater: (report: Report) => Report) => {
      const updated = reportsRef.current.map((rep) =>
        rep.id === reportId ? updater(rep) : rep,
      );
      saveReports(updated);
    },
    [saveReports],
  );

  const factLogEntry = useCallback(
    (
      f: Fact,
      globalIndex: number,
      error?: { message: string } | null,
    ): EvalLogEntry => {
      if (error) {
        return {
          id: `${f.id}-log-${globalIndex}`,
          type: "error",
          text: `[${f.id}] ERROR: ${error.message}`,
        };
      }
      if (f.verdict === "PASS") {
        return {
          id: `${f.id}-log-${globalIndex}`,
          type: "pass",
          text: `[${f.id}] PASS: Claim matches source context parameters.`,
        };
      }
      if (f.verdict === "NOT_SURE") {
        return {
          id: `${f.id}-log-${globalIndex}`,
          type: "unsure",
          text: `[${f.id}] NOT SURE: ${f.reason || "Insufficient evidence."}`,
        };
      }
      return {
        id: `${f.id}-log-${globalIndex}`,
        type: "fail",
        text: `[${f.id}] FAIL (${f.issue || "CLAIM_NOT_SUPPORTED"}): ${f.reason}`,
      };
    },
    [],
  );

  const syncEvaluatedFact = useCallback(
    (
      reportId: string,
      index: number,
      fact: Fact,
      error: { factId: string; code: string; message: string } | null,
    ) => {
      const report = reportsRef.current.find((r) => r.id === reportId);
      if (!report) return;

      const updatedReport = applyFactToReport(report, index, fact);
      saveReports(
        reportsRef.current.map((r) => (r.id === reportId ? updatedReport : r)),
      );

      const counts = computeReportCounts(updatedReport.facts);
      const nextIndex = index + 1;
      const total = report.factCount;

      setActiveEvaluation((prev) => {
        if (!prev || prev.reportId !== reportId) return prev;

        return {
          ...prev,
          currentIndex: nextIndex,
          passedCount: counts.passedCount,
          failedCount: counts.failedCount,
          notSureCount: updatedReport.facts.filter(
            (f) =>
              f.evaluationStatus !== "PENDING" && f.verdict === "NOT_SURE",
          ).length,
          errorCount: updatedReport.facts.filter(
            (f) => f.evaluationStatus === "ERROR",
          ).length,
          isWaitingForFirst: false,
          statusLine:
            nextIndex >= total
              ? `All ${total} claims processed.`
              : `Verified ${nextIndex} / ${total} — claim ${nextIndex + 1} in progress...`,
          logs: [factLogEntry(fact, index, error), ...prev.logs].slice(0, 30),
        };
      });
    },
    [saveReports, factLogEntry],
  );

  const appendEvalLog = useCallback((entry: EvalLogEntry) => {
    setActiveEvaluation((prev) =>
      prev ? { ...prev, logs: [entry, ...prev.logs].slice(0, 30) } : prev,
    );
  }, []);

  const setActiveEvalStatus = useCallback(
    (
      statusLine: string,
      options?: { isWaitingForFirst?: boolean },
    ) => {
      setActiveEvaluation((prev) =>
        prev
          ? {
              ...prev,
              statusLine,
              isWaitingForFirst: options?.isWaitingForFirst ?? prev.isWaitingForFirst,
            }
          : prev,
      );
    },
    [],
  );

  const finishActiveEvaluation = useCallback(
    (status: ReportStatusType) => {
      setActiveEvaluation((prev) => {
        if (!prev) return prev;
        updateReportInStore(prev.reportId, (report) =>
          finalizeReportStatus(report, status),
        );
        return {
          ...prev,
          isRunning: false,
          isPaused: false,
          isComplete: true,
          isWaitingForFirst: false,
          statusLine: `All ${prev.inputFacts.length} claims processed.`,
        };
      });
      setPendingEvaluation(null);
    },
    [updateReportInStore],
  );

  const failActiveEvaluation = useCallback(
    (message: string) => {
      setActiveEvaluation((prev) => {
        if (!prev) return prev;
        updateReportInStore(prev.reportId, (report) =>
          finalizeReportStatus(report, "FAILED"),
        );
        return {
          ...prev,
          isRunning: false,
          isPaused: false,
          fatalError: message,
          isWaitingForFirst: false,
          statusLine: "Evaluation stopped — partial results saved.",
          logs: [
            { id: "fatal-err", type: "error" as const, text: message },
            ...prev.logs,
          ].slice(0, 30),
        };
      });
    },
    [updateReportInStore],
  );

  const pauseActiveEvaluation = useCallback((pausedAt: number) => {
    setActiveEvaluation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        isRunning: false,
        isPaused: true,
        isWaitingForFirst: false,
        currentIndex: pausedAt,
        statusLine: `Paused at ${pausedAt} / ${prev.inputFacts.length} claims.`,
        logs: [
          {
            id: `paused-${Date.now()}`,
            type: "info" as const,
            text: `⏸ Paused — ${pausedAt} of ${prev.inputFacts.length} verified. Open the report to review, then Resume.`,
          },
          ...prev.logs,
        ].slice(0, 30),
      };
    });
  }, []);

  const pauseEvaluation = useCallback(() => {
    abortEvalRef.current?.();
  }, []);

  const resumeEvaluation = useCallback(() => {
    setActiveEvaluation((prev) => {
      if (!prev || prev.isRunning || prev.isComplete) return prev;
      return {
        ...prev,
        isRunning: true,
        isPaused: false,
        fromIndex: prev.currentIndex,
        fatalError: null,
      };
    });
  }, []);

  const resumeInterruptedReport = useCallback((reportId: string) => {
    const report = reportsRef.current.find((r) => r.id === reportId);
    if (!report) return;

    const restored = buildActiveEvaluationFromReport(report);
    if (!restored) return;

    setActiveEvaluation(restored);
    setPendingEvaluation({
      name: restored.name,
      evaluator: restored.evaluator,
      facts: restored.inputFacts,
      reportId: restored.reportId,
    });
  }, []);

  const startEvaluation = useCallback(
    (
      name: string,
      evaluator: EvaluatorModelId,
      factsList: Record<string, unknown>[],
    ) => {
      const reportId = `rep_${Date.now()}`;
      const placeholderFacts = buildPlaceholderFacts(factsList);
      const counts = computeReportCounts(placeholderFacts);

      const newReport: Report = {
        id: reportId,
        name,
        createdAt: new Date().toISOString(),
        sourceCount: counts.sourceCount,
        factCount: placeholderFacts.length,
        passedCount: 0,
        failedCount: 0,
        status: "PROCESSING",
        evaluator,
        facts: placeholderFacts,
      };

      saveReports([newReport, ...reportsRef.current]);
      setPendingEvaluation({ name, evaluator, facts: factsList, reportId });
      setActiveEvaluation({
        reportId,
        name,
        evaluator,
        inputFacts: factsList,
        fromIndex: 0,
        currentIndex: 0,
        isRunning: true,
        isPaused: false,
        isComplete: false,
        isWaitingForFirst: true,
        fatalError: null,
        statusLine: "Connecting to Groq...",
        logs: [],
        passedCount: 0,
        failedCount: 0,
        notSureCount: 0,
        errorCount: 0,
      });
      router.push("/evaluations/progress");
    },
    [saveReports, router],
  );

  const handleReRunReport = useCallback(
    (id: string) => {
      const reportToRerun = reports.find((r) => r.id === id);
      if (!reportToRerun) return;

      saveReports(reports.filter((r) => r.id !== id));
      startEvaluation(
        reportToRerun.name,
        reportToRerun.evaluator,
        reportToRerun.facts.map((f) => ({
          fact_id: f.id,
          id: f.id,
          fact: f.fact,
          exact_paragraph: f.evidence_text,
          evidence_text: f.evidence_text,
          source_url: f.source_url,
          publisher: f.publisher,
          year: f.year,
          page_no: f.page_no,
          citation_url: f.citation_url,
        })),
      );
    },
    [reports, saveReports, startEvaluation],
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

  const handleProgressComplete = useCallback(() => {
    if (!activeEvaluation?.reportId) return;
    router.push(`/reports/${activeEvaluation.reportId}`);
  }, [activeEvaluation?.reportId, router]);

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
    localStorage.removeItem(ACTIVE_EVAL_KEY);
    localStorage.removeItem(PENDING_EVAL_KEY);
    localStorage.removeItem("CITATION_CUSTOM_DATASETS");
    setReports([]);
    setActiveEvaluation(null);
    setPendingEvaluation(null);
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
        activeEvaluation,
        pauseEvaluation,
        resumeEvaluation,
        resumeInterruptedReport,
        registerEvalAbort,
        syncEvaluatedFact,
        finishActiveEvaluation,
        failActiveEvaluation,
        pauseActiveEvaluation,
        appendEvalLog,
        setActiveEvalStatus,
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
