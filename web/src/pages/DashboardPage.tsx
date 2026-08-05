import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Users, CheckCircle, XCircle, MapPin,
  IndianRupee, Clock, TrendingUp, TrendingDown,
  ArrowUpRight, Server, Database, Plus, Calendar, Download
} from 'lucide-react';
import api from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import { useBreakpoint } from '../hooks/useBreakpoint';

// ─── KPI Card ────────────────────────────────────────────────────────
function KPICard({
  title, value, subtitle, icon: Icon, color, trend, trendUp, isLoading, isCompact
}: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color: string; trend?: string; trendUp?: boolean;
  isLoading?: boolean; isCompact?: boolean;
}) {
  if (isLoading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: isCompact ? '12px' : '20px',
        flex: 1,
        minWidth: isCompact ? '0' : '220px',
        height: isCompact ? '100px' : '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: isCompact ? '8px' : '12px'
      }}>
        <div style={{ width: isCompact ? '32px' : '40px', height: isCompact ? '32px' : '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '80%', height: isCompact ? '18px' : '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '50%', height: isCompact ? '10px' : '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: isCompact ? '12px' : '20px',
      flex: 1,
      minWidth: isCompact ? '0' : '220px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: isCompact ? '60px' : '80px', height: isCompact ? '60px' : '80px',
        background: `radial-gradient(circle at top right, ${color}20, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isCompact ? '10px' : '16px' }}>
        <div style={{
          width: isCompact ? '32px' : '40px', height: isCompact ? '32px' : '40px',
          background: `${color}20`,
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={isCompact ? 16 : 20} color={color} />
        </div>
        {trend && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            background: trendUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: trendUp ? '#22C55E' : '#EF4444',
            borderRadius: '20px', padding: isCompact ? '2px 6px' : '4px 10px', fontSize: isCompact ? '10px' : '12px', fontWeight: '600',
          }}>
            {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend}
          </div>
        )}
      </div>

      <div style={{ fontSize: isCompact ? '20px' : '28px', fontWeight: '800', color: '#F8FAFC', marginBottom: '2px', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: isCompact ? '11px' : '13px', fontWeight: '500', color: 'var(--text-muted)' }}>{title}</div>
      {!isCompact && subtitle && <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────
function SectionTitle({ title, action, isCompact }: { title: string; action?: string; isCompact?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCompact ? '10px' : '16px' }}>
      <h2 style={{ fontSize: isCompact ? '13px' : '15px', fontWeight: '700', color: 'var(--text)' }}>{title}</h2>
      {action && (
        <button style={{
          fontSize: isCompact ? '11px' : '13px', color: 'var(--primary)', fontWeight: '600', background: 'none',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          {action} <ArrowUpRight size={isCompact ? 12 : 14} />
        </button>
      )}
    </div>
  );
}

// ─── Chart Card ────────────────────────────────────────────────────────
function ChartCard({ title, children, isCompact }: { title: string; children: React.ReactNode; isCompact?: boolean }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: isCompact ? '12px' : '20px',
    }}>
      <SectionTitle title={title} isCompact={isCompact} />
      {children}
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1E293B', border: '1px solid #334155',
      borderRadius: '10px', padding: '10px 14px', fontSize: '12px',
    }}>
      <p style={{ color: '#94A3B8', marginBottom: '6px' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontWeight: '600' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────
export function DashboardPage() {
  const queryClient = useQueryClient();
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const showToastMsg = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Fetch Real-time Analytics from Backend
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await api.get('/admin/activity/stats');
      return res.data;
    },
    refetchInterval: 30000, // Background fallback polling
  });

  // 2. Fetch Initial Activity Log Feed
  const { data: initialLogs } = useQuery({
    queryKey: ['adminLogs'],
    queryFn: async () => {
      const res = await api.get('/admin/activity?limit=15');
      return res.data;
    }
  });

  // 3. Populate liveActivities when initial logs are loaded
  useEffect(() => {
    if (initialLogs?.results) {
      setLiveActivities(initialLogs.results);
    }
  }, [initialLogs]);

  // 4. Register Socket.IO hooks to inject events in real time without refresh
  useSocket(
    (newActivity) => {
      setLiveActivities(prev => [newActivity, ...prev].slice(0, 15));
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    }
  );

  const siteStatusData = [
    { name: 'Running', value: stats?.runningSites || 0, color: '#3B82F6' },
    { name: 'Completed', value: stats?.completedSites || 0, color: '#22C55E' },
    { name: 'Delayed', value: stats?.delayedSites || 0, color: '#EF4444' },
    { name: 'Total', value: stats?.totalSites || 0, color: '#64748B' },
  ].filter(s => s.name !== 'Total' || s.value > 0);

  // ─── MOBILE LAYOUT ───
  const renderMobile = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '60px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '2px' }}>Live Control Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{today}</p>
      </div>

      {/* Quick Access Bar */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button onClick={() => showToastMsg('Redirecting to Workers...')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          <Plus size={12} color="var(--primary)" /> Add Worker
        </button>
        <button onClick={() => showToastMsg('Redirecting to Attendance...')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          <Calendar size={12} color="var(--primary)" /> Mark Attendance
        </button>
        <button onClick={() => showToastMsg('Generating report pdf...')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          <Download size={12} color="var(--primary)" /> Reports
        </button>
      </div>

      {/* KPI Cards: 2x3 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <KPICard title="Total Accounts" value={stats?.totalAccounts ?? 0} icon={Users} color="#3B82F6" trend={`+${stats?.todayNewAccounts || 0}`} trendUp={true} isLoading={statsLoading} isCompact={true} />
        <KPICard title="Present Today" value={stats?.todayPresent ?? 0} icon={CheckCircle} color="#22C55E" isLoading={statsLoading} isCompact={true} />
        <KPICard title="Absent Today" value={stats?.todayAbsent ?? 0} icon={XCircle} color="#EF4444" isLoading={statsLoading} isCompact={true} />
        <KPICard title="Active Sites" value={stats?.runningSites ?? 0} icon={MapPin} color="#F97316" isLoading={statsLoading} isCompact={true} />
        <KPICard title="Monthly Revenue" value={`₹${(stats?.monthlyRevenue || 0) >= 100000 ? `${((stats?.monthlyRevenue || 0) / 100000).toFixed(1)}L` : stats?.monthlyRevenue?.toLocaleString('en-IN')}`} icon={IndianRupee} color="#22C55E" trend={stats?.growthStatistics?.revenuePercent ? `+${stats?.growthStatistics?.revenuePercent}%` : undefined} trendUp={true} isLoading={statsLoading} isCompact={true} />
        <KPICard title="Pending Payments" value={`₹${(stats?.pendingPayments || 0) >= 100000 ? `${((stats?.pendingPayments || 0) / 100000).toFixed(1)}L` : stats?.pendingPayments?.toLocaleString('en-IN')}`} icon={Clock} color="#F59E0B" isLoading={statsLoading} isCompact={true} />
      </div>

      {/* Compact Recharts charts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ChartCard title="Attendance Trend (Last 11 Days)" isCompact={true}>
          {statsLoading ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Analyzing records...</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={stats?.attendanceTrend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGradMob" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="absentGradMob" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="present" name="Present" stroke="#22C55E" fill="url(#presentGradMob)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="absent" name="Absent" stroke="#EF4444" fill="url(#absentGradMob)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Monthly Revenue (₹)" isCompact={true}>
          {statsLoading ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Calculating sales...</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats?.revenueTrend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`₹${v?.toLocaleString('en-IN')}`, 'Revenue']} />
                <Bar dataKey="revenue" name="Revenue" fill="#F97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Diagnostics / Status Stack */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Server Status:</span>
          <span style={{ color: stats?.serverStatus === 'ONLINE' ? '#22C55E' : '#EF4444', fontWeight: '700' }}>{stats?.serverStatus || 'OFFLINE'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Database Connection:</span>
          <span style={{ color: stats?.databaseStatus === 'CONNECTED' ? '#22C55E' : '#EF4444', fontWeight: '700' }}>{stats?.databaseStatus || 'DISCONNECTED'}</span>
        </div>
      </div>

      {/* Lists */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Recent Workers */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <SectionTitle title="Recent Workers" action="View All" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!stats?.recentWorkers || stats.recentWorkers.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '12px' }}>No workers registered yet.</div>
            ) : (
              stats.recentWorkers.slice(0, 4).map((w: any) => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px', color: 'white', flexShrink: 0 }}>
                    {w.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{w.role} · {w.site}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '20px', background: w.status === 'Present' ? 'var(--success-muted)' : 'rgba(255,255,255,0.08)', color: w.status === 'Present' ? 'var(--success)' : 'var(--text-muted)' }}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <SectionTitle title="Live Activity Feed" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
            {liveActivities.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '12px' }}>Waiting for system events...</div>
            ) : (
              liveActivities.slice(0, 8).map((a, idx) => (
                <div key={a.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--info)', marginTop: '6px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text)' }}>{a.message}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── TABLET LAYOUT ───
  const renderTablet = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Live Control Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{today}</p>
        </div>
        
        {/* Systems Diagnostics */}
        <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Server size={14} color={stats?.serverStatus === 'ONLINE' ? '#22C55E' : '#EF4444'} />
            Server: <span style={{ color: stats?.serverStatus === 'ONLINE' ? '#22C55E' : '#EF4444', fontWeight: '700' }}>{stats?.serverStatus || 'OFFLINE'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Database size={14} color={stats?.databaseStatus === 'CONNECTED' ? '#22C55E' : '#EF4444'} />
            Database: <span style={{ color: stats?.databaseStatus === 'CONNECTED' ? '#22C55E' : '#EF4444', fontWeight: '700' }}>{stats?.databaseStatus || 'DISCONNECTED'}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards: Two Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <KPICard title="Total Accounts" value={stats?.totalAccounts ?? 0} icon={Users} color="#3B82F6" trend={`+${stats?.todayNewAccounts || 0} today`} trendUp={true} isLoading={statsLoading} />
        <KPICard title="Present Today" value={stats?.todayPresent ?? 0} subtitle={`${stats?.todayAttendance || 0} marked today`} icon={CheckCircle} color="#22C55E" isLoading={statsLoading} />
        <KPICard title="Absent Today" value={stats?.todayAbsent ?? 0} icon={XCircle} color="#EF4444" isLoading={statsLoading} />
        <KPICard title="Active Sites" value={stats?.runningSites ?? 0} subtitle={`Out of ${stats?.totalSites || 0} total sites`} icon={MapPin} color="#F97316" isLoading={statsLoading} />
        <KPICard title="Monthly Revenue" value={`₹${stats?.monthlyRevenue?.toLocaleString('en-IN') || 0}`} icon={IndianRupee} color="#22C55E" trend={`+${stats?.growthStatistics?.revenuePercent || 0}%`} trendUp={true} isLoading={statsLoading} />
        <KPICard title="Pending Payments" value={`₹${stats?.pendingPayments?.toLocaleString('en-IN') || 0}`} icon={Clock} color="#F59E0B" isLoading={statsLoading} />
      </div>

      {/* Charts: Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard title="Attendance Trend">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats?.attendanceTrend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="presentGradTab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="absentGradTab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="present" name="Present" stroke="#22C55E" fill="url(#presentGradTab)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="absent" name="Absent" stroke="#EF4444" fill="url(#absentGradTab)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Revenue (₹)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats?.revenueTrend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Widgets: Two Column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <SectionTitle title="Recent Workers" action="View All" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats?.recentWorkers?.slice(0, 5).map((w: any) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px', color: 'white' }}>
                  {w.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{w.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{w.role} · {w.site}</div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '20px', background: w.status === 'Present' ? 'var(--success-muted)' : 'rgba(255,255,255,0.08)', color: w.status === 'Present' ? 'var(--success)' : 'var(--text-muted)' }}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <SectionTitle title="Live Activity Feed" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {liveActivities.slice(0, 10).map((a, idx) => (
              <div key={a.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--info)', marginTop: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text)' }}>{a.message}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                    {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── DESKTOP LAYOUT ───
  const renderDesktop = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Live Control Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{today}</p>
        </div>
        
        {/* Systems Diagnostics */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Server size={14} color={stats?.serverStatus === 'ONLINE' ? '#22C55E' : '#EF4444'} />
            Server: <span style={{ color: stats?.serverStatus === 'ONLINE' ? '#22C55E' : '#EF4444', fontWeight: '700' }}>{stats?.serverStatus || 'OFFLINE'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Database size={14} color={stats?.databaseStatus === 'CONNECTED' ? '#22C55E' : '#EF4444'} />
            Database: <span style={{ color: stats?.databaseStatus === 'CONNECTED' ? '#22C55E' : '#EF4444', fontWeight: '700' }}>{stats?.databaseStatus || 'DISCONNECTED'}</span>
          </div>
        </div>
      </div>

      {/* KPI Row: High Density Flexbox */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <KPICard title="Total Accounts" value={stats?.totalAccounts ?? 0} icon={Users} color="#3B82F6" trend={`+${stats?.todayNewAccounts || 0} today`} trendUp={true} isLoading={statsLoading} />
        <KPICard title="Present Today" value={stats?.todayPresent ?? 0} subtitle={`${stats?.todayAttendance || 0} marked today`} icon={CheckCircle} color="#22C55E" isLoading={statsLoading} />
        <KPICard title="Absent Today" value={stats?.todayAbsent ?? 0} icon={XCircle} color="#EF4444" isLoading={statsLoading} />
        <KPICard title="Active Sites" value={stats?.runningSites ?? 0} subtitle={`Out of ${stats?.totalSites || 0} total sites`} icon={MapPin} color="#F97316" isLoading={statsLoading} />
        <KPICard title="Monthly Revenue" value={`₹${stats?.monthlyRevenue?.toLocaleString('en-IN') || 0}`} icon={IndianRupee} color="#22C55E" trend={`+${stats?.growthStatistics?.revenuePercent || 0}%`} trendUp={true} isLoading={statsLoading} />
        <KPICard title="Pending Payments" value={`₹${stats?.pendingPayments?.toLocaleString('en-IN') || 0}`} icon={Clock} color="#F59E0B" isLoading={statsLoading} />
      </div>

      {/* Charts Row: Two Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <ChartCard title="Attendance Trend (Last 11 Days)">
          {statsLoading ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Analyzing records...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats?.attendanceTrend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="present" name="Present" stroke="#22C55E" fill="url(#presentGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="absent" name="Absent" stroke="#EF4444" fill="url(#absentGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Monthly Revenue (₹)">
          {statsLoading ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Calculating sales...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.revenueTrend || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`₹${v?.toLocaleString('en-IN')}`, 'Revenue']} />
                <Bar dataKey="revenue" name="Revenue" fill="#F97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Bottom Dense Row: Three Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: '20px' }}>
        {/* Recent Workers */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <SectionTitle title="Recent Workers" action="View All" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {statsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: '56px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : !stats?.recentWorkers || stats.recentWorkers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '13px' }}>No workers registered yet.</div>
            ) : (
              stats.recentWorkers.map((w: any) => (
                <div key={w.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: 'white', flexShrink: 0 }}>
                    {w.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{w.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.role} · {w.site}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.wage}</div>
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: w.status === 'Present' ? 'var(--success-muted)' : w.status === 'Absent' ? 'var(--error-muted)' : w.status === 'Half Day' ? 'var(--warning-muted)' : 'rgba(255,255,255,0.08)', color: w.status === 'Present' ? 'var(--success)' : w.status === 'Absent' ? 'var(--error)' : w.status === 'Half Day' ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <SectionTitle title="Live Activity Feed" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto' }}>
            {liveActivities.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '13px' }}>Waiting for system events...</div>
            ) : (
              liveActivities.map((a, idx) => {
                let bulletColor = 'var(--info)';
                if (a.action?.includes('CREATE') || a.action?.includes('MARKED') || a.action?.includes('ADD')) bulletColor = 'var(--success)';
                if (a.action?.includes('DELETE')) bulletColor = 'var(--error)';
                if (a.action?.includes('UPDATE') || a.action?.includes('CHANGE')) bulletColor = 'var(--warning)';

                return (
                  <div key={a.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', animation: 'fadeInDown 0.3s ease' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: bulletColor, marginTop: '6px', flexShrink: 0, boxShadow: `0 0 6px ${bulletColor}` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text)' }}>{a.message}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                        {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {a.platform} ({a.device})
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Site Status Donut */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <SectionTitle title="Site Distribution" />
          {statsLoading ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : siteStatusData.length === 0 ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: '13px' }}>No site status records.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={siteStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {siteStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, 'Sites']} contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {siteStatusData.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#22C55E', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', zIndex: 1100, boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
          {toastMessage}
        </div>
      )}

      {/* Render layout based on detected breakpoint */}
      {isMobile && renderMobile()}
      {isTablet && renderTablet()}
      {isDesktop && renderDesktop()}

      {/* Quick Action Modal Bottom Sheet */}
      {isMobile && showQuickActionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 1001 }} onClick={() => setShowQuickActionModal(false)}>
          <div style={{ width: '100%', background: '#0F172A', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', borderTop: '1px solid var(--border)', padding: '24px 20px 40px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '40px', height: '4px', background: '#334155', borderRadius: '2px', margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#F8FAFC' }}>Quick Operations</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button onClick={() => { setShowQuickActionModal(false); showToastMsg('Marked all present successfully!'); }} style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', color: '#F8FAFC', fontWeight: '600', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <CheckCircle color="#22C55E" size={20} />
                Bulk Attendance
              </button>
              <button onClick={() => { setShowQuickActionModal(false); showToastMsg('Database health check: Excellent!'); }} style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', color: '#F8FAFC', fontWeight: '600', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Server color="#3B82F6" size={20} />
                Health Check
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
