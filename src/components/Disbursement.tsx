import React, { useState, useEffect } from 'react';
import { getDisbursements, getContracts, disburseContract } from '../dbStore';
import { Disbursement as DisbursementType, Contract } from '../types';
import { Search, Plus, Download, FileSpreadsheet, ArrowUpRight, CheckCircle2, DollarSign, Calendar, CreditCard } from 'lucide-react';

export default function Disbursement() {
  const [disbursements, setDisbursements] = useState<DisbursementType[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedContractId, setSelectedContractId] = useState('');
  const [amount, setAmount] = useState<number>(2000);
  const [disburseDate, setDisburseDate] = useState('2026-05-22');
  const [description, setDescription] = useState('');

  // Loaded contract detail for guidance
  const [activeContractDetail, setActiveContractDetail] = useState<Contract | null>(null);

  useEffect(() => {
    setDisbursements(getDisbursements());
    setContracts(getContracts());
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
    setDisburseDate('2026-05-22');
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

  return (
    <div className="space-y-6">
      {/* Search Bar & Action Trigger */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="กรอกเลขที่สัญญาเพื่อค้นหา..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อลูกค้าลูกหนี้..."
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
            <span>เบิกจ่ายสั่งจ่ายวงเงิน</span>
          </button>
        </div>
      </div>

      {/* History Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">ประวัติรายรอบการสั่งจ่ายเบิกสุทธิ (Disbursement Ledger Transactions)</h3>
          <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-1 rounded border">รวม {filteredDisb.length} คอร์สสั่งจ่าย</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">รหัสทำรายการ</th>
                <th className="p-4">เลขที่สัญญา</th>
                <th className="p-4">ชื่อลูกค้า</th>
                <th className="p-4">งวดสั่งจ่าย</th>
                <th className="p-4 text-center">วันที่เบิกจ่าย</th>
                <th className="p-4 text-right header-num">จำนวนเบิกตามสัญญา (Gross)</th>
                <th className="p-4 text-right header-num">หักดอกเบี้ยล่วงหน้า (Prepaid Int)</th>
                <th className="p-4 text-right header-num">หักค่าธรรมเนียม (Prepaid Fee)</th>
                <th className="p-4 text-right header-num text-[#25348D]">โอนเน็ตที่ลูกค้าได้รับ (Net)</th>
                <th className="p-4">บันทึกหมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredDisb.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    ไม่พบข้อมูลธุรกรรมการเบิกจ่ายที่เลือกในระบบ ณ ขณะนี้
                  </td>
                </tr>
              ) : (
                filteredDisb.map(d => {
                  const parent = contracts.find(c => c.id === d.contractId);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/40 transition">
                      <td className="p-4 font-mono font-bold text-slate-400">{d.id}</td>
                      <td className="p-4 font-mono font-bold text-[#213F9A] uppercase tracking-wider">{d.contractId}</td>
                      <td className="p-4 font-semibold text-slate-800">{parent ? parent.customerName : 'N/A'}</td>
                      <td className="p-4 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">งวดที่ {d.batchNumber}</span>
                      </td>
                      <td className="p-4 text-center font-mono font-medium pr-4">{d.disburseDate}</td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-700">{formatThb(Number(d.amount))}</td>
                      <td className="p-4 text-right font-mono font-medium text-rose-500">
                        {d.upfrontInterest > 0 ? `-${formatThb(d.upfrontInterest)}` : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-medium text-rose-500">
                        {d.upfrontFee > 0 ? `-${formatThb(d.upfrontFee)}` : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-[#25348D]">{formatThb(d.netReceived)}</td>
                      <td className="p-4 text-slate-500 italic max-w-xs truncate">{d.description || '-'}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-[#25348D] rounded-t-xl text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ArrowUpRight className="w-5 h-5 text-[#41C3DB]" />
                <h3 className="font-semibold text-base">ทำรายการใบเบิกจ่ายสั่งใช้วงเงินสัญญา</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white/10 rounded p-1 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">เลือกสัญญาที่ได้รับอนุมัติ *</label>
                <select
                  required
                  value={selectedContractId}
                  onChange={e => setSelectedContractId(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50 font-bold"
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
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 space-y-1.5">
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
                  <div className="flex justify-between text-[#25348D] font-bold border-t border-slate-200 pt-1.5 mt-1.5">
                    <span>งวดเบิกถัดไปที่จะบันทึก:</span>
                    <span>งวดที่ {getBatchNumSuggestion(activeContractDetail.id)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">จำนวนเงินที่เบิกจ่าย (THB) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    max={activeContractDetail ? (activeContractDetail.creditLimit - activeContractDetail.disbursedAmount) : undefined}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">วันที่ทำเบิก (DisburseDate) *</label>
                  <input
                    type="date"
                    required
                    value={disburseDate}
                    onChange={e => setDisburseDate(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">รายละเอียดและหมายเหตุความเห็น *</label>
                <textarea
                  placeholder="วัตถุประสงค์การใช้เงินกู้ยืมงวดนี้..."
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50"
                ></textarea>
              </div>

              {activeContractDetail?.paymentFrequency === 'ANNUAL' && (
                <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-[10px] leading-relaxed">
                  💡 <strong>เงื่อนไขการหักลบ:</strong> ระบบ LMS จะหักภาษีดอกเบี้ยล่วงหน้า 1 ปี (Prepaid Interest) ของยอดสั่งกู้ก้อนนี้โดยอัตโนมัติ พร้อมค่าธรรมเนียมสัดส่วน โดยเงินโอนเน็ตที่ลูกค้าเข้าบัญชีจะน้อยลงตามสูตรกลุ่มปลูก
                </div>
              )}

              <div className="flex justify-end space-x-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4.5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#25348D] text-white rounded-lg text-xs font-semibold hover:bg-[#213F9A] transition cursor-pointer shadow"
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
