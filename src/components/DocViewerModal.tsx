import React, { useRef } from 'react';
import { Printer, X, Download, ShieldCheck, Building, Coins, FileText, CheckCircle } from 'lucide-react';
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
    const originalContent = document.body.innerHTML;

    if (printContent) {
      // Create a style block for high fidelity document print
      const style = document.createElement('style');
      style.textContent = `
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 1.5cm;
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
              <link href="https://cdn.jsdelivr.net/npm/tailwindcss@4.0.0/dist/index.css" rel="stylesheet">
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
                body {
                  font-family: 'Sarabun', sans-serif;
                }
              </style>
            </head>
            <body class="p-8 bg-white text-slate-800">
              ${printContent}
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-[#25348D] rounded-t-xl text-white">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#41C3DB]" />
            <h3 className="font-semibold text-lg">
              {type === 'INVOICE' ? 'พิมพ์ใบแจ้งหนี้ / Invoice Preview' : 'พิมพ์ใบเสร็จรับเงิน/ใบกำกับภาษี Preview'}
            </h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#41C3DB] hover:bg-[#32B4CC] text-slate-900 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition text-white"
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
            <div className="flex justify-between items-start border-b-2 border-[#25348D] pb-6 mb-6">
              <div>
                <div className="flex items-center space-x-2 mb-2 text-[#25348D]">
                  <Building className="w-8 h-8" />
                  <span className="text-xl font-bold tracking-tight">LMS ENTERPRISE CO., LTD.</span>
                </div>
                <p className="text-xs text-slate-500 max-w-md">
                  สำนักงานใหญ่: 888 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400<br/>
                  เลขประจำตัวผู้เสียภาษี: 0105566029144 (Tel: 02-123-4567)
                </p>
              </div>

              <div className="text-right">
                <h1 className="text-2xl font-bold text-[#25348D] tracking-wide">
                  {type === 'INVOICE' ? 'ใบแจ้งหนี้ / INVOICE' : 'ใบเสร็จรับเงิน/ใบกำกับภาษี'}
                </h1>
                <p className="text-xs text-slate-500 font-medium">RECEIPT / TAX INVOICE</p>
                <div className="mt-4 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 inline-block text-left">
                  <div><strong className="text-slate-700">เลขที่เอกสาร:</strong> {type === 'INVOICE' ? `INV-${contract.id}-${scheduledPayment?.termNumber}` : (repayment?.receiptNo || 'RCP-xxxx')}</div>
                  <div><strong className="text-slate-700">วันที่ออกหลักฐาน:</strong> {type === 'INVOICE' ? scheduledPayment?.lastUpdated : repayment?.paymentDate}</div>
                </div>
              </div>
            </div>

            {/* Customer & Contract Rows */}
            <div className="grid grid-cols-2 gap-8 mb-6 text-xs bg-slate-50/50 p-4 rounded-lg border border-slate-100">
              <div>
                <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5 mb-2 text-[13px] uppercase tracking-wider text-[#213F9A]">
                  ข้อมูลผู้เช่าซื้อ / ลูกค้า (CUSTOMER)
                </h4>
                <div className="space-y-1">
                  <div><strong>ชื่อผู้ติดต่อ:</strong> {contract.customerName}</div>
                  <div><strong>เลขผู้เสียภาษี:</strong> {contract.customerTaxId || '-'}</div>
                  <div><strong>เบอร์โทรศัพท์:</strong> {contract.customerPhone || '-'}</div>
                  <div><strong>ที่อยู่:</strong> กรุงเทพมหานคร, ประเทศไทย (ตามทะเบียนบ้าน)</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5 mb-2 text-[13px] uppercase tracking-wider text-[#213F9A]">
                  รายละเอียดสัญญา (CONTRACT DETAILS)
                </h4>
                <div className="space-y-1">
                  <div><strong>เลขที่สัญญา:</strong> {contract.id}</div>
                  <div><strong>ประเภทผลิตภัณฑ์:</strong> {contract.productType === 'HP' ? 'เช่าซื้อรถบรรทุก (Hire Purchase)' : `เงินกู้ทั่วไป (${contract.paymentFrequency})`}</div>
                  <div><strong>วงเงินอนุมัติ:</strong> {formatThb(contract.creditLimit)}</div>
                  <div><strong>อัตราดอกเบี้ย:</strong> {contract.interestRate}% ต่อปี (Effective Rate)</div>
                </div>
              </div>
            </div>

            {/* Document Specific Wording */}
            {type === 'INVOICE' && scheduledPayment && (
              <div className="mb-4 text-xs bg-amber-50 text-amber-900 p-3 rounded border border-amber-200">
                ⚠️ <strong>เรียนลูกค้าผู้มีอุปการคุณ:</strong> กรุณาชำระยอดเรียกเก็บเงินภายในวันที่ <strong>{scheduledPayment.dueDate}</strong> หากต้องการติดต่อสอบถามหรือชำระค่างวดสามารถทำได้ผ่าน Direct Debit หรือสแกนชำระเงินทางท้ายเอกสาร
              </div>
            )}

            {/* Items Table */}
            <table className="w-full text-left border-collapse text-xs mb-8">
              <thead>
                <tr className="bg-[#25348D] text-white">
                  <th className="p-2.5 rounded-l border-b border-[#25348D]">ลำดับ (No.)</th>
                  <th className="p-2.5 border-b border-[#25348D]">รายการรายละเอียดค่าใช้จ่าย (Description)</th>
                  <th className="p-2.5 border-b border-[#25348D] text-right">จำนวนเงินปกติ (Amount)</th>
                  <th className="p-2.5 border-b border-[#25348D] text-right">เบี้ยปรับ/ทวงถาม (Fees)</th>
                  <th className="p-2.5 rounded-r border-b border-[#25348D] text-right">ยอดรวมสุทธิ (Net Total)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {type === 'INVOICE' && scheduledPayment ? (
                  <>
                    <tr>
                      <td className="p-3 text-center">1</td>
                      <td className="p-3">
                        <div><strong>ค่าเบี้ยผ่อนชำระงวดที่ {scheduledPayment.termNumber}</strong></div>
                        <div className="text-slate-400 text-[10px]">เงินต้น: {formatThb(scheduledPayment.principalDue)} | ดอกเบี้ย: {formatThb(scheduledPayment.interestDue)}</div>
                      </td>
                      <td className="p-3 text-right">{formatThb(scheduledPayment.principalDue + scheduledPayment.interestDue)}</td>
                      <td className="p-3 text-right">-</td>
                      <td className="p-3 text-right">{formatThb(scheduledPayment.principalDue + scheduledPayment.interestDue)}</td>
                    </tr>
                    {(scheduledPayment.penaltyDue > 0 || scheduledPayment.trackingFeeDue > 0) && (
                      <tr>
                        <td className="p-3 text-center">2</td>
                        <td className="p-3">
                          <div><strong>ค่าติดตามทวงถามและค่าเบี้ยปรับค้างชำระ</strong></div>
                          <div className="text-rose-500 text-[10px]">
                            {scheduledPayment.trackingFeeDue > 0 && `ค่าติดตามทวงถาม (มี VAT): ${formatThb(scheduledPayment.trackingFeeDue)}`}
                            {scheduledPayment.penaltyDue > 0 && ` | ค่าปรับล่าช้า 15%ต่อปี: ${formatThb(scheduledPayment.penaltyDue)}`}
                          </div>
                        </td>
                        <td className="p-3 text-right">-</td>
                        <td className="p-3 text-right text-rose-600 font-medium">
                          {formatThb(scheduledPayment.penaltyDue + scheduledPayment.trackingFeeDue)}
                        </td>
                        <td className="p-3 text-right text-rose-600 font-medium">
                          {formatThb(scheduledPayment.penaltyDue + scheduledPayment.trackingFeeDue)}
                        </td>
                      </tr>
                    )}
                    {contract.productType === 'HP' && (
                      <tr>
                        <td className="p-3 text-center">{scheduledPayment.penaltyDue > 0 ? 3 : 2}</td>
                        <td className="p-3">
                          <strong>ภาษีมูลค่าเพิ่ม (VAT 7%)</strong> <span className="text-slate-400 text-[10px]">(คำนวณจากค่างวดเช่าซื้อ)</span>
                        </td>
                        <td className="p-3 text-right">{formatThb(scheduledPayment.vatDue)}</td>
                        <td className="p-3 text-right">-</td>
                        <td className="p-3 text-right">{formatThb(scheduledPayment.vatDue)}</td>
                      </tr>
                    )}
                  </>
                ) : type === 'RECEIPT' && repayment ? (
                  <>
                    <tr>
                      <td className="p-3 text-center">1</td>
                      <td className="p-3">
                        <div><strong>ตัดชำระค่างวด/เงินต้นค้างชำระ (Repayment Allocated)</strong></div>
                        <div className="text-emerald-600 text-[10px]">เงินต้นที่ตัด: {formatThb(repayment.appliedPrincipal)} | ดอกเบี้ยที่ตัด: {formatThb(repayment.appliedInterest)}</div>
                      </td>
                      <td className="p-3 text-right">{formatThb(repayment.appliedPrincipal + repayment.appliedInterest)}</td>
                      <td className="p-3 text-right">-</td>
                      <td className="p-3 text-right">{formatThb(repayment.appliedPrincipal + repayment.appliedInterest)}</td>
                    </tr>
                    {(repayment.appliedPenalty > 0 || repayment.appliedTrackingFee > 0) && (
                      <tr>
                        <td className="p-3 text-center">2</td>
                        <td className="p-3">
                          <div><strong>ตัดชำระค่าทวงถามและค่าเบี้ยปรับ (Overdue Fees Deducted)</strong></div>
                          <div className="text-emerald-600 text-[10px]">
                            {repayment.appliedTrackingFee > 0 && `ค่าติดตามทวงถาม: ${formatThb(repayment.appliedTrackingFee)} `}
                            {repayment.appliedPenalty > 0 && `| ค่าเกณฑ์เบี้ยปรับล่าช้า: ${formatThb(repayment.appliedPenalty)}`}
                          </div>
                        </td>
                        <td className="p-3 text-right">-</td>
                        <td className="p-3 text-right text-emerald-600">
                          {formatThb(repayment.appliedPenalty + repayment.appliedTrackingFee)}
                        </td>
                        <td className="p-3 text-right text-emerald-600 font-medium">
                          {formatThb(repayment.appliedPenalty + repayment.appliedTrackingFee)}
                        </td>
                      </tr>
                    )}
                    {repayment.appliedVat > 0 && (
                      <tr>
                        <td className="p-3 text-center">3</td>
                        <td className="p-3">
                          <strong>ภาษีมูลค่าเพิ่มที่ได้รับชำระ (VAT Received 7%)</strong>
                        </td>
                        <td className="p-3 text-right">{formatThb(repayment.appliedVat)}</td>
                        <td className="p-3 text-right">-</td>
                        <td className="p-3 text-right">{formatThb(repayment.appliedVat)}</td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400">ไม่มีข้อมูลธุรกรรมอ้างอิง</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Total Block Calc */}
            <div className="flex justify-between items-start text-xs border-t border-slate-200 pt-6">
              <div className="bg-slate-50 p-3 rounded border border-slate-100 max-w-sm">
                <strong>(ตัวอักษร / BAHT TEXT)</strong>
                <p className="text-slate-600 mt-1 italic font-medium">({thaiBahtText(getGrandTotal())})</p>
              </div>

              <div className="w-80 space-y-2 text-right">
                <div className="flex justify-between text-slate-600">
                  <span>ยอดจัดเก็บไม่รวมภาษี (Subtotal):</span>
                  <span className="font-semibold text-slate-800">{formatThb(getSubTotal())}</span>
                </div>
                {contract.productType === 'HP' && (
                  <div className="flex justify-between text-slate-600">
                    <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                    <span className="font-semibold text-slate-800">{formatThb(getVatValue())}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-[#25348D] border-t border-slate-100 pt-2">
                  <span>ยอดสุทธิรวมทั้งสิ้น (Grand Total):</span>
                  <span>{formatThb(getGrandTotal())}</span>
                </div>
              </div>
            </div>

            {/* Payment allocations & Bank transfer guide */}
            {type === 'INVOICE' && (
              <div className="mt-8 border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-500">
                <div className="flex items-center space-x-3">
                  <Coins className="w-6 h-6 text-[#213F9A]" />
                  <div>
                    <h5 className="font-bold text-slate-700 text-xs">ช่องทางชำระเงิน / Bank Transfer Details</h5>
                    <p>ธนาคารกรุงไทย (KTB) • บัญชีกระแสรายวัน: 001-9-28192-3</p>
                    <p>ชื่อบัญชี: บจก. แอลเอ็มเอส เอนเตอร์ไพรส์ (LMS Enterprise Co., Ltd.)</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center text-[8px] border border-slate-300">
                    [ QR PAY ]
                  </div>
                  <span className="mt-1 text-[8px] font-semibold text-slate-400">Scan for PromptPay</span>
                </div>
              </div>
            )}

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-12 mt-12 text-center text-xs">
              <div className="flex flex-col items-center justify-end">
                <div className="w-40 border-b border-slate-300 pb-2 mb-2 min-h-[50px] flex items-end justify-center">
                  {type === 'RECEIPT' && <CheckCircle className="w-10 h-10 text-[#41C3DB] mb-1 opacity-60" />}
                </div>
                <p className="font-medium text-slate-700">ผู้รับเงิน / ผู้แจ้งเรื่อง</p>
                <p className="text-[10px] text-slate-400">เจ้าหน้าที่ฝ่ายวิเคราะห์สินเชื่อ (LMS)</p>
              </div>

              <div className="flex flex-col items-center justify-end">
                <div className="w-40 border-b border-slate-300 pb-2 mb-2 min-h-[50px]"></div>
                <p className="font-medium text-slate-700">ลูกค้า / ผู้รับมอบอำนาจชำระเงิน</p>
                <p className="text-[10px] text-slate-400">วันที่: {type === 'INVOICE' ? '____/____/____' : repayment?.paymentDate}</p>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="border-t border-slate-100 pt-4 mt-8 text-[9px] text-center text-slate-400">
              เอกสารฉบับนี้พิมพ์ด้วยระบบคอมพิวเตอร์ผ่านระบบ LMS Enterprise Portal • ถือเป็นเอกสารสมบูรณ์โดยไม่ต้องลงลายมือชื่อ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
