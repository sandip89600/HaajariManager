import React from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { User, Lock, Mail, Phone, Shield } from 'lucide-react';
import { useProfile, useUpdateProfile, useChangePassword } from '../hooks/useApi';

const ProfilePage: React.FC = () => {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const { register: registerProfile, handleSubmit: handleProfileSubmit } = useForm({
    defaultValues: {
      name: profile?.name || '',
      email: profile?.email || '',
      phone: profile?.phone || ''
    },
    values: profile // Auto-updates when profile data is loaded
  });

  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, watch, formState: { errors } } = useForm();
  
  const newPassword = watch('newPassword');

  const onProfileSave = (data: any) => {
    updateProfile.mutate(data, {
      onSuccess: () => toast.success('Profile updated successfully'),
      onError: () => toast.error('Failed to update profile')
    });
  };

  const onPasswordSave = (data: any) => {
    changePassword.mutate(data, {
      onSuccess: () => {
        toast.success('Password changed successfully');
        resetPassword();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to change password');
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading profile...</div>;
  }

  const initials = profile?.name ? profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'A';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl"
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Administrator Profile</h1>
        <p className="text-slate-400">Manage your account settings and security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Info Card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center text-2xl font-bold border border-orange-500/50">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{profile?.name || 'Admin User'}</h2>
              <div className="flex items-center gap-1 text-slate-400 text-sm mt-1">
                <Shield size={14} className="text-orange-500" />
                Super Administrator
              </div>
            </div>
          </div>
          
          <form onSubmit={handleProfileSubmit(onProfileSave)} className="p-6 space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-1">
                <User size={16} /> Full Name
              </label>
              <input
                type="text"
                {...registerProfile('name', { required: 'Name is required' })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-1">
                <Mail size={16} /> Email Address
              </label>
              <input
                type="email"
                {...registerProfile('email', { required: 'Email is required' })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-1">
                <Phone size={16} /> Phone Number
              </label>
              <input
                type="tel"
                {...registerProfile('phone')}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Lock size={20} className="text-orange-500" />
              Change Password
            </h2>
            <p className="text-sm text-slate-400 mt-1">Ensure your account is using a long, random password to stay secure.</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit(onPasswordSave)} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                {...registerPassword('currentPassword', { required: 'Current password is required' })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">New Password</label>
              <input
                type="password"
                {...registerPassword('newPassword', { 
                  required: 'New password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-orange-500"
              />
              {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message as string}</p>}
              
              {/* Simple strength indicator */}
              {newPassword && (
                <div className="mt-2 flex gap-1 h-1.5">
                  <div className={`flex-1 rounded-full ${newPassword.length > 0 ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                  <div className={`flex-1 rounded-full ${newPassword.length > 5 ? 'bg-yellow-500' : 'bg-slate-700'}`}></div>
                  <div className={`flex-1 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                  <div className={`flex-1 rounded-full ${newPassword.length >= 12 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                {...registerPassword('confirmPassword', { 
                  required: 'Please confirm your password',
                  validate: value => value === newPassword || 'Passwords do not match'
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-orange-500"
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message as string}</p>}
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                disabled={changePassword.isPending}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors border border-slate-600 disabled:opacity-50"
              >
                {changePassword.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfilePage;
