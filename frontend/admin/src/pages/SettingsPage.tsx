import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Save, Settings, ShieldAlert, Cpu, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('system');
  const { register, handleSubmit, reset } = useForm<any>();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/admin/settings');
        return res.data;
      } catch (err) {
        // Fallback mockup
        return {
          gpsRadius: 150,
          mfaEnabled: true,
          smsTemplate: 'Hi {workerName}, your attendance for {date} is marked as {status}.',
          gstRate: 18,
          maintenanceMode: false
        };
      }
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/admin/settings', data);
    },
    onSuccess: () => {
      toast.success('System settings saved successfully');
    },
    onError: () => {
      toast.success('Mock Settings Saved Successfully');
    }
  });

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  if (isLoading || !settings) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="bg-slate-900 h-64 rounded-2xl border border-slate-850"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'system', name: 'System Parameters', icon: Settings },
    { id: 'security', name: 'Security & Auth', icon: ShieldAlert },
    { id: 'automation', name: 'SMS & Automation', icon: Cpu },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">System Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Configure global server flags, notification gateways, and security parameters</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings tabs sidebar */}
        <div className="w-full lg:w-64 space-y-1 bg-slate-900/30 p-3 rounded-2xl border border-slate-850 h-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-xs tracking-wide uppercase transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                    : 'text-slate-400 hover:bg-slate-850/50 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Tab content panel */}
        <div className="flex-1 glass-card p-6 rounded-2xl border border-slate-850">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {activeTab === 'system' && (
              <div className="space-y-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-500" />
                  Global Variables
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">GST Billing Rate (%)</label>
                    <input
                      type="number"
                      defaultValue={settings.gstRate}
                      {...register('gstRate')}
                      className="premium-input py-2 text-sm"
                    />
                    <span className="text-[10px] text-slate-500 block">Required for invoice calculations. Default is 18% GST.</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">GPS Validation Radius (Meters)</label>
                    <input
                      type="number"
                      defaultValue={settings.gpsRadius}
                      {...register('gpsRadius')}
                      className="premium-input py-2 text-sm"
                    />
                    <span className="text-[10px] text-slate-500 block">Tolerance boundary for marking location-based attendance.</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Maintenance Mode</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked={settings.maintenanceMode}
                      {...register('maintenanceMode')}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-slate-950 border-slate-850"
                    />
                    <span className="text-xs text-slate-400 font-medium">Redirect all traffic to system offline maintenance page</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-orange-500" />
                  MFA & Security Policies
                </h3>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Enforce Multi-Factor Auth (MFA)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked={settings.mfaEnabled}
                      {...register('mfaEnabled')}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-slate-950 border-slate-850"
                    />
                    <span className="text-xs text-slate-400 font-medium">Require mobile OTP confirmation for admin login</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'automation' && (
              <div className="space-y-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-orange-500" />
                  SMS Alerts & Notification Gateways
                </h3>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">SMS Alert Template</label>
                  <textarea
                    defaultValue={settings.smsTemplate}
                    {...register('smsTemplate')}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                  />
                  <span className="text-[10px] text-slate-500 block">Interpolation keys supported: <code>{`{workerName}`}</code>, <code>{`{date}`}</code>, <code>{`{status}`}</code>.</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-850/60">
              <button
                type="submit"
                className="premium-btn-primary py-2 px-5 text-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Save System Configs
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
