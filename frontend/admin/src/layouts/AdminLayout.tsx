import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CalendarDays, Building2, 
  DollarSign, FileSpreadsheet, BarChart3, Settings, 
  LogOut, Menu, X, Bell, User, HardHat, ShieldCheck,
  Building, UserCheck, Package, CreditCard, TrendingDown,
  Coins, Gem, HelpCircle, FileText, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const adminUser = useAuthStore((state) => state.user);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Organizations', path: '/organizations', icon: Building },
    { name: 'Users', path: '/users', icon: UserCheck },
    { name: 'Workers', path: '/workers', icon: HardHat },
    { name: 'Attendance', path: '/attendance', icon: CalendarDays },
    { name: 'Sites', path: '/sites', icon: Building2 },
    { name: 'Materials', path: '/materials', icon: Package },
    { name: 'Payments', path: '/payments', icon: CreditCard },
    { name: 'Expenses', path: '/expenses', icon: TrendingDown },
    { name: 'Salary', path: '/salary', icon: Coins },
    { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Subscriptions', path: '/subscriptions', icon: Gem },
    { name: 'Support', path: '/support', icon: HelpCircle },
    { name: 'Activity Logs', path: '/activity-logs', icon: FileText },
    { name: 'Device Mgmt', path: '/devices', icon: Smartphone },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <div className="bg-orange-500 p-1.5 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold font-display text-lg tracking-tight">Haajari Admin</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar navigation */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full md:w-72 bg-slate-900/40 backdrop-blur-md border-r border-slate-850/80 flex flex-col text-slate-300 md:h-screen fixed md:sticky top-0 z-40"
          >
            {/* Desktop Brand Header */}
            <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-slate-850/40">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-2 rounded-xl shadow-md shadow-orange-500/10">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg text-white font-display tracking-tight">Haajari Manager</span>
                <span className="block text-[10px] text-slate-500 font-medium tracking-widest uppercase">Admin System</span>
              </div>
            </div>

            {/* Nav Menu */}
            <div className="flex-1 px-4 py-4 overflow-y-auto space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all duration-150 ${
                      isActive 
                        ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' 
                        : 'hover:bg-slate-850/50 hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* User card & Log out */}
            <div className="p-4 border-t border-slate-850/40 bg-slate-900/20">
              <Link
                to="/profile"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-850/20 hover:bg-slate-800/30 border border-slate-850/50 hover:border-orange-500/20 mb-3 group transition-all"
              >
                <div className="bg-slate-850 p-1.5 rounded-full border border-slate-750 group-hover:border-orange-500/30 transition-all">
                  <User className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 transition-all" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate group-hover:text-orange-500 transition-all">{adminUser?.name || 'Admin User'}</p>
                  <p className="text-[9px] text-slate-500 truncate">{adminUser?.phone}</p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl font-semibold text-xs transition-all duration-200"
              >
                <LogOut className="w-4.5 h-4.5 text-slate-400 hover:text-rose-400" />
                Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col overflow-y-auto max-h-screen">
        {/* Top Navbar header */}
        <header className="bg-slate-950 border-b border-slate-850/40 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-slate-400 text-xs font-medium">
              Enterprise Dashboard &bull; Live Monitor
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification triggers */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 hover:text-white text-slate-400 rounded-xl transition-all"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              </button>

              {/* Notification Overlay Panel */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-sm text-white">Live Alerts</span>
                      <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-semibold">Active</span>
                    </div>
                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      <div className="p-2.5 hover:bg-slate-850/30 rounded-xl border border-slate-850/50 transition-colors">
                        <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold mb-1">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                          Subscription Limit Alert
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal">Client Organization 'Shree Builders' reached limit of 20 workers.</p>
                      </div>
                      <div className="p-2.5 hover:bg-slate-850/30 rounded-xl border border-slate-850/50 transition-colors">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          Plan Upgraded Success
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal">Client 'Vikas Constructions' upgraded to Premium Plan (Annual).</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="h-8 w-px bg-slate-850"></div>

            <Link to="/profile" className="flex items-center gap-2 hover:opacity-85 transition-opacity group">
              <span className="text-xs font-semibold text-slate-300 hidden sm:inline group-hover:text-orange-500 transition-all">{adminUser?.name || 'Administrator'}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center font-bold text-xs text-white ring-1 ring-slate-855 group-hover:ring-orange-500/50 transition-all animate-in fade-in">
                {adminUser?.name ? adminUser.name.substring(0, 2).toUpperCase() : 'AD'}
              </div>
            </Link>
          </div>
        </header>

        {/* Dynamic content rendering */}
        <main className="flex-1 bg-slate-950 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
