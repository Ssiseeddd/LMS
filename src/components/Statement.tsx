import React, { useState, useEffect } from 'react';
import { getScheduledPayments, getContracts } from '../dbStore';
import { ScheduledPayment, Contract, StatementStatus } from '../types';
import { Search, Printer, FileText, CheckCircle, AlertTriangle, Clock, PlayCircle } from 'lucide-react';
import DocViewerModal from './DocViewerModal';

export default function Statement() {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  // Search parameters
  const [searchContract, setSearchContract] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatementStatus | 'ALL'>('ALL');
  const [searchDueDate, setSearchDueDate] = useState('');

  // Modal Doc states
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledPayment | undefined>(undefined);

  useEffect(() => {
    setPayments(getScheduledPayments());
    setContracts(getContracts());
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

  // Filter schedules
  const filteredSchedules = payments.filter(s => {
    const parent = contracts.find(c => c.id === s.contractId);
    const parentName = parent ? parent.customerName.toLowerCase() : '';
    
    const matchesContract = s.contractId.toLowerCase().includes(searchContract.toLowerCase());
    const matchesCustomer = parentName.includes(searchCustomer.toLowerCase());
    const matchesStatus = selectedStatus === 'ALL' ? true : s.status === selectedStatus;
    const matchesDueDate = searchDueDate ? s.dueDate === searchDueDate : true;

    return matchesContract && matchesCustomer && matchesStatus && matchesDueDate;
  });

  return (
    <div className="space-y-6">
      {/* Search Filter Panel */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="font-bold text-[#25348D] text-sm">ค้นหาข้อมูลเรียกเก็บตามดิวสัญญา (Statement Bills Filter)</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">เลขที่สัญญา</label>
            <input
              type="text"
              placeholder="กรองเลขที่สัญญา..."
              value={searchContract}
              onChange={e => setSearchContract(e.target.value)}
              className="w-full border border-slate-200 p-2 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">ชื่อสมาชิกลูกหนี้</label>
            <input
              type="text"
              placeholder="กรองชื่อลูกค้านักปลูก..."
              value={searchCustomer}
              onChange={e => setSearchCustomer(e.target.value)}
              className="w-full border border-slate-200 p-2 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">สถานะเรียกเก็บ</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value as StatementStatus | 'ALL')}
              className="w-full border border-slate-200 p-2 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">แสดงทั้งหมด (All States)</option>
              <option value="NOT_PAID">รอดำเนินการ (Not Paid)</option>
              <option value="PARTIAL">ค้างเหลือจ่ายบางส่วน (Partial)</option>
              <option value="PAID">ชำระครบกำหนด (Paid)</option>
              <option value="OVERDUE">เลยกำหนดค้างชำระ (Overdue)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">วันที่ครบ Due Date</label>
            <input
              type="date"
              value={searchDueDate}
              onChange={e => setSearchDueDate(e.target.value)}
              className="w-full border border-slate-200 p-2 rounded-lg focus:outline-none focus:border-[#213F9A] bg-slate-50/50"
            />
          </div>
        </div>
      </div>

      {/* Dues Listings Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs">
          <div>
            <h4 className="font-bold text-slate-800 text-sm">รายการค่างวดเรียกชำระ (Statement Active Billings)</h4>
            <p className="text-slate-400 mt-1">ยอดค่างวดแสดงขึ้นอัตราล่วงหน้า 15 วันก่อนถึงกำหนดดิวแต่ละงวด</p>
          </div>
          <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-1 rounded border">พบ {filteredSchedules.length} คิวค่างวด</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">เลขที่สัญญา</th>
                <th className="p-4">ผู้กู้ / ลูกค้า</th>
                <th className="p-4 text-center">งวดที่</th>
                <th className="p-4 text-center">วันครบดิวจ่าย</th>
                <th className="p-4 text-right header-num">เงินต้นเรียกเก็บ (Principal)</th>
                <th className="p-4 text-right header-num">ดอกเบี้ยคำนวณ (Interest)</th>
                <th className="p-4 text-right header-num">ภาษีมูลค่าเพิ่ม (VAT 7%)</th>
                <th className="p-4 text-right header-num text-rose-500">เบี้ยปรับสะสม (Penalty)</th>
                <th className="p-4 text-right header-num text-rose-500">ค่าติดตามทวงถาม (Collection)</th>
                <th className="p-4 text-right header-num text-[#25348D]">ยอดรวมต้องชำระ (Total)</th>
                <th className="p-4 text-right header-num text-emerald-600">ชำระแล้วแล้ว</th>
                <th className="p-4 text-center">สถานะ</th>
                <th className="p-4 text-center">ออกใบแจ้งหนี้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">
                    ไม่พบรายการค้างชำระตามดิวหรือสถานะค่างวดที่เลือกในระบบขณะนี้
                  </td>
                </tr>
              ) : (
                filteredSchedules.map(sch => {
                  const parent = contracts.find(c => c.id === sch.contractId);
                  return (
                    <tr key={sch.id} className="hover:bg-slate-50/40 transition">
                      <td className="p-4 font-mono font-bold text-[#213F9A] uppercase tracking-wider">{sch.contractId}</td>
                      <td className="p-4 pr-1">
                        <div>
                          <span className="font-semibold text-slate-800 block">{parent ? parent.customerName : 'N/A'}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">ประเภท: {parent?.productType === 'HP' ? 'เช่าซื้อรถบรรทุก' : 'กู้ยืมเงิน'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-extrabold">งวด {sch.termNumber}</span>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-600">{sch.dueDate}</td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-700">{formatThb(sch.principalDue)}</td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-700">{formatThb(sch.interestDue)}</td>
                      <td className="p-4 text-right font-mono font-semibold text-slate-700">{sch.vatDue > 0 ? formatThb(sch.vatDue) : '-'}</td>
                      
                      <td className="p-4 text-right font-mono font-bold text-rose-500">
                        {sch.penaltyDue > 0 ? formatThb(sch.penaltyDue) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-rose-500">
                        {sch.trackingFeeDue > 0 ? formatThb(sch.trackingFeeDue) : '-'}
                      </td>
                      
                      <td className="p-4 text-right font-mono font-extrabold text-[#25348D]">{formatThb(sch.totalDue)}</td>
                      <td className="p-4 text-right font-mono font-extrabold text-emerald-600">{formatThb(sch.totalPaid)}</td>
                      <td className="p-4 text-center">{getStatusBadge(sch.status)}</td>
                      
                      <td className="p-4 text-center text-slate-300">
                        <button
                          onClick={() => handleOpenInvoice(sch)}
                          className="p-1 px-2.5 bg-slate-100 hover:bg-[#25348D] hover:text-white rounded text-[#25348D] font-bold text-[10px] transition flex items-center justify-center space-x-1 mx-auto cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
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

      {/* Document View Printable Modal */}
      {selectedContract && selectedSchedule && (
        <DocViewerModal
          isOpen={isDocOpen}
          onClose={() => setIsDocOpen(false)}
          type="INVOICE"
          contract={selectedContract}
          scheduledPayment={selectedSchedule}
        />
      )}
    </div>
  );
}
