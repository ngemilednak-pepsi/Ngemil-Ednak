/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  FileSpreadsheet, 
  RefreshCw,
  Coins,
  Lock
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { FinanceLedger, LedgerCategory, User } from '../types';

interface FinanceModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

export default function FinanceModule({ currentBranchId, currentUser, dbVersion }: FinanceModuleProps) {
  const [ledgers, setLedgers] = useState<FinanceLedger[]>([]);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'In' | 'Out'>('Out');
  const [category, setCategory] = useState<LedgerCategory>('Operational_Electricity');
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  // active tab: 'ledger' | 'pnl'
  const [activeTab, setActiveTab] = useState<'ledger' | 'pnl'>('ledger');

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  const loadData = () => {
    setLedgers(LocalDb.getFinanceLedgers().filter(l => l.branchId === currentBranchId).reverse());
  };

  // Submit expense/income ledger record
  const handleAddLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!LocalDb.hasPermission(currentUser, 'manageFinance')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk menginput kas jurnal keuangan manual.');
      return;
    }
    if (amount <= 0 || !note) {
      alert('Isi jumlah nominal dan deskripsi transaksi!');
      return;
    }

    const newLedger: FinanceLedger = {
      id: `f-${Date.now()}`,
      branchId: currentBranchId,
      type,
      category,
      amount,
      note,
      operatorId: currentUser.id,
      createdAt: new Date().toISOString()
    };

    const updated = [...LocalDb.getFinanceLedgers(), newLedger];
    LocalDb.saveFinanceLedgers(updated);

    LocalDb.logAudit(currentUser.id, 'Finance_Ledger_Added', `Mencatat buku kas ${type}: ${note} senilai Rp ${amount.toLocaleString('id-ID')}`);

    // Reset Form
    setAmount(0);
    setNote('');
    setShowForm(false);
    loadData();
    alert('Catatan transaksi kas keuangan berhasil disimpan!');
  };

  // Category label mapper
  const getCategoryLabel = (cat: LedgerCategory) => {
    const map: Record<LedgerCategory, string> = {
      'Operational_Electricity': 'Listrik & Utilitas',
      'Operational_Water': 'Air Bersih',
      'Operational_Internet': 'Internet & Wifi',
      'Operational_Rent': 'Sewa Tempat/Ruko',
      'Operational_Marketing': 'Iklan & Marketing',
      'Purchase_Payment': 'Pelunasan PO Supplier',
      'Sale_Income': 'Pendapatan Kasir POS',
      'Payroll_Expense': 'Biaya Gaji Karyawan',
      'Capital_Injection': 'Suntikan Modal Owner',
      'Cash_Adjustment': 'Penyesuaian Kas / Refund'
    };
    return map[cat] || cat;
  };

  // Calculations for ledger
  const totalCashIn = ledgers.filter(l => l.type === 'In').reduce((sum, l) => sum + l.amount, 0);
  const totalCashOut = ledgers.filter(l => l.type === 'Out').reduce((sum, l) => sum + l.amount, 0);
  const cashBalance = totalCashIn - totalCashOut;

  // PROFIT & LOSS CALCULATOR
  // Income: Sales POS
  const salesIncome = ledgers.filter(l => l.type === 'In' && l.category === 'Sale_Income').reduce((sum, l) => sum + l.amount, 0);
  const capitalInjections = ledgers.filter(l => l.type === 'In' && l.category === 'Capital_Injection').reduce((sum, l) => sum + l.amount, 0);

  // COGS / HPP estimation: items cost price
  const calculateCogsAmount = () => {
    const sales = LocalDb.getSales().filter(s => s.branchId === currentBranchId && s.status === 'Completed');
    const products = LocalDb.getProducts();
    let cogs = 0;
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cost = prod ? prod.costPrice : 0;
        cogs += cost * item.quantity;
      });
    });
    return cogs;
  };

  const cogsAmount = calculateCogsAmount();
  const grossProfit = salesIncome - cogsAmount;

  // Expenses Breakdown
  const expenseElectricity = ledgers.filter(l => l.category === 'Operational_Electricity').reduce((sum, l) => sum + l.amount, 0);
  const expenseWater = ledgers.filter(l => l.category === 'Operational_Water').reduce((sum, l) => sum + l.amount, 0);
  const expenseInternet = ledgers.filter(l => l.category === 'Operational_Internet').reduce((sum, l) => sum + l.amount, 0);
  const expenseRent = ledgers.filter(l => l.category === 'Operational_Rent').reduce((sum, l) => sum + l.amount, 0);
  const expenseMarketing = ledgers.filter(l => l.category === 'Operational_Marketing').reduce((sum, l) => sum + l.amount, 0);
  const expensePayroll = ledgers.filter(l => l.category === 'Payroll_Expense').reduce((sum, l) => sum + l.amount, 0);
  const expensePurchasePayments = ledgers.filter(l => l.category === 'Purchase_Payment').reduce((sum, l) => sum + l.amount, 0);
  const expenseAdjustments = ledgers.filter(l => l.type === 'Out' && l.category === 'Cash_Adjustment').reduce((sum, l) => sum + l.amount, 0);

  const totalOperatingExpenses = expenseElectricity + expenseWater + expenseInternet + expenseRent + expenseMarketing + expensePayroll + expensePurchasePayments + expenseAdjustments;
  const netProfit = grossProfit - totalOperatingExpenses;

  return (
    <div className="space-y-6">
      
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Buku Kas & Laporan Keuangan</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">Catat pengeluaran operasional (OpEx), rekonsiliasi kas masuk, dan pantau rugi laba bersih usaha secara otomatis.</p>
        </div>

        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'ledger' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Jurnal Buku Kas
            </button>
            <button
              onClick={() => setActiveTab('pnl')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'pnl' ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Laporan Rugi Laba
            </button>
          </div>

          {(() => {
            const canManageFin = LocalDb.hasPermission(currentUser, 'manageFinance');
            return (
              <button
                onClick={() => {
                  if (!canManageFin) {
                    alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengentri transaksi manual.');
                    return;
                  }
                  setShowForm(!showForm);
                }}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all shadow cursor-pointer ${
                  canManageFin 
                    ? 'bg-orange-500 hover:bg-orange-600' 
                    : 'bg-slate-400 dark:bg-slate-800 opacity-60 cursor-not-allowed'
                }`}
              >
                {canManageFin ? <PlusCircle size={14} /> : <Lock size={14} />}
                Catat Pengeluaran/Pendapatan
              </button>
            );
          })()}
        </div>
      </div>

      {/* Expense/Income Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm text-xs animate-in slide-in-from-top-4 duration-200">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b pb-2">Form Catat Transaksi Buku Kas Manual</h4>
          <form onSubmit={handleAddLedger} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Jenis Transaksi</label>
              <select
                value={type}
                onChange={(e) => {
                  const val = e.target.value as 'In' | 'Out';
                  setType(val);
                  setCategory(val === 'In' ? 'Capital_Injection' : 'Operational_Electricity');
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
              >
                <option value="Out">Pengeluaran Kas (Cash Out)</option>
                <option value="In">Pendapatan/Modal Masuk (Cash In)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Kategori Akuntansi</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LedgerCategory)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
              >
                {type === 'Out' ? (
                  <>
                    <option value="Operational_Electricity">Listrik & Utilitas</option>
                    <option value="Operational_Water">Air Bersih</option>
                    <option value="Operational_Internet">Internet & Wifi</option>
                    <option value="Operational_Rent">Sewa Ruko/Kios</option>
                    <option value="Operational_Marketing">Biaya Marketing/Iklan</option>
                    <option value="Payroll_Expense">Biaya Gaji Karyawan</option>
                    <option value="Purchase_Payment">Pelunasan PO Supplier</option>
                    <option value="Cash_Adjustment">Penyesuaian Buku Kas Keluar</option>
                  </>
                ) : (
                  <>
                    <option value="Capital_Injection">Suntikan Modal Owner</option>
                    <option value="Sale_Income">Pendapatan Penjualan Non-POS</option>
                    <option value="Cash_Adjustment">Penyesuaian Kas Masuk</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Nominal Uang (Rp)</label>
              <input
                type="number"
                placeholder="Contoh: 150000"
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Deskripsi / Keterangan Transaksi</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Contoh: Pembelian token listrik dapur..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                />
                <button type="submit" className="py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded">Catat</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'ledger' ? (
        /* JOURNAL LEDGER VIEW */
        <div className="space-y-4">
          
          {/* Quick cash balance stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <TrendingUp size={11} className="text-emerald-500" /> Total Arus Kas Masuk (In)
              </p>
              <h4 className="text-base font-black font-mono mt-1 text-slate-900 dark:text-white">Rp {totalCashIn.toLocaleString('id-ID')}</h4>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <TrendingDown size={11} className="text-red-500" /> Total Arus Kas Keluar (Out)
              </p>
              <h4 className="text-base font-black font-mono mt-1 text-slate-900 dark:text-white">Rp {totalCashOut.toLocaleString('id-ID')}</h4>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <DollarSign size={11} className="text-orange-500" /> Saldo Bersih Buku Kas (Net)
              </p>
              <h4 className={`text-base font-black font-mono mt-1 ${cashBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                Rp {cashBalance.toLocaleString('id-ID')}
              </h4>
            </div>
          </div>

          {/* Jurnal kas list table */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Jurnal Aliran Buku Kas</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-3 px-4 font-bold uppercase">Tanggal</th>
                    <th className="py-3 px-4 font-bold uppercase">Aliran</th>
                    <th className="py-3 px-4 font-bold uppercase">Kategori Akun</th>
                    <th className="py-3 px-4 font-bold uppercase">Keterangan</th>
                    <th className="py-3 px-4 font-bold uppercase text-right">Nominal Uang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {ledgers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Belum ada catatan pembukuan kas tersimpan.</td>
                    </tr>
                  ) : (
                    ledgers.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-400">{new Date(l.createdAt).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                            l.type === 'In' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {l.type === 'In' ? 'KAS MASUK' : 'PENGELUARAN'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">{getCategoryLabel(l.category)}</td>
                        <td className="py-3 px-4 max-w-sm truncate text-slate-500 italic">"{l.note}"</td>
                        <td className={`py-3 px-4 text-right font-mono font-black ${
                          l.type === 'In' ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {l.type === 'In' ? '+' : '-'} Rp {l.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        /* INCOME PROFIT & LOSS STATEMENT VIEW */
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="border-b pb-3 border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Laporan Rugi Laba Buku Kas (Profit & Loss Statement)</h3>
              <p className="text-[11px] text-slate-400">Laporan dihitung otomatis berdasarkan akumulasi penjualan kasir dikurangi takaran HPP bahan baku (COGS) dan total pengeluaran operasional.</p>
            </div>
            <button onClick={loadData} className="p-1.5 rounded hover:bg-slate-100 text-slate-400" title="Refresh Laporan">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="max-w-xl mx-auto space-y-4 text-xs">
            {/* Row 1: Revenues */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-xs border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="uppercase">1. Pendapatan Usaha (Revenue)</span>
                <span>AKUMULASI</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Pendapatan Kotor Penjualan F&B</span>
                <span className="font-mono">Rp {salesIncome.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pl-4 pt-1 border-t border-dotted border-slate-200 dark:border-slate-800/80">
                <span>Total Pendapatan Kotor</span>
                <span className="font-mono text-emerald-500">Rp {salesIncome.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Row 2: COGS */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-xs border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="uppercase">2. Harga Pokok Penjualan (HPP / COGS)</span>
                <span>AKUMULASI</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>HPP Konsumsi Bahan Baku Terjual</span>
                <span className="font-mono text-red-500">- Rp {cogsAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pl-4 pt-1 border-t border-dotted border-slate-200 dark:border-slate-800/80">
                <span>Total HPP / COGS</span>
                <span className="font-mono text-red-500">- Rp {cogsAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Row 3: Gross Profit Margin */}
            <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border">
              <span>3. LABA KOTOR (Gross Profit Margin)</span>
              <span className="font-mono text-emerald-500">Rp {grossProfit.toLocaleString('id-ID')}</span>
            </div>

            {/* Row 4: Operating Expenses */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 text-xs border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="uppercase">4. Pengeluaran Operasional (OpEx)</span>
                <span>AKUMULASI</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Biaya Listrik & Utilitas</span>
                <span className="font-mono">Rp {expenseElectricity.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Biaya Air Bersih</span>
                <span className="font-mono">Rp {expenseWater.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Biaya Internet & Wifi</span>
                <span className="font-mono">Rp {expenseInternet.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Biaya Sewa Kios / Ruko</span>
                <span className="font-mono">Rp {expenseRent.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Biaya Iklan & Marketing</span>
                <span className="font-mono">Rp {expenseMarketing.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Biaya Gaji Karyawan (Payroll)</span>
                <span className="font-mono">Rp {expensePayroll.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Pelunasan PO Supplier (Utang AP)</span>
                <span className="font-mono">Rp {expensePurchasePayments.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600 dark:text-slate-400">
                <span>Penyesuaian Buku Kas Keluar (Refund)</span>
                <span className="font-mono">Rp {expenseAdjustments.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pl-4 pt-1 border-t border-dotted border-slate-200 dark:border-slate-800/80">
                <span>Total Pengeluaran Operasional (OpEx)</span>
                <span className="font-mono text-red-500">- Rp {totalOperatingExpenses.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Row 5: Net Profit */}
            <div className="flex justify-between font-black text-sm text-slate-100 bg-slate-900 p-3 rounded-lg border border-slate-800 mt-4 animate-pulse">
              <span>5. LABA BERSIH (Net Profit / Loss)</span>
              <span className={`font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Rp {netProfit.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
