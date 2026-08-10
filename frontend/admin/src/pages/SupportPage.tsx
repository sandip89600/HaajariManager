import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Search, Mail, MessageSquare, ChevronDown, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface SupportTicket {
  _id: string;
  ticketId: string;
  company: string;
  issue: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Resolved' | 'Closed';
  createdAt: string;
}

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Fetch support tickets
  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['supportTicketsList'],
    queryFn: async () => {
      const res = await api.get('/admin/support');
      return res.data;
    }
  });

  const faqs = [
    { q: 'How do I upgrade a client organization plan?', a: 'Navigate to the Users or Organizations tab, click the "Upgrade" action button on the corresponding row, and select the plan tier (Basic, Super, Premium) in the modal popup.' },
    { q: 'What are the GPS radius validation limits?', a: 'GPS boundaries are defined globally inside the System Settings panel. Client sites enforce this geofencing radius parameter (e.g. 150 meters) when supervisors mark workers present.' },
    { q: 'Where are database backups stored?', a: 'System backup configurations are integrated into the global setting profiles. Full database dumps can be automatically synced to Amazon S3 buckets or downloaded locally.' },
  ];

  const filteredTickets = tickets.filter((t) => {
    return t.company.toLowerCase().includes(search.toLowerCase()) || 
           t.issue.toLowerCase().includes(search.toLowerCase()) ||
           t.ticketId.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Support & Customer Tickets</h1>
          <p className="text-slate-400 text-sm mt-1">Audit active client inquiries, system bugs, and administrative assistance logs</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['supportTicketsList'] });
            toast.success('Support tickets refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support tickets listing */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-850 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Active Inquiries
            </h3>
            <div className="relative max-w-xs w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-555" />
              <input
                type="text"
                placeholder="Search ticket ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="premium-input pl-9 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-850/40">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((t) => (
                <div key={t._id} className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-white text-sm">{t.ticketId}</span>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-450 font-bold uppercase px-2 py-0.5 rounded">
                        {t.company}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'High' ? 'bg-rose-500/10 text-rose-400' :
                        t.priority === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {t.priority} Priority
                      </span>
                    </div>
                    <p className="text-xs text-slate-450 mt-1.5 leading-normal max-w-lg">{t.issue}</p>
                    <span className="block text-[10px] text-slate-550 mt-1 font-semibold">Logged: {t.createdAt}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    t.status === 'Open' ? 'bg-rose-500/10 text-rose-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 font-medium">
                No tickets matching queries.
              </div>
            )}
          </div>
        </div>

        {/* FAQs */}
        <div className="glass-card p-6 rounded-2xl border border-slate-850 h-fit space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-orange-500" />
            Knowledge Base FAQs
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-slate-850 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-900/40 text-left hover:bg-slate-900/80 transition-colors"
                >
                  <span className="text-xs font-bold text-slate-200">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-450 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-3.5 bg-slate-950/60 border-t border-slate-850/60">
                    <p className="text-xs text-slate-400 leading-normal">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
