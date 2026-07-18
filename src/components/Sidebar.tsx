/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Hammer, 
  ClipboardList, 
  Truck, 
  Users, 
  UserCheck, 
  DollarSign, 
  ShieldAlert, 
  Settings, 
  LogOut, 
  Building,
  Store,
  User as UserIcon,
  Moon,
  Sun,
  Database,
  X,
  Lock
} from 'lucide-react';
import { User, Branch } from '../types';
import { LocalDb } from '../db/localDb';

interface SidebarProps {
  currentModule: string;
  setCurrentModule: (module: string) => void;
  currentUser: User;
  onLogout: () => void;
  branches: Branch[];
  currentBranchId: string;
  setCurrentBranchId: (id: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onResetDb: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  currentModule,
  setCurrentModule,
  currentUser,
  onLogout,
  branches,
  currentBranchId,
  setCurrentBranchId,
  darkMode,
  setDarkMode,
  onResetDb,
  isMobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  
  // Available menu items with permissions mapping
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard Analytics', icon: LayoutDashboard, roles: ['Owner', 'Admin', 'Supervisor', 'Finance'] },
    { id: 'pos', name: 'Point of Sale (POS)', icon: ShoppingCart, roles: ['Owner', 'Admin', 'Supervisor', 'Kasir'] },
    { id: 'inventory', name: 'Inventory & Stock', icon: Package, roles: ['Owner', 'Admin', 'Supervisor', 'Gudang'] },
    { id: 'production', name: 'BOM & Produksi', icon: Hammer, roles: ['Owner', 'Admin', 'Supervisor', 'Produksi'] },
    { id: 'purchasing', name: 'Pembelian (PO)', icon: ClipboardList, roles: ['Owner', 'Admin', 'Finance', 'Gudang'] },
    { id: 'suppliers', name: 'Supplier & Hutang', icon: Truck, roles: ['Owner', 'Admin', 'Finance'] },
    { id: 'customers', name: 'CRM & Customer', icon: Users, roles: ['Owner', 'Admin', 'Supervisor', 'Kasir'] },
    { id: 'employees', name: 'HR, Absensi & Payroll', icon: UserCheck, roles: ['Owner', 'Admin', 'Supervisor'] },
    { id: 'finance', name: 'Keuangan & Buku Kas', icon: DollarSign, roles: ['Owner', 'Finance'] },
    { id: 'audit', name: 'Audit Logs', icon: ShieldAlert, roles: ['Owner', 'Admin'] },
    { id: 'settings', name: 'Pengaturan Sistem', icon: Settings, roles: ['Owner', 'Admin'] },
  ];

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs transition-all duration-300"
        />
      )}

      <aside className={`bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0 h-screen overflow-y-auto transition-transform duration-300 z-50 print:hidden
        fixed inset-y-0 left-0 w-64 lg:static lg:translate-x-0
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-bold text-white shadow-md shadow-orange-500/20">
              DR
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white">Ngemil Ednak</h1>
              <p className="text-[10px] text-slate-400 font-mono">v1.2.0-Enterprise</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Toggle Theme"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 lg:hidden transition-colors"
                title="Close Menu"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Multi-Branch Selector */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5 flex items-center gap-1">
            <Building size={11} className="text-orange-500" /> Cabang Aktif
          </label>
          <select
            value={currentBranchId}
            onChange={(e) => {
              setCurrentBranchId(e.target.value);
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans"
          >
            {branches
              .filter(br => {
                if (currentUser.assignedBranchIds && currentUser.assignedBranchIds.length > 0) {
                  return currentUser.assignedBranchIds.includes(br.id);
                }
                return br.id === currentUser.branchId;
              })
              .map(br => (
                <option key={br.id} value={br.id}>
                  {br.name}
                </option>
              ))}
          </select>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 mb-2 text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Modul Bisnis</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            const hasAccess = LocalDb.hasModuleAccess(currentUser, item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentModule(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left group cursor-pointer ${
                  isActive 
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                } ${!hasAccess ? 'opacity-50' : ''}`}
                title={!hasAccess ? `Akses Dibatasi untuk Peran ${currentUser.role}` : item.name}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'} />
                  <span className="truncate">{item.name}</span>
                </div>
                {!hasAccess && (
                  <Lock size={12} className="text-slate-500 group-hover:text-slate-400 shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 mt-auto flex flex-col gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-orange-400 border border-slate-700 font-semibold text-sm">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-semibold text-white truncate">{currentUser.name}</h2>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {currentUser.role}
              </span>
            </div>
          </div>
        </div>

        {/* Database & Logout Controls */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onResetDb}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 text-[10px] font-medium border border-slate-700 transition-colors"
            title="Reset Database"
          >
            <Database size={12} />
            <span>Reset DB</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] font-medium border border-slate-700 transition-colors"
          >
            <LogOut size={12} className="text-slate-400" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </aside>
  </>
  );
}
