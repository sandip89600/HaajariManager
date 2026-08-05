

import { CalendarCheck, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

const WORKERS_ATTENDANCE = [
  { id: '1', name: 'Ravi Kumar', role: 'Mason', status: 'P', wage: 650 },
  { id: '2', name: 'Suresh Patel', role: 'Carpenter', status: 'P', wage: 700 },
  { id: '3', name: 'Mohan Das', role: 'Helper', status: 'A', wage: 400 },
  { id: '4', name: 'Ramesh Singh', role: 'Electrician', status: 'OT', wage: 800 },
  { id: '5', name: 'Ajay Verma', role: 'Plumber', status: 'H', wage: 500 },
  { id: '6', name: 'Deepak Nair', role: 'Welder', status: 'P', wage: 750 },
  { id: '7', name: 'Kiran Sharma', role: 'Painter', status: 'P', wage: 500 },
  { id: '8', name: 'Vijay Gupta', role: 'Mason', status: 'A', wage: 650 },
];

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  P: { label: 'Present', bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  A: { label: 'Absent', bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  H: { label: 'Half Day', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  OT: { label: 'Overtime', bg: 'rgba(168,85,247,0.15)', color: '#A855F7' },
};

export function AttendancePage() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const presentCount = WORKERS_ATTENDANCE.filter(w => w.status === 'P' || w.status === 'OT').length;
  const absentCount = WORKERS_ATTENDANCE.filter(w => w.status === 'A').length;
  const halfCount = WORKERS_ATTENDANCE.filter(w => w.status === 'H').length;
  const otCount = WORKERS_ATTENDANCE.filter(w => w.status === 'OT').length;

  // ─── MOBILE LAYOUT ───
  const renderMobile = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '2px' }}>Attendance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Daily attendance records</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '12px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer',
        }}>
          <CalendarCheck size={16} /> Save Attendance
        </button>
      </div>

      {/* Date Selector */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: '700' }}>{today}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(34,197,94,0.15)', color: '#22C55E',
            borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: '600', marginTop: '4px',
          }}>
            {presentCount}/{WORKERS_ATTENDANCE.length} Present
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Stats - 2x2 Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[
          { label: 'Present', value: presentCount, bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
          { label: 'Absent', value: absentCount, bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
          { label: 'Half Day', value: halfCount, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
          { label: 'Overtime', value: otCount, bg: 'rgba(168,85,247,0.12)', color: '#A855F7' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: '12px', padding: '12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: s.color, fontWeight: '600', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Worker Cards Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {WORKERS_ATTENDANCE.map(w => {
          const s = STATUS_MAP[w.status];
          return (
            <div key={w.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '14px',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              {/* Row 1: Worker Info */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: s.bg, border: `1.5px solid ${s.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '700', fontSize: '13px', color: s.color,
                  }}>{w.name[0]}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>{w.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{w.role} · ₹{w.wage}/day</div>
                  </div>
                </div>
                <span style={{
                  padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                  background: s.bg, color: s.color,
                }}>{s.label}</span>
              </div>

              {/* Row 2: Status Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                {['P', 'H', 'A', 'OT'].map(btn => (
                  <button key={btn} style={{
                    height: '36px', borderRadius: '8px', border: 'none',
                    background: w.status === btn ? STATUS_MAP[btn].bg : 'rgba(255,255,255,0.04)',
                    color: w.status === btn ? STATUS_MAP[btn].color : 'var(--text-muted)',
                    fontWeight: '700', fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}>
                    {btn}
                    {w.status === btn && <Check size={10} />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── TABLET LAYOUT ───
  const renderTablet = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Attendance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Daily attendance records</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '10px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer',
        }}>
          <CalendarCheck size={16} /> Save Attendance
        </button>
      </div>

      {/* Date Selector */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '17px', fontWeight: '700' }}>{today}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(34,197,94,0.15)', color: '#22C55E',
            borderRadius: '20px', padding: '4px 14px', fontSize: '13px', fontWeight: '600', marginTop: '6px',
          }}>
            {presentCount}/{WORKERS_ATTENDANCE.length} Present
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
        {[
          { label: 'Present', value: presentCount, bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
          { label: 'Absent', value: absentCount, bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
          { label: 'Half Day', value: halfCount, bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
          { label: 'Overtime', value: otCount, bg: 'rgba(168,85,247,0.15)', color: '#A855F7' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: '14px', padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: s.color, fontWeight: '600', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Worker Cards Grid - 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {WORKERS_ATTENDANCE.map(w => {
          const s = STATUS_MAP[w.status];
          return (
            <div key={w.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: s.bg, border: `2px solid ${s.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '16px', color: s.color,
                }}>{w.name[0]}</div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700' }}>{w.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{w.role} · ₹{w.wage}/day</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <span style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                  background: s.bg, color: s.color,
                }}>{s.label}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['P', 'H', 'A', 'OT'].map(btn => (
                    <button key={btn} style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                      background: w.status === btn ? STATUS_MAP[btn].bg : 'rgba(255,255,255,0.06)',
                      color: w.status === btn ? STATUS_MAP[btn].color : 'var(--text-muted)',
                      fontWeight: '700', fontSize: '11px', cursor: 'pointer',
                    }}>{btn}</button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── DESKTOP LAYOUT ───
  const renderDesktop = () => (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>Attendance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Daily attendance records</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          border: 'none', borderRadius: '12px',
          padding: '10px 20px', color: 'white', fontWeight: '700', fontSize: '14px',
          cursor: 'pointer',
        }}>
          <CalendarCheck size={16} /> Save Attendance
        </button>
      </div>

      {/* Date Selector */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '17px', fontWeight: '700' }}>{today}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(34,197,94,0.15)', color: '#22C55E',
            borderRadius: '20px', padding: '4px 14px', fontSize: '13px', fontWeight: '600', marginTop: '6px',
          }}>
            {presentCount}/{WORKERS_ATTENDANCE.length} Present
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Present', value: presentCount, bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
          { label: 'Absent', value: absentCount, bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
          { label: 'Half Day', value: halfCount, bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
          { label: 'Overtime', value: otCount, bg: 'rgba(168,85,247,0.15)', color: '#A855F7' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: '120px', background: s.bg, borderRadius: '14px', padding: '16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: s.color, fontWeight: '600', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Worker List Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Worker', 'Role', 'Daily Wage', 'Status Label', 'Status Select Actions'].map(h => (
                <th key={h} style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontSize: '12px', fontWeight: '600',
                  color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WORKERS_ATTENDANCE.map((w, i) => {
              const s = STATUS_MAP[w.status];
              return (
                <tr key={w.id} style={{
                  borderBottom: i < WORKERS_ATTENDANCE.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: s.bg, border: `1.5px solid ${s.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '700', fontSize: '14px', color: s.color,
                      }}>{w.name[0]}</div>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{w.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{w.role}</td>
                  <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#22C55E' }}>₹{w.wage}/day</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                      background: s.bg, color: s.color,
                    }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['P', 'H', 'A', 'OT'].map(btn => (
                        <button key={btn} style={{
                          width: '36px', height: '36px', borderRadius: '8px', border: 'none',
                          background: w.status === btn ? STATUS_MAP[btn].bg : 'rgba(255,255,255,0.06)',
                          color: w.status === btn ? STATUS_MAP[btn].color : 'var(--text-muted)',
                          fontWeight: '700', fontSize: '12px', cursor: 'pointer',
                        }}>{btn}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
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
