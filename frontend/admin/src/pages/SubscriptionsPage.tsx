import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gem, Search, Calendar, RefreshCw, AlertCircle, Settings, Sliders, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { startRazorpayWebCheckout } from '../utils/razorpayCheckout';

interface PlanSubscription {
  _id: string;
  company: string;
  plan: 'basic' | 'super' | 'premium';
  amount: number;
  cycle: 'monthly' | '3 months' | 'yearly';
  renewalDate: string;
  autoRenew: boolean;
  status: 'Active' | 'Expired' | 'Pending';
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Fetch subscriptions list
  const { data: subs = [], isLoading: isSubsLoading } = useQuery<PlanSubscription[]>({
    queryKey: ['planSubscriptionsList'],
    queryFn: async () => {
      const res = await api.get('/admin/subscriptions');
      return res.data;
    }
  });

  // Fetch centralized configurations
  const { data: config, isLoading: isConfigLoading } = useQuery({
    queryKey: ['subscriptionConfig'],
    queryFn: async () => {
      const res = await api.get('/admin/subscription-config');
      return res.data;
    }
  });

  // Mutation to save settings on backend
  const updateMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return api.put('/admin/subscription-config', updatedData);
    },
    onSuccess: () => {
      toast.success('App configuration updated successfully');
      queryClient.invalidateQueries({ queryKey: ['subscriptionConfig'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save configuration');
    }
  });

  const handleToggleSubscriptions = () => {
    if (!config) return;
    const newVal = !config.subscriptionsEnabled;
    const msg = newVal
      ? "Are you sure you want to enable subscription enforcement? Premium/paid features will start restricting access based on user subscription levels."
      : "Are you sure you want to disable subscription enforcement? All users will access the default launch settings.";

    if (window.confirm(msg)) {
      updateMutation.mutate({
        ...config,
        subscriptionsEnabled: newVal
      });
    }
  };

  const handleToggleSupervisorRestricted = () => {
    if (!config) return;
    const newVal = !config.supervisorManagementRestrictedToPaid;
    updateMutation.mutate({
      ...config,
      supervisorManagementRestrictedToPaid: newVal
    });
  };

  const handleToggleFeature = (featureKey: string) => {
    if (!config) return;
    const updatedFeatures = config.features.map((f: any) => {
      if (f.key === featureKey) {
        return { ...f, enabled: !f.enabled };
      }
      return f;
    });

    updateMutation.mutate({
      ...config,
      features: updatedFeatures
    });
  };

  const handleChangeFeaturePlan = (featureKey: string, minPlan: string) => {
    if (!config) return;
    const updatedFeatures = config.features.map((f: any) => {
      if (f.key === featureKey) {
        return { ...f, minPlan };
      }
      return f;
    });

    updateMutation.mutate({
      ...config,
      features: updatedFeatures
    });
  };

  const filteredSubs = subs.filter((sub) => {
    return sub.company.toLowerCase().includes(search.toLowerCase()) ||
           sub.plan.toLowerCase().includes(search.toLowerCase());
  });

  const isLoading = isSubsLoading || isConfigLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">SaaS Subscriptions & Features</h1>
          <p className="text-slate-400 text-sm mt-1">Configure global monetization logic, feature toggles, and audit tier access</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              startRazorpayWebCheckout({
                amount: 149,
                planName: 'super',
                billingCycle: 'monthly',
                userName: 'Haajari Admin User',
                userEmail: 'admin@haajari.app',
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ['planSubscriptionsList'] });
                  queryClient.invalidateQueries({ queryKey: ['subscriptionConfig'] });
                },
              });
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all inline-flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95"
          >
            <Gem className="w-4 h-4" />
            <span>Pay with Razorpay (₹149)</span>
          </button>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['planSubscriptionsList'] });
              queryClient.invalidateQueries({ queryKey: ['subscriptionConfig'] });
              toast.success('Information refreshed');
            }}
            disabled={isLoading}
            className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-855 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── CENTRAL CONTROL: SUBSCRIPTION & FEATURE SYSTEM ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Control Card */}
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-bold text-white">Subscription Control</h3>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Toggle subscription enforcement globally. If disabled, all features operate under a free trial launch phase. If enabled, features respect configured plans.
            </p>
            <div className="flex items-center gap-3 mb-6 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
              <span className="text-xs font-semibold text-slate-450 uppercase tracking-wide">System Status:</span>
              {config?.subscriptionsEnabled ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  Inactive
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleToggleSubscriptions}
            disabled={updateMutation.isPending}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              config?.subscriptionsEnabled
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-455 hover:bg-emerald-500/30 border border-emerald-500/30'
            }`}
          >
            {config?.subscriptionsEnabled ? 'Turn OFF Subscription Enforcement' : 'Turn ON Subscription Enforcement'}
          </button>
        </div>

        {/* Supervisor Creation Subscription Requirement Control Card */}
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Create Supervisor Subscription Control</h3>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Enable or Disable subscription plan enforcement when creating supervisor accounts.
              <br/>
              <span className="text-emerald-400 font-semibold">• DISABLED (OFF):</span> Create supervisors freely on all plans without any subscription messages or upgrade errors.
              <br/>
              <span className="text-amber-400 font-semibold">• ENABLED (ON):</span> Restrict supervisor creation to paid subscription plans only.
            </p>
            <div className="flex items-center gap-3 mb-6 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
              <span className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Subscription Enforcement:</span>
              {config?.supervisorManagementRestrictedToPaid ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  ENABLED (Paid Required)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  DISABLED (Create Freely)
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleToggleSupervisorRestricted}
            disabled={updateMutation.isPending}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              config?.supervisorManagementRestrictedToPaid
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
            }`}
          >
            {config?.supervisorManagementRestrictedToPaid ? 'Disable Restriction (Create Supervisors Freely)' : 'Enable Restriction (Require Paid Subscription)'}
          </button>
        </div>

        {/* Feature Management Panel */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-850">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="text-lg font-bold text-white">Feature Management</h3>
              <p className="text-slate-400 text-xs mt-0.5">Control feature rollouts and tier requirements dynamically</p>
            </div>
          </div>

          {isConfigLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs font-semibold flex justify-center items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
              <span>Loading feature flags...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850/60 text-slate-450 uppercase font-bold tracking-wider pb-2">
                    <th className="py-2.5 pr-4">Feature Name / Scope</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2">Min Plan Requirement</th>
                    <th className="py-2.5 pl-2 text-right">Toggle Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/30 text-slate-300">
                  {config?.features?.map((feat: any) => (
                    <tr key={feat.key} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="font-bold text-white text-sm">{feat.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{feat.description}</div>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          feat.premium ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {feat.premium ? 'Premium' : 'Free'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2">
                        {feat.premium ? (
                          <select
                            value={feat.minPlan}
                            onChange={(e) => handleChangeFeaturePlan(feat.key, e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-350 focus:outline-none focus:ring-1 focus:ring-orange-500/50 text-[11px] font-medium"
                          >
                            <option value="free">Free</option>
                            <option value="basic">Basic</option>
                            <option value="super">Super</option>
                            <option value="premium">Premium</option>
                          </select>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pl-2 text-right">
                        <button
                          onClick={() => handleToggleFeature(feat.key)}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase transition-all duration-150 active:scale-95 ${
                            feat.enabled
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800/40 text-slate-500 border border-slate-700/60 hover:bg-slate-800/60'
                          }`}
                        >
                          {feat.enabled ? 'ON' : 'OFF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Stats header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Subscriptions</p>
            <h3 className="text-2xl font-bold text-white">{subs.filter(s => s.status === 'Active').length} Clients</h3>
          </div>
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
            <Gem className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Auto Renewal Enabled</p>
            <h3 className="text-2xl font-bold text-white">{subs.filter(s => s.autoRenew && s.status === 'Active').length} Clients</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500">
            <RefreshCw className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Expired Accounts</p>
            <h3 className="text-2xl font-bold text-rose-450">{subs.filter(s => s.status === 'Expired').length} Clients</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by subscriber name or plan category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Subscriptions table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Client Organization</th>
                <th className="px-6 py-4.5">Tier Plan</th>
                <th className="px-6 py-4.5">Plan Amount</th>
                <th className="px-6 py-4.5">Billing Cycle</th>
                <th className="px-6 py-4.5">Renewal / Expiry Date</th>
                <th className="px-6 py-4.5">Auto Renewal</th>
                <th className="px-6 py-4.5">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredSubs.length > 0 ? (
                filteredSubs.map((sub) => (
                  <tr key={sub._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{sub.company}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase border ${
                        sub.plan === 'premium' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        sub.plan === 'super' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-extrabold text-white">₹{sub.amount}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400 uppercase">{sub.cycle}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span>{sub.renewalDate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {sub.autoRenew ? (
                        <span className="text-xs text-emerald-450 font-bold uppercase tracking-wider">✔ Enabled</span>
                      ) : (
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">— Disabled</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        sub.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-medium">
                    No subscriptions registered.
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
