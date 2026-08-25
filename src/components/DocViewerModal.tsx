import React, { useRef, useState } from 'react';
import { Printer, X, Coins, FileText, CheckCircle, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { Contract, ScheduledPayment, Repayment } from '../types';

interface DocViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'INVOICE' | 'RECEIPT';
  contract: Contract;
  scheduledPayment?: ScheduledPayment; // For Invoice
  repayment?: Repayment; // For Receipt
  schedules?: ScheduledPayment[]; // For looking up term due dates
}

export default function DocViewerModal({
  isOpen,
  onClose,
  type,
  contract,
  scheduledPayment,
  repayment,
  schedules
}: DocViewerModalProps) {
  if (!isOpen) return null;

  const printAreaRef = useRef<HTMLDivElement>(null);

  const hasTrackingFee = type === 'INVOICE'
    ? (scheduledPayment ? scheduledPayment.trackingFeeDue > 0 : false)
    : (repayment ? repayment.appliedTrackingFee > 0 : false);

  const [activeTab, setActiveTab] = useState<'INSTALLMENT' | 'TRACKING'>('INSTALLMENT');
  const [receiptSubTab, setReceiptSubTab] = useState<'RECEIPT' | 'TAX_INVOICE'>('TAX_INVOICE');
  const [isGenerating, setIsGenerating] = useState(false);

  const getDocTitle = () => {
    if (contract.productType === 'HP') {
      if (activeTab === 'TRACKING') {
        if (type === 'INVOICE') {
          return 'ใบแจ้งหนี้ (ค่าบริการติดตามทวงถาม)';
        }
        return receiptSubTab === 'TAX_INVOICE'
          ? 'ใบกำกับภาษี (ค่าบริการติดตามทวงถาม)'
          : 'ใบเสร็จรับเงิน (ค่าบริการติดตามทวงถาม)';
      } else {
        if (type === 'INVOICE') {
          return 'ใบแจ้งหนี้ / INVOICE';
        }
        return receiptSubTab === 'TAX_INVOICE'
          ? 'ใบกำกับภาษี / TAX INVOICE'
          : 'ใบเสร็จรับเงิน / RECEIPT';
      }
    }
    return type === 'INVOICE' ? 'ใบแจ้งหนี้ / INVOICE' : 'ใบเสร็จรับเงิน / RECEIPT';
  };

  const getDocTitleEn = () => {
    if (contract.productType === 'HP') {
      if (activeTab === 'TRACKING') {
        if (type === 'INVOICE') {
          return 'INVOICE (DEBT COLLECTION SERVICE)';
        }
        return receiptSubTab === 'TAX_INVOICE'
          ? 'TAX INVOICE (DEBT COLLECTION SERVICE)'
          : 'RECEIPT (DEBT COLLECTION SERVICE)';
      } else {
        if (type === 'INVOICE') {
          return 'INVOICE';
        }
        return receiptSubTab === 'TAX_INVOICE'
          ? 'TAX INVOICE'
          : 'RECEIPT';
      }
    }
    return type === 'INVOICE' ? 'INVOICE' : 'RECEIPT';
  };

  const getDocNo = () => {
    const suffix = (contract.productType === 'HP' && activeTab === 'TRACKING') ? '-TRK' : '';
    if (type === 'INVOICE') {
      return `INV-${contract.id}-${scheduledPayment?.termNumber}${suffix}`;
    }
    const rNo = repayment?.receiptNo || 'RCP-xxxx';
    if (contract.productType === 'HP') {
      if (receiptSubTab === 'TAX_INVOICE') {
        return `${rNo.replace(/^RCP-/, 'TAX-')}${suffix}`;
      }
      return `${rNo.startsWith('RCP-') ? rNo : 'RCP-' + rNo}${suffix}`;
    }
    return `${rNo}${suffix}`;
  };

  const handlePrint = async () => {
    if (printAreaRef.current) {
      setIsGenerating(true);
      
      const docPrefix = type === 'RECEIPT' 
        ? (contract.productType === 'HP' && receiptSubTab === 'TAX_INVOICE' ? 'TaxInvoice-' : 'Receipt-') 
        : 'Invoice-';
      const docNoSuffix = type === 'RECEIPT' ? (repayment?.receiptNo || 'RCP') : (contract.id);
      const filename = `${docPrefix}${docNoSuffix}${activeTab === 'TRACKING' ? '-TRK' : ''}.pdf`;

      try {
        const opt = {
          margin:       5,
          filename:     filename,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0 },
          jsPDF:        { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
        };

        // Promise wrapper with 8 second timeout to prevent infinite hang
        const generatePdf = new Promise((resolve, reject) => {
          html2pdf().set(opt).from(printAreaRef.current).save().then(resolve).catch(reject);
          setTimeout(() => reject(new Error('Timeout')), 8000);
        });

        await generatePdf;
      } catch (error) {
        console.error('PDF Generation Error, falling back to native print:', error);
        
        // Fallback to high-fidelity native print
        const printContent = printAreaRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>${filename}</title>
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
                  .print-container { border: none !important; box-shadow: none !important; padding: 0 !important; }
                </style>
              </head>
              <body class="p-6 bg-white">
                <div class="max-w-[21cm] mx-auto">${printContent}</div>
                <script>
                  setTimeout(function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                  }, 800);
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const getTaxInvoiceDate = (paymentDate: string, dueDate: string): string => {
    if (!dueDate) return paymentDate;
    if (paymentDate < dueDate) {
      // จ่ายก่อน Due date: ออกวันที่ชำระเงิน
      return paymentDate;
    } else {
      // จ่ายตรง หรือจ่ายล่าช้า (Overdue): ออกวันที่ Due date
      return dueDate;
    }
  };

  const getHeaderDocDate = () => {
    if (contract.productType === 'HP' && activeTab === 'TRACKING') {
      return repayment ? repayment.paymentDate : (scheduledPayment?.lastUpdated || '');
    }
    if (type === 'INVOICE') {
      return scheduledPayment?.lastUpdated || '';
    }
    if (repayment) {
      if (contract.productType === 'HP' && repayment.distributionDetails && repayment.distributionDetails.length > 0) {
        const firstTermNo = repayment.distributionDetails[0].termNumber;
        const sch = schedules?.find(s => s.contractId === contract.id && s.termNumber === firstTermNo);
        if (sch) {
          return getTaxInvoiceDate(repayment.paymentDate, sch.dueDate);
        }
      }
      return repayment.paymentDate;
    }
    return '';
  };

  const getVatValue = () => {
    if (type === 'RECEIPT' && contract.productType === 'HP' && receiptSubTab === 'RECEIPT') {
      return 0;
    }
    const vatRateDecimal = 0.07;
    if (contract.productType === 'HP' && activeTab === 'TRACKING') {
      if (type === 'INVOICE' && scheduledPayment) {
        if (scheduledPayment.trackingFeeDue <= 0) return 0;
        const total = scheduledPayment.trackingFeeDue;
        const sub = Math.round((total / 1.07) * 100) / 100;
        return Math.round((total - sub) * 100) / 100;
      }
      if (type === 'RECEIPT' && repayment) {
        if (repayment.appliedTrackingFee <= 0) return 0;
        const total = repayment.appliedTrackingFee;
        const sub = Math.round((total / 1.07) * 100) / 100;
        return Math.round((total - sub) * 100) / 100;
      }
      return 0;
    }

    // activeTab === 'INSTALLMENT' or non-HP
    if (type === 'INVOICE' && scheduledPayment) {
      return scheduledPayment.vatDue;
    }
    if (type === 'RECEIPT' && repayment) {
      return repayment.appliedVat;
    }
    return 0;
  };

  const getSubTotal = () => {
    if (type === 'RECEIPT' && contract.productType === 'HP' && receiptSubTab === 'RECEIPT') {
      return getGrandTotal();
    }
    const vatRateDecimal = 0.07;
    if (contract.productType === 'HP' && activeTab === 'TRACKING') {
      if (type === 'INVOICE' && scheduledPayment) {
        return scheduledPayment.trackingFeeDue > 0
          ? Math.round((scheduledPayment.trackingFeeDue / 1.07) * 100) / 100
          : 0;
      }
      if (type === 'RECEIPT' && repayment) {
        return repayment.appliedTrackingFee > 0
          ? Math.round((repayment.appliedTrackingFee / 1.07) * 100) / 100
          : 0;
      }
      return 0;
    }

    // activeTab === 'INSTALLMENT' or non-HP
    if (type === 'INVOICE' && scheduledPayment) {
      return Math.round((scheduledPayment.principalDue + scheduledPayment.interestDue) * 100) / 100;
    }
    if (type === 'RECEIPT' && repayment) {
      return Math.round((repayment.appliedPrincipal + repayment.appliedInterest) * 100) / 100;
    }
    return 0;
  };

  const getGrandTotal = () => {
    if (contract.productType === 'HP' && activeTab === 'TRACKING') {
      if (type === 'INVOICE' && scheduledPayment) {
        return scheduledPayment.trackingFeeDue;
      }
      if (type === 'RECEIPT' && repayment) {
        return repayment.appliedTrackingFee;
      }
      return 0;
    }

    // activeTab === 'INSTALLMENT' or non-HP
    if (type === 'INVOICE' && scheduledPayment) {
      return Math.round((scheduledPayment.principalDue + scheduledPayment.interestDue + scheduledPayment.vatDue + scheduledPayment.penaltyDue) * 100) / 100;
    }
    if (type === 'RECEIPT' && repayment) {
      return Math.round((repayment.appliedPrincipal + repayment.appliedInterest + repayment.appliedVat + repayment.appliedPenalty) * 100) / 100;
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
        <div className="flex justify-between items-center px-6 py-4 border-b border-sky-100 bg-slate-800 rounded-t-xl text-white">
          <div className="flex items-center space-x-2 font-mono">
            <FileText className="w-5 h-5 text-sky-105" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              {type === 'INVOICE' 
                ? 'พิมพ์ใบแจ้งหนี้ / Invoice Preview' 
                : contract.productType === 'HP'
                  ? receiptSubTab === 'TAX_INVOICE'
                    ? 'พิมพ์ใบกำกับภาษี / Tax Invoice Preview'
                    : 'พิมพ์ใบเสร็จรับเงิน / Receipt Preview'
                  : 'พิมพ์ใบเสร็จรับเงิน / Receipt Preview'}
            </h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className={`flex items-center space-x-1.5 px-4 py-2 bg-white text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-bold transition cursor-pointer ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isGenerating ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs Bar for separating Installment and Tracking Fee */}
        {contract.productType === 'HP' && hasTrackingFee && (
          <div className="bg-sky-50/50 px-6 py-2.5 border-b border-sky-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 no-print">
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('INSTALLMENT')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'INSTALLMENT'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-800 hover:bg-sky-100/50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>ชุดที่ 1: ค่างวดเช่าซื้อ (HP Installment)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('TRACKING')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'TRACKING'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-800 hover:bg-sky-100/50'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>ชุดที่ 2: ค่าติดตามทวงถาม (Tracking Fee)</span>
              </button>
            </div>
            <div className="text-[10px] text-sky-800 font-bold bg-sky-100/60 px-3 py-1.5 rounded-md border border-sky-200 font-sans">
              * แยกเอกสารชุดค่าติดตามทวงถามต่างหาก และลงวันที่เป็นวันที่จ่ายจริง
            </div>
          </div>
        )}

        {/* Separating Receipt and Tax Invoice selector */}
        {type === 'RECEIPT' && contract.productType === 'HP' && (
          <div className="bg-amber-50/40 px-6 py-2.5 border-b border-amber-100/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 no-print">
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setReceiptSubTab('TAX_INVOICE')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  receiptSubTab === 'TAX_INVOICE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-100/30'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>ฉบับที่ 1: ใบกำกับภาษี (Tax Invoice)</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptSubTab('RECEIPT')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  receiptSubTab === 'RECEIPT'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-100/30'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>ฉบับที่ 2: ใบเสร็จรับเงิน (Receipt)</span>
              </button>
            </div>
            <div className="text-[10px] text-amber-850 font-bold bg-amber-100/50 px-3 py-1.5 rounded-md border border-amber-200/50 font-sans">
              * พระราชบัญญัติประมวลรัษฎากรระบุให้แยก "ใบกำกับภาษี" และ "ใบเสร็จรับเงิน" ต่างหาก
            </div>
          </div>
        )}

        {/* Print Content Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-50" id="document-print-outer">
          <div 
            ref={printAreaRef}
            className="bg-white p-10 rounded-lg border border-slate-200 shadow-sm max-w-[21cm] mx-auto text-slate-800 print-container"
          >
            {/* Template Top Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-6 font-sans">
              <div>
                <div className="flex items-center space-x-2 mb-2 text-slate-800 font-mono">
                  <span className="text-xl font-extrabold tracking-tight">บริษัท เอ็นพีเอส ทุนเสริมทรัพย์ จำกัด</span>
                </div>
                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                  1 หมู่ที่ 2 ตำบลท่าตูม อำเภอศรีมหาโพธิ จ.ปราจีนบุรี 25140<br/>
                  เลขประจำตัวผู้เสียภาษี: 0255567003330
                </p>
              </div>

              <div className="text-right font-sans">
                <h1 className="text-xl font-extrabold text-slate-800 tracking-wide uppercase">
                  {getDocTitle()}
                </h1>
                <p className="text-[10px] text-slate-400 font-extrabold tracking-widest font-mono uppercase mt-0.5">{getDocTitleEn()}</p>
                <div className="mt-4 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-150 inline-block text-left font-mono">
                  <div><strong className="text-slate-700">เลขที่เอกสาร:</strong> {getDocNo()}</div>
                  {type === 'RECEIPT' && repayment && contract.productType === 'HP' ? (
                    receiptSubTab === 'TAX_INVOICE' ? (
                      <>
                        <div><strong className="text-slate-700">วันที่ชำระเงิน:</strong> {repayment.paymentDate}</div>
                        <div><strong className="text-slate-700 text-slate-800">วันที่ออกใบกำกับภาษี:</strong> {getHeaderDocDate()}</div>
                      </>
                    ) : (
                      <>
                        <div><strong className="text-slate-700">วันที่ชำระเงิน:</strong> {repayment.paymentDate}</div>
                        <div><strong className="text-slate-700 text-slate-800">วันที่ออกใบเสร็จ:</strong> {repayment.paymentDate}</div>
                      </>
                    )
                  ) : (
                    <div><strong className="text-slate-700">วันที่ออกหลักฐาน:</strong> {getHeaderDocDate()}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Customer & Contract Rows */}
            <div className="grid grid-cols-2 gap-8 mb-6 text-xs bg-white p-4 rounded-lg border border-slate-300 font-sans">
              <div>
                <h4 className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5 mb-2 text-xs uppercase tracking-wider font-mono">
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
                <h4 className="font-extrabold text-slate-800 border-b border-[#E5E7EB] pb-1.5 mb-2 text-xs uppercase tracking-wider font-mono">
                  รายละเอียดสัญญา (CONTRACT DETAILS)
                </h4>
                <div className="space-y-1.5 text-slate-650">
                  <div><strong>เลขที่สัญญา:</strong> <span className="font-mono font-bold uppercase">{contract.id}</span></div>
                  <div><strong>ประเภทผลิตภัณฑ์:</strong> {contract.productType === 'HP' ? 'เช่าซื้อรถบรรทุก (Hire Purchase)' : `เงินกู้ทั่วไป (${contract.paymentFrequency})`}</div>
                  <div><strong>วงเงินอนุมัติ:</strong> <span className="font-mono">{formatThb(contract.creditLimit)}</span></div>
                  <div><strong>อัตราดอกเบี้ย:</strong> <span className="font-mono font-bold text-slate-800">{contract.interestRate}% ต่อปี</span></div>
                  <div className="text-rose-600 font-bold"><strong>ยอดคงค้างเงินต้น (Outstanding):</strong> <span className="font-mono font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 border border-rose-100 rounded">{formatThb(contract.outstandingPrincipal)}</span></div>
                  {type === 'RECEIPT' && repayment && repayment.outstandingPrincipal !== undefined && (
                    <div className="text-indigo-600 font-bold"><strong>ยอดคงเหลือหลังชำระเงินนี้:</strong> <span className="font-mono font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 border border-indigo-100 rounded">{formatThb(repayment.outstandingPrincipal)}</span></div>
                  )}
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
                <tr className="bg-slate-800 text-white font-mono uppercase tracking-wider text-[10px]">
                  <th className="p-3 rounded-l border-b border-slate-300">ลำดับ (No.)</th>
                  <th className="p-3 border-b border-slate-300">รายการรายละเอียดค่าใช้จ่าย (Description)</th>
                  <th className="p-3 border-b border-slate-300 text-right">จำนวนเงินปกติ (Amount)</th>
                  <th className="p-3 border-b border-slate-300 text-right">เบี้ยปรับ / ทวงถาม (Fees)</th>
                  <th className="p-3 rounded-r border-b border-slate-300 text-right">ยอดรวมสุทธิ (Net Total)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-650">
                {type === 'INVOICE' && scheduledPayment ? (
                  contract.productType === 'HP' && activeTab === 'TRACKING' ? (
                    <>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono">1</td>
                        <td className="p-3">
                          <div><strong className="text-slate-800">ค่าบริการติดตามทวงถามหนี้ค้างชำระ (Debt Collection & Tracking Services)</strong></div>
                          <div className="text-slate-400 text-[10px] font-mono mt-0.5">ค่าบริการตามเกณฑ์อัตราค่าติดตาม (ก่อนภาษีมูลค่าเพิ่ม 7%)</div>
                        </td>
                        <td className="p-3 text-right font-mono">{formatThb(Math.round((scheduledPayment.trackingFeeDue / 1.07) * 100) / 100)}</td>
                        <td className="p-3 text-right font-mono">-</td>
                        <td className="p-3 text-right font-mono">{formatThb(Math.round((scheduledPayment.trackingFeeDue / 1.07) * 100) / 100)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono">2</td>
                        <td className="p-3">
                          <div><strong className="text-slate-800">ภาษีมูลค่าเพิ่มสำหรับค่าบริการติดตามทวงถาม (VAT 7%)</strong></div>
                        </td>
                        <td className="p-3 text-right font-mono">{formatThb(scheduledPayment.trackingFeeDue - Math.round((scheduledPayment.trackingFeeDue / 1.07) * 100) / 100)}</td>
                        <td className="p-3 text-right font-mono">-</td>
                        <td className="p-3 text-right font-mono">{formatThb(scheduledPayment.trackingFeeDue - Math.round((scheduledPayment.trackingFeeDue / 1.07) * 100) / 100)}</td>
                      </tr>
                    </>
                  ) : (
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
                      {scheduledPayment.penaltyDue > 0 && (
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 text-center font-mono">2</td>
                          <td className="p-3">
                            <div><strong className="text-slate-800">ค่าเบี้ยปรับล่าช้าค้างชำระ (Late Payment Penalty)</strong></div>
                          </td>
                          <td className="p-3 text-right font-mono">-</td>
                          <td className="p-3 text-right text-rose-600 font-bold font-mono">
                            {formatThb(scheduledPayment.penaltyDue)}
                          </td>
                          <td className="p-3 text-right text-rose-600 font-bold font-mono">
                            {formatThb(scheduledPayment.penaltyDue)}
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
                  )
                ) : type === 'RECEIPT' && repayment ? (
                  contract.productType === 'HP' && activeTab === 'TRACKING' ? (
                    repayment.distributionDetails && repayment.distributionDetails.length > 0 ? (
                      repayment.distributionDetails
                        .filter(dist => dist.trackingFee > 0)
                        .map((dist, dIdx) => {
                          const baseTracking = Math.round((dist.trackingFee / 1.07) * 100) / 100;
                          const vatTracking = Math.round((dist.trackingFee - baseTracking) * 100) / 100;
                          return (
                            <tr key={dIdx} className="hover:bg-slate-50/50 border-b border-slate-100">
                              <td className="p-3 text-center font-mono">{dIdx + 1}</td>
                              <td className="p-3">
                                <div><strong className="text-slate-800 font-sans text-xs">จัดสรรตัดชำระค่าบริการติดตามทวงถามหนี้ - งวดที่ {dist.termNumber}</strong></div>
                                <div className="text-slate-500 text-[10px] mt-0.5 font-sans">
                                  {receiptSubTab === 'TAX_INVOICE' ? (
                                    <>📑 วันที่ออกใบกำกับภาษี (Tax Invoice Date): <span className="font-mono font-extrabold text-slate-800">{repayment.paymentDate}</span></>
                                  ) : (
                                    <>📑 วันที่ออกใบเสร็จ (Receipt Date): <span className="font-mono font-extrabold text-slate-800">{repayment.paymentDate}</span></>
                                  )}
                                </div>
                                {receiptSubTab === 'TAX_INVOICE' ? (
                                  <div className="text-emerald-700 text-[10px] font-mono mt-1.5 leading-relaxed bg-emerald-50/30 p-2 rounded border border-emerald-100/30">
                                    ตัดค่าติดตาม (ไม่รวม VAT): {formatThb(baseTracking)} | VAT ค่าติดตาม 7%: {formatThb(vatTracking)}
                                  </div>
                                ) : (
                                  <div className="text-emerald-700 text-[10px] font-mono mt-1.5 leading-relaxed bg-emerald-50/30 p-2 rounded border border-emerald-100/30">
                                    ตัดค่าติดตาม (รวมภาษีมูลค่าเพิ่ม): {formatThb(dist.trackingFee)}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono text-xs">
                                {receiptSubTab === 'TAX_INVOICE' ? formatThb(baseTracking) : formatThb(dist.trackingFee)}
                              </td>
                              <td className="p-3 text-right font-mono text-rose-600 text-xs">-</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900 text-xs">{formatThb(dist.trackingFee)}</td>
                            </tr>
                          );
                        })
                    ) : (
                      <tr className="hover:bg-slate-50/50">
                        <td className="p-3 text-center font-mono">1</td>
                        <td className="p-3">
                          <div><strong className="text-slate-800">ตัดชำระค่าบริการติดตามทวงถามหนี้ (Debt Collection & Tracking Fee)</strong></div>
                          {receiptSubTab === 'TAX_INVOICE' ? (
                            <div className="text-emerald-700 text-[10px] font-mono mt-0.5">
                              ตัดค่าบริการติดตามทวงถามสะสม (ไม่รวม VAT): {formatThb(Math.round((repayment.appliedTrackingFee / 1.07) * 100) / 100)} | VAT 7%: {formatThb(repayment.appliedTrackingFee - Math.round((repayment.appliedTrackingFee / 1.07) * 100) / 100)}
                            </div>
                          ) : (
                            <div className="text-emerald-700 text-[10px] font-mono mt-0.5">
                              ตัดค่าบริการติดตามทวงถามสะสม (รวมภาษีมูลค่าเพิ่ม): {formatThb(repayment.appliedTrackingFee)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {receiptSubTab === 'TAX_INVOICE'
                            ? formatThb(Math.round((repayment.appliedTrackingFee / 1.07) * 100) / 100)
                            : formatThb(repayment.appliedTrackingFee)
                          }
                        </td>
                        <td className="p-3 text-right font-mono">-</td>
                        <td className="p-3 text-right font-mono">{formatThb(repayment.appliedTrackingFee)}</td>
                      </tr>
                    )
                  ) : (
                    repayment.distributionDetails && repayment.distributionDetails.length > 0 ? (
                      repayment.distributionDetails.map((dist, dIdx) => {
                        const itemsList = [];
                        if (dist.penalty > 0) itemsList.push(`ตัดเบี้ยปรับ: ${formatThb(dist.penalty)}`);
                        if (receiptSubTab === 'TAX_INVOICE') {
                          if (dist.interest > 0) itemsList.push(`ตัดดอกเบี้ย: ${formatThb(dist.interest)}`);
                          if (dist.principal > 0) itemsList.push(`ตัดเงินต้น: ${formatThb(dist.principal)}`);
                          if (dist.vat > 0) itemsList.push(`ตัด VAT 7%: ${formatThb(dist.vat)}`);
                        } else {
                          if (dist.interest > 0 || dist.principal > 0 || dist.vat > 0) {
                            itemsList.push(`ตัดค่าผ่อนชำระงวด (รวมภาษีมูลค่าเพิ่ม): ${formatThb(dist.principal + dist.interest + dist.vat)}`);
                          }
                        }

                        const sch = schedules?.find(s => s.contractId === contract.id && s.termNumber === dist.termNumber);
                        const dueDate = sch ? sch.dueDate : '';
                        const taxInvoiceDate = getTaxInvoiceDate(repayment.paymentDate, dueDate);

                        return (
                           <tr key={dIdx} className="hover:bg-slate-50/50 border-b border-slate-100">
                             <td className="p-3 text-center font-mono">{dIdx + 1}</td>
                             <td className="p-3">
                               <div><strong className="text-slate-800 font-sans text-xs">จัดสรรตัดชำระ - งวดที่ {dist.termNumber} (Allocation Term {dist.termNumber})</strong></div>
                               <div className="text-slate-500 text-[10px] mt-0.5 font-sans">
                                 📅 กำหนดชำระ (Due Date): <span className="font-mono font-bold text-slate-700">{dueDate || '-'}</span> 
                                 {contract.productType === 'HP' && (
                                   <>
                                     {' | '}
                                     {receiptSubTab === 'TAX_INVOICE' ? (
                                       <>📑 วันที่ออกใบกำกับภาษี (Tax Invoice Date): <span className="font-mono font-extrabold text-slate-800">{taxInvoiceDate}</span></>
                                     ) : (
                                       <>📑 วันที่ออกใบเสร็จ (Receipt Date): <span className="font-mono font-extrabold text-slate-800">{repayment.paymentDate}</span></>
                                     )}
                                   </>
                                 )}
                               </div>
                               <div className="text-emerald-700 text-[10px] font-mono mt-1.5 leading-relaxed bg-emerald-50/30 p-2 rounded border border-emerald-100/30">
                                 {itemsList.join(' | ')}
                               </div>
                             </td>
                             <td className="p-3 text-right font-mono text-xs">
                               {receiptSubTab === 'TAX_INVOICE' 
                                 ? formatThb(dist.principal + dist.interest) 
                                 : formatThb(dist.principal + dist.interest + dist.vat)
                               }
                             </td>

                            <td className="p-3 text-right font-mono text-rose-600 text-xs">
                              {dist.penalty > 0 ? formatThb(dist.penalty) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900 text-xs">{formatThb(dist.principal + dist.interest + dist.penalty + dist.vat)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 text-center font-mono">1</td>
                          <td className="p-3">
                            <div><strong className="text-slate-800">ตัดชำระค่างวด / เงินต้นค้างชำระ (Repayment Allocated)</strong></div>
                            {receiptSubTab === 'TAX_INVOICE' ? (
                              <div className="text-emerald-700 text-[10px] font-mono mt-0.5">เงินต้นที่ตัด: {formatThb(repayment.appliedPrincipal)} | ดอกเบี้ยที่ตัด: {formatThb(repayment.appliedInterest)}</div>
                            ) : (
                              <div className="text-emerald-700 text-[10px] font-mono mt-0.5">เงินผ่อนชำระที่ตัด (รวมภาษีมูลค่าเพิ่ม): {formatThb(repayment.appliedPrincipal + repayment.appliedInterest + repayment.appliedVat)}</div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {receiptSubTab === 'TAX_INVOICE' 
                              ? formatThb(repayment.appliedPrincipal + repayment.appliedInterest)
                              : formatThb(repayment.appliedPrincipal + repayment.appliedInterest + repayment.appliedVat)
                            }
                          </td>
                          <td className="p-3 text-right font-mono">-</td>
                          <td className="p-3 text-right font-mono">
                            {receiptSubTab === 'TAX_INVOICE' 
                              ? formatThb(repayment.appliedPrincipal + repayment.appliedInterest)
                              : formatThb(repayment.appliedPrincipal + repayment.appliedInterest + repayment.appliedVat)
                            }
                          </td>
                        </tr>
                        {repayment.appliedPenalty > 0 && (
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 text-center font-mono">2</td>
                            <td className="p-3">
                              <div><strong className="text-slate-800">ตัดชำระค่าเบี้ยปรับ (Penalty Fees Deducted)</strong></div>
                            </td>
                            <td className="p-3 text-right font-mono">-</td>
                            <td className="p-3 text-right text-emerald-600 font-mono font-bold">
                              {formatThb(repayment.appliedPenalty)}
                            </td>
                            <td className="p-3 text-right text-emerald-600 font-mono font-bold">
                              {formatThb(repayment.appliedPenalty)}
                            </td>
                          </tr>
                        )}
                        {receiptSubTab === 'TAX_INVOICE' && repayment.appliedVat > 0 && (
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 text-center font-mono">{repayment.appliedPenalty > 0 ? 3 : 2}</td>
                            <td className="p-3">
                              <strong className="text-slate-800">ภาษีมูลค่าเพิ่มที่ได้รับชำระ (VAT Received 7%)</strong>
                            </td>
                            <td className="p-3 text-right font-mono">{formatThb(repayment.appliedVat)}</td>
                            <td className="p-3 text-right font-mono">-</td>
                            <td className="p-3 text-right font-mono">{formatThb(repayment.appliedVat)}</td>
                          </tr>
                        )}
                      </>
                    )
                  )
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

              <div className="min-w-[400px] space-y-2">
                {!(type === 'RECEIPT' && contract.productType === 'HP' && receiptSubTab === 'RECEIPT') && (
                  <div className="flex items-center justify-between text-slate-500 font-medium">
                    <span className="text-left whitespace-nowrap">ยอดจัดเก็บไม่รวมภาษี (Subtotal):</span>
                    <span className="text-right font-semibold text-slate-800 font-mono ml-4">{formatThb(getSubTotal())}</span>
                  </div>
                )}
                {contract.productType === 'HP' && !(type === 'RECEIPT' && receiptSubTab === 'RECEIPT') && (
                  <div className="flex items-center justify-between text-slate-500 font-medium">
                    <span className="text-left whitespace-nowrap">ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                    <span className="text-right font-semibold text-slate-800 font-mono ml-4">{formatThb(getVatValue())}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base font-extrabold text-slate-800 border-t border-slate-200 pt-2 font-mono">
                  <span className="text-left whitespace-nowrap">ยอดสุทธิรวมทั้งสิ้น (Grand Total):</span>
                  <span className="text-right ml-4">{formatThb(getGrandTotal())}</span>
                </div>
              </div>
            </div>

            {/* Payment allocations & Bank transfer guide */}
            {type === 'INVOICE' && (
              <div className="mt-8 border border-dashed border-slate-250 rounded-lg p-4 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-500 font-sans">
                <div className="flex items-center space-x-3">
                  <Coins className="w-6 h-6 text-slate-800 shrink-0" />
                  <div>
                    <h5 className="font-bold text-slate-700 text-xs">ช่องทางชำระเงิน / Bank Transfer Details</h5>
                    <p className="mt-1 font-mono">ธนาคารกรุงไทย (KTB) • บัญชีกระแสรายวัน: 001-9-28192-3</p>
                    <p className="font-mono">ชื่อบัญชี: บริษัท เอ็นพีเอส ทุนเสริมทรัพย์ จำกัด</p>
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
                  {type === 'RECEIPT' && <CheckCircle className="w-10 h-10 text-slate-400 mb-1 opacity-60" />}
                </div>
                <p className="font-bold text-slate-700">ผู้รับเงิน / ผู้แจ้งเรื่อง</p>
                <p className="text-[10px] text-slate-400 mt-1">เจ้าหน้าที่บริษัทฯ</p>
              </div>

              <div className="flex flex-col items-center justify-end">
                <div className="w-40 border-b border-slate-300 pb-2 mb-2 min-h-[50px]"></div>
                <p className="font-bold text-slate-700">ลูกค้า / ผู้รับมอบอำนาจชำระเงิน</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">วันที่: {type === 'INVOICE' ? '____/____/____' : repayment?.paymentDate}</p>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="border-t border-slate-100 pt-4 mt-8 text-[9px] text-center text-slate-400 font-mono">
              เอกสารฉบับนี้พิมพ์ด้วยระบบคอมพิวเตอร์ • ถือเป็นเอกสารสมบูรณ์โดยไม่ต้องลงลายมือชื่อ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
