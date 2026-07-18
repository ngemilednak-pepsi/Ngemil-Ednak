/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  PlusCircle, 
  Trash2, 
  Play, 
  FileText, 
  CheckCircle, 
  ChevronRight, 
  Activity, 
  HelpCircle,
  TrendingUp,
  Coins,
  Lock
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Product, Bom, BomItem, ProductionLog, Warehouse, User } from '../types';

interface ProductionModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

export default function ProductionModule({ currentBranchId, currentUser, dbVersion }: ProductionModuleProps) {
  const [boms, setBoms] = useState<Bom[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Toggle view: 'list' | 'create-bom' | 'run-production'
  const [currentView, setCurrentView] = useState<'list' | 'create-bom' | 'run-production'>('list');

  // BOM Creator States
  const [bomFinishedProductId, setBomFinishedProductId] = useState('');
  const [bomName, setBomName] = useState('');
  const [bomIngredients, setBomIngredients] = useState<{ ingredientId: string; quantity: number }[]>([]);
  const [gasCost, setGasCost] = useState<number>(0);
  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [overheadCost, setOverheadCost] = useState<number>(0);

  // New Ingredient entry temp state
  const [tempIngredientId, setTempIngredientId] = useState('');
  const [tempQuantity, setTempQuantity] = useState<number>(0);

  // Run Production State
  const [selectedBomId, setSelectedBomId] = useState('');
  const [productionQty, setProductionQty] = useState<number>(0);
  const [rejectQty, setRejectQty] = useState<number>(0);
  const [wasteQty, setWasteQty] = useState<number>(0);
  const [productionWarehouseId, setProductionWarehouseId] = useState('');
  const [productionNote, setProductionNote] = useState('');

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  const loadData = () => {
    setBoms(LocalDb.getBoms());
    setProducts(LocalDb.getProducts());
    setProductionLogs(LocalDb.getProductionLogs().filter(p => p.branchId === currentBranchId).reverse());
    
    const whs = LocalDb.getWarehouses().filter(w => w.branchId === currentBranchId);
    setWarehouses(whs);
    if (whs.length > 0) {
      setProductionWarehouseId(whs[0].id);
    }
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown';
  };

  const getProductUnit = (id: string) => {
    const prod = products.find(p => p.id === id);
    return prod ? LocalDb.getUnits().find(u => u.id === prod.unitId)?.name : 'pcs';
  };

  const getProductCost = (id: string) => {
    return products.find(p => p.id === id)?.costPrice || 0;
  };

  // Add temp ingredient to BOM creator list
  const addIngredientToBomList = () => {
    if (!tempIngredientId || tempQuantity <= 0) return;
    if (bomIngredients.some(i => i.ingredientId === tempIngredientId)) {
      alert('Bahan ini sudah dimasukkan ke daftar!');
      return;
    }
    setBomIngredients(prev => [...prev, { ingredientId: tempIngredientId, quantity: tempQuantity }]);
    setTempIngredientId('');
    setTempQuantity(0);
  };

  // Remove ingredient from BOM creator list
  const removeIngredientFromBomList = (id: string) => {
    setBomIngredients(prev => prev.filter(i => i.ingredientId !== id));
  };

  // Calculate live HPP cost of the BOM being created
  const calculateLiveBomHpp = () => {
    const ingredientsSum = bomIngredients.reduce((sum, item) => {
      const cost = getProductCost(item.ingredientId);
      return sum + (cost * item.quantity);
    }, 0);
    return ingredientsSum + gasCost + packagingCost + laborCost + overheadCost;
  };

  const liveHppSum = calculateLiveBomHpp();

  // Save new BOM
  const handleSaveBom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!LocalDb.hasPermission(currentUser, 'manageProduction')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengelola BOM resep.');
      return;
    }
    if (!bomFinishedProductId || !bomName || bomIngredients.length === 0) {
      alert('Mohon isi nama resep, produk jadi, dan masukkan bahan baku!');
      return;
    }

    const newBom: Bom = {
      id: `bom-${Date.now()}`,
      finishedProductId: bomFinishedProductId,
      name: bomName,
      ingredients: bomIngredients.map((ing, idx) => ({
        id: `bi-${Date.now()}-${idx}`,
        ingredientId: ing.ingredientId,
        quantity: ing.quantity
      })),
      otherCosts: {
        gas: gasCost,
        packaging: packagingCost,
        labor: laborCost,
        overhead: overheadCost
      },
      totalCostPrice: liveHppSum,
      createdAt: new Date().toISOString()
    };

    const updatedBoms = [...LocalDb.getBoms(), newBom];
    LocalDb.saveBoms(updatedBoms);

    // Update finished product cost price in catalog automatically to match BOM HPP
    const updatedProducts = LocalDb.getProducts().map(p => {
      if (p.id === bomFinishedProductId) {
        return { ...p, costPrice: Math.round(liveHppSum) };
      }
      return p;
    });
    LocalDb.saveProducts(updatedProducts);

    LocalDb.logAudit(currentUser.id, 'BOM_Created', `Membuat Bill of Materials (BOM) resep "${bomName}" dengan HPP Rp ${Math.round(liveHppSum).toLocaleString('id-ID')}`);

    // Reset Creator
    setBomFinishedProductId('');
    setBomName('');
    setBomIngredients([]);
    setGasCost(0);
    setPackagingCost(0);
    setLaborCost(0);
    setOverheadCost(0);
    setCurrentView('list');
    loadData();
    alert('Bill of Materials resep baru & HPP otomatis berhasil disimpan!');
  };

  // Handle running production batch
  const handleExecuteProduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!LocalDb.hasPermission(currentUser, 'manageProduction')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengeksekusi proses produksi dapur.');
      return;
    }
    if (!selectedBomId || productionQty <= 0 || !productionWarehouseId) {
      alert('Isi semua parameter form produksi!');
      return;
    }

    const bom = boms.find(b => b.id === selectedBomId);
    if (!bom) return;

    // STEP 1: Verify ingredient stock levels before consumption
    const currentStocks = LocalDb.getStocks();
    let isSufficient = true;
    const insufficientList: string[] = [];

    bom.ingredients.forEach(item => {
      const neededQty = item.quantity * productionQty;
      const stock = currentStocks.find(s => s.productId === item.ingredientId && s.warehouseId === productionWarehouseId)?.quantity || 0;
      if (stock < neededQty) {
        isSufficient = false;
        const name = getProductName(item.ingredientId);
        insufficientList.push(`- ${name}: Dibutuhkan ${neededQty.toFixed(3)} ${getProductUnit(item.ingredientId)}, hanya tersedia ${stock.toFixed(3)}`);
      }
    });

    if (!isSufficient) {
      alert(`Gagal Memulai Produksi!\nStok bahan baku di gudang terpilih kurang:\n${insufficientList.join('\n')}`);
      return;
    }

    // STEP 2: Stocks are sufficient. Deduct ingredients & record stock-out movements
    bom.ingredients.forEach(item => {
      const neededQty = item.quantity * productionQty;
      LocalDb.addStockMovement(
        item.ingredientId,
        productionWarehouseId,
        neededQty,
        'Out',
        `PROD-OUT-${Date.now().toString().slice(-4)}`,
        currentUser.id,
        `Konsumsi bahan baku produksi batch resep ${bom.name}`
      );
    });

    // STEP 3: Add finished products & record stock-in movement (Produced minus Rejects & Waste)
    const netProduced = Math.max(0, productionQty - rejectQty - wasteQty);
    LocalDb.addStockMovement(
      bom.finishedProductId,
      productionWarehouseId,
      netProduced,
      'In',
      `PROD-IN-${Date.now().toString().slice(-4)}`,
      currentUser.id,
      `Hasil produksi produk jadi selesai (Reject: ${rejectQty}, Waste: ${wasteQty})`
    );

    // STEP 4: Record Production Log History
    const pNo = `PRD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${(productionLogs.length + 1).toString().padStart(4, '0')}`;
    const newLog: ProductionLog = {
      id: `p-log-${Date.now()}`,
      productionNo: pNo,
      bomId: bom.id,
      finishedProductId: bom.finishedProductId,
      quantityProduced: netProduced,
      quantityRejected: rejectQty,
      quantityWaste: wasteQty,
      operatorId: currentUser.id,
      branchId: currentBranchId,
      note: productionNote || 'Produksi reguler dapur',
      status: rejectQty > productionQty * 0.5 ? 'Rejected' : 'Completed',
      createdAt: new Date().toISOString()
    };

    const updatedLogs = [...LocalDb.getProductionLogs(), newLog];
    LocalDb.saveProductionLogs(updatedLogs);

    // Record bookkeeping op-ex cost ledger (gas/packaging/labor overhead multiplier for production)
    const otherCostsSum = (bom.otherCosts.gas + bom.otherCosts.packaging + bom.otherCosts.labor + bom.otherCosts.overhead) * productionQty;
    if (otherCostsSum > 0) {
      const ledgers = LocalDb.getFinanceLedgers();
      ledgers.push({
        id: `f-${Date.now()}`,
        branchId: currentBranchId,
        type: 'Out',
        category: 'Cash_Adjustment', // or Operational cost
        amount: otherCostsSum,
        referenceId: newLog.id,
        note: `Biaya produksi non-bahan (Gas/Overhead/Tenaga Kerja) batch ${pNo}`,
        operatorId: currentUser.id,
        createdAt: new Date().toISOString()
      });
      LocalDb.saveFinanceLedgers(ledgers);
    }

    LocalDb.logAudit(currentUser.id, 'Production_Run', `Melakukan produksi ${productionQty} batch resep ${bom.name}. Hasil bersih jadi: ${netProduced} pcs`);

    // Reset Form & Load
    setSelectedBomId('');
    setProductionQty(0);
    setRejectQty(0);
    setWasteQty(0);
    setProductionNote('');
    setCurrentView('list');
    loadData();
    alert(`Dapur produksi berhasil merilis ${netProduced} pcs produk ${getProductName(bom.finishedProductId)}! Stok bahan baku terpotong otomatis.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">BOM & Produksi F&B</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Rancang resep modular (BOM), kalkulasi HPP otomatis, jalankan proses batch produksi dapur.</p>
        </div>

        <div className="flex gap-2">
          {currentView !== 'list' ? (
            <button
              onClick={() => setCurrentView('list')}
              className="py-2 px-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg transition-all cursor-pointer"
            >
              Kembali ke Daftar
            </button>
          ) : (
            <>
              {(() => {
                const canManageProd = LocalDb.hasPermission(currentUser, 'manageProduction');
                return (
                  <>
                    <button
                      onClick={() => {
                        if (!canManageProd) {
                          alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk mengelola formula resep (BOM).');
                          return;
                        }
                        setCurrentView('create-bom');
                      }}
                      className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all cursor-pointer ${
                        canManageProd 
                          ? 'bg-slate-800 hover:bg-slate-750 dark:bg-slate-700 dark:hover:bg-slate-650' 
                          : 'bg-slate-400 dark:bg-slate-850 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {canManageProd ? <PlusCircle size={14} /> : <Lock size={14} />}
                      Buat Resep (BOM)
                    </button>
                    <button
                      onClick={() => {
                        if (!canManageProd) {
                          alert('Akses Ditolak: Peran akun Anda tidak memiliki izin untuk memulai eksekusi proses produksi.');
                          return;
                        }
                        setCurrentView('run-production');
                      }}
                      className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all shadow cursor-pointer ${
                        canManageProd 
                          ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/15' 
                          : 'bg-slate-400 dark:bg-slate-850 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {canManageProd ? <Play size={14} /> : <Lock size={14} />}
                      Mulai Produksi
                    </button>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {currentView === 'create-bom' && (
        /* BILL OF MATERIALS CREATOR VIEW */
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Rancang Bill of Materials (Resep F&B) Baru</h3>
            <p className="text-[11px] text-slate-400">Resep ini digunakan sebagai acuan auto-pengurangan stok bahan dan penentuan HPP dasar produk.</p>
          </div>

          <form onSubmit={handleSaveBom} className="space-y-4 text-xs">
            {/* Meta row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Nama Resep/BOM</label>
                <input
                  type="text"
                  placeholder="Contoh: Resep Risol Beef Cheese Pedas..."
                  value={bomName}
                  onChange={(e) => setBomName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Produk Hasil Jadi</label>
                <select
                  value={bomFinishedProductId}
                  onChange={(e) => setBomFinishedProductId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-slate-850 dark:text-white"
                >
                  <option value="">-- Pilih Produk Jadi --</option>
                  {products.filter(p => !p.isIngredient).map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ingredients Selection Block */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3.5">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">1. Komposisi Bahan Baku (Per 1 Pcs Porsi Selesai)</h4>
              
              {/* Entry helper */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="block text-[9px] uppercase text-slate-400 font-semibold">Pilih Bahan Baku</label>
                  <select
                    value={tempIngredientId}
                    onChange={(e) => setTempIngredientId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5"
                  >
                    <option value="">-- Pilih Bahan --</option>
                    {products.filter(p => p.isIngredient).map(p => (
                      <option key={p.id} value={p.id}>[{p.code}] {p.name} (HPP: Rp {p.costPrice.toLocaleString('id-ID')}/{LocalDb.getUnits().find(u => u.id === p.unitId)?.name})</option>
                    ))}
                  </select>
                </div>

                <div className="w-28 space-y-1">
                  <label className="block text-[9px] uppercase text-slate-400 font-semibold">Takaran/Qty</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Contoh: 0.015"
                    value={tempQuantity || ''}
                    onChange={(e) => setTempQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-center font-mono font-bold"
                  />
                </div>

                <button
                  type="button"
                  onClick={addIngredientToBomList}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded"
                >
                  Tambah Bahan
                </button>
              </div>

              {/* Added ingredients list table */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                      <th className="py-2 px-3">Bahan Baku</th>
                      <th className="py-2 px-3 text-right">Takaran Resep</th>
                      <th className="py-2 px-3 text-right">Biaya Bahan Baku (HPP)</th>
                      <th className="py-2 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                    {bomIngredients.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 text-[11px]">Belum ada bahan baku ditambahkan.</td>
                      </tr>
                    ) : (
                      bomIngredients.map((item, idx) => {
                        const cost = getProductCost(item.ingredientId);
                        const unit = getProductUnit(item.ingredientId);
                        const totalCost = cost * item.quantity;
                        return (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{getProductName(item.ingredientId)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">{item.quantity} {unit}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">Rp {Math.round(totalCost).toLocaleString('id-ID')}</td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeIngredientFromBomList(item.ingredientId)}
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

            {/* Other Overhead Cost Factors */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-3">2. Biaya Gas, Kemasan, Tenaga Kerja & Overhead Lainnya (Per Porsi)</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Gas LPG</label>
                  <input
                    type="number"
                    value={gasCost || ''}
                    onChange={(e) => setGasCost(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Kemasan Tambahan</label>
                  <input
                    type="number"
                    value={packagingCost || ''}
                    onChange={(e) => setPackagingCost(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Tenaga Kerja (Direct Labor)</label>
                  <input
                    type="number"
                    value={laborCost || ''}
                    onChange={(e) => setLaborCost(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-400">Biaya Overhead Pabrik (BOP)</label>
                  <input
                    type="number"
                    value={overheadCost || ''}
                    onChange={(e) => setOverheadCost(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Calculations and submit action */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">HPP Pokok Produksi Otomatis</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-mono text-xl font-black text-orange-500">Rp {Math.round(liveHppSum).toLocaleString('id-ID')}</span>
                  <span className="text-[10px] text-slate-400">/ Porsi</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="py-2 px-4 rounded bg-slate-200 text-slate-700 font-bold text-[11px]"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] shadow shadow-orange-500/10 animate-pulse"
                >
                  Simpan Resep & Tetapkan HPP
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {currentView === 'run-production' && (
        /* RUN BATCH PRODUCTION VIEW */
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu size={16} className="text-orange-500" />
              Mulai Produksi Batch Makanan Jadi
            </h3>
            <p className="text-[11px] text-slate-400">Pilih resep, tentukan porsi sasaran. Sistem akan memeriksa ketersediaan bahan, memotong stok otomatis, dan menambah produk siap jual.</p>
          </div>

          <form onSubmit={handleExecuteProduction} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Pilih Resep/BOM F&B</label>
                <select
                  value={selectedBomId}
                  onChange={(e) => setSelectedBomId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                >
                  <option value="">-- Pilih Resep --</option>
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>{b.name} (HPP: Rp {b.totalCostPrice.toLocaleString('id-ID')})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Gudang Penyimpanan Bahan & Hasil</label>
                <select
                  value={productionWarehouseId}
                  onChange={(e) => setProductionWarehouseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Jumlah Batch (Porsi Sasaran)</label>
                <input
                  type="number"
                  placeholder="Jumlah porsi..."
                  value={productionQty || ''}
                  onChange={(e) => setProductionQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
            </div>

            {/* Quality control section */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">Quality Control (QC) & Waste Reporting</h4>
              <p className="text-[10px] text-slate-400 mb-3">Masukkan produk jadi yang tidak layak jual (reject) atau tumpahan (waste) untuk pencatatan rugi-laba.</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-red-500">Jumlah Reject (Tidak Lolos QC)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 3"
                    value={rejectQty || ''}
                    onChange={(e) => setRejectQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-center font-bold text-red-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">Jumlah Waste (Tumpah/Basi)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 1"
                    value={wasteQty || ''}
                    onChange={(e) => setWasteQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-center font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-400">Catatan Produksi</label>
              <input
                type="text"
                placeholder="Contoh: Adonan jamur gurih, gas LPG diganti baru..."
                value={productionNote}
                onChange={(e) => setProductionNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
              />
            </div>

            {/* Calculations & Execute */}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="py-2 px-4 rounded bg-slate-200 text-slate-750 font-bold"
              >
                Kembali
              </button>
              <button
                type="submit"
                className="py-2 px-5 rounded bg-orange-500 hover:bg-orange-600 text-white font-bold"
              >
                Konfirmasi & Jalankan Produksi
              </button>
            </div>
          </form>
        </div>
      )}

      {currentView === 'list' && (
        /* STANDARD LIST OF BOMS & PRODUCTION LOGS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recipes / BOM list panel */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Coins size={16} className="text-orange-500 animate-pulse" />
              Formula Resep Terdaftar & HPP Pokok
            </h4>

            {boms.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <p>Belum ada formula resep F&B tersimpan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {boms.map((bom, bIdx) => (
                  <div key={bIdx} className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-xs text-slate-850 dark:text-white">{bom.name}</h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">Hasil Jadi: <strong>{getProductName(bom.finishedProductId)}</strong></p>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded">
                        HPP: Rp {Math.round(bom.totalCostPrice).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* Ingredients detail */}
                    <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                      <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Bahan Baku Konsumsi:</p>
                      <div className="space-y-1">
                        {bom.ingredients.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
                            <span>{getProductName(item.ingredientId)}</span>
                            <span className="font-mono font-bold">{item.quantity} {getProductUnit(item.ingredientId)}</span>
                          </div>
                        ))}
                        {bom.ingredients.length > 3 && (
                          <p className="text-[9px] text-slate-400 italic mt-0.5">+ {bom.ingredients.length - 3} bahan lainnya...</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                      <span>Overhead porsi: Rp {(bom.otherCosts.gas + bom.otherCosts.packaging + bom.otherCosts.labor + bom.otherCosts.overhead).toLocaleString('id-ID')}</span>
                      
                      {/* Action trigger to direct make production */}
                      <button
                        onClick={() => {
                          setSelectedBomId(bom.id);
                          setCurrentView('run-production');
                        }}
                        className="text-[10px] font-bold text-orange-500 hover:underline flex items-center"
                      >
                        Produksi <ChevronRight size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Production History logs list */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity size={16} className="text-orange-500" />
                Histori Produksi Dapur
              </h4>

              <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                {productionLogs.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    <p>Belum ada proses produksi selesai.</p>
                  </div>
                ) : (
                  productionLogs.map((log, idx) => (
                    <div key={idx} className="p-3 border border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-lg space-y-1.5 text-xs">
                      <div className="flex justify-between items-start">
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{log.productionNo}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${
                          log.status === 'Completed' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {log.status}
                        </span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        Diproduksi: <strong>{log.quantityProduced} pcs</strong> {getProductName(log.finishedProductId)}
                      </p>

                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Reject: {log.quantityRejected} &bull; Waste: {log.quantityWaste}</span>
                        <span>{new Date(log.createdAt).toLocaleDateString('id-ID')}</span>
                      </div>
                      
                      <p className="text-[10px] text-slate-400 italic">"{log.note}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center border-t border-slate-100 dark:border-slate-800 pt-3.5 mt-3">
              Kapasitas produksi multi-outlet terintegrasi
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
