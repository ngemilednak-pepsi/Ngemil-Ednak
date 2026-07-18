/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Percent, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Store, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Filter,
  Printer,
  FileText,
  UserCheck,
  DollarSign
} from 'lucide-react';
import { LocalDb } from '../db/localDb';
import { Sale, Product, Stock, Warehouse, Branch } from '../types';
import DashboardAttendanceTable from './DashboardAttendanceTable';
import DashboardPayslipModal from './DashboardPayslipModal';

interface DashboardModuleProps {
  currentBranchId: string;
  dbVersion?: number;
}

export default function DashboardModule({ currentBranchId, dbVersion }: DashboardModuleProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  // HR Dashboard state variables
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'sales' | 'hr'>('sales');
  const [hoveredHrIndex, setHoveredHrIndex] = useState<number | null>(null);

  // Print-ready active payslip overlay inside HR dashboard
  const [activeDashboardPayslip, setActiveDashboardPayslip] = useState<any | null>(null);

  useEffect(() => {
    // Reload dashboard metrics
    setSales(LocalDb.getSales());
    setProducts(LocalDb.getProducts());
    setStocks(LocalDb.getStocks());
    setWarehouses(LocalDb.getWarehouses());
    setBranches(LocalDb.getBranches());

    // Load HR data
    setEmployees(LocalDb.getUsers());
    const allAtt = LocalDb.getAttendancesReal();
    setAttendances(allAtt);
    const allPay = LocalDb.getPayslipsReal();
    setPayslips(allPay);
  }, [currentBranchId, dbVersion]);

  // Filter warehouses belonging to this branch
  const activeBranchWarehouses = warehouses.filter(w => w.branchId === currentBranchId).map(w => w.id);

  // Filter sales based on branch
  const branchSales = sales.filter(s => s.branchId === currentBranchId);

  // Helper date parsing
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const isCurrentMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  // Calculations
  const todaySalesList = branchSales.filter(s => isToday(s.createdAt) && s.status === 'Completed');
  const monthSalesList = branchSales.filter(s => isCurrentMonth(s.createdAt) && s.status === 'Completed');

  const todaySalesRevenue = todaySalesList.reduce((sum, s) => sum + s.totalAmount, 0);
  const monthSalesRevenue = monthSalesList.reduce((sum, s) => sum + s.totalAmount, 0);

  // Profit calculations: Laba = Sale total - Sum of (item costPrice * quantity)
  const calculateSalesProfit = (salesList: Sale[]) => {
    let revenue = 0;
    let totalCogs = 0;
    salesList.forEach(sale => {
      revenue += sale.totalAmount;
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cost = prod ? prod.costPrice : 0;
        totalCogs += cost * item.quantity;
      });
    });
    return revenue - totalCogs;
  };

  const todayProfit = calculateSalesProfit(todaySalesList);
  const monthProfit = calculateSalesProfit(monthSalesList);

  const totalTransactionsCount = branchSales.length;
  const completedTransactionsCount = branchSales.filter(s => s.status === 'Completed').length;

  // Active members
  const totalCustomersCount = LocalDb.getCustomers().length;

  // Stock warning
  const stockWarnings = LocalDb.getStockWarnings().filter(w => activeBranchWarehouses.includes(w.warehouse.id));

  // Product sales volume chart preparation
  const getProductSalesVolume = () => {
    const map: Record<string, number> = {};
    branchSales.filter(s => s.status === 'Completed').forEach(sale => {
      sale.items.forEach(item => {
        map[item.productId] = (map[item.productId] || 0) + item.quantity;
      });
    });
    return Object.entries(map).map(([pid, qty]) => {
      const prod = products.find(p => p.id === pid);
      return {
        name: prod ? prod.name : 'Unknown Product',
        qty,
        category: prod ? prod.categoryId : ''
      };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5);
  };

  const topSellingProducts = getProductSalesVolume();

  // Chart filter states
  const [chartFilterType, setChartFilterType] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // default custom date to 14 days ago
    return d.toISOString().split('T')[0];
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Daily revenue chart generator supporting weekly, monthly, and custom range filters
  const getChartData = () => {
    const monthsName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const daysShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    
    if (chartFilterType === 'weekly') {
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = daysShort[d.getDay()];
        const daySales = branchSales.filter(s => {
          const sd = new Date(s.createdAt);
          return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear() && s.status === 'Completed';
        });
        const rev = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
        result.push({
          label: `${dayName} (${d.getDate()}/${d.getMonth() + 1})`,
          value: rev,
          tooltip: `${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}: Rp ${rev.toLocaleString('id-ID')}`
        });
      }
      return result;
    }
    
    if (chartFilterType === 'monthly') {
      const result = [];
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(selectedYear, selectedMonth, day);
        const daySales = branchSales.filter(s => {
          const sd = new Date(s.createdAt);
          return sd.getDate() === day && sd.getMonth() === selectedMonth && sd.getFullYear() === selectedYear && s.status === 'Completed';
        });
        const rev = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
        result.push({
          label: `${day}`,
          value: rev,
          tooltip: `${day} ${monthsName[selectedMonth]} ${selectedYear}: Rp ${rev.toLocaleString('id-ID')}`
        });
      }
      return result;
    }
    
    if (chartFilterType === 'custom') {
      const result = [];
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const temp = new Date(start);
        
        // Limit to max 90 days to prevent browser hanging
        for (let i = 0; i <= Math.min(diffDays, 90); i++) {
          const currentDay = temp.getDate();
          const currentMonth = temp.getMonth();
          const currentYear = temp.getFullYear();
          
          const daySales = branchSales.filter(s => {
            const sd = new Date(s.createdAt);
            return sd.getDate() === currentDay && sd.getMonth() === currentMonth && sd.getFullYear() === currentYear && s.status === 'Completed';
          });
          const rev = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
          result.push({
            label: `${currentDay}/${currentMonth + 1}`,
            value: rev,
            tooltip: `${temp.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}: Rp ${rev.toLocaleString('id-ID')}`
          });
          temp.setDate(temp.getDate() + 1);
        }
      }
      return result;
    }
    
    return [];
  };

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = getChartData();
  const maxWeeklyRevenue = Math.max(...chartData.map(d => d.value), 100000);
  const totalFilteredRevenue = chartData.reduce((sum, d) => sum + d.value, 0);
  const avgFilteredRevenue = chartData.length > 0 ? Math.round(totalFilteredRevenue / chartData.length) : 0;

  // Compute coordinate points for SVG line chart
  const points = chartData.map((d, idx) => {
    // Leave margin on left/right for neat styling inside viewBox="0 0 600 200"
    const x = chartData.length > 1 ? 25 + (idx / (chartData.length - 1)) * 550 : 300;
    // Leave margin on top/bottom: y=30 is max value (highest revenue), y=180 is min value (zero revenue)
    const y = maxWeeklyRevenue > 0 ? 180 - (d.value / maxWeeklyRevenue) * 150 : 180;
    return { x, y, ...d, index: idx };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} 185 L ${points[0].x} 185 Z`
    : '';

  // Latest activities
  const recentSales = branchSales.slice(-4).reverse();

  // --- HR ANALYSIS CALCULATIONS ---
  // Active employees in this branch
  const activeEmployees = employees.filter(u => u.branchId === currentBranchId && u.isActive);
  const totalActiveEmployees = activeEmployees.length;
  const managerCount = activeEmployees.filter(u => u.role === 'Owner' || u.role === 'Admin' || u.role === 'Supervisor').length;
  const staffCount = totalActiveEmployees - managerCount;

  // Attendance today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAtts = attendances.filter(a => a.branchId === currentBranchId && a.clockIn.startsWith(todayStr));
  const uniqueAttendeesToday = new Set(todayAtts.map(a => a.userId));
  const attendancePercentageToday = totalActiveEmployees > 0 
    ? Math.round((uniqueAttendeesToday.size / totalActiveEmployees) * 100) 
    : 0;
  const lateCheckinsToday = todayAtts.filter(a => a.status === 'Late').length;

  // Payroll expenditures this month
  const currentMonthStr = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  const thisMonthPayslips = payslips.filter(p => p.branchId === currentBranchId && p.month === currentMonthStr);
  const totalPayrollExpense = thisMonthPayslips.reduce((sum, p) => sum + p.netSalary, 0);

  // Generate 7-day attendance trend data for this branch
  const getHrChartData = () => {
    const daysShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const result = [];
    const totalActive = activeEmployees.length;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = daysShort[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];

      const dayAtts = attendances.filter(a => a.branchId === currentBranchId && a.clockIn.startsWith(dateStr));
      const attendedUserIds = new Set(dayAtts.map(a => a.userId));
      const percent = totalActive > 0 ? Math.round((attendedUserIds.size / totalActive) * 100) : 0;

      result.push({
        label: `${dayName} (${d.getDate()}/${d.getMonth() + 1})`,
        value: percent,
        count: attendedUserIds.size,
        tooltip: `${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}: ${percent}% Kehadiran (${attendedUserIds.size} dari ${totalActive} staf)`
      });
    }
    return result;
  };

  const hrChartData = getHrChartData();
  const maxHrValue = 100; // attendance is percentage
  
  // Compute coordinates for HR SVG line chart
  const hrPoints = hrChartData.map((d, idx) => {
    const x = hrChartData.length > 1 ? 25 + (idx / (hrChartData.length - 1)) * 550 : 300;
    const y = 180 - (d.value / maxHrValue) * 150;
    return { x, y, ...d, index: idx };
  });

  const hrLinePath = hrPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const hrAreaPath = hrPoints.length > 0
    ? `${hrLinePath} L ${hrPoints[hrPoints.length - 1].x} 185 L ${hrPoints[0].x} 185 Z`
    : '';

  // Helper function to resolve Employee names by ID
  const getEmployeeName = (id: string) => {
    const found = employees.find(u => u.id === id);
    return found ? found.name : 'Unknown Employee';
  };

  const getEmployeeRole = (id: string) => {
    const found = employees.find(u => u.id === id);
    return found ? found.role : 'Staff';
  };

  return (
    <div className="space-y-6">
      {/* Title & Branch Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard Analisis</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ringkasan aktivitas bisnis, metrik performa toko, dan analisis kepegawaian.</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-500 bg-white dark:bg-slate-900 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 print:hidden">
          <Store size={14} className="text-orange-500 animate-pulse" />
          <span>Cabang: <strong className="text-orange-500 font-sans">{branches.find(b => b.id === currentBranchId)?.name}</strong></span>
        </div>
      </div>

      {/* Tab Switcher - Premium Toggle */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 print:hidden">
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-2.5 px-5 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'sales'
              ? 'border-orange-500 text-orange-500 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <TrendingUp size={14} />
          Analisis POS & Retail
        </button>
        <button
          onClick={() => setActiveTab('hr')}
          className={`pb-2.5 px-5 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'hr'
              ? 'border-orange-500 text-orange-500 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Users size={14} />
          Analisis Kepegawaian, Kehadiran & Payroll (HR)
        </button>
      </div>

      {activeTab === 'sales' ? (
        <>
          {/* Metric Cards Row (Sales/Retail) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            {/* Card 1: Revenue */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Penjualan Hari Ini</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Rp {todaySalesRevenue.toLocaleString('id-ID')}
                </h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="text-emerald-500 flex items-center gap-0.5 font-bold"><ArrowUpRight size={10} /> +8.2%</span> dari kemarin
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-inner">
                <TrendingUp size={20} />
              </div>
            </div>

            {/* Card 2: Profit */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Laba Hari Ini (Estimasi)</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Rp {todayProfit.toLocaleString('id-ID')}
                </h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="text-emerald-500 flex items-center gap-0.5 font-bold"><ArrowUpRight size={10} /> +12.4%</span> margin {todaySalesRevenue > 0 ? Math.round((todayProfit / todaySalesRevenue) * 100) : 0}%
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                <Percent size={20} />
              </div>
            </div>

            {/* Card 3: Total Sales Transactions */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Transaksi (Selesai/Total)</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {completedTransactionsCount} / {totalTransactionsCount}
                </h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="text-orange-500 flex items-center gap-0.5 font-bold">{branchSales.filter(s => s.status === 'Void').length} Void</span> &bull; {branchSales.filter(s => s.status === 'Refunded').length} Refund
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                <ShoppingBag size={20} />
              </div>
            </div>

            {/* Card 4: CRM Active Customer */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Total Customer (Member)</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {totalCustomersCount} Member
                </h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  Level Platinum terbanyak &bull; 100% Aktif
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner">
                <Users size={20} />
              </div>
            </div>
          </div>

          {/* Main Charts & Analytics Block */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            {/* Interactive Sales Revenue Graph Widget */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-orange-500" />
                      {chartFilterType === 'weekly' && 'Grafik Penjualan Mingguan'}
                      {chartFilterType === 'monthly' && 'Grafik Penjualan Bulanan'}
                      {chartFilterType === 'custom' && 'Grafik Penjualan Range Tanggal'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {chartFilterType === 'weekly' && 'Akumulasi transaksi selesai dalam 7 hari terakhir (realtime).'}
                      {chartFilterType === 'monthly' && 'Akumulasi harian untuk bulan kalender yang dipilih.'}
                      {chartFilterType === 'custom' && 'Akumulasi harian berdasarkan rentang tanggal khusus.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[9px] uppercase font-mono font-black text-emerald-500">
                      Realtime Sync
                    </span>
                  </div>
                </div>

                {/* Filter Toolbar Area */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-150 dark:border-slate-850/60 mt-3">
                  <div className="flex items-center bg-slate-200/60 dark:bg-slate-900 p-1 rounded-lg border border-slate-250 dark:border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setChartFilterType('weekly')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        chartFilterType === 'weekly'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Mingguan
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartFilterType('monthly')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        chartFilterType === 'monthly'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Bulanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartFilterType('custom')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                        chartFilterType === 'custom'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Range Tanggal
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {chartFilterType === 'monthly' && (
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-450 dark:text-slate-500" />
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-0.5 text-[10px] font-sans font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, idx) => (
                            <option key={idx} value={idx}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-0.5 text-[10px] font-sans font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          {[2025, 2026, 2027].map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {chartFilterType === 'custom' && (
                      <div className="flex items-center gap-1">
                        <Filter size={11} className="text-slate-450" />
                        <input
                          type="date"
                          value={startDateStr}
                          onChange={(e) => setStartDateStr(e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <span className="text-[9px] text-slate-400 font-bold">s/d</span>
                        <input
                          type="date"
                          value={endDateStr}
                          onChange={(e) => setEndDateStr(e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Interactive Line Chart */}
                {chartData.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                    <Calendar size={24} className="text-slate-300 dark:text-slate-700 mb-1.5 animate-pulse" />
                    <p className="font-bold">Tidak Ada Data Penjualan</p>
                    <p className="text-[10px] text-slate-450">Silakan pilih tanggal atau filter yang valid.</p>
                  </div>
                ) : (
                  <div className="h-56 flex flex-col justify-between mt-4">
                    <div className="w-full h-44 relative">
                      <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#f43f5e" />
                          </linearGradient>
                          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#f97316" stopOpacity="0.00" />
                          </linearGradient>
                        </defs>

                        <line x1="20" y1="30" x2="580" y2="30" stroke="currentColor" className="text-slate-100 dark:text-slate-800/40" strokeDasharray="3 3" />
                        <line x1="20" y1="80" x2="580" y2="80" stroke="currentColor" className="text-slate-100 dark:text-slate-800/40" strokeDasharray="3 3" />
                        <line x1="20" y1="130" x2="580" y2="130" stroke="currentColor" className="text-slate-100 dark:text-slate-800/40" strokeDasharray="3 3" />
                        <line x1="20" y1="180" x2="580" y2="180" stroke="currentColor" className="text-slate-200 dark:text-slate-800/80" strokeWidth="1" />

                        {areaPath && (
                          <path d={areaPath} fill="url(#area-grad)" className="transition-all duration-300" />
                        )}

                        {linePath && (
                          <path d={linePath} fill="none" stroke="url(#line-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
                        )}

                        {points.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIndex === idx ? "5" : "3"}
                            className={`transition-all duration-300 ${
                              hoveredIndex === idx
                                ? 'fill-orange-500 stroke-white dark:stroke-slate-900 stroke-2'
                                : 'fill-white dark:fill-slate-900 stroke-orange-500 stroke-[1.5]'
                            }`}
                          />
                        ))}

                        {hoveredIndex !== null && points[hoveredIndex] && (
                          <g>
                            <line
                              x1={points[hoveredIndex].x}
                              y1="30"
                              x2={points[hoveredIndex].x}
                              y2="180"
                              stroke="#f97316"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                              className="opacity-60 dark:opacity-45"
                            />
                            <circle
                              cx={points[hoveredIndex].x}
                              cy={points[hoveredIndex].y}
                              r="8"
                              className="fill-orange-500/20 stroke-orange-500/30 animate-ping"
                            />
                          </g>
                        )}
                      </svg>

                      <div className="absolute inset-0 flex items-stretch">
                        {points.map((p, idx) => (
                          <div
                            key={idx}
                            className="flex-1 relative cursor-pointer"
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                          >
                            <div
                              className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 transition-all duration-200 origin-bottom whitespace-nowrap text-center space-y-0.5 pointer-events-none z-30 ${
                                hoveredIndex === idx ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                              }`}
                            >
                              <div className="bg-slate-950 dark:bg-slate-900 border border-slate-800 dark:border-slate-700 text-white font-sans text-[10px] rounded-lg py-1.5 px-3 shadow-xl">
                                <p className="text-[8px] font-mono text-orange-400 font-black tracking-wider uppercase">LAPORAN REVENUE</p>
                                <p className="font-bold">{p.tooltip}</p>
                              </div>
                              <div className="w-2 h-2 bg-slate-950 dark:bg-slate-900 border-r border-b border-slate-850 dark:border-slate-750 rotate-45 mx-auto -mt-1 shadow-sm"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 select-none border-t border-slate-100 dark:border-slate-800/60">
                      {points.map((p, idx) => {
                        const isLabelVisible =
                          points.length <= 10
                            ? true
                            : points.length <= 15
                            ? idx % 2 === 0
                            : points.length <= 31
                            ? idx % 4 === 0 || idx === points.length - 1
                            : idx % 7 === 0 || idx === points.length - 1;

                        return (
                          <div key={idx} className="flex-1 text-center">
                            <span className="text-[8px] sm:text-[9px] text-slate-400 dark:text-slate-500 font-mono font-medium block truncate px-0.5">
                              {isLabelVisible ? p.label : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-150 dark:border-slate-850/60 text-slate-700 dark:text-slate-300 font-sans">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Total Penjualan</span>
                  <p className="text-xs font-black text-slate-850 dark:text-white truncate">
                    Rp {totalFilteredRevenue.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="space-y-0.5 border-l border-slate-200 dark:border-slate-800 pl-3.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Rata-rata Harian</span>
                  <p className="text-xs font-black text-slate-850 dark:text-white truncate">
                    Rp {avgFilteredRevenue.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="space-y-0.5 border-l border-slate-200 dark:border-slate-800 pl-3.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Penjualan Puncak</span>
                  <p className="text-xs font-black text-orange-500 truncate">
                    Rp {Math.max(...chartData.map(d => d.value), 0).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>

            {/* Top Product Chart Mockup */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Produk Terlaris</h4>
                {topSellingProducts.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <p>Belum ada data penjualan tercatat.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {topSellingProducts.map((prod, idx) => {
                      const percent = Math.min(100, Math.round((prod.qty / topSellingProducts[0].qty) * 100));
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{prod.name}</span>
                            <span className="font-mono font-bold text-orange-500">{prod.qty} Pcs</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${percent}%` }}
                              className={`h-full rounded-full ${
                                idx === 0 ? 'bg-orange-500' : idx === 1 ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-4 border-t border-slate-100 dark:border-slate-800 pt-3.5 flex items-center justify-between">
                <span>Berdasarkan cabang aktif</span>
                <span className="text-emerald-500 font-bold">Menu Terfavorit: {topSellingProducts[0]?.name || '-'}</span>
              </div>
            </div>
          </div>

          {/* Alerts and Low Stock Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            {/* Stock Alerts Panel */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500 animate-bounce" />
                  Peringatan Stok Minimum (Gudang & Bahan Baku)
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold">
                  {stockWarnings.length} Alert
                </span>
              </div>

              {stockWarnings.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  <CheckCircle size={24} className="text-emerald-500 mb-2" />
                  <p className="font-medium text-slate-850 dark:text-slate-200">Semua stok aman!</p>
                  <p className="text-[10px]">Seluruh stok bahan baku dan produk jadi berada di atas batas minimum.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                        <th className="pb-2 font-medium">Bahan/Produk</th>
                        <th className="pb-2 font-medium">Gudang</th>
                        <th className="pb-2 font-medium text-right">Stok Saat Ini</th>
                        <th className="pb-2 font-medium text-right">Batas Min</th>
                        <th className="pb-2 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {stockWarnings.map((warn, idx) => {
                        const isCrit = warn.quantity <= warn.minStock / 2;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 font-medium text-slate-850 dark:text-slate-150">{warn.product.name}</td>
                            <td className="py-2.5 text-slate-500">{warn.warehouse.name}</td>
                            <td className="py-2.5 text-right font-mono font-bold text-red-500">{warn.quantity}</td>
                            <td className="py-2.5 text-right font-mono text-slate-500">{warn.minStock}</td>
                            <td className="py-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                                isCrit
                                  ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse'
                                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {isCrit ? 'CRITICAL' : 'REFILL'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Activities Panel */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  Aktivitas Penjualan Terkini
                </h4>
                {recentSales.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <p>Belum ada aktivitas penjualan.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentSales.map((sale, idx) => {
                      const paymentLabels: Record<string, string> = {
                        'Cash': 'Tunai',
                        'QRIS': 'QRIS',
                        'Bank Transfer': 'Transfer',
                        'E-Wallet': 'E-Wallet',
                        'Split': 'Split'
                      };
                      return (
                        <div key={idx} className="flex items-start justify-between border-b border-slate-50 dark:border-slate-800/50 pb-3 last:border-0 last:pb-0">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-850 dark:text-slate-150">{sale.invoiceNo}</p>
                            <p className="text-[10px] text-slate-400">{new Date(sale.createdAt).toLocaleTimeString('id-ID')} &bull; {paymentLabels[sale.paymentMethod]}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">Rp {sale.totalAmount.toLocaleString('id-ID')}</p>
                            <span className={`inline-block text-[9px] font-mono px-1.5 rounded ${
                              sale.status === 'Completed'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : sale.status === 'Refunded'
                                ? 'bg-blue-500/10 text-blue-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {sale.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3.5 text-center">
                Membaca data realtime database local
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* HR & PAYROLL ANALYSIS VIEW CONTENT */}
          {/* HR Metric Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            {/* Card 1: Total Karyawan Aktif */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Total Karyawan Aktif</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {totalActiveEmployees} Pegawai
                </h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="text-emerald-500 font-bold">{managerCount} Manajemen</span> &bull; {staffCount} Staf
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                <Users size={20} />
              </div>
            </div>

            {/* Card 2: Kehadiran Hari Ini */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Kehadiran Hari Ini</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {attendancePercentageToday}%
                </h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="text-emerald-500 font-bold">{uniqueAttendeesToday.size} Staf</span> dari {totalActiveEmployees} hadir hari ini
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                <UserCheck size={20} />
              </div>
            </div>

            {/* Card 3: Total Pengeluaran Payroll */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Total Pengeluaran Gaji</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Rp {totalPayrollExpense.toLocaleString('id-ID')}
                </h3>
                <p className="text-[10px] text-slate-400">
                  Rilis Slip Bulan: <strong className="text-orange-500 font-sans">{currentMonthStr}</strong>
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-inner">
                <DollarSign size={20} />
              </div>
            </div>

            {/* Card 4: Keterlambatan Hari Ini */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400">Terlambat Hari Ini</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lateCheckinsToday} Staf
                </h3>
                <p className="text-[10px] text-slate-500">
                  {lateCheckinsToday > 0 ? 'Denda dikoordinasikan ke Payroll' : 'Tingkat kedisiplinan optimal'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shadow-inner">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* HR Charts & Bento Block */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            {/* Weekly Attendance Trend Card */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Users size={16} className="text-orange-500" />
                      Grafik Kehadiran Mingguan
                    </h4>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Rata-rata kehadiran staf dalam 7 hari terakhir berdasarkan data check-in harian.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                    <span className="text-[9px] uppercase font-mono font-black text-orange-500">
                      Attendance Sync
                    </span>
                  </div>
                </div>

                {/* SVG Attendance Chart */}
                <div className="h-56 flex flex-col justify-between mt-4">
                  <div className="w-full h-44 relative">
                    <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="hr-line-grad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f43f5e" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                        <linearGradient id="hr-area-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#f97316" stopOpacity="0.00" />
                        </linearGradient>
                      </defs>

                      <line x1="20" y1="30" x2="580" y2="30" stroke="currentColor" className="text-slate-100 dark:text-slate-800/40" strokeDasharray="3 3" />
                      <line x1="20" y1="80" x2="580" y2="80" stroke="currentColor" className="text-slate-100 dark:text-slate-800/40" strokeDasharray="3 3" />
                      <line x1="20" y1="130" x2="580" y2="130" stroke="currentColor" className="text-slate-100 dark:text-slate-800/40" strokeDasharray="3 3" />
                      <line x1="20" y1="180" x2="580" y2="180" stroke="currentColor" className="text-slate-200 dark:text-slate-800/80" strokeWidth="1" />

                      {hrAreaPath && (
                        <path d={hrAreaPath} fill="url(#hr-area-grad)" className="transition-all duration-300" />
                      )}

                      {hrLinePath && (
                        <path d={hrLinePath} fill="none" stroke="url(#hr-line-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
                      )}

                      {hrPoints.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={hoveredHrIndex === idx ? "5" : "3"}
                          className={`transition-all duration-300 ${
                            hoveredHrIndex === idx
                              ? 'fill-orange-500 stroke-white dark:stroke-slate-900 stroke-2'
                              : 'fill-white dark:fill-slate-900 stroke-orange-500 stroke-[1.5]'
                          }`}
                        />
                      ))}

                      {hoveredHrIndex !== null && hrPoints[hoveredHrIndex] && (
                        <g>
                          <line
                            x1={hrPoints[hoveredHrIndex].x}
                            y1="30"
                            x2={hrPoints[hoveredHrIndex].x}
                            y2="180"
                            stroke="#f97316"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                            className="opacity-60 dark:opacity-45"
                          />
                          <circle
                            cx={hrPoints[hoveredHrIndex].x}
                            cy={hrPoints[hoveredHrIndex].y}
                            r="8"
                            className="fill-orange-500/20 stroke-orange-500/30 animate-ping"
                          />
                        </g>
                      )}
                    </svg>

                    <div className="absolute inset-0 flex items-stretch">
                      {hrPoints.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex-1 relative cursor-pointer"
                          onMouseEnter={() => setHoveredHrIndex(idx)}
                          onMouseLeave={() => setHoveredHrIndex(null)}
                        >
                          <div
                            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 transition-all duration-200 origin-bottom whitespace-nowrap text-center space-y-0.5 pointer-events-none z-30 ${
                              hoveredHrIndex === idx ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                            }`}
                          >
                            <div className="bg-slate-950 dark:bg-slate-900 border border-slate-800 dark:border-slate-700 text-white font-sans text-[10px] rounded-lg py-1.5 px-3 shadow-xl">
                              <p className="text-[8px] font-mono text-orange-400 font-black tracking-wider uppercase">LOG KEHADIRAN</p>
                              <p className="font-bold">{p.tooltip}</p>
                            </div>
                            <div className="w-2 h-2 bg-slate-950 dark:bg-slate-900 border-r border-b border-slate-850 dark:border-slate-750 rotate-45 mx-auto -mt-1 shadow-sm"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 select-none border-t border-slate-100 dark:border-slate-800/60">
                    {hrPoints.map((p, idx) => (
                      <div key={idx} className="flex-1 text-center">
                        <span className="text-[8px] sm:text-[9px] text-slate-400 dark:text-slate-500 font-mono font-medium block truncate px-0.5">
                          {p.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-150 dark:border-slate-850/60 text-slate-700 dark:text-slate-300 font-sans">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Target Kehadiran</span>
                  <p className="text-xs font-black text-slate-850 dark:text-white truncate">100% Optimal</p>
                </div>
                <div className="space-y-0.5 border-l border-slate-200 dark:border-slate-800 pl-3.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Rata-Rata Kehadiran</span>
                  <p className="text-xs font-black text-slate-850 dark:text-white truncate">
                    {hrChartData.length > 0 ? Math.round(hrChartData.reduce((s, d) => s + d.value, 0) / hrChartData.length) : 0}%
                  </p>
                </div>
                <div className="space-y-0.5 border-l border-slate-200 dark:border-slate-800 pl-3.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Tren Terendah</span>
                  <p className="text-xs font-black text-red-500 truncate">
                    {hrChartData.length > 0 ? Math.min(...hrChartData.map(d => d.value)) : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Payslips (col-span-1) */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Slip Gaji Terbit Bulan Ini</h4>
                {thisMonthPayslips.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <p className="font-bold">Belum Ada Slip Gaji</p>
                    <p className="text-[10px] text-slate-450 text-center px-4">Silakan terbitkan slip gaji di menu HR & Payroll.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {thisMonthPayslips.slice(0, 4).map((slip: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-150 truncate">{getEmployeeName(slip.userId)}</p>
                          <p className="text-[10px] text-slate-400 truncate">{slip.month} &bull; {getEmployeeRole(slip.userId)}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1 shrink-0">
                          <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">Rp {slip.netSalary.toLocaleString('id-ID')}</p>
                          <button
                            onClick={() => setActiveDashboardPayslip(slip)}
                            className="py-0.5 px-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded text-[8px] tracking-wider uppercase transition-colors cursor-pointer"
                          >
                            Cetak
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-4 border-t border-slate-100 dark:border-slate-800 pt-3.5 flex items-center justify-between">
                <span>Rangkuman bulan berjalan</span>
                <span className="text-emerald-500 font-bold">{thisMonthPayslips.length} Slip Rilis</span>
              </div>
            </div>
          </div>

          {/* Bottom Row - Attendance Log and active Shift */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            {/* Today's Attendances list */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck size={16} className="text-emerald-500" />
                  Log Absensi Hari Ini (Realtime)
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold">
                  {todayAtts.length} Staf Mengabsen
                </span>
              </div>

              {todayAtts.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  <p className="font-medium text-slate-800 dark:text-slate-200">Tidak ada absensi terdaftar hari ini</p>
                  <p className="text-[10px] text-slate-450 mt-1">Lakukan check-in/out karyawan di halaman HR, Absensi & Payroll.</p>
                </div>
              ) : (
                <DashboardAttendanceTable
                  todayAtts={todayAtts}
                  getEmployeeName={getEmployeeName}
                />
              )}
            </div>

            {/* Shift settings */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-slate-450" />
                  Ketentuan Shift Kerja Cabang
                </h4>
                <div className="space-y-4 font-sans">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-xl text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Jam Masuk Toleransi:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-100">09:00 WIB</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Jam Mulai Pulang:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-100">17:00 WIB</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Hari Kerja Aktif:</span>
                      <strong className="text-slate-800 dark:text-slate-100">Senin - Sabtu (6 Hari)</strong>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed italic text-center">
                    "Sistem denda keterlambatan Rp 50.000 per hari dihitung otomatis saat pembuatan slip gaji."
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3.5 text-center font-bold text-orange-500">
                Data Absensi Terkunci & Aman
              </div>
            </div>
          </div>
        </>
      )}

      {/* Active Dashboard Payslip modal for premium print-ready display */}
      <DashboardPayslipModal
        payslip={activeDashboardPayslip}
        onClose={() => setActiveDashboardPayslip(null)}
        getEmployeeName={getEmployeeName}
        getEmployeeRole={getEmployeeRole}
      />
    </div>
  );
}
