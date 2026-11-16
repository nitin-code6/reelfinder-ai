import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Filter, Check, X, ArrowUpRight, Clock, AlertTriangle, 
  CheckCircle2, ShieldCheck, Download, ArrowUpDown, ChevronRight, Eye, AlertCircle
} from 'lucide-react';
import { getPromos, getShows, approvePromo, rejectPromo } from '../api';
import { Link, useNavigate } from 'react-router-dom';

export default function Promos() {
  const navigate = useNavigate();
  const [promos, setPromos] = useState([]);
  const [shows, setShows] = useState([]);
  
  // Compact Filters
  const [selectedShow, setSelectedShow] = useState('');
  const [episodeFilter, setEpisodeFilter] = useState('');
  const [validationFilter, setValidationFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score_desc');

  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    loadShows();
    fetchPromos();
  }, [selectedShow]);

  async function loadShows() {
    try {
      const res = await getShows();
      setShows(res.data || []);
    } catch (err) {
      console.error('Failed to load shows:', err);
    }
  }

  async function fetchPromos() {
    setLoading(true);
    try {
      const params = {};
      if (selectedShow) params.show_id = selectedShow;
      const res = await getPromos(params);
      setPromos(res.data || []);
    } catch (err) {
      console.error('Failed to load promos:', err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  async function handleQuickApprove(promo, e) {
    e.stopPropagation();
    if (promo.validation_status === 'invalid') {
      alert(`Cannot approve invalid candidate: ${promo.limitations?.join(', ') || 'Technical validation failed'}.`);
      return;
    }
    try {
      await approvePromo(promo.id);
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, approval_status: 'approved' } : p));
      showToast(`✓ ${promo.promo_identifier} approved for export!`);
    } catch (err) {
      alert('Error approving promo: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function handleQuickReject(promo, e) {
    e.stopPropagation();
    try {
      await rejectPromo(promo.id);
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, approval_status: 'rejected' } : p));
      showToast(`✗ ${promo.promo_identifier} marked as rejected.`);
    } catch (err) {
      alert('Error rejecting promo: ' + (err.response?.data?.detail || err.message));
    }
  }

  // Filter & Sort
  const filteredPromos = useMemo(() => {
    let result = [...promos];

    if (episodeFilter) {
      const epNum = parseInt(episodeFilter, 10);
      if (!isNaN(epNum)) {
        result = result.filter(p => p.primary_episode_number === epNum);
      }
    }

    if (validationFilter !== 'all') {
      result = result.filter(p => p.validation_status === validationFilter);
    }

    if (approvalFilter !== 'all') {
      result = result.filter(p => p.approval_status === approvalFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'score_desc') return (b.overall_score || 0) - (a.overall_score || 0);
      if (sortBy === 'score_asc') return (a.overall_score || 0) - (b.overall_score || 0);
      if (sortBy === 'episode_asc') return (a.primary_episode_number || 0) - (b.primary_episode_number || 0);
      return (b.id || 0) - (a.id || 0);
    });

    return result;
  }, [promos, episodeFilter, validationFilter, approvalFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#172B4D] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-white/20 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#172B4D] tracking-tight">Promo Discovery</h2>
          <p className="text-xs text-[#64748B]">
            Discover, evaluate, and rank high-converting promotional moments.
          </p>
        </div>
        <Link
          to="/export"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-[#0F766E] font-bold rounded-xl text-xs shadow-xs transition-all"
        >
          <Download className="w-4 h-4 text-[#0F766E]" />
          <span>Export Results</span>
        </Link>
      </div>

      {/* Compact Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Series Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Series</label>
            <select
              value={selectedShow}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="">All Series</option>
              {shows.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* Episode Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Episode #</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 1"
              value={episodeFilter}
              onChange={(e) => setEpisodeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>

          {/* Validation Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Technical Status</label>
            <select
              value={validationFilter}
              onChange={(e) => setValidationFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="all">All Validation</option>
              <option value="valid">Valid (20-60s)</option>
              <option value="invalid">Invalid</option>
            </select>
          </div>

          {/* Editorial Approval Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Editorial Status</label>
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Sort Order</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="score_desc">Highest Score First</option>
              <option value="score_asc">Lowest Score First</option>
              <option value="episode_asc">Episode Number</option>
            </select>
          </div>
        </div>
      </div>

      {/* Discovery Candidates Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#64748B] px-1">
          <span>Found {filteredPromos.length} Candidate(s)</span>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-xs text-slate-400">
            Loading promo candidates...
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-16 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-[#172B4D]">No promo candidates match your criteria.</p>
            <p className="text-xs text-slate-500">Try adjusting filters or process episodes in the Library.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPromos.map((promo, idx) => {
              const isInvalid = promo.validation_status === 'invalid';
              const isApproved = promo.approval_status === 'approved';
              const isRejected = promo.approval_status === 'rejected';

              return (
                <div
                  key={promo.id}
                  className={`bg-white border rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                    isInvalid
                      ? 'border-rose-200 bg-rose-50/20'
                      : isApproved
                      ? 'border-emerald-200'
                      : 'border-slate-200 hover:border-[#0F766E]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Rank, Promo Identifier, Score & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#F5F7FA] text-slate-700 text-xs font-bold flex items-center justify-center border border-slate-200">
                          #{idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-[#172B4D] font-mono">
                            {promo.promo_identifier}
                          </h4>
                          <span className="text-[10px] text-slate-500">
                            Episode {promo.primary_episode_number} &bull; {promo.total_duration_seconds?.toFixed(1) || '0.0'}s
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Overall Score */}
                        <span className="px-2 py-0.5 rounded-md text-xs font-black bg-[#CCFBF1] text-[#0F766E] border border-teal-200">
                          {promo.overall_score?.toFixed(1) || '0.0'}
                        </span>

                        {/* Validation Status Badge */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          isInvalid
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {isInvalid ? 'Invalid' : 'Valid'}
                        </span>
                      </div>
                    </div>

                    {/* Hook & Cliffhanger Summaries */}
                    <div className="space-y-1.5 bg-[#F5F7FA] p-3 rounded-lg border border-slate-100 text-xs">
                      <div>
                        <span className="font-bold text-[#0F766E] text-[11px] block">Hook (0-3s):</span>
                        <p className="text-slate-700 line-clamp-2 text-[11px] mt-0.5">
                          {promo.hook_explanation || 'Strong dialogue hook opening beat.'}
                        </p>
                      </div>
                      <div>
                        <span className="font-bold text-[#0F766E] text-[11px] block">Cliffhanger:</span>
                        <p className="text-slate-700 line-clamp-2 text-[11px] mt-0.5">
                          {promo.cliffhanger_explanation || 'Suspenseful unresolved emotional turning point.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100">
                    <div>
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved</span>
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <X className="w-3.5 h-3.5" />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-[#D69E36] border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Review</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isApproved && !isRejected && (
                        <button
                          type="button"
                          onClick={(e) => handleQuickApprove(promo, e)}
                          disabled={isInvalid}
                          title={isInvalid ? "Cannot approve: Technical validation failed" : "Quick approve"}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0F766E] hover:bg-[#115E59] text-white disabled:opacity-40 transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      <Link
                        to={`/review?id=${promo.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-[#172B4D] transition-colors"
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
