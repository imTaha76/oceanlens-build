/**
 * OCEANLENS - Backend Configuration & Diagnostics Modal
 */

import React, { useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileUp,
  Radio,
  RefreshCw,
  Server,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { DataSourceMode } from '../hooks/useOceanData';
import { checkBackendHealth } from '../services/oceanApi';
import { CurrentVelocitySlice, OceanMetadata, OceanSlice } from '../types';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiUrl: string;
  isConnected: boolean;
  isConnecting: boolean;
  pingMs: number | null;
  connectionError: string | null;
  dataSourceMode: DataSourceMode;
  onSelectMode: (mode: DataSourceMode) => void;
  onSaveUrl: (newUrl: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onLoadDataset?: (meta: OceanMetadata, slice: OceanSlice | CurrentVelocitySlice) => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  isOpen,
  onClose,
  apiUrl,
  isConnected,
  isConnecting,
  pingMs,
  connectionError,
  dataSourceMode,
  onSelectMode,
  onSaveUrl,
  onRetry,
  onLoadDataset,
}) => {
  const [inputUrl, setInputUrl] = useState(apiUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; error?: string } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    const result = await checkBackendHealth(inputUrl);
    setTestResult(result);
    setTesting(false);
  };

  const handleApply = async () => {
    await onSaveUrl(inputUrl);
    onSelectMode('backend');
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus(`Processing ${file.name}...`);

    if (file.name.endsWith('.json')) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.latitude && data.longitude && data.values) {
          const meta: OceanMetadata = {
            name: `Imported: ${file.name}`,
            region: 'Arabian Sea (Custom Upload)',
            latitude_range: [Math.min(...data.latitude), Math.max(...data.latitude)],
            longitude_range: [Math.min(...data.longitude), Math.max(...data.longitude)],
            bbox: [
              Math.min(...data.longitude),
              Math.min(...data.latitude),
              Math.max(...data.longitude),
              Math.max(...data.latitude),
            ],
            grid_resolution: `${(data.latitude[1] - data.latitude[0]).toFixed(3)}°`,
            variables: [data.variable || 'thetao'],
            depths: [data.depth ?? 0.5],
            times: [data.time ?? new Date().toISOString()],
          };
          if (onLoadDataset) {
            onLoadDataset(meta, data);
            setUploadStatus(`✓ Successfully loaded ${file.name}`);
            setTimeout(() => onClose(), 800);
          }
        } else {
          setUploadStatus('Invalid ocean slice format (missing latitude, longitude, or values)');
        }
      } catch (err: any) {
        setUploadStatus(`Failed to parse JSON: ${err.message}`);
      }
    } else if (file.name.endsWith('.nc')) {
      // If backend is online, upload to backend /upload-netcdf
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${apiUrl}/upload-netcdf`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const resData = await res.json();
          setUploadStatus(`✓ Uploaded ${file.name} to FastAPI backend!`);
          onRetry();
          setTimeout(() => onClose(), 1000);
        } else {
          setUploadStatus(`Backend upload returned ${res.status}. NetCDF files require the local FastAPI server.`);
        }
      } catch (err: any) {
        setUploadStatus(
          `To load ${file.name}, place it in 'backend/data/' in your cloned repo and run uvicorn main:app --reload`
        );
      }
    }
  };

  return (
    <div
      id="backend-config-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        id="backend-config-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-700/50 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                Ocean Data Source & Backend Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Choose how real Copernicus ocean model data is loaded
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
        <div className="p-5 space-y-4 text-xs text-slate-300 overflow-y-auto custom-scrollbar">
          {/* Data Source Selection Cards */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-200 text-xs block">
              Select Data Provider:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Embedded Copernicus Reanalysis */}
              <div
                onClick={() => {
                  onSelectMode('embedded');
                  onClose();
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  dataSourceMode === 'embedded'
                    ? 'bg-cyan-950/50 border-cyan-500 shadow-md shadow-cyan-950/50 text-slate-100 ring-1 ring-cyan-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold flex items-center gap-1.5 text-cyan-300">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Embedded Copernicus
                  </span>
                  {dataSourceMode === 'embedded' && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Real physical Copernicus reanalysis model for Arabian Sea (61×61 grid, 26 depth levels, 7 daily steps). Visualizes immediately with zero server setup.
                </p>
              </div>

              {/* Option 2: Local FastAPI Backend */}
              <div
                onClick={() => onSelectMode('backend')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  dataSourceMode === 'backend'
                    ? 'bg-emerald-950/50 border-emerald-500 shadow-md shadow-emerald-950/50 text-slate-100 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <Server className="w-4 h-4 text-emerald-400" />
                    Local FastAPI Backend
                  </span>
                  {dataSourceMode === 'backend' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Connects to your local Python server at <code className="text-slate-300">127.0.0.1:8000</code> streaming directly from custom NetCDF (.nc) files.
                </p>
              </div>
            </div>
          </div>

          {/* Local FastAPI Backend Configuration Details */}
          {dataSourceMode === 'backend' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-200">
              {/* Status Banner */}
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                  isConnected
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                }`}
              >
                {isConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-medium text-xs">
                    {isConnected
                      ? `FastAPI Backend Online (${pingMs ?? '--'} ms)`
                      : 'Backend Disconnected or Unreachable'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {isConnected
                      ? `Connected to ${apiUrl}.`
                      : connectionError || 'Ensure uvicorn is running on port 8000.'}
                  </div>
                </div>
              </div>

              {/* URL Input */}
              <div className="space-y-1">
                <label className="block font-medium text-slate-300 text-[11px]">
                  FastAPI Endpoint URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="backend-url-input"
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8000"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    id="test-backend-url-btn"
                    onClick={handleTest}
                    disabled={testing}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 text-xs"
                  >
                    {testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                    Test
                  </button>
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={`p-2 rounded-lg border font-mono text-[11px] ${
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

              {/* Command to run */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                <div className="text-[11px] text-slate-300 font-semibold">
                  How to start the backend in your cloned repo:
                </div>
                <div className="p-2 bg-slate-950 rounded font-mono text-[11px] text-emerald-400 select-all border border-slate-800">
                  cd backend && uvicorn main:app --reload --port 8000
                </div>
              </div>
            </div>
          )}

          {/* Option 3: Direct NetCDF / JSON File Upload */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-amber-400" />
                Upload Ocean Dataset File (.nc or .json)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Load an ocean slice JSON or Copernicus NetCDF file directly from your computer.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".nc,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 border border-dashed border-slate-700 hover:border-cyan-500 rounded-lg text-slate-300 hover:text-cyan-300 bg-slate-900/50 flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <FileUp className="w-4 h-4" />
              Choose .nc or .json file to load
            </button>
            {uploadStatus && (
              <div className="text-[11px] font-mono text-cyan-300 p-2 bg-slate-900 rounded border border-slate-800">
                {uploadStatus}
              </div>
            )}
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
              Close
            </button>
            {dataSourceMode === 'backend' && (
              <button
                id="apply-backend-url-btn"
                onClick={handleApply}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 transition-colors"
              >
                Save & Connect Backend
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

