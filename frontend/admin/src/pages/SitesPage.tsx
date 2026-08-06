import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, Plus, User, Building2, HardHat } from 'lucide-react';
import { api } from '../utils/api';

interface Site {
  _id: string;
  name: string;
  location?: string;
  clientName?: string;
  company?: string;
  supervisorsCount?: number;
  workersCount?: number;
  status?: string;
  isActive?: boolean;
}

export default function SitesPage() {
  const [search, setSearch] = useState('');

  // Fetch sites
  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    }
  });

  const filteredSites = sites.filter((site) => {
    return site.name.toLowerCase().includes(search.toLowerCase()) || 
           (site.location || '').toLowerCase().includes(search.toLowerCase()) ||
           (site.clientName || site.company || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Construction Sites</h1>
          <p className="text-slate-400 text-sm mt-1">Audit active sites, geofences, and supervisors</p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="glass-card p-4 rounded-2xl border border-slate-850">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by site name, location address, or client company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Grid of sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSites.length > 0 ? (
          filteredSites.map((site) => {
            const isSiteActive = site.isActive !== undefined ? site.isActive : site.status === 'active';
            return (
              <div 
                key={site._id} 
                className="glass-card p-6 rounded-2xl border border-slate-850 flex flex-col justify-between space-y-4 hover:border-slate-700/60 transition-all group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      {site.clientName || site.company || 'N/A'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${isSiteActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-orange-500 transition-colors flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-slate-400 shrink-0" />
                    {site.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                    <span>{site.location || 'No Location Details'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-850/40">
                  <div className="flex items-center gap-2.5 text-xs text-slate-400">
                    <User className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="block font-bold text-white">{site.supervisorsCount || 0}</span>
                      <span>Supervisors</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-slate-400">
                    <HardHat className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="block font-bold text-white">{site.workersCount || 0}</span>
                      <span>Deployed Workers</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 text-center py-8 text-slate-500 font-medium">
            No active construction sites found.
          </div>
        )}
      </div>
    </div>
  );
}
