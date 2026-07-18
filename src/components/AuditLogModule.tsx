/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Trash2, 
  Filter, 
  RefreshCw 
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { AuditLog, User } from '../types';

interface AuditLogModuleProps {
  currentUser: User;
  dbVersion?: number;
}

export default function AuditLogModule({ currentUser, dbVersion }: AuditLogModuleProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [dbVersion]);

  const loadData = () => {
    setLogs(LocalDb.getAuditLogs().reverse());
  };

  const getUserName = (id: string) => {
    return LocalDb.getUsers().find(u => u.id === id)?.name || 'Sistem Daemon';
  };

  const getRoleLabel = (id: string) => {
    return LocalDb.getUsers().find(u => u.id === id)?.role || 'System';
  };

  // Perform clearing audit trails for system cleanups
  const handleClearLogs = () => {
    if (currentUser.role !== 'Owner') {
      alert('Hanya Owner utama yang memiliki hak menghapus jejak audit log keamanan!');
      return;
    }

    if (confirm('PERINGATAN KRITIKAL!\nApakah Anda yakin ingin menghapus bersih seluruh riwayat jejak audit log keamanan sistem? Tindakan ini tidak dapat dibatalkan.')) {
      localStorage.setItem('erp_audit_logs', JSON.stringify([]));
      LocalDb.logAudit(currentUser.id, 'System_Reset', 'Menghapus paksa seluruh jejak log audit sistem');
      loadData();
      alert('Log audit berhasil dibersihkan.');
    }
  };

  const filteredLogs = logs.filter(log => {
    // Filter action type
    if (selectedActionType !== 'all' && log.action !== selectedActionType) return false;

    // Filter search text
    const query = searchQuery.toLowerCase();
    const matchesUser = getUserName(log.userId).toLowerCase().includes(query);
    const matchesNote = log.note.toLowerCase().includes(query);
    const matchesAction = log.action.toLowerCase().includes(query);

    return matchesUser || matchesNote || matchesAction;
  });

  // Extract unique action types for filter options
  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Jejak Audit Keamanan (System Audit Trail)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">Pantau riwayat operasi sistem, perubahan stok opname, pelunasan utang-piutang, login operator, dan peluncuran payroll.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-200 transition-colors"
            title="Refresh Log"
          >
            <RefreshCw size={14} />
          </button>

          {currentUser.role === 'Owner' && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 py-2 px-3 bg-red-500 hover:bg-red-600 text-xs font-bold text-white rounded-lg transition-all"
            >
              <Trash2 size={14} />
              Bersihkan Jejak Log
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan operator, deskripsi tindakan atau kode transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <select
          value={selectedActionType}
          onChange={(e) => setSelectedActionType(e.target.value)}
          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-lg focus:outline-none text-slate-600 dark:text-slate-400 font-sans w-full sm:w-56"
        >
          <option value="all">Semua Tipe Tindakan</option>
          {uniqueActions.map((act, idx) => (
            <option key={idx} value={act}>{act}</option>
          ))}
        </select>
      </div>

      {/* Main Audit log list */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400 sticky top-0 z-10">
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Tanggal & Waktu</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Operator Pegawai</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Akses</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Tindakan Sistem</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Rincian Informasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada catatan log aktivitas terekam.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-400">{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-850 dark:text-white">{getUserName(log.userId)}</div>
                      <span className="text-[9px] text-slate-400 font-mono font-medium">UID: {log.userId}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-500">{getRoleLabel(log.userId)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-orange-500/10 text-orange-600 border border-orange-500/20 uppercase tracking-wider">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-sm font-medium text-slate-750 dark:text-slate-250 italic">
                      "{log.note}"
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
