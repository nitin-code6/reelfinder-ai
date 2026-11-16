import React, { useEffect, useState, useRef } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Play, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  ChevronRight, 
  Sparkles,
  Pause,
  RotateCcw,
  X,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getShows, createShow, getEpisodes, getEpisode, processEpisode, inspectEpisode } from '../api';

export default function Shows() {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingShows, setLoadingShows] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // New Show Form State
  const [showModalOpen, setShowModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('English');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Reprocess confirm modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMode, setConfirmMode] = useState('all'); // 'all' | 'failed'

  // Inspect Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingEpisode, setInspectingEpisode] = useState(null);
  const [inspectionData, setInspectionData] = useState(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);

  // Processing state
  const [processingId, setProcessingId] = useState(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [currentBatchEp, setCurrentBatchEp] = useState(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, completed: 0, failed: 0 });
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    loadShows();
  }, []);

  async function loadShows() {
    setLoadingShows(true);
    try {
      const res = await getShows();
      const list = res.data || [];
      setShows(list);
      if (list.length > 0 && !selectedShow) {
        handleSelectShow(list[0]);
      }
    } catch (err) {
      console.error('Failed to load shows:', err);
    } finally {
      setLoadingShows(false);
    }
  }

  async function handleSelectShow(show) {
    setSelectedShow(show);
    setLoadingEpisodes(true);
    try {
      const res = await getEpisodes(show.id);
      setEpisodes(res.data || []);
    } catch (err) {
      console.error('Failed to load episodes:', err);
      setEpisodes([]);
    } finally {
      setLoadingEpisodes(false);
    }
  }

  async function handleCreateShow(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await createShow({
        title: title.trim(),
        language: language.trim(),
        description: description.trim() || undefined,
      });
      setShowModalOpen(false);
      setTitle('');
      setDescription('');
      await loadShows();
      handleSelectShow(res.data);
    } catch (err) {
      alert('Error creating show: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreating(false);
    }
  }

  async function handleInspectEpisode(ep) {
    setInspectingEpisode(ep);
    setInspectModalOpen(true);
    setInspectionLoading(true);
    setInspectionData(null);
    try {
      const res = await inspectEpisode(ep.id);
      setInspectionData(res.data);
    } catch (err) {
      console.error('Failed to inspect episode:', err);
    } finally {
      setInspectionLoading(false);
    }
  }

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

  async function startBatchProcessing(mode = 'all') {
    if (isBatchRunning || !selectedShow || episodes.length === 0) return;
    setShowConfirmModal(false);
    stopRequestedRef.current = false;
    setIsBatchRunning(true);

    const targetEpisodes = mode === 'failed'
      ? episodes.filter(e => e.processing_status === 'failed' || e.processing_status === 'pending')
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
    });

    let completed = 0;
    let failed = 0;

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
        completed++;

        setEpisodes(prev => prev.map(e => e.id === ep.id ? {
          ...epData.data,
          processing_status: 'completed',
          promos_found: found
        } : e));

        setBatchProgress(prev => ({ ...prev, completed }));
      } catch (err) {
        console.error(`Batch processing failed for Ep ${ep.episode_number}:`, err);
        failed++;
        setEpisodes(prev => prev.map(e => e.id === ep.id ? {
          ...e,
          processing_status: 'failed',
          error_message: err.response?.data?.detail || err.message
        } : e));
        setBatchProgress(prev => ({ ...prev, failed }));
      }

      // 400ms throttle between episodes to protect AI provider rate limits
      if (i < targetEpisodes.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    setIsBatchRunning(false);
    setCurrentBatchEp(null);
  }

  const completedCount = episodes.filter(e => e.processing_status === 'completed').length;
  const failedCount = episodes.filter(e => e.processing_status === 'failed').length;
  const pendingCount = episodes.filter(e => e.processing_status === 'pending').length;
  const totalEpisodes = episodes.length;
  const progressPercent = totalEpisodes > 0 ? Math.round((completedCount / totalEpisodes) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#172B4D] tracking-tight">Library & Episode Management</h2>
          <p className="text-xs text-[#64748B]">
            Screenplay parsing, cue-sheet timestamp validation, and promotional moment discovery.
          </p>
        </div>
        <button
          onClick={() => setShowModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Series</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Registered Series List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D]">
              Registered Series ({shows.length})
            </h3>
            <button
              onClick={loadShows}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              title="Refresh series"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {loadingShows ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading series...</div>
            ) : shows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No series registered yet.
              </div>
            ) : (
              shows.map((show) => {
                const isSelected = selectedShow?.id === show.id;
                return (
                  <button
                    key={show.id}
                    onClick={() => handleSelectShow(show)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-teal-50/70 border-[#0F766E] text-[#0F766E]'
                        : 'border-slate-100 bg-[#F5F7FA] hover:bg-slate-100 text-[#172B4D]'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold truncate">{show.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {show.language || 'English'} &bull; {show.total_episodes || 0} episodes
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Series Episode Table */}
        <div className="lg:col-span-8 space-y-4">
          {selectedShow ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              {/* Series Summary Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-[#172B4D]">{selectedShow.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                    <span className="font-medium">{selectedShow.language}</span>
                    <span>&bull;</span>
                    <span>{totalEpisodes} Episodes Uploaded</span>
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center gap-2">
                  {failedCount > 0 && !isBatchRunning && (
                    <button
                      onClick={() => {
                        setConfirmMode('failed');
                        setShowConfirmModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      <span>Retry Failed ({failedCount})</span>
                    </button>
                  )}

                  {!isBatchRunning ? (
                    <button
                      onClick={() => {
                        setConfirmMode('all');
                        setShowConfirmModal(true);
                      }}
                      disabled={episodes.length === 0}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Process All Episodes</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { stopRequestedRef.current = true; }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-all"
                    >
                      <Pause className="w-3.5 h-3.5 text-rose-600" />
                      <span>Pause Batch</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar during Batch */}
              {isBatchRunning && (
                <div className="p-3.5 bg-teal-50/50 border border-teal-200/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F766E] flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Processing: Ep {currentBatchEp?.episode_number} ({currentBatchEp?.original_filename})
                    </span>
                    <span className="text-[11px] font-bold text-slate-600">
                      Step {batchProgress.current} / {batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0F766E] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Completed: <strong className="text-emerald-700">{batchProgress.completed}</strong></span>
                    <span>Failed: <strong className="text-rose-700">{batchProgress.failed}</strong></span>
                  </div>
                </div>
              )}

              {/* Episode Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[#64748B] font-bold">
                      <th className="py-2.5 px-3">EP #</th>
                      <th className="py-2.5 px-3">SCREENPLAY FILE</th>
                      <th className="py-2.5 px-3">SCENES</th>
                      <th className="py-2.5 px-3">EST. DURATION</th>
                      <th className="py-2.5 px-3">PIPELINE STATUS</th>
                      <th className="py-2.5 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingEpisodes ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">Loading episodes...</td>
                      </tr>
                    ) : episodes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No episodes in this series. <Link to="/upload" className="text-[#0F766E] font-bold hover:underline">Upload screenplays</Link>.
                        </td>
                      </tr>
                    ) : (
                      episodes.map((ep) => {
                        const isCurrent = currentBatchEp?.id === ep.id;
                        const isProcessing = ep.processing_status === 'processing' || isCurrent || processingId === ep.id;
                        const isDone = ep.processing_status === 'completed';
                        const isFailed = ep.processing_status === 'failed';

                        return (
                          <tr key={ep.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-[#172B4D]">
                              Ep {ep.episode_number}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-[200px]" title={ep.original_filename}>
                              {ep.original_filename}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {ep.scene_count > 0 ? `${ep.scene_count} scenes` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {ep.duration_estimate_seconds > 0 ? `${ep.duration_estimate_seconds}s` : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isProcessing ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#0F766E] border border-teal-200">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  PROCESSING
                                </span>
                              ) : isDone ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#15803D] border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  DISCOVERED
                                </span>
                              ) : isFailed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-[#DC2626] border border-rose-200">
                                  <AlertCircle className="w-3 h-3" />
                                  FAILED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right space-x-1.5">
                              <button
                                onClick={() => handleInspectEpisode(ep)}
                                className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                                title="Inspect cues & timestamps"
                              >
                                Inspect
                              </button>
                              <button
                                onClick={() => handleProcessEpisode(ep.id)}
                                disabled={isProcessing || isBatchRunning}
                                className="px-2 py-1 rounded bg-[#0F766E] hover:bg-[#115E59] text-white text-[11px] font-semibold transition-all disabled:opacity-40"
                              >
                                {isDone ? 'Re-run' : 'Discover'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              Select a series to view episodes
            </div>
          )}
        </div>
      </div>

      {/* New Series Modal */}
      {showModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#172B4D]">Register New Series</h3>
              <button onClick={() => setShowModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateShow} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Series Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Secret Billionaire Heir"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0F766E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="e.g. English, Mandarin, Hindi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0F766E] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Premise or genre..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0F766E] focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0F766E] hover:bg-[#115E59]"
                >
                  {creating ? 'Creating...' : 'Create Series'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Batch Reprocess */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-[#172B4D]">
              {confirmMode === 'failed' ? 'Retry Failed Episodes?' : 'Process All Episodes?'}
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {confirmMode === 'failed'
                ? `This will re-run screenplay parsing and promo discovery on ${failedCount} failed episode(s).`
                : `This will sequentially process all ${totalEpisodes} episode(s) in "${selectedShow?.title}". Each episode discovers and ranks promo candidates.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => startBatchProcessing(confirmMode)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0F766E] hover:bg-[#115E59]"
              >
                Confirm Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Episode Inspection Modal */}
      {inspectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172B4D]">
                  Episode Inspection: Ep {inspectingEpisode?.episode_number}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {inspectingEpisode?.original_filename}
                </span>
              </div>
              <button onClick={() => setInspectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {inspectionLoading ? (
                <div className="p-12 text-center text-xs text-slate-400">Loading inspection data...</div>
              ) : inspectionData ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-semibold text-slate-500">Cues Extracted</div>
                      <div className="text-base font-bold text-[#172B4D]">{inspectionData.cues_count || 0}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-semibold text-slate-500">Scenes Detected</div>
                      <div className="text-base font-bold text-[#172B4D]">{inspectionData.scenes_count || 0}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-semibold text-slate-500">Duration Range</div>
                      <div className="text-base font-bold text-[#0F766E]">{inspectionData.duration_seconds || 0}s</div>
                    </div>
                  </div>

                  {/* Dialogue cues preview */}
                  <div>
                    <h4 className="text-xs font-bold text-[#172B4D] mb-2">Screenplay Cues & Timecodes:</h4>
                    <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono max-h-60 overflow-y-auto space-y-1">
                      {inspectionData.cues && inspectionData.cues.length > 0 ? (
                        inspectionData.cues.map((c, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-teal-400 shrink-0">[{c.timestamp || '00:00.00'}]</span>
                            <span className="text-slate-300">{c.speaker ? `${c.speaker}: ` : ''}{c.text}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 italic">No cues parsed for this episode.</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400">No inspection details available.</div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
