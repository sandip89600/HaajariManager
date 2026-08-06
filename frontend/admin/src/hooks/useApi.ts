import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

const DEFAULT_QUERY_OPTIONS = {
  staleTime: 30000,
  retry: 1,
};

// Analytics
export const useAnalytics = () => {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics');
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

// Users
export const useUsers = (search?: string) => {
  return useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', { params: { search } });
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const { data } = await api.put(`/admin/users/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string | boolean }) => {
      const { data } = await api.put(`/admin/users/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/users/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Workers
export const useWorkers = (search?: string) => {
  return useQuery({
    queryKey: ['workers', search],
    queryFn: async () => {
      const { data } = await api.get('/admin/workers', { params: { search } });
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useUpdateWorker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const { data } = await api.put(`/admin/workers/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
  });
};

export const useDeleteWorker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/workers/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
  });
};

// Attendance
export const useAttendance = (month?: number, year?: number) => {
  return useQuery({
    queryKey: ['attendance', month, year],
    queryFn: async () => {
      const { data } = await api.get('/admin/attendance', { params: { month, year } });
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useUpdateAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const { data } = await api.put(`/admin/attendance/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

export const useDeleteAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/attendance/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

// Payments
export const usePayments = () => {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data } = await api.get('/admin/payments');
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useUpdatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const { data } = await api.put(`/admin/payments/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
};

export const useDeletePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/payments/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
};

// Support/Problems
export const useProblems = () => {
  return useQuery({
    queryKey: ['problems'],
    queryFn: async () => {
      const { data } = await api.get('/admin/support/problems');
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useResolveProblem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      const { data } = await api.put(`/admin/support/problems/${id}/resolve`, { resolution });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

export const useDeleteProblem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/support/problems/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
  });
};

// Feedback
export const useFeedback = () => {
  return useQuery({
    queryKey: ['feedback'],
    queryFn: async () => {
      const { data } = await api.get('/admin/support/feedback');
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useDeleteFeedback = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/support/feedback/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
};

// Security
export const useSecurityLogs = () => {
  return useQuery({
    queryKey: ['security-logs'],
    queryFn: async () => {
      const { data } = await api.get('/admin/security/logs');
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useActiveSessions = () => {
  return useQuery({
    queryKey: ['active-sessions'],
    queryFn: async () => {
      const { data } = await api.get('/admin/security/sessions');
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useForceLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, userId }: { sessionId?: string; userId?: string }) => {
      const { data } = await api.post(`/admin/security/force-logout`, { sessionId, userId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
    },
  });
};

// Activity
export const useActivityLogs = (page?: number) => {
  return useQuery({
    queryKey: ['activity-logs', page],
    queryFn: async () => {
      const { data } = await api.get('/admin/activity', { params: { page } });
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

// Profile / Auth
export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/auth/profile');
      return data;
    },
    ...DEFAULT_QUERY_OPTIONS,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.put(`/auth/profile`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.put(`/auth/change-password`, payload);
      return data;
    },
  });
};
