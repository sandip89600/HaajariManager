import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, Plus, Send, Search, RefreshCw, CheckCircle2, 
  AlertTriangle, ShieldAlert, Megaphone, Info, Radio, 
  Users, User, ExternalLink, X, Loader2, Mail, Eye, 
  Save, Smartphone, Monitor, Check, FileText, Sparkles
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

interface EmailHistoryItem {
  _id: string;
  subject: string;
  type: string;
  category: string;
  priority: string;
  recipients: string;
  heading: string;
  message: string;
  cta?: {
    enabled?: boolean;
    buttonText?: string;
    actionTarget?: string;
    customUrl?: string;
  };
  status: string;
  createdAt: string;
  sentAt?: string;
  createdByName?: string;
  deliveryStats?: {
    totalRecipients: number;
    successfulSends: number;
    failedSends: number;
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
  const [activeTab, setActiveTab] = useState<'inapp' | 'email'>('email');

  // Common Search & Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');

  // In-App Notification States
  const [showInAppModal, setShowInAppModal] = useState(false);
  const [showInAppConfirm, setShowInAppConfirm] = useState(false);
  const [inAppSending, setInAppSending] = useState(false);

  const [inAppTitle, setInAppTitle] = useState('');
  const [inAppMessage, setInAppMessage] = useState('');
  const [inAppType, setInAppType] = useState('general');
  const [inAppRecipientType, setInAppRecipientType] = useState('all');
  const [inAppSelectedUserIds, setInAppSelectedUserIds] = useState<string[]>([]);
  const [inAppActionTarget, setInAppActionTarget] = useState('none');
  const [inAppUserSearch, setInAppUserSearch] = useState('');

  // Email Notification States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  const [emailSending, setEmailSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  // Email Form Fields
  const [emailSubject, setEmailSubject] = useState('');
  const [emailType, setEmailType] = useState('Announcement');
  const [emailCategory, setEmailCategory] = useState('General');
  const [emailPriority, setEmailPriority] = useState<'Normal' | 'Important' | 'Urgent'>('Normal');
  const [selectedRecipientRoles, setSelectedRecipientRoles] = useState<string[]>(['All Users']);
  const [emailSpecificUserIds, setEmailSpecificUserIds] = useState<string[]>([]);
  const [userSearchText, setUserSearchText] = useState('');
  
  const [emailHeading, setEmailHeading] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  // CTA Fields
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaButtonText, setCtaButtonText] = useState('Open Haajari Manager');
  const [ctaActionTarget, setCtaActionTarget] = useState('Open Dashboard');
  const [ctaCustomUrl, setCtaCustomUrl] = useState('');

  // 1. Fetch In-App Notification History
  const { data: inAppHistoryData, isLoading: inAppLoading } = useQuery<{
    notifications: NotificationHistoryItem[];
  }>({
    queryKey: ['adminNotificationHistory'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications/history');
      return res.data;
    },
    enabled: activeTab === 'inapp',
  });

  // 2. Fetch Email Notification History
  const { data: emailHistoryData, isLoading: emailLoading } = useQuery<{
    notifications: EmailHistoryItem[];
  }>({
    queryKey: ['adminEmailHistory'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications/email/history');
      return res.data;
    },
    enabled: activeTab === 'email',
  });

  // 3. Fetch Recipients User List
  const { data: recipientsData } = useQuery<{ users: UserOption[] }>({
    queryKey: ['adminRecipientUsers'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications/recipients');
      return res.data;
    },
    enabled: showInAppModal || showEmailModal,
  });

  const recipientUsers = recipientsData?.users || [];
  const inAppHistoryList = inAppHistoryData?.notifications || [];
  const emailHistoryList = emailHistoryData?.notifications || [];

  const filteredRecipientUsers = recipientUsers.filter(
    (u) =>
      u.name.toLowerCase().includes((activeTab === 'email' ? userSearchText : inAppUserSearch).toLowerCase()) ||
      u.email.toLowerCase().includes((activeTab === 'email' ? userSearchText : inAppUserSearch).toLowerCase()) ||
      u.role.toLowerCase().includes((activeTab === 'email' ? userSearchText : inAppUserSearch).toLowerCase())
  );

  // Load Sample Notification Preset
  const handleLoadSampleNotification = () => {
    setEmailSubject('Haajari Manager — New Update Available 🚀');
    setEmailType('Announcement');
    setEmailCategory('Update');
    setEmailPriority('Important');
    setSelectedRecipientRoles(['All Users']);
    setEmailHeading('Haajari Manager is getting better! 🚀');
    setEmailMessage(
      "We're excited to share a new update from Haajari Manager.\n\n" +
      "We've improved the app experience to make workforce management simpler, faster and more efficient.\n\n" +
      "You can manage your workforce, attendance, payments, reports and site activities from one place.\n\n" +
      "Thank you for being part of the Haajari Manager journey. ❤️"
    );
    setCtaEnabled(true);
    setCtaButtonText('Open Haajari Manager');
    setCtaActionTarget('Open Dashboard');
    toast.success('Loaded sample update email notification');
  };

  // Toggle recipient roles for email
  const handleToggleRecipientRole = (role: string) => {
    if (role === 'All Users') {
      setSelectedRecipientRoles(['All Users']);
      setEmailSpecificUserIds([]);
    } else {
      let updated = selectedRecipientRoles.filter((r) => r !== 'All Users');
      if (updated.includes(role)) {
        updated = updated.filter((r) => r !== role);
      } else {
        updated.push(role);
      }
      if (updated.length === 0) updated = ['All Users'];
      setSelectedRecipientRoles(updated);
    }
  };

  const formatUserErrorMessage = (err: any): string => {
    if (!err.response) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    if (err.response.status === 401) {
      return 'Your admin session has expired. Please sign in again.';
    }
    if (err.response.status === 403) {
      return 'Unauthorized access. Only authorized Admin users can perform this action.';
    }
    return err.response?.data?.message || 'Unable to process request. Please try again.';
  };

  // Submit In-App Broadcast
  const handleConfirmInAppSend = async () => {
    setInAppSending(true);
    try {
      const res = await api.post('/admin/notifications/send', {
        title: inAppTitle.trim(),
        message: inAppMessage.trim(),
        type: inAppType,
        recipientType: inAppRecipientType,
        recipientIds: inAppSelectedUserIds,
        actionType: inAppActionTarget === 'none' ? 'none' : 'screen',
        actionTarget: inAppActionTarget,
      });

      if (res.data.success) {
        toast.success(`In-App broadcast sent to ${res.data.deliveryStats?.total || 1} recipients`);
        setShowInAppConfirm(false);
        setShowInAppModal(false);
        setInAppTitle('');
        setInAppMessage('');
        queryClient.invalidateQueries({ queryKey: ['adminNotificationHistory'] });
      }
    } catch (err: any) {
      toast.error(formatUserErrorMessage(err));
    } finally {
      setInAppSending(false);
    }
  };

  // Submit Test Email
  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid test email address');
      return;
    }
    if (!emailSubject.trim()) {
      toast.error('Email Subject is required for test email');
      return;
    }
    if (!emailHeading.trim()) {
      toast.error('Email Heading is required for test email');
      return;
    }

    console.log('[AdminEmailUI] Initiating Test Email send:', {
      testEmail: testEmailAddress.trim(),
      subject: emailSubject.trim(),
      heading: emailHeading.trim(),
    });

    setTestSending(true);
    try {
      const res = await api.post('/admin/notifications/email/test', {
        testEmail: testEmailAddress.trim(),
        subject: emailSubject.trim(),
        heading: emailHeading.trim(),
        message: emailMessage.trim(),
        cta: {
          enabled: ctaEnabled,
          buttonText: ctaButtonText,
          actionTarget: ctaActionTarget,
          customUrl: ctaCustomUrl,
        },
      });

      console.log('[AdminEmailUI] Test Email API Response:', res.data);

      if (res.data.success) {
        toast.success(res.data.message || `Test email sent to ${testEmailAddress.trim()}`);
        setShowTestModal(false);
      } else {
        toast.error(res.data.message || 'Failed to send test email');
      }
    } catch (err: any) {
      console.error('[AdminEmailUI] Error sending test email:', err.response?.data || err.message || err);
      toast.error(formatUserErrorMessage(err));
    } finally {
      setTestSending(false);
    }
  };

  // Save Email Draft
  const handleSaveDraft = async () => {
    console.log('[AdminEmailUI] Saving Email Draft:', {
      draftId: currentDraftId,
      subject: emailSubject.trim() || 'Untitled Draft',
    });
    setDraftSaving(true);
    try {
      const res = await api.post('/admin/notifications/email/draft', {
        draftId: currentDraftId,
        subject: emailSubject.trim() || 'Untitled Draft',
        type: emailType,
        category: emailCategory,
        priority: emailPriority,
        recipientRoles: selectedRecipientRoles,
        specificUserIds: emailSpecificUserIds,
        heading: emailHeading.trim(),
        message: emailMessage.trim(),
        cta: {
          enabled: ctaEnabled,
          buttonText: ctaButtonText,
          actionTarget: ctaActionTarget,
          customUrl: ctaCustomUrl,
        },
      });

      console.log('[AdminEmailUI] Save Draft API Response:', res.data);

      if (res.data.success) {
        toast.success('Email draft saved successfully');
        if (res.data.notification?._id) {
          setCurrentDraftId(res.data.notification._id);
        }
        queryClient.invalidateQueries({ queryKey: ['adminEmailHistory'] });
      }
    } catch (err: any) {
      console.error('[AdminEmailUI] Error saving draft:', err.response?.data || err.message || err);
      toast.error(formatUserErrorMessage(err));
    } finally {
      setDraftSaving(false);
    }
  };

  // Submit Final Email Broadcast Send
  const handleConfirmEmailSend = async () => {
    console.log('[AdminEmailUI] Initiating Final Email Broadcast Send:', {
      draftId: currentDraftId,
      subject: emailSubject.trim(),
      heading: emailHeading.trim(),
      roles: selectedRecipientRoles,
      specificUserIds: emailSpecificUserIds,
    });
    setEmailSending(true);
    try {
      const res = await api.post('/admin/notifications/email/send', {
        draftId: currentDraftId,
        subject: emailSubject.trim(),
        type: emailType,
        category: emailCategory,
        priority: emailPriority,
        recipientRoles: selectedRecipientRoles,
        specificUserIds: emailSpecificUserIds,
        heading: emailHeading.trim(),
        message: emailMessage.trim(),
        cta: {
          enabled: ctaEnabled,
          buttonText: ctaButtonText,
          actionTarget: ctaActionTarget,
          customUrl: ctaCustomUrl,
        },
      });

      console.log('[AdminEmailUI] Email Broadcast API Response:', res.data);

      if (res.data.success) {
        toast.success(res.data.message || 'Email notification sent successfully');
        setShowEmailConfirmModal(false);
        setShowEmailModal(false);
        // Reset Email Form
        setEmailSubject('');
        setEmailHeading('');
        setEmailMessage('');
        setCtaEnabled(false);
        setCurrentDraftId(null);
        queryClient.invalidateQueries({ queryKey: ['adminEmailHistory'] });
      } else {
        toast.error(res.data.message || 'Failed to send email notification');
      }
    } catch (err: any) {
      console.error('[AdminEmailUI] Error in handleConfirmEmailSend:', err.response?.data || err.message || err);
      toast.error(formatUserErrorMessage(err));
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            {activeTab === 'email' ? <Mail className="w-8 h-8 text-orange-500" /> : <Bell className="w-8 h-8 text-orange-500" />}
            Notification Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Send real-time mobile push notifications and branded HTML email broadcasts to workforce users.
          </p>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-850 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('email')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'email'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('inapp')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'inapp'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>In-App Push</span>
            </button>
          </div>

          {activeTab === 'email' ? (
            <button
              onClick={() => {
                setCurrentDraftId(null);
                setShowEmailModal(true);
              }}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Email Notification</span>
            </button>
          ) : (
            <button
              onClick={() => setShowInAppModal(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create In-App Alert</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder={activeTab === 'email' ? "Search email subject or content..." : "Search in-app alerts..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => {
              if (activeTab === 'email') queryClient.invalidateQueries({ queryKey: ['adminEmailHistory'] });
              else queryClient.invalidateQueries({ queryKey: ['adminNotificationHistory'] });
              toast.success('History refreshed');
            }}
            className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm mr-2"
          >
            <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: EMAIL NOTIFICATIONS TABLE ───────────────────────────── */}
      {activeTab === 'email' && (
        <div className="glass-card rounded-2xl border border-slate-850 p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-extrabold text-white">Email Notification History & Drafts</h2>
            <span className="text-xs text-slate-400 font-semibold">{emailHistoryList.length} Total Records</span>
          </div>

          {emailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : emailHistoryList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Subject & Heading</th>
                    <th className="py-3 px-4">Type & Category</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Recipients</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Delivery Stats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300 font-medium">
                  {emailHistoryList.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-4 px-4 max-w-md">
                        <span className="font-extrabold text-white text-sm block">{item.subject}</span>
                        <span className="text-slate-400 text-xs mt-0.5 block line-clamp-1">{item.heading}</span>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="bg-slate-900 border border-slate-800 text-orange-400 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase block w-fit">
                            {item.type}
                          </span>
                          <span className="text-slate-400 text-[10px] block">{item.category}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                            item.priority === 'Urgent'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : item.priority === 'Important'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap text-slate-300 font-semibold">{item.recipients}</td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                            item.status === 'Sent'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : item.status === 'Draft'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {item.status === 'Sent' && <CheckCircle2 className="w-3 h-3" />}
                          {item.status === 'Draft' && <FileText className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap text-slate-400 text-xs">
                        {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {item.status === 'Draft' ? (
                          <span className="text-slate-500 text-[11px]">Not Sent Yet</span>
                        ) : (
                          <div className="text-[11px] font-bold text-slate-400">
                            <span className="text-orange-400 font-extrabold">{item.deliveryStats?.totalRecipients || 1}</span> recipients
                            <span className="text-slate-600 mx-1.5">•</span>
                            <span className="text-emerald-400">{item.deliveryStats?.successfulSends || 1}</span> sent
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 font-medium">
              No email notifications found in history. Click <strong>Create Email Notification</strong> to start!
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: IN-APP BROADCAST HISTORY ────────────────────────────── */}
      {activeTab === 'inapp' && (
        <div className="glass-card rounded-2xl border border-slate-850 p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-white mb-2">In-App Broadcast History</h2>
          {inAppLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : inAppHistoryList.length > 0 ? (
            <div className="divide-y divide-slate-850/40">
              {inAppHistoryList.map((item) => (
                <div key={item._id} className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-white text-sm">{item.title}</span>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-orange-400 font-bold uppercase px-2 py-0.5 rounded">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-2xl">{item.message}</p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">No in-app broadcasts found.</div>
          )}
        </div>
      )}

      {/* ── CREATE EMAIL NOTIFICATION MODAL ─────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-800 p-6 space-y-6 shadow-2xl overflow-y-auto my-auto animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">Create Email Notification</h2>
                  <p className="text-xs text-slate-400">Configure and send branded email broadcasts to workforce recipients</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSampleNotification}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-orange-500/40 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Load Sample Preset</span>
                </button>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Email Form Sections */}
            <div className="space-y-6">
              {/* SECTION 1: EMAIL DETAILS */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-orange-400 uppercase tracking-widest border-b border-slate-850/60 pb-1">
                  1. Email Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="font-bold text-xs text-slate-300">Email Subject *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Haajari Manager — New Update Available 🚀"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="premium-input text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-xs text-slate-300">Notification Type</label>
                    <select
                      value={emailType}
                      onChange={(e) => setEmailType(e.target.value)}
                      className="premium-input text-sm bg-slate-900"
                    >
                      <option value="Announcement">Announcement</option>
                      <option value="Update">Update</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Security">Security</option>
                      <option value="Reminder">Reminder</option>
                      <option value="Promotional">Promotional</option>
                      <option value="System">System</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-xs text-slate-300">Category</label>
                    <select
                      value={emailCategory}
                      onChange={(e) => setEmailCategory(e.target.value)}
                      className="premium-input text-sm bg-slate-900"
                    >
                      <option value="General">General</option>
                      <option value="Attendance">Attendance</option>
                      <option value="Workforce">Workforce</option>
                      <option value="Payment">Payment</option>
                      <option value="Site Management">Site Management</option>
                      <option value="Reports">Reports</option>
                      <option value="Security">Security</option>
                      <option value="System Update">System Update</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="font-bold text-xs text-slate-300">Priority Level</label>
                    <div className="flex items-center gap-4 pt-1">
                      {['Normal', 'Important', 'Urgent'].map((p) => (
                        <label key={p} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                          <input
                            type="radio"
                            name="priority"
                            checked={emailPriority === p}
                            onChange={() => setEmailPriority(p as any)}
                            className="accent-orange-500"
                          />
                          <span>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: RECIPIENTS */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-orange-400 uppercase tracking-widest border-b border-slate-850/60 pb-1">
                  2. Recipients
                </h3>

                <div className="space-y-2">
                  <label className="font-bold text-xs text-slate-300 block">Select Recipient Group(s) *</label>
                  <div className="flex flex-wrap gap-3">
                    {['All Users', 'Contractor', 'Supervisor', 'Worker', 'User'].map((role) => {
                      const isChecked = selectedRecipientRoles.includes(role);
                      return (
                        <label
                          key={role}
                          onClick={() => handleToggleRecipientRole(role)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all flex items-center gap-2 ${
                            isChecked
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/40 shadow-sm'
                              : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:border-slate-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-700'}`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span>{role}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 3: EMAIL CONTENT */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-orange-400 uppercase tracking-widest border-b border-slate-850/60 pb-1">
                  3. Email Content
                </h3>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-xs text-slate-300">Email Heading *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Haajari Manager is getting better! 🚀"
                      value={emailHeading}
                      onChange={(e) => setEmailHeading(e.target.value)}
                      className="premium-input text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-xs text-slate-300">Message Body Content *</label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Write message paragraphs. Paragraph breaks and formatting will be rendered cleanly in the email template..."
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      className="premium-input text-sm leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: CALL TO ACTION (CTA) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-850/60 pb-1">
                  <h3 className="text-xs font-extrabold text-orange-400 uppercase tracking-widest">
                    4. Call To Action (CTA)
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <span>CTA Button Enabled:</span>
                    <button
                      type="button"
                      onClick={() => setCtaEnabled(!ctaEnabled)}
                      className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all border ${
                        ctaEnabled
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {ctaEnabled ? 'ON' : 'OFF'}
                    </button>
                  </label>
                </div>

                {ctaEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-850">
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs text-slate-300">Button Text</label>
                      <input
                        type="text"
                        placeholder="Open Haajari Manager"
                        value={ctaButtonText}
                        onChange={(e) => setCtaButtonText(e.target.value)}
                        className="premium-input text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-xs text-slate-300">Action Link Target</label>
                      <select
                        value={ctaActionTarget}
                        onChange={(e) => setCtaActionTarget(e.target.value)}
                        className="premium-input text-sm bg-slate-900"
                      >
                        <option value="Open Dashboard">Open Dashboard</option>
                        <option value="Open Attendance">Open Attendance</option>
                        <option value="Open Workers">Open Workers</option>
                        <option value="Open Reports">Open Reports</option>
                        <option value="Open Profile">Open Profile</option>
                        <option value="Open Site Management">Open Site Management</option>
                        <option value="Custom Link">Custom Link</option>
                      </select>
                    </div>

                    {ctaActionTarget === 'Custom Link' && (
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="font-bold text-xs text-slate-300">Custom Deep Link / URL *</label>
                        <input
                          type="url"
                          placeholder="https://haajarimanager.onrender.com"
                          value={ctaCustomUrl}
                          onChange={(e) => setCtaCustomUrl(e.target.value)}
                          className="premium-input text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Action Footer Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-orange-500/40 transition-all flex items-center gap-2"
              >
                <Eye className="w-4 h-4 text-orange-400" />
                <span>Preview Email</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={draftSaving}
                  onClick={handleSaveDraft}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-all flex items-center gap-2"
                >
                  {draftSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTestModal(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!emailSubject.trim()) return toast.error('Subject is required');
                    if (!emailHeading.trim()) return toast.error('Heading is required');
                    if (!emailMessage.trim()) return toast.error('Message content is required');
                    setShowEmailConfirmModal(true);
                  }}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Notification</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE EMAIL PREVIEW MODAL ────────────────────────────────────── */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card w-full max-w-3xl rounded-2xl border border-slate-800 p-6 space-y-6 shadow-2xl my-auto animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-extrabold text-white">Live Email Preview</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-850 flex items-center gap-1">
                  <button
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      previewViewport === 'desktop' ? 'bg-orange-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop
                  </button>
                  <button
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      previewViewport === 'mobile' ? 'bg-orange-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile
                  </button>
                </div>
                <button onClick={() => setShowPreviewModal(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Email Render Box */}
            <div className="flex justify-center bg-slate-950 p-4 rounded-xl border border-slate-850">
              <div
                className={`bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
                  previewViewport === 'mobile' ? 'w-[360px]' : 'w-full max-w-2xl'
                }`}
              >
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white text-center">
                  <h1 className="text-2xl font-black font-display tracking-tight">HAAJARI MANAGER</h1>
                  <p className="text-xs font-semibold opacity-90 mt-1 uppercase tracking-widest">Enterprise Workforce Platform</p>
                </div>

                {/* Email Content Body */}
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{emailHeading || 'Email Heading Title'}</h2>
                  <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-line">
                    {emailMessage || 'Message content body will render here...'}
                  </div>

                  {ctaEnabled && (
                    <div className="text-center py-4">
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-sm px-7 py-3 rounded-xl shadow-lg shadow-orange-500/20"
                      >
                        {ctaButtonText || 'Open Haajari Manager'}
                      </a>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-slate-900/80 border-t border-slate-800 p-4 text-center text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-slate-300">Haajari Manager</p>
                  <p className="text-[11px] text-slate-500">Manage Workforce. Empower Growth.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TEST EMAIL MODAL ───────────────────────────────────────────── */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-extrabold text-white">Send Test Email</h3>
              </div>
              <button onClick={() => setShowTestModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your email address to receive a live test preview of this email notification.
              </p>

              <div className="space-y-1.5">
                <label className="font-bold text-xs text-slate-300">Test Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="test@example.com"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="premium-input text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={testSending}
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={testSending}
                onClick={handleSendTestEmail}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Test Email</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL CONFIRMATION MODAL ───────────────────────────────────── */}
      {showEmailConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Confirm Email Broadcast</h3>
                <p className="text-xs text-slate-400 mt-0.5">Are you sure you want to send this email notification?</p>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-850 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Subject:</span>
                <span className="text-white font-extrabold block mt-0.5">{emailSubject}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Recipients:</span>
                <span className="text-orange-400 font-bold block">{selectedRecipientRoles.join(', ')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={emailSending}
                onClick={() => setShowEmailConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={emailSending}
                onClick={handleConfirmEmailSend}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {emailSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Emails...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Email Notification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IN-APP CREATION & CONFIRMATION MODALS ──────────────────────── */}
      {showInAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-xl rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-extrabold text-white">Create In-App Alert</h3>
              </div>
              <button onClick={() => setShowInAppModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="In-app notification title"
                  value={inAppTitle}
                  onChange={(e) => setInAppTitle(e.target.value)}
                  className="premium-input py-2 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Recipients *</label>
                <select
                  value={inAppRecipientType}
                  onChange={(e) => setInAppRecipientType(e.target.value)}
                  className="premium-input py-2 bg-slate-900 text-sm"
                >
                  <option value="all">All Users</option>
                  <option value="contractor">Contractors</option>
                  <option value="supervisor">Supervisors</option>
                  <option value="worker">Workers</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Message Content *</label>
                <textarea
                  rows={4}
                  placeholder="In-app notification message text..."
                  value={inAppMessage}
                  onChange={(e) => setInAppMessage(e.target.value)}
                  className="premium-input text-sm leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-850">
              <button
                onClick={() => setShowInAppModal(false)}
                className="px-4 py-2 rounded-xl font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowInAppConfirm(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2 rounded-xl transition-all"
              >
                Send In-App Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {showInAppConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-extrabold text-white">Confirm In-App Send</h3>
            <p className="text-xs text-slate-300">Are you sure you want to broadcast this in-app alert?</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowInAppConfirm(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400">
                Cancel
              </button>
              <button
                disabled={inAppSending}
                onClick={handleConfirmInAppSend}
                className="bg-orange-500 text-white font-bold px-5 py-2 rounded-xl text-xs"
              >
                {inAppSending ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
