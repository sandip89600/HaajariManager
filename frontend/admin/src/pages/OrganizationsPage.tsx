import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building, Search, Plus, Trash2, ShieldAlert, CheckCircle, ArrowUpRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface Organization {
  _id: string;
  name: string;
  owner: string;
  phone: string;
  plan: 'free' | 'professional' | 'business';
  isActive: boolean;
  sitesCount: number;
  workersCount: number;
  createdAt: string;
}

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: orgs = [], isLoading } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await api.get('/admin/tenants');
      return res.data;
    }
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/tenants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete organization');
    }
  });



  const filteredOrgs = orgs.filter((org) => {
    return org.name.toLowerCase().includes(search.toLowerCase()) ||
           org.owner.toLowerCase().includes(search.toLowerCase()) ||
           org.phone.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Client Organizations</h1>
          <p className="text-slate-400 text-sm mt-1">Audit, configure, and onboard client construction tenants</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            toast.success('Organizations refreshed');
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
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Registrations</p>
            <h3 className="text-2xl font-bold text-white">{orgs.length}</h3>
          </div>
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
            <Building className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Business & Professional Plans</p>
            <h3 className="text-2xl font-bold text-white">{orgs.filter(o => o.plan === 'business' || o.plan === 'professional').length}</h3>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-500">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Suspended Clients</p>
            <h3 className="text-2xl font-bold text-white">{orgs.filter(o => !o.isActive).length}</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by company name, manager owner, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Orgs list table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Company Name</th>
                <th className="px-6 py-4.5">Owner / Manager</th>
                <th className="px-6 py-4.5">Contact Phone</th>
                <th className="px-6 py-4.5">Tier Plan</th>
                <th className="px-6 py-4.5">Deployed Sites</th>
                <th className="px-6 py-4.5">Active Workers</th>
                <th className="px-6 py-4.5">Registered Date</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredOrgs.length > 0 ? (
                filteredOrgs.map((org) => (
                  <tr key={org._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{org.name}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{org.owner}</td>
                    <td className="px-6 py-4 font-medium text-slate-400">{org.phone}</td>
                    <td className="px-6 py-4 font-medium text-slate-400 uppercase">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                        org.plan === 'business' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        org.plan === 'professional' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        'bg-slate-850 text-slate-500 border-slate-800'
                      }`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-300">{org.sitesCount}</td>
                    <td className="px-6 py-4 font-bold text-slate-300">{org.workersCount}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{org.createdAt}</td>
                    <td className="px-6 py-4">
                      {org.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                          <CheckCircle className="w-4 h-4" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
                          <ShieldAlert className="w-4 h-4" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete organization "${org.name}" and all associated workers, projects, and data?`)) {
                            deleteOrgMutation.mutate(org._id);
                          }
                        }}
                        disabled={deleteOrgMutation.isPending}
                        className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 py-1.5 px-3 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1.5 shadow-sm"
                        title="Delete Organization"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-medium">
                    No client organizations found.
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
