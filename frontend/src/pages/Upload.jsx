import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, 
  Layers, Plus, Trash2, FileArchive, RefreshCw, Sparkles, Check, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getShows, createShow, uploadScreenplay, processEpisode, getErrorMessage } from '../api';

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [shows, setShows] = useState([]);
  const [selectedShowId, setSelectedShowId] = useState('');
  
  // Inline New Series State
  const [isCreatingShow, setIsCreatingShow] = useState(false);
  const [newShowTitle, setNewShowTitle] = useState('');
  const [newShowDesc, setNewShowDesc] = useState('');

  // Selected Files
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Stepper State: 1: Select, 2: Upload Files, 3: Preview, 4: Process / Summary
  const [currentStep, setCurrentStep] = useState(2); // Start at step 2 as shown in mockup
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingSummary, setProcessingSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadShows();
  }, []);

  async function loadShows() {
    try {
      const res = await getShows();
      const list = res.data || [];
      setShows(list);
      if (list.length > 0 && !selectedShowId) {
        setSelectedShowId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load shows:', err);
    }
  }

  async function handleCreateNewShow(e) {
    e.preventDefault();
    if (!newShowTitle.trim()) return;
    try {
      const res = await createShow({
        title: newShowTitle.trim(),
        language: 'English',
        description: newShowDesc.trim() || undefined,
      });
      await loadShows();
      setSelectedShowId(res.data.id);
      setIsCreatingShow(false);
      setNewShowTitle('');
      setNewShowDesc('');
    } catch (err) {
      setErrorMsg('Failed to create series: ' + getErrorMessage(err));
    }
  }

  function handleFileSelect(files) {
    setErrorMsg('');
    const validExtensions = ['txt', 'pdf', 'zip'];
    const newFiles = [];
    const errors = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!validExtensions.includes(ext)) {
        errors.push(`"${file.name}" rejected: Unsupported format (must be .txt, .pdf, or .zip)`);
        return;
      }
      if (selectedFiles.some(f => f.name === file.name)) {
        errors.push(`"${file.name}" skipped: Duplicate file already selected.`);
        return;
      }
      newFiles.push(file);
    });

    setValidationErrors(errors);
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }

  function handleRemoveFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleStartProcessing() {
    if (!selectedShowId || selectedFiles.length === 0) return;

    setErrorMsg('');
    setCurrentStep(4);
    setUploadProgress(10);
    setProcessingStatus('Uploading screenplays to server...');

    try {
      const res = await uploadScreenplay(selectedShowId, selectedFiles);
      setUploadProgress(40);
      setProcessingStatus('Parsing cues, scenes, and character dialogue...');

      const uploadedEpisodes = Array.isArray(res.data) ? res.data : (res.data?.episodes || []);

      if (uploadedEpisodes.length === 0) {
        setErrorMsg('Upload completed, but no episodes were identified. Ensure the files contain valid screenplay text.');
        setCurrentStep(2);
        return;
      }

      let parsedCount = 0;
      let totalPromosDiscovered = 0;

      for (let i = 0; i < uploadedEpisodes.length; i++) {
        const ep = uploadedEpisodes[i];
        setProcessingStatus(`Analyzing hooks & cliffhangers: Ep ${ep.episode_number} (${i + 1}/${uploadedEpisodes.length})...`);
        try {
          const promoRes = await processEpisode(ep.id);
          const found = Array.isArray(promoRes.data) ? promoRes.data.length : 0;
          totalPromosDiscovered += found;
          parsedCount++;
        } catch (procErr) {
          console.warn(`Episode ${ep.id} discovery notice:`, procErr);
        }

        const currentPct = 40 + Math.round(((i + 1) / uploadedEpisodes.length) * 60);
        setUploadProgress(currentPct);

        if (i < uploadedEpisodes.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      setProcessingSummary({
        totalFilesUploaded: selectedFiles.length,
        totalEpisodesIdentified: uploadedEpisodes.length,
        parsedSuccessfully: parsedCount,
        promosDiscovered: totalPromosDiscovered,
      });

    } catch (err) {
      console.error('Upload error:', err);
      setErrorMsg('Upload error: ' + getErrorMessage(err));
      setCurrentStep(2);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 4-Step Stepper Bar from Panel 3 */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 text-xs py-2">
        {[
          { num: 1, label: 'Select Series' },
          { num: 2, label: 'Upload Files' },
          { num: 3, label: 'Preview' },
          { num: 4, label: 'Process' },
        ].map((step) => {
          const isDone = currentStep > step.num || processingSummary;
          const isActive = currentStep === step.num && !processingSummary;

          return (
            <div key={step.num} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isDone
                  ? 'bg-[#0F766E] text-white'
                  : isActive
                  ? 'bg-[#0F766E] text-white ring-4 ring-teal-100'
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {isDone ? '✓' : step.num}
              </span>
              <span className={`font-semibold hidden sm:inline ${
                isActive ? 'text-[#0F766E]' : isDone ? 'text-slate-800' : 'text-slate-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Upload Box: 3 Columns Grid exactly as shown in Panel 3 */}
      {!processingSummary && currentStep !== 4 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Column 1 (Col 3): Select Series */}
            <div className="lg:col-span-3 space-y-3">
              <label className="text-xs font-bold text-[#172B4D] block">
                Select Series
              </label>

              {isCreatingShow ? (
                <form onSubmit={handleCreateNewShow} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={newShowTitle}
                      onChange={(e) => setNewShowTitle(e.target.value)}
                      placeholder="Series title"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingShow(false)}
                      className="px-2 py-1 text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-[#0F766E] text-white font-bold rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <select
                  value={selectedShowId}
                  onChange={(e) => setSelectedShowId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#172B4D] focus:ring-1 focus:ring-[#0F766E] focus:outline-none"
                >
                  {shows.map(show => (
                    <option key={show.id} value={show.id}>
                      {show.title}
                    </option>
                  ))}
                </select>
              )}

              {!isCreatingShow && (
                <button
                  type="button"
                  onClick={() => setIsCreatingShow(true)}
                  className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Series</span>
                </button>
              )}
            </div>

            {/* Column 2 (Col 5): Drag & Drop Zone */}
            <div className="lg:col-span-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[190px] ${
                  isDragging
                    ? 'border-[#0F766E] bg-teal-50/50'
                    : 'border-slate-300 hover:border-[#0F766E] bg-[#F5F7FA]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.pdf,.zip"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-[#0F766E] mb-2" />
                <p className="text-xs font-bold text-[#172B4D]">
                  Drag & drop files here
                </p>
                <p className="text-[11px] text-[#0F766E] font-medium mt-0.5">
                  or click to browse
                </p>
                <p className="text-[10px] text-slate-400 mt-2">
                  Supports TXT, PDF or ZIP (multi-episode)
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-600">TXT</span>
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-600">PDF</span>
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-600">ZIP</span>
                </div>
              </div>
            </div>

            {/* Column 3 (Col 4): Selected Files List */}
            <div className="lg:col-span-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#172B4D]">
                <span>Selected Files ({selectedFiles.length})</span>
                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-[10px] text-rose-600 hover:underline font-normal"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="min-h-[190px] max-h-[220px] overflow-y-auto space-y-1.5 p-2 bg-[#F5F7FA] border border-slate-200 rounded-xl">
                {selectedFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400 text-xs">
                    <FileText className="w-6 h-6 mb-1 text-slate-300" />
                    <span>No files added yet</span>
                  </div>
                ) : (
                  selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                        <span className="font-medium text-[#172B4D] truncate text-[11px]">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-1">
                        <span className="text-[10px] text-slate-400">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom Action Button (Next: Preview / Process) */}
          <div className="pt-2 flex justify-end border-t border-slate-100">
            <button
              type="button"
              onClick={handleStartProcessing}
              disabled={selectedFiles.length === 0 || !selectedShowId}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-40"
            >
              <span>Next: Process {selectedFiles.length > 0 ? `(${selectedFiles.length} files)` : ''}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Active Processing View */}
      {currentStep === 4 && !processingSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0F766E] flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#172B4D]">Processing Screenplays</h3>
            <p className="text-xs text-[#64748B]">{processingStatus}</p>
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0F766E] h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-[10px] text-right font-semibold text-slate-500">
              {uploadProgress}%
            </div>
          </div>
        </div>
      )}

      {/* Completed Summary View */}
      {processingSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#172B4D]">Processing Complete!</h3>
            <p className="text-xs text-[#64748B]">
              Your screenplays were parsed and validated for promotional moments.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
            <div className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold">Files Uploaded</div>
              <div className="text-base font-bold text-[#172B4D]">{processingSummary.totalFilesUploaded}</div>
            </div>
            <div className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold">Episodes Identified</div>
              <div className="text-base font-bold text-[#172B4D]">{processingSummary.totalEpisodesIdentified}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[10px] text-emerald-700 font-semibold">Parsed</div>
              <div className="text-base font-bold text-emerald-800">{processingSummary.parsedSuccessfully}</div>
            </div>
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="text-[10px] text-[#0F766E] font-semibold">Promos Found</div>
              <div className="text-base font-bold text-[#0F766E]">{processingSummary.promosDiscovered}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/shows"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#172B4D] rounded-xl text-xs font-semibold transition-colors"
            >
              View in Library
            </Link>
            <Link
              to="/promos"
              className="px-5 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Explore Discovered Promos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
