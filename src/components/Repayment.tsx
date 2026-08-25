import React, { useState, useEffect } from 'react';
import { getRepayments, getContracts, recordRepayment, getScheduledPayments, getSystemDate, getFirstDisbursementDate } from '../dbStore';
import { Repayment as RepaymentType, Contract, ScheduledPayment } from '../types';
import { Search, Plus, Download, Coins, Receipt, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import DocViewerModal from './DocViewerModal';
import { getInterestCalculationBreakdown, allocateHorizontalPayment, recalculateFutureSchedules } from '../financialEngine';

export default function Repayment() {
  const getTodayDateString = () => {
    return getSystemDate();
  };

  const [repayments, setRepayments] = useState<RepaymentType[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedContractId, setSelectedContractId] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState('');
  const [contractSearchQuery, setContractSearchQuery] = useState('');
  const [isContractDropdownOpen, setIsContractDropdownOpen] = useState(false);

  // Success Feedback view states
  const [showAllocationReceipt, setShowAllocationReceipt] = useState(false);
  const [lastAllocatedRepayment, setLastAllocatedRepayment] = useState<RepaymentType | null>(null);

  // Modal Doc states
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [selectedReceiptContract, setSelectedReceiptContract] = useState<Contract | null>(null);
  const [selectedReceiptRepay, setSelectedReceiptRepay] = useState<RepaymentType | undefined>(undefined);

  const reloadData = () => {
    setRepayments(getRepayments());
    setContracts(getContracts());
    setSchedules(getScheduledPayments());
  };

  useEffect(() => {
    reloadData();
    // Do not set default payment date to today/system date, keep it empty!

    const handleDateChanged = () => {
      reloadData();
    };
    window.addEventListener('system-date-changed', handleDateChanged);
    return () => {
      window.removeEventListener('system-date-changed', handleDateChanged);
    };
  }, []);

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId || amountPaid <= 0 || !paymentDate) return;

    const recorded = recordRepayment(selectedContractId, Number(amountPaid), paymentDate);

    if (recorded) {
      setRepayments(getRepayments());
      setContracts(getContracts());
      setSchedules(getScheduledPayments());
      setLastAllocatedRepayment(recorded);
      setShowAllocationReceipt(true);
      setIsModalOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedContractId('');
    setAmountPaid(0);
    setPaymentDate('');
    setContractSearchQuery('');
    setIsContractDropdownOpen(false);
  };

  const handleExportCSV = () => {
    const headers = 'Receipt No.,Contract ID,Customer Name,Payment Date,Gross Paid,Penalty Settled,Tracking Fee Settled,Interest Settled,Principal Settled,VAT Settled,Outstanding Principal\n';
    const rows = repayments.map(r => {
      const rCid = (r.contractId || '').trim().toUpperCase();
      const parent = contracts.find(c => (c.id || '').trim().toUpperCase() === rCid);
      const name = parent ? parent.customerName : 'N/A';
      const outstandingVal = r.outstandingPrincipal !== undefined ? r.outstandingPrincipal : '';
      return `"${r.receiptNo}","${r.contractId}","${name}","${r.paymentDate}",${r.amountPaid},${r.appliedPenalty},${r.appliedTrackingFee},${r.appliedInterest},${r.appliedPrincipal},${r.appliedVat},${outstandingVal}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LMS_Repayments_History_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  // Open Receipt PDF Modal Viewer
  const handleOpenReceipt = (repay: RepaymentType) => {
    const rCid = (repay.contractId || '').trim().toUpperCase();
    const con = contracts.find(c => (c.id || '').trim().toUpperCase() === rCid);
    if (con) {
      setSelectedReceiptContract(con);
      setSelectedReceiptRepay(repay);
      setIsDocOpen(true);
    }
  };

  // Filters
  const filteredRepays = repayments.filter(r => {
    const rCid = (r.contractId || '').trim().toUpperCase();
    const parent = contracts.find(c => (c.id || '').trim().toUpperCase() === rCid);
    const parentName = parent ? parent.customerName.toLowerCase() : '';
    const matchesId = r.contractId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesName = parentName.includes(searchName.toLowerCase());

    return (searchTerm ? matchesId : true) && (searchName ? matchesName : true);
  });

  // Filter active contracts for modal search
  const filteredContractsInModal = contracts
    .filter(c => c.status !== 'CLOSED')
    .filter(c => {
      const query = contractSearchQuery.toLowerCase();
      return (
        c.id.toLowerCase().includes(query) ||
        c.customerName.toLowerCase().includes(query)
      );
    });

  return (
    <div className="space-y-6">
      {/* Search Bar Panel & Control buttons */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาตามรหัสสัญญาที่ชำระ..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition font-sans"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสมาชิกลูกหนี้..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition font-sans"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-4 py-2.5 border border-slate-200 text-slate-700 bg-white rounded-lg text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>ส่งออกข้อมูล (CSV)</span>
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกชำระค่างวด (Repay)</span>
          </button>
        </div>
      </div>

      {/* Success Horizontal Cut Feedback Log Panel */}
      {showAllocationReceipt && lastAllocatedRepayment && (
        <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl p-6 shadow-xs space-y-4 font-sans animate-fade-in">
          <div className="flex justify-between items-start border-b border-emerald-200 pb-3">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <h4 className="font-extrabold text-sky-800 text-[14px]">ตัดยอดจัดชำระแนวนอน (Horizontal Allocation) สำเร็จ!</h4>
                <p className="text-xs text-slate-500 mt-0.5">เงินจำนวน <strong>{formatThb(lastAllocatedRepayment.amountPaid)}</strong> ได้รับจัดสรร term-by-term ตามลำดับเกรซพีเรียดพาร์ทเนอร์</p>
              </div>
            </div>
            <button
              onClick={() => setShowAllocationReceipt(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold font-mono bg-white border border-slate-200 rounded px-2 py-1 cursor-pointer"
            >
              ซ่อน logs
            </button>
          </div>

          {/* Table display of distribution details */}
          <div className="bg-white rounded-lg border border-emerald-200/50 overflow-hidden text-xs">
            <div className="px-4 py-2 bg-emerald-55/40 border-b border-emerald-200/50 font-bold text-sky-800">
              บันทึกลำดับแถวการชำระเงินต้นและดอกเบี้ย / เบี้ยปรับค้าง (Allocations breakdown)
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-500 border-b">
                  <th className="p-3">งวดที่ได้ชำระ (Term Number)</th>
                  <th className="p-4 text-right">ตัดเบี้ยปรับ (Penalty)</th>
                  <th className="p-4 text-right">ตัดค่าติดตาม (Collection Fee)</th>
                  <th className="p-4 text-right">ตัดดอกเบี้ย (Interest)</th>
                  <th className="p-4 text-right">ตัดปัดเศษเงินต้น (Principal)</th>
                  <th className="p-3 text-right">ตัดหักภาษี (VAT 7%)</th>
                  <th className="p-3 text-right font-bold text-emerald-700">รวมถูกตัดสุทธิ (Subtotal)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                {lastAllocatedRepayment.distributionDetails.map((item, idx) => (
                  <tr key={idx} className="hover:bg-teal-50/10">
                    <td className="p-3 font-bold text-teal-900 font-sans">งวดเรียกชำระที่ {item.termNumber}</td>
                    <td className="p-3 text-right text-rose-600 font-semibold">{item.penalty > 0 ? formatThb(item.penalty) : '-'}</td>
                    <td className="p-3 text-right text-rose-600 font-semibold">{item.trackingFee > 0 ? formatThb(item.trackingFee) : '-'}</td>
                    <td className="p-3 text-right text-emerald-600">{item.interest > 0 ? formatThb(item.interest) : '-'}</td>
                    <td className="p-3 text-right text-slate-800 font-semibold">{item.principal > 0 ? formatThb(item.principal) : '-'}</td>
                    <td className="p-3 text-right">{item.vat > 0 ? formatThb(item.vat) : '-'}</td>
                    <td className="p-3 text-right font-bold text-emerald-700 font-sans">{formatThb(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[10px] text-slate-400 gap-2">
            <span>* ลำดับลำเลียงตัดเงิน: เบี้ยปรับงวด N &rarr; ค่าทวงถามงวด N &rarr; ดอกเบี้ยงวด N &rarr; เงินต้นงวด N &rarr; ไปงวดถัดไป N+1</span>
            <button
              onClick={() => handleOpenReceipt(lastAllocatedRepayment)}
              className="px-4 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 text-xs transition cursor-pointer self-start sm:self-auto"
            >
              ออกใบเสร็จรับเงินใบนี้ทันที
            </button>
          </div>
        </div>
      )}

      {/* Transaction History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4.5 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center text-xs">
          <div>
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">ประวัติการรับชำระค่างวดสะสม (Repayments Log & Tax Invoices)</h4>
            <p className="text-slate-400 mt-0.5 font-sans">รายการสับยอดชำระและประทับเอกสารรับชำระจริงในระบบ</p>
          </div>
          <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 font-mono font-bold">รวม {filteredRepays.length} ธุรกรรม</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-3 py-3 border-r border-slate-200/30">เลขที่ใบเสร็จ</th>
                <th className="px-3 py-3 border-r border-slate-200/30">เลขที่สัญญา</th>
                <th className="px-3 py-3 font-sans border-r border-slate-200/30">สมาชิกลูกหนี้</th>
                <th className="px-3 py-3 text-center border-r border-slate-200/30">วันที่ได้รับชำระ</th>
                <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดเบี้ยปรับ</th>
                <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดค่าติดตาม</th>
                <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดดอกเบี้ย</th>
                <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดเงินต้นค้าง</th>
                <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดภาษี VAT</th>
                <th className="px-3 py-3 text-right bg-sky-50/40 text-sky-700 font-bold border-r border-slate-200/30">จำนวกระแสเงินฝากเข้ามา</th>
                <th className="px-3 py-3 text-right bg-indigo-50/40 text-indigo-700 font-bold border-r border-slate-200/30">เงินต้นคงเหลือหลังชำระ</th>
                <th className="px-3 py-3 text-center">พิมพ์ใบกำกับ/ใบเสร็จ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-650 font-sans">
              {filteredRepays.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400 font-sans">
                    ไม่พบรายการประวัติการชำระค่างวดอ้างอิงขณะนี้ในพอร์ตระบบ
                  </td>
                </tr>
              ) : (
                filteredRepays.map((r, idx) => {
                  const parent = contracts.find(c => c.id === r.contractId);
                  return (
                    <tr key={`${r.id}-${idx}`} className="hover:bg-slate-50/50 transition border-b border-slate-100 last:border-0 hover:text-slate-900">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-700 border-r border-slate-100/40">{r.receiptNo}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-sky-600 uppercase tracking-wider border-r border-slate-100/40">{r.contractId}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800 border-r border-slate-100/40">{parent ? parent.customerName : 'N/A'}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-normal text-slate-600 border-r border-slate-100/40">{r.paymentDate}</td>
                      
                      <td className="px-3 py-2.5 text-right font-mono text-rose-500 font-medium border-r border-slate-100/40">
                        {r.appliedPenalty > 0 ? formatThb(r.appliedPenalty) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-rose-500 font-medium border-r border-slate-100/40">
                        {r.appliedTrackingFee > 0 ? formatThb(r.appliedTrackingFee) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-emerald-600 border-r border-slate-100/40">
                        {r.appliedInterest > 0 ? formatThb(r.appliedInterest) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-800 border-r border-slate-100/40">
                        {r.appliedPrincipal > 0 ? formatThb(r.appliedPrincipal) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 border-r border-slate-100/40">
                        {r.appliedVat > 0 ? formatThb(r.appliedVat) : '-'}
                      </td>
                      
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-sky-750 bg-sky-50/20 border-r border-slate-100/40">{formatThb(r.amountPaid)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10 border-r border-slate-100/40">
                        {r.outstandingPrincipal !== undefined ? formatThb(r.outstandingPrincipal) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleOpenReceipt(r)}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-700 border border-sky-100 rounded font-bold text-[10px] transition flex items-center justify-center space-x-1 mx-auto cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-inherit" />
                          <span>ใบเสร็จ / VAT</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Repayments Registration Action Drawer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col border border-slate-100 animate-fade-in">
            <div className="px-6 py-4 border-b border-sky-100 bg-sky-600 rounded-t-xl text-white flex justify-between items-center">
              <div className="flex items-center space-x-2 font-mono">
                <Coins className="w-5 h-5 text-sky-100" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">บันทึกรับชำระหนี้ค่างวด</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/10 rounded-full p-1 transition cursor-pointer text-sm w-7 h-7 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRepaySubmit} className="p-6 space-y-5 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">เลือกหมายเลขทะเบียนสัญญาลูกหนี้ *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsContractDropdownOpen(!isContractDropdownOpen)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50 font-bold text-slate-850 text-left flex justify-between items-center transition"
                  >
                    <span className="truncate pr-2">
                      {selectedContractId
                        ? `[${selectedContractId}] ${contracts.find(c => c.id === selectedContractId)?.customerName} (คงเหลือค้างต้นกู้หลัก: ${formatThb(contracts.find(c => c.id === selectedContractId)?.outstandingPrincipal || 0)})`
                        : '-- กรุณาเลือกบัญชีสัญญาที่ต้องการตัดยอดชำระ --'}
                    </span>
                    <span className="text-slate-400 text-[10px]">▼</span>
                  </button>
                  
                  {isContractDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 cursor-default" 
                        onClick={() => setIsContractDropdownOpen(false)} 
                      />
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-slate-100 bg-slate-50">
                          <input
                            type="text"
                            placeholder="พิมพ์เพื่อค้นหา (รหัสสัญญา หรือ ชื่อสมาชิกลูกหนี้)..."
                            value={contractSearchQuery}
                            onChange={(e) => setContractSearchQuery(e.target.value)}
                            className="w-full border border-slate-200 px-3 py-1.5 rounded text-xs focus:outline-none focus:border-sky-500 bg-white"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 max-h-44">
                          {filteredContractsInModal.length === 0 ? (
                            <div className="p-3 text-center text-slate-400">ไม่พบสัญญาที่ตรงเงื่อนไข</div>
                          ) : (
                            filteredContractsInModal.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedContractId(c.id);
                                  setIsContractDropdownOpen(false);
                                  setContractSearchQuery('');
                                }}
                                className={`w-full text-left p-2.5 text-xs hover:bg-sky-50 transition flex flex-col gap-0.5 cursor-pointer ${selectedContractId === c.id ? 'bg-sky-50/70 font-bold text-sky-700' : 'text-slate-700'}`}
                              >
                                <span className="font-mono font-bold">[{c.id}] {c.customerName}</span>
                                <span className="text-[10px] text-slate-400">คงเหลือค้างต้นกู้หลัก: {formatThb(c.outstandingPrincipal)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">จำนวนยอดเงินที่ส่งชำระ (THB) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={amountPaid}
                    onChange={e => setAmountPaid(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50 font-bold text-slate-800 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">วันที่ได้รับเงินชำระโอนจริง *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50 font-semibold font-mono text-slate-800"
                  />
                </div>
              </div>

              {selectedContractId && (
                <div className="space-y-4">
                  {/* Daily / Term Interest Breakdown Card */}
                  <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-lg space-y-3">
                    <span className="font-extrabold text-sky-850 flex items-center gap-1.5 text-xs">
                      <Info className="w-4 h-4 text-sky-600" />
                      {(() => {
                        const con = contracts.find(c => c.id === selectedContractId);
                        return con?.productType === 'HP'
                          ? 'รายละเอียดดอกเบี้ยและภาษีมูลค่าเพิ่มประจำงวด (HP Interest & VAT Breakdown)'
                          : 'รายละเอียดวิธีคำนวณดอกเบี้ย ณ วันที่ระบุชำระจริง (Daily Interest Breakdown)';
                      })()}
                    </span>
                    {(() => {
                      const con = contracts.find(c => c.id === selectedContractId);
                      if (!con) return null;

                      const selCid = (selectedContractId || '').trim().toUpperCase();
                      const activeSchedules = schedules
                        .filter(s => (s.contractId || '').trim().toUpperCase() === selCid)
                        .sort((a, b) => a.termNumber - b.termNumber);

                      const nextUnpaidTerm = activeSchedules.find(s => s.status !== 'PAID');
                      if (!nextUnpaidTerm) {
                        return (
                           <p className="text-emerald-700 font-bold bg-emerald-55/35 p-2 rounded text-[11px] border border-emerald-100 font-sans">
                             สัญญานี้ได้รับการชำระครบกำหนดครบถ้วนเรียบร้อยแล้ว! ไม่มียอดค้างชำระที่คำนวณได้
                           </p>
                        );
                      }

                      // Compute dynamic interest breakdown based on user simulation date!
                      const effectivePaymentDate = paymentDate || getTodayDateString();
                      const breakdown = getInterestCalculationBreakdown(con, nextUnpaidTerm.termNumber, schedules, repayments, effectivePaymentDate);
                      const totalInterest = Math.round(breakdown.reduce((sum, b) => sum + b.interestCharged, 0) * 100) / 100;

                      const priorCarriedAccrued = Math.round(
                        activeSchedules
                          .filter(s => s.termNumber < nextUnpaidTerm.termNumber && (s.accruedInterest || 0) > 0)
                          .reduce((sum, s) => sum + (s.accruedInterest || 0), 0) * 100
                      ) / 100;

                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center bg-white p-2 rounded border border-sky-100/50 text-[11px]">
                            <div>
                              <span className="text-slate-500 font-bold block">งวดถัดไปที่ตัดชำระ:</span>
                              <span className="font-extrabold text-sky-800 font-mono">งวดที่ {nextUnpaidTerm.termNumber} (Due: {nextUnpaidTerm.dueDate})</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-500 font-bold block">
                                {con.productType === 'HP' ? 'ดอกเบี้ยเรียกเก็บงวดนี้:' : 'ดอกเบี้ยคำนวณสะสมช่วงงวดนี้:'}
                              </span>
                              <span className="font-black text-emerald-600 text-xs font-mono">
                                {formatThb(totalInterest)}
                                {priorCarriedAccrued > 0 && (
                                  <span className="text-[10px] text-amber-600 font-normal ml-1">
                                    (+ยกมา {formatThb(priorCarriedAccrued)})
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          {breakdown.length > 0 ? (
                            <div className="max-h-36 overflow-y-auto rounded border border-slate-200/80 bg-white">
                              <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b text-slate-500 font-bold sticky top-0">
                                    <th className="p-2">{con.productType === 'HP' ? 'ค่างวดบัญชี' : 'ช่วงเวลาใช้เงินกู้จริง'}</th>
                                    <th className="p-2 text-center">{con.productType === 'HP' ? 'ประเภท' : 'จำนวนวัน'}</th>
                                    <th className="p-2 text-right">เงินต้นคงเหลือ (Outstanding)</th>
                                    <th className="p-2 text-right text-sky-850">ดอกเบี้ย (Interest)</th>
                                    {con.productType === 'HP' && <th className="p-2 text-right text-indigo-700">ภาษีมูลค่าเพิ่ม (VAT 7%)</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-650 font-mono">
                                  {breakdown.map((b, bIdx) => (
                                    <tr key={bIdx} className="hover:bg-sky-50/20">
                                      <td className="p-2 font-sans">
                                        {con.productType === 'HP'
                                          ? `งวดเช่าซื้อที่ ${nextUnpaidTerm.termNumber} (Due: ${nextUnpaidTerm.dueDate})`
                                          : `${b.startDate} ถึง ${b.endDate}`}
                                      </td>
                                      <td className="p-2 text-center text-slate-500 font-bold">
                                        {con.productType === 'HP' ? 'รายงวด (HP)' : `${b.daysCount} วัน`}
                                      </td>
                                      <td className="p-2 text-right text-slate-700 font-bold">{formatThb(b.principal)}</td>
                                      <td className="p-2 text-right font-black text-emerald-600">{formatThb(b.interestCharged)}</td>
                                      {con.productType === 'HP' && (
                                        <td className="p-2 text-right font-black text-indigo-600">{formatThb(nextUnpaidTerm.vatDue)}</td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-center py-2 text-[10px] bg-slate-50 rounded">
                              ไม่มีข้อมูลย่อยการคำนวณดอกเบี้ย
                            </p>
                          )}
                          
                          {con.productType === 'HP' ? (
                            <p className="text-[9px] text-slate-400 leading-normal font-sans">
                              * สัญญาเช่าซื้อคิดดอกเบี้ยแบบรายงวด (Monthly Effective Rate) อัตรา {con.interestRate}% ต่อปี <br />
                              สูตร: <code className="font-mono bg-slate-100 px-1 rounded font-bold">เงินต้นคงเหลือตามตาราง × {con.interestRate}% / 12</code> <br />
                              (และคำนวณภาษีมูลค่าเพิ่ม VAT 7% จากยอดรวม [เงินต้น + ดอกเบี้ย] ประจำงวด)
                            </p>
                          ) : (
                            <p className="text-[9px] text-slate-400 leading-normal font-sans">
                              * คิดแบบลดต้นลดดอกรายวัน (Daily Reducing Balance) อัตรา {con.interestRate}% ต่อปี <br />
                              สูตร: <code className="font-mono bg-slate-100 px-1 rounded font-bold">เงินต้น × {con.interestRate}% × (วัน / 365)</code>
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* REAL-TIME ALLOCATION PREVIEW CARD */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-lg space-y-3">
                    <span className="font-extrabold text-emerald-900 flex items-center gap-1.5 text-xs">
                      <Coins className="w-4 h-4 text-emerald-600 animate-pulse" />
                      จำลองลำดับตารางการตัดยอดรับชำระ (Repayment Allocation Preview)
                    </span>
                    {(() => {
                      const con = contracts.find(c => c.id === selectedContractId);
                      if (!con) return null;

                      // Run simulated recalculation & allocation
                      const simCid = (selectedContractId || '').trim().toUpperCase();
                      const simSchedules = schedules
                        .filter(s => (s.contractId || '').trim().toUpperCase() === simCid)
                        .sort((a, b) => a.termNumber - b.termNumber);
                      
                      const effectivePaymentDate = paymentDate || getTodayDateString();
                      const firstDisbDate = getFirstDisbursementDate(con.id) || con.firstDisburseDate || con.startDate;
                      const simulatedRecalcSchedules = recalculateFutureSchedules(con, schedules, effectivePaymentDate, repayments, firstDisbDate);
                      const simResult = allocateHorizontalPayment(
                        simulatedRecalcSchedules,
                        selectedContractId,
                        amountPaid || 0,
                        effectivePaymentDate,
                        con.productType === 'HP' ? 0.07 : 0,
                        firstDisbDate,
                        repayments,
                        con
                      );

                      const totalAllocated = simResult.allocationItems.reduce((sum, item) => sum + item.total, 0);
                      const excessCash = Math.max(0, (amountPaid || 0) - totalAllocated);

                      if (!amountPaid || amountPaid <= 0) {
                        return (
                          <p className="text-slate-400 italic text-center py-2.5 text-[11px] bg-white rounded border border-slate-100">
                            กรุณาระบุจำนวนยอดเงินชำระ เพื่อพรีวิวลำดับการตัดชำระค่างวดจริงรายรายการ
                          </p>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {simResult.allocationItems.length === 0 ? (
                            <p className="text-amber-700 font-bold bg-amber-50 p-2 rounded text-[11px] border border-amber-100">
                              ไม่มียอดค้างชำระที่ต้องตัดจ่าย หรือเงินน้อยกว่าส่วนที่จะหักชำระได้
                            </p>
                          ) : (
                            <div className="max-h-36 overflow-y-auto rounded border border-slate-200/80 bg-white">
                              <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b text-slate-500 font-bold sticky top-0">
                                    <th className="p-2">งวดที่จะถูกหัก (Term)</th>
                                    <th className="p-2 text-right text-rose-600">ตัดเบี้ยปรับ (Penalty)</th>
                                    <th className="p-2 text-right text-rose-600">ตัดทวงถาม (Tracking)</th>
                                    <th className="p-2 text-right text-emerald-600">ตัดดอกเบี้ย (Interest)</th>
                                    <th className="p-2 text-right text-slate-800">ตัดเงินต้น (Principal)</th>
                                    {con.productType === 'HP' && <th className="p-2 text-right text-indigo-600">ตัดภาษี (VAT)</th>}
                                    <th className="p-2 text-right font-bold text-emerald-800">รวมตัด (Total)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-650 font-mono">
                                  {simResult.allocationItems.map((item, itemIdx) => (
                                    <tr key={itemIdx} className="hover:bg-emerald-50/20">
                                      <td className="p-2 font-sans font-bold text-slate-700">งวดที่ {item.termNumber}</td>
                                      <td className="p-2 text-right text-rose-600">{item.penalty > 0 ? formatThb(item.penalty) : '-'}</td>
                                      <td className="p-2 text-right text-rose-600">{item.trackingFee > 0 ? formatThb(item.trackingFee) : '-'}</td>
                                      <td className="p-2 text-right text-emerald-600">{item.interest > 0 ? formatThb(item.interest) : '-'}</td>
                                      <td className="p-2 text-right text-slate-800">{item.principal > 0 ? formatThb(item.principal) : '-'}</td>
                                      {con.productType === 'HP' && (
                                        <td className="p-2 text-right text-indigo-600">{item.vat > 0 ? formatThb(item.vat) : '-'}</td>
                                      )}
                                      <td className="p-2 text-right font-bold text-emerald-700">{formatThb(item.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          <div className="bg-emerald-100/40 p-2.5 rounded border border-emerald-200/50 space-y-1 text-[11px] font-sans">
                            <div className="flex justify-between">
                              <span className="text-slate-600 font-bold">รวมยอดเงินจัดสรรตัดชำระจริง:</span>
                              <span className="font-extrabold text-emerald-800 font-mono">{formatThb(totalAllocated)}</span>
                            </div>
                            {excessCash > 0.01 && (
                              <div className="flex justify-between border-t border-emerald-200/30 pt-1 text-sky-800">
                                <span className="font-bold">เงินเหลือล้นงวด (Excess / ชำระล่วงหน้า):</span>
                                <span className="font-black font-mono">{formatThb(excessCash)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}



              <div className="flex justify-end space-x-3 border-t border-slate-150 pt-5 font-sans">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  ออก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-600 text-white rounded-lg font-bold hover:bg-sky-700 transition cursor-pointer shadow-xs"
                >
                  บันทึกสับยอดรับชำระเงินค่างวด
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Receipt Viewer Printable Modal */}
      {selectedReceiptContract && selectedReceiptRepay && (
        <DocViewerModal
          isOpen={isDocOpen}
          onClose={() => setIsDocOpen(false)}
          type="RECEIPT"
          contract={selectedReceiptContract}
          repayment={selectedReceiptRepay}
          schedules={schedules}
        />
      )}
    </div>
  );
}
