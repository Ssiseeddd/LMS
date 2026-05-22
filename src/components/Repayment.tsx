import React, { useState, useEffect } from 'react';
import { getRepayments, getContracts, recordRepayment } from '../dbStore';
import { Repayment as RepaymentType, Contract, RepaymentAllocationItem } from '../types';
import { Search, Plus, Download, Coins, Receipt, ArrowDownLeft, CheckCircle2, ListFilter, AlertCircle } from 'lucide-react';
import DocViewerModal from './DocViewerModal';

export default function Repayment() {
  const [repayments, setRepayments] = useState<RepaymentType[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedContractId, setSelectedContractId] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(11172.08);
  const [paymentDate, setPaymentDate] = useState('2026-05-22');

  // Success Feedback view states
  const [showAllocationReceipt, setShowAllocationReceipt] = useState(false);
  const [lastAllocatedRepayment, setLastAllocatedRepayment] = useState<RepaymentType | null>(null);

  // Modal Doc states
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [selectedReceiptContract, setSelectedReceiptContract] = useState<Contract | null>(null);
  const [selectedReceiptRepay, setSelectedReceiptRepay] = useState<RepaymentType | undefined>(undefined);

  useEffect(() => {
    setRepayments(getRepayments());
    setContracts(getContracts());
  }, []);

  // Update default payment offer dynamically when Contract modifies
  useEffect(() => {
    const found = contracts.find(c => c.id === selectedContractId);
    if (found) {
      if (found.productType === 'HP') {
        // Offer standard HP installment ~ 11172.08
        setAmountPaid(found.creditLimit * 0.0931); // Rough installment
      } else {
        setAmountPaid(found.creditLimit * 0.08); // Normal loan rough installments
      }
    }
  }, [selectedContractId, contracts]);

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId || amountPaid <= 0) return;

    const recorded = recordRepayment(selectedContractId, Number(amountPaid), paymentDate);

    if (recorded) {
      setRepayments(getRepayments());
      setContracts(getContracts());
      setLastAllocatedRepayment(recorded);
      setShowAllocationReceipt(true);
      setIsModalOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedContractId('');
    setAmountPaid(5000);
    setPaymentDate('2026-05-22');
  };

  const handleExportCSV = () => {
    const headers = 'Receipt No.,Contract ID,Customer Name,Payment Date,Gross Paid,Penalty Settled,Tracking Fee Settled,Interest Settled,Principal Settled,VAT Settled\n';
    const rows = repayments.map(r => {
      const parent = contracts.find(c => c.id === r.contractId);
      const name = parent ? parent.customerName : 'N/A';
      return `"${r.receiptNo}","${r.contractId}","${name}","${r.paymentDate}",${r.amountPaid},${r.appliedPenalty},${r.appliedTrackingFee},${r.appliedInterest},${r.appliedPrincipal},${r.appliedVat}`;
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
    const con = contracts.find(c => c.id === repay.contractId);
    if (con) {
      setSelectedReceiptContract(con);
      setSelectedReceiptRepay(repay);
      setIsDocOpen(true);
    }
  };

  // Filters
  const filteredRepays = repayments.filter(r => {
    const parent = contracts.find(c => c.id === r.contractId);
    const parentName = parent ? parent.customerName.toLowerCase() : '';
    const matchesId = r.contractId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesName = parentName.includes(searchName.toLowerCase());

    return (searchTerm ? matchesId : true) && (searchName ? matchesName : true);
  });

  return (
    <div className="space-y-6">
      {/* Search Bar Panel & Control buttons */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาตามรหัสสัญญาที่ชำระ..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสมาชิกลูกหนี้..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออกข้อมูล (CSV)</span>
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#25348D] text-white rounded-lg text-xs font-semibold hover:bg-[#213F9A] transition shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกชำระค่างวด (Repay)</span>
          </button>
        </div>
      </div>

      {/* Success Horizontal Cut Feedback Log Panel */}
      {showAllocationReceipt && lastAllocatedRepayment && (
        <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl p-6 shadow-sm space-y-4 font-sans animate-fade-in">
          <div className="flex justify-between items-start border-b border-emerald-200 pb-3">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <h4 className="font-extrabold text-[#25348D] text-[15px]">ตัดยอดจัดชำระแนวนอน (Horizontal Allocation) สำเร็จ!</h4>
                <p className="text-xs text-slate-500 mt-0.5">เงินจำนวน <strong>{formatThb(lastAllocatedRepayment.amountPaid)}</strong> ได้รับจัดสรร term-by-term ตามลำดับเกรซพีเรียดพาร์ทเนอร์</p>
              </div>
            </div>
            <button
              onClick={() => setShowAllocationReceipt(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold font-mono text-slate-600 bg-white border rounded px-1.5 cursor-pointer"
            >
              ซ่อน logs
            </button>
          </div>

          {/* Table display of distribution details */}
          <div className="bg-white rounded-lg border border-emerald-200/50 overflow-hidden text-xs">
            <div className="px-4 py-2 bg-emerald-100/40 border-b border-emerald-200/50 font-bold text-[#213F9A]">
              บันทึกลำดับแถวการชำระเงินต้นและดอกเบี้ย / เบี้ยปรับค้าง (Allocations breakdown)
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-500 border-b">
                  <th className="p-3">งวดที่ได้ชำระ (Term Number)</th>
                  <th className="p-3 text-right">ตัดเบี้ยปรับ (Penalty)</th>
                  <th className="p-3 text-right">ตัดค่าติดตาม (Collection Fee)</th>
                  <th className="p-3 text-right">ตัดดอกเบี้ย (Interest)</th>
                  <th className="p-3 text-right">ตัดปัดเศษเงินต้น (Principal)</th>
                  <th className="p-3 text-right">ตัดหักภาษี (VAT 7%)</th>
                  <th className="p-3 text-right font-bold text-emerald-700">รวมถูกตัดสุทธิ (Subtotal)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {lastAllocatedRepayment.distributionDetails.map((item, idx) => (
                  <tr key={idx} className="hover:bg-teal-50/10">
                    <td className="p-3 font-bold text-teal-900">งวดเรียกชำระที่ {item.termNumber}</td>
                    <td className="p-3 text-right text-rose-600 font-semibold">{item.penalty > 0 ? formatThb(item.penalty) : '-'}</td>
                    <td className="p-3 text-right text-rose-600 font-semibold">{item.trackingFee > 0 ? formatThb(item.trackingFee) : '-'}</td>
                    <td className="p-3 text-right text-emerald-600">{item.interest > 0 ? formatThb(item.interest) : '-'}</td>
                    <td className="p-3 text-right text-slate-800 font-semibold">{item.principal > 0 ? formatThb(item.principal) : '-'}</td>
                    <td className="p-3 text-right">{item.vat > 0 ? formatThb(item.vat) : '-'}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{formatThb(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span>* ลำดับลำเลียงตัดเงิน: เบี้ยปรับงวด N &rarr; ค่าทวงถามงวด N &rarr; ดอกเบี้ยงวด N &rarr; เงินต้นงวด N &rarr; ไปงวดถัดไป N+1</span>
            <button
              onClick={() => handleOpenReceipt(lastAllocatedRepayment)}
              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 text-xs transition cursor-pointer"
            >
              ออกใบเสร็จรับเงินใบนี้ทันที
            </button>
          </div>
        </div>
      )}

      {/* Transaction History Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs">
          <div>
            <h4 className="font-bold text-slate-800 text-sm">ประวัติการรับชำระค่างวดสะสม (Repayments Log & Tax Invoices)</h4>
            <p className="text-slate-400 mt-1">รายการสับยอดชำระและประทับเอกสารรับชำระจริงในระบบ</p>
          </div>
          <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-1 rounded border">รวม {filteredRepays.length} ธุรกรรม</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">เลขที่ใบเสร็จ</th>
                <th className="p-4">เลขที่สัญญา</th>
                <th className="p-4">สมาชิกลูกหนี้</th>
                <th className="p-4 text-center">วันที่ได้รับชำระ</th>
                <th className="p-4 text-right">ตัดเบี้ยปรับ</th>
                <th className="p-4 text-right">ตัดค่าติดตาม</th>
                <th className="p-4 text-right">ตัดดอกเบี้ย</th>
                <th className="p-4 text-right">ตัดเงินต้นค้าง</th>
                <th className="p-4 text-right">ตัดภาษี VAT</th>
                <th className="p-4 text-right font-bold text-[#25348D]">จำนวกระแสเงินฝากเข้ามา</th>
                <th className="p-4 text-center">พิมพ์ใบกำกับ/ใบเสร็จ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredRepays.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    ไม่พบรายการประวัติการชำระค่างวดอ้างอิงขณะนี้ในพอร์ตระบบ
                  </td>
                </tr>
              ) : (
                filteredRepays.map(r => {
                  const parent = contracts.find(c => c.id === r.contractId);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/40 transition">
                      <td className="p-4 font-mono font-bold text-slate-700">{r.receiptNo}</td>
                      <td className="p-4 font-mono font-bold text-[#213F9A] uppercase tracking-wider">{r.contractId}</td>
                      <td className="p-4 font-semibold text-slate-800">{parent ? parent.customerName : 'N/A'}</td>
                      <td className="p-4 text-center font-mono font-bold text-slate-500">{r.paymentDate}</td>
                      
                      <td className="p-4 text-right font-mono text-rose-500 font-medium">
                        {r.appliedPenalty > 0 ? formatThb(r.appliedPenalty) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono text-rose-500 font-medium">
                        {r.appliedTrackingFee > 0 ? formatThb(r.appliedTrackingFee) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-medium text-emerald-600">
                        {r.appliedInterest > 0 ? formatThb(r.appliedInterest) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-medium text-slate-800">
                        {r.appliedPrincipal > 0 ? formatThb(r.appliedPrincipal) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-600">
                        {r.appliedVat > 0 ? formatThb(r.appliedVat) : '-'}
                      </td>
                      
                      <td className="p-4 text-right font-mono font-extrabold text-[#25348D]">{formatThb(r.amountPaid)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenReceipt(r)}
                          className="p-1 px-3 bg-indigo-50 hover:bg-[#25348D] hover:text-white text-[#25348D] rounded font-bold text-[10px] transition flex items-center justify-center space-x-1 mx-auto cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-[#25348D] rounded-t-xl text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 text-[#41C3DB]" />
                <h3 className="font-semibold text-base">บันทึกรับชำระหนี้ค่างวดและเบี้ยปรนเปรอหนี้ค้าง</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/10 rounded p-1 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRepaySubmit} className="p-6 space-y-5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">เลือกหมายเลขทะเบียนสัญญาลูกหนี้ *</label>
                <select
                  required
                  value={selectedContractId}
                  onChange={e => setSelectedContractId(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50 font-bold text-slate-800"
                >
                  <option value="">-- กรุณาเลือกบัญชีสัญญาที่ต้องการตัดยอดชำระ --</option>
                  {contracts
                    .filter(c => c.status !== 'CLOSED')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.id}] {c.customerName} (คงเหลือค้างต้นกู้หลัก: {formatThb(c.outstandingPrincipal)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">จำนวนยอดเงินที่ส่งชำระ (บิลถอนฝาก) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="1"
                    value={amountPaid}
                    onChange={e => setAmountPaid(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50 font-bold text-slate-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">วันที่ได้รับเงินชำระโอนจริง *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50 font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-2 text-slate-700">
                <span className="font-bold flex items-center text-amber-900 border-b border-amber-200/50 pb-1 mb-1">
                  <AlertCircle className="w-4 h-4 mr-1 text-amber-700" />
                  หลักเกณฑ์ลอจิกการหักลบแนวนอน (Horizontal Grace Period Rules)
                </span>
                <p className="leading-relaxed text-[10px] text-slate-500">
                  ระบบ LMS จะจัดกระจายเงินตามช่วงชั้นแนวนอนทีละงวดเรียงจากงวดที่เก่าที่สุด: <br/>
                  <strong>ค่าปรับ (Penalty) &rarr; ค่าทวงถาม (Collection) &rarr; ดอกเบี้ย (Interest) &rarr; เงินต้น (Principal) + ภาษี (VAT)</strong> <br/>
                  เมื่อชำระงวดเก่าครบ 100% จึงย้ายไปหักชำระค่างวดถัดไปตามลำดับ!
                </p>
              </div>

              <div className="flex justify-end space-x-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4.5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  ออก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer shadow-md"
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
        />
      )}
    </div>
  );
}
