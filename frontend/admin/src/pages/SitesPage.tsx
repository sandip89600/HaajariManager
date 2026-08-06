import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, MapPin, Calendar, User, HardHat, Building2, Eye, Map } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return config;
});

type SiteStatus = 'Active' | 'Completed' | 'Archived' | 'On Hold';

interface Site {
  _id: string;
  name: string;
  projectType: string;
  clientName: string;
  address: string;
  startDate: string;
  status: SiteStatus;
  supervisorName: string;
  workerCount: number;
}

const STATUS_COLORS: Record<SiteStatus, string> = {
  Active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
  Completed: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  Archived: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  'On Hold': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
};

export default function SitesPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<SiteStatus | 'All'>('All');

  const { data: sites = [], isLoading } = useQuery({ 
    queryKey: ['sites'], 
    queryFn: async () => (await api.get('/admin/sites')).data 
  });

  const filteredSites = sites.filter((site: Site) => {
    const matchesSearch = site.name?.toLowerCase().includes(search.toLowerCase()) || 
                          site.clientName?.toLowerCase().includes(search.toLowerCase()) || 
                          site.address?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'All' || site.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const activeCount = sites.filter((s: Site) => s.status === 'Active').length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 text-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Site Management
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-sm py-1 px-2 rounded-full font-medium">{activeCount} Active</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Global view of all construction sites across tenants.</p>
        </div>
      </div>

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by site, client, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {['All', 'Active', 'Completed', 'On Hold', 'Archived'].map(s => (
            <button 
              key={s} 
              onClick={() => setFilterStatus(s as any)} 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                ${filterStatus === s 
                  ? 'bg-orange-500 text-white border-orange-500' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-pulse">
              <div className="h-6 bg-slate-700 rounded w-2/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                <div className="h-4 bg-slate-700 rounded w-4/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center text-slate-400 flex flex-col items-center">
          <Map className="w-16 h-16 mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-white mb-2">No sites found</h3>
          <p>Try adjusting your search filters to find what you're looking for.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSites.map((site: Site) => (
            <motion.div 
              key={site._id}
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg hover:shadow-xl hover:border-slate-600 group flex flex-col"
            >
              <div className="p-6 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">{site.name}</h3>
                    <span className="inline-block bg-slate-700/50 text-slate-300 text-xs px-2 py-1 rounded font-medium">
                      {site.projectType}
                    </span>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[site.status]}`}>
                    {site.status}
                  </span>
                </div>

                <div className="space-y-3 mt-6">
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-slate-400 text-xs mb-0.5">Client</div>
                      <div className="font-medium">{site.clientName}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-slate-400 text-xs mb-0.5">Location</div>
                      <div className="leading-tight">{site.address}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-slate-400 text-xs mb-0.5">Start Date</div>
                      <div>{new Date(site.startDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <HardHat className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-slate-400 text-xs mb-0.5">Supervisor</div>
                      <div>{site.supervisorName}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-900/50 p-4 border-t border-slate-700 flex justify-between items-center mt-auto">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Building2 className="w-4 h-4" />
                  <span>{site.workerCount} Active Workers</span>
                </div>
                <button className="text-orange-500 hover:text-orange-400 text-sm font-medium flex items-center gap-1 transition-colors">
                  <Eye className="w-4 h-4" /> View Details
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
