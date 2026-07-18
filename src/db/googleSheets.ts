/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAccessToken } from './firebase';

export const SHEET_KEYS = [
  'erp_users',
  'erp_branches',
  'erp_warehouses',
  'erp_customers',
  'erp_suppliers',
  'erp_categories',
  'erp_units',
  'erp_racks',
  'erp_products',
  'erp_stocks',
  'erp_movements',
  'erp_boms',
  'erp_production_logs',
  'erp_purchase_orders',
  'erp_sales',
  'erp_vouchers',
  'erp_finance_ledgers',
  'erp_employees',
  'erp_attendance',
  'erp_payroll',
  'erp_audit_logs',
  'erp_settings',
  'erp_role_permissions',
  'erp_attendances',
  'erp_payslips'
];

/**
 * Convert JSON array to Google Sheet rows (2D array)
 */
export function jsonToRows(data: any[]): any[][] {
  if (!Array.isArray(data) || data.length === 0) {
    return [["_empty_"]];
  }
  
  const allKeysSet = new Set<string>();
  data.forEach(item => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(k => allKeysSet.add(k));
    }
  });
  
  const headers = Array.from(allKeysSet);
  if (headers.length === 0) {
    return [["_empty_"]];
  }

  const rows = [headers];
  data.forEach(item => {
    const row = headers.map(header => {
      const val = item[header];
      if (val === undefined || val === null) {
        return "";
      }
      if (typeof val === 'object' || Array.isArray(val)) {
        return JSON.stringify(val);
      }
      return val;
    });
    rows.push(row);
  });
  return rows;
}

/**
 * Convert Google Sheet rows (2D array) back to JSON array of objects
 */
export function rowsToJson(rows: any[][]): any[] {
  if (!Array.isArray(rows) || rows.length < 1) return [];
  const headers = rows[0];
  if (headers.length === 1 && headers[0] === "_empty_") return [];
  
  const result: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj: any = {};
    headers.forEach((header, colIndex) => {
      let val = row[colIndex];
      if (val === undefined || val === null || val === "") {
        return;
      }
      
      const valStr = String(val).trim();
      if ((valStr.startsWith('{') && valStr.endsWith('}')) || (valStr.startsWith('[') && valStr.endsWith(']'))) {
        try {
          val = JSON.parse(valStr);
        } catch (e) {
          // Keep as string
        }
      } else if (valStr === 'true') {
        val = true;
      } else if (valStr === 'false') {
        val = false;
      } else if (!isNaN(Number(valStr)) && valStr !== '') {
        val = Number(valStr);
      }
      
      obj[header] = val;
    });
    result.push(obj);
  }
  return result;
}

/**
 * Create a new spreadsheet inside the user's Drive and initialize all sheets
 */
export async function createDatabaseSpreadsheet(token: string): Promise<string> {
  // 1. Create a spreadsheet named "FB ERP Database"
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'FB ERP System Database'
      }
    })
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal membuat spreadsheet baru: ${createRes.statusText}`);
  }

  const ss = await createRes.json();
  const spreadsheetId = ss.spreadsheetId;

  // 2. Add tabs for all tables in a batch update
  const requests = SHEET_KEYS.map(key => ({
    addSheet: {
      properties: {
        title: key
      }
    }
  }));

  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!updateRes.ok) {
    console.error('Failed to create tabs, but spreadsheet is created:', spreadsheetId);
  }

  return spreadsheetId;
}

/**
 * Writes a full collection to a specific tab/sheet
 */
export async function writeCollectionToSheet(token: string, spreadsheetId: string, sheetName: string, data: any[]): Promise<void> {
  const rows = jsonToRows(data);
  const range = `${sheetName}!A1`;

  // First, clear existing content on the tab
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z10000:clear`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // Now, update values
  const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: rows
    })
  });

  if (!writeRes.ok) {
    const err = await writeRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal menulis data ke tab ${sheetName}`);
  }
}

/**
 * Reads a collection from a specific tab/sheet
 */
export async function readCollectionFromSheet(token: string, spreadsheetId: string, sheetName: string): Promise<any[]> {
  const range = `${sheetName}!A1:Z10000`;
  const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!readRes.ok) {
    const err = await readRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal membaca data dari tab ${sheetName}`);
  }

  const data = await readRes.json();
  return rowsToJson(data.values || []);
}

/**
 * Push all local data into Google Sheets
 */
export async function pushAllLocalDataToSheets(token: string, spreadsheetId: string, onProgress?: (percent: number, currentTable: string) => void): Promise<void> {
  for (let i = 0; i < SHEET_KEYS.length; i++) {
    const key = SHEET_KEYS[i];
    if (onProgress) {
      onProgress(Math.round((i / SHEET_KEYS.length) * 100), key);
    }
    const localDataStr = localStorage.getItem(key);
    const localData = localDataStr ? JSON.parse(localDataStr) : [];
    await writeCollectionToSheet(token, spreadsheetId, key, localData);
  }
  if (onProgress) {
    onProgress(100, 'Selesai');
  }
}

/**
 * Pull all data from Google Sheets into local storage & Firebase
 */
export async function pullAllDataFromSheets(token: string, spreadsheetId: string, onProgress?: (percent: number, currentTable: string) => void): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  for (let i = 0; i < SHEET_KEYS.length; i++) {
    const key = SHEET_KEYS[i];
    if (onProgress) {
      onProgress(Math.round((i / SHEET_KEYS.length) * 100), key);
    }
    try {
      const data = await readCollectionFromSheet(token, spreadsheetId, key);
      result[key] = data;
    } catch (e) {
      console.warn(`Gagal memuat key ${key} dari Google Sheet (mungkin tab belum diisi):`, e);
    }
  }
  if (onProgress) {
    onProgress(100, 'Selesai');
  }
  return result;
}
