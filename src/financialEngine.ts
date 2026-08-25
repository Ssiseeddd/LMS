/**
 * Financial Calculation Engine for LMS Web Application
 */

import { Contract, ScheduledPayment, Repayment, RepaymentAllocationItem, Disbursement, InterestBreakdownPeriod, DailyInterestLogEntry, DailyAccruedInterest } from './types';

export function getStoredParameters() {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('lms_parameters');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }
  }
  return {
    penaltyRate: 15,
    trackingFeeTier1: 50,
    trackingFeeTier2: 100,
    vatRate: 7
  };
}

function getSystemDateStr(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('lms_system_date') || '2026-05-22';
  }
  return '2026-05-22';
}

/**
 * Robustly parses a YYYY-MM-DD date string into a UTC Date object
 * to ensure consistent behavior across browsers and timezones (especially Safari).
 */
export function parseDate(dateStr: string | null | undefined): Date {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.includes('NaN')) {
    return new Date();
  }
  const cleanStr = dateStr.split('T')[0].split(' ')[0].trim();
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && year > 1900 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day));
    }
  }
  const parsed = new Date(cleanStr);
  if (isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

/**
 * Calculates days between two date strings
 */
export function getDaysBetween(d1: string | null | undefined, d2: string | null | undefined): number {
  if (!d1 || !d2 || d1.includes('NaN') || d2.includes('NaN')) return 0;
  const date1 = parseDate(d1);
  const date2 = parseDate(d2);
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Adds months to a date, preserving or adjusting day of month safely
 */
export function addMonths(dateStr: string | null | undefined, months: number, targetDueDay?: number): string {
  if (!dateStr || dateStr.includes('NaN')) return '';
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return '';

  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + months;
  
  // Handle year overflow
  year += Math.floor(month / 12);
  month = month % 12;
  if (month < 0) {
    month += 12;
    year -= 1;
  }
  
  let effectiveDay = date.getUTCDate() || 1;
  if (targetDueDay !== undefined && targetDueDay !== null && !isNaN(Number(targetDueDay)) && Number(targetDueDay) > 0) {
    effectiveDay = Number(targetDueDay);
  }
  
  const maxDaysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(effectiveDay, maxDaysInMonth);
  
  const targetDate = new Date(Date.UTC(year, month, safeDay));
  if (isNaN(targetDate.getTime())) return '';
  
  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  if (isNaN(y) || isNaN(targetDate.getUTCMonth()) || isNaN(targetDate.getUTCDate())) {
    return '';
  }
  const result = `${y}-${m}-${d}`;
  if (result.includes('NaN')) return '';
  return result;
}

/**
 * Subtracts days from a date string (YYYY-MM-DD)
 */
export function subtractDays(dateStr: string, days: number): string {
  if (!dateStr || dateStr.includes('NaN')) return '';
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() - days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (isNaN(y) || isNaN(d.getUTCMonth()) || isNaN(d.getUTCDate())) return '';
  return `${y}-${m}-${day}`;
}

/**
 * PMT function to calculate constant monthly installment
 */
export function calculatePMT(principal: number, annualRate: number, terms: number): number {
  const r = (annualRate / 100) / 12;
  if (r === 0) return principal / terms;
  return (principal * r * Math.pow(1 + r, terms)) / (Math.pow(1 + r, terms) - 1);
}

/**
 * Computes the expected Due Date for a contract and term number
 */
export function getExpectedDueDate(
  contract: Contract,
  termNumber: number,
  firstDisburseDateStr?: string
): string {
  const disburseDate = firstDisburseDateStr || contract.firstDisburseDate || contract.disburseDate || contract.startDate || '2026-05-22';
  const baseFirstDueDate = contract.firstPaymentDate || contract.firstDueDate;
  const firstDueDate = baseFirstDueDate || addMonths(disburseDate, 1, contract.dueDay);

  if (contract.paymentFrequency === 'ANNUAL') {
    return addMonths(disburseDate, termNumber * 12, contract.dueDay);
  }

  if (baseFirstDueDate) {
    return addMonths(firstDueDate, termNumber - 1, contract.dueDay);
  } else {
    return addMonths(disburseDate, termNumber, contract.dueDay);
  }
}

/**
 * Generates an initial scheduled payment plan for a contract
 */
export function generateInitialSchedule(
  contract: Contract,
  disbursedAmount: number,
  disburseDate: string
): ScheduledPayment[] {
  const schedule: ScheduledPayment[] = [];
  const rate = contract.interestRate / 100;
  const params = getStoredParameters();
  const vatRateDecimal = params.vatRate / 100;

  if (contract.productType === 'HP') {
    // Hire Purchase: Single full drawdown, monthly installments with dynamic VAT on each installment
    const disbursedAmountExVat = disbursedAmount / (1 + vatRateDecimal);
    const pmtExVat = calculatePMT(disbursedAmountExVat, contract.interestRate, contract.termMonths);
    let remainingPrincipal = disbursedAmountExVat;

    for (let i = 1; i <= contract.termMonths; i++) {
      const dueDate = getExpectedDueDate(contract, i, disburseDate);
      const interest = remainingPrincipal * (rate / 12);
      const principal = Math.min(pmtExVat - interest, remainingPrincipal);
      const vat = (principal + interest) * vatRateDecimal; // Dynamic VAT on full installment

      schedule.push({
        id: `${contract.id}-SCH-${i}`,
        contractId: contract.id,
        termNumber: i,
        dueDate,
        principalDue: Math.round(principal * 100) / 100,
        interestDue: Math.round(interest * 100) / 100,
        vatDue: Math.round(vat * 100) / 100,
        penaltyDue: 0,
        trackingFeeDue: 0,
        totalDue: Math.round((principal + interest + vat) * 100) / 100,
        principalPaid: 0,
        interestPaid: 0,
        vatPaid: 0,
        penaltyPaid: 0,
        trackingFeePaid: 0,
        totalPaid: 0,
        status: 'NOT_PAID',
        lastUpdated: new Date().toISOString().split('T')[0]
      });

      remainingPrincipal -= principal;
    }
  } else if (contract.productType === 'LOAN' && contract.paymentFrequency === 'MONTHLY') {
    // Normal Loan, Monthly, Days/365, no VAT. Round interest & principal to 2 decimal places.
    const pmt = calculatePMT(disbursedAmount, contract.interestRate, contract.termMonths);
    let remainingPrincipal = disbursedAmount;
    let lastDueDate = disburseDate;

    for (let i = 1; i <= contract.termMonths; i++) {
      const dueDate = getExpectedDueDate(contract, i, disburseDate);
      const days = getDaysBetween(lastDueDate, dueDate);
      const interest = remainingPrincipal * rate * (days / 365);
      const roundedInterest = Math.round(interest * 100) / 100;
      const principal = Math.min(pmt - roundedInterest, remainingPrincipal);
      const roundedPrincipal = Math.round(principal * 100) / 100;

      schedule.push({
        id: `${contract.id}-SCH-${i}`,
        contractId: contract.id,
        termNumber: i,
        dueDate,
        principalDue: roundedPrincipal,
        interestDue: roundedInterest,
        vatDue: 0,
        penaltyDue: 0,
        trackingFeeDue: 0,
        totalDue: Math.round((roundedPrincipal + roundedInterest) * 100) / 100,
        principalPaid: 0,
        interestPaid: 0,
        vatPaid: 0,
        penaltyPaid: 0,
        trackingFeePaid: 0,
        totalPaid: 0,
        status: 'NOT_PAID',
        lastUpdated: new Date().toISOString().split('T')[0]
      });

      remainingPrincipal -= principal;
      lastDueDate = dueDate;
    }
  } else if (contract.productType === 'LOAN' && contract.paymentFrequency === 'ANNUAL') {
    // กลุ่มปลูก (Tree planters group): Annual payment for 5 years
    // Pay interest only annually, principal at the final year.
    // Year 1 is prepaid (upfront deducted). Thus schedule contains Year 2, 3, 4, 5
    const years = Math.ceil(contract.termMonths / 12); // e.g., 5 years
    
    // We construct 5 Annual schedule items
    for (let i = 1; i <= years; i++) {
      const dueDate = addMonths(disburseDate, i * 12, contract.dueDay);
      
      const isFinalYear = (i === years);
      // For groups planting, year 1 interest is already deducted upfront, so i=1 has interestDue = 0
      const interest = (i === 1) ? 0 : (disbursedAmount * rate); // interest calculated on current drawn amount (this will be adjusted dynamically when more disbursements are added)
      const principalDue = isFinalYear ? disbursedAmount : 0;

      schedule.push({
        id: `${contract.id}-SCH-${i}`,
        contractId: contract.id,
        termNumber: i,
        dueDate,
        principalDue: Math.round(principalDue * 100) / 100,
        interestDue: Math.round(interest * 100) / 100,
        vatDue: 0,
        penaltyDue: 0,
        trackingFeeDue: 0,
        totalDue: Math.round((principalDue + interest) * 100) / 100,
        principalPaid: 0,
        interestPaid: 0,
        vatPaid: 0,
        penaltyPaid: 0,
        trackingFeePaid: 0,
        totalPaid: 0,
        status: 'NOT_PAID',
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    }
  }

  return schedule;
}

/**
 * Formulate Upfront Interest and Fees for LOAN ANNUAL (กลุ่มปลูก)
 */
export function calculatePrepaidDisbursement(
  contract: Contract,
  amount: number,
  disburseDate: string,
  isFirstDisbursement: boolean,
  firstDisburseDate?: string
): { upfrontInterest: number; upfrontFee: number; netReceived: number } {
  const rate = contract.interestRate / 100;
  
  if (contract.productType === 'LOAN' && contract.paymentFrequency === 'ANNUAL') {
    let interest = 0;
    
    if (isFirstDisbursement) {
      // e.g. Year 1 draw 4000: upfront interest for 1 full year = 4000 * 10% * 1 = 400 THB
      interest = amount * rate;
    } else {
      // Split disbursement of Yr 1.
      // e.g., Batch 2 of Yr 1, drawn on 2026-02-02, first disburse was on 2026-01-01.
      // Interest calculated from 2026-02-02 to anniversary of first disburse (e.g., 2027-01-01)
      const yr1End = addMonths(firstDisburseDate || disburseDate, 12, contract.dueDay);
      const days = getDaysBetween(disburseDate, yr1End);
      
      if (days > 0) {
        interest = amount * rate * (days / 365);
      } else {
        interest = 0; // If drawing in later years
      }
    }

    const upfrontFee = contract.serviceFee * (amount / contract.creditLimit); // Allocated fee or flat fee
    const roundedInterest = Math.round(interest * 100) / 100;
    const roundedFee = Math.round(upfrontFee * 100) / 100;
    const netReceived = Math.round((amount - roundedInterest - roundedFee) * 100) / 100;

    return {
      upfrontInterest: roundedInterest,
      upfrontFee: roundedFee,
      netReceived
    };
  }

  return { upfrontInterest: 0, upfrontFee: 0, netReceived: amount };
}

/**
 * Re-calculate dynamic defaults, penalties, and tracking fees on overdue items.
 * Running date defaults to 2026-05-22 (as provided in mock environment)
 */
export function auditAndApplyOverdueState(
  scheduledPayments: ScheduledPayment[],
  contracts: Contract[],
  currentDateStr: string = getSystemDateStr()
): { updatedSchedules: ScheduledPayment[]; updatedContracts: Contract[] } {
  const gracePeriodDays = 3; // e.g. 3 days before charging penalty
  const params = getStoredParameters();
  const penaltyRateDecimal = params.penaltyRate / 100;
  const vatRateDecimal = params.vatRate / 100;

  // Pre-calculate consecutive overdue streaks per contract
  const contractOverdueStreaks: { [contractId: string]: { [termNumber: number]: number } } = {};
  const uniqContractIds = Array.from(new Set(scheduledPayments.map(s => (s.contractId || '').trim().toUpperCase())));

  for (const cid of uniqContractIds) {
    if (!cid) continue;
    const cSchedules = scheduledPayments
      .filter(s => (s.contractId || '').trim().toUpperCase() === cid)
      .sort((a, b) => a.termNumber - b.termNumber);
      
    let streak = 0;
    contractOverdueStreaks[cid] = {};
    for (const s of cSchedules) {
      const totalPaid = s.principalPaid + s.interestPaid + s.vatPaid + s.penaltyPaid + s.trackingFeePaid;
      const totalDue = s.principalDue + s.interestDue + s.vatDue + s.penaltyDue + s.trackingFeeDue;
      const isPaid = totalPaid >= totalDue - 0.02;
      const isOverdue = (s.dueDate < currentDateStr && !isPaid);
      if (isOverdue) {
        streak += 1;
        contractOverdueStreaks[cid][s.termNumber] = streak;
      } else {
        streak = 0;
        contractOverdueStreaks[cid][s.termNumber] = 0;
      }
    }
  }

  const schedulesCopy = scheduledPayments.map(sch => {
    const schCid = (sch.contractId || '').trim().toUpperCase();
    const contract = contracts.find(c => (c.id || '').trim().toUpperCase() === schCid);
    if (!contract || contract.status === 'CLOSED') return sch;

    const unpaidPrincipal = sch.principalDue - sch.principalPaid;
    const unpaidInterest = sch.interestDue - sch.interestPaid;

    const totalPaid = sch.principalPaid + sch.interestPaid + sch.vatPaid + sch.penaltyPaid + sch.trackingFeePaid;
    const totalDue = sch.principalDue + sch.interestDue + sch.vatDue + sch.penaltyDue + sch.trackingFeeDue;
    const installmentTarget = Math.max(sch.principalDue + sch.interestDue + sch.vatDue, totalDue - sch.penaltyDue - sch.trackingFeeDue);

    // Self-correct status base on actual paid amount vs total due amount or installment target (ค่างวด)
    let schStatus = sch.status;
    if (sch.status === 'PAID') {
      schStatus = 'PAID';
    } else if ((totalPaid >= installmentTarget - 0.02 || totalPaid >= totalDue - 0.02) && (installmentTarget > 0 || totalDue > 0)) {
      schStatus = 'PAID';
    } else if (contract.paymentFrequency === 'ANNUAL' && totalPaid > 0) {
      schStatus = 'PAID'; // Treat any payment as satisfying the term for tree planters to avoid OVERDUE
    } else if (totalPaid > 0) {
      schStatus = 'PARTIAL';
    } else {
      schStatus = 'NOT_PAID';
    }

    let updatedSch = { ...sch, status: schStatus };

    if (updatedSch.status === 'PAID') {
      return updatedSch;
    }

    if (sch.dueDate < currentDateStr) {
      const daysOverdue = Math.max(0, getDaysBetween(sch.dueDate, currentDateStr));
      
      // Calculate Tracking Fee (ค่าติดตามทวงถาม)
      // HP: Has VAT
      // Loan also has VAT for tracking fee as requested.
      // Single terms overdue -> Tier 1 (50) + VAT. 2+ terms overdue consecutive -> Tier 2 (100) + VAT.
      // No tracking fee if unpaid principal is <= 1000 THB
      let totalTrackingFee = sch.trackingFeeDue;
      let totalPenalty = sch.penaltyDue;

      if (!sch.fromDb) {
        if (totalTrackingFee <= 0) {
          let trackingFee = 0;
          let trackingVat = 0;
          if (unpaidPrincipal > 1000) {
            const streak = contractOverdueStreaks[sch.contractId]?.[sch.termNumber] || 1;

            if (streak >= 2) {
              trackingFee = params.trackingFeeTier2;
            } else {
              trackingFee = params.trackingFeeTier1;
            }
            
            // Fee has VAT (tracking fee has VAT of dynamic rate)
            trackingVat = trackingFee * vatRateDecimal;
            totalTrackingFee = Math.round((trackingFee + trackingVat) * 100) / 100;
          }
        }

        // Penalty (ค่าเบี้ยปรับ): dynamic penaltyRate% per annum on unpaid principal after grace period
        let penalty = 0;
        if (daysOverdue > gracePeriodDays && unpaidPrincipal > 0) {
          penalty = unpaidPrincipal * penaltyRateDecimal * (daysOverdue / 365);
        }

        totalPenalty = Math.round(penalty * 100) / 100;
      }

      return {
        ...updatedSch,
        status: 'OVERDUE' as const,
        penaltyDue: totalPenalty,
        trackingFeeDue: totalTrackingFee,
        totalDue: Math.round((sch.principalDue + sch.interestDue + sch.vatDue + totalPenalty + totalTrackingFee) * 100) / 100,
        lastUpdated: currentDateStr
      };
    } else if (updatedSch.status === 'NOT_PAID' && overdueWithinGracePeriod(sch.dueDate, currentDateStr)) {
      // 15 days before due date, show invoice/billing request.
      const daysUntilDue = getDaysBetween(currentDateStr, sch.dueDate);
      if (sch.dueDate >= currentDateStr && daysUntilDue <= 15) {
        return {
          ...updatedSch,
          status: 'NOT_PAID' as const,
          lastUpdated: currentDateStr
        };
      }
    }
    
    return updatedSch;
  });

  // Highlight Default contracts
  const updatedContracts = contracts.map(con => {
    const conCid = (con.id || '').trim().toUpperCase();
    const contractSchedules = schedulesCopy.filter(s => (s.contractId || '').trim().toUpperCase() === conCid);
    const overdueItems = contractSchedules.filter(s => s.status === 'OVERDUE');
    
    // Check if fully closed (i.e. all schedules are PAID or contract principal is fully paid)
    const isClosed = contractSchedules.length > 0 && (
      contractSchedules.every(s => s.status === 'PAID') || 
      con.outstandingPrincipal <= 1
    );

    if (isClosed) {
      return { ...con, status: 'CLOSED' as const };
    }

    if (overdueItems.length >= 2) {
      return { ...con, status: 'DEFAULT' as const };
    } else if (con.status === 'DEFAULT') {
      // If it has less than 2 overdue items, and was defaulted, mark as ACTIVE
      return { ...con, status: 'ACTIVE' as const };
    }
    return con;
  });

  return { updatedSchedules: schedulesCopy, updatedContracts };
}

function overdueWithinGracePeriod(dueDate: string | null | undefined, todayStr: string | null | undefined): boolean {
  if (!dueDate || !todayStr) return false;
  const d = parseDate(dueDate);
  const today = parseDate(todayStr);
  const diffTime = d.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 15 && diffDays >= -3;
}

export function getTermPaymentDatesMap(
  contractSchedules: ScheduledPayment[],
  contractRepayments: Repayment[]
): Map<number, string> {
  const paymentDatesMap = new Map<number, string>();

  // 1. First check distributionDetails on repayments
  contractRepayments.forEach(r => {
    if (r.distributionDetails && Array.isArray(r.distributionDetails)) {
      r.distributionDetails.forEach(d => {
        const tNum = (d as any).termNumber || (d as any).term_number;
        if (tNum && (d.principal > 0 || d.interest > 0 || d.total > 0)) {
          paymentDatesMap.set(tNum, r.paymentDate);
        }
      });
    }
  });

  // 2. Match remaining repayments to paid schedules by exact/near matching of applied principal or interest
  const remainingRepayments = contractRepayments.filter(r => !Array.from(paymentDatesMap.values()).includes(r.paymentDate));
  
  contractSchedules.forEach((s, sIdx) => {
    if ((s.status === 'PAID' || s.principalPaid > 0) && !paymentDatesMap.has(s.termNumber)) {
      const prevAnchor = getTermAnchorDate(sIdx, contractSchedules, contractSchedules[0]?.dueDate || s.dueDate);
      const exactMatchIndex = remainingRepayments.findIndex(r => 
        (r.paymentDate >= prevAnchor && r.paymentDate <= s.dueDate) ||
        Math.abs(r.appliedPrincipal - s.principalPaid) < 0.05 || 
        Math.abs(r.appliedPrincipal - s.principalDue) < 0.05
      );
      if (exactMatchIndex !== -1) {
        paymentDatesMap.set(s.termNumber, remainingRepayments[exactMatchIndex].paymentDate);
        remainingRepayments.splice(exactMatchIndex, 1);
      }
    }
  });

  // 3. Match any remaining repayments to remaining paid schedules by closest due date
  contractSchedules.forEach(s => {
    if ((s.status === 'PAID' || s.principalPaid > 0) && !paymentDatesMap.has(s.termNumber)) {
      if (remainingRepayments.length > 0) {
        let closestIdx = 0;
        let minDiff = Math.abs(new Date(remainingRepayments[0].paymentDate).getTime() - new Date(s.dueDate).getTime());
        for (let i = 1; i < remainingRepayments.length; i++) {
          const diff = Math.abs(new Date(remainingRepayments[i].paymentDate).getTime() - new Date(s.dueDate).getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }
        paymentDatesMap.set(s.termNumber, remainingRepayments[closestIdx].paymentDate);
        remainingRepayments.splice(closestIdx, 1);
      }
    }
  });

  return paymentDatesMap;
}

export function getTermAnchorDate(
  index: number,
  contractSchedules: ScheduledPayment[],
  contractStartDate: string,
  _termPaymentMap?: Map<number, string>
): string {
  if (index === 0) return contractStartDate;
  const prevSch = contractSchedules[index - 1];
  return prevSch.dueDate;
}

/**
 * Horizontal Payment Allocation Algorithm
 * Pays out term-by-term following:
 * Penalty Term N -> Tracking Fee Term N -> Interest Term N -> Principal Term N, then Term N+1
 */
export function allocateHorizontalPayment(
  allScheduledPayments: ScheduledPayment[],
  contractId: string,
  amountPaid: number,
  paymentDateStr: string,
  contractVatRate: number = 0,
  firstDisbursementDateStr?: string,
  repaymentsList: Repayment[] = [],
  contractObj?: Contract
): {
  updatedScheduledPayments: ScheduledPayment[];
  allocationItems: RepaymentAllocationItem[];
  allocatedAmounts: {
    appliedPenalty: number;
    appliedTrackingFee: number;
    appliedInterest: number;
    appliedPrincipal: number;
    appliedVat: number;
  };
} {
  const targetCid = (contractId || '').trim().toUpperCase();

  let contract = contractObj;
  if (!contract && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('lms_contracts');
      if (raw) {
        const list: Contract[] = JSON.parse(raw);
        contract = list.find(c => (c.id || '').trim().toUpperCase() === targetCid);
      }
    } catch (e) {
      // ignore
    }
  }

  const activeSchedules = allScheduledPayments
    .filter(s => (s.contractId || '').trim().toUpperCase() === targetCid)
    .sort((a, b) => a.termNumber - b.termNumber);

  let remainingCash = amountPaid;
  const allocationItems: RepaymentAllocationItem[] = [];

  // Track allocation details per term
  const termAllocMap = new Map<string, {
    penalty: number;
    trackingFee: number;
    interest: number;
    principal: number;
    vat: number;
  }>();

  activeSchedules.forEach(sch => {
    termAllocMap.set(sch.id, {
      penalty: 0,
      trackingFee: 0,
      interest: 0,
      principal: 0,
      vat: 0
    });
  });

  // Find the last active/started term index
  let lastActiveTermIndex = -1;
  const contractRepaymentsForAlloc = repaymentsList.filter(r => (r.contractId || '').trim().toUpperCase() === targetCid);
  const termPaymentMapForAlloc = getTermPaymentDatesMap(activeSchedules, contractRepaymentsForAlloc);
  const contractStartDate = firstDisbursementDateStr || (activeSchedules.length > 0 ? activeSchedules[0].dueDate : '');

  activeSchedules.forEach((sch, index) => {
    if (sch.status === 'PAID') return;
    const currentAnchor = getTermAnchorDate(index, activeSchedules, contractStartDate, termPaymentMapForAlloc);
    // A term is active if payment date is within or after its start anchor:
    // For index 0: paymentDateStr >= currentAnchor
    // For index > 0: paymentDateStr > currentAnchor (on the exact due date of prior term, that prior term is active, not the next term)
    if (!currentAnchor || (index === 0 ? paymentDateStr >= currentAnchor : paymentDateStr > currentAnchor)) {
      lastActiveTermIndex = index;
    }
  });

  if (lastActiveTermIndex === -1) {
    const firstUnpaid = activeSchedules.findIndex(s => s.status !== 'PAID');
    if (firstUnpaid !== -1) {
      lastActiveTermIndex = firstUnpaid;
    }
  }

  // Filter eligible active terms for allocation
  const eligibleSchedules = activeSchedules.filter((sch, index) => {
    if (sch.status === 'PAID') return false;
    // Only pay standard dues up to last active term for LOAN, but allow all terms for HP
    if (contractVatRate === 0 && index > lastActiveTermIndex) return false;
    return true;
  });

  // HORIZONTAL ALLOCATION (หลักเกณฑ์การตัดชำระแนวนอน: ตัดทีละงวดตามลำดับ Penalty -> Tracking -> Interest -> Principal)
  const activeTermForRow3a = eligibleSchedules.length > 0 ? eligibleSchedules[0] : null;
  let totalPriorInterestPaidInThisAlloc = 0;

  eligibleSchedules.forEach((sch, termIdx) => {
    if (remainingCash <= 0) return;
    const termAlloc = termAllocMap.get(sch.id)!;

    // 1. Carried-over accrued interest from prior terms (only allocated when processing the earliest unpaid term)
    if (termIdx === 0) {
      activeSchedules.forEach(priorSch => {
        if (remainingCash <= 0) return;
        const isPriorTerm = activeTermForRow3a 
          ? priorSch.termNumber < activeTermForRow3a.termNumber || (priorSch.status === 'PAID' && priorSch.id !== activeTermForRow3a.id)
          : priorSch.status === 'PAID';

        if (isPriorTerm) {
          const accruedVal = priorSch.accruedInterest !== undefined ? Number(priorSch.accruedInterest) : 0;
          const carriedOwed = Math.max(0, Math.round(accruedVal * 100) / 100);

          if (carriedOwed > 0) {
            const pay = Math.min(remainingCash, carriedOwed);
            const roundedPay = Math.round(pay * 100) / 100;

            if (priorSch.accruedInterest !== undefined) {
              priorSch.accruedInterest = Math.max(0, Math.round((accruedVal - roundedPay) * 100) / 100);
            }

            const targetAlloc = (priorSch.status === 'PAID' && activeTermForRow3a)
              ? termAllocMap.get(activeTermForRow3a.id)
              : termAllocMap.get(priorSch.id);

            if (targetAlloc) {
              targetAlloc.interest += roundedPay;
            }
            totalPriorInterestPaidInThisAlloc += roundedPay;
            remainingCash = Math.round((remainingCash - roundedPay) * 100) / 100;
          }
        }
      });
    }

    if (remainingCash <= 0) return;

    // 2. Penalty Interest for THIS term
    const penaltyOwed = sch.penaltyDue - sch.penaltyPaid;
    if (penaltyOwed > 0) {
      const pay = Math.min(remainingCash, penaltyOwed);
      const roundedPay = Math.round(pay * 100) / 100;
      termAlloc.penalty += roundedPay;
      remainingCash = Math.round((remainingCash - roundedPay) * 100) / 100;
    }

    if (remainingCash <= 0) return;

    // 3. Tracking Fees for THIS term
    const trackingOwed = sch.trackingFeeDue - sch.trackingFeePaid;
    if (trackingOwed > 0) {
      const pay = Math.min(remainingCash, trackingOwed);
      const roundedPay = Math.round(pay * 100) / 100;
      termAlloc.trackingFee += roundedPay;
      remainingCash = Math.round((remainingCash - roundedPay) * 100) / 100;
    }

    if (remainingCash <= 0) return;

    // 4. Normal Interest (and VAT if applicable) for THIS term
    let termInterestDue = sch.interestDue;
    const isLoanContract = contract ? (contract.productType === 'LOAN') : (contractVatRate === 0);
    if (isLoanContract && (!contract || contract.paymentFrequency === 'MONTHLY')) {
      if (contract) {
        const breakdown = getInterestCalculationBreakdown(
          contract,
          sch.termNumber,
          allScheduledPayments,
          repaymentsList,
          paymentDateStr,
          firstDisbursementDateStr
        );
        const calculatedAccruedInterest = breakdown.reduce((sum, b) => sum + b.interestCharged, 0);
        if (calculatedAccruedInterest > 0) {
          termInterestDue = calculatedAccruedInterest;
        } else if (sch.accruedInterest !== undefined && sch.accruedInterest > 0) {
          termInterestDue = sch.accruedInterest;
        }
      } else if (sch.accruedInterest !== undefined && sch.accruedInterest > 0) {
        termInterestDue = sch.accruedInterest;
      }
    }

    const interestOwed = Math.max(0, termInterestDue - sch.interestPaid);

    if (interestOwed > 0) {
      if (contractVatRate > 0) {
        const payTotal = Math.min(remainingCash, interestOwed * (1 + contractVatRate));
        const netInterest = payTotal / (1 + contractVatRate);
        const termInterestPaid = Math.round(netInterest * 100) / 100;
        const termVatPaid = Math.round((payTotal - netInterest) * 100) / 100;
        termAlloc.interest += termInterestPaid;
        termAlloc.vat += termVatPaid;
        remainingCash = Math.round((remainingCash - payTotal) * 100) / 100;
      } else {
        const pay = Math.min(remainingCash, interestOwed);
        const roundedPay = Math.round(pay * 100) / 100;
        termAlloc.interest += roundedPay;
        remainingCash = Math.round((remainingCash - roundedPay) * 100) / 100;
      }
    }

    if (remainingCash <= 0) return;

    // 5. Principal (and VAT if applicable) for THIS term
    const currentPrincipalPaid = sch.principalPaid + termAlloc.principal;

    // For LOAN contracts, the target principal owed in this term is at least (full installment target - fees/interest paid)
    // so that paying the standard monthly installment (e.g. 13,340 or 8,607) fully fulfills the term's installment!
    let targetPrincipalForTerm = sch.principalDue;
    if (isLoanContract) {
      const termDuesPaid = (sch.penaltyPaid + termAlloc.penalty)
        + (sch.trackingFeePaid + termAlloc.trackingFee)
        + (sch.interestPaid + termAlloc.interest)
        + (sch.vatPaid + termAlloc.vat);
      const installmentTarget = sch.totalDue || (sch.principalDue + sch.interestDue);
      targetPrincipalForTerm = Math.max(sch.principalDue, installmentTarget - termDuesPaid);
    }

    const principalOwed = Math.max(0, targetPrincipalForTerm - currentPrincipalPaid);

    if (principalOwed > 0) {
      if (contractVatRate > 0) {
        const payTotal = Math.min(remainingCash, principalOwed * (1 + contractVatRate));
        const netPrincipal = payTotal / (1 + contractVatRate);
        const termPrincipalPaid = Math.round(netPrincipal * 100) / 100;
        const termVatPaid = Math.round((payTotal - netPrincipal) * 100) / 100;
        termAlloc.principal += termPrincipalPaid;
        termAlloc.vat += termVatPaid;
        remainingCash = Math.round((remainingCash - payTotal) * 100) / 100;
      } else {
        const pay = Math.min(remainingCash, principalOwed);
        const roundedPay = Math.round(pay * 100) / 100;
        termAlloc.principal += roundedPay;
        remainingCash = Math.round((remainingCash - roundedPay) * 100) / 100;
      }
    }
  });

  // PASS 2: Allocate extra principal to the last active term if remaining cash exists (For LOAN contracts)
  let totalPenaltyAlloc = 0;
  let totalTrackingFeeAlloc = 0;
  let totalInterestAlloc = 0;
  let totalPrincipalAlloc = 0;
  let totalVatAlloc = 0;

  activeSchedules.forEach(sch => {
    const alloc = termAllocMap.get(sch.id)!;
    totalPenaltyAlloc += alloc.penalty;
    totalTrackingFeeAlloc += alloc.trackingFee;
    totalInterestAlloc += alloc.interest;
    totalPrincipalAlloc += alloc.principal;
    totalVatAlloc += alloc.vat;
  });

  if (contractVatRate === 0 && remainingCash > 0 && lastActiveTermIndex !== -1) {
    const sch = activeSchedules[lastActiveTermIndex];
    const totalRemainingContractPrincipal = activeSchedules.reduce((sum, s) => {
      if (s.status === 'PAID') return sum;
      return sum + Math.max(0, s.principalDue - s.principalPaid);
    }, 0);

    const extraPrincipalCap = Math.max(0, totalRemainingContractPrincipal - totalPrincipalAlloc);

    if (extraPrincipalCap > 0) {
      const extraPrincipalPaid = Math.min(remainingCash, extraPrincipalCap);
      termAllocMap.get(sch.id)!.principal += extraPrincipalPaid;
      totalPrincipalAlloc += extraPrincipalPaid;
      remainingCash = Math.round((remainingCash - extraPrincipalPaid) * 100) / 100;
    }
  }

  // Build allocation summary items & updated schedule records
  const updatedActiveSchedulesMap = new Map<string, ScheduledPayment>();

  activeSchedules.forEach(sch => {
    const alloc = termAllocMap.get(sch.id)!;
    const totalTermPaid = alloc.penalty + alloc.trackingFee + alloc.interest + alloc.principal + alloc.vat;

    if (totalTermPaid > 0) {
      allocationItems.push({
        termNumber: sch.termNumber,
        penalty: Math.round(alloc.penalty * 100) / 100,
        trackingFee: Math.round(alloc.trackingFee * 100) / 100,
        interest: Math.round(alloc.interest * 100) / 100,
        principal: Math.round(alloc.principal * 100) / 100,
        vat: Math.round(alloc.vat * 100) / 100,
        total: Math.round(totalTermPaid * 100) / 100
      });
    }

    const newPenaltyPaid = sch.penaltyPaid + alloc.penalty;
    const newTrackingPaid = sch.trackingFeePaid + alloc.trackingFee;
    const newInterestPaid = sch.interestPaid + alloc.interest;
    const newPrincipalPaid = sch.principalPaid + alloc.principal;
    const newVatPaid = sch.vatPaid + alloc.vat;
    const totalPaidSum = newPenaltyPaid + newTrackingPaid + newInterestPaid + newPrincipalPaid + newVatPaid;
    const totalDueSum = sch.principalDue + sch.interestDue + sch.vatDue + sch.penaltyDue + sch.trackingFeeDue;
    const installmentTarget = Math.max(sch.principalDue + sch.interestDue + sch.vatDue, totalDueSum - sch.penaltyDue - sch.trackingFeeDue);

    let nextStatus: ScheduledPayment['status'] = sch.status;
    const isMainActiveTerm = activeTermForRow3a && sch.id === activeTermForRow3a.id;
    const effectivePaidForStatus = isMainActiveTerm ? (totalPaidSum + totalPriorInterestPaidInThisAlloc) : totalPaidSum;

    if (sch.status === 'PAID') {
      nextStatus = 'PAID';
    } else if ((effectivePaidForStatus >= installmentTarget - 0.02 || totalPaidSum >= totalDueSum - 0.02 || (isMainActiveTerm && amountPaid >= installmentTarget - 0.02)) && (installmentTarget > 0 || totalDueSum > 0)) {
      nextStatus = 'PAID';
    } else if (contractObj?.paymentFrequency === 'ANNUAL' && totalPaidSum > 0) {
      nextStatus = 'PAID'; // Treat any payment as satisfying the term for tree planters
    } else if (totalPaidSum > 0) {
      nextStatus = 'PARTIAL';
    }

    let nextAccrued = sch.accruedInterest !== undefined ? sch.accruedInterest : 0;
    if (alloc.interest > 0) {
      nextAccrued = Math.max(0, Math.round((nextAccrued - alloc.interest) * 100) / 100);
    }

    updatedActiveSchedulesMap.set(sch.id, {
      ...sch,
      penaltyPaid: Math.round(newPenaltyPaid * 100) / 100,
      trackingFeePaid: Math.round(newTrackingPaid * 100) / 100,
      interestPaid: Math.round(newInterestPaid * 100) / 100,
      principalPaid: Math.round(newPrincipalPaid * 100) / 100,
      vatPaid: Math.round(newVatPaid * 100) / 100,
      totalPaid: Math.round(totalPaidSum * 100) / 100,
      accruedInterest: nextAccrued,
      status: nextStatus,
      lastUpdated: paymentDateStr,
      priority: sch.priority ?? sch.termNumber ?? 1
    });
  });

  const updatedScheduledPayments = allScheduledPayments.map(s => {
    if (updatedActiveSchedulesMap.has(s.id)) {
      return updatedActiveSchedulesMap.get(s.id)!;
    }
    return s;
  });

  return {
    updatedScheduledPayments,
    allocationItems,
    allocatedAmounts: {
      appliedPenalty: Math.round(totalPenaltyAlloc * 100) / 100,
      appliedTrackingFee: Math.round(totalTrackingFeeAlloc * 100) / 100,
      appliedInterest: Math.round(totalInterestAlloc * 100) / 100,
      appliedPrincipal: Math.round(totalPrincipalAlloc * 100) / 100,
      appliedVat: Math.round(totalVatAlloc * 100) / 100
    }
  };
}

/**
 * Generates list of daily date strings (YYYY-MM-DD) between two dates inclusive
 * (both start date and end date are included)
 */
export function getDaysListBetween(startDateStr: string | null | undefined, endDateStr: string | null | undefined): string[] {
  if (!startDateStr || !endDateStr) return [];
  const dates: string[] = [];
  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [];
  }
  
  let current = new Date(start);
  let limit = 0;
  while (current <= end && limit < 10000) {
    limit++;
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Calculates the outstanding principal of a contract on a specific date (YYYY-MM-DD).
 * The reduction in outstanding principal from a repayment is effective starting from
 * the payment date (as requested: on payment date, principal is reduced and daily interest
 * starting from payment date is calculated on the new reduced outstanding balance).
 */
export function getOutstandingPrincipalOnDate(
  contract: Contract,
  dateStr: string,
  schedules: ScheduledPayment[],
  repaymentsList: Repayment[] = [],
  _lastRepaymentDateStr: string = ''
): number {
  const params = getStoredParameters();
  const vatRateDecimal = params.vatRate / 100;
  const initialPrincipal = contract.productType === 'HP' 
    ? contract.creditLimit / (1 + vatRateDecimal) 
    : contract.disbursedAmount;
  
  const conCid = (contract.id || '').trim().toUpperCase();
  const contractRepayments = repaymentsList.filter(r => (r.contractId || '').trim().toUpperCase() === conCid);
  const contractSchedules = schedules.filter(s => (s.contractId || '').trim().toUpperCase() === conCid);

  const termPaymentMap = getTermPaymentDatesMap(contractSchedules, contractRepayments);

  // Chronological principal reductions
  const principalPayments: { date: string; amount: number; termNumber?: number }[] = [];

  // Add payments from contractRepayments
  contractRepayments.forEach(r => {
    if (r.paymentDate && (r.appliedPrincipal || 0) > 0) {
      principalPayments.push({
        date: r.paymentDate,
        amount: r.appliedPrincipal,
      });
    }
  });

  // Add paid schedules that might not have a separate repayment record
  contractSchedules.forEach(s => {
    if (s.status === 'PAID' || s.principalPaid > 0) {
      const pPaid = s.principalPaid || s.principalDue;
      if (pPaid > 0) {
        let payDate = termPaymentMap.get(s.termNumber);
        if (!payDate && s.lastUpdated) {
          payDate = s.lastUpdated.split(' ')[0];
        }
        if (!payDate) {
          payDate = s.dueDate;
        }
        const hasMatchingRepayment = principalPayments.some(p => 
          Math.abs(p.amount - pPaid) < 0.05 && (p.date === payDate || p.termNumber === s.termNumber)
        );
        if (!hasMatchingRepayment && payDate) {
          principalPayments.push({
            date: payDate,
            amount: pPaid,
            termNumber: s.termNumber
          });
        }
      }
    }
  });

  // Calculate sum of principal paid strictly on or before dateStr
  let totalPrincipalPaidUpToDate = 0;
  principalPayments.forEach(p => {
    if (p.date <= dateStr) {
      totalPrincipalPaidUpToDate += p.amount;
    }
  });

  const currentPrincipal = Math.max(0, initialPrincipal - totalPrincipalPaidUpToDate);

  // If there are no payments recorded after dateStr, and contract has a specific outstandingPrincipal,
  // we can use it if initialPrincipal is not set or to avoid minor rounding drift
  if (principalPayments.length === 0 && contract.outstandingPrincipal !== undefined && contract.outstandingPrincipal > 0) {
    return Number(contract.outstandingPrincipal.toFixed(2));
  }

  return Math.max(0, Number(currentPrincipal.toFixed(2)));
}

/**
 * Dynamic Daily Reducing-Balance Interest Recalculation
 * Runs through all unpaid scheduled payments for a contract and recalculates
 * interest and principal due based on the actual remaining outstanding principal.
 */
export function recalculateFutureSchedules(
  contract: Contract,
  schedules: ScheduledPayment[],
  lastRepaymentDateStr: string,
  repaymentsList: Repayment[] = [],
  firstDisburseDateStr?: string
): ScheduledPayment[] {
  const rate = contract.interestRate / 100;
  const params = getStoredParameters();
  const vatRateDecimal = params.vatRate / 100;

  let allRepayments = repaymentsList;
  if ((!allRepayments || allRepayments.length === 0) && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('lms_repayments');
      if (raw) {
        allRepayments = JSON.parse(raw);
      }
    } catch (e) {
      // ignore
    }
  }
  
  // Get all schedules of this contract, sorted by termNumber
  const conCid = (contract.id || '').trim().toUpperCase();
  const contractSchedules = schedules
    .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
    .sort((a, b) => a.termNumber - b.termNumber);

  if (contractSchedules.length === 0) {
    return schedules;
  }

  // Start chronological tracking of outstanding principal from the contract's initial disbursed limit/drawndown sum
  const initialPrincipal = contract.productType === 'HP' 
    ? contract.creditLimit / (1 + vatRateDecimal) 
    : contract.disbursedAmount;
  let outstandingPrincipal = initialPrincipal;

  const firstUnpaidIndex = contractSchedules.findIndex(s => s.status !== 'PAID');

  const contractRepayments = allRepayments.filter(r => (r.contractId || '').trim().toUpperCase() === conCid);
  const termPaymentMap = getTermPaymentDatesMap(contractSchedules, contractRepayments);

  const anchorStart = firstDisburseDateStr || contract.firstDisburseDate || contract.disburseDate || contract.startDate;

  const updatedSchedules = contractSchedules.map((sch, index) => {
    // Standard period boundaries for each term: start from currentAnchor, end at capDate - 1 day
    const currentAnchor = getTermAnchorDate(index, contractSchedules, anchorStart, termPaymentMap);
    
    // System date cutoff for accrued interest
    const sysDate = lastRepaymentDateStr || getSystemDateStr();

    let capDate = sch.dueDate;
    if (sysDate < sch.dueDate) {
      capDate = sysDate;
    }
    const currentEndDate = subtractDays(capDate, 1);

    // Full term interest calculation for schedule dues
    const fullTermCapDate = sch.dueDate;
    const fullTermEndDate = subtractDays(fullTermCapDate, 1);
    let interest = 0;
    if (fullTermEndDate >= currentAnchor) {
      if (contract.productType === 'LOAN' && contract.paymentFrequency === 'MONTHLY') {
        const daysList = getDaysListBetween(currentAnchor, fullTermEndDate);
        daysList.forEach(dayDate => {
          const dailyOutstanding = getOutstandingPrincipalOnDate(contract, dayDate, contractSchedules, allRepayments, sysDate);
          interest += dailyOutstanding * rate * (1 / 365);
        });
      } else if (contract.productType === 'LOAN' && contract.paymentFrequency === 'ANNUAL') {
        if (sch.termNumber === 1 && sch.interestDue === 0 && sch.principalDue === 0) {
          interest = 0; // Year 1 interest is prepaid upfront (upfront deduction) only if unassigned
        } else if (sch.interestDue > 0) {
          interest = sch.interestDue;
        } else {
          interest = outstandingPrincipal * rate; // Annual flat on outstanding
        }
      } else if (contract.productType === 'HP') {
        // Hire Purchase monthly interest amortized recalculation
        interest = outstandingPrincipal * (rate / 12);
      }
    } else {
      interest = sch.interestDue > 0 ? sch.interestDue : 0;
    }

    const roundedInterest = Math.round(interest * 100) / 100;

    // Check if this term had an early repayment
    const earlyPayDate = termPaymentMap.get(sch.termNumber) 
      || contractRepayments.find(r => r.paymentDate && r.paymentDate >= currentAnchor && r.paymentDate < sch.dueDate)?.paymentDate
      || (sch.status === 'PAID' && sch.lastUpdated && sch.lastUpdated.split(' ')[0] >= currentAnchor && sch.lastUpdated.split(' ')[0] < sch.dueDate ? sch.lastUpdated.split(' ')[0] : undefined);

    // Calculate accrued interest strictly up to system date (sysDate)
    // If early payment occurred in this term, interest before payment date was already settled; accrued interest is for days from earlyPayDate onwards
    let calculatedAccrued = 0;
    const accruedStartDate = (earlyPayDate && earlyPayDate < sch.dueDate && earlyPayDate >= currentAnchor)
      ? earlyPayDate
      : currentAnchor;

    if (sysDate >= accruedStartDate) {
      const accruedCapDate = sysDate < sch.dueDate ? sysDate : sch.dueDate;
      const accruedEndDate = subtractDays(accruedCapDate, 1);
      if (accruedEndDate >= accruedStartDate) {
        if (contract.productType === 'LOAN' && contract.paymentFrequency === 'MONTHLY') {
          const accruedDaysList = getDaysListBetween(accruedStartDate, accruedEndDate);
          accruedDaysList.forEach(dayDate => {
            if (dayDate <= sysDate) {
              const dailyOutstanding = getOutstandingPrincipalOnDate(contract, dayDate, contractSchedules, allRepayments, sysDate);
              calculatedAccrued += dailyOutstanding * rate * (1 / 365);
            }
          });
        } else if (contract.productType === 'LOAN' && contract.paymentFrequency === 'ANNUAL') {
          if (sch.termNumber > 1) {
            const totalDaysInTerm = Math.max(1, getDaysBetween(currentAnchor, subtractDays(sch.dueDate, 1)));
            const elapsedDays = Math.max(0, getDaysBetween(accruedStartDate, accruedEndDate));
            calculatedAccrued = (outstandingPrincipal * rate) * (elapsedDays / totalDaysInTerm);
          }
        } else if (contract.productType === 'HP') {
          const totalDaysInTerm = Math.max(1, getDaysBetween(currentAnchor, subtractDays(sch.dueDate, 1)));
          const elapsedDays = Math.max(0, getDaysBetween(accruedStartDate, accruedEndDate));
          calculatedAccrued = (outstandingPrincipal * (rate / 12)) * (elapsedDays / totalDaysInTerm);
        }
      }
    }
    const roundedAccruedInterest = Math.round(calculatedAccrued * 100) / 100;

    // Use initial PMT (principalDue + interestDue) as installment target
    const originalPMT = sch.principalDue + sch.interestDue;
    
    let principal = 0;
    const isLastTerm = index === contractSchedules.length - 1;

    // If explicit principalDue and interestDue are defined on schedule (e.g. from imported CSV or Supabase), preserve them
    const hasExplicitDues = sch.fromDb || sch.principalDue > 0 || sch.interestDue > 0;

    if (hasExplicitDues) {
      principal = sch.principalDue;
    } else if (isLastTerm) {
      principal = outstandingPrincipal;
    } else {
      principal = Math.max(0, Math.min(originalPMT - roundedInterest, outstandingPrincipal));
    }

    // Ensure we don't reduce principal/interest due below already paid amounts
    const finalInterestDue = hasExplicitDues ? sch.interestDue : Math.max(sch.interestPaid, roundedInterest);
    const finalPrincipalDue = hasExplicitDues ? sch.principalDue : Math.max(sch.principalPaid, principal);

    // Subtract from rolling chronological outstanding principal.
    // If HP: use sch.principalDue to keep future interest/principal dues fixed.
    // Otherwise, if PAID or PARTIAL up to this point, use actual paid. Otherwise, use projected finalPrincipalDue.
    const principalToSubtract = contract.productType === 'HP' 
      ? sch.principalDue 
      : (sch.status === 'PAID' ? (sch.principalPaid || sch.principalDue) : (sch.status === 'PARTIAL' ? sch.principalPaid : finalPrincipalDue));
    outstandingPrincipal = Math.max(0, Number((outstandingPrincipal - principalToSubtract).toFixed(2)));

    // HP tax and totals
    const vat = contract.productType === 'HP' ? (finalPrincipalDue + finalInterestDue) * vatRateDecimal : 0;
    const roundedVat = Math.round(vat * 100) / 100;

    const newTotalDue = (sch.fromDb && sch.totalDue !== undefined) ? sch.totalDue : Math.round((finalPrincipalDue + finalInterestDue + roundedVat + sch.penaltyDue + sch.trackingFeeDue) * 100) / 100;
    const installmentTarget = Math.max(finalPrincipalDue + finalInterestDue + roundedVat, originalPMT);

    // Check status: If totalPaid reaches installment target or total due, status is PAID regardless of allocation
    let status: ScheduledPayment['status'] = sch.status;
    const totalPaid = sch.principalPaid + sch.interestPaid + sch.vatPaid + sch.penaltyPaid + sch.trackingFeePaid;
    if (sch.status === 'PAID' || ((totalPaid >= installmentTarget - 0.02 || totalPaid >= newTotalDue - 0.02) && (installmentTarget > 0 || newTotalDue > 0))) {
      status = 'PAID';
    } else if (contract.paymentFrequency === 'ANNUAL' && totalPaid > 0) {
      status = 'PAID'; // Treat any payment as satisfying the term for tree planters
    } else if (totalPaid > 0) {
      status = 'PARTIAL';
    } else {
      status = sch.status === 'OVERDUE' ? 'OVERDUE' : 'NOT_PAID';
    }

    // Dynamic daily accrued interest based on actual remaining daily outstanding balance up to sysDate.
    // If this term is PAID and subsequent terms have also been paid, accrued interest was collected in next term -> 0.
    // If this term was PAID early and next term is not yet paid, remaining days in the term still accrue interest on new balance!
    const hasSubsequentPaidTerm = contractSchedules.some((other, oIdx) => 
      oIdx > index && (other.status === 'PAID' || other.status === 'PARTIAL' || (other.principalPaid + other.interestPaid) > 0)
    );

    let finalAccruedInterest = 0;
    if (status === 'PAID') {
      if (hasSubsequentPaidTerm) {
        finalAccruedInterest = 0;
      } else {
        if (earlyPayDate && earlyPayDate < sch.dueDate) {
          finalAccruedInterest = roundedAccruedInterest;
        } else if (sch.accruedInterest !== undefined && sch.accruedInterest > 0) {
          finalAccruedInterest = sch.accruedInterest;
        } else {
          finalAccruedInterest = 0;
        }
      }
    } else {
      finalAccruedInterest = Math.max(0, Math.round((roundedAccruedInterest - (earlyPayDate ? 0 : sch.interestPaid)) * 100) / 100);
    }

    return {
      ...sch,
      principalDue: (sch.status === 'PAID' || sch.fromDb) ? sch.principalDue : Math.round(finalPrincipalDue * 100) / 100,
      interestDue: (sch.status === 'PAID' || sch.fromDb) ? sch.interestDue : Math.round(finalInterestDue * 100) / 100,
      accruedInterest: finalAccruedInterest,
      vatDue: roundedVat,
      totalDue: newTotalDue,
      status
    };
  });

  // Merge the updated schedules list back into the main list
  return schedules.map(s => {
    if ((s.contractId || '').trim().toUpperCase() === conCid) {
      const updated = updatedSchedules.find(u => u.id === s.id || u.termNumber === s.termNumber);
      return updated ? updated : s;
    }
    return s;
  });
}

/**
 * Calculates a detailed breakdown of the daily interest calculation for a specific term of a contract.
 */
export function getInterestCalculationBreakdown(
  contract: Contract,
  termNumber: number,
  schedules: ScheduledPayment[],
  repaymentsList: Repayment[] = [],
  lastRepaymentDateStr: string = '',
  firstDisburseDateStr?: string
): InterestBreakdownPeriod[] {
  const sysDate = lastRepaymentDateStr || getSystemDateStr();
  const conCid = (contract.id || '').trim().toUpperCase();
  const sortedSchedules = schedules
    .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
    .sort((a, b) => a.termNumber - b.termNumber);
  
  if (sortedSchedules.length === 0) return [];
  
  const schIndex = sortedSchedules.findIndex(s => s.termNumber === termNumber);
  if (schIndex === -1) return [];
  const sch = sortedSchedules[schIndex];

  if (sch.status === 'PAID') {
    return [];
  }
  
  // Determine standard start and end dates for the daily interest calculation of this term
  const contractRepaymentsForBk = repaymentsList.filter(r => (r.contractId || '').trim().toUpperCase() === conCid);
  const termPaymentMapForBk = getTermPaymentDatesMap(sortedSchedules, contractRepaymentsForBk);
  const anchorStart = firstDisburseDateStr || contract.firstDisburseDate || contract.disburseDate || contract.startDate;
  const currentAnchor = getTermAnchorDate(schIndex, sortedSchedules, anchorStart, termPaymentMapForBk);

  if (sysDate < currentAnchor) {
    return [];
  }

  // Standard term end date is capDate - 1 day (where capDate is sch.dueDate or sysDate)
  let capDate = sch.dueDate;
  if (sysDate < sch.dueDate) {
    capDate = sysDate;
  }
  const currentEndDate = subtractDays(capDate, 1);
  if (currentEndDate < currentAnchor) {
    return [];
  }
  
  if (!(contract.productType === 'LOAN' && contract.paymentFrequency === 'MONTHLY')) {
    // For non-LOAN MONTHLY (e.g. HP or ANNUAL), calculation is flat or simple amortization per period
    const days = getDaysBetween(currentAnchor, currentEndDate);
    const rate = contract.interestRate / 100;
    let interest = 0;
    let principal = 0;
    
    if (contract.productType === 'HP') {
      const params = getStoredParameters();
      const vatRateDecimal = params.vatRate / 100;
      let prevOutstanding = contract.creditLimit / (1 + vatRateDecimal);
      for (let i = 0; i < schIndex; i++) {
        prevOutstanding -= sortedSchedules[i].principalDue;
      }
      principal = prevOutstanding;
      interest = principal * (rate / 12);
    } else {
      // LOAN ANNUAL
      let prevOutstanding = contract.disbursedAmount;
      for (let i = 0; i < schIndex; i++) {
        prevOutstanding -= sortedSchedules[i].principalPaid;
      }
      principal = prevOutstanding;
      interest = sch.termNumber === 1 ? 0 : principal * rate;
    }
    
    return [{
      startDate: currentAnchor,
      endDate: currentEndDate,
      daysCount: days,
      principal: Math.round(principal * 100) / 100,
      dailyRate: contract.interestRate,
      interestCharged: Math.round(interest * 100) / 100
    }];
  }

  const daysList = getDaysListBetween(currentAnchor, currentEndDate);
  const rate = contract.interestRate / 100;

  if (daysList.length === 0) return [];

  const rawDays: { date: string; principal: number; interest: number }[] = [];
  daysList.forEach(dayDate => {
    const dailyOutstanding = getOutstandingPrincipalOnDate(contract, dayDate, sortedSchedules, repaymentsList, lastRepaymentDateStr);
    const dailyInterest = dailyOutstanding * rate * (1 / 365);
    rawDays.push({
      date: dayDate,
      principal: dailyOutstanding,
      interest: dailyInterest
    });
  });

  // Group contiguous days with the same principal balance
  const periods: InterestBreakdownPeriod[] = [];
  let currentPeriod: {
    startDate: string;
    endDate: string;
    daysCount: number;
    principal: number;
    interestCharged: number;
  } | null = null;

  rawDays.forEach((day, i) => {
    if (!currentPeriod) {
      currentPeriod = {
        startDate: day.date,
        endDate: day.date,
        daysCount: 1,
        principal: day.principal,
        interestCharged: day.interest
      };
    } else if (Math.abs(currentPeriod.principal - day.principal) < 0.01) {
      currentPeriod.endDate = day.date;
      currentPeriod.daysCount += 1;
      currentPeriod.interestCharged += day.interest;
    } else {
      periods.push({
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
        daysCount: currentPeriod.daysCount,
        principal: Math.round(currentPeriod.principal * 100) / 100,
        dailyRate: contract.interestRate,
        interestCharged: Math.round(currentPeriod.interestCharged * 100) / 100
      });
      currentPeriod = {
        startDate: day.date,
        endDate: day.date,
        daysCount: 1,
        principal: day.principal,
        interestCharged: day.interest
      };
    }

    if (i === rawDays.length - 1 && currentPeriod) {
      periods.push({
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
        daysCount: currentPeriod.daysCount,
        principal: Math.round(currentPeriod.principal * 100) / 100,
        dailyRate: contract.interestRate,
        interestCharged: Math.round(currentPeriod.interestCharged * 100) / 100
      });
    }
  });

  return periods;
}

/**
 * Returns a day-by-day itemized log of accrued interest for a contract term.
 */
export function getDailyInterestLog(
  contract: Contract,
  termNumber: number,
  schedules: ScheduledPayment[],
  repaymentsList: Repayment[] = [],
  asOfDateStr: string = '',
  firstDisburseDateStr?: string
): DailyInterestLogEntry[] {
  const sysDate = asOfDateStr || getSystemDateStr();
  const conCid = (contract.id || '').trim().toUpperCase();
  const sortedSchedules = schedules
    .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
    .sort((a, b) => a.termNumber - b.termNumber);
  
  if (sortedSchedules.length === 0) return [];
  
  const schIndex = sortedSchedules.findIndex(s => s.termNumber === termNumber);
  if (schIndex === -1) return [];
  const sch = sortedSchedules[schIndex];
  
  const contractRepayments = repaymentsList.filter(r => (r.contractId || '').trim().toUpperCase() === conCid);
  const termPaymentMap = getTermPaymentDatesMap(sortedSchedules, contractRepayments);
  const anchorStart = firstDisburseDateStr || contract.firstDisburseDate || contract.disburseDate || contract.startDate;
  const currentAnchor = getTermAnchorDate(schIndex, sortedSchedules, anchorStart, termPaymentMap);
  
  if (sysDate < currentAnchor) {
    return [];
  }

  let capDate = sch.dueDate;
  if (sysDate < sch.dueDate) {
    capDate = sysDate;
  }
  const currentEndDate = subtractDays(capDate, 1);
  if (currentEndDate < currentAnchor) {
    return [];
  }

  const daysList = getDaysListBetween(currentAnchor, currentEndDate);
  const rate = contract.interestRate / 100;
  
  const log: DailyInterestLogEntry[] = [];
  let cum = 0;
  let prevRoundedCum = 0;

  daysList.forEach(dayDate => {
    if (dayDate <= sysDate) {
      const dailyOutstanding = getOutstandingPrincipalOnDate(contract, dayDate, sortedSchedules, repaymentsList, sysDate);
      const dailyInterestRaw = dailyOutstanding * rate * (1 / 365);
      cum += dailyInterestRaw;
      const roundedCum = Math.round(cum * 100) / 100;
      const dailyInterest = Math.round((roundedCum - prevRoundedCum) * 100) / 100;
      prevRoundedCum = roundedCum;

      log.push({
        date: dayDate,
        principal: Math.round(dailyOutstanding * 100) / 100,
        dailyRate: contract.interestRate,
        dailyInterest: dailyInterest,
        cumulativeInterest: roundedCum
      });
    }
  });

  return log;
}

/**
 * Generates itemized DailyAccruedInterest records for Supabase persistence
 * and allocates repayment amounts line-by-line.
 */
export function generateDailyAccruedInterestRecords(
  contract: Contract,
  termNumber: number,
  schedules: ScheduledPayment[],
  repaymentsList: Repayment[] = [],
  asOfDateStr: string = '',
  firstDisburseDateStr?: string,
  paidInterestForTerm: number = 0
): DailyAccruedInterest[] {
  const dailyLog = getDailyInterestLog(
    contract,
    termNumber,
    schedules,
    repaymentsList,
    asOfDateStr,
    firstDisburseDateStr
  );

  const conCid = (contract.id || '').trim().toUpperCase();
  const contractRepayments = repaymentsList
    .filter(r => (r.contractId || '').trim().toUpperCase() === conCid)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  const sortedSchedules = schedules
    .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
    .sort((a, b) => a.termNumber - b.termNumber);
  const schIndex = sortedSchedules.findIndex(s => s.termNumber === termNumber);
  const sch = schIndex !== -1 ? sortedSchedules[schIndex] : null;

  const hasSubsequentPaidTerm = sortedSchedules.some((other, oIdx) => 
    oIdx > schIndex && (other.status === 'PAID' || other.status === 'PARTIAL' || (other.principalPaid + other.interestPaid) > 0)
  );

  const termPaymentMap = getTermPaymentDatesMap(sortedSchedules, contractRepayments);
  const fallbackPayDate = sch 
    ? (termPaymentMap.get(termNumber) || sch.lastUpdated?.split(' ')[0] || sch.dueDate) 
    : '';

  return dailyLog.map((entry, idx) => {
    const seq = idx + 1;
    const dailyInt = entry.dailyInterest;
    const cumulativeAccrued = entry.cumulativeInterest;

    const anchorStart = firstDisburseDateStr || contract.firstDisburseDate || contract.disburseDate || contract.startDate;
    const currentAnchor = getTermAnchorDate(schIndex, sortedSchedules, anchorStart, termPaymentMap);

    const payDate = termPaymentMap.get(termNumber) 
      || contractRepayments.find(r => r.paymentDate && r.paymentDate >= currentAnchor && r.paymentDate <= (sch?.dueDate || ''))?.paymentDate
      || (sch?.status === 'PAID' && sch?.lastUpdated && sch.lastUpdated.split(' ')[0] >= currentAnchor && sch.lastUpdated.split(' ')[0] <= (sch?.dueDate || '') ? sch.lastUpdated.split(' ')[0] : undefined)
      || sch?.dueDate;

    let amountPaidForThisDay = 0;
    let outstanding = 0;
    let status: 'NOT_PAID' | 'PARTIAL' | 'PAID' = 'NOT_PAID';

    if (sch && sch.status === 'PAID') {
      if (payDate && payDate < sch.dueDate) {
        // Early paid term:
        if (entry.date < payDate) {
          // Days prior to payment date: fully settled by repayment on payDate
          amountPaidForThisDay = dailyInt;
          outstanding = 0;
          status = 'PAID';
        } else {
          // Days on or after payment date (entry.date >= payDate):
          if (hasSubsequentPaidTerm) {
            // Paid in subsequent term
            amountPaidForThisDay = dailyInt;
            outstanding = 0;
            status = 'PAID';
          } else {
            amountPaidForThisDay = 0;
            const daysFromPayDate = dailyLog.slice(0, idx + 1).filter(d => d.date >= payDate);
            outstanding = Math.round(daysFromPayDate.reduce((sum, d) => sum + d.dailyInterest, 0) * 100) / 100;
            status = 'NOT_PAID';
          }
        }
      } else {
        // Paid on or after due date: completely paid
        amountPaidForThisDay = dailyInt;
        outstanding = 0;
        status = 'PAID';
      }
    } else {
      // Normal schedule (NOT_PAID or PARTIAL)
      // Calculate interest paid by repayments on or before entry.date for this term
      let interestPaidToDate = 0;
      let foundRepayment = false;

      contractRepayments.forEach(r => {
        if (r.paymentDate && r.paymentDate <= entry.date) {
          if (r.distributionDetails && Array.isArray(r.distributionDetails)) {
            const termDet = r.distributionDetails.find(d => d.termNumber === termNumber);
            if (termDet) {
              interestPaidToDate += (termDet.interest || 0);
              foundRepayment = true;
            }
          } else {
            const matchedTerm = Array.from(termPaymentMap.entries()).find(([t, pDate]) => pDate === r.paymentDate)?.[0];
            if (matchedTerm === termNumber || (!matchedTerm && sortedSchedules.length === 1)) {
              interestPaidToDate += (r.appliedInterest || 0);
              foundRepayment = true;
            }
          }
        }
      });

      if (!foundRepayment && paidInterestForTerm > 0 && fallbackPayDate && entry.date >= fallbackPayDate) {
        interestPaidToDate = paidInterestForTerm;
      }

      const prevCumAccrued = idx > 0 ? dailyLog[idx - 1].cumulativeInterest : 0;
      const effectivePaidInterest = Math.max(interestPaidToDate, paidInterestForTerm, sch ? (sch.interestPaid || 0) : 0);

      amountPaidForThisDay = Math.max(0, Math.min(dailyInt, effectivePaidInterest - prevCumAccrued));
      const totalCutInterest = Math.min(cumulativeAccrued, effectivePaidInterest);
      outstanding = Math.max(0, Math.round((cumulativeAccrued - totalCutInterest) * 100) / 100);

      if (outstanding <= 0.001) {
        status = 'PAID';
        outstanding = 0;
      } else if (amountPaidForThisDay > 0) {
        status = 'PARTIAL';
      }
    }

    const roundedAmountPaid = Math.round(amountPaidForThisDay * 100) / 100;

    return {
      id: `ACC-${contract.id}-T${termNumber}-${seq}`,
      contractId: contract.id,
      termNumber,
      seq,
      entryDate: entry.date,
      principalBalance: entry.principal,
      interestRate: entry.dailyRate,
      dailyInterest: dailyInt,
      accumulatedInterest: cumulativeAccrued,
      amountPaid: roundedAmountPaid,
      outstandingInterest: outstanding,
      status
    };
  });
}


