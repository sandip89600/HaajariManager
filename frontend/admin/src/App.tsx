import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import { Loader2 } from 'lucide-react';

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy load all pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const WorkersPage = lazy(() => import('./pages/WorkersPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const SitesPage = lazy(() => import('./pages/SitesPage'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const SalaryPage = lazy(() => import('./pages/SalaryPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const ActivityLogsPage = lazy(() => import('./pages/ActivityLogsPage'));
const DevicesPage = lazy(() => import('./pages/DevicesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Fallback loader
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px] w-full h-full">
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      <p className="text-sm font-medium">Loading content...</p>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          </div>
        }>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            
            <Route path="/" element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                
                <Route path="dashboard" element={
                  <Suspense fallback={<PageLoader />}>
                    <DashboardPage />
                  </Suspense>
                } />
                
                <Route path="analytics" element={
                  <Suspense fallback={<PageLoader />}>
                    <AnalyticsPage />
                  </Suspense>
                } />
                
                <Route path="organizations" element={
                  <Suspense fallback={<PageLoader />}>
                    <OrganizationsPage />
                  </Suspense>
                } />
                
                <Route path="users" element={
                  <Suspense fallback={<PageLoader />}>
                    <UsersPage />
                  </Suspense>
                } />
                
                <Route path="workers" element={
                  <Suspense fallback={<PageLoader />}>
                    <WorkersPage />
                  </Suspense>
                } />
                
                <Route path="attendance" element={
                  <Suspense fallback={<PageLoader />}>
                    <AttendancePage />
                  </Suspense>
                } />
                
                <Route path="sites" element={
                  <Suspense fallback={<PageLoader />}>
                    <SitesPage />
                  </Suspense>
                } />
                
                <Route path="materials" element={
                  <Suspense fallback={<PageLoader />}>
                    <MaterialsPage />
                  </Suspense>
                } />
                
                <Route path="payments" element={
                  <Suspense fallback={<PageLoader />}>
                    <PaymentsPage />
                  </Suspense>
                } />
                
                <Route path="expenses" element={
                  <Suspense fallback={<PageLoader />}>
                    <ExpensesPage />
                  </Suspense>
                } />
                
                <Route path="salary" element={
                  <Suspense fallback={<PageLoader />}>
                    <SalaryPage />
                  </Suspense>
                } />
                
                <Route path="reports" element={
                  <Suspense fallback={<PageLoader />}>
                    <ReportsPage />
                  </Suspense>
                } />
                
                <Route path="notifications" element={
                  <Suspense fallback={<PageLoader />}>
                    <NotificationsPage />
                  </Suspense>
                } />
                
                <Route path="subscriptions" element={
                  <Suspense fallback={<PageLoader />}>
                    <SubscriptionsPage />
                  </Suspense>
                } />
                
                <Route path="support" element={
                  <Suspense fallback={<PageLoader />}>
                    <SupportPage />
                  </Suspense>
                } />
                
                <Route path="activity-logs" element={
                  <Suspense fallback={<PageLoader />}>
                    <ActivityLogsPage />
                  </Suspense>
                } />
                
                <Route path="devices" element={
                  <Suspense fallback={<PageLoader />}>
                    <DevicesPage />
                  </Suspense>
                } />
                
                <Route path="settings" element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsPage />
                  </Suspense>
                } />
                
                <Route path="profile" element={
                  <Suspense fallback={<PageLoader />}>
                    <ProfilePage />
                  </Suspense>
                } />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1E293B',
            color: '#F8FAFC',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#1E293B',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#1E293B',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
