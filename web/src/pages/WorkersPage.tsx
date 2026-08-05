import { Search, Plus, Filter } from 'lucide-react';

const WORKERS = [
  { id: '1', name: 'Ravi Kumar', role: 'Mason', site: 'Site Alpha', status: 'Present', wage: '₹650/day', phone: '+91 98765 43210' },
  { id: '2', name: 'Suresh Patel', role: 'Carpenter', site: 'Site Beta', status: 'Present', wage: '₹700/day', phone: '+91 87654 32109' },
  { id: '3', name: 'Mohan Das', role: 'Helper', site: 'Site Alpha', status: 'Absent', wage: '₹400/day', phone: '+91 76543 21098' },
  { id: '4', name: 'Ramesh Singh', role: 'Electrician', site: 'Site Gamma', status: 'Present', wage: '₹800/day', phone: '+91 65432 10987' },
  { id: '5', name: 'Ajay Verma', role: 'Plumber', site: 'Site Beta', status: 'Half Day', wage: '₹350/day', phone: '+91 54321 09876' },
  { id: '6', name: 'Deepak Nair', role: 'Welder', site: 'Site Alpha', status: 'Present', wage: '₹750/day', phone: '+91 43210 98765' },
  { id: '7', name: 'Kiran Sharma', role: 'Painter', site: 'Site Gamma', status: 'OT', wage: '₹500/day', phone: '+91 32109 87654' },
  { id: '8', name: 'Vijay Gupta', role: 'Mason', site: 'Site Delta', status: 'Absent', wage: '₹650/day', phone: '+91 21098 76543' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Present: { bg: 'rgba(34,197,94,0.15)', text: '#22C55E' },
  Absent: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
  'Half Day': { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  OT: { bg: 'rgba(168,85,247,0.15)', text: '#A855F7' },
};

export function WorkersPage() {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Workers Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{WORKERS.length} workers registered</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '10px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
        }}>
          <Plus size={16} />
          Add Worker
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: WORKERS.length, color: '#3B82F6' },
          { label: 'Present', value: WORKERS.filter(w => w.status === 'Present').length, color: '#22C55E' },
          { label: 'Absent', value: WORKERS.filter(w => w.status === 'Absent').length, color: '#EF4444' },
          { label: 'Half Day / OT', value: WORKERS.filter(w => w.status === 'Half Day' || w.status === 'OT').length, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Search workers..." style={{
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

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Worker', 'Role', 'Site', 'Phone', 'Wage', 'Status', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontSize: '12px', fontWeight: '600',
                  color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WORKERS.map((w, i) => (
              <tr key={w.id} style={{
                borderBottom: i < WORKERS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'linear-gradient(135deg, #F97316, #EA580C)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '13px', color: 'white',
                    }}>{w.name[0]}</div>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{w.name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{w.role}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{w.site}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{w.phone}</td>
                <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#22C55E' }}>{w.wage}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                    background: STATUS_COLORS[w.status]?.bg ?? 'rgba(100,116,139,0.15)',
                    color: STATUS_COLORS[w.status]?.text ?? '#64748B',
                  }}>{w.status}</span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['Edit', 'View'].map(a => (
                      <button key={a} style={{
                        padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                        background: a === 'Edit' ? 'var(--primary-muted)' : 'rgba(255,255,255,0.06)',
                        color: a === 'Edit' ? 'var(--primary)' : 'var(--text-muted)',
                        border: 'none', cursor: 'pointer',
                      }}>{a}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
