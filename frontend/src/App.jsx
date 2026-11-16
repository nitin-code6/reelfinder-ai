import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Shows from './pages/Shows';
import Upload from './pages/Upload';
import Promos from './pages/Promos';
import Review from './pages/Review';
import Export from './pages/Export';

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex bg-[#F5F7FA] text-[#172B4D]">
        {/* Left Sidebar */}
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header onMenuClick={() => setMobileOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Routes>
              {/* Primary 4 sections */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route path="/shows" element={<Shows />} />
              <Route path="/library" element={<Shows />} />
              <Route path="/promos" element={<Promos />} />
              <Route path="/discovery" element={<Promos />} />
              <Route path="/review" element={<Review />} />

              {/* Contextual actions */}
              <Route path="/upload" element={<Upload />} />
              <Route path="/export" element={<Export />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-500">
            ReelFinder AI &bull; Kuku AI Generalist Assignment &bull; Problem 1: Find the Promos
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
