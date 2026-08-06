import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  HardHat,
  CalendarCheck,
  Building2,
  CreditCard,
  FileText,
  Settings,
  UserCircle,
  Search,
  Bell,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';

const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { name: 'Users', path: '/users', icon: Users },
      { name: 'Workers', path: '/workers', icon: HardHat },
      { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
      { name: 'Sites', path: '/sites', icon: Building2 },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { name: 'Payments', path: '/payments', icon: CreditCard },
      { name: 'Reports', path: '/reports', icon: FileText },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
      { name: 'Profile', path: '/profile', icon: UserCircle },
    ],
  },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { user, logout } = useAuthStore();
  const { isConnected } = useSocket();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const currentPath = location.pathname;
    for (const group of navGroups) {
      const match = group.items.find(item => item.path === currentPath);
      if (match) return match.name;
    }
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans selection:bg-orange-500/30 selection:text-orange-200">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: collapsed ? 72 : 260,
          x: mobileOpen ? 0 : -260,
        }}
        className="fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-800 border-r border-slate-700/50 shadow-2xl transition-all duration-300 lg:static lg:translate-x-0"
        style={{ x: mobileOpen ? 0 : 'var(--sidebar-x, 0)' }}
      >
        <style>{`
          @media (min-width: 1024px) {
            aside { transform: none !important; }
          }
        `}</style>
        
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 shrink-0">
              <HardHat size={24} strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Haajari Admin
              </span>
            )}
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin py-4 px-3 space-y-6">
          {navGroups.map((group, i) => (
            <div key={i} className="flex flex-col gap-1">
              {!collapsed ? (
                <div className="px-3 text-xs font-semibold text-slate-400 mb-2 tracking-wider">
                  {group.title}
                </div>
              ) : (
                <div className="h-6 w-full flex justify-center mb-2">
                  <div className="w-4 border-b border-slate-700"></div>
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.name : undefined}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                    ${isActive 
                      ? 'bg-orange-500/10 text-orange-500' 
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'}
                  `}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div 
                          layoutId="activeNav"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-orange-500 rounded-r-full"
                        />
                      )}
                      <item.icon size={20} className={`shrink-0 ${isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-300'}`} />
                      {!collapsed && <span className="font-medium whitespace-nowrap">{item.name}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Collapse Toggle */}
        <div className="h-16 flex items-center px-4 border-t border-slate-700/50 shrink-0 hidden lg:flex">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            {collapsed ? <ChevronRight size={20} /> : <div className="flex items-center gap-2 w-full"><ChevronLeft size={20} /><span className="text-sm font-medium">Collapse</span></div>}
          </button>
        </div>
      </motion.aside>

      {/* Main Container */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Topbar */}
        <header className="h-16 bg-slate-800 border-b border-slate-700/50 flex items-center justify-between px-4 lg:px-8 shrink-0 z-10 relative shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-200 rounded-lg lg:hidden"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-semibold hidden sm:block text-slate-100">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search..."
                className="w-64 bg-slate-900 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-3 border-l border-slate-700 pl-4 sm:pl-6">
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-medium cursor-help"
                title={isConnected ? 'Connected to server' : 'Disconnected from server'}
              >
                {isConnected ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-rose-500" />}
                <span className="hidden sm:inline-block text-slate-300">{isConnected ? 'Live' : 'Offline'}</span>
              </div>

              <button className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-full transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-slate-800"></span>
              </button>

              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 pl-2 pr-3 bg-slate-900 border border-slate-700 rounded-full hover:border-slate-600 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-tr from-orange-600 to-orange-400 rounded-full flex items-center justify-center text-white font-bold shadow-inner">
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                  <span className="text-sm font-medium text-slate-300 hidden sm:block">{user?.name || 'Admin'}</span>
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 shadow-xl rounded-xl overflow-hidden z-50 py-1"
                      >
                        <div className="px-4 py-3 border-b border-slate-700/50 mb-1">
                          <p className="text-sm text-slate-100 font-medium truncate">{user?.name || 'Admin User'}</p>
                          <p className="text-xs text-slate-400 truncate">{user?.email || 'admin@haajari.com'}</p>
                        </div>
                        <button 
                          onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 flex items-center gap-2"
                        >
                          <UserCircle size={16} /> Profile
                        </button>
                        <button 
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-slate-700 hover:text-rose-300 flex items-center gap-2"
                        >
                          <LogOut size={16} /> Logout
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 scrollbar-thin relative bg-slate-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
