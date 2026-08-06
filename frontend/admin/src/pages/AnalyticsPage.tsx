import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { useAnalytics } from '../hooks/useApi';
import { Building2, Users as UsersIcon } from 'lucide-react';

const COLORS = ['#64748B', '#3B82F6', '#F97316', '#8B5CF6', '#10B981', '#F59E0B'];

const AnalyticsPage: React.FC = () => {
  const { data: analytics, isLoading } = useAnalytics();

  if (isLoading || !analytics) {
    return (
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-slate-800 rounded-xl h-80 border border-slate-700"></div>
        ))}
        <div className="col-span-1 md:col-span-2 bg-slate-800 rounded-xl h-64 border border-slate-700 mt-6"></div>
      </div>
    );
  }

  const tooltipStyle = { backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC' };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-200">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Comprehensive system statistics and trends</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. User Growth */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">User Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} cursor={{fill: '#334155', opacity: 0.4}} />
                <Bar dataKey="users" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Revenue Trend */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend (MRR)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="revenue" stroke="#F97316" strokeWidth={3} dot={{r: 4, fill: '#1E293B', stroke: '#F97316', strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Subscription Distribution */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Subscription Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.subscriptionPlans}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {analytics.subscriptionPlans.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ color: '#F8FAFC' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Workforce by Category */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Workforce by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.workforceByCategory} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} cursor={{fill: '#334155', opacity: 0.4}} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Attendance Overview */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Attendance Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.attendanceOverview}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} cursor={{fill: '#334155', opacity: 0.4}} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="present" stackId="a" fill="#10B981" />
                <Bar dataKey="absent" stackId="a" fill="#EF4444" />
                <Bar dataKey="halfDay" stackId="a" fill="#F59E0B" />
                <Bar dataKey="overtime" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Payroll Trend */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Payroll Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.payrollTrend}>
                <defs>
                  <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorPayroll)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Top Active Companies Table */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg mt-6 overflow-hidden">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-orange-500" />
          Top Active Companies
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium rounded-tl-lg">Company Name</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Workers</th>
                <th className="px-4 py-3 font-medium rounded-tr-lg">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {analytics.topCompanies.map((company: any) => (
                <tr key={company.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{company.name}</td>
                  <td className="px-4 py-3 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <UsersIcon className="w-3.5 h-3.5 text-slate-500" />
                      {company.usersCount}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{company.workersCount}</td>
                  <td className="px-4 py-3 text-emerald-400 font-medium">₹{company.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AnalyticsPage;
