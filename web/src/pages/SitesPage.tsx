

import { MapPin, Users, AlertTriangle, CheckCircle2, Play, Plus, Search, Filter } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

const SITES = [
  { id: '1', name: 'Site Alpha (Metropolis Towers)', address: 'Sector 62, Noida', workers: 18, status: 'Active', start: '01 Mar 2026', end: '15 Dec 2026', budget: '₹12.5 L', progress: 45 },
  { id: '2', name: 'Site Beta (Greenwood Residency)', address: 'Indiranagar, Bengaluru', workers: 14, status: 'Active', start: '10 Apr 2026', end: '30 Jan 2027', budget: '₹8.2 L', progress: 30 },
  { id: '3', name: 'Site Gamma (Regency Plaza)', address: 'Andheri West, Mumbai', workers: 8, status: 'Active', start: '15 Jan 2026', end: '20 Oct 2026', budget: '₹22.0 L', progress: 75 },
  { id: '4', name: 'Site Delta (Riverfront Mall)', address: 'Gomti Nagar, Lucknow', workers: 0, status: 'On Hold', start: '01 Feb 2026', end: '30 Nov 2026', budget: '₹15.0 L', progress: 15 },
  { id: '5', name: 'Site Epsilon (Highway Overpass)', address: 'NH-8, Gurugram', workers: 10, status: 'Delayed', start: '01 Dec 2025', end: '30 Aug 2026', budget: '₹35.0 L', progress: 80 },
  { id: '6', name: 'Site Zeta (Corporate Park)', address: 'Salt Lake, Kolkata', workers: 0, status: 'Completed', start: '01 Sep 2025', end: '30 May 2026', budget: '₹6.8 L', progress: 100 },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: any }> = {
  Active: { label: 'Active', bg: 'rgba(34,197,94,0.15)', color: '#22C55E', icon: Play },
  'On Hold': { label: 'On Hold', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', icon: AlertTriangle },
  Delayed: { label: 'Delayed', bg: 'rgba(239,68,68,0.15)', color: '#EF4444', icon: AlertTriangle },
  Completed: { label: 'Completed', bg: 'rgba(59,130,246,0.15)', color: '#3B82F6', icon: CheckCircle2 },
};

export function SitesPage() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // Helper to render site card content
  const renderCard = (site: any) => {
    const config = STATUS_CONFIG[site.status];
    const StatusIcon = config.icon;
    return (
      <div key={site.id} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
        display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{
            padding: '10px', borderRadius: '12px', background: `${config.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MapPin size={20} color={config.color} />
          </div>
          <span style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
            background: config.bg, color: config.color, display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <StatusIcon size={12} />
            {config.label}
          </span>
        </div>

        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>{site.name}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{site.address}</p>

        {/* Progress bar */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>Completion Progress</span>
            <span style={{ fontWeight: '700', color: config.color }}>{site.progress}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${site.progress}%`, background: config.color, borderRadius: '3px' }} />
          </div>
        </div>

        {/* Info badges grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Workers</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <Users size={14} color="var(--primary)" />
              {site.workers} Assigned
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Budget</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', marginTop: '2px' }}>
              {site.budget}
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
          <button style={{
            flex: 1, padding: '10px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
            background: 'var(--primary-muted)', color: 'var(--primary)', border: 'none', cursor: 'pointer'
          }}>Workforce</button>
          <button style={{
            flex: 1, padding: '10px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer'
          }}>Settings</button>
        </div>
      </div>
    );
  };

  // ─── MOBILE LAYOUT ───
  const renderMobile = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '2px' }}>Sites & Projects</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Manage construction sites and project progress</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '12px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
        }}>
          <Plus size={16} /> New Site
        </button>
      </div>

      {/* Stats - 2x2 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[
          { label: 'Total Projects', value: SITES.length, color: '#3B82F6' },
          { label: 'Active Sites', value: SITES.filter(s => s.status === 'Active').length, color: '#22C55E' },
          { label: 'Delayed / Hold', value: SITES.filter(s => s.status === 'Delayed' || s.status === 'On Hold').length, color: '#EF4444' },
          { label: 'Completed', value: SITES.filter(s => s.status === 'Completed').length, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '10px 14px',
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input type="text" placeholder="Search sites..." style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '13px',
          }} />
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '10px 14px',
          color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
        }}>
          <Filter size={14} /> Filter
        </button>
      </div>

      {/* Grid: 1 Column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {SITES.map(renderCard)}
      </div>
    </div>
  );

  // ─── TABLET LAYOUT ───
  const renderTablet = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Sites & Projects</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Manage construction sites and project progress</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '10px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
        }}>
          <Plus size={16} /> New Site
        </button>
      </div>

      {/* Stats - 4 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total Projects', value: SITES.length, color: '#3B82F6' },
          { label: 'Active Sites', value: SITES.filter(s => s.status === 'Active').length, color: '#22C55E' },
          { label: 'Delayed / Hold', value: SITES.filter(s => s.status === 'Delayed' || s.status === 'On Hold').length, color: '#EF4444' },
          { label: 'Completed', value: SITES.filter(s => s.status === 'Completed').length, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Search sites by name or location..." style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '14px',
          }} />
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
          color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer',
        }}>
          <Filter size={16} /> Filter
        </button>
      </div>

      {/* Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {SITES.map(renderCard)}
      </div>
    </div>
  );

  // ─── DESKTOP LAYOUT ───
  const renderDesktop = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Sites & Projects</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Manage construction sites and project progress</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '10px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
        }}>
          <Plus size={16} /> New Site
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Projects', value: SITES.length, color: '#3B82F6' },
          { label: 'Active Sites', value: SITES.filter(s => s.status === 'Active').length, color: '#22C55E' },
          { label: 'Delayed / Hold', value: SITES.filter(s => s.status === 'Delayed' || s.status === 'On Hold').length, color: '#EF4444' },
          { label: 'Completed', value: SITES.filter(s => s.status === 'Completed').length, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: '140px', background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: '240px', display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Search sites by name or location..." style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '14px',
          }} />
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
          color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer',
        }}>
          <Filter size={16} /> Filter
        </button>
      </div>

      {/* Grid: 3 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        {SITES.map(renderCard)}
      </div>
    </div>
  );

  return (
    <div>
      {isMobile && renderMobile()}
      {isTablet && renderTablet()}
      {isDesktop && renderDesktop()}
    </div>
  );
}
