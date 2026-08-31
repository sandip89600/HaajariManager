import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, Plus, Send, Search, RefreshCw, CheckCircle2, 
  AlertTriangle, ShieldAlert, Megaphone, Info, Radio, 
  Users, User, ExternalLink, X, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface NotificationHistoryItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  recipientType: string;
  recipientName?: string;
  senderName?: string;
  createdAt: string;
  status: string;
  deliveryStats?: {
    total: number;
    socketSent: number;
    pushSent: number;
  };
}

interface UserOption {
  _id: string;
  name: string;
  email: string;
  role: string;
  company: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('general');
  const [recipientType, setRecipientType] = useState('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [actionTarget, setActionTarget] = useState('none');
  const [userSearchText, setUserSearchText] = useState('');

  // 1. Fetch Sent Notification History
  const { data: historyData, isLoading: historyLoading } = useQuery<{
    notifications: NotificationHistoryItem[];
  }>({
    queryKey: ['adminNotificationHistory'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications/history');
      return res.data;
    },
  });

  const historyList = historyData?.notifications || [];

  // 2. Fetch Recipient Users List
  const { data: recipientsData } = useQuery<{ users: UserOption[] }>({
    queryKey: ['adminRecipientUsers'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications/recipients');
      return res.data;
    },
    enabled: showCreateModal,
  });

  const recipientUsers = recipientsData?.users || [];

  const filteredRecipientUsers = recipientUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearchText.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchText.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearchText.toLowerCase())
  );

  // Filter Notification History
  const filteredHistory = historyList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.message.toLowerCase().includes(search.toLowerCase()) ||
      (item.recipientName && item.recipientName.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === 'All' || item.type.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  // Validation before opening confirmation
  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!message.trim()) {
      toast.error('Message is required');
      return;
    }
    if (title.length > 100) {
      toast.error('Title exceeds maximum 100 characters');
      return;
    }
    if (message.length > 1000) {
      toast.error('Message exceeds maximum 1000 characters');
      return;
    }
    if ((recipientType === 'user' || recipientType === 'multiple_users') && selectedUserIds.length === 0) {
      toast.error('Please select at least one specific user');
      return;
    }

    setShowConfirmModal(true);
  };

  // Submit Notification Send API
  const handleConfirmSend = async () => {
    setIsSending(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        recipientType,
        recipientIds: selectedUserIds,
        actionType: actionTarget === 'none' ? 'none' : 'screen',
        actionTarget,
      };

      const res = await api.post('/admin/notifications/send', payload);
      
      if (res.data.success) {
        toast.success(`Notification sent successfully to ${res.data.deliveryStats?.total || 1} recipients`);
        setShowConfirmModal(false);
        setShowCreateModal(false);
        // Reset form
        setTitle('');
        setMessage('');
        setType('general');
        setRecipientType('all');
        setSelectedUserIds([]);
        setActionTarget('none');
        
        queryClient.invalidateQueries({ queryKey: ['adminNotificationHistory'] });
      } else {
        toast.error(res.data.message || 'Failed to send notification');
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Unable to send notification. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case 'announcement':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 font-bold px-2 py-0.5 rounded-full uppercase">
            <Megaphone className="w-3 h-3" /> Announcement
          </span>
        );
      case 'important':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded-full uppercase">
            <AlertTriangle className="w-3 h-3" /> Important
          </span>
        );
      case 'update':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold px-2 py-0.5 rounded-full uppercase">
            <Info className="w-3 h-3" /> Update
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold px-2 py-0.5 rounded-full uppercase">
            <Radio className="w-3 h-3" /> Maintenance
          </span>
        );
      case 'security':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold px-2 py-0.5 rounded-full uppercase">
            <ShieldAlert className="w-3 h-3" /> Security
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-full uppercase">
            <Bell className="w-3 h-3" /> General
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-orange-500" />
            Notification Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Broadcast real-time push alerts, system announcements, and targeted updates to mobile app users.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['adminNotificationHistory'] });
              toast.success('Notification history refreshed');
            }}
            disabled={historyLoading}
            className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${historyLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Notification</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search notification history by title or text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['All', 'General', 'Announcement', 'Important', 'Update', 'Maintenance', 'Security'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                filterType === t
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-slate-900/50 text-slate-400 border-slate-850 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Notification History Log Table */}
      <div className="glass-card rounded-2xl border border-slate-850 p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-white mb-2">Broadcast History & Delivery Log</h2>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : filteredHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Recipients</th>
                  <th className="py-3 px-4">Sent Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Delivery Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-slate-300 font-medium">
                {filteredHistory.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 px-4 max-w-md">
                      <span className="font-extrabold text-white text-sm block">{item.title}</span>
                      <p className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">{item.message}</p>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">{getTypeBadge(item.type)}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase">
                        {item.recipientType === 'all'
                          ? 'All Users'
                          : item.recipientType === 'contractor'
                          ? 'Contractors'
                          : item.recipientType === 'supervisor'
                          ? 'Supervisors'
                          : item.recipientType === 'worker'
                          ? 'Workers'
                          : item.recipientName || 'Specific Users'}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-slate-400 text-xs">
                      {new Date(item.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" /> Sent
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span className="text-orange-400 font-extrabold">{item.deliveryStats?.total || 1}</span> targeted
                        <span className="text-slate-600 mx-1.5">•</span>
                        <span className="text-emerald-400">{item.deliveryStats?.socketSent || 1}</span> live socket
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 font-medium">
            No broadcast notifications found in history matching filters.
          </div>
        )}
      </div>

      {/* ── CREATE NOTIFICATION MODAL ───────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl rounded-2xl border border-slate-800 p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-850 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                  <Megaphone className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">Create New Notification</h2>
                  <p className="text-xs text-slate-400">Send an instant alert or announcement to app users</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInitiateSend} className="space-y-4">
              {/* Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-300">Notification Title *</label>
                    <span className={`text-[11px] font-mono ${title.length > 100 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                      {title.length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. System Maintenance Scheduled"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="premium-input text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-xs text-slate-300">Type Category</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="premium-input text-sm bg-slate-900"
                  >
                    <option value="general">General</option>
                    <option value="announcement">Announcement</option>
                    <option value="important">Important</option>
                    <option value="update">Update</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="security">Security</option>
                  </select>
                </div>
              </div>

              {/* Recipients & Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-xs text-slate-300">Recipients *</label>
                  <select
                    value={recipientType}
                    onChange={(e) => {
                      setRecipientType(e.target.value);
                      setSelectedUserIds([]);
                    }}
                    className="premium-input text-sm bg-slate-900"
                  >
                    <option value="all">All Users</option>
                    <option value="contractor">All Contractors</option>
                    <option value="supervisor">All Supervisors</option>
                    <option value="worker">All Workers</option>
                    <option value="user">Specific User</option>
                    <option value="multiple_users">Multiple Specific Users</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-xs text-slate-300">Optional Action / Deep Link</label>
                  <select
                    value={actionTarget}
                    onChange={(e) => setActionTarget(e.target.value)}
                    className="premium-input text-sm bg-slate-900"
                  >
                    <option value="none">None</option>
                    <option value="Open Reports">Open Reports</option>
                    <option value="Open Profile">Open Profile</option>
                    <option value="Open Site Management">Open Site Management</option>
                    <option value="Open Workers">Open Workers</option>
                    <option value="Open Attendance">Open Attendance</option>
                  </select>
                </div>
              </div>

              {/* Searchable User Selector if Specific User chosen */}
              {(recipientType === 'user' || recipientType === 'multiple_users') && (
                <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-850">
                  <label className="font-bold text-xs text-slate-300 block">
                    Select Targeted User(s) ({selectedUserIds.length} selected)
                  </label>
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    className="premium-input text-xs py-2"
                  />
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 mt-2">
                    {filteredRecipientUsers.map((u) => {
                      const isSelected = selectedUserIds.includes(u._id);
                      return (
                        <div
                          key={u._id}
                          onClick={() => {
                            if (recipientType === 'user') {
                              setSelectedUserIds([u._id]);
                            } else {
                              if (isSelected) {
                                setSelectedUserIds(selectedUserIds.filter((id) => id !== u._id));
                              } else {
                                setSelectedUserIds([...selectedUserIds, u._id]);
                              }
                            }
                          }}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer border transition-colors ${
                            isSelected
                              ? 'bg-orange-500/10 border-orange-500/40 text-white'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-slate-200 block">{u.name}</span>
                            <span className="text-[10px] text-slate-500">{u.email} • {u.role}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-300">Message Content *</label>
                  <span className={`text-[11px] font-mono ${message.length > 1000 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                    {message.length}/1000
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  placeholder="Write message content to deliver to mobile app users..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="premium-input text-sm leading-relaxed"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Notification</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL ─────────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Confirm Broadcast Send</h3>
                <p className="text-xs text-slate-400 mt-0.5">Verify recipient targeting before dispatching</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-slate-850">
              Are you sure you want to send this notification <strong className="text-white">"{title}"</strong> to{' '}
              <strong className="text-orange-400 uppercase">
                {recipientType === 'all'
                  ? 'All Users'
                  : recipientType === 'contractor'
                  ? 'All Contractors'
                  : recipientType === 'supervisor'
                  ? 'All Supervisors'
                  : recipientType === 'worker'
                  ? 'All Workers'
                  : `${selectedUserIds.length} Selected User(s)`}
              </strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isSending}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-all"
              >
                Cancel
              </button>
              <button
                disabled={isSending}
                onClick={handleConfirmSend}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
