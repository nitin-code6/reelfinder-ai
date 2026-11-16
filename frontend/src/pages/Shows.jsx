import React, { useEffect, useState } from 'react';
import { Film, Plus, Play, CheckCircle2, Clock, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { getShows, createShow, getEpisodes, processEpisode, processAllEpisodes } from '../api';

export default function Shows() {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

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

  async function handleProcessEpisode(epId) {
    setProcessingId(epId);
    try {
      await processEpisode(epId);
      await selectShow(selectedShow);
    } catch (err) {
      alert('Processing failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleProcessAll() {
    if (!selectedShow) return;
    setBatchProcessing(true);
    try {
      await processAllEpisodes(selectedShow.id);
      await selectShow(selectedShow);
      alert('Batch processing completed successfully!');
    } catch (err) {
      alert('Batch processing error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setBatchProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shows & Episodes Management</h1>
          <p className="text-xs text-slate-500">Manage microdrama series, view episode cue-sheets, and trigger promo discovery.</p>
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedShow.title}</h2>
                  <p className="text-xs text-slate-500">{selectedShow.description || 'No description provided.'}</p>
                </div>
                {episodes.length > 0 && (
                  <button
                    onClick={handleProcessAll}
                    disabled={batchProcessing}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${batchProcessing ? 'animate-spin' : ''}`} />
                    {batchProcessing ? 'Processing All...' : 'Process All Episodes'}
                  </button>
                )}
              </div>

              {episodes.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No screenplay files uploaded for this show.</p>
                  <p className="text-xs text-slate-400 mt-1">Go to the Upload page to import TXT, PDF, or a multi-episode ZIP archive.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase font-semibold">
                        <th className="pb-3">Ep #</th>
                        <th className="pb-3">Filename</th>
                        <th className="pb-3">Scenes</th>
                        <th className="pb-3">Est. Duration</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {episodes.map((ep) => (
                        <tr key={ep.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-bold text-slate-900">Ep {ep.episode_number}</td>
                          <td className="py-3 text-xs text-slate-600 truncate max-w-xs">{ep.original_filename}</td>
                          <td className="py-3 text-xs text-slate-600">{ep.scene_count || '-'}</td>
                          <td className="py-3 text-xs text-slate-600">{ep.duration_estimate_seconds ? `${ep.duration_estimate_seconds}s` : '-'}</td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                ep.processing_status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ep.processing_status === 'failed'
                                  ? 'bg-rose-100 text-rose-800'
                                  : ep.processing_status === 'processing'
                                  ? 'bg-blue-100 text-blue-800 animate-pulse'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ep.processing_status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleProcessEpisode(ep.id)}
                              disabled={processingId === ep.id}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {processingId === ep.id ? 'Analyzing...' : 'Discover Promos'}
                            </button>
                          </td>
                        </tr>
                      ))}
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
