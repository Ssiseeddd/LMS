import React, { useState, useEffect } from 'react';
import { getContracts, getDisbursements, getRepayments } from '../dbStore';
import { Contract, Disbursement, Repayment } from '../types';
import { 
  FileSpreadsheet, 
  Settings2, 
  BookOpen, 
  ArrowLeftRight, 
  Sliders, 
  Filter, 
  Download, 
  CheckCircle, 
  Building,
  Info,
  Calendar,
  Layers,
  HelpCircle
} from 'lucide-react';

interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  date: string;
  voucherNo: string;
  reference: string;
  description: string;
  contractId: string;
  customerName: string;
  productType: 'HP' | 'LOAN';
  type: 'DISBURSEMENT' | 'REPAYMENT';
  lines: JournalLine[];
}

interface ChartOfAccounts {
  cashBank: { code: string; name: string };
  hpReceivable: { code: string; name: string };
  loanReceivable: { code: string; name: string };
  deferredVat: { code: string; name: string };
  outputVat: { code: string; name: string };
  interestLoan: { code: string; name: string };
  interestHp: { code: string; name: string };
  deferredUpfrontFee: { code: string; name: string };
  deferredInterest: { code: string; name: string };
  collectionIncome: { code: string; name: string };
  penaltyIncome: { code: string; name: string };
}

const DEFAULT_COA: ChartOfAccounts = {
  cashBank: { code: '111100', name: 'เงินสดและเงินฝากธนาคาร (Cash & Cash Equivalents)' },
  hpReceivable: { code: '112100', name: 'ลูกหนี้สัญญาเช่าซื้อ (Hire Purchase Receivables)' },
  loanReceivable: { code: '112200', name: 'ลูกหนี้เงินกู้ยืม (Loan Receivables)' },
  deferredVat: { code: '219100', name: 'ภาษีขายรอตัดบัญชี (Deferred Output VAT)' },
  outputVat: { code: '219200', name: 'ภาษีขาย (Output VAT)' },
  interestLoan: { code: '411100', name: 'รายได้ดอกเบี้ยรับ - เงินกู้ยืม (Interest Income - Loans)' },
  interestHp: { code: '411200', name: 'รายได้ดอกเบี้ยรับ - สัญญาเช่าซื้อ (Interest Income - HP)' },
  deferredUpfrontFee: { code: '412100', name: 'รายได้ค่าธรรมเนียมเบิกจ่ายล่วงหน้า (Deferred Service Fees)' },
  deferredInterest: { code: '411150', name: 'รายได้ดอกเบี้ยรับรอตัดบัญชี (Deferred Interest Income)' },
  collectionIncome: { code: '413100', name: 'รายได้ค่าธรรมเนียมติดตามทวงถาม (Debt Collection Fees)' },
  penaltyIncome: { code: '414100', name: 'รายได้เบี้ยปรับล่าช้า (Late Payment Penalties)' }
};

export default function Accounting() {
  // Load local data
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  
  // Chart of accounts
  const [coa, setCoa] = useState<ChartOfAccounts>(() => {
    const saved = localStorage.getItem('lms_accounting_coa');
    return saved ? JSON.parse(saved) : DEFAULT_COA;
  });

  const [exportFormat, setExportFormat] = useState<'STANDARD' | 'EXPRESS' | 'PEAK_FLOW'>('STANDARD');
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DISBURSEMENT' | 'REPAYMENT'>('ALL');
  const [filterProduct, setFilterProduct] = useState<'ALL' | 'HP' | 'LOAN'>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Load database state
  useEffect(() => {
    setContracts(getContracts());
    setDisbursements(getDisbursements());
    setRepayments(getRepayments());
    
    // Add event listener for global search
    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSearchQuery(customEvent.detail || '');
    };
    window.addEventListener('global-contract-search', handleGlobalSearch);
    return () => window.removeEventListener('global-contract-search', handleGlobalSearch);
  }, []);

  // Save COA
  const handleSaveCOA = (newCoa: ChartOfAccounts) => {
    setCoa(newCoa);
    localStorage.setItem('lms_accounting_coa', JSON.stringify(newCoa));
    setShowConfig(false);
  };

  const handleResetCOA = () => {
    if (confirm('คุณต้องการรีเซ็ตรหัสบัญชีเป็นค่าเริ่มต้นทั้งหมดหรือไม่?')) {
      setCoa(DEFAULT_COA);
      localStorage.removeItem('lms_accounting_coa');
    }
  };

  // Convert disbursements and repayments into dual-entry journal entries
  const generateJournalEntries = (): JournalEntry[] => {
    const entries: JournalEntry[] = [];

    // 1. Process Disbursements (การจ่ายเงินกู้)
    disbursements.forEach(d => {
      const contract = contracts.find(c => c.id === d.contractId);
      if (!contract) return;

      const amountNum = typeof d.amount === 'string' ? parseFloat(d.amount) : d.amount;
      const netReceived = d.netReceived;
      const upfrontInterest = d.upfrontInterest || 0;
      const upfrontFee = d.upfrontFee || 0;
      const isHp = contract.productType === 'HP';

      const lines: JournalLine[] = [];

      // DR Receivable
      if (isHp) {
        lines.push({
          accountCode: coa.hpReceivable.code,
          accountName: coa.hpReceivable.name,
          debit: amountNum,
          credit: 0
        });
      } else {
        lines.push({
          accountCode: coa.loanReceivable.code,
          accountName: coa.loanReceivable.name,
          debit: amountNum,
          credit: 0
        });
      }

      // CR Cash/Bank
      lines.push({
        accountCode: coa.cashBank.code,
        accountName: coa.cashBank.name,
        debit: 0,
        credit: netReceived
      });

      // CR Upfront Interest / Deferred
      if (upfrontInterest > 0) {
        lines.push({
          accountCode: coa.deferredInterest.code,
          accountName: coa.deferredInterest.name,
          debit: 0,
          credit: upfrontInterest
        });
      }

      // CR Upfront Fees
      if (upfrontFee > 0) {
        lines.push({
          accountCode: coa.deferredUpfrontFee.code,
          accountName: coa.deferredUpfrontFee.name,
          debit: 0,
          credit: upfrontFee
        });
      }

      // Safeguard against rounding / floating point imbalance
      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
      const diff = parseFloat((totalDebit - totalCredit).toFixed(2));
      if (diff !== 0 && lines.length > 1) {
        // Adjust cash/bank to ensure absolute balance
        const bankIdx = lines.findIndex(l => l.accountCode === coa.cashBank.code);
        if (bankIdx !== -1) {
          lines[bankIdx].credit = parseFloat((lines[bankIdx].credit + diff).toFixed(2));
        }
      }

      entries.push({
        id: `DISB-${d.id}`,
        date: d.disburseDate,
        voucherNo: `PV-DISB-${d.id}`,
        reference: d.contractId,
        description: `บันทึกการเบิกจ่ายเงินกู้สัญญา เลขที่ ${d.contractId} (${contract.customerName})`,
        contractId: d.contractId,
        customerName: contract.customerName,
        productType: contract.productType,
        type: 'DISBURSEMENT',
        lines
      });
    });

    // 2. Process Repayments (การรับชำระเงินคืน)
    repayments.forEach(r => {
      const contract = contracts.find(c => c.id === r.contractId);
      if (!contract) return;

      const isHp = contract.productType === 'HP';
      const lines: JournalLine[] = [];

      // DR Bank
      lines.push({
        accountCode: coa.cashBank.code,
        accountName: coa.cashBank.name,
        debit: r.amountPaid,
        credit: 0
      });

      // CR Receivable (Principal)
      if (isHp) {
        // For Hire Purchase, the receivable comprises Principal and Interest (ExVat)
        lines.push({
          accountCode: coa.hpReceivable.code,
          accountName: coa.hpReceivable.name,
          debit: 0,
          credit: parseFloat((r.appliedPrincipal + r.appliedInterest).toFixed(2))
        });
      } else {
        lines.push({
          accountCode: coa.loanReceivable.code,
          accountName: coa.loanReceivable.name,
          debit: 0,
          credit: r.appliedPrincipal
        });
      }

      // CR Interest Income (For Loans only; HP reduces receivable)
      if (!isHp && r.appliedInterest > 0) {
        lines.push({
          accountCode: coa.interestLoan.code,
          accountName: coa.interestLoan.name,
          debit: 0,
          credit: r.appliedInterest
        });
      }

      // CR Output VAT (For HP payments)
      if (isHp && r.appliedVat > 0) {
        lines.push({
          accountCode: coa.outputVat.code,
          accountName: coa.outputVat.name,
          debit: 0,
          credit: r.appliedVat
        });
      }

      // CR Tracking Collection Fee
      if (r.appliedTrackingFee > 0) {
        if (isHp) {
          const netTracking = Math.round((r.appliedTrackingFee / 1.07) * 100) / 100;
          const vatTracking = parseFloat((r.appliedTrackingFee - netTracking).toFixed(2));

          lines.push({
            accountCode: coa.collectionIncome.code,
            accountName: coa.collectionIncome.name,
            debit: 0,
            credit: netTracking
          });

          lines.push({
            accountCode: coa.outputVat.code,
            accountName: coa.outputVat.name,
            debit: 0,
            credit: vatTracking
          });
        } else {
          lines.push({
            accountCode: coa.collectionIncome.code,
            accountName: coa.collectionIncome.name,
            debit: 0,
            credit: r.appliedTrackingFee
          });
        }
      }

      // CR Late Penalties
      if (r.appliedPenalty > 0) {
        lines.push({
          accountCode: coa.penaltyIncome.code,
          accountName: coa.penaltyIncome.name,
          debit: 0,
          credit: r.appliedPenalty
        });
      }

      // Balancing validation
      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
      const diff = parseFloat((totalDebit - totalCredit).toFixed(2));
      if (diff !== 0 && lines.length > 1) {
        // Find main receivable credit line and adjust
        const recCode = isHp ? coa.hpReceivable.code : coa.loanReceivable.code;
        const recIdx = lines.findIndex(l => l.accountCode === recCode);
        if (recIdx !== -1) {
          lines[recIdx].credit = parseFloat((lines[recIdx].credit + diff).toFixed(2));
        } else {
          // Fallback adjust to the last line
          lines[lines.length - 1].credit = parseFloat((lines[lines.length - 1].credit + diff).toFixed(2));
        }
      }

      const entryId = r.id.startsWith('REPAY-') ? `JNL-${r.id}` : `JNL-REPAY-${r.id}`;

      entries.push({
        id: entryId,
        date: r.paymentDate,
        voucherNo: `RV-RCP-${r.receiptNo || r.id}`,
        reference: r.contractId,
        description: `รับชำระค่างวด/เงินคืนสัญญา ${r.contractId} (${contract.customerName}) ใบเสร็จ ${r.receiptNo || '-'}`,
        contractId: r.contractId,
        customerName: contract.customerName,
        productType: contract.productType,
        type: 'REPAYMENT',
        lines
      });
    });

    // Ensure all journal entry IDs are strictly unique
    const seenIds = new Set<string>();
    entries.forEach((e, idx) => {
      if (seenIds.has(e.id)) {
        e.id = `${e.id}-${idx}`;
      }
      seenIds.add(e.id);
    });

    // Sort by date descending
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const allEntries = generateJournalEntries();

  // Filter entries
  const filteredEntries = allEntries.filter(e => {
    // Search query
    const matchSearch = 
      e.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.contractId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase());

    // Date range
    const matchStart = startDate ? new Date(e.date).getTime() >= new Date(startDate).getTime() : true;
    const matchEnd = endDate ? new Date(e.date).getTime() <= new Date(endDate).getTime() : true;

    // Type
    const matchType = filterType === 'ALL' ? true : e.type === filterType;

    // Product Type
    const matchProduct = filterProduct === 'ALL' ? true : e.productType === filterProduct;

    return matchSearch && matchStart && matchEnd && matchType && matchProduct;
  });

  // Calculate Trial Balance / Summary of Accounts
  const getTrialBalance = () => {
    const summary: { [code: string]: { name: string; debit: number; credit: number } } = {};
    
    filteredEntries.forEach(entry => {
      entry.lines.forEach(line => {
        if (!summary[line.accountCode]) {
          summary[line.accountCode] = { name: line.accountName, debit: 0, credit: 0 };
        }
        summary[line.accountCode].debit += line.debit;
        summary[line.accountCode].credit += line.credit;
      });
    });

    return Object.keys(summary).map(code => ({
      code,
      name: summary[code].name,
      debit: parseFloat(summary[code].debit.toFixed(2)),
      credit: parseFloat(summary[code].credit.toFixed(2)),
      net: parseFloat((summary[code].debit - summary[code].credit).toFixed(2))
    })).sort((a, b) => a.code.localeCompare(b.code));
  };

  const trialBalance = getTrialBalance();
  const totalDebitSum = trialBalance.reduce((sum, item) => sum + item.debit, 0);
  const totalCreditSum = trialBalance.reduce((sum, item) => sum + item.credit, 0);

  // Helper format currency
  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const formatDateDMY = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Export to Excel (CSV with UTF-8 BOM)
  const exportToExcel = (mode: 'LEDGER' | 'SUMMARY') => {
    let csvContent = '';
    let fileName = '';

    if (mode === 'LEDGER') {
      if (exportFormat === 'EXPRESS') {
        fileName = `Express_GL_Import_${new Date().toISOString().split('T')[0]}.csv`;
        // Express columns
        csvContent += 'VOUCHER,DATE,REF,DEPT,ACCNO,DESP,AMOUNT,DRCR\n';
        
        filteredEntries.forEach(entry => {
          entry.lines.forEach(line => {
            const cleanDesc = `"${entry.description.replace(/"/g, '""')}"`;
            const amount = line.debit > 0 ? line.debit : line.credit;
            const drcr = line.debit > 0 ? 'D' : 'C';
            csvContent += `${entry.voucherNo},${formatDateDMY(entry.date)},${entry.reference},HQ,${line.accountCode},${cleanDesc},${amount.toFixed(2)},${drcr}\n`;
          });
        });
      } else if (exportFormat === 'PEAK_FLOW') {
        fileName = `PEAK_FlowAccount_Import_${new Date().toISOString().split('T')[0]}.csv`;
        // PEAK / FlowAccount columns
        csvContent += 'วันที่ใบสำคัญ (DD/MM/YYYY),เลขที่เอกสาร,คำอธิบายรายการ,รหัสบัญชี,ชื่อบัญชี,เดบิต,เครดิต,แผนก,ชื่อลูกค้า\n';
        
        filteredEntries.forEach(entry => {
          entry.lines.forEach(line => {
            const cleanDesc = `"${entry.description.replace(/"/g, '""')}"`;
            const cleanCust = `"${entry.customerName.replace(/"/g, '""')}"`;
            const cleanAccName = `"${line.accountName.replace(/"/g, '""')}"`;
            csvContent += `${formatDateDMY(entry.date)},${entry.voucherNo},${cleanDesc},${line.accountCode},${cleanAccName},${line.debit || 0},${line.credit || 0},HQ,${cleanCust}\n`;
          });
        });
      } else {
        fileName = `Journal_Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`;
        // Standard columns
        csvContent += 'วันที่บันทึกบัญชี (Date),เลขที่ใบสำคัญ (Voucher No),อ้างอิงสัญญา (Reference No),รหัสบัญชี (Account Code),ชื่อบัญชี (Account Name),คำอธิบายรายการ (Description),เดบิต (Debit),เครดิต (Credit),ประเภทสัญญา (Product Type),ชื่อลูกค้า (Customer Name)\n';
        
        filteredEntries.forEach(entry => {
          entry.lines.forEach(line => {
            const cleanDesc = `"${entry.description.replace(/"/g, '""')}"`;
            const cleanCust = `"${entry.customerName.replace(/"/g, '""')}"`;
            const cleanAccName = `"${line.accountName.replace(/"/g, '""')}"`;
            csvContent += `${entry.date},${entry.voucherNo},${entry.reference},${line.accountCode},${cleanAccName},${cleanDesc},${line.debit || 0},${line.credit || 0},${entry.productType},${cleanCust}\n`;
          });
        });
      }
    } else {
      fileName = `Trial_Balance_Summary_${new Date().toISOString().split('T')[0]}.csv`;
      csvContent += 'รหัสบัญชี (Account Code),ชื่อบัญชี (Account Name),ยอดเดบิตสะสม (Total Debit),ยอดเครดิตสะสม (Total Credit),ยอดดุลสุทธิ (Net Balance)\n';
      
      trialBalance.forEach(item => {
        const cleanAccName = `"${item.name.replace(/"/g, '""')}"`;
        csvContent += `${item.code},${cleanAccName},${item.debit},${item.credit},${item.net}\n`;
      });
      csvContent += `,,${totalDebitSum},${totalCreditSum},0.00\n`;
    }

    // Download flow with UTF-8 BOM
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#1463F3]" />
            สมุดบันทึกบัญชี & ส่งออกข้อมูล (Accounting Journal)
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            สืบค้นข้อมูลประวัติการเบิกเงินและการรับชำระเงิน นำเข้าข้อมูลระบบบัญชีมาตรฐาน (เช่น Express, SAP, Odoo, CD Organizer)
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition"
          >
            <Settings2 className="w-4 h-4 text-slate-400" />
            <span>กำหนดผังบัญชี (Chart of Accounts)</span>
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs">
            <span className="text-slate-400">ระบบปลายทาง:</span>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              <option value="STANDARD">มาตรฐาน (Standard GL)</option>
              <option value="EXPRESS">Express (Thai GL)</option>
              <option value="PEAK_FLOW">PEAK / FlowAccount</option>
            </select>
          </div>
          
          <button
            type="button"
            onClick={() => exportToExcel('LEDGER')}
            disabled={filteredEntries.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel (Ledger)</span>
          </button>
          <button
            type="button"
            onClick={() => exportToExcel('SUMMARY')}
            disabled={trialBalance.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (Summary)</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">รายการบันทึกทั้งหมด</div>
            <div className="text-lg font-black text-slate-800">{allEntries.length} รายการ</div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            ฿
          </div>
          <div>
            <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">ยอดเดบิตสะสมในตาราง</div>
            <div className="text-lg font-black text-emerald-600">฿ {formatThb(totalDebitSum)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
            ฿
          </div>
          <div>
            <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">ยอดเครดิตสะสมในตาราง</div>
            <div className="text-lg font-black text-violet-600">฿ {formatThb(totalCreditSum)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">สถานะการตรวจสอบสมดุล</div>
            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md inline-block">
              ✓ ดุลบัญชีเท่ากัน (Balanced)
            </div>
          </div>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <h2 className="text-xs font-extrabold uppercase text-slate-600 tracking-wider">ตัวกรองสืบค้นสมุดบัญชี (Journal Filters)</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">จากวันที่ (Start Date)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ถึงวันที่ (End Date)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Filter Transaction Type */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ประเภทธุรกรรม (Type)</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="ALL">ทั้งหมด (All Transactions)</option>
              <option value="DISBURSEMENT">เบิกจ่ายเงินกู้ยืม / Drawdown</option>
              <option value="REPAYMENT">รับชำระเงินคืน / Repayments</option>
            </select>
          </div>

          {/* Filter Product Type */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ประเภทสัญญา (Product)</label>
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value as any)}
              className="w-full bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="ALL">ทั้งหมด (All Products)</option>
              <option value="HP">เช่าซื้อ (HP - Hire Purchase)</option>
              <option value="LOAN">เงินกู้ยืม (LOAN - Effective Rate)</option>
            </select>
          </div>

          {/* Search Box inside filter section for convenience */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">คำค้นหาพิเศษ (Search Keyword)</label>
            <input
              type="text"
              placeholder="รหัสสัญญา, เลขที่ใบเสร็จ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Main Journal Ledger & Summary Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Journal Book Vouchers (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  สมุดรายวันทั่วไป (General Journal Book)
                </h3>
              </div>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono">
                {filteredEntries.length} รายการกรอง
              </span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                ไม่พบข้อมูลธุรกรรมบัญชีที่ตรงกับตัวกรองที่เลือก
              </div>
            ) : (
              <div className="divide-y divide-slate-150">
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className="p-5 hover:bg-slate-50/50 transition duration-150">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-dashed border-slate-150 pb-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md tracking-wider ${
                          entry.type === 'DISBURSEMENT' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-150' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                        }`}>
                          {entry.type === 'DISBURSEMENT' ? 'เบิกจ่าย / Drawdown' : 'รับเงิน / Repayment'}
                        </span>
                        
                        <span className="text-xs font-black text-slate-800 font-mono">{entry.voucherNo}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">📅</span>
                          <span className="font-mono">{entry.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">📑</span>
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">{entry.contractId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Word description */}
                    <p className="text-xs text-slate-600 font-semibold mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      📝 {entry.description}
                    </p>

                    {/* Debit/Credit lines */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] font-sans border border-slate-100 rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-slate-50/60 text-slate-500 font-extrabold uppercase border-b border-slate-100">
                            <th className="p-2 w-28">รหัสบัญชี (Code)</th>
                            <th className="p-2">ชื่อบัญชี (Account Name)</th>
                            <th className="p-2 text-right w-28">เดบิต (Dr. ฿)</th>
                            <th className="p-2 text-right w-28">เครดิต (Cr. ฿)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entry.lines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-white/80">
                              <td className="p-2 font-mono text-slate-500 font-bold">{line.accountCode}</td>
                              <td className="p-2 font-medium">
                                <span className={line.credit > 0 ? "pl-5 text-slate-600 block" : "text-slate-800 block font-bold"}>
                                  {line.accountName}
                                </span>
                              </td>
                              <td className="p-2 text-right font-mono text-emerald-700 font-bold">
                                {line.debit > 0 ? formatThb(line.debit) : '-'}
                              </td>
                              <td className="p-2 text-right font-mono text-violet-700 font-bold">
                                {line.credit > 0 ? formatThb(line.credit) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Trial Balance Summary (1/3 width on large screens) */}
        <div className="space-y-6">
          
          {/* Trial balance card */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-150">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                สรุปตามผังรหัสบัญชี (Trial Balance)
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] font-sans">
                  <thead>
                    <tr className="text-slate-400 font-extrabold uppercase border-b border-slate-150 pb-2">
                      <th className="pb-2">รหัสบัญชี (COA)</th>
                      <th className="pb-2 text-right">เดบิต (Dr.)</th>
                      <th className="pb-2 text-right">เครดิต (Cr.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trialBalance.map((item) => (
                      <tr key={item.code} className="hover:bg-slate-50">
                        <td className="py-2.5">
                          <div className="font-mono text-slate-800 font-bold">{item.code}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={item.name}>{item.name.split(' (')[0]}</div>
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-600 font-medium">
                          {item.debit > 0 ? formatThb(item.debit) : '-'}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-600 font-medium">
                          {item.credit > 0 ? formatThb(item.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-200">
                      <td className="py-2.5 font-bold text-slate-700">ยอดรวมทั้งสิ้น (Total)</td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-700">฿ {formatThb(totalDebitSum)}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-violet-700">฿ {formatThb(totalCreditSum)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Integration Guide Box */}
          <div className="bg-[#FFF9E6]/70 border border-amber-200/80 p-5 rounded-2xl space-y-3 shadow-xs">
            <h4 className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5 font-sans">
              <Building className="w-4 h-4 text-amber-700" />
              คำแนะนำการนำเข้าข้อมูลระบบบัญชี (ERP Integration)
            </h4>
            <div className="text-[11px] text-slate-600 leading-relaxed font-sans space-y-2">
              <p>
                ไฟล์ที่ส่งออกจากระบบ <strong>Nexus LMS</strong> เป็นมาตรฐาน UTF-8 CSV พร้อม Byte Order Mark (BOM) สามารถเปิดใน Excel โดยตรงไม่เป็นภาษาต่างดาว
              </p>
              <ul className="list-disc pl-4 space-y-1 bg-amber-50/40 p-2.5 rounded-lg border border-amber-100">
                <li><strong>ระบบ Express:</strong> สามารถนำเข้าไฟล์ Ledger โดยแปลงฟิลด์ให้ตรงกับโครงสร้างตารางของสมุดรายวันทั่วไป (GL)</li>
                <li><strong>Odoo / SAP:</strong> รองรับการแมปปิ้งรหัสรหัสบัญชี (Account Code) และนำเข้าผ่านชุดเมนู Journal Entries ได้ทันที</li>
                <li>รหัสบัญชีสามารถปรับเปลี่ยนให้ตรงกับระบบ ERP ขององค์กรคุณได้ในปุ่มกำหนดผังด้านบน</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* COA Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  กำหนดผังรหัสบัญชี (Chart of Accounts Configurator)
                </h3>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-50 cursor-pointer transition font-bold"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-6 font-medium leading-relaxed">
              * กำหนดค่ารหัสผังบัญชีให้ตรงกับความต้องการของฝ่ายบัญชีและโครงสร้างของโปรแกรม ERP ที่กิจการท่านใช้งานอยู่ ระบบจะนำรหัสเหล่านี้ไปประมวลผลเป็นสมุดรายวันทั่วไป
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as any;
              const updatedCoa: ChartOfAccounts = {
                cashBank: { code: form.cashBankCode.value, name: form.cashBankName.value },
                hpReceivable: { code: form.hpReceivableCode.value, name: form.hpReceivableName.value },
                loanReceivable: { code: form.loanReceivableCode.value, name: form.loanReceivableName.value },
                deferredVat: { code: form.deferredVatCode.value, name: form.deferredVatName.value },
                outputVat: { code: form.outputVatCode.value, name: form.outputVatName.value },
                interestLoan: { code: form.interestLoanCode.value, name: form.interestLoanName.value },
                interestHp: { code: form.interestHpCode.value, name: form.interestHpName.value },
                deferredUpfrontFee: { code: form.deferredUpfrontFeeCode.value, name: form.deferredUpfrontFeeName.value },
                deferredInterest: { code: form.deferredInterestCode.value, name: form.deferredInterestName.value },
                collectionIncome: { code: form.collectionIncomeCode.value, name: form.collectionIncomeName.value },
                penaltyIncome: { code: form.penaltyIncomeCode.value, name: form.penaltyIncomeName.value },
              };
              handleSaveCOA(updatedCoa);
            }} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto p-1.5 border border-slate-100 rounded-2xl bg-slate-50">
                {/* Cash Bank */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">เงินฝากธนาคาร / เงินสด</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="cashBankCode" defaultValue={coa.cashBank.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="cashBankName" defaultValue={coa.cashBank.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* HP Receivable */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">ลูกหนี้สัญญาเช่าซื้อ (HP)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="hpReceivableCode" defaultValue={coa.hpReceivable.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="hpReceivableName" defaultValue={coa.hpReceivable.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Loan Receivable */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">ลูกหนี้เงินกู้ยืม (Loans)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="loanReceivableCode" defaultValue={coa.loanReceivable.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="loanReceivableName" defaultValue={coa.loanReceivable.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Output VAT */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">ภาษีขาย (Output VAT)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="outputVatCode" defaultValue={coa.outputVat.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="outputVatName" defaultValue={coa.outputVat.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Deferred Output VAT */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">ภาษีขายรอตัดบัญชี (Deferred VAT)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="deferredVatCode" defaultValue={coa.deferredVat.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="deferredVatName" defaultValue={coa.deferredVat.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Interest Loans */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">รายได้ดอกเบี้ยรับ - เงินกู้ยืม</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="interestLoanCode" defaultValue={coa.interestLoan.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="interestLoanName" defaultValue={coa.interestLoan.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Interest HP */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">รายได้ดอกเบี้ยรับ - สัญญาเช่าซื้อ</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="interestHpCode" defaultValue={coa.interestHp.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="interestHpName" defaultValue={coa.interestHp.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Deferred Interest */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">รายได้ดอกเบี้ยรับรอตัด (Deferred Int)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="deferredInterestCode" defaultValue={coa.deferredInterest.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="deferredInterestName" defaultValue={coa.deferredInterest.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Deferred Upfront Fees */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">รายได้ค่าธรรมเนียมล่วงหน้า</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="deferredUpfrontFeeCode" defaultValue={coa.deferredUpfrontFee.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="deferredUpfrontFeeName" defaultValue={coa.deferredUpfrontFee.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Collection Fee Income */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">รายได้ค่าติดตามทวงถาม (Collection)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="collectionIncomeCode" defaultValue={coa.collectionIncome.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="collectionIncomeName" defaultValue={coa.collectionIncome.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>

                {/* Penalty Income */}
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">รายได้เบี้ยปรับล่าช้า (Penalties)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="penaltyIncomeCode" defaultValue={coa.penaltyIncome.code} className="col-span-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                    <input type="text" name="penaltyIncomeName" defaultValue={coa.penaltyIncome.name} className="col-span-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 focus:bg-white" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetCOA}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition"
                >
                  คืนค่าเริ่มต้น (Reset Defaults)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition"
                >
                  บันทึกการตั้งค่ารหัสบัญชี
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
