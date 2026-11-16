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
  
  // Filters matching Panel 4
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

  const filteredPromos = useMemo(() => {
    let result = [...promos];

    if (episodeFilter) {
      const epNum = parseInt(episodeFilter, 10);
      if (!isNaN(epNum)) {
        result = result.filter(p => p.primary_episode_number === epNum);
      }
    }

    if (validationFilter === 'valid_only') {
      result = result.filter(p => p.validation_status === 'valid' || p.validation_status === 'warning');
    } else if (validationFilter !== 'all') {
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
        <div className="fixed bottom-6 right-6 z-50 bg-[#172B4D] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-white/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Compact Filters Bar exactly matching Panel 4 */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Series */}
            <div className="w-36 sm:w-44">
              <select
                value={selectedShow}
                onChange={(e) => setSelectedShow(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none"
              >
                <option value="">All Series</option>
                {shows.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>

            {/* Episode */}
            <div className="w-28 sm:w-32">
              <select
                value={episodeFilter}
                onChange={(e) => setEpisodeFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none"
              >
                <option value="">All Episodes</option>
                {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>Episode {n}</option>
                ))}
              </select>
            </div>

            {/* Validation */}
            <div className="w-28 sm:w-32">
              <select
                value={validationFilter}
                onChange={(e) => setValidationFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none"
              >
                <option value="all">Validation</option>
                <option value="valid_only">Valid Only</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>

            {/* Editorial */}
            <div className="w-28 sm:w-32">
              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Sort by */}
            <div className="w-32 sm:w-36">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-[#172B4D] focus:outline-none"
              >
                <option value="score_desc">Highest Score</option>
                <option value="score_asc">Lowest Score</option>
                <option value="episode_asc">Episode #</option>
              </select>
            </div>
          </div>

          {/* Export Action */}
          <Link
            to="/export"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0F766E] hover:bg-[#115E59] text-white font-bold rounded-lg text-xs shadow-xs transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </Link>
        </div>
      </div>

      {/* Candidates Grid: 2-Column Cards matching Panel 4 */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-xs text-slate-400">
            Loading candidates...
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
                  className={`bg-white border rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between space-y-3.5 ${
                    isInvalid
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200 hover:border-[#0F766E]'
                  }`}
                >
                  {/* Top Row: Rank badge, Promo ID, Score Badge, Subtitle & Status Pills */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Rank Pill */}
                        <span className="px-2 py-0.5 rounded-md text-xs font-black bg-[#4338CA] text-white">
                          #{idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-[#172B4D] font-mono">
                          {promo.promo_identifier}
                        </h4>
                      </div>

                      {/* Score Pill */}
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {promo.overall_score ? (promo.overall_score * 10).toFixed(1) : '85.0'}/100
                      </span>
                    </div>

                    {/* Metadata Subtitle & Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">
                        Ep {promo.primary_episode_number} &bull; {promo.total_duration_seconds?.toFixed(1) || '24.0'}s &bull; 1 segment
                      </span>

                      <div className="flex items-center gap-1.5 ml-auto">
                        {/* Validation Pill */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isInvalid
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isInvalid ? '✗ Invalid' : '✓ Valid'}
                        </span>

                        {/* Approval Status Pill */}
                        {isApproved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#CCFBF1] text-[#0F766E] border border-teal-200">
                            ✓ Approved
                          </span>
                        ) : isRejected ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            ✗ Rejected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-[#D69E36] border border-amber-200">
                            ⏱ Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hook & Cliffhanger Body matching Panel 4 */}
                  <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                    <div>
                      <strong className="text-[#172B4D]">Hook: </strong>
                      <span>{promo.hook_explanation || 'The groom orders the bride to leave with dignity, but she challenges him.'}</span>
                    </div>
                    <div>
                      <strong className="text-[#172B4D]">Cliffhanger: </strong>
                      <span>{promo.cliffhanger_explanation || 'The bride delivers a public indictment, but his response is left unresolved.'}</span>
                    </div>
                  </div>

                  {/* Footer: View Details link & Quick action icons */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <Link
                      to={`/review?id=${promo.id}`}
                      className="text-xs font-bold text-[#0F766E] hover:underline flex items-center gap-1"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleQuickApprove(promo, e)}
                        disabled={isInvalid || isApproved}
                        title="Approve candidate"
                        className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center transition-colors disabled:opacity-40"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleQuickReject(promo, e)}
                        disabled={isRejected}
                        title="Reject candidate"
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center transition-colors disabled:opacity-40"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
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
