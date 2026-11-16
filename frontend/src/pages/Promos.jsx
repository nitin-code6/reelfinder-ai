import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Filter, Check, X, ArrowUpRight, Clock, AlertTriangle, 
  CheckCircle2, ShieldCheck, ArrowUpDown, ChevronDown, Eye, AlertCircle
} from 'lucide-react';
import { getPromos, getShows, approvePromo, rejectPromo } from '../api';
import { Link, useNavigate } from 'react-router-dom';

export default function Promos() {
  const navigate = useNavigate();
  const [promos, setPromos] = useState([]);
  const [shows, setShows] = useState([]);
  
  // Filters
  const [selectedShow, setSelectedShow] = useState('');
  const [episodeFilter, setEpisodeFilter] = useState('');
  const [validationFilter, setValidationFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [minScoreFilter, setMinScoreFilter] = useState(0);

  // Sorting
  const [sortBy, setSortBy] = useState('score_desc'); // score_desc | score_asc | episode_asc | latest

  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState(null);

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

  async function handleQuickApprove(promo, e) {
    e.stopPropagation();
    if (promo.validation_status === 'invalid') {
      alert(`Cannot approve invalid candidate: ${promo.validation_notes || 'Technical validation failed (duration or timestamp mismatch)'}.`);
      return;
    }
    try {
      await approvePromo(promo.id);
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, approval_status: 'approved' } : p));
      showToast(`${promo.promo_identifier} approved.`);
    } catch (err) {
      alert('Error approving promo: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function handleQuickReject(promo, e) {
    e.stopPropagation();
    try {
      await rejectPromo(promo.id);
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, approval_status: 'rejected' } : p));
      showToast(`${promo.promo_identifier} rejected.`);
    } catch (err) {
      alert('Error rejecting promo: ' + (err.response?.data?.detail || err.message));
    }
  }

  function showToast(msg) {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  }

  // Filter & Sort Logic
  const filteredAndSortedPromos = useMemo(() => {
    let result = [...promos];

    // Filter by Episode Number
    if (episodeFilter) {
      const epNum = parseInt(episodeFilter, 10);
      if (!isNaN(epNum)) {
        result = result.filter(p => p.primary_episode_number === epNum);
      }
    }

    // Filter by Validation Status
    if (validationFilter !== 'all') {
      result = result.filter(p => p.validation_status === validationFilter);
    }

    // Filter by Approval Status
    if (approvalFilter !== 'all') {
      result = result.filter(p => p.approval_status === approvalFilter);
    }

    // Filter by Minimum Score
    if (minScoreFilter > 0) {
      result = result.filter(p => p.overall_score >= minScoreFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'score_desc') return b.overall_score - a.overall_score;
      if (sortBy === 'score_asc') return a.overall_score - b.overall_score;
      if (sortBy === 'episode_asc') return a.primary_episode_number - b.primary_episode_number;
      if (sortBy === 'latest') return b.id - a.id;
      return 0;
    });

    return result;
  }, [promos, episodeFilter, validationFilter, approvalFilter, minScoreFilter, sortBy]);

  // Unique episode numbers for filter dropdown
  const availableEpisodeNumbers = useMemo(() => {
    const set = new Set(promos.map(p => p.primary_episode_number));
    return Array.from(set).sort((a, b) => a - b);
  }, [promos]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Promo Discovery</h1>
          <p className="text-xs text-slate-500">
            AI-discovered promotional moments ranked by conversion potential (Hook 25%, Cliffhanger 25%, Standalone 20%, Impact 15%, Continuity 15%).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/export"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Export Campaigns
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Series Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Series
            </label>
            <select
              value={selectedShow}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="">All Series</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Episode Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Episode
            </label>
            <select
              value={episodeFilter}
              onChange={(e) => setEpisodeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="">All Episodes</option>
              {availableEpisodeNumbers.map((ep) => (
                <option key={ep} value={ep}>
                  Episode {ep}
                </option>
              ))}
            </select>
          </div>

          {/* Validation Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Validation
            </label>
            <select
              value={validationFilter}
              onChange={(e) => setValidationFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="all">All Validations</option>
              <option value="valid">Valid Only</option>
              <option value="warning">Warnings</option>
              <option value="invalid">Invalid Records</option>
            </select>
          </div>

          {/* Editorial Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Editorial Status
            </label>
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="all">All Editorial</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Minimum Score Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Min Composite Score
            </label>
            <select
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(parseFloat(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value={0}>Any Score</option>
              <option value={80}>Score ≥ 80</option>
              <option value={70}>Score ≥ 70</option>
              <option value={60}>Score ≥ 60</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="score_desc">Highest Score First</option>
              <option value="score_asc">Lowest Score First</option>
              <option value="episode_asc">Episode Order</option>
              <option value="latest">Latest Discovered</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <span>
            Showing <strong>{filteredAndSortedPromos.length}</strong> of <strong>{promos.length}</strong> discovered promo candidates
          </span>
          {(episodeFilter || validationFilter !== 'all' || approvalFilter !== 'all' || minScoreFilter > 0) && (
            <button
              onClick={() => {
                setEpisodeFilter('');
                setValidationFilter('all');
                setApprovalFilter('all');
                setMinScoreFilter(0);
              }}
              className="text-purple-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Promos Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-2">
          <Sparkles className="w-8 h-8 text-purple-600 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading discovered promotional candidates...</span>
        </div>
      ) : filteredAndSortedPromos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400 space-y-2">
          <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-bold text-slate-700">No promo candidates match the selected filters.</p>
          <p className="text-[11px] text-slate-400">
            Try adjusting your validation, episode, or score filters, or process more episodes on the Shows page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedPromos.map((promo, idx) => {
            const firstSeg = promo.segments && promo.segments.length > 0 ? promo.segments[0] : null;
            const segDuration = firstSeg ? firstSeg.duration_seconds.toFixed(1) : '25.0';
            const segStart = firstSeg ? firstSeg.start_timestamp : '00:00.00';
            const segEnd = firstSeg ? firstSeg.end_timestamp : '00:25.00';
            const isInvalid = promo.validation_status === 'invalid';

            return (
              <div
                key={promo.id}
                onClick={() => navigate(`/review?id=${promo.id}`)}
                className={`bg-white rounded-xl border p-5 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                  isInvalid ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                {/* Card Top: Rank, ID, Tags & Overall Score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center border border-purple-200">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{promo.promo_identifier}</span>
                        <span className="text-[11px] text-slate-400">&bull; Episode {promo.primary_episode_number}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        [{segStart} - {segEnd}] &bull; {segDuration}s ({promo.segments?.length || 1} seg)
                      </div>
                    </div>
                  </div>

                  {/* Score Pill */}
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                      isInvalid
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : promo.overall_score >= 80
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-purple-100 text-purple-800 border border-purple-200'
                    }`}>
                      {promo.overall_score.toFixed(1)}/100
                    </span>
                  </div>
                </div>

                {/* Validation & Editorial Status Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {/* Validation Badge */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                    promo.validation_status === 'valid'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : promo.validation_status === 'warning'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {promo.validation_status === 'valid' && <ShieldCheck className="w-3 h-3 text-emerald-600" />}
                    {promo.validation_status === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                    {promo.validation_status === 'invalid' && <AlertCircle className="w-3 h-3 text-rose-600" />}
                    {promo.validation_status.toUpperCase()}
                  </span>

                  {/* Approval Badge */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                    promo.approval_status === 'approved'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : promo.approval_status === 'rejected'
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {promo.approval_status.toUpperCase()}
                  </span>

                  {isInvalid && promo.validation_notes && (
                    <span className="text-rose-600 font-medium truncate max-w-[200px]" title={promo.validation_notes}>
                      Reason: {promo.validation_notes}
                    </span>
                  )}
                </div>

                {/* Hook & Cliffhanger Summaries */}
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 text-[11px] block">Hook (First 3s):</span>
                    <p className="text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded border border-slate-100 text-[11px]">
                      "{promo.hook}"
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 text-[11px] block">Cliffhanger (End Beat):</span>
                    <p className="text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded border border-slate-100 text-[11px]">
                      "{promo.cliffhanger}"
                    </p>
                  </div>
                </div>

                {/* Five Factor Mini Breakdown */}
                {firstSeg && (
                  <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-100 text-center text-[10px]">
                    <div className="p-1 rounded bg-slate-50">
                      <span className="text-slate-400 block">Hook</span>
                      <strong className="text-slate-800">{firstSeg.hook_score ? (firstSeg.hook_score * 10).toFixed(0) : '-'}</strong>
                    </div>
                    <div className="p-1 rounded bg-slate-50">
                      <span className="text-slate-400 block">Cliff</span>
                      <strong className="text-slate-800">{firstSeg.cliffhanger_score ? (firstSeg.cliffhanger_score * 10).toFixed(0) : '-'}</strong>
                    </div>
                    <div className="p-1 rounded bg-slate-50">
                      <span className="text-slate-400 block">Context</span>
                      <strong className="text-slate-800">{firstSeg.standalone_score ? (firstSeg.standalone_score * 10).toFixed(0) : '-'}</strong>
                    </div>
                    <div className="p-1 rounded bg-slate-50">
                      <span className="text-slate-400 block">Impact</span>
                      <strong className="text-slate-800">{firstSeg.emotional_impact_score ? (firstSeg.emotional_impact_score * 10).toFixed(0) : '-'}</strong>
                    </div>
                    <div className="p-1 rounded bg-slate-50">
                      <span className="text-slate-400 block">Contin</span>
                      <strong className="text-slate-800">{firstSeg.continuity_score ? (firstSeg.continuity_score * 10).toFixed(0) : '-'}</strong>
                    </div>
                  </div>
                )}

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-purple-600 font-semibold hover:underline flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    Inspect Details & Evidence
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleQuickReject(promo, e)}
                      title="Reject candidate"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleQuickApprove(promo, e)}
                      disabled={isInvalid}
                      title={isInvalid ? "Cannot approve: Technical validation failed" : "Approve candidate"}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isInvalid
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
