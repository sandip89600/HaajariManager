import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Phone, Lock, Eye, EyeOff, Loader2, AlertCircle, User, Mail, UserCheck } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

interface SignupFormInputs {
  name: string;
  phone: string;
  email: string;
  username: string;
  password: string;
}

const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormInputs>();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSignupSubmit = async (data: SignupFormInputs) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await api.post('/auth/signup', {
        name: data.name,
        phone: data.phone,
        email: data.email,
        username: data.username,
        password: data.password,
        role: 'admin',
      });

      const { user, token, refreshToken } = response.data;

      login(token, refreshToken || '', user);
      toast.success('Administrator account registered and logged in successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      console.error('Registration error details:', err);
      
      let errorMessage = 'Registration failed. Please try again.';
      if (err.response && err.response.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else {
          errorMessage = err.response.data.message || 
                         err.response.data.error || 
                         err.response.data.errorMessage ||
                         JSON.stringify(err.response.data);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setAuthError(errorMessage);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 overflow-y-auto">
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
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Create Administrator Account</p>
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

        <form onSubmit={handleSubmit(onSignupSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 block ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="John Doe"
                {...register('name', { required: 'Name is required' })}
                className="premium-input pl-10 py-2 text-xs"
              />
            </div>
            {errors.name && (
              <span className="text-[9px] text-rose-400 block ml-1">{errors.name.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 block ml-1">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. 7058222107"
                {...register('phone', { required: 'Mobile number is required' })}
                className="premium-input pl-10 py-2 text-xs"
              />
            </div>
            {errors.phone && (
              <span className="text-[9px] text-rose-400 block ml-1">{errors.phone.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 block ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="admin@company.com"
                {...register('email', { required: 'Email is required' })}
                className="premium-input pl-10 py-2 text-xs"
              />
            </div>
            {errors.email && (
              <span className="text-[9px] text-rose-400 block ml-1">{errors.email.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 block ml-1">Username</label>
            <div className="relative">
              <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="admin_username"
                {...register('username', { required: 'Username is required' })}
                className="premium-input pl-10 py-2 text-xs"
              />
            </div>
            {errors.username && (
              <span className="text-[9px] text-rose-400 block ml-1">{errors.username.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 block ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum length is 6' } })}
                className="premium-input pl-10 pr-10 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-[9px] text-rose-400 block ml-1">{errors.password.message}</span>
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
                Creating account...
              </>
            ) : (
              'Create Account & Log In'
            )}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-slate-850/40">
          <Link
            to="/login"
            className="text-xs text-orange-500 hover:text-orange-400 font-bold transition-colors"
          >
            Already have an admin account? Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
