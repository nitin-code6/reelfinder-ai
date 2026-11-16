import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Activity } from 'lucide-react';
import { getHealth } from '../api';

const routeHeaders = {
  '/': { title: 'Overview', subtitle: 'Your microdrama promotional workspace' },
  '/overview': { title: 'Overview', subtitle: 'Your microdrama promotional workspace' },
  '/shows': { title: 'Library', subtitle: 'Manage shows, episodes and processing status.' },
  '/library': { title: 'Library', subtitle: 'Manage shows, episodes and processing status.' },
  '/promos': { title: 'Promo Discovery', subtitle: 'AI-discovered promotional moments ranked by conversion potential.' },
  '/discovery': { title: 'Promo Discovery', subtitle: 'AI-discovered promotional moments ranked by conversion potential.' },
  '/review': { title: 'Editorial Review', subtitle: 'Verify screenplay evidence, scores and make an editorial decision.' },
  '/upload': { title: 'Upload Screenplays', subtitle: 'Add screenplay files and start automated processing.' },
  '/export': { title: 'Export Results', subtitle: 'Download approved and validated promotional results.' },
};

export default function Header({ onMenuClick }) {
  const [backendStatus, setBackendStatus] = useState('healthy');
  const [aiInfo, setAiInfo] = useState(null);
  const location = useLocation();

  useEffect(() => {
    getHealth()
      .then(res => {
        setBackendStatus(res.data.status === 'ok' ? 'healthy' : 'degraded');
        if (res.data.ai) {
          setAiInfo(res.data.ai);
        }
      })
      .catch(() => setBackendStatus('offline'));
  }, []);

  const currentHeader = routeHeaders[location.pathname] || {
    title: 'ReelFinder AI',
    subtitle: 'Microdrama Promo Engine'
  };

  const isNoKeys = aiInfo?.status === 'no_keys';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#172B4D] tracking-tight">
              {currentHeader.title}
            </h1>
            <p className="text-xs text-[#64748B] hidden sm:block">
              {currentHeader.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI / API Status Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isNoKeys
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : backendStatus === 'healthy'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : backendStatus === 'degraded'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={aiInfo?.message || 'API Online'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isNoKeys
                  ? 'bg-amber-500'
                  : backendStatus === 'healthy'
                  ? 'bg-emerald-500 animate-pulse'
                  : backendStatus === 'degraded'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold">
              {isNoKeys
                ? 'Heuristic Mode (No Keys)'
                : backendStatus === 'healthy'
                ? 'API Online'
                : backendStatus === 'degraded'
                ? 'API Degraded'
                : 'API Offline'}
            </span>
          </div>
        </div>
      </div>

      {isNoKeys && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between">
          <span>⚠️ <strong>AI API Key Not Available:</strong> Tokens not configured or exhausted. Processing will run using the deterministic heuristic engine. Add your <code>GROQ_API_KEY</code> or <code>GEMINI_API_KEY</code> to enable full LLM discovery.</span>
        </div>
      )}
    </header>
  );
}
