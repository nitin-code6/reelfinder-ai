import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, Layers } from 'lucide-react';
import { getShows, uploadScreenplay } from '../api';
import { Link, useNavigate } from 'react-router-dom';

export default function Upload() {
  const [shows, setShows] = useState([]);
  const [selectedShowId, setSelectedShowId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getShows().then((res) => {
      setShows(res.data);
      if (res.data.length > 0) {
        setSelectedShowId(res.data[0].id);
      }
    });
  }, []);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    setError('');
    setUploadResult(null);

    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase();
      if (!['txt', 'pdf', 'zip'].includes(ext)) {
        setError('Invalid file format. Please upload a .txt, .pdf, or .zip archive.');
        setFile(null);
        return;
      }
      setFile(selected);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedShowId) {
      setError('Please select or create a show first.');
      return;
    }
    if (!file) {
      setError('Please select a screenplay file to upload.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const res = await uploadScreenplay(selectedShowId, file);
      setUploadResult(res.data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please check file integrity.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Screenplay Datasets</h1>
        <p className="text-xs text-slate-500">
          Upload single episode screenplay cue-sheets (.txt or .pdf) or bulk ZIP archives containing full series runs.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-sm space-y-6">
        <form onSubmit={handleUpload} className="space-y-6">
          {/* Target Show Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Target Series
            </label>
            {shows.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-sm flex items-center justify-between">
                <span>No shows found. Create a show first to assign uploaded scripts.</span>
                <Link to="/shows" className="font-semibold underline text-amber-900">
                  Create Show
                </Link>
              </div>
            ) : (
              <select
                value={selectedShowId}
                onChange={(e) => setSelectedShowId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {shows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Drag & Drop Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Screenplay File (.TXT, .PDF, or .ZIP)
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center transition-colors bg-slate-50/50 hover:bg-slate-50 cursor-pointer relative">
              <input
                type="file"
                accept=".txt,.pdf,.zip"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
              {file ? (
                <div>
                  <p className="text-sm font-bold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-700">Click or drag screenplay file here</p>
                  <p className="text-xs text-slate-400 mt-1">Supports individual scripts (.txt, .pdf) or multi-episode ZIP archive</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !file || !selectedShowId}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
          >
            {uploading ? 'Validating and Uploading...' : 'Upload Screenplay'}
          </button>
        </form>

        {/* Upload Success Breakdown */}
        {uploadResult && (
          <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-3">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Successfully Uploaded {uploadResult.length} Episode(s)!
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
              {uploadResult.map((ep) => (
                <div key={ep.id} className="flex justify-between py-1 border-b border-emerald-100 last:border-none">
                  <span className="font-semibold">Episode {ep.episode_number}</span>
                  <span className="text-emerald-700 truncate max-w-xs">{ep.original_filename}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => navigate('/shows')}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950"
              >
                Go to Shows to Discover Promos <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
