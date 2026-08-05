import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Users, CheckCircle, XCircle, MapPin,
  IndianRupee, Clock, TrendingUp, TrendingDown,
  ArrowUpRight, Server, Database, Activity
} from 'lucide-react';
import api from '../utils/api';
import { useSocket } from '../hooks/useSocket';

// ─── KPI Card ────────────────────────────────────────────────────────
function KPICard({
  title, value, subtitle, icon: Icon, color, trend, trendUp, isLoading
}: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color: string; trend?: string; trendUp?: boolean;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        flex: 1,
        minWidth: '220px',
        height: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '80%', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '50%', height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      flex: 1,
      minWidth: '220px',
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
        width: '80px', height: '80px',
        background: `radial-gradient(circle at top right, ${color}20, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px',
          background: `${color}20`,
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={color} />
        </div>
        {trend && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: trendUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: trendUp ? '#22C55E' : '#EF4444',
            borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: '600',
          }}>
            {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend}
          </div>
        )}
      </div>

      <div style={{ fontSize: '28px', fontWeight: '800', color: '#F8FAFC', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────
function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>{title}</h2>
      {action && (
        <button style={{
          fontSize: '13px', color: 'var(--primary)', fontWeight: '600', background: 'none',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          {action} <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Chart Card ────────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
    }}>
      <SectionTitle title={title} />
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

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

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
      // Prepend event instantly
      setLiveActivities(prev => [newActivity, ...prev].slice(0, 15));
      // Invalidate counter states immediately
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    () => {
      // Invalidate counter states on generic notify events
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    }
  );

  // Dynamic Pie status configuration mapping
  const siteStatusData = [
    { name: 'Running', value: stats?.runningSites || 0, color: '#3B82F6' },
    { name: 'Completed', value: stats?.completedSites || 0, color: '#22C55E' },
    { name: 'Delayed', value: stats?.delayedSites || 0, color: '#EF4444' },
    { name: 'Total', value: stats?.totalSites || 0, color: '#64748B' },
  ].filter(s => s.name !== 'Total' || s.value > 0);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
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

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <KPICard title="Total Accounts" value={stats?.totalAccounts ?? 0} icon={Users} color="#3B82F6" trend={`+${stats?.todayNewAccounts || 0} today`} trendUp={true} isLoading={statsLoading} />
        <KPICard title="Present Today" value={stats?.todayPresent ?? 0} subtitle={`${stats?.todayAttendance || 0} marked today`} icon={CheckCircle} color="#22C55E" isLoading={statsLoading} />
        <KPICard title="Absent Today" value={stats?.todayAbsent ?? 0} icon={XCircle} color="#EF4444" isLoading={statsLoading} />
        <KPICard title="Active Sites" value={stats?.runningSites ?? 0} subtitle={`Out of ${stats?.totalSites || 0} total sites`} icon={MapPin} color="#F97316" isLoading={statsLoading} />
        <KPICard title="Monthly Revenue" value={`₹${stats?.monthlyRevenue?.toLocaleString('en-IN') || 0}`} icon={IndianRupee} color="#22C55E" trend={`+${stats?.growthStatistics?.revenuePercent || 0}%`} trendUp={true} isLoading={statsLoading} />
        <KPICard title="Pending Payments" value={`₹${stats?.pendingPayments?.toLocaleString('en-IN') || 0}`} icon={Clock} color="#F59E0B" isLoading={statsLoading} />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
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

      {/* Bottom Row */}
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
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #F97316, #EA580C)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '700', fontSize: '13px', color: 'white', flexShrink: 0,
                  }}>
                    {w.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{w.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.role} · {w.site}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.wage}</div>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                      background: w.status === 'Present' ? 'var(--success-muted)' : w.status === 'Absent' ? 'var(--error-muted)' : w.status === 'Half Day' ? 'var(--warning-muted)' : 'rgba(255,255,255,0.08)',
                      color: w.status === 'Present' ? 'var(--success)' : w.status === 'Absent' ? 'var(--error)' : w.status === 'Half Day' ? 'var(--warning)' : 'var(--text-muted)',
                    }}>
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
                // Color mapping depending on event action type
                let bulletColor = 'var(--info)';
                if (a.action?.includes('CREATE') || a.action?.includes('MARKED') || a.action?.includes('ADD')) bulletColor = 'var(--success)';
                if (a.action?.includes('DELETE')) bulletColor = 'var(--error)';
                if (a.action?.includes('UPDATE') || a.action?.includes('CHANGE')) bulletColor = 'var(--warning)';

                return (
                  <div key={a.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', animation: 'fadeInDown 0.3s ease' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: bulletColor, marginTop: '6px', flexShrink: 0,
                      boxShadow: `0 0 6px ${bulletColor}`,
                    }} />
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
                  <Pie
                    data={siteStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
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
}
