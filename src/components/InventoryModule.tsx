/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  MinusCircle, 
  ArrowLeftRight, 
  Search, 
  FileSpreadsheet, 
  AlertTriangle, 
  TrendingUp, 
  History,
  Building,
  Archive,
  Check,
  Edit,
  Lock
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Product, Stock, Warehouse, Category, StockMovement, User } from '../types';

interface InventoryModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

export default function InventoryModule({ currentBranchId, currentUser, dbVersion }: InventoryModuleProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Sub-tabs: 'stock' for stock levels, 'catalog' for product list
  const [subTab, setSubTab] = useState<'stock' | 'catalog'>('stock');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilterType, setStockFilterType] = useState<'all' | 'low' | 'normal'>('all');

  // Modal forms
  const [activeForm, setActiveForm] = useState<'none' | 'adjust' | 'transfer' | 'product'>('none');
  const [formProductId, setFormProductId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formTargetWarehouseId, setFormTargetWarehouseId] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(0);
  const [formType, setFormType] = useState<'In' | 'Out'>('In');
  const [formNote, setFormNote] = useState('');

  // Product Form states (Add/Edit)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodCode, setProdCode] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodCostPrice, setProdCostPrice] = useState<number>(0);
  const [prodSellingPrice, setProdSellingPrice] = useState<number>(0);
  const [prodWholesalePrice, setProdWholesalePrice] = useState<number>(0);
  const [prodMinStock, setProdMinStock] = useState<number>(0);
  const [prodUnitId, setProdUnitId] = useState('');
  const [prodIsIngredient, setProdIsIngredient] = useState(false);
  const [prodDescription, setProdDescription] = useState('');
  const [prodIsActive, setProdIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentBranchId, dbVersion]);

  const loadData = () => {
    setStocks(LocalDb.getStocks());
    setProducts(LocalDb.getProducts());
    setCategories(LocalDb.getCategories());
    setWarehouses(LocalDb.getWarehouses().filter(w => w.branchId === currentBranchId));
    // Load reverse-chronological movements
    const allMovements = (localStorage.getItem('erp_movements') ? JSON.parse(localStorage.getItem('erp_movements')!) : []) as StockMovement[];
    setMovements(allMovements.reverse());
  };

  const getWarehouseName = (id: string) => {
    return warehouses.find(w => w.id === id)?.name || 'Gudang Lain';
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown Product';
  };

  const getProductCode = (id: string) => {
    return products.find(p => p.id === id)?.code || 'PRD-XXX';
  };

  // Perform stock adjustment
  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId || !formWarehouseId || formQuantity <= 0) {
      alert('Isi semua kolom form penyesuaian stok!');
      return;
    }

    LocalDb.addStockMovement(
      formProductId,
      formWarehouseId,
      formQuantity,
      formType,
      `ADJ-${Date.now().toString().slice(-6)}`,
      currentUser.id,
      `Penyesuaian manual: ${formNote}`
    );

    LocalDb.logAudit(currentUser.id, 'Stock_Adjustment', `Melakukan penyesuaian stok ${formType} pada produk ${getProductName(formProductId)} sebanyak ${formQuantity}`);

    // Reset Form
    setActiveForm('none');
    setFormProductId('');
    setFormQuantity(0);
    setFormNote('');
    loadData();
    alert('Penyesuaian stok berhasil disimpan.');
  };

  // Perform stock transfer
  const handleStockTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId || !formWarehouseId || !formTargetWarehouseId || formQuantity <= 0) {
      alert('Isi semua kolom form transfer stok!');
      return;
    }

    if (formWarehouseId === formTargetWarehouseId) {
      alert('Gudang sumber dan gudang tujuan tidak boleh sama!');
      return;
    }

    const success = LocalDb.transferStock(
      formProductId,
      formWarehouseId,
      formTargetWarehouseId,
      formQuantity,
      currentUser.id,
      `Transfer Gudang: ${formNote}`
    );

    if (!success) {
      alert('Gagal transfer. Stok gudang asal tidak mencukupi!');
      return;
    }

    LocalDb.logAudit(currentUser.id, 'Stock_Transfer', `Transfer stok produk ${getProductName(formProductId)} sebanyak ${formQuantity} dari ${getWarehouseName(formWarehouseId)} ke ${getWarehouseName(formTargetWarehouseId)}`);

    // Reset Form
    setActiveForm('none');
    setFormProductId('');
    setFormQuantity(0);
    setFormNote('');
    loadData();
    alert('Transfer stok gudang sukses dilakukan.');
  };

  // Open Add Product Form
  const handleOpenAddProduct = () => {
    if (!LocalDb.hasPermission(currentUser, 'editProduct')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin (hak akses) untuk menambahkan produk baru.');
      return;
    }
    setEditingProduct(null);
    setProdCode(`PRD-${Date.now().toString().slice(-4)}`);
    setProdBarcode('');
    setProdName('');
    setProdBrand('');
    setProdCategory(categories[0]?.id || 'cat-01');
    setProdCostPrice(0);
    setProdSellingPrice(0);
    setProdWholesalePrice(0);
    setProdMinStock(10);
    setProdUnitId(LocalDb.getUnits()[0]?.id || 'un-03');
    setProdIsIngredient(false);
    setProdDescription('');
    setProdIsActive(true);
    setActiveForm('product');
  };

  // Open Edit Product Form
  const handleOpenEditProduct = (prod: Product) => {
    if (!LocalDb.hasPermission(currentUser, 'editProduct')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki izin (hak akses) untuk mengedit rincian produk.');
      return;
    }
    setEditingProduct(prod);
    setProdCode(prod.code);
    setProdBarcode(prod.barcode || '');
    setProdName(prod.name);
    setProdBrand(prod.brand || '');
    setProdCategory(prod.categoryId);
    setProdCostPrice(prod.costPrice);
    setProdSellingPrice(prod.sellingPrice);
    setProdWholesalePrice(prod.wholesalePrice);
    setProdMinStock(prod.minStock);
    setProdUnitId(prod.unitId);
    setProdIsIngredient(prod.isIngredient);
    setProdDescription(prod.description || '');
    setProdIsActive(prod.isActive !== false);
    setActiveForm('product');
  };

  // Save Product (Add or Edit)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodCode || !prodName || !prodCategory || !prodUnitId) {
      alert('Isi kode, nama, kategori, dan satuan produk!');
      return;
    }

    const allProducts = LocalDb.getProducts();
    let updatedProducts: Product[] = [];

    if (editingProduct) {
      // Edit existing product
      updatedProducts = allProducts.map(p => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            code: prodCode,
            barcode: prodBarcode,
            name: prodName,
            brand: prodBrand,
            categoryId: prodCategory,
            costPrice: Number(prodCostPrice) || 0,
            sellingPrice: Number(prodSellingPrice) || 0,
            wholesalePrice: Number(prodWholesalePrice) || 0,
            minStock: Number(prodMinStock) || 0,
            unitId: prodUnitId,
            isIngredient: prodIsIngredient,
            description: prodDescription,
            isActive: prodIsActive
          };
        }
        return p;
      });

      LocalDb.logAudit(currentUser.id, 'Product_Updated', `Memperbarui detail produk: ${prodName} (${prodCode})`);
      alert('Produk berhasil diperbarui.');
    } else {
      // Create new product
      const newId = `p-${Date.now().toString()}`;
      const newProduct: Product = {
        id: newId,
        code: prodCode,
        barcode: prodBarcode,
        name: prodName,
        brand: prodBrand,
        categoryId: prodCategory,
        costPrice: Number(prodCostPrice) || 0,
        sellingPrice: Number(prodSellingPrice) || 0,
        wholesalePrice: Number(prodWholesalePrice) || 0,
        imageUrl: '',
        description: prodDescription,
        minStock: Number(prodMinStock) || 0,
        unitId: prodUnitId,
        isIngredient: prodIsIngredient,
        isActive: prodIsActive,
        createdAt: new Date().toISOString()
      };

      updatedProducts = [...allProducts, newProduct];

      // Auto-initialize stock = 0 for this new product in all warehouses
      const allStocks = LocalDb.getStocks();
      const allWarehouses = LocalDb.getWarehouses();
      const newStocks = [...allStocks];
      allWarehouses.forEach(wh => {
        const stockExists = allStocks.some(st => st.productId === newId && st.warehouseId === wh.id);
        if (!stockExists) {
          newStocks.push({
            id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            productId: newId,
            warehouseId: wh.id,
            quantity: 0
          });
        }
      });
      LocalDb.saveStocks(newStocks);

      LocalDb.logAudit(currentUser.id, 'Product_Created', `Mendaftarkan produk baru: ${prodName} (${prodCode})`);
      alert('Produk baru berhasil didaftarkan.');
    }

    LocalDb.saveProducts(updatedProducts);
    setActiveForm('none');
    loadData();
  };

  // List filtered stocks
  const filteredStocks = stocks.filter(stock => {
    const prod = products.find(p => p.id === stock.productId);
    const wh = warehouses.find(w => w.id === stock.warehouseId);
    
    // Must belong to warehouse of active branch
    if (!wh) return false;

    // Filter warehouse select
    if (selectedWarehouseId !== 'all' && stock.warehouseId !== selectedWarehouseId) return false;

    // Filter category
    if (prod && selectedCategory !== 'all' && prod.categoryId !== selectedCategory) return false;

    // Filter search text
    const query = searchQuery.toLowerCase();
    const matchQuery = prod && (prod.name.toLowerCase().includes(query) || prod.code.toLowerCase().includes(query));
    if (!matchQuery) return false;

    // Stock warning alerts filter
    if (stockFilterType === 'low') {
      return prod && stock.quantity <= prod.minStock;
    } else if (stockFilterType === 'normal') {
      return prod && stock.quantity > prod.minStock;
    }

    return true;
  });

  // List filtered products for catalog
  const filteredProducts = products.filter(prod => {
    // Filter category
    if (selectedCategory !== 'all' && prod.categoryId !== selectedCategory) return false;

    // Filter search text
    const query = searchQuery.toLowerCase();
    const matchQuery = prod.name.toLowerCase().includes(query) || prod.code.toLowerCase().includes(query) || (prod.brand && prod.brand.toLowerCase().includes(query));
    if (!matchQuery) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Inventaris & Stok Bahan</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Kelola kuantitas produk jadi, bahan baku resep, penyesuaian stok opname, dan riwayat mutasi.</p>
        </div>
        
        {/* Buttons */}
        <div className="flex gap-2">
          {subTab === 'stock' ? (
            <>
              {(() => {
                const canAdjust = LocalDb.hasPermission(currentUser, 'adjustStock');
                return (
                  <button
                    onClick={() => {
                      if (!canAdjust) {
                        alert('Akses Ditolak: Peran akun Anda tidak memiliki wewenang untuk melakukan penyesuaian stok (Stock Opname).');
                        return;
                      }
                      setFormType('In');
                      setActiveForm('adjust');
                    }}
                    className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all cursor-pointer ${
                      canAdjust 
                        ? 'bg-slate-800 hover:bg-slate-750 dark:bg-slate-700 dark:hover:bg-slate-650' 
                        : 'bg-slate-400 dark:bg-slate-850 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {canAdjust ? <PlusCircle size={14} /> : <Lock size={14} />}
                    Penyesuaian Stok
                  </button>
                );
              })()}
              {(() => {
                const canTransfer = LocalDb.hasPermission(currentUser, 'transferStock');
                return (
                  <button
                    onClick={() => {
                      if (!canTransfer) {
                        alert('Akses Ditolak: Peran akun Anda tidak memiliki wewenang untuk melakukan transfer/mutasi stok antar gudang.');
                        return;
                      }
                      setActiveForm('transfer');
                    }}
                    className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all shadow cursor-pointer ${
                      canTransfer 
                        ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/10' 
                        : 'bg-slate-400 dark:bg-slate-850 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {canTransfer ? <ArrowLeftRight size={14} /> : <Lock size={14} />}
                    Transfer Gudang
                  </button>
                );
              })()}
            </>
          ) : (
            (() => {
              const canEditProd = LocalDb.hasPermission(currentUser, 'editProduct');
              return (
                <button
                  onClick={handleOpenAddProduct}
                  className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold text-white rounded-lg transition-all shadow cursor-pointer ${
                    canEditProd 
                      ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/10' 
                      : 'bg-slate-400 dark:bg-slate-850 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {canEditProd ? <PlusCircle size={14} /> : <Lock size={14} />}
                  Tambah Produk Baru
                </button>
              );
            })()
          )}
        </div>
      </div>

      {/* Grid: Form Modals overlay */}
      {activeForm !== 'none' && (
        <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h4 className="font-bold text-sm text-slate-850 dark:text-white">
              {activeForm === 'adjust' 
                ? 'Form Penyesuaian Stok Opname' 
                : activeForm === 'transfer' 
                  ? 'Form Transfer Gudang Multi-outlet' 
                  : editingProduct 
                    ? `Edit Detail Produk: ${editingProduct.name}` 
                    : 'Tambah Produk Baru'}
            </h4>
            <button onClick={() => setActiveForm('none')} className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase">Batal</button>
          </div>

          {activeForm === 'adjust' ? (
            /* Stock Adjustment Form */
            <form onSubmit={handleStockAdjustment} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Produk/Bahan</label>
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 w-full"
                >
                  <option value="">-- Pilih Produk/Bahan --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name} ({p.isIngredient ? 'Bahan Baku' : 'Produk Jadi'})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Gudang Penyimpanan</label>
                <select
                  value={formWarehouseId}
                  onChange={(e) => setFormWarehouseId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 w-full"
                >
                  <option value="">-- Pilih Gudang --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Tipe & Jumlah</label>
                <div className="flex gap-1">
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1 py-1 text-[10px] font-bold uppercase"
                  >
                    <option value="In">Stok Masuk</option>
                    <option value="Out">Stok Keluar</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Qty..."
                    value={formQuantity || ''}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 w-20 font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Catatan Opname</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Contoh: Selisih Opname Fisik Juli..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                  <button type="submit" className="py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded">
                    Simpan
                  </button>
                </div>
              </div>
            </form>
          ) : activeForm === 'transfer' ? (
            /* Stock Transfer Form */
            <form onSubmit={handleStockTransfer} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Produk/Bahan</label>
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 w-full"
                >
                  <option value="">-- Pilih Produk/Bahan --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Dari Gudang Sumber</label>
                <select
                  value={formWarehouseId}
                  onChange={(e) => setFormWarehouseId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 w-full"
                >
                  <option value="">-- Pilih Gudang Sumber --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Ke Gudang Tujuan</label>
                <select
                  value={formTargetWarehouseId}
                  onChange={(e) => setFormTargetWarehouseId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 w-full"
                >
                  <option value="">-- Pilih Gudang Tujuan --</option>
                  {LocalDb.getWarehouses().map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({LocalDb.getBranches().find(b => b.id === w.branchId)?.name})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Kuantitas & Transfer</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={formQuantity || ''}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 w-16 font-mono text-center font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Catatan transfer..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                  <button type="submit" className="py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded">
                    Transfer
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Product Add / Edit Form */
            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Kode Produk/Bahan *</label>
                  <input
                    type="text"
                    required
                    value={prodCode}
                    onChange={(e) => setProdCode(e.target.value.toUpperCase())}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-bold font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Barcode / EAN</label>
                  <input
                    type="text"
                    value={prodBarcode}
                    onChange={(e) => setProdBarcode(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono"
                    placeholder="899..."
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Nama Produk/Bahan *</label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-bold"
                    placeholder="Contoh: Risol Mozzarella"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Merek / Brand</label>
                  <input
                    type="text"
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                    placeholder="Contoh: Dapur Risol"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 font-medium">Kategori *</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 font-medium">Satuan Barang *</label>
                  <select
                    value={prodUnitId}
                    onChange={(e) => setProdUnitId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  >
                    {LocalDb.getUnits().map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Batas Minimum Stok</label>
                  <input
                    type="number"
                    min="0"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 font-bold text-orange-500">Harga Modal (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold text-orange-600 dark:text-orange-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 font-bold text-emerald-500">Harga Jual Kasir (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={prodIsIngredient}
                    value={prodIsIngredient ? 0 : prodSellingPrice}
                    onChange={(e) => setProdSellingPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-indigo-500">Harga Jual Grosir (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={prodIsIngredient}
                    value={prodIsIngredient ? 0 : prodWholesalePrice}
                    onChange={(e) => setProdWholesalePrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono text-right font-bold text-indigo-600 dark:text-indigo-400 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tipe Produk</label>
                  <div className="flex gap-4 items-center h-8">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="prodIsIngredient"
                        checked={!prodIsIngredient}
                        onChange={() => setProdIsIngredient(false)}
                        className="text-orange-500 focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">Produk Jadi</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="prodIsIngredient"
                        checked={prodIsIngredient}
                        onChange={() => setProdIsIngredient(true)}
                        className="text-orange-500 focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">Bahan Baku</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <div className="flex items-center h-8">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={prodIsActive}
                        onChange={(e) => setProdIsActive(e.target.checked)}
                        className="w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">Status Aktif</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1 md:col-span-4">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Deskripsi Singkat</label>
                  <input
                    type="text"
                    value={prodDescription}
                    onChange={(e) => setProdDescription(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                    placeholder="Isi rincian deskripsi produk..."
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveForm('none')}
                  className="py-1.5 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded flex items-center gap-1.5 shadow shadow-orange-500/15 text-xs"
                >
                  <Check size={12} />
                  Simpan Produk
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Sub tabs selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 mt-2">
        <button
          onClick={() => setSubTab('stock')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            subTab === 'stock'
              ? 'border-orange-500 text-orange-500'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Stok per Gudang
        </button>
        <button
          onClick={() => setSubTab('catalog')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all ${
            subTab === 'catalog'
              ? 'border-orange-500 text-orange-500'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Katalog Produk
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={subTab === 'stock' ? "Cari nama produk, bahan resep atau kode..." : "Cari nama produk, merek, atau kode katalog..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto text-xs shrink-0">
          {subTab === 'stock' && (
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-2.5 rounded-lg focus:outline-none text-slate-600 dark:text-slate-400 font-sans"
            >
              <option value="all">Semua Gudang</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          )}

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-2.5 rounded-lg focus:outline-none text-slate-600 dark:text-slate-400 font-sans"
          >
            <option value="all">Semua Kategori</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {subTab === 'stock' && (
            <select
              value={stockFilterType}
              onChange={(e) => setStockFilterType(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-2.5 rounded-lg focus:outline-none text-slate-600 dark:text-slate-400 font-sans"
            >
              <option value="all">Semua Kondisi</option>
              <option value="low">🚨 Stok Kurang (Batas Minimum)</option>
              <option value="normal">✅ Stok Aman (Normal)</option>
            </select>
          )}
        </div>
      </div>

      {subTab === 'stock' ? (
        <>
          {/* Main Stock Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-3 px-4 font-bold uppercase tracking-wider">Kode</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider">Nama Produk/Bahan</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider">Gudang</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider">Kategori</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Stok Fisik</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Batas Min</th>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Tidak ada stok bahan atau produk terdaftar sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((stock, idx) => {
                      const prod = products.find(p => p.id === stock.productId);
                      if (!prod) return null;
                      const cat = categories.find(c => c.id === prod.categoryId)?.name || 'Kategori Umum';
                      const isLow = stock.quantity <= prod.minStock;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-500">{prod.code}</td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100">{prod.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {prod.isIngredient ? 'Bahan Baku Resep' : 'Produk Jadi Kasir'} &bull; Satuan: {LocalDb.getUnits().find(u => u.id === prod.unitId)?.name}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-400">{getWarehouseName(stock.warehouseId)}</td>
                          <td className="py-3 px-4 text-slate-500">{cat}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-xs text-slate-800 dark:text-slate-200">{stock.quantity.toLocaleString('id-ID')}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">{prod.minStock}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                              isLow 
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            }`}>
                              {isLow ? 'REFILL' : 'AMAN'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Movement History Logs list */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-orange-500" />
              Log Mutasi & Riwayat Kartu Stok Terkini
            </h4>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 pb-2">
                    <th className="pb-2 font-medium">Tanggal</th>
                    <th className="pb-2 font-medium">Bahan/Produk</th>
                    <th className="pb-2 font-medium">Gudang Terkait</th>
                    <th className="pb-2 font-medium">Mutasi</th>
                    <th className="pb-2 font-medium">Tipe Transaksi</th>
                    <th className="pb-2 font-medium">Ref ID</th>
                    <th className="pb-2 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-slate-600 dark:text-slate-400">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        Belum ada log pergerakan stok tercatat.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m, idx) => {
                      const whRel = m.toWarehouseId ? getWarehouseName(m.toWarehouseId) : getWarehouseName(m.fromWarehouseId!);
                      const isAddition = !!m.toWarehouseId;
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                          <td className="py-2.5 font-mono text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleString('id-ID')}</td>
                          <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">{getProductName(m.productId)}</td>
                          <td className="py-2.5">{whRel}</td>
                          <td className={`py-2.5 font-mono font-bold ${isAddition ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isAddition ? `+${m.quantity}` : `-${m.quantity}`}
                          </td>
                          <td className="py-2.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {m.type}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono text-[10px] text-slate-500">{m.referenceId}</td>
                          <td className="py-2.5 italic max-w-xs truncate">{m.note}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Katalog Produk Table */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Kode</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Nama Produk/Bahan</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Merek</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Kategori</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Harga Modal</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Harga Jual</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Harga Grosir</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Batas Min</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Tipe</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Status</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      Tidak ada produk terdaftar sesuai filter katalog.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const cat = categories.find(c => c.id === prod.categoryId)?.name || 'Kategori Umum';
                    const unitName = LocalDb.getUnits().find(u => u.id === prod.unitId)?.name || '';
                    const isActive = prod.isActive !== false;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-500">{prod.code}</td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{prod.name}</p>
                            {prod.description && (
                              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 italic max-w-xs">{prod.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{prod.brand || '-'}</td>
                        <td className="py-3 px-4 text-slate-500">{cat}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                          {prod.costPrice > 0 ? `Rp ${prod.costPrice.toLocaleString('id-ID')}` : 'Rp 0'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-850 dark:text-slate-200">
                          {prod.isIngredient ? (
                            <span className="text-slate-400 dark:text-slate-600 font-normal">-</span>
                          ) : (
                            `Rp ${prod.sellingPrice.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                          {prod.isIngredient ? (
                            <span className="text-slate-400 dark:text-slate-600 font-normal">-</span>
                          ) : (
                            `Rp ${prod.wholesalePrice.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {prod.minStock} <span className="text-[10px] text-slate-400">{unitName}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                            prod.isIngredient 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                              : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                          }`}>
                            {prod.isIngredient ? 'BAHAN BAKU' : 'PRODUK JADI'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            isActive 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                          }`}>
                            {isActive ? 'AKTIF' : 'PASIF'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="py-1 px-2.5 text-orange-500 hover:text-white hover:bg-orange-500 dark:hover:bg-orange-600 border border-orange-500/30 rounded-lg transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            title="Edit Detail Produk"
                          >
                            <Edit size={11} />
                            <span>Edit</span>
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
      )}
    </div>
  );
}
