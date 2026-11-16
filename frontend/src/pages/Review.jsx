import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, MessageSquare, Clock, ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getPromo, getPromos, approvePromo, rejectPromo, submitFeedback } from '../api';

export default function Review() {
  const [searchParams] = useSearchParams();
  const promoId = searchParams.get('id');

  const [promos, setPromos] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const res = await getPromos();
        setPromos(res.data);
        if (promoId) {
          const promoRes = await getPromo(promoId);
          setSelectedPromo(promoRes.data);
        } else if (res.data.length > 0) {
          setSelectedPromo(res.data[0]);
        }
      } catch (err) {
        console.error('Failed to load review data:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [promoId]);

  async function handleDecision(decision) {
    if (!selectedPromo) return;
    setSubmitting(true);
    try {
      if (comments.trim()) {
        await submitFeedback(selectedPromo.id, {
          decision,
          comments,
        });
      } else if (decision === 'approved') {
        await approvePromo(selectedPromo.id);
      } else {
        await rejectPromo(selectedPromo.id);
      }

      // Refresh promo
      const updated = await getPromo(selectedPromo.id);
      setSelectedPromo(updated.data);
      setComments('');
      alert(`Recommendation marked as ${decision.toUpperCase()}`);
    } catch (err) {
      alert('Error updating decision: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!selectedPromo) {
    return (
      <div className="bg-white rounded-xl p-12 text-center text-slate-500">
        <p className="text-sm font-semibold">No promo selected for review.</p>
        <Link to="/promos" className="text-xs text-indigo-600 font-bold underline mt-2 block">
          Browse Promo Discovery Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/promos" className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Editorial Review: {selectedPromo.promo_identifier}
            </h1>
            <p className="text-xs text-slate-500">
              Verify screenplay timestamps, inspect narrative tension, and approve for marketing export.
            </p>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            selectedPromo.approval_status === 'approved'
              ? 'bg-emerald-100 text-emerald-800'
              : selectedPromo.approval_status === 'rejected'
              ? 'bg-rose-100 text-rose-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          Status: {selectedPromo.approval_status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Screenplay Excerpt & Timecode Verification */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Verified Screenplay Excerpt
            </h2>

            {selectedPromo.segments?.map((seg, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between text-xs font-semibold text-slate-700 pb-2 border-b border-slate-200">
                  <span>Episode {seg.episode_number} &bull; Scene: {seg.scene_heading || 'SCENE'}</span>
                  <span className="flex items-center gap-1 font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    <Clock className="w-3.5 h-3.5" />
                    {seg.start_timestamp} &rarr; {seg.end_timestamp} ({seg.duration_seconds}s)
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-0.5">
                      Starting Hook Line:
                    </span>
                    <p className="p-2.5 bg-white rounded border border-slate-200 text-slate-900 font-serif italic">
                      "{seg.first_line || 'No dialogue line'}"
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-0.5">
                      Cliffhanger Cutoff Line:
                    </span>
                    <p className="p-2.5 bg-white rounded border border-slate-200 text-slate-900 font-serif italic">
                      "{seg.last_line || 'No dialogue line'}"
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {selectedPromo.limitations?.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Validation Notes:
                </div>
                {selectedPromo.limitations.map((lim, idx) => (
                  <div key={idx} className="pl-5">&bull; {lim}</div>
                ))}
              </div>
            )}
          </div>

          {/* Narrative Analysis Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Conversion Mechanics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-700 block mb-1">3-Second Hook Rationale:</span>
                <p className="text-slate-600 leading-relaxed">{selectedPromo.hook}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-700 block mb-1">Unresolved Cliffhanger:</span>
                <p className="text-slate-600 leading-relaxed">{selectedPromo.cliffhanger}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-700 block mb-1">Standalone Comprehension:</span>
                <p className="text-slate-600 leading-relaxed">{selectedPromo.standalone_context}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-700 block mb-1">Why This Promo Works:</span>
                <p className="text-slate-600 leading-relaxed">{selectedPromo.reason}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Scoring Breakdown & Decision Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="text-center pb-4 border-b border-slate-100">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Overall Composite Score</span>
              <div className="text-5xl font-black text-indigo-600 mt-1">{selectedPromo.overall_score}</div>
              <span className="text-[11px] text-slate-500">out of 100 points</span>
            </div>

            <div className="space-y-3 text-xs">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">5-Factor Breakdown</h3>
              {[
                { label: 'Hook Strength (25%)', val: selectedPromo.hook_score },
                { label: 'Cliffhanger Suspense (25%)', val: selectedPromo.cliffhanger_score },
                { label: 'Standalone Context (20%)', val: selectedPromo.standalone_score },
                { label: 'Emotional Impact (15%)', val: selectedPromo.emotional_impact_score },
                { label: 'Narrative Continuity (15%)', val: selectedPromo.continuity_score },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-bold text-slate-900">{item.val}/10</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all"
                      style={{ width: `${(item.val / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editorial Approval Actions */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Editor Decision</h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Feedback Comments (Optional)</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Notes on ad pacing, actor performance, or targeting..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleDecision('approved')}
                disabled={submitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => handleDecision('rejected')}
                disabled={submitting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
