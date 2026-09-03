import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  MessageSquare, Search, Filter, RefreshCw, AlertTriangle, 
  CheckCircle2, Clock, ShieldAlert, FileText, ChevronRight, 
  User, Phone, Mail, Smartphone, Layers, Tag, X, Send, Eye,
  Building2, HardHat, FileSpreadsheet, Check, Sparkles, TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface InternalNote {
  _id?: string;
  note: string;
  adminName: string;
  createdAt: string;
}

interface IssueFeedbackItem {
  _id: string;
  userId?: string;
  userName: string;
  userRole: string;
  userPhone?: string;
  userEmail?: string;
  category: string;
  feature: string;
  message: string;
  errorType?: string;
  errorMessage?: string;
  httpStatus?: number;
  durationMs?: number;
  platform?: string;
  appVersion?: string;
  status: 'New' | 'In Review' | 'Investigating' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  internalNotes: InternalNote[];
  createdAt: string;
  updatedAt: string;
}

interface FeedbackResponse {
  success: boolean;
  feedbacks: IssueFeedbackItem[];
  summary: {
    total: number;
    new: number;
    inReview: number;
    investigating: number;
    resolved: number;
    closed: number;
  };
  topCategories: { category: string; count: number }[];
  systemicIssues: { category: string; feature: string; reportCount: number; latestReportAt: string }[];
}

export default function FeedbackPage() {
  const queryClient = useQueryClient();

  // Filters & State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Detail Modal State
  const [selectedIssue, setSelectedIssue] = useState<IssueFeedbackItem | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch Feedback Data
  const { data, isLoading, refetch } = useQuery<FeedbackResponse>({
    queryKey: ['adminFeedbacks', search, categoryFilter, statusFilter, roleFilter, priorityFilter],
    queryFn: async () => {
      const res = await api.get('/admin/feedback', {
        params: {
          search,
          category: categoryFilter,
          status: statusFilter,
          role: roleFilter,
          priority: priorityFilter,
        },
      });
      return res.data;
    },
  });

  const feedbacks = data?.feedbacks || [];
  const summary = data?.summary || { total: 0, new: 0, inReview: 0, investigating: 0, resolved: 0, closed: 0 };
  const topCategories = data?.topCategories || [];
  const systemicIssues = data?.systemicIssues || [];

  // Update Status / Priority
  const handleUpdateStatus = async (id: string, newStatus: string, newPriority?: string) => {
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/admin/feedback/${id}/status`, {
        status: newStatus,
        priority: newPriority,
      });

      if (res.data.success) {
        toast.success('Issue updated successfully');
        if (selectedIssue && selectedIssue._id === id) {
          setSelectedIssue(res.data.feedback);
        }
        queryClient.invalidateQueries({ queryKey: ['adminFeedbacks'] });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update issue status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Add Internal Note
  const handleAddNote = async (id: string) => {
    if (!newNoteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await api.post(`/admin/feedback/${id}/notes`, {
        note: newNoteText.trim(),
      });

      if (res.data.success) {
        toast.success('Internal note added');
        setNewNoteText('');
        if (selectedIssue && selectedIssue._id === id) {
          setSelectedIssue(res.data.feedback);
        }
        queryClient.invalidateQueries({ queryKey: ['adminFeedbacks'] });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add internal note');
    } finally {
      setAddingNote(false);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'High':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Medium':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'In Review':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Investigating':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Resolved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Closed':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-display tracking-tight flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-orange-500" />
            User Feedback & Issues
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time audit log of mobile app failures, performance bottlenecks, and user problem reports
          </p>
        </div>
        <button
          onClick={() => {
            refetch();
            toast.success('Feedback reports refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Reports</span>
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-slate-850">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Issues</span>
          <span className="text-2xl font-extrabold text-white mt-1 block">{summary.total}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">New</span>
          <span className="text-2xl font-extrabold text-amber-300 mt-1 block">{summary.new}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5">
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider block">In Review</span>
          <span className="text-2xl font-extrabold text-purple-300 mt-1 block">{summary.inReview}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5">
          <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider block">Investigating</span>
          <span className="text-2xl font-extrabold text-orange-300 mt-1 block">{summary.investigating}</span>
        </div>
        <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Resolved</span>
          <span className="text-2xl font-extrabold text-emerald-300 mt-1 block">{summary.resolved}</span>
        </div>
      </div>

      {/* Systemic Issue Alert Banner (If repeated issues exist) */}
      {systemicIssues.length > 0 && (
        <div className="glass-card p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-200">Systemic Problem Pattern Detected</h4>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Multiple users have reported recurring failures in the following features:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {systemicIssues.map((si, idx) => (
                <span
                  key={idx}
                  className="bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5"
                >
                  <span>{si.category}</span>
                  <span className="text-amber-400/60">•</span>
                  <span>{si.feature}</span>
                  <span className="bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded text-[10px]">
                    {si.reportCount} reports
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Categories Pills */}
      {topCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
            Top Categories:
          </span>
          {topCategories.map((c) => (
            <button
              key={c.category}
              onClick={() => setCategoryFilter(categoryFilter === c.category ? 'All' : c.category)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                categoryFilter === c.category
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {c.category} ({c.count})
            </button>
          ))}
        </div>
      )}

      {/* Multi-Attribute Filter Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search user, message, error..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="premium-input pl-9 text-xs py-2"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="premium-input text-xs py-2"
            >
              <option value="All">All Categories</option>
              <option value="Attendance">Attendance</option>
              <option value="Attendance Grid">Attendance Grid</option>
              <option value="Worker Management">Worker Management</option>
              <option value="Site Management">Site Management</option>
              <option value="Reports">Reports</option>
              <option value="PDF">PDF</option>
              <option value="CSV">CSV</option>
              <option value="Print">Print</option>
              <option value="GPS / Location">GPS / Location</option>
              <option value="Notifications">Notifications</option>
              <option value="Login / Authentication">Login / Authentication</option>
              <option value="Payments">Payments</option>
              <option value="Performance / Slow App">Performance / Slow App</option>
              <option value="UI / Design">UI / Design</option>
              <option value="Network / Server">Network / Server</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="premium-input text-xs py-2"
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="In Review">In Review</option>
              <option value="Investigating">Investigating</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="premium-input text-xs py-2"
            >
              <option value="All">All User Roles</option>
              <option value="admin">Admin</option>
              <option value="contractor">Contractor</option>
              <option value="supervisor">Supervisor</option>
              <option value="worker">Worker</option>
              <option value="user">User</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="premium-input text-xs py-2"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Feedback Data Table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-850">
              <tr>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Feature</th>
                <th className="px-4 py-3.5">User Details</th>
                <th className="px-4 py-3.5">Problem Description</th>
                <th className="px-4 py-3.5">Priority</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    Loading feedback reports...
                  </td>
                </tr>
              ) : feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No issue reports found matching your active filters.
                  </td>
                </tr>
              ) : (
                feedbacks.map((f) => (
                  <tr key={f._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="bg-slate-900 border border-slate-800 text-orange-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        {f.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-white font-bold max-w-[140px] truncate">
                      {f.feature}
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="font-bold text-white block">{f.userName}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{f.userRole} {f.userPhone ? `• ${f.userPhone}` : ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <p className="text-slate-300 line-clamp-2">{f.message}</p>
                      {f.errorMessage && (
                        <span className="text-[10px] text-rose-400 font-mono block truncate mt-0.5">
                          Err: {f.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`border px-2 py-0.5 rounded text-[10px] font-bold ${getPriorityBadgeClass(f.priority)}`}>
                        {f.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`border px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${getStatusBadgeClass(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedIssue(f)}
                        className="bg-slate-900 border border-slate-800 hover:border-orange-500/40 hover:bg-slate-850 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-orange-400" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Issue Modal / Drawer */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                    {selectedIssue.category}
                  </span>
                  <span className={`border px-2.5 py-0.5 rounded-lg text-xs font-bold ${getPriorityBadgeClass(selectedIssue.priority)}`}>
                    {selectedIssue.priority} Priority
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white font-display mt-2">
                  {selectedIssue.feature}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reported on {new Date(selectedIssue.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Details & Technical Diagnostics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">User Info</span>
                <div className="text-white font-bold">{selectedIssue.userName}</div>
                <div className="text-slate-400 capitalize">Role: <span className="text-slate-200">{selectedIssue.userRole}</span></div>
                {selectedIssue.userPhone && <div className="text-slate-400">Phone: <span className="text-slate-200">{selectedIssue.userPhone}</span></div>}
                {selectedIssue.userEmail && <div className="text-slate-400">Email: <span className="text-slate-200">{selectedIssue.userEmail}</span></div>}
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Technical Context</span>
                <div className="text-slate-400">Platform: <span className="text-slate-200">{selectedIssue.platform || 'mobile'}</span></div>
                <div className="text-slate-400">App Version: <span className="text-slate-200">{selectedIssue.appVersion || '1.0.0'}</span></div>
                {selectedIssue.httpStatus && <div className="text-slate-400">HTTP Status: <span className="text-amber-400 font-bold">{selectedIssue.httpStatus}</span></div>}
                {selectedIssue.durationMs && <div className="text-slate-400">Operation Duration: <span className="text-amber-400 font-bold">{(selectedIssue.durationMs / 1000).toFixed(1)}s</span></div>}
              </div>
            </div>

            {/* Problem Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">User Description</label>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedIssue.message}
              </div>
            </div>

            {/* Error Message if captured */}
            {selectedIssue.errorMessage && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-rose-400 uppercase tracking-wider block">Captured Error Stack / Notice</label>
                <div className="bg-rose-950/30 border border-rose-500/20 p-3 rounded-xl text-xs font-mono text-rose-300 break-all">
                  {selectedIssue.errorMessage}
                </div>
              </div>
            )}

            {/* Status & Priority Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Change Status</label>
                <select
                  value={selectedIssue.status}
                  onChange={(e) => handleUpdateStatus(selectedIssue._id, e.target.value, selectedIssue.priority)}
                  disabled={updatingStatus}
                  className="premium-input text-xs py-2"
                >
                  <option value="New">New</option>
                  <option value="In Review">In Review</option>
                  <option value="Investigating">Investigating</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Change Priority</label>
                <select
                  value={selectedIssue.priority}
                  onChange={(e) => handleUpdateStatus(selectedIssue._id, selectedIssue.status, e.target.value)}
                  disabled={updatingStatus}
                  className="premium-input text-xs py-2"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Internal Admin Notes */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Internal Admin Notes (Invisible to Users)</label>
              
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedIssue.internalNotes && selectedIssue.internalNotes.length > 0 ? (
                  selectedIssue.internalNotes.map((n, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="font-bold text-orange-400">{n.adminName}</span>
                        <span className="text-[10px]">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300">{n.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No internal notes added yet.</p>
                )}
              </div>

              {/* Add Note Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Write an internal note (e.g. Fixed in v1.2.4)..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="premium-input text-xs py-2 flex-1"
                />
                <button
                  onClick={() => handleAddNote(selectedIssue._id)}
                  disabled={addingNote || !newNoteText.trim()}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all inline-flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Add Note</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
