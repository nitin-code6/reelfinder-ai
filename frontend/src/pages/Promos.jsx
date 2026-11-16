import React, { useState, useEffect } from 'react';
import { Sparkles, Filter, Check, X, ArrowUpRight, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getPromos, getShows, approvePromo, rejectPromo } from '../api';
import { Link } from 'react-router-dom';

export default function Promos() {
  const [promos, setPromos] = useState([]);
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShows().then((res) => setShows(res.data));
    fetchPromos();
  }, [selectedShow, statusFilter]);

  async function fetchPromos() {
    setLoading(true);
    try {
      const params = {};
      if (selectedShow) params.show_id = selectedShow;
      if (statusFilter !== 'all') params.approval_status = statusFilter;
      const res = await getPromos(params);
      setPromos(res.data);
    } catch (err) {
      console.error('Failed to load promos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id, e) {
    e.stopPropagation();
    try {
      await approvePromo(id);
      fetchPromos();
    } catch (err) {
      alert('Error approving promo: ' + err.message);
    }
  }

  async function handleReject(id, e) {
    e.stopPropagation();
    try {
      await rejectPromo(id);
      fetchPromos();
    } catch (err) {
      alert('Error rejecting promo: ' + err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ranked Promo Discovery</h1>
          <p className="text-xs text-slate-500">
            Automated recommendations sorted by overall conversion score (Hook, Cliffhanger, Context, Impact, Continuity).
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedShow}
            onChange={(e) => setSelectedShow(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Series</option>
            {shows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : promos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center text-slate-400">
          <Sparkles className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No promos found matching filters.</p>
          <p className="text-xs text-slate-400 mt-1">Upload screenplays and trigger discovery to generate ranked clips.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {promos.map((promo, rank) => (
            <div
              key={promo.id}
              className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm hover:border-indigo-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
                    #{rank + 1}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {promo.promo_identifier}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Episode {promo.primary_episode_number}
                  </span>
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {promo.total_duration_seconds}s
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                      promo.approval_status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : promo.approval_status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {promo.approval_status}
                  </span>
                  {promo.validation_status === 'warning' && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Timestamp Snapped
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Hook: {promo.hook}</h3>
                  <p className="text-xs text-slate-600">
                    <strong className="text-slate-800">Cliffhanger:</strong> {promo.cliffhanger}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                  <div>
                    <span className="font-semibold text-slate-700">Timecodes: </span>
                    {promo.segments?.map((s) => `${s.start_timestamp} - ${s.end_timestamp}`).join('; ') || 'N/A'}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Standalone Context: </span>
                    {promo.standalone_context}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                    Hook: {promo.hook_score}/10
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                    Cliffhanger: {promo.cliffhanger_score}/10
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                    Context: {promo.standalone_score}/10
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                    Impact: {promo.emotional_impact_score}/10
                  </span>
                </div>
              </div>

              {/* Score & Actions */}
              <div className="flex lg:flex-col items-center justify-between lg:justify-center lg:items-end gap-4 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                <div className="text-left lg:text-right">
                  <div className="text-3xl font-extrabold text-indigo-600">{promo.overall_score}</div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Overall Score</div>
                </div>

                <div className="flex items-center gap-2">
                  {promo.approval_status !== 'approved' && (
                    <button
                      onClick={(e) => handleApprove(promo.id, e)}
                      title="Approve Recommendation"
                      className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-200"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {promo.approval_status !== 'rejected' && (
                    <button
                      onClick={(e) => handleReject(promo.id, e)}
                      title="Reject Recommendation"
                      className="p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors border border-rose-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <Link
                    to={`/review?id=${promo.id}`}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Details <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
