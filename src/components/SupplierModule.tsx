/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  DollarSign, 
  Phone, 
  MapPin, 
  Layers, 
  ClipboardCheck,
  Building
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Supplier, PurchaseOrder, User } from '../types';

interface SupplierModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

export default function SupplierModule({ currentBranchId, currentUser, dbVersion }: SupplierModuleProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [bankName, setBankName] = useState('BCA');
  const [bankAccount, setBankAccount] = useState('');

  // Payment states
  const [showPayForm, setShowPayForm] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState('');

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  const loadData = () => {
    setSuppliers(LocalDb.getSuppliers());
    setPurchases(LocalDb.getPurchases().filter(p => p.branchId === currentBranchId));
  };

  // Add Supplier
  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !contactPerson) {
      alert('Nama, HP, dan Contact Person wajib diisi!');
      return;
    }

    const newSup: Supplier = {
      id: `s-${Date.now()}`,
      name,
      phone,
      email,
      address,
      contactPerson,
      bankName,
      bankAccount,
      accountsPayable: 0,
      createdAt: new Date().toISOString()
    };

    const updated = [...LocalDb.getSuppliers(), newSup];
    LocalDb.saveSuppliers(updated);

    LocalDb.logAudit(currentUser.id, 'Supplier_Added', `Menambah data supplier baru: ${name}`);

    // Reset Form
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setContactPerson('');
    setBankAccount('');
    setShowAddForm(false);
    loadData();
    alert('Data supplier baru berhasil disimpan.');
  };

  // Pay Supplier AP Debt
  const handlePaySupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierId || payAmount <= 0) {
      alert('Isi semua kolom form pembayaran hutang!');
      return;
    }

    const allSuppliers = LocalDb.getSuppliers();
    const idx = allSuppliers.findIndex(s => s.id === paySupplierId);
    if (idx === -1) return;

    const sup = allSuppliers[idx];

    if (payAmount > sup.accountsPayable) {
      alert(`Jumlah bayar melebihi nominal hutang yang tercatat (Hutang: Rp ${sup.accountsPayable.toLocaleString('id-ID')})`);
      return;
    }

    // Deduct accounts payable balance
    allSuppliers[idx].accountsPayable -= payAmount;
    LocalDb.saveSuppliers(allSuppliers);

    // Register cash out Ledger log
    const ledgers = LocalDb.getFinanceLedgers();
    ledgers.push({
      id: `f-${Date.now()}`,
      branchId: currentBranchId,
      type: 'Out',
      category: 'Purchase_Payment',
      amount: payAmount,
      note: `Bayar Cicilan Hutang ke ${sup.name}. Catatan: ${payNote}`,
      operatorId: currentUser.id,
      createdAt: new Date().toISOString()
    });
    LocalDb.saveFinanceLedgers(ledgers);

    LocalDb.logAudit(currentUser.id, 'Supplier_AP_Payment', `Membayar cicilan hutang ke ${sup.name} sebesar Rp ${payAmount.toLocaleString('id-ID')}`);

    // Reset Form
    setShowPayForm(false);
    setPaySupplierId('');
    setPayAmount(0);
    setPayNote('');
    loadData();
    alert('Pembayaran cicilan hutang supplier berhasil dibukukan!');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Supplier & Utang Usaha (AP)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Hubungkan logistik supply-chain, catat nominal hutang tempo, bayar tagihan penyuplai.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowPayForm(false);
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-750 dark:bg-slate-700 dark:hover:bg-slate-650 text-xs font-bold text-white rounded-lg transition-all"
          >
            <PlusCircle size={14} />
            Tambah Supplier
          </button>
          
          <button
            onClick={() => {
              setShowAddForm(false);
              setShowPayForm(!showPayForm);
            }}
            className="flex items-center gap-1.5 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white rounded-lg transition-all shadow"
          >
            <DollarSign size={14} />
            Bayar Hutang Supplier
          </button>
        </div>
      </div>

      {/* Forms Overlay */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm text-xs animate-in slide-in-from-top-4 duration-200">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b pb-2">Form Tambah Kontak Supplier Baru</h4>
          <form onSubmit={handleAddSupplier} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Nama Supplier</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">No. HP / Kontak</label>
              <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Contact Person</label>
              <input type="text" required value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Bank & No Rekening</label>
              <div className="flex gap-1">
                <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded px-1 text-[10px]">
                  <option value="BCA">BCA</option>
                  <option value="Mandiri">Mandiri</option>
                  <option value="BRI">BRI</option>
                </select>
                <input type="text" placeholder="Rekening..." value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded px-2" />
              </div>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Alamat Lengkap Kantor/Gudang</label>
              <div className="flex gap-2">
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5" />
                <button type="submit" className="py-1.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded">Simpan Supplier</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showPayForm && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm text-xs animate-in slide-in-from-top-4 duration-200">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b pb-2">Form Pencatatan Pembayaran Cicilan Utang</h4>
          <form onSubmit={handlePaySupplier} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Pilih Supplier Penerima</label>
              <select
                value={paySupplierId}
                onChange={(e) => setPaySupplierId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
              >
                <option value="">-- Pilih Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Hutang: Rp {s.accountsPayable.toLocaleString('id-ID')})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Nominal Pembayaran (Rp)</label>
              <input
                type="number"
                placeholder="Jumlah bayar..."
                value={payAmount || ''}
                onChange={(e) => setPayAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[9px] uppercase font-bold text-slate-400">Keterangan / No. Bukti Transfer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Contoh: Bukti Transfer BCA Ref-8877..."
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                />
                <button type="submit" className="py-1.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded">Bukukan Pembayaran</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Supplier Grid list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((sup, idx) => {
          // Calculate supplier transactions in this branch
          const branchPO = purchases.filter(p => p.supplierId === sup.id);
          const totalOrderSum = branchPO.reduce((sum, p) => sum + p.totalAmount, 0);

          return (
            <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 space-y-4 shadow-sm flex flex-col justify-between hover:border-orange-500 transition-colors duration-250">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{sup.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">PIC: {sup.contactPerson}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold font-mono rounded-full ${
                    sup.accountsPayable > 0 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse' 
                      : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {sup.accountsPayable > 0 ? 'MEMILIKI TEMPO' : 'LUNAS'}
                  </span>
                </div>

                <div className="space-y-1.5 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800 pt-3">
                  <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {sup.phone}</p>
                  <p className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" /> {sup.address || '-'}</p>
                  <p className="flex items-center gap-1.5"><Layers size={12} className="text-slate-400" /> Bank: {sup.bankName} - {sup.bankAccount || 'No Rekening'}</p>
                </div>
              </div>

              {/* Accounts Payable Statistics */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-sans">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Total Utang Usaha (AP)</p>
                  <strong className="font-mono text-xs text-red-500">Rp {sup.accountsPayable.toLocaleString('id-ID')}</strong>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Transaksi Cabang</p>
                  <strong className="text-slate-700 dark:text-slate-300 font-mono text-xs">{branchPO.length} PO (Rp {totalOrderSum.toLocaleString('id-ID')})</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
