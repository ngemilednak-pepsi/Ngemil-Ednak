/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  PlusCircle, 
  Truck, 
  ClipboardCheck, 
  Trash2, 
  Clock, 
  X,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Product, Supplier, PurchaseOrder, PurchaseItem, Warehouse, User } from '../types';

interface PurchasingModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

export default function PurchasingModule({ currentBranchId, currentUser, dbVersion }: PurchasingModuleProps) {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // View state: 'list' | 'create-po'
  const [currentView, setCurrentView] = useState<'list' | 'create-po'>('list');

  // New PO States
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [poItems, setPoItems] = useState<{ productId: string; quantity: number; price: number }[]>([]);
  const [poNote, setPoNote] = useState('');
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // New entry item
  const [tempProductId, setTempProductId] = useState('');
  const [tempQuantity, setTempQuantity] = useState<number>(0);
  const [tempPrice, setTempPrice] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  const loadData = () => {
    setPurchases(LocalDb.getPurchases().filter(p => p.branchId === currentBranchId).reverse());
    setSuppliers(LocalDb.getSuppliers());
    setProducts(LocalDb.getProducts());
    
    const whs = LocalDb.getWarehouses().filter(w => w.branchId === currentBranchId);
    setWarehouses(whs);
    if (whs.length > 0) {
      setSelectedWarehouseId(whs[0].id);
    }
  };

  const getSupplierName = (id: string) => {
    return suppliers.find(s => s.id === id)?.name || 'Unknown Supplier';
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown';
  };

  const getProductUnit = (id: string) => {
    const prod = products.find(p => p.id === id);
    return prod ? LocalDb.getUnits().find(u => u.id === prod.unitId)?.name : 'pcs';
  };

  // When changing item choice in PO creator, pre-populate default cost price
  const handleProductSelectionChange = (id: string) => {
    setTempProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod) {
      setTempPrice(prod.costPrice);
    }
  };

  const addItemToPo = () => {
    if (!tempProductId || tempQuantity <= 0 || tempPrice <= 0) return;
    if (poItems.some(i => i.productId === tempProductId)) {
      alert('Produk ini sudah dimasukkan!');
      return;
    }
    setPoItems(prev => [...prev, { productId: tempProductId, quantity: tempQuantity, price: tempPrice }]);
    setTempProductId('');
    setTempQuantity(0);
    setTempPrice(0);
  };

  const removeItemFromPo = (id: string) => {
    setPoItems(prev => prev.filter(i => i.productId !== id));
  };

  // Pricing math
  const subTotal = poItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = (subTotal - discountAmount) * (taxPercent / 100);
  const grandTotal = Math.max(0, subTotal - discountAmount + taxAmount);

  // Submit PO
  const handleSavePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!LocalDb.hasPermission(currentUser, 'addPurchase')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki wewenang untuk membuat dokumen pengajuan Purchase Order (PO).');
      return;
    }
    if (!selectedSupplierId || !selectedWarehouseId || poItems.length === 0) {
      alert('Lengkapi semua data Purchase Order!');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const poCount = LocalDb.getPurchases().length + 1;
    const poNo = `PO-${todayStr}-${poCount.toString().padStart(4, '0')}`;

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNo,
      supplierId: selectedSupplierId,
      branchId: currentBranchId,
      warehouseId: selectedWarehouseId,
      items: poItems,
      status: 'Draft', // Starts as Draft
      taxPercent,
      taxAmount,
      discountAmount,
      totalAmount: grandTotal,
      note: poNote,
      operatorId: currentUser.id,
      createdAt: new Date().toISOString()
    };

    const updatedPOList = [...LocalDb.getPurchases(), newPO];
    LocalDb.savePurchases(updatedPOList);

    LocalDb.logAudit(currentUser.id, 'PO_Created', `Membuat Purchase Order ${poNo} untuk ${getSupplierName(selectedSupplierId)} senilai Rp ${grandTotal.toLocaleString('id-ID')}`);

    // Reset Form
    setSelectedSupplierId('');
    setPoItems([]);
    setPoNote('');
    setCurrentView('list');
    loadData();
    alert('Draft Purchase Order berhasil dibuat. Kirim ke supervisor/owner untuk di-approve!');
  };

  // Transition status logic (Draft -> Approved -> Received)
  const handleUpdateStatus = (poId: string, nextStatus: 'Approved' | 'Received' | 'Cancelled') => {
    const allPurchases = LocalDb.getPurchases();
    const poIdx = allPurchases.findIndex(p => p.id === poId);
    if (poIdx === -1) return;

    const po = allPurchases[poIdx];

    if (po.status === 'Received') {
      alert('PO ini sudah berstatus Received (selesai ditransaksikan).');
      return;
    }

    if (nextStatus === 'Approved') {
      allPurchases[poIdx].status = 'Approved';
      LocalDb.savePurchases(allPurchases);
      LocalDb.logAudit(currentUser.id, 'PO_Approved', `Menyetujui Purchase Order ${po.poNo}`);
      alert(`Purchase Order ${po.poNo} berhasil di-APPROVE!`);
    } else if (nextStatus === 'Received') {
      // 1. ADD raw items/products to Warehouse stock
      po.items.forEach(item => {
        LocalDb.addStockMovement(
          item.productId,
          po.warehouseId,
          item.quantity,
          'In',
          po.id,
          currentUser.id,
          `Penerimaan Barang PO ${po.poNo}`
        );
      });

      // 2. Add total PO sum to Supplier accountsPayable (Hutang)
      const allSuppliers = LocalDb.getSuppliers();
      const sIdx = allSuppliers.findIndex(s => s.id === po.supplierId);
      if (sIdx > -1) {
        allSuppliers[sIdx].accountsPayable += po.totalAmount;
        LocalDb.saveSuppliers(allSuppliers);
      }

      // 3. Mark PO Received
      allPurchases[poIdx].status = 'Received';
      LocalDb.savePurchases(allPurchases);

      LocalDb.logAudit(currentUser.id, 'PO_Received', `Menerima pengiriman barang PO ${po.poNo}. Stok bahan baku bertambah, hutang tercatat.`);
      alert(`Penerimaan Barang PO ${po.poNo} sukses! Stok bertambah otomatis, hutang supplier dicatat.`);
    } else if (nextStatus === 'Cancelled') {
      allPurchases[poIdx].status = 'Cancelled';
      LocalDb.savePurchases(allPurchases);
      LocalDb.logAudit(currentUser.id, 'PO_Cancelled', `Membatalkan Purchase Order ${po.poNo}`);
      alert(`Purchase Order ${po.poNo} dibatalkan.`);
    }

    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Title & Toggle buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Pembelian Bahan Baku (Purchasing)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Kelola pengajuan pembelian bahan baku F&B (Purchase Requests & PO) dan penerimaan barang supplier.</p>
        </div>

        <div>
          {currentView === 'list' ? (
            (() => {
              const canAddPurchase = LocalDb.hasPermission(currentUser, 'addPurchase');
              return (
                <button
                  onClick={() => {
                    if (!canAddPurchase) {
                      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk membuat Purchase Order baru.');
                      return;
                    }
                    setCurrentView('create-po');
                  }}
                  className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all cursor-pointer ${
                    canAddPurchase 
                      ? 'bg-orange-500 hover:bg-orange-600' 
                      : 'bg-slate-400 dark:bg-slate-800 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {canAddPurchase ? <PlusCircle size={14} /> : <Lock size={14} />}
                  Buat Purchase Order (PO)
                </button>
              );
            })()
          ) : (
            <button
              onClick={() => setCurrentView('list')}
              className="py-2 px-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg transition-all cursor-pointer"
            >
              Kembali ke Daftar PO
            </button>
          )}
        </div>
      </div>

      {currentView === 'create-po' ? (
        /* CREATE NEW PO VIEW */
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Buat Form Pengajuan Purchase Order Baru</h3>
            <p className="text-[11px] text-slate-400 font-medium">Lengkapi supplier penyuplai, gudang penerima, dan daftar bahan baku.</p>
          </div>

          <form onSubmit={handleSavePO} className="space-y-4 text-xs">
            {/* Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Pilih Penyuplai (Supplier)</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Cp: {s.contactPerson})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Gudang Penerima</label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* PO Line Entry Block */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3.5">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Daftar Barang yang Dipesan</h4>
              
              <div className="flex flex-col sm:flex-row gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="block text-[9px] uppercase text-slate-400">Pilih Produk Jadi/Bahan Baku</label>
                  <select
                    value={tempProductId}
                    onChange={(e) => handleProductSelectionChange(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5"
                  >
                    <option value="">-- Pilih Item --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>[{p.code}] {p.name} ({p.isIngredient ? 'Bahan Baku' : 'Produk Jadi'})</option>
                    ))}
                  </select>
                </div>

                <div className="w-20 space-y-1">
                  <label className="block text-[9px] uppercase text-slate-400 text-center">Kuantitas</label>
                  <input
                    type="number"
                    placeholder="Qty..."
                    value={tempQuantity || ''}
                    onChange={(e) => setTempQuantity(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-center font-mono font-bold"
                  />
                </div>

                <div className="w-28 space-y-1">
                  <label className="block text-[9px] uppercase text-slate-400 text-right">Harga Satuan (HPP)</label>
                  <input
                    type="number"
                    placeholder="Harga..."
                    value={tempPrice || ''}
                    onChange={(e) => setTempPrice(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-right font-mono font-bold"
                  />
                </div>

                <button
                  type="button"
                  onClick={addItemToPo}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded"
                >
                  Tambah PO Item
                </button>
              </div>

              {/* Added PO Item lines table */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                      <th className="py-2 px-3">Produk / Bahan</th>
                      <th className="py-2 px-3 text-right">Jumlah Order</th>
                      <th className="py-2 px-3 text-right">Harga Beli</th>
                      <th className="py-2 px-3 text-right">Total Biaya</th>
                      <th className="py-2 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                    {poItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 text-[11px]">Belum ada item ditambahkan ke Purchase Order.</td>
                      </tr>
                    ) : (
                      poItems.map((item, idx) => {
                        const unit = getProductUnit(item.productId);
                        const rowTotal = item.price * item.quantity;
                        return (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 font-medium text-slate-850 dark:text-slate-150">{getProductName(item.productId)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">{item.quantity} {unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono">Rp {item.price.toLocaleString('id-ID')}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200 font-bold">Rp {rowTotal.toLocaleString('id-ID')}</td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeItemFromPo(item.productId)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations & Pricing panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Catatan/Note PO</label>
                  <textarea
                    placeholder="Instruksi tambahan pengiriman supplier..."
                    value={poNote}
                    onChange={(e) => setPoNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-2 h-20 text-[11px]"
                  />
                </div>
              </div>

              {/* pricing */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">Rp {subTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Potongan Harga (Diskon)</span>
                  <input
                    type="number"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseInt(e.target.value) || 0)}
                    className="w-24 bg-white dark:bg-slate-900 border border-slate-200 rounded px-2 py-0.5 font-mono text-right text-xs"
                  />
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Pajak Pembelian (PPN)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={taxPercent || ''}
                      onChange={(e) => setTaxPercent(parseInt(e.target.value) || 0)}
                      className="w-12 bg-white dark:bg-slate-900 border border-slate-200 rounded px-2 py-0.5 font-mono text-center text-xs"
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                  <span>Total Pengajuan</span>
                  <span className="font-mono text-orange-500 text-base">Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="py-2 px-4 rounded bg-slate-200 text-slate-700 font-bold"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={poItems.length === 0}
                className="py-2 px-5 rounded bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold shadow"
              >
                Kirim Pengajuan PO (Draft)
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* STANDARD PO LIST VIEW */
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Daftar Riwayat Purchase Order Cabang</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-bold uppercase">No. PO</th>
                  <th className="py-3 px-4 font-bold uppercase">Penyuplai (Supplier)</th>
                  <th className="py-3 px-4 font-bold uppercase">Gudang Penerima</th>
                  <th className="py-3 px-4 font-bold uppercase text-right">Total Anggaran</th>
                  <th className="py-3 px-4 font-bold uppercase text-center">Status</th>
                  <th className="py-3 px-4 font-bold uppercase text-center">Aksi / Persetujuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Belum ada transaksi pembelian bahan baku tercatat.</td>
                  </tr>
                ) : (
                  purchases.map((po, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div>
                          <p>{po.poNo}</p>
                          <span className="text-[9px] text-slate-400 font-mono font-medium">{new Date(po.createdAt).toLocaleDateString('id-ID')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-250">{getSupplierName(po.supplierId)}</td>
                      <td className="py-3 px-4 text-slate-500">{LocalDb.getWarehouses().find(w => w.id === po.warehouseId)?.name || 'Gudang'}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-800 dark:text-slate-200">Rp {po.totalAmount.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                          po.status === 'Draft' 
                            ? 'bg-slate-100 text-slate-500' 
                            : po.status === 'Approved' 
                            ? 'bg-blue-500/10 text-blue-500' 
                            : po.status === 'Received' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex gap-2 justify-center">
                          {/* Approval workflows based on role permissions */}
                          {po.status === 'Draft' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(po.id, 'Approved')}
                                className="text-[10px] font-bold py-1 px-2.5 rounded bg-blue-500 hover:bg-blue-600 text-white transition-all"
                              >
                                Approve PO
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(po.id, 'Cancelled')}
                                className="text-[10px] font-bold py-1 px-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 transition-all"
                              >
                                Batalkan
                              </button>
                            </>
                          )}

                          {po.status === 'Approved' && (
                            <button
                              onClick={() => handleUpdateStatus(po.id, 'Received')}
                              className="text-[10px] font-bold py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white transition-all flex items-center gap-1"
                            >
                              <ClipboardCheck size={12} />
                              Penerimaan Barang
                            </button>
                          )}

                          {po.status === 'Received' && (
                            <span className="text-[10px] text-slate-400 italic">Selesai (Stok bertambah)</span>
                          )}

                          {po.status === 'Cancelled' && (
                            <span className="text-[10px] text-slate-400 line-through">Dibatalkan</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
