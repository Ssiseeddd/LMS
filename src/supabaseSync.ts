import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { Contract, Disbursement, ScheduledPayment, Repayment, DailyAccruedInterest } from './types';
import { 
  getContracts, 
  getDisbursements, 
  getScheduledPayments, 
  getRepayments,
  getDailyAccruedInterests,
  saveDailyAccruedInterests,
  saveScheduledPayments,
  getFirstDisbursementDate,
  getSystemDate
} from './dbStore';
import { generateDailyAccruedInterestRecords } from './financialEngine';

// === MAP HELPERS ===

export function mapContractToDb(c: Contract) {
  const disburseDateClean = cleanDateString(c.firstDisburseDate || c.disburseDate || c.startDate);
  return {
    id: c.id,
    customer_name: c.customerName,
    customer_tax_id: c.customerTaxId,
    customer_phone: c.customerPhone,
    customer_address: c.customerAddress || '',
    product_type: c.productType,
    credit_limit: c.creditLimit,
    interest_rate: c.interestRate,
    start_date: cleanDateString(c.startDate),
    disburse_date: disburseDateClean,
    first_disburse_date: disburseDateClean,
    term_months: c.termMonths !== undefined && c.termMonths !== null ? c.termMonths : null,
    due_day: c.dueDay !== undefined && c.dueDay !== null ? c.dueDay : null,
    payment_frequency: c.paymentFrequency,
    service_fee: c.serviceFee,
    tree_cut_option: c.treeCutOption,
    outstanding_principal: c.outstandingPrincipal,
    disbursed_amount: c.disbursedAmount,
    installment_amount: c.installmentAmount !== undefined && c.installmentAmount !== null ? c.installmentAmount : null,
    status: c.status,
    created_at: cleanDateString(c.createdAt) || new Date().toISOString().split('T')[0],
    planting_type: c.plantingType || null,
    planting_area_rai: c.plantingAreaRai !== undefined ? c.plantingAreaRai : null,
    planting_tree_count: c.plantingTreeCount !== undefined ? c.plantingTreeCount : null,
    planting_province: c.plantingProvince || null,
    planting_district: c.plantingDistrict || null,
    planting_subdistrict: c.plantingSubdistrict || null
  };
}

export function mapDbToContract(row: any): Contract {
  let startDateStr = row.start_date || row.startDate;
  if (startDateStr && typeof startDateStr === 'string') {
    startDateStr = startDateStr.split('T')[0].split(' ')[0];
  }
  let firstDisburseStr = row.disburse_date || row.first_disburse_date || row.disburseDate || row.firstDisburseDate || row.disbursed_date;
  if (firstDisburseStr && typeof firstDisburseStr === 'string') {
    firstDisburseStr = firstDisburseStr.split('T')[0].split(' ')[0];
  }
  let firstPaymentStr = row.first_payment_date || row.firstPaymentDate;
  if (firstPaymentStr && typeof firstPaymentStr === 'string') {
    firstPaymentStr = firstPaymentStr.split('T')[0].split(' ')[0];
  }
  return {
    id: String(row.id || '').trim(),
    customerName: row.customer_name || row.customerName || '',
    customerTaxId: row.customer_tax_id || row.customerTaxId || '',
    customerPhone: row.customer_phone || row.customerPhone || '',
    customerAddress: row.customer_address || row.customerAddress || '',
    productType: row.product_type || row.productType,
    creditLimit: Number(row.credit_limit ?? row.creditLimit ?? 0),
    interestRate: Number(row.interest_rate ?? row.interestRate ?? 0),
    startDate: startDateStr || '',
    firstDisburseDate: firstDisburseStr || undefined,
    disburseDate: firstDisburseStr || undefined,
    firstPaymentDate: firstPaymentStr || undefined,
    termMonths: row.term_months ?? row.termMonths ?? undefined,
    dueDay: row.due_day ?? row.dueDay ?? undefined,
    paymentFrequency: row.payment_frequency || row.paymentFrequency,
    serviceFee: Number(row.service_fee ?? row.serviceFee ?? 0),
    treeCutOption: !!(row.tree_cut_option ?? row.treeCutOption),
    outstandingPrincipal: Number(row.outstanding_principal ?? row.outstandingPrincipal ?? 0),
    disbursedAmount: Number(row.disbursed_amount ?? row.disbursedAmount ?? 0),
    installmentAmount: row.installment_amount ?? row.installmentAmount ?? undefined,
    status: row.status,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    plantingType: row.planting_type || row.plantingType || undefined,
    plantingAreaRai: row.planting_area_rai ?? row.plantingAreaRai ?? undefined,
    plantingTreeCount: row.planting_tree_count ?? row.plantingTreeCount ?? undefined,
    plantingProvince: row.planting_province || row.plantingProvince || undefined,
    plantingDistrict: row.planting_district || row.plantingDistrict || undefined,
    plantingSubdistrict: row.planting_subdistrict || row.plantingSubdistrict || undefined
  };
}

export function mapDisbursementToDb(d: Disbursement) {
  return {
    id: d.id,
    contract_id: d.contractId,
    amount: Number(d.amount),
    disburse_date: cleanDateString(d.disburseDate),
    batch_number: d.batchNumber,
    upfront_interest: d.upfrontInterest,
    upfront_fee: d.upfrontFee,
    net_received: d.netReceived,
    description: d.description
  };
}

export function mapDbToDisbursement(row: any): Disbursement {
  let disburseDateStr = row.disburse_date || row.disburseDate;
  if (disburseDateStr && typeof disburseDateStr === 'string') {
    disburseDateStr = disburseDateStr.split('T')[0].split(' ')[0];
  }
  return {
    id: String(row.id || ''),
    contractId: String(row.contract_id || row.contractId || '').trim(),
    amount: Number(row.amount || 0),
    disburseDate: disburseDateStr || '',
    batchNumber: Number(row.batch_number ?? row.batchNumber ?? 1),
    upfrontInterest: Number(row.upfront_interest ?? row.upfrontInterest ?? 0),
    upfrontFee: Number(row.upfront_fee ?? row.upfrontFee ?? 0),
    netReceived: Number(row.net_received ?? row.netReceived ?? 0),
    description: row.description || ''
  };
}

export function mapScheduledPaymentToDb(s: ScheduledPayment) {
  return {
    id: s.id,
    contract_id: s.contractId,
    term_number: s.termNumber,
    due_date: cleanDateString(s.dueDate),
    principal_due: s.principalDue,
    interest_due: s.interestDue,
    vat_due: s.vatDue,
    penalty_due: s.penaltyDue,
    tracking_fee_due: s.trackingFeeDue,
    total_due: s.totalDue,
    principal_paid: s.principalPaid,
    interest_paid: s.interestPaid,
    vat_paid: s.vatPaid,
    penalty_paid: s.penaltyPaid,
    tracking_fee_paid: s.trackingFeePaid,
    total_paid: s.totalPaid,
    status: s.status,
    last_updated: cleanDateString(s.lastUpdated) || new Date().toISOString().split('T')[0],
    pending_disbursement: s.pendingDisbursement || 0,
    priority: s.priority ?? s.termNumber ?? 1,
    accrued_interest: s.accruedInterest ?? 0
  };
}

function cleanDateString(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'null' || trimmed.includes('NaN')) return '';

    // Extract date portion before time (e.g. "17/6/2026 0:00" -> "17/6/2026")
    const dateOnly = trimmed.split('T')[0].split(' ')[0].trim();
    if (!dateOnly) return '';

    // Check DD/MM/YYYY or DD-MM-YYYY
    const slashMatch = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (slashMatch) {
      const d = parseInt(slashMatch[1], 10);
      const m = parseInt(slashMatch[2], 10);
      let y = parseInt(slashMatch[3], 10);
      if (y > 2500) y -= 543;
      else if (y < 100) y += 2000;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Check YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = dateOnly.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (isoMatch) {
      let y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (y > 2500) y -= 543;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    return dateOnly;
  }
  return String(raw).split('T')[0].split(' ')[0];
}

export function mapDbToScheduledPayment(row: any, fallbackTermNum?: number): ScheduledPayment {
  const rawValue = row.due_date || row.dueDate;
  const dueDateStr = cleanDateString(rawValue);

  let termNum: number | undefined = undefined;
  const rawTerm = row.term_number ?? row.termNumber ?? row.term_no ?? row.termNo ?? row.term ?? row.installment ?? row.installment_no;
  if (rawTerm !== undefined && rawTerm !== null && rawTerm !== '') {
    const parsed = Number(rawTerm);
    if (!isNaN(parsed) && parsed > 0) {
      termNum = parsed;
    }
  }

  if (!termNum && row.id) {
    const match = String(row.id).match(/(?:SCH|TERM|งวด)[-_]?(\d+)/i) || String(row.id).match(/-(\d+)$/);
    if (match && match[1]) {
      const parsedIdNum = parseInt(match[1], 10);
      if (!isNaN(parsedIdNum) && parsedIdNum > 0) {
        termNum = parsedIdNum;
      }
    }
  }

  if (!termNum && fallbackTermNum && fallbackTermNum > 0) {
    termNum = fallbackTermNum;
  }

  return {
    id: String(row.id || ''),
    contractId: String(row.contract_id || row.contractId || '').trim(),
    termNumber: termNum ?? 1,
    dueDate: dueDateStr || '',
    rawDbDueDate: rawValue !== undefined && rawValue !== null ? String(rawValue) : undefined,
    fromDb: true,
    pendingDisbursement: Number(row.pending_disbursement ?? row.pendingDisbursement ?? 0),
    principalDue: Number(row.principal_due ?? row.principalDue ?? 0),
    interestDue: Number(row.interest_due ?? row.interestDue ?? 0),
    vatDue: Number(row.vat_due ?? row.vatDue ?? 0),
    penaltyDue: Number(row.penalty_due ?? row.penaltyDue ?? 0),
    trackingFeeDue: Number(row.tracking_fee_due ?? row.trackingFeeDue ?? 0),
    totalDue: Number(row.total_due ?? row.totalDue ?? 0),
    principalPaid: Number(row.principal_paid ?? row.principalPaid ?? 0),
    interestPaid: Number(row.interest_paid ?? row.interestPaid ?? 0),
    vatPaid: Number(row.vat_paid ?? row.vatPaid ?? 0),
    penaltyPaid: Number(row.penalty_paid ?? row.penaltyPaid ?? 0),
    trackingFeePaid: Number(row.tracking_fee_paid ?? row.trackingFeePaid ?? 0),
    totalPaid: Number(row.total_paid ?? row.totalPaid ?? 0),
    status: row.status,
    lastUpdated: cleanDateString(row.last_updated || row.lastUpdated || new Date().toISOString().split('T')[0]),
    priority: row.priority !== undefined && row.priority !== null ? Number(row.priority) : (termNum ?? 1),
    accruedInterest: Number(row.accrued_interest ?? row.accruedInterest ?? 0)
  };
}

export function mapRepaymentToDb(r: Repayment) {
  return {
    id: r.id,
    contract_id: r.contractId,
    payment_date: cleanDateString(r.paymentDate),
    amount_paid: r.amountPaid,
    receipt_no: r.receiptNo,
    applied_penalty: r.appliedPenalty,
    applied_tracking_fee: r.appliedTrackingFee,
    applied_interest: r.appliedInterest,
    applied_principal: r.appliedPrincipal,
    applied_vat: r.appliedVat,
    distribution_details: r.distributionDetails,
    outstanding: r.outstandingPrincipal !== undefined ? r.outstandingPrincipal : null,
    outstanding_principal: r.outstandingPrincipal !== undefined ? r.outstandingPrincipal : null,
    created_at: cleanDateString(r.createdAt) || new Date().toISOString().split('T')[0]
  };
}

export function mapDbToRepayment(row: any): Repayment {
  let paymentDateStr = row.payment_date || row.paymentDate;
  if (paymentDateStr && typeof paymentDateStr === 'string') {
    paymentDateStr = paymentDateStr.split('T')[0].split(' ')[0];
  }
  const rawOutstanding = row.outstanding !== undefined && row.outstanding !== null
    ? row.outstanding
    : (row.outstanding_principal !== undefined && row.outstanding_principal !== null 
      ? row.outstanding_principal 
      : row.outstandingPrincipal);

  return {
    id: String(row.id || ''),
    contractId: String(row.contract_id || row.contractId || '').trim(),
    paymentDate: paymentDateStr || '',
    amountPaid: Number(row.amount_paid ?? row.amountPaid ?? 0),
    receiptNo: row.receipt_no || row.receiptNo || '',
    appliedPenalty: Number(row.applied_penalty ?? row.appliedPenalty ?? 0),
    appliedTrackingFee: Number(row.applied_tracking_fee ?? row.appliedTrackingFee ?? 0),
    appliedInterest: Number(row.applied_interest ?? row.appliedInterest ?? 0),
    appliedPrincipal: Number(row.applied_principal ?? row.appliedPrincipal ?? 0),
    appliedVat: Number(row.applied_vat ?? row.appliedVat ?? 0),
    distributionDetails: row.distribution_details || row.distributionDetails || undefined,
    outstandingPrincipal: rawOutstanding !== undefined && rawOutstanding !== null ? Number(rawOutstanding) : undefined,
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}

export function mapDailyAccruedInterestToDb(a: DailyAccruedInterest) {
  return {
    id: a.id,
    contract_id: a.contractId,
    term_number: a.termNumber,
    seq: a.seq,
    entry_date: cleanDateString(a.entryDate),
    principal_balance: a.principalBalance,
    interest_rate: a.interestRate,
    daily_interest: a.dailyInterest,
    accumulated_interest: a.accumulatedInterest,
    amount_paid: a.amountPaid,
    outstanding_interest: a.outstandingInterest,
    status: a.status
  };
}

export function mapDbToDailyAccruedInterest(row: any): DailyAccruedInterest {
  return {
    id: String(row.id || '').trim(),
    contractId: String(row.contract_id || row.contractId || '').trim(),
    termNumber: Number(row.term_number ?? row.termNumber ?? 1),
    seq: Number(row.seq ?? 1),
    entryDate: cleanDateString(row.entry_date || row.entryDate),
    principalBalance: Number(row.principal_balance ?? row.principalBalance ?? 0),
    interestRate: Number(row.interest_rate ?? row.interestRate ?? 0),
    dailyInterest: Number(row.daily_interest ?? row.dailyInterest ?? 0),
    accumulatedInterest: Number(row.accumulated_interest ?? row.accumulatedInterest ?? 0),
    amountPaid: Number(row.amount_paid ?? row.amountPaid ?? 0),
    outstandingInterest: Number(row.outstanding_interest ?? row.outstandingInterest ?? 0),
    status: row.status || 'NOT_PAID',
    createdAt: row.created_at || row.createdAt
  };
}

// === API SYNC OPERATORS ===

/**
 * Pushes all local storage tables up to the active Supabase Schema
 */
export async function pushLocalDataToSupabase(client: SupabaseClient, replaceMode: boolean = false): Promise<{
  success: boolean;
  message: string;
  pushedCount?: {
    contracts: number;
    disbursements: number;
    payments: number;
    repayments: number;
  }
}> {
  try {
    const contracts = getContracts().map(mapContractToDb);
    const disbursements = getDisbursements().map(mapDisbursementToDb);
    const payments = getScheduledPayments().map(mapScheduledPaymentToDb);
    const repayments = getRepayments().map(mapRepaymentToDb);
    const dailyAccrued = getDailyAccruedInterests().map(mapDailyAccruedInterestToDb);

    if (replaceMode) {
      // Clear tables in reverse dependency order before pushing new snapshot
      await client.from('daily_accrued_interests').delete().neq('id', '____DUMMY____');
      await client.from('repayments').delete().neq('id', '____DUMMY____');
      await client.from('scheduled_payments').delete().neq('id', '____DUMMY____');
      await client.from('disbursements').delete().neq('id', '____DUMMY____');
      await client.from('contracts').delete().neq('id', '____DUMMY____');
    }

    const chunkSize = 200;

    // 1. Upsert contracts
    if (contracts.length > 0) {
      for (let i = 0; i < contracts.length; i += chunkSize) {
        const chunk = contracts.slice(i, i + chunkSize);
        const { error: err1 } = await client.from('contracts').upsert(chunk, { onConflict: 'id' });
        if (err1) throw new Error(`Contracts upload failed: ${err1.message}`);
      }
    }

    // 2. Upsert disbursements
    if (disbursements.length > 0) {
      for (let i = 0; i < disbursements.length; i += chunkSize) {
        const chunk = disbursements.slice(i, i + chunkSize);
        const { error: err2 } = await client.from('disbursements').upsert(chunk, { onConflict: 'id' });
        if (err2) throw new Error(`Disbursements upload failed: ${err2.message}`);
      }
    }

    // 3. Upsert scheduled payments in chunks
    if (payments.length > 0) {
      for (let i = 0; i < payments.length; i += chunkSize) {
        const chunk = payments.slice(i, i + chunkSize);
        const { error: err3 } = await client.from('scheduled_payments').upsert(chunk, { onConflict: 'id' });
        if (err3) {
          if (err3.code === 'PGRST204' || err3.message?.includes('pending_disbursement')) {
            console.warn(`[Supabase Push] pending_disbursement column not found. Retrying upload without pending_disbursement.`);
            const fallbackChunk = chunk.map(p => {
              const copy = { ...p };
              delete (copy as any).pending_disbursement;
              return copy;
            });
            const { error: retryErr3 } = await client.from('scheduled_payments').upsert(fallbackChunk, { onConflict: 'id' });
            if (retryErr3) throw new Error(`Schedule upload fallback failed: ${retryErr3.message}`);
          } else {
            throw new Error(`Schedule upload failed: ${err3.message}`);
          }
        }
      }
    }

    // 4. Upsert repayments
    if (repayments.length > 0) {
      for (let i = 0; i < repayments.length; i += chunkSize) {
        const chunk = repayments.slice(i, i + chunkSize);
        const { error: err4 } = await client.from('repayments').upsert(chunk, { onConflict: 'id' });
        if (err4) throw new Error(`Repayments upload failed: ${err4.message}`);
      }
    }

    // 5. Upsert daily accrued interests
    if (dailyAccrued.length > 0) {
      for (let i = 0; i < dailyAccrued.length; i += chunkSize) {
        const chunk = dailyAccrued.slice(i, i + chunkSize);
        const { error: err5 } = await client.from('daily_accrued_interests').upsert(chunk, { onConflict: 'id' });
        if (err5) console.warn(`Daily accrued interests upload warning: ${err5.message}`);
      }
    }

    return {
      success: true,
      message: 'Successfully exported and merged local store into your cloud Supabase database!',
      pushedCount: {
        contracts: contracts.length,
        disbursements: disbursements.length,
        payments: payments.length,
        repayments: repayments.length
      }
    };
  } catch (error: any) {
    console.error('Push replication failed:', error);
    return {
      success: false,
      message: error?.message || 'Unknown push conflict occurred.'
    };
  }
}

/**
 * Pulls all records from Supabase tables down to LocalStorage
 */
export async function pullSupabaseDataToLocal(client: SupabaseClient): Promise<{
  success: boolean;
  message: string;
  pulledCount?: {
    contracts: number;
    disbursements: number;
    payments: number;
    repayments: number;
  }
}> {
  try {
    // 1. Fetch contracts
    const { data: dbContracts, error: err1 } = await client.from('contracts').select('*');
    if (err1) throw new Error(`Fetch contracts failed: ${err1.message}`);

    // 2. Fetch disbursements
    const { data: dbDisb, error: err2 } = await client.from('disbursements').select('*');
    if (err2) throw new Error(`Fetch disbursements failed: ${err2.message}`);

    // 3. Fetch scheduled_payments
    const { data: dbSched, error: err3 } = await client.from('scheduled_payments').select('*');
    if (err3) throw new Error(`Fetch schedule failed: ${err3.message}`);

    // 4. Fetch repayments
    const { data: dbRepay, error: err4 } = await client.from('repayments').select('*');
    if (err4) throw new Error(`Fetch repayments failed: ${err4.message}`);

    // 5. Fetch daily_accrued_interests
    let mappedDailyAccrued: DailyAccruedInterest[] = [];
    const { data: dbDaily, error: err5 } = await client.from('daily_accrued_interests').select('*');
    if (!err5 && dbDaily) {
      mappedDailyAccrued = dbDaily.map(mapDbToDailyAccruedInterest);
    }

    // Map back
    const mappedContracts = (dbContracts || []).map(mapDbToContract);
    const mappedDisb = (dbDisb || []).map(mapDbToDisbursement);
    const mappedRepay = (dbRepay || []).map(mapDbToRepayment);

    // Group and sort dbSched per contract to guarantee term numbers are contiguous and accurate even if term_number was missing/null in DB
    const schedByContract: Record<string, any[]> = {};
    (dbSched || []).forEach((row: any) => {
      const cId = (row.contract_id || row.contractId || 'UNKNOWN').trim().toUpperCase();
      if (!schedByContract[cId]) schedByContract[cId] = [];
      schedByContract[cId].push(row);
    });

    const mappedSched: ScheduledPayment[] = [];
    Object.keys(schedByContract).forEach(cId => {
      const rows = schedByContract[cId];
      // Sort rows by term_number if available, or by due_date, or by id
      rows.sort((a, b) => {
        const termA = Number(a.term_number ?? a.termNumber ?? 0);
        const termB = Number(b.term_number ?? b.termNumber ?? 0);
        if (termA > 0 && termB > 0) return termA - termB;
        const dateA = cleanDateString(a.due_date || a.dueDate || '');
        const dateB = cleanDateString(b.due_date || b.dueDate || '');
        if (dateA && dateB) return dateA.localeCompare(dateB);
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

      rows.forEach((row, idx) => {
        mappedSched.push(mapDbToScheduledPayment(row, idx + 1));
      });
    });

    // Save to LocalStorage
    localStorage.setItem('lms_contracts', JSON.stringify(mappedContracts));
    localStorage.setItem('lms_disbursements', JSON.stringify(mappedDisb));
    localStorage.setItem('lms_statements', JSON.stringify(mappedSched));
    localStorage.setItem('lms_repayments', JSON.stringify(mappedRepay));
    if (mappedDailyAccrued.length > 0) {
      saveDailyAccruedInterests(mappedDailyAccrued);
    }

    return {
      success: true,
      message: 'Successfully pulled and restored database snapshot from your active cloud Supabase!',
      pulledCount: {
        contracts: mappedContracts.length,
        disbursements: mappedDisb.length,
        payments: mappedSched.length,
        repayments: mappedRepay.length
      }
    };
  } catch (error: any) {
    console.error('Pull replication failed:', error);
    return {
      success: false,
      message: error?.message || 'Could not pulling database records.'
    };
  }
}

// === AUTO SYNC RECORD PERSISTENCE HELPERS ===

/**
 * Persists a transaction directly to Supabase as an incremental update
 */
export async function autoPushItem(
  client: SupabaseClient, 
  table: 'contracts' | 'disbursements' | 'scheduled_payments' | 'repayments' | 'daily_accrued_interests', 
  item: any
): Promise<boolean> {
  try {
    let payload: any;
    
    if (table === 'contracts') payload = mapContractToDb(item);
    else if (table === 'disbursements') payload = mapDisbursementToDb(item);
    else if (table === 'scheduled_payments') payload = mapScheduledPaymentToDb(item);
    else if (table === 'repayments') payload = mapRepaymentToDb(item);
    else if (table === 'daily_accrued_interests') payload = mapDailyAccruedInterestToDb(item);
    
    if (!payload) return false;

    const { error } = await client.from(table).upsert(payload, { onConflict: 'id' });
    if (error) {
      if (table === 'scheduled_payments' && (error.code === 'PGRST204' || error.message?.includes('pending_disbursement'))) {
        console.warn(`[Supabase AutoSync] pending_disbursement column not found. Retrying without it.`);
        const fallbackPayload = { ...payload };
        delete fallbackPayload.pending_disbursement;
        const { error: retryError } = await client.from(table).upsert(fallbackPayload, { onConflict: 'id' });
        if (!retryError) return true;
        console.warn(`[Supabase AutoSync Retry Failed]`, retryError.message);
      }
      console.warn(`[Supabase AutoSync] Failed to automatically sync record to ${table}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase AutoSync Exception] Table: ${table}`, err);
    return false;
  }
}

/**
  Generates itemized daily accrued interest records for all active contracts/schedules
  and persists them to Local Storage as well as Supabase (`daily_accrued_interests` table).
 */
export async function generateAndSyncDailyAccruedToSupabase(client?: SupabaseClient | null) {
  const activeClient = client || getSupabaseClient();
  const contracts = getContracts();
  const schedules = getScheduledPayments();
  const repayments = getRepayments();
  const sysDate = getSystemDate();
  const allRecords: DailyAccruedInterest[] = [];

  contracts.forEach(con => {
    const conCid = con.id.trim().toUpperCase();
    const conSchedules = schedules.filter(s => (s.contractId || '').trim().toUpperCase() === conCid);
    const firstDisbDate = getFirstDisbursementDate(con.id) || con.firstDisburseDate || con.startDate;

    conSchedules.forEach(sch => {
      const recs = generateDailyAccruedInterestRecords(
        con,
        sch.termNumber,
        schedules,
        repayments,
        sysDate,
        firstDisbDate,
        sch.interestPaid || 0
      );
      allRecords.push(...recs);

      // Save calculated remaining accrued interest (from last day of the term record) into sch.accruedInterest
      if (recs.length > 0) {
        const lastRec = recs[recs.length - 1];
        sch.accruedInterest = Math.round((lastRec.outstandingInterest || 0) * 100) / 100;
      }
    });
  });

  // Save updated schedules with calculated accruedInterest back to LocalStorage
  saveScheduledPayments(schedules);
  saveDailyAccruedInterests(allRecords);

  // Sync updated scheduled_payments and daily_accrued_interests tables to Supabase if client exists
  if (activeClient) {
    if (schedules.length > 0) {
      const schedulePayload = schedules.map(mapScheduledPaymentToDb);
      const chunkSize = 500;
      for (let i = 0; i < schedulePayload.length; i += chunkSize) {
        const chunk = schedulePayload.slice(i, i + chunkSize);
        const { error } = await activeClient.from('scheduled_payments').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.warn(`[Scheduled Payments Supabase Sync Warning batch ${i}]`, error.message);
        }
      }
    }

    if (allRecords.length > 0) {
      const dailyPayload = allRecords.map(r => ({
        id: r.id,
        contract_id: r.contractId,
        term_number: r.termNumber,
        seq: r.seq,
        entry_date: r.entryDate,
        principal_balance: r.principalBalance,
        interest_rate: r.interestRate,
        daily_interest: r.dailyInterest,
        accumulated_interest: r.accumulatedInterest,
        amount_paid: r.amountPaid,
        outstanding_interest: r.outstandingInterest,
        status: r.status
      }));
      const chunkSize = 500;
      for (let i = 0; i < dailyPayload.length; i += chunkSize) {
        const chunk = dailyPayload.slice(i, i + chunkSize);
        const { error } = await activeClient.from('daily_accrued_interests').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.warn(`[Daily Accrued Interests Supabase Sync Warning batch ${i}]`, error.message);
        }
      }
    }
  }

  return schedules.length;
}

/**
 * Clears accrued_interest column (sets accruedInterest = 0) for all schedules in LocalStorage and Supabase.
 */
export async function clearAccruedInterestInSupabaseAndLocal(client?: SupabaseClient | null) {
  const schedules = getScheduledPayments();
  schedules.forEach(sch => {
    sch.accruedInterest = 0;
  });
  saveScheduledPayments(schedules);

  if (client) {
    // 1. Direct bulk update in Supabase DB setting accrued_interest = 0 for all rows
    const { error: directErr } = await client
      .from('scheduled_payments')
      .update({ accrued_interest: 0 })
      .neq('id', '');

    if (directErr) {
      console.warn('[Clear Accrued Interest direct update error, falling back to batch upsert]', directErr.message);
    }

    // 2. Batch upsert mapped schedules to ensure local sync state matches
    if (schedules.length > 0) {
      const schedulePayload = schedules.map(mapScheduledPaymentToDb);
      const chunkSize = 500;
      for (let i = 0; i < schedulePayload.length; i += chunkSize) {
        const chunk = schedulePayload.slice(i, i + chunkSize);
        const { error } = await client.from('scheduled_payments').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.warn(`[Clear Accrued Interest Supabase Sync Warning batch ${i}]`, error.message);
        }
      }
    }
  }

  return schedules.length;
}
