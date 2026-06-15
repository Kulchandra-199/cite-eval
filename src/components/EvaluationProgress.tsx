"use client";
import React from 'react';
import Link from 'next/link';
import { getEvaluatorLabel } from '@/lib/evaluators';
import { useReports } from '@/context/ReportsContext';
import { Cpu, CheckCircle2, AlertTriangle, Loader2, Pause, Play, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EvaluationProgressProps {
  onViewReport: () => void;
}

export default function EvaluationProgress({ onViewReport }: EvaluationProgressProps) {
  const {
    activeEvaluation,
    pauseEvaluation,
    resumeEvaluation,
  } = useReports();

  if (!activeEvaluation) {
    return null;
  }

  const {
    reportId,
    name,
    evaluator,
    inputFacts,
    currentIndex,
    passedCount,
    failedCount,
    notSureCount,
    errorCount,
    logs,
    fatalError,
    isComplete,
    isPaused,
    isRunning,
    isWaitingForFirst,
    statusLine,
  } = activeEvaluation;

  const total = inputFacts.length;
  const canPause = isRunning && !isComplete && !fatalError;
  const canResume =
    isPaused && !isRunning && !isComplete && !fatalError && currentIndex < total;

  const percent = fatalError
    ? Math.min(100, Math.round((currentIndex / total) * 100))
    : isComplete
      ? 100
      : Math.min(99, Math.round((currentIndex / total) * 100)) || 0;

  return (
    <div className="max-w-2xl mx-auto" id="evaluator-processing-view">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" id="processing-progress-card">
        <div className="p-8 text-center space-y-6">
          {currentIndex > 0 && !isComplete && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-emerald-900">Partial report ready</p>
                  <p className="text-xs text-emerald-800 mt-1">
                    {currentIndex} of {total} claims verified. You can review and edit finished claims while the rest run.
                  </p>
                </div>
                <Link
                  href={`/reports/${reportId}`}
                  onClick={onViewReport}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] uppercase tracking-wider"
                >
                  <ExternalLink className="w-3 h-3" />
                  View report
                </Link>
              </div>
            </div>
          )}

          {fatalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-800">Evaluation stopped</p>
                    <p className="text-xs text-red-700 mt-1">{fatalError}</p>
                    <p className="text-xs text-red-600 mt-1">Partial results were saved — open the report to review.</p>
                  </div>
                </div>
                <Link
                  href={`/reports/${reportId}`}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 bg-white hover:bg-red-50 text-red-800 font-bold rounded text-[10px] uppercase tracking-wider"
                >
                  View report
                </Link>
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
                    {currentIndex} of {total} verified. Resume here or edit the report now.
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
                  <p className="text-sm font-bold text-indigo-900">Waiting for first result</p>
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
              Model <span className="text-indigo-600 font-bold">{getEvaluatorLabel(evaluator)}</span> on {name}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">{statusLine}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {(currentIndex > 0 || fatalError) && (
              <Link
                href={`/reports/${reportId}`}
                onClick={onViewReport}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded text-xs uppercase tracking-wider"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View & edit report
              </Link>
            )}
            {canPause && (
              <button
                type="button"
                onClick={pauseEvaluation}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded text-xs uppercase tracking-wider cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
            )}
            {canResume && (
              <button
                type="button"
                onClick={resumeEvaluation}
                className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs uppercase tracking-wider cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Resume
              </button>
            )}
            {isComplete && (
              <Link
                href={`/reports/${reportId}`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs uppercase tracking-wider"
              >
                Open full report
              </Link>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>{currentIndex} / {total} claims</span>
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
