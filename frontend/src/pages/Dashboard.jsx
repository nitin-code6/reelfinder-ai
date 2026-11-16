import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Video, Sparkles, CheckCircle2, Clock, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { getShows, getPromos } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalShows: 0,
    totalEpisodes: 0,
    totalPromos: 0,
    pendingApprovals: 0,
    approvedPromos: 0,
    rejectedPromos: 0,
    averageScore: 0,
  });
  const [recentPromos, setRecentPromos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [showsRes, promosRes] = await Promise.all([getShows(), getPromos({ limit: 10 })]);
        const shows = showsRes.data;
        const promos = promosRes.data;

        const totalEpisodes = shows.reduce((acc, s) => acc + (s.episode_count || 0), 0);
        const pending = promos.filter((p) => p.approval_status === 'pending').length;
        const approved = promos.filter((p) => p.approval_status === 'approved').length;
        const rejected = promos.filter((p) => p.approval_status === 'rejected').length;
        const avgScore = promos.length
          ? (promos.reduce((acc, p) => acc + p.overall_score, 0) / promos.length).toFixed(1)
          : 0;

        setStats({
          totalShows: shows.length,
          totalEpisodes,
          totalPromos: promos.length,
          pendingApprovals: pending,
          approvedPromos: approved,
          rejectedPromos: rejected,
          averageScore: avgScore,
        });
        setRecentPromos(promos.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const statCards = [
    { title: 'Total Shows', value: stats.totalShows, icon: Film, color: 'text-blue-600 bg-blue-50' },
    { title: 'Total Episodes', value: stats.totalEpisodes, icon: Video, color: 'text-purple-600 bg-purple-50' },
    { title: 'Detected Promos', value: stats.totalPromos, icon: Sparkles, color: 'text-indigo-600 bg-indigo-50' },
    { title: 'Pending Approval', value: stats.pendingApprovals, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { title: 'Approved Promos', value: stats.approvedPromos, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'Avg Composite Score', value: `${stats.averageScore}/100`, icon: TrendingUp, color: 'text-rose-600 bg-rose-50' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Welcome */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 bg-indigo-500/30 rounded-full text-xs font-semibold tracking-wider uppercase mb-3 border border-indigo-400/20">
            Kuku AI Generalist Assignment — Problem 1
          </span>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Automated Microdrama Promo Discovery</h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Discover, evaluate, and rank 20–60 second viral ads from microdrama screenplays. Powered by structured AI
            understanding, 3-second hook detection, unresolved cliffhangers, and deterministic timestamp validation.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-all shadow-md"
            >
              Upload Screenplays
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/promos"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm transition-all"
            >
              Browse Ranked Promos
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500">{card.title}</span>
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Recent High-Scoring Recommendations */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Top Promotional Opportunities</h2>
            <p className="text-xs text-slate-500">Highest converting candidate clips ranked by the 5-factor scoring engine.</p>
          </div>
          <Link to="/promos" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentPromos.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Film className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium">No promos discovered yet.</p>
            <p className="text-xs text-slate-400 mt-1">Upload an episode script or run batch evaluation to see recommendations.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentPromos.map((promo) => (
              <div key={promo.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                      {promo.promo_identifier}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Episode {promo.primary_episode_number} &bull; {promo.total_duration_seconds}s Duration
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                        promo.approval_status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : promo.approval_status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {promo.approval_status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">Hook: {promo.hook}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    <strong className="text-slate-700">Cliffhanger:</strong> {promo.cliffhanger}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-end md:self-center">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{promo.overall_score}</div>
                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Score / 100</div>
                  </div>
                  <Link
                    to={`/review?id=${promo.id}`}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
