"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database } from "lucide-react";
import { ReportsProvider, useReports } from "@/context/ReportsContext";
import { ActiveEvaluationRunner } from "@/context/ActiveEvaluationRunner";
import { getEvaluatorLabel, DEFAULT_EVALUATOR } from "@/lib/evaluators";

function AppHeader() {
  const pathname = usePathname();
  const { reports } = useReports();

  const isReports =
    pathname === "/" ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/evaluations");
  const isDatasets = pathname.startsWith("/datasets");
  const isSettings = pathname.startsWith("/settings");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-none md:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-600 font-bold text-white">
              C
            </div>
            <div>
              <h1 className="flex items-center gap-1.5 text-base font-bold leading-none tracking-tight text-slate-900">
                CiteEval
              </h1>
              <p className="mt-0.5 font-mono text-[10px] uppercase leading-none tracking-wider text-slate-400">
                Validation Suite
              </p>
            </div>
          </Link>
          <div className="hidden h-4 w-px bg-slate-200 sm:block" />
          <nav className="hidden gap-4 text-xs font-semibold text-slate-500 sm:flex sm:gap-6">
            <Link
              href="/"
              className={`border-b-2 pb-1 transition-colors hover:text-indigo-600 ${
                isReports
                  ? "border-indigo-600 font-bold text-indigo-600"
                  : "border-transparent"
              }`}
            >
              Reports
            </Link>
            <Link
              href="/datasets"
              className={`border-b-2 pb-1 transition-colors hover:text-indigo-600 ${
                isDatasets
                  ? "border-indigo-600 font-bold text-indigo-600"
                  : "border-transparent"
              }`}
            >
              Datasets
            </Link>
            <Link
              href="/settings"
              className={`border-b-2 pb-1 transition-colors hover:text-indigo-600 ${
                isSettings
                  ? "border-indigo-600 font-bold text-indigo-600"
                  : "border-transparent"
              }`}
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs font-semibold">
          <span className="hidden items-center gap-1.5 text-slate-400 md:inline-flex">
            <Database className="h-3.5 w-3.5" />
            Local Storage
          </span>
          <span className="hidden h-4 w-px bg-slate-200 md:inline" />
          <span className="rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600">
            REV v1.4
          </span>
        </div>
      </div>
    </header>
  );
}

function AppFooter() {
  const { reports } = useReports();
  return (
    <footer className="z-30 mt-auto flex h-10 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-900 px-6 font-mono text-[10px] text-slate-400">
      <div className="flex gap-4">
        <span>Persist: Local Storage</span>
        <span>Model: {getEvaluatorLabel(reports[0]?.evaluator ?? DEFAULT_EVALUATOR)}</span>
      </div>
      <div className="flex gap-4 uppercase tracking-tighter">
        <span>Active Queues: {reports.length}</span>
        <span className="text-emerald-400">System Ready</span>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ReportsProvider>
      <ActiveEvaluationRunner />
      <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800 antialiased">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
          {children}
        </main>
        <AppFooter />
      </div>
    </ReportsProvider>
  );
}
