import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, FileSpreadsheet, FileCode, CheckCircle2, Filter, 
  ShieldCheck, AlertTriangle, AlertCircle, Info, Clock, Check
} from 'lucide-react';
import { getShows, getPromos } from '../api';

export default function Export() {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState('');
  const [status, setStatus] = useState('approved');
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadNotice, setDownloadNotice] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedShow]);

  async function loadData() {
    setLoading(true);
    try {
      const [showsRes, promosRes] = await Promise.all([
        getShows(),
        getPromos({ show_id: selectedShow || undefined })
      ]);
      setShows(showsRes.data || []);
      setPromos(promosRes.data || []);
    } catch (err) {
      console.error('Failed to load export data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate live breakdown metrics
  const metrics = useMemo(() => {
    const total = promos.length;
    const approved = promos.filter(p => p.approval_status === 'approved').length;
    const validApproved = promos.filter(p => p.approval_status === 'approved' && (p.validation_status === 'valid' || p.validation_status === 'warning')).length;
    const pending = promos.filter(p => p.approval_status === 'pending').length;
    const invalidExcluded = promos.filter(p => p.validation_status === 'invalid').length;

    let willExport = 0;
    if (status === 'approved') {
      willExport = validApproved;
    } else if (status === 'pending') {
      willExport = promos.filter(p => p.approval_status === 'pending' && p.validation_status !== 'invalid').length;
    } else {
      willExport = promos.filter(p => p.validation_status !== 'invalid').length;
    }

    return {
      total,
      approved,
      validApproved,
      pending,
      invalidExcluded,
      willExport
    };
  }, [promos, status]);

  function getDownloadUrl(format) {
    const params = new URLSearchParams();
    if (selectedShow) params.append('show_id', selectedShow);
    if (status) params.append('status', status);
    return `/api/export/${format}?${params.toString()}`;
  }

  function handleDownloadClick(format) {
    setDownloadNotice(`Generating and downloading ${format.toUpperCase()} export...`);
    setTimeout(() => {
      setDownloadNotice(`${format.toUpperCase()} export downloaded successfully.`);
      setTimeout(() => setDownloadNotice(null), 3500);
    }, 1000);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Toast Notice */}
      {downloadNotice && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Export Promotional Campaigns</h1>
        <p className="text-xs text-slate-500">
          Export verified promotional cue-sheets and playlists to production-ready CSV (for editors & marketers) or validated JSON (for automated publishing pipelines).
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Filter by Series
            </label>
            <select
              value={selectedShow}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="">All Registered Series</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.language})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Approval Status Filter
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="approved">Approved Candidates Only (Recommended)</option>
              <option value="pending">Pending Editorial Review Only</option>
              <option value="all">All Discovered Valid Candidates</option>
            </select>
          </div>
        </div>

        {/* Live Export Eligibility Breakdown */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Export Records Breakdown & Eligibility Audit
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Total Discovered</span>
              <strong className="text-sm font-bold text-slate-900">{metrics.total}</strong>
            </div>
            <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-200">
              <span className="text-[11px] text-purple-700 block">Approved</span>
              <strong className="text-sm font-bold text-purple-900">{metrics.approved}</strong>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-emerald-700 block">Valid & Approved</span>
              <strong className="text-sm font-bold text-emerald-800">{metrics.validApproved}</strong>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-[11px] text-amber-700 block">Pending Review</span>
              <strong className="text-sm font-bold text-amber-800">{metrics.pending}</strong>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
              <span className="text-[11px] text-rose-700 block">Invalid (Excluded)</span>
              <strong className="text-sm font-bold text-rose-800">{metrics.invalidExcluded}</strong>
            </div>
            <div className="p-3 bg-purple-600 text-white rounded-lg shadow-xs flex flex-col justify-between">
              <span className="text-[11px] text-purple-200 block">Will Export</span>
              <strong className="text-base font-extrabold">{metrics.willExport} Records</strong>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <span>
              <strong>Integrity Guarantee:</strong> Only candidates with passed technical validation (accurate timestamps, 20-60s duration, valid source dialogue cues) are included in standard exports. Invalid candidates are automatically segregated into the audit log.
            </span>
          </div>
        </div>

        {/* Empty State vs Export Cards */}
        {metrics.willExport === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No eligible promo records match current export criteria.</p>
            <p className="text-[11px] text-slate-400">
              If you have pending candidates, review and approve them on the Editorial Review page, or change the filter to "Pending Review" or "All Valid Candidates".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* CSV Card */}
            <div className="p-6 rounded-xl border border-slate-200 hover:border-purple-300 transition-all flex flex-col justify-between space-y-4 bg-slate-50/50">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">CSV Marketing Spreadsheet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Includes exact timecodes, durations, 5-factor quality scores, hook summaries, and editor approval statuses formatted for video editors and growth teams.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href={getDownloadUrl('csv')}
                  onClick={() => handleDownloadClick('csv')}
                  download="kuku_promos_export.csv"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Download CSV ({metrics.willExport} Records)
                </a>
              </div>
            </div>

            {/* JSON Card */}
            <div className="p-6 rounded-xl border border-slate-200 hover:border-purple-300 transition-all flex flex-col justify-between space-y-4 bg-slate-50/50">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <FileCode className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Structured Production JSON</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Conforms strictly to the Kuku assignment JSON schema with multi-segment arrays, nested score factor objects, and source cue verification metadata.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href={getDownloadUrl('json')}
                  onClick={() => handleDownloadClick('json')}
                  download="kuku_promos_export.json"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Download JSON ({metrics.willExport} Records)
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Invalid Records Separate Export */}
        {metrics.invalidExcluded > 0 && (
          <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-rose-900 block">Rejected / Invalid Candidates Audit Report</span>
              <p className="text-rose-700 text-[11px] mt-0.5">
                {metrics.invalidExcluded} candidates were rejected due to duration or timestamp cue mismatches.
              </p>
            </div>
            <a
              href={`/api/export/invalid/csv${selectedShow ? `?show_id=${selectedShow}` : ''}`}
              download="invalid_candidates_audit.csv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download Audit CSV
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
