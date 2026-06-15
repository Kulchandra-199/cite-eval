"use client";
import React from 'react';
import { Report } from '@/lib/types';
import { getEvaluatorLabel } from '@/lib/evaluators';
import { Play, Eye, Trash2, Plus, Calendar, Database, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface ReportListProps {
  reports: Report[];
  onViewReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  onReRunReport: (id: string) => void;
  onCreateNewClick: () => void;
}

export default function ReportList({
  reports,
  onViewReport,
  onDeleteReport,
  onReRunReport,
  onCreateNewClick
}: ReportListProps) {
  // Aggregate stats across all reports
  const totalReports = reports.length;
  const totalFacts = reports.reduce((sum, r) => sum + r.factCount, 0);
  const totalPassed = reports.reduce((sum, r) => sum + r.passedCount, 0);
  const totalFailed = reports.reduce((sum, r) => sum + r.failedCount, 0);
  const passRate = totalFacts > 0 ? Math.round((totalPassed / totalFacts) * 100) : 0;

  return (
    <div className="space-y-8" id="report-list-container">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="stats-banner">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between" id="stat-total-runs">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evaluation Runs</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalReports}</h3>
          </div>
          <div className="w-10 h-10 bg-slate-200/60 rounded flex items-center justify-center text-slate-600">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between" id="stat-total-facts">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Claims Checked</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalFacts}</h3>
          </div>
          <div className="w-10 h-10 bg-slate-200/60 rounded flex items-center justify-center text-slate-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-center justify-between" id="stat-passed-ratio">
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Passed</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">
              {totalPassed} <span className="text-xs font-normal text-emerald-500">({passRate}%)</span>
            </h3>
          </div>
          <div className="w-10 h-10 bg-emerald-100 rounded flex items-center justify-center text-emerald-700">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-center justify-between" id="stat-failures-tracked">
          <div>
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest">Failed</p>
            <h3 className="text-2xl font-bold text-red-600 mt-1">{totalFailed}</h3>
          </div>
          <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center text-red-700">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
        </div>
      </div>

      {/* Header and Call to action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" id="runs-list-header">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Citation Evaluation Runs</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track, audit, and clean data extraction outputs using language models.</p>
        </div>
        <button
          onClick={onCreateNewClick}
          id="run-new-eval-btn"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Run New Evaluation
        </button>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" id="reports-table-card">
        {reports.length === 0 ? (
          <div className="py-16 text-center" id="empty-reports-fallback">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">No reports available</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">Create your first citation evaluation run by uploading a facts dataset.</p>
            <button
              onClick={onCreateNewClick}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Run New Evaluation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="reports-list-table">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-3 font-bold">Report Name</th>
                  <th className="px-6 py-3 font-bold">Created At</th>
                  <th className="px-6 py-3 font-bold text-center">Source Count</th>
                  <th className="px-6 py-3 font-bold text-center">Fact Count</th>
                  <th className="px-6 py-3 font-bold text-center text-emerald-700 bg-emerald-50/20">Passed Facts</th>
                  <th className="px-6 py-3 font-bold text-center text-red-750 bg-red-50/20">Failed Facts</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  <th className="px-6 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reports.map((report) => {
                  const dateObject = new Date(report.createdAt);
                  const formattedDate = dateObject.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <motion.tr
                      key={report.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      id={`report-row-${report.id}`}
                    >
                      <td className="px-6 py-4 font-medium text-slate-800 max-w-xs truncate" onClick={() => onViewReport(report.id)}>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                            {report.name}
                          </span>
                          <span className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] uppercase font-mono font-semibold tracking-tight text-slate-500">
                              {getEvaluatorLabel(report.evaluator)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap" onClick={() => onViewReport(report.id)}>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formattedDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-600 whitespace-nowrap" onClick={() => onViewReport(report.id)}>
                        {report.sourceCount}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-slate-900 whitespace-nowrap" onClick={() => onViewReport(report.id)}>
                        {report.factCount}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-emerald-600 font-bold bg-emerald-50/10 whitespace-nowrap" onClick={() => onViewReport(report.id)}>
                        {report.passedCount}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-red-600 font-bold bg-red-50/10 whitespace-nowrap" onClick={() => onViewReport(report.id)}>
                        {report.failedCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={() => onViewReport(report.id)}>
                        {report.status === 'COMPLETED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Success
                          </span>
                        )}
                        {report.status === 'PROCESSING' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 animate-pulse">
                            Evaluating...
                          </span>
                        )}
                        {report.status === 'FAILED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewReport(report.id)}
                            id={`view-btn-${report.id}`}
                            title="View Report"
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onReRunReport(report.id)}
                            id={`rerun-btn-${report.id}`}
                            title="Re-run Evaluation"
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteReport(report.id)}
                            id={`delete-btn-${report.id}`}
                            title="Delete Report"
                            className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
