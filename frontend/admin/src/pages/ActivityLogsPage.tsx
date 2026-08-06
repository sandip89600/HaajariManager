import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, ShieldAlert, CheckCircle, Terminal } from 'lucide-react';
import { api } from '../utils/api';

interface ActivityLog {
  id: string;
  userName: string;
  role: string;
  action: string;
  message: string;
  ipAddress: string;
  timestamp: string;
}

export default function ActivityLogsPage() {
  const [search, setSearch] = useState('');

  // Fetch activity logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['systemActivityLogs'],
    queryFn: async () => {
      const res = await api.get('/admin/activity');
      return res.data;
    }
  });

  const logs: ActivityLog[] = logsData?.results || [];

  const filteredLogs = logs.filter((log) => {
    const actor = log.userName || '';
    const actionText = log.message || log.action || '';
    const userRole = log.role || '';
    return actor.toLowerCase().includes(search.toLowerCase()) || 
           actionText.toLowerCase().includes(search.toLowerCase()) ||
           userRole.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">System Activity Logs</h1>
        <p className="text-slate-400 text-sm mt-1">Audit administrative operations, database transactions, and authorization attempts</p>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by action, user account, or role category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Activity Table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Account / Actor</th>
                <th className="px-6 py-4.5">System Role</th>
                <th className="px-6 py-4.5">Action Executed</th>
                <th className="px-6 py-4.5">IP Address</th>
                <th className="px-6 py-4.5">Timestamp</th>
                <th className="px-6 py-4.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 font-semibold text-xs">
                    Loading activity logs...
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-bold text-white block">{log.userName || 'System Actor'}</span>
                        <span className="block text-[10px] text-slate-500">{log.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{log.role || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                        <Terminal className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>{log.message || log.action}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-xs text-emerald-450 font-bold uppercase tracking-wider">
                        <CheckCircle className="w-4 h-4 text-emerald-450" /> Success
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 font-medium">
                    No activity logs registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
