import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Search, ArrowUpRight, Award, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface SalaryRecord {
  _id: string;
  workerName: string;
  company: string;
  dailyRate: number;
  daysPresent: number;
  grossSalary: number;
  paidAmount: number;
  dueAmount: number;
  status: 'Fully Paid' | 'Partially Paid' | 'Due';
}

export default function SalaryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Fetch salaries
  const { data: salaries = [], isLoading } = useQuery<SalaryRecord[]>({
    queryKey: ['salaryLedger'],
    queryFn: async () => {
      const res = await api.get('/admin/salary');
      return res.data;
    }
  });

  const filteredSalaries = salaries.filter((s) => {
    return s.workerName.toLowerCase().includes(search.toLowerCase()) ||
           s.company.toLowerCase().includes(search.toLowerCase());
  });

  const totalGross = salaries.reduce((acc, curr) => acc + curr.grossSalary, 0);
  const totalPaid = salaries.reduce((acc, curr) => acc + curr.paidAmount, 0);
  const totalDue = salaries.reduce((acc, curr) => acc + curr.dueAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Wage & Salary Payouts</h1>
          <p className="text-slate-400 text-sm mt-1">Audit worker daily wage payroll distributions and outstanding liabilities</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['salaryLedger'] });
            toast.success('Salary records refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Gross Wages Incurred</p>
            <h3 className="text-2xl font-bold text-white">₹{totalGross.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Salary Disbursed</p>
            <h3 className="text-2xl font-bold text-white">₹{totalPaid.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Outstanding Wages Due</p>
            <h3 className="text-2xl font-bold text-rose-455">₹{totalDue.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by worker name or contractor company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Salary table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Worker Name</th>
                <th className="px-6 py-4.5">Client Organization</th>
                <th className="px-6 py-4.5">Daily Rate</th>
                <th className="px-6 py-4.5">Attended Days</th>
                <th className="px-6 py-4.5">Gross Wages</th>
                <th className="px-6 py-4.5">Amount Disbursed</th>
                <th className="px-6 py-4.5">Due Balance</th>
                <th className="px-6 py-4.5">Payout Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredSalaries.length > 0 ? (
                filteredSalaries.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{s.workerName}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{s.company}</td>
                    <td className="px-6 py-4 font-extrabold text-slate-300">₹{s.dailyRate}</td>
                    <td className="px-6 py-4 font-bold text-white">{s.daysPresent} Days</td>
                    <td className="px-6 py-4 font-extrabold text-white">₹{s.grossSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 font-extrabold text-slate-300">₹{s.paidAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 font-extrabold text-rose-450">₹{s.dueAmount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                        s.status === 'Fully Paid' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        s.status === 'Partially Paid' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-medium">
                    No payroll summaries generated.
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
