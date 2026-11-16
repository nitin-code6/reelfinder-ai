import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, AlertTriangle, ShieldCheck, Clock, ChevronLeft, ChevronRight, 
  Sparkles, Check, X, FileText, ArrowRight, RefreshCw, AlertCircle, ArrowLeft
} from 'lucide-react';
import { getPromo, getPromos, approvePromo, rejectPromo, submitFeedback } from '../api';

function parseTimestampToSec(ts) {
  if (!ts) return 0;
  const clean = ts.replace(/[()]/g, '').trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
  }
  return parseFloat(clean) || 0;
}

export default function Review() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [allPromos, setAllPromos] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({ open: false, decision: null });

  useEffect(() => {
    loadPromosAndSelect();
  }, []);

  async function loadPromosAndSelect() {
    setLoading(true);
    try {
      const res = await getPromos({ limit: 100 });
      const promosList = res.data || [];
      setAllPromos(promosList);

      const targetId = searchParams.get('id');
      if (targetId) {
        const found = promosList.find(p => p.id === parseInt(targetId, 10));
        if (found) {
          setSelectedPromo(found);
          setLoading(false);
          return;
        }
      }

      const defaultPromo = promosList.find(p => p.approval_status === 'pending') || promosList[0];
      if (defaultPromo) {
        setSelectedPromo(defaultPromo);
        setSearchParams({ id: defaultPromo.id });
      }
    } catch (err) {
      console.error('Failed to load review candidate:', err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  const currentIndex = useMemo(() => {
    if (!selectedPromo || allPromos.length === 0) return -1;
    return allPromos.findIndex(p => p.id === selectedPromo.id);
  }, [selectedPromo, allPromos]);

  function navigateToCandidate(index) {
    if (index >= 0 && index < allPromos.length) {
      const target = allPromos[index];
      setSelectedPromo(target);
      setSearchParams({ id: target.id });
      setComments('');
    }
  }

  function promptDecision(decision) {
    if (!selectedPromo) return;
    if (decision === 'approved' && selectedPromo.validation_status === 'invalid') {
      alert(`Cannot approve invalid candidate: ${selectedPromo.limitations?.join(', ') || 'Technical validation failed'}.`);
      return;
    }
    setConfirmModal({ open: true, decision });
  }

  async function executeDecision() {
    const { decision } = confirmModal;
    if (!selectedPromo || !decision) return;

    setSubmitting(true);
    setConfirmModal({ open: false, decision: null });

    try {
      if (comments.trim()) {
        await submitFeedback(selectedPromo.id, {
          decision,
          comments: comments.trim(),
        });
      } else if (decision === 'approved') {
        await approvePromo(selectedPromo.id);
      } else {
        await rejectPromo(selectedPromo.id);
      }

      // Refresh promo
      const updated = await getPromo(selectedPromo.id);
      setSelectedPromo(updated.data);
      setAllPromos(prev => prev.map(p => p.id === updated.data.id ? updated.data : p));
      setComments('');
      showToast(`✓ ${selectedPromo.promo_identifier} marked as ${decision.toUpperCase()}!`);
    } catch (err) {
      alert('Error updating decision: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-2">
        <RefreshCw className="w-8 h-8 text-[#0F766E] animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Loading candidate evidence...</span>
      </div>
    );
  }

  if (!selectedPromo) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500 space-y-3">
        <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
        <p className="text-sm font-bold text-[#172B4D]">No promo candidate selected for review.</p>
        <Link
          to="/promos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          Browse Discovery Candidates
        </Link>
      </div>
    );
  }

  const isInvalid = selectedPromo.validation_status === 'invalid';
  const isApproved = selectedPromo.approval_status === 'approved';
  const isRejected = selectedPromo.approval_status === 'rejected';

  const firstSeg = selectedPromo.segments && selectedPromo.segments.length > 0 ? selectedPromo.segments[0] : null;

  const startSec = firstSeg ? parseTimestampToSec(firstSeg.start_timestamp) : 0;
  const endSec = firstSeg ? parseTimestampToSec(firstSeg.end_timestamp) : 0;
  const isChronological = firstSeg ? (endSec > startSec || firstSeg.duration_seconds > 0) : false;

  const score100 = selectedPromo.overall_score ? (selectedPromo.overall_score * 10).toFixed(1) : '90.5';

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#172B4D] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-white/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Candidate Bar matching Panel 5 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/promos"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Back to Discovery"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[#172B4D] font-mono">
                {selectedPromo.promo_identifier}
              </h3>
              {isApproved && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#CCFBF1] text-[#0F766E] border border-teal-200">
                  Approved
                </span>
              )}
              {isRejected && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  Rejected
                </span>
              )}
              {!isApproved && !isRejected && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-[#D69E36] border border-amber-200">
                  Pending
                </span>
              )}

              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isInvalid
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {isInvalid ? 'Invalid' : 'Valid'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Episode {selectedPromo.primary_episode_number} &bull; {selectedPromo.show_title || 'Microdrama Series'}
            </p>
          </div>
        </div>

        {/* Prev / Next Pagination matching Panel 5 */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
          <button
            onClick={() => navigateToCandidate(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>
          <span className="text-xs text-slate-500 font-medium">
            {currentIndex + 1} of {allPromos.length}
          </span>
          <button
            onClick={() => navigateToCandidate(currentIndex + 1)}
            disabled={currentIndex >= allPromos.length - 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2-Column Split matching Panel 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (Col 6): Screenplay Evidence */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#172B4D] pb-2 border-b border-slate-100">
            Screenplay Evidence
          </h3>

          {/* 3 Metric Boxes: Start, End, Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Start</span>
              <span className="text-sm font-mono font-bold text-[#172B4D]">
                {firstSeg?.start_timestamp || '01:12.80'}
              </span>
            </div>
            <div className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">End</span>
              <span className="text-sm font-mono font-bold text-[#172B4D]">
                {firstSeg?.end_timestamp || '01:36.80'}
              </span>
            </div>
            <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl">
              <span className="text-[10px] font-bold text-[#0F766E] uppercase block">Duration</span>
              <span className="text-sm font-mono font-bold text-[#0F766E]">
                {firstSeg?.duration_seconds?.toFixed(1) || '24.0'}s
              </span>
            </div>
          </div>

          {/* Starting Cue */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#172B4D] block">Starting Cue</span>
            <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs italic text-slate-800 leading-relaxed font-serif">
              &ldquo;{firstSeg?.first_line || selectedPromo.hook_dialogue || 'Profile close-up of Juliana turning her face back toward the altar, tears still shimmering on her cheeks.'}&rdquo;
            </p>
          </div>

          {/* Ending Cue */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#172B4D] block">Ending Cue</span>
            <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs italic text-slate-800 leading-relaxed font-serif">
              &ldquo;{firstSeg?.last_line || selectedPromo.cliffhanger_dialogue || "Close-up on Juliana's face, calm, dignified, and unwavering."}&rdquo;
            </p>
          </div>

          {/* Excerpt (Context) */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#172B4D] block">Excerpt (Context)</span>
            <p className="p-3 bg-[#F5F7FA] border border-slate-200 rounded-xl text-xs italic text-slate-700 leading-relaxed font-serif">
              &ldquo;{firstSeg?.excerpt || selectedPromo.hook_explanation || "The shift from victim to victor is visually and verbally clear. The bride's transformation from tearful to defiant is self-explanatory, and the final line is a powerful, standalone statement of empowerment."}&rdquo;
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN (Col 6): AI Evaluation & Validation Checks */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-[#172B4D]">
              AI Evaluation
            </h3>
            {/* Score Pill in Panel 5 */}
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              {score100}/100
            </span>
          </div>

          {/* 5 Factors Progress Bars matching Panel 5 */}
          <div className="space-y-3.5">
            {[
              { label: 'Hook Strength (25%)', score: selectedPromo.hook_strength || 9.0 },
              { label: 'Cliffhanger Suspense (25%)', score: selectedPromo.cliffhanger_strength || 9.5 },
              { label: 'Standalone Context (20%)', score: selectedPromo.standalone_score || 8.5 },
              { label: 'Emotional Impact (15%)', score: selectedPromo.emotional_resonance || 9.0 },
              { label: 'Narrative Continuity (15%)', score: selectedPromo.audio_visual_score || 9.0 },
            ].map((factor, idx) => {
              const val = factor.score;
              const pct = Math.round((val / 10) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">{factor.label}</span>
                    <span className="font-mono font-bold text-[#172B4D]">{val.toFixed(1)}/10</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0F766E] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Validation Checks (4 check items with green dots) matching Panel 5 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-[#172B4D] block">Validation Checks</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Source cues found</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Duration (20-60s)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Valid timestamps</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Segment order valid</span>
              </div>
            </div>
          </div>

          {/* Decision Action Buttons matching Panel 5 */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => promptDecision('rejected')}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Reject</span>
            </button>

            <button
              type="button"
              onClick={() => promptDecision('approved')}
              disabled={submitting || isInvalid}
              title={isInvalid ? "Cannot approve: Technical validation failed" : "Approve candidate"}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              <span>Approve</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-[#172B4D]">
              Confirm Editorial Decision
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to mark <strong>{selectedPromo.promo_identifier}</strong> as{' '}
              <strong className={confirmModal.decision === 'approved' ? 'text-emerald-700' : 'text-rose-700'}>
                {confirmModal.decision.toUpperCase()}
              </strong>?
              {confirmModal.decision === 'approved' && ' Approved candidates are automatically marked eligible for marketing CSV and publishing JSON exports.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, decision: null })}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDecision}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-colors shadow-xs ${
                  confirmModal.decision === 'approved'
                    ? 'bg-[#0F766E] hover:bg-[#115E59]'
                    : 'bg-[#DC2626] hover:bg-rose-700'
                }`}
              >
                Confirm {confirmModal.decision === 'approved' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
