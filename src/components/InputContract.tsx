import React, { useState, useEffect } from 'react';
import { getContracts, addContract } from '../dbStore';
import { Contract, ProductType, PaymentFrequency } from '../types';
import { Search, Plus, Download, HelpCircle, Save, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react';
import ContractDetailModal from './ContractDetailModal';
import { generateAndSyncDailyAccruedToSupabase, clearAccruedInterestInSupabaseAndLocal } from '../supabaseSync';
import { getSupabaseClient } from '../supabaseClient';

export default function InputContract() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncingDaily, setIsSyncingDaily] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Detail Modal states
  const [selectedConForDetail, setSelectedConForDetail] = useState<Contract | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form states
  const [id, setId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [productType, setProductType] = useState<ProductType>('HP');
  const [creditLimit, setCreditLimit] = useState<number>(100000);
  const [interestRate, setInterestRate] = useState<number>(8);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [disburseDate, setDisburseDate] = useState('2026-01-01');
  const [termMonths, setTermMonths] = useState<number>(12);
  const [installmentAmount, setInstallmentAmount] = useState<number | ''>('');
  const [dueDay, setDueDay] = useState<5 | 15 | 25>(5);
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('MONTHLY');
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [treeCutOption, setTreeCutOption] = useState<boolean>(false);

  // Planting Group specifies
  const [plantingType, setPlantingType] = useState<'RESERVE' | 'NON_RESERVE'>('RESERVE');
  const [plantingAreaRai, setPlantingAreaRai] = useState<number | ''>('');
  const [plantingTreeCount, setPlantingTreeCount] = useState<number | ''>('');
  const [plantingProvince, setPlantingProvince] = useState('');
  const [plantingDistrict, setPlantingDistrict] = useState('');
  const [plantingSubdistrict, setPlantingSubdistrict] = useState('');

  // Snapshot/Migration states
  const [isSnapshotEnabled, setIsSnapshotEnabled] = useState<boolean>(false);
  const [snapshotDisbursed, setSnapshotDisbursed] = useState<number>(100000);
  const [snapshotOutstanding, setSnapshotOutstanding] = useState<number>(80000);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setContracts(getContracts());

    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setSearchTerm(customEvent.detail || '');
    };
    window.addEventListener('global-contract-search', handleGlobalSearch);
    return () => {
      window.removeEventListener('global-contract-search', handleGlobalSearch);
    };
  }, []);

  // Update payment frequency automatically if Product Type is Hire Purchase (HP)
  useEffect(() => {
    if (productType === 'HP') {
      setPaymentFrequency('MONTHLY');
      setServiceFee(0);
      setTreeCutOption(false);
    }
  }, [productType]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSnapshotEnabled) {
      if (Number(snapshotDisbursed) <= 0) {
        setFormError('ยอดเงินกู้เบิกรับจริงตั้งต้นต้องมากกว่า 0 บาท');
        return;
      }
      if (Number(snapshotOutstanding) > Number(snapshotDisbursed)) {
        setFormError('ยอดเงินต้นคงเหลือ ณ ปัจจุบัน ต้องไม่มากกว่ายอดเบิกรับจริงตั้งต้น');
        return;
      }
    }
    setFormError('');

    // Auto generate clean ID if empty
    const prefix = productType === 'HP' ? 'HP' : 'LN';
    const finalId = id.trim() || `${prefix}-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(4, '0')}`;

    addContract({
      id: finalId,
      customerName,
      customerTaxId,
      customerPhone,
      customerAddress,
      productType,
      creditLimit: Number(creditLimit),
      interestRate: Number(interestRate),
      startDate,
      firstDisburseDate: disburseDate || startDate,
      disburseDate: disburseDate || startDate,
      termMonths: Number(termMonths),
      dueDay,
      paymentFrequency,
      serviceFee: Number(serviceFee),
      treeCutOption,
      installmentAmount: installmentAmount !== '' ? Number(installmentAmount) : undefined,
      disbursedAmount: isSnapshotEnabled ? Number(snapshotDisbursed) : undefined,
      outstandingPrincipal: isSnapshotEnabled ? Number(snapshotOutstanding) : undefined,
      ...(productType === 'LOAN' && paymentFrequency === 'ANNUAL' ? {
        plantingType,
        plantingAreaRai: plantingAreaRai !== '' ? Number(plantingAreaRai) : undefined,
        plantingTreeCount: plantingTreeCount !== '' ? Number(plantingTreeCount) : undefined,
        plantingProvince,
        plantingDistrict,
        plantingSubdistrict,
      } : {})
    });

    // Reset list and close
    setContracts(getContracts());
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setId('');
    setCustomerName('');
    setCustomerTaxId('');
    setCustomerPhone('');
    setCustomerAddress('');
    setProductType('HP');
    setCreditLimit(100000);
    setInterestRate(8);
    setStartDate('2026-01-01');
    setDisburseDate('2026-01-01');
    setTermMonths(12);
    setInstallmentAmount('');
    setDueDay(5);
    setPaymentFrequency('MONTHLY');
    setServiceFee(0);
    setTreeCutOption(false);
    setPlantingType('RESERVE');
    setPlantingAreaRai('');
    setPlantingTreeCount('');
    setPlantingProvince('');
    setPlantingDistrict('');
    setPlantingSubdistrict('');
    setIsSnapshotEnabled(false);
    setSnapshotDisbursed(100000);
    setSnapshotOutstanding(80000);
    setFormError('');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = 'Contract ID,Customer Name,Tax ID,Phone,Product Type,Freq,Credit Limit,Rate %,Start Date,Disburse Date,Terms,Status\n';
    const rows = contracts.map(c => 
      `"${c.id}","${c.customerName}","${c.customerTaxId}","${c.customerPhone}","${c.productType}","${c.paymentFrequency}",${c.creditLimit},${c.interestRate},"${c.startDate}","${c.firstDisburseDate || c.disburseDate || c.startDate}",${c.termMonths},"${c.status}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LMS_Contracts_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncDailyAccrued = async () => {
    setIsSyncingDaily(true);
    try {
      const client = getSupabaseClient();
      const count = await generateAndSyncDailyAccruedToSupabase(client);
      setSyncMessage(`คำนวณดอกเบี้ยค้างรับสะสม (Accrued Interest) สำหรับทุกสัญญา และบันทึกลงตาราง Scheduled Payments เรียบร้อยแล้ว รวม ${count} งวดสัญญา`);
      setTimeout(() => setSyncMessage(null), 8000);
    } catch (err: any) {
      setSyncMessage(`เกิดข้อผิดพลาดในการคำนวณบันทึกดอกเบี้ย: ${err?.message || err}`);
    } finally {
      setIsSyncingDaily(false);
    }
  };

  const handleClearAccrued = async () => {
    setIsSyncingDaily(true);
    try {
      const client = getSupabaseClient();
      const count = await clearAccruedInterestInSupabaseAndLocal(client);
      setSyncMessage(`เคลียร์ค่า accrued_interest ในตาราง scheduled_payments บน Supabase และ Local Storage ให้เป็น 0 เรียบร้อยแล้ว (รวม ${count} งวด)`);
      setTimeout(() => setSyncMessage(null), 8000);
    } catch (err: any) {
      setSyncMessage(`เกิดข้อผิดพลาดในการเคลียร์ค่า: ${err?.message || err}`);
    } finally {
      setIsSyncingDaily(false);
    }
  };

  // Format currencies
  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val);
  };

  // Filter lists
  const filteredContracts = contracts.filter(c => {
    const matchesId = c.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesName = c.customerName.toLowerCase().includes(searchName.toLowerCase());
    return matchesId && matchesName;
  });

  return (
    <div className="space-y-6 font-sans">
      {syncMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Search and Action Bar */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่สัญญา (Contract ID)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อลูกค้า..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncDailyAccrued}
            disabled={isSyncingDaily}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSyncingDaily ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>⚡ Run ดอกเบี้ยย้อนหลัง & บันทึกลง Supabase</span>
          </button>

          <button
            onClick={handleClearAccrued}
            disabled={isSyncingDaily}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSyncingDaily ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>🗑️ เคลียร์ accrued_interest เป็น 0 (Supabase)</span>
          </button>

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
            <span>สร้างสัญญาใหม่</span>
          </button>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">สัญญาเงินกู้และเช่าซื้อรายปี/รายเดือน ทั้งหมดในระบบ</h3>
          <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 font-mono">แสดงผล {filteredContracts.length} สัญญา</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">เลขที่สัญญา</th>
                <th className="p-4 font-sans">ผู้กู้ / ลูกค้า</th>
                <th className="p-4">ประเภทผลิตภัณฑ์</th>
                <th className="p-4">ความถี่การส่ง</th>
                <th className="p-4 text-right">วงเงินอนุมัติ</th>
                <th className="p-4 text-right">ยอดเบิกใช้แล้ว</th>
                <th className="p-4 text-right">เงินต้นคงเหลือ</th>
                <th className="p-4 text-center">อัตราดอกเบี้ย</th>
                <th className="p-4 text-center">วันครบดิว</th>
                <th className="p-4 text-center">สถานะ</th>
                <th className="p-4 text-center">เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 font-sans">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-sans">
                    ไม่พบข้อมูลสัญญาใดๆ ในตารางขณะนี้ ทดลองกดปุ่มเพื่อสร้างสัญญาใหม่
                  </td>
                </tr>
              ) : (
                filteredContracts.map(con => (
                  <tr key={con.id} className="hover:bg-slate-50/40 transition">
                    <td className="p-4 font-mono font-bold text-sky-600 uppercase tracking-wider">{con.id}</td>
                    <td className="p-4">
                      <div>
                        <span className="font-semibold text-slate-800 block text-[13px]">{con.customerName}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Tax ID: {con.customerTaxId || '-'} • โทร: {con.customerPhone || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${con.productType === 'HP' ? 'bg-indigo-50 text-sky-700 border border-indigo-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                        {con.productType === 'HP' ? 'เช่าซื้อ (HP)' : 'เงินกู้สามัญ'}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-slate-500">{con.paymentFrequency === 'ANNUAL' ? 'รายปี (กลุ่มปลูก)' : 'รายเดือนปกติ'}</td>
                    <td className="p-4 text-right font-mono font-semibold text-slate-800">{formatThb(con.creditLimit)}</td>
                    <td className="p-4 text-right font-mono font-semibold text-emerald-600">{formatThb(con.disbursedAmount)}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800 bg-slate-50/20">{formatThb(con.outstandingPrincipal)}</td>
                    <td className="p-4 text-center font-bold text-sky-600 font-mono">{con.interestRate}% <span className="text-[10px] text-slate-400 block font-normal font-sans">ต่อปี</span></td>
                    <td className="p-4 text-center font-medium font-sans">ทุกวันที่ {con.dueDay}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-extrabold ${con.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : con.status === 'DEFAULT' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'}`}>
                        {con.status === 'ACTIVE' ? 'ปกติ (ACTIVE)' : con.status === 'DEFAULT' ? 'ผิดนัดชำระ (DEFAULT)' : 'ปิดยอดแล้ว (CLOSED)'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedConForDetail(con);
                          setIsDetailOpen(true);
                        }}
                        className="px-3 py-1.5 bg-sky-600 font-bold text-white hover:bg-sky-700 rounded-lg text-[10px] transition cursor-pointer shadow-xs"
                      >
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto w-full h-full font-sans">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] border border-slate-100 animate-fade-in">
            <div className="px-6 py-4 border-b border-sky-100 bg-sky-600 rounded-t-xl text-white flex justify-between items-center">
              <div className="flex items-center space-x-2 font-mono">
                <Plus className="w-5 h-5 text-sky-105" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">สร้างและจดทะเบียนสัญญาสินเชื่อใหม่</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/10 rounded-full p-1 transition cursor-pointer text-sm w-7 h-7 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Product selector */}
              <div className="grid grid-cols-2 gap-4">
                <label className="border border-slate-200 p-3.5 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-50 transition">
                  <div>
                    <span className="font-extrabold text-xs text-slate-800 block">สินเชื่อเช่าซื้อรถ/เครื่องจักร (HP)</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">มี VAT 7% • จ่ายรายเดือน มีดิว 5, 15, 25</span>
                  </div>
                  <input
                    type="radio"
                    name="product_type_select"
                    checked={productType === 'HP'}
                    onChange={() => setProductType('HP')}
                    className="w-4 h-4 text-sky-600 accent-sky-600"
                  />
                </label>

                <label className="border border-slate-200 p-3.5 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-50 transition">
                  <div>
                    <span className="font-extrabold text-xs text-slate-800 block">สินเชื่อเงินกู้ทั่วไป (LOAN)</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">ไม่มี VAT ดอกเบี้ย • มีรายเดือน หรือรายปี</span>
                  </div>
                  <input
                    type="radio"
                    name="product_type_select"
                    checked={productType === 'LOAN'}
                    onChange={() => setProductType('LOAN')}
                    className="w-4 h-4 text-sky-600 accent-sky-600"
                  />
                </label>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-650 font-bold mb-1">เลขที่สัญญา (ปล่อยว่างเพื่อ Auto-generate)</label>
                  <input
                    type="text"
                    placeholder="เช่น LN-2026-0001"
                    value={id}
                    onChange={e => setId(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 uppercase font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-650 font-bold mb-1">ชื่อผู้กู้ / ลูกค้า (Customer Name) *</label>
                  <input
                    type="text"
                    required
                    placeholder="กรอกชื่อ-นามสกุล บุคคลหรือวิสาหกิจ"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-650 font-bold mb-1">เลขผู้เสียภาษี (Tax ID / นิติบุคคล) *</label>
                  <input
                    type="text"
                    required
                    maxLength={13}
                    placeholder="กรอกเลขผู้เสียภาษี 13 หลัก"
                    value={customerTaxId}
                    onChange={e => setCustomerTaxId(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-650 font-bold mb-1">เบอร์โทรศัพท์ติดต่อ</label>
                  <input
                    type="text"
                    placeholder="เช่น 081-xxxxxxx"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-650 font-bold mb-1">ที่อยู่สำหรับติดต่อและออกเอกสาร / ใบเสร็จ (Customer Address)</label>
                <textarea
                  placeholder="กรอกที่อยู่จัดส่งเอกสารและใบแจ้งหนี้แบบสมบูรณ์"
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 p-2.5 bg-slate-50/50 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 font-sans font-semibold text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-650 font-bold mb-1">วงเงินกู้สูงสุด (Credit Limit) *</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={creditLimit}
                    onChange={e => setCreditLimit(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-bold font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-650 font-bold mb-1">อัตราดอกเบี้ยต่อปี (%) *</label>
                  <input
                    type="number"
                    required
                    min={0.1}
                    max={28}
                    step={0.01}
                    value={interestRate}
                    onChange={e => setInterestRate(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-bold font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-650 font-bold mb-1">ระยะเวลาผ่อน (งวด / เดือน) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={termMonths}
                    onChange={e => setTermMonths(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-bold font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-650 font-bold mb-1">ค่างวดผ่อนชำระ (Installment)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="ระบุค่างวดผ่อนชำระ"
                    value={installmentAmount}
                    onChange={e => setInstallmentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-bold font-mono text-emerald-700 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-650 font-bold mb-1">วันที่ทำสัญญา (Contract Date) *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => {
                      const newStart = e.target.value;
                      setStartDate(newStart);
                      if (disburseDate === startDate || !disburseDate) {
                        setDisburseDate(newStart);
                      }
                    }}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-mono font-medium text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">วันที่เริ่มทำสัญญา / เซ็นสัญญา</p>
                </div>

                <div>
                  <label className="block text-emerald-700 font-bold mb-1">วันเบิกเงินครั้งแรก (Disburse Date) *</label>
                  <input
                    type="date"
                    required
                    value={disburseDate}
                    onChange={e => setDisburseDate(e.target.value)}
                    className="w-full border border-emerald-300 p-2.5 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 bg-emerald-50/30 font-mono font-bold text-emerald-800"
                  />
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">*ดอกเบี้ยของงวดแรกเริ่มคำนวณจาก Disburse Date นี้</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-650 font-bold mb-1">กำหนด Due Date *</label>
                  <select
                    value={dueDay}
                    onChange={e => setDueDay(Number(e.target.value) as 5 | 15 | 25)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-bold text-slate-700 font-sans"
                  >
                    <option value={5}>ทุกวันที่ 5</option>
                    <option value={15}>ทุกวันที่ 15</option>
                    <option value={25}>ทุกวันที่ 25</option>
                  </select>
                </div>

                {productType === 'LOAN' && (
                  <div>
                    <label className="block text-slate-650 font-bold mb-1">ความถี่ผ่อนชำระ *</label>
                    <select
                      value={paymentFrequency}
                      onChange={e => setPaymentFrequency(e.target.value as PaymentFrequency)}
                      className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 font-bold text-slate-700 font-sans"
                    >
                      <option value="MONTHLY">รายเดือนปกติ</option>
                      <option value="ANNUAL">รายปี (กลุ่มปลูกป่าเศรษฐกิจ)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Conditional options for PLOOK (กลุ่มปลูก) */}
              {productType === 'LOAN' && paymentFrequency === 'ANNUAL' && (
                <div className="bg-sky-50/20 p-4 rounded-xl border border-sky-100/50 space-y-4 text-xs font-sans">
                  <h4 className="font-extrabold text-[#1463F3] flex items-center mb-1">
                    <HelpCircle className="w-4 h-4 mr-1 text-inherit" />
                    รายละเอียดเพิ่มเติมสำหรับการกู้ &ldquo;กลุ่มปลูกป่า&rdquo; (PLOOK Details)
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">ประเภทกลุ่มปลูก *</label>
                      <select
                        required
                        value={plantingType}
                        onChange={e => setPlantingType(e.target.value as 'RESERVE' | 'NON_RESERVE')}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-white text-slate-800 font-bold font-sans"
                      >
                        <option value="RESERVE">Reserve (รับพันธสัญญาพิเศษ)</option>
                        <option value="NON_RESERVE">Non-Reserve (ปกติ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">จำนวนพื้นที่ปลูก (ไร่) *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="จำนวนไร่ เช่น 15"
                        value={plantingAreaRai}
                        onChange={e => setPlantingAreaRai(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-white text-slate-800 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">จำนวนต้นที่ปลูก *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="จำนวนต้น เช่น 3000"
                        value={plantingTreeCount}
                        onChange={e => setPlantingTreeCount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-white text-slate-800 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">จังหวัด *</label>
                      <input
                        type="text"
                        required
                        placeholder="จังหวัด เช่น ลพบุรี"
                        value={plantingProvince}
                        onChange={e => setPlantingProvince(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-white text-slate-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">อำเภอ *</label>
                      <input
                        type="text"
                        required
                        placeholder="อำเภอ เช่น พัฒนานิคม"
                        value={plantingDistrict}
                        onChange={e => setPlantingDistrict(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-white text-slate-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">ตำบล *</label>
                      <input
                        type="text"
                        required
                        placeholder="ตำบล เช่น ดีลัง"
                        value={plantingSubdistrict}
                        onChange={e => setPlantingSubdistrict(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-white text-slate-800 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-sky-100/30 pt-3">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">ค่าธรรมเนียมบริการเบิกจ่ายรายปี (THB)</label>
                      <input
                        type="number"
                        placeholder="เช่น 500"
                        value={serviceFee}
                        onChange={e => setServiceFee(Number(e.target.value))}
                        className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-white text-slate-800 font-mono font-medium"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="treeCut"
                        checked={treeCutOption}
                        onChange={e => setTreeCutOption(e.target.checked)}
                        className="w-4 h-4 text-sky-600 accent-sky-600 cursor-pointer"
                      />
                      <label htmlFor="treeCut" className="text-slate-600 font-bold cursor-pointer select-none">
                        เพิ่มสิทธิ์เบิกค่าจัดตัดจ่ายไม้ (4,000 บาท ปี 3-5)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Snapshot/Migration carrying section */}
              <div className="bg-amber-50/20 p-4 rounded-xl border border-amber-100/50 space-y-3 text-xs font-sans">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isSnapshotEnabled"
                    checked={isSnapshotEnabled}
                    onChange={e => setIsSnapshotEnabled(e.target.checked)}
                    className="w-4 h-4 text-amber-600 accent-amber-600 cursor-pointer"
                  />
                  <label htmlFor="isSnapshotEnabled" className="text-slate-700 font-extrabold cursor-pointer select-none flex items-center">
                    <span>ระบุยอดยกยอดมา (สำหรับสัญญานำเข้าระบบ / Migration Snapshot)</span>
                  </label>
                </div>
                
                {isSnapshotEnabled && (
                  <div className="space-y-3 pt-1">
                    <p className="text-[10px] text-amber-850 bg-amber-50 p-2.5 rounded border border-amber-100 leading-relaxed font-sans">
                      💡 <strong>สำหรับการโอนย้ายพอร์ตสัญญา:</strong> ระบบจะใช้ <strong>ยอดเงินเบิกรับสะสมต้นทาง</strong> ในการสร้างตารางค่างวดผ่อนชำระดั้งเดิม และเทียบกับ <strong>ยอดเงินต้นคงเหลือปัจจุบัน</strong> เพื่อทำเครื่องหมายชำระเงินงวดก่อนหน้าให้เป็นสถานะ <strong>ชำระแล้ว (PAID)</strong> อัตโนมัติ เพื่อให้พอร์ตสัญญาตรงกับความจริงและคำนวณดอกเบี้ยล่วงหน้าสำหรับงวดที่เหลือได้อย่างถูกต้อง
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-650 font-bold mb-1">ยอดเงินกู้เบิกรับสะสมต้นทาง (Original Disbursed Amount) *</label>
                        <input
                          type="number"
                          required={isSnapshotEnabled}
                          min={1}
                          value={snapshotDisbursed}
                          onChange={e => setSnapshotDisbursed(Number(e.target.value))}
                          className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 bg-white font-bold font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-650 font-bold mb-1">ยอดเงินต้นคงเหลือยกยอดมาปัจจุบัน (Outstanding Principal) *</label>
                        <input
                          type="number"
                          required={isSnapshotEnabled}
                          min={0}
                          value={snapshotOutstanding}
                          onChange={e => setSnapshotOutstanding(Number(e.target.value))}
                          className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 bg-white font-bold font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 font-bold font-sans">
                  ⚠️ {formError}
                </div>
              )}

              {/* Notice row */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 leading-normal leading-relaxed">
                💡 <strong>ข้อแนะนำ:</strong> สัญญาประเภท **เช่าซื้อ (HP)** จะทำการอนุมัติสั่งจ่าย (Disbursement) เต็มจำนวนวงเงินทันที ณ วันทำสัญญา เพื่อให้พอร์ตและตารางค่างวดคำนวณภาษีมูลค่าเพิ่มได้อย่างสมบูรณ์
              </div>

              {/* Action row */}
              <div className="flex justify-end space-x-3 border-t border-slate-150 pt-5 font-sans">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4.5 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-600 text-white rounded-lg font-bold hover:bg-sky-700 cursor-pointer transition shadow-xs"
                >
                  บันทึกจดทะเบียนสัญญา
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Contract Detail Modal */}
      {selectedConForDetail && (
        <ContractDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedConForDetail(null);
          }}
          contract={selectedConForDetail}
        />
      )}
    </div>
  );
}
