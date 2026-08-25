import React, { useState } from 'react';
import { Contract, ScheduledPayment, Repayment } from '../types';
import { getDaysBetween, parseDate, subtractDays } from '../financialEngine';
import { getSystemDate } from '../dbStore';
import { Filter, CheckSquare, Square, RotateCcw } from 'lucide-react';

interface DetailedScheduleMatrixProps {
  contract: Contract;
  schedules: ScheduledPayment[];
  repayments: Repayment[];
}

export default function DetailedScheduleMatrix({
  contract,
  schedules,
  repayments
}: DetailedScheduleMatrixProps) {
  // Category Group Column Visibility State
  const [categories, setCategories] = useState({
    doc: true,     // 1. เอกสาร (Plan)
    exp: true,     // 2. การชำระเงินที่คาดหวัง (Expected)
    due: true,     // 3. ครบกำหนดชำระเงิน (Due / Overdue)
    paid: true,    // 4. ชำระเงินแล้ว (Paid)
    actual: true,  // 5. จ่ายจริง (Actual Cash Paid)
    rem: true      // 6. ยอดจ่ายคงเหลือ (Remaining Balance)
  });

  // Sub-column / Field Visibility State
  const [subCols, setSubCols] = useState({
    principal: true, // เงินต้น
    interest: true,  // ดอกเบี้ย
    fee: true,       // ค่าธรรมเนียม
    total: true,     // ทั้งหมด / รวม
    balance: true    // ยอดคงเหลือ
  });

  const toggleCategory = (key: keyof typeof categories) => {
    setCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSubCol = (key: keyof typeof subCols) => {
    setSubCols(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetAllFilters = () => {
    setCategories({
      doc: true,
      exp: true,
      due: true,
      paid: true,
      actual: true,
      rem: true
    });
    setSubCols({
      principal: true,
      interest: true,
      fee: true,
      total: true,
      balance: true
    });
  };
  const formatThb = (val: number) => {
    if (isNaN(val) || val === null || val === undefined) return '0.00';
    return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Convert YYYY-MM-DD or ISO string to BE date DD/MM/YYYY
  const formatThaiDate = (dateStr: string | undefined | null) => {
    if (!dateStr || dateStr.includes('NaN')) return '-';
    const clean = dateStr.split('T')[0].split(' ')[0].trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
      let y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (y < 2400) y += 543; // Convert to Thai BE year
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }
    const slashParts = clean.split('/');
    if (slashParts.length === 3) {
      return clean;
    }
    return dateStr;
  };

  // Sort schedules by term number
  const sortedSchedules = [...schedules].sort((a, b) => a.termNumber - b.termNumber);

  // Filter repayments for this contract
  const contractCid = (contract.id || '').trim().toUpperCase();
  const contractRepayments = repayments
    .filter(r => (r.contractId || '').trim().toUpperCase() === contractCid)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  // Compute schedule matrix rows with early payment interest rollover logic
  let runningDocPrincipalBalance = contract.disbursedAmount || contract.creditLimit || 0;
  let runningExpPrincipalBalance = contract.disbursedAmount || contract.creditLimit || 0;
  let runningDuePrincipalBalance = contract.disbursedAmount || contract.creditLimit || 0;

  let prevAnchorDate = contract.firstDisburseDate || contract.startDate || '2026-05-22';
  let carryOverUnpaidInterest = 0;

  const matrixRows = sortedSchedules.map((sch, idx) => {
    const termRepayments = contractRepayments.filter(r => {
      if (r.distributionDetails && Array.isArray(r.distributionDetails)) {
        return r.distributionDetails.some(d => d.termNumber === sch.termNumber && d.total > 0);
      }
      return false;
    });

    const primaryRepayment = termRepayments.length > 0 
      ? termRepayments[0] 
      : contractRepayments[idx];

    // Execution / Order Date
    const executionDate = primaryRepayment 
      ? primaryRepayment.paymentDate 
      : (sch.lastUpdated ? sch.lastUpdated.split(' ')[0] : sch.dueDate);

    // 1. Original Document Plan (เอกสาร)
    const docPrincipal = sch.principalDue;
    const docInterest = sch.interestDue;
    const docFee = sch.trackingFeeDue;
    const docTotal = sch.totalDue;
    runningDocPrincipalBalance = Math.max(0, runningDocPrincipalBalance - docPrincipal);
    const docBalance = runningDocPrincipalBalance;

    // 2. Actual Receipts & Payments (จ่ายจริง / ชำระเงินแล้ว)
    let actualPrincipal = sch.principalPaid;
    let actualInterest = sch.interestPaid;
    let actualFee = sch.penaltyPaid + sch.trackingFeePaid;
    let actualTotal = actualPrincipal + actualInterest + actualFee + sch.vatPaid;

    if (primaryRepayment) {
      if (primaryRepayment.appliedPrincipal > 0 || primaryRepayment.appliedInterest > 0) {
        actualPrincipal = primaryRepayment.appliedPrincipal;
        actualInterest = primaryRepayment.appliedInterest;
        actualFee = (primaryRepayment.appliedPenalty || 0) + (primaryRepayment.appliedTrackingFee || 0);
        actualTotal = primaryRepayment.amountPaid;
      }
    }

    // Early Payment Calculation Check:
    // If payment date < due date (Early Payment)
    const isEarlyPayment = primaryRepayment && primaryRepayment.paymentDate < sch.dueDate;
    
    // 3. Expected Schedule (การชำระเงินที่คาดหวัง)
    let expPrincipal = docPrincipal;
    let expInterest = docInterest;
    let expFee = docFee;

    if (isEarlyPayment) {
      // Early payment term:
      // Interest accrued up to payment date = Balance * rate * days / 365
      const daysCount = Math.max(1, getDaysBetween(prevAnchorDate, primaryRepayment.paymentDate));
      const dailyRate = (contract.interestRate / 100) / 365;
      const accruedInt = Math.round(runningExpPrincipalBalance * dailyRate * daysCount * 100) / 100;
      
      // Expected Principal in early payment term equals cash paid minus accrued interest or actual principal paid
      expPrincipal = actualPrincipal > 0 ? actualPrincipal : Math.max(0, docTotal - accruedInt);
      expInterest = accruedInt;
      
      // Unpaid interest for the rest of term 1 (from early payment date to due date) is carried over to next term
      const fullTermInterestPlanned = docInterest;
      const unaccruedInterest = Math.max(0, fullTermInterestPlanned - accruedInt);
      carryOverUnpaidInterest = unaccruedInterest;
      
      prevAnchorDate = primaryRepayment.paymentDate;
    } else if (idx > 0 && carryOverUnpaidInterest > 0) {
      // Subsequent term after early payment:
      // The remaining interest from previous term + current term interest
      const daysFromEarlyPaymentToDueDate = Math.max(1, getDaysBetween(prevAnchorDate, sch.dueDate));
      const dailyRate = (contract.interestRate / 100) / 365;
      const currentPeriodInterest = Math.round(runningExpPrincipalBalance * dailyRate * daysFromEarlyPaymentToDueDate * 100) / 100;
      
      expInterest = Math.round((currentPeriodInterest + carryOverUnpaidInterest) * 100) / 100;
      expPrincipal = Math.max(0, docTotal - expInterest);
      
      carryOverUnpaidInterest = 0; // Reset carryover after applying
      prevAnchorDate = sch.dueDate;
    } else {
      prevAnchorDate = sch.dueDate;
    }

    const expTotal = Math.round((expPrincipal + expInterest + expFee) * 100) / 100;
    runningExpPrincipalBalance = Math.max(0, runningExpPrincipalBalance - (actualPrincipal > 0 ? actualPrincipal : expPrincipal));
    const expBalance = runningExpPrincipalBalance;

    // 4. Payment Due / Overdue (ครบกำหนดชำระเงิน)
    const isOverdue = sch.status === 'OVERDUE' || (sch.status !== 'PAID' && sch.dueDate < getSystemDate());
    const duePrincipal = isOverdue ? Math.max(0, docPrincipal - actualPrincipal) : 0;
    const dueInterest = isOverdue ? Math.max(0, docInterest - actualInterest) : 0;
    const dueFee = isOverdue ? Math.max(0, docFee - actualFee) : 0;
    const dueTotal = duePrincipal + dueInterest + dueFee;
    
    if (isOverdue) {
      runningDuePrincipalBalance = Math.max(0, runningDuePrincipalBalance - actualPrincipal);
    }
    const dueBalance = runningDuePrincipalBalance;

    // 5. Paid Amount (ชำระเงินแล้ว)
    const paidPrincipal = actualPrincipal;
    const paidInterest = actualInterest;
    const paidFee = actualFee;
    const paidTotal = actualTotal;

    // 6. Remaining Due per Term (ยอดจ่ายคงเหลือ)
    const remPrincipal = Math.max(0, docPrincipal - paidPrincipal);
    const remInterest = Math.max(0, docInterest - paidInterest);
    const remFee = Math.max(0, docFee - paidFee);
    const remTotal = remPrincipal + remInterest + remFee;
    const remInstallmentCount = remTotal > 0 ? 1 : 0;

    return {
      termNumber: sch.termNumber,
      executionDate,
      dueDate: sch.dueDate,
      // เอกสาร
      docPrincipal,
      docInterest,
      docFee,
      docTotal,
      docBalance,
      // การชำระเงินที่คาดหวัง
      expPrincipal,
      expInterest,
      expFee,
      expTotal,
      expBalance,
      // ครบกำหนดชำระเงิน
      duePrincipal,
      dueInterest,
      dueFee,
      dueTotal,
      dueBalance,
      // ชำระเงินแล้ว
      paidPrincipal,
      paidInterest,
      paidFee,
      paidTotal,
      // จ่ายจริง
      actualPrincipal,
      actualInterest,
      actualFee,
      actualTotal,
      // ยอดจ่ายคงเหลือ
      remInstallmentCount,
      remPrincipal,
      remInterest,
      remFee,
      remTotal,
      status: sch.status
    };
  });

  // Calculate Overdue & Default Summary metrics
  const totalOverdueAmount = matrixRows.reduce((sum, r) => sum + r.dueTotal, 0);
  const overdueRows = matrixRows.filter(r => r.dueTotal > 0);
  const lastDefaultDate = overdueRows.length > 0 
    ? formatThaiDate(overdueRows[overdueRows.length - 1].dueDate) 
    : formatThaiDate('2026-08-12');
  
  const defaultBucket = overdueRows.length >= 2 ? 'DEFAULT (NPL)' : overdueRows.length === 1 ? 'XDAY' : 'NORMAL';

  // Calculate dynamic colSpans for headers based on active subCols
  const getColSpan = (hasBalance: boolean = true) => {
    let count = 0;
    if (subCols.principal) count++;
    if (subCols.interest) count++;
    if (subCols.fee) count++;
    if (subCols.total) count++;
    if (hasBalance && subCols.balance) count++;
    return count;
  };

  const docColSpan = getColSpan(true);
  const expColSpan = getColSpan(true);
  const dueColSpan = getColSpan(true);
  const paidColSpan = getColSpan(false);
  const actualColSpan = getColSpan(false);
  const remColSpan = 1 + getColSpan(false); // 1 for 'จำนวนผ่อนชำระ'

  const totalVisibleCols = 3 + 
    (categories.doc ? docColSpan : 0) +
    (categories.exp ? expColSpan : 0) +
    (categories.due ? dueColSpan : 0) +
    (categories.paid ? paidColSpan : 0) +
    (categories.actual ? actualColSpan : 0) +
    (categories.rem ? remColSpan : 0);

  const renderSubHeaders = (hasBalance: boolean = true) => (
    <>
      {subCols.principal && <th className="px-2 py-2 border-r border-blue-500 min-w-[65px]">เงินต้น</th>}
      {subCols.interest && <th className="px-2 py-2 border-r border-blue-500 min-w-[65px]">ดอกเบี้ย</th>}
      {subCols.fee && <th className="px-2 py-2 border-r border-blue-500 min-w-[65px]">ค่าธรรมเนียม</th>}
      {subCols.total && <th className="px-2 py-2 border-r border-blue-500 min-w-[70px]">ทั้งหมด</th>}
      {hasBalance && subCols.balance && <th className="px-2 py-2 border-r border-blue-600 bg-blue-800/40 min-w-[75px]">ยอดคงเหลือ</th>}
    </>
  );

  return (
    <div className="space-y-4 font-sans">
      {/* Category & Column Filter Control Panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-xs font-sans text-xs">
        {/* Row 1: Major Category Group Checkboxes */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-extrabold text-slate-800 flex items-center gap-1.5 min-w-[170px]">
            <Filter className="w-4 h-4 text-[#1d5cc2]" />
            เลือกหมวดหมู่ที่ต้องการแสดง:
          </span>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs hover:border-blue-400 font-bold text-slate-700 transition">
            <input
              type="checkbox"
              checked={categories.doc}
              onChange={() => toggleCategory('doc')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-blue-900">1. เอกสาร</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs hover:border-blue-400 font-bold text-slate-700 transition">
            <input
              type="checkbox"
              checked={categories.exp}
              onChange={() => toggleCategory('exp')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-blue-900">2. การชำระเงินที่คาดหวัง</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs hover:border-blue-400 font-bold text-slate-700 transition">
            <input
              type="checkbox"
              checked={categories.due}
              onChange={() => toggleCategory('due')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-blue-900">3. ครบกำหนดชำระเงิน</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs hover:border-blue-400 font-bold text-slate-700 transition">
            <input
              type="checkbox"
              checked={categories.paid}
              onChange={() => toggleCategory('paid')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-blue-900">4. ชำระเงินแล้ว</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs hover:border-blue-400 font-bold text-slate-700 transition">
            <input
              type="checkbox"
              checked={categories.actual}
              onChange={() => toggleCategory('actual')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-blue-900">5. จ่ายจริง</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs hover:border-blue-400 font-bold text-slate-700 transition">
            <input
              type="checkbox"
              checked={categories.rem}
              onChange={() => toggleCategory('rem')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-blue-900">6. ยอดจ่ายคงเหลือ</span>
          </label>

          <button
            onClick={resetAllFilters}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            รีเซ็ตรายการเลือก
          </button>
        </div>

        {/* Row 2: Sub-column / Elements Checkboxes */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-200/80">
          <span className="font-bold text-slate-600 flex items-center gap-1.5 min-w-[170px]">
            เลือกส่วนประกอบคอลัมน์ย่อย:
          </span>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={subCols.principal}
              onChange={() => toggleSubCol('principal')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>เงินต้น</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={subCols.interest}
              onChange={() => toggleSubCol('interest')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>ดอกเบี้ย</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={subCols.fee}
              onChange={() => toggleSubCol('fee')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>ค่าธรรมเนียม/เบี้ยปรับ</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={subCols.total}
              onChange={() => toggleSubCol('total')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>ยอดรวม (Total)</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={subCols.balance}
              onChange={() => toggleSubCol('balance')}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>ยอดคงเหลือ (Balance)</span>
          </label>
        </div>
      </div>

      {/* 1. Main Detailed Schedule Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-[11px] font-mono">
            <thead>
              {/* Row 1 Group Headers */}
              <tr className="bg-[#1d5cc2] text-white font-bold border-b border-blue-800 uppercase tracking-wider">
                <th rowSpan={2} className="px-2 py-3 border-r border-blue-600 min-w-[50px]">งวดที่</th>
                <th rowSpan={2} className="px-2 py-3 border-r border-blue-600 min-w-[85px]">วันที่ทำสั่ง</th>
                <th rowSpan={2} className="px-2 py-3 border-r border-blue-600 min-w-[85px]">ครบกำหนดสิ้นสุด</th>
                
                {categories.doc && docColSpan > 0 && <th colSpan={docColSpan} className="px-3 py-1.5 border-r border-blue-600 bg-[#164cb0]">เอกสาร</th>}
                {categories.exp && expColSpan > 0 && <th colSpan={expColSpan} className="px-3 py-1.5 border-r border-blue-600 bg-[#1953bc]">การชำระเงินที่คาดหวัง</th>}
                {categories.due && dueColSpan > 0 && <th colSpan={dueColSpan} className="px-3 py-1.5 border-r border-blue-600 bg-[#164cb0]">ครบกำหนดชำระเงิน</th>}
                {categories.paid && paidColSpan > 0 && <th colSpan={paidColSpan} className="px-3 py-1.5 border-r border-blue-600 bg-[#1953bc]">ชำระเงินแล้ว</th>}
                {categories.actual && actualColSpan > 0 && <th colSpan={actualColSpan} className="px-3 py-1.5 border-r border-blue-600 bg-[#164cb0]">จ่ายจริง</th>}
                {categories.rem && remColSpan > 0 && <th colSpan={remColSpan} className="px-3 py-1.5 bg-[#1953bc]">ยอดจ่ายคงเหลือ</th>}
              </tr>

              {/* Row 2 Sub-column Headers */}
              <tr className="bg-[#2a6cd8] text-white font-semibold border-b border-blue-700 text-[10px]">
                {/* 1. เอกสาร */}
                {categories.doc && docColSpan > 0 && renderSubHeaders(true)}

                {/* 2. การชำระเงินที่คาดหวัง */}
                {categories.exp && expColSpan > 0 && renderSubHeaders(true)}

                {/* 3. ครบกำหนดชำระเงิน */}
                {categories.due && dueColSpan > 0 && renderSubHeaders(true)}

                {/* 4. ชำระเงินแล้ว */}
                {categories.paid && paidColSpan > 0 && renderSubHeaders(false)}

                {/* 5. จ่ายจริง */}
                {categories.actual && actualColSpan > 0 && renderSubHeaders(false)}

                {/* 6. ยอดจ่ายคงเหลือ */}
                {categories.rem && remColSpan > 0 && (
                  <>
                    <th className="px-2 py-2 border-r border-blue-500 min-w-[60px]">จำนวนผ่อนชำระ</th>
                    {subCols.principal && <th className="px-2 py-2 border-r border-blue-500 min-w-[65px]">เงินต้น</th>}
                    {subCols.interest && <th className="px-2 py-2 border-r border-blue-500 min-w-[65px]">ดอกเบี้ย</th>}
                    {subCols.fee && <th className="px-2 py-2 border-r border-blue-500 min-w-[65px]">ค่าธรรมเนียม</th>}
                    {subCols.total && <th className="px-2 py-2 min-w-[70px]">ทั้งหมด</th>}
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-700">
              {matrixRows.length === 0 ? (
                <tr>
                  <td colSpan={totalVisibleCols} className="p-8 text-center text-slate-400 font-sans">
                    ไม่พบข้อมูลตารางผ่อนชำระในระบบ
                  </td>
                </tr>
              ) : (
                matrixRows.map((row) => (
                  <tr key={row.termNumber} className="hover:bg-blue-50/30 transition text-right">
                    <td className="px-2 py-2.5 text-center font-bold text-slate-800 border-r border-slate-200 bg-slate-50/50">
                      {row.termNumber}
                    </td>
                    <td className="px-2 py-2.5 text-center text-slate-600 border-r border-slate-200">
                      {formatThaiDate(row.executionDate)}
                    </td>
                    <td className="px-2 py-2.5 text-center text-slate-600 border-r border-slate-200 font-semibold">
                      {formatThaiDate(row.dueDate)}
                    </td>

                    {/* 1. เอกสาร (Plan) */}
                    {categories.doc && docColSpan > 0 && (
                      <>
                        {subCols.principal && <td className="px-2 py-2.5 border-r border-slate-200 text-slate-700">{formatThb(row.docPrincipal)}</td>}
                        {subCols.interest && <td className="px-2 py-2.5 border-r border-slate-200 text-slate-700">{formatThb(row.docInterest)}</td>}
                        {subCols.fee && <td className="px-2 py-2.5 border-r border-slate-200 text-slate-500">{formatThb(row.docFee)}</td>}
                        {subCols.total && <td className="px-2 py-2.5 border-r border-slate-200 font-bold text-slate-800">{formatThb(row.docTotal)}</td>}
                        {subCols.balance && <td className="px-2 py-2.5 border-r border-slate-300 font-extrabold text-sky-800 bg-slate-50/80">{formatThb(row.docBalance)}</td>}
                      </>
                    )}

                    {/* 2. การชำระเงินที่คาดหวัง (Expected) */}
                    {categories.exp && expColSpan > 0 && (
                      <>
                        {subCols.principal && <td className="px-2 py-2.5 border-r border-slate-200 text-slate-700 font-semibold">{formatThb(row.expPrincipal)}</td>}
                        {subCols.interest && <td className="px-2 py-2.5 border-r border-slate-200 text-slate-700 font-semibold">{formatThb(row.expInterest)}</td>}
                        {subCols.fee && <td className="px-2 py-2.5 border-r border-slate-200 text-slate-500">{formatThb(row.expFee)}</td>}
                        {subCols.total && <td className="px-2 py-2.5 border-r border-slate-200 font-bold text-slate-800">{formatThb(row.expTotal)}</td>}
                        {subCols.balance && <td className="px-2 py-2.5 border-r border-slate-300 font-extrabold text-sky-800 bg-slate-50/80">{formatThb(row.expBalance)}</td>}
                      </>
                    )}

                    {/* 3. ครบกำหนดชำระเงิน (Overdue/Due) */}
                    {categories.due && dueColSpan > 0 && (
                      <>
                        {subCols.principal && <td className="px-2 py-2.5 border-r border-slate-200 text-rose-700 font-semibold">{formatThb(row.duePrincipal)}</td>}
                        {subCols.interest && <td className="px-2 py-2.5 border-r border-slate-200 text-rose-700 font-semibold">{formatThb(row.dueInterest)}</td>}
                        {subCols.fee && <td className="px-2 py-2.5 border-r border-slate-200 text-rose-600">{formatThb(row.dueFee)}</td>}
                        {subCols.total && <td className="px-2 py-2.5 border-r border-slate-200 font-bold text-rose-800 bg-rose-50/20">{formatThb(row.dueTotal)}</td>}
                        {subCols.balance && <td className="px-2 py-2.5 border-r border-slate-300 font-extrabold text-slate-700 bg-slate-50/80">{formatThb(row.dueBalance)}</td>}
                      </>
                    )}

                    {/* 4. ชำระเงินแล้ว (Paid Amount) */}
                    {categories.paid && paidColSpan > 0 && (
                      <>
                        {subCols.principal && <td className="px-2 py-2.5 border-r border-slate-200 text-emerald-700 font-semibold">{formatThb(row.paidPrincipal)}</td>}
                        {subCols.interest && <td className="px-2 py-2.5 border-r border-slate-200 text-emerald-700 font-semibold">{formatThb(row.paidInterest)}</td>}
                        {subCols.fee && <td className="px-2 py-2.5 border-r border-slate-200 text-emerald-600">{formatThb(row.paidFee)}</td>}
                        {subCols.total && <td className="px-2 py-2.5 border-r border-slate-300 font-extrabold text-emerald-800 bg-emerald-50/30">{formatThb(row.paidTotal)}</td>}
                      </>
                    )}

                    {/* 5. จ่ายจริง (Actual Cash Paid) */}
                    {categories.actual && actualColSpan > 0 && (
                      <>
                        {subCols.principal && <td className="px-2 py-2.5 border-r border-slate-200 text-emerald-700 font-semibold">{formatThb(row.actualPrincipal)}</td>}
                        {subCols.interest && <td className="px-2 py-2.5 border-r border-slate-200 text-emerald-700 font-semibold">{formatThb(row.actualInterest)}</td>}
                        {subCols.fee && <td className="px-2 py-2.5 border-r border-slate-200 text-emerald-600">{formatThb(row.actualFee)}</td>}
                        {subCols.total && <td className="px-2 py-2.5 border-r border-slate-300 font-extrabold text-emerald-800 bg-emerald-50/30">{formatThb(row.actualTotal)}</td>}
                      </>
                    )}

                    {/* 6. ยอดจ่ายคงเหลือ (Remaining Balance) */}
                    {categories.rem && remColSpan > 0 && (
                      <>
                        <td className="px-2 py-2.5 text-center border-r border-slate-200 font-bold text-slate-700">{row.remInstallmentCount}</td>
                        {subCols.principal && <td className="px-2 py-2.5 border-r border-slate-200 text-amber-800">{formatThb(row.remPrincipal)}</td>}
                        {subCols.interest && <td className="px-2 py-2.5 border-r border-slate-200 text-amber-800">{formatThb(row.remInterest)}</td>}
                        {subCols.fee && <td className="px-2 py-2.5 border-r border-slate-200 text-amber-700">{formatThb(row.remFee)}</td>}
                        {subCols.total && <td className="px-2 py-2.5 font-extrabold text-amber-900 bg-amber-50/40">{formatThb(row.remTotal)}</td>}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Overdue & Default Summary Section (ครบกำหนดและผิดนัดชำระหนี้) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-5 space-y-4">
        <h4 className="font-extrabold text-sm text-[#1d5cc2] border-b border-slate-200 pb-2 flex items-center gap-2">
          <span>ครบกำหนดและผิดนัดชำระหนี้ (Overdue & Default Status Summary)</span>
        </h4>

        {/* Info Banner Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
          <div className="flex items-center gap-3 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
            <span className="font-bold text-slate-600 min-w-[170px]">จำนวนเงินทั้งหมดที่พ้นกำหนดชำระ:</span>
            <div className="bg-white px-4 py-1.5 rounded-lg border border-blue-200 text-rose-700 font-extrabold font-mono text-sm shadow-xs">
              {formatThb(totalOverdueAmount)}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
            <span className="font-bold text-slate-600 min-w-[170px]">วันที่กระทำผิดครั้งสุดท้าย:</span>
            <div className="bg-white px-4 py-1.5 rounded-lg border border-blue-200 text-slate-800 font-extrabold font-mono text-sm shadow-xs">
              {lastDefaultDate}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-blue-50/60 p-3 rounded-lg border border-blue-100 md:col-span-2">
            <span className="font-bold text-slate-600 min-w-[170px]">ชั้นหนี้:</span>
            <div className="bg-white px-4 py-1.5 rounded-lg border border-blue-200 text-sky-800 font-black font-mono text-xs uppercase shadow-xs">
              {defaultBucket}
            </div>
          </div>
        </div>

        {/* Delinquency Grid Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-center border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#1d5cc2] text-white font-bold text-[11px]">
                <th className="px-3 py-2.5 border-r border-blue-600">การกระทำผิดกฎหมาย</th>
                <th className="px-3 py-2.5 border-r border-blue-600">ชั้นหนี้</th>
                <th className="px-3 py-2.5 border-r border-blue-600">วัน</th>
                <th className="px-3 py-2.5 border-r border-blue-600 text-right">ยอดจ่ายทั้งหมด</th>
                <th className="px-3 py-2.5 border-r border-blue-600 text-right">ดอกเบี้ย</th>
                <th className="px-3 py-2.5 border-r border-blue-600 text-right">เงินต้น</th>
                <th className="px-3 py-2.5 border-r border-blue-600 text-right">เปอร์เซ็นต์ภาษีมูลค่าเพิ่ม</th>
                <th className="px-3 py-2.5 border-r border-blue-600 text-right">ดอกเบี้ยผิดนัด</th>
                <th className="px-3 py-2.5 border-r border-blue-600 text-right">ค่าธรรมเนียม</th>
                <th className="px-3 py-2.5 text-right">ทั้งหมด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              <tr className="hover:bg-slate-50 transition">
                <td className="px-3 py-2 text-center font-bold border-r border-slate-200">X-Days</td>
                <td className="px-3 py-2 text-center border-r border-slate-200 text-sky-800 font-bold">OD3</td>
                <td className="px-3 py-2 text-center border-r border-slate-200">05/08/2026</td>
                <td className="px-3 py-2 text-right border-r border-slate-200 font-semibold">{formatThb(totalOverdueAmount > 0 ? 13393.5 : 0)}</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200 font-semibold text-rose-700">{formatThb(totalOverdueAmount)}</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right font-extrabold text-rose-800 bg-rose-50/30">{formatThb(totalOverdueAmount)}</td>
              </tr>
              <tr className="hover:bg-slate-50 transition">
                <td className="px-3 py-2 text-center font-bold border-r border-slate-200">30-Days</td>
                <td className="px-3 py-2 text-center border-r border-slate-200 text-sky-800 font-bold">OD2</td>
                <td className="px-3 py-2 text-center border-r border-slate-200">05/07/2026</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right font-bold text-slate-500">0.00</td>
              </tr>
              <tr className="hover:bg-slate-50 transition">
                <td className="px-3 py-2 text-center font-bold border-r border-slate-200">60-Days</td>
                <td className="px-3 py-2 text-center border-r border-slate-200 text-sky-800 font-bold">OD1</td>
                <td className="px-3 py-2 text-center border-r border-slate-200">05/06/2026</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right border-r border-slate-200">0.00</td>
                <td className="px-3 py-2 text-right font-bold text-slate-500">0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
