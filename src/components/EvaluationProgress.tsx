"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EvaluatorModelId } from '@/lib/types';
import { getEvaluatorLabel } from '@/lib/evaluators';
import { EvaluationStreamEvent } from '@/lib/evaluation-config';
import { Cpu, CheckCircle2, AlertTriangle, Loader2, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EvaluationProgressProps {
  reportName: string;
  evaluator: EvaluatorModelId;
  facts: any[];
  onComplete: (processedFacts: any[]) => void;
}

interface LogEntry {
  id: string;
  type: 'info' | 'pass' | 'fail' | 'unsure' | 'error';
  text: string;
}

interface EvaluationIssue {
  factId: string;
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

interface VerdictCounts {
  passed: number;
  failed: number;
  notSure: number;
  errors: number;
}

function factLogEntry(
  f: any,
  globalIndex: number,
  matchedError?: EvaluationIssue | null,
): LogEntry {
  const factID = f.id || f.fact_id || `F${globalIndex + 1}`;

  if (matchedError) {
    return {
      id: `${factID}-log-${globalIndex}`,
      type: 'error',
      text: `[${factID}] ERROR: ${matchedError.message}`,
    };
  }

  if (f.verdict === 'PASS') {
    return {
      id: `${factID}-log-${globalIndex}`,
      type: 'pass',
      text: `[${factID}] PASS: Claim matches source context parameters.`,
    };
  }

  if (f.verdict === 'NOT_SURE') {
    return {
      id: `${factID}-log-${globalIndex}`,
      type: 'unsure',
      text: `[${factID}] NOT SURE: ${f.reason || 'Insufficient evidence to verify claim.'}`,
    };
  }

  return {
    id: `${factID}-log-${globalIndex}`,
    type: 'fail',
    text: `[${factID}] FAIL (${f.issue || 'CLAIM_NOT_SUPPORTED'}): ${f.reason}`,
  };
}

function countFromResults(results: any[], errorsByIndex: Map<number, EvaluationIssue>): VerdictCounts {
  let passed = 0;
  let failed = 0;
  let notSure = 0;
  let errors = 0;

  results.forEach((f, i) => {
    if (!f) return;
    if (errorsByIndex.has(i)) {
      errors++;
      notSure++;
    } else if (f.verdict === 'PASS') {
      passed++;
    } else if (f.verdict === 'NOT_SURE') {
      notSure++;
    } else {
      failed++;
    }
  });

  return { passed, failed, notSure, errors };
}

async function readEvaluationStream(
  response: Response,
  onEvent: (event: EvaluationStreamEvent) => void,
  signal?: AbortSignal,
) {
  if (!response.body) {
    throw new Error('No response body from evaluation server.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException('Evaluation aborted.', 'AbortError');
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as EvaluationStreamEvent);
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as EvaluationStreamEvent);
  }
}

export default function EvaluationProgress({
  reportName,
  evaluator,
  facts,
  onComplete
}: EvaluationProgressProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [notSureCount, setNotSureCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingForFirst, setIsWaitingForFirst] = useState(false);
  const [statusLine, setStatusLine] = useState('Ready to start...');

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<any[]>([]);
  const errorsRef = useRef<Map<number, EvaluationIssue>>(new Map());
  const runIdRef = useRef(0);
  const startedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const syncCounts = useCallback(() => {
    const counts = countFromResults(resultsRef.current, errorsRef.current);
    setPassedCount(counts.passed);
    setFailedCount(counts.failed);
    setNotSureCount(counts.notSure);
    setErrorCount(counts.errors);
  }, []);

  const finishEvaluation = useCallback(() => {
    const completed = resultsRef.current.filter(Boolean);
    setIsComplete(true);
    setIsRunning(false);
    setIsPaused(false);
    setIsWaitingForFirst(false);
    setStatusLine(`All ${facts.length} claims processed.`);
    setTimeout(() => {
      onCompleteRef.current(completed);
    }, 400);
  }, [facts.length]);

  const runEvaluation = useCallback(async (fromIndex: number) => {
    const runId = ++runIdRef.current;
    const remaining = facts.slice(fromIndex);

    if (remaining.length === 0) {
      finishEvaluation();
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setIsPaused(false);
    setIsWaitingForFirst(fromIndex === 0 && currentIndex === 0);
    setFatalError(null);
    setStatusLine(
      fromIndex === 0
        ? 'Connecting to Groq...'
        : `Resuming from claim ${fromIndex + 1} of ${facts.length}...`
    );

    if (fromIndex === 0 && resultsRef.current.length === 0) {
      setLogs([{
        id: 'init',
        type: 'info',
        text: `Streaming ${facts.length} claim(s) through Groq (${getEvaluatorLabel(evaluator)})...`
      }]);
    } else if (fromIndex > 0) {
      setLogs(prev => [
        {
          id: `resume-${fromIndex}-${Date.now()}`,
          type: 'info',
          text: `▶ Resumed — ${remaining.length} claim(s) remaining.`
        },
        ...prev
      ]);
    }

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ evaluator, facts: remaining, stream: true }),
      });

      if (runIdRef.current !== runId) return;

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || `Server returned error status ${response.status}.`;
        setFatalError(message);
        setIsRunning(false);
        setIsWaitingForFirst(false);
        setStatusLine('Evaluation stopped.');
        setLogs(prev => [
          { id: 'critical-err', type: 'error', text: `Evaluation failed: ${message}` },
          ...prev
        ]);
        return;
      }

      let streamFinished = false;

      await readEvaluationStream(
        response,
        (event) => {
          if (runIdRef.current !== runId) return;

          if (event.type === 'meta') {
            setStatusLine(
              fromIndex === 0
                ? `Groq connected — verifying claim 1 of ${facts.length}...`
                : `Groq connected — verifying claim ${fromIndex + 1} of ${facts.length}...`
            );
            if (event.provider === 'offline' && fromIndex === 0) {
              setLogs(prev => [
                {
                  id: 'fallback-warn',
                  type: 'info',
                  text: 'Running in offline local mode: no GROQ_API_KEY or GEMINI_API_KEY configured.'
                },
                ...prev
              ]);
            } else if (event.provider === 'groq' && fromIndex === 0) {
              setLogs(prev => [
                {
                  id: 'groq-active',
                  type: 'info',
                  text: 'Groq connected — results appear as each claim is verified.'
                },
                ...prev
              ]);
            }
            return;
          }

          if (event.type === 'fatal') {
            setFatalError(event.error.message);
            setIsRunning(false);
            setIsWaitingForFirst(false);
            setStatusLine('Evaluation stopped.');
            setLogs(prev => [
              { id: 'fatal-err', type: 'error', text: event.error.message },
              ...prev
            ]);
            return;
          }

          if (event.type === 'fact') {
            setIsWaitingForFirst(false);
            const globalIndex = fromIndex + event.index;
            resultsRef.current[globalIndex] = event.fact;

            if (event.error) {
              errorsRef.current.set(globalIndex, event.error);
            } else {
              errorsRef.current.delete(globalIndex);
            }

            syncCounts();

            const nextIndex = globalIndex + 1;
            currentIndexRef.current = nextIndex;
            setCurrentIndex(nextIndex);
            setStatusLine(
              nextIndex >= facts.length
                ? `All ${facts.length} claims processed.`
                : `Verified ${nextIndex} / ${facts.length} — waiting on claim ${nextIndex + 1}...`
            );
            setLogs(prev => [factLogEntry(event.fact, globalIndex, event.error), ...prev]);
            return;
          }

          if (event.type === 'done') {
            streamFinished = true;
            if (event.errors.length > 0) {
              setLogs(prev => [
                {
                  id: `errors-${fromIndex}`,
                  type: 'error',
                  text: `${event.errors.length} claim(s) in this segment had API errors.`
                },
                ...prev
              ]);
            }
          }
        },
        controller.signal,
      );

      if (runIdRef.current !== runId) return;

      if (streamFinished) {
        finishEvaluation();
      }
    } catch (err: unknown) {
      if (runIdRef.current !== runId) return;

      if (err instanceof DOMException && err.name === 'AbortError') {
        const pausedAt = currentIndexRef.current;
        setIsRunning(false);
        setIsPaused(true);
        setIsWaitingForFirst(false);
        setStatusLine(`Paused at ${pausedAt} / ${facts.length} claims.`);
        setLogs(prev => [
          {
            id: `paused-${Date.now()}`,
            type: 'info',
            text: `⏸ Paused — ${pausedAt} of ${facts.length} claim(s) verified. Press Resume to continue.`
          },
          ...prev
        ]);
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Unknown network error.';
      setFatalError(message);
      setIsRunning(false);
      setIsWaitingForFirst(false);
      setStatusLine('Evaluation stopped.');
      setLogs(prev => [
        {
          id: 'critical-err',
          type: 'error',
          text: `Could not reach evaluation server: ${message}`
        },
        ...prev
      ]);
    }
  }, [evaluator, facts, finishEvaluation, syncCounts]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    resultsRef.current = new Array(facts.length);
    errorsRef.current = new Map();
    runEvaluation(0);

    return () => {
      runIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [facts.length, runEvaluation]);

  const handlePause = () => {
    if (!isRunning || isComplete || fatalError) return;
    abortRef.current?.abort();
  };

  const handleResume = () => {
    if (isRunning || isComplete || fatalError) return;
    runEvaluation(currentIndexRef.current);
  };

  const canPause = isRunning && !isComplete && !fatalError;
  const canResume = isPaused && !isRunning && !isComplete && !fatalError && currentIndex < facts.length;

  const percent = fatalError
    ? Math.min(100, Math.round((currentIndex / facts.length) * 100))
    : isComplete
      ? 100
      : Math.min(99, Math.round((currentIndex / facts.length) * 100)) || 0;

  return (
    <div className="max-w-2xl mx-auto" id="evaluator-processing-view">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" id="processing-progress-card">
        <div className="p-8 text-center space-y-6">
          {fatalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-800">Evaluation failed</p>
                  <p className="text-xs text-red-700 mt-1">{fatalError}</p>
                </div>
              </div>
            </div>
          )}

          {isPaused && !fatalError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left">
              <div className="flex items-start gap-2">
                <Pause className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Evaluation paused</p>
                  <p className="text-xs text-amber-800 mt-1">
                    {currentIndex} of {facts.length} claims verified. Press Resume to continue from claim {currentIndex + 1}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isWaitingForFirst && isRunning && !fatalError && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-left">
              <div className="flex items-start gap-2">
                <Loader2 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 animate-spin" />
                <div>
                  <p className="text-sm font-bold text-indigo-900">Waiting for next result</p>
                  <p className="text-xs text-indigo-700 mt-1">{statusLine}</p>
                </div>
              </div>
            </div>
          )}

          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded relative mb-1">
            {fatalError ? (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            ) : isComplete ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : isPaused ? (
              <Pause className="w-6 h-6 text-amber-600" />
            ) : (
              <Cpu className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
            )}
            {isRunning && !fatalError && !isComplete && (
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-indigo-600 animate-pulse"></span>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {fatalError
                ? 'Evaluation Stopped'
                : isComplete
                  ? 'Evaluation Complete'
                  : isPaused
                    ? 'Evaluation Paused'
                    : 'Evaluating Citations'}
            </h2>
            <p className="text-xs text-slate-500 font-mono font-semibold">
              Model <span className="text-indigo-600 font-bold">{getEvaluatorLabel(evaluator)}</span> on {reportName}
            </p>
            {!fatalError && (
              <p className="text-[10px] text-slate-400 font-mono">{statusLine}</p>
            )}
          </div>

          {!isComplete && !fatalError && (
            <div className="flex justify-center gap-3">
              {canPause && (
                <button
                  type="button"
                  onClick={handlePause}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded text-xs uppercase tracking-wider cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </button>
              )}
              {canResume && (
                <button
                  type="button"
                  onClick={handleResume}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs uppercase tracking-wider cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>{currentIndex} / {facts.length} claims</span>
              <span>{percent}% Completed</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${
                  fatalError
                    ? 'bg-red-500'
                    : isPaused
                      ? 'bg-amber-400'
                      : isWaitingForFirst
                        ? 'bg-indigo-400 animate-pulse'
                        : 'bg-indigo-600'
                }`}
                style={{ width: `${percent}%` }}
                layoutId="progress-gauge"
              ></motion.div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
            <div className="text-center border-r border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wide">Pass</span>
              <span className="text-lg font-bold text-emerald-600 mt-1 block">{passedCount}</span>
            </div>
            <div className="text-center border-r border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wide">Fail</span>
              <span className="text-lg font-bold text-red-600 mt-1 block">{failedCount}</span>
            </div>
            <div className="text-center border-r border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wide">Not sure</span>
              <span className="text-lg font-bold text-slate-600 mt-1 block">{notSureCount}</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wide">Errors</span>
              <span className="text-lg font-bold text-amber-600 mt-1 block">{errorCount}</span>
            </div>
          </div>

          <div className="space-y-1.5 text-left border border-slate-200 rounded-lg bg-slate-50 p-4 font-mono text-[11px] text-slate-700 max-h-56 overflow-y-auto flex flex-col-reverse" id="processing-logs-window">
            <AnimatePresence initial={false}>
              {logs.slice(0, 25).map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`${
                    log.type === 'pass'
                      ? 'text-emerald-600 font-semibold'
                      : log.type === 'fail'
                        ? 'text-red-600 font-semibold'
                        : log.type === 'error'
                          ? 'text-amber-700 font-semibold'
                          : log.type === 'unsure'
                            ? 'text-slate-600 font-semibold'
                            : 'text-slate-400 font-semibold'
                  }`}
                >
                  {log.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
