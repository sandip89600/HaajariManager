import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import {
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  Download,
  FileText,
  X,
  IndianRupee
} from 'lucide-react';
import {
  usePayments,
  useUpdatePayment,
  useDeletePayment
} from '../hooks/useApi';

interface PaymentFormInputs {
  amount: number;
  notes: string;
  status: 'Paid' | 'Pending' | 'Failed';
}

const PaymentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Failed'>('All');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [editingPayment, setEditingPayment] = useState<any>(null);
  
  const { data: payments = [], isLoading } = usePayments();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentFormInputs>();

  const filteredPayments = payments.filter((p: any) => {
    const matchesSearch = p.workerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.transactionId && p.transactionId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPaid = payments.filter((p: any) => p.status === 'Paid').reduce((acc: number, p: any) => acc + p.amount, 0);
  const totalPending = payments.filter((p: any) => p.status === 'Pending').reduce((acc: number, p: any) => acc + p.amount, 0);
  const totalFailed = payments.filter((p: any) => p.status === 'Failed').reduce((acc: number, p: any) => acc + p.amount, 0);

  const openEditModal = (payment: any) => {
    setEditingPayment(payment);
    reset({
      amount: payment.amount,
      notes: payment.notes || '',
      status: payment.status
    });
  };

  const closeEditModal = () => {
    setEditingPayment(null);
    reset();
  };

  const onSubmitEdit = (data: PaymentFormInputs) => {
    if (editingPayment) {
      updatePayment.mutate({ id: editingPayment._id, ...data }, {
        onSuccess: () => {
          toast.success('Payment updated successfully');
          closeEditModal();
        },
        onError: () => {
          toast.error('Failed to update payment');
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment record?')) {
      deletePayment.mutate(id, {
        onSuccess: () => toast.success('Payment deleted successfully'),
        onError: () => toast.error('Failed to delete payment')
      });
    }
  };

  const handleExportPDF = () => {
    window.open(`/api/export/payment-summary?month=${month}&year=${year}`, '_blank');
  };

  const handleExportCSV = () => {
    window.open(`/api/export/csv?month=${month}&year=${year}&type=payments`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Payment Records</h1>
          <p className="text-slate-400">Manage and track worker payments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
          >
            <FileText size={18} />
            Export PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-lg">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Paid</p>
            <p className="text-2xl font-bold text-slate-100">₹{totalPaid.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
          <div className="p-3 bg-yellow-500/20 text-yellow-500 rounded-lg">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Pending</p>
            <p className="text-2xl font-bold text-slate-100">₹{totalPending.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
          <div className="p-3 bg-red-500/20 text-red-500 rounded-lg">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Failed</p>
            <p className="text-2xl font-bold text-slate-100">₹{totalFailed.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('default', { month: 'short' })}
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
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
            {['All', 'Paid', 'Pending', 'Failed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900/50 text-slate-400 text-sm border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-medium">Worker Name</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Method</th>
                <th className="px-6 py-4 font-medium">Transaction ID</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">Loading payments...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">No payments found</td>
                </tr>
              ) : (
                filteredPayments.map((payment: any) => (
                  <tr key={payment._id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">{payment.workerName}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-200">
                      ₹{payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {payment.method || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {payment.transactionId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(payment.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        payment.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        payment.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(payment)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(payment._id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md overflow-hidden shadow-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h3 className="text-lg font-bold text-slate-100">Edit Payment</h3>
                <button
                  onClick={closeEditModal}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit(onSubmitEdit)} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Amount</label>
                  <input
                    type="number"
                    {...register('amount', { required: 'Amount is required', min: 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                  {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                  <select
                    {...register('status')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
                  <textarea
                    {...register('notes')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500 h-24 resize-none"
                  ></textarea>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatePayment.isPending}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {updatePayment.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PaymentsPage;
