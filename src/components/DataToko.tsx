/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Store, 
  Search, 
  MapPin, 
  TrendingUp, 
  History, 
  ShoppingBag,
  Award,
  Crown,
  ChevronRight,
  Sparkles,
  Navigation,
  User,
  Calendar,
  XCircle,
  Filter
} from 'lucide-react';
import { Transaction, StoreMetric, RegionMetric } from '../types';
import { formatIDR, formatDateIndo } from '../utils/spreadsheetParser';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export const extractKecamatan = (address: string, city: string, directKecamatan?: string): string => {
  const source = directKecamatan || city;
  if (source && source.trim() && source !== 'Lainnya') {
    const cleanKec = source.trim();
    if (/^(kecamatan|kec\.)/i.test(cleanKec)) {
      return cleanKec;
    }
    return 'Kec. ' + cleanKec;
  }

  const match = address.match(/(?:kecamatan|kec\.)\s+([a-zA-Z0-9\s\-]+?)(?:,|$|\d)/i);
  if (match && match[1]) {
    return 'Kec. ' + match[1].trim();
  }
  return 'Kec. Sumbersari'; // default general Jember kecamatan
};

interface DataTokoProps {
  transactions: Transaction[];
}

export default function DataToko({ transactions }: DataTokoProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'highest' | 'repeat' | 'regions'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'toko' | 'konsumen'>('all');

  // New Filters for Sales PIC & Date Range
  const [selectedSales, setSelectedSales] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Extract unique sales list
  const uniqueSalesList = React.useMemo(() => {
    const list = transactions.map(tx => tx.salesName).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [transactions]);

  // Derived filtered transactions based on selected sales & date range
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(tx => {
      // 1. Filter by Sales
      if (selectedSales !== 'all' && tx.salesName !== selectedSales) {
        return false;
      }

      // 2. Filter by Date Range
      const txDate = new Date(tx.tanggal);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const currentTxDate = new Date(txDate);
        currentTxDate.setHours(0, 0, 0, 0);
        if (currentTxDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const currentTxDate = new Date(txDate);
        currentTxDate.setHours(0, 0, 0, 0);
        if (currentTxDate > end) return false;
      }

      return true;
    });
  }, [transactions, selectedSales, startDate, endDate]);

  const parseTransaksiKeToNumeric = (val?: string): number => {
    if (!val) return 0;
    const clean = val.toLowerCase().trim();
    if (clean.includes('lebih dari 3') || clean.includes('> 3') || clean.includes('>3')) {
      return 4;
    }
    if (clean.includes('3 kali') || clean.includes('3x')) {
      return 3;
    }
    if (clean.includes('2 kali') || clean.includes('2x')) {
      return 2;
    }
    if (clean.includes('1 kali') || clean.includes('1x')) {
      return 1;
    }
    if (clean.includes('repeat order') || clean.includes('ro')) {
      return 2;
    }
    
    const match = clean.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0;
  };

  // Parse transaction data to aggregate detailed store metrics
  const getStoreMetrics = (): StoreMetric[] => {
    const storeMap: Record<string, StoreMetric> = {};

    filteredTransactions.forEach(tx => {
      const name = tx.storeName;
      if (!name || name === 'Toko Umum') return;

      // Extract region (Kecamatan) directly
      let region = 'Lainnya';
      if (tx.kecamatan && tx.kecamatan.trim()) {
        region = tx.kecamatan.trim();
      } else {
        const match = (tx.storeAddress || '').match(/(?:kecamatan|kec\.)\s+([a-zA-Z0-9\s\-]+?)(?:,|$|\d)/i);
        if (match && match[1]) {
          region = match[1].trim();
        }
      }

      // Standardize/Normalize name to look nice
      if (region && region !== 'Lainnya') {
        region = region
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        // Standardize short forms
        if (region === 'Sbr Jambe' || region === 'Sbrjambe') {
          region = 'Sumberjambe';
        } else if (region === 'Klisat') {
          region = 'Kalisat';
        }
      }

      if (!storeMap[name]) {
        storeMap[name] = {
          name,
          address: tx.storeAddress || 'Alamat tidak terdaftar',
          region,
          totalPurchasesPacks: 0,
          totalOmset: 0,
          repeatCount: 0,
          lastVisit: tx.tanggal,
          salesName: tx.salesName,
          kecamatan: tx.kecamatan,
          desa: tx.desa,
          transaksiKe: tx.transaksiKe,
          statusToko: tx.statusToko || 'Toko / Outlet'
        };
      }

      if (tx.kecamatan) {
        storeMap[name].kecamatan = tx.kecamatan;
      }
      if (tx.desa) {
        storeMap[name].desa = tx.desa;
      }

      if (tx.qtyPacks > 0) {
        storeMap[name].totalPurchasesPacks += tx.qtyPacks;
        storeMap[name].totalOmset += tx.omset;
        
        if (tx.statusKunjungan === 'Repeat Order' || (tx.transaksiKe && parseTransaksiKeToNumeric(tx.transaksiKe) >= 2) || tx.transaksiKe?.toLowerCase() === 'repeat order') {
          storeMap[name].repeatCount += 1;
        }
      }

      // Track newest visit
      if (new Date(tx.tanggal).getTime() > new Date(storeMap[name].lastVisit).getTime()) {
        storeMap[name].lastVisit = tx.tanggal;
        storeMap[name].salesName = tx.salesName;
        if (tx.transaksiKe) {
          storeMap[name].transaksiKe = tx.transaksiKe;
        }
      }
    });

    return Object.values(storeMap);
  };

  const storeMetrics = getStoreMetrics();

  // Sort store list by purchases descending for top list
  const topPurchasingStores = [...storeMetrics]
    .sort((a, b) => b.totalPurchasesPacks - a.totalPurchasesPacks)
    .slice(0, 10);

  // Sort by repeat order rating or status descending
  const topRepeatStores = [...storeMetrics]
    .filter(s => s.repeatCount > 0 || (s.transaksiKe && parseTransaksiKeToNumeric(s.transaksiKe) >= 2) || s.transaksiKe?.toLowerCase() === 'repeat order')
    .sort((a, b) => {
      const valA = parseTransaksiKeToNumeric(a.transaksiKe) || a.repeatCount;
      const valB = parseTransaksiKeToNumeric(b.transaksiKe) || b.repeatCount;
      return valB - valA;
    })
    .slice(0, 15);

  // Aggregate regional metrics (Wilayah Potensial)
  const getRegionMetrics = (): RegionMetric[] => {
    const regionMap: Record<string, { totalStores: Set<string>; packs: number; omset: number }> = {};

    storeMetrics.forEach(store => {
      const region = store.region;
      if (!regionMap[region]) {
        regionMap[region] = {
          totalStores: new Set(),
          packs: 0,
          omset: 0
        };
      }
      regionMap[region].totalStores.add(store.name);
      regionMap[region].packs += store.totalPurchasesPacks;
      regionMap[region].omset += store.totalOmset;
    });

    return Object.entries(regionMap).map(([name, data]) => ({
      name,
      totalStores: data.totalStores.size,
      totalPacks: data.packs,
      totalOmset: data.omset
    })).sort((a, b) => b.totalPacks - a.totalPacks); // Sort highest packs first
  };

  const regionMetrics = getRegionMetrics();

  // Filter all store metrics by search query & type filter
  const filteredStores = storeMetrics.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.salesName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.region.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (typeFilter === 'toko') {
      return store.statusToko !== 'Konsumen / End User';
    }
    if (typeFilter === 'konsumen') {
      return store.statusToko === 'Konsumen / End User';
    }
    return true;
  });

  const REGION_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  return (
    <div id="data_toko_view" className="space-y-6">

      {/* Global Filter Bar (Sales & Date Range) */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Sales Select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-amber-500" />
            Pilih Sales PIC
          </label>
          <div className="relative">
            <select
              value={selectedSales}
              onChange={(e) => setSelectedSales(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="all">Semua Sales ({uniqueSalesList.length})</option>
              {uniqueSalesList.map((sales) => (
                <option key={sales} value={sales}>
                  {sales}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <ChevronRight className="w-3.5 h-3.5 rotate-90" />
            </div>
          </div>
        </div>

        {/* Start Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            Dari Tanggal
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        {/* End Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            Sampai Tanggal
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        {/* Reset & Status summary */}
        <div className="flex items-center gap-2 w-full">
          {(selectedSales !== 'all' || startDate || endDate) ? (
            <button
              onClick={() => {
                setSelectedSales('all');
                setStartDate('');
                setEndDate('');
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              Reset Filter
            </button>
          ) : (
            <div className="w-full text-center py-2 px-3 bg-slate-100/70 text-[10px] text-slate-500 font-extrabold rounded-xl border border-slate-200/50">
              <span className="flex items-center justify-center gap-1 uppercase tracking-wider">
                <Filter className="w-3 h-3 text-slate-400" />
                Semua Data Aktif
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Sub-tab navigation buttons */}
      <div className="flex overflow-x-auto whitespace-nowrap pb-1 border-b border-slate-200/60 gap-1.5 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveSubTab('all')}
          id="btn_subtab_all"
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shrink-0 active:scale-95 ${
            activeSubTab === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          Semua Toko ({storeMetrics.length})
        </button>
        <button
          onClick={() => setActiveSubTab('highest')}
          id="btn_subtab_high"
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shrink-0 active:scale-95 ${
            activeSubTab === 'highest'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          Pembelian Terbanyak (Leaderboard)
        </button>
        <button
          onClick={() => setActiveSubTab('repeat')}
          id="btn_subtab_rep"
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shrink-0 active:scale-95 ${
            activeSubTab === 'repeat'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          Repeat Order Tertinggi
        </button>
        <button
          onClick={() => setActiveSubTab('regions')}
          id="btn_subtab_reg"
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shrink-0 active:scale-95 ${
            activeSubTab === 'regions'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          Wilayah Paling Potensial
        </button>
      </div>

      {/* Sub-tab CONTENT 1: ALL STORES SEARCH */}
      {activeSubTab === 'all' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-50 pb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Database Pelanggan Makayasa</h4>
              <p className="text-xs text-slate-500">Cari, sortir, dan pantau status pemesanan terakhir masing-masing outlet & konsumen</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filters */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                    typeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Semua ({storeMetrics.length})
                </button>
                <button
                  onClick={() => setTypeFilter('toko')}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                    typeFilter === 'toko'
                      ? 'bg-amber-500 text-white shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🏪 Toko / Outlet ({storeMetrics.filter(s => s.statusToko !== 'Konsumen / End User').length})
                </button>
                <button
                  onClick={() => setTypeFilter('konsumen')}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                    typeFilter === 'konsumen'
                      ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  👤 Konsumen ({storeMetrics.filter(s => s.statusToko === 'Konsumen / End User').length})
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-full md:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  id="store_search_input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, alamat, pic..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 w-full">
            <table className="w-full min-w-[800px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="p-4">Nama Pelanggan</th>
                  <th className="p-4">Alamat & Wilayah</th>
                  <th className="p-4 text-center">Total Beli (Pack)</th>
                  <th className="p-4 text-center">Kunjungan Repeat</th>
                  <th className="p-4">Sales PIC</th>
                  <th className="p-4">Kunjungan Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStores.length > 0 ? (
                  filteredStores.map((store) => (
                    <tr key={store.name} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Store className={`w-4 h-4 shrink-0 ${store.statusToko === 'Konsumen / End User' ? 'text-indigo-400' : 'text-slate-400'}`} />
                            <span className="text-slate-900 font-bold">{store.name}</span>
                          </div>
                          <div>
                            {store.statusToko === 'Konsumen / End User' ? (
                              <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-indigo-100/50 shadow-sm">
                                👤 Konsumen / End User
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-800 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-amber-100/50 shadow-sm">
                                🏪 Toko / Outlet
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span className="truncate max-w-[220px] font-bold text-slate-800" title={store.address}>
                              {(() => {
                                const kec = store.kecamatan ? store.kecamatan.trim() : '';
                                const des = store.desa ? store.desa.trim() : '';
                                if (kec || des) {
                                  return [kec, des].filter(Boolean).join(', ');
                                }
                                return store.address;
                              })()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold font-mono text-indigo-600">
                        {store.totalPurchasesPacks}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold font-mono text-[10px] uppercase ${store.transaksiKe || store.repeatCount > 0 ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-slate-100 text-slate-400'}`}>
                          {store.transaksiKe ? store.transaksiKe : `${store.repeatCount}x`}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        {store.salesName}
                      </td>
                      <td className="p-4 font-mono text-[11px] text-slate-400">
                        {formatDateIndo(store.lastVisit).split(',')[1] || formatDateIndo(store.lastVisit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Toko tidak ditemukan. Coba ketik kata kunci lainnya.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab CONTENT 2: LEADERBOARD TOKO TERBANYAK */}
      {activeSubTab === 'highest' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Top 3 Medal cards */}
          <div className="xl:col-span-1 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
              <Crown className="w-12 h-12 text-amber-400 mx-auto animate-bounce mb-3" />
              <h4 className="text-sm font-bold text-amber-400">Super Outlet Terbanyak</h4>
              {topPurchasingStores[0] ? (
                <div className="mt-4">
                  <h5 className="text-xl font-black truncate">{topPurchasingStores[0].name}</h5>
                  <div className="mt-2 flex justify-center">
                    {topPurchasingStores[0].statusToko === 'Konsumen / End User' ? (
                      <span className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 font-extrabold px-2 py-1 rounded-lg text-[10px] border border-indigo-500/30 shadow-sm">
                        👤 Konsumen / End User
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 font-extrabold px-2 py-1 rounded-lg text-[10px] border border-amber-500/30 shadow-sm">
                        🏪 Toko / Outlet
                      </span>
                    )}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl text-sm font-mono shadow-md shadow-amber-500/20">
                    <ShoppingBag className="w-4 h-4" />
                    <span>{topPurchasingStores[0].totalPurchasesPacks} Pack</span>
                  </div>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-3">
                    Omset Toko: {formatIDR(topPurchasingStores[0].totalOmset)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-4">Belum ada data toko</p>
              )}
            </div>

            {/* Top 2 and 3 quick stats */}
            <div className="grid grid-cols-2 gap-4">
              {topPurchasingStores.slice(1, 3).map((store, idx) => (
                <div key={store.name} className="bg-white border border-slate-100 rounded-xl p-4 text-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Peringkat {idx + 2}</span>
                  <h5 className="text-xs font-bold text-slate-800 truncate mt-1.5">{store.name}</h5>
                  <strong className="text-sm font-mono font-black text-indigo-600 block mt-2">{store.totalPurchasesPacks} Pack</strong>
                </div>
              ))}
            </div>
          </div>

          {/* List rank 1 - 10 */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Peringkat 10 Toko dengan Pembelian Rokok Tertinggi</h4>
            <div className="space-y-3">
              {topPurchasingStores.map((store, index) => (
                <div key={store.name} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h5 className="text-xs font-extrabold text-slate-900 truncate">{store.name}</h5>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {store.statusToko === 'Konsumen / End User' ? (
                          <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-indigo-100/50 shadow-sm shrink-0">
                            👤 Konsumen / End User
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-800 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-amber-100/50 shadow-sm shrink-0">
                            🏪 Toko / Outlet
                          </span>
                        )}
                        <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9px] border border-slate-200 shadow-sm">
                          📍 {extractKecamatan(store.address, store.region, store.kecamatan)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <strong className="text-sm font-black text-slate-800 font-mono">{store.totalPurchasesPacks} <span className="text-xs font-normal text-slate-400">Pack</span></strong>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">{formatIDR(store.totalOmset)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Sub-tab CONTENT 3: REPEAT ORDER HIGHEST */}
      {activeSubTab === 'repeat' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Leaderboard Tingkat Loyalitas Toko (Repeat Order)</h4>
            <p className="text-xs text-slate-500">Outlet dengan intensitas pemesanan berulang (repeat buy) terbanyak dari sales</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topRepeatStores.length > 0 ? (
              topRepeatStores.map((store, index) => (
                <div key={store.name} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 shadow-sm">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-extrabold text-slate-900 truncate">{store.name}</h5>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {store.statusToko === 'Konsumen / End User' ? (
                          <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-indigo-100/50 shadow-sm shrink-0">
                            👤 Konsumen / End User
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-800 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-amber-100/50 shadow-sm shrink-0">
                            🏪 Toko / Outlet
                          </span>
                        )}
                        <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9px] border border-slate-200 shadow-sm">
                          📍 {extractKecamatan(store.address, store.region, store.kecamatan)}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-semibold">Total Order (periode ini):</span>
                        <strong className="font-mono font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                          {store.totalPurchasesPacks} Pack
                        </strong>
                        <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md font-bold font-mono">
                          {formatIDR(store.totalOmset)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className="bg-sky-100 text-sky-800 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-sky-200 tracking-wide shadow-sm max-w-[120px] text-center truncate">
                      {store.transaksiKe ? store.transaksiKe.toUpperCase() : `${store.repeatCount}X REPEAT`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">PIC: {store.salesName}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-slate-400 text-xs col-span-2">Belum ada transaksi repeat order terdeteksi.</p>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab CONTENT 4: REGIONAL POTENTIALS */}
      {activeSubTab === 'regions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recharts chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Volume Penjualan (Rasio Distribusi) Per Kecamatan</h4>
            <p className="text-xs text-slate-500 mb-6">
              Grafik batang ini menunjukkan total volume rokok Makayasa (dalam satuan Pack) yang berhasil didistribusikan ke masing-masing Kecamatan. Semakin panjang batangnya, semakin tinggi tingkat penyerapan produk di wilayah tersebut.
            </p>
            
            <div className="h-80 w-full">
              {regionMetrics.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionMetrics} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" stroke="#94A3B8" fontSize={11} fontWeight={600} />
                    <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={11} fontWeight={600} width={100} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff' }}
                      itemStyle={{ fontSize: '11px' }}
                    />
                    <Bar dataKey="totalPacks" name="Total Pack" radius={[0, 8, 8, 0]}>
                      {regionMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={REGION_COLORS[index % REGION_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">Tidak ada data wilayah</div>
              )}
            </div>
          </div>

          {/* Details list */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Pemetaan Wilayah Potensial</h4>
              <p className="text-xs text-slate-500 mb-6">Daftar peringkat kecamatan berdasarkan performa penjualan dan jumlah outlet aktif</p>
              
              <div className="space-y-3 animate-fadeIn">
                {regionMetrics.map((region, index) => (
                  <div key={region.name} className="p-4 bg-slate-50 border border-slate-100 rounded-xl shadow-sm hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: REGION_COLORS[index % REGION_COLORS.length] }} />
                        <div>
                          <h5 className="text-xs font-black text-slate-900">Kec. {region.name}</h5>
                          <p className="text-[10px] text-slate-400 font-semibold">{region.totalStores} outlet aktif</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <strong className="text-xs font-black text-indigo-600 font-mono block">{region.totalPacks} Pack</strong>
                        <span className="text-[10px] text-emerald-600 font-bold block">{formatIDR(region.totalOmset)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 text-center">
              <Sparkles className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-[11px] font-bold text-slate-800">Kecamatan Prioritas Utama</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Kecamatan <strong className="text-slate-900 font-extrabold">{regionMetrics[0]?.name || '-'}</strong> menyumbang kontribusi terbesar dengan penyerapan pasar {regionMetrics[0]?.totalPacks || 0} Pack rokok.
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
