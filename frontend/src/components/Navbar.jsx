import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Film, LayoutDashboard, UploadCloud, Sparkles, CheckCircle2, Download, Activity } from 'lucide-react';
import { getHealth } from '../api';

export default function Navbar() {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    getHealth()
      .then(res => setBackendStatus(res.data.status === 'ok' ? 'healthy' : 'degraded'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/shows', label: 'Shows & Episodes', icon: Film },
    { to: '/upload', label: 'Upload Screenplays', icon: UploadCloud },
    { to: '/promos', label: 'Promo Discovery', icon: Sparkles },
    { to: '/review', label: 'Editorial Review', icon: CheckCircle2 },
    { to: '/export', label: 'Export', icon: Download },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 font-bold text-lg">
              RF
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">ReelFinder AI</span>
              <span className="block text-xs text-indigo-600 font-medium">Microdrama Promo Engine</span>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                backendStatus === 'healthy'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : backendStatus === 'degraded'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'healthy'
                    ? 'bg-emerald-500'
                    : backendStatus === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-rose-500 animate-pulse'
                }`}
              />
              {backendStatus === 'healthy' ? 'API Online' : backendStatus === 'degraded' ? 'Degraded' : 'API Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
