/**
 * OCEANLENS - Backend Configuration & Diagnostics Modal
 */

import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Server,
  X,
} from 'lucide-react';
import { checkBackendHealth } from '../services/oceanApi';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  isConnected: boolean;
  isConnecting: boolean;
  pingMs: number | null;
  connectionError: string | null;
  onSaveUrl: (newUrl: string) => Promise<void>;
  onRetry: () => Promise<void>;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  isOpen,
  onClose,
  apiUrl,
  isConnected,
  isConnecting,
  pingMs,
  connectionError,
  onSaveUrl,
  onRetry,
}) => {
  const [inputUrl, setInputUrl] = useState(apiUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; error?: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    const result = await checkBackendHealth(inputUrl);
    setTestResult(result);
    setTesting(false);
  };

  const handleApply = async () => {
    await onSaveUrl(inputUrl);
    onClose();
  };

  return (
    <div
      id="backend-config-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        id="backend-config-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-700/50 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                FastAPI Ocean Data Backend Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Copernicus Marine Data API (Port 8000)
              </p>
            </div>
          </div>
          <button
            id="close-backend-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-lg border flex items-start gap-3 ${
              isConnected
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
            }`}
          >
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-medium text-sm">
                {isConnected
                  ? 'Connected to Copernicus Ocean Service'
                  : 'Backend Disconnected or Unreachable'}
              </div>
              <div className="text-xs opacity-90">
                {isConnected
                  ? `Active connection to ${apiUrl}. Round-trip ping: ${pingMs ?? '--'} ms.`
                  : connectionError || 'FastAPI server at 127.0.0.1:8000 is not responding.'}
              </div>
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="block font-medium text-slate-300 text-xs">
              FastAPI Service Endpoint URL
            </label>
            <div className="flex gap-2">
              <input
                id="backend-url-input"
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
              <button
                id="test-backend-url-btn"
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5" />
                )}
                Test
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Default is <code className="text-cyan-400">http://127.0.0.1:8000</code>.
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border font-mono text-[11px] ${
                testResult.ok
                  ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-800 text-rose-300'
              }`}
            >
              {testResult.ok
                ? `✓ Ping successful: 200 OK (${testResult.latencyMs} ms)`
                : `✗ Ping failed: ${testResult.error || 'Connection refused'}`}
            </div>
          )}

          {/* Instructions for starting FastAPI */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>How to start your FastAPI backend:</span>
              <span className="text-[10px] text-cyan-400 font-mono">Python 3.10+</span>
            </div>
            <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-emerald-400 select-all border border-slate-800">
              uvicorn main:app --reload --host 127.0.0.1 --port 8000
            </div>
            <p className="text-[11px] text-slate-400">
              Ensure CORS is enabled in FastAPI with <code className="text-slate-300">CORSMiddleware</code> allowing <code className="text-slate-300">allow_origins=["*"]</code> so browser can query <code className="text-slate-300">/metadata</code> and <code className="text-slate-300">/slice</code>.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            id="retry-backend-connection-btn"
            onClick={onRetry}
            disabled={isConnecting}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
            Retry Connection
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              id="apply-backend-url-btn"
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/30 transition-colors"
            >
              Save & Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
