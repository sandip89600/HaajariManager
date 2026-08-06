import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search, Edit2, Trash2, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

const useAttendance = (month: number, year: number) => useQuery({ 
  queryKey: ['attendance', month, year], 
  queryFn: async () => (await api.get('/admin/attendance', { params: { month, year } })).data 
});
const useUpdateAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(`/admin/attendance/${data.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Attendance updated'); },
    onError: () => toast.error('Failed to update attendance'),
  });
};
const useDeleteAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/attendance/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Record deleted'); },
    onError: () => toast.error('Failed to delete record'),
  });
};

type AttendanceStatus = 'Present' | 'Absent' | 'Half-Day' | 'Overtime';

interface AttendanceRecord {
  _id: string;
  workerId: string;
  workerName: string;
  date: string;
  status: AttendanceStatus;
  dailyRate: number;
  finalPay: number;
  siteName: string;
  notes?: string;
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  Present: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
  Absent: 'bg-rose-500/20 text-rose-400 border-rose-500/20',
  'Half-Day': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  Overtime: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  Present: 'P', Absent: 'A', 'Half-Day': 'HD', Overtime: 'OT'
};

export default function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'List' | 'Grid'>('List');
  const [filterStatus, setFilterStatus] = useState<'All' | AttendanceStatus>('All');
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  
  const { data: records = [], isLoading } = useAttendance(month, year);
  const deleteMutation = useDeleteAttendance();

  const prevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month, 1));

  const filteredRecords = records.filter((r: AttendanceRecord) => filterStatus === 'All' || r.status === filterStatus);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Grid view calculation
  const workersInMonth = Array.from(new Set(records.map((r: AttendanceRecord) => r.workerName)));
  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 text-slate-200">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">Attendance Records</h1>
          <p className="text-slate-400 text-sm mt-1">Global view of all attendance logs.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-xl border border-slate-700">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 font-medium w-36 justify-center">
            <CalendarIcon className="w-4 h-4 text-orange-500" />
            {monthName} {year}
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
          
          <div className="w-px h-6 bg-slate-700 mx-2"></div>
          
          <div className="flex bg-slate-900 rounded-lg p-1">
            <button 
              onClick={() => setView('List')} 
              className={`p-1.5 rounded-md transition-colors ${view === 'List' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView('Grid')} 
              className={`p-1.5 rounded-md transition-colors ${view === 'Grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {view === 'List' && (
        <div className="mb-6 flex gap-2">
          {['All', 'Present', 'Absent', 'Half-Day', 'Overtime'].map(s => (
            <button 
              key={s} 
              onClick={() => setFilterStatus(s as any)} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {view === 'List' ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700 uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Worker Name</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Site</th>
                  <th className="px-6 py-4">Daily Rate</th>
                  <th className="px-6 py-4">Final Pay</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-20"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-slate-700 rounded-full w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-12"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-700 rounded w-12"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-slate-700 rounded w-16"></div></td>
                    </tr>
                  ))
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No attendance records found for this period.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record: AttendanceRecord) => (
                    <tr key={record._id} className="hover:bg-slate-700/20 transition-colors group">
                      <td className="px-6 py-4 font-medium text-white">{record.workerName}</td>
                      <td className="px-6 py-4 text-slate-300">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[record.status]}`}>
                          {record.status} ({STATUS_LABELS[record.status]})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{record.siteName}</td>
                      <td className="px-6 py-4 text-slate-400">₹{record.dailyRate}</td>
                      <td className="px-6 py-4 font-medium text-slate-300">₹{record.finalPay}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditRecord(record)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if(window.confirm('Delete this attendance record?')) deleteMutation.mutate(record._id);
                            }}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
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
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-center text-sm border-collapse">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 sticky left-0 bg-slate-900 z-10 text-left border-r border-slate-700">Worker</th>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                  <th key={i} className="px-2 py-3 min-w-[36px]">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {workersInMonth.map(worker => (
                <tr key={worker as string} className="hover:bg-slate-700/20">
                  <td className="px-4 py-3 font-medium text-white text-left sticky left-0 bg-slate-800 border-r border-slate-700 whitespace-nowrap">
                    {worker as string}
                  </td>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                    const rec = records.find((r: AttendanceRecord) => r.workerName === worker && r.date.startsWith(dayStr));
                    return (
                      <td key={i} className="px-1 py-2">
                        {rec ? (
                          <div 
                            title={`${rec.status} - ${rec.siteName}`}
                            className={`w-7 h-7 mx-auto rounded flex items-center justify-center text-xs font-bold cursor-pointer ${STATUS_COLORS[rec.status as AttendanceStatus].replace('/20', '/30')}`}
                            onClick={() => setEditRecord(rec)}
                          >
                            {STATUS_LABELS[rec.status as AttendanceStatus]}
                          </div>
                        ) : (
                          <div className="w-7 h-7 mx-auto rounded bg-slate-900/50 border border-slate-700"></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {workersInMonth.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth + 1} className="py-8 text-slate-400">No attendance data for this month.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {editRecord && <EditAttendanceModal record={editRecord} onClose={() => setEditRecord(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function EditAttendanceModal({ record, onClose }: { record: AttendanceRecord, onClose: () => void }) {
  const { register, handleSubmit } = useForm({ defaultValues: record });
  const updateMutation = useUpdateAttendance();

  const onSubmit = (data: any) => {
    updateMutation.mutate({ id: record._id, ...data }, {
      onSuccess: () => onClose()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Edit Attendance</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <div className="text-sm text-slate-400 mb-1">Worker</div>
            <div className="font-medium text-white">{record.workerName}</div>
          </div>
          <div>
            <div className="text-sm text-slate-400 mb-1">Date</div>
            <div className="font-medium text-white">{new Date(record.date).toLocaleDateString()}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
            <select {...register('status')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none">
              <option value="Present">Present</option>
              <option value="Half-Day">Half-Day</option>
              <option value="Absent">Absent</option>
              <option value="Overtime">Overtime</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Final Pay (₹)</label>
            <input type="number" {...register('finalPay')} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none" />
            <p className="text-xs text-slate-500 mt-1">Base daily rate: ₹{record.dailyRate}</p>
          </div>
          
          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors font-medium">Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors font-medium">
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
