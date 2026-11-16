import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Shows from './pages/Shows';
import Upload from './pages/Upload';
import Promos from './pages/Promos';
import Review from './pages/Review';
import Export from './pages/Export';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/shows" element={<Shows />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/promos" element={<Promos />} />
            <Route path="/review" element={<Review />} />
            <Route path="/export" element={<Export />} />
          </Routes>
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          ReelFinder AI &bull; Kuku AI Generalist Assignment &bull; Problem 1: Find the Promos
        </footer>
      </div>
    </BrowserRouter>
  );
}
