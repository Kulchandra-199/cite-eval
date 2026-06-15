"use client";
import React, { useState, useEffect } from 'react';
import { Database, Copy, FileText, Link2, Sparkles, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  loadCustomDatasets,
  saveCustomDatasets,
  parseFactsFromJson,
  SavedDataset,
} from '@/lib/datasets';

interface DatasetsViewProps {
  onBack: () => void;
  onEvaluateDataset: (name: string, facts: any[]) => void;
}

export default function DatasetsView({ onBack, onEvaluateDataset }: DatasetsViewProps) {
  const [datasets, setDatasets] = useState<SavedDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<SavedDataset | null>(null);
  const [copiedDatasetId, setCopiedDatasetId] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const customList = loadCustomDatasets().map((d) => ({ ...d, isCustom: true }));
    setDatasets(customList);
    setSelectedDataset(customList[0] || null);
  }, []);

  const handleCopyJSON = (dataset: SavedDataset) => {
    navigator.clipboard.writeText(JSON.stringify(dataset.facts, null, 2));
    setCopiedDatasetId(dataset.id);
    setToastMessage(`Copied JSON structure of "${dataset.name}"`);
    setTimeout(() => setCopiedDatasetId(null), 2000);
  };

  const handleSaveCustomDataset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonInput.trim()) {
      setUploadError('Please paste your JSON structure.');
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      const factsArray = parseFactsFromJson(parsed);

      if (factsArray.length === 0) {
        setUploadError('No valid facts parsed from the provided JSON context.');
        return;
      }

      const publisherName =
        (factsArray[0]?.publisher as string) || 'Custom';
      const docYear = (factsArray[0]?.year as string) || '2026';

      const newSet: SavedDataset = {
        id: `custom_${Date.now()}`,
        name: datasetName.trim() || `User Dataset #${datasets.length + 1}`,
        description: `Imported claims collection with ${factsArray.length} facts.`,
        publisher: publisherName,
        year: docYear,
        factsCount: factsArray.length,
        facts: factsArray,
        isCustom: true,
      };

      const currentCustom = loadCustomDatasets();
      currentCustom.push(newSet);
      saveCustomDatasets(currentCustom);

      const updatedList = currentCustom.map((d) => ({ ...d, isCustom: true }));
      setDatasets(updatedList);
      setSelectedDataset(newSet);

      setJsonInput('');
      setDatasetName('');
      setUploadError(null);
      setToastMessage('New dataset uploaded and registered successfully!');
    } catch (err: unknown) {
      setUploadError(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteCustomDataset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmation = window.confirm('Are you sure you want to delete this dataset?');
    if (!confirmation) return;

    const filtered = loadCustomDatasets().filter((d) => d.id !== id);
    saveCustomDatasets(filtered);
    const updatedList = filtered.map((d) => ({ ...d, isCustom: true }));
    setDatasets(updatedList);
    if (selectedDataset?.id === id) {
      setSelectedDataset(updatedList[0] || null);
    }
    setToastMessage('Dataset deleted.');
  };

  // Pre-load dynamic structures inside paste box
  const handleInsertSampleStructure = () => {
    const sample = {
      source_url: "https://www.example.com/report2026",
      publisher: "Example Publisher",
      year: "2026",
      facts: [
        {
          fact_id: "F1",
          fact: "Example claim text to verify against the source.",
          citation_url: "https://www.example.com/report2026#page=1",
          page_no: 1,
        },
      ],
    };
    setJsonInput(JSON.stringify(sample, null, 2));
    setDatasetName('Sample Dataset');
    setUploadError(null);
  };

  return (
    <div className="space-y-6" id="datasets-workspace-container">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-slate-800 text-white rounded p-3 text-xs font-semibold shadow-xl flex items-center gap-2 animate-slide-in">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-auto text-slate-400 hover:text-white text-[9px] font-bold uppercase pl-2">Dismiss</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5" id="datasets-header-deck">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Citation Claim Datasets
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Store collections of claims and ground-truth documents to run bulk verification benchmarks.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 hover:text-indigo-650 text-slate-700 font-bold rounded text-xs uppercase tracking-wider cursor-pointer"
        >
          Back To Validation Runs
        </button>
      </div>

      {/* Core Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="datasets-manager-grids">
        
        {/* Left column: Dataset templates select list */}
        <div className="lg:col-span-5 space-y-4" id="datasets-templates-col">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <h3 className="font-bold text-slate-9 tracking-tight text-xs uppercase text-slate-400 tracking-widest">
              Saved Datasets
            </h3>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {datasets.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  No datasets yet. Import JSON below to add one.
                </p>
              ) : (
              datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  onClick={() => setSelectedDataset(dataset)}
                  className={`p-3.5 rounded border transition-all cursor-pointer text-left relative ${
                    selectedDataset?.id === dataset.id
                      ? 'border-indigo-600 bg-indigo-50/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-xs">
                      {dataset.name}
                    </h4>
                    {dataset.isCustom && (
                      <span className="bg-indigo-100 text-indigo-800 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                        custom
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {dataset.description}
                  </p>

                  <div className="flex items-center gap-3 mt-3.5 text-[10px] font-mono text-slate-450 font-semibold border-t border-slate-100 pt-2">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {dataset.factsCount} claims
                    </span>
                    <span>•</span>
                    <span>{dataset.publisher}</span>
                    <span>•</span>
                    <span>{dataset.year}</span>
                  </div>

                  {dataset.isCustom && (
                    <button
                      onClick={(e) => handleDeleteCustomDataset(dataset.id, e)}
                      className="absolute bottom-2 right-2 p-1 text-slate-350 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                      title="Remove Dataset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
              )}
            </div>
          </div>

          {/* Quick Import card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-bold text-slate-900 text-xs tracking-tight uppercase tracking-widest text-slate-400">
              Bulk Import Claims JSON
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 mb-4 leading-normal">
              Paste or drop facts arrays conforming to citation structures. Perfect for testing custom research claims.
            </p>

            <form onSubmit={handleSaveCustomDataset} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-450 uppercase block tracking-wider">
                  Dataset Label / Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Biotech Clinical Trials Audit"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-semibold focus:outline-hidden focus:ring-1.5 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold text-slate-450 uppercase block tracking-wider">
                    JSON Array/Source Structure
                  </label>
                  <button
                    type="button"
                    onClick={handleInsertSampleStructure}
                    className="text-[9px] font-bold text-indigo-650 hover:underline uppercase tracking-wide"
                  >
                    Insert Example
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='[ { "source_url": "...", "publisher": "...", "facts": [ { "fact": "..." } ] } ]'
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-mono focus:outline-hidden focus:ring-1.5 focus:ring-indigo-500"
                />
              </div>

              {uploadError && (
                <p className="text-[11px] font-semibold text-red-650 bg-red-50 p-2 rounded border border-red-100">
                  ⚠️ {uploadError}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 border border-slate-999 hover:bg-slate-800 text-white rounded py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Register & Initialize Dataset
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Selected Dataset Inspection Panel */}
        <div className="lg:col-span-7" id="datasets-inspection-panel">
          <AnimatePresence mode="wait">
            {selectedDataset ? (
              <motion.div
                key={selectedDataset.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full h-full min-h-[500px]"
              >
                {/* Panel Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-5 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider">
                      Dataset Inspect
                    </span>
                    <h3 className="font-sans font-bold text-slate-900 text-sm mt-1">
                      {selectedDataset.name}
                    </h3>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyJSON(selectedDataset)}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-[10px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedDatasetId === selectedDataset.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Claims JSON</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => onEvaluateDataset(selectedDataset.name, selectedDataset.facts)}
                      className="px-3.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      Verify Claims Now
                    </button>
                  </div>
                </div>

                {/* Info Deck */}
                <div className="grid grid-cols-3 gap-1 bg-slate-50/50 border-b border-slate-200 text-center text-xs text-slate-500">
                  <div className="p-3 border-r border-slate-200 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">claims quantity</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">{selectedDataset.factsCount} total items</span>
                  </div>
                  <div className="p-3 border-r border-slate-200 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">origin publisher</span>
                    <span className="text-sm font-bold text-slate-850 truncate block px-2">{selectedDataset.publisher}</span>
                  </div>
                  <div className="p-3 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">source year</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">{selectedDataset.year}</span>
                  </div>
                </div>

                {/* Inspect facts list */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[500px]">
                  <h4 className="font-bold text-slate-400 uppercase tracking-widest text-[9px] block">
                    Claims Ledger Core Content
                  </h4>

                  <div className="space-y-3">
                    {selectedDataset.facts.map((fact, idx) => {
                      const factId = String(fact.fact_id ?? fact.id ?? `F${idx + 1}`);
                      const factText = String(fact.fact ?? '');
                      const pageNo = fact.page_no;
                      const sourceUrl = fact.source_url ? String(fact.source_url) : '';
                      return (
                      <div
                        key={idx}
                        className="p-3 border border-slate-200 rounded bg-slate-50/20 hover:border-slate-350 transition-colors space-y-2 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm">
                            {factId}
                          </span>
                          {pageNo != null && pageNo !== '' && (
                            <span className="text-[10px] text-slate-450 font-medium">
                              Page {String(pageNo)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-800 leading-relaxed font-sans font-medium">
                          {factText}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100 text-[10px] font-mono text-slate-450 font-medium">
                          {sourceUrl && (
                            <span className="flex items-center gap-0.5 truncate max-w-[200px]">
                              <Link2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-650 hover:underline leading-tight"
                              >
                                {sourceUrl}
                              </a>
                            </span>
                          )}
                        </div>
                      </div>
                    );})}
                  </div>

                  {/* Raw Schema Preview collapse button */}
                  <div className="pt-4 border-t border-slate-150">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Raw JSON preview</span>
                    <pre className="p-3 border border-slate-200 rounded font-mono text-[10px] text-slate-650 bg-slate-900 text-emerald-400 overflow-x-auto text-left max-h-52">
                      {JSON.stringify(selectedDataset.facts, null, 2)}
                    </pre>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-12 text-center text-slate-400 space-y-2 h-full flex flex-col items-center justify-center">
                <Database className="w-8 h-8 text-slate-300" />
                <h4 className="font-semibold text-slate-700 text-sm">No dataset loaded</h4>
                <p className="text-xs text-slate-400">Select or list standard sets on the left pane to begin audits.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
