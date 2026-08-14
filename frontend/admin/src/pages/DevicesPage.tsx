import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Search, RefreshCw, CheckCircle, ShieldAlert, ShieldCheck, Shield, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
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

interface SecurityEventItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  eventType: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  browser: string;
  ipAddress: string;
  location: string;
  status: string;
  timestamp: string;
}

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'terminals' | 'security_events'>('terminals');
  const [search, setSearch] = useState('');

  // Fetch devices
  const { data: devices = [], isLoading: loadingDevices } = useQuery<DeviceItem[]>({
    queryKey: ['registeredDevicesList'],
    queryFn: async () => {
      const res = await api.get('/admin/devices');
      return res.data;
    }
  });

  // Fetch security event logs
  const { data: securityEvents = [], isLoading: loadingEvents } = useQuery<SecurityEventItem[]>({
    queryKey: ['adminSecurityEventsList'],
    queryFn: async () => {
      const res = await api.get('/admin/security-events');
      return res.data?.events || [];
    }
  });

  const filteredDevices = devices.filter((d) => {
    return d.model.toLowerCase().includes(search.toLowerCase()) || 
           d.company.toLowerCase().includes(search.toLowerCase()) ||
           d.deviceId.toLowerCase().includes(search.toLowerCase());
  });

  const filteredEvents = securityEvents.filter((e) => {
    return (e.userName || '').toLowerCase().includes(search.toLowerCase()) ||
           (e.userEmail || '').toLowerCase().includes(search.toLowerCase()) ||
           (e.deviceName || '').toLowerCase().includes(search.toLowerCase()) ||
           (e.location || '').toLowerCase().includes(search.toLowerCase()) ||
           (e.eventType || '').toLowerCase().includes(search.toLowerCase());
  });

  const isLoading = loadingDevices || loadingEvents;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Security & Devices</h1>
          <p className="text-slate-400 text-sm mt-1">Audit registered supervisor terminals, login activity, and new-device security alerts</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['registeredDevicesList'] });
            queryClient.invalidateQueries({ queryKey: ['adminSecurityEventsList'] });
            toast.success('Security data refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('terminals')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-2 ${
            activeTab === 'terminals'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Registered Terminals ({devices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('security_events')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors inline-flex items-center gap-2 ${
            activeTab === 'security_events'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security & Login Activity ({securityEvents.length})</span>
        </button>
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
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">New Device Alerts</p>
            <h3 className="text-2xl font-bold text-white">{securityEvents.filter(e => e.eventType === 'NEW_DEVICE_LOGIN').length} Logins</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Suspicious Reports</p>
            <h3 className="text-2xl font-bold text-rose-450">{securityEvents.filter(e => e.status === 'marked_suspicious').length} Alerts</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder={activeTab === 'terminals' ? "Search by device model, device ID, or contractor company..." : "Search by user, device name, location, or event type..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Tab 1: Registered Terminals Table */}
      {activeTab === 'terminals' && (
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
      )}

      {/* Tab 2: Security & Login Activity Table */}
      {activeTab === 'security_events' && (
        <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4.5">Account Owner</th>
                  <th className="px-6 py-4.5">Event Type</th>
                  <th className="px-6 py-4.5">Device & Platform</th>
                  <th className="px-6 py-4.5">Approximate Location</th>
                  <th className="px-6 py-4.5">Timestamp</th>
                  <th className="px-6 py-4.5">Confirmation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-bold text-white block">{evt.userName}</span>
                          <span className="text-xs text-slate-400 block">{evt.userEmail || evt.userRole}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-300">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          evt.eventType === 'NEW_DEVICE_LOGIN'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : evt.eventType === 'TRUST_DEVICE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : evt.eventType === 'SECURITY_ALERT'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {evt.eventType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{evt.deviceName}</div>
                        <div className="text-xs text-slate-400">{evt.platform} &bull; {evt.browser}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-300">
                        📍 {evt.location || 'Location unavailable'}
                        <span className="block text-[11px] text-slate-500">IP: {evt.ipAddress}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-400">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {evt.status === 'confirmed_by_user' ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400">
                            ✔ Confirmed by User
                          </span>
                        ) : evt.status === 'marked_suspicious' ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-400">
                            ⚠️ Marked Suspicious
                          </span>
                        ) : evt.status === 'new_device_login' ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400">
                            Pending Verification
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-400">
                            {evt.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-medium">
                      No security audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
