import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Info, AlertTriangle, CheckCircle, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface SystemNotification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: string;
  company: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');

  // Fetch notifications
  const { data: alerts = [], isLoading } = useQuery<SystemNotification[]>({
    queryKey: ['systemAlertsList'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications');
      return res.data;
    }
  });

  const filteredAlerts = alerts.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                          a.message.toLowerCase().includes(search.toLowerCase()) ||
                          a.company.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'All' || a.type === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">System Alerts Log</h1>
          <p className="text-slate-400 text-sm mt-1">Audit SaaS operations, geofence breaches, and plan threshold notifications</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['systemAlertsList'] });
            toast.success('Alerts refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search alerts by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {['All', 'Info', 'Warning', 'Success', 'Error'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filterType === type
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-slate-900/50 text-slate-400 border-slate-850 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Alert Feed */}
      <div className="glass-card rounded-2xl border border-slate-850 p-6 space-y-4">
        <div className="divide-y divide-slate-850/40">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <div key={alert._id} className="py-4.5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${
                    alert.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                    alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                    alert.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                    'bg-blue-500/10 border-blue-500/20 text-blue-500'
                  }`}>
                    {alert.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                     alert.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                     alert.type === 'error' ? <AlertTriangle className="w-5 h-5" /> :
                     <Info className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-white text-sm">{alert.title}</span>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-450 font-bold uppercase px-2 py-0.5 rounded">
                        {alert.company}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-normal max-w-2xl">{alert.message}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">{alert.timestamp}</span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500 font-medium">
              No system alerts found matching filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
