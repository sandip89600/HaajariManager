import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, DollarSign, ArrowUpRight, ArrowDownLeft, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface PaymentRecord {
  _id: string;
  transactionId?: string;
  tenantId?: { _id: string; name: string };
  workerId?: { _id: string; name: string };
  amount: number;
  paidAt: string;
  status: 'Completed' | 'Pending' | 'Failed';
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await api.get('/admin/payments');
      return res.data;
    }
  });

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = (p.tenantId?.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.workerId?.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.transactionId || '').toLowerCase().includes(search.toLowerCase()) ||
                          p._id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInvoiced = payments.filter(p => p.status === 'Completed').reduce((acc, curr) => acc + curr.amount, 0);
  const totalFailed = payments.filter(p => p.status === 'Failed').reduce((acc, curr) => acc + curr.amount, 0);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Payroll Payment Ledger</h1>
          <p className="text-slate-400 text-sm mt-1">Audit worker daily wage payroll transactions and payout logs</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            toast.success('Payments ledger refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Disbursed</p>
            <h3 className="text-2xl font-bold text-white">₹{totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Live collections
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Failed Attempts</p>
            <h3 className="text-2xl font-bold text-white">₹{totalFailed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-0.5 mt-1">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Declines/reversals
            </span>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pending Payouts</p>
            <h3 className="text-2xl font-bold text-white">₹{totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5 mt-1">
              <Clock className="w-3.5 h-3.5" /> Awaiting approval
            </span>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by worker, organization or transaction ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 pr-8 w-36 appearance-none"
          >
            <option>All</option>
            <option>Completed</option>
            <option>Pending</option>
            <option>Failed</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Transaction ID</th>
                <th className="px-6 py-4.5">Client Organization</th>
                <th className="px-6 py-4.5">Worker Name</th>
                <th className="px-6 py-4.5">Total Amount</th>
                <th className="px-6 py-4.5">Payment Date</th>
                <th className="px-6 py-4.5">Transaction Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white tracking-wider">{p.transactionId || p._id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{p.tenantId?.name || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-slate-300">{p.workerId?.name || 'N/A'}</td>
                    <td className="px-6 py-4 font-extrabold text-white">₹{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{new Date(p.paidAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                        p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        p.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {p.status || 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 font-medium">
                    No transactions matching parameters.
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
