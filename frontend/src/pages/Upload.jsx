import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, 
  Layers, Plus, Trash2, FileArchive, Check, RefreshCw, Sparkles, AlertTriangle
} from 'lucide-react';
import { getShows, createShow, uploadScreenplay, processEpisode } from '../api';
import { Link, useNavigate } from 'react-router-dom';

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [shows, setShows] = useState([]);
  const [selectedShowId, setSelectedShowId] = useState('');
  
  // New series creation inline
  const [isCreatingShow, setIsCreatingShow] = useState(false);
  const [newShowTitle, setNewShowTitle] = useState('');
  const [newShowDesc, setNewShowDesc] = useState('');

  // Uploaded files state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Processing state
  const [currentStep, setCurrentStep] = useState('upload'); // 'upload' | 'processing' | 'summary'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsingProgress, setParsingProgress] = useState(0);
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [currentProcessingStatus, setCurrentProcessingStatus] = useState('');
  const [processingSummary, setProcessingSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadShows();
  }, []);

  async function loadShows() {
    try {
      const res = await getShows();
      setShows(res.data || []);
      if (res.data?.length > 0 && !selectedShowId) {
        setSelectedShowId(res.data[0].id);
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
        description: newShowDesc.trim()
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

      // Check duplicates in current selection
      if (selectedFiles.some(f => f.name === file.name)) {
        errors.push(`"${file.name}" rejected: Duplicate file already selected.`);
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

  function removeFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Pre-processing Preview Analysis
  const detectedEpisodes = selectedFiles.map(file => {
    const isZip = file.name.toLowerCase().endsWith('.zip');
    return {
      name: file.name,
      size: formatBytes(file.size),
      type: isZip ? 'Archive (.zip)' : file.name.split('.').pop().toUpperCase(),
      isZip,
    };
  });

  // Start Guided Processing Workflow
  async function handleStartProcessing() {
    if (!selectedShowId) {
      setErrorMsg('Please select or create a series first.');
      return;
    }
    if (selectedFiles.length === 0) {
      setErrorMsg('Please select at least one screenplay file (.txt, .pdf, or .zip).');
      return;
    }

    setCurrentStep('processing');
    setErrorMsg('');
    setUploadProgress(10);
    setParsingProgress(0);
    setDiscoveryProgress(0);
    setCurrentProcessingStatus('Uploading screenplay files to backend...');

    try {
      const uploadedEpisodes = [];
      
      // 1. Upload files
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentProcessingStatus(`Uploading file ${i + 1} of ${selectedFiles.length}: ${file.name}...`);
        const res = await uploadScreenplay(selectedShowId, file);
        const epList = Array.isArray(res.data) ? res.data : [res.data];
        uploadedEpisodes.push(...epList);
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      setUploadProgress(100);
      setCurrentProcessingStatus(`Upload complete! Parsing ${uploadedEpisodes.length} episode screenplays...`);
      setParsingProgress(30);

      // 2. Parse & Discover
      let parsedOk = 0;
      let totalPromos = 0;

      for (let j = 0; j < uploadedEpisodes.length; j++) {
        const ep = uploadedEpisodes[j];
        setCurrentProcessingStatus(`Analyzing Episode ${ep.episode_number} (${j + 1}/${uploadedEpisodes.length})...`);
        try {
          const promoRes = await processEpisode(ep.id);
          const found = promoRes.data ? promoRes.data.length : 0;
          totalPromos += found;
          parsedOk++;
        } catch (procErr) {
          console.warn(`Episode ${ep.id} processing notice:`, procErr);
        }
        setParsingProgress(Math.round(30 + ((j + 1) / uploadedEpisodes.length) * 40));
        setDiscoveryProgress(Math.round(((j + 1) / uploadedEpisodes.length) * 100));
      }

      setParsingProgress(100);
      setDiscoveryProgress(100);

      // Final summary
      setProcessingSummary({
        totalFilesUploaded: selectedFiles.length,
        totalEpisodesIdentified: uploadedEpisodes.length,
        parsedSuccessfully: parsedOk,
        promosDiscovered: totalPromos,
      });

      setSelectedFiles([]);
      setCurrentStep('summary');

    } catch (err) {
      console.error('Processing workflow failed:', err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Processing failed. Please check backend connection.');
      setCurrentStep('upload');
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Screenplay Datasets</h1>
        <p className="text-xs text-slate-500">
          Guided 4-step pipeline: Target series selection, cue-sheet verification, automatic parsing, and AI promotional discovery.
        </p>
      </div>

      {/* Guided Progress Tabs */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'step1', num: '1', title: 'Target Series' },
          { id: 'step2', num: '2', title: 'Select Files' },
          { id: 'step3', num: '3', title: 'Review & Verify' },
          { id: 'step4', num: '4', title: 'Process Pipeline' },
        ].map((tab, i) => (
          <div key={tab.id} className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
              currentStep === 'summary' || (currentStep === 'processing' && i < 3)
                ? 'bg-emerald-600 text-white'
                : 'bg-purple-600 text-white'
            }`}>
              {tab.num}
            </span>
            <span className="text-xs font-semibold text-slate-800 hidden sm:inline">{tab.title}</span>
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold">Error: </strong>{errorMsg}
          </div>
        </div>
      )}

      {/* Step 1: Select or Create Series */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">1</span>
              Step 1: Select Target Microdrama Series
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">All uploaded screenplay episodes will be mapped to this show.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingShow(!isCreatingShow)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            {isCreatingShow ? 'Select Existing Series' : '+ Create New Series'}
          </button>
        </div>

        {isCreatingShow ? (
          <form onSubmit={handleCreateNewShow} className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Series Title *</label>
                <input
                  type="text"
                  required
                  value={newShowTitle}
                  onChange={(e) => setNewShowTitle(e.target.value)}
                  placeholder="e.g., I Married a Broken Soldier"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newShowDesc}
                  onChange={(e) => setNewShowDesc(e.target.value)}
                  placeholder="Logline or theme..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingShow(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Save & Select
              </button>
            </div>
          </form>
        ) : (
          <div>
            {shows.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs">
                No series registered yet. Please click "+ Create New Series" above.
              </div>
            ) : (
              <select
                value={selectedShowId}
                onChange={(e) => setSelectedShowId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {shows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.language}) &bull; {s.episode_count || 0} episodes currently
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Upload Files */}
      {currentStep === 'upload' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">2</span>
              Step 2: Select Screenplay Files (.txt, .pdf, or .zip)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports individual screenplay cue-sheets or a single ZIP archive containing all 50+ episodes.
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-purple-500 bg-purple-50/70'
                : 'border-slate-300 hover:border-purple-400 bg-slate-50/50 hover:bg-slate-50'
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
            <UploadCloud className="w-10 h-10 mx-auto text-purple-600 mb-2" />
            <p className="text-xs font-bold text-slate-800">
              Drag and drop your screenplay files here, or <span className="text-purple-600 underline">browse files</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Accepted: Single or multiple .TXT files, formatted .PDF scripts, or bulk .ZIP archives
            </p>
          </div>

          {/* Validation Notices */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1 text-xs text-amber-800">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Upload Notice
              </div>
              {validationErrors.map((err, i) => (
                <p key={i} className="text-[11px]">{err}</p>
              ))}
            </div>
          )}

          {/* Step 3: Selected Files Preview Table */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Step 3: Preview Detected Files ({selectedFiles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-[11px] text-rose-600 hover:underline font-semibold"
                >
                  Clear All
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                {detectedEpisodes.map((file, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="flex items-center gap-2 truncate pr-2">
                      {file.isZip ? (
                        <FileArchive className="w-4 h-4 text-purple-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="font-mono text-slate-800 truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-400">({file.size})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                        {file.type}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Step 4: Start Processing CTA */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Ready to parse timestamps & discover candidates for <strong>{selectedFiles.length} file(s)</strong>.
                </span>
                <button
                  type="button"
                  onClick={handleStartProcessing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Start Screenplay Pipeline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Active Processing View */}
      {currentStep === 'processing' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center space-y-6">
          <div className="flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-10 h-10 text-purple-600 animate-spin" />
            <h3 className="text-base font-bold text-slate-900">Processing Screenplay Dataset</h3>
            <p className="text-xs text-slate-500 font-mono">{currentProcessingStatus}</p>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4 max-w-md mx-auto text-left text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>1. File Upload</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>2. Screenplay Parsing & Cues Extraction</span>
                <span>{parsingProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${parsingProgress}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>3. AI Promotional Discovery</span>
                <span>{discoveryProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${discoveryProgress}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion Summary View */}
      {currentStep === 'summary' && processingSummary && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center space-y-6">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Processing Successfully Completed</h3>
            <p className="text-xs text-slate-500">
              Your screenplay dataset has been completely parsed, validated, and analyzed for promotional clips.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Files Uploaded</span>
              <strong className="text-sm text-slate-900">{processingSummary.totalFilesUploaded}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Episodes Created</span>
              <strong className="text-sm text-slate-900">{processingSummary.totalEpisodesIdentified}</strong>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-emerald-700 block">Parsed Successfully</span>
              <strong className="text-sm text-emerald-800">{processingSummary.parsedSuccessfully}</strong>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-[11px] text-purple-700 block">Promos Discovered</span>
              <strong className="text-sm text-purple-800">{processingSummary.promosDiscovered}</strong>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setCurrentStep('upload')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Upload More Files
            </button>
            <button
              onClick={() => navigate('/shows')}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
            >
              View Episodes Table
            </button>
            <button
              onClick={() => navigate('/promos')}
              className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              Inspect Ranked Promos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
