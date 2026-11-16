import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Film, Plus, Play, CheckCircle2, Clock, AlertCircle, RefreshCw, Layers, 
  Pause, Sparkles, ArrowRight, Check, AlertTriangle, FileText, Eye, X, 
  Cpu, Database, ShieldCheck
} from 'lucide-react';
import { getShows, createShow, getEpisodes, getEpisode, processEpisode, inspectEpisode } from '../api';

export default function Shows() {
  const navigate = useNavigate();
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create show modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Reprocess confirm modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Episode inspection modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingEpisode, setInspectingEpisode] = useState(null);
  const [inspectionData, setInspectionData] = useState(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  
  // Single episode processing state
  const [processingId, setProcessingId] = useState(null);
  
  // Batch processing state
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [currentBatchEp, setCurrentBatchEp] = useState(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, completed: 0, failed: 0, promosFound: 0 });
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    loadShows();
  }, []);

  async function loadShows() {
    setLoading(true);
    try {
      const res = await getShows();
      setShows(res.data);
      if (res.data.length > 0 && !selectedShow) {
        selectShow(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load shows:', err);
    } finally {
      setLoading(false);
    }
  }

  async function selectShow(show) {
    setSelectedShow(show);
    try {
      const res = await getEpisodes(show.id);
      setEpisodes(res.data || []);
      if (isBatchRunning) {
        stopRequestedRef.current = true;
        setIsBatchRunning(false);
      }
    } catch (err) {
      console.error('Failed to load episodes:', err);
    }
  }

  async function handleCreateShow(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await createShow({
        title: newTitle.trim(),
        language: 'English',
        description: newDesc.trim(),
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      await loadShows();
      selectShow(res.data);
    } catch (err) {
      alert('Error creating show: ' + (err.response?.data?.detail || err.message));
    }
  }

  // Open inspection modal for an episode
  async function handleInspectEpisode(ep) {
    setInspectingEpisode(ep);
    setInspectModalOpen(true);
    setInspectionLoading(true);
    setInspectionData(null);
    try {
      const res = await inspectEpisode(ep.id);
      setInspectionData(res.data);
    } catch (err) {
      console.error('Failed to load inspection data:', err);
    } finally {
      setInspectionLoading(false);
    }
  }

  // Process a single episode
  async function handleProcessEpisode(epId) {
    if (isBatchRunning) return;
    setProcessingId(epId);
    
    setEpisodes(prev => prev.map(ep => ep.id === epId ? { ...ep, processing_status: 'processing' } : ep));
    
    try {
      const promoRes = await processEpisode(epId);
      const epRes = await getEpisode(epId);
      const foundCount = promoRes.data ? promoRes.data.length : 0;
      
      setEpisodes(prev => prev.map(ep => ep.id === epId ? { 
        ...epRes.data, 
        processing_status: 'completed', 
        promos_found: foundCount 
      } : ep));
    } catch (err) {
      setEpisodes(prev => prev.map(ep => ep.id === epId ? { 
        ...ep, 
        processing_status: 'failed', 
        error_message: err.response?.data?.detail || err.message 
      } : ep));
      alert('Processing failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  }

  // Sequential batch processing
  async function startBatchProcessing(pendingOnly = false) {
    if (isBatchRunning || !selectedShow || episodes.length === 0) return;

    setShowConfirmModal(false);
    stopRequestedRef.current = false;
    setIsBatchRunning(true);

    const targetEpisodes = pendingOnly 
      ? episodes.filter(e => e.processing_status === 'pending' || e.processing_status === 'failed')
      : [...episodes];

    if (targetEpisodes.length === 0) {
      setIsBatchRunning(false);
      return;
    }

    setBatchProgress({
      current: 0,
      total: targetEpisodes.length,
      completed: 0,
      failed: 0,
      promosFound: 0,
    });

    let completedCount = 0;
    let failedCount = 0;
    let totalPromosFound = 0;

    for (let i = 0; i < targetEpisodes.length; i++) {
      if (stopRequestedRef.current) break;

      const ep = targetEpisodes[i];
      setCurrentBatchEp(ep);
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));

      setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, processing_status: 'processing' } : e));

      try {
        const res = await processEpisode(ep.id);
        const epData = await getEpisode(ep.id);

        const found = res.data?.length || 0;
        totalPromosFound += found;
        completedCount++;

        setEpisodes(prev => prev.map(e => e.id === ep.id ? { 
          ...epData.data, 
          processing_status: 'completed', 
          promos_found: found 
        } : e));

        setBatchProgress(prev => ({ 
          ...prev, 
          completed: completedCount,
          promosFound: totalPromosFound
        }));

      } catch (err) {
        console.error(`Batch processing failed for Episode ${ep.episode_number}:`, err);
        failedCount++;
        setEpisodes(prev => prev.map(e => e.id === ep.id ? { 
          ...e, 
          processing_status: 'failed', 
          error_message: err.response?.data?.detail || err.message 
        } : e));

        setBatchProgress(prev => ({ ...prev, failed: failedCount }));
      }
    }

    setIsBatchRunning(false);
    setCurrentBatchEp(null);
  }

  function handleStopBatch() {
    stopRequestedRef.current = true;
  }

  const completedCount = episodes.filter(e => e.processing_status === 'completed').length;
  const pendingCount = episodes.filter(e => e.processing_status === 'pending').length;
  const failedCount = episodes.filter(e => e.processing_status === 'failed').length;
  const totalEpisodes = episodes.length;
  const progressPercent = totalEpisodes > 0 ? Math.round((completedCount / totalEpisodes) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shows & Episodes Management</h1>
          <p className="text-xs text-slate-500">
            Screenplay parsing, cue-sheet timestamp validation, and AI promotional moment discovery.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create Show
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shows Sidebar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Registered Series</h2>
            <span className="text-xs text-slate-400 font-semibold">{shows.length}</span>
          </div>

          {shows.length === 0 ? (
            <p className="text-xs text-slate-400 p-2">No shows created yet.</p>
          ) : (
            <div className="space-y-1">
              {shows.map((show) => {
                const isSelected = selectedShow?.id === show.id;
                return (
                  <button
                    key={show.id}
                    onClick={() => selectShow(show)}
                    className={`w-full text-left p-3 rounded-lg text-xs transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-50 text-purple-950 border border-purple-200 font-semibold shadow-xs'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold text-sm text-slate-900 truncate">{show.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {show.language} &bull; {show.episode_count || 0} episodes
                      </div>
                    </div>
                    <Film className={`w-4 h-4 shrink-0 ${isSelected ? 'text-purple-600' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Series Detail & Episodes View */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          {selectedShow ? (
            <>
              {/* Series Overview Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{selectedShow.title}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {selectedShow.language}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedShow.description || 'No series description provided.'}
                  </p>
                </div>
                
                {episodes.length > 0 && (
                  <div className="flex items-center gap-2">
                    {isBatchRunning ? (
                      <button
                        onClick={handleStopBatch}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause Batch
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {pendingCount > 0 && (
                          <button
                            onClick={() => startBatchProcessing(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Process Pending ({pendingCount})
                          </button>
                        )}
                        <button
                          onClick={() => setShowConfirmModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Re-process All ({totalEpisodes})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Series Statistics Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500 block">Total Episodes</span>
                  <span className="text-lg font-bold text-slate-900">{totalEpisodes}</span>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200/80">
                  <span className="text-[11px] font-medium text-emerald-700 block">Parsed Successfully</span>
                  <span className="text-lg font-bold text-emerald-800">{completedCount}</span>
                </div>
                <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200/80">
                  <span className="text-[11px] font-medium text-rose-700 block">Failed Episodes</span>
                  <span className="text-lg font-bold text-rose-800">{failedCount}</span>
                </div>
                <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200/80">
                  <span className="text-[11px] font-medium text-purple-700 block">Awaiting Processing</span>
                  <span className="text-lg font-bold text-purple-800">{pendingCount}</span>
                </div>
              </div>

              {/* Live Batch Progress Banner */}
              {totalEpisodes > 0 && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isBatchRunning 
                    ? 'bg-purple-50/50 border-purple-200 shadow-xs' 
                    : completedCount === totalEpisodes
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isBatchRunning ? (
                        <div className="flex items-center gap-2 text-purple-800 font-semibold text-xs">
                          <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                          <span>Currently Processing: <strong>Episode {currentBatchEp?.episode_number}</strong> ({currentBatchEp?.original_filename})</span>
                        </div>
                      ) : completedCount === totalEpisodes ? (
                        <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>All {totalEpisodes} episodes parsed & candidate promos discovered!</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-600 font-medium text-xs">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>Progress: {completedCount} of {totalEpisodes} completed</span>
                        </div>
                      )}
                    </div>
                    
                    {completedCount > 0 && (
                      <button
                        onClick={() => navigate('/promos')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        View Ranked Promos
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full transition-all duration-300 rounded-full ${
                        isBatchRunning ? 'bg-purple-600 animate-pulse' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-semibold text-slate-700">
                      Overall: <strong className="text-purple-700">{progressPercent}%</strong>
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium">
                      Done: <strong>{completedCount}</strong>
                    </span>
                    {pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-medium">
                        Pending: <strong>{pendingCount}</strong>
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                        Failed: <strong>{failedCount}</strong>
                      </span>
                    )}
                    {isBatchRunning && (
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium animate-pulse">
                        Step: <strong>{batchProgress.current} / {batchProgress.total}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Episodes Table */}
              {episodes.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-700">No screenplays uploaded for this series.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Upload TXT, PDF, or a multi-episode ZIP archive on the Upload page.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Ep #</th>
                        <th className="py-2.5 px-3">Screenplay File</th>
                        <th className="py-2.5 px-3">Scenes</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Pipeline Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {episodes.map((ep) => {
                        const isCurrent = currentBatchEp?.id === ep.id;
                        const isProcessing = ep.processing_status === 'processing' || isCurrent || processingId === ep.id;
                        const isDone = ep.processing_status === 'completed';
                        const isFailed = ep.processing_status === 'failed';

                        return (
                          <tr key={ep.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              Ep {ep.episode_number}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 max-w-[200px] truncate" title={ep.original_filename}>
                              {ep.original_filename}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {ep.scene_count ? `${ep.scene_count} scenes` : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {ep.duration_estimate_seconds ? `${ep.duration_estimate_seconds}s` : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isProcessing ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Parsing...
                                </span>
                              ) : isDone ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  Parsed
                                </span>
                              ) : isFailed ? (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
                                  title={ep.error_message || 'Parsing error'}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                  Uploaded
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Inspect details button */}
                                <button
                                  onClick={() => handleInspectEpisode(ep)}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                                  title="Inspect Screenplay Cues & AI Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Process / Reprocess button */}
                                <button
                                  onClick={() => handleProcessEpisode(ep.id)}
                                  disabled={isBatchRunning || isProcessing}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                                    isDone
                                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                                  }`}
                                >
                                  {isProcessing ? 'Working...' : isDone ? 'Re-run' : 'Discover Promos'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <Film className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Select a series to view episodes</p>
            </div>
          )}
        </div>
      </div>

      {/* Episode Inspection Modal */}
      {inspectModalOpen && inspectingEpisode && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Screenplay Inspection: Episode {inspectingEpisode.episode_number}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{inspectingEpisode.original_filename}</p>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {inspectionLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
                  <span className="text-slate-500 font-medium">Extracting screenplay cues & scene headers...</span>
                </div>
              ) : inspectionData ? (
                <>
                  {/* Meta Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Total Scenes</span>
                      <strong className="text-sm text-slate-900">{inspectionData.scene_count}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Extracted Cues</span>
                      <strong className="text-sm text-slate-900">{inspectionData.total_cues}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Duration</span>
                      <strong className="text-sm text-slate-900">{inspectionData.duration_seconds}s</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Discovered Promos</span>
                      <strong className="text-sm text-slate-900">{inspectionData.promos_count}</strong>
                    </div>
                  </div>

                  {/* AI Provider Config */}
                  <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-900">
                      <Cpu className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <span className="font-bold text-xs">AI Inference Engine:</span>{' '}
                        <span className="text-xs">{inspectionData.ai_info.provider}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white text-purple-800 border border-purple-200">
                      {inspectionData.ai_info.groq_model}
                    </span>
                  </div>

                  {/* Parsing Warnings / Errors if any */}
                  {inspectionData.warnings && inspectionData.warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Parser Notice
                      </div>
                      {inspectionData.warnings.map((w, idx) => (
                        <p key={idx} className="text-xs">{w}</p>
                      ))}
                    </div>
                  )}

                  {/* Screenplay Excerpt & Scenes */}
                  <div>
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                      Parsed Cues & Dialogue Segments ({inspectionData.cues.length} sampled)
                    </h4>
                    <div className="bg-slate-50 rounded-lg border border-slate-200 max-h-56 overflow-y-auto p-3 divide-y divide-slate-200/60 font-mono text-[11px]">
                      {inspectionData.cues.length === 0 ? (
                        <p className="text-slate-400">No formatted cues extracted.</p>
                      ) : (
                        inspectionData.cues.map((c, i) => (
                          <div key={i} className="py-1.5 first:pt-0 last:pb-0 flex items-start gap-2">
                            <span className="text-purple-700 shrink-0">
                              [{c.start_timestamp} - {c.end_timestamp}]
                            </span>
                            <span className="font-bold text-slate-900 shrink-0">
                              {c.speaker}:
                            </span>
                            <span className="text-slate-700">"{c.text}"</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 text-center py-6">Could not load inspection details.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Verified against disk screenplay cue-sheet</span>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Batch Reprocess */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Re-process All Episodes?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will re-run screenplay parsing, cue extraction, and AI candidate discovery across all{' '}
              <strong>{totalEpisodes} episodes</strong> of <em>{selectedShow?.title}</em>.
              Existing promo candidates will be cleanly updated with zero duplicates.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => startBatchProcessing(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                Confirm Re-process All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Show Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateShow}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200"
          >
            <h3 className="text-base font-bold text-slate-900">Create New Microdrama Series</h3>
            
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Series Title *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., I Married a Broken Soldier"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Description (Optional)</label>
              <textarea
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short logline or premise..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                Create Series
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
