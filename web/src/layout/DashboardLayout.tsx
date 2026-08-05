import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, MapPin,
  CreditCard, FileBarChart, Settings, LogOut,
  Menu, X, Bell, Search, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBreakpoint } from '../hooks/useBreakpoint';
import styles from './DashboardLayout.module.css';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/workers', icon: Users, label: 'Workers' },
  { path: '/attendance', icon: CalendarCheck, label: 'Attendance' },
  { path: '/sites', icon: MapPin, label: 'Sites' },
  { path: '/payments', icon: CreditCard, label: 'Payments' },
  { path: '/reports', icon: FileBarChart, label: 'Reports' },
];

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={styles.clock} style={{ color: 'var(--text-muted)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
      {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export function DashboardLayout() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { username, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  // Monitor Window Breaks
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(true);
    } else if (isTablet) {
      setSidebarOpen(false);
      setMobileOpen(false);
    } else if (isDesktop) {
      setSidebarOpen(true);
      setMobileOpen(false);
    }
  }, [isMobile, isTablet, isDesktop]);

  // Swipe to Close Drawer
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diffX = touchStartX.current - touchCurrentX.current;
    if (diffX > 50 && mobileOpen) {
      setMobileOpen(false);
    }
  };

  const pageTitle = NAV_ITEMS.find(n =>
    n.exact ? location.pathname === n.path : location.pathname.startsWith(n.path)
  )?.label ?? 'Dashboard';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside 
        className={`${styles.sidebar} ${sidebarOpen ? styles.expanded : styles.collapsed} ${mobileOpen ? styles.mobileVisible : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div className={styles.logoIcon}>H</div>
            {sidebarOpen && (
              <div>
                <div className={styles.logoText}>Haajari</div>
                <div className={styles.logoSub}>Admin Portal</div>
              </div>
            )}
          </div>
          {isMobile && mobileOpen && (
            <button className={styles.closeDrawerBtn} onClick={() => setMobileOpen(false)}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ path, icon: Icon, label, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={() => setMobileOpen(false)}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={20} className={styles.navIcon} />
              {sidebarOpen && <span className={styles.navLabel}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
          onClick={() => setMobileOpen(false)}
          title={!sidebarOpen ? 'Settings' : undefined}
        >
          <Settings size={20} className={styles.navIcon} />
          {sidebarOpen && <span className={styles.navLabel}>Settings</span>}
        </NavLink>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <div className={styles.adminInfo}>
            <div className={styles.adminAvatar}>
              {(username?.[0] ?? 'A').toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className={styles.adminDetails}>
                <div className={styles.adminName}>{username ?? 'Admin'}</div>
                <div className={styles.adminRole}>Super Admin</div>
              </div>
            )}
          </div>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main Area ────────────────────────────────────────────── */}
      <div className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuBtn}
              onClick={() => {
                if (isMobile) {
                  setMobileOpen(v => !v);
                } else {
                  setSidebarOpen(v => !v);
                }
              }}
            >
              {isMobile && mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className={styles.breadcrumb}>
              <span className={styles.breadcrumbBase}>Admin</span>
              <ChevronRight size={14} color="var(--text-subtle)" />
              <span className={styles.breadcrumbPage}>{pageTitle}</span>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <Clock />
            <div className={styles.searchWrap}>
              <Search size={14} color="var(--text-muted)" />
              <input
                className={styles.searchInput}
                placeholder="Search..."
                type="text"
              />
            </div>
            <button className={styles.iconBtn}>
              <Bell size={18} />
              <span className={styles.notifBadge}>3</span>
            </button>
            <div className={styles.topbarAvatar}>
              {(username?.[0] ?? 'A').toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
