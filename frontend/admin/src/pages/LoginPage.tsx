import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Eye, EyeOff, Loader2, AlertCircle, User } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

interface LoginFormInputs {
  phone: string; // Map internally to API's "phone" string parameter which accepts email/username
  password: string;
}

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onLoginSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await api.post('/auth/login', {
        phone: data.phone,
        password: data.password,
      });

      const { user, token, refreshToken } = response.data;

      if (user.role !== 'admin') {
        setAuthError('Access denied. Administrator credentials required.');
        setIsLoading(false);
        return;
      }

      login(token, refreshToken || '', user);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      if (err.response && err.response.data && err.response.data.error) {
        setAuthError(err.response.data.error);
      } else if (err.response && err.response.data && err.response.data.message) {
        setAuthError(err.response.data.message);
      } else {
        setAuthError('Invalid credentials. Please verify your email/username and password.');
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 overflow-hidden">
      {/* Decorative blurred background lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md glass-card rounded-2xl border border-slate-850 p-8 shadow-2xl relative z-10 space-y-6"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl shadow-lg shadow-orange-500/10 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">Haajari Manager</h2>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Enterprise Web Administrator Portal</p>
        </div>

        <AnimatePresence>
          {authError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-start gap-2.5"
            >
              <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{authError}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 block ml-1">Username or Email</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input
                type="text"
                placeholder="Enter username or email"
                {...register('phone', { required: 'Username or email is required' })}
                className={`premium-input pl-11 py-2.5 text-sm ${errors.phone ? 'border-rose-500 focus:ring-rose-500/35 focus:border-rose-500' : ''}`}
              />
            </div>
            {errors.phone && (
              <span className="text-[10px] text-rose-400 block ml-1">{errors.phone.message}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 block ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                {...register('password', { required: 'Password is required' })}
                className={`premium-input pl-11 pr-11 py-2.5 text-sm ${errors.password ? 'border-rose-500 focus:ring-rose-500/35 focus:border-rose-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-330 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-[10px] text-rose-400 block ml-1">{errors.password.message}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full premium-btn-primary py-2.5 text-xs flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                Signing in...
              </>
            ) : (
              'Sign In to Dashboard'
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-[11px] text-slate-500">
          Haajari Manager Enterprise Administration
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
