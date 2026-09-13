import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ChevronDown,
  CheckCircle,
  ShieldAlert,
  Clock,
  RefreshCw,
  Trash2,
  Eye,
  X,
  Building2,
  UserCheck,
  HardHat,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../utils/api";

interface UserRecord {
  _id: string;
  name: string;
  username?: string;
  role: "contractor" | "builder" | "supervisor" | "labor" | "admin";
  phone: string;
  email: string;
  createdAt?: string | Date;
  isActive: boolean;
  connectionStatus?: "connected" | "pending" | "declined" | "not_connected";
  contractorName?: string;
  contractorCompany?: string;
  tenantId?: {
    _id: string;
    name: string;
    plan: "free" | "professional" | "business";
  };
  workerCount: number;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userDetailedData, setUserDetailedData] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Fetch users
  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/admin/users");
      return res.data;
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted successfully");
      if (selectedUser) setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to delete user");
    },
  });

  const handleOpenUserDetail = async (user: UserRecord) => {
    setSelectedUser(user);
    setIsLoadingDetails(true);
    setUserDetailedData(null);
    try {
      let endpoint = `/admin/users/${user._id}`;
      if (user.role === "contractor")
        endpoint = `/admin/contractors/${user._id}`;
      if (user.role === "supervisor")
        endpoint = `/admin/supervisors/${user._id}`;
      if (user.role === "labor") endpoint = `/admin/labor/${user._id}`;

      const res = await api.get(endpoint);
      setUserDetailedData(res.data);
    } catch {
      setUserDetailedData(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const formatSignupTiming = (dateString?: string | Date) => {
    if (!dateString) return { date: "N/A", time: "N/A" };
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return { date: "N/A", time: "N/A" };

    const date = d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return { date, time };
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      (user.username || "").toLowerCase().includes(search.toLowerCase()) ||
      user.phone.includes(search) ||
      (user.email || "").toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "All" ||
      user.role.toLowerCase() === roleFilter.toLowerCase();

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">System Users</h1>
          <p className="text-slate-400 text-sm mt-1">
            Role-based user management across Contractors, Supervisors, and
            Labour
          </p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast.success("Users list refreshed");
          }}
          disabled={isLoading}
          className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters card */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, username, phone or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Filter Role
          </label>
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-44 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none"
            >
              <option value="All">All</option>
              <option value="contractor">Contractor</option>
              <option value="supervisor">Supervisor</option>
              <option value="labor">Labour</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="glass-card rounded-2xl border border-slate-850 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 border-b border-slate-850/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4.5">User Details</th>
                <th className="px-6 py-4.5">Role</th>
                <th className="px-6 py-4.5">Contact & Username</th>
                <th className="px-6 py-4.5">Company / Contractor</th>
                <th className="px-6 py-4.5">Connection Status</th>
                <th className="px-6 py-4.5">Signup Date</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/30 text-sm text-slate-300">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const { date, time } = formatSignupTiming(user.createdAt);
                  return (
                    <tr
                      key={user._id}
                      className="hover:bg-slate-900/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-white">
                        <div>
                          <div>{user.name}</div>
                          <div className="text-xs text-slate-500 font-normal">
                            {user.email || "No Email"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase inline-flex items-center gap-1.5 ${
                            user.role === "contractor"
                              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                              : user.role === "supervisor"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : user.role === "labor"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {user.role === "contractor" && (
                            <Building2 className="w-3 h-3" />
                          )}
                          {user.role === "supervisor" && (
                            <UserCheck className="w-3 h-3" />
                          )}
                          {user.role === "labor" && (
                            <HardHat className="w-3 h-3" />
                          )}
                          {user.role === "admin" && (
                            <Shield className="w-3 h-3" />
                          )}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-300">
                          {user.phone}
                        </div>
                        <div className="text-xs text-slate-500">
                          @{user.username || "n/a"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-white">
                        {user.tenantId?.name ||
                          user.contractorCompany ||
                          user.contractorName ||
                          "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            user.connectionStatus === "connected" ||
                            user.role === "contractor"
                              ? "text-emerald-400 bg-emerald-500/10"
                              : user.connectionStatus === "pending"
                                ? "text-amber-400 bg-amber-500/10"
                                : "text-slate-400 bg-slate-800"
                          }`}
                        >
                          {user.role === "contractor"
                            ? "Owner"
                            : user.connectionStatus || "Not Connected"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-orange-400" />
                          <div>
                            <div className="font-bold text-white text-xs">
                              {date}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {time}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.isActive ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />{" "}
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
                            <ShieldAlert className="w-4 h-4 text-rose-400" />{" "}
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenUserDetail(user)}
                          className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 py-1.5 px-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition-all"
                          title="View Account Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Are you sure you want to delete user "${user.name}"?`,
                              )
                            ) {
                              deleteUserMutation.mutate(user._id);
                            }
                          }}
                          disabled={deleteUserMutation.isPending}
                          className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 py-1.5 px-2.5 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-slate-500 font-medium"
                  >
                    No users found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* USER DETAILS DRAWER / MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {selectedUser.name}
                </h2>
                <p className="text-xs text-orange-400 font-mono uppercase tracking-wider mt-0.5">
                  Role: {selectedUser.role}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="py-12 text-center text-slate-400">
                Loading details...
              </div>
            ) : userDetailedData ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                  <div className="font-bold text-white">Contact & Profile</div>
                  <div className="text-xs text-slate-400">
                    Username: @{selectedUser.username || "n/a"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Phone: {selectedUser.phone}
                  </div>
                  <div className="text-xs text-slate-400">
                    Email: {selectedUser.email || "N/A"}
                  </div>
                </div>

                {selectedUser.role === "contractor" &&
                  userDetailedData.supervisors && (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                      <div className="font-bold text-white">
                        Supervisors ({userDetailedData.supervisors.total})
                      </div>
                      <div className="text-xs text-emerald-400">
                        Connected: {userDetailedData.supervisors.connected}
                      </div>
                      <div className="text-xs text-amber-400">
                        Pending: {userDetailedData.supervisors.pending}
                      </div>
                    </div>
                  )}

                {selectedUser.role === "supervisor" && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                    <div className="font-bold text-white">
                      Contractor Connection
                    </div>
                    <div className="text-xs text-slate-400">
                      Contractor: {userDetailedData.contractor?.name || "N/A"}
                    </div>
                    <div className="text-xs text-slate-400">
                      Company: {userDetailedData.contractor?.company || "N/A"}
                    </div>
                    <div className="text-xs text-emerald-400">
                      Status: {userDetailedData.connectionStatus}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
