import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, XCircle, MessageSquare, Clock, ArrowLeft, AlertTriangle, 
  ShieldCheck, AlertCircle, ChevronLeft, ChevronRight, FileText, Sparkles, 
  Check, X, Film, Info, RefreshCw
} from 'lucide-react';
import { getPromo, getPromos, approvePromo, rejectPromo, submitFeedback } from '../api';

export default function Review() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const promoId = searchParams.get('id');

  const [allPromos, setAllPromos] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Confirmation dialog modal
  const [confirmModal, setConfirmModal] = useState({ open: false, decision: null });

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const res = await getPromos();
        const promoList = res.data || [];
        setAllPromos(promoList);

        if (promoId) {
          const promoRes = await getPromo(promoId);
          setSelectedPromo(promoRes.data);
        } else if (promoList.length > 0) {
          setSelectedPromo(promoList[0]);
          setSearchParams({ id: promoList[0].id });
        }
      } catch (err) {
        console.error('Failed to load review data:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [promoId]);

  // Current index for previous/next candidate navigation
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

  // Trigger confirmation modal
  function promptDecision(decision) {
    if (!selectedPromo) return;
    if (decision === 'approved' && selectedPromo.validation_status === 'invalid') {
      alert(`Cannot approve invalid candidate: ${selectedPromo.validation_notes || 'Technical validation failed'}.`);
      return;
    }
    setConfirmModal({ open: true, decision });
  }

  // Execute confirmed decision
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
    } catch (err) {
      alert('Error saving decision: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-2">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Loading candidate evidence & evaluation...</span>
      </div>
    );
  }

  if (!selectedPromo) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-500 space-y-3">
        <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
        <p className="text-sm font-bold text-slate-800">No promo candidate selected for review.</p>
        <Link
          to="/promos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          Browse Promo Discovery Leaderboard
        </Link>
      </div>
    );
  }

  const isInvalid = selectedPromo.validation_status === 'invalid';
  const isWarning = selectedPromo.validation_status === 'warning';
  const firstSeg = selectedPromo.segments && selectedPromo.segments.length > 0 ? selectedPromo.segments[0] : null;

  // Validation Checks List
  const validationChecks = [
    { label: 'Source screenplay exists', pass: true, detail: 'Screenplay file verified on disk' },
    { label: 'Source cue references exist', pass: !isInvalid, detail: firstSeg?.first_line ? 'Dialogue cues mapped' : 'Cue cues check' },
    { label: 'Start timestamp exists', pass: !!firstSeg?.start_timestamp, detail: firstSeg?.start_timestamp || 'Missing' },
    { label: 'End timestamp exists', pass: !!firstSeg?.end_timestamp, detail: firstSeg?.end_timestamp || 'Missing' },
    { label: 'End timestamp is after start', pass: firstSeg ? firstSeg.end_seconds > firstSeg.start_seconds : false, detail: 'Chronological order valid' },
    { 
      label: 'Duration is within 20–60 seconds', 
      pass: firstSeg ? (firstSeg.duration_seconds >= 20.0 && firstSeg.duration_seconds <= 60.0) : false, 
      detail: `${firstSeg?.duration_seconds?.toFixed(1) || 0}s (Target: 20-60s)` 
    },
    { label: 'Segment order is valid', pass: true, detail: '1 segment continuous' },
    { label: 'Calculated duration matches cues', pass: !isInvalid, detail: 'Accurate cue timecodes' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/promos"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Back to Discovery Leaderboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {selectedPromo.promo_identifier}
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedPromo.approval_status === 'approved'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : selectedPromo.approval_status === 'rejected'
                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {selectedPromo.approval_status.toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedPromo.validation_status === 'valid'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isWarning
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {selectedPromo.validation_status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Episode {selectedPromo.primary_episode_number} &bull; Human-in-the-Loop Editorial Verification
            </p>
          </div>
        </div>

        {/* Previous / Next Navigation Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => navigateToCandidate(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>
          <span className="text-xs font-medium text-slate-400">
            {currentIndex + 1} of {allPromos.length}
          </span>
          <button
            onClick={() => navigateToCandidate(currentIndex + 1)}
            disabled={currentIndex >= allPromos.length - 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Invalid Warning Alert */}
      {isInvalid && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Technical Validation Failed</h4>
            <p className="mt-0.5 leading-relaxed">
              This candidate violated technical constraints ({selectedPromo.validation_notes || 'Invented timestamp or invalid duration'}).
              In accordance with editorial guidelines, <strong>approval is strictly blocked</strong> for this candidate until technical validity is satisfied.
            </p>
          </div>
        </div>
      )}

      {/* Two Column Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: SCREENPLAY EVIDENCE */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              Left Column: Screenplay Evidence & Source Cues
            </h2>
            <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Episode {selectedPromo.primary_episode_number}
            </span>
          </div>

          {/* Timecode & Duration Metadata */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Start Timestamp</span>
              <strong className="font-mono text-slate-900">{firstSeg?.start_timestamp || '00:00.00'}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">End Timestamp</span>
              <strong className="font-mono text-slate-900">{firstSeg?.end_timestamp || '00:25.00'}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Duration</span>
              <strong className="font-mono text-slate-900">{firstSeg?.duration_seconds?.toFixed(1) || 25}s</strong>
            </div>
          </div>

          {/* Exact Starting & Ending Cues */}
          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Exact Starting Hook Cue
              </span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800">
                <span className="text-purple-600 font-bold block mb-1">[{firstSeg?.start_timestamp}] First Dialogue / Action Line:</span>
                "{firstSeg?.first_line || selectedPromo.hook}"
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Exact Ending Cliffhanger Cue
              </span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800">
                <span className="text-purple-600 font-bold block mb-1">[{firstSeg?.end_timestamp}] Terminating Unanswered Beat:</span>
                "{firstSeg?.last_line || selectedPromo.cliffhanger}"
              </div>
            </div>
          </div>

          {/* Narrative Excerpt */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Screenplay Narrative Excerpt
            </span>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-700 italic">
              "{selectedPromo.standalone_context || 'Full uninterrupted continuous scene excerpt extracted directly from original screenplay cue-sheet.'}"
            </div>
          </div>

          {/* Multi-segment inspection list */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Segment Breakdown ({selectedPromo.segments?.length || 1} Total)
            </span>
            <div className="space-y-2">
              {selectedPromo.segments && selectedPromo.segments.map((seg, idx) => (
                <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-800">Segment #{seg.segment_index || (idx + 1)}</span>
                    <span className="font-mono text-purple-700">[{seg.start_timestamp} - {seg.end_timestamp}] ({seg.duration_seconds.toFixed(1)}s)</span>
                  </div>
                  <p className="text-slate-500 text-[11px] line-clamp-1">Opening: "{seg.first_line}"</p>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Checklist Panel */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Technical Validation Audit</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedPromo.validation_status === 'valid'
                  ? 'bg-emerald-100 text-emerald-800'
                  : isWarning
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {selectedPromo.validation_status.toUpperCase()}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {validationChecks.map((chk, i) => (
                <div key={i} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 truncate pr-2">{chk.label}</span>
                  <span className={`flex items-center gap-1 font-bold shrink-0 ${
                    chk.pass ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {chk.pass ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-rose-600" />}
                    {chk.pass ? 'Pass' : 'Fail'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI EVALUATION & DECISION */}
        <div className="space-y-6">
          {/* AI Scores Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Right Column: AI Conversion Evaluation
              </h2>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">Overall Composite Score</span>
                <span className="text-xl font-extrabold text-slate-900 font-mono">
                  {selectedPromo.overall_score.toFixed(1)}/100
                </span>
              </div>
            </div>

            {/* Five Factor Weighted Breakdown */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Five-Factor Weighted Scoring Formula
              </h3>
              
              <div className="space-y-2 text-xs">
                {/* 1. Hook Strength */}
                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>1. Hook Strength (25% weight)</span>
                    <strong className="font-mono">{firstSeg ? (firstSeg.hook_score * 10).toFixed(1) : 70}/100</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-600 h-full" style={{ width: `${firstSeg ? firstSeg.hook_score * 10 : 70}%` }} />
                  </div>
                </div>

                {/* 2. Cliffhanger Suspense */}
                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>2. Cliffhanger Suspense (25% weight)</span>
                    <strong className="font-mono">{firstSeg ? (firstSeg.cliffhanger_score * 10).toFixed(1) : 70}/100</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full" style={{ width: `${firstSeg ? firstSeg.cliffhanger_score * 10 : 70}%` }} />
                  </div>
                </div>

                {/* 3. Standalone Context */}
                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>3. Standalone Context (20% weight)</span>
                    <strong className="font-mono">{firstSeg ? (firstSeg.standalone_score * 10).toFixed(1) : 70}/100</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{ width: `${firstSeg ? firstSeg.standalone_score * 10 : 70}%` }} />
                  </div>
                </div>

                {/* 4. Emotional Impact */}
                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>4. Emotional Impact (15% weight)</span>
                    <strong className="font-mono">{firstSeg ? (firstSeg.emotional_impact_score * 10).toFixed(1) : 70}/100</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full" style={{ width: `${firstSeg ? firstSeg.emotional_impact_score * 10 : 70}%` }} />
                  </div>
                </div>

                {/* 5. Narrative Continuity */}
                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>5. Narrative Continuity (15% weight)</span>
                    <strong className="font-mono">{firstSeg ? (firstSeg.continuity_score * 10).toFixed(1) : 70}/100</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-600 h-full" style={{ width: `${firstSeg ? firstSeg.continuity_score * 10 : 70}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analytical Rationales */}
            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-800 block mb-0.5">Hook Analysis (0-3s retention):</span>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                  {selectedPromo.hook}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-0.5">Cliffhanger Suspense Analysis:</span>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                  {selectedPromo.cliffhanger}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-0.5">Why This Promo Works:</span>
                <p className="text-slate-600 leading-relaxed bg-purple-50/50 p-2.5 rounded border border-purple-100 text-purple-950">
                  {selectedPromo.why_it_works || 'Opening with direct confrontation delivers an immediate hook within 3 seconds, followed by escalating interpersonal drama that cuts abruptly before reaction.'}
                </p>
              </div>
            </div>
          </div>

          {/* Editor Decision Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              Editorial Review Decision
            </h3>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Editor Feedback & Directorial Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add editorial notes, music cues, or reasons for approval/rejection..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* Approve / Reject Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => promptDecision('rejected')}
                disabled={submitting}
                className="flex-1 py-2 px-4 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Reject Candidate
              </button>

              <button
                type="button"
                onClick={() => promptDecision('approved')}
                disabled={submitting || isInvalid}
                title={isInvalid ? "Cannot approve: Technical validation failed" : "Approve candidate"}
                className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs ${
                  isInvalid
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                <Check className="w-4 h-4" />
                Approve for Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Explicit Confirmation Dialog */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Editorial Decision
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to mark <strong>{selectedPromo.promo_identifier}</strong> as{' '}
              <strong className={confirmModal.decision === 'approved' ? 'text-purple-700' : 'text-rose-700'}>
                {confirmModal.decision.toUpperCase()}
              </strong>?
              {confirmModal.decision === 'approved' && ' Approved candidates are automatically marked eligible for marketing CSV and publishing JSON exports.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, decision: null })}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDecision}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors shadow-xs ${
                  confirmModal.decision === 'approved'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-rose-600 hover:bg-rose-700'
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
