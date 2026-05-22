import { SupabaseClient } from '@supabase/supabase-js';
import { Contract, Disbursement, ScheduledPayment, Repayment } from './types';
import { 
  getContracts, 
  getDisbursements, 
  getScheduledPayments, 
  getRepayments 
} from './dbStore';

// === MAP HELPERS ===

export function mapContractToDb(c: Contract) {
  return {
    id: c.id,
    customer_name: c.customerName,
    customer_tax_id: c.customerTaxId,
    customer_phone: c.customerPhone,
    product_type: c.productType,
    credit_limit: c.creditLimit,
    interest_rate: c.interestRate,
    start_date: c.startDate,
    term_months: c.termMonths,
    due_day: c.dueDay,
    payment_frequency: c.paymentFrequency,
    service_fee: c.serviceFee,
    tree_cut_option: c.treeCutOption,
    outstanding_principal: c.outstandingPrincipal,
    disbursed_amount: c.disbursedAmount,
    status: c.status,
    created_at: c.createdAt
  };
}

export function mapDbToContract(row: any): Contract {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerTaxId: row.customer_tax_id,
    customerPhone: row.customer_phone || '',
    productType: row.product_type,
    creditLimit: Number(row.credit_limit || 0),
    interestRate: Number(row.interest_rate || 0),
    startDate: row.start_date,
    termMonths: Number(row.term_months || 0),
    dueDay: row.due_day,
    paymentFrequency: row.payment_frequency,
    serviceFee: Number(row.service_fee || 0),
    treeCutOption: !!row.tree_cut_option,
    outstandingPrincipal: Number(row.outstanding_principal || 0),
    disbursedAmount: Number(row.disbursed_amount || 0),
    status: row.status,
    createdAt: row.created_at || new Date().toISOString()
  };
}

export function mapDisbursementToDb(d: Disbursement) {
  return {
    id: d.id,
    contract_id: d.contractId,
    amount: Number(d.amount),
    disburse_date: d.disburseDate,
    batch_number: d.batchNumber,
    upfront_interest: d.upfrontInterest,
    upfront_fee: d.upfrontFee,
    net_received: d.netReceived,
    description: d.description
  };
}

export function mapDbToDisbursement(row: any): Disbursement {
  return {
    id: row.id,
    contractId: row.contract_id,
    amount: Number(row.amount || 0),
    disburseDate: row.disburse_date,
    batchNumber: Number(row.batch_number || 1),
    upfrontInterest: Number(row.upfront_interest || 0),
    upfrontFee: Number(row.upfront_fee || 0),
    netReceived: Number(row.net_received || 0),
    description: row.description || ''
  };
}

export function mapScheduledPaymentToDb(s: ScheduledPayment) {
  return {
    id: s.id,
    contract_id: s.contractId,
    term_number: s.termNumber,
    due_date: s.dueDate,
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
    last_updated: s.lastUpdated
  };
}

export function mapDbToScheduledPayment(row: any): ScheduledPayment {
  return {
    id: row.id,
    contractId: row.contract_id,
    termNumber: Number(row.term_number || 1),
    dueDate: row.due_date,
    principalDue: Number(row.principal_due || 0),
    interestDue: Number(row.interest_due || 0),
    vatDue: Number(row.vat_due || 0),
    penaltyDue: Number(row.penalty_due || 0),
    trackingFeeDue: Number(row.tracking_fee_due || 0),
    totalDue: Number(row.total_due || 0),
    principalPaid: Number(row.principal_paid || 0),
    interestPaid: Number(row.interest_paid || 0),
    vatPaid: Number(row.vat_paid || 0),
    penaltyPaid: Number(row.penalty_paid || 0),
    trackingFeePaid: Number(row.tracking_fee_paid || 0),
    totalPaid: Number(row.total_paid || 0),
    status: row.status,
    lastUpdated: row.last_updated || new Date().toISOString().split('T')[0]
  };
}

export function mapRepaymentToDb(r: Repayment) {
  return {
    id: r.id,
    contract_id: r.contractId,
    payment_date: r.paymentDate,
    amount_paid: r.amountPaid,
    receipt_no: r.receiptNo,
    applied_penalty: r.appliedPenalty,
    applied_tracking_fee: r.appliedTrackingFee,
    applied_interest: r.appliedInterest,
    applied_principal: r.appliedPrincipal,
    applied_vat: r.appliedVat,
    distribution_details: r.distributionDetails,
    created_at: r.createdAt
  };
}

export function mapDbToRepayment(row: any): Repayment {
  return {
    id: row.id,
    contractId: row.contract_id,
    paymentDate: row.payment_date,
    amountPaid: Number(row.amount_paid || 0),
    receiptNo: row.receipt_no,
    appliedPenalty: Number(row.applied_penalty || 0),
    appliedTrackingFee: Number(row.applied_tracking_fee || 0),
    appliedInterest: Number(row.applied_interest || 0),
    appliedPrincipal: Number(row.applied_principal || 0),
    appliedVat: Number(row.applied_vat || 0),
    distributionDetails: row.distribution_details || [],
    createdAt: row.created_at || new Date().toISOString()
  };
}

// === API SYNC OPERATORS ===

/**
 * Pushes all local storage tables up to the active Supabase Schema
 */
export async function pushLocalDataToSupabase(client: SupabaseClient): Promise<{
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

    // 1. Upsert contracts
    if (contracts.length > 0) {
      const { error: err1 } = await client.from('contracts').upsert(contracts, { onConflict: 'id' });
      if (err1) throw new Error(`Contracts upload failed: ${err1.message}`);
    }

    // 2. Upsert disbursements
    if (disbursements.length > 0) {
      const { error: err2 } = await client.from('disbursements').upsert(disbursements, { onConflict: 'id' });
      if (err2) throw new Error(`Disbursements upload failed: ${err2.message}`);
    }

    // 3. Upsert scheduled payments
    if (payments.length > 0) {
      const { error: err3 } = await client.from('scheduled_payments').upsert(payments, { onConflict: 'id' });
      if (err3) throw new Error(`Schedule upload failed: ${err3.message}`);
    }

    // 4. Upsert repayments
    if (repayments.length > 0) {
      const { error: err4 } = await client.from('repayments').upsert(repayments, { onConflict: 'id' });
      if (err4) throw new Error(`Repayments upload failed: ${err4.message}`);
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

    // Map back
    const mappedContracts = (dbContracts || []).map(mapDbToContract);
    const mappedDisb = (dbDisb || []).map(mapDbToDisbursement);
    const mappedSched = (dbSched || []).map(mapDbToScheduledPayment);
    const mappedRepay = (dbRepay || []).map(mapDbToRepayment);

    // Save to LocalStorage
    localStorage.setItem('lms_contracts', JSON.stringify(mappedContracts));
    localStorage.setItem('lms_disbursements', JSON.stringify(mappedDisb));
    localStorage.setItem('lms_statements', JSON.stringify(mappedSched));
    localStorage.setItem('lms_repayments', JSON.stringify(mappedRepay));

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
  table: 'contracts' | 'disbursements' | 'scheduled_payments' | 'repayments', 
  item: any
): Promise<boolean> {
  try {
    let payload: any;
    
    if (table === 'contracts') payload = mapContractToDb(item);
    else if (table === 'disbursements') payload = mapDisbursementToDb(item);
    else if (table === 'scheduled_payments') payload = mapScheduledPaymentToDb(item);
    else if (table === 'repayments') payload = mapRepaymentToDb(item);
    
    if (!payload) return false;

    const { error } = await client.from(table).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`[Supabase AutoSync] Failed to automatically sync record to ${table}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase AutoSync Exception] Table: ${table}`, err);
    return false;
  }
}
