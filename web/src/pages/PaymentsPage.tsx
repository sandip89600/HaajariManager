

import { ArrowDownRight, ArrowUpRight, Search, Plus, Filter, Wallet, Calendar } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

const TRANSACTIONS = [
  { id: 'TXN-1082', worker: 'Ravi Kumar', site: 'Site Alpha', date: '04 Aug 2026', type: 'Daily Wage', amount: '₹650', status: 'Paid', method: 'UPI' },
  { id: 'TXN-1081', worker: 'Suresh Patel', site: 'Site Beta', date: '04 Aug 2026', type: 'Advance Payment', amount: '₹2,000', status: 'Paid', method: 'Bank Transfer' },
  { id: 'TXN-1080', worker: 'Mohan Das', site: 'Site Alpha', date: '03 Aug 2026', type: 'Overtime Pay', amount: '₹350', status: 'Paid', method: 'Cash' },
  { id: 'TXN-1079', worker: 'Ramesh Singh', site: 'Site Gamma', date: '03 Aug 2026', type: 'Daily Wage', amount: '₹800', status: 'Paid', method: 'UPI' },
  { id: 'TXN-1078', worker: 'Ajay Verma', site: 'Site Beta', date: '02 Aug 2026', type: 'Daily Wage', amount: '₹350', status: 'Paid', method: 'Cash' },
  { id: 'TXN-1077', worker: 'Kiran Sharma', site: 'Site Gamma', date: '02 Aug 2026', type: 'Advance Payment', amount: '₹1,500', status: 'Pending', method: 'UPI' },
];

export function PaymentsPage() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  // Helper to render transaction list table rows
  const renderTableBody = () => (
    <tbody>
      {TRANSACTIONS.map((t, i) => (
        <tr key={t.id} style={{
          borderBottom: i < TRANSACTIONS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>{t.id}</td>
          <td style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '700', fontSize: '11px', color: 'white',
              }}>{t.worker[0]}</div>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>{t.worker}</span>
            </div>
          </td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{t.site}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{t.date}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{t.type}</td>
          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', color: '#22C55E' }}>{t.amount}</td>
          <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{t.method}</td>
          <td style={{ padding: '14px 16px' }}>
            <span style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
              background: t.status === 'Paid' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: t.status === 'Paid' ? '#22C55E' : '#F59E0B',
            }}>{t.status}</span>
          </td>
        </tr>
      ))}
    </tbody>
  );

  // ─── MOBILE LAYOUT ───
  const renderMobile = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '2px' }}>Payments & Payroll</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Track daily wages, advance payments, and transactions</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '12px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
        }}>
          <Plus size={16} /> New Transaction
        </button>
      </div>

      {/* Stats - Stacked */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[
          { label: 'Total Paid (Month)', value: '₹4,45,000', icon: ArrowUpRight, color: '#22C55E' },
          { label: 'Pending Payroll', value: '₹28,500', icon: ClockIcon, color: '#F59E0B' },
          { label: 'Advances Issued', value: '₹62,000', icon: ArrowDownRight, color: '#3B82F6' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
              </div>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px', background: `${s.color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} color={s.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '10px 14px',
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input type="text" placeholder="Search transactions..." style={{
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

      {/* Compact Cards Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {TRANSACTIONS.map(t => (
          <div key={t.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>{t.id}</span>
              <span style={{
                padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                background: t.status === 'Paid' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                color: t.status === 'Paid' ? '#22C55E' : '#F59E0B',
              }}>{t.status}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px', color: 'white' }}>
                {t.worker[0]}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{t.worker}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.site}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '10px', fontSize: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-subtle)', fontSize: '10px', textTransform: 'uppercase' }}>Type</div>
                <div style={{ color: 'var(--text)', fontWeight: '600', marginTop: '2px' }}>{t.type}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-subtle)', fontSize: '10px', textTransform: 'uppercase' }}>Amount</div>
                <div style={{ color: '#22C55E', fontWeight: '700', marginTop: '2px' }}>{t.amount}</div>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginTop: '4px', fontSize: '11px' }}>
                <Wallet size={12} />
                <span>Method: {t.method}</span>
                <span style={{ margin: '0 4px', color: 'var(--text-subtle)' }}>•</span>
                <Calendar size={12} />
                <span>{t.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── TABLET LAYOUT ───
  const renderTablet = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Payments & Payroll</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Track daily wages, advance payments, and transactions</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '10px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
        }}>
          <Plus size={16} /> New Transaction
        </button>
      </div>

      {/* Stats - 3 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {[
          { label: 'Total Paid (Month)', value: '₹4,45,000', icon: ArrowUpRight, color: '#22C55E' },
          { label: 'Pending Payroll', value: '₹28,500', icon: ClockIcon, color: '#F59E0B' },
          { label: 'Advances Issued', value: '₹62,000', icon: ArrowDownRight, color: '#3B82F6' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
              </div>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', background: `${s.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={s.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Search by worker name, site or transaction ID..." style={{
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
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Txn ID', 'Worker', 'Site', 'Date', 'Type', 'Amount', 'Method', 'Status'].map(h => (
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Payments & Payroll</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Track daily wages, advance payments, and transactions</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '10px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)',
        }}>
          <Plus size={16} /> New Transaction
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Paid (Month)', value: '₹4,45,000', icon: ArrowUpRight, color: '#22C55E' },
          { label: 'Pending Payroll', value: '₹28,500', icon: ClockIcon, color: '#F59E0B' },
          { label: 'Advances Issued', value: '₹62,000', icon: ArrowDownRight, color: '#3B82F6' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              flex: 1, minWidth: '220px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
              </div>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', background: `${s.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={s.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: '240px', display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 16px',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Search by worker name, site or transaction ID..." style={{
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
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Txn ID', 'Worker', 'Site', 'Date', 'Type', 'Amount', 'Method', 'Status'].map(h => (
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

function ClockIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}


