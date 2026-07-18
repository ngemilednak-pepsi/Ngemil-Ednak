/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  PlusCircle, 
  Award, 
  DollarSign, 
  Gift, 
  History, 
  UserPlus, 
  CheckCircle,
  Tag
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Customer, Sale, User } from '../types';

interface CrmModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

export default function CrmModule({ currentBranchId, currentUser, dbVersion }: CrmModuleProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Add Member State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Voucher details
  const vouchers = LocalDb.getVouchers();

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  const loadData = () => {
    setCustomers(LocalDb.getCustomers());
    setSales(LocalDb.getSales());
  };

  // Add New CRM member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      alert('Nama dan No HP wajib diisi!');
      return;
    }

    const newCust: Customer = {
      id: `c-${Date.now()}`,
      name,
      phone,
      email,
      address,
      birthDate: birthDate || '1990-01-01',
      points: 100, // 100 welcome points!
      cashback: 10000, // Rp 10k welcome cashback!
      tier: 'Silver',
      totalSpent: 0,
      createdAt: new Date().toISOString()
    };

    const updated = [...LocalDb.getCustomers(), newCust];
    LocalDb.saveCustomers(updated);

    LocalDb.logAudit(currentUser.id, 'Customer_Added_CRM', `Registrasi member loyalitas baru: ${name}`);

    // Reset Form
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setBirthDate('');
    setShowAddForm(false);
    loadData();
    alert('Member CRM berhasil didaftarkan! Bonus 100 Loyalty Points & Rp 10.000 cashback ditambahkan.');
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">CRM & Keanggotaan Customer</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Bangun loyalitas pembeli: kelola pendaftaran member, saldo point rewards, cashback belanja, dan tier level benefit.</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white rounded-lg transition-all shadow"
        >
          <UserPlus size={14} />
          Registrasi Member Baru
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm text-xs animate-in slide-in-from-top-4 duration-200">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b pb-2">Form Registrasi Member Loyalitas F&B</h4>
          <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Nama Lengkap</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Nomor HP</label>
              <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Tanggal Lahir (Ulang Tahun)</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Alamat Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Alamat Rumah</label>
              <div className="flex gap-2">
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
                <button type="submit" className="py-1.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded">Simpan Member</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* CRM Tier Benefits Explanations Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { level: 'Silver', spent: 'Welcome tier', disc: 'Tanpa potongan khusus', cardBg: 'bg-slate-100 dark:bg-slate-800', textColor: 'text-slate-500', ptsMult: '1x Points' },
          { level: 'Gold', spent: 'Belanja > Rp 500.000', disc: 'Flat 2% OFF pada POS Kasir', cardBg: 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40', textColor: 'text-amber-500', ptsMult: '1.2x Points' },
          { level: 'Platinum', spent: 'Belanja > Rp 1.200.000', disc: 'Flat 5% OFF pada POS Kasir', cardBg: 'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40', textColor: 'text-orange-500', ptsMult: '1.5x Points' }
        ].map((item, idx) => (
          <div key={idx} className={`p-4 rounded-xl ${item.cardBg} space-y-2`}>
            <div className="flex justify-between items-center">
              <span className={`font-black text-xs uppercase tracking-wider ${item.textColor}`}>{item.level} MEMBER</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-500">{item.ptsMult}</span>
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.disc}</p>
            <p className="text-[10px] text-slate-400 font-medium">Kriteria: {item.spent}</p>
          </div>
        ))}
      </div>

      {/* Customers List and purchase history info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Customers Table Column */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Users size={16} className="text-orange-500" />
            Database Member Loyalitas
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-bold uppercase">Nama</th>
                  <th className="py-2.5 px-3 font-bold uppercase">Kontak HP</th>
                  <th className="py-2.5 px-3 font-bold uppercase text-right">Loyalty Points</th>
                  <th className="py-2.5 px-3 font-bold uppercase text-right">Saldo Cashback</th>
                  <th className="py-2.5 px-3 font-bold uppercase text-right">Total Belanja</th>
                  <th className="py-2.5 px-3 font-bold uppercase text-center">Tier Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {customers.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-bold text-slate-850 dark:text-white">{c.name}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{c.email || '-'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono">{c.phone}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-orange-500">{c.points} Pts</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-500 font-bold">Rp {c.cashback.toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400 font-bold">Rp {c.totalSpent.toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wide border ${
                        c.tier === 'Platinum' 
                          ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' 
                          : c.tier === 'Gold' 
                          ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {c.tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Promotions & Vouchers campaigns panel */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Gift size={16} className="text-orange-500" />
              Kampanye Kupon Voucher Aktif
            </h4>

            <div className="space-y-3">
              {vouchers.map((v, idx) => (
                <div key={idx} className="p-3 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl space-y-1.5 text-xs relative overflow-hidden">
                  
                  {/* Decorative tag punchhole */}
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 z-10" />
                  
                  <div className="flex justify-between items-baseline pl-1.5">
                    <span className="font-black font-mono text-orange-500 bg-orange-500/10 border border-orange-500/20 py-0.5 px-2 rounded text-[11px] select-all cursor-copy" title="Salin kode kupon">{v.code}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Min: Rp {v.minTransaction.toLocaleString('id-ID')}</span>
                  </div>

                  <p className="font-bold text-slate-800 dark:text-slate-200 pl-1.5">{v.name}</p>
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pl-1.5 pt-1 border-t border-dotted border-slate-200 dark:border-slate-800/80">
                    <span>Exp: {new Date(v.expiryDate).toLocaleDateString('id-ID')}</span>
                    <strong className="text-emerald-500 font-bold">
                      {v.discountType === 'Percentage' ? `Diskon ${v.value}%` : `Potongan Rp ${v.value.toLocaleString('id-ID')}`}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-center border-t border-slate-100 dark:border-slate-800 pt-3.5 mt-4">
            Gunakan kode kupon di atas saat transaksi checkout kasir POS!
          </div>
        </div>

      </div>

    </div>
  );
}
