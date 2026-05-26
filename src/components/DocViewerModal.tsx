import React, { useRef } from 'react';
import { Printer, X, Coins, FileText, CheckCircle } from 'lucide-react';
import { Contract, ScheduledPayment, Repayment } from '../types';

interface DocViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'INVOICE' | 'RECEIPT';
  contract: Contract;
  scheduledPayment?: ScheduledPayment; // For Invoice
  repayment?: Repayment; // For Receipt
}

export default function DocViewerModal({
  isOpen,
  onClose,
  type,
  contract,
  scheduledPayment,
  repayment
}: DocViewerModalProps) {
  if (!isOpen) return null;

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;

    if (printContent) {
      // Create a style block for high fidelity document print
      const style = document.createElement('style');
      style.textContent = `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `;
      document.head.appendChild(style);
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${type === 'INVOICE' ? 'Invoice-' + contract.id : 'Receipt-' + (repayment?.receiptNo || 'RCP')}</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;850&display=swap');
                body {
                  font-family: 'Sarabun', sans-serif;
                  background-color: white !important;
                  color: #1a1a1a !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-container {
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                }
              </style>
            </head>
            <body class="p-6 bg-white">
              <div class="max-w-[21cm] mx-auto">
                ${printContent}
              </div>
              <script>
                // Give Tailwind script of printable window 800ms to compile styles before dialog fires
                setTimeout(function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 500);
                }, 800);
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
      
      // Clean up style
      document.head.removeChild(style);
    }
  };

  const getVatValue = () => {
    if (type === 'INVOICE' && scheduledPayment) {
      return scheduledPayment.vatDue;
    }
    if (type === 'RECEIPT' && repayment) {
      return repayment.appliedVat;
    }
    return 0;
  };

  const getSubTotal = () => {
    if (type === 'INVOICE' && scheduledPayment) {
      return scheduledPayment.principalDue + scheduledPayment.interestDue;
    }
    if (type === 'RECEIPT' && repayment) {
      return repayment.appliedPrincipal + repayment.appliedInterest;
    }
    return 0;
  };

  const getGrandTotal = () => {
    if (type === 'INVOICE' && scheduledPayment) {
      return scheduledPayment.totalDue;
    }
    if (type === 'RECEIPT' && repayment) {
      return repayment.amountPaid;
    }
    return 0;
  };

  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  // Convert numbers to text (Thai Baht Text)
  const thaiBahtText = (num: number): string => {
    const thaiNumbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const thaiPositions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    let str = num.toFixed(2);
    let [integerPart, decimalPart] = str.split('.');
    
    let text = '';
    
    if (parseInt(integerPart) === 0) {
      text = 'ศูนย์บาท';
    } else {
      const len = integerPart.length;
      for (let i = 0; i < len; i++) {
        const digit = parseInt(integerPart.charAt(i));
        const pos = len - i - 1;
        if (digit !== 0) {
          if (pos === 1 && digit === 1) {
            text += 'สิบ';
          } else if (pos === 1 && digit === 2) {
            text += 'ยี่สิบ';
          } else if (pos === 0 && digit === 1 && len > 1) {
            text += 'เอ็ด';
          } else {
            text += thaiNumbers[digit] + thaiPositions[pos];
          }
        }
      }
      text += 'บาท';
    }
    
    if (decimalPart === '00' || !decimalPart) {
      text += 'ถ้วน';
    } else {
      const d1 = parseInt(decimalPart.charAt(0));
      const d2 = parseInt(decimalPart.charAt(1));
      if (d1 !== 0) {
        if (d1 === 1) text += 'สิบ';
        else if (d1 === 2) text += 'ยี่สิบ';
        else text += thaiNumbers[d1] + 'สิบ';
      }
      if (d2 !== 0) {
        if (d2 === 1 && d1 !== 0) text += 'เอ็ด';
        else text += thaiNumbers[d2];
      }
      text += 'สตางค์';
    }
    
    return text;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] border border-slate-100 animate-fade-in">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-sky-100 bg-sky-600 rounded-t-xl text-white">
          <div className="flex items-center space-x-2 font-mono">
            <FileText className="w-5 h-5 text-sky-105" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              {type === 'INVOICE' ? 'พิมพ์ใบแจ้งหนี้ / Invoice Preview' : 'พิมพ์ใบเสร็จรับเงิน/ใบกำกับภาษี Preview'}
            </h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-2 bg-white text-sky-700 hover:bg-sky-50 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Content Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-50" id="document-print-outer">
          <div 
            ref={printAreaRef}
            className="bg-white p-10 rounded-lg border border-slate-200 shadow-sm max-w-[21cm] mx-auto text-slate-800 print-container"
          >
            {/* Template Top Header */}
            <div className="flex justify-between items-start border-b-2 border-sky-600 pb-6 mb-6 font-sans">
              <div>
                <div className="flex items-center space-x-2 mb-2 text-sky-600 font-mono">
                  <span className="text-xl font-extrabold tracking-tight">LMS ENTERPRISE CO., LTD.</span>
                </div>
                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                  สำนักงานใหญ่: 888 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400<br/>
                  เลขประจำตัวผู้เสียภาษี: 0105566029144 (Tel: 02-123-4567)
                </p>
              </div>

              <div className="text-right font-sans">
                <h1 className="text-xl font-extrabold text-sky-700 tracking-wide uppercase">
                  {type === 'INVOICE' ? 'ใบแจ้งหนี้ / INVOICE' : 'ใบเสร็จรับเงิน / ใบกำกับภาษี'}
                </h1>
                <p className="text-[10px] text-slate-400 font-extrabold tracking-widest font-mono uppercase mt-0.5">RECEIPT / TAX INVOICE</p>
                <div className="mt-4 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-150 inline-block text-left font-mono">
                  <div><strong className="text-slate-700">เลขที่เอกสาร:</strong> {type === 'INVOICE' ? `INV-${contract.id}-${scheduledPayment?.termNumber}` : (repayment?.receiptNo || 'RCP-xxxx')}</div>
                  <div><strong className="text-slate-700">วันที่ออกหลักฐาน:</strong> {type === 'INVOICE' ? scheduledPayment?.lastUpdated : repayment?.paymentDate}</div>
                </div>
              </div>
            </div>

            {/* Customer & Contract Rows */}
            <div className="grid grid-cols-2 gap-8 mb-6 text-xs bg-slate-50/50 p-4 rounded-lg border border-slate-100 font-sans">
              <div>
                <h4 className="font-extrabold text-sky-850 border-b border-slate-200 pb-1.5 mb-2 text-xs uppercase tracking-wider font-mono">
                  ข้อมูลผู้เช่าซื้อ / ลูกค้า (CUSTOMER)
                </h4>
                <div className="space-y-1.5 text-slate-650">
                  <div><strong>ชื่อผู้ติดต่อ:</strong> {contract.customerName}</div>
                  <div><strong>เลขผู้เสียภาษี:</strong> <span className="font-mono">{contract.customerTaxId || '-'}</span></div>
                  <div><strong>เบอร์โทรศัพท์:</strong> <span className="font-mono">{contract.customerPhone || '-'}</span></div>
                  <div><strong>ที่อยู่:</strong> {contract.customerAddress || 'กรุงเทพมหานคร, ประเทศไทย (ตามทะเบียนบ้าน)'}</div>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-sky-850 border-b border-[#E5E7EB] pb-1.5 mb-2 text-xs uppercase tracking-wider font-mono">
                  รายละเอียดสัญญา (CONTRACT DETAILS)
                </h4>
                <div className="space-y-1.5 text-slate-650">
                  <div><strong>เลขที่สัญญา:</strong> <span className="font-mono font-bold uppercase">{contract.id}</span></div>
                  <div><strong>ประเภทผลิตภัณฑ์:</strong> {contract.productType === 'HP' ? 'เช่าซื้อรถบรรทุก (Hire Purchase)' : `เงินกู้ทั่วไป (${contract.paymentFrequency})`}</div>
                  <div><strong>วงเงินอนุมัติ:</strong> <span className="font-mono">{formatThb(contract.creditLimit)}</span></div>
                  <div><strong>อัตราดอกเบี้ย:</strong> <span className="font-mono font-bold text-sky-600">{contract.interestRate}% ต่อปี</span></div>
                  <div className="text-rose-600 font-bold"><strong>ยอดคงค้างเงินต้น (Outstanding):</strong> <span className="font-mono font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 border border-rose-100 rounded">{formatThb(contract.outstandingPrincipal)}</span></div>
                </div>
              </div>
            </div>

            {/* Document Specific Wording */}
            {type === 'INVOICE' && scheduledPayment && (
              <div className="mb-4 text-xs bg-amber-50 text-amber-950 p-3 rounded-lg border border-amber-200/60 leading-relaxed font-sans">
                💡 <strong>เรียนลูกค้าผู้มีอุปการคุณ:</strong> กรุณาชำระยอดเรียกเก็บเงินภายในวันที่ <strong className="font-mono text-amber-700">{scheduledPayment.dueDate}</strong> หากต้องการติดต่อสอบถามหรือชำระค่างวดสามารถทำได้ผ่าน Direct Debit หรือสแกนชำระเงินทางท้ายเอกสาร
              </div>
            )}

            {/* Items Table */}
            <table className="w-full text-left border-collapse text-xs mb-8 font-sans">
              <thead>
                <tr className="bg-sky-600 text-white font-mono uppercase tracking-wider text-[10px]">
                  <th className="p-3 rounded-l border-b border-sky-650">ลำดับ (No.)</th>
                  <th className="p-3 border-b border-sky-650">รายการรายละเอียดค่าใช้จ่าย (Description)</th>
                  <th className="p-3 border-b border-sky-650 text-right">จำนวนเงินปกติ (Amount)</th>
                  <th className="p-3 border-b border-sky-650 text-right">เบี้ยปรับ / ทวงถาม (Fees)</th>
                  <th className="p-3 rounded-r border-b border-sky-650 text-right">ยอดรวมสุทธิ (Net Total)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-650">
                {type === 'INVOICE' && scheduledPayment ? (
                  <>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 text-center font-mono">1</td>
                      <td className="p-3">
                        <div><strong className="text-slate-800">ค่าเบี้ยผ่อนชำระงวดที่ {scheduledPayment.termNumber}</strong></div>
                        <div className="text-slate-400 text-[10px] font-mono mt-0.5">เงินต้น: {formatThb(scheduledPayment.principalDue)} | ดอกเบี้ย: {formatThb(scheduledPayment.interestDue)}</div>
                      </td>
                      <td className="p-3 text-right font-mono">{formatThb(scheduledPayment.principalDue + scheduledPayment.interestDue)}</td>
                      <td className="p-3 text-right font-mono">-</td>
                      <td className="p-3 text-right font-mono">{formatThb(scheduledPayment.principalDue + scheduledPayment.interestDue)}</td>
                    </tr>
                    {(scheduledPayment.penaltyDue > 0 || scheduledPayment.trackingFeeDue > 0) && (
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono">2</td>
                        <td className="p-3">
                          <div><strong className="text-slate-800">ค่าติดตามทวงถามและค่าเบี้ยปรับค้างชำระ</strong></div>
                          <div className="text-rose-500 text-[10px] font-mono mt-0.5">
                            {scheduledPayment.trackingFeeDue > 0 && `ค่าติดตามทวงถาม: ${formatThb(scheduledPayment.trackingFeeDue)}`}
                            {scheduledPayment.penaltyDue > 0 && ` | ค่าปรับล่าช้า: ${formatThb(scheduledPayment.penaltyDue)}`}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">-</td>
                        <td className="p-3 text-right text-rose-600 font-bold font-mono">
                          {formatThb(scheduledPayment.penaltyDue + scheduledPayment.trackingFeeDue)}
                        </td>
                        <td className="p-3 text-right text-rose-600 font-bold font-mono">
                          {formatThb(scheduledPayment.penaltyDue + scheduledPayment.trackingFeeDue)}
                        </td>
                      </tr>
                    )}
                    {contract.productType === 'HP' && (
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono">{scheduledPayment.penaltyDue > 0 ? 3 : 2}</td>
                        <td className="p-3">
                          <strong className="text-slate-800">ภาษีมูลค่าเพิ่ม (VAT 7%)</strong> <span className="text-slate-400 text-[10px]">(คำนวณจากค่างวดเช่าซื้อ)</span>
                        </td>
                        <td className="p-3 text-right font-mono">{formatThb(scheduledPayment.vatDue)}</td>
                        <td className="p-3 text-right font-mono">-</td>
                        <td className="p-3 text-right font-mono">{formatThb(scheduledPayment.vatDue)}</td>
                      </tr>
                    )}
                  </>
                ) : type === 'RECEIPT' && repayment ? (
                  <>
                    <tr className="hover:bg-slate-50/50">
                      <td className="p-3 text-center font-mono">1</td>
                      <td className="p-3">
                        <div><strong className="text-slate-800">ตัดชำระค่างวด / เงินต้นค้างชำระ (Repayment Allocated)</strong></div>
                        <div className="text-emerald-700 text-[10px] font-mono mt-0.5">เงินต้นที่ตัด: {formatThb(repayment.appliedPrincipal)} | ดอกเบี้ยที่ตัด: {formatThb(repayment.appliedInterest)}</div>
                      </td>
                      <td className="p-3 text-right font-mono">{formatThb(repayment.appliedPrincipal + repayment.appliedInterest)}</td>
                      <td className="p-3 text-right font-mono">-</td>
                      <td className="p-3 text-right font-mono">{formatThb(repayment.appliedPrincipal + repayment.appliedInterest)}</td>
                    </tr>
                    {(repayment.appliedPenalty > 0 || repayment.appliedTrackingFee > 0) && (
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono">2</td>
                        <td className="p-3">
                          <div><strong className="text-slate-800">ตัดชำระค่าทวงถามและค่าเบี้ยปรับ (Overdue Fees Deducted)</strong></div>
                          <div className="text-emerald-700 text-[10px] font-mono mt-0.5">
                            {repayment.appliedTrackingFee > 0 && `ค่าติดตามทวงถาม: ${formatThb(repayment.appliedTrackingFee)} `}
                            {repayment.appliedPenalty > 0 && `| ค่าตรวจสอบวิเคราะห์เบี้ยปรับสะสม: ${formatThb(repayment.appliedPenalty)}`}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">-</td>
                        <td className="p-3 text-right text-emerald-600 font-mono font-bold">
                          {formatThb(repayment.appliedPenalty + repayment.appliedTrackingFee)}
                        </td>
                        <td className="p-3 text-right text-emerald-600 font-mono font-bold">
                          {formatThb(repayment.appliedPenalty + repayment.appliedTrackingFee)}
                        </td>
                      </tr>
                    )}
                    {repayment.appliedVat > 0 && (
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono">3</td>
                        <td className="p-3">
                          <strong className="text-slate-800">ภาษีมูลค่าเพิ่มที่ได้รับชำระ (VAT Received 7%)</strong>
                        </td>
                        <td className="p-3 text-right font-mono">{formatThb(repayment.appliedVat)}</td>
                        <td className="p-3 text-right font-mono">-</td>
                        <td className="p-3 text-right font-mono">{formatThb(repayment.appliedVat)}</td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">ไม่มีข้อมูลธุรกรรมอ้างอิง</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Total Block Calc */}
            <div className="flex justify-between items-start text-xs border-t border-slate-250 pt-6 font-sans">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 max-w-sm">
                <strong className="text-slate-650 text-[10px] uppercase font-bold tracking-wider">ตัวอักษร / BAHT TEXT:</strong>
                <p className="text-slate-700 mt-1.5 font-bold">({thaiBahtText(getGrandTotal())})</p>
              </div>

              <div className="w-80 space-y-2 text-right">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>ยอดยอดจัดเก็บไม่รวมภาษี (Subtotal):</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatThb(getSubTotal())}</span>
                </div>
                {contract.productType === 'HP' && (
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                    <span className="font-semibold text-slate-800 font-mono">{formatThb(getVatValue())}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-sky-850 border-t border-slate-200 pt-2 font-mono">
                  <span>ยอดสุทธิรวมทั้งสิ้น (Grand Total):</span>
                  <span>{formatThb(getGrandTotal())}</span>
                </div>
              </div>
            </div>

            {/* Payment allocations & Bank transfer guide */}
            {type === 'INVOICE' && (
              <div className="mt-8 border border-dashed border-slate-250 rounded-lg p-4 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-500 font-sans">
                <div className="flex items-center space-x-3">
                  <Coins className="w-6 h-6 text-sky-600 shrink-0" />
                  <div>
                    <h5 className="font-bold text-slate-700 text-xs">ช่องทางชำระเงิน / Bank Transfer Details</h5>
                    <p className="mt-1 font-mono">ธนาคารกรุงไทย (KTB) • บัญชีกระแสรายวัน: 001-9-28192-3</p>
                    <p className="font-mono">ชื่อบัญชี: บจก. แอลเอ็มเอส เอนเตอร์ไพรส์ (LMS Enterprise Co., Ltd.)</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-center">
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-[8px] border border-slate-250 font-mono text-slate-400 font-semibold shadow-xs">
                    [ QR PAY ]
                  </div>
                  <span className="mt-1.5 text-[8px] font-bold text-slate-400 font-mono">Scan for PromptPay</span>
                </div>
              </div>
            )}

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-12 mt-12 text-center text-xs font-sans">
              <div className="flex flex-col items-center justify-end">
                <div className="w-40 border-b border-slate-300 pb-2 mb-2 min-h-[50px] flex items-end justify-center">
                  {type === 'RECEIPT' && <CheckCircle className="w-10 h-10 text-sky-500 mb-1 opacity-60" />}
                </div>
                <p className="font-bold text-slate-700">ผู้รับเงิน / ผู้แจ้งเรื่อง</p>
                <p className="text-[10px] text-slate-400 mt-1">เจ้าหน้าที่ฝ่ายวิเคราะห์สินเชื่อ (LMS)</p>
              </div>

              <div className="flex flex-col items-center justify-end">
                <div className="w-40 border-b border-slate-300 pb-2 mb-2 min-h-[50px]"></div>
                <p className="font-bold text-slate-700">ลูกค้า / ผู้รับมอบอำนาจชำระเงิน</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">วันที่: {type === 'INVOICE' ? '____/____/____' : repayment?.paymentDate}</p>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="border-t border-slate-100 pt-4 mt-8 text-[9px] text-center text-slate-400 font-mono">
              เอกสารฉบับนี้พิมพ์ด้วยระบบคอมพิวเตอร์ผ่านระบบ LMS Enterprise Portal • ถือเป็นเอกสารสมบูรณ์โดยไม่ต้องลงลายมือชื่อ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
