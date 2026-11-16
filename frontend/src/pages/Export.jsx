import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, FileSpreadsheet, FileCode, CheckCircle2, ShieldCheck, 
  AlertCircle, Sparkles, Check
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

  const metrics = useMemo(() => {
    const total = promos.length;
    const approved = promos.filter(p => p.approval_status === 'approved').length;
    const validApproved = promos.filter(p => p.approval_status === 'approved' && (p.validation_status === 'valid' || p.validation_status === 'warning')).length;
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
    setDownloadNotice(`Downloading ${format.toUpperCase()} export file...`);
    setTimeout(() => {
      setDownloadNotice(`✓ ${format.toUpperCase()} export downloaded successfully.`);
      setTimeout(() => setDownloadNotice(null), 3000);
    }, 1200);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast Notice */}
      {downloadNotice && (
        <div className="fixed bottom-6 right-6 bg-[#172B4D] text-white text-xs px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2 border border-white/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#172B4D] tracking-tight">Export Promotional Campaigns</h2>
        <p className="text-xs text-[#64748B]">
          Download validated promo cue-sheets for video editors and automated publishing pipelines.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Series</label>
            <select
              value={selectedShow}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="">All Registered Series</option>
              {shows.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Editorial Scope</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="approved">Approved Candidates Only (Recommended)</option>
              <option value="pending">Pending Candidates</option>
              <option value="all">All Discovered Valid Candidates</option>
            </select>
          </div>
        </div>
      </div>

      {/* Export Eligibility Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
          <span>Export Eligibility Breakdown</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-semibold text-slate-500 block">Total Candidates</span>
            <span className="text-base font-bold text-[#172B4D]">{metrics.total}</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-[10px] font-semibold text-emerald-700 block">Valid & Approved</span>
            <span className="text-base font-bold text-emerald-800">{metrics.validApproved}</span>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <span className="text-[10px] font-semibold text-rose-700 block">Invalid (Excluded)</span>
            <span className="text-base font-bold text-rose-800">{metrics.invalidExcluded}</span>
          </div>
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
            <span className="text-[10px] font-semibold text-[#0F766E] block">Eligible for Export</span>
            <span className="text-base font-bold text-[#0F766E]">{metrics.willExport}</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Only technically validated candidates (20–60s duration with matching screenplay cue timestamps) are included in exports.
        </p>
      </div>

      {/* Two Download Format Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CSV Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#0F766E] transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0F766E] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#172B4D]">Marketing & Editorial CSV</h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Tabular format with timecodes, cue dialogue, hook & cliffhanger analyses, and overall score rankings. Compatible with Excel and video NLE cue-sheets.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-[#0F766E]">
              {metrics.willExport} record(s) ready for download
            </div>
          </div>

          <a
            href={getDownloadUrl('csv')}
            onClick={() => handleDownloadClick('csv')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
              metrics.willExport === 0
                ? 'bg-slate-100 text-slate-400 pointer-events-none'
                : 'bg-[#0F766E] hover:bg-[#115E59] text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Spreadsheet</span>
          </a>
        </div>

        {/* JSON Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#0F766E] transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#172B4D]">Structured Pipeline JSON</h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Full programmatic schema conforming strictly to Kuku assignment specs. Includes multi-segment breakdown, 5-factor scoring, and verified timecodes.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-[#0F766E]">
              {metrics.willExport} record(s) ready for download
            </div>
          </div>

          <a
            href={getDownloadUrl('json')}
            onClick={() => handleDownloadClick('json')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
              metrics.willExport === 0
                ? 'bg-slate-100 text-slate-400 pointer-events-none'
                : 'bg-[#172B4D] hover:bg-slate-800 text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download Structured JSON</span>
          </a>
        </div>
      </div>
    </div>
  );
}
