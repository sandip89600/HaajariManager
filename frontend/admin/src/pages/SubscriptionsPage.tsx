import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Gem,
  Search,
  RefreshCw,
  Power,
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Tag,
  Clock,
  Shield,
  Edit3,
  ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  AdminSubscriptionApi,
  AdminSubscriptionPlan,
  AdminTransaction,
} from "../services/adminSubscriptionApi";

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "overview" | "plans" | "transactions" | "analytics"
  >("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPriceOption, setEditingPriceOption] = useState<{
    planId: string;
    optionId: string;
    price: number;
    promotionalPrice: number;
    promotionEnabled: boolean;
  } | null>(null);

  // 1. Query Global Subscription Config
  const { data: configData, isLoading: isConfigLoading } = useQuery({
    queryKey: ["adminSubConfigV2"],
    queryFn: AdminSubscriptionApi.getConfig,
  });

  // 2. Query Plans & Billing Options
  const { data: plansData, isLoading: isPlansLoading } = useQuery({
    queryKey: ["adminSubPlansV2"],
    queryFn: AdminSubscriptionApi.getPlans,
  });

  // 3. Query Transactions Ledger
  const { data: transactionsData, isLoading: isTxnLoading } = useQuery({
    queryKey: ["adminSubTransactionsV2"],
    queryFn: AdminSubscriptionApi.getTransactions,
  });

  // 4. Query Analytics
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["adminSubAnalyticsV2"],
    queryFn: AdminSubscriptionApi.getAnalytics,
  });

  // Global Config Toggle Mutation
  const configMutation = useMutation({
    mutationFn: (newGlobalState: boolean) =>
      AdminSubscriptionApi.updateConfig(newGlobalState),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["adminSubConfigV2"] });
      queryClient.invalidateQueries({ queryKey: ["adminSubAnalyticsV2"] });
      toast.success(
        data.globalEnabled
          ? "Global Subscription Mode turned ON (Paid Subscription Mode)"
          : "Global Subscription Mode turned OFF (Free Mode Active)",
      );
    },
    onError: () => toast.error("Failed to update global subscription switch."),
  });

  // Plan Active Toggle Mutation
  const planToggleMutation = useMutation({
    mutationFn: ({ planId, active }: { planId: string; active: boolean }) =>
      AdminSubscriptionApi.togglePlanStatus(planId, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSubPlansV2"] });
      toast.success("Plan status updated.");
    },
    onError: () => toast.error("Failed to update plan status."),
  });

  // Billing Option Toggle / Edit Mutation
  const billingOptionMutation = useMutation({
    mutationFn: (params: {
      planId: string;
      optionId: string;
      active?: boolean;
      promotionEnabled?: boolean;
      price?: number;
      promotionalPrice?: number;
    }) =>
      AdminSubscriptionApi.toggleBillingOptionStatus(
        params.planId,
        params.optionId,
        params,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSubPlansV2"] });
      toast.success("Billing option updated.");
      setEditingPriceOption(null);
    },
    onError: () => toast.error("Failed to update billing option."),
  });

  const isGlobalOn = configData?.globalEnabled ?? false;

  const filteredTransactions = (transactionsData || []).filter(
    (txn: AdminTransaction) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        txn.transactionId.toLowerCase().includes(q) ||
        txn.planNameSnapshot.toLowerCase().includes(q) ||
        txn.userId?.name?.toLowerCase().includes(q) ||
        txn.tenantId?.name?.toLowerCase().includes(q)
      );
    },
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Gem className="h-7 w-7 text-indigo-600" />
            Subscription System Architecture
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Control global free/paid mode, plans, ₹2 promo offers, flexible
            billing durations, and payment ledgers.
          </p>
        </div>

        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["adminSubConfigV2"] });
            queryClient.invalidateQueries({ queryKey: ["adminSubPlansV2"] });
            queryClient.invalidateQueries({
              queryKey: ["adminSubTransactionsV2"],
            });
            queryClient.invalidateQueries({
              queryKey: ["adminSubAnalyticsV2"],
            });
            toast.success("Subscription data refreshed.");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* GLOBAL MASTER SWITCH CARD */}
      <div
        className={`p-6 rounded-2xl border-2 transition-all ${
          isGlobalOn
            ? "bg-gradient-to-r from-emerald-900 to-slate-900 border-emerald-500 text-white shadow-xl"
            : "bg-gradient-to-r from-indigo-900 to-slate-900 border-indigo-500 text-white shadow-xl"
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                  isGlobalOn
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-slate-950"
                }`}
              >
                {isGlobalOn ? "Paid Subscription Mode" : "Currently Free Mode"}
              </span>
              <span className="text-slate-300 text-xs flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> Admin Controlled Master
                Switch
              </span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight">
              Global Subscription System:{" "}
              <span
                className={isGlobalOn ? "text-emerald-400" : "text-amber-300"}
              >
                {isGlobalOn ? "ON" : "OFF"}
              </span>
            </h2>

            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              {isGlobalOn
                ? "Paid Subscription Mode is active. Normal users will see active plans according to configuration, and plan entitlement limits are enforced."
                : "Free Mode is active. The entire app is 100% FREE. No paywalls, upgrade popups, or restrictions appear. All plans remain saved for future activation."}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20">
            <div className="text-right">
              <div className="text-xs text-slate-300 font-semibold uppercase">
                Toggle Mode
              </div>
              <div className="text-sm font-bold text-white">
                {isGlobalOn ? "Switch to FREE" : "Switch to PAID"}
              </div>
            </div>

            <button
              disabled={configMutation.isPending || isConfigLoading}
              onClick={() => configMutation.mutate(!isGlobalOn)}
              className={`relative inline-flex h-8 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isGlobalOn ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isGlobalOn ? "translate-x-8" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase">
              Active Subscribers
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {analyticsData?.activeSubscribers || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase">
              Total Revenue
            </p>
            <p className="text-2xl font-bold text-slate-900">
              ₹{analyticsData?.totalRevenue || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Tag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase">
              Configured Plans
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {plansData?.length || 0}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase">
              Total Transactions
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {analyticsData?.totalTransactions || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6">
        {[
          { key: "overview", label: "Subscription Master" },
          { key: "plans", label: "Plans & Pricing (₹2 Promo)" },
          { key: "transactions", label: "Transaction Ledger" },
          { key: "analytics", label: "Analytics" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW / PLANS CONTROL */}
      {(activeTab === "overview" || activeTab === "plans") && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">
              Configured Subscription Plans
            </h3>
            <p className="text-xs text-slate-500">
              Toggle individual plans and billing option durations ON/OFF.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(plansData || []).map((plan: AdminSubscriptionPlan) => (
              <div
                key={plan.planId}
                className={`bg-white rounded-xl border p-6 flex flex-col justify-between shadow-sm ${
                  plan.active
                    ? "border-slate-200"
                    : "border-slate-200 opacity-60 bg-slate-50"
                }`}
              >
                <div>
                  {/* Plan Top Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                        {plan.planId}
                      </span>
                      <h4 className="text-xl font-bold text-slate-900">
                        {plan.name}
                      </h4>
                    </div>

                    <button
                      onClick={() =>
                        planToggleMutation.mutate({
                          planId: plan.planId,
                          active: !plan.active,
                        })
                      }
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                        plan.active
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {plan.active ? "Active" : "Inactive"}
                    </button>
                  </div>

                  <p className="text-slate-500 text-xs mb-4 min-h-[36px]">
                    {plan.description}
                  </p>

                  {/* Features Summary */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 space-y-1.5 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">
                      Plan Features:
                    </div>
                    <div>
                      • Max Workers:{" "}
                      {plan.features.maxWorkers === -1
                        ? "Unlimited"
                        : plan.features.maxWorkers}
                    </div>
                    <div>
                      • Max Sites:{" "}
                      {plan.features.maxProjects === -1
                        ? "Unlimited"
                        : plan.features.maxProjects}
                    </div>
                    <div>
                      • Max Supervisors:{" "}
                      {plan.features.maxSupervisors === -1
                        ? "Unlimited"
                        : plan.features.maxSupervisors}
                    </div>
                  </div>

                  {/* Billing Options List */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Billing Durations & Pricing
                    </div>

                    {plan.billingOptions.map((opt) => (
                      <div
                        key={opt.optionId}
                        className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-2"
                      >
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span>
                            {opt.billingLabel} ({opt.durationMonths}M)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                billingOptionMutation.mutate({
                                  planId: plan.planId,
                                  optionId: opt.optionId,
                                  active: !opt.active,
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                opt.active
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {opt.active ? "ACTIVE" : "OFF"}
                            </button>

                            <button
                              onClick={() =>
                                billingOptionMutation.mutate({
                                  planId: plan.planId,
                                  optionId: opt.optionId,
                                  promotionEnabled: !opt.promotionEnabled,
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                opt.promotionEnabled
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              PROMO {opt.promotionEnabled ? "ON" : "OFF"}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-slate-600">
                          <div>
                            Price:{" "}
                            <span className="font-bold text-slate-900">
                              ₹{opt.price}
                            </span>
                            {opt.promotionEnabled && (
                              <span className="ml-2 font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                Promo: ₹{opt.promotionalPrice ?? 2}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              setEditingPriceOption({
                                planId: plan.planId,
                                optionId: opt.optionId,
                                price: opt.price,
                                promotionalPrice: opt.promotionalPrice ?? 2,
                                promotionEnabled: opt.promotionEnabled,
                              })
                            }
                            className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] flex items-center gap-1"
                          >
                            <Edit3 className="h-3 w-3" /> Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TRANSACTIONS LEDGER */}
      {activeTab === "transactions" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900">
              Subscription Transaction Ledger
            </h3>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search transaction ID, user, plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">User / Tenant</th>
                  <th className="p-3">Plan Snapshot</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No transaction records found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((txn: AdminTransaction) => (
                    <tr key={txn._id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {txn.transactionId}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">
                          {txn.userId?.name || "User"}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {txn.tenantId?.name || "Organization"}
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-700">
                        {txn.planNameSnapshot}
                      </td>
                      <td className="p-3 font-bold text-indigo-600">
                        ₹{txn.amount}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            txn.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {txn.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(txn.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Price Edit Modal */}
      {editingPriceOption && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Edit Price & Promotion
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Regular Price (₹)
                </label>
                <input
                  type="number"
                  value={editingPriceOption.price}
                  onChange={(e) =>
                    setEditingPriceOption({
                      ...editingPriceOption,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  Promotional Price (₹)
                </label>
                <input
                  type="number"
                  value={editingPriceOption.promotionalPrice}
                  onChange={(e) =>
                    setEditingPriceOption({
                      ...editingPriceOption,
                      promotionalPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="promoToggle"
                  checked={editingPriceOption.promotionEnabled}
                  onChange={(e) =>
                    setEditingPriceOption({
                      ...editingPriceOption,
                      promotionEnabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                />
                <label
                  htmlFor="promoToggle"
                  className="text-xs font-bold text-slate-700"
                >
                  Enable Promotional Pricing Offer
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingPriceOption(null)}
                className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  billingOptionMutation.mutate({
                    planId: editingPriceOption.planId,
                    optionId: editingPriceOption.optionId,
                    price: editingPriceOption.price,
                    promotionalPrice: editingPriceOption.promotionalPrice,
                    promotionEnabled: editingPriceOption.promotionEnabled,
                  })
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm"
              >
                Save Pricing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
