/**
 * Database store module using localStorage with real-time defaults and Supabase structure mapping
 */

import { Contract, Disbursement, ScheduledPayment, Repayment } from './types';
import { generateInitialSchedule, calculatePrepaidDisbursement, auditAndApplyOverdueState, allocateHorizontalPayment, addMonths } from './financialEngine';

// Default initial date defaults to 2026-05-22
const SYSTEM_DATE = '2026-05-22';

// 1. Initial Default Contracts
const DEFAULT_CONTRACTS: Contract[] = [
  {
    id: 'HP-2026-0001',
    customerName: 'นายพูนศักดิ์ รุ่งเรือง (Somyot Truck)',
    customerTaxId: '3101294829103',
    customerPhone: '081-234-5678',
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
    outstandingPrincipal: 101200,
    status: 'DEFAULT',
    createdAt: '2026-01-05T00:00:00Z'
  },
  {
    id: 'LN-2026-0002',
    customerName: 'นางสาวสิริมา ประเสริฐดี',
    customerTaxId: '4221008273641',
    customerPhone: '089-876-5432',
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
    outstandingPrincipal: 73500,
    status: 'ACTIVE',
    createdAt: '2026-02-15T00:00:00Z'
  },
  {
    id: 'LN-2026-0003',
    customerName: 'กลุ่มวิสาหกิจชุมชนปลูกป่า ท่าหลวง (กลุ่มปลูก)',
    customerTaxId: '0994002817264',
    customerPhone: '036-777-1111',
    productType: 'LOAN',
    creditLimit: 130000,
    interestRate: 10,
    startDate: '2026-01-01',
    termMonths: 60,
    dueDay: 25,
    paymentFrequency: 'ANNUAL',
    serviceFee: 500, // Service fee full limit
    treeCutOption: true,
    disbursedAmount: 4000, // 2000 + 2000 drawn in Year 1
    outstandingPrincipal: 4000,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z'
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
    amountPaid: 11172.08,
    receiptNo: 'RCP-2026-02-0001',
    appliedPenalty: 0,
    appliedTrackingFee: 0,
    appliedInterest: 793.84,
    appliedPrincipal: 9647.36,
    appliedVat: 730.88,
    distributionDetails: [
      { termNumber: 1, penalty: 0, trackingFee: 0, interest: 793.84, principal: 9647.36, vat: 730.88, total: 11172.08 }
    ],
    createdAt: '2026-02-05T08:30:00Z'
  },
  {
    id: 'REPAY-0002',
    contractId: 'HP-2026-0001',
    paymentDate: '2026-03-05',
    amountPaid: 11172.08,
    receiptNo: 'RCP-2026-03-0001',
    appliedPenalty: 0,
    appliedTrackingFee: 0,
    appliedInterest: 735.12,
    appliedPrincipal: 9706.08,
    appliedVat: 730.88,
    distributionDetails: [
      { termNumber: 2, penalty: 0, trackingFee: 0, interest: 735.12, principal: 9706.08, vat: 730.88, total: 11172.08 }
    ],
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
    createdAt: '2026-03-15T11:00:00Z'
  }
];

export function initializeDB() {
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
  
  // Apply Audit dynamic values instantly
  runDailyAudit();
}

export function getContracts(): Contract[] {
  initializeDB();
  return JSON.parse(localStorage.getItem('lms_contracts') || '[]');
}

export function getDisbursements(): Disbursement[] {
  initializeDB();
  return JSON.parse(localStorage.getItem('lms_disbursements') || '[]');
}

export function getScheduledPayments(): ScheduledPayment[] {
  initializeDB();
  return JSON.parse(localStorage.getItem('lms_statements') || '[]');
}

export function getRepayments(): Repayment[] {
  initializeDB();
  return JSON.parse(localStorage.getItem('lms_repayments') || '[]');
}

/**
 * Audit defaults, recalculates Penalties and Collection tracking fees based on current system time
 */
export function runDailyAudit() {
  const contracts = JSON.parse(localStorage.getItem('lms_contracts') || '[]');
  const schedules = JSON.parse(localStorage.getItem('lms_statements') || '[]');
  
  const { updatedSchedules, updatedContracts } = auditAndApplyOverdueState(schedules, contracts, SYSTEM_DATE);
  
  localStorage.setItem('lms_statements', JSON.stringify(updatedSchedules));
  localStorage.setItem('lms_contracts', JSON.stringify(updatedContracts));
}

/**
 * Inserts a new contract & triggers generateInitialSchedule
 */
export function addContract(contract: Omit<Contract, 'disbursedAmount' | 'outstandingPrincipal' | 'status' | 'createdAt'>): Contract {
  const newContract: Contract = {
    ...contract,
    disbursedAmount: 0,
    outstandingPrincipal: 0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  const contracts = getContracts();
  contracts.push(newContract);
  localStorage.setItem('lms_contracts', JSON.stringify(contracts));

  // If Hire Purchase, we execute single disbursement immediately equal to the credit limit
  if (contract.productType === 'HP') {
    disburseContract(
      newContract.id,
      contract.creditLimit,
      contract.startDate,
      'เบิกเงินเช้าซื้อเต็มจำนวน ณ วันทำสัญญา'
    );
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
  localStorage.setItem('lms_disbursements', JSON.stringify(disbursements));

  // Update Contract disbursed amount and outstanding logic
  con.disbursedAmount = Number((con.disbursedAmount + amount).toFixed(2));
  con.outstandingPrincipal = Number((con.outstandingPrincipal + amount).toFixed(2));
  
  contracts[index] = con;
  localStorage.setItem('lms_contracts', JSON.stringify(contracts));

  // Generate or regenerate schedule! 
  // If first disbursement, create general schedule
  // If subsequent disbursement, we adjust current schedule to add outstanding principal
  let schedules = getScheduledPayments();
  if (batchNum === 1) {
    const initSched = generateInitialSchedule(con, amount, disburseDate);
    // Append to database
    schedules.push(...initSched);
  } else {
    // For ANNUAL (กลุ่มปลูก) - subsequent drawdowns add to the accumulated principal 
    // and interest calculation increases. Let's find outstanding scheds for this contract and recalculate
    schedules = schedules.map(sch => {
      if (sch.contractId === contractId && sch.status !== 'PAID') {
        const rate = con.interestRate / 100;
        
        // Final year due gets increased by the secondary drawdown amount
        const isFinalYear = sch.dueDate === addMonths(firstDisDate, con.termMonths, con.dueDay);
        const addedPrincipal = isFinalYear ? amount : 0;
        const newPrincipalDue = Number((sch.principalDue + addedPrincipal).toFixed(2));

        // Let's compute remaining interest if annual: subsequent years interest is calculated based on cumulative drawn amount
        let newInterestDue = sch.interestDue;
        if (con.paymentFrequency === 'ANNUAL' && sch.termNumber > 1) {
          // Interest Year 2 onwards = Accumulated Principal * Rate
          newInterestDue = Number((con.disbursedAmount * rate).toFixed(2));
        }

        return {
          ...sch,
          principalDue: newPrincipalDue,
          interestDue: newInterestDue,
          totalDue: Number((newPrincipalDue + newInterestDue + sch.penaltyDue + sch.trackingFeeDue + sch.vatDue).toFixed(2))
        };
      }
      return sch;
    });
  }

  localStorage.setItem('lms_statements', JSON.stringify(schedules));

  // Run audit to apply correct states
  runDailyAudit();

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
  const currentConIndex = contracts.findIndex(c => c.id === contractId);
  if (currentConIndex === -1) return null;
  const con = contracts[currentConIndex];

  const schedules = getScheduledPayments();
  const repayments = getRepayments();

  // Run allocation
  const { updatedScheduledPayments, allocationItems, allocatedAmounts } = allocateHorizontalPayment(
    schedules,
    contractId,
    amountPaid,
    paymentDate,
    con.productType === 'HP' ? 0.07 : 0
  );

  // Save updated schedule payments
  localStorage.setItem('lms_statements', JSON.stringify(updatedScheduledPayments));

  // Generate Receipt No.
  const rcpCount = repayments.filter(r => r.paymentDate.substring(0, 7) === paymentDate.substring(0, 7)).length + 1;
  const yearMonth = paymentDate.replace(/-/g, '').substring(0, 6);
  const receiptNo = `RCP-${yearMonth}-${String(rcpCount).padStart(4, '0')}`;

  const newRepay: Repayment = {
    id: `REPAY-${String(repayments.length + 1).padStart(4, '0')}`,
    contractId,
    paymentDate,
    amountPaid,
    receiptNo,
    ...allocatedAmounts,
    distributionDetails: allocationItems,
    createdAt: new Date().toISOString()
  };

  repayments.push(newRepay);
  localStorage.setItem('lms_repayments', JSON.stringify(repayments));

  // Decrease contract outstanding principal
  con.outstandingPrincipal = Math.max(0, Number((con.outstandingPrincipal - allocatedAmounts.appliedPrincipal).toFixed(2)));
  
  // Check if contract is now fully closed
  const remainingDue = updatedScheduledPayments
    .filter(s => s.contractId === contractId)
    .reduce((sum, s) => sum + (s.principalDue - s.principalPaid + s.interestDue - s.interestPaid), 0);
  
  if (remainingDue <= 1 && con.outstandingPrincipal <= 1) {
    con.status = 'CLOSED';
  } else {
    // Re-audit state
    const overdueSchedules = updatedScheduledPayments.filter(s => s.contractId === contractId && s.status === 'OVERDUE');
    if (overdueSchedules.length < 2 && con.status === 'DEFAULT') {
      con.status = 'ACTIVE';
    }
  }

  contracts[currentConIndex] = con;
  localStorage.setItem('lms_contracts', JSON.stringify(contracts));

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
CREATE TABLE public.contracts (
    id VARCHAR(100) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_tax_id VARCHAR(50) NOT NULL,
    customer_phone VARCHAR(50),
    product_type product_type NOT NULL,
    credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_rate NUMERIC(5, 2) NOT NULL,
    start_date DATE NOT NULL,
    term_months INT NOT NULL,
    due_day INT NOT NULL CHECK (due_day IN (5, 15, 25)),
    payment_frequency payment_frequency NOT NULL DEFAULT 'MONTHLY',
    service_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tree_cut_option BOOLEAN NOT NULL DEFAULT FALSE,
    outstanding_principal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    disbursed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status contract_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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
    last_updated DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 5. Create repayments table
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
