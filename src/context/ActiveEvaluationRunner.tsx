"use client";

import { useEffect, useRef } from "react";
import { getEvaluatorLabel } from "@/lib/evaluators";
import { readEvaluationStream } from "@/lib/evaluation-client";
import { normalizeStreamFact } from "@/lib/report-utils";
import { useReports } from "@/context/ReportsContext";
import {
  chunkArray,
  CLIENT_BATCH_SIZE,
  EvaluationStreamEvent,
} from "@/lib/evaluation-config";

/** Runs Groq streaming in the background so evaluation survives page navigation. */
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
        ? "Connecting to Groq..."
        : `Resuming from claim ${fromIndex + 1} of ${inputFacts.length}...`,
      { isWaitingForFirst: fromIndex === 0 && currentIndexRef.current === 0 },
    );

    if (fromIndex === 0) {
      appendEvalLog({
        id: "init",
        type: "info",
        text: `Streaming ${inputFacts.length} claim(s) through Groq (${getEvaluatorLabel(evaluator)})...`,
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
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          if (runIdRef.current !== runId) return;

          const batch = batches[batchIndex];
          const batchStartIndex =
            fromIndex +
            batches
              .slice(0, batchIndex)
              .reduce((sum, chunk) => sum + chunk.length, 0);

          const response = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ evaluator, facts: batch, stream: true }),
          });

          if (runIdRef.current !== runId) return;

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const message =
              typeof data.error === "string"
                ? data.error
                : data.error?.message ||
                  `Server returned error status ${response.status}.`;
            failActiveEvaluation(message);
            return;
          }

          let batchFinished = false;

          await readEvaluationStream(
            response,
            (event: EvaluationStreamEvent) => {
              if (runIdRef.current !== runId) return;

              if (event.type === "meta") {
                const claimNumber = currentIndexRef.current + 1;
                setActiveEvalStatus(
                  `Groq connected — verifying claim ${Math.min(claimNumber, inputFacts.length)} of ${inputFacts.length}...`,
                  { isWaitingForFirst: false },
                );
                if (
                  event.provider === "groq" &&
                  fromIndex === 0 &&
                  batchIndex === 0
                ) {
                  appendEvalLog({
                    id: "groq-active",
                    type: "info",
                    text: "Groq connected — open the report anytime to review finished claims.",
                  });
                }
                return;
              }

              if (event.type === "fatal") {
                failActiveEvaluation(event.error.message);
                return;
              }

              if (event.type === "fact") {
                const globalIndex = batchStartIndex + event.index;
                const normalized = normalizeStreamFact(
                  event.fact,
                  Boolean(event.error),
                );
                currentIndexRef.current = globalIndex + 1;
                syncEvaluatedFact(reportId, globalIndex, normalized, event.error);
                return;
              }

              if (event.type === "done") {
                batchFinished = true;
              }
            },
            controller.signal,
          );

          if (runIdRef.current !== runId) return;

          if (!batchFinished) {
            pauseActiveEvaluation(currentIndexRef.current);
            appendEvalLog({
              id: `batch-interrupted-${batchStartIndex}`,
              type: "info",
              text: `Connection interrupted after ${currentIndexRef.current} / ${inputFacts.length} claims. Resume to continue.`,
            });
            return;
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
