import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, 
  Layers, Plus, Trash2, FileArchive, RefreshCw, Sparkles, Check
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getShows, createShow, uploadScreenplay, processEpisode } from '../api';

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

  // Guided Steps: 'select' | 'upload' | 'processing' | 'summary'
  const [currentStep, setCurrentStep] = useState('upload');
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
      setErrorMsg('Failed to create series: ' + (err.response?.data?.detail || err.message));
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
    setCurrentStep('processing');
    setUploadProgress(10);
    setProcessingStatus('Uploading screenplays to server...');

    try {
      const res = await uploadScreenplay(selectedShowId, selectedFiles);
      setUploadProgress(50);
      setProcessingStatus('Screenplay files received. Parsing cues & timestamps...');

      const uploadedEpisodes = res.data?.episodes || [];
      let parsedCount = 0;
      let totalPromosDiscovered = 0;

      // Sequential discovery with 400ms delay between episodes
      for (let i = 0; i < uploadedEpisodes.length; i++) {
        const ep = uploadedEpisodes[i];
        setProcessingStatus(`Analyzing hooks & cliffhangers: Ep ${ep.episode_number} (${i + 1}/${uploadedEpisodes.length})...`);
        try {
          const promoRes = await processEpisode(ep.id);
          const found = promoRes.data ? promoRes.data.length : 0;
          totalPromosDiscovered += found;
          parsedCount++;
        } catch (procErr) {
          console.warn(`Episode ${ep.id} discovery notice:`, procErr);
        }

        const currentPct = 50 + Math.round(((i + 1) / uploadedEpisodes.length) * 50);
        setUploadProgress(currentPct);

        if (i < uploadedEpisodes.length - 1) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      setProcessingSummary({
        totalFilesUploaded: selectedFiles.length,
        totalEpisodesIdentified: uploadedEpisodes.length,
        parsedSuccessfully: parsedCount,
        promosDiscovered: totalPromosDiscovered,
      });

      setCurrentStep('summary');
    } catch (err) {
      setErrorMsg('Upload error: ' + (err.response?.data?.detail || err.message));
      setCurrentStep('upload');
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-[#172B4D] tracking-tight">Upload Screenplay Dataset</h2>
        <p className="text-xs text-[#64748B]">
          Guided upload for microdrama screenplays. Supports TXT, PDF, and multi-episode ZIP archives.
        </p>
      </div>

      {/* Progress Wizard Steps */}
      <div className="flex items-center justify-center gap-2 text-xs">
        {[
          { id: 'select', label: '1. Select Series' },
          { id: 'upload', label: '2. Add Files' },
          { id: 'processing', label: '3. Parse & Discover' },
          { id: 'summary', label: '4. Summary' },
        ].map((step, idx) => {
          const isDone = (currentStep === 'summary') ||
                         (currentStep === 'processing' && idx <= 2) ||
                         (currentStep === 'upload' && idx <= 1);
          return (
            <div key={step.id} className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full font-semibold ${
                isDone ? 'bg-[#CCFBF1] text-[#0F766E]' : 'bg-slate-100 text-slate-400'
              }`}>
                {step.label}
              </span>
              {idx < 3 && <span className="text-slate-300">&bull;</span>}
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

      {/* Step 1 & 2: Upload Panel */}
      {currentStep === 'upload' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          {/* Step 1: Series Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                Step 1: Target Series
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingShow(!isCreatingShow)}
                className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingShow ? 'Select Existing Series' : 'Create New Series'}</span>
              </button>
            </div>

            {isCreatingShow ? (
              <form onSubmit={handleCreateNewShow} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Series Title *</label>
                  <input
                    type="text"
                    required
                    value={newShowTitle}
                    onChange={(e) => setNewShowTitle(e.target.value)}
                    placeholder="e.g. Secret Billionaire Heir"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0F766E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Premise / Description (Optional)</label>
                  <input
                    type="text"
                    value={newShowDesc}
                    onChange={(e) => setNewShowDesc(e.target.value)}
                    placeholder="Short description..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0F766E] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingShow(false)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 rounded-lg text-xs font-bold text-white bg-[#0F766E] hover:bg-[#115E59]"
                  >
                    Save Series
                  </button>
                </div>
              </form>
            ) : (
              <select
                value={selectedShowId}
                onChange={(e) => setSelectedShowId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-[#172B4D] focus:ring-2 focus:ring-[#0F766E] focus:outline-none"
              >
                {shows.map(show => (
                  <option key={show.id} value={show.id}>
                    {show.title} ({show.language || 'English'}) - {show.total_episodes || 0} episodes uploaded
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2: Drag and Drop Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#172B4D] uppercase tracking-wider block">
              Step 2: Screenplay Files (.txt, .pdf, .zip)
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
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
              <div className="w-12 h-12 rounded-xl bg-white shadow-xs mx-auto flex items-center justify-center text-[#0F766E] mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-[#172B4D]">
                Click to browse or drag & drop screenplays here
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">
                Upload single episode files or a ZIP archive containing all episodes
              </p>
            </div>
          </div>

          {/* Validation Warnings */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-[11px] text-amber-800">
              {validationErrors.map((err, i) => (
                <div key={i}>&bull; {err}</div>
              ))}
            </div>
          )}

          {/* Selected Files Preview List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#172B4D]">
                <span>Selected Files ({selectedFiles.length})</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-[11px] text-rose-600 hover:underline"
                >
                  Clear All
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {file.name.endsWith('.zip') ? (
                        <FileArchive className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#0F766E] shrink-0" />
                      )}
                      <span className="font-medium text-[#172B4D] truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-400">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Start Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleStartProcessing}
              disabled={selectedFiles.length === 0 || !selectedShowId}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-40"
            >
              <span>Process {selectedFiles.length} Screenplay(s)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Active Processing State */}
      {currentStep === 'processing' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0F766E] flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#172B4D]">Processing Screenplays</h3>
            <p className="text-xs text-[#64748B]">{processingStatus}</p>
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#0F766E] h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-[10px] text-right font-semibold text-slate-500">
              {uploadProgress}%
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Summary State */}
      {currentStep === 'summary' && processingSummary && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#172B4D]">Processing Complete!</h3>
            <p className="text-xs text-[#64748B]">
              Your screenplays have been parsed, validated, and analyzed for promotional moments.
            </p>
          </div>

          {/* Metric summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold">Files Uploaded</div>
              <div className="text-base font-bold text-[#172B4D]">{processingSummary.totalFilesUploaded}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[10px] text-slate-500 font-semibold">Episodes Identified</div>
              <div className="text-base font-bold text-[#172B4D]">{processingSummary.totalEpisodesIdentified}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[10px] text-emerald-700 font-semibold">Parsed Successfully</div>
              <div className="text-base font-bold text-emerald-800">{processingSummary.parsedSuccessfully}</div>
            </div>
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="text-[10px] text-teal-700 font-semibold">Promos Found</div>
              <div className="text-base font-bold text-[#0F766E]">{processingSummary.promosDiscovered}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/shows"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#172B4D] rounded-xl text-xs font-semibold transition-colors"
            >
              View Episodes in Library
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
