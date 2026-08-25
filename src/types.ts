/**
 * LMS Types and Interfaces matching Supabase database schema
 */

export type ProductType = 'HP' | 'LOAN';
export type PaymentFrequency = 'MONTHLY' | 'ANNUAL';
export type StatementStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface SystemParameters {
  penaltyRate: number; // e.g. 15 for 15% p.a.
  trackingFeeTier1: number; // e.g. 50
  trackingFeeTier2: number; // e.g. 100
  vatRate: number; // e.g. 7 for 7%
}

export interface Contract {
  id: string; // Contract No., e.g., 'HP-2026-0001' or 'LN-2026-0001'
  customerName: string;
  customerTaxId: string;
  customerPhone: string;
  customerAddress?: string; // ที่อยู่ของลูกค้า
  productType: ProductType;
  creditLimit: number;
  interestRate: number; // Effective rate per year, e.g. 10 for 10%
  startDate: string; // YYYY-MM-DD (วันที่ทำสัญญา/เซ็นสัญญา)
  firstDisburseDate?: string; // YYYY-MM-DD (วันที่เริ่มเบิกเงินกู้/เริ่มคิดดอกเบี้ย)
  disburseDate?: string; // YYYY-MM-DD (วันที่มีการเบิกเงินครั้งแรก / Disburse date)
  firstPaymentDate?: string; // YYYY-MM-DD
  firstDueDate?: string; // YYYY-MM-DD
  termMonths?: number; // e.g. 12, 24, 60
  dueDay?: 5 | 15 | 25;
  paymentFrequency: PaymentFrequency; // 'MONTHLY' or 'ANNUAL' (groups planting / กลุ่มปลูก)
  serviceFee: number; // For ANNUAL (กลุ่มปลูก)
  treeCutOption: boolean; // For ANNUAL, whether they can draw the final tree-cutting batch
  plantingType?: 'RESERVE' | 'NON_RESERVE'; // ประเภท (RESERVE/NON_RESERVE)
  plantingAreaRai?: number; // จำนวนไร่
  plantingTreeCount?: number; // จำนวนต้น
  plantingProvince?: string; // จังหวัด
  plantingDistrict?: string; // อำเภอ
  plantingSubdistrict?: string; // ตำบล
  outstandingPrincipal: number; // Outstanding balance
  disbursedAmount: number; // Total amount drawn so far
  installmentAmount?: number; // ค่างวดผ่อนชำระต่อเดือน/ปี
  status: 'ACTIVE' | 'CLOSED' | 'DEFAULT';
  createdAt: string;
}

export interface Disbursement {
  id: string;
  contractId: string;
  amount: string | number;
  disburseDate: string; // YYYY-MM-DD
  batchNumber: number; // e.g. 1, 2, 3...
  upfrontInterest: number; // Prepaid interest deducted at drawdown
  upfrontFee: number; // Service fees deducted
  netReceived: number; // Net amount transferred to customer (amount - upfrontInterest - upfrontFee)
  description: string;
}

export interface ScheduledPayment {
  id: string;
  contractId: string;
  termNumber: number; // งวดที่ 1, 2...
  dueDate: string; // YYYY-MM-DD
  rawDbDueDate?: string; // Raw unparsed/parsed date string fetched directly from database
  fromDb?: boolean; // Flag to trace if loaded from DB to preserve stored penalty/tracking dues
  pendingDisbursement?: number; // ยอดรอเบิก (Pending/waiting disbursement per term)
  
  // Dues
  principalDue: number;
  interestDue: number;
  vatDue: number; // VAT on HP payments (usually 7% on principal+interest)
  penaltyDue: number; // Base defaults penalty (e.g., 15% on overdue principal * overdue days)
  trackingFeeDue: number; // 50 or 100 THB + VAT based on overdue status
  totalDue: number;
  priority?: number; // Priority row order in horizontal payment allocation
  accruedInterest?: number; // Actual accrued interest based on days (separate from planned interestDue)

  // Payments applied
  principalPaid: number;
  interestPaid: number;
  vatPaid: number;
  penaltyPaid: number;
  trackingFeePaid: number;
  totalPaid: number;

  status: StatementStatus;
  lastUpdated: string;
}

export interface Repayment {
  id: string;
  contractId: string;
  paymentDate: string; // YYYY-MM-DD
  amountPaid: number;
  receiptNo: string; // RH2-YY00000 or RT1-YY00000
  appliedPenalty: number;
  appliedTrackingFee: number;
  appliedInterest: number;
  appliedPrincipal: number;
  appliedVat: number;
  distributionDetails: RepaymentAllocationItem[];
  outstandingPrincipal?: number;
  createdAt: string;
}

export interface RepaymentAllocationItem {
  termNumber: number;
  penalty: number;
  trackingFee: number;
  interest: number;
  principal: number;
  vat: number;
  total: number;
}

export interface InterestBreakdownPeriod {
  startDate: string;
  endDate: string;
  daysCount: number;
  principal: number;
  dailyRate: number;
  interestCharged: number;
}

export interface DailyInterestLogEntry {
  date: string;
  principal: number;
  dailyRate: number;
  dailyInterest: number;
  cumulativeInterest: number;
}

export interface DailyAccruedInterest {
  id: string;
  contractId: string;
  termNumber: number;
  seq: number;
  entryDate: string;
  principalBalance: number;
  interestRate: number;
  dailyInterest: number;
  accumulatedInterest: number;
  amountPaid: number;
  outstandingInterest: number;
  status: 'NOT_PAID' | 'PARTIAL' | 'PAID';
  createdAt?: string;
}

