/**
 * LMS Types and Interfaces matching Supabase database schema
 */

export type ProductType = 'HP' | 'LOAN';
export type PaymentFrequency = 'MONTHLY' | 'ANNUAL';
export type StatementStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface Contract {
  id: string; // Contract No., e.g., 'HP-2026-0001' or 'LN-2026-0001'
  customerName: string;
  customerTaxId: string;
  customerPhone: string;
  productType: ProductType;
  creditLimit: number;
  interestRate: number; // Effective rate per year, e.g. 10 for 10%
  startDate: string; // YYYY-MM-DD
  termMonths: number; // e.g. 12, 24, 60
  dueDay: 5 | 15 | 25;
  paymentFrequency: PaymentFrequency; // 'MONTHLY' or 'ANNUAL' (groups planting / กลุ่มปลูก)
  serviceFee: number; // For ANNUAL (กลุ่มปลูก)
  treeCutOption: boolean; // For ANNUAL, whether they can draw the final tree-cutting batch
  outstandingPrincipal: number; // Outstanding balance
  disbursedAmount: number; // Total amount drawn so far
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
  
  // Dues
  principalDue: number;
  interestDue: number;
  vatDue: number; // VAT on HP payments (usually 7% on principal+interest)
  penaltyDue: number; // Base defaults penalty (e.g., 15% on overdue principal * overdue days)
  trackingFeeDue: number; // 50 or 100 THB + VAT based on overdue status
  totalDue: number;

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
  receiptNo: string; // RCP-YYYY-MM-XXXX
  appliedPenalty: number;
  appliedTrackingFee: number;
  appliedInterest: number;
  appliedPrincipal: number;
  appliedVat: number;
  distributionDetails: RepaymentAllocationItem[];
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
