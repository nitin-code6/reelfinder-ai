import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileCode, CheckCircle2, Filter } from 'lucide-react';
import { getShows } from '../api';

export default function Export() {
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState('');
  const [status, setStatus] = useState('approved');

  useEffect(() => {
    getShows().then((res) => setShows(res.data));
  }, []);

  function getDownloadUrl(format) {
    const params = new URLSearchParams();
    if (selectedShow) params.append('show_id', selectedShow);
    if (status) params.append('status', status);
    return `/api/export/${format}?${params.toString()}`;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Export Promotional Campaigns</h1>
        <p className="text-xs text-slate-500">
          Export approved promo playlists and timestamp cue-sheets directly to CSV (for editors/marketers) or JSON (for automated publishing pipelines).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Filter by Series
            </label>
            <select
              value={selectedShow}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Shows</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Approval Filter
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="approved">Approved Only (Recommended)</option>
              <option value="pending">Pending Review Only</option>
              <option value="all">All Recommendations</option>
            </select>
          </div>
        </div>

        {/* Export Formats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CSV Card */}
          <div className="p-6 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between space-y-4 bg-slate-50/50">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">CSV Spreadsheet</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Includes episode numbers, exact timecodes, durations, 5-factor quality scores, hook summaries, and editor notes.
              </p>
            </div>

            <a
              href={getDownloadUrl('csv')}
              download="kuku_promos_export.csv"
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download CSV File
            </a>
          </div>

          {/* JSON Card */}
          <div className="p-6 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex flex-col justify-between space-y-4 bg-slate-50/50">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <FileCode className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Structured JSON</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Conforms strictly to the assignment schema with multi-segment arrays, nested score objects, and validation metadata.
              </p>
            </div>

            <a
              href={getDownloadUrl('json')}
              download="kuku_promos_export.json"
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download JSON File
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
