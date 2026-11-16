import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Layers, 
  Sparkles, 
  CheckSquare, 
  UploadCloud, 
  Download, 
  Clapperboard,
  Menu,
  X
} from 'lucide-react';
import { getPromos } from '../api';

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    // Refresh pending count
    getPromos({ approval_status: 'pending' })
      .then(res => setPendingCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => setPendingCount(0));
  }, [location.pathname]);

  const navItems = [
    { to: '/', label: 'Overview', icon: Home },
    { to: '/shows', label: 'Library', icon: Layers, matchPaths: ['/shows', '/library'] },
    { to: '/promos', label: 'Discovery', icon: Sparkles, matchPaths: ['/promos', '/discovery'] },
    { 
      to: '/review', 
      label: 'Review', 
      icon: CheckSquare, 
      matchPaths: ['/review'],
      badge: pendingCount > 0 ? pendingCount : null 
    },
  ];

  const content = (
    <div className="flex flex-col h-full bg-[#172B4D] text-white select-none">
      {/* Brand Header */}
      <div className="p-5 pb-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] flex items-center justify-center text-white shadow-md">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block leading-tight">
              ReelFinder AI
            </span>
            <span className="text-[11px] text-teal-300 font-medium tracking-wide">
              Microdrama Promo Engine
            </span>
          </div>
        </div>
        {/* Mobile close button */}
        {mobileOpen && (
          <button 
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 px-3 pb-1">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPaths 
            ? item.matchPaths.some(p => location.pathname.startsWith(p))
            : location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#D69E36] text-white shadow-xs">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Action Section */}
        <div className="pt-6 space-y-2">
          <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 px-3 pb-1">
            Actions
          </div>
          <NavLink
            to="/upload"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isActive
                  ? 'bg-white text-[#0F766E]'
                  : 'bg-[#CCFBF1] hover:bg-[#99F6E4] text-[#0F766E]'
              }`
            }
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Screenplay</span>
          </NavLink>

          <NavLink
            to="/export"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Export</span>
          </NavLink>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 border-r border-slate-200">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" 
            onClick={() => setMobileOpen(false)} 
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
