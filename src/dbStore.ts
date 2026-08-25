/**
 * Database store module using localStorage with real-time defaults and Supabase structure mapping
 */

import { Contract, Disbursement, ScheduledPayment, Repayment, SystemParameters, DailyAccruedInterest } from './types';
import { generateInitialSchedule, calculatePrepaidDisbursement, auditAndApplyOverdueState, allocateHorizontalPayment, addMonths, recalculateFutureSchedules, getExpectedDueDate, getStoredParameters } from './financialEngine';
import { getSupabaseClient, getSavedSupabaseConfig } from './supabaseClient';
import { autoPushItem } from './supabaseSync';
import { parseScheduledPaymentsCSV } from './utils/csvParser';
import { PROVIDED_SCHEDULES_CSV } from './data/providedSchedules';

// Default initial date defaults to 2026-05-22
export function getSystemDate(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('lms_system_date') || '2026-05-22';
  }
  return '2026-05-22';
}

export function saveSystemDate(dateStr: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lms_system_date', dateStr);
    runDailyAudit();
  }
}


// 1. Initial Default Contracts
const DEFAULT_CONTRACTS: Contract[] = [
  {
    id: 'HP-2026-0001',
    customerName: 'นายพูนศักดิ์ รุ่งเรือง (Somyot Truck)',
    customerTaxId: '3101294829103',
    customerPhone: '081-234-5678',
    customerAddress: '99/5 หมู่ 4 ถนนสุวรรณศร ตำบลเมืองเก่า อำเภอกบินทร์บุรี จังหวัดปราจีนบุรี 25110',
    productType: 'HP',
    creditLimit: 120000,
    interestRate: 8,
    startDate: '2026-01-05',
    termMonths: 12,
    dueDay: 5,
    paymentFrequency: 'MONTHLY',
    serviceFee: 0,
    treeCutOption: false,
    disbursedAmount: 120000,
    outstandingPrincipal: 94073.48,
    status: 'DEFAULT',
    createdAt: '2026-01-05T00:00:00Z'
  },
  {
    id: 'LN-2026-0002',
    customerName: 'นางสาวสิริมา ประเสริฐดี',
    customerTaxId: '4221008273641',
    customerPhone: '089-876-5432',
    customerAddress: '123/4 ซอยลาดพร้าว 101 แขวงคลองเจ้าคุณสิงห์ เขตวังทองหลาง กรุงเทพมหานคร 10310',
    productType: 'LOAN',
    creditLimit: 80000,
    interestRate: 12,
    startDate: '2026-02-15',
    termMonths: 12,
    dueDay: 15,
    paymentFrequency: 'MONTHLY',
    serviceFee: 0,
    treeCutOption: false,
    disbursedAmount: 80000,
    outstandingPrincipal: 73625.03,
    status: 'ACTIVE',
    createdAt: '2026-02-15T00:00:00Z'
  },
  {
    id: 'LN-2026-0003',
    customerName: 'กลุ่มวิสาหกิจชุมชนปลูกป่า ท่าหลวง (กลุ่มปลูก)',
    customerTaxId: '0994002817264',
    customerPhone: '036-777-1111',
    customerAddress: 'กลุ่มวิสาหกิจชุมชนปลูกป่า ท่าหลวง หมู่ที่ 1 ตำบลท่าหลวง อำเภอท่าหลวง จังหวัดลพบุรี 15230',
    productType: 'LOAN',
    creditLimit: 130000,
    interestRate: 10,
    startDate: '2026-01-01',
    termMonths: 60,
    dueDay: 25,
    paymentFrequency: 'ANNUAL',
    serviceFee: 500, // Service fee full limit
    treeCutOption: true,
    plantingType: 'RESERVE',
    plantingAreaRai: 25,
    plantingTreeCount: 5000,
    plantingProvince: 'ลพบุรี',
    plantingDistrict: 'ท่าหลวง',
    plantingSubdistrict: 'ท่าหลวง',
    disbursedAmount: 4000, // 2000 + 2000 drawn in Year 1
    outstandingPrincipal: 4000,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'CT1-2500006',
    customerName: 'นายพูนศักดิ์ รุ่งเรือง (Somyot Truck)',
    customerTaxId: '3101294829103',
    customerPhone: '081-234-5678',
    customerAddress: '99/5 หมู่ 4 ถนนสุวรรณศร ตำบลเมืองเก่า อำเภอกบินทร์บุรี จังหวัดปราจีนบุรี 25110',
    productType: 'LOAN',
    creditLimit: 300000,
    interestRate: 12,
    startDate: '2026-01-05',
    firstPaymentDate: '2026-03-05',
    termMonths: 60,
    dueDay: 5,
    paymentFrequency: 'MONTHLY',
    serviceFee: 0,
    treeCutOption: false,
    disbursedAmount: 300000,
    outstandingPrincipal: 284340.28,
    status: 'ACTIVE',
    createdAt: '2026-01-05T00:00:00Z'
  }
];

// 2. Initial Disbursements
const DEFAULT_DISBURSEMENTS: Disbursement[] = [
  {
    id: 'DISB-0001',
    contractId: 'HP-2026-0001',
    amount: 120000,
    disburseDate: '2026-01-05',
    batchNumber: 1,
    upfrontInterest: 0,
    upfrontFee: 0,
    netReceived: 120000,
    description: 'เบิกจ่ายงวดแรกเต็มจำนวน สำหรับเช่าซื้อรถบรรทุกหกล้อ'
  },
  {
    id: 'DISB-0002',
    contractId: 'LN-2026-0002',
    amount: 80000,
    disburseDate: '2026-02-15',
    batchNumber: 1,
    upfrontInterest: 0,
    upfrontFee: 0,
    netReceived: 80000,
    description: 'เบิกครั้งเดียวเต็มจำนวน เงินกู้หมุนเวียนเกษตรกรรม'
  },
  {
    id: 'DISB-0003',
    contractId: 'LN-2026-0003',
    amount: 2000,
    disburseDate: '2026-01-01',
    batchNumber: 1,
    upfrontInterest: 200, // 2000 * 10% = 200 THB prepaid Year 1
    upfrontFee: 15.38, // 500 * (2000/13000) proportional fee
    netReceived: 1784.62,
    description: 'เบิกจ่ายงวดย่อยที่ 1 มัดจำค่าต้นกล้ายูคาลิปตัส 1/1/2026'
  },
  {
    id: 'DISB-0004',
    contractId: 'LN-2026-0003',
    amount: 2000,
    disburseDate: '2026-02-02',
    batchNumber: 2,
    upfrontInterest: 182.47, // 2000 * 10% * (333 days / 365) to 2027-01-01
    upfrontFee: 15.38,
    netReceived: 1802.15,
    description: 'เบิกจ่ายงวดย่อยที่ 2 หลังปลูกเสร็จเรียบร้อย 2/2/2026'
  },
  {
    id: 'DISB-0005',
    contractId: 'CT1-2500006',
    amount: 300000,
    disburseDate: '2026-01-05',
    batchNumber: 1,
    upfrontInterest: 0,
    upfrontFee: 0,
    netReceived: 300000,
    description: 'เบิกจ่ายงวดแรกเต็มจำนวน สัญญากู้เงินพูนศักดิ์'
  }
];

// 3. Initial Scheduled Payments (Pre-computed up to today, showing 2 terms paid, some overdue)
const generateInitialDefaultPayments = (): ScheduledPayment[] => {
  const allSchedules: ScheduledPayment[] = [];

  // HP-2026-0001: Monthly
  // PMT of HP 120000 over 12 mo @ 8% = ~10441.20 ExVat. InclVat = 11172.08
  const hpSchedule = generateInitialSchedule(DEFAULT_CONTRACTS[0], 120000, '2026-01-05');
  // Term 1 (due 2026-02-05) -> PAID on 2026-02-05
  hpSchedule[0].principalPaid = hpSchedule[0].principalDue;
  hpSchedule[0].interestPaid = hpSchedule[0].interestDue;
  hpSchedule[0].vatPaid = hpSchedule[0].vatDue;
  hpSchedule[0].totalPaid = hpSchedule[0].totalDue;
  hpSchedule[0].status = 'PAID';

  // Term 2 (due 2026-03-05) -> PAID on 2026-03-05
  hpSchedule[1].principalPaid = hpSchedule[1].principalDue;
  hpSchedule[1].interestPaid = hpSchedule[1].interestDue;
  hpSchedule[1].vatPaid = hpSchedule[1].vatDue;
  hpSchedule[1].totalPaid = hpSchedule[1].totalDue;
  hpSchedule[1].status = 'PAID';

  // Term 3 (due 2026-04-05) -> OVERDUE (unpaid)
  // Term 4 (due 2026-05-05) -> OVERDUE (unpaid)
  // Term 5 (due 2026-06-05) -> ACTIVE (not paid, near due)
  allSchedules.push(...hpSchedule);

  // LN-2026-0002: Monthly
  const lnSchedule = generateInitialSchedule(DEFAULT_CONTRACTS[1], 80000, '2026-02-15');
  // Term 1 (due 2026-03-15) -> PAID on 2026-03-15
  lnSchedule[0].principalPaid = lnSchedule[0].principalDue;
  lnSchedule[0].interestPaid = lnSchedule[0].interestDue;
  lnSchedule[0].totalPaid = lnSchedule[0].totalDue;
  lnSchedule[0].status = 'PAID';

  // Term 2 (due 2026-04-15) -> OVERDUE (unpaid)
  // Term 3 (due 2026-05-15) -> OVERDUE (unpaid)
  allSchedules.push(...lnSchedule);

  // LN-2026-0003: Annual PLOOK Group
  // Due Dates: 2027-01-01 (End of year 1, etc)
  const groupPlookSchedule = generateInitialSchedule(DEFAULT_CONTRACTS[2], 4000, '2026-01-01');
  allSchedules.push(...groupPlookSchedule);

  return allSchedules;
};

// 4. Initial Repayment entries
const DEFAULT_REPAYMENTS: Repayment[] = [
  {
    id: 'REPAY-0001',
    contractId: 'HP-2026-0001',
    paymentDate: '2026-02-05',
    amountPaid: 10438.56,
    receiptNo: 'RCP-2026-02-0001',
    appliedPenalty: 0,
    appliedTrackingFee: 0,
    appliedInterest: 747.66,
    appliedPrincipal: 9008.00,
    appliedVat: 682.90,
    distributionDetails: [
      { termNumber: 1, penalty: 0, trackingFee: 0, interest: 747.66, principal: 9008.00, vat: 682.90, total: 10438.56 }
    ],
    outstandingPrincipal: 103141.53,
    createdAt: '2026-02-05T08:30:00Z'
  },
  {
    id: 'REPAY-0002',
    contractId: 'HP-2026-0001',
    paymentDate: '2026-03-05',
    amountPaid: 10438.56,
    receiptNo: 'RCP-2026-03-0001',
    appliedPenalty: 0,
    appliedTrackingFee: 0,
    appliedInterest: 687.61,
    appliedPrincipal: 9068.05,
    appliedVat: 682.90,
    distributionDetails: [
      { termNumber: 2, penalty: 0, trackingFee: 0, interest: 687.61, principal: 9068.05, vat: 682.90, total: 10438.56 }
    ],
    outstandingPrincipal: 94073.48,
    createdAt: '2026-03-05T09:15:00Z'
  },
  {
    id: 'REPAY-0003',
    contractId: 'LN-2026-0002',
    paymentDate: '2026-03-15',
    amountPaid: 7111.41,
    receiptNo: 'RCP-2026-03-0002',
    appliedPenalty: 0,
    appliedTrackingFee: 0,
    appliedInterest: 736.44,
    appliedPrincipal: 6374.97,
    appliedVat: 0,
    distributionDetails: [
      { termNumber: 1, penalty: 0, trackingFee: 0, interest: 736.44, principal: 6374.97, vat: 0, total: 7111.41 }
    ],
    outstandingPrincipal: 73625.03,
    createdAt: '2026-03-15T11:00:00Z'
  }
];

export function isSandboxActive(): boolean {
  return localStorage.getItem('lms_sandbox_active') === 'true';
}

export function enterSandboxMode() {
  localStorage.setItem('lms_sandbox_active', 'true');
  resetSandboxData();
}

export function exitSandboxMode() {
  localStorage.setItem('lms_sandbox_active', 'false');
}

export function resetSandboxData() {
  localStorage.setItem('lms_sandbox_contracts', localStorage.getItem('lms_contracts') || JSON.stringify(DEFAULT_CONTRACTS));
  localStorage.setItem('lms_sandbox_disbursements', localStorage.getItem('lms_disbursements') || JSON.stringify(DEFAULT_DISBURSEMENTS));
  localStorage.setItem('lms_sandbox_statements', localStorage.getItem('lms_statements') || '[]');
  localStorage.setItem('lms_sandbox_repayments', localStorage.getItem('lms_repayments') || '[]');
  localStorage.setItem('lms_sandbox_parameters', localStorage.getItem('lms_parameters') || '');
}

export function getStorageKeys() {
  const active = isSandboxActive();
  return {
    contracts: active ? 'lms_sandbox_contracts' : 'lms_contracts',
    disbursements: active ? 'lms_sandbox_disbursements' : 'lms_disbursements',
    statements: active ? 'lms_sandbox_statements' : 'lms_statements',
    repayments: active ? 'lms_sandbox_repayments' : 'lms_repayments',
    parameters: active ? 'lms_sandbox_parameters' : 'lms_parameters',
    dailyAccruedInterests: active ? 'lms_sandbox_daily_accrued' : 'lms_daily_accrued_interests',
  };
}

export function initializeDB() {
  if (!localStorage.getItem('lms_parameters')) {
    const defaultParams: SystemParameters = {
      penaltyRate: 15,
      trackingFeeTier1: 50,
      trackingFeeTier2: 100,
      vatRate: 7
    };
    localStorage.setItem('lms_parameters', JSON.stringify(defaultParams));
  }
  if (!localStorage.getItem('lms_contracts')) {
    localStorage.setItem('lms_contracts', JSON.stringify(DEFAULT_CONTRACTS));
  }
  if (!localStorage.getItem('lms_disbursements')) {
    localStorage.setItem('lms_disbursements', JSON.stringify(DEFAULT_DISBURSEMENTS));
  }
  if (!localStorage.getItem('lms_statements')) {
    const rawPayments = generateInitialDefaultPayments();
    localStorage.setItem('lms_statements', JSON.stringify(rawPayments));
  }
  if (!localStorage.getItem('lms_repayments')) {
    localStorage.setItem('lms_repayments', JSON.stringify(DEFAULT_REPAYMENTS));
  }
}

export function getSystemParameters(): SystemParameters {
  const keys = getStorageKeys();
  const raw = localStorage.getItem(keys.parameters);
  if (raw) return JSON.parse(raw);
  return {
    penaltyRate: 15,
    trackingFeeTier1: 50,
    trackingFeeTier2: 100,
    vatRate: 7
  };
}

export function saveSystemParameters(params: SystemParameters) {
  const keys = getStorageKeys();
  localStorage.setItem(keys.parameters, JSON.stringify(params));
  runDailyAudit();
}

export function getContracts(): Contract[] {
  initializeDB();
  const keys = getStorageKeys();
  const list = JSON.parse(localStorage.getItem(keys.contracts) || '[]');
  let changed = false;
  const updated = list.map((c: any) => {
    if (!c.customerAddress) {
      const foundDef = DEFAULT_CONTRACTS.find(d => d.id === c.id);
      if (foundDef) {
        c.customerAddress = foundDef.customerAddress;
        changed = true;
      } else {
        c.customerAddress = '-';
        changed = true;
      }
    }
    return c;
  });
  if (changed) {
    localStorage.setItem(keys.contracts, JSON.stringify(updated));
  }
  return updated;
}

export function getDisbursements(): Disbursement[] {
  initializeDB();
  const keys = getStorageKeys();
  return JSON.parse(localStorage.getItem(keys.disbursements) || '[]');
}

export function getScheduledPayments(): ScheduledPayment[] {
  initializeDB();
  const keys = getStorageKeys();
  let list: ScheduledPayment[] = JSON.parse(localStorage.getItem(keys.statements) || '[]');
  const contracts: Contract[] = JSON.parse(localStorage.getItem(keys.contracts) || '[]');

  // Deduplicate schedules by contractId + termNumber
  const uniqueMap = new Map<string, ScheduledPayment>();
  list.forEach(s => {
    const cCid = (s.contractId || '').trim().toUpperCase();
    const key = `${cCid}_TERM_${s.termNumber}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, s);
    } else {
      const existing = uniqueMap.get(key)!;
      if (!existing.fromDb && s.fromDb) {
        uniqueMap.set(key, s);
      } else if (existing.fromDb && s.fromDb) {
        // If both are from DB, prefer the one with higher totalPaid or valid status
        if ((s.totalPaid || 0) > (existing.totalPaid || 0) || (existing.status === 'NOT_PAID' && s.status === 'PAID')) {
          uniqueMap.set(key, s);
        }
      }
    }
  });

  if (uniqueMap.size !== list.length) {
    list = Array.from(uniqueMap.values());
    localStorage.setItem(keys.statements, JSON.stringify(list));
  }

  let changed = false;

  // Sanitize only corrupt 'NaN' strings
  list.forEach(s => {
    const cCid = (s.contractId || '').trim().toUpperCase();
    const parentCon = contracts.find(c => (c.id || '').trim().toUpperCase() === cCid);
    
    if (s.dueDate && typeof s.dueDate === 'string' && s.dueDate.includes('NaN')) {
      if (parentCon) {
        const firstDisbDate = getFirstDisbursementDate(parentCon.id) || parentCon.firstDisburseDate;
        s.dueDate = getExpectedDueDate(parentCon, s.termNumber || 1, firstDisbDate);
      } else {
        s.dueDate = getSystemDate();
      }
      changed = true;
    }
  });

  // Ensure every contract has complete schedule terms (restore any missing terms from provided schedules or auto-generation)
  const providedParsed = parseScheduledPaymentsCSV(PROVIDED_SCHEDULES_CSV);
  contracts.forEach((c: Contract) => {
    const cCid = (c.id || '').trim().toUpperCase();
    const cSchedules = list.filter(s => (s.contractId || '').trim().toUpperCase() === cCid);
    const disburseAmt = c.disbursedAmount || c.creditLimit || 0;
    const disburseDate = getFirstDisbursementDate(c.id) || c.firstDisburseDate || c.startDate || getSystemDate();

    if (cSchedules.length === 0) {
      const rawSchedules = generateInitialSchedule(c, disburseAmt, disburseDate);
      list.push(...rawSchedules);
      changed = true;
    } else {
      // Check if any terms in sequence 1..termMonths (or max existing term) are missing from list
      const existingTermNumbers = new Set(cSchedules.map(s => s.termNumber));
      const maxTermInSchedules = Math.max(0, ...cSchedules.map(s => s.termNumber));
      const targetMaxTerm = Math.max(c.termMonths || 1, maxTermInSchedules);
      
      const contractProvided = providedParsed.filter(p => (p.contractId || '').trim().toUpperCase() === cCid);
      const fullGenerated = generateInitialSchedule(c, disburseAmt, disburseDate);

      for (let t = 1; t <= targetMaxTerm; t++) {
        if (!existingTermNumbers.has(t)) {
          const fromProvided = contractProvided.find(p => p.termNumber === t);
          const fromGenerated = fullGenerated.find(g => g.termNumber === t);
          const fallbackTerm: ScheduledPayment = fromProvided || fromGenerated || {
            id: `${c.id}-SCH-${t}`,
            contractId: c.id,
            termNumber: t,
            dueDate: getExpectedDueDate(c, t, disburseDate),
            principalDue: 0,
            interestDue: 0,
            vatDue: 0,
            penaltyDue: 0,
            trackingFeeDue: 0,
            totalDue: 0,
            principalPaid: 0,
            interestPaid: 0,
            vatPaid: 0,
            penaltyPaid: 0,
            trackingFeePaid: 0,
            totalPaid: 0,
            status: 'NOT_PAID',
            lastUpdated: getSystemDate()
          };

          list.push(fallbackTerm);
          existingTermNumbers.add(t);
          changed = true;
        }
      }
    }
  });

  if (changed) {
    list.sort((a, b) => a.termNumber - b.termNumber);
    localStorage.setItem(keys.statements, JSON.stringify(list));
  }

  return list;
}

export function getRepayments(): Repayment[] {
  initializeDB();
  const keys = getStorageKeys();
  const raw = localStorage.getItem(keys.repayments);
  let list: Repayment[] = raw ? JSON.parse(raw) : [];

  const seenIds = new Set<string>();
  let modified = false;

  const sanitizedList = list.map((r, idx) => {
    let currentId = r.id;
    if (!currentId || seenIds.has(currentId)) {
      let nextNum = idx + 1;
      let newId = `REPAY-${String(nextNum).padStart(4, '0')}`;
      while (seenIds.has(newId)) {
        nextNum++;
        newId = `REPAY-${String(nextNum).padStart(4, '0')}`;
      }
      currentId = newId;
      modified = true;
    }
    seenIds.add(currentId);
    return { ...r, id: currentId };
  });

  if (modified) {
    localStorage.setItem(keys.repayments, JSON.stringify(sanitizedList));
  }

  return sanitizedList;
}

export function getDailyAccruedInterests(contractId?: string): DailyAccruedInterest[] {
  initializeDB();
  const keys = getStorageKeys();
  const raw = localStorage.getItem(keys.dailyAccruedInterests);
  if (!raw) return [];
  try {
    const list: DailyAccruedInterest[] = JSON.parse(raw);
    if (contractId) {
      const cid = contractId.trim().toUpperCase();
      return list.filter(item => (item.contractId || '').trim().toUpperCase() === cid);
    }
    return list;
  } catch (e) {
    return [];
  }
}

export function saveScheduledPayments(schedules: ScheduledPayment[]) {
  const keys = getStorageKeys();
  localStorage.setItem(keys.statements, JSON.stringify(schedules));

  const client = getSupabaseClient();
  const config = getSavedSupabaseConfig();
  if (client && config.autoSync && !isSandboxActive()) {
    schedules.forEach(sch => {
      autoPushItem(client, 'scheduled_payments', sch);
    });
  }
}

export function clearAllAccruedInterest() {
  const schedules = getScheduledPayments();
  schedules.forEach(sch => {
    sch.accruedInterest = 0;
  });
  saveScheduledPayments(schedules);
}

export function saveDailyAccruedInterests(records: DailyAccruedInterest[]) {
  const keys = getStorageKeys();
  const key = keys.dailyAccruedInterests;
  const existing = getDailyAccruedInterests();
  const map = new Map<string, DailyAccruedInterest>();
  existing.forEach(r => map.set(r.id, r));
  records.forEach(r => map.set(r.id, r));
  const merged = Array.from(map.values());
  try {
    localStorage.setItem(key, JSON.stringify(merged));
  } catch (e) {
    console.warn('[LocalStorage Quota Warning] Exceeded storage limit when saving daily accrued interests:', e);
    try {
      const recent = merged.slice(-1000);
      localStorage.setItem(key, JSON.stringify(recent));
    } catch (e2) {
      console.warn('[LocalStorage Quota Warning] Fallback save failed:', e2);
    }
  }
}

export function getFirstDisbursementDate(contractId: string): string | null {
  const disbursements = getDisbursements();
  const conDisbs = disbursements.filter(d => (d.contractId || '').trim().toUpperCase() === (contractId || '').trim().toUpperCase());
  if (conDisbs.length > 0) {
    conDisbs.sort((a, b) => a.disburseDate.localeCompare(b.disburseDate));
    return conDisbs[0].disburseDate;
  }
  const contracts = getContracts();
  const con = contracts.find(c => (c.id || '').trim().toUpperCase() === (contractId || '').trim().toUpperCase());
  if (con && (con.firstDisburseDate || con.disburseDate)) {
    return con.firstDisburseDate || con.disburseDate || null;
  }
  return null;
}

/**
 * Audit defaults, recalculates daily accrued interest, Penalties and Collection tracking fees based on current system time
 */
export function runDailyAudit() {
  const keys = getStorageKeys();
  const rawContracts = localStorage.getItem(keys.contracts);
  const rawSchedules = localStorage.getItem(keys.statements);
  if (!rawContracts || !rawSchedules) return;

  const contracts: Contract[] = JSON.parse(rawContracts);
  let schedules: ScheduledPayment[] = JSON.parse(rawSchedules);
  const repayments: Repayment[] = JSON.parse(localStorage.getItem(keys.repayments) || '[]');
  const sysDate = getSystemDate();

  // Daily interest recalculation for active contracts up to sysDate
  contracts.forEach(con => {
    if (con.status === 'ACTIVE' || con.status === 'DEFAULT') {
      const disburseDate = getFirstDisbursementDate(con.id) || con.firstDisburseDate || con.startDate;
      schedules = recalculateFutureSchedules(con, schedules, sysDate, repayments, disburseDate);
    }
  });

  const { updatedSchedules, updatedContracts } = auditAndApplyOverdueState(schedules, contracts, sysDate);
  
  localStorage.setItem(keys.statements, JSON.stringify(updatedSchedules));
  localStorage.setItem(keys.contracts, JSON.stringify(updatedContracts));

  // Sync to Supabase if autoSync enabled
  const client = getSupabaseClient();
  const config = getSavedSupabaseConfig();
  if (client && config.autoSync && !isSandboxActive()) {
    updatedSchedules.forEach(sch => {
      autoPushItem(client, 'scheduled_payments', sch);
    });
  }
}

/**
 * Runs a full historical daily interest audit from contract start dates up to current system date.
 */
export function runHistoricalDailyAudit(): { updatedContractsCount: number; updatedSchedulesCount: number } {
  runDailyAudit();
  const keys = getStorageKeys();
  const rawContracts = localStorage.getItem(keys.contracts) || '[]';
  const rawSchedules = localStorage.getItem(keys.statements) || '[]';
  const contracts: Contract[] = JSON.parse(rawContracts);
  const schedules: ScheduledPayment[] = JSON.parse(rawSchedules);
  return {
    updatedContractsCount: contracts.length,
    updatedSchedulesCount: schedules.length
  };
}

/**
 * Imports scheduled payments from CSV text and ensures contract records exist.
 */
export function importScheduledPaymentsFromCSV(csvText: string, replaceMode: boolean = false): { importedCount: number; contractsEnsured: number } {
  initializeDB();
  const keys = getStorageKeys();
  const parsed = parseScheduledPaymentsCSV(csvText);
  if (parsed.length === 0) return { importedCount: 0, contractsEnsured: 0 };

  const currentSchedules: ScheduledPayment[] = replaceMode
    ? []
    : JSON.parse(localStorage.getItem(keys.statements) || '[]');
  const currentContracts: Contract[] = JSON.parse(localStorage.getItem(keys.contracts) || '[]');

  const scheduleMap = new Map<string, ScheduledPayment>();
  // Index existing schedules by id as well as contractId+termNumber
  const termKeyMap = new Map<string, string>(); // termKey -> schedule id

  currentSchedules.forEach(s => {
    scheduleMap.set(s.id, s);
    const key = `${(s.contractId || '').trim().toUpperCase()}_TERM_${s.termNumber}`;
    termKeyMap.set(key, s.id);
  });

  // Upsert parsed items cleanly
  parsed.forEach(s => {
    s.fromDb = true;
    const key = `${(s.contractId || '').trim().toUpperCase()}_TERM_${s.termNumber}`;
    const existingId = termKeyMap.get(key);
    if (existingId && existingId !== s.id) {
      scheduleMap.delete(existingId);
    }
    scheduleMap.set(s.id, s);
    termKeyMap.set(key, s.id);
  });

  const updatedSchedules = Array.from(scheduleMap.values());

  // Ensure contracts exist for all contractIds in updatedSchedules
  let contractsEnsured = 0;
  const contractIdSet = new Set(currentContracts.map(c => (c.id || '').trim().toUpperCase()));

  updatedSchedules.forEach(s => {
    const cCid = (s.contractId || '').trim().toUpperCase();
    if (cCid && !contractIdSet.has(cCid)) {
      contractIdSet.add(cCid);
      contractsEnsured++;
      const isHP = cCid.startsWith('HP') || cCid.startsWith('CH');
      const newContract: Contract = {
        id: s.contractId,
        customerName: `ลูกค้าสัญญา ${s.contractId}`,
        customerTaxId: '0000000000000',
        customerPhone: '080-000-0000',
        productType: isHP ? 'HP' : 'LOAN',
        creditLimit: Math.max(100000, s.totalDue * 12),
        interestRate: 8,
        startDate: s.dueDate || getSystemDate(),
        paymentFrequency: 'MONTHLY',
        serviceFee: 0,
        treeCutOption: false,
        disbursedAmount: Math.max(100000, s.totalDue * 12),
        outstandingPrincipal: s.principalDue,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      currentContracts.push(newContract);
    }
  });

  localStorage.setItem(keys.statements, JSON.stringify(updatedSchedules));
  localStorage.setItem(keys.contracts, JSON.stringify(currentContracts));

  runDailyAudit();

  return {
    importedCount: parsed.length,
    contractsEnsured
  };
}


/**
 * Updates the pending disbursement amount for a specific schedule payment
 */
export function updateScheduledPaymentPendingDisbursement(id: string, pendingDisbursement: number): ScheduledPayment | null {
  const schedules = getScheduledPayments();
  const index = schedules.findIndex(s => s.id === id);
  if (index === -1) return null;

  schedules[index].pendingDisbursement = pendingDisbursement;
  schedules[index].lastUpdated = new Date().toISOString().split('T')[0];

  const keys = getStorageKeys();
  localStorage.setItem(keys.statements, JSON.stringify(schedules));

  // Sync to Supabase if connected
  const client = getSupabaseClient();
  const config = getSavedSupabaseConfig();
  if (client && config.autoSync && !isSandboxActive()) {
    autoPushItem(client, 'scheduled_payments', schedules[index]);
  }

  return schedules[index];
}

/**
 * Helper to generate initial schedule and align it with snapshot/migrated balances
 */
function generateAndSaveSnapshotSchedules(contract: Contract, disbursedAmount: number, outstandingPrincipal: number) {
  const disburseDate = getFirstDisbursementDate(contract.id) || contract.firstDisburseDate || contract.disburseDate || contract.startDate;
  const rawSchedules = generateInitialSchedule(contract, disbursedAmount, disburseDate);
  
  let principalPaidTarget = Number((disbursedAmount - outstandingPrincipal).toFixed(2));
  
  const updatedSchedules = rawSchedules.map(term => {
    if (principalPaidTarget >= term.principalDue - 0.01 && principalPaidTarget > 0) {
      term.principalPaid = term.principalDue;
      term.interestPaid = term.interestDue;
      term.vatPaid = term.vatDue;
      term.totalPaid = term.totalDue;
      term.status = 'PAID';
      principalPaidTarget = Math.max(0, Number((principalPaidTarget - term.principalDue).toFixed(2)));
    } else if (principalPaidTarget > 0.01) {
      term.principalPaid = Math.round(principalPaidTarget * 100) / 100;
      term.interestPaid = term.interestDue; // assume interest is paid
      term.vatPaid = term.vatDue;
      term.totalPaid = Math.round((term.principalPaid + term.interestPaid + term.vatPaid) * 100) / 100;
      term.status = 'PARTIAL';
      principalPaidTarget = 0;
    }
    return term;
  });

  const allSchedules = getScheduledPayments();
  
  // Find the last paid or partial term due date
  let lastPaidDueDate = disburseDate;
  updatedSchedules.forEach(s => {
    if (s.status === 'PAID' || s.status === 'PARTIAL') {
      if (new Date(s.dueDate).getTime() > new Date(lastPaidDueDate).getTime()) {
        lastPaidDueDate = s.dueDate;
      }
    }
  });

  // Recalculate future terms using the last paid date as the anchor and empty repayments list since it's a migration snapshot
  const finalSchedulesForContract = recalculateFutureSchedules(contract, updatedSchedules, lastPaidDueDate, [], disburseDate);

  allSchedules.push(...finalSchedulesForContract);
  const keys = getStorageKeys();
  localStorage.setItem(keys.statements, JSON.stringify(allSchedules));

  // Auto-sync to Supabase
  const client = getSupabaseClient();
  const config = getSavedSupabaseConfig();
  if (client && config.autoSync && !isSandboxActive()) {
    finalSchedulesForContract.forEach(sch => {
      autoPushItem(client, 'scheduled_payments', sch);
    });
  }
}

/**
 * Inserts a new contract & triggers generateInitialSchedule or snapshot setup
 */
export function addContract(
  contract: Omit<Contract, 'status' | 'createdAt' | 'disbursedAmount' | 'outstandingPrincipal'> & {
    disbursedAmount?: number;
    outstandingPrincipal?: number;
  }
): Contract {
  const hasSnapshot = contract.disbursedAmount !== undefined && contract.outstandingPrincipal !== undefined;
  const initialDisbursed = hasSnapshot ? Number(contract.disbursedAmount) : 0;
  const initialOutstanding = hasSnapshot ? Number(contract.outstandingPrincipal) : 0;

  const newContract: Contract = {
    ...contract,
    disbursedAmount: initialDisbursed,
    outstandingPrincipal: initialOutstanding,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  const contracts = getContracts();
  contracts.push(newContract);
  const keys = getStorageKeys();
  localStorage.setItem(keys.contracts, JSON.stringify(contracts));

  // Async Auto-sync to Supabase if connected
  const client = getSupabaseClient();
  const config = getSavedSupabaseConfig();
  if (client && config.autoSync && !isSandboxActive()) {
    autoPushItem(client, 'contracts', newContract);
  }

  if (hasSnapshot) {
    // Save disbursement entry for consistency
    const disbursements = getDisbursements();
    const disburseDateToUse = newContract.firstDisburseDate || newContract.disburseDate || newContract.startDate;
    const newDisb: Disbursement = {
      id: `DISB-${String(disbursements.length + 1).padStart(4, '0')}`,
      contractId: newContract.id,
      amount: initialDisbursed,
      disburseDate: disburseDateToUse,
      batchNumber: 1,
      upfrontInterest: 0,
      upfrontFee: 0,
      netReceived: initialDisbursed,
      description: 'ยอดยกยอดมา ณ วันที่เริ่มต้นระบบ (Migration Snapshot)'
    };
    disbursements.push(newDisb);
    localStorage.setItem(keys.disbursements, JSON.stringify(disbursements));
    if (client && config.autoSync && !isSandboxActive()) {
      autoPushItem(client, 'disbursements', newDisb);
    }

    // Generate schedule and mark paid terms
    generateAndSaveSnapshotSchedules(newContract, initialDisbursed, initialOutstanding);
  } else {
    // If Hire Purchase, we execute single disbursement immediately equal to the credit limit
    if (newContract.productType === 'HP') {
      disburseContract(
        newContract.id,
        newContract.creditLimit,
        newContract.firstDisburseDate || newContract.disburseDate || newContract.startDate,
        'เบิกเงินเช้าซื้อเต็มจำนวน ณ วันทำสัญญา'
      );
    }
  }

  return newContract;
}

/**
 * record loan disbursement
 */
export function disburseContract(
  contractId: string,
  amount: number,
  disburseDate: string,
  description: string
): Disbursement | null {
  const contracts = getContracts();
  const index = contracts.findIndex(c => c.id === contractId);
  if (index === -1) return null;

  const con = contracts[index];
  
  // Find current disburse count for batch index
  const disbursements = getDisbursements();
  const currentDisbursements = disbursements.filter(d => d.contractId === contractId);
  const batchNum = currentDisbursements.length + 1;

  // Process upfront deduction if LOAN - ANNUAL
  const isFirstDisburse = (batchNum === 1);
  const firstDisDate = isFirstDisburse ? disburseDate : (currentDisbursements[0]?.disburseDate || disburseDate);
  
  const { upfrontInterest, upfrontFee, netReceived } = calculatePrepaidDisbursement(
    con,
    amount,
    disburseDate,
    isFirstDisburse,
    firstDisDate
  );

  const newDisb: Disbursement = {
    id: `DISB-${String(disbursements.length + 1).padStart(4, '0')}`,
    contractId,
    amount,
    disburseDate,
    batchNumber: batchNum,
    upfrontInterest,
    upfrontFee,
    netReceived,
    description
  };

  // Add disbursement
  disbursements.push(newDisb);
  const keys = getStorageKeys();
  localStorage.setItem(keys.disbursements, JSON.stringify(disbursements));

  // Update Contract disbursed amount and outstanding logic
  con.disbursedAmount = Number((con.disbursedAmount + amount).toFixed(2));
  con.outstandingPrincipal = Number((con.outstandingPrincipal + amount).toFixed(2));
  
  contracts[index] = con;
  localStorage.setItem(keys.contracts, JSON.stringify(contracts));

  // Generate or regenerate schedule! 
  // If first disbursement, create general schedule
  // If subsequent disbursement, we adjust current schedule to add outstanding principal
  let schedules = getScheduledPayments();
  if (batchNum === 1) {
    const existingContractSchedules = schedules.filter(s => s.contractId === contractId);
    if (existingContractSchedules.length > 0) {
      // If schedules already existed (e.g. from Supabase / CSV), update their pendingDisbursement and assign due dates from disburseDate
      schedules = schedules.map(sch => {
        if (sch.contractId === contractId) {
          const newDueDate = sch.dueDate || addMonths(disburseDate, (sch.termNumber || 1) * (con.paymentFrequency === 'ANNUAL' ? 12 : 1), con.dueDay);
          const newPending = Math.max(0, (sch.pendingDisbursement || 0) - amount);
          return {
            ...sch,
            dueDate: newDueDate,
            pendingDisbursement: newPending
          };
        }
        return sch;
      });
    } else {
      const initSched = generateInitialSchedule(con, amount, disburseDate);
      schedules.push(...initSched);
    }
  } else {
    // For ANNUAL (กลุ่มปลูก) - subsequent drawdowns add to the accumulated principal 
    // and interest calculation increases. Let's find outstanding scheds for this contract and recalculate
    schedules = schedules.map(sch => {
      if (sch.contractId === contractId && sch.status !== 'PAID') {
        const rate = con.interestRate / 100;
        
        // Final year due gets increased by the secondary drawdown amount
        const isFinalYear = sch.dueDate === addMonths(firstDisDate, con.termMonths, con.dueDay) || sch.termNumber === Math.ceil(con.termMonths / 12);
        const addedPrincipal = isFinalYear ? amount : 0;
        const newPrincipalDue = Number((sch.principalDue + addedPrincipal).toFixed(2));

        // Compute remaining interest if annual: subsequent years interest is calculated based on cumulative drawn amount
        let newInterestDue = sch.interestDue;
        if (con.paymentFrequency === 'ANNUAL' && sch.termNumber > 1) {
          // Interest Year 2 onwards = Accumulated Principal * Rate
          newInterestDue = Number((con.disbursedAmount * rate).toFixed(2));
        }

        const newPending = Math.max(0, (sch.pendingDisbursement || 0) - amount);

        return {
          ...sch,
          principalDue: newPrincipalDue,
          interestDue: newInterestDue,
          pendingDisbursement: newPending,
          totalDue: Number((newPrincipalDue + newInterestDue + sch.penaltyDue + sch.trackingFeeDue + sch.vatDue).toFixed(2))
        };
      }
      return sch;
    });
  }

  localStorage.setItem(keys.statements, JSON.stringify(schedules));

  // Run audit to apply correct states
  runDailyAudit();

  // Async Auto-sync to Supabase if connected
  const client = getSupabaseClient();
  const config = getSavedSupabaseConfig();
  if (client && config.autoSync && !isSandboxActive()) {
    autoPushItem(client, 'disbursements', newDisb);
    autoPushItem(client, 'contracts', con);
    const updatedSchedules = JSON.parse(localStorage.getItem(keys.statements) || '[]');
    const contractSchedules = updatedSchedules.filter((sch: any) => sch.contractId === contractId);
    for (const sch of contractSchedules) {
      autoPushItem(client, 'scheduled_payments', sch);
    }
  }

  return newDisb;
}

/**
 * Handle repayment with term-by-term horizontal cut allocation
 */
export function recordRepayment(
  contractId: string,
  amountPaid: number,
  paymentDate: string
): Repayment | null {
  const contracts = getContracts();
  const conCid = (contractId || '').trim().toUpperCase();
  const currentConIndex = contracts.findIndex(c => (c.id || '').trim().toUpperCase() === conCid);
  if (currentConIndex === -1) return null;
  const con = contracts[currentConIndex];

  const schedules = getScheduledPayments();
  const repayments = getRepayments();

  const disburseDate = getFirstDisbursementDate(con.id) || con.firstDisburseDate || con.startDate;

  // Recalculate schedules first to ensure we use up-to-date interest/principal due based on the actual payment date and outstanding principal before payment!
  const recalculatedSchedules = recalculateFutureSchedules(con, schedules, paymentDate, repayments, disburseDate);

  // Run allocation on recalculated schedules
  const { updatedScheduledPayments, allocationItems, allocatedAmounts } = allocateHorizontalPayment(
    recalculatedSchedules,
    contractId,
    amountPaid,
    paymentDate,
    con.productType === 'HP' ? 0.07 : 0,
    disburseDate,
    repayments,
    con
  );

  const keys = getStorageKeys();

  // Save updated schedule payments
  localStorage.setItem(keys.statements, JSON.stringify(updatedScheduledPayments));

  // Generate Receipt No. based on Product Type (HP -> RH2-YY00000, LOAN -> RT1-YY00000)
  const yy = paymentDate.substring(2, 4); // e.g. '2026' -> '26'
  const prefix = con.productType === 'HP' ? 'RH2' : 'RT1';
  const yearPrefix = `${prefix}-${yy}`;
  const rcpCount = repayments.filter(r => r.receiptNo && r.receiptNo.startsWith(yearPrefix)).length + 1;
  const receiptNo = `${yearPrefix}${String(rcpCount).padStart(5, '0')}`;

  const afterOutstanding = Math.max(0, Number((con.outstandingPrincipal - allocatedAmounts.appliedPrincipal).toFixed(2)));

  let nextNum = repayments.length + 1;
  while (repayments.some(r => r.id === `REPAY-${String(nextNum).padStart(4, '0')}`)) {
    nextNum++;
  }

  const newRepay: Repayment = {
    id: `REPAY-${String(nextNum).padStart(4, '0')}`,
    contractId,
    paymentDate,
    amountPaid,
    receiptNo,
    ...allocatedAmounts,
    distributionDetails: allocationItems,
    outstandingPrincipal: afterOutstanding,
    createdAt: new Date().toISOString()
  };

  repayments.push(newRepay);

  // Recalculate chronological running outstanding principal for all repayments of this contract
  const conRepayments = repayments
    .filter(r => (r.contractId || '').trim().toUpperCase() === conCid)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || (a.createdAt || '').localeCompare(b.createdAt || ''));

  const params = getStoredParameters();
  const vatRateDecimal = params.vatRate / 100;
  const initialPrincipal = con.productType === 'HP' 
    ? con.creditLimit / (1 + vatRateDecimal) 
    : con.disbursedAmount;

  let runBal = initialPrincipal;
  conRepayments.forEach(r => {
    runBal = Math.max(0, Number((runBal - (r.appliedPrincipal || 0)).toFixed(2)));
    r.outstandingPrincipal = runBal;
  });
  con.outstandingPrincipal = runBal;

  localStorage.setItem(keys.repayments, JSON.stringify(repayments));
  
  // Dynamic daily reducing-balance interest & future schedules recalculation up to system date
  const sysDate = getSystemDate();
  const finalScheduledPayments = recalculateFutureSchedules(con, updatedScheduledPayments, sysDate, repayments, disburseDate);
  localStorage.setItem(keys.statements, JSON.stringify(finalScheduledPayments));

  // Check if contract is now fully closed
  const remainingDue = finalScheduledPayments
    .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
    .reduce((sum, s) => sum + (s.principalDue - s.principalPaid + s.interestDue - s.interestPaid), 0);
  
  if (remainingDue <= 1 && con.outstandingPrincipal <= 1) {
    con.status = 'CLOSED';
  } else {
    // Re-audit state
    const overdueSchedules = finalScheduledPayments.filter(s => (s.contractId || '').trim().toUpperCase() === conCid && s.status === 'OVERDUE');
    if (overdueSchedules.length < 2 && con.status === 'DEFAULT') {
      con.status = 'ACTIVE';
    }
  }

  contracts[currentConIndex] = con;
  localStorage.setItem(keys.contracts, JSON.stringify(contracts));

  // Async Auto-sync to Supabase if connected
  const client = getSupabaseClient();
  const config = getSavedSupabaseConfig();
  if (client && config.autoSync && !isSandboxActive()) {
    autoPushItem(client, 'repayments', newRepay);
    autoPushItem(client, 'contracts', con);
    const contractSchedules = finalScheduledPayments.filter(sch => (sch.contractId || '').trim().toUpperCase() === conCid);
    for (const sch of contractSchedules) {
      autoPushItem(client, 'scheduled_payments', sch);
    }
  }

  return newRepay;
}

/**
 * Return SQL query snippet to create Supabase tables
 */
export function getSupabaseSQLMigration(): string {
  return `-- SQL Migration Scripts for Supabase Full-scale LMS
-- Execute this in Supabase SQL Editor to create matching tables

-- 1. Create enum lookup types
CREATE TYPE contract_status AS ENUM ('ACTIVE', 'CLOSED', 'DEFAULT');
CREATE TYPE product_type AS ENUM ('HP', 'LOAN');
CREATE TYPE payment_frequency AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE statement_status AS ENUM ('NOT_PAID', 'PARTIAL', 'PAID', 'OVERDUE');

-- 2. Create contracts table
-- Note: If you have an existing table, run this SQL command to add columns:
-- ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS disburse_date DATE;
-- ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS first_disburse_date DATE;
-- ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(15, 2);
CREATE TABLE public.contracts (
    id VARCHAR(100) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_tax_id VARCHAR(50) NOT NULL,
    customer_phone VARCHAR(50),
    customer_address TEXT,
    product_type product_type NOT NULL,
    credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_rate NUMERIC(5, 2) NOT NULL,
    start_date DATE NOT NULL,
    disburse_date DATE,
    first_disburse_date DATE,
    term_months INT,
    due_day INT CHECK (due_day IS NULL OR due_day IN (5, 15, 25)),
    payment_frequency payment_frequency NOT NULL DEFAULT 'MONTHLY',
    service_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tree_cut_option BOOLEAN NOT NULL DEFAULT FALSE,
    outstanding_principal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    disbursed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    installment_amount NUMERIC(15, 2),
    status contract_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    planting_type VARCHAR(50),
    planting_area_rai NUMERIC(15, 2),
    planting_tree_count INT,
    planting_province VARCHAR(100),
    planting_district VARCHAR(100),
    planting_subdistrict VARCHAR(100)
);

-- 3. Create disbursements table
CREATE TABLE public.disbursements (
    id VARCHAR(100) PRIMARY KEY,
    contract_id VARCHAR(100) REFERENCES public.contracts(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    disburse_date DATE NOT NULL,
    batch_number INT NOT NULL,
    upfront_interest NUMERIC(15, 2) DEFAULT 0.00,
    upfront_fee NUMERIC(15, 2) DEFAULT 0.00,
    net_received NUMERIC(15, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create scheduled_payments table (Statements)
-- Note: If you have an existing table, run these SQL commands to add the columns:
-- ALTER TABLE public.scheduled_payments ADD COLUMN IF NOT EXISTS pending_disbursement NUMERIC(15, 2) DEFAULT 0.00;
-- ALTER TABLE public.scheduled_payments ADD COLUMN IF NOT EXISTS priority INT DEFAULT 1;
-- ALTER TABLE public.scheduled_payments ADD COLUMN IF NOT EXISTS accrued_interest NUMERIC(15, 2) DEFAULT 0.00;
CREATE TABLE public.scheduled_payments (
    id VARCHAR(100) PRIMARY KEY,
    contract_id VARCHAR(100) REFERENCES public.contracts(id) ON DELETE CASCADE,
    term_number INT NOT NULL,
    due_date DATE NOT NULL,
    
    principal_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    penalty_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tracking_fee_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    principal_paid NUMERIC(15, 2) DEFAULT 0.00,
    interest_paid NUMERIC(15, 2) DEFAULT 0.00,
    vat_paid NUMERIC(15, 2) DEFAULT 0.00,
    penalty_paid NUMERIC(15, 2) DEFAULT 0.00,
    tracking_fee_paid NUMERIC(15, 2) DEFAULT 0.00,
    total_paid NUMERIC(15, 2) DEFAULT 0.00,
    
    status statement_status NOT NULL DEFAULT 'NOT_PAID',
    last_updated DATE NOT NULL DEFAULT CURRENT_DATE,
    pending_disbursement NUMERIC(15, 2) DEFAULT 0.00,
    priority INT DEFAULT 1,
    accrued_interest NUMERIC(15, 2) DEFAULT 0.00
);

-- 5. Create repayments table
-- Note: If you have an existing table, run this SQL command to add the column:
-- ALTER TABLE public.repayments ADD COLUMN outstanding_principal NUMERIC(15, 2) DEFAULT 0.00;
CREATE TABLE public.repayments (
    id VARCHAR(100) PRIMARY KEY,
    contract_id VARCHAR(100) REFERENCES public.contracts(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount_paid NUMERIC(15, 2) NOT NULL,
    receipt_no VARCHAR(100) NOT NULL UNIQUE,
    applied_penalty NUMERIC(15, 2) DEFAULT 0.00,
    applied_tracking_fee NUMERIC(15, 2) DEFAULT 0.00,
    applied_interest NUMERIC(15, 2) DEFAULT 0.00,
    applied_principal NUMERIC(15, 2) DEFAULT 0.00,
    applied_vat NUMERIC(15, 2) DEFAULT 0.00,
    distribution_details JSONB,
    outstanding_principal NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create daily_accrued_interests table (ตารางบันทึกดอกเบี้ยคงค้างรายวัน)
CREATE TABLE public.daily_accrued_interests (
    id VARCHAR(100) PRIMARY KEY,
    contract_id VARCHAR(100) REFERENCES public.contracts(id) ON DELETE CASCADE,
    term_number INT NOT NULL,
    seq INT NOT NULL,
    entry_date DATE NOT NULL,
    principal_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    daily_interest NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    accumulated_interest NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    outstanding_interest NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'NOT_PAID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Initial Mocking Data for testing:
-- (Uncomment to execute in your testing sandbox)
/*
INSERT INTO contracts VALUES 
('HP-2026-0001', 'นายพูนศักดิ์ รุ่งเรือง (Somyot Truck)', '3101294829103', '081-234-5678', 'HP', 120000.00, 8.00, '2026-01-05', 12, 5, 'MONTHLY', 0.00, false, 101200.00, 120000.00, 'DEFAULT');
*/
`;
}
