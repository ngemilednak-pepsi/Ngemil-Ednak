/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User & Authentication Types
export type UserRole = 'Owner' | 'Admin' | 'Supervisor' | 'Kasir' | 'Gudang' | 'Produksi' | 'Finance';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  branchId: string; // Multi-branch association
  assignedBranchIds?: string[];
  assignedWarehouseIds?: string[];
  createdAt: string;
  ktpFiles?: { name: string; size: number; data: string }[];
  supportingDocument?: { name: string; size: number; data: string } | null;
  baseSalary?: number;
}

export interface Session {
  token: string;
  refreshToken: string;
  user: User;
  expiresAt: string;
}

export interface RolePermissions {
  role: UserRole;
  modules: {
    dashboard: boolean;
    pos: boolean;
    inventory: boolean;
    production: boolean;
    purchasing: boolean;
    suppliers: boolean;
    customers: boolean;
    employees: boolean;
    finance: boolean;
    audit: boolean;
    settings: boolean;
  };
  actions: {
    editProduct: boolean;      // Tambah/Edit Produk
    adjustStock: boolean;      // Penyesuaian Stok
    transferStock: boolean;    // Transfer Stok Gudang
    checkoutSales: boolean;    // Transaksi POS (Bayar)
    refundSales: boolean;      // Refund/Void Transaksi
    manageProduction: boolean; // Produksi (BOM & Mulai)
    addPurchase: boolean;      // Buat Purchase Order (PO)
    manageEmployees: boolean;  // Kelola Staff & Gaji
    manageFinance: boolean;    // Kelola Buku Kas & Keuangan
    exportBackup: boolean;     // Backup Database
    resetDb: boolean;          // Reset Database
  };
}

// Branch & Warehouse Types
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  branchId: string;
  name: string;
  location: string;
  isActive: boolean;
}

// Supplier & Customer Types
export type MemberTier = 'Silver' | 'Gold' | 'Platinum';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  birthDate: string;
  points: number;
  cashback: number;
  tier: MemberTier;
  totalSpent: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  bankAccount: string;
  bankName: string;
  accountsPayable: number;
  createdAt: string;
}

// Product & Inventory Types
export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Unit {
  id: string;
  name: string; // e.g., kg, gram, pcs, liter, ml, pack
}

export interface StorageRack {
  id: string;
  warehouseId: string;
  name: string;
}

export interface Product {
  id: string;
  code: string;
  barcode: string;
  name: string;
  categoryId: string;
  brand: string;
  costPrice: number; // Harga Modal
  sellingPrice: number; // Harga Jual
  wholesalePrice: number; // Harga Grosir
  imageUrl: string;
  description: string;
  minStock: number;
  unitId: string;
  isIngredient: boolean; // True if raw material (BOM ingredient), false if finished product
  isPackage?: boolean;
  packageItems?: { productId: string; quantity: number }[];
  isActive: boolean;
  createdAt: string;
}

export interface Stock {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
}

export type MovementType = 'In' | 'Out' | 'Transfer' | 'Opname' | 'Production_In' | 'Production_Out' | 'Purchase_Receipt' | 'Sale' | 'Sale_Refund';

export interface StockMovement {
  id: string;
  productId: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  quantity: number;
  type: MovementType;
  referenceId: string; // Invoice ID, PO ID, Production ID, etc.
  batchNumber?: string;
  expiryDate?: string;
  operatorId: string;
  note: string;
  createdAt: string;
}

// Bill of Materials (BOM) & Production Types
export interface BomItem {
  id: string;
  ingredientId: string; // Product where isIngredient is true
  quantity: number; // Quantity needed per 1 unit of finished product
}

export interface Bom {
  id: string;
  finishedProductId: string; // Product where isIngredient is false
  name: string;
  ingredients: BomItem[];
  otherCosts: {
    gas: number;
    packaging: number;
    labor: number;
    overhead: number;
  };
  totalCostPrice: number; // Calculated automatic HPP
  createdAt: string;
}

export type ProductionStatus = 'Completed' | 'Rejected';

export interface ProductionLog {
  id: string;
  productionNo: string;
  bomId: string;
  finishedProductId: string;
  quantityProduced: number;
  quantityRejected: number;
  quantityWaste: number;
  operatorId: string;
  branchId: string;
  note: string;
  status: ProductionStatus;
  createdAt: string;
}

// Purchasing Types
export type PurchaseStatus = 'Draft' | 'Approved' | 'Received' | 'Cancelled';

export interface PurchaseItem {
  productId: string;
  quantity: number;
  price: number; // Cost price at purchase
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string;
  branchId: string;
  warehouseId: string;
  items: PurchaseItem[];
  status: PurchaseStatus;
  taxPercent: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  note: string;
  operatorId: string;
  createdAt: string;
}

// Sales & POS Types
export interface SaleItem {
  productId: string;
  quantity: number;
  price: number; // Selling price
  discountPercent: number;
  discountAmount: number;
  total: number;
}

export type PaymentMethod = 'Cash' | 'QRIS' | 'Bank Transfer' | 'E-Wallet' | 'Split';

export interface Sale {
  id: string;
  invoiceNo: string;
  branchId: string;
  warehouseId?: string;
  customerId?: string; // Optional member
  items: SaleItem[];
  subTotal: number;
  taxPercent: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  voucherCode?: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentDetail: {
    cashAmount?: number;
    nonCashAmount?: number;
    bankName?: string;
    referenceNo?: string;
  };
  cashReceived?: number;
  changeAmount?: number;
  status: 'Completed' | 'Refunded' | 'Void';
  refundNote?: string;
  operatorId: string;
  createdAt: string;
}

// Voucher / Promo Types
export interface Voucher {
  code: string;
  name: string;
  discountType: 'Percentage' | 'Nominal';
  value: number;
  minTransaction: number;
  isActive: boolean;
  expiryDate: string;
}

// Financial Ledger Types
export type LedgerCategory = 'Operational_Electricity' | 'Operational_Water' | 'Operational_Internet' | 'Operational_Rent' | 'Operational_Marketing' | 'Purchase_Payment' | 'Sale_Income' | 'Payroll_Expense' | 'Capital_Injection' | 'Cash_Adjustment';

export interface FinanceLedger {
  id: string;
  branchId: string;
  type: 'In' | 'Out';
  category: LedgerCategory;
  amount: number;
  referenceId?: string; // PO ID, Sale ID, Payroll ID, etc.
  note: string;
  operatorId: string;
  createdAt: string;
}

// Employee, Attendance, and Payroll Types
export type EmployeeStatus = 'Active' | 'Inactive';
export type ShiftType = 'Shift Pagi' | 'Shift Siang' | 'Shift Malam';

export interface Employee {
  id: string;
  name: string;
  phone: string;
  email: string;
  division: string;
  role: string;
  baseSalary: number;
  mealAllowance: number;
  transportAllowance: number;
  shift: ShiftType;
  status: EmployeeStatus;
  joinedDate: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string;
  clockInSelfie?: string; // Data URL mock
  clockInLocation?: { lat: number; lng: number; address: string };
  clockOut?: string;
  clockOutSelfie?: string;
  clockOutLocation?: { lat: number; lng: number; address: string };
  status: 'Present' | 'Late' | 'Absent' | 'On_Leave';
  overtimeMinutes: number;
  lateMinutes: number;
}

export interface Payroll {
  id: string;
  payrollNo: string;
  employeeId: string;
  month: string; // e.g., "2026-07"
  baseSalary: number;
  mealAllowance: number;
  transportAllowance: number;
  bonus: number;
  overtimePay: number;
  deductions: {
    bpjs: number;
    pph21: number;
    lateDeduction: number;
    other: number;
  };
  netSalary: number;
  status: 'Paid' | 'Pending';
  paidAt?: string;
  operatorId: string;
  createdAt: string;
}

// Audit Log Type
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

// ERP Settings Types
export interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoUrl: string;
  currency: string; // Rp, USD, etc.
  taxPercent: number;
  taxEnabledByDefault?: boolean;
  thermalPrinterConfig: {
    paperWidth: '58mm' | '80mm';
    headerMessage: string;
    footerMessage: string;
  };
  smtpConfig: {
    host: string;
    port: number;
    user: string;
  };
  whatsAppConfig: {
    gatewayUrl: string;
    apiKey: string;
  };
  timezone: string;
}
