"use client";
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Sliders, RefreshCw, AlertCircle, Database, ToggleLeft, ToggleRight, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { EVALUATOR_OPTIONS } from '@/lib/evaluators';
import { EvaluatorModelId } from '@/lib/types';

interface SettingsViewProps {
  onBack: () => void;
  currentEvaluator: EvaluatorModelId;
  onChangeEvaluator: (evaluator: EvaluatorModelId) => void;
  onClearStorage: () => void;
}

export default function SettingsView({
  onBack,
  currentEvaluator,
  onChangeEvaluator,
  onClearStorage
}: SettingsViewProps) {
  // Simulator operational toggles
  const [latencyActive, setLatencyActive] = useState<boolean>(() => {
    return localStorage.getItem('SETTINGS_SIMULATE_LATENCY') !== 'false';
  });
  const [autoFlagPass, setAutoFlagPass] = useState<boolean>(() => {
    return localStorage.getItem('SETTINGS_AUTO_FLAG_PASS') === 'true';
  });
  const [detailedTelemetry, setDetailedTelemetry] = useState<boolean>(() => {
    return localStorage.getItem('SETTINGS_DETAILED_TELEMETRY') === 'true';
  });

  // Backend validation health checks
  const [apiStatus, setApiStatus] = useState<'IDLE' | 'PINGING' | 'LIVE_AI' | 'LIVE_OFFLINE' | 'FAILED'>('IDLE');
  const [apiNotes, setApiNotes] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('SETTINGS_SIMULATE_LATENCY', String(latencyActive));
  }, [latencyActive]);

  useEffect(() => {
    localStorage.setItem('SETTINGS_AUTO_FLAG_PASS', String(autoFlagPass));
  }, [autoFlagPass]);

  useEffect(() => {
    localStorage.setItem('SETTINGS_DETAILED_TELEMETRY', String(detailedTelemetry));
  }, [detailedTelemetry]);

  // Perform API ping sequence
  const handleTestBackendConnection = async () => {
    setApiStatus('PINGING');
    setApiNotes('Pinging validation gateway endpoint at /api/evaluate ...');

    try {
      const start = Date.now();
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evaluator: currentEvaluator,
          facts: [
            {
              fact_id: 'PING_CHECK',
              fact: 'Test verification handshake',
              exact_paragraph: 'Test verification handshake'
            }
          ]
        })
      });

      const latency = Date.now() - start;

      if (!response.ok) {
        throw new Error(`Endpoint returned status ${response.status}`);
      }

      const data = await response.json();
      const fallback = data.usingFallback;
      const provider = data.provider as string | undefined;

      if (fallback) {
        setApiStatus('LIVE_OFFLINE');
        setApiNotes(`Connected in ${latency}ms. Offline local validator active. Set GROQ_API_KEY in .env.local for live AI (see console.groq.com/docs).`);
      } else if (provider === 'groq') {
        setApiStatus('LIVE_AI');
        setApiNotes(`Connected in ${latency}ms. Groq inference is live via OpenAI-compatible API (api.groq.com).`);
      } else {
        setApiStatus('LIVE_AI');
        setApiNotes(`Connected in ${latency}ms. ${provider ?? 'AI'} inference is live and running evaluations.`);
      }

    } catch (err: any) {
      console.error('Handshake failed:', err);
      setApiStatus('FAILED');
      setApiNotes(`Handshake pipeline failure: ${err.message}. Verify the Next.js API routes are running.`);
    }
  };

  const handleResetStorageClick = () => {
    const confirm = window.confirm('Are you sure you want to clear and reset CiteEval data? This will restore original preset verification reports and delete custom changes.');
    if (confirm) {
      onClearStorage();
      alert('Local storage cleared.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" id="settings-workspace-stage">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 animate-pulse" />
            Global Settings & Controls
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure default AI validation targets, proxy channels, telemetry layouts, and offline memory triggers.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 hover:text-indigo-650 text-slate-700 font-bold rounded text-xs uppercase tracking-wider cursor-pointer"
        >
          Back To Runs
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6" id="settings-cards-frame">
        {/* Core AI Setting Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
              <Cpu className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Default Groq Model</h3>
              <p className="text-xs text-slate-500 mt-0.5">Choose which Groq model runs citation verification by default.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {EVALUATOR_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onChangeEvaluator(option.id)}
                className={`p-3 border rounded text-left transition-all cursor-pointer ${
                  currentEvaluator === option.id
                    ? 'border-indigo-600 bg-indigo-500/10 text-indigo-900 shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-mono text-[10px] text-slate-400 mb-0.5">GROQ</div>
                <div className="font-bold text-xs">{option.label}</div>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">{option.description}</p>
                {option.recommended && (
                  <span className="inline-block mt-2 bg-indigo-600 text-white text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm">
                    Recommended
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Live Proxy verification diagnostic widget */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Validation Pipeline Handshake Diagnostics</h3>
                <p className="text-xs text-slate-500 mt-0.5">Verify real-time communication with the local appraisal Express microserver.</p>
              </div>
            </div>

            <button
              onClick={handleTestBackendConnection}
              disabled={apiStatus === 'PINGING'}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-white text-[10px] font-bold uppercase tracking-wider rounded inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${apiStatus === 'PINGING' ? 'animate-spin' : ''}`} />
              Test Gateway Connection
            </button>
          </div>

          <div className="border border-slate-150 rounded p-4 font-mono text-xs space-y-2 text-left bg-slate-50">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Handshake Status</span>
              {apiStatus === 'IDLE' && (
                <span className="text-slate-500 font-bold uppercase text-[10px]">● NOT TESTED</span>
              )}
              {apiStatus === 'PINGING' && (
                <span className="text-indigo-600 font-bold uppercase text-[10px] animate-pulse">● TESTING CONNECTION</span>
              )}
              {apiStatus === 'LIVE_AI' && (
                <span className="text-emerald-600 font-bold uppercase text-[10px] flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  ● LIVE (AI CONNECTED)
                </span>
              )}
              {apiStatus === 'LIVE_OFFLINE' && (
                <span className="text-amber-600 font-bold uppercase text-[10px] flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  ● LIVE (LOCAL VALIDATOR RETRIEVALS)
                </span>
              )}
              {apiStatus === 'FAILED' && (
                <span className="text-red-650 font-bold uppercase text-[10px] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  ● OFFLINE/ERROR
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
              {apiStatus === 'IDLE' ? 'Initiate diagnostic query above to confirm express service layers or api proxies viability.' : apiNotes}
            </p>

            <div className="pt-2 border-t border-slate-200 mt-2 text-[10px] text-slate-450 leading-relaxed space-y-1 font-sans">
              <span className="font-bold text-slate-400 block uppercase font-mono tracking-wider text-[9px]">API Security Guidelines (Server-Side Proxying):</span>
              <p>
                CiteEval runs evaluations via Next.js API routes using <a href="https://console.groq.com/docs/overview" className="text-indigo-600 underline" target="_blank" rel="noreferrer">Groq</a> (OpenAI-compatible) when <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono text-[9px]">GROQ_API_KEY</code> is set in <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono text-[9px]">.env.local</code>. Gemini is used as fallback if only <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono text-[9px]">GEMINI_API_KEY</code> is configured.
              </p>
            </div>
          </div>
        </div>

        {/* Layout Simulation configs */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Fine-Tune UI Simulation Engine</h3>
          <p className="text-xs text-slate-500 mt-0.5">Control how animations, log speeds, and telemetry metrics load within the workspace.</p>

          <div className="space-y-4 pt-2">
            {/* Simulation delay Toggle */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-bold text-xs text-slate-800 block">Staggered Processing Delay</span>
                <span className="text-xs text-slate-400 block mt-0.5">Simulate AI evaluation latencies dynamically for a cooler research room dashboard.</span>
              </div>
              <button
                type="button"
                className="cursor-pointer text-indigo-600 hover:text-indigo-800 inline-flex"
                onClick={() => setLatencyActive(!latencyActive)}
              >
                {latencyActive ? (
                  <ToggleRight className="w-9 h-9" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-300" />
                )}
              </button>
            </div>

            {/* Auto-Review passed facts Toggle */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 font-medium">
              <div>
                <span className="font-bold text-xs text-slate-800 block">Auto-Flag Verification Checks</span>
                <span className="text-xs text-slate-400 block mt-0.5">Set validation results with "PASS" status to "REVIEWED" instantly.</span>
              </div>
              <button
                type="button"
                className="cursor-pointer text-indigo-600 hover:text-indigo-800 inline-flex"
                onClick={() => setAutoFlagPass(!autoFlagPass)}
              >
                {autoFlagPass ? (
                  <ToggleRight className="w-9 h-9" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-300" />
                )}
              </button>
            </div>

            {/* Telemetry output toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-800 block">Expose Process logs & telemetry</span>
                <span className="text-xs text-slate-400 block mt-0.5">Include detailed evaluation processing output and debug message alerts in screens.</span>
              </div>
              <button
                type="button"
                className="cursor-pointer text-indigo-600 hover:text-indigo-800 id-telemetry-toggle inline-flex"
                onClick={() => setDetailedTelemetry(!detailedTelemetry)}
              >
                {detailedTelemetry ? (
                  <ToggleRight className="w-9 h-9" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-300" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Clear memory trigger card */}
        <div className="bg-white border border-red-200 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-red-950 text-sm flex items-center gap-1.5">
              <Database className="w-4 h-4 text-red-600" />
              Reset Local Storage Cache Memory
            </h3>
            <p className="text-xs text-red-700/80 max-w-md leading-normal">
              Permanently purge all evaluation reports, saved datasets, and reviewer notes. This is irreversible.
            </p>
          </div>

          <button
            onClick={handleResetStorageClick}
            className="sm:shrink-0 px-4 py-2 border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 font-bold rounded text-xs uppercase tracking-wider cursor-pointer"
          >
            Purge Cache Storage
          </button>
        </div>
      </div>
    </div>
  );
}
