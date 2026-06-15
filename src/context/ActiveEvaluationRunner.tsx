"use client";

import { useEffect, useRef } from "react";
import { getEvaluatorLabel } from "@/lib/evaluators";
import { normalizeStreamFact } from "@/lib/report-utils";
import { useReports } from "@/context/ReportsContext";
import {
  chunkArray,
  CLIENT_BATCH_SIZE,
  CLIENT_BATCH_DELAY_MS,
} from "@/lib/evaluation-config";
import {
  getBrowserGroqApiKey,
  getEvaluationApiUrl,
  shouldUseBrowserGroq,
} from "@/lib/evaluation-api";
import {
  evaluateFactWithBrowserGroq,
  formatBrowserFactResult,
} from "@/lib/groq-browser";
import { toEvaluationIssue } from "@/lib/api-errors";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BatchEvaluateResponse {
  facts: Record<string, unknown>[];
  errors: Array<{
    factId: string;
    code: string;
    message: string;
    retryAfterSeconds?: number;
  }>;
  provider?: string;
}

/** Runs Groq evaluations in the background so evaluation survives page navigation. */
export function ActiveEvaluationRunner() {
  const {
    activeEvaluation,
    syncEvaluatedFact,
    finishActiveEvaluation,
    failActiveEvaluation,
    pauseActiveEvaluation,
    appendEvalLog,
    setActiveEvalStatus,
    registerEvalAbort,
  } = useReports();

  const abortRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<"user" | "supersede">("supersede");
  const runIdRef = useRef(0);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    if (!activeEvaluation?.isRunning) return;

    const runId = ++runIdRef.current;
    const { reportId, evaluator, inputFacts, fromIndex } = activeEvaluation;
    const remaining = inputFacts.slice(fromIndex);
    const useBrowserGroq = shouldUseBrowserGroq();
    const browserGroqKey = getBrowserGroqApiKey();

    if (remaining.length === 0) {
      finishActiveEvaluation("COMPLETED");
      return;
    }

    if (abortRef.current) {
      abortReasonRef.current = "supersede";
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    registerEvalAbort(() => {
      if (!controller.signal.aborted) {
        abortReasonRef.current = "user";
        controller.abort();
      }
    });

    setActiveEvalStatus(
      fromIndex === 0
        ? useBrowserGroq
          ? "Connecting to Groq (browser)..."
          : "Connecting to Groq..."
        : `Resuming from claim ${fromIndex + 1} of ${inputFacts.length}...`,
      { isWaitingForFirst: fromIndex === 0 && currentIndexRef.current === 0 },
    );

    if (fromIndex === 0) {
      appendEvalLog({
        id: "init",
        type: "info",
        text: useBrowserGroq
          ? `Evaluating ${inputFacts.length} claim(s) via Groq in your browser (${getEvaluatorLabel(evaluator)})...`
          : `Evaluating ${inputFacts.length} claim(s) via Groq (${getEvaluatorLabel(evaluator)})...`,
      });
    } else {
      appendEvalLog({
        id: `resume-${fromIndex}`,
        type: "info",
        text: `▶ Resumed — ${remaining.length} claim(s) remaining.`,
      });
    }

    const batches = chunkArray(remaining, CLIENT_BATCH_SIZE);

    (async () => {
      try {
        if (useBrowserGroq && browserGroqKey) {
          if (fromIndex === 0) {
            appendEvalLog({
              id: "groq-active",
              type: "info",
              text: "Groq browser mode — bypasses Vercel serverless timeouts.",
            });
          }

          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            if (runIdRef.current !== runId) return;
            if (controller.signal.aborted) {
              throw new DOMException("Evaluation aborted.", "AbortError");
            }

            const batch = batches[batchIndex];
            const batchStartIndex =
              fromIndex +
              batches
                .slice(0, batchIndex)
                .reduce((sum, chunk) => sum + chunk.length, 0);

            for (let i = 0; i < batch.length; i++) {
              if (runIdRef.current !== runId) return;

              const rawFact = batch[i];
              const globalIndex = batchStartIndex + i;
              const factId = String(
                rawFact.fact_id ?? rawFact.id ?? `F${globalIndex + 1}`,
              );

              setActiveEvalStatus(
                `Verifying claim ${globalIndex + 1} of ${inputFacts.length}...`,
                { isWaitingForFirst: false },
              );

              try {
                const parsed = await evaluateFactWithBrowserGroq(
                  rawFact,
                  browserGroqKey,
                  evaluator,
                );
                const formatted = formatBrowserFactResult(rawFact, factId, parsed);
                currentIndexRef.current = globalIndex + 1;
                syncEvaluatedFact(
                  reportId,
                  globalIndex,
                  normalizeStreamFact(formatted, false),
                  null,
                );
              } catch (err) {
                const issue = toEvaluationIssue(factId, err);
                const formatted = formatBrowserFactResult(rawFact, factId, {
                  verdict: "NOT_SURE",
                  issue: null,
                  reason: issue.message,
                  evidence_text: String(
                    rawFact.exact_paragraph ?? rawFact.evidence_text ?? "",
                  ),
                });
                currentIndexRef.current = globalIndex + 1;
                syncEvaluatedFact(
                  reportId,
                  globalIndex,
                  normalizeStreamFact(formatted, true),
                  issue,
                );
              }

              if (batchIndex < batches.length - 1 || i < batch.length - 1) {
                await sleep(CLIENT_BATCH_DELAY_MS);
              }
            }
          }

          if (runIdRef.current !== runId) return;
          finishActiveEvaluation("COMPLETED");
          return;
        }

        const apiUrl = getEvaluationApiUrl();

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          if (runIdRef.current !== runId) return;

          const batch = batches[batchIndex];
          const batchStartIndex =
            fromIndex +
            batches
              .slice(0, batchIndex)
              .reduce((sum, chunk) => sum + chunk.length, 0);

          const claimNumber = batchStartIndex + 1;
          setActiveEvalStatus(
            `Verifying claim ${claimNumber} of ${inputFacts.length}...`,
            { isWaitingForFirst: batchStartIndex === 0 && batchIndex === 0 },
          );

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ evaluator, facts: batch }),
          });

          if (runIdRef.current !== runId) return;

          const data = (await response.json().catch(() => ({}))) as
            BatchEvaluateResponse & {
              error?: { message?: string } | string;
            };

          if (!response.ok) {
            const message =
              typeof data.error === "string"
                ? data.error
                : data.error?.message ||
                  `Server returned error status ${response.status}.`;
            failActiveEvaluation(message);
            return;
          }

          if (batchIndex === 0 && fromIndex === 0 && data.provider === "groq") {
            appendEvalLog({
              id: "groq-active",
              type: "info",
              text: "Groq connected — open the report anytime to review finished claims.",
            });
          }

          if (!data.facts?.length) {
            failActiveEvaluation("Evaluation server returned no results.");
            return;
          }

          for (let i = 0; i < data.facts.length; i++) {
            const fact = data.facts[i];
            const factId = String(
              fact.id ?? fact.fact_id ?? batch[i]?.fact_id ?? batch[i]?.id ?? "",
            );
            const error =
              data.errors?.find((entry) => entry.factId === factId) ?? null;
            const globalIndex = batchStartIndex + i;
            const normalized = normalizeStreamFact(fact, Boolean(error));
            currentIndexRef.current = globalIndex + 1;
            syncEvaluatedFact(reportId, globalIndex, normalized, error);
          }

          setActiveEvalStatus(
            `Verified ${currentIndexRef.current} / ${inputFacts.length} claims...`,
            { isWaitingForFirst: false },
          );

          if (batchIndex < batches.length - 1) {
            await sleep(CLIENT_BATCH_DELAY_MS);
          }
        }

        if (runIdRef.current !== runId) return;

        if (currentIndexRef.current >= inputFacts.length) {
          finishActiveEvaluation("COMPLETED");
        } else {
          pauseActiveEvaluation(currentIndexRef.current);
        }
      } catch (err: unknown) {
        if (runIdRef.current !== runId) return;

        if (err instanceof DOMException && err.name === "AbortError") {
          if (abortReasonRef.current === "user") {
            pauseActiveEvaluation(currentIndexRef.current);
          }
          return;
        }

        const message =
          err instanceof Error ? err.message : "Unknown network error.";
        failActiveEvaluation(message);
      }
    })();

    return () => {
      // Intentionally do NOT abort on unmount — evaluation continues in background.
    };
  }, [
    activeEvaluation?.isRunning,
    activeEvaluation?.fromIndex,
    activeEvaluation?.reportId,
    activeEvaluation?.evaluator,
    syncEvaluatedFact,
    finishActiveEvaluation,
    failActiveEvaluation,
    pauseActiveEvaluation,
    appendEvalLog,
    setActiveEvalStatus,
    registerEvalAbort,
  ]);

  useEffect(() => {
    if (activeEvaluation) {
      currentIndexRef.current = activeEvaluation.currentIndex;
    }
  }, [activeEvaluation?.currentIndex, activeEvaluation]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  return null;
}
