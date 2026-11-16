import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Activity } from 'lucide-react';
import { getHealth } from '../api';

const routeHeaders = {
  '/': { title: 'Overview', subtitle: 'Your microdrama promotional workspace' },
  '/overview': { title: 'Overview', subtitle: 'Your microdrama promotional workspace' },
  '/shows': { title: 'Library', subtitle: 'Manage shows, screenplay parsing, and episode discovery' },
  '/library': { title: 'Library', subtitle: 'Manage shows, screenplay parsing, and episode discovery' },
  '/promos': { title: 'Discovery', subtitle: 'Discover, evaluate, and rank high-converting promotional moments' },
  '/discovery': { title: 'Discovery', subtitle: 'Discover, evaluate, and rank high-converting promotional moments' },
  '/review': { title: 'Review', subtitle: 'Human-in-the-loop candidate validation, scoring inspection, and editorial approval' },
  '/upload': { title: 'Upload Screenplays', subtitle: 'Guided upload for TXT, PDF, or ZIP screenplay datasets' },
  '/export': { title: 'Export', subtitle: 'Download validated eligible promo results in marketing CSV and JSON' },
};

export default function Header({ onMenuClick }) {
  const [backendStatus, setBackendStatus] = useState('healthy');
  const location = useLocation();

  useEffect(() => {
    getHealth()
      .then(res => setBackendStatus(res.data.status === 'ok' ? 'healthy' : 'degraded'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  const currentHeader = routeHeaders[location.pathname] || {
    title: 'ReelFinder AI',
    subtitle: 'Microdrama Promo Engine'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
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
        {/* Backend Status Pill */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
          backendStatus === 'healthy'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : backendStatus === 'degraded'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            backendStatus === 'healthy'
              ? 'bg-emerald-500 animate-pulse'
              : backendStatus === 'degraded'
              ? 'bg-amber-500'
              : 'bg-rose-500'
          }`} />
          <span className="font-semibold">
            {backendStatus === 'healthy' ? 'API Online' : backendStatus === 'degraded' ? 'API Degraded' : 'API Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
