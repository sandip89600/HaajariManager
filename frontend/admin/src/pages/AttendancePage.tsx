import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Search, MapPin, Check, X, ShieldAlert, Award } from 'lucide-react';
import { api } from '../utils/api';

interface AttendanceRecord {
  _id: string;
  workerName?: string;
  phone?: string;
  company?: string;
  workerId?: {
    name: string;
    phone?: string;
  };
  tenantId?: {
    name: string;
  };
  year: number;
  month: number;
  day: number;
  value: string | number;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export default function AttendancePage() {
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Fetch attendance records
  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', dateFilter],
    queryFn: async () => {
      const res = await api.get(`/admin/attendance?date=${dateFilter}`);
      return res.data;
    }
  });

  const filteredRecords = records.filter((r) => {
    const wName = r.workerName || r.workerId?.name || 'Worker';
    const compName = r.company || r.tenantId?.name || 'Company';
    const statusValue = r.value === 'P' || r.value === 'OT' ? 'Present' : r.value === 'H' ? 'Half Day' : 'Absent';
    
    const matchesSearch = wName.toLowerCase().includes(search.toLowerCase()) || 
                          compName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || statusValue === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Labor Attendance logs</h1>
        <p className="text-slate-400 text-sm mt-1">Monitor real-time biometric and manual clock-in logs uploaded from supervisor applications</p>
      </div>

      {/* Filters */}
      <div className="glass-card p-5 rounded-2xl border border-slate-850 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ml-1">Filter Date</label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="premium-input pl-10 py-2 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ml-1">Search Labor</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by worker name, organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="premium-input pl-10 py-2 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ml-1">Status Class</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="premium-input py-2 text-xs appearance-none"
          >
            <option value="All">All Records</option>
            <option value="Present">Present</option>
            <option value="Half Day">Half Day</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
      </div>

      {/* Records Table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Labor Worker</th>
                <th className="px-6 py-4.5">Organization</th>
                <th className="px-6 py-4.5">Date Filter</th>
                <th className="px-6 py-4.5">GPS Verification</th>
                <th className="px-6 py-4.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 font-semibold text-xs animate-pulse">
                    Syncing live records...
                  </td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((r) => {
                  const wName = r.workerName || r.workerId?.name || 'Worker';
                  const compName = r.company || r.tenantId?.name || 'Company';
                  const statusValue = r.value === 'P' || r.value === 'OT' ? 'Present' : r.value === 'H' ? 'Half Day' : 'Absent';
                  
                  return (
                    <tr key={r._id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-bold text-white block">{wName}</span>
                          <span className="block text-[10px] text-slate-500">{r.phone || r.workerId?.phone || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-400">{compName}</td>
                      <td className="px-6 py-4 font-medium text-slate-500">
                        {r.year ? `${r.day}/${r.month + 1}/${r.year}` : new Date(r.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {r.location?.latitude ? (
                          <div className="flex items-center gap-1.5 text-xs text-orange-500 font-bold">
                            <MapPin className="w-4.5 h-4.5 text-orange-500" />
                            <span>GPS Verified ({r.location.latitude.toFixed(4)}, {r.location.longitude.toFixed(4)})</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs font-semibold">Manual Over-ride</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {statusValue === 'Present' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-450 font-bold uppercase tracking-wider">
                            <Check className="w-4 h-4 text-emerald-450" /> Present
                          </span>
                        ) : statusValue === 'Half Day' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-bold uppercase tracking-wider">
                            <Award className="w-4 h-4 text-amber-500" /> Half Day
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-450 font-bold uppercase tracking-wider">
                            <X className="w-4 h-4 text-rose-450" /> Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500 font-medium">
                    No attendance records found for this date.
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
