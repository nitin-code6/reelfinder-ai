import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Clock, 
  UploadCloud, 
  PlayCircle, 
  ArrowRight, 
  Clapperboard,
  RefreshCw,
  Film
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
  });
  const [seriesWorkflow, setSeriesWorkflow] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [showsRes, promosRes] = await Promise.all([
        getShows(),
        getPromos({ limit: 100 })
      ]);
      const shows = showsRes.data || [];
      const promos = promosRes.data || [];

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

          workflowItems.push({
            id: show.id,
            title: show.title,
            language: show.language,
            totalEpisodes: eps.length,
            parsedCount,
            failedCount,
            progressPercent: eps.length > 0 ? Math.round((parsedCount / eps.length) * 100) : 0,
            status: failedCount > 0 ? 'warning' : parsedCount === eps.length && eps.length > 0 ? 'completed' : 'processing',
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

      setStats({
        totalShows: shows.length,
        totalEpisodes: allEpisodes.length,
        parsedEpisodes: parsedEps,
        failedEpisodes: failedEps,
        validPromos: validCandidates,
        pendingApprovals,
        approvedPromos,
      });

      setSeriesWorkflow(workflowItems);

      // Build real activity timeline
      const activities = [];
      if (workflowItems.length > 0) {
        const topShow = workflowItems[0];
        if (topShow.parsedCount > 0) {
          activities.push({
            id: 'act-parse',
            icon: CheckCircle2,
            iconColor: 'text-emerald-600 bg-emerald-50',
            text: `${topShow.parsedCount} episodes parsed for "${topShow.title}"`,
            time: 'Recently'
          });
        }
      }
      if (promos.length > 0) {
        activities.push({
          id: 'act-promos',
          icon: Sparkles,
          iconColor: 'text-teal-600 bg-teal-50',
          text: `${promos.length} promo candidates discovered`,
          time: 'Active'
        });
      }
      const approvedSample = promos.find(p => p.approval_status === 'approved');
      if (approvedSample) {
        activities.push({
          id: 'act-appr',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 bg-emerald-50',
          text: `${approvedSample.promo_identifier} approved for export`,
          time: 'Verified'
        });
      }
      if (allEpisodes.length > 0) {
        activities.push({
          id: 'act-upload',
          icon: UploadCloud,
          iconColor: 'text-sky-600 bg-sky-50',
          text: `Uploaded ${allEpisodes.length} screenplay files to library`,
          time: 'Ready'
        });
      }
      setRecentActivity(activities);

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Hero Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text & CTA */}
          <div className="lg:col-span-5 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] tracking-tight leading-snug">
              Find the Best <br />
              <span className="text-[#0F766E]">Promo Moments</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Discover, evaluate, and rank high-converting promo moments from your microdrama screenplays.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold shadow-sm transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Screenplay</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
              <Link
                to="/promos"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#172B4D] text-xs font-semibold shadow-xs transition-all"
              >
                <PlayCircle className="w-4 h-4 text-[#0F766E]" />
                <span>View Discovered Promos</span>
              </Link>
            </div>
          </div>

          {/* Center Illustration Graphic */}
          <div className="hidden md:flex lg:col-span-3 items-center justify-center">
            <div className="relative w-44 h-40 flex items-center justify-center">
              <div className="absolute inset-0 bg-teal-50 rounded-full blur-xl opacity-70" />
              <div className="relative bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] p-6 rounded-2xl shadow-lg text-white transform -rotate-3 hover:rotate-0 transition-transform">
                <Clapperboard className="w-16 h-16 text-white" />
                <div className="absolute bottom-2 right-2 bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">
                  20-60s
                </div>
              </div>
            </div>
          </div>

          {/* Right "How It Works" Card */}
          <div className="lg:col-span-4 bg-[#F5F7FA] border border-slate-200/80 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B4D]">
              How It Works
            </h3>
            <div className="space-y-2.5">
              {[
                { step: 1, text: 'Upload your screenplays' },
                { step: 2, text: 'Parse scenes and timestamps' },
                { step: 3, text: 'Discover hooks & cliffhangers' },
                { step: 4, text: 'Review and approve candidates' },
                { step: 5, text: 'Export final results' }
              ].map(item => (
                <div key={item.step} className="flex items-center gap-2.5 text-xs text-[#172B4D]">
                  <span className="w-5 h-5 rounded-full bg-[#CCFBF1] text-[#0F766E] font-bold flex items-center justify-center text-[10px] shrink-0">
                    {item.step}
                  </span>
                  <span className="font-medium text-slate-700">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6 Clean Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          {
            label: 'Total Episodes',
            value: stats.totalEpisodes,
            icon: Layers,
            iconColor: 'text-slate-600',
            bgColor: 'bg-slate-100',
          },
          {
            label: 'Parsed Successfully',
            value: stats.parsedEpisodes,
            icon: CheckCircle2,
            iconColor: 'text-[#15803D]',
            bgColor: 'bg-emerald-50',
          },
          {
            label: 'Failed Episodes',
            value: stats.failedEpisodes,
            icon: AlertCircle,
            iconColor: 'text-[#DC2626]',
            bgColor: 'bg-rose-50',
          },
          {
            label: 'Valid Candidates',
            value: stats.validPromos,
            icon: Sparkles,
            iconColor: 'text-[#0F766E]',
            bgColor: 'bg-teal-50',
          },
          {
            label: 'Pending Reviews',
            value: stats.pendingApprovals,
            icon: Clock,
            iconColor: 'text-[#D69E36]',
            bgColor: 'bg-amber-50',
          },
          {
            label: 'Approved Promos',
            value: stats.approvedPromos,
            icon: CheckCircle2,
            iconColor: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#64748B] block truncate">
                  {item.label}
                </span>
                <div className={`w-7 h-7 rounded-lg ${item.bgColor} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#172B4D] tracking-tight">
                {loading ? '--' : item.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Two Panels: Processing Progress by Series & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Processing Progress by Series */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
              <Film className="w-4 h-4 text-[#0F766E]" />
              <span>Processing Progress by Series</span>
            </h2>
            <Link
              to="/shows"
              className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1"
            >
              <span>View Library</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading series...</div>
            ) : seriesWorkflow.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No series registered yet. <Link to="/upload" className="text-[#0F766E] font-bold hover:underline">Upload your first screenplay</Link>.
              </div>
            ) : (
              seriesWorkflow.map(show => (
                <div
                  key={show.id}
                  className="p-3.5 rounded-lg border border-slate-100 bg-[#F5F7FA] hover:bg-slate-100/60 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#172B4D] truncate">{show.title}</span>
                      <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded font-medium">
                        {show.language}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {show.totalEpisodes} Episodes
                    </div>
                  </div>

                  <div className="w-36 sm:w-44 shrink-0 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#172B4D]">
                      <span>{show.parsedCount} / {show.totalEpisodes} Parsed</span>
                      <span className="text-[10px] text-slate-500">{show.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0F766E] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${show.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0">
                    {show.parsedCount === show.totalEpisodes && show.totalEpisodes > 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                    ) : show.failedCount > 0 ? (
                      <AlertCircle className="w-4 h-4 text-[#D69E36]" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Recent Activity */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0F766E]" />
              <span>Recent Activity</span>
            </h2>
            <Link
              to="/promos"
              className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No recent activity. Upload screenplays to begin.
              </div>
            ) : (
              recentActivity.map(act => {
                const Icon = act.icon;
                return (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-[#F5F7FA]"
                  >
                    <div className={`w-7 h-7 rounded-lg ${act.iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#172B4D] truncate">
                        {act.text}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {act.time}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
