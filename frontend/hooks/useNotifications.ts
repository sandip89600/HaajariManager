import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { authenticatedFetch, API_URL, storage } from "@/utils/storage";
import { useSocket } from "@/hooks/useSocket";
import {
  registerExpoPushToken,
  isRunningInExpoGo,
  getNotificationsModule,
} from "@/utils/notifications";

export interface NotificationItem {
  _id: string;
  type:
    | "attendance_reminder"
    | "subscription_reminder"
    | "payment_reminder"
    | "worker_reminder"
    | "site_reminder"
    | "system"
    | "announcement";
  title: string;
  message: string;
  data?: {
    screen?: string;
    params?: any;
    url?: string;
    [key: string]: any;
  };
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  // 1. Query notifications list
  const notificationsQuery = useQuery<{
    notifications: NotificationItem[];
    unreadCount: number;
  }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await authenticatedFetch(`${API_URL}/notifications`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      return {
        notifications: data.notifications || [],
        unreadCount: data.unreadCount || 0,
      };
    },
    staleTime: 60 * 1000,
  });

  // 2. Query unread count independently for fast badge updates
  const unreadCountQuery = useQuery<number>({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${API_URL}/notifications/unread-count`,
      );
      if (!res.ok) return 0;
      const data = await res.json();
      return data.unreadCount || 0;
    },
    staleTime: 30 * 1000,
  });

  // 3. Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authenticatedFetch(
        `${API_URL}/notifications/${id}/read`,
        {
          method: "PATCH",
        },
      );
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>(["notifications"], (old) => {
        if (!old) return old as any;
        const updatedList = old.notifications.map((item) =>
          item._id === id ? { ...item, isRead: true } : item,
        );
        return {
          notifications: updatedList,
          unreadCount: Math.max(0, data.unreadCount ?? old.unreadCount - 1),
        };
      });
      queryClient.setQueryData<number>(["notifications-unread-count"], (old) =>
        Math.max(0, (old || 1) - 1),
      );
    },
  });

  // 4. Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(
        `${API_URL}/notifications/read-all`,
        {
          method: "PATCH",
        },
      );
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>(["notifications"], (old) => {
        if (!old) return old as any;
        return {
          notifications: old.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        };
      });
      queryClient.setQueryData<number>(["notifications-unread-count"], 0);
    },
  });

  // 5. Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authenticatedFetch(`${API_URL}/notifications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete notification");
      return res.json();
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>(["notifications"], (old) => {
        if (!old) return old as any;
        return {
          notifications: old.notifications.filter((item) => item._id !== id),
          unreadCount: data.unreadCount ?? old.unreadCount,
        };
      });
    },
  });

  // 6. Realtime Socket.IO notification listener setup
  let socket: any = null;
  try {
    const socketContext = useSocket();
    socket = socketContext?.socket;
  } catch (e) {}

  useEffect(() => {
    if (socket) {
      const handleNewNotification = () => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({
          queryKey: ["notifications-unread-count"],
        });
      };
      socket.on("notification:new", handleNewNotification);
      return () => {
        socket.off("notification:new", handleNewNotification);
      };
    }
  }, [socket, queryClient]);

  // 7. Register Expo notification foreground & response listeners safely with Expo Go check
  useEffect(() => {
    if (
      Platform.OS === "web" ||
      (Platform.OS === "android" && isRunningInExpoGo())
    ) {
      return;
    }

    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
      const notificationListener =
        Notifications.addNotificationReceivedListener((notification) => {
          console.log(
            "[Notifications] Received in foreground:",
            notification.request.content.title,
          );
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({
            queryKey: ["notifications-unread-count"],
          });
        });

      const responseListener =
        Notifications.addNotificationResponseReceivedListener((response) => {
          console.log(
            "[Notifications] User tapped notification response:",
            response.notification.request.content.data,
          );
        });

      return () => {
        notificationListener.remove();
        responseListener.remove();
      };
    } catch (e) {
      console.warn("[Notifications] Listener setup warning:", e);
    }
  }, [queryClient]);

  return {
    notifications: notificationsQuery.data?.notifications || [],
    unreadCount:
      unreadCountQuery.data ?? notificationsQuery.data?.unreadCount ?? 0,
    isLoading: notificationsQuery.isLoading,
    isRefetching: notificationsQuery.isRefetching,
    refetch: notificationsQuery.refetch,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    deleteNotification: deleteNotificationMutation.mutateAsync,
  };
}

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  const token = await registerExpoPushToken();

  if (token) {
    const auth = await storage.getAuth();
    if (auth?.token) {
      await fetch(`${API_URL}/auth/push-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ pushToken: token }),
      }).catch(() => {});
    }
  }

  return token;
}
