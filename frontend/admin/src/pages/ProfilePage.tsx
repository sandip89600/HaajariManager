import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { User, Shield, Phone, Mail } from 'lucide-react';

export default function ProfilePage() {
  const adminUser = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Admin Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Manage credentials and authorization tokens</p>
      </div>

      <div className="glass-card p-6 rounded-2xl border border-slate-850 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-orange-500/10">
            {adminUser?.name ? adminUser.name.substring(0, 2).toUpperCase() : 'AD'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{adminUser?.name || 'Administrator'}</h3>
            <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded font-extrabold uppercase">
              {adminUser?.role}
            </span>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-850/40">
          <div className="flex items-center gap-3.5 text-sm text-slate-300">
            <Phone className="w-5 h-5 text-slate-500 shrink-0" />
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Phone number</span>
              <span className="font-semibold">{adminUser?.phone || 'Not configured'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 text-sm text-slate-300">
            <Mail className="w-5 h-5 text-slate-500 shrink-0" />
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Email address</span>
              <span className="font-semibold">{adminUser?.email || 'admin@haajarimanager.com'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
