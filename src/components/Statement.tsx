import React, { useState, useEffect, useRef } from 'react';
import { getScheduledPayments, getContracts, getRepayments, getSystemDate, importScheduledPaymentsFromCSV } from '../dbStore';
import { ScheduledPayment, Contract, StatementStatus, Repayment } from '../types';
import { Search, Printer, Upload, FileSpreadsheet, CheckCircle2, Database, AlertCircle, CloudUpload, Loader2 } from 'lucide-react';
import DocViewerModal from './DocViewerModal';
import DbInspectorModal from './DbInspectorModal';
import DetailedScheduleMatrix from './DetailedScheduleMatrix';
import { PROVIDED_SCHEDULES_CSV } from '../data/providedSchedules';
import { parseScheduledPaymentsCSV } from '../utils/csvParser';
import { getSupabaseClient, getSavedSupabaseConfig } from '../supabaseClient';
import { pushLocalDataToSupabase } from '../supabaseSync';

export default function Statement() {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  // Search parameters
  const [searchContract, setSearchContract] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatementStatus | 'ALL'>('ALL');
  const [searchDueDate, setSearchDueDate] = useState('');
  const [viewMode, setViewMode] = useState<'standard' | 'matrix'>('standard');

  // Modal Doc & Inspector states
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [isDbInspectorOpen, setIsDbInspectorOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledPayment | undefined>(undefined);

  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [systemDate, setSystemDate] = useState(getSystemDate());
  const [importMessage, setImportMessage] = useState<string | null>(null);
  
  // Pending file upload states
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pendingCsvContent, setPendingCsvContent] = useState<string | null>(null);
  const [pendingParsedCount, setPendingParsedCount] = useState<number>(0);
  const [replaceExistingMode, setReplaceExistingMode] = useState<boolean>(true);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadData = () => {
    setPayments(getScheduledPayments());
    setContracts(getContracts());
    setRepayments(getRepayments());
    setSystemDate(getSystemDate());
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseScheduledPaymentsCSV(text);
        setSelectedFileName(file.name);
        setPendingCsvContent(text);
        setPendingParsedCount(parsed.length);
        setImportMessage(`เลือกไฟล์ "${file.name}" เรียบร้อย (สแกนพบ ${parsed.length} รายการ) กรุณากดปุ่ม "ยืนยันนำเข้าข้อมูล" เพื่อดำเนินการบันทึก`);
      }
    };
    reader.readAsText(file);
  };

  const syncToSupabaseIfConnected = async (replaceMode: boolean) => {
    const client = getSupabaseClient();
    if (!client) return;
    setIsSyncingSupabase(true);
    setImportMessage(`☁️ กำลังนำข้อมูลทั้งหมด Sync ขึ้นไปบันทึกบน Supabase...`);
    try {
      const pushRes = await pushLocalDataToSupabase(client, replaceMode);
      if (pushRes.success) {
        setImportMessage(`🎉 นำเข้าสำเร็จและ Sync ขึ้น Supabase เรียบร้อยแล้ว! (สัญญา: ${pushRes.pushedCount?.contracts || 0}, งวดชำระ: ${pushRes.pushedCount?.payments || 0} รายการ)`);
      } else {
        setImportMessage(`⚠️ บันทึกลง Local แล้ว แต่เกิดข้อผิดพลาดในการ Sync ขึ้น Supabase: ${pushRes.message}`);
      }
    } catch (err: any) {
      setImportMessage(`⚠️ บันทึกลง Local แล้ว แต่เกิดข้อผิดพลาดในการ Sync ขึ้น Supabase: ${err.message || err}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingCsvContent) return;
    try {
      const res = importScheduledPaymentsFromCSV(pendingCsvContent, replaceExistingMode);
      setPendingCsvContent(null);
      setSelectedFileName(null);
      setPendingParsedCount(0);
      reloadData();
      if (fileInputRef.current) fileInputRef.current.value = '';

      const client = getSupabaseClient();
      if (client) {
        await syncToSupabaseIfConnected(replaceExistingMode);
      } else {
        setImportMessage(`🎉 นำเข้าข้อมูลสำเร็จเรียบร้อยแล้ว: ทั้งหมด ${res.importedCount} รายการค่างวด (บันทึกใน Local DB)`);
      }
      setTimeout(() => setImportMessage(null), 12000);
    } catch (err: any) {
      setImportMessage(`เกิดข้อผิดพลาดในการนำเข้าไฟล์ CSV: ${err.message || err}`);
    }
  };

  const handleImportProvidedDataDemo = async () => {
    try {
      const res = importScheduledPaymentsFromCSV(PROVIDED_SCHEDULES_CSV, replaceExistingMode);
      reloadData();
      const client = getSupabaseClient();
      if (client) {
        await syncToSupabaseIfConnected(replaceExistingMode);
      } else {
        setImportMessage(`นำเข้าข้อมูลตัวอย่าง Demo สำเร็จ: ${res.importedCount} รายการค่างวด`);
      }
      setTimeout(() => setImportMessage(null), 8000);
    } catch (err: any) {
      setImportMessage(`เกิดข้อผิดพลาด: ${err.message || err}`);
    }
  };

  useEffect(() => {
    reloadData();

    const handleDateChanged = () => {
      reloadData();
    };
    window.addEventListener('system-date-changed', handleDateChanged);
    return () => {
      window.removeEventListener('system-date-changed', handleDateChanged);
    };
  }, []);

  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  const getStatusBadge = (status: StatementStatus) => {
    switch (status) {
      case 'PAID':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">ชำระแล้ว (PAID)</span>;
      case 'PARTIAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">จ่ายบางส่วน (PARTIAL)</span>;
      case 'OVERDUE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">ค้างชำระ (OVERDUE)</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">รอดำเนินการ</span>;
    }
  };

  // Launch Invoice Viewer
  const handleOpenInvoice = (sch: ScheduledPayment) => {
    const con = contracts.find(c => c.id === sch.contractId);
    if (con) {
      setSelectedContract(con);
      setSelectedSchedule(sch);
      setIsDocOpen(true);
    }
  };

  const [showOnlyUpcoming, setShowOnlyUpcoming] = useState(false);

  // Filter schedules
  const filteredSchedules = payments.filter(s => {
    const isSearching = Boolean(searchContract || searchCustomer || searchDueDate || selectedStatus !== 'ALL');
    if (showOnlyUpcoming && !isSearching) {
      const dueTime = new Date(s.dueDate).getTime();
      const sysTime = new Date(systemDate).getTime();
      const diffDays = (dueTime - sysTime) / (1000 * 60 * 60 * 24);
      if (diffDays > 15) {
        return false;
      }
    }

    const sCid = (s.contractId || '').trim().toUpperCase();
    const parent = contracts.find(c => (c.id || '').trim().toUpperCase() === sCid);
    const parentName = parent ? parent.customerName.toLowerCase() : '';
    
    const matchesContract = (s.contractId || '').toLowerCase().includes(searchContract.toLowerCase());
    const matchesCustomer = parentName.includes(searchCustomer.toLowerCase());
    const matchesStatus = selectedStatus === 'ALL' ? true : s.status === selectedStatus;
    const matchesDueDate = searchDueDate ? s.dueDate === searchDueDate : true;

    return matchesContract && matchesCustomer && matchesStatus && matchesDueDate;
  });

  const renderAgingBadge = (sch: ScheduledPayment) => {
    if (sch.status === 'PAID') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 inline-block whitespace-nowrap">
          ปกติ (ชำระแล้ว)
        </span>
      );
    }
    const todayMs = new Date(systemDate).getTime();
    const dueMs = new Date(sch.dueDate).getTime();
    const diffDays = Math.ceil((todayMs - dueMs) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block whitespace-nowrap">
          ปกติ (0 วัน)
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-block whitespace-nowrap">
          ค้าง {diffDays} วัน (1-30)
        </span>
      );
    } else if (diffDays <= 60) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200 inline-block whitespace-nowrap">
          ค้าง {diffDays} วัน (31-60)
        </span>
      );
    } else if (diffDays <= 90) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200 inline-block whitespace-nowrap">
          ค้าง {diffDays} วัน (61-90)
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-900 border border-red-300 inline-block whitespace-nowrap animate-pulse">
          ค้าง {diffDays} วัน (&gt;90 NPL)
        </span>
      );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <input 
        type="file" 
        accept=".csv" 
        ref={fileInputRef} 
        onChange={handleFileSelected} 
        className="hidden" 
      />

      {/* CSV Import Banner / Panel */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>ระบบนำเข้าตารางค่างวดจากไฟล์ CSV (Import Schedules)</span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-sky-900/80 text-sky-300 border border-sky-600/50 font-bold">
                  {payments.length} รายการในฐานข้อมูล
                </span>
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                เลือกไฟล์ CSV จากเครื่องของคุณเพื่อนำเข้าตารางเรียกเก็บ พร้อมสร้างสัญญาลูกค้าให้อัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDbInspectorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>🔍 ตรวจสอบค่าดิบ DB</span>
            </button>

            <button
              type="button"
              onClick={() => syncToSupabaseIfConnected(replaceExistingMode)}
              disabled={isSyncingSupabase}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50 shadow-md transition cursor-pointer disabled:opacity-50"
              title="ส่งข้อมูลทั้งหมด (1,300+ รายการ) ขึ้นไปอัปเดตบันทึกบน Supabase Cloud"
            >
              {isSyncingSupabase ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลัง Sync Supabase...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>☁️ Sync ขึ้น Supabase</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{selectedFileName ? '📁 เปลี่ยนไฟล์ CSV' : '📁 เลือกไฟล์ CSV'}</span>
            </button>

            <button
              type="button"
              onClick={handleImportProvidedDataDemo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="นำเข้าชุดข้อมูลตัวอย่าง Demo 202 รายการ"
            >
              <span>🧪 ชุดข้อมูลตัวอย่าง Demo (202 รายการ)</span>
            </button>
          </div>
        </div>

        {/* Selected File Confirmation Box */}
        {pendingCsvContent ? (
          <div className="bg-sky-950/90 border-2 border-sky-500 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs animate-fadeIn shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <div>
                <span className="font-extrabold text-white text-sm block">
                  📄 ไฟล์ที่พร้อมนำเข้า: <span className="text-sky-300 font-mono underline">{selectedFileName}</span>
                </span>
                <span className="text-sky-200 text-xs block mt-0.5">
                  สแกนพบ <span className="font-extrabold text-emerald-300 font-mono text-sm">{pendingParsedCount} รายการค่างวด</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-slate-200 text-[11px] font-bold bg-slate-900/90 px-3.5 py-2 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-900 transition">
                <input
                  type="checkbox"
                  checked={replaceExistingMode}
                  onChange={e => setReplaceExistingMode(e.target.checked)}
                  className="rounded border-slate-600 text-sky-500 focus:ring-sky-400 w-4 h-4 cursor-pointer"
                />
                <span>ล้างข้อมูลเก่าและนำเข้าเฉพาะไฟล์นี้ทั้งหมด (Replace Mode)</span>
              </label>

              <button
                type="button"
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl transition cursor-pointer transform hover:scale-105"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>📥 กดปุ่มนี้เพื่อนำเข้าข้อมูล ({pendingParsedCount} รายการ)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
            <span>คำแนะนำ: กดปุ่ม <strong className="text-sky-300">"เลือกไฟล์ CSV"</strong> ด้านบนเพื่อสแกนไฟล์ก่อน จากนั้นระบบจะแสดงปุ่มให้กดยืนยันนำเข้าข้อมูล</span>
          </div>
        )}
      </div>

      {importMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{importMessage}</span>
        </div>
      )}

      {/* Search Filter Panel */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-xs uppercase tracking-wider font-mono text-sky-700">ค้นหาข้อมูลเรียกเก็บตามดิวสัญญา (Statement Bills Filter)</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-bold mb-1">เลขที่สัญญา</label>
            <input
              type="text"
              placeholder="กรองเลขที่สัญญา..."
              value={searchContract}
              onChange={e => setSearchContract(e.target.value)}
              className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1">ชื่อสมาชิกลูกหนี้</label>
            <input
              type="text"
              placeholder="กรองชื่อลูกค้านักปลูก..."
              value={searchCustomer}
              onChange={e => setSearchCustomer(e.target.value)}
              className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1">สถานะเรียกเก็บ</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value as StatementStatus | 'ALL')}
              className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition font-sans font-bold text-slate-700"
            >
              <option value="ALL">แสดงทั้งหมด (All States)</option>
              <option value="NOT_PAID">รอดำเนินการ (Not Paid)</option>
              <option value="PARTIAL">ค้างเหลือจ่ายบางส่วน (Partial)</option>
              <option value="PAID">ชำระครบกำหนด (Paid)</option>
              <option value="OVERDUE">เลยกำหนดค้างชำระ (Overdue)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1">วันที่ครบ Due Date</label>
            <input
              type="date"
              value={searchDueDate}
              onChange={e => setSearchDueDate(e.target.value)}
              className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition font-mono text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Dues Listings Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
          <div>
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">รายการค่างวดเรียกชำระ (Statement Active Billings)</h4>
            <p className="text-slate-400 mt-0.5">เลือกรูปแบบมุมมองตาราง Plan vs Actual หรือตารางรายการย่อ</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center font-bold text-[11px]">
              <button
                onClick={() => setViewMode('standard')}
                className={`px-3 py-1.5 rounded-md transition ${viewMode === 'standard' ? 'bg-[#1463F3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ตารางรายการ (List)
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-md transition ${viewMode === 'matrix' ? 'bg-[#1463F3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ตาราง Matrix (Plan vs Actual 9 หมวด)
              </button>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={showOnlyUpcoming}
                onChange={e => setShowOnlyUpcoming(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
              />
              <span>กรองเฉพาะงวดดิวล่วงหน้า 15 วัน</span>
            </label>
            <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 font-mono">พบ {filteredSchedules.length} คิวค่างวด</span>
          </div>
        </div>

        {viewMode === 'matrix' ? (
          <div className="p-4">
            {contracts.length > 0 ? (
              <DetailedScheduleMatrix
                contract={contracts.find(c => searchContract ? c.id.toLowerCase().includes(searchContract.toLowerCase()) : true) || contracts[0]}
                schedules={filteredSchedules}
                repayments={repayments}
              />
            ) : (
              <div className="p-8 text-center text-slate-400 font-sans">ไม่พบสัญญาสำหรับการแสดงผลตาราง Matrix</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">เลขที่สัญญา</th>
                <th className="p-4 font-sans">ผู้กู้ / ลูกค้า</th>
                <th className="p-4 text-center">งวดที่</th>
                <th className="p-4 text-center">วันครบดิวจ่าย</th>
                <th className="p-4 text-center text-amber-700">Aging / DPD</th>
                <th className="p-4 text-right header-num">เงินต้นเรียกเก็บ (Principal)</th>
                <th className="p-4 text-right header-num">ดอกเบี้ยคำนวณ (Interest)</th>
                <th className="p-4 text-right header-num">ภาษีมูลค่าเพิ่ม (VAT 7%)</th>
                <th className="p-4 text-right header-num text-rose-500">เบี้ยปรับสะสม (Penalty)</th>
                <th className="p-4 text-right header-num text-rose-500">ค่าติดตามทวงถาม (Collection)</th>
                <th className="p-4 text-right header-num text-sky-700">ยอดรวมต้องชำระ (Total)</th>
                <th className="p-4 text-right header-num text-emerald-600">ชำระแล้ว</th>
                <th className="p-4 text-center">สถานะ</th>
                <th className="p-4 text-center">ออกใบแจ้งหนี้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 font-sans">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-slate-400 font-sans">
                    ไม่พบรายการค้างชำระตามดิวหรือสถานะค่างวดที่เลือกในระบบขณะนี้
                  </td>
                </tr>
              ) : (
                filteredSchedules.map(sch => {
                  const parent = contracts.find(c => c.id === sch.contractId);

                  return (
                    <tr key={sch.id} className="hover:bg-slate-50/40 transition">
                      <td className="p-4 font-mono font-bold text-sky-600 uppercase tracking-wider">{sch.contractId}</td>
                      <td className="p-4 pr-1">
                        <div>
                          <span className="font-semibold text-slate-800 block">{parent ? parent.customerName : 'N/A'}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">ประเภท: {parent?.productType === 'HP' ? 'เช่าซื้อรถบรรทุก' : 'กู้ยืมเงิน'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-extrabold text-[10px]">งวด {sch.termNumber}</span>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-700">
                        <div>{sch.dueDate}</div>
                        {sch.rawDbDueDate && sch.rawDbDueDate !== sch.dueDate && (
                          <div className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 mt-0.5 font-normal" title="Raw DB due_date">
                            DB Raw: {sch.rawDbDueDate}
                          </div>
                        )}
                        {sch.fromDb && (
                          <span className="inline-block px-1 py-0.2 text-[8px] bg-emerald-50 text-emerald-700 font-sans font-bold rounded border border-emerald-200 mt-0.5">
                            Supabase DB
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-sans">
                        {renderAgingBadge(sch)}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-700">
                        <div>{formatThb(sch.principalDue)}</div>
                        {sch.pendingDisbursement && sch.pendingDisbursement > 0 ? (
                          <div className="text-[10px] text-sky-700 bg-sky-50 px-1 py-0.5 rounded border border-sky-100 font-sans font-bold mt-0.5" title="ยอดรอเบิก (pending_disbursement)">
                            รอเบิก: {formatThb(sch.pendingDisbursement)}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-700">
                        {formatThb(sch.interestDue)}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-700">{sch.vatDue > 0 ? formatThb(sch.vatDue) : '-'}</td>
                      
                      <td className="p-4 text-right font-mono font-bold text-rose-500">
                        {sch.penaltyDue > 0 ? formatThb(sch.penaltyDue) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-rose-500">
                        {sch.trackingFeeDue > 0 ? formatThb(sch.trackingFeeDue) : '-'}
                      </td>
                      
                      <td className="p-4 text-right font-mono font-extrabold text-sky-700 bg-sky-50/10">{formatThb(sch.totalDue)}</td>
                      <td className="p-4 text-right font-mono font-extrabold text-emerald-600">{formatThb(sch.totalPaid)}</td>
                      <td className="p-4 text-center">{getStatusBadge(sch.status)}</td>
                      
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenInvoice(sch)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded font-bold text-xs transition flex items-center justify-center space-x-1.5 mx-auto cursor-pointer shadow-xs"
                          title="พิมพ์ / ออกใบแจ้งหนี้ PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>ออกใบแจ้งหนี้</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Document View Printable Modal */}
      {selectedContract && selectedSchedule && (
        <DocViewerModal
          isOpen={isDocOpen}
          onClose={() => setIsDocOpen(false)}
          type="INVOICE"
          contract={selectedContract}
          scheduledPayment={selectedSchedule}
          schedules={payments}
        />
      )}

      {/* Raw Database Inspector Modal */}
      <DbInspectorModal
        isOpen={isDbInspectorOpen}
        onClose={() => setIsDbInspectorOpen(false)}
      />
    </div>
  );
}
