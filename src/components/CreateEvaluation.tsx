"use client";
import React, { useState, useRef, useEffect } from 'react';
import { EvaluatorModelId } from '@/lib/types';
import { EVALUATOR_OPTIONS, DEFAULT_EVALUATOR, normalizeEvaluatorId } from '@/lib/evaluators';
import { loadCustomDatasets, SavedDataset, parseFactsFromJson } from '@/lib/datasets';
import { Sparkles, ArrowLeft, CheckCircle2, AlertTriangle, Cpu, UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';

interface CreateEvaluationProps {
  onBack: () => void;
  onSubmit: (name: string, evaluator: EvaluatorModelId, datasetFacts: any[]) => void;
}

export default function CreateEvaluation({ onBack, onSubmit }: CreateEvaluationProps) {
  const [evaluationName, setEvaluationName] = useState('');
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('custom');
  const [evaluator, setEvaluator] = useState<EvaluatorModelId>(() =>
    normalizeEvaluatorId(localStorage.getItem('CITATE_EVAL_DEFAULT_EVALUATOR')),
  );
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedDatasets(loadCustomDatasets());
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setJsonError('Only JSON format is supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        // Validate JSON
        const parsed = JSON.parse(text);
        setJsonInput(JSON.stringify(parsed, null, 2));
        setSelectedDatasetId('custom');
        setJsonError(null);
      } catch (err: any) {
        setJsonError(`Invalid JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleJSONAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonInput(val);
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(`Syntax validation failed: ${err.message}`);
    }
  };

  const executeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let targetFacts: Record<string, unknown>[] = [];
    const saved = savedDatasets.find((d) => d.id === selectedDatasetId);
    const finalName =
      evaluationName.trim() ||
      (saved ? `${saved.name} Run` : "Custom Evaluation Run");

    if (saved) {
      targetFacts = saved.facts;
    } else {
      try {
        if (!jsonInput.trim()) {
          setJsonError('Please specify or upload a JSON dataset.');
          return;
        }
        targetFacts = parseFactsFromJson(JSON.parse(jsonInput));

        if (targetFacts.length === 0) {
          setJsonError('No compliant facts structure detected. Ensure format matches the schema.');
          return;
        }
      } catch (err: unknown) {
        setJsonError(`Invalid JSON data: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    onSubmit(finalName, evaluator, targetFacts);
  };

  const populatePlaceholderJSON = () => {
    const placeholder = {
      "source_url": "https://www.example-finance.com/report2026",
      "publisher": "Federal Securities Audit",
      "year": "2026",
      "facts": [
        {
          "fact_id": "F101",
          "fact": "Company cash flows decreased by 18% during the fourth quarter audit run.",
          "citation_url": "https://www.example-finance.com/report2026#page=4",
          "page_no": 4
        },
        {
          "fact_id": "F102",
          "fact": "Asset reserves of the core holding firm remained consistent at $1.2 Billion.",
          "citation_url": "https://www.example-finance.com/report2026#page=12",
          "page_no": 12
        }
      ]
    };
    setJsonInput(JSON.stringify(placeholder, null, 2));
    setSelectedDatasetId('custom');
  };

  return (
    <div className="max-w-3xl mx-auto" id="create-eval-form-view">
      <button
        onClick={onBack}
        id="cancel-create-eval"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-650 font-bold mb-6 cursor-pointer hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Runs
      </button>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" id="create-run-card">
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Run New Citation Evaluation</h2>
            <p className="text-xs text-slate-500 mt-0.5">Validate extracted claims against ground-truth source parameters.</p>
          </div>
        </div>

        <form onSubmit={executeSubmit} className="p-6 space-y-6">
          {/* Evaluation Name */}
          <div className="space-y-1.5" id="group-eval-name">
            <label htmlFor="eval-name-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Evaluation Name
            </label>
            <input
              id="eval-name-input"
              type="text"
              required
              placeholder="e.g. India Infrastructure Budget Audit"
              value={evaluationName}
              onChange={(e) => setEvaluationName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Evaluator Engine */}
            <div className="space-y-1.5" id="group-evaluator">
              <label htmlFor="evaluator-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Evaluator Model
              </label>
              <select
                id="evaluator-select"
                value={evaluator}
                onChange={(e) => setEvaluator(e.target.value as EvaluatorModelId)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {EVALUATOR_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}{opt.recommended ? " (Recommended)" : ""} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Dataset Selection */}
            <div className="space-y-1.5" id="group-dataset-select">
              <label htmlFor="dataset-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-slate-900">
                Dataset Source
              </label>
              <select
                id="dataset-select"
                value={selectedDatasetId}
                onChange={(e) => {
                  setSelectedDatasetId(e.target.value);
                  if (e.target.value !== 'custom') {
                    setJsonError(null);
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {savedDatasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.factsCount} facts)
                  </option>
                ))}
                <option value="custom">Upload JSON dataset…</option>
              </select>
            </div>
          </div>

          {selectedDatasetId === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pt-2 border-t border-slate-100"
                id="custom-json-panel"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    JSON Claims Specification
                  </span>
                  <button
                    type="button"
                    onClick={populatePlaceholderJSON}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                    id="populate-template-btn"
                  >
                    Insert Schema Template
                  </button>
                </div>

                {/* Drag and drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                  }`}
                  id="dropzone"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    className="hidden"
                  />
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-900">Drag/drop dataset file or click to choose</p>
                  <p className="text-xs text-slate-450 mt-1">Supports JSON formatted citation claim structures (.json)</p>
                </div>

                {/* Textarea for JSON */}
                <div className="space-y-1">
                  <textarea
                    rows={8}
                    value={jsonInput}
                    onChange={handleJSONAreaChange}
                    placeholder={`Paste your JSON structure here containing "facts" array.\nSchema example:\n{\n  "facts": [\n    {\n      "fact_id": "F1",\n      "fact": "We loaded 20 tons",\n      "citation_url": "https://..."\n    }\n  ]\n}`}
                    className="w-full bg-mono font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-455"
                    id="json-textarea-input"
                  />
                  {jsonError ? (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-sans font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {jsonError}
                    </p>
                  ) : jsonInput.trim() ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1 font-sans font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      JSON formatting matches parser requirements!
                    </p>
                  ) : null}
                </div>
              </motion.div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-sm font-semibold text-slate-755 hover:text-slate-900 rounded-lg bg-slate-100 hover:bg-slate-200/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedDatasetId === 'custom' && !!jsonError}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer"
              id="start-eval-submit-btn"
            >
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
              Start Evaluation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
