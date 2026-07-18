/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Branch,
  Warehouse,
  Customer,
  Supplier,
  Category,
  Unit,
  StorageRack,
  Product,
  Stock,
  StockMovement,
  Bom,
  ProductionLog,
  PurchaseOrder,
  Sale,
  Voucher,
  FinanceLedger,
  Employee,
  Attendance,
  Payroll,
  AuditLog,
  SystemSettings,
  RolePermissions
} from '../types';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';


// Key names for LocalStorage
const KEYS = {
  USERS: 'erp_users',
  BRANCHES: 'erp_branches',
  WAREHOUSES: 'erp_warehouses',
  CUSTOMERS: 'erp_customers',
  SUPPLIERS: 'erp_suppliers',
  CATEGORIES: 'erp_categories',
  UNITS: 'erp_units',
  RACKS: 'erp_racks',
  PRODUCTS: 'erp_products',
  STOCKS: 'erp_stocks',
  MOVEMENTS: 'erp_movements',
  BOMS: 'erp_boms',
  PRODUCTION: 'erp_production_logs',
  PURCHASES: 'erp_purchase_orders',
  SALES: 'erp_sales',
  VOUCHERS: 'erp_vouchers',
  FINANCE: 'erp_finance_ledgers',
  EMPLOYEES: 'erp_employees',
  ATTENDANCE: 'erp_attendance',
  PAYROLL: 'erp_payroll',
  AUDIT: 'erp_audit_logs',
  SETTINGS: 'erp_settings',
  CURRENT_SESSION: 'erp_current_session',
  PERMISSIONS: 'erp_role_permissions'
};

// Initial Data Seeding
const initialBranches: Branch[] = [
  { id: 'b-01', name: 'Cabang Jakarta Pusat (HQ)', address: 'Jl. Jenderal Sudirman No. 12, Jakarta', phone: '021-5551234', isActive: true },
  { id: 'b-02', name: 'Cabang Bandung Dago', address: 'Jl. Ir. H. Juanda No. 85, Bandung', phone: '022-7775678', isActive: true },
  { id: 'b-03', name: 'Cabang Surabaya Gubeng', address: 'Jl. Pemuda No. 45, Surabaya', phone: '031-8889012', isActive: true }
];

const initialWarehouses: Warehouse[] = [
  { id: 'w-01', branchId: 'b-01', name: 'Gudang Utama JKT', location: 'Lantai Dasar HQ', isActive: true },
  { id: 'w-02', branchId: 'b-01', name: 'Gudang Dapur JKT', location: 'Dapur Produksi JKT', isActive: true },
  { id: 'w-03', branchId: 'b-02', name: 'Gudang Dago', location: 'Belakang Cafe Bandung', isActive: true },
  { id: 'w-04', branchId: 'b-03', name: 'Gudang Surabaya', location: 'Ruko Samping Outlet', isActive: true }
];

const initialUsers: User[] = [
  { id: 'u-01', email: 'owner@erp.com', name: 'Pak Hendra (Owner)', phone: '081234567890', role: 'Owner', isActive: true, branchId: 'b-01', createdAt: '2026-01-01T08:00:00Z' },
  { id: 'u-02', email: 'admin@erp.com', name: 'Dewi Lestari (Admin)', phone: '081234567891', role: 'Admin', isActive: true, branchId: 'b-01', createdAt: '2026-01-02T08:00:00Z' },
  { id: 'u-03', email: 'kasir@erp.com', name: 'Ahmad Dani (Kasir JKT)', phone: '081234567892', role: 'Kasir', isActive: true, branchId: 'b-01', createdAt: '2026-01-03T08:00:00Z' },
  { id: 'u-04', email: 'gudang@erp.com', name: 'Rudi Hartono (Gudang)', phone: '081234567893', role: 'Gudang', isActive: true, branchId: 'b-01', createdAt: '2026-01-04T08:00:00Z' },
  { id: 'u-05', email: 'produksi@erp.com', name: 'Siti Aminah (Chef Produksi)', phone: '081234567894', role: 'Produksi', isActive: true, branchId: 'b-01', createdAt: '2026-01-05T08:00:00Z' },
  { id: 'u-06', email: 'finance@erp.com', name: 'Joko Susilo (CFO)', phone: '081234567895', role: 'Finance', isActive: true, branchId: 'b-01', createdAt: '2026-01-06T08:00:00Z' },
  { id: 'u-07', email: 'kasir.bandung@erp.com', name: 'Bella (Kasir BDG)', phone: '081234567896', role: 'Kasir', isActive: true, branchId: 'b-02', createdAt: '2026-02-01T08:00:00Z' }
];

const initialCategories: Category[] = [
  { id: 'cat-01', name: 'Makanan Jadi', description: 'Menu makanan siap saji untuk customer' },
  { id: 'cat-02', name: 'Minuman Jadi', description: 'Menu minuman siap saji untuk customer' },
  { id: 'cat-03', name: 'Bahan Baku Basah', description: 'Bahan segar seperti daging, keju, jamur' },
  { id: 'cat-04', name: 'Bahan Baku Kering', description: 'Tepung, bumbu, bumbu kering, matcha powder' },
  { id: 'cat-05', name: 'Kemasan', description: 'Box risol, gelas cup, sedotan' }
];

const initialUnits: Unit[] = [
  { id: 'un-01', name: 'kg' },
  { id: 'un-02', name: 'gr' },
  { id: 'un-03', name: 'pcs' },
  { id: 'un-04', name: 'liter' },
  { id: 'un-05', name: 'ml' },
  { id: 'un-06', name: 'pack' },
  { id: 'un-07', name: 'box' }
];

const initialRacks: StorageRack[] = [
  { id: 'r-01', warehouseId: 'w-01', name: 'Chiller Utama' },
  { id: 'r-02', warehouseId: 'w-01', name: 'Rak Kering-A' },
  { id: 'r-03', warehouseId: 'w-01', name: 'Rak Kemasan-B' },
  { id: 'r-04', warehouseId: 'w-02', name: 'Chiller Dapur' }
];

const initialProducts: Product[] = [
  // Finished Goods
  { id: 'p-01', code: 'PRD-001', barcode: '8990001001', name: 'Risol Beef Cheese', categoryId: 'cat-01', brand: 'Ngemil Ednak', costPrice: 4200, sellingPrice: 10000, wholesalePrice: 8500, imageUrl: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&w=300&q=80', description: 'Risol renyah dengan isian smoked beef gourmet, keju cheddar meleleh, dan mayones spesial.', minStock: 20, unitId: 'un-03', isIngredient: false, isActive: true, createdAt: '2026-01-10T08:00:00Z' },
  { id: 'p-02', code: 'PRD-002', barcode: '8990001002', name: 'Risol Beef Mushroom', categoryId: 'cat-01', brand: 'Ngemil Ednak', costPrice: 3500, sellingPrice: 8500, wholesalePrice: 7500, imageUrl: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=300&q=80', description: 'Risol dengan isian jamur champignon tumis mentega, smoked beef, dan mayones krimi.', minStock: 20, unitId: 'un-03', isIngredient: false, isActive: true, createdAt: '2026-01-10T08:00:00Z' },
  { id: 'p-03', code: 'PRD-003', barcode: '8990001003', name: 'Cheese Tea Matcha', categoryId: 'cat-02', brand: 'Ngemil Ednak', costPrice: 3800, sellingPrice: 15000, wholesalePrice: 13000, imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=300&q=80', description: 'Minuman teh hijau matcha premium Jepang dengan topping busa keju gurih yang tebal.', minStock: 15, unitId: 'un-03', isIngredient: false, isActive: true, createdAt: '2026-01-11T08:00:00Z' },

  // Raw Materials (Ingredients)
  { id: 'p-04', code: 'RAW-001', barcode: '', name: 'Kulit Risol Jadi', categoryId: 'cat-03', brand: 'Lokal', costPrice: 500, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Kulit risol mentah siap gulung.', minStock: 100, unitId: 'un-03', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' },
  { id: 'p-05', code: 'RAW-002', barcode: '', name: 'Mayonaise Premium', categoryId: 'cat-04', brand: 'Kewpie', costPrice: 40000, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Saus mayones kemasan 1 kg.', minStock: 5, unitId: 'un-01', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }, // Cost per kg: 40,000 (gr: 40)
  { id: 'p-06', code: 'RAW-003', barcode: '', name: 'Keju Cheddar Block', categoryId: 'cat-03', brand: 'Kraft', costPrice: 25000, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Keju cheddar block berat 250 gr.', minStock: 10, unitId: 'un-03', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }, // Cost per block: 25,000 (gr: 100)
  { id: 'p-07', code: 'RAW-004', barcode: '', name: 'Smoked Beef Slice', categoryId: 'cat-03', brand: 'Bernardi', costPrice: 75000, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Daging asap slice isi 50 lembar.', minStock: 5, unitId: 'un-06', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }, // Cost per pack: 75,000 (pcs: 1,500)
  { id: 'p-08', code: 'RAW-005', barcode: '', name: 'Jamur Champignon Segar', categoryId: 'cat-03', brand: 'Farm', costPrice: 35000, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Jamur kancing segar per kg.', minStock: 2, unitId: 'un-01', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }, // Cost per kg: 35,000 (gr: 35)
  { id: 'p-09', code: 'RAW-006', barcode: '', name: 'Minyak Goreng Sawit', categoryId: 'cat-04', brand: 'Bimoli', costPrice: 18000, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Minyak goreng pouch 1 liter.', minStock: 10, unitId: 'un-04', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }, // Cost per liter: 18,000 (ml: 18)
  { id: 'p-10', code: 'RAW-007', barcode: '', name: 'Matcha Powder Premium', categoryId: 'cat-04', brand: 'Uji Matcha', costPrice: 150000, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Matcha bubuk murni pack 500 gr.', minStock: 2, unitId: 'un-06', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }, // Cost per 500gr: 150,000 (gr: 300)
  { id: 'p-11', code: 'RAW-008', barcode: '', name: 'Susu Cair UHT Full Cream', categoryId: 'cat-04', brand: 'Greenfields', costPrice: 20000, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Susu UHT tawar 1 Liter.', minStock: 24, unitId: 'un-04', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }, // Cost per liter: 20,000 (ml: 20)
  { id: 'p-12', code: 'PKG-001', barcode: '', name: 'Box Kemasan Risol Isi 3', categoryId: 'cat-05', brand: 'Custom', costPrice: 1200, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Box kertas kraft coklat cetak logo.', minStock: 200, unitId: 'un-03', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' },
  { id: 'p-13', code: 'PKG-002', barcode: '', name: 'Gelas Plastik Cup 16oz', categoryId: 'cat-05', brand: 'Lokal', costPrice: 800, sellingPrice: 0, wholesalePrice: 0, imageUrl: '', description: 'Gelas plastik tebal beserta tutup.', minStock: 200, unitId: 'un-03', isIngredient: true, isActive: true, createdAt: '2026-01-05T08:00:00Z' }
];

const initialStocks: Stock[] = [
  // Finished Goods in Main Kitchen/Outlet JKT
  { id: 'st-01', productId: 'p-01', warehouseId: 'w-01', quantity: 50 },
  { id: 'st-02', productId: 'p-02', warehouseId: 'w-01', quantity: 30 },
  { id: 'st-03', productId: 'p-03', warehouseId: 'w-01', quantity: 40 },
  // Finished Goods in BDG
  { id: 'st-04', productId: 'p-01', warehouseId: 'w-03', quantity: 15 }, // Near Minimum Stock!
  { id: 'st-05', productId: 'p-02', warehouseId: 'w-03', quantity: 8 },  // Low stock!
  { id: 'st-06', productId: 'p-03', warehouseId: 'w-03', quantity: 12 },

  // Raw Materials in Main JKT Warehouse
  { id: 'st-07', productId: 'p-04', warehouseId: 'w-01', quantity: 500 }, // 500 pcs kulit
  { id: 'st-08', productId: 'p-05', warehouseId: 'w-01', quantity: 15 },  // 15 kg mayo
  { id: 'st-09', productId: 'p-06', warehouseId: 'w-01', quantity: 20 },  // 20 blocks cheese
  { id: 'st-10', productId: 'p-07', warehouseId: 'w-01', quantity: 10 },  // 10 packs smoked beef
  { id: 'st-11', productId: 'p-08', warehouseId: 'w-01', quantity: 5 },   // 5 kg jamur
  { id: 'st-12', productId: 'p-09', warehouseId: 'w-01', quantity: 30 },  // 30 liters minyak
  { id: 'st-13', productId: 'p-10', warehouseId: 'w-01', quantity: 4 },   // 4 packs matcha
  { id: 'st-14', productId: 'p-11', warehouseId: 'w-01', quantity: 48 },  // 48 liters milk
  { id: 'st-15', productId: 'p-12', warehouseId: 'w-01', quantity: 1000 },// 1000 boxes
  { id: 'st-16', productId: 'p-13', warehouseId: 'w-01', quantity: 1000 } // 1000 cups
];

const initialBoms: Bom[] = [
  {
    id: 'bom-01',
    finishedProductId: 'p-01',
    name: 'Resep Standar Risol Beef Cheese',
    ingredients: [
      { id: 'bi-01', ingredientId: 'p-04', quantity: 1 }, // 1 kulit risol
      { id: 'bi-02', ingredientId: 'p-05', quantity: 0.015 }, // 15 gram mayo
      { id: 'bi-03', ingredientId: 'p-06', quantity: 0.04 }, // 10 gram cheese block (kraft block 250gr, so 10gr is 0.04 block)
      { id: 'bi-04', ingredientId: 'p-07', quantity: 0.02 }, // 1 slice smoked beef (pack of 50, so 1 slice is 0.02 pack)
      { id: 'bi-05', ingredientId: 'p-09', quantity: 0.05 }, // 50 ml minyak goreng (1 liter, so 50ml is 0.05 L)
      { id: 'bi-06', ingredientId: 'p-12', quantity: 0.33 } // 1/3 of a box (holds 3 risol)
    ],
    otherCosts: { gas: 150, packaging: 400, labor: 600, overhead: 200 },
    totalCostPrice: 4200,
    createdAt: '2026-01-10T10:00:00Z'
  },
  {
    id: 'bom-02',
    finishedProductId: 'p-02',
    name: 'Resep Standar Risol Beef Mushroom',
    ingredients: [
      { id: 'bi-07', ingredientId: 'p-04', quantity: 1 },
      { id: 'bi-08', ingredientId: 'p-05', quantity: 0.015 },
      { id: 'bi-09', ingredientId: 'p-08', quantity: 0.02 }, // 20 gram jamur
      { id: 'bi-10', ingredientId: 'p-07', quantity: 0.02 }, // 1 slice beef
      { id: 'bi-11', ingredientId: 'p-09', quantity: 0.05 },
      { id: 'bi-12', ingredientId: 'p-12', quantity: 0.33 }
    ],
    otherCosts: { gas: 150, packaging: 400, labor: 500, overhead: 150 },
    totalCostPrice: 3500,
    createdAt: '2026-01-10T10:00:00Z'
  },
  {
    id: 'bom-03',
    finishedProductId: 'p-03',
    name: 'Resep Cheese Tea Matcha',
    ingredients: [
      { id: 'bi-13', ingredientId: 'p-10', quantity: 0.03 }, // 15 gr matcha powder (from 500gr pack = 0.03 pack)
      { id: 'bi-14', ingredientId: 'p-11', quantity: 0.20 }, // 200 ml susu (from 1 L = 0.20 L)
      { id: 'bi-15', ingredientId: 'p-06', quantity: 0.05 }, // 12.5 gr cheese topping (from 250gr block = 0.05 block)
      { id: 'bi-16', ingredientId: 'p-13', quantity: 1 } // 1 cup
    ],
    otherCosts: { gas: 0, packaging: 300, labor: 1000, overhead: 200 },
    totalCostPrice: 3800,
    createdAt: '2026-01-11T11:00:00Z'
  }
];

const initialCustomers: Customer[] = [
  { id: 'c-01', name: 'Budi Santoso', phone: '081299991111', email: 'budi.santoso@gmail.com', address: 'Kuningan, Jakarta Selatan', birthDate: '1990-05-15', points: 850, cashback: 50000, tier: 'Platinum', totalSpent: 1500000, createdAt: '2026-01-15T09:00:00Z' },
  { id: 'c-02', name: 'Ani Wijaya', phone: '081299992222', email: 'ani.wijaya@yahoo.com', address: 'Cibeunying, Bandung', birthDate: '1995-11-20', points: 320, cashback: 15000, tier: 'Gold', totalSpent: 640000, createdAt: '2026-02-10T10:00:00Z' },
  { id: 'c-03', name: 'Roni Hidayat', phone: '081299993333', email: 'roni.hid@gmail.com', address: 'Gubeng, Surabaya', birthDate: '1988-08-01', points: 110, cashback: 0, tier: 'Silver', totalSpent: 220000, createdAt: '2026-03-01T11:00:00Z' }
];

const initialSuppliers: Supplier[] = [
  { id: 's-01', name: 'PT Sumber Makmur Sembako', phone: '021-333444', email: 'sales@sumbermakmur.com', address: 'Kawasan Industri Pulogadung, Jakarta', contactPerson: 'Hendra Wijaya', bankAccount: '1234567890', bankName: 'BCA', accountsPayable: 4500000, createdAt: '2026-01-05T08:00:00Z' },
  { id: 's-02', name: 'CV Daging Segar Jaya', phone: '022-444555', email: 'order@dagingsegar.com', address: 'Soekarno Hatta No. 450, Bandung', contactPerson: 'Ibu Ratna', bankAccount: '0987654321', bankName: 'Mandiri', accountsPayable: 0, createdAt: '2026-01-05T08:00:00Z' },
  { id: 's-03', name: 'Toko Kemasan Indah Pratama', phone: '031-555666', email: 'kemasan.indah@gmail.com', address: 'Ngagel, Surabaya', contactPerson: 'Budi Santika', bankAccount: '5544332211', bankName: 'BRI', accountsPayable: 1200000, createdAt: '2026-01-06T08:00:00Z' }
];

const initialVouchers: Voucher[] = [
  { code: 'ERPBELANJA5', name: 'Diskon Belanja 5%', discountType: 'Percentage', value: 5, minTransaction: 50000, isActive: true, expiryDate: '2027-12-31' },
  { code: 'ERPHARIINI10K', name: 'Potongan Langsung 10K', discountType: 'Nominal', value: 10000, minTransaction: 75000, isActive: true, expiryDate: '2027-12-31' },
  { code: 'MEMBERBARU', name: 'Cashback Khusus 15%', discountType: 'Percentage', value: 15, minTransaction: 30000, isActive: true, expiryDate: '2027-12-31' }
];

const initialEmployees: Employee[] = [
  { id: 'e-01', name: 'Joko Susilo', phone: '08130001001', email: 'joko.s@erp.com', division: 'Finance', role: 'Staff Finance', baseSalary: 6000000, mealAllowance: 500000, transportAllowance: 500000, shift: 'Shift Pagi', status: 'Active', joinedDate: '2025-01-01' },
  { id: 'e-02', name: 'Ahmad Dani', phone: '08130001002', email: 'ahmad.d@erp.com', division: 'Retail', role: 'Kasir Senior', baseSalary: 4500000, mealAllowance: 400000, transportAllowance: 400000, shift: 'Shift Siang', status: 'Active', joinedDate: '2025-03-15' },
  { id: 'e-03', name: 'Siti Aminah', phone: '08130001003', email: 'siti.a@erp.com', division: 'Kitchen', role: 'Cook/Operator Produksi', baseSalary: 4800000, mealAllowance: 500000, transportAllowance: 300000, shift: 'Shift Pagi', status: 'Active', joinedDate: '2025-02-10' },
  { id: 'e-04', name: 'Rudi Hartono', phone: '08130001004', email: 'rudi.h@erp.com', division: 'Warehouse', role: 'Staff Gudang', baseSalary: 4200000, mealAllowance: 400000, transportAllowance: 400000, shift: 'Shift Malam', status: 'Active', joinedDate: '2025-05-20' }
];

const initialAttendance: Attendance[] = [
  { id: 'at-01', employeeId: 'e-01', date: '2026-07-08', clockIn: '07:55', status: 'Present', overtimeMinutes: 60, lateMinutes: 0 },
  { id: 'at-02', employeeId: 'e-02', date: '2026-07-08', clockIn: '12:05', status: 'Present', overtimeMinutes: 0, lateMinutes: 5 },
  { id: 'at-03', employeeId: 'e-03', date: '2026-07-08', clockIn: '08:30', status: 'Late', overtimeMinutes: 0, lateMinutes: 30 },
  { id: 'at-04', employeeId: 'e-04', date: '2026-07-08', clockIn: '21:50', status: 'Present', overtimeMinutes: 120, lateMinutes: 0 }
];

const initialSales: Sale[] = [
  {
    id: 's-1001',
    invoiceNo: 'INV-20260708-000001',
    branchId: 'b-01',
    customerId: 'c-01',
    items: [
      { productId: 'p-01', quantity: 3, price: 10000, discountPercent: 0, discountAmount: 0, total: 30000 },
      { productId: 'p-03', quantity: 2, price: 15000, discountPercent: 0, discountAmount: 0, total: 30000 }
    ],
    subTotal: 60000,
    taxPercent: 11,
    taxAmount: 6600,
    discountPercent: 5,
    discountAmount: 3000,
    voucherCode: 'ERPBELANJA5',
    totalAmount: 63600,
    paymentMethod: 'QRIS',
    paymentDetail: { nonCashAmount: 63600, referenceNo: 'QR-998822' },
    status: 'Completed',
    operatorId: 'u-03',
    createdAt: '2026-07-08T11:30:00Z'
  },
  {
    id: 's-1002',
    invoiceNo: 'INV-20260708-000002',
    branchId: 'b-01',
    customerId: 'c-02',
    items: [
      { productId: 'p-02', quantity: 5, price: 8500, discountPercent: 0, discountAmount: 0, total: 42500 }
    ],
    subTotal: 42500,
    taxPercent: 11,
    taxAmount: 4675,
    discountPercent: 0,
    discountAmount: 0,
    totalAmount: 47175,
    paymentMethod: 'Cash',
    paymentDetail: { cashAmount: 50000 },
    cashReceived: 50000,
    changeAmount: 2825,
    status: 'Completed',
    operatorId: 'u-03',
    createdAt: '2026-07-08T15:45:00Z'
  }
];

const initialPurchases: PurchaseOrder[] = [
  {
    id: 'po-01',
    poNo: 'PO-20260705-0001',
    supplierId: 's-01',
    branchId: 'b-01',
    warehouseId: 'w-01',
    items: [
      { productId: 'p-05', quantity: 10, price: 40000 }, // 10 kg mayo
      { productId: 'p-09', quantity: 50, price: 18000 }  // 50 L minyak
    ],
    status: 'Received',
    taxPercent: 11,
    taxAmount: 143000,
    discountAmount: 50000,
    totalAmount: 1393000,
    note: 'Stok bulanan reguler',
    operatorId: 'u-02',
    createdAt: '2026-07-05T09:00:00Z'
  },
  {
    id: 'po-02',
    poNo: 'PO-20260707-0002',
    supplierId: 's-02',
    branchId: 'b-01',
    warehouseId: 'w-01',
    items: [
      { productId: 'p-07', quantity: 20, price: 75000 } // 20 packs smoked beef
    ],
    status: 'Approved',
    taxPercent: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 1500000,
    note: 'Urgent refill stock',
    operatorId: 'u-02',
    createdAt: '2026-07-07T14:00:00Z'
  }
];

const initialProductionLogs: ProductionLog[] = [
  {
    id: 'prd-01',
    productionNo: 'PRD-20260707-0001',
    bomId: 'bom-01',
    finishedProductId: 'p-01',
    quantityProduced: 120,
    quantityRejected: 3,
    quantityWaste: 2,
    operatorId: 'u-05',
    branchId: 'b-01',
    note: 'Batch pagi, adonan mengembang dengan sempurna.',
    status: 'Completed',
    createdAt: '2026-07-07T11:00:00Z'
  }
];

const initialFinanceLedger: FinanceLedger[] = [
  { id: 'f-01', branchId: 'b-01', type: 'In', category: 'Capital_Injection', amount: 50000000, note: 'Modal awal owner', operatorId: 'u-01', createdAt: '2026-01-01T08:00:00Z' },
  { id: 'f-02', branchId: 'b-01', type: 'Out', category: 'Operational_Rent', amount: 5000000, note: 'Sewa ruko bulan Juli', operatorId: 'u-06', createdAt: '2026-07-01T10:00:00Z' },
  { id: 'f-03', branchId: 'b-01', type: 'Out', category: 'Operational_Electricity', amount: 850000, note: 'Tagihan listrik dapur', operatorId: 'u-06', createdAt: '2026-07-03T11:00:00Z' },
  { id: 'f-04', branchId: 'b-01', type: 'Out', category: 'Purchase_Payment', amount: 1393000, referenceId: 'po-01', note: 'Pelunasan PO-20260705-0001', operatorId: 'u-06', createdAt: '2026-07-06T15:00:00Z' },
  { id: 'f-05', branchId: 'b-01', type: 'In', category: 'Sale_Income', amount: 63600, referenceId: 's-1001', note: 'Pendapatan invoice INV-20260708-000001', operatorId: 'u-03', createdAt: '2026-07-08T11:30:00Z' },
  { id: 'f-06', branchId: 'b-01', type: 'In', category: 'Sale_Income', amount: 47175, referenceId: 's-1002', note: 'Pendapatan invoice INV-20260708-000002', operatorId: 'u-03', createdAt: '2026-07-08T15:45:00Z' }
];

const initialAuditLogs: AuditLog[] = [
  { id: 'ad-01', userId: 'u-01', userName: 'Pak Hendra (Owner)', userRole: 'Owner', action: 'Login', details: 'Berhasil login ke sistem ERP.', ipAddress: '192.168.1.100', createdAt: '2026-07-09T08:00:00Z' },
  { id: 'ad-02', userId: 'u-01', userName: 'Pak Hendra (Owner)', userRole: 'Owner', action: 'View_Dashboard', details: 'Membuka dashboard analisis utama.', ipAddress: '192.168.1.100', createdAt: '2026-07-09T08:02:00Z' }
];

const initialRolePermissions: RolePermissions[] = [
  {
    role: 'Owner',
    modules: {
      dashboard: true,
      pos: true,
      inventory: true,
      production: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      employees: true,
      finance: true,
      audit: true,
      settings: true,
    },
    actions: {
      editProduct: true,
      adjustStock: true,
      transferStock: true,
      checkoutSales: true,
      refundSales: true,
      manageProduction: true,
      addPurchase: true,
      manageEmployees: true,
      manageFinance: true,
      exportBackup: true,
      resetDb: true,
    },
  },
  {
    role: 'Admin',
    modules: {
      dashboard: true,
      pos: true,
      inventory: true,
      production: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      employees: true,
      finance: false,
      audit: true,
      settings: true,
    },
    actions: {
      editProduct: true,
      adjustStock: true,
      transferStock: true,
      checkoutSales: true,
      refundSales: true,
      manageProduction: true,
      addPurchase: true,
      manageEmployees: true,
      manageFinance: false,
      exportBackup: true,
      resetDb: false,
    },
  },
  {
    role: 'Supervisor',
    modules: {
      dashboard: true,
      pos: true,
      inventory: true,
      production: true,
      purchasing: false,
      suppliers: false,
      customers: true,
      employees: true,
      finance: false,
      audit: false,
      settings: false,
    },
    actions: {
      editProduct: true,
      adjustStock: true,
      transferStock: true,
      checkoutSales: true,
      refundSales: true,
      manageProduction: true,
      addPurchase: false,
      manageEmployees: false,
      manageFinance: false,
      exportBackup: false,
      resetDb: false,
    },
  },
  {
    role: 'Kasir',
    modules: {
      dashboard: false,
      pos: true,
      inventory: false,
      production: false,
      purchasing: false,
      suppliers: false,
      customers: true,
      employees: false,
      finance: false,
      audit: false,
      settings: false,
    },
    actions: {
      editProduct: false,
      adjustStock: false,
      transferStock: false,
      checkoutSales: true,
      refundSales: false,
      manageProduction: false,
      addPurchase: false,
      manageEmployees: false,
      manageFinance: false,
      exportBackup: false,
      resetDb: false,
    },
  },
  {
    role: 'Gudang',
    modules: {
      dashboard: false,
      pos: false,
      inventory: true,
      production: false,
      purchasing: true,
      suppliers: false,
      customers: false,
      employees: false,
      finance: false,
      audit: false,
      settings: false,
    },
    actions: {
      editProduct: false,
      adjustStock: true,
      transferStock: true,
      checkoutSales: false,
      refundSales: false,
      manageProduction: false,
      addPurchase: false,
      manageEmployees: false,
      manageFinance: false,
      exportBackup: false,
      resetDb: false,
    },
  },
  {
    role: 'Produksi',
    modules: {
      dashboard: false,
      pos: false,
      inventory: false,
      production: true,
      purchasing: false,
      suppliers: false,
      customers: false,
      employees: false,
      finance: false,
      audit: false,
      settings: false,
    },
    actions: {
      editProduct: false,
      adjustStock: false,
      transferStock: false,
      checkoutSales: false,
      refundSales: false,
      manageProduction: true,
      addPurchase: false,
      manageEmployees: false,
      manageFinance: false,
      exportBackup: false,
      resetDb: false,
    },
  },
  {
    role: 'Finance',
    modules: {
      dashboard: true,
      pos: false,
      inventory: false,
      production: false,
      purchasing: true,
      suppliers: true,
      customers: false,
      employees: false,
      finance: true,
      audit: false,
      settings: false,
    },
    actions: {
      editProduct: false,
      adjustStock: false,
      transferStock: false,
      checkoutSales: false,
      refundSales: false,
      manageProduction: false,
      addPurchase: true,
      manageEmployees: false,
      manageFinance: true,
      exportBackup: false,
      resetDb: false,
    },
  },
];

const defaultSettings: SystemSettings = {
  companyName: 'Ngemil Ednak',
  companyAddress: 'Jl. Boulevard Raya Blok DF No. 9, Kelapa Gading, Jakarta Utara',
  companyPhone: '0812-1122-3344',
  companyEmail: 'info@dapurrisol.com',
  logoUrl: '',
  currency: 'Rp',
  taxPercent: 11,
  taxEnabledByDefault: false,
  thermalPrinterConfig: {
    paperWidth: '58mm',
    headerMessage: 'Ngemil Ednak\nLezat & Gurih',
    footerMessage: 'Thank you!\nfor supporting my small business \nOrder 081213484896_IG @ngemil.ednak.'
  },
  smtpConfig: {
    host: 'smtp.dapurrisol.com',
    port: 587,
    user: 'billing@dapurrisol.com'
  },
  whatsAppConfig: {
    gatewayUrl: 'https://api.whatsapp-gateway.io/send',
    apiKey: 'wa_key_mock_123456789'
  },
  timezone: 'WIB (UTC+7)'
};

// Syncing configuration
const SYNC_KEYS = [
  KEYS.USERS,
  KEYS.BRANCHES,
  KEYS.WAREHOUSES,
  KEYS.CUSTOMERS,
  KEYS.SUPPLIERS,
  KEYS.CATEGORIES,
  KEYS.UNITS,
  KEYS.RACKS,
  KEYS.PRODUCTS,
  KEYS.STOCKS,
  KEYS.MOVEMENTS,
  KEYS.BOMS,
  KEYS.PRODUCTION,
  KEYS.PURCHASES,
  KEYS.SALES,
  KEYS.VOUCHERS,
  KEYS.FINANCE,
  KEYS.EMPLOYEES,
  KEYS.ATTENDANCE,
  KEYS.PAYROLL,
  KEYS.AUDIT,
  KEYS.SETTINGS,
  KEYS.PERMISSIONS,
  'erp_attendances',
  'erp_payslips'
];

const INITIAL_DATA_MAP: Record<string, any> = {
  [KEYS.USERS]: initialUsers,
  [KEYS.BRANCHES]: initialBranches,
  [KEYS.WAREHOUSES]: initialWarehouses,
  [KEYS.CATEGORIES]: initialCategories,
  [KEYS.UNITS]: initialUnits,
  [KEYS.RACKS]: initialRacks,
  [KEYS.PRODUCTS]: initialProducts,
  [KEYS.STOCKS]: initialStocks,
  [KEYS.BOMS]: initialBoms,
  [KEYS.CUSTOMERS]: initialCustomers,
  [KEYS.SUPPLIERS]: initialSuppliers,
  [KEYS.VOUCHERS]: initialVouchers,
  [KEYS.EMPLOYEES]: initialEmployees,
  [KEYS.ATTENDANCE]: initialAttendance,
  [KEYS.SALES]: initialSales,
  [KEYS.PURCHASES]: initialPurchases,
  [KEYS.PRODUCTION]: initialProductionLogs,
  [KEYS.FINANCE]: initialFinanceLedger,
  [KEYS.AUDIT]: initialAuditLogs,
  [KEYS.SETTINGS]: defaultSettings,
  [KEYS.PAYROLL]: [] as Payroll[],
  [KEYS.PERMISSIONS]: initialRolePermissions,
  [KEYS.MOVEMENTS]: [] as StockMovement[],
  'erp_attendances': [] as any[],
  'erp_payslips': [] as any[]
};

// Database Engine Wrapper
export class LocalDb {
  private static syncTimeout: any = null;

  private static dispatchSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      window.dispatchEvent(new Event('db-sync'));
    }, 150);
  }

  private static get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error loading database key: ${key}`, e);
      return defaultValue;
    }
  }

  private static set<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      
      // Background Sync to Firestore
      if (SYNC_KEYS.includes(key)) {
        setDoc(doc(db, key, "all"), { data }).catch(err => {
          console.error(`Failed to sync key ${key} to Firestore:`, err);
        });
      }
    } catch (e) {
      console.error(`Error saving database key: ${key}`, e);
    }
  }

  // Seeder & Firestore Sync Init
  public static init(): void {
    // 1. Fill local storage with defaults first if empty (instant user feedback)
    Object.keys(INITIAL_DATA_MAP).forEach(key => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(INITIAL_DATA_MAP[key]));
      }
    });

    if (!localStorage.getItem(KEYS.CURRENT_SESSION)) {
      localStorage.setItem(KEYS.CURRENT_SESSION, JSON.stringify({
        token: 'mock-jwt-token-123456',
        refreshToken: 'mock-refresh-token-123456',
        user: initialUsers[0], // Pak Hendra (Owner)
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }));
    }

    // 2. Initialize Real-Time Sync with Firestore
    SYNC_KEYS.forEach(key => {
      const docRef = doc(db, key, "all");
      onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data().data;
          const localStr = localStorage.getItem(key);
          const cloudStr = JSON.stringify(cloudData);
          
          if (localStr !== cloudStr) {
            localStorage.setItem(key, cloudStr);
            this.dispatchSync();
          }
        } else {
          // Document does not exist in Cloud, seed local copy to cloud
          const localData = this.get(key, INITIAL_DATA_MAP[key] || []);
          setDoc(docRef, { data: localData }).catch(err => {
            console.error(`Failed to seed cloud collection ${key}:`, err);
          });
        }
      }, (error) => {
        console.error(`onSnapshot error for collection ${key}:`, error);
      });
    });
  }

  // Reset to factory seed (resets both local storage and firestore)
  public static resetFactory(): void {
    localStorage.removeItem(KEYS.CURRENT_SESSION);

    Object.keys(INITIAL_DATA_MAP).forEach(key => {
      localStorage.setItem(key, JSON.stringify(INITIAL_DATA_MAP[key]));
      setDoc(doc(db, key, "all"), { data: INITIAL_DATA_MAP[key] }).catch(err => {
        console.error(`Failed to reset cloud key ${key}:`, err);
      });
    });

    this.init();
  }


  // Getters
  public static getBranches(): Branch[] { return this.get(KEYS.BRANCHES, []); }
  public static saveBranches(data: Branch[]): void { this.set(KEYS.BRANCHES, data); }

  public static getWarehouses(): Warehouse[] { return this.get(KEYS.WAREHOUSES, []); }
  public static saveWarehouses(data: Warehouse[]): void { this.set(KEYS.WAREHOUSES, data); }

  public static getUsers(): User[] { return this.get(KEYS.USERS, []); }
  public static saveUsers(data: User[]): void { this.set(KEYS.USERS, data); }

  public static getCategories(): Category[] { return this.get(KEYS.CATEGORIES, []); }
  public static saveCategories(data: Category[]): void { this.set(KEYS.CATEGORIES, data); }

  public static getUnits(): Unit[] { return this.get(KEYS.UNITS, []); }
  public static saveUnits(data: Unit[]): void { this.set(KEYS.UNITS, data); }

  public static getRacks(): StorageRack[] { return this.get(KEYS.RACKS, []); }
  public static saveRacks(data: StorageRack[]): void { this.set(KEYS.RACKS, data); }

  public static getProducts(): Product[] { return this.get(KEYS.PRODUCTS, []); }
  public static saveProducts(data: Product[]): void { this.set(KEYS.PRODUCTS, data); }

  public static getStocks(): Stock[] { return this.get(KEYS.STOCKS, []); }
  public static saveStocks(data: Stock[]): void { this.set(KEYS.STOCKS, data); }

  public static getBoms(): Bom[] { return this.get(KEYS.BOMS, []); }
  public static saveBoms(data: Bom[]): void { this.set(KEYS.BOMS, data); }

  public static getCustomers(): Customer[] { return this.get(KEYS.CUSTOMERS, []); }
  public static saveCustomers(data: Customer[]): void { this.set(KEYS.CUSTOMERS, data); }

  public static getSuppliers(): Supplier[] { return this.get(KEYS.SUPPLIERS, []); }
  public static saveSuppliers(data: Supplier[]): void { this.set(KEYS.SUPPLIERS, data); }

  public static getVouchers(): Voucher[] { return this.get(KEYS.VOUCHERS, []); }
  public static saveVouchers(data: Voucher[]): void { this.set(KEYS.VOUCHERS, data); }

  public static getEmployees(): Employee[] { return this.get(KEYS.EMPLOYEES, []); }
  public static saveEmployees(data: Employee[]): void { this.set(KEYS.EMPLOYEES, data); }

  public static getAttendance(): Attendance[] { return this.get(KEYS.ATTENDANCE, []); }
  public static saveAttendance(data: Attendance[]): void { this.set(KEYS.ATTENDANCE, data); }

  public static getSales(): Sale[] { return this.get(KEYS.SALES, []); }
  public static saveSales(data: Sale[]): void { this.set(KEYS.SALES, data); }

  public static getPurchases(): PurchaseOrder[] { return this.get(KEYS.PURCHASES, []); }
  public static savePurchases(data: PurchaseOrder[]): void { this.set(KEYS.PURCHASES, data); }

  public static getProductionLogs(): ProductionLog[] { return this.get(KEYS.PRODUCTION, []); }
  public static saveProductionLogs(data: ProductionLog[]): void { this.set(KEYS.PRODUCTION, data); }

  public static getFinanceLedgers(): FinanceLedger[] { return this.get(KEYS.FINANCE, []); }
  public static saveFinanceLedgers(data: FinanceLedger[]): void { this.set(KEYS.FINANCE, data); }

  public static getAuditLogs(): AuditLog[] { return this.get(KEYS.AUDIT, []); }
  public static saveAuditLogs(data: AuditLog[]): void { this.set(KEYS.AUDIT, data); }

  public static getStockMovements(): StockMovement[] { return this.get(KEYS.MOVEMENTS, []); }
  public static saveStockMovements(data: StockMovement[]): void { this.set(KEYS.MOVEMENTS, data); }

  public static getSettings(): SystemSettings { return this.get(KEYS.SETTINGS, defaultSettings); }
  public static saveSettings(data: SystemSettings): void { this.set(KEYS.SETTINGS, data); }

  public static getPermissions(): RolePermissions[] { return this.get(KEYS.PERMISSIONS, initialRolePermissions); }
  public static savePermissions(data: RolePermissions[]): void { this.set(KEYS.PERMISSIONS, data); }

  public static getAttendancesReal(): any[] { return this.get('erp_attendances', []); }
  public static saveAttendancesReal(data: any[]): void { this.set('erp_attendances', data); }

  public static getPayslipsReal(): any[] { return this.get('erp_payslips', []); }
  public static savePayslipsReal(data: any[]): void { this.set('erp_payslips', data); }


  public static hasPermission(user: User, action: keyof RolePermissions['actions']): boolean {
    if (user.role === 'Owner') return true;
    const permissions = this.getPermissions();
    const perm = permissions.find(p => p.role === user.role);
    if (!perm) return false;
    return !!perm.actions[action];
  }

  public static hasModuleAccess(user: User, moduleKey: string): boolean {
    if (user.role === 'Owner') return true;
    const permissions = this.getPermissions();
    const perm = permissions.find(p => p.role === user.role);
    if (!perm) {
      const defaultRolesMap: Record<string, string[]> = {
        dashboard: ['Owner', 'Admin', 'Supervisor', 'Finance'],
        pos: ['Owner', 'Admin', 'Supervisor', 'Kasir'],
        inventory: ['Owner', 'Admin', 'Supervisor', 'Gudang'],
        production: ['Owner', 'Admin', 'Supervisor', 'Produksi'],
        purchasing: ['Owner', 'Admin', 'Finance', 'Gudang'],
        suppliers: ['Owner', 'Admin', 'Finance'],
        customers: ['Owner', 'Admin', 'Supervisor', 'Kasir'],
        employees: ['Owner', 'Admin', 'Supervisor'],
        finance: ['Owner', 'Finance'],
        audit: ['Owner', 'Admin'],
        settings: ['Owner', 'Admin']
      };
      const allowedRoles = defaultRolesMap[moduleKey] || [];
      return allowedRoles.includes(user.role);
    }
    return !!perm.modules[moduleKey as keyof typeof perm.modules];
  }

  public static getCurrentSession(): { token: string; refreshToken: string; user: User; expiresAt: string } | null {
    return this.get(KEYS.CURRENT_SESSION, null);
  }
  public static saveCurrentSession(session: any | null): void {
    this.set(KEYS.CURRENT_SESSION, session);
  }

  // Stock mutation Helper
  public static addStockMovement(
    productId: string,
    warehouseId: string,
    quantity: number,
    type: 'In' | 'Out',
    referenceId: string,
    operatorId: string,
    note: string,
    batchNumber?: string,
    expiryDate?: string
  ): void {
    const stocks = this.getStocks();
    const existingIndex = stocks.findIndex(s => s.productId === productId && s.warehouseId === warehouseId);
    
    if (existingIndex > -1) {
      if (type === 'In') {
        stocks[existingIndex].quantity += quantity;
      } else {
        stocks[existingIndex].quantity = Math.max(0, stocks[existingIndex].quantity - quantity);
      }
      if (batchNumber) stocks[existingIndex].batchNumber = batchNumber;
      if (expiryDate) stocks[existingIndex].expiryDate = expiryDate;
    } else {
      stocks.push({
        id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId,
        warehouseId,
        quantity: type === 'In' ? quantity : 0,
        batchNumber,
        expiryDate
      });
    }
    this.saveStocks(stocks);

    // Record movement log
    const movements = this.get(KEYS.MOVEMENTS, [] as StockMovement[]);
    movements.push({
      id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId,
      [type === 'In' ? 'toWarehouseId' : 'fromWarehouseId']: warehouseId,
      quantity,
      type: type === 'In' ? 'In' : 'Out',
      referenceId,
      batchNumber,
      expiryDate,
      operatorId,
      note,
      createdAt: new Date().toISOString()
    });
    this.set(KEYS.MOVEMENTS, movements);
  }

  // Stock transfer helper
  public static transferStock(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    operatorId: string,
    note: string
  ): boolean {
    const stocks = this.getStocks();
    const sourceStockIndex = stocks.findIndex(s => s.productId === productId && s.warehouseId === fromWarehouseId);
    
    if (sourceStockIndex === -1 || stocks[sourceStockIndex].quantity < quantity) {
      return false; // Insufficient stock
    }

    // Deduct source
    stocks[sourceStockIndex].quantity -= quantity;

    // Add target
    const targetStockIndex = stocks.findIndex(s => s.productId === productId && s.warehouseId === toWarehouseId);
    if (targetStockIndex > -1) {
      stocks[targetStockIndex].quantity += quantity;
    } else {
      stocks.push({
        id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId,
        warehouseId: toWarehouseId,
        quantity
      });
    }
    this.saveStocks(stocks);

    // Record transfer log
    const movements = this.get(KEYS.MOVEMENTS, [] as StockMovement[]);
    movements.push({
      id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId,
      fromWarehouseId,
      toWarehouseId,
      quantity,
      type: 'Transfer',
      referenceId: `TRF-${Date.now()}`,
      operatorId,
      note,
      createdAt: new Date().toISOString()
    });
    this.set(KEYS.MOVEMENTS, movements);
    return true;
  }

  // Stock warning status list
  public static getStockWarnings(): { product: Product; warehouse: Warehouse; quantity: number; minStock: number }[] {
    const stocks = this.getStocks();
    const products = this.getProducts();
    const warehouses = this.getWarehouses();
    const warnings: any[] = [];

    stocks.forEach(stock => {
      const prod = products.find(p => p.id === stock.productId);
      const wh = warehouses.find(w => w.id === stock.warehouseId);
      if (prod && wh && stock.quantity <= prod.minStock) {
        warnings.push({
          product: prod,
          warehouse: wh,
          quantity: stock.quantity,
          minStock: prod.minStock
        });
      }
    });

    return warnings;
  }

  // Audit Logger
  public static logAudit(userId: string, action: string, details: string): void {
    const logs = this.getAuditLogs();
    const users = this.getUsers();
    const u = users.find(user => user.id === userId);
    
    logs.push({
      id: `audit-${Date.now()}`,
      userId,
      userName: u ? u.name : 'Unknown User',
      userRole: u ? u.role : 'Guest',
      action,
      details,
      ipAddress: '127.0.0.1 (Web Preview)',
      createdAt: new Date().toISOString()
    });
    
    // Cap at 1000 logs
    if (logs.length > 1000) logs.shift();
    this.saveAuditLogs(logs);
  }

  // General Backup Data Export
  public static exportData(): string {
    const data: Record<string, any> = {};
    Object.keys(KEYS).forEach(k => {
      const storageKey = (KEYS as any)[k];
      data[storageKey] = localStorage.getItem(storageKey);
    });
    return JSON.stringify(data);
  }

  // General Restore Data Import
  public static restoreData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(storageKey => {
        if (data[storageKey] !== null) {
          localStorage.setItem(storageKey, data[storageKey]);
        }
      });
      return true;
    } catch (e) {
      console.error('Failed to restore data', e);
      return false;
    }
  }
}

LocalDb.init();

