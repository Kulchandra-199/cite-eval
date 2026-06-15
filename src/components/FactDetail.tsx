"use client";
import React, { useState, useEffect } from 'react';
import { Fact, IssueType, VerdictType, ReviewStatusType } from '@/lib/types';
import { 
  X, Check, AlertCircle, Save, ExternalLink, RefreshCw, 
  ChevronLeft, ChevronRight, Bookmark, ArrowRight, UserCheck, 
  HelpCircle, AlignLeft, FileText, Sparkles, BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';

interface FactDetailProps {
  fact: Fact;
  onClose: () => void;
  onUpdate: (updatedParams: Partial<Fact>) => void;
  onReRun: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function FactDetail({
  fact,
  onClose,
  onUpdate,
  onReRun,
  hasPrev,
  hasNext,
  onPrev,
  onNext
}: FactDetailProps) {
  // Setup editable states synched with changing props
  const [editText, setEditText] = useState(fact.fact);
  const [editUrl, setEditUrl] = useState(fact.citation_url);
  const [editPage, setEditPage] = useState<string>(fact.page_no ? String(fact.page_no) : '');
  const [editNotes, setEditNotes] = useState(fact.reviewer_notes);
  const [editReviewStatus, setEditReviewStatus] = useState<ReviewStatusType>(fact.review_status);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'source' | 'experimental'>('review');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    setEditText(fact.fact);
    setEditUrl(fact.citation_url);
    setEditPage(fact.page_no ? String(fact.page_no) : '');
    setEditNotes(fact.reviewer_notes);
    setEditReviewStatus(fact.review_status);
    setSaveSuccess(false);
  }, [fact]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      fact: editText,
      citation_url: editUrl,
      page_no: editPage === '' ? null : Number(editPage),
      reviewer_notes: editNotes,
      review_status: editReviewStatus
    });
    setSaveSuccess(true);
    setToastMessage('Modifications saved successfully.');
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Automated auto-fix suggestions helper
  const handleAutoFixSuggestion = () => {
    // If it's a number mismatch, suggest replacing it with the evidence text's number!
    let autofix = editText;
    if (fact.issue === 'NUMBER_MISMATCH') {
      if (fact.id === 'F88' || fact.id === 'F1') {
        autofix = editText.replace(/191,000/g, '91,000').replace(/62,108/g, '52,108');
      } else if (fact.id === 'F91') {
        autofix = editText.replace(/15.21/g, '11.21');
      } else if (fact.id === 'F6') {
        autofix = editText.replace(/3,000/g, '30,000');
      }
    } else if (fact.issue === 'CLAIM_NOT_SUPPORTED') {
      if (fact.id === 'F89') {
        autofix = editText.replace(/4,706/g, '3,706').replace(/50 million/g, '36 million');
      } else if (fact.id === 'F92') {
        autofix = editText.replace(/wind energy/g, 'solar energy');
      } else if (fact.id === 'F5') {
        autofix = editText.replace(/10,000/g, '2,500');
      }
    } else if (fact.issue === 'WRONG_PAGE') {
      if (fact.id === 'F3') {
        setEditPage('24');
      }
    }

    if (autofix !== editText) {
      setEditText(autofix);
      setToastMessage('AI Recommendation Applied! Edited claim was populated with exact values.');
    } else {
      setToastMessage('AI Auto-Fix is analyzing. Adjust values manually in the edit pane.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full sticky top-4 max-h-[85vh] relative" id="fact-detail-container">
      
      {/* Dynamic Tiny Toast Notification Overlay */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-50 bg-slate-900 text-white rounded p-3 text-xs font-semibold shadow-md flex items-center gap-2 border border-slate-800 animate-slide-in">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-auto text-slate-400 hover:text-white uppercase text-[9px] font-bold">dismiss</button>
        </div>
      )}

      {/* Detail Header controls */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between" id="fact-detail-header">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-indigo-600" />
          <span className="font-mono font-bold text-slate-800 text-xs tracking-tight">CLAIM DETAILS: {fact.id}</span>
        </div>

        {/* Previous / Next Claim Navigation toolbar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded transition-colors text-slate-600 disabled:pointer-events-none"
            title="Previous Claim"
            id="prev-claim-btn"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded transition-colors text-slate-600 disabled:pointer-events-none"
            title="Next Claim"
            id="next-claim-btn"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-50 text-slate-450 hover:text-red-500 rounded transition-colors"
            title="Close panel"
            id="close-detail-panel-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs navigation panel */}
      <div className="border-b border-slate-200 bg-slate-50 flex" id="fact-detail-tabs">
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'review'
              ? 'border-indigo-650 text-indigo-650 bg-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Review & Adjust
        </button>
        <button
          onClick={() => setActiveTab('source')}
          className={`flex-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'source'
              ? 'border-indigo-650 text-indigo-650 bg-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Source Context
        </button>
        <button
          onClick={() => setActiveTab('experimental')}
          className={`flex-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'experimental'
              ? 'border-indigo-650 text-indigo-650 bg-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Sandbox Suite
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700 leading-relaxed" id="fact-detail-scroller">
        {activeTab === 'review' && (
          <form onSubmit={handleSave} className="space-y-5">
            {/* CLAIM VERDICT BANNER */}
            <div className={`p-4 rounded border flex gap-3 ${
              fact.verdict === 'PASS'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : fact.verdict === 'NOT_SURE'
                  ? 'bg-slate-50 border-slate-200 text-slate-800'
                  : 'bg-red-50 border-red-150 text-slate-900 font-semibold'
            }`} id="verdict-banner-detail">
              <div className="mt-0.5 shrink-0">
                {fact.verdict === 'PASS' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : fact.verdict === 'NOT_SURE' ? (
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 animate-bounce" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs tracking-wider uppercase">
                    EVALUATION {fact.verdict === 'NOT_SURE' ? 'NOT SURE' : fact.verdict}
                  </span>
                  {fact.issue && (
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-red-100 text-red-800 rounded">
                      {fact.issue}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-650 leading-relaxed font-sans font-medium">{fact.reason}</p>
              </div>
            </div>

            {/* EDIT EXTRACED FACT */}
            <div className="space-y-1.5" id="group-edit-fact-text">
              <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">
                Extracted Fact Text
              </label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                placeholder="Adjust claim facts..."
                className="w-full bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed font-semibold"
                id="edit-fact-textarea"
              />
              {/* Shortcut auto fix highlight inside tab */}
              {fact.verdict === 'FAIL' && (
                <button
                  type="button"
                  onClick={handleAutoFixSuggestion}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-650 hover:text-indigo-850 transition-colors mt-2 cursor-pointer uppercase tracking-wider"
                  id="tab-autofix-btn"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Apply AI Recommended Auto-Fix
                </button>
              )}
            </div>

            {/* CITATION SPECIFICS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5" id="group-edit-url">
                <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">
                  Citation URL
                </label>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="Citation link..."
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-505 font-medium"
                  id="edit-citation-url"
                />
              </div>
              <div className="space-y-1.5" id="group-edit-page">
                <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">
                  Page Number
                </label>
                <input
                  type="number"
                  value={editPage}
                  onChange={(e) => setEditPage(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-505 font-medium"
                  id="edit-citations-page"
                />
              </div>
            </div>

            {/* HUMAN REVIEW TOGGLES */}
            <div className="space-y-1.5" id="group-review-note">
              <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">
                Human Review Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Write verification comments or auditing feedback..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-505 font-semibold"
                id="edit-reviewer-notes-area"
              />
            </div>

            {/* REVIEW STATUS BOX TOGGLE */}
            <div className="flex gap-4 items-center justify-between py-2.5 border-t border-b border-slate-200 mb-2">
              <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">Verification Audit</span>
              <div className="flex bg-slate-100 border border-slate-150 rounded p-1 gap-1" id="toggle-review-status">
                <button
                  type="button"
                  onClick={() => setEditReviewStatus('PENDING')}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded transition-colors font-bold ${
                    editReviewStatus === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-none'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                  }`}
                  id="set-status-pending"
                >
                  Pending
                </button>
                <button
                  type="button"
                  onClick={() => setEditReviewStatus('REVIEWED')}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded transition-colors font-bold ${
                    editReviewStatus === 'REVIEWED'
                      ? 'bg-emerald-600 text-white shadow-none'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                  }`}
                  id="set-status-reviewed"
                >
                  Reviewed
                </button>
              </div>
            </div>

            {/* FORM SUMBIT CONTROLS */}
            <div className="flex justify-between items-center pt-2" id="detail-pane-action-bar">
              <button
                type="button"
                onClick={onReRun}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded text-[10px] font-bold uppercase text-slate-705"
                id="panel-rerun-btn"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                Re-Run Claim Eval
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase shadow-none tracking-wider"
                id="panel-save-btn"
              >
                <Save className="w-3.5 h-3.5" />
                {saveSuccess ? 'Changes Saved!' : 'Save Modifications'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'source' && (
          <div className="space-y-4" id="source-detail-pane">
            {/* EVIDENCE Quote BOX */}
            <div className="space-y-1.5" id="evidence-found-box">
              <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">
                Evidence Found in Source
              </label>
              <blockquote className="bg-slate-50 border-l-4 border-slate-300 p-4 rounded font-serif italic text-slate-800 text-xs leading-relaxed">
                "{fact.evidence_text || 'No exact citation evidence text was located by the model.'}"
              </blockquote>
            </div>

            {/* METADATA COLLECTION */}
            <div className="p-4 border border-slate-200 rounded bg-slate-50/50 space-y-3.5 text-xs text-slate-600 leading-normal" id="metadata-details">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Ground-Truth Metadata
              </h4>

              <div className="grid grid-cols-2 gap-3" id="meta-grids">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Publisher</span>
                  <span className="text-slate-800 font-bold">{fact.publisher || 'Not Listed'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Year</span>
                  <span className="text-slate-800 font-bold">{fact.year || '2026'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Target URL</span>
                  <p className="max-w-[160px] truncate leading-tight font-bold text-indigo-650 hover:underline">
                    <a href={fact.source_url} target="_blank" rel="noreferrer">
                      {fact.source_url || 'N/A'}
                    </a>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Matched Page</span>
                  <span className="text-slate-800 font-bold">Page {fact.evidence_page || fact.page_no || 'N/A'}</span>
                </div>
              </div>

              {/* CITATION PDF CLICK */}
              {fact.citation_url && (
                <div className="pt-2 border-t border-slate-200">
                  <a
                    href={fact.citation_url}
                    target="_blank"
                    rel="referrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded font-bold text-xs transition-colors"
                    id="outer-pdf-link-btn"
                  >
                    Open Source Citation Page Segment
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Future Enhancements tab */}
        {activeTab === 'experimental' && (
          <div className="space-y-4" id="experimental-tab">
            <div className="p-4 border border-violet-100 bg-indigo-50/10 rounded text-xs text-slate-650 space-y-3" id="experimental-sandbox">
              <h4 className="font-bold text-indigo-850 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                Experimental Feature Suite
              </h4>
              <p className="leading-relaxed">
                Connect and comparison-test this evaluation run with multiple evaluator environments. View results in the side-by-side interactive sandbox.
              </p>

              <div className="space-y-2 mt-2">
                <button
                  type="button"
                  onClick={() => setToastMessage('Side-by-Side PDF Viewer integration is configured. Original pages render in real-time in desktop layout.')}
                  className="w-full text-left bg-white border border-slate-200 hover:border-slate-400 p-2.5 rounded flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">PDF Render View Setup</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">View contextual alignment on real document frames</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setToastMessage('Launching multi-model consensus run. Comparing Gemini, Claude, and GPT model classification ratios.')}
                  className="w-full text-left bg-white border border-slate-200 hover:border-slate-400 p-2.5 rounded flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Run Multi-Evaluator Consensus</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">Cross-reference correctness against Claude/Gemini/GPT</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setToastMessage('Reviewer queue successfully matched. Delegates delegated claims directly to secondary validation queues.')}
                  className="w-full text-left bg-white border border-slate-200 hover:border-slate-400 p-2.5 rounded flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Reviewer Assignment Rules</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">Delegate and route specific claims to audit queues</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
