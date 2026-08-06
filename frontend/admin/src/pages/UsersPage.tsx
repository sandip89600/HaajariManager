import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Edit2, Trash2, X, Plus, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

// Mock API instance (assuming base URL is set elsewhere, or replace with your actual api client)
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

// Hooks
const useUsers = () => useQuery({ queryKey: ['users'], queryFn: async () => (await api.get('/admin/users')).data });
const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(`/admin/users/${data.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated'); },
    onError: () => toast.error('Failed to update user'),
  });
};
const useToggleUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/toggle-status`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Status toggled'); },
    onError: () => toast.error('Failed to toggle status'),
  });
};
const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted'); },
    onError: () => toast.error('Failed to delete user'),
  });
};

interface User {
  _id: string;
  name: string;
  phone: string;
  email: string;
  role: 'Contractor' | 'Builder' | 'Supervisor';
  plan: 'Free' | 'Basic' | 'Super' | 'Premium';
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useUsers();
  const toggleStatus = useToggleUserStatus();
  const deleteUser = useDeleteUser();

  const filteredUsers = users.filter((u: User) => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || 
                          u.phone?.includes(search) || 
                          u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'All' || u.role === filterRole;
    const matchesStatus = filterStatus === 'All' || (filterStatus === 'Active' ? u.isActive : !u.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 text-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            User Management
            <span className="bg-slate-800 text-slate-300 text-sm py-1 px-2 rounded-full font-medium">{users.length}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage system users, roles, and subscriptions.</p>
        </div>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {['All', 'Active', 'Inactive'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {s}
            </button>
          ))}
          <div className="w-px h-8 bg-slate-700 mx-2 hidden md:block"></div>
          {['All', 'Contractor', 'Builder', 'Supervisor'].map(r => (
            <button key={r} onClick={() => setFilterRole(r)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterRole === r ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-12"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-20"></div></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No users found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user: User) => (
                  <tr key={user._id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="px-6 py-4 font-medium text-white">{user.name}</td>
                    <td className="px-6 py-4 text-slate-300">
                      <div>{user.phone}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium 
                        ${user.plan === 'Free' ? 'bg-slate-700 text-slate-300' : 
                          user.plan === 'Basic' ? 'bg-blue-500/20 text-blue-400' : 
                          user.plan === 'Super' ? 'bg-orange-500/20 text-orange-400' : 
                          'bg-purple-500/20 text-purple-400'}`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${user.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditUser(user)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if(window.confirm(`Are you sure you want to toggle status for ${user.name}?`)) {
                              toggleStatus.mutate(user._id);
                            }
                          }} 
                          className={`p-2 rounded-lg transition-colors ${user.isActive ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-400/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10'}`} 
                          title="Toggle Status"
                        >
                          {user.isActive ? <X className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => {
                            if(window.confirm(`Permanently delete user ${user.name}? This action cannot be undone.`)) {
                              deleteUser.mutate(user._id);
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
        {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function EditUserModal({ user, onClose }: { user: User, onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: user });
  const updateMutation = useUpdateUser();

  const onSubmit = (data: any) => {
    updateMutation.mutate({ id: user._id, ...data }, {
      onSuccess: () => onClose()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Edit User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input {...register('name', { required: 'Name is required' })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
              <input {...register('phone')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input type="email" {...register('email')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <select {...register('role')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none">
                <option value="Contractor">Contractor</option>
                <option value="Builder">Builder</option>
                <option value="Supervisor">Supervisor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Plan</label>
              <select {...register('plan')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none">
                <option value="Free">Free</option>
                <option value="Basic">Basic</option>
                <option value="Super">Super</option>
                <option value="Premium">Premium</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isActive" {...register('isActive')} className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-800" />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-300">Active Account</label>
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
