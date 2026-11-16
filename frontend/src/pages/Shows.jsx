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
  Eye,
  SlidersHorizontal,
  Film
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getShows, createShow, getEpisodes, getEpisode, processEpisode, inspectEpisode, getPromos } from '../api';

export default function Shows() {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [showPromos, setShowPromos] = useState([]);
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
      const [epRes, promoRes] = await Promise.all([
        getEpisodes(show.id),
        getPromos({ show_id: show.id })
      ]);
      setEpisodes(epRes.data || []);
      setShowPromos(promoRes.data || []);
    } catch (err) {
      console.error('Failed to load episodes:', err);
      setEpisodes([]);
      setShowPromos([]);
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

      // Refresh promos count
      if (selectedShow) {
        const pr = await getPromos({ show_id: selectedShow.id });
        setShowPromos(pr.data || []);
      }
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

  async function startBatchProcessing() {
    if (isBatchRunning || !selectedShow || episodes.length === 0) return;
    setShowConfirmModal(false);
    stopRequestedRef.current = false;
    setIsBatchRunning(true);

    const targetEpisodes = [...episodes];
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

      if (i < targetEpisodes.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    if (selectedShow) {
      const pr = await getPromos({ show_id: selectedShow.id });
      setShowPromos(pr.data || []);
    }

    setIsBatchRunning(false);
    setCurrentBatchEp(null);
  }

  const completedCount = episodes.filter(e => e.processing_status === 'completed').length;
  const failedCount = episodes.filter(e => e.processing_status === 'failed').length;
  const totalEpisodes = episodes.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Width ~4/12): Shows List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
              <span>Shows ({shows.length})</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowModalOpen(true)}
                className="text-xs text-[#0F766E] font-bold hover:underline flex items-center gap-0.5"
                title="Create new series"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto">
            {loadingShows ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading shows...</div>
            ) : shows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No shows registered yet.</div>
            ) : (
              shows.map((show) => {
                const isSelected = selectedShow?.id === show.id;
                return (
                  <button
                    key={show.id}
                    onClick={() => handleSelectShow(show)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[#CCFBF1]/30 border-[#0F766E] text-[#0F766E]'
                        : 'border-slate-100 bg-[#F5F7FA] hover:bg-slate-100 text-[#172B4D]'
                    }`}
                  >
                    {/* Thumbnail Avatar */}
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#172B4D] to-[#0F766E] text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
                      {show.title.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#172B4D] truncate">{show.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {show.language || 'English'} &bull; {show.total_episodes || 0} episodes
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Width ~8/12): Show Header, 4 Stat Boxes & Episodes Table */}
        <div className="lg:col-span-8 space-y-4">
          {selectedShow ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              {/* Show Header Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#172B4D] to-[#0F766E] text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-sm">
                    {selectedShow.title.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#172B4D]">{selectedShow.title}</h3>
                    <p className="text-xs text-[#64748B]">
                      {selectedShow.language || 'English'} &bull; {totalEpisodes} Episodes
                    </p>
                  </div>
                </div>

                {/* Re-process All Action */}
                {!isBatchRunning ? (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={episodes.length === 0}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-bold text-[#172B4D] transition-colors disabled:opacity-40"
                  >
                    Re-process All
                  </button>
                ) : (
                  <button
                    onClick={() => { stopRequestedRef.current = true; }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 transition-colors"
                  >
                    Pause Batch
                  </button>
                )}
              </div>

              {/* 4 Stat Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-xl text-center">
                  <div className="text-xl font-black text-[#172B4D]">{totalEpisodes}</div>
                  <div className="text-[11px] font-semibold text-slate-500">Total</div>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-xl font-black text-emerald-700">{completedCount}</div>
                  <div className="text-[11px] font-semibold text-emerald-700">Parsed</div>
                </div>
                <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl text-center">
                  <div className="text-xl font-black text-rose-700">{failedCount}</div>
                  <div className="text-[11px] font-semibold text-rose-700">Failed</div>
                </div>
                <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl text-center">
                  <div className="text-xl font-black text-[#0F766E]">{showPromos.length}</div>
                  <div className="text-[11px] font-semibold text-[#0F766E]">Candidates</div>
                </div>
              </div>

              {/* Batch Processing Indicator */}
              {isBatchRunning && (
                <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F766E] flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Processing: Ep {currentBatchEp?.episode_number}
                    </span>
                    <span className="text-[11px] font-bold text-slate-600">
                      Step {batchProgress.current} / {batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0F766E] h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Episode Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[#64748B] font-bold text-[11px]">
                      <th className="py-2.5 px-3">Ep #</th>
                      <th className="py-2.5 px-3">File</th>
                      <th className="py-2.5 px-3">Scenes</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Parse</th>
                      <th className="py-2.5 px-3">Discovery</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingEpisodes ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">Loading episodes...</td>
                      </tr>
                    ) : episodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No episodes uploaded yet. <Link to="/upload" className="text-[#0F766E] font-bold hover:underline">Upload screenplays</Link>.
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
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-[180px]" title={ep.original_filename}>
                              {ep.original_filename}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {ep.scene_count > 0 ? ep.scene_count : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {ep.duration_estimate_seconds > 0 ? `${ep.duration_estimate_seconds}s` : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  ✓ Parsed
                                </span>
                              ) : isFailed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  ✗ Failed
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Pending</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {isProcessing ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0F766E] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Running
                                </span>
                              ) : isDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  ✓ Done
                                </span>
                              ) : isFailed ? (
                                <button
                                  onClick={() => handleProcessEpisode(ep.id)}
                                  className="text-[10px] text-rose-600 font-bold hover:underline"
                                >
                                  Retry
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleProcessEpisode(ep.id)}
                                  className="text-[10px] text-[#0F766E] font-bold hover:underline"
                                >
                                  Discover
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleInspectEpisode(ep)}
                                className="p-1 rounded text-slate-400 hover:text-[#0F766E] hover:bg-slate-100 transition-colors"
                                title="Inspect cues and timestamps"
                              >
                                <Eye className="w-4 h-4 mx-auto" />
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
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
              Select a series to inspect episodes
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
              Re-process All Episodes?
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              This will sequentially parse screenplay dialogue cues and run AI promo discovery across all {totalEpisodes} episodes in &quot;{selectedShow?.title}&quot;.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={startBatchProcessing}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0F766E] hover:bg-[#115E59]"
              >
                Confirm Re-process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Episode Inspection Modal */}
      {inspectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#172B4D]">
                  Episode {inspectingEpisode?.episode_number} Inspection
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
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                      <div className="text-[10px] font-semibold text-slate-500">Cues</div>
                      <div className="text-base font-bold text-[#172B4D]">{inspectionData.cues_count || 0}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                      <div className="text-[10px] font-semibold text-slate-500">Scenes</div>
                      <div className="text-base font-bold text-[#172B4D]">{inspectionData.scenes_count || 0}</div>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-center">
                      <div className="text-[10px] font-semibold text-[#0F766E]">Duration</div>
                      <div className="text-base font-bold text-[#0F766E]">{inspectionData.duration_seconds || 0}s</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#172B4D] mb-1.5">Parsed Cues & Timecodes:</h4>
                    <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono max-h-56 overflow-y-auto space-y-1">
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
