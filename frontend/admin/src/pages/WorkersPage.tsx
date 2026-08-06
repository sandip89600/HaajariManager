import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Edit2, Trash2, X, Plus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

const useWorkers = () => useQuery({ queryKey: ['workers'], queryFn: async () => (await api.get('/admin/workers')).data });
const useUpdateWorker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(`/admin/workers/${data.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workers'] }); toast.success('Worker updated'); },
    onError: () => toast.error('Failed to update worker'),
  });
};
const useDeleteWorker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/workers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workers'] }); toast.success('Worker deleted'); },
    onError: () => toast.error('Failed to delete worker'),
  });
};

type WorkerCategory = 'Mason' | 'Helper' | 'Painter' | 'Electrician' | 'Plumber' | 'Carpenter' | 'Welder' | 'Other';

interface Worker {
  _id: string;
  name: string;
  phone: string;
  category: WorkerCategory;
  dailyRate: number;
  company: string;
  isActive: boolean;
  address?: string;
  notes?: string;
}

const CATEGORY_COLORS: Record<WorkerCategory, string> = {
  Mason: 'bg-orange-500/20 text-orange-400 border-orange-500/20',
  Helper: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  Painter: 'bg-violet-500/20 text-violet-400 border-violet-500/20',
  Electrician: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  Plumber: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  Carpenter: 'bg-lime-500/20 text-lime-400 border-lime-500/20',
  Welder: 'bg-rose-500/20 text-rose-400 border-rose-500/20',
  Other: 'bg-slate-500/20 text-slate-300 border-slate-500/20',
};

export default function WorkersPage() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<WorkerCategory | 'All'>('All');
  const [editWorker, setEditWorker] = useState<Worker | null>(null);

  const { data: workers = [], isLoading } = useWorkers();
  const deleteMutation = useDeleteWorker();

  const filteredWorkers = workers.filter((w: Worker) => {
    const matchesSearch = w.name?.toLowerCase().includes(search.toLowerCase()) || 
                          w.phone?.includes(search) || 
                          w.company?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'All' || w.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: (WorkerCategory | 'All')[] = ['All', 'Mason', 'Helper', 'Painter', 'Electrician', 'Plumber', 'Carpenter', 'Welder', 'Other'];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 text-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Worker Management
            <span className="bg-slate-800 text-slate-300 text-sm py-1 px-2 rounded-full font-medium">{workers.length}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage global worker database across all sites.</p>
        </div>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6 flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button 
              key={c} 
              onClick={() => setFilterCategory(c)} 
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
                ${filterCategory === c 
                  ? 'bg-orange-500 text-white border-orange-500' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Name & Contact</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Daily Rate</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-8 bg-slate-700 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-700 rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-700 rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-700 rounded w-16"></div></td>
                  </tr>
                ))
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No workers found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((worker: Worker) => (
                  <tr key={worker._id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{worker.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{worker.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${CATEGORY_COLORS[worker.category] || CATEGORY_COLORS.Other}`}>
                        {worker.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-300">
                      ₹{worker.dailyRate}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {worker.company || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium 
                        ${worker.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {worker.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditWorker(worker)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if(window.confirm(`Permanently delete worker ${worker.name}?`)) {
                              deleteMutation.mutate(worker._id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {editWorker && <EditWorkerModal worker={editWorker} onClose={() => setEditWorker(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function EditWorkerModal({ worker, onClose }: { worker: Worker, onClose: () => void }) {
  const { register, handleSubmit } = useForm({ defaultValues: worker });
  const updateMutation = useUpdateWorker();

  const onSubmit = (data: any) => {
    updateMutation.mutate({ id: worker._id, ...data }, {
      onSuccess: () => onClose()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Edit Worker Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
              <input {...register('name', { required: true })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
              <input {...register('phone')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Daily Rate (₹)</label>
              <input type="number" {...register('dailyRate')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
              <select {...register('category')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none">
                {['Mason', 'Helper', 'Painter', 'Electrician', 'Plumber', 'Carpenter', 'Welder', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
            <input {...register('address')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea {...register('notes')} rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none"></textarea>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isActive" {...register('isActive')} className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-800" />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-300">Active Profile</label>
          </div>
          
          <div className="pt-6 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors font-medium">Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors font-medium flex items-center gap-2 disabled:opacity-70">
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
