import React, { useEffect, useState } from 'react';
import { 
  DollarSign, Wallet, AlertTriangle, Users, 
  Activity, Clock, UserCheck, UserX, Clock4 
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { useAnalytics } from '../hooks/useApi';
import { useSocket } from '../hooks/useSocket';

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

const COLORS = ['#64748B', '#3B82F6', '#F97316', '#8B5CF6']; // Free, Basic, Super, Premium

const DashboardPage: React.FC = () => {
  const { data: analytics, isLoading } = useAnalytics();
  const { socket } = useSocket();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Listen for real-time admin activities
    const handleActivity = (activity: ActivityItem) => {
      setActivities(prev => [activity, ...prev].slice(0, 15));
    };

    if (socket) {
      socket.on('admin_activity', handleActivity);
    }

    return () => {
      if (socket) {
        socket.off('admin_activity', handleActivity);
      }
    };
  }, [socket]);

  const renderSkeleton = () => (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-800 rounded-xl h-32 border border-slate-700"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl h-80 border border-slate-700"></div>
        <div className="bg-slate-800 rounded-xl h-80 border border-slate-700"></div>
      </div>
      <div className="bg-slate-800 rounded-xl h-64 border border-slate-700"></div>
    </div>
  );

  if (isLoading || !analytics) {
    return <div className="p-6">{renderSkeleton()}</div>;
  }

  const { 
    mrrIncome, totalPaidPayroll, totalDueLiability, activeClients,
    attendanceToday, subscriptionPlans 
  } = analytics;

  const attendanceTotal = attendanceToday.present + attendanceToday.absent + attendanceToday.halfDay + attendanceToday.overtime;
  const getPercent = (val: number) => attendanceTotal === 0 ? 0 : Math.round((val / attendanceTotal) * 100);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-200">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard Overview</h1>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">MRR Plan Income</p>
            <h3 className="text-2xl font-bold text-white">₹{mrrIncome.toLocaleString()}</h3>
            <p className="text-emerald-500 text-xs mt-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> +12.5% from last month
            </p>
          </div>
          <div className="bg-emerald-500/20 p-3 rounded-full">
            <DollarSign className="w-6 h-6 text-emerald-500" />
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Total Paid Payroll</p>
            <h3 className="text-2xl font-bold text-white">₹{totalPaidPayroll.toLocaleString()}</h3>
            <p className="text-blue-500 text-xs mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> This month
            </p>
          </div>
          <div className="bg-blue-500/20 p-3 rounded-full">
            <Wallet className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Total Due Liability</p>
            <h3 className="text-2xl font-bold text-white">₹{totalDueLiability.toLocaleString()}</h3>
            <p className="text-amber-500 text-xs mt-2 flex items-center gap-1">
              Needs attention
            </p>
          </div>
          <div className="bg-amber-500/20 p-3 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Active Clients</p>
            <h3 className="text-2xl font-bold text-white">{activeClients.toLocaleString()}</h3>
            <p className="text-purple-500 text-xs mt-2 flex items-center gap-1">
              Across all plans
            </p>
          </div>
          <div className="bg-purple-500/20 p-3 rounded-full">
            <Users className="w-6 h-6 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Row 2: Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Today's Live Attendance */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            Today's Live Attendance
          </h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-400">Present</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-xl font-bold text-white">{attendanceToday.present}</span>
                <span className="text-xs text-emerald-500 font-medium">{getPercent(attendanceToday.present)}%</span>
              </div>
            </div>
            
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <UserX className="w-4 h-4 text-red-500" />
                <span className="text-sm text-slate-400">Absent</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-xl font-bold text-white">{attendanceToday.absent}</span>
                <span className="text-xs text-red-500 font-medium">{getPercent(attendanceToday.absent)}%</span>
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Clock4 className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-slate-400">Half-Day</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-xl font-bold text-white">{attendanceToday.halfDay}</span>
                <span className="text-xs text-amber-500 font-medium">{getPercent(attendanceToday.halfDay)}%</span>
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-slate-400">Overtime</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-xl font-bold text-white">{attendanceToday.overtime}</span>
                <span className="text-xs text-blue-500 font-medium">{getPercent(attendanceToday.overtime)}%</span>
              </div>
            </div>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
            <div style={{ width: `${getPercent(attendanceToday.present)}%` }} className="h-full bg-emerald-500"></div>
            <div style={{ width: `${getPercent(attendanceToday.halfDay)}%` }} className="h-full bg-amber-500"></div>
            <div style={{ width: `${getPercent(attendanceToday.overtime)}%` }} className="h-full bg-blue-500"></div>
            <div style={{ width: `${getPercent(attendanceToday.absent)}%` }} className="h-full bg-red-500"></div>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-2">Subscription Plans</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionPlans}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {subscriptionPlans.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC' }}
                  itemStyle={{ color: '#F8FAFC' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Row 3: Full width Recent Activity Feed */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity Feed</h2>
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No recent activities to display.
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 p-3 hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-700">
                <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${
                  activity.type === 'info' ? 'bg-blue-500' :
                  activity.type === 'success' ? 'bg-emerald-500' :
                  activity.type === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <div className="flex-1">
                  <p className="text-slate-300 text-sm">{activity.description}</p>
                  <p className="text-slate-500 text-xs mt-1">{new Date(activity.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
