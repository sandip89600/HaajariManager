import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, Users, ShieldAlert, Award, Server, Database, Activity,
  MapPin, Cpu, Eye, Calendar, DollarSign, Download, ArrowUpRight,
  Search, RotateCcw, AlertTriangle, Play, Smartphone, CheckCircle, RefreshCw
} from 'lucide-react';
import { api } from '../utils/api';
import { useSocket } from '../hooks/useSocket';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'business' | 'workers' | 'health'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('All');
  const [selectedPlan, setSelectedPlan] = useState('All');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pingStatus, setPingStatus] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const socket = useSocket();

  // 1. Fetch live metrics from backend
  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['adminAnalyticsFull'],
    queryFn: async () => {
      const res = await api.get('/admin/analytics');
      return res.data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds automatically
  });

  // Track real-time live events locally in state
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeBlinks, setRealtimeBlinks] = useState<Record<string, boolean>>({});

  // 2. Real-time updates via Socket.IO
  useEffect(() => {
    if (!analytics) return;
    setLiveLogs(analytics.activityFeed || []);
  }, [analytics]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    if (socket.connected) setSocketConnected(true);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    const handleActivity = (event: any) => {
      // Add socket log to the feed
      const newLog = {
        id: event.id || Math.random().toString(),
        action: event.action || 'ACTIVITY',
        message: event.message || 'Operation logged in mobile application',
        timestamp: new Date().toISOString(),
        userName: event.userName || 'Supervisor',
        userId: event.userId || 'N/A',
        organization: event.organization || 'Client Org',
        ipAddress: event.ipAddress || '127.0.0.1',
        device: event.device || 'Mobile client',
        location: event.location || 'N/A'
      };

      setLiveLogs(prev => [newLog, ...prev].slice(0, 50));

      // Trigger visual highlights (blink cards) depending on event type
      const triggerBlink = (key: string) => {
        setRealtimeBlinks(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setRealtimeBlinks(prev => ({ ...prev, [key]: false }));
        }, 1500);
      };

      // Trigger query cache updates or local state increments
      if (event.action?.includes('REGISTER') || event.action?.includes('SIGNUP')) {
        triggerBlink('users');
        queryClient.invalidateQueries({ queryKey: ['adminAnalyticsFull'] });
      } else if (event.action?.includes('WORKER_ADD') || event.action?.includes('WORKER_CREATE')) {
        triggerBlink('workers');
        queryClient.invalidateQueries({ queryKey: ['adminAnalyticsFull'] });
      } else if (event.action?.includes('ATTENDANCE')) {
        triggerBlink('attendance');
        queryClient.invalidateQueries({ queryKey: ['adminAnalyticsFull'] });
      } else if (event.action?.includes('PAYMENT') || event.action?.includes('SUBSCRIPTION')) {
        triggerBlink('payments');
        queryClient.invalidateQueries({ queryKey: ['adminAnalyticsFull'] });
      }
    };

    socket.on('admin_activity', handleActivity);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('admin_activity', handleActivity);
    };
  }, [socket, queryClient, analytics]);

  // Ping backend to compute response latency
  useEffect(() => {
    const checkPing = async () => {
      const start = Date.now();
      try {
        await api.get('/admin/notifications'); // Light query
        setPingStatus(Date.now() - start);
      } catch {
        setPingStatus(999);
      }
    };
    checkPing();
    const interval = setInterval(checkPing, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter organizations dynamically
  const uniqueOrgs = useMemo(() => {
    if (!analytics?.activityFeed) return ['All'];
    const orgs = new Set<string>();
    analytics.activityFeed.forEach((item: any) => {
      if (item.organization && item.organization !== 'N/A') orgs.add(item.organization);
    });
    return ['All', ...Array.from(orgs)];
  }, [analytics]);

  const filteredLogs = useMemo(() => {
    if (!liveLogs) return [];
    return liveLogs.filter((log: any) => {
      const matchSearch =
        log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchOrg = selectedOrg === 'All' || log.organization === selectedOrg;
      return matchSearch && matchOrg;
    });
  }, [liveLogs, searchQuery, selectedOrg]);

  // Export functions (PDF, Excel, CSV)
  const exportData = (type: 'csv' | 'excel' | 'pdf') => {
    if (!analytics) return;

    if (type === 'csv' || type === 'excel') {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Metric,Value\n";
      Object.entries(analytics.metrics || {}).forEach(([key, val]) => {
        csvContent += `${key},${val}\n`;
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Haajari_Metrics_${Date.now()}.${type === 'csv' ? 'csv' : 'xls'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.print();
    }
    setShowExportMenu(false);
  };

  if (isLoading || !analytics) {
    return (
      <div className="flex flex-col justify-center items-center h-[70vh] space-y-4">
        <RefreshCw className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-slate-400 text-sm">Computing platform statistics from live MongoDB indices...</p>
      </div>
    );
  }

  const { metrics, plans, userGrowthTrend, workersByCategory, revenueGrowth, dbStats, systemHealth, errors, geoAnalytics, deviceAnalytics } = analytics;

  // Pie chart colors
  const COLORS = ['#F97316', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#EF4444', '#06B6D4'];

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Enterprise Analytics & Monitoring Center</h1>
            <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Live Control
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Platform-wide system health, operational activity, telemetry audits, and SaaS MRR growth.</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Force Sync
          </button>
          
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-all shadow-lg shadow-orange-950/20"
          >
            <Download className="w-3.5 h-3.5" /> Export Data
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-10 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 py-2 w-40 animate-in fade-in slide-in-from-top-1 duration-200">
              <button onClick={() => exportData('pdf')} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2">📄 Print PDF</button>
              <button onClick={() => exportData('csv')} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2">📊 Export CSV</button>
              <button onClick={() => exportData('excel')} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2">📉 Export Excel</button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Executive KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {/* Total Users */}
        <div className={`glass-card p-5 rounded-2xl border transition-all duration-500 ${realtimeBlinks.users ? 'border-orange-500 bg-orange-500/10 scale-102 shadow-lg shadow-orange-500/15' : 'border-slate-800/80 bg-slate-900/60'}`}>
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Registered Users</span>
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-450 border border-orange-500/15"><Users className="w-4 h-4" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">{metrics.totalUsers}</h3>
            <span className="text-xs text-orange-450 font-semibold flex items-center gap-0.5 mt-1.5">
              +{metrics.newUsersToday} created today <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Online & Active Users */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active & Online</span>
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/15"><Activity className="w-4 h-4" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
              {metrics.onlineUsers}
              <span className="text-xs font-bold text-slate-500">/ {metrics.activeUsersToday} active today</span>
            </h3>
            <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span> Real-time active supervisors
            </span>
          </div>
        </div>

        {/* Workers Status */}
        <div className={`glass-card p-5 rounded-2xl border transition-all duration-500 ${realtimeBlinks.workers ? 'border-emerald-500 bg-emerald-500/10 scale-102 shadow-lg shadow-emerald-500/15' : 'border-slate-800/80 bg-slate-900/60'}`}>
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Active Workers</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"><Award className="w-4 h-4" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">{metrics.totalWorkers}</h3>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5 mt-1.5">
              +{metrics.newWorkersThisMonth} registered this month <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Today's Attendance Check-in */}
        <div className={`glass-card p-5 rounded-2xl border transition-all duration-500 ${realtimeBlinks.attendance ? 'border-violet-500 bg-violet-500/10 scale-102 shadow-lg shadow-violet-500/15' : 'border-slate-800/80 bg-slate-900/60'}`}>
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Today's Attendance</span>
            <span className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/15"><CheckCircle className="w-4 h-4" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">{metrics.presentToday} present</h3>
            <span className="text-xs text-violet-400 font-semibold flex items-center gap-0.5 mt-1.5">
              {metrics.presentPercent}% Present rate (this month)
            </span>
          </div>
        </div>

        {/* Monthly Recurring Revenue */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Estimated Revenue</span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-450 border border-rose-500/15"><DollarSign className="w-4 h-4" /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">₹{metrics.totalRevenue}</h3>
            <span className="text-xs text-rose-450 font-semibold flex items-center gap-0.5 mt-1.5">
              {metrics.premiumUsers} Enterprise / {metrics.freeUsers} Free orgs
            </span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${activeTab === 'overview' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Database className="w-4 h-4" /> System Overview
        </button>
        <button
          onClick={() => setActiveTab('business')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${activeTab === 'business' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <TrendingUp className="w-4 h-4" /> User & Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('workers')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${activeTab === 'workers' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Users className="w-4 h-4" /> Workers & Operations
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all shrink-0 ${activeTab === 'health' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Server className="w-4 h-4" /> Live Platform Health
        </button>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB A: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Database Collections Auditor */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4 lg:col-span-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-500" /> MongoDB Document Registry
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Real-time counts of Mongoose schemas in active cluster collections</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(dbStats || {}).map(([key, stat]: any) => (
                <div key={key} className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 flex flex-col justify-between">
                  <span className="text-slate-400 text-xs font-bold capitalize">{stat.name}</span>
                  <div className="flex justify-between items-baseline mt-3">
                    <span className="text-2xl font-extrabold text-white">{stat.count}</span>
                    <span className="text-2xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded font-mono">OK</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Geo Analytics */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-500" /> Geographic Footprint
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Active workforce distribution by region</p>
            </div>
            
            <div className="space-y-4">
              {/* State Counts */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Region State</span>
                  <span>Supervisors</span>
                </div>
                {geoAnalytics.usersByState.map((stateInfo: any) => (
                  <div key={stateInfo.state} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{stateInfo.state}</span>
                    <span className="font-bold text-white">{stateInfo.count}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800/80 pt-4">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>GPS Telemetry attendance marked:</span>
                  <span className="font-bold text-white font-mono">{geoAnalytics.gpsAttendanceCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Device & Client Analytics */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-500" /> Device & OS Telemetry
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Active supervisor client configurations</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Android Clients</span>
                <span className="font-bold text-white">{deviceAnalytics.androidUsers}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">iOS Clients</span>
                <span className="font-bold text-white">{deviceAnalytics.iosUsers}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Target App Version</span>
                <span className="font-bold text-orange-450">{deviceAnalytics.appVersion}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Connected Devices Online</span>
                <span className="font-bold text-cyan-400 font-mono">{deviceAnalytics.onlineDevices}</span>
              </div>
            </div>
          </div>

          {/* Error Rate Overview */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4 lg:col-span-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" /> Live Exceptions & Audits
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Exceptions, authorization alerts, and validation warnings in database logs</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-350">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5">API Location</th>
                    <th className="py-2.5">User</th>
                    <th className="py-2.5">Error Context</th>
                    <th className="py-2.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {errors && errors.length > 0 ? (
                    errors.map((err: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="py-2.5 font-mono text-rose-450">{err.apiName}</td>
                        <td className="py-2.5">{err.user}</td>
                        <td className="py-2.5 truncate max-w-xs">{err.message}</td>
                        <td className="py-2.5 text-right font-mono">{new Date(err.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">No active system exceptions recorded today.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: BUSINESS ANALYTICS */}
      {activeTab === 'business' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* User Registrations Trend */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">New Supervisor Registrations</h3>
              <p className="text-slate-550 text-xs mt-0.5">Account completions over the last 7 calendar days</p>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                  <Area type="monotone" dataKey="registrations" stroke="#3B82F6" fillOpacity={1} fill="url(#colorReg)" strokeWidth={3} name="Registrations" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SaaS Plan MRR Revenue Growth */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Monthly Recurring Revenue (MRR) Growth</h3>
              <p className="text-slate-555 text-xs mt-0.5">Calculated subscription rates accumulated over the last 6 months</p>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMRR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                  <Area type="monotone" dataKey="amount" stroke="#f97316" fillOpacity={1} fill="url(#colorMRR)" strokeWidth={3} name="MRR (₹)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subscription Tier Distribution */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Client Subscription Breakdown</h3>
              <p className="text-slate-500 text-xs mt-0.5">Active organization plan metrics</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Free Plan', value: plans.free },
                        { name: 'Basic Plan', value: plans.basic },
                        { name: 'Professional Plan', value: plans.professional },
                        { name: 'Business Plan', value: plans.business }
                      ].filter(p => p.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(plans).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 bg-[#F97316] rounded"></span>
                  <span className="text-slate-400">Free Tier: <strong className="text-white">{plans.free}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 bg-[#3B82F6] rounded"></span>
                  <span className="text-slate-400">Basic Tier: <strong className="text-white">{plans.basic}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 bg-[#8B5CF6] rounded"></span>
                  <span className="text-slate-400">Professional Tier: <strong className="text-white">{plans.professional}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 bg-[#10B981] rounded"></span>
                  <span className="text-slate-400">Business Tier: <strong className="text-white">{plans.business}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Expenditures Summary */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Payroll & Expense Telemetry</h3>
              <p className="text-slate-500 text-xs mt-0.5">SaaS income vs worker payroll totals</p>
            </div>

            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-center bg-slate-950/60 p-4 rounded-xl border border-slate-850/60">
                <div>
                  <span className="text-slate-400 text-xs font-bold block">Total SaaS Billings</span>
                  <span className="text-lg font-extrabold text-orange-450 mt-1 block">₹{metrics.totalRevenue}</span>
                </div>
                <TrendingUp className="w-6 h-6 text-orange-500" />
              </div>

              <div className="flex justify-between items-center bg-slate-950/60 p-4 rounded-xl border border-slate-850/60">
                <div>
                  <span className="text-slate-400 text-xs font-bold block">Active Workers Wages Paid</span>
                  <span className="text-lg font-extrabold text-emerald-450 mt-1 block">₹{metrics.totalPayroll}</span>
                </div>
                <Award className="w-6 h-6 text-emerald-500" />
              </div>

              <div className="flex justify-between items-center bg-slate-950/60 p-4 rounded-xl border border-slate-850/60">
                <div>
                  <span className="text-slate-400 text-xs font-bold block">Operational Site Expenses</span>
                  <span className="text-lg font-extrabold text-violet-450 mt-1 block">₹{metrics.totalExpenses}</span>
                </div>
                <DollarSign className="w-6 h-6 text-violet-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB C: WORKERS & ATTENDANCE */}
      {activeTab === 'workers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Worker Categories Distribution */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Workforce Distribution by Category</h3>
              <p className="text-slate-500 text-xs mt-0.5">Active worker profiles classified by trades</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(workersByCategory || {}).map(([key, val]) => ({ name: key, value: val }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {Object.entries(workersByCategory || {}).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {Object.entries(workersByCategory || {}).map(([key, val]: any, index) => (
                  <div key={key} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-slate-400">{key}</span>
                    </div>
                    <span className="font-bold text-white">{val} workers</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Construction Sites progress */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">Active Projects & Status</h3>
              <p className="text-slate-500 text-xs mt-0.5">Audit counter of active, completed, and delayed worksite telemetry</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 text-center">
                <span className="text-slate-500 text-2xs uppercase font-bold block">Total Workspaces</span>
                <span className="text-3xl font-extrabold text-white mt-1 block">{metrics.totalSites}</span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 text-center">
                <span className="text-slate-500 text-2xs uppercase font-bold block">Active Workspaces</span>
                <span className="text-3xl font-extrabold text-cyan-400 mt-1 block">{metrics.activeSites}</span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 text-center">
                <span className="text-slate-500 text-2xs uppercase font-bold block">Completed Works</span>
                <span className="text-3xl font-extrabold text-emerald-400 mt-1 block">{metrics.completedSites}</span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/60 text-center">
                <span className="text-slate-500 text-2xs uppercase font-bold block">Delayed Projects</span>
                <span className="text-3xl font-extrabold text-rose-450 mt-1 block">{metrics.delayedSites}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB D: PLATFORM HEALTH & REAL-TIME ACTIVITY LOGS */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Hardware & System Telemetry */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-orange-500 animate-spin-slow" /> Host Hardware Telemetry
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">CPU load, free memory limits, and backend latency metrics</p>
            </div>

            <div className="space-y-4 mt-2">
              {/* Memory Indicator */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Node Process Memory Allocation</span>
                  <span className="font-bold text-white">{systemHealth.memoryUsage}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-orange-500 h-1.5" style={{ width: `${systemHealth.memoryUsage}%` }}></div>
                </div>
              </div>

              {/* CPU load */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Host OS CPU Average load</span>
                  <span className="font-bold text-white">{systemHealth.cpuUsage}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-violet-500 h-1.5" style={{ width: `${systemHealth.cpuUsage}%` }}></div>
                </div>
              </div>

              {/* Disk usage */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">MongoDB Persistent Storage Allocation</span>
                  <span className="font-bold text-white">{systemHealth.diskUsage}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5" style={{ width: `${systemHealth.diskUsage}%` }}></div>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">MongoDB Connection status</span>
                  <span className="font-bold text-emerald-400">{systemHealth.databaseStatus}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">API Gateway latency</span>
                  <span className="font-bold text-cyan-400 font-mono">{pingStatus !== null ? `${pingStatus}ms` : `${systemHealth.apiResponseTime}ms`}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Socket.IO gateway clients</span>
                  <span className="font-bold text-white">{systemHealth.connectedClients} connections</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Activity Logs Monitor */}
          <div className="glass-card p-6 rounded-2xl border border-slate-850 bg-slate-900/30 space-y-4 lg:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-500 animate-pulse" /> Real-time Activity Logs Monitor
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Live Socket.IO activity logs from connected supervisor mobile clients</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950/60 border border-slate-800 text-white rounded-lg pl-8 pr-3 py-1.5 text-xs w-full sm:w-44 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="bg-slate-950/60 border border-slate-800 text-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500/50"
                >
                  {uniqueOrgs.map(org => (
                    <option key={org} value={org}>{org}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-96 overflow-y-auto border border-slate-850 bg-slate-950/60 rounded-xl p-4 space-y-3 font-mono text-xs scrollbar-thin">
              {filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map((log: any) => (
                  <div key={log.id} className="border-b border-slate-900 pb-2 flex flex-col sm:flex-row sm:items-start justify-between gap-1 hover:bg-slate-900/20 px-2 py-1 rounded">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className="bg-orange-500/10 text-orange-450 border border-orange-500/10 px-1 rounded text-2xs uppercase font-bold">{log.action || 'ACTIVITY'}</span>
                        <strong className="text-slate-350">{log.userName}</strong>
                        <span className="text-slate-500 font-normal">({log.organization})</span>
                      </div>
                      <p className="text-slate-300 font-semibold">{log.message}</p>
                      <div className="flex flex-wrap items-center gap-x-3 text-slate-500 text-2xs">
                        <span>IP: {log.ipAddress}</span>
                        <span>Device: {log.device}</span>
                        <span>Location: {log.location}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex justify-center items-center text-slate-500">
                  No active logs match filters or search parameters.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
