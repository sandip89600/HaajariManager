import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Download, FileText, CheckCircle, Search, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

interface SystemReport {
  _id: string;
  name: string;
  type: 'PDF' | 'Excel';
  size: string;
  generatedAt: string;
  downloadUrl: string;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('attendance');
  const [dateRange, setDateRange] = useState('7days');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch reports list
  const { data: reports = [], refetch } = useQuery<SystemReport[]>({
    queryKey: ['systemReports'],
    queryFn: async () => {
      const res = await api.get('/admin/reports');
      return res.data;
    }
  });

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      await api.post('/admin/reports/generate', {
        type: reportType,
        range: dateRange
      });
      toast.success('Report generated successfully!');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">System Reports</h1>
        <p className="text-slate-400 text-sm mt-1">Generate SaaS metrics, audit logs, and compliance forms</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form generator */}
        <div className="glass-card p-6 rounded-2xl border border-slate-850 h-fit space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Generate New Report
          </h3>
          <form onSubmit={handleGenerateReport} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Report Category</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="attendance">Daily Attendance Log</option>
                <option value="payouts">Client MRR Payouts</option>
                <option value="workers">Worker Registry & Rates</option>
                <option value="geofence">GPS Geofencing Violations</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Time Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="currentMonth">This Month</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full premium-btn-primary py-2.5 flex items-center justify-center gap-2 text-xs font-bold"
            >
              {isGenerating ? 'Compiling Report...' : 'Compile Audit Report'}
            </button>
          </form>
        </div>

        {/* List of generated reports */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-850 space-y-4">
          <h3 className="text-lg font-bold text-white">Download Generated Archives</h3>
          <div className="divide-y divide-slate-850/40">
            {reports.map((report) => (
              <div key={report._id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    report.type === 'PDF' 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  }`}>
                    {report.type === 'PDF' ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="block font-bold text-white text-sm">{report.name}</span>
                    <span className="block text-[11px] text-slate-500 font-semibold">{report.size} &bull; Generated {report.generatedAt}</span>
                  </div>
                </div>

                <a
                  href={report.downloadUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    toast.success(`Downloading ${report.name}...`);
                  }}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
