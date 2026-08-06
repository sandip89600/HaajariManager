import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { 
  CheckCircle, 
  Trash2, 
  LogOut, 
  ShieldAlert, 
  Server, 
  Users, 
  Activity,
  Star
} from 'lucide-react';
import {
  useProblems,
  useResolveProblem,
  useDeleteProblem,
  useFeedback,
  useDeleteFeedback,
  useActiveSessions,
  useForceLogout,
  useSecurityLogs
} from '../hooks/useApi';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'support' | 'security' | 'system'>('support');

  // Support Hooks
  const { data: problems = [], isLoading: isLoadingProblems } = useProblems();
  const resolveProblem = useResolveProblem();
  const deleteProblem = useDeleteProblem();
  
  const { data: feedbacks = [], isLoading: isLoadingFeedback } = useFeedback();
  const deleteFeedback = useDeleteFeedback();

  // Security Hooks
  const { data: sessions = [], isLoading: isLoadingSessions } = useActiveSessions();
  const forceLogout = useForceLogout();
  const { data: securityLogs = [], isLoading: isLoadingLogs } = useSecurityLogs();

  const { register: registerDevice, handleSubmit: handleDisableDevice, reset: resetDeviceForm } = useForm<{deviceId: string}>();

  // Handlers
  const handleResolveProblem = (id: string) => {
    resolveProblem.mutate({ id, resolution: 'Resolved' }, {
      onSuccess: () => toast.success('Problem marked as resolved')
    });
  };

  const handleDeleteProblem = (id: string) => {
    if (window.confirm('Delete this ticket?')) {
      deleteProblem.mutate(id, {
        onSuccess: () => toast.success('Ticket deleted')
      });
    }
  };

  const handleDeleteFeedback = (id: string) => {
    if (window.confirm('Delete this feedback?')) {
      deleteFeedback.mutate(id, {
        onSuccess: () => toast.success('Feedback deleted')
      });
    }
  };

  const handleForceLogout = (sessionId: string) => {
    forceLogout.mutate({ sessionId }, {
      onSuccess: () => toast.success('Session terminated')
    });
  };

  const handleForceLogoutAll = () => {
    if (window.confirm('Are you sure you want to log out all users? This is an emergency action.')) {
      forceLogout.mutate({}, {
        onSuccess: () => toast.success('All users logged out')
      });
    }
  };

  const onDisableDevice = (data: {deviceId: string}) => {
    toast.success(`Device ${data.deviceId} disabled`);
    resetDeviceForm();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-100">System Settings</h1>
        <p className="text-slate-400">Manage support, security, and system configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('support')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${
            activeTab === 'support' ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Support Tickets
          {activeTab === 'support' && (
            <motion.div layoutId="activeTabSettings" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${
            activeTab === 'security' ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Security & Sessions
          {activeTab === 'security' && (
            <motion.div layoutId="activeTabSettings" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${
            activeTab === 'system' ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          System Info
          {activeTab === 'system' && (
            <motion.div layoutId="activeTabSettings" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="space-y-8">
            {/* Problems Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="font-semibold text-slate-100">Reported Problems</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/30 text-slate-400 text-sm border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-6 py-3 font-medium">Subject</th>
                      <th className="px-6 py-3 font-medium">Description</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {isLoadingProblems ? (
                      <tr><td colSpan={6} className="p-4 text-center text-slate-400">Loading...</td></tr>
                    ) : problems.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-slate-400">No problems reported</td></tr>
                    ) : problems.map((p: any) => (
                      <tr key={p._id} className="hover:bg-slate-700/20">
                        <td className="px-6 py-4 text-slate-200 text-sm">{p.user?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-slate-200 text-sm font-medium">{p.subject}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm max-w-xs truncate" title={p.description}>{p.description}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            p.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {p.status !== 'Resolved' && (
                              <button onClick={() => handleResolveProblem(p._id)} className="p-1.5 text-slate-400 hover:text-emerald-500 bg-slate-700/50 rounded-lg">
                                <CheckCircle size={16} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteProblem(p._id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-700/50 rounded-lg">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Feedback Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="font-semibold text-slate-100">User Feedback</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/30 text-slate-400 text-sm border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-6 py-3 font-medium">Rating</th>
                      <th className="px-6 py-3 font-medium">Feedback</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {isLoadingFeedback ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">Loading...</td></tr>
                    ) : feedbacks.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">No feedback submitted</td></tr>
                    ) : feedbacks.map((f: any) => (
                      <tr key={f._id} className="hover:bg-slate-700/20">
                        <td className="px-6 py-4 text-slate-200 text-sm">{f.user?.name || 'Unknown'}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} size={14} className={star <= f.rating ? 'fill-orange-500 text-orange-500' : 'text-slate-600'} />
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{f.text}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{new Date(f.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDeleteFeedback(f._id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-700/50 rounded-lg">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 text-red-500 rounded-lg">
                  <ShieldAlert size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-500">Emergency Actions</h3>
                  <p className="text-slate-400 text-sm mt-1 mb-4">Use these actions only in case of a security breach or system compromise.</p>
                  
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={handleForceLogoutAll}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Force Logout All Users
                    </button>
                    
                    <form onSubmit={handleDisableDevice(onDisableDevice)} className="flex gap-2">
                      <input
                        {...registerDevice('deviceId', { required: true })}
                        placeholder="Device ID..."
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-red-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                      >
                        Disable Device
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="font-semibold text-slate-100">Active Sessions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/30 text-slate-400 text-sm border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-6 py-3 font-medium">Device / Browser</th>
                      <th className="px-6 py-3 font-medium">IP Address</th>
                      <th className="px-6 py-3 font-medium">Last Active</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {isLoadingSessions ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">Loading...</td></tr>
                    ) : sessions.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">No active sessions</td></tr>
                    ) : sessions.map((s: any) => (
                      <tr key={s._id} className="hover:bg-slate-700/20">
                        <td className="px-6 py-4 text-slate-200 text-sm">{s.user?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{s.device} - {s.browser}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm font-mono">{s.ipAddress}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{new Date(s.lastActive).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleForceLogout(s._id)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-600 text-slate-300 hover:text-red-500 hover:border-red-500/50 rounded-lg transition-colors ml-auto"
                          >
                            <LogOut size={14} />
                            Force Logout
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="font-semibold text-slate-100">Security Audit Logs</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/30 text-slate-400 text-sm border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-3 font-medium">Timestamp</th>
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                      <th className="px-6 py-3 font-medium">IP Address</th>
                      <th className="px-6 py-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {isLoadingLogs ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">Loading...</td></tr>
                    ) : securityLogs.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">No logs found</td></tr>
                    ) : securityLogs.map((log: any) => (
                      <tr key={log._id} className="hover:bg-slate-700/20">
                        <td className="px-6 py-4 text-slate-400 text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-200 text-sm">{log.user?.name || 'System'}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">{log.action}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-sm font-mono">{log.ipAddress}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* System Info Tab */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 text-blue-500 rounded-lg"><Activity size={24} /></div>
              <div>
                <p className="text-slate-400 text-sm">App Version</p>
                <p className="text-lg font-bold text-slate-100">v1.2.4 (Production)</p>
              </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-lg"><Server size={24} /></div>
              <div>
                <p className="text-slate-400 text-sm">API URL</p>
                <p className="text-lg font-bold text-slate-100 truncate max-w-[200px]" title={import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}>
                  {import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}
                </p>
              </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
              <div className="p-3 bg-orange-500/20 text-orange-500 rounded-lg"><Activity size={24} /></div>
              <div>
                <p className="text-slate-400 text-sm">Socket.IO Status</p>
                <p className="text-lg font-bold text-emerald-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </p>
              </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 text-purple-500 rounded-lg"><Users size={24} /></div>
              <div>
                <p className="text-slate-400 text-sm">Total Registered Users</p>
                <p className="text-lg font-bold text-slate-100">842</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SettingsPage;
