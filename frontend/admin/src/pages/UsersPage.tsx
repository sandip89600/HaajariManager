import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronDown, CheckCircle, ShieldAlert, ArrowUpRight, Slash, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

interface UserRecord {
  _id: string;
  name: string;
  role: 'contractor' | 'builder' | 'supervisor';
  phone: string;
  email: string;
  isActive: boolean;
  tenantId?: {
    _id: string;
    name: string;
    plan: 'free' | 'professional' | 'business';
  };
  workerCount: number;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('All');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Fetch users
  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data;
    }
  });

  // Toggle active/inactive state
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.put(`/admin/users/${id}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  // Upgrade plan mutation
  const upgradePlanMutation = useMutation({
    mutationFn: async ({ tenantId, plan }: { tenantId: string; plan: string }) => {
      return api.put(`/admin/tenants/${tenantId}/plan`, { plan });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowUpgradeModal(false);
      setSelectedUser(null);
    }
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) || 
                          user.phone.includes(search) ||
                          (user.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === 'All' || (user.tenantId?.plan || 'free') === planFilter.toLowerCase();
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">System Users</h1>
          <p className="text-slate-400 text-sm mt-1">Manage user credentials, organization access, plan scopes, and security states</p>
        </div>
      </div>

      {/* Filters card */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, phone or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Filter Plan</label>
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full sm:w-40 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none"
            >
              <option>All</option>
              <option>Free</option>
              <option>Professional</option>
              <option>Business</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">User Details</th>
                <th className="px-6 py-4.5">Role</th>
                <th className="px-6 py-4.5">Contact Number</th>
                <th className="px-6 py-4.5">Tenant Organization</th>
                <th className="px-6 py-4.5">Tier Plan</th>
                <th className="px-6 py-4.5">Active Workers</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      <div>
                        <div>{user.name}</div>
                        <div className="text-xs text-slate-550 font-normal">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-450 uppercase">{user.role}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{user.phone}</td>
                    <td className="px-6 py-4 font-bold text-white">{user.tenantId?.name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                        user.tenantId?.plan === 'business' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 glow-purple' :
                        user.tenantId?.plan === 'professional' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 glow-orange' :
                        'bg-slate-850 text-slate-400 border border-slate-800'
                      }`}>
                        {user.tenantId?.plan || 'free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-300">{user.workerCount || 0}</td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                          <CheckCircle className="w-4 h-4 text-emerald-400" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
                          <ShieldAlert className="w-4 h-4 text-rose-400" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {user.tenantId?._id && (
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUpgradeModal(true);
                          }}
                          className="bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500 hover:text-white text-orange-400 py-1.5 px-3 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1"
                        >
                          Upgrade <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: user._id, isActive: !user.isActive })}
                        className={`py-1.5 px-3 rounded-xl font-bold text-xs transition-all border ${
                          user.isActive
                            ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-400'
                        }`}
                      >
                        {user.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-medium">
                    No users found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && selectedUser && selectedUser.tenantId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card max-w-md w-full rounded-2xl border border-slate-850 p-6 space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-white">Upgrade Service Tier</h3>
              <p className="text-slate-400 text-xs mt-1">Select plan for client: <b>{selectedUser.tenantId.name}</b></p>
            </div>

            <div className="space-y-3">
              {['free', 'professional', 'business'].map((p) => (
                <button
                  key={p}
                  onClick={() => upgradePlanMutation.mutate({ tenantId: selectedUser.tenantId!._id, plan: p })}
                  className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all ${
                    selectedUser.tenantId!.plan === p
                      ? 'bg-slate-900 border-orange-500 text-white'
                      : 'bg-slate-950 border-slate-850 hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="block font-bold text-sm uppercase tracking-wide">{p} Plan</span>
                    <span className="block text-[10px] text-slate-500">
                      {p === 'free' ? 'Max 15 workers, free access' :
                       p === 'professional' ? 'Max 100 workers, 10 sites' :
                       'Unlimited workers & sites'}
                    </span>
                  </div>
                  {selectedUser.tenantId!.plan === p && (
                    <span className="bg-orange-500/10 text-orange-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Current</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-slate-850/60">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  setSelectedUser(null);
                }}
                className="bg-slate-900 border border-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-850"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
