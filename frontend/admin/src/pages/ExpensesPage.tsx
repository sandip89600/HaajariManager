import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingDown, Search, Filter, DollarSign, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface ExpenseItem {
  _id: string;
  description: string;
  category: 'Fuel' | 'Materials' | 'Machinery Lease' | 'Rent' | 'Labor' | 'Other';
  amount: number;
  date: string;
  company: string;
  status: 'Approved' | 'Pending' | 'Rejected';
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Fetch expenses
  const { data: expenses = [], isLoading } = useQuery<ExpenseItem[]>({
    queryKey: ['expensesList'],
    queryFn: async () => {
      const res = await api.get('/admin/expenses');
      return res.data;
    }
  });

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch = e.description.toLowerCase().includes(search.toLowerCase()) || 
                          e.company.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Expense Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Audit operational expenses, fuel bills, and machinery lease payouts</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['expensesList'] });
            toast.success('Expenses refreshed');
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Monthly Spending</p>
            <h3 className="text-2xl font-bold text-white">₹{totalExpense.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pending Approvals</p>
            <h3 className="text-2xl font-bold text-white">
              ₹{expenses.filter(e => e.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by description or client organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none pr-8 w-40"
          >
            <option>All</option>
            <option>Fuel</option>
            <option>Materials</option>
            <option>Machinery Lease</option>
            <option>Rent</option>
            <option>Labor</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Expenditure Details</th>
                <th className="px-6 py-4.5">Category</th>
                <th className="px-6 py-4.5">Total Amount</th>
                <th className="px-6 py-4.5">Billing Date</th>
                <th className="px-6 py-4.5">Client Organization</th>
                <th className="px-6 py-4.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((e) => (
                  <tr key={e._id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{e.description}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{e.category}</td>
                    <td className="px-6 py-4 font-extrabold text-white">₹{e.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{e.date}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{e.company}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                        e.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        e.status === 'Pending' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 font-medium">
                    No expense items registered.
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
