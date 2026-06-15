"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Report, Fact, IssueType, VerdictType, ReviewStatusType } from '@/lib/types';
import { getEvaluatorLabel } from '@/lib/evaluators';
import { useReports } from '@/context/ReportsContext';
import { 
  ArrowLeft, Search, Filter, HelpCircle, ArrowRight, CheckCircle2, 
  XCircle, ChevronLeft, ChevronRight, FileJson, FileSpreadsheet, 
  FileCode, Play, CheckSquare, RefreshCw, Eye, ExternalLink, BookOpen, 
  Info, Check, Download, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FactDetail from '@/components/FactDetail';

interface ReportDetailProps {
  report: Report;
  isLiveEvaluating?: boolean;
  onBack: () => void;
  onUpdateFact: (factId: string, updatedParams: Partial<Fact>) => void;
  onBulkUpdate: (factIds: string[], updatedParams: Partial<Fact>) => void;
  onReRunFact: (factId: string) => void;
}

export default function ReportDetail({
  report,
  isLiveEvaluating = false,
  onBack,
  onUpdateFact,
  onBulkUpdate,
  onReRunFact
}: ReportDetailProps) {
  const router = useRouter();
  const { resumeInterruptedReport } = useReports();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'NOT_SURE' | 'REVIEWED' | 'NOT_REVIEWED'>('ALL');
  const [issueFilter, setIssueFilter] = useState<IssueType | 'ALL'>('ALL');
  
  // Table pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected fact for detail panel
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);

  // Checkbox selection state
  const [selectedFactIds, setSelectedFactIds] = useState<string[]>([]);

  // Find active fact object
  const activeFact = report.facts.find(f => f.id === selectedFactId) || null;

  // Filter items
  const filteredFacts = report.facts.filter((fact) => {
    // Search filter
    const matchesSearch = 
      fact.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fact.fact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fact.reason && fact.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'PASSED') matchesStatus = fact.verdict === 'PASS';
    else if (statusFilter === 'FAILED') matchesStatus = fact.verdict === 'FAIL';
    else if (statusFilter === 'NOT_SURE') matchesStatus = fact.verdict === 'NOT_SURE';
    else if (statusFilter === 'REVIEWED') matchesStatus = fact.review_status === 'REVIEWED';
    else if (statusFilter === 'NOT_REVIEWED') matchesStatus = fact.review_status === 'PENDING';

    // Issue filter
    let matchesIssue = true;
    if (issueFilter !== 'ALL') {
      matchesIssue = fact.issue === issueFilter;
    }

    return matchesSearch && matchesStatus && matchesIssue;
  });

  // Calculate stats dynamically based on current state of facts
  const totalCount = report.facts.length;
  const evaluatedFacts = report.facts.filter((f) => f.evaluationStatus !== "PENDING");
  const pendingEvalCount = report.facts.filter((f) => f.evaluationStatus === "PENDING").length;
  const isStuckProcessing =
    report.status === "PROCESSING" && !isLiveEvaluating && pendingEvalCount > 0;
  const passedCount = evaluatedFacts.filter(f => f.verdict === 'PASS').length;
  const failedCount = evaluatedFacts.filter(f => f.verdict === 'FAIL').length;
  const notSureCount = evaluatedFacts.filter(f => f.verdict === 'NOT_SURE').length;
  const pendingReviewCount = report.facts.filter(f => f.review_status === 'PENDING').length;
  const reviewedCount = report.facts.filter(f => f.review_status === 'REVIEWED').length;

  // Pagination bounds
  const totalPages = Math.ceil(filteredFacts.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFacts = filteredFacts.slice(startIndex, startIndex + itemsPerPage);

  // Check/Uncheck functions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedFacts.map(f => f.id);
      setSelectedFactIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = paginatedFacts.map(f => f.id);
      setSelectedFactIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleRowSelect = (factId: string) => {
    setSelectedFactIds(prev => 
      prev.includes(factId) 
        ? prev.filter(id => id !== factId) 
        : [...prev, factId]
    );
  };

  // Export handlers
  const handleExportJSON = (targetList: Fact[], filename = 'citation-run.json') => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = (targetList: Fact[], filename = 'citation-run.csv') => {
    const csvRows = [
      ['Fact ID', 'Fact Text', 'Verdict', 'Issue Type', 'Evaluator Reason', 'Source Publisher', 'Source URL', 'Page Number', 'Review Status', 'Reviewer Notes']
    ];

    targetList.forEach(f => {
      csvRows.push([
        f.id,
        f.fact.replace(/"/g, '""'),
        f.verdict,
        f.issue || 'NONE',
        (f.reason || '').replace(/"/g, '""'),
        f.publisher,
        f.source_url,
        f.page_no ? String(f.page_no) : 'N/A',
        f.review_status,
        (f.reviewer_notes || '').replace(/"/g, '""')
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportExcel = (targetList: Fact[], filename = 'citation-run-excel.csv') => {
    // Generate styled/tab-delimited Excel-readable CSV
    handleExportCSV(targetList, filename);
  };

  const handleBulkMarkReviewed = () => {
    if (selectedFactIds.length === 0) return;
    onBulkUpdate(selectedFactIds, { review_status: 'REVIEWED' });
    setSelectedFactIds([]);
  };

  const handleBulkReRun = () => {
    if (selectedFactIds.length === 0) return;
    // Simulate rerunning on specific ones (making some randomly recover, or keep them original)
    // To make it functional, just execute a rerun refresh
    selectedFactIds.forEach(id => {
      onReRunFact(id);
    });
    setSelectedFactIds([]);
  };

  const handlePrevFactDetail = () => {
    if (!selectedFactId) return;
    const currentIndexInReport = report.facts.findIndex(f => f.id === selectedFactId);
    if (currentIndexInReport > 0) {
      setSelectedFactId(report.facts[currentIndexInReport - 1].id);
    }
  };

  const handleNextFactDetail = () => {
    if (!selectedFactId) return;
    const currentIndexInReport = report.facts.findIndex(f => f.id === selectedFactId);
    if (currentIndexInReport < report.facts.length - 1) {
      setSelectedFactId(report.facts[currentIndexInReport + 1].id);
    }
  };

  return (
    <div className="space-y-6" id="report-detail-layout">
      {/* Back navigation & Export Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <button
          onClick={onBack}
          id="back-list-btn"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-650 font-bold cursor-pointer hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Runs
        </button>

        <div className="flex items-center gap-2 self-stretch sm:self-auto" id="report-exports-group">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2 hidden md:inline">
            Export Report:
          </span>
          <button
            onClick={() => handleExportJSON(report.facts, `${report.name.toLowerCase().replace(/\s+/g, '-')}-run.json`)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 transition-colors"
            id="export-json-btn"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-500" />
            JSON
          </button>
          <button
            onClick={() => handleExportCSV(report.facts, `${report.name.toLowerCase().replace(/\s+/g, '-')}-run.csv`)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 transition-colors"
            id="export-csv-btn"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            CSV
          </button>
          <button
            onClick={() => handleExportExcel(report.facts, `${report.name.toLowerCase().replace(/\s+/g, '-')}-run-excel.csv`)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 transition-colors"
            id="export-excel-btn"
          >
            <FileJson className="w-3.5 h-3.5 text-indigo-600" />
            Excel
          </button>
        </div>
      </div>

      {(isLiveEvaluating || report.status === 'PROCESSING') && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-indigo-900">Evaluation in progress</p>
            <p className="text-xs text-indigo-700 mt-0.5">
              {evaluatedFacts.length} of {totalCount} claims verified.
              {pendingEvalCount > 0
                ? ` You can review and edit finished claims while the rest are processed.`
                : ''}
            </p>
          </div>
          {isLiveEvaluating ? (
            <Link
              href="/evaluations/progress"
              className="shrink-0 inline-flex items-center justify-center px-3 py-1.5 border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] uppercase tracking-wider"
            >
              View progress
            </Link>
          ) : isStuckProcessing ? (
            <button
              type="button"
              onClick={() => {
                resumeInterruptedReport(report.id);
                router.push("/evaluations/progress");
              }}
              className="shrink-0 inline-flex items-center justify-center px-3 py-1.5 border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] uppercase tracking-wider cursor-pointer"
            >
              Resume evaluation
            </button>
          ) : null}
        </div>
      )}

      {/* Header Cards (Dashboard Metadata Stats) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-none" id="detail-header-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{report.name}</h2>
            <p className="text-xs text-slate-400 font-mono font-semibold mt-0.5">
              Verified by <span className="text-indigo-600 font-bold">{getEvaluatorLabel(report.evaluator)}</span> on{' '}
              {new Date(report.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap" id="header-metrics">
            <div className="px-4 py-2 bg-slate-50 border border-slate-150 rounded text-center min-w-[70px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Checked</span>
              <span className="text-base font-bold text-slate-800 mt-0.5 block">{totalCount}</span>
            </div>
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded text-center min-w-[70px]">
              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest block">Passed</span>
              <span className="text-base font-bold text-emerald-600 mt-0.5 block">{passedCount}</span>
            </div>
            <div className="px-4 py-2 bg-red-50 border border-red-100 rounded text-center min-w-[70px]">
              <span className="text-[10px] text-red-700 font-bold uppercase tracking-widest block">Failed</span>
              <span className="text-base font-bold text-red-600 mt-0.5 block">{failedCount}</span>
            </div>
            <div className="px-4 py-2 bg-slate-100 border border-slate-200 rounded text-center min-w-[70px]">
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest block">Not Sure</span>
              <span className="text-base font-bold text-slate-700 mt-0.5 block">{notSureCount}</span>
            </div>
            <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded text-center min-w-[70px]">
              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest block">Queued</span>
              <span className="text-base font-bold text-amber-600 mt-0.5 block">{pendingEvalCount}</span>
            </div>
            <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded text-center min-w-[70px]">
              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest block">Review</span>
              <span className="text-base font-bold text-amber-600 mt-0.5 block">{pendingReviewCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Core Layout: Split screen or full-width table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="split-workspace">
        {/* Left pane: Table and Filters */}
        <div className={`space-y-4 ${selectedFactId ? 'lg:col-span-7' : 'lg:col-span-12'}`} id="left-table-pane">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 gap-4 flex flex-col md:flex-row md:items-center justify-between shadow-none" id="filters-card">
            {/* Keyword search filter */}
            <div className="relative flex-1" id="group-search-facts">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search Fact ID, keywords, or claim..."
                className="w-full pl-9.5 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Dropdown status filters */}
            <div className="flex items-center gap-3 flex-wrap" id="selectors-container">
              <div className="flex items-center gap-1.5" id="group-filter-status">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 text-xs font-bold text-slate-700 px-2.5 py-1.5 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PASSED">Passed Facts</option>
                  <option value="FAILED">Failed Facts</option>
                  <option value="NOT_SURE">Not Sure Facts</option>
                  <option value="REVIEWED">Reviewed Only</option>
                  <option value="NOT_REVIEWED">Not Reviewed Only</option>
                </select>
              </div>

              {/* Dropdown issue types filters */}
              <div className="flex items-center gap-1.5" id="group-filter-issues">
                <select
                  value={issueFilter}
                  onChange={(e) => {
                    setIssueFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 text-xs font-bold text-slate-700 px-2.5 py-1.5 rounded focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Issue Types</option>
                  <option value="NUMBER_MISMATCH">Number Mismatches</option>
                  <option value="CLAIM_NOT_SUPPORTED">Claim Unsupported</option>
                  <option value="CITATION_NOT_FOUND">Citation Missing</option>
                  <option value="WRONG_PAGE">Wrong Pages</option>
                  <option value="OTHER">Other Issues</option>
                </select>
              </div>
            </div>
          </div>

          {/* BULK ACTIONS TOOLBAR */}
          <AnimatePresence>
            {selectedFactIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-slate-900 text-white rounded px-4 py-3 flex items-center justify-between text-xs font-semibold border border-slate-800"
                id="bulk-actions-toolbar"
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  <span>Selected {selectedFactIds.length} claims</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkMarkReviewed}
                    className="hover:bg-white/10 px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors text-slate-300 hover:text-white"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Mark Reviewed
                  </button>
                  <button
                    onClick={handleBulkReRun}
                    className="hover:bg-white/10 px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors text-slate-300 hover:text-white"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin-reverse" />
                    Re-run Eval
                  </button>
                  <button
                    onClick={() => {
                      const list = report.facts.filter(f => selectedFactIds.includes(f.id));
                      handleExportCSV(list, `selected-citations.csv`);
                    }}
                    className="hover:bg-white/10 px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors text-slate-300 hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FACTS TABLE */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-none" id="table-container">
            {filteredFacts.length === 0 ? (
              <div className="py-12 text-center" id="empty-filtered-fallback">
                <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-900">No matching claims found</h4>
                <p className="text-xs text-slate-400 mt-0.5">Try widening your search terms or adjustments.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse" id="report-facts-table">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-center w-8">
                      <input
                        type="checkbox"
                        checked={paginatedFacts.every(f => selectedFactIds.includes(f.id))}
                        onChange={handleSelectAll}
                        className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        id="checkbox-select-all"
                      />
                    </th>
                    <th className="px-4 py-3 font-bold w-16">Fact ID</th>
                    <th className="px-4 py-3 font-bold">Fact Description</th>
                    <th className="px-4 py-3 font-bold text-center w-20">Verdict</th>
                    <th className="px-4 py-3 font-bold w-24">Issue Type</th>
                    <th className="px-4 py-3 font-bold text-center w-12">Page</th>
                    <th className="px-4 py-3 font-bold text-center w-24">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedFacts.map((fact) => {
                    const isSelected = selectedFactId === fact.id;
                    const isCheked = selectedFactIds.includes(fact.id);

                    return (
                      <tr
                        key={fact.id}
                        id={`fact-row-${fact.id}`}
                        onClick={() => setSelectedFactId(fact.id)}
                        className={`cursor-pointer transition-colors group ${
                          isSelected 
                            ? 'bg-indigo-50 hover:bg-indigo-100/80' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isCheked}
                            onChange={() => handleRowSelect(fact.id)}
                            className="rounded-sm border-slate-300 text-indigo-650 focus:ring-indigo-500"
                            id={`checkbox-${fact.id}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {fact.id}
                        </td>
                        <td className="px-4 py-3 max-w-sm">
                          <p className="line-clamp-2 text-slate-700 leading-relaxed font-semibold font-sans">
                            {fact.fact}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {fact.evaluationStatus === 'PENDING' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700 border border-indigo-200 animate-pulse">
                              QUEUED
                            </span>
                          ) : fact.verdict === 'PASS' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                              PASS
                            </span>
                          ) : fact.verdict === 'NOT_SURE' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                              NOT SURE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-00 border border-red-200 animate-pulse">
                              FAIL
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {fact.issue ? (
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] border tracking-wide uppercase ${
                              fact.issue === 'NUMBER_MISMATCH' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                              fact.issue === 'CLAIM_NOT_SUPPORTED' ? 'bg-red-100 text-red-800 border-red-200' :
                              fact.issue === 'CITATION_NOT_FOUND' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              fact.issue === 'WRONG_PAGE' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                              'bg-slate-100 text-slate-800 border-slate-200'
                            }`}>
                              {fact.issue}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-600 whitespace-nowrap">
                          {fact.page_no || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {fact.review_status === 'REVIEWED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Reviewed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500">
                              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION GRAPHICS CONTROLS */}
          {filteredFacts.length > itemsPerPage && (
            <div className="flex justify-between items-center bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-none font-mono text-xs" id="pagination-footer">
              <span className="text-slate-400">
                Page <strong className="text-slate-800">{currentPage}</strong> of <strong className="text-slate-800">{totalPages}</strong> ({filteredFacts.length} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-650 disabled:opacity-30 disabled:pointer-events-none"
                  id="pagination-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-650 disabled:opacity-30 disabled:pointer-events-none"
                  id="pagination-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right pane: Sliding Workspace Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedFactId && activeFact && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-5 h-full"
              id="right-details-pane"
            >
              <FactDetail
                fact={activeFact}
                onClose={() => setSelectedFactId(null)}
                onUpdate={(params) => onUpdateFact(activeFact.id, params)}
                onReRun={() => onReRunFact(activeFact.id)}
                hasPrev={report.facts.findIndex(f => f.id === selectedFactId) > 0}
                hasNext={report.facts.findIndex(f => f.id === selectedFactId) < report.facts.length - 1}
                onPrev={handlePrevFactDetail}
                onNext={handleNextFactDetail}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
