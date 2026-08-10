import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Search, Edit2, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

type WorkerCategory = 'Mason' | 'Helper' | 'Painter' | 'Electrician' | 'Plumber' | 'Carpenter' | 'Welder' | 'Other';

interface Worker {
  _id: string;
  name: string;
  phone: string;
  category: WorkerCategory;
  dailyRate: number;
  tenantId?: { _id: string; name: string };
  isArchived: boolean;
  address?: string;
  notes?: string;
}

const CATEGORY_COLORS: Record<WorkerCategory, string> = {
  Mason: 'bg-orange-500/10 text-orange-400 border-orange-500/20 glow-orange',
  Helper: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Painter: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Electrician: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Plumber: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Carpenter: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
  Welder: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Other: 'bg-slate-850 text-slate-400 border-slate-800',
};

export default function WorkersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<WorkerCategory | 'All'>('All');
  const [editWorker, setEditWorker] = useState<Worker | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  // Fetch workers
  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ['workers'],
    queryFn: async () => {
      const res = await api.get('/admin/workers');
      return res.data;
    }
  });

  // Edit worker mutation
  const editWorkerMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.put(`/admin/workers/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      toast.success('Worker details updated');
      setEditWorker(null);
    },
    onError: () => {
      toast.error('Failed to update worker');
    }
  });

  // Delete worker mutation
  const deleteWorkerMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/workers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      toast.success('Worker deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete worker');
    }
  });

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) || 
                          w.phone.includes(search) || 
                          (w.tenantId?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'All' || w.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: (WorkerCategory | 'All')[] = ['All', 'Mason', 'Helper', 'Painter', 'Electrician', 'Plumber', 'Carpenter', 'Welder', 'Other'];

  const onSubmitEdit = (data: any) => {
    if (editWorker) {
      editWorkerMutation.mutate({ ...data, id: editWorker._id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Workers Directory</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor global worker registries and wage contracts</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            toast.success('Workers refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by worker name, phone number, or contractor organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filterCategory === cat
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-slate-900/50 text-slate-400 border-slate-850 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Worker Name</th>
                <th className="px-6 py-4.5">Phone Number</th>
                <th className="px-6 py-4.5">Category</th>
                <th className="px-6 py-4.5">Daily Rate</th>
                <th className="px-6 py-4.5">Client Organization</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredWorkers.length > 0 ? (
                filteredWorkers.map((w) => (
                  <tr key={w._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{w.name}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{w.phone}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${CATEGORY_COLORS[w.category]}`}>
                        {w.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-extrabold text-white">₹{w.dailyRate}</td>
                    <td className="px-6 py-4 font-medium text-slate-400">{w.tenantId?.name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${!w.isArchived ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {!w.isArchived ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditWorker(w);
                          reset({
                            name: w.name,
                            phone: w.phone,
                            category: w.category,
                            dailyRate: w.dailyRate,
                            company: w.tenantId?.name || '',
                            isActive: !w.isArchived,
                            address: w.address || '',
                            notes: w.notes || ''
                          });
                        }}
                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to remove this worker permanently?')) {
                            deleteWorkerMutation.mutate(w._id);
                          }
                        }}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/25 hover:border-rose-500 text-rose-400 hover:text-white rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-medium">
                    No workers registered in system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Worker Dialog Modal */}
      {editWorker && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="glass-card max-w-lg w-full rounded-2xl border border-slate-850 p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-850/60 pb-3">
              <h3 className="text-lg font-bold text-white">Edit Worker Details</h3>
              <button 
                onClick={() => setEditWorker(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Full Name</label>
                  <input
                    type="text"
                    {...register('name', { required: 'Name is required' })}
                    className="premium-input py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Phone Number</label>
                  <input
                    type="text"
                    {...register('phone', { required: 'Phone is required' })}
                    className="premium-input py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Category</label>
                  <select
                    {...register('category')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  >
                    {categories.slice(1).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Daily Rate (₹)</label>
                  <input
                    type="number"
                    {...register('dailyRate', { required: true, min: 0 })}
                    className="premium-input py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Address</label>
                <input
                  type="text"
                  {...register('address')}
                  className="premium-input py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Notes / Medical Records</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-850/60">
                <button
                  type="button"
                  onClick={() => setEditWorker(null)}
                  className="bg-slate-900 border border-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-850"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="premium-btn-primary py-2 px-5 text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
