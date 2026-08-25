import React, { useState, useEffect } from 'react';
import { getDisbursements, getContracts, disburseContract, getSystemDate, getScheduledPayments } from '../dbStore';
import { Disbursement as DisbursementType, Contract, ScheduledPayment } from '../types';
import { Search, Plus, Download, ArrowUpRight, AlertCircle } from 'lucide-react';
import { addMonths } from '../financialEngine';

export default function Disbursement() {
  const [disbursements, setDisbursements] = useState<DisbursementType[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedContractId, setSelectedContractId] = useState('');
  const [amount, setAmount] = useState<number>(2000);
  const [disburseDate, setDisburseDate] = useState(getSystemDate());
  const [description, setDescription] = useState('');

  // Loaded contract detail for guidance
  const [activeContractDetail, setActiveContractDetail] = useState<Contract | null>(null);

  useEffect(() => {
    setDisbursements(getDisbursements());
    setContracts(getContracts());
    setSchedules(getScheduledPayments());
  }, []);

  useEffect(() => {
    const found = contracts.find(c => c.id === selectedContractId);
    setActiveContractDetail(found || null);
    if (found) {
      // Prompt suggested parameters based on remaining limits
      const remainingLimit = found.creditLimit - found.disbursedAmount;
      if (found.productType === 'HP') {
        setAmount(remainingLimit);
      } else {
        setAmount(Math.min(2000, remainingLimit));
      }
    }
  }, [selectedContractId, contracts]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedContractId) return;

    const added = disburseContract(
      selectedContractId,
      Number(amount),
      disburseDate,
      description || `สั่งจ่ายเบิกใช้วงเงินตามดิวสัญญา (${disburseDate})`
    );

    if (added) {
      setDisbursements(getDisbursements());
      setContracts(getContracts());
      setIsModalOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedContractId('');
    setAmount(2000);
    setDescription('');
    setDisburseDate(getSystemDate());
  };

  const handleExportCSV = () => {
    const headers = 'Disbursement ID,Contract ID,Customer Name,Date,Batch No.,Gross Amount,Prepaid Interest,Prepaid Fee,Net Received,Description\n';
    const rows = disbursements.map(d => {
      const parent = contracts.find(c => c.id === d.contractId);
      const name = parent ? parent.customerName : 'N/A';
      return `"${d.id}","${d.contractId}","${name}","${d.disburseDate}",${d.batchNumber},${d.amount},${d.upfrontInterest},${d.upfrontFee},${d.netReceived},"${d.description}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LMS_Disbursements_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  // Filters
  const filteredDisb = disbursements.filter(d => {
    const parent = contracts.find(c => c.id === d.contractId);
    const matchesId = d.contractId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesName = parent ? parent.customerName.toLowerCase().includes(searchName.toLowerCase()) : false;
    
    return (searchTerm ? matchesId : true) && (searchName ? matchesName : true);
  });

  // Calculate next potential batch index for selection
  const getBatchNumSuggestion = (conId: string) => {
    const prevs = disbursements.filter(d => d.contractId === conId).length;
    return prevs + 1;
  };

  const systemDate = getSystemDate();
  const threeMonthsFromNow = addMonths(systemDate, 3);

  const pendingSchedules = schedules.filter(s => {
    if (!s.pendingDisbursement || s.pendingDisbursement <= 0) return false;
    if (!s.dueDate) return true; // Show if no due date set yet
    return s.dueDate <= threeMonthsFromNow;
  });

  return (
    <div className="space-y-6">
      {/* Search Bar & Action Trigger */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="กรอกเลขที่สัญญาเพื่อค้นหา..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 bg-slate-50/50 transition font-sans"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อลูกค้าลูกหนี้..."
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
            <span>เบิกจ่ายสั่งจ่ายวงเงิน</span>
          </button>
        </div>
      </div>

      {/* Pending Disbursements Table */}
      {pendingSchedules.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4.5 border-b border-amber-100 bg-amber-50/50 flex justify-between items-center">
            <h3 className="font-extrabold text-amber-800 text-xs uppercase tracking-wider font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> รายการรอเบิกจ่าย (Pending Disbursements)
            </h3>
            <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 font-mono">
              รวม {pendingSchedules.length} รายการ
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-amber-50/30 border-b border-amber-100 text-amber-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-3 py-3 border-r border-amber-100/50">เลขที่สัญญา</th>
                  <th className="px-3 py-3 font-sans border-r border-amber-100/50">ชื่อลูกค้า</th>
                  <th className="px-3 py-3 text-center border-r border-amber-100/50">งวดที่</th>
                  <th className="px-3 py-3 text-center border-r border-amber-100/50">กำหนดรับเงิน</th>
                  <th className="px-3 py-3 text-right header-num">ยอดรอเบิก (THB)</th>
                  <th className="px-3 py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/50 text-slate-650 font-sans">
                {pendingSchedules.map(sch => {
                  const parent = contracts.find(c => c.id === sch.contractId);
                  // Hide if contract is closed
                  if (parent?.status === 'CLOSED') return null;
                  
                  return (
                    <tr key={sch.id} className="hover:bg-amber-50/40 transition">
                      <td className="px-3 py-2.5 font-mono font-bold text-amber-700 uppercase tracking-wider border-r border-amber-100/50">{sch.contractId}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800 border-r border-amber-100/50">{parent ? parent.customerName : 'N/A'}</td>
                      <td className="px-3 py-2.5 text-center border-r border-amber-100/50">
                        <span className="bg-amber-100/50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded font-mono font-bold text-[10px]">{sch.termNumber}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-semibold text-amber-700 border-r border-amber-100/50">
                        {sch.dueDate ? new Date(sch.dueDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700 border-r border-amber-100/50">{formatThb(sch.pendingDisbursement || 0)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button 
                          onClick={() => {
                            setSelectedContractId(sch.contractId);
                            setAmount(sch.pendingDisbursement || 0);
                            setIsModalOpen(true);
                          }}
                          className="text-[10px] bg-sky-600 text-white px-3 py-1.5 rounded font-bold hover:bg-sky-700 transition"
                        >
                          ทำรายการเบิก
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4.5 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">ประวัติรายรอบการสั่งจ่ายเบิกสุทธิ (Disbursement Ledger)</h3>
          <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 font-mono">รวม {filteredDisb.length} คอร์สสั่งจ่าย</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-3 py-3 border-r border-slate-200/30">รหัสทำรายการ</th>
                <th className="px-3 py-3 border-r border-slate-200/30">เลขที่สัญญา</th>
                <th className="px-3 py-3 font-sans border-r border-slate-200/30">ชื่อลูกค้า</th>
                <th className="px-3 py-3 text-center border-r border-slate-200/30">งวดสั่งจ่าย</th>
                <th className="px-3 py-3 text-center border-r border-slate-200/30">วันที่เบิกจ่าย</th>
                <th className="px-3 py-3 text-right header-num border-r border-slate-200/30">จำนวนเบิกตามสัญญา (Gross)</th>
                <th className="px-3 py-3 text-right header-num border-r border-slate-200/30">หักดอกเบี้ยล่วงหน้า</th>
                <th className="px-3 py-3 text-right header-num border-r border-slate-200/30">หักค่าธรรมเนียม</th>
                <th className="px-3 py-3 text-right bg-sky-50/40 text-sky-700 border-r border-slate-200/30 font-bold">โอนสุทธิ (Net Client)</th>
                <th className="px-3 py-3 w-44 max-w-[170px]">บันทึกหมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-650 font-sans">
              {filteredDisb.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">
                    ไม่พบข้อมูลธุรกรรมการเบิกจ่ายที่เลือกในระบบ ณ ขณะนี้
                  </td>
                </tr>
              ) : (
                filteredDisb.map(d => {
                  const parent = contracts.find(c => c.id === d.contractId);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/55 transition border-b border-slate-100 last:border-0 hover:text-slate-900">
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-400 border-r border-slate-100/40">{d.id}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-sky-600 uppercase tracking-wider border-r border-slate-100/40">{d.contractId}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800 border-r border-slate-100/40">{parent ? parent.customerName : 'N/A'}</td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-100/40">
                        <span className="bg-sky-50/70 text-sky-700 border border-sky-100/40 px-2 py-0.5 rounded font-mono font-bold text-[10px]">งวดที่ {d.batchNumber}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-medium text-slate-500 border-r border-slate-100/40">{d.disburseDate}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700 border-r border-slate-100/40">{formatThb(Number(d.amount))}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-rose-500 border-r border-slate-100/40">
                        {d.upfrontInterest > 0 ? `-${formatThb(d.upfrontInterest)}` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-rose-500 border-r border-slate-100/40">
                        {d.upfrontFee > 0 ? `-${formatThb(d.upfrontFee)}` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-sky-700 bg-sky-50/20 border-r border-slate-100/40">{formatThb(d.netReceived)}</td>
                      <td className="px-3 py-2.5 text-slate-500 italic max-w-[170px] truncate" title={d.description || '-'}>
                        {d.description || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col animate-fade-in border border-slate-100">
            <div className="px-6 py-4 border-b border-sky-100 bg-sky-600 rounded-t-xl text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ArrowUpRight className="w-5 h-5 text-sky-100" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide font-mono">ทำรายการใบเบิกจ่ายสั่งใช้วงเงินสัญญา</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/10 rounded-full p-1 transition cursor-pointer text-sm w-7 h-7 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5 text-xs font-sans">
              <div>
                <label className="block text-slate-600 font-bold mb-1">เลือกสัญญาที่ได้รับอนุมัติ *</label>
                <select
                  required
                  value={selectedContractId}
                  onChange={e => setSelectedContractId(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50 font-bold text-slate-800"
                >
                  <option value="">-- เลือกสัญญาเพื่อทำเบิกจ่าย --</option>
                  {contracts
                    .filter(c => c.status !== 'CLOSED')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.id}] {c.customerName} (วงเงินที่กู้ได้คงเหลือ: {formatThb(c.creditLimit - c.disbursedAmount)})
                      </option>
                    ))}
                </select>
              </div>

              {activeContractDetail && (
                <div className="bg-sky-50/30 p-4 rounded-lg border border-sky-100/50 space-y-1.5 font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ประเภทวงเงินกู้:</span>
                    <strong className="text-slate-700">{activeContractDetail.productType === 'HP' ? 'เช่าซื้อ (ขนส่ง/ VAT 7%)' : 'เงินกู้สามัญ'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ความถี่ผ่อนส่งค่างวด:</span>
                    <strong className="text-slate-700">{activeContractDetail.paymentFrequency === 'ANNUAL' ? 'รายปี (กลุ่มปลูกป่า)' : 'รายเดือนปกติ'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ยอดเบิกจ่ายเดิม:</span>
                    <strong className="text-slate-700">{formatThb(activeContractDetail.disbursedAmount)} / {formatThb(activeContractDetail.creditLimit)}</strong>
                  </div>
                  <div className="flex justify-between text-sky-700 font-bold border-t border-sky-100 pt-1.5 mt-1.5 font-mono">
                    <span>งวดเบิกถัดไปที่จะบันทึก:</span>
                    <span className="text-sky-600">งวดที่ {getBatchNumSuggestion(activeContractDetail.id)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">จำนวนเงินที่เบิกจ่าย (THB) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    max={activeContractDetail ? (activeContractDetail.creditLimit - activeContractDetail.disbursedAmount) : undefined}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50 font-bold text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">วันที่ทำเบิก (DisburseDate) *</label>
                  <input
                    type="date"
                    required
                    value={disburseDate}
                    onChange={e => setDisburseDate(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50 font-semibold font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">รายละเอียดและหมายเหตุความเห็น *</label>
                <textarea
                  placeholder="วัตถุประสงค์การใช้เงินกู้ยืมงวดนี้..."
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50"
                ></textarea>
              </div>

              {activeContractDetail?.paymentFrequency === 'ANNUAL' && (
                <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-[10px] leading-relaxed">
                  💡 <strong>เงื่อนไขการหักลบ:</strong> ระบบ LMS จะหักภาษีดอกเบี้ยล่วงหน้า 1 ปี (Prepaid Interest) ของยอดสั่งกู้ก้อนนี้โดยอัตโนมัติ พร้อมค่าธรรมเนียมสัดส่วน โดยเงินโอนเน็ตที่ลูกค้าเข้าบัญชีจะน้อยลงตามสูตรกลุ่มปลูก
                </div>
              )}

              <div className="flex justify-end space-x-3 border-t border-slate-150 pt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sky-600 text-white rounded-lg font-bold hover:bg-sky-700 transition cursor-pointer shadow-xs"
                >
                  ยืนยันโอนเงินสั่งจ่าย (Disburse)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
