/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  Database, 
  Cigarette, 
  AlertCircle, 
  HelpCircle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Download,
  Upload,
  Share2,
  Smartphone,
  Laptop
} from 'lucide-react';
import { AppConfig } from '../types';

interface SistemPengaturanProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
  onResetToDefault: () => void;
}

export default function SistemPengaturan({ config, setConfig, onResetToDefault }: SistemPengaturanProps) {
  const [spreadsheetInput, setSpreadsheetInput] = useState(config.spreadsheetUrl);
  const [priceInput, setPriceInput] = useState(config.pricePerPack);
  const [modeInput, setModeInput] = useState<'live' | 'demo'>(config.mode);
  
  // Brand & profile customization state inputs
  const [brandName, setBrandName] = useState(config.brandName || 'MAKAYASA JEMBER');
  const [brandSubtitle, setBrandSubtitle] = useState(config.brandSubtitle || 'KOMANDAN');
  const [brandLogoInitials, setBrandLogoInitials] = useState(config.brandLogoInitials || 'MY');
  const [ownerName, setOwnerName] = useState(config.ownerName || 'Komandan Makayasa');
  const [ownerRole, setOwnerRole] = useState(config.ownerRole || 'Komandan Perusahaan');
  const [ownerInitials, setOwnerInitials] = useState(config.ownerInitials || 'KM');
  
  // Login credentials state inputs
  const [loginUsername, setLoginUsername] = useState(config.loginUsername || 'komandan');
  const [loginPassword, setLoginPassword] = useState(config.loginPassword || 'makayasajaya');

  const [saved, setSaved] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 1. Export Data to JSON File
  const handleExportData = () => {
    try {
      const keysToBackup = [
        'makayasa_expenses',
        'makayasa_sales_deposits',
        'makayasa_freelance_records',
        'makayasa_stok_gudang',
        'makayasa_min_stock_alert',
        'makayasa_owner_config',
        'makayasa_owner_session'
      ];
      
      const backupData: Record<string, string | null> = {};
      keysToBackup.forEach(key => {
        backupData[key] = localStorage.getItem(key);
      });
      
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataUri);
      
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `cadangan_makayasa_jaya_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      setBackupMessage({ text: 'Berhasil mengekspor cadangan data! Silakan bagikan file .json ini ke laptop/perangkat lain Anda.', type: 'success' });
      setTimeout(() => setBackupMessage(null), 5000);
    } catch (err: any) {
      setBackupMessage({ text: `Gagal mengekspor data: ${err.message || err}`, type: 'error' });
    }
  };

  // 2. Import Data from JSON File
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Simple verification that this is indeed our backup file
        const hasValidKeys = Object.keys(parsed).some(key => key.startsWith('makayasa_'));
        if (!hasValidKeys) {
          throw new Error('Format file cadangan tidak valid. Pastikan Anda mengunggah file .json yang diekspor dari aplikasi ini.');
        }

        // Save keys back to localStorage
        Object.entries(parsed).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            localStorage.setItem(key, value as string);
          }
        });

        setBackupMessage({ text: 'Berhasil mengimpor cadangan! Sistem akan memuat ulang halaman ini dalam 2 detik untuk menerapkan data...', type: 'success' });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (err: any) {
        setBackupMessage({ text: `Gagal mengimpor file: ${err.message || err}`, type: 'error' });
      }
    };
    
    fileReader.readAsText(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfig({
      ...config,
      spreadsheetUrl: spreadsheetInput,
      pricePerPack: priceInput,
      mode: modeInput,
      brandName,
      brandSubtitle,
      brandLogoInitials,
      ownerName,
      ownerRole,
      ownerInitials,
      loginUsername,
      loginPassword
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div id="pengaturan_view" className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* Settings Form Card */}
      <form onSubmit={handleSave} className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <span>Sistem Pengaturan Command Center</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1">Konfigurasi sumber data spreadsheets, harga barang jualan, dan mode aplikasi</p>
        </div>

        {saved && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Pengaturan berhasil disimpan dan diterapkan!</span>
          </motion.div>
        )}

        {/* Input: Mode Toggle */}
        <div className="space-y-2 border-b border-slate-100 pb-5">
          <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Mode Sumber Data:</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              id="set_mode_demo"
              onClick={() => setModeInput('demo')}
              className={`p-4 rounded-xl text-xs font-bold text-left border flex flex-col justify-between h-24 transition-all ${
                modeInput === 'demo'
                  ? 'bg-amber-50/50 border-amber-500 text-amber-950'
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Database className="w-5 h-5" />
              <div>
                <span className="block font-black text-sm">Demo Mode</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Simulasi data lokal 350+ baris</span>
              </div>
            </button>
            <button
              type="button"
              id="set_mode_live"
              onClick={() => setModeInput('live')}
              className={`p-4 rounded-xl text-xs font-bold text-left border flex flex-col justify-between h-24 transition-all ${
                modeInput === 'live'
                  ? 'bg-indigo-50/50 border-indigo-500 text-indigo-950'
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <RefreshCw className="w-5 h-5" />
              <div>
                <span className="block font-black text-sm">Live Google Sheet</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Ambil data langsung dari link spreadsheet</span>
              </div>
            </button>
          </div>
        </div>

        {/* Input: Spreadsheet Link */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Link Google Spreadsheet:</label>
          <input
            type="url"
            id="set_spreadsheet_url"
            value={spreadsheetInput}
            onChange={(e) => setSpreadsheetInput(e.target.value)}
            placeholder="Masukkan link Google Spreadsheet..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 font-mono"
          />
          <span className="text-[10px] text-slate-400 block font-medium">Contoh: https://docs.google.com/spreadsheets/d/1ZS6Zk0vPlMER19uRdPLZHiXReZNnJsMwdaZhFZdCeus/edit...</span>
        </div>

        {/* Input: Price of Rokok Makayasa per pack */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Harga Rokok Makayasa (per Pak):</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold text-xs font-mono">Rp</span>
            <input
              type="number"
              id="set_price_per_pack"
              value={priceInput}
              onChange={(e) => setPriceInput(parseInt(e.target.value, 10) || 0)}
              placeholder="6000"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
            />
          </div>
          <span className="text-[10px] text-slate-400 block font-medium">Beban omset penjualan dihitung berdasarkan: <strong>Volume Penjualan * Harga Jual per Pack</strong></span>
        </div>

        {/* SECTION: BRAND & PROFILE CUSTOMIZATION */}
        <div className="pt-5 border-t border-slate-100 space-y-4">
          <div>
            <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kustomisasi Identitas Brand & Profil</h5>
            <p className="text-[10px] text-slate-500 mt-0.5">Ubah nama perusahaan, inisial logo, dan identitas komandan yang ditampilkan di sidebar</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Nama Brand/Perusahaan:</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="MAKAYASA JEMBER"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Subtitle Brand Sidebar:</label>
              <input
                type="text"
                value={brandSubtitle}
                onChange={(e) => setBrandSubtitle(e.target.value)}
                placeholder="KOMANDAN"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Inisial Logo (Maks 2 Karakter):</label>
              <input
                type="text"
                maxLength={2}
                value={brandLogoInitials}
                onChange={(e) => setBrandLogoInitials(e.target.value.toUpperCase())}
                placeholder="MY"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Nama Lengkap Komandan:</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Komandan Makayasa"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Peran/Jabatan Komandan:</label>
              <input
                type="text"
                value={ownerRole}
                onChange={(e) => setOwnerRole(e.target.value)}
                placeholder="Komandan Perusahaan"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Inisial Profil (Maks 2 Karakter):</label>
              <input
                type="text"
                maxLength={2}
                value={ownerInitials}
                onChange={(e) => setOwnerInitials(e.target.value.toUpperCase())}
                placeholder="KM"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* SECTION: ACCOUNT CREDENTIALS */}
        <div className="pt-5 border-t border-slate-100 space-y-4">
          <div>
            <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kredensial Keamanan Akun (Login Komandan)</h5>
            <p className="text-[10px] text-slate-500 mt-0.5">Atur username dan kata sandi baru untuk masuk ke Command Center ini</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Username Baru:</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="komandan"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Kata Sandi Baru:</label>
              <input
                type="text"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="makayasajaya"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Action Button save */}
        <div className="flex gap-3 pt-5 border-t border-slate-100">
          <button
            type="submit"
            id="btn_save_config"
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-98"
          >
            Simpan Konfigurasi
          </button>
          <button
            type="button"
            id="btn_reset_config"
            onClick={() => {
              onResetToDefault();
              setSpreadsheetInput('https://docs.google.com/spreadsheets/d/1ZS6Zk0vPlMER19uRdPLZHiXReZNnJsMwdaZhFZdCeus/edit');
              setPriceInput(6000);
              setModeInput('demo');
              setBrandName('MAKAYASA JEMBER');
              setBrandSubtitle('KOMANDAN');
              setBrandLogoInitials('MY');
              setOwnerName('Komandan Makayasa');
              setOwnerRole('Komandan Perusahaan');
              setOwnerInitials('KM');
              setLoginUsername('komandan');
              setLoginPassword('makayasajaya');
            }}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-all border border-slate-200"
          >
            Reset Default
          </button>
        </div>
      </form>

      {/* Information side cards (1/3 width) */}
      <div className="space-y-6">
        
        {/* Card Sinkronisasi Antar Perangkat */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="text-indigo-500 w-5 h-5" />
            <span>Sinkronisasi HP & Laptop</span>
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Karena data input (seperti setoran, stok, kas) disimpan aman di memori lokal masing-masing perangkat (browser), Anda bisa mentransfer data dari HP ke Laptop agar sama persis secara instan:
          </p>

          <div className="flex items-center justify-around bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex flex-col items-center gap-1">
              <Smartphone className="w-5 h-5 text-slate-600" />
              <span className="text-[10px] font-bold text-slate-500">HP (Mobile)</span>
            </div>
            <div className="text-xs font-bold text-indigo-500 animate-pulse">➔ transfer file .json ➔</div>
            <div className="flex flex-col items-center gap-1">
              <Laptop className="w-5 h-5 text-slate-600" />
              <span className="text-[10px] font-bold text-slate-500">Laptop (PC)</span>
            </div>
          </div>

          {backupMessage && (
            <div className={`p-3 rounded-xl text-xs font-bold ${
              backupMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-150 text-emerald-800' : 'bg-rose-50 border border-rose-150 text-rose-800'
            }`}>
              {backupMessage.text}
            </div>
          )}

          <div className="space-y-2 pt-1">
            {/* Download/Export Button */}
            <button
              type="button"
              onClick={handleExportData}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Ekspor Cadangan Data (.json)
            </button>

            {/* Upload/Import Button */}
            <label className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm">
              <Upload className="w-4 h-4" />
              <span>Impor Cadangan (.json)</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
          </div>

          <div className="text-[10px] text-slate-400 font-semibold space-y-1">
            <p>💡 <strong>Tips:</strong> Ekspor data setoran dari HP Anda terlebih dahulu, lalu impor di laptop Anda. Seluruh data (setoran, stok, kas, dan setelan) akan sinkron instan tanpa perlu input ulang!</p>
          </div>
        </div>
        
        {/* Help Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="text-amber-500 w-5 h-5" />
            <span>Panduan Sinkronisasi Live</span>
          </h4>

          <div className="space-y-3 font-medium text-xs text-slate-600 leading-relaxed">
            <p>
              Untuk mengaktifkan sinkronisasi <strong>Live Google Sheet</strong>:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-[11px] text-slate-500">
              <li>Pastikan link Google Spreadsheet disetel ke <strong>"Siapa saja yang memiliki link dapat melihat"</strong> di menu Berbagi Google.</li>
              <li>Pastikan penamaan kolom di spreadsheet Anda merepresentasikan parameter: <strong>Tanggal, Sales, Toko, Alamat/Wilayah, Penjualan, Status Kunjungan</strong>.</li>
              <li>Aplikasi memiliki algoritma fuzzy-matching cerdas yang secara otomatis mendeteksi kolom walaupun penamaannya bervariasi (contoh: "Qty", "Jumlah", atau "Penjualan" akan otomatis terbaca sebagai volume order).</li>
            </ol>
          </div>
        </div>

        {/* Business Vibe Card */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
          <Cigarette className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-amber-400">Komitmen Kualitas Makayasa</h4>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Pusat kendali (Komandan Command Center) membantu menjaga reliabilitas pengiriman, kedisiplinan sales di lapangan, serta memastikan ketersediaan pasokan rokok Makayasa di setiap wilayah potensial.
          </p>
        </div>

      </div>

    </div>
  );
}
