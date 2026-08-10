import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronDown, CheckCircle, ShieldAlert, ArrowUpRight, Clock, Calendar, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface UserRecord {
  _id: string;
  name: string;
  role: 'contractor' | 'builder' | 'supervisor';
  phone: string;
  email: string;
  createdAt?: string | Date;
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

  // Fetch users
  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data;
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  });

  const formatSignupTiming = (dateString?: string | Date) => {
    if (!dateString) return { date: 'N/A', time: 'N/A' };
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return { date: 'N/A', time: 'N/A' };

    const date = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return { date, time };
  };

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
          <p className="text-slate-400 text-sm mt-1">Manage user credentials, registration timestamps, organization access, plan scopes, and security states</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Users list refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
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
                <th className="px-6 py-4.5">Signup Timing</th>
                <th className="px-6 py-4.5">Tenant Organization</th>
                <th className="px-6 py-4.5">Tier Plan</th>
                <th className="px-6 py-4.5">Active Workers</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const { date, time } = formatSignupTiming(user.createdAt);
                  return (
                    <tr key={user._id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">
                        <div>
                          <div>{user.name}</div>
                          <div className="text-xs text-slate-550 font-normal">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-450 uppercase">{user.role}</td>
                      <td className="px-6 py-4 font-semibold text-slate-400">{user.phone}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              {date}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {time}
                            </div>
                          </div>
                        </div>
                      </td>
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
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete user "${user.name}"?`)) {
                              deleteUserMutation.mutate(user._id);
                            }
                          }}
                          disabled={deleteUserMutation.isPending}
                          className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 py-1.5 px-3 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1.5 shadow-sm"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-medium">
                    No users found matching filters.
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
