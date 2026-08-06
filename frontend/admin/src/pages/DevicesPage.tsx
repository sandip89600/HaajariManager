import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Smartphone, Search, RefreshCw, CheckCircle, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';

interface DeviceItem {
  _id: string;
  deviceId: string;
  model: string;
  os: string;
  company: string;
  biometricEnrolled: boolean;
  isActive: boolean;
  registeredAt: string;
}

export default function DevicesPage() {
  const [search, setSearch] = useState('');

  // Fetch devices
  const { data: devices = [], isLoading } = useQuery<DeviceItem[]>({
    queryKey: ['registeredDevicesList'],
    queryFn: async () => {
      const res = await api.get('/admin/devices');
      return res.data;
    }
  });

  const filteredDevices = devices.filter((d) => {
    return d.model.toLowerCase().includes(search.toLowerCase()) || 
           d.company.toLowerCase().includes(search.toLowerCase()) ||
           d.deviceId.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Device Management</h1>
        <p className="text-slate-400 text-sm mt-1">Audit and approve registered supervisor mobile devices and biometric signatures</p>
      </div>

      {/* Stats header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Registered Terminals</p>
            <h3 className="text-2xl font-bold text-white">{devices.length} Devices</h3>
          </div>
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
            <Smartphone className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Biometrics Enrolled</p>
            <h3 className="text-2xl font-bold text-white">{devices.filter(d => d.biometricEnrolled).length} Devices</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Blocked Devices</p>
            <h3 className="text-2xl font-bold text-rose-450">{devices.filter(d => !d.isActive).length} Devices</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by device model, device ID, or contractor company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Devices table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Device Model</th>
                <th className="px-6 py-4.5">Device ID</th>
                <th className="px-6 py-4.5">Operating System</th>
                <th className="px-6 py-4.5">Client Organization</th>
                <th className="px-6 py-4.5">Biometrics Enrolled</th>
                <th className="px-6 py-4.5">Registration Date</th>
                <th className="px-6 py-4.5">Device Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredDevices.length > 0 ? (
                filteredDevices.map((d) => (
                  <tr key={d._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{d.model}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400 tracking-widest">{d.deviceId}</td>
                    <td className="px-6 py-4 font-semibold text-slate-450">{d.os}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{d.company}</td>
                    <td className="px-6 py-4">
                      {d.biometricEnrolled ? (
                        <span className="text-xs text-emerald-450 font-bold uppercase tracking-wider">✔ Enrolled</span>
                      ) : (
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">— None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{d.registeredAt}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        d.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {d.isActive ? 'Approved' : 'Blocked'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-medium">
                    No registered terminals found.
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
