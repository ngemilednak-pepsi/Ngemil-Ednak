import React from 'react';

export interface AttendanceRecord {
  userId: string;
  clockIn: string;
  clockOut: string | null;
  status: string;
}

interface DashboardAttendanceTableProps {
  todayAtts: AttendanceRecord[];
  getEmployeeName: (userId: string) => string;
}

export default function DashboardAttendanceTable({
  todayAtts,
  getEmployeeName,
}: DashboardAttendanceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
            <th className="pb-2 font-medium">Nama Karyawan</th>
            <th className="pb-2 font-medium">Jam Masuk</th>
            <th className="pb-2 font-medium">Jam Keluar</th>
            <th className="pb-2 font-medium text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {todayAtts.map((att, idx) => (
            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="py-2.5 font-medium text-slate-850 dark:text-slate-150">
                {getEmployeeName(att.userId)}
              </td>
              <td className="py-2.5 font-mono text-slate-500">
                {att.clockIn
                  ? new Date(att.clockIn).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'}
              </td>
              <td className="py-2.5 font-mono text-slate-500">
                {att.clockOut
                  ? new Date(att.clockOut).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'}
              </td>
              <td className="py-2.5 text-center">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                    att.status === 'Hadir'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : att.status === 'Terlambat'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : att.status === 'Izin'
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}
                >
                  {att.status.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
