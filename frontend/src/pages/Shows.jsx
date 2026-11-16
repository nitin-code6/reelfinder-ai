import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Film, Plus, Play, CheckCircle2, Clock, AlertCircle, RefreshCw, Layers, 
  Pause, Sparkles, ArrowRight, Check, AlertTriangle, FileText
} from 'lucide-react';
import { getShows, createShow, getEpisodes, getEpisode, processEpisode } from '../api';

export default function Shows() {
  const navigate = useNavigate();
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  // Single episode processing state
  const [processingId, setProcessingId] = useState(null);
  
  // Batch processing state
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isBatchPaused, setIsBatchPaused] = useState(false);
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
      setEpisodes(res.data);
      // Reset batch state when changing shows
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
        title: newTitle,
        language: 'English',
        description: newDesc,
      });
      setShowModal(false);
      setNewTitle('');
      setNewDesc('');
      await loadShows();
      selectShow(res.data);
    } catch (err) {
      alert('Error creating show: ' + (err.response?.data?.detail || err.message));
    }
  }

  // Process a single episode
  async function handleProcessEpisode(epId) {
    if (isBatchRunning) return;
    setProcessingId(epId);
    
    // Optimistically update status to 'processing'
    setEpisodes(prev => prev.map(ep => ep.id === epId ? { ...ep, processing_status: 'processing' } : ep));
    
    try {
      const promoRes = await processEpisode(epId);
      const epRes = await getEpisode(epId);
      
      setEpisodes(prev => prev.map(ep => ep.id === epId ? { ...epRes.data, promos_found: promoRes.data.length } : ep));
    } catch (err) {
      setEpisodes(prev => prev.map(ep => ep.id === epId ? { ...ep, processing_status: 'failed', error_message: err.message } : ep));
      alert('Processing failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  }

  // Interactive Episode-by-Episode Batch Processor
  async function startBatchProcessing(onlyPending = false) {
    if (!selectedShow || episodes.length === 0) return;

    const queue = onlyPending 
      ? episodes.filter(e => e.processing_status !== 'completed')
      : [...episodes];

    if (queue.length === 0) {
      alert('All episodes are already completed!');
      return;
    }

    stopRequestedRef.current = false;
    setIsBatchRunning(true);
    setIsBatchPaused(false);

    // Reset non-completed episodes to 'pending' in the UI so they don't show old failure states
    const queueIds = new Set(queue.map(e => e.id));
    setEpisodes(prev => prev.map(e => 
      queueIds.has(e.id) && e.processing_status !== 'completed'
        ? { ...e, processing_status: 'pending', error_message: null }
        : e
    ));

    let completedCount = episodes.filter(e => e.processing_status === 'completed' && !queueIds.has(e.id)).length;
    let failedCount = 0;
    let totalPromosFound = 0;

    setBatchProgress({
      current: 0,
      total: queue.length,
      completed: completedCount,
      failed: 0,
      promosFound: totalPromosFound,
    });

    for (let i = 0; i < queue.length; i++) {
      if (stopRequestedRef.current) {
        break;
      }

      const ep = queue[i];
      setCurrentBatchEp(ep);
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));

      // 1. Mark episode as processing in UI
      setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, processing_status: 'processing' } : e));

      try {
        // 2. Call backend process
        const res = await processEpisode(ep.id);
        const epData = await getEpisode(ep.id);

        const found = res.data?.length || 0;
        totalPromosFound += found;
        completedCount++;

        // 3. Update episode with completed details
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
    setIsBatchPaused(true);
  }

  const completedCount = episodes.filter(e => e.processing_status === 'completed').length;
  const pendingCount = episodes.filter(e => e.processing_status === 'pending').length;
  const failedCount = episodes.filter(e => e.processing_status === 'failed').length;
  const totalEpisodes = episodes.length;
  const progressPercent = totalEpisodes > 0 ? Math.round((completedCount / totalEpisodes) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shows & Episodes Management</h1>
          <p className="text-xs text-slate-500">Live episode-wise screenplay parser, AI candidate discovery, and automated scoring pipeline.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Show
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shows Sidebar */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider px-2">Registered Series</h2>
          {shows.length === 0 ? (
            <p className="text-xs text-slate-400 p-2">No shows created yet.</p>
          ) : (
            <div className="space-y-1">
              {shows.map((show) => (
                <button
                  key={show.id}
                  onClick={() => selectShow(show)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    selectedShow?.id === show.id
                      ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-medium'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="truncate">
                    <div className="font-semibold">{show.title}</div>
                    <div className="text-xs text-slate-500">{show.language} &bull; {show.episode_count || 0} episodes</div>
                  </div>
                  <Film className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Episode Detail View */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          {selectedShow ? (
            <>
              {/* Show Header & Batch Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedShow.title}</h2>
                  <p className="text-xs text-slate-500">{selectedShow.description || 'No description provided.'}</p>
                </div>
                
                {episodes.length > 0 && (
                  <div className="flex items-center gap-2">
                    {isBatchRunning ? (
                      <button
                        onClick={handleStopBatch}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause Batch
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {pendingCount > 0 ? (
                          <button
                            onClick={() => startBatchProcessing(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Process Pending ({pendingCount})
                          </button>
                        ) : null}
                        
                        <button
                          onClick={() => startBatchProcessing(false)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Re-process All ({totalEpisodes})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Live Batch Progress Banner */}
              {totalEpisodes > 0 && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isBatchRunning 
                    ? 'bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border-indigo-200 shadow-sm' 
                    : completedCount === totalEpisodes
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isBatchRunning ? (
                        <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                          <span>Currently Processing: <strong className="font-bold">Episode {currentBatchEp?.episode_number}</strong> ({currentBatchEp?.original_filename})</span>
                        </div>
                      ) : completedCount === totalEpisodes ? (
                        <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>All {totalEpisodes} episodes processed! Promos ready for editor review.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-600 font-medium text-xs">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>Batch Progress: {completedCount} of {totalEpisodes} completed</span>
                        </div>
                      )}
                    </div>
                    
                    {completedCount > 0 && (
                      <button
                        onClick={() => navigate('/promos')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        View Discovered Promos
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden mb-3">
                    <div 
                      className={`h-full transition-all duration-300 rounded-full ${
                        isBatchRunning ? 'bg-indigo-600 animate-pulse' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold text-slate-700">
                      Progress: <span className="text-indigo-700 font-bold">{progressPercent}%</span>
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium">
                      Total: <strong>{totalEpisodes}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                      Done: <strong>{completedCount}</strong>
                    </span>
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-medium">
                        Pending: <strong>{pendingCount}</strong>
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                        Failed: <strong>{failedCount}</strong>
                      </span>
                    )}
                    {isBatchRunning && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium animate-pulse">
                        Step: <strong>{batchProgress.current} / {batchProgress.total}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {episodes.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No screenplay files uploaded for this show.</p>
                  <p className="text-xs text-slate-400 mt-1">Go to the Upload page to import TXT, PDF, or a multi-episode ZIP archive.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[550px] overflow-y-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                      <tr className="border-b border-slate-200 text-slate-400 text-xs uppercase font-semibold">
                        <th className="py-2.5 px-3">Ep #</th>
                        <th className="py-2.5 px-3">Screenplay File</th>
                        <th className="py-2.5 px-3">Scenes</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Pipeline Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {episodes.map((ep) => {
                        const isCurrent = currentBatchEp?.id === ep.id;
                        const isProcessing = ep.processing_status === 'processing' || isCurrent || processingId === ep.id;
                        const isDone = ep.processing_status === 'completed';
                        const isFailed = ep.processing_status === 'failed';

                        return (
                          <tr 
                            key={ep.id} 
                            className={`transition-colors ${
                              isCurrent 
                                ? 'bg-indigo-50/70 font-medium ring-1 ring-indigo-200' 
                                : isDone 
                                ? 'hover:bg-slate-50/50' 
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                              Ep {ep.episode_number}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-slate-600 truncate max-w-xs">
                              <span className="inline-flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {ep.original_filename}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">
                              {ep.scene_count ? `${ep.scene_count} scenes` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-slate-600">
                              {ep.duration_estimate_seconds ? `${ep.duration_estimate_seconds}s` : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isProcessing ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-blue-100 text-blue-800 animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Processing...
                                </span>
                              ) : isDone ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" />
                                  Completed
                                </span>
                              ) : isFailed ? (
                                <span 
                                  title={ep.error_message || 'Pipeline failed'}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-rose-100 text-rose-800 cursor-help"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-slate-100 text-slate-600">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleProcessEpisode(ep.id)}
                                disabled={isBatchRunning || isProcessing}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 ${
                                  isDone
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700'
                                }`}
                              >
                                {isProcessing ? 'Analyzing...' : isDone ? 'Re-run' : 'Discover Promos'}
                              </button>
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
            <div className="text-center py-16 text-slate-400">Select a show to view details.</div>
          )}
        </div>
      </div>

      {/* Create Show Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create New Microdrama Show</h3>
            <form onSubmit={handleCreateShow} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Show Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. I Married a Broken Soldier"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief synopsis or audience genre..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Save Show
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
