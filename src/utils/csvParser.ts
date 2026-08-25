import { ScheduledPayment, StatementStatus } from '../types';

function parseNum(val: any): number {
  if (val === undefined || val === null) return 0;
  const str = String(val).replace(/,/g, '').replace(/[฿$\s]/g, '').trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Cleans quotation marks, BOM characters, and outer whitespace from a cell value.
 */
function cleanValue(v: string | undefined): string {
  if (!v) return '';
  let s = v.replace(/^[\uFEFF\uFFFE]/, '').trim();
  // Strip outer quotes if present
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function cleanHeader(h: string): string {
  if (!h) return '';
  return cleanValue(h)
    .toLowerCase()
    .replace(/[\s_\-]/g, '');
}

/**
 * Detects CSV delimiter (comma, semicolon, or tab) across the first 10 lines.
 */
function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 10).join('\n');
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
  return ',';
}

/**
 * Splits a single CSV line into cells safely without letting unclosed quotes leak to other lines.
 */
function splitCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(cleanValue(current));
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(cleanValue(current));
  return fields;
}

/**
 * Formats or parses various Thai/ISO date strings into YYYY-MM-DD
 */
function parseDateStrToISO(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  if (!s || s === 'null' || s.includes('NaN')) return '';

  // Extract date portion before time (e.g. "17/6/2026 0:00" -> "17/6/2026")
  const dateOnly = s.split('T')[0].split(' ')[0].trim();
  if (!dateOnly) return '';

  // Check DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10);
    let y = parseInt(slashMatch[3], 10);
    if (y > 2500) y -= 543; // Buddhist year conversion
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

  return dateOnly;
}

/**
 * Parses raw CSV text for Scheduled Payments (lms_statements)
 */
export function parseScheduledPaymentsCSV(csvText: string): ScheduledPayment[] {
  if (!csvText || !csvText.trim()) return [];

  // Split lines first - guarantees every line is processed independently
  const rawLines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (rawLines.length === 0) return [];

  const delimiter = detectDelimiter(rawLines);
  const rows = rawLines.map(line => splitCSVLine(line, delimiter));

  if (rows.length === 0) return [];

  // Identify headers from first row
  const headerRow = rows[0];
  const cleanedHeaders = headerRow.map(h => cleanHeader(h));

  const getIdx = (...aliases: string[]) => {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[\s_\-]/g, '');
      const idx = cleanedHeaders.findIndex(h => h === cleanAlias);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  let idxId = getIdx('id', 'sch_id', 'schedule_id', 'statement_id', 'รหัส', 'รหัสตาราง', 'ไอดี');
  let idxContractId = getIdx('contract_id', 'contractid', 'contract_no', 'contractno', 'เลขที่สัญญา', 'รหัสสัญญา', 'สัญญา', 'con_id', 'sch_contract_id', 'ref_no', 'contract', 'เลขสัญญา', 'สัญญารหัส');
  let idxTermNumber = getIdx('term_number', 'termnumber', 'term_no', 'termno', 'term', 'installment', 'installment_no', 'งวด', 'งวดที่', 'period', 'seq', 'ลำดับงวด');
  let idxDueDate = getIdx('due_date', 'duedate', 'due_date_str', 'วันครบกำหนด', 'วันครบกำหนดชำระ', 'กำหนดชำระ', 'วันดิว', 'ดิว', 'pay_date', 'date', 'วันที่ครบกำหนด', 'วันที่');
  let idxPrincipalDue = getIdx('principal_due', 'principaldue', 'principal', 'principal_amount', 'เงินต้น', 'เงินต้นเรียกเก็บ', 'ยอดเงินต้น', 'เงินต้นงวดนี้', 'prin_due', 'prin');
  let idxInterestDue = getIdx('interest_due', 'interestdue', 'interest', 'interest_amount', 'ดอกเบี้ย', 'ดอกเบี้ยเรียกเก็บ', 'ยอดดอกเบี้ย', 'ดอกเบี้ยงวดนี้', 'int_due', 'int');
  let idxVatDue = getIdx('vat_due', 'vatdue', 'vat', 'vat_amount', 'ภาษี', 'ภาษีมูลค่าเพิ่ม', '7%');
  let idxPenaltyDue = getIdx('penalty_due', 'penaltydue', 'penalty', 'เบี้ยปรับ', 'ค่าปรับ');
  let idxTrackingFeeDue = getIdx('tracking_fee_due', 'trackingfeedue', 'tracking_fee', 'trackingfee', 'ค่าติดตาม', 'ค่าทวงถาม', 'ค่าติดตามทวงถาม', 'collection');
  let idxTotalDue = getIdx('total_due', 'totaldue', 'total', 'total_amount', 'ยอดรวม', 'ยอดรวมเรียกเก็บ', 'ยอดเรียกเก็บ', 'จำนวนเงินต้องชำระ', 'จำนวนเงิน', 'ค่างวด', 'ยอดค่างวด');
  let idxPrincipalPaid = getIdx('principal_paid', 'principalpaid', 'เงินต้นชำระแล้ว', 'ชำระเงินต้น');
  let idxInterestPaid = getIdx('interest_paid', 'interestpaid', 'ดอกเบี้ยชำระแล้ว', 'ชำระดอกเบี้ย');
  let idxVatPaid = getIdx('vat_paid', 'vatpaid', 'ภาษีชำระแล้ว');
  let idxPenaltyPaid = getIdx('penalty_paid', 'penaltypaid', 'เบี้ยปรับชำระแล้ว');
  let idxTrackingFeePaid = getIdx('tracking_fee_paid', 'trackingfeepaid', 'ค่าติดตามชำระแล้ว');
  let idxTotalPaid = getIdx('total_paid', 'totalpaid', 'ชำระแล้ว', 'ยอดชำระแล้ว', 'ยอดรวมชำระแล้ว');
  let idxStatus = getIdx('status', 'สถานะ');
  let idxAccruedInterest = getIdx('accrued_interest', 'accruedinterest', 'accrued', 'accrued_int', 'accruedint', 'ดอกเบี้ยค้างรับ', 'ดอกเบี้ยค้าง', 'ดอกเบี้ยตั้งรับ', 'accrued_interest_amount');
  let idxLastUpdated = getIdx('last_updated', 'lastupdated', 'updatedat', 'updated_at');
  let idxPendingDisbursement = getIdx('pending_disbursement', 'pendingdisbursement', 'pendingdisb', 'ยอดรอเบิก', 'รอเบิก');

  let startRowIndex = 1;

  // Fallback column detection if contract_id header was not matched
  if (idxContractId < 0) {
    // Inspect row 0
    for (let c = 0; c < headerRow.length; c++) {
      const sampleVal = headerRow[c];
      if (/^[A-Za-z0-9]{2,}[-_/][A-Za-z0-9]+$/i.test(sampleVal) || /^(CT|CH|HP|LN|CON)/i.test(sampleVal)) {
        idxContractId = c;
        startRowIndex = 0; // row 0 is actually data
        break;
      }
    }
    // Inspect row 1 if still not found
    if (idxContractId < 0 && rows.length > 1) {
      for (let c = 0; c < rows[1].length; c++) {
        const sampleVal = rows[1][c];
        if (/^[A-Za-z0-9]{2,}[-_/][A-Za-z0-9]+$/i.test(sampleVal) || /^(CT|CH|HP|LN|CON)/i.test(sampleVal)) {
          idxContractId = c;
          break;
        }
      }
    }
    // Final fallback: column 0
    if (idxContractId < 0) {
      idxContractId = 0;
    }
  }

  // Fallback for termNumber if not found
  if (idxTermNumber < 0) {
    if (rows.length > 1 && rows[1].length > 1 && !isNaN(parseInt(rows[1][1], 10))) {
      idxTermNumber = 1;
    } else if (rows.length > 1 && rows[1].length > 2 && !isNaN(parseInt(rows[1][2], 10))) {
      idxTermNumber = 2;
    }
  }

  const results: ScheduledPayment[] = [];
  const termCounterMap = new Map<string, number>();

  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawContractId = idxContractId >= 0 ? row[idxContractId] : '';
    // Skip if empty or if it's a re-repeated header line
    if (!rawContractId || rawContractId.toLowerCase() === 'contract_id' || rawContractId.toLowerCase() === 'contractid' || rawContractId === 'เลขที่สัญญา') {
      continue;
    }

    const contractId = rawContractId;

    // Track term sequence fallback
    let currentSeq = (termCounterMap.get(contractId) || 0) + 1;
    termCounterMap.set(contractId, currentSeq);

    let termNum = idxTermNumber >= 0 ? parseNum(row[idxTermNumber]) : currentSeq;
    if (isNaN(termNum) || termNum <= 0) {
      termNum = currentSeq;
    }

    let dueDateRaw = idxDueDate >= 0 ? parseDateStrToISO(row[idxDueDate]) : '';
    if (!dueDateRaw) {
      const prevForContract = [...results].reverse().find(r => r.contractId === contractId);
      if (prevForContract && prevForContract.dueDate) {
        const parts = prevForContract.dueDate.split('-');
        if (parts.length === 3) {
          let yr = parseInt(parts[0], 10);
          let mo = parseInt(parts[1], 10) + 1;
          const da = parts[2];
          if (mo > 12) { mo = 1; yr += 1; }
          dueDateRaw = `${yr}-${String(mo).padStart(2, '0')}-${da}`;
        }
      } else {
        dueDateRaw = '2026-05-22';
      }
    }

    const principalDue = idxPrincipalDue >= 0 ? parseNum(row[idxPrincipalDue]) : 0;
    const interestDue = idxInterestDue >= 0 ? parseNum(row[idxInterestDue]) : 0;
    const vatDue = idxVatDue >= 0 ? parseNum(row[idxVatDue]) : 0;
    const penaltyDue = idxPenaltyDue >= 0 ? parseNum(row[idxPenaltyDue]) : 0;
    const trackingFeeDue = idxTrackingFeeDue >= 0 ? parseNum(row[idxTrackingFeeDue]) : 0;
    const totalDue = (idxTotalDue >= 0 && row[idxTotalDue] !== undefined && row[idxTotalDue] !== '')
      ? parseNum(row[idxTotalDue])
      : (principalDue + interestDue + vatDue + penaltyDue + trackingFeeDue);

    const principalPaid = idxPrincipalPaid >= 0 ? parseNum(row[idxPrincipalPaid]) : 0;
    const interestPaid = idxInterestPaid >= 0 ? parseNum(row[idxInterestPaid]) : 0;
    const vatPaid = idxVatPaid >= 0 ? parseNum(row[idxVatPaid]) : 0;
    const penaltyPaid = idxPenaltyPaid >= 0 ? parseNum(row[idxPenaltyPaid]) : 0;
    const trackingFeePaid = idxTrackingFeePaid >= 0 ? parseNum(row[idxTrackingFeePaid]) : 0;
    const totalPaid = (idxTotalPaid >= 0 && row[idxTotalPaid] !== undefined && row[idxTotalPaid] !== '')
      ? parseNum(row[idxTotalPaid])
      : (principalPaid + interestPaid + vatPaid + penaltyPaid + trackingFeePaid);

    let statusRaw = idxStatus >= 0 ? row[idxStatus].toUpperCase() : '';
    if (!['PAID', 'NOT_PAID', 'PARTIAL', 'OVERDUE'].includes(statusRaw)) {
      const installmentTarget = Math.max(principalDue + interestDue + vatDue, totalDue - penaltyDue - trackingFeeDue);
      if ((totalPaid >= installmentTarget - 0.02 || totalPaid >= totalDue - 0.02) && (installmentTarget > 0 || totalDue > 0)) {
        statusRaw = 'PAID';
      } else if (totalPaid > 0) {
        statusRaw = 'PARTIAL';
      } else {
        statusRaw = 'NOT_PAID';
      }
    }

    const rawId = idxId >= 0 ? row[idxId] : '';
    const id = rawId || `${contractId}-SCH-${termNum}`;
    const rawLastUpdated = idxLastUpdated >= 0 ? row[idxLastUpdated] : '';
    const lastUpdated = parseDateStrToISO(rawLastUpdated) || new Date().toISOString().split('T')[0];
    const pendingDisbursement = idxPendingDisbursement >= 0 ? parseNum(row[idxPendingDisbursement]) : 0;
    const uploadedAccruedInterest = idxAccruedInterest >= 0 ? parseNum(row[idxAccruedInterest]) : undefined;

    results.push({
      id,
      contractId,
      termNumber: termNum,
      dueDate: dueDateRaw,
      principalDue,
      interestDue,
      vatDue,
      penaltyDue,
      trackingFeeDue,
      totalDue,
      principalPaid,
      interestPaid,
      vatPaid,
      penaltyPaid,
      trackingFeePaid,
      totalPaid,
      status: statusRaw as StatementStatus,
      accruedInterest: uploadedAccruedInterest !== undefined && !isNaN(uploadedAccruedInterest) ? uploadedAccruedInterest : 0,
      lastUpdated,
      pendingDisbursement,
      fromDb: true
    });
  }

  return results;
}



