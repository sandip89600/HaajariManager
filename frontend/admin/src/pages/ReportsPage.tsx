import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CalendarCheck, 
  CreditCard, 
  Download, 
  Printer, 
  FileText
} from 'lucide-react';

const ReportsPage: React.FC = () => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const handleDownload = (endpoint: string) => {
    // In a real app with token auth, you might need to append the token
    // or use a fetch request that creates a blob and downloads it.
    // Assuming cookie-based or query param for now as per instructions.
    window.open(`${endpoint}?month=${month}&year=${year}`, '_blank');
  };

  const reports = [
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Monthly summary of worker attendance, overtime, and absences.',
      icon: CalendarCheck,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      action: () => handleDownload('/api/export/attendance-pdf'),
      btnText: 'Download PDF',
      btnIcon: FileText
    },
    {
      id: 'payments',
      title: 'Payment Summary',
      description: 'Comprehensive report of all payments, pending dues, and failures.',
      icon: CreditCard,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/20',
      action: () => handleDownload('/api/export/payment-summary'),
      btnText: 'Download PDF',
      btnIcon: FileText
    },
    {
      id: 'export',
      title: 'Data Export',
      description: 'Raw data export in CSV format for spreadsheet processing.',
      icon: Download,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      action: () => handleDownload('/api/export/csv'),
      btnText: 'Export CSV',
      btnIcon: Download
    },
    {
      id: 'print',
      title: 'Print View',
      description: 'Printer-friendly web view of the monthly master sheet.',
      icon: Printer,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      action: () => handleDownload('/api/export/print'),
      btnText: 'Open Print View',
      btnIcon: Printer
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports & Exports</h1>
          <p className="text-slate-400">Generate and download system data</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={year - 2 + i} value={year - 2 + i}>{year - 2 + i}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          const BtnIcon = report.btnIcon;
          return (
            <div key={report.id} className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col hover:border-slate-600 transition-colors">
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-4 rounded-xl ${report.bgColor} ${report.color}`}>
                  <Icon size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{report.title}</h3>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    {report.description}
                  </p>
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-slate-700/50">
                <button
                  onClick={report.action}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  <BtnIcon size={18} />
                  {report.btnText}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ReportsPage;
