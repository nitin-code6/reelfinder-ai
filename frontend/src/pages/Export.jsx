import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, FileSpreadsheet, FileCode, CheckCircle2, ShieldCheck, 
  AlertCircle, Sparkles, Check, Info, Code2
} from 'lucide-react';
import { getShows, getPromos } from '../api';

export default function Export() {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState('');
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

  // Exact metrics matching Panel 6
  const metrics = useMemo(() => {
    const total = promos.length;
    const approved = promos.filter(p => p.approval_status === 'approved').length;
    const validApproved = promos.filter(p => p.approval_status === 'approved' && (p.validation_status === 'valid' || p.validation_status === 'warning')).length;
    const pending = promos.filter(p => p.approval_status === 'pending').length;
    const invalidExcluded = promos.filter(p => p.validation_status === 'invalid').length;
    const willExport = validApproved;

    return {
      total,
      approved,
      validApproved,
      pending,
      invalidExcluded,
      willExport
    };
  }, [promos]);

  function getDownloadUrl(format) {
    const params = new URLSearchParams();
    if (selectedShow) params.append('show_id', selectedShow);
    params.append('status', 'approved');
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast Notice */}
      {downloadNotice && (
        <div className="fixed bottom-6 right-6 bg-[#172B4D] text-white text-xs px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2 border border-white/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Series Filter Selector if user wants to filter by series */}
      {shows.length > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="text-slate-500 font-medium">Filter by Series:</span>
          <select
            value={selectedShow}
            onChange={(e) => setSelectedShow(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-[#172B4D] focus:outline-none"
          >
            <option value="">All Series ({metrics.total} Promos)</option>
            {shows.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Top 6 Metric Boxes matching Panel 6 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-[#172B4D]">{metrics.total}</div>
          <div className="text-[11px] font-semibold text-slate-500">Total Candidates</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-indigo-700">{metrics.approved}</div>
          <div className="text-[11px] font-semibold text-slate-500">Approved</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-emerald-700">{metrics.validApproved}</div>
          <div className="text-[11px] font-semibold text-slate-500">Valid & Approved</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-[#D69E36]">{metrics.pending}</div>
          <div className="text-[11px] font-semibold text-slate-500">Pending</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-rose-700">{metrics.invalidExcluded}</div>
          <div className="text-[11px] font-semibold text-slate-500">Invalid (Excluded)</div>
        </div>

        <div className="bg-white border border-teal-200 bg-teal-50/30 rounded-2xl p-4 shadow-xs text-center space-y-1">
          <div className="text-2xl font-black text-[#0F766E]">{metrics.willExport}</div>
          <div className="text-[11px] font-bold text-[#0F766E]">Will Export</div>
        </div>
      </div>

      {/* Information Banner matching Panel 6 */}
      <div className="p-3.5 bg-slate-100/70 border border-slate-200 rounded-xl flex items-center gap-2.5 text-xs text-slate-600">
        <Info className="w-4 h-4 text-[#0F766E] shrink-0" />
        <span>
          Only approved candidates that passed technical validation (accurate timestamps, 20-60s duration and valid source cues) will be included in the export.
        </span>
      </div>

      {/* Two Download Cards matching Panel 6 */}
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
                Timelines, durations, scores and editorial status ({metrics.willExport} records)
              </p>
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
            <span>Download CSV ({metrics.willExport} Records)</span>
          </a>
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
                Conforms to Kuku assignment schema with segments and source cue metadata ({metrics.willExport} records)
              </p>
            </div>
          </div>

          <a
            href={getDownloadUrl('json')}
            onClick={() => handleDownloadClick('json')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
              metrics.willExport === 0
                ? 'bg-slate-100 text-slate-400 pointer-events-none'
                : 'bg-[#0F766E] hover:bg-[#115E59] text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download JSON ({metrics.willExport} Records)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
