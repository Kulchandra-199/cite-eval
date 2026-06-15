"use client";
import React, { useEffect, useState } from 'react';
import { EvaluatorModelId } from '@/lib/types';
import { getEvaluatorLabel } from '@/lib/evaluators';
import { EvaluationStreamEvent } from '@/lib/evaluation-config';
import { Cpu, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
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

async function readEvaluationStream(
  response: Response,
  onEvent: (event: EvaluationStreamEvent) => void,
) {
  if (!response.body) {
    throw new Error('No response body from evaluation server.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
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
  const [isWaitingForFirst, setIsWaitingForFirst] = useState(true);
  const [statusLine, setStatusLine] = useState('Connecting to Groq...');

  useEffect(() => {
    let active = true;

    async function runLiveEvaluation() {
      setLogs([{
        id: 'init',
        type: 'info',
        text: `Streaming ${facts.length} claim(s) through Groq (${getEvaluatorLabel(evaluator)})...`
      }]);

      const allResults: any[] = new Array(facts.length);
      let pCount = 0;
      let fCount = 0;
      let uCount = 0;
      let eCount = 0;

      try {
        const response = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evaluator, facts, stream: true }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message =
            typeof data.error === 'string'
              ? data.error
              : data.error?.message || `Server returned error status ${response.status}.`;
          if (!active) return;
          setFatalError(message);
          setIsWaitingForFirst(false);
          setStatusLine('Evaluation stopped.');
          setLogs(prev => [
            { id: 'critical-err', type: 'error', text: `Evaluation failed: ${message}` },
            ...prev
          ]);
          return;
        }

        await readEvaluationStream(response, (event) => {
          if (!active) return;

          if (event.type === 'meta') {
            setStatusLine(`Groq connected — verifying claim 1 of ${event.total}...`);
            if (event.provider === 'offline') {
              setLogs(prev => [
                {
                  id: 'fallback-warn',
                  type: 'info',
                  text: 'Running in offline local mode: no GROQ_API_KEY or GEMINI_API_KEY configured.'
                },
                ...prev
              ]);
            } else if (event.provider === 'groq') {
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
            allResults[event.index] = event.fact;

            const log = factLogEntry(event.fact, event.index, event.error);
            if (event.error) {
              eCount++;
              uCount++;
              setErrorCount(eCount);
              setNotSureCount(uCount);
            } else if (event.fact.verdict === 'PASS') {
              pCount++;
              setPassedCount(pCount);
            } else if (event.fact.verdict === 'NOT_SURE') {
              uCount++;
              setNotSureCount(uCount);
            } else {
              fCount++;
              setFailedCount(fCount);
            }

            const nextIndex = event.index + 1;
            setCurrentIndex(nextIndex);
            setStatusLine(
              nextIndex >= facts.length
                ? `All ${facts.length} claims processed.`
                : `Verified ${nextIndex} / ${facts.length} — waiting on claim ${nextIndex + 1}...`
            );
            setLogs(prev => [log, ...prev]);
            return;
          }

          if (event.type === 'done') {
            if (event.errors.length > 0) {
              setLogs(prev => [
                {
                  id: 'api-errors-summary',
                  type: 'error',
                  text: `${event.errors.length} claim(s) could not be verified due to API errors.`
                },
                ...prev
              ]);
            }
          }
        });

        if (!active) return;

        const completed = allResults.filter(Boolean);
        setIsComplete(true);
        setIsWaitingForFirst(false);
        setStatusLine(`All ${facts.length} claims processed.`);

        setTimeout(() => {
          if (active) onComplete(completed);
        }, 400);

      } catch (err: unknown) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : 'Unknown network error.';
        setFatalError(message);
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
    }

    runLiveEvaluation();

    return () => {
      active = false;
    };
  }, [facts, evaluator, reportName, onComplete]);

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

          {isWaitingForFirst && !fatalError && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-left">
              <div className="flex items-start gap-2">
                <Loader2 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 animate-spin" />
                <div>
                  <p className="text-sm font-bold text-indigo-900">Waiting for first result</p>
                  <p className="text-xs text-indigo-700 mt-1">{statusLine}</p>
                  <p className="text-[10px] text-indigo-500 mt-1 font-mono">
                    First claim typically returns in 1–3 seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded relative mb-1">
            {fatalError ? (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            ) : isComplete ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <Cpu className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
            )}
            {!fatalError && !isComplete && (
              <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-indigo-600 animate-pulse"></span>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {fatalError ? 'Evaluation Stopped' : isComplete ? 'Evaluation Complete' : 'Evaluating Citations'}
            </h2>
            <p className="text-xs text-slate-500 font-mono font-semibold">
              Model <span className="text-indigo-600 font-bold">{getEvaluatorLabel(evaluator)}</span> on {reportName}
            </p>
            {!fatalError && (
              <p className="text-[10px] text-slate-400 font-mono">{statusLine}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>{currentIndex} / {facts.length} claims</span>
              <span>{percent}% Completed</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${fatalError ? 'bg-red-500' : isWaitingForFirst ? 'bg-indigo-400 animate-pulse' : 'bg-indigo-600'}`}
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
