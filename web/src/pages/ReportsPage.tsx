

import { FileText, Download, Calendar, BarChart3, Users, MapPin } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

const REPORTS = [
  { id: 'REP-001', name: 'Monthly Attendance Summary - July 2026', type: 'Attendance', format: 'PDF', size: '2.4 MB', date: '01 Aug 2026' },
  { id: 'REP-002', name: 'Wage & Payroll Statement - July 2026', type: 'Payroll', format: 'XLSX', size: '1.1 MB', date: '01 Aug 2026' },
  { id: 'REP-003', name: 'Site-wise Expense Report - Q2 2026', type: 'Expenses', format: 'PDF', size: '5.8 MB', date: '15 Jul 2026' },
  { id: 'REP-004', name: 'Worker Activity & Performance Logs', type: 'Activity', format: 'CSV', size: '840 KB', date: '10 Jul 2026' },
  { id: 'REP-005', name: 'Monthly Attendance Summary - June 2026', type: 'Attendance', format: 'PDF', size: '2.3 MB', date: '01 Jul 2026' },
];

export function ReportsPage() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // Helper for quick action cards
  const renderQuickActionCard = (r: any) => {
    const Icon = r.icon;
    return (
      <div key={r.title} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px', background: `${r.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
        }}>
          <Icon size={20} color={r.color} />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>{r.title}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '18px', marginBottom: '16px' }}>{r.desc}</p>
        <button style={{
          marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'var(--primary-muted)', color: 'var(--primary)', border: 'none',
          borderRadius: '10px', padding: '10px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
        }}>
          Generate Report
        </button>
      </div>
    );
  };

  // Helper for download table rows
  const renderTableBody = () => (
    <tbody>
      {REPORTS.map((r, i) => (
        <tr key={r.id} style={{
          borderBottom: i < REPORTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <td style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={16} color="var(--primary)" />
              <span style={{ fontSize: '14px', fontWeight: '600' }}>{r.name}</span>
            </div>
          </td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{r.type}</td>
          <td style={{ padding: '14px 16px' }}>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800',
              background: r.format === 'PDF' ? 'rgba(239,68,68,0.15)' : r.format === 'XLSX' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
              color: r.format === 'PDF' ? '#EF4444' : r.format === 'XLSX' ? '#22C55E' : '#3B82F6',
            }}>{r.format}</span>
          </td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{r.size}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{r.date}</td>
          <td style={{ padding: '14px 16px' }}>
            <button style={{
              padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-muted)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} title="Download File">
              <Download size={14} />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  );

  const reportActions = [
    { title: 'Attendance Report', desc: 'Generate overall or site-specific attendance logs', icon: Calendar, color: '#3B82F6' },
    { title: 'Payroll Statement', desc: 'Summarize worker wages, advances and net pay', icon: BarChart3, color: '#22C55E' },
    { title: 'Worker Directory', desc: 'Export full list of registered workers and metadata', icon: Users, color: '#A855F7' },
    { title: 'Site Productivity', desc: 'Analyze project timelines, delays and efficiency', icon: MapPin, color: '#F97316' },
  ];

  // ─── MOBILE LAYOUT ───
  const renderMobile = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '2px' }}>Reports & Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Generate and download workforce, attendance, and expense reports</p>
      </div>

      {/* Grid: 1 Column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {reportActions.map(renderQuickActionCard)}
      </div>

      <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginTop: '8px' }}>Recent Downloads</h2>

      {/* Downloads Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {REPORTS.map(r => (
          <div key={r.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <FileText size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{r.name}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800',
                  background: r.format === 'PDF' ? 'rgba(239,68,68,0.12)' : r.format === 'XLSX' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                  color: r.format === 'PDF' ? '#EF4444' : r.format === 'XLSX' ? '#22C55E' : '#3B82F6',
                }}>{r.format}</span>
                <span>{r.size}</span>
                <span>•</span>
                <span>{r.date}</span>
              </div>
              <button style={{
                padding: '8px 14px', borderRadius: '8px', background: 'var(--primary-muted)',
                color: 'var(--primary)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600'
              }}>
                <Download size={12} /> Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── TABLET LAYOUT ───
  const renderTablet = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Reports & Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Generate and download workforce, attendance, and expense reports</p>
      </div>

      {/* Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {reportActions.map(renderQuickActionCard)}
      </div>

      <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginTop: '8px' }}>Recent Generated Downloads</h2>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Report Name', 'Type', 'Format', 'Size', 'Generated Date', 'Download'].map(h => (
                <th key={h} style={{
                  padding: '12px 14px', textAlign: 'left',
                  fontSize: '11px', fontWeight: '600',
                  color: 'var(--text-subtle)', textTransform: 'uppercase',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          {renderTableBody()}
        </table>
      </div>
    </div>
  );

  // ─── DESKTOP LAYOUT ───
  const renderDesktop = () => (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Generate and download workforce, attendance, and expense reports</p>
        </div>
      </div>

      {/* Grid: 4 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        {reportActions.map(renderQuickActionCard)}
      </div>

      <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '16px' }}>Recent Generated Downloads</h2>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Report Name', 'Type', 'Format', 'Size', 'Generated Date', 'Download'].map(h => (
                <th key={h} style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontSize: '12px', fontWeight: '600',
                  color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          {renderTableBody()}
        </table>
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
