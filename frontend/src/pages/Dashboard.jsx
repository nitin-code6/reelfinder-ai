import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Film, Video, Sparkles, CheckCircle2, Clock, ArrowRight, 
  AlertCircle, ShieldCheck, FileSpreadsheet, RefreshCw, UploadCloud, ChevronRight
} from 'lucide-react';
import { getShows, getPromos, getEpisodes } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalShows: 0,
    totalEpisodes: 0,
    parsedEpisodes: 0,
    failedEpisodes: 0,
    validPromos: 0,
    pendingApprovals: 0,
    approvedPromos: 0,
    rejectedPromos: 0,
  });
  const [seriesWorkflow, setSeriesWorkflow] = useState([]);
  const [recentDecisions, setRecentDecisions] = useState([]);
  const [recentCandidates, setRecentCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [showsRes, promosRes] = await Promise.all([
        getShows(),
        getPromos({ limit: 50 })
      ]);
      const shows = showsRes.data || [];
      const promos = promosRes.data || [];

      // Fetch episodes across registered shows
      let allEpisodes = [];
      const workflowItems = [];

      for (const show of shows) {
        try {
          const epRes = await getEpisodes(show.id);
          const eps = epRes.data || [];
          allEpisodes = allEpisodes.concat(eps);

          const showPromos = promos.filter(p => p.show_id === show.id);
          const parsedCount = eps.filter(e => e.processing_status === 'completed').length;
          const failedCount = eps.filter(e => e.processing_status === 'failed').length;
          const validCount = showPromos.filter(p => p.validation_status === 'valid' || p.validation_status === 'warning').length;
          const pendingCount = showPromos.filter(p => p.approval_status === 'pending').length;
          const approvedCount = showPromos.filter(p => p.approval_status === 'approved').length;

          workflowItems.push({
            id: show.id,
            title: show.title,
            language: show.language,
            totalEpisodes: eps.length,
            parsedCount,
            failedCount,
            discoveredPromos: showPromos.length,
            validCount,
            pendingCount,
            approvedCount,
          });
        } catch (e) {
          console.error(`Failed to load episodes for show ${show.id}`, e);
        }
      }

      const parsedEps = allEpisodes.filter(e => e.processing_status === 'completed').length;
      const failedEps = allEpisodes.filter(e => e.processing_status === 'failed').length;
      const validCandidates = promos.filter(p => p.validation_status === 'valid' || p.validation_status === 'warning').length;
      const pendingApprovals = promos.filter(p => p.approval_status === 'pending').length;
      const approvedPromos = promos.filter(p => p.approval_status === 'approved').length;
      const rejectedPromos = promos.filter(p => p.approval_status === 'rejected').length;

      setStats({
        totalShows: shows.length,
        totalEpisodes: allEpisodes.length,
        parsedEpisodes: parsedEps,
        failedEpisodes: failedEps,
        validPromos: validCandidates,
        pendingApprovals,
        approvedPromos,
        rejectedPromos,
      });

      setSeriesWorkflow(workflowItems);
      setRecentCandidates(promos.slice(0, 5));
      setRecentDecisions(promos.filter(p => p.approval_status !== 'pending').slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  const workflowSteps = [
    { num: '1', name: 'Upload', desc: 'TXT / PDF / ZIP screenplays', link: '/upload' },
    { num: '2', name: 'Parse', desc: 'Cues, timecodes & scenes', link: '/shows' },
    { num: '3', name: 'Discover', desc: '20-60s hooks & cliffhangers', link: '/promos' },
    { num: '4', name: 'Review', desc: '5-factor editorial verification', link: '/review' },
    { num: '5', name: 'Export', desc: 'Production CSV & JSON formats', link: '/export' },
  ];

  const statCards = [
    { label: 'Total Shows', value: stats.totalShows, icon: Film, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    { label: 'Total Episodes', value: stats.totalEpisodes, icon: Video, color: 'text-slate-700 bg-slate-100 border-slate-200' },
    { label: 'Parsed Successfully', value: stats.parsedEpisodes, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Failed Episodes', value: stats.failedEpisodes, icon: AlertCircle, color: 'text-rose-700 bg-rose-50 border-rose-200' },
    { label: 'Valid Candidates', value: stats.validPromos, icon: ShieldCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: Clock, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Approved Promos', value: stats.approvedPromos, icon: Sparkles, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="text-sm font-medium text-slate-500">Loading dashboard metrics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200/60">
            Microdrama Promotional Intelligence
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            ReelFinder AI
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Discover, evaluate, and rank promotional moments from microdrama screenplays.
            Deterministic timestamp validation guarantees zero fabricated timecodes, while five-factor scoring
            detects high-converting viral hooks and cliffhangers.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Screenplays
            </Link>
            <Link
              to="/promos"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold border border-slate-300 transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              View Discovered Promos
            </Link>
          </div>
        </div>

        {/* Compact Workflow Steps Banner */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block mb-3">
            Processing Workflow
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {workflowSteps.map((step, idx) => (
              <Link
                key={step.num}
                to={step.link}
                className="group p-3 rounded-lg bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-200 transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-200 group-hover:bg-purple-600 group-hover:text-white text-slate-700 text-[11px] font-bold flex items-center justify-center transition-colors">
                    {step.num}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition-colors" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-900 transition-colors">
                    {step.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {step.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Real Statistics Grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Platform Statistics (Live Backend Metrics)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {statCards.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-slate-500 leading-tight">
                    {c.label}
                  </span>
                  <div className={`p-1.5 rounded-md ${c.color} border`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {c.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workflow Status per Series */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Series Processing Progress</h2>
            <p className="text-xs text-slate-500">Live breakdown of parsing, validation and editorial state by series</p>
          </div>
          <Link
            to="/shows"
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            Manage Episodes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {seriesWorkflow.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs">
            No registered microdrama series found. Click "Upload Screenplays" to add your first dataset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-2.5 px-3">Series Title</th>
                  <th className="py-2.5 px-3">Total Episodes</th>
                  <th className="py-2.5 px-3">Parsed</th>
                  <th className="py-2.5 px-3">Failures</th>
                  <th className="py-2.5 px-3">Discovered Promos</th>
                  <th className="py-2.5 px-3">Valid Promos</th>
                  <th className="py-2.5 px-3">Awaiting Review</th>
                  <th className="py-2.5 px-3">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {seriesWorkflow.map((sw) => (
                  <tr key={sw.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {sw.title} <span className="text-[10px] text-slate-400 font-normal">({sw.language})</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{sw.totalEpisodes}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {sw.parsedCount}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {sw.failedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          {sw.failedCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{sw.discoveredPromos}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {sw.validCount}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {sw.pendingCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {sw.pendingCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        {sw.approvedCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Discovered Candidates & Recent Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Discovered Candidates */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Latest Discovered Promos
            </h3>
            <Link to="/promos" className="text-xs font-semibold text-purple-600 hover:text-purple-700">
              View All ({stats.validPromos + stats.failedEpisodes})
            </Link>
          </div>

          {recentCandidates.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No promo candidates discovered yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentCandidates.map((promo) => (
                <div key={promo.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{promo.promo_identifier}</span>
                      <span className="text-slate-400">• Ep {promo.primary_episode_number}</span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-semibold ${
                        promo.validation_status === 'valid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : promo.validation_status === 'warning'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {promo.validation_status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">{promo.hook}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-800">{promo.overall_score.toFixed(1)}/100</span>
                    <Link
                      to={`/review?id=${promo.id}`}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-xs font-semibold transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Editorial Decisions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Recent Editorial Decisions
            </h3>
            <Link to="/review" className="text-xs font-semibold text-purple-600 hover:text-purple-700">
              Editorial Desk
            </Link>
          </div>

          {recentDecisions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No editorial decisions made yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentDecisions.map((promo) => (
                <div key={promo.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{promo.promo_identifier}</span>
                      <span className="text-slate-400">• Ep {promo.primary_episode_number}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">{promo.cliffhanger}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      promo.approval_status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {promo.approval_status.toUpperCase()}
                    </span>
                    <Link
                      to={`/review?id=${promo.id}`}
                      className="px-2 py-1 text-slate-500 hover:text-slate-900 font-medium"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
