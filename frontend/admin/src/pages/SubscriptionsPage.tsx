import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gem, Search, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

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

  // Fetch subscriptions
  const { data: subs = [], isLoading } = useQuery<PlanSubscription[]>({
    queryKey: ['planSubscriptionsList'],
    queryFn: async () => {
      const res = await api.get('/admin/subscriptions');
      return res.data;
    }
  });

  const filteredSubs = subs.filter((sub) => {
    return sub.company.toLowerCase().includes(search.toLowerCase()) ||
           sub.plan.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">SaaS Subscriptions</h1>
          <p className="text-slate-400 text-sm mt-1">Audit active service tier subscriptions, auto-renewals, and expirations</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['planSubscriptionsList'] });
            toast.success('Subscriptions refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
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
