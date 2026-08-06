import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Search, AlertTriangle, ArrowDown, ClipboardList } from 'lucide-react';
import { api } from '../utils/api';

interface MaterialStock {
  _id: string;
  name: string;
  category: string;
  inStock: number;
  unit: string;
  threshold: number;
  company: string;
}

export default function MaterialsPage() {
  const [search, setSearch] = useState('');

  // Fetch materials stock
  const { data: stocks = [], isLoading } = useQuery<MaterialStock[]>({
    queryKey: ['materialsStock'],
    queryFn: async () => {
      const res = await api.get('/admin/materials');
      return res.data;
    }
  });

  const filteredStocks = stocks.filter((stock) => {
    return stock.name.toLowerCase().includes(search.toLowerCase()) ||
           stock.category.toLowerCase().includes(search.toLowerCase()) ||
           stock.company.toLowerCase().includes(search.toLowerCase());
  });

  const lowStockItems = stocks.filter(item => item.inStock <= item.threshold);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Materials & Inventory</h1>
        <p className="text-slate-400 text-sm mt-1">Audit raw materials stock levels, category listings, and low-stock alerts</p>
      </div>

      {/* Stats header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Inventory Categories</p>
            <h3 className="text-2xl font-bold text-white">{new Set(stocks.map(s => s.category)).size}</h3>
          </div>
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Low Stock Warnings</p>
            <h3 className="text-2xl font-bold text-rose-450">{lowStockItems.length}</h3>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-850 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Deployments</p>
            <h3 className="text-2xl font-bold text-white">{stocks.length} Items</h3>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500">
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by material item name, category, or contractor company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Inventory table */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">Material Name</th>
                <th className="px-6 py-4.5">Category</th>
                <th className="px-6 py-4.5">Available Stock</th>
                <th className="px-6 py-4.5">Unit Metric</th>
                <th className="px-6 py-4.5">Alert Threshold</th>
                <th className="px-6 py-4.5">Client Organization</th>
                <th className="px-6 py-4.5">Inventory Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock) => {
                  const isLow = stock.inStock <= stock.threshold;
                  return (
                    <tr key={stock._id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{stock.name}</td>
                      <td className="px-6 py-4 font-semibold text-slate-450">{stock.category}</td>
                      <td className="px-6 py-4 font-bold text-white">{stock.inStock.toLocaleString()}</td>
                      <td className="px-6 py-4 font-medium text-slate-400">{stock.unit}</td>
                      <td className="px-6 py-4 font-medium text-slate-500">{stock.threshold.toLocaleString()}</td>
                      <td className="px-6 py-4 font-semibold text-slate-400">{stock.company}</td>
                      <td className="px-6 py-4">
                        {isLow ? (
                          <span className="flex items-center gap-1 text-xs text-rose-400 font-bold uppercase tracking-wider">
                            <ArrowDown className="w-3.5 h-3.5" /> Reorder Alert
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-450 font-bold uppercase tracking-wider">
                            ✔ Healthy Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-medium">
                    No material stocks registered.
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
