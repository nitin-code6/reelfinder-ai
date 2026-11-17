import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, FileSpreadsheet, FileCode, CheckCircle2, ShieldCheck, 
  AlertCircle, Sparkles, Check, Info, Code2, RefreshCw, Filter
} from 'lucide-react';
import { getShows, getPromos, downloadExport, getErrorMessage } from '../api';

export default function Export() {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState('');
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [exportScope, setExportScope] = useState('all'); // 'all' (All Evaluated) or 'approved' (Approved Only)

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

  // Exact metrics
  const metrics = useMemo(() => {
    const total = promos.length;
    const approved = promos.filter(p => p.approval_status === 'approved').length;
    const valid = promos.filter(p => p.validation_status === 'valid').length;
    const warning = promos.filter(p => p.validation_status === 'warning').length;
    const invalid = promos.filter(p => p.validation_status === 'invalid').length;
    const pending = promos.filter(p => p.approval_status === 'pending').length;
    const multiSegment = promos.filter(p => p.segments && p.segments.length > 1).length;

    const countToExport = exportScope === 'approved' ? approved : total;

    return {
      total,
      approved,
      valid,
      warning,
      invalid,
      pending,
      multiSegment,
      countToExport
    };
  }, [promos, exportScope]);

  async function handleDownload(format) {
    setDownloadingFormat(format);
    setDownloadNotice(`Generating and downloading ${format.toUpperCase()} export...`);

    try {
      const params = {
        include_invalid: true
      };
      if (selectedShow) params.show_id = selectedShow;
      if (exportScope !== 'all') params.status = exportScope;

      const res = await downloadExport(format, params);
      
      // Determine file blob and trigger browser download
      const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = `reelfinder_promos_${exportScope}_${new Date().toISOString().slice(0, 10)}.${format}`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setDownloadNotice(`✓ ${format.toUpperCase()} file downloaded successfully (${metrics.countToExport} records).`);
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (err) {
      console.error(`Export failed for ${format}:`, err);
      const msg = getErrorMessage(err, `Failed to download ${format.toUpperCase()} file.`);
      alert(`Download Error: ${msg}`);
      setDownloadNotice(null);
    } finally {
      setDownloadingFormat(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Toast Notice */}
      {downloadNotice && (
        <div className="fixed bottom-6 right-6 bg-[#172B4D] text-white text-xs px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2.5 border border-white/20 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Header and Scope Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[#172B4D]">Export Center</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Download full promotional candidate datasets with timecodes, segments, and validation audits.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Series Filter */}
          {shows.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Series:</span>
              <select
                value={selectedShow}
                onChange={(e) => setSelectedShow(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#172B4D] focus:outline-none"
              >
                <option value="">All Series ({promos.length})</option>
                {shows.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Export Scope Selector (All vs Approved Only) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setExportScope('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                exportScope === 'all'
                  ? 'bg-white text-[#0F766E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Discovered ({metrics.total})
            </button>
            <button
              onClick={() => setExportScope('approved')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                exportScope === 'approved'
                  ? 'bg-white text-[#0F766E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approved Only ({metrics.approved})
            </button>
          </div>
        </div>
      </div>

      {/* Top 6 Metric Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-[#172B4D]">{metrics.total}</div>
          <div className="text-[11px] font-semibold text-slate-500">Total Candidates</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-emerald-700">{metrics.valid}</div>
          <div className="text-[11px] font-semibold text-emerald-700">Valid</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-amber-600">{metrics.warning}</div>
          <div className="text-[11px] font-semibold text-amber-600">Warnings</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-rose-700">{metrics.invalid}</div>
          <div className="text-[11px] font-semibold text-rose-700">Invalid</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-indigo-700">{metrics.approved}</div>
          <div className="text-[11px] font-semibold text-indigo-700">Approved</div>
        </div>

        <div className="bg-white border border-teal-200 bg-teal-50/40 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-[#0F766E]">{metrics.countToExport}</div>
          <div className="text-[11px] font-bold text-[#0F766E]">Ready to Export</div>
        </div>
      </div>

      {/* Information Banner */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-xs text-slate-600">
        <Info className="w-4 h-4 text-[#0F766E] shrink-0" />
        <span>
          {exportScope === 'approved' ? (
            <span>Exporting <strong>Approved Candidates Only</strong>. Review and approve candidates in the Promos tab to add more to this view.</span>
          ) : (
            <span>Exporting <strong>All Evaluated Candidates</strong> ({metrics.total} records) with explicit validation status and limitations audit.</span>
          )}
        </span>
      </div>

      {/* Two Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: CSV Marketing Spreadsheet */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 hover:border-[#0F766E] transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0F766E] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#172B4D]">CSV Marketing Spreadsheet</h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Contains columns for timestamps, segment breakdown, scores, verbatim hook/cliffhanger, and validation audit.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleDownload('csv')}
            disabled={downloadingFormat === 'csv' || metrics.countToExport === 0}
            className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
              metrics.countToExport === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#0F766E] hover:bg-[#115E59] text-white active:scale-[0.99]'
            }`}
          >
            {downloadingFormat === 'csv' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Downloading CSV...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download CSV ({metrics.countToExport} Records)</span>
              </>
            )}
          </button>
        </div>

        {/* Card 2: Structured Production JSON */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 hover:border-[#0F766E] transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#172B4D]">Structured Production JSON</h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Conforms strictly to the assignment schema with full segments array, source cue metadata, score breakdowns, and provider trace.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleDownload('json')}
            disabled={downloadingFormat === 'json' || metrics.countToExport === 0}
            className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
              metrics.countToExport === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#0F766E] hover:bg-[#115E59] text-white active:scale-[0.99]'
            }`}
          >
            {downloadingFormat === 'json' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Downloading JSON...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download JSON ({metrics.countToExport} Records)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
