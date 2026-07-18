/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Tag, 
  Trash2, 
  Plus, 
  Minus, 
  Percent, 
  Receipt, 
  UserPlus, 
  CheckCircle, 
  CreditCard, 
  QrCode, 
  Smartphone, 
  Wallet, 
  RotateCcw,
  User as UserIcon,
  X,
  Printer,
  ChevronDown,
  ShoppingBag,
  Ticket,
  Pencil,
  Lock
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Product, Category, Customer, Voucher, Sale, User, Warehouse, Stock } from '../types';

interface PosModuleProps {
  currentBranchId: string;
  currentUser: User;
  dbVersion?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
}

export default function PosModule({ currentBranchId, currentUser, dbVersion }: PosModuleProps) {
  // Master lists
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  
  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Voucher state
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState('');

  // Tax applicability state (optional)
  const [applyTax, setApplyTax] = useState<boolean>(() => {
    const s = LocalDb.getSettings();
    return !!s.taxEnabledByDefault;
  });

  // Held Transactions (Hold / Resume)
  const [heldCarts, setHeldCarts] = useState<{ id: string; time: string; customer: string; itemsCount: number; cart: CartItem[] }[]>([]);

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS' | 'Bank Transfer' | 'E-Wallet' | 'Split'>('Cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>(''); // For split payment
  const [splitNonCashAmount, setSplitNonCashAmount] = useState<string>(''); // For split payment
  const [paymentReference, setPaymentReference] = useState('');
  const [bankName, setBankName] = useState('BCA');

  // Completed receipt view
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Recent invoices view (for refunds/voids)
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [activeTab, setActiveTab] = useState<'sell' | 'history'>('sell');

  // Selected warehouse for subtracting stocks
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  // Add Product modal states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('cat-01');
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('Ngemil Ednak');
  const [newProdCost, setNewProdCost] = useState<number | ''>('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>('');
  const [newProdMinStock, setNewProdMinStock] = useState<number | ''>(10);
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdInitialStock, setNewProdInitialStock] = useState<number | ''>(0);
  const [newProdImg, setNewProdImg] = useState('');

  // Add Category states
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  // Filter warehouses based on active user's assignedWarehouseIds
  const allowedWarehouses = (() => {
    const allWhs = LocalDb.getWarehouses().filter(w => w.branchId === currentBranchId);
    if (currentUser.role === 'Owner') {
      return allWhs;
    }
    if (currentUser.assignedWarehouseIds && currentUser.assignedWarehouseIds.length > 0) {
      return allWhs.filter(w => currentUser.assignedWarehouseIds?.includes(w.id));
    }
    return allWhs;
  })();

  // Package/Bundle states
  const [isPackageProduct, setIsPackageProduct] = useState(false);
  const [selectedPackageComponents, setSelectedPackageComponents] = useState<{ productId: string; quantity: number }[]>([]);
  const [tempComponentId, setTempComponentId] = useState('');
  const [tempComponentQty, setTempComponentQty] = useState<number | ''>(1);

  // Helper to calculate available stock (including package logic)
  const getProductAvailableStock = (prod: Product, warehouseId: string) => {
    if (prod.isPackage && prod.packageItems) {
      if (prod.packageItems.length === 0) return 0;
      let minPackStock = Infinity;
      prod.packageItems.forEach(pkgItem => {
        const componentStock = stocks.find(s => s.productId === pkgItem.productId && s.warehouseId === warehouseId)?.quantity || 0;
        const possiblePacks = Math.floor(componentStock / pkgItem.quantity);
        if (possiblePacks < minPackStock) {
          minPackStock = possiblePacks;
        }
      });
      return minPackStock === Infinity ? 0 : minPackStock;
    }
    return stocks.find(s => s.productId === prod.id && s.warehouseId === warehouseId)?.quantity || 0;
  };

  // Helper to get last updated stock action for a product
  const getProductLastUpdatedStockInfo = (productId: string) => {
    const movements = LocalDb.getStockMovements();
    const productMoves = movements
      .filter(m => m.productId === productId && (m.fromWarehouseId === selectedWarehouseId || m.toWarehouseId === selectedWarehouseId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (productMoves.length > 0) {
      const latest = productMoves[0];
      const date = new Date(latest.createdAt);
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      const changeType = latest.toWarehouseId === selectedWarehouseId ? 'In' : 'Out';
      const qtyChange = latest.quantity;
      return {
        text: `${changeType === 'In' ? 'Masuk' : 'Keluar'} ${qtyChange} Pcs`,
        time: timeStr,
        note: latest.note || 'Mutasi'
      };
    }
    return null;
  };

  // Open product creation modal with auto-populated code
  const handleOpenAddProductModal = () => {
    setEditingProduct(null);
    const productsList = LocalDb.getProducts();
    const nextCodeNum = productsList.length + 1;
    setNewProdCode(`PRD-${nextCodeNum.toString().padStart(3, '0')}`);
    setNewProdName('');
    setNewProdCategory('cat-01');
    setNewProdBarcode('');
    setNewProdBrand('Ngemil Ednak');
    setNewProdCost('');
    setNewProdPrice('');
    setNewProdMinStock(10);
    setNewProdDesc('');
    setNewProdInitialStock(0);
    setNewProdImg('');

    // Reset package/bundle creation states
    setIsPackageProduct(false);
    setSelectedPackageComponents([]);
    const nonPackageProds = productsList.filter(p => !p.isIngredient && !p.isPackage);
    setTempComponentId(nonPackageProds[0]?.id || '');
    setTempComponentQty(1);

    setShowAddProductModal(true);
  };

  // Open product editing modal
  const handleOpenEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setNewProdName(prod.name);
    setNewProdCategory(prod.categoryId);
    setNewProdCode(prod.code);
    setNewProdBarcode(prod.barcode || '');
    setNewProdBrand(prod.brand || 'Ngemil Ednak');
    setNewProdCost(prod.costPrice || '');
    setNewProdPrice(prod.sellingPrice || '');
    setNewProdMinStock(prod.minStock || 0);
    setNewProdDesc(prod.description || '');
    setNewProdInitialStock(0); // stock editing should be done via Stock Opname
    setNewProdImg(prod.imageUrl || '');

    setIsPackageProduct(!!prod.isPackage);
    setSelectedPackageComponents(prod.packageItems || []);
    const nonPackageProds = LocalDb.getProducts().filter(p => !p.isIngredient && !p.isPackage && p.id !== prod.id);
    setTempComponentId(nonPackageProds[0]?.id || '');
    setTempComponentQty(1);

    setShowAddProductModal(true);
  };

  // Delete product completely or soft delete by setting isActive to false
  const handleDeleteProduct = (prod: Product) => {
    if (confirm(`Apakah Anda yakin ingin menghapus produk "${prod.name}" dari katalog POS?`)) {
      const productsList = LocalDb.getProducts();
      const updatedList = productsList.map(p => {
        if (p.id === prod.id) {
          return { ...p, isActive: false };
        }
        return p;
      });
      LocalDb.saveProducts(updatedList);
      LocalDb.logAudit(currentUser.id, 'POS_Product_Delete', `Menghapus produk "${prod.name}" dari katalog POS`);
      
      const allProducts = LocalDb.getProducts().filter(p => p.isActive && !p.isIngredient);
      setProducts(allProducts);
      alert(`Produk "${prod.name}" berhasil dihapus.`);
    }
  };

  // Submit product creation
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      alert('Nama produk tidak boleh kosong!');
      return;
    }
    const priceVal = Number(newProdPrice) || 0;
    if (priceVal <= 0) {
      alert('Harga jual harus lebih besar dari 0!');
      return;
    }

    if (isPackageProduct && selectedPackageComponents.length === 0) {
      alert('Produk paket minimal harus memiliki 1 komponen produk!');
      return;
    }

    const productsList = LocalDb.getProducts();
    if (productsList.some(p => p.id !== editingProduct?.id && p.code.toLowerCase() === newProdCode.trim().toLowerCase())) {
      alert(`Kode produk "${newProdCode}" sudah terdaftar! Gunakan kode lain.`);
      return;
    }

    if (editingProduct) {
      // Edit existing product
      const updatedList = productsList.map(p => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            code: newProdCode.trim().toUpperCase(),
            barcode: newProdBarcode.trim(),
            name: newProdName.trim(),
            categoryId: newProdCategory,
            brand: newProdBrand.trim(),
            costPrice: Number(newProdCost) || 0,
            sellingPrice: priceVal,
            wholesalePrice: priceVal,
            imageUrl: newProdImg.trim() || p.imageUrl,
            description: newProdDesc.trim() || (isPackageProduct ? 'Paket / Bundle produk spesial.' : 'Produk F&B POS baru ditambahkan.'),
            minStock: Number(newProdMinStock) || 0,
            isPackage: isPackageProduct || undefined,
            packageItems: isPackageProduct ? selectedPackageComponents : undefined,
          };
        }
        return p;
      });

      LocalDb.saveProducts(updatedList);

      LocalDb.logAudit(
        currentUser.id,
        'POS_Product_Edit',
        `Mengubah informasi produk "${newProdName.trim()}" dari POS`
      );

      alert(`Produk "${newProdName.trim()}" berhasil diperbarui!`);
    } else {
      // Create new product
      const newProdId = `p-${Date.now()}`;
      const defaultImg = newProdCategory === 'cat-01' 
        ? 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=300&q=80'
        : 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=300&q=80';

      const newProduct: Product = {
        id: newProdId,
        code: newProdCode.trim().toUpperCase(),
        barcode: newProdBarcode.trim(),
        name: newProdName.trim(),
        categoryId: newProdCategory,
        brand: newProdBrand.trim(),
        costPrice: Number(newProdCost) || 0,
        sellingPrice: priceVal,
        wholesalePrice: priceVal,
        imageUrl: newProdImg.trim() || defaultImg,
        description: newProdDesc.trim() || (isPackageProduct ? 'Paket / Bundle produk spesial.' : 'Produk F&B POS baru ditambahkan.'),
        minStock: Number(newProdMinStock) || 0,
        unitId: 'un-03',
        isIngredient: false,
        isPackage: isPackageProduct || undefined,
        packageItems: isPackageProduct ? selectedPackageComponents : undefined,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // Save product
      LocalDb.saveProducts([...productsList, newProduct]);

      // Save initial stock (only for regular products)
      const initStockNum = Number(newProdInitialStock) || 0;
      if (!isPackageProduct && initStockNum > 0) {
        LocalDb.addStockMovement(
          newProdId,
          selectedWarehouseId,
          initStockNum,
          'In',
          `POS-ADD-${Date.now()}`,
          currentUser.id,
          'Stok awal produk baru dari POS'
        );
      }

      // Log audit
      LocalDb.logAudit(
        currentUser.id, 
        'POS_Product_Add', 
        isPackageProduct 
          ? `Menambah produk paket baru "${newProduct.name}" dengan ${selectedPackageComponents.length} komponen` 
          : `Menambah produk baru "${newProduct.name}" dengan stok awal ${initStockNum} Pcs`
      );

      alert(`Produk "${newProduct.name}" berhasil ditambahkan!`);
    }

    // Refresh products list in POS view
    const allProducts = LocalDb.getProducts().filter(p => p.isActive && !p.isIngredient);
    setProducts(allProducts);
    setStocks(LocalDb.getStocks());

    setShowAddProductModal(false);
    setEditingProduct(null);
  };

  // Submit category creation
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      alert('Nama kategori tidak boleh kosong!');
      return;
    }

    const existingCats = LocalDb.getCategories();
    const cleanName = newCategoryName.trim();
    if (existingCats.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      alert(`Kategori "${cleanName}" sudah terdaftar!`);
      return;
    }

    const newCatId = `cat-${Date.now()}`;
    const newCategory: Category = {
      id: newCatId,
      name: cleanName,
      description: newCategoryDesc.trim() || 'Kategori kustom ditambahkan dari POS.'
    };

    const updatedCategories = [...existingCats, newCategory];
    LocalDb.saveCategories(updatedCategories);

    // Refresh categories state
    const nonIngredientCategories = updatedCategories.filter(c => c.id !== 'cat-03' && c.id !== 'cat-04' && c.id !== 'cat-05');
    setCategories(nonIngredientCategories);
    
    // Auto-select this newly created category for the product creation
    setNewProdCategory(newCatId);

    // Reset states
    setNewCategoryName('');
    setNewCategoryDesc('');
    setShowAddCategoryModal(false);
    alert(`Kategori "${cleanName}" berhasil ditambahkan dan otomatis terpilih!`);
  };

  // System Settings (tax percent etc.)
  const settings = LocalDb.getSettings();

  useEffect(() => {
    // Exclude ingredients (RAW-*** and IS_INGREDIENT true) from checkout POS catalog
    const allProducts = LocalDb.getProducts().filter(p => p.isActive && !p.isIngredient);
    setProducts(allProducts);
    
    // Load non-ingredient categories
    const nonIngredientCategories = LocalDb.getCategories().filter(c => c.id !== 'cat-03' && c.id !== 'cat-04' && c.id !== 'cat-05');
    setCategories(nonIngredientCategories);
    setCustomers(LocalDb.getCustomers());
    setVouchers(LocalDb.getVouchers());
    setStocks(LocalDb.getStocks());

    // Select first warehouse of this branch by default, respecting user assignment if any
    const allowedWhs = (() => {
      const allWhs = LocalDb.getWarehouses().filter(w => w.branchId === currentBranchId);
      if (currentUser.role === 'Owner') return allWhs;
      if (currentUser.assignedWarehouseIds && currentUser.assignedWarehouseIds.length > 0) {
        return allWhs.filter(w => currentUser.assignedWarehouseIds?.includes(w.id));
      }
      return allWhs;
    })();

    if (allowedWhs.length > 0) {
      setSelectedWarehouseId(allowedWhs[0].id);
    } else {
      setSelectedWarehouseId('');
    }

    // Load recent sales of this branch
    setRecentSales(LocalDb.getSales().filter(s => s.branchId === currentBranchId).reverse());
  }, [currentBranchId, dbVersion]);

  // Barcode Scanner simulator: typing code and pressing Enter triggers direct addition
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    
    const prod = products.find(p => p.barcode === barcodeInput || p.code === barcodeInput);
    if (prod) {
      addToCart(prod);
      setBarcodeInput('');
    } else {
      alert(`Barcode "${barcodeInput}" tidak terdaftar sebagai produk jadi!`);
    }
  };

  // Add Item to Checkout Cart
  const addToCart = (product: Product) => {
    // Check if sufficient stock is available in selected warehouse
    const currentStock = getProductAvailableStock(product, selectedWarehouseId);
    
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx > -1) {
        if (prev[idx].quantity >= currentStock) {
          alert(`Peringatan: Stok fisik ${product.name} di gudang terpilih tidak mencukupi (Tersisa ${currentStock} pcs).`);
          return prev;
        }
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      } else {
        if (currentStock <= 0) {
          alert(`Peringatan: Stok fisik ${product.name} di gudang terpilih saat ini kosong (0 Pcs).`);
          return prev;
        }
        return [...prev, { product, quantity: 1, discountPercent: 0 }];
      }
    });
  };

  // Adjust Item Qty
  const adjustQty = (productId: string, val: number) => {
    const itemInCart = cart.find(it => it.product.id === productId);
    if (!itemInCart) return;
    const currentStock = getProductAvailableStock(itemInCart.product, selectedWarehouseId);
    
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === productId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const newQty = updated[idx].quantity + val;
      if (newQty > currentStock) {
        alert(`Peringatan: Stok fisik ${updated[idx].product.name} di gudang terpilih tidak mencukupi (Tersisa ${currentStock} pcs).`);
        return prev;
      }
      updated[idx].quantity = Math.max(1, newQty);
      return updated;
    });
  };

  // Set Item specific discount percentage (simulating supervisor manual overrides)
  const adjustItemDiscount = (productId: string, discount: number) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === productId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx].discountPercent = Math.min(100, Math.max(0, discount));
      return updated;
    });
  };

  // Remove Item
  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Apply Voucher
  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherError('');
    if (!voucherCode.trim()) return;

    const v = vouchers.find(v => v.code.toUpperCase() === voucherCode.toUpperCase().trim() && v.isActive);
    if (!v) {
      setVoucherError('Voucher tidak ditemukan atau sudah tidak aktif.');
      setAppliedVoucher(null);
      return;
    }

    // Check min transaction
    if (subTotal < v.minTransaction) {
      setVoucherError(`Transaksi minimal Rp ${v.minTransaction.toLocaleString('id-ID')} untuk voucher ini.`);
      setAppliedVoucher(null);
      return;
    }

    setAppliedVoucher(v);
  };

  // Cancel Voucher
  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setVoucherError('');
  };

  // Hold transaction state
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const holdItem = {
      id: `hold-${Date.now()}`,
      time: new Date().toLocaleTimeString('id-ID'),
      customer: selectedCustomer ? selectedCustomer.name : 'Umum (Walk-in)',
      itemsCount: cart.reduce((sum, i) => sum + i.quantity, 0),
      cart: [...cart]
    };
    setHeldCarts(prev => [holdItem, ...prev]);
    setCart([]);
    setSelectedCustomer(null);
    removeVoucher();
    alert('Keranjang belanja berhasil di-HOLD (ditangguhkan).');
  };

  // Resume transaction state
  const handleResumeCart = (id: string) => {
    const held = heldCarts.find(h => h.id === id);
    if (!held) return;
    setCart(held.cart);
    setHeldCarts(prev => prev.filter(h => h.id !== id));
    alert('Keranjang belanja berhasil di-RESUME (dilanjutkan).');
  };

  // Calculations
  const subTotal = cart.reduce((sum, item) => {
    const itemPrice = item.product.sellingPrice;
    const discountFactor = (100 - item.discountPercent) / 100;
    return sum + (itemPrice * item.quantity * discountFactor);
  }, 0);

  // Member Tier Discount (Silver 0%, Gold 2%, Platinum 5% applied automatic)
  const getMemberTierDiscountPercent = () => {
    if (!selectedCustomer) return 0;
    if (selectedCustomer.tier === 'Gold') return 2;
    if (selectedCustomer.tier === 'Platinum') return 5;
    return 0;
  };

  const memberDiscountPercent = getMemberTierDiscountPercent();
  const memberDiscountAmount = subTotal * (memberDiscountPercent / 100);

  // Voucher discount
  const getVoucherDiscountAmount = () => {
    if (!appliedVoucher) return 0;
    const baseAfterMember = subTotal - memberDiscountAmount;
    if (appliedVoucher.discountType === 'Percentage') {
      return baseAfterMember * (appliedVoucher.value / 100);
    } else {
      return appliedVoucher.value;
    }
  };

  const voucherDiscountAmount = getVoucherDiscountAmount();
  const totalDiscount = memberDiscountAmount + voucherDiscountAmount;

  const taxableAmount = Math.max(0, subTotal - totalDiscount);
  const taxPercent = applyTax ? settings.taxPercent : 0;
  const taxAmount = taxableAmount * (taxPercent / 100);

  const grandTotal = taxableAmount + taxAmount;

  // Checkout submission
  const handleProcessCheckout = () => {
    if (!LocalDb.hasPermission(currentUser, 'checkoutSales')) {
      alert('Akses Ditolak: Peran akun Anda tidak memiliki wewenang untuk memproses transaksi kasir (checkout).');
      return;
    }
    if (cart.length === 0) return;
    
    // Default cash amount to grand total for quick processing
    if (paymentMethod === 'Cash' && !cashAmount) {
      setCashAmount(Math.ceil(grandTotal).toString());
    }

    // Set split payments if Split is selected
    if (paymentMethod === 'Split') {
      setSplitCashAmount(Math.round(grandTotal / 2).toString());
      setSplitNonCashAmount(Math.round(grandTotal / 2).toString());
    }

    setShowCheckout(true);
  };

  const submitTransaction = () => {
    let finalCashReceived = 0;
    let change = 0;

    if (paymentMethod === 'Cash') {
      const cashVal = parseFloat(cashAmount) || 0;
      if (cashVal < grandTotal) {
        alert('Pembayaran tunai kurang dari total tagihan!');
        return;
      }
      finalCashReceived = cashVal;
      change = cashVal - grandTotal;
    } else if (paymentMethod === 'Split') {
      const splitCash = parseFloat(splitCashAmount) || 0;
      const splitNonCash = parseFloat(splitNonCashAmount) || 0;
      if (splitCash + splitNonCash < grandTotal) {
        alert('Gabungan pembayaran Split kurang dari total tagihan!');
        return;
      }
      finalCashReceived = splitCash;
      change = (splitCash + splitNonCash) - grandTotal; // Usually change is 0 for exact split, but calculator-safe
    }

    // Generate Invoice Number: INV-YYYYMMDD-00000X
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoices = LocalDb.getSales();
    const countToday = invoices.filter(s => s.invoiceNo.startsWith(`INV-${todayStr}`)).length + 1;
    const invoiceNo = `INV-${todayStr}-${countToday.toString().padStart(6, '0')}`;

    const saleItemData = cart.map(item => {
      const p = item.product;
      const itemPrice = p.sellingPrice;
      const discPercent = item.discountPercent;
      const discAmt = itemPrice * item.quantity * (discPercent / 100);
      return {
        productId: p.id,
        quantity: item.quantity,
        price: itemPrice,
        discountPercent: discPercent,
        discountAmount: discAmt,
        total: (itemPrice * item.quantity) - discAmt
      };
    });

    const newSale: Sale = {
      id: `s-${Date.now()}`,
      invoiceNo,
      branchId: currentBranchId,
      warehouseId: selectedWarehouseId,
      customerId: selectedCustomer?.id,
      items: saleItemData,
      subTotal,
      taxPercent,
      taxAmount,
      discountPercent: memberDiscountPercent, // Log the general tier discount
      discountAmount: totalDiscount,
      voucherCode: appliedVoucher?.code,
      totalAmount: grandTotal,
      paymentMethod,
      paymentDetail: {
        cashAmount: paymentMethod === 'Cash' ? parseFloat(cashAmount) : paymentMethod === 'Split' ? parseFloat(splitCashAmount) : undefined,
        nonCashAmount: paymentMethod === 'Split' ? parseFloat(splitNonCashAmount) : (paymentMethod !== 'Cash' ? grandTotal : undefined),
        bankName: (paymentMethod === 'Bank Transfer' || paymentMethod === 'Split') ? bankName : undefined,
        referenceNo: paymentReference || `MOCK-TX-${Date.now().toString().slice(-6)}`
      },
      cashReceived: paymentMethod === 'Cash' ? finalCashReceived : (paymentMethod === 'Split' ? finalCashReceived : undefined),
      changeAmount: change,
      status: 'Completed',
      operatorId: currentUser.id,
      createdAt: new Date().toISOString()
    };

    // Save transaction
    const allSales = [...LocalDb.getSales(), newSale];
    LocalDb.saveSales(allSales);

    // DEDUCT stock & record movement
    cart.forEach(item => {
      if (item.product.isPackage && item.product.packageItems) {
        // This is a package! Deduct stock for each package item
        item.product.packageItems.forEach(pkgItem => {
          LocalDb.addStockMovement(
            pkgItem.productId,
            selectedWarehouseId,
            pkgItem.quantity * item.quantity, // Multiply package item qty by quantity purchased
            'Out',
            newSale.id,
            currentUser.id,
            `Penjualan paket ${item.product.name} (Komponen: ${LocalDb.getProducts().find(p => p.id === pkgItem.productId)?.name || 'Produk'})`
          );
        });
      } else {
        // Regular product
        LocalDb.addStockMovement(
          item.product.id,
          selectedWarehouseId,
          item.quantity,
          'Out',
          newSale.id,
          currentUser.id,
          `Penjualan kasir invoice ${newSale.invoiceNo}`
        );
      }
    });

    // Record Loyalty Points CRM
    if (selectedCustomer) {
      const customersList = LocalDb.getCustomers();
      const cIdx = customersList.findIndex(c => c.id === selectedCustomer.id);
      if (cIdx > -1) {
        // 1 Point awarded for every Rp 1,000 spent
        const ptsEarned = Math.floor(grandTotal / 1000);
        customersList[cIdx].points += ptsEarned;
        customersList[cIdx].totalSpent += grandTotal;
        
        // Dynamic Tier Upgrading: Silver -> Gold (> 500k), Gold -> Platinum (> 1.2M)
        if (customersList[cIdx].totalSpent >= 1200000) {
          customersList[cIdx].tier = 'Platinum';
        } else if (customersList[cIdx].totalSpent >= 500000) {
          customersList[cIdx].tier = 'Gold';
        }
        LocalDb.saveCustomers(customersList);
      }
    }

    // Record General Ledger Revenue log
    const ledgers = LocalDb.getFinanceLedgers();
    ledgers.push({
      id: `f-${Date.now()}`,
      branchId: currentBranchId,
      type: 'In',
      category: 'Sale_Income',
      amount: grandTotal,
      referenceId: newSale.id,
      note: `Kasir Penjualan Invoice ${newSale.invoiceNo}`,
      operatorId: currentUser.id,
      createdAt: new Date().toISOString()
    });
    LocalDb.saveFinanceLedgers(ledgers);

    // Audit action
    LocalDb.logAudit(currentUser.id, 'POS_Sale_Checkout', `Checkout invoice ${newSale.invoiceNo} senilai Rp ${grandTotal.toLocaleString('id-ID')}`);

    // Refresh views & prepare receipt mockup
    setRecentSales(allSales.filter(s => s.branchId === currentBranchId).reverse());
    setCompletedSale(newSale);
    setShowCheckout(false);
    setShowReceipt(true);
    setCart([]);
    setStocks(LocalDb.getStocks());
    setSelectedCustomer(null);
    removeVoucher();
    setCashAmount('');
    setSplitCashAmount('');
    setSplitNonCashAmount('');
    setPaymentReference('');
    
    // Reset applyTax to default value from settings
    const currentSettings = LocalDb.getSettings();
    setApplyTax(!!currentSettings.taxEnabledByDefault);
  };

  // Refund / Void transaction
  const handleRefundTransaction = (saleId: string, action: 'Refund' | 'Void') => {
    if (!LocalDb.hasPermission(currentUser, 'refundSales')) {
      alert(`Akses Ditolak: Peran akun Anda tidak memiliki wewenang untuk melakukan ${action} transaksi.`);
      return;
    }
    const reason = prompt(`Masukkan alasan ${action} untuk invoice ini:`);
    if (reason === null) return; // user cancelled prompt
    
    const salesList = LocalDb.getSales();
    const sIdx = salesList.findIndex(s => s.id === saleId);
    if (sIdx === -1) return;

    const saleToRefund = salesList[sIdx];
    if (saleToRefund.status !== 'Completed') {
      alert('Transaksi ini sudah di-refund atau dibatalkan.');
      return;
    }

    const originWarehouseId = saleToRefund.warehouseId || selectedWarehouseId;

    // Reverse stocks
    saleToRefund.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod && prod.isPackage && prod.packageItems) {
        prod.packageItems.forEach(pkgItem => {
          LocalDb.addStockMovement(
            pkgItem.productId,
            originWarehouseId,
            pkgItem.quantity * item.quantity,
            'In',
            saleToRefund.id,
            currentUser.id,
            `Refund/Void paket ${prod.name} (Komponen: ${LocalDb.getProducts().find(p => p.id === pkgItem.productId)?.name || 'Produk'})`
          );
        });
      } else {
        LocalDb.addStockMovement(
          item.productId,
          originWarehouseId,
          item.quantity,
          'In',
          saleToRefund.id,
          currentUser.id,
          `${action} transaksi kasir ${saleToRefund.invoiceNo}`
        );
      }
    });

    // Update sale status
    salesList[sIdx].status = action === 'Refund' ? 'Refunded' : 'Void';
    salesList[sIdx].refundNote = reason;
    LocalDb.saveSales(salesList);

    // Record reverse Ledger transaction (Deduct revenue as cash out / reverse)
    const ledgers = LocalDb.getFinanceLedgers();
    ledgers.push({
      id: `f-${Date.now()}`,
      branchId: currentBranchId,
      type: 'Out',
      category: 'Cash_Adjustment',
      amount: saleToRefund.totalAmount,
      referenceId: saleToRefund.id,
      note: `${action} Penjualan Invoice ${saleToRefund.invoiceNo}. Alasan: ${reason}`,
      operatorId: currentUser.id,
      createdAt: new Date().toISOString()
    });
    LocalDb.saveFinanceLedgers(ledgers);

    // Reverse CRM loyalty points if applicable
    if (saleToRefund.customerId) {
      const customersList = LocalDb.getCustomers();
      const cIdx = customersList.findIndex(c => c.id === saleToRefund.customerId);
      if (cIdx > -1) {
        const ptsLost = Math.floor(saleToRefund.totalAmount / 1000);
        customersList[cIdx].points = Math.max(0, customersList[cIdx].points - ptsLost);
        customersList[cIdx].totalSpent = Math.max(0, customersList[cIdx].totalSpent - saleToRefund.totalAmount);
        LocalDb.saveCustomers(customersList);
      }
    }

    // Audit log
    LocalDb.logAudit(currentUser.id, `POS_${action}`, `${action} invoice ${saleToRefund.invoiceNo}. Alasan: ${reason}`);

    // Update UI states
    setRecentSales(salesList.filter(s => s.branchId === currentBranchId).reverse());
    setStocks(LocalDb.getStocks());
    alert(`Transaksi ${saleToRefund.invoiceNo} berhasil di-${action === 'Refund' ? 'REFUND' : 'VOID'}.`);
  };

  // Filter Catalog
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-130px)] gap-4 lg:gap-6 overflow-visible lg:overflow-hidden">
      
      {/* LEFT PANEL: Catalog or History */}
      <div className="w-full lg:flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 overflow-visible lg:overflow-hidden min-h-[500px] lg:min-h-0">
        
        {/* Module Header Toggle tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('sell')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'sell' 
                  ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              Menu POS Kasir
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'history' 
                  ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              Riwayat Transaksi
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 font-mono font-medium">Asal Stok Gudang:</label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 text-[11px] font-sans font-bold py-1 px-2.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              {allowedWarehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
        </div>

        {activeTab === 'sell' ? (
          /* CATALOG MODE */
          <div className="flex-1 flex flex-col overflow-hidden gap-4">
            {/* Catalog Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 shrink-0 sm:items-center">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari menu makanan, minuman atau kode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Barcode scanner simulator */}
              <form onSubmit={handleBarcodeSubmit} className="relative w-48 shrink-0">
                <input
                  type="text"
                  placeholder="Simulasi Scan Barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono font-semibold"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500">
                  <Receipt size={14} />
                </button>
              </form>

              {/* Add Product Button */}
              {(() => {
                const isOwner = currentUser.role === 'Owner';
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isOwner) {
                        alert('Akses Ditolak: Hanya pengguna dengan peran "Owner" yang dapat menambah produk!');
                        return;
                      }
                      handleOpenAddProductModal();
                    }}
                    className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                      isOwner
                        ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-orange-500/15 cursor-pointer'
                        : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {isOwner ? <Plus size={14} /> : <Lock size={14} />}
                    <span>Tambah Produk</span>
                  </button>
                );
              })()}
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto shrink-0 pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                Semua Kategori
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              {filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <p className="text-xs">Tidak ada menu F&B cocok dalam kategori ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map(prod => {
                    const cartQty = cart.find(item => item.product.id === prod.id)?.quantity || 0;
                    const physicalStock = getProductAvailableStock(prod, selectedWarehouseId);
                    const stockVal = Math.max(0, physicalStock - cartQty);
                    const isOutOfStock = stockVal <= 0;
                    return (
                      <div
                        key={prod.id}
                        onClick={() => !isOutOfStock && addToCart(prod)}
                        className={`group flex flex-col bg-slate-50 dark:bg-slate-950 hover:bg-orange-500/5 dark:hover:bg-orange-500/5 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-left transition-all duration-200 relative ${
                          isOutOfStock 
                            ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-850' 
                            : 'hover:border-orange-500 cursor-pointer'
                        }`}
                      >
                        {/* Owner Controls: Edit & Delete */}
                        {currentUser.role === 'Owner' && (
                          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditProductModal(prod);
                              }}
                              className="w-7 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-orange-500 dark:hover:text-orange-500 shadow-sm transition-colors cursor-pointer"
                              title="Edit Produk"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(prod);
                              }}
                              className="w-7 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-500 shadow-sm transition-colors cursor-pointer"
                              title="Hapus Produk"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}

                        {/* Stock label */}
                        <span className={`absolute top-2.5 right-2.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-red-500/20 text-red-600 border border-red-500/30'
                            : stockVal <= prod.minStock 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {isOutOfStock ? 'HABIS' : `Stok: ${stockVal}`}
                        </span>

                        {prod.imageUrl && (
                          <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-200 mb-3 relative">
                            <img src={prod.imageUrl} referrerPolicy="no-referrer" alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                        )}

                        <div className="flex-1 flex flex-col justify-between gap-1.5 w-full">
                          <div>
                            <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-orange-500 transition-colors line-clamp-1 flex items-center gap-1">
                              {prod.isPackage && (
                                <span className="bg-orange-500 text-white text-[8px] px-1 py-0.5 rounded font-extrabold uppercase shrink-0">PAKET</span>
                              )}
                              <span className="truncate">{prod.name}</span>
                            </h5>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">{prod.description}</p>
                          </div>
                          
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="font-mono text-xs font-black text-slate-900 dark:text-white">Rp {prod.sellingPrice.toLocaleString('id-ID')}</span>
                          </div>

                          {/* Stock information details */}
                          <div className="mt-2 border-t border-slate-100 dark:border-slate-800/85 pt-2 text-[10px] text-slate-400 flex flex-col gap-1 w-full font-sans">
                            {prod.isPackage ? (
                              <div className="space-y-0.5">
                                <span className="text-[8px] font-bold text-orange-500 block uppercase tracking-wider">Komponen:</span>
                                {prod.packageItems?.map((pkgItem, idx) => {
                                  const subProd = products.find(p => p.id === pkgItem.productId);
                                  const subStock = stocks.find(s => s.productId === pkgItem.productId && s.warehouseId === selectedWarehouseId)?.quantity || 0;
                                  return (
                                    <div key={idx} className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400 font-mono leading-normal">
                                      <span className="truncate max-w-[110px]">({pkgItem.quantity}x) {subProd ? subProd.name : 'Produk'}</span>
                                      <span className="shrink-0 text-slate-400 font-semibold">(Stok: {subStock})</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                                <span>Stok Fisik Gudang:</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded text-[10px]">{physicalStock} Pcs</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TRANSACTION HISTORY MODE */
          <div className="flex-1 flex flex-col overflow-hidden">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-3">Daftar Nota Penjualan Cabang</h4>
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-slate-800 pr-1">
              {recentSales.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <p>Belum ada invoice transaksi kasir hari ini.</p>
                </div>
              ) : (
                recentSales.map((sale, idx) => (
                  <div key={idx} className="py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/20 px-2 rounded-lg transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{sale.invoiceNo}</span>
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold rounded ${
                          sale.status === 'Completed' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {sale.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        Operator: {sale.operatorId === 'u-03' ? 'Kasir JKT' : 'Admin'} &bull; {new Date(sale.createdAt).toLocaleString('id-ID')}
                      </p>
                      {sale.refundNote && (
                        <p className="text-[10px] text-red-400 font-medium italic mt-1">Alasan pembatalan: "{sale.refundNote}"</p>
                      )}
                      
                      {/* Products overview */}
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {sale.items.map(i => {
                          const p = products.find(prod => prod.id === i.productId);
                          return `${p ? p.name : 'Unknown'} (x${i.quantity})`;
                        }).join(', ')}
                      </p>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                      <span className="font-mono font-black text-xs text-slate-900 dark:text-white">Rp {sale.totalAmount.toLocaleString('id-ID')}</span>
                      
                      {sale.status === 'Completed' && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setCompletedSale(sale);
                              setShowReceipt(true);
                            }}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                            title="Cetak Nota"
                          >
                            <Printer size={12} />
                          </button>
                          <button
                            onClick={() => handleRefundTransaction(sale.id, 'Refund')}
                            className="text-[9px] px-2 py-1 rounded bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold transition-all"
                          >
                            Void / Refund
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Cart & Calculations */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col overflow-visible lg:overflow-hidden shrink-0 min-h-[450px] lg:min-h-0">
        
        {/* Customer / Loyalty CRM selector */}
        <div className="mb-3.5 shrink-0">
          <label className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
            <UserIcon size={12} className="text-orange-500" /> Pelanggan / Member CRM
          </label>
          <div className="flex gap-2">
            <select
              value={selectedCustomer ? selectedCustomer.id : ''}
              onChange={(e) => {
                const c = customers.find(cust => cust.id === e.target.value);
                setSelectedCustomer(c || null);
              }}
              className="flex-1 bg-slate-50 dark:bg-slate-950 text-xs font-medium py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">-- Pelanggan Umum (Walk-in) --</option>
              {customers.map(cust => (
                <option key={cust.id} value={cust.id}>
                  {cust.name} ({cust.tier} - {cust.points} Pts)
                </option>
              ))}
            </select>
            
            {selectedCustomer && (
              <div className="px-2 bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold uppercase rounded-lg flex items-center">
                {selectedCustomer.tier}
              </div>
            )}
          </div>
        </div>

        {/* Cart Item list */}
        <div className="flex-1 flex flex-col overflow-hidden mb-4 border border-slate-100 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 p-3 min-h-[250px] lg:min-h-0">
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <span>Item Pembelian</span>
            <span>Total</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 pr-1 min-h-0 mt-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1 text-xs">
                <ShoppingBag size={20} className="text-slate-300 animate-pulse" />
                <p>Keranjang kosong.</p>
                <p className="text-[10px] text-slate-400 text-center">Pilih menu di katalog sebelah kiri atau masukkan kode.</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const itemPrice = item.product.sellingPrice;
                const finalItemPrice = itemPrice * (100 - item.discountPercent) / 100;
                return (
                  <div key={idx} className="py-2.5 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2">{item.product.name}</h6>
                        <span className="text-[10px] font-mono text-slate-400">Rp {itemPrice.toLocaleString('id-ID')}</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0">
                        Rp {(finalItemPrice * item.quantity).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      {/* Qty selectors */}
                      <div className="flex items-center gap-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => adjustQty(item.product.id, -1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center text-xs hover:bg-slate-100"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-xs font-bold font-mono px-1.5">{item.quantity}</span>
                        <button
                          onClick={() => adjustQty(item.product.id, 1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center text-xs hover:bg-slate-100"
                        >
                          <Plus size={10} />
                        </button>
                      </div>

                      {/* Manual Discount overrides & controls */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          <Percent size={10} />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Disc%"
                            value={item.discountPercent || ''}
                            onChange={(e) => adjustItemDiscount(item.product.id, parseInt(e.target.value) || 0)}
                            className="w-10 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center rounded text-[10px] text-slate-700 dark:text-slate-300 font-mono"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Promo / Coupon input */}
        <div className="mb-3 shrink-0">
          <form onSubmit={handleApplyVoucher} className="flex gap-1.5">
            <div className="relative flex-1">
              <Ticket size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Kode Voucher (cth: ERPBELANJA5)..."
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-[10px] pl-7.5 pr-2 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none"
              />
            </div>
            {appliedVoucher ? (
              <button
                type="button"
                onClick={removeVoucher}
                className="text-[10px] font-bold px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-650"
              >
                Hapus
              </button>
            ) : (
              <button
                type="submit"
                className="text-[10px] font-bold px-3 py-1.5 bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-650 rounded-lg hover:bg-slate-750"
              >
                Pakai
              </button>
            )}
          </form>
          {voucherError && <p className="text-[10px] text-red-500 font-medium mt-1">{voucherError}</p>}
          {appliedVoucher && (
            <p className="text-[10px] text-emerald-500 font-bold mt-1 flex items-center gap-1">
              <CheckCircle size={10} /> Voucher "{appliedVoucher.name}" berhasil digunakan!
            </p>
          )}
        </div>

        {/* Pricing calculations details */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 shrink-0">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Subtotal</span>
            <span className="font-mono">Rp {subTotal.toLocaleString('id-ID')}</span>
          </div>
          
          {selectedCustomer && memberDiscountAmount > 0 && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>Diskon Member ({selectedCustomer.tier} {memberDiscountPercent}%)</span>
              <span className="font-mono text-emerald-500">- Rp {memberDiscountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {appliedVoucher && voucherDiscountAmount > 0 && (
            <div className="flex justify-between text-xs text-slate-500">
              <span>Diskon Voucher ({appliedVoucher.code})</span>
              <span className="font-mono text-emerald-500">- Rp {voucherDiscountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs text-slate-500 py-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyTax}
                onChange={(e) => setApplyTax(e.target.checked)}
                className="w-3.5 h-3.5 text-orange-500 border-slate-300 dark:border-slate-800 rounded focus:ring-orange-500 focus:ring-opacity-20 cursor-pointer"
              />
              <span>Pajak ({settings.taxPercent}%)</span>
            </label>
            <span className="font-mono">Rp {taxAmount.toLocaleString('id-ID')}</span>
          </div>

          <div className="flex justify-between text-sm font-black border-t border-dashed border-slate-200 dark:border-slate-800 pt-2.5 text-slate-900 dark:text-white">
            <span>Total Bayar</span>
            <span className="font-mono text-orange-500 text-base">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* POS Action Buttons (Hold / Checkout) */}
        <div className="grid grid-cols-3 gap-2 mt-3 shrink-0">
          <button
            onClick={handleHoldCart}
            disabled={cart.length === 0}
            className="py-2 px-2 text-[10px] font-bold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg text-center transition-colors flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} className="text-slate-500 rotate-180" />
            <span>Hold Bill</span>
          </button>
          
          {(() => {
            const canCheckout = LocalDb.hasPermission(currentUser, 'checkoutSales');
            return (
              <button
                onClick={handleProcessCheckout}
                disabled={cart.length === 0}
                className={`col-span-2 py-2 px-3 text-white rounded-lg text-center transition-all flex items-center justify-center gap-2 font-bold text-xs shadow-md cursor-pointer ${
                  canCheckout 
                    ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/15' 
                    : 'bg-slate-400 dark:bg-slate-800 opacity-60'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {canCheckout ? <Receipt size={14} /> : <Lock size={14} />}
                <span>Pembayaran / Bayar</span>
              </button>
            );
          })()}
        </div>

        {/* Held bills drawers simulation indicator */}
        {heldCarts.length > 0 && (
          <div className="mt-3 bg-slate-100 dark:bg-slate-800/40 p-2 rounded-lg shrink-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nota Ditangguhkan ({heldCarts.length})</p>
            <div className="flex flex-col gap-1">
              {heldCarts.map((h, idx) => (
                <div key={idx} className="flex justify-between items-center text-[10px] bg-white dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{h.customer} ({h.itemsCount} item &bull; {h.time})</span>
                  <button
                    onClick={() => handleResumeCart(h.id)}
                    className="text-orange-500 font-bold hover:underline"
                  >
                    Buka
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CHECKOUT MODAL POPUP */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Proses Pembayaran Penjualan</h4>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            <div className="p-5 flex-1 space-y-4">
              
              {/* Grand Total Indicator */}
              <div className="bg-orange-500/5 dark:bg-orange-500/5 border border-orange-500/10 p-4 rounded-xl text-center">
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Tagihan Pembelian</p>
                <h5 className="font-black text-2xl text-orange-500 font-mono mt-1">Rp {grandTotal.toLocaleString('id-ID')}</h5>
              </div>

              {/* Payment Method Selector Grid */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Cash', label: 'Tunai / Cash', icon: CreditCard },
                    { id: 'QRIS', label: 'QRIS Gopay/OVO', icon: QrCode },
                    { id: 'Bank Transfer', label: 'Transfer Bank', icon: Smartphone },
                    { id: 'E-Wallet', label: 'E-Wallet', icon: Wallet },
                    { id: 'Split', label: 'Split Payment', icon: RotateCcw }
                  ].map(m => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 justify-center ${
                          isSelected 
                            ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/10' 
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <Icon size={14} />
                        <span className="text-[9px] font-bold uppercase leading-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash payment specific details */}
              {paymentMethod === 'Cash' && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jumlah Uang Diterima (Cash)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      placeholder="Masukkan jumlah tunai..."
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Cash Quick buttons */}
                  <div className="flex gap-1.5">
                    {[
                      grandTotal,
                      50000,
                      100000,
                      200000
                    ].map((amt, idx) => {
                      const finalAmt = Math.ceil(amt);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCashAmount(finalAmt.toString())}
                          className="flex-1 py-1 px-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-[10px] font-mono font-bold rounded-lg"
                        >
                          Rp {finalAmt.toLocaleString('id-ID')}
                        </button>
                      );
                    })}
                  </div>

                  {/* Change Calculator */}
                  {parseFloat(cashAmount) >= grandTotal && (
                    <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg text-emerald-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Kembalian</span>
                      <strong className="text-sm font-mono">Rp {(parseFloat(cashAmount) - grandTotal).toLocaleString('id-ID')}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Non-Cash options */}
              {(paymentMethod === 'QRIS' || paymentMethod === 'E-Wallet' || paymentMethod === 'Bank Transfer') && (
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  {paymentMethod === 'Bank Transfer' && (
                    <div className="space-y-1">
                      <label className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold">Pilih Bank</label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="bg-white dark:bg-slate-900 text-xs py-1.5 px-2 border border-slate-200 dark:border-slate-800 rounded w-full"
                      >
                        <option value="BCA">BCA (Virtual Account)</option>
                        <option value="Mandiri">Mandiri</option>
                        <option value="BRI">BRI</option>
                        <option value="BNI">BNI</option>
                      </select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold">Kode / Nomor Referensi Transaksi</label>
                    <input
                      type="text"
                      placeholder="Masukkan kode unik transaksi bank..."
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  {paymentMethod === 'QRIS' && (
                    <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-slate-100">
                      {/* Interactive mock QR */}
                      <div className="w-24 h-24 bg-slate-100 flex items-center justify-center border border-dashed text-[10px] text-slate-400 font-mono text-center">
                        [QRIS PREVIEW MOCK]
                      </div>
                      <p className="text-[9px] text-slate-400 text-center mt-1">Scan QRIS menggunakan Gopay, ShopeePay, OVO, Dana.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Split Payment Options */}
              {paymentMethod === 'Split' && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-3.5 border border-slate-150 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Masukkan gabungan pembayaran tunai dan non-tunai (Transfer/QRIS):</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tunai (Cash)</label>
                      <input
                        type="number"
                        value={splitCashAmount}
                        onChange={(e) => setSplitCashAmount(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Non-Tunai (QRIS/Bank)</label>
                      <input
                        type="number"
                        value={splitNonCashAmount}
                        onChange={(e) => setSplitNonCashAmount(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Total Masuk: Rp {( (parseFloat(splitCashAmount)||0) + (parseFloat(splitNonCashAmount)||0) ).toLocaleString('id-ID')}</span>
                    <span>Selisih: Rp {( (parseFloat(splitCashAmount)||0) + (parseFloat(splitNonCashAmount)||0) - grandTotal ).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
              >
                Kembali
              </button>
              <button
                onClick={submitTransaction}
                className="flex-1 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow"
              >
                Selesaikan Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED INVOICE THERMAL RECEIPT MOCK POPUP */}
      {showReceipt && completedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950/80 w-full max-w-sm rounded-2xl p-6 border border-slate-800 flex flex-col items-center gap-4">
            
            {/* Header indicators */}
            <div className="flex flex-col items-center text-center text-slate-200">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-2">
                <CheckCircle size={22} />
              </div>
              <h5 className="font-bold text-sm">Pembayaran Sukses!</h5>
              <p className="text-[10px] text-slate-400">Invoice: {completedSale.invoiceNo}</p>
            </div>

            {/* Simulated thermal receipt paper layout */}
            <div className="bg-white text-slate-900 w-full rounded-lg p-5 font-mono text-[10px] leading-relaxed shadow-lg max-h-[420px] overflow-y-auto">
              {/* Header */}
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
                <p className="font-bold text-xs uppercase">{settings.companyName}</p>
                <p className="text-[8px] text-slate-500 line-clamp-2">{settings.companyAddress}</p>
                <p className="text-[8px] text-slate-500">Telp: {settings.companyPhone}</p>
              </div>

              {/* Meta */}
              <div className="py-2.5 space-y-0.5 border-b border-dashed border-slate-300 text-slate-600">
                <p>Nota: {completedSale.invoiceNo}</p>
                <p>Tanggal: {new Date(completedSale.createdAt).toLocaleString('id-ID')}</p>
                <p>Kasir: {currentUser.name}</p>
                <p>Pelanggan: {selectedCustomer ? selectedCustomer.name : 'Umum (Walk-in)'}</p>
              </div>

              {/* Items Table */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1">
                {completedSale.items.map((it, idx) => {
                  const p = LocalDb.getProducts().find(prod => prod.id === it.productId);
                  return (
                    <div key={idx} className="flex justify-between">
                      <div className="flex-1 pr-4">
                        <p>{p ? p.name : 'Unknown Product'}</p>
                        <p className="text-[8px] text-slate-500">{it.quantity} x Rp {it.price.toLocaleString('id-ID')}</p>
                      </div>
                      <span className="shrink-0">Rp {it.total.toLocaleString('id-ID')}</span>
                    </div>
                  );
                })}
              </div>

              {/* Pricing Totals */}
              <div className="py-2.5 space-y-1 border-b border-dashed border-slate-300 text-slate-650">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rp {completedSale.subTotal.toLocaleString('id-ID')}</span>
                </div>
                {completedSale.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Diskon</span>
                    <span>-Rp {completedSale.discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pajak ({completedSale.taxPercent}%)</span>
                  <span>Rp {completedSale.taxAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-dotted border-slate-300 pt-1.5">
                  <span>TOTAL BAYAR</span>
                  <span>Rp {completedSale.totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Cash & Change */}
              <div className="py-2.5 space-y-0.5 text-slate-600">
                <p>Metode Pembayaran: {completedSale.paymentMethod}</p>
                {completedSale.paymentMethod === 'Cash' && (
                  <>
                    <p>Uang Tunai: Rp {(completedSale.cashReceived || 0).toLocaleString('id-ID')}</p>
                    <p>Kembalian: Rp {(completedSale.changeAmount || 0).toLocaleString('id-ID')}</p>
                  </>
                )}
                {completedSale.paymentMethod === 'Split' && (
                  <>
                    <p>Porsi Tunai: Rp {(completedSale.paymentDetail.cashAmount || 0).toLocaleString('id-ID')}</p>
                    <p>Porsi QRIS/Bank: Rp {(completedSale.paymentDetail.nonCashAmount || 0).toLocaleString('id-ID')}</p>
                  </>
                )}
                {completedSale.paymentMethod !== 'Cash' && completedSale.paymentMethod !== 'Split' && (
                  <p>Ref ID: {completedSale.paymentDetail.referenceNo}</p>
                )}
              </div>

              {/* Footer messages */}
              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[8px] text-slate-500 whitespace-pre-line leading-normal">
                {settings.thermalPrinterConfig.footerMessage}
              </div>
            </div>

            {/* Receipt Modal Action Controls */}
            <div className="w-full flex gap-2">
              <button
                onClick={() => {
                  // Simply simulate printing message
                  alert('Melakukan pengiriman berkas struk ke printer thermal (MOCK)...');
                }}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <Printer size={12} />
                Cetak Struk
              </button>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setCompletedSale(null);
                }}
                className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
              >
                Tutup / POS Baru
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD NEW PRODUCT MODAL */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingProduct ? `Edit Produk: ${editingProduct.name}` : 'Tambah Produk Baru (Catalog F&B POS)'}
              </h4>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 overflow-y-auto max-h-[75vh] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori Produk</label>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryModal(true)}
                      className="text-[9px] font-bold text-orange-500 hover:text-orange-600"
                    >
                      + Kategori Baru
                    </button>
                  </div>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kode Produk</label>
                  <input
                    type="text"
                    required
                    value={newProdCode}
                    onChange={(e) => setNewProdCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Produk Jadi *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Risol Mayo Spicy"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* PACKAGE PRODUCT SETTINGS CONTAINER */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">Produk Paket (Bundle)</label>
                    <span className="text-[10px] text-slate-400 block">Paket berisi gabungan beberapa menu/produk jadi</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPackageProduct}
                    onChange={(e) => {
                      setIsPackageProduct(e.target.checked);
                      if (e.target.checked) {
                        setNewProdInitialStock(0);
                      }
                    }}
                    className="w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500 focus:ring-opacity-20 cursor-pointer"
                  />
                </div>

                {isPackageProduct && (
                  <div className="mt-3 border-t border-slate-200 dark:border-slate-850 pt-3 space-y-3">
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider block">Pilih Isi Komponen Paket</span>
                    
                    {/* Add Component Selector */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Pilih Produk</label>
                        <select
                          value={tempComponentId}
                          onChange={(e) => setTempComponentId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none"
                        >
                          <option value="">-- Pilih Produk --</option>
                          {products.filter(p => !p.isIngredient && !p.isPackage && p.id !== newProdCode).map(p => (
                            <option key={p.id} value={p.id}>{p.name} (HPP: Rp {p.costPrice})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20 space-y-1">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Jumlah</label>
                        <input
                          type="number"
                          min="1"
                          value={tempComponentQty}
                          onChange={(e) => setTempComponentQty(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-white text-center focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tempComponentId) return;
                          const exists = selectedPackageComponents.some(c => c.productId === tempComponentId);
                          if (exists) {
                            alert('Produk ini sudah ada di daftar komponen!');
                            return;
                          }
                          const addedItem = { productId: tempComponentId, quantity: Number(tempComponentQty) || 1 };
                          setSelectedPackageComponents(prev => [...prev, addedItem]);
                          setTempComponentQty(1);
                        }}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold shrink-0 h-[26px]"
                      >
                        Tambah
                      </button>
                    </div>

                    {/* Selected components list */}
                    {selectedPackageComponents.length > 0 ? (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-900 space-y-1.5">
                        {selectedPackageComponents.map((item, index) => {
                          const p = products.find(prod => prod.id === item.productId);
                          return (
                            <div key={index} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 py-1 border-b border-slate-50 last:border-0 dark:border-slate-850">
                              <span>{p ? p.name : 'Unknown'} ({item.quantity} Pcs)</span>
                              <button
                                type="button"
                                onClick={() => setSelectedPackageComponents(prev => prev.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-600 text-[10px] font-bold"
                              >
                                Hapus
                              </button>
                            </div>
                          );
                        })}

                        {/* Cost suggestions */}
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">Total HPP Komponen:</span>
                          <div className="flex gap-2 items-center">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              Rp {selectedPackageComponents.reduce((sum, item) => {
                                const p = products.find(prod => prod.id === item.productId);
                                return sum + (p?.costPrice || 0) * item.quantity;
                              }, 0).toLocaleString('id-ID')}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const totalHpp = selectedPackageComponents.reduce((sum, item) => {
                                  const p = products.find(prod => prod.id === item.productId);
                                  return sum + (p?.costPrice || 0) * item.quantity;
                                }, 0);
                                setNewProdCost(totalHpp);
                              }}
                              className="text-orange-500 hover:text-orange-600 font-bold text-[9px] underline"
                            >
                              Gunakan sbg HPP Paket
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic block">Belum ada komponen terpilih.</span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Harga Modal (HPP)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Harga Jual *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stok Pengaman Minimum</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={newProdMinStock}
                    onChange={(e) => setNewProdMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {isPackageProduct ? (
                  <div className="space-y-1 bg-orange-50/20 dark:bg-orange-500/5 p-3 rounded border border-orange-100 dark:border-orange-500/10 flex flex-col justify-center">
                    <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-wider">Stok Paket</label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1">
                      Stok dihitung dinamis dari stok fisik terkecil komponen pembentuknya.
                    </span>
                  </div>
                ) : editingProduct ? (
                  <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Informasi Stok</label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1">
                      Perubahan stok fisik dilakukan melalui modul <span className="font-bold">Inventaris & Gudang</span>.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1 bg-orange-50/50 dark:bg-orange-500/5 p-2 rounded border border-orange-100 dark:border-orange-500/10">
                    <label className="block text-[10px] font-bold text-orange-600 uppercase tracking-wider">Stok Awal POS *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="0"
                      value={newProdInitialStock}
                      onChange={(e) => setNewProdInitialStock(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-500/20 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                    />
                    <span className="text-[8px] text-orange-500 mt-1 block leading-relaxed">
                      Akan langsung masuk ke gudang terpilih ({LocalDb.getWarehouses().find(w => w.id === selectedWarehouseId)?.name || 'Default'}).
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Barcode (Optional)</label>
                  <input
                    type="text"
                    placeholder="899..."
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brand / Merek</label>
                  <input
                    type="text"
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gambar URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newProdImg}
                  onChange={(e) => setNewProdImg(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi Menu</label>
                <textarea
                  placeholder="Tulis detail deskripsi menu F&B..."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-400"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md shadow-orange-500/10"
                >
                  {editingProduct ? 'Perbarui Produk' : 'Simpan & Daftarkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW CATEGORY SUB-MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Tambah Kategori Baru</h4>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Kategori *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Camilan, Dessert"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi (Optional)</label>
                <textarea
                  placeholder="Keterangan singkat..."
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="flex-1 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-100 text-slate-600 dark:text-slate-400"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-lg shadow-orange-500/10"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
