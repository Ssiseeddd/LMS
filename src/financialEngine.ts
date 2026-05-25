/**
 * Financial Calculation Engine for LMS Web Application
 */

import { Contract, ScheduledPayment, Repayment, RepaymentAllocationItem, Disbursement } from './types';

function getStoredParameters() {
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

/**
 * Calculates days between two date strings
 */
export function getDaysBetween(d1: string, d2: string): number {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Adds months to a date, preserving or adjusting day of month
 */
export function addMonths(dateStr: string, months: number, targetDueDay: number): string {
  const date = new Date(dateStr);
  let year = date.getFullYear();
  let month = date.getMonth() + months;
  
  // Handle year overflow
  year += Math.floor(month / 12);
  month = month % 12;
  if (month < 0) {
    month += 12;
    year -= 1;
  }
  
  // Set to target due day
  const targetDate = new Date(year, month, targetDueDay);
  
  // Ensure we format as YYYY-MM-DD
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
 * Generates an initial scheduled payment plan for a contract
 */
export function generateInitialSchedule(
  contract: Contract,
  disbursedAmount: number,
  disburseDate: string
): ScheduledPayment[] {
  const schedule: ScheduledPayment[] = [];
  const start = new Date(disburseDate);
  const rate = contract.interestRate / 100;
  const params = getStoredParameters();
  const vatRateDecimal = params.vatRate / 100;

  if (contract.productType === 'HP') {
    // Hire Purchase: Single full drawdown, monthly installments with dynamic VAT on each installment
    const pmtExVat = calculatePMT(disbursedAmount, contract.interestRate, contract.termMonths);
    let remainingPrincipal = disbursedAmount;

    for (let i = 1; i <= contract.termMonths; i++) {
      const dueDate = addMonths(disburseDate, i, contract.dueDay);
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
    // Normal Loan, Monthly, Days/365, no VAT
    const pmt = calculatePMT(disbursedAmount, contract.interestRate, contract.termMonths);
    let remainingPrincipal = disbursedAmount;
    let lastDueDate = disburseDate;

    for (let i = 1; i <= contract.termMonths; i++) {
      const dueDate = addMonths(disburseDate, i, contract.dueDay);
      const days = getDaysBetween(lastDueDate, dueDate);
      const interest = remainingPrincipal * rate * (days / 365);
      const principal = Math.min(pmt - interest, remainingPrincipal);

      schedule.push({
        id: `${contract.id}-SCH-${i}`,
        contractId: contract.id,
        termNumber: i,
        dueDate,
        principalDue: Math.round(principal * 100) / 100,
        interestDue: Math.round(interest * 100) / 100,
        vatDue: 0,
        penaltyDue: 0,
        trackingFeeDue: 0,
        totalDue: Math.round((principal + interest) * 100) / 100,
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
  currentDateStr: string = '2026-05-22'
): { updatedSchedules: ScheduledPayment[]; updatedContracts: Contract[] } {
  const today = new Date(currentDateStr);
  const gracePeriodDays = 3; // e.g. 3 days before charging penalty
  const params = getStoredParameters();
  const penaltyRateDecimal = params.penaltyRate / 100;
  const vatRateDecimal = params.vatRate / 100;

  // Pre-calculate consecutive overdue streaks per contract
  const contractOverdueStreaks: { [contractId: string]: { [termNumber: number]: number } } = {};
  const uniqContractIds = Array.from(new Set(scheduledPayments.map(s => s.contractId)));

  for (const cid of uniqContractIds) {
    const cSchedules = scheduledPayments
      .filter(s => s.contractId === cid)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      
    let streak = 0;
    contractOverdueStreaks[cid] = {};
    for (const s of cSchedules) {
      const unpaidP = s.principalDue - s.principalPaid;
      const unpaidI = s.interestDue - s.interestPaid;
      const isOverdue = (new Date(s.dueDate) < today && (unpaidP > 0 || unpaidI > 0));
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
    const contract = contracts.find(c => c.id === sch.contractId);
    if (!contract || contract.status === 'CLOSED') return sch;

    const due = new Date(sch.dueDate);
    const unpaidPrincipal = sch.principalDue - sch.principalPaid;
    const unpaidInterest = sch.interestDue - sch.interestPaid;

    if (due < today && (unpaidPrincipal > 0 || unpaidInterest > 0)) {
      const daysOverdue = Math.max(0, getDaysBetween(sch.dueDate, currentDateStr));
      
      // Calculate Tracking Fee (ค่าติดตามทวงถาม)
      // HP: Has VAT
      // Loan also has VAT for tracking fee as requested.
      // Single terms overdue -> Tier 1 (50) + VAT. 2+ terms overdue consecutive -> Tier 2 (100) + VAT.
      // No tracking fee if unpaid principal is <= 1000 THB
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
      }

      // Penalty (ค่าเบี้ยปรับ): dynamic penaltyRate% per annum on unpaid principal after grace period
      let penalty = 0;
      if (daysOverdue > gracePeriodDays && unpaidPrincipal > 0) {
        penalty = unpaidPrincipal * penaltyRateDecimal * (daysOverdue / 365);
      }

      const totalPenalty = Math.round(penalty * 100) / 100;
      const totalTrackingFee = Math.round((trackingFee + trackingVat) * 100) / 100;

      return {
        ...sch,
        status: 'OVERDUE' as const,
        penaltyDue: totalPenalty,
        trackingFeeDue: totalTrackingFee,
        totalDue: Math.round((sch.principalDue + sch.interestDue + sch.vatDue + totalPenalty + totalTrackingFee) * 100) / 100,
        lastUpdated: currentDateStr
      };
    } else if (sch.status === 'NOT_PAID' && overdueWithinGracePeriod(sch.dueDate, currentDateStr)) {
      // 15 days before due date, show invoice/billing request.
      const daysUntilDue = getDaysBetween(currentDateStr, sch.dueDate);
      if (due >= today && daysUntilDue <= 15) {
        return {
          ...sch,
          status: 'NOT_PAID' as const,
          lastUpdated: currentDateStr
        };
      }
    }
    
    return sch;
  });

  // Highlight Default contracts
  const updatedContracts = contracts.map(con => {
    const overdueItems = schedulesCopy.filter(s => s.contractId === con.id && s.status === 'OVERDUE');
    if (overdueItems.length >= 2) {
      return { ...con, status: 'DEFAULT' as const };
    }
    return con;
  });

  return { updatedSchedules: schedulesCopy, updatedContracts };
}

function overdueWithinGracePeriod(dueDate: string, todayStr: string): boolean {
  const d = new Date(dueDate);
  const today = new Date(todayStr);
  const diffTime = d.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 15 && diffDays >= -3;
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
  contractVatRate: number = 0
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
  // Filter and sort schedules for this contract by dueDate
  const activeSchedules = allScheduledPayments
    .filter(s => s.contractId === contractId)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  let remainingCash = amountPaid;
  const allocationItems: RepaymentAllocationItem[] = [];

  let totalPenaltyAlloc = 0;
  let totalTrackingFeeAlloc = 0;
  let totalInterestAlloc = 0;
  let totalPrincipalAlloc = 0;
  let totalVatAlloc = 0;

  const updatedSchedules = allScheduledPayments.map(originSch => {
    // If it's not of this contract, keep original
    if (originSch.contractId !== contractId) return originSch;

    // Find our copy
    const sch = activeSchedules.find(s => s.id === originSch.id);
    if (!sch || sch.status === 'PAID') return originSch;

    // Calculate dynamic dues
    const penaltyOwed = sch.penaltyDue - sch.penaltyPaid;
    const trackingOwed = sch.trackingFeeDue - sch.trackingFeePaid;
    const interestOwed = sch.interestDue - sch.interestPaid;
    const principalOwed = sch.principalDue - sch.principalPaid;
    const vatOwed = sch.vatDue - sch.vatPaid;

    let termPenaltyPaid = 0;
    let termTrackingPaid = 0;
    let termInterestPaid = 0;
    let termPrincipalPaid = 0;
    let termVatPaid = 0;

    // 1. Allocate to Penalty of this term
    if (remainingCash > 0 && penaltyOwed > 0) {
      const pay = Math.min(remainingCash, penaltyOwed);
      termPenaltyPaid += pay;
      remainingCash -= pay;
    }

    // 2. Allocate to Tracking Fee of this term
    if (remainingCash > 0 && trackingOwed > 0) {
      const pay = Math.min(remainingCash, trackingOwed);
      termTrackingPaid += pay;
      remainingCash -= pay;
    }

    // 3. Allocate to Interest of this term
    if (remainingCash > 0 && interestOwed > 0) {
      const pay = Math.min(remainingCash, interestOwed);
      termInterestPaid += pay;
      remainingCash -= pay;
    }

    // 4. Allocate to Principal (+ VAT if HP) of this term
    // Usually, VAT is linked to matching Principal + Interest installments.
    // For simplicity, we pay VAT first or parallel. Let's process VAT paid and Principal paid.
    if (remainingCash > 0 && vatOwed > 0) {
      const pay = Math.min(remainingCash, vatOwed);
      termVatPaid += pay;
      remainingCash -= pay;
    }

    if (remainingCash > 0 && principalOwed > 0) {
      const pay = Math.min(remainingCash, principalOwed);
      termPrincipalPaid += pay;
      remainingCash -= pay;
    }

    // Record allocation if any payment made to this terms
    const totalTermPaid = termPenaltyPaid + termTrackingPaid + termInterestPaid + termPrincipalPaid + termVatPaid;
    if (totalTermPaid > 0) {
      allocationItems.push({
        termNumber: sch.termNumber,
        penalty: Math.round(termPenaltyPaid * 100) / 100,
        trackingFee: Math.round(termTrackingPaid * 100) / 100,
        interest: Math.round(termInterestPaid * 100) / 100,
        principal: Math.round(termPrincipalPaid * 100) / 100,
        vat: Math.round(termVatPaid * 100) / 100,
        total: Math.round(totalTermPaid * 100) / 100
      });

      totalPenaltyAlloc += termPenaltyPaid;
      totalTrackingFeeAlloc += termTrackingPaid;
      totalInterestAlloc += termInterestPaid;
      totalPrincipalAlloc += termPrincipalPaid;
      totalVatAlloc += termVatPaid;
    }

    // Update state of this scheduled payment
    const newPenaltyPaid = sch.penaltyPaid + termPenaltyPaid;
    const newTrackingPaid = sch.trackingFeePaid + termTrackingPaid;
    const newInterestPaid = sch.interestPaid + termInterestPaid;
    const newPrincipalPaid = sch.principalPaid + termPrincipalPaid;
    const newVatPaid = sch.vatPaid + termVatPaid;
    const totalPaidSum = newPenaltyPaid + newTrackingPaid + newInterestPaid + newPrincipalPaid + newVatPaid;
    const totalDueSum = sch.principalDue + sch.interestDue + sch.vatDue + sch.penaltyDue + sch.trackingFeeDue;

    let nextStatus: 'NOT_PAID' | 'PARTIAL' | 'PAID' = 'NOT_PAID';
    if (totalPaidSum >= totalDueSum - 0.02) {
      nextStatus = 'PAID';
    } else if (totalPaidSum > 0) {
      nextStatus = 'PARTIAL';
    }

    return {
      ...sch,
      penaltyPaid: Math.round(newPenaltyPaid * 100) / 100,
      trackingFeePaid: Math.round(newTrackingPaid * 100) / 100,
      interestPaid: Math.round(newInterestPaid * 100) / 100,
      principalPaid: Math.round(newPrincipalPaid * 100) / 100,
      vatPaid: Math.round(newVatPaid * 100) / 100,
      totalPaid: Math.round(totalPaidSum * 100) / 100,
      status: nextStatus,
      lastUpdated: paymentDateStr
    };
  });

  return {
    updatedScheduledPayments: updatedSchedules,
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
 * Dynamic Daily Reducing-Balance Interest Recalculation
 * Runs through all unpaid scheduled payments for a contract and recalculates
 * interest and principal due based on the actual remaining outstanding principal.
 */
export function recalculateFutureSchedules(
  contract: Contract,
  schedules: ScheduledPayment[],
  lastRepaymentDateStr: string
): ScheduledPayment[] {
  const rate = contract.interestRate / 100;
  const params = getStoredParameters();
  const vatRateDecimal = params.vatRate / 100;
  
  // Get all schedules of this contract, sorted by due date
  const contractSchedules = schedules
    .filter(s => s.contractId === contract.id)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Let's track outstanding principal as we go through unpaid terms
  let outstandingPrincipal = contract.outstandingPrincipal;

  // Track the previous dueDate or contract startDate to compute days between periods
  let lastAnchorDate = contract.startDate;

  const updatedSchedules = contractSchedules.map((sch, index) => {
    if (sch.status === 'PAID') {
      // For fully paid schedules, they are settled. We carry forward their boundary anchor
      lastAnchorDate = sch.dueDate;
      return sch;
    }

    // Calculate days elapsed for this specific term
    const days = getDaysBetween(lastAnchorDate, sch.dueDate);
    
    // Calculate daily interest based on outstandingPrincipal
    let interest = 0;
    if (contract.productType === 'LOAN' && contract.paymentFrequency === 'MONTHLY') {
      interest = outstandingPrincipal * rate * (days / 365);
    } else if (contract.productType === 'LOAN' && contract.paymentFrequency === 'ANNUAL') {
      if (sch.termNumber === 1) {
        interest = 0; // Year 1 interest is prepaid upfront (upfront deduction)
      } else {
        interest = outstandingPrincipal * rate; // Annual flat on outstanding
      }
    } else if (contract.productType === 'HP') {
      // Hire Purchase monthly interest amortized recalculation
      interest = outstandingPrincipal * (rate / 12);
    }

    const roundedInterest = Math.round(interest * 100) / 100;

    // Use initial PMT (principalDue + interestDue) as installment target
    const originalPMT = sch.principalDue + sch.interestDue;
    
    let principal = 0;
    const isLastTerm = index === contractSchedules.length - 1;

    if (isLastTerm) {
      principal = outstandingPrincipal;
    } else {
      principal = Math.max(0, Math.min(originalPMT - roundedInterest, outstandingPrincipal));
    }

    // Ensure we don't reduce principal/interest due below already paid amounts
    const finalInterestDue = Math.max(sch.interestPaid, roundedInterest);
    const finalPrincipalDue = Math.max(sch.principalPaid, principal);

    // Calculate principal actually allocated for amortization in this term
    const unpaidPrincipalInTerm = Math.max(0, finalPrincipalDue - sch.principalPaid);
    
    // Subtract from rolling outstanding principal balance
    outstandingPrincipal = Math.max(0, Number((outstandingPrincipal - unpaidPrincipalInTerm).toFixed(2)));

    // HP tax and totals
    const vat = contract.productType === 'HP' ? (finalPrincipalDue + finalInterestDue) * vatRateDecimal : 0;
    const roundedVat = Math.round(vat * 100) / 100;

    const newTotalDue = Math.round((finalPrincipalDue + finalInterestDue + roundedVat + sch.penaltyDue + sch.trackingFeeDue) * 100) / 100;

    // Check status
    let status: ScheduledPayment['status'] = sch.status;
    const totalPaid = sch.principalPaid + sch.interestPaid + sch.vatPaid + sch.penaltyPaid + sch.trackingFeePaid;
    if (totalPaid >= newTotalDue - 0.02 && newTotalDue > 0) {
      status = 'PAID';
    } else if (totalPaid > 0) {
      status = 'PARTIAL';
    } else {
      // Retain OVERDUE if it was overdue
      status = sch.status === 'OVERDUE' ? 'OVERDUE' : 'NOT_PAID';
    }

    lastAnchorDate = sch.dueDate;

    return {
      ...sch,
      principalDue: Math.round(finalPrincipalDue * 100) / 100,
      interestDue: Math.round(finalInterestDue * 100) / 100,
      vatDue: roundedVat,
      totalDue: newTotalDue,
      status
    };
  });

  // Merge the updated schedules list back into the main list
  return schedules.map(s => {
    if (s.contractId === contract.id) {
      const updated = updatedSchedules.find(u => u.id === s.id);
      return updated ? updated : s;
    }
    return s;
  });
}
