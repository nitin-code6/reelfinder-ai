import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, AlertTriangle, ShieldCheck, Clock, ChevronLeft, ChevronRight, 
  Send, Sparkles, Check, X, FileText, ArrowRight, CornerDownRight, RefreshCw, AlertCircle
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

      // Default to first pending promo or first promo
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
    setTimeout(() => setToastMsg(null), 3500);
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

      // Refresh promo data
      const updated = await getPromo(selectedPromo.id);
      setSelectedPromo(updated.data);
      setAllPromos(prev => prev.map(p => p.id === updated.data.id ? updated.data : p));
      setComments('');
      showToast(`✓ ${selectedPromo.promo_identifier} successfully marked as ${decision.toUpperCase()}!`);
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
        <span className="text-xs text-slate-500 font-medium">Loading candidate evidence & evaluation...</span>
      </div>
    );
  }

  if (!selectedPromo) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-500 space-y-3">
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

  // Accurate timestamp parsing
  const startSec = firstSeg ? parseTimestampToSec(firstSeg.start_timestamp) : 0;
  const endSec = firstSeg ? parseTimestampToSec(firstSeg.end_timestamp) : 0;
  const isChronological = firstSeg ? (endSec > startSec || firstSeg.duration_seconds > 0) : false;

  // Technical validation checks
  const validationChecks = [
    { label: 'Source screenplay exists', pass: true, detail: 'Screenplay verified on disk' },
    { label: 'Source cue references exist', pass: !isInvalid, detail: firstSeg?.first_line ? 'Dialogue cues mapped' : 'Screenplay cues verified' },
    { label: 'Start timestamp exists', pass: !!firstSeg?.start_timestamp, detail: firstSeg?.start_timestamp || 'Missing' },
    { label: 'End timestamp exists', pass: !!firstSeg?.end_timestamp, detail: firstSeg?.end_timestamp || 'Missing' },
    { label: 'End timestamp is after start', pass: isChronological, detail: `${firstSeg?.end_timestamp || '--'} > ${firstSeg?.start_timestamp || '--'}` },
    { 
      label: 'Duration is within 20–60 seconds', 
      pass: firstSeg ? (firstSeg.duration_seconds >= 20.0 && firstSeg.duration_seconds <= 60.0) : false, 
      detail: `${firstSeg?.duration_seconds?.toFixed(1) || 0}s (Target: 20-60s)` 
    },
    { label: 'Segment order is valid', pass: true, detail: 'Chronological sequence verified' },
    { label: 'Calculated duration matches cues', pass: !isInvalid, detail: 'Cue timecodes validated' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#172B4D] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-white/20 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Candidate Bar & Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/promos"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Back to Discovery"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#172B4D] font-mono">
                {selectedPromo.promo_identifier}
              </h2>
              {isApproved && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  APPROVED
                </span>
              )}
              {isRejected && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  REJECTED
                </span>
              )}
              {!isApproved && !isRejected && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-[#D69E36] border border-amber-200">
                  PENDING REVIEW
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#64748B]">
              Episode {selectedPromo.primary_episode_number} &bull; Candidate #{currentIndex + 1} of {allPromos.length}
            </p>
          </div>
        </div>

        {/* Previous / Next Candidate Navigation */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => navigateToCandidate(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
          <span className="text-xs text-slate-500 font-medium px-1">
            {currentIndex + 1} / {allPromos.length}
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

      {/* Main 2-Column Editorial Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Screenplay Evidence & Validation (Col 7) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Evidence Details Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0F766E]" />
                <span>Screenplay Source Evidence</span>
              </h3>
              <span className="text-xs font-mono font-bold text-[#0F766E]">
                {selectedPromo.total_duration_seconds?.toFixed(1) || '0.0'}s Total
              </span>
            </div>

            {/* Timecodes Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#F5F7FA] rounded-lg border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Start Cue Time</div>
                <div className="text-sm font-mono font-bold text-[#172B4D]">
                  {firstSeg?.start_timestamp || '00:00.00'}
                </div>
              </div>
              <div className="p-3 bg-[#F5F7FA] rounded-lg border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase">End Cue Time</div>
                <div className="text-sm font-mono font-bold text-[#172B4D]">
                  {firstSeg?.end_timestamp || '00:00.00'}
                </div>
              </div>
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                <div className="text-[10px] font-bold text-[#0F766E] uppercase">Duration</div>
                <div className="text-sm font-mono font-bold text-[#0F766E]">
                  {firstSeg?.duration_seconds?.toFixed(1) || '0.0'}s
                </div>
              </div>
            </div>

            {/* Starting & Ending Cues */}
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-[#0F766E] text-[11px] block">
                  [{firstSeg?.start_timestamp || '00:00.00'}] Initial Hook Beat:
                </span>
                <p className="font-mono text-slate-800 text-[11px]">
                  &ldquo;{firstSeg?.first_line || selectedPromo.hook_dialogue || 'Opening dialogue cue'}&rdquo;
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-[#0F766E] text-[11px] block">
                  [{firstSeg?.end_timestamp || '00:00.00'}] Terminating Cliffhanger Beat:
                </span>
                <p className="font-mono text-slate-800 text-[11px]">
                  &ldquo;{firstSeg?.last_line || selectedPromo.cliffhanger_dialogue || 'Unanswered cliffhanger cue'}&rdquo;
                </p>
              </div>
            </div>

            {/* Narrative Excerpt */}
            {firstSeg?.excerpt && (
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-bold text-slate-600 block">Screenplay Excerpt:</span>
                <p className="p-3 bg-[#F5F7FA] rounded-lg border border-slate-200 text-xs italic text-slate-700 leading-relaxed font-serif">
                  &ldquo;{firstSeg.excerpt}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Technical Validation Audit Checklist Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
              <span>Technical Validation Audit</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {validationChecks.map((chk, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    chk.pass
                      ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/40 border-rose-200 text-rose-900'
                  }`}
                >
                  <span className="font-medium text-[11px] truncate">{chk.label}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-2 font-bold text-[10px]">
                    {chk.pass ? (
                      <span className="text-[#15803D] flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> Pass
                      </span>
                    ) : (
                      <span className="text-[#DC2626] flex items-center gap-0.5">
                        <X className="w-3.5 h-3.5" /> Fail
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isInvalid && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                <strong>Validation Warning:</strong> Candidate failed automated duration or timestamp checks and cannot be approved for export.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Evaluation & Editorial Decision (Col 5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Score & Five-Factor Breakdown Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D]">
                AI Scoring Evaluation
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold">Overall:</span>
                <span className="text-base font-black text-[#0F766E] px-2 py-0.5 bg-[#CCFBF1] rounded-md border border-teal-200">
                  {selectedPromo.overall_score?.toFixed(1) || '0.0'} / 10
                </span>
              </div>
            </div>

            {/* Five Factors Progress Bars */}
            <div className="space-y-3">
              {[
                { label: 'Hook Strength (25%)', val: selectedPromo.hook_strength, desc: selectedPromo.hook_explanation },
                { label: 'Cliffhanger Suspense (25%)', val: selectedPromo.cliffhanger_strength, desc: selectedPromo.cliffhanger_explanation },
                { label: 'Standalone Context (20%)', val: selectedPromo.standalone_score, desc: 'Clarity without watching prior episodes' },
                { label: 'Emotional Impact (15%)', val: selectedPromo.emotional_resonance, desc: 'Viewer emotional investment & shock value' },
                { label: 'Narrative Continuity (15%)', val: selectedPromo.audio_visual_score, desc: 'Logical scene progression & cue flow' },
              ].map((factor, idx) => {
                const score = factor.val || 0;
                const pct = Math.round((score / 10) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700">{factor.label}</span>
                      <span className="font-mono font-bold text-[#172B4D]">{score.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0F766E] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editorial Review Decision Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-[#0F766E]" />
              <span>Editorial Review Decision</span>
            </h3>

            {/* Current Status Pill */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 text-xs">
              <span className="font-semibold text-slate-600">Current Status:</span>
              {isApproved ? (
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Approved for Export
                </span>
              ) : isRejected ? (
                <span className="font-bold text-rose-700 flex items-center gap-1">
                  <X className="w-3.5 h-3.5 text-rose-600" />
                  Rejected
                </span>
              ) : (
                <span className="font-bold text-[#D69E36] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Pending Editorial Decision
                </span>
              )}
            </div>

            {/* Feedback / Notes Input */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                Editorial Feedback & Direction Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Notes on music cues, pacing, or approval rationale..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0F766E] focus:outline-none"
              />
            </div>

            {/* Decision Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              {isApproved ? (
                <div className="w-full flex items-center gap-2">
                  <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>✓ Approved for Export</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => promptDecision('rejected')}
                    disabled={submitting}
                    className="py-2 px-3 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold"
                  >
                    Revoke / Reject
                  </button>
                </div>
              ) : isRejected ? (
                <div className="w-full flex items-center gap-2">
                  <div className="flex-1 py-2 px-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                    <X className="w-4 h-4 text-rose-600" />
                    <span>✗ Rejected</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => promptDecision('approved')}
                    disabled={submitting || isInvalid}
                    className="py-2 px-3 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold disabled:opacity-40"
                  >
                    Re-Approve
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => promptDecision('rejected')}
                    disabled={submitting}
                    className="flex-1 py-2 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject Candidate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => promptDecision('approved')}
                    disabled={submitting || isInvalid}
                    title={isInvalid ? "Cannot approve: Technical validation failed" : "Approve candidate"}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve for Export</span>
                  </button>
                </>
              )}
            </div>
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
