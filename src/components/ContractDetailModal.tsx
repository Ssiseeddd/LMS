import React, { useState, useEffect } from 'react';
import { Contract, ScheduledPayment, Repayment, Disbursement } from '../types';
import { getScheduledPayments, getRepayments, getDisbursements } from '../dbStore';
import { generateInitialSchedule } from '../financialEngine';
import { 
  X, 
  Calendar, 
  Coins, 
  Receipt, 
  Percent, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  TrendingUp, 
  ShieldCheck, 
  Activity,
  Calculator
} from 'lucide-react';

interface ContractDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
}

export default function ContractDetailModal({ isOpen, onClose, contract }: ContractDetailModalProps) {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'repayments'>('overview');

  useEffect(() => {
    if (isOpen) {
      // Fetch latest from the store
      const allSchedules = getScheduledPayments();
      const allRepayments = getRepayments();
      const allDisbursements = getDisbursements();
      
      // Filter for this specific contract
      const contractSchedules = allSchedules
        .filter(s => s.contractId === contract.id)
        .sort((a, b) => a.termNumber - b.termNumber);
      
      const contractRepayments = allRepayments
        .filter(r => r.contractId === contract.id)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      const contractDisbursements = allDisbursements
        .filter(d => d.contractId === contract.id);

      setPayments(contractSchedules);
      setRepayments(contractRepayments);
      setDisbursements(contractDisbursements);
    }
  }, [isOpen, contract]);

  if (!isOpen) return null;

  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  const getStatusBadge = (status: ScheduledPayment['status']) => {
    switch (status) {
      case 'PAID':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">ชำระแล้ว</span>;
      case 'PARTIAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">จ่ายบางส่วน</span>;
      case 'OVERDUE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">ค้างชำระ (Overdue)</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">รอดำเนินการ</span>;
    }
  };

  // Compute stats
  const totalDueSum = payments.reduce((sum, p) => sum + p.totalDue, 0);
  const totalPaidSum = payments.reduce((sum, p) => sum + p.totalPaid, 0);
  const totalOutstandingDue = Math.max(0, totalDueSum - totalPaidSum);
  
  const overdueSchedules = payments.filter(p => p.status === 'OVERDUE');
  const totalOverdueAmount = overdueSchedules.reduce((sum, p) => sum + (p.totalDue - p.totalPaid), 0);

  const initialSchedule = React.useMemo(() => {
    const baseAmt = contract.productType === 'HP' ? contract.creditLimit : (contract.disbursedAmount || contract.creditLimit);
    return generateInitialSchedule(contract, baseAmt, contract.startDate);
  }, [contract]);

  // Philosophy of calculation
  const getInterestDescription = () => {
    if (contract.productType === 'HP') {
      return (
        <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
          <p>
            <strong className="text-slate-800">1. การคิดคำนวณแบบ เช่าซื้อรถ/เครื่องจักร (Hire Purchase):</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>คำนวณแบ่งค่างวดออกเป็น เงินต้น และดอกเบี้ยคงที่ตามสัดส่วน (Fixed/Amortized HP Interest)</li>
            <li>มีภาษีมูลค่าเพิ่ม (VAT 7%) คำนวณครอบคลุมทั้งเงินต้นและดอกเบี้ยตามกฎหมายสรรพากรในทุกๆ งวดเรียกเก็บ</li>
            <li>เมื่อมีการชำระเงินเข้ามา ระบบจะตัดลำดับตามสลัดคิว: เบี้ยปรับล่าช้า → ค่าติดตามหนี้ → ดอกเบี้ยค้างจ่าย → เงินต้นค้างจ่าย → ภาษีมูลค่าเพิ่ม</li>
          </ul>
        </div>
      );
    } else {
      if (contract.paymentFrequency === 'ANNUAL') {
        return (
          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>
              <strong className="text-slate-800">1. การคิดคำนวณสำหรับ สินเชื่อกลุ่มส่งเสริมการจำหน่ายไม้/ปลูกป่า (กู้รายปี):</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>งวดที่ 1 (ปีแรก): หักลดดอกเบี้ยหน้าตั๋วล่วงหน้าเพื่อความปลอดภัยของเงินทุน (Prepaid upfront interest deduction) ยอดดอกเบี้ยปีแรกในตารางผ่อนชำระจึงขึ้นเป็น 0 (เพราะลบออกตั้งแต่ฝั่งเบิกจ่ายเงินแล้ว)</li>
              <li>งวดถัดไป: คำนวณดอกเบี้ยรายปีโดยอิงจากอัตราดอกเบี้ยร้อยละ <span className="font-bold text-[#1463F3]">{contract.interestRate}%</span> ต่อปี คูณกับยอดเงินต้นคงค้างที่เหลืออยู่</li>
              <li>มีค่าธรรมเนียมการบริหารจัดการสวนป่ารายปี (Annual Management Fee) อัตราคงที่ {formatThb(contract.serviceFee)} ช่วยดูแลพอร์ตสมาชิกลูกหนี้</li>
            </ul>
          </div>
        );
      } else {
        return (
          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>
              <strong className="text-slate-800">1. การคำนวณลดต้นลดดอกรายวัน (Daily Reducing-Balance Loan):</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>ดอกเบี้ยคิดเป็นรายวันขึ้นกับเงินต้นคงเหลือจริง ณ ปัจจุบัน</li>
              <li>สูตรการคำนวณดอกเบี้ยรายวัน: <code className="bg-slate-100 p-0.5 px-1 rounded text-[#25348D] font-mono font-bold">ยอดเงินต้นคงค้าง × อัตราดอกเบี้ย (%) × (จำนวนวันในงวด ÷ 365 วัน)</code></li>
              <li>
                <strong className="text-[#25348D]">การรีดักชั่นแบบเรียลไทม์:</strong> เมื่อมีรายการชำระเงินเข้ามา ยอดจะหักลบเงินต้นคงค้าง (Outstanding Principal) 
                และระบบจะทำการ <strong>รีเซ็ตการคิดดอกเบี้ยใหม่ลดลงตามยอดเงินต้นคงเหลือทันที</strong> สำหรับคำนวณงวดต่อๆ ไปที่ยังมาไม่ถึงเป็นแบบลดต้นลดดอกรายวันอย่างถูกต้องตามกฎเกณฑ์สากล
              </li>
            </ul>
          </div>
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-[#1D2023] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <Calculator className="w-5 h-5 text-[#84A4FC]" />
            <div>
              <h3 className="font-bold text-[15px] tracking-tight">
                รายละเอียดสถานะสัญญาและการคิดดอกเบี้ยแบบลดต้นลดดอกรายวัน
              </h3>
              <p className="text-[#84A4FC] text-[10px] font-semibold tracking-wider font-mono mt-0.5">CONTRACT NO: {contract.id} • {contract.customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/10 rounded-lg p-2 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Navigation */}
        <div className="flex bg-slate-50 border-b border-slate-200 px-6 font-bold text-xs shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'overview' ? 'border-[#1463F3] text-[#1463F3]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>1. ภาพรวม & วิธีคิดดอกเบี้ยลดต้นลดดอก</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'schedule' ? 'border-[#1463F3] text-[#1463F3]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>2. ตารางผ่อนชำระค่างวด (Dues Plan)</span>
          </button>
          <button
            onClick={() => setActiveTab('repayments')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'repayments' ? 'border-[#1463F3] text-[#1463F3]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>3. ประวัติการตัดชำระจริง (Repayments History)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/20">

          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">ยอดเบิกใช้วงเงินต้นสะสม</span>
                  <span className="text-lg font-bold text-slate-800 mt-1 block">
                    {formatThb(contract.disbursedAmount)}
                  </span>
                  <span className="text-[9px] text-[#1463F3] font-semibold mt-1 block">จากวงเงินสูงสุด {formatThb(contract.creditLimit)}</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">เงินต้นคงเหลือปัจจุบัน</span>
                  <span className="text-lg font-bold text-[#1463F3] mt-1 block">
                    {formatThb(contract.outstandingPrincipal)}
                  </span>
                  <span className="text-[9px] text-emerald-600 font-semibold mt-1 block">Outstanding Balance</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">ยอดยอดคงเหลือตามดิวค้าง</span>
                  <span className="text-lg font-bold text-rose-600 mt-1 block">
                    {formatThb(totalOutstandingDue)}
                  </span>
                  <span className="text-[9px] text-slate-550 font-semibold mt-1 block">ที่เรียกชำระแล้วแต่ยังไม่ได้รับเงิน</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#FDA4AF]/40 shadow-xs bg-rose-50/20">
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block">ยอดค้างชำระพ้นกำหนด (Overdue/NPL)</span>
                  <span className="text-lg font-bold text-rose-700 mt-1 block">
                    {formatThb(totalOverdueAmount)}
                  </span>
                  <span className="text-[9px] text-rose-550 font-semibold mt-1 block">จำนวนงวดค้างชำระ: {overdueSchedules.length} งวด</span>
                </div>

              </div>

              {/* Detail Contract Profile */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Profile card */}
                <div className="bg-white p-5 rounded-xl border border-slate-150 space-y-4">
                  <h4 className="font-bold text-xs text-[#1463F3] uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ข้อมูลและโครงสร้างของสัญญากู้ยืม / เช่าซื้อ (Contract Terms Info)</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">รหัสประจำตัวผู้กู้</span>
                      <strong className="text-slate-700 font-bold block mt-0.5">{contract.customerName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">เลขประจำตัวผู้เสียภาษี</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5">{contract.customerTaxId || 'ไม่ระบุ'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">เบอร์โทรศัพท์ติดต่อ</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5">{contract.customerPhone || 'ไม่ระบุ'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">วันที่เริ่มทำสัญญา</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5 font-mono">{contract.startDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">ระยะเวลาสัญญากู้</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5">{contract.termMonths} เดือน</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">วันครบกำหนดดิวประจำงวด</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5">ทุกวันที่ {contract.dueDay}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">อัตราดอกเบี้ยจริง (Effective Rate)</span>
                      <strong className="text-[#1463F3] font-extrabold block mt-0.5">{contract.interestRate}% ต่อปี</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">สถานะปัจจุบัน</span>
                      <strong className="block mt-0.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${contract.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : contract.status === 'DEFAULT' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'}`}>
                          {contract.status === 'ACTIVE' ? 'ACTIVE' : contract.status === 'DEFAULT' ? 'DEFAULT' : 'CLOSED'}
                        </span>
                      </strong>
                    </div>

                    {contract.paymentFrequency === 'ANNUAL' && (
                      <div className="col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-2">
                        <span className="text-[10px] font-extrabold text-[#1463F3] tracking-wider uppercase block">ข้อมูลแปลงเพาะปลูก (Economic Forest Details)</span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div>
                            <span className="text-slate-400 font-medium block">ประเภทกลุ่มปลูก</span>
                            <strong className="text-slate-750 font-bold block mt-0.5 text-[11.5px]">
                              {contract.plantingType === 'RESERVE' ? 'Reserve (พันธสัญญาพิเศษ)' : 'Non-Reserve (ปกติ)'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">ขนาดพื้นที่ปลูก</span>
                            <strong className="text-slate-750 font-bold block mt-0.5 text-[11.5px] font-mono">{contract.plantingAreaRai || '-'} ไร่</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">จำนวนกล้าไม้ที่ปลูก</span>
                            <strong className="text-slate-750 font-bold block mt-0.5 text-[11.5px] font-mono">{(contract.plantingTreeCount || 0).toLocaleString('th-TH')} ต้น</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">สถานที่เพาะปลูก (ที่ตั้ง)</span>
                            <strong className="text-slate-750 font-semibold block mt-0.5 text-[11.5px]">
                              ต.{contract.plantingSubdistrict || '-'} อ.{contract.plantingDistrict || '-'} จ.{contract.plantingProvince || '-'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Calculation Philosophy & Daily reducing Balance explanation */}
                <div className="bg-white p-5 rounded-xl border border-slate-150 space-y-4">
                  <h4 className="font-bold text-xs text-[#1463F3] uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <BookOpen className="w-4 h-4" />
                    <span>อธิบายกลไกคำนวณดอกเบี้ยแบบลดต้นลดดอก (How Interest Operates)</span>
                  </h4>

                  {getInterestDescription()}

                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs flex items-start space-x-2.5">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-blue-900 leading-relaxed font-medium">
                      <strong className="block font-bold mb-0.5">การคำนวณดอกเบี้ยเป็นสัจจวัตถุ (No Mock Data)</strong>
                      ทุกครั้งที่บันทึกสัญญาหรือตัดคืนชำระเงินต้นในพอร์ทัลคาร์บอนแบงก์ ดอกเบี้ยสำหรับงวดถัดไปที่ยังไม่ชำระของสัญญานี้จะถูกคำนวณใหม่โดยทันที เพื่อลบสัดส่วนตามเงินต้นคงค้างจริงทำให้ลูกหนี้ได้รับดอกเบี้ยที่ลดสัดส่วนลงอย่างถูกต้องเป็นรายวัน
                    </p>
                  </div>
                </div>

              </div>
              
              {/* Due & Delinquency summary section */}
              <div className="bg-white p-5 rounded-xl border border-slate-150 space-y-4">
                <h4 className="font-bold text-xs text-rose-700 uppercase tracking-wider flex items-center space-x-2 border-b border-rose-50 pb-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span>รายงานตารางดิวค้างและประเมินหลักเกณฑ์หนี้เสีย (Due Delinquency & NPL Standards)</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
                  <div className="space-y-1 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <strong className="block text-slate-800 text-[11px] mb-1">เกณฑ์ผิดนัดชำระค้างงวด (Aging Bucket)</strong>
                    <p>ระบบตรวจสอบแบบรายวัน: สัญญานี้มีจำนวนดิวที่ยังไม่ชำระ <strong>{payments.filter(p => p.status !== 'PAID').length} งวด</strong></p>
                    <p>มีจำนวนดิวค้างเกินกำหนด (Overdue): <span className="text-rose-600 font-bold">{overdueSchedules.length} งวด</span></p>
                  </div>

                  <div className="space-y-1 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <strong className="block text-slate-800 text-[11px] mb-1">เกณฑ์การคิดเบี้ยปรับล่าช้า (Penalty 15% p.a.)</strong>
                    <p>คำนวณอัตราบังคับตามกฎหมายสูงสุด <strong>15% ต่อปี</strong> ของก้อนเงินต้นที่ค้างในงวดสะสมรายวัน โดยระบบบวกอัตราเบี้ยปรับสะสมเข้ายอด Due โดยตรงโดยคำนวณปรับปรุงอัตโนมัติตลอดเวลา</p>
                  </div>

                  <div className="space-y-1 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <strong className="block text-slate-800 text-[11px] mb-1">การเปลี่ยนสถานภาพสัญญาเป็น DEFAULT</strong>
                    <p>หากสมาชิกลูกหนี้มีปริมาณ <strong>ค้างชำระงวดสะสมเกิน 2 งวดขึ้นไป</strong> ระบบจะทำการปรับระดับสภาพสัญญาเป็น <span className="text-rose-700 font-extrabold">DEFAULT (ผิดนัดชำระขั้นร้ายแรง)</span> โดยอัตโนมัติ เพื่อส่งค่ายังหน่วยจัดตามเก็บประทุษธรรมต่อไป</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold bg-white px-3 py-1.5 rounded-lg border">แผนค่างวดผ่อนชำระรวม: {payments.length} งวดหลัก</span>
                <span className="font-bold text-slate-400">อัตราภาษีนำส่ง: {contract.productType === 'HP' ? 'มีภาษีมูลค่าเพิ่ม (VAT 7%)' : 'ได้รับการยกเว้นภาษีค่างวด'}</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <th className="px-3 py-3 text-center border-r border-slate-200/30">งวดที่</th>
                        <th className="px-3 py-3 border-r border-slate-200/30">วันครบกำหนด (Due Date)</th>
                        <th className="px-3 py-3 text-right bg-blue-50/40 text-[#1463F3] font-bold border-r border-slate-200/30 font-sans">เงินต้นที่เบิก (Disbursed)</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30 font-sans">เงินต้นค่างวด (Principal)</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30 font-sans">ดอกเบี้ยคำนวณ (Interest)</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30 font-sans">ภาษีมูลค่าเพิ่ม (VAT)</th>
                        <th className="px-3 py-3 text-right text-rose-500 border-r border-slate-200/30 font-sans">เบี้ยปรับสะสม</th>
                        <th className="px-3 py-3 text-right text-rose-500 border-r border-slate-200/30 font-sans">ค่าติดตามทวงถาม</th>
                        <th className="px-3 py-3 text-right text-[#1463F3] border-r border-slate-200/30 font-sans">ยอดรวมต้องจ่าย</th>
                        <th className="px-3 py-3 text-right text-emerald-600 border-r border-slate-200/30 font-sans">ชำระสะสมแล้ว</th>
                        <th className="px-3 py-3 text-right bg-emerald-50/20 text-emerald-800 font-bold border-r border-slate-200/30 font-sans">เงินต้นคงเหลือ (Balance)</th>
                        <th className="px-3 py-3 text-center font-sans">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-655 font-medium font-mono text-[11px]">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="p-8 text-center text-slate-400">
                            ไม่พบตารางผ่อนชำระในฐานข้อมูล กรุณาไปทำรายการสร้างหรืออนุมัติในหน้าเบิกจ่ายเงินกู้
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const sortedSchedules = [...payments].sort((a, b) => a.termNumber - b.termNumber);
                          return sortedSchedules.map(sch => {
                            const totalPaidInTerm = sch.principalPaid + sch.interestPaid + sch.vatPaid + sch.penaltyPaid + sch.trackingFeePaid;
                            const initSchTerm = initialSchedule.find(i => i.termNumber === sch.termNumber);
                            
                            const prevDueDate = sch.termNumber === 1 
                              ? contract.startDate 
                              : sortedSchedules.find(p => p.termNumber === sch.termNumber - 1)?.dueDate || contract.startDate;

                            const termDisbursedRecs = disbursements.filter(d => {
                              if (sch.termNumber === 1) {
                                return d.disburseDate <= sch.dueDate;
                              } else {
                                return d.disburseDate > prevDueDate && d.disburseDate <= sch.dueDate;
                              }
                            });
                            const termDisbursedAmount = termDisbursedRecs.reduce((sum, d) => sum + Number(d.amount), 0);

                            const cumulativeDisburbed = disbursements
                              .filter(d => d.disburseDate <= sch.dueDate)
                              .reduce((sum, d) => sum + Number(d.amount), 0);

                            const cumulativePrincipalDue = sortedSchedules
                              .filter(p => p.termNumber <= sch.termNumber)
                              .reduce((sum, p) => sum + p.principalDue, 0);

                            const cumulativePrincipalPaid = sortedSchedules
                              .filter(p => p.termNumber <= sch.termNumber)
                              .reduce((sum, p) => sum + p.principalPaid, 0);

                            const remainingPrincipalProjected = Math.max(0, cumulativeDisburbed - cumulativePrincipalDue);
                            const remainingPrincipalActual = Math.max(0, cumulativeDisburbed - cumulativePrincipalPaid);

                            return (
                              <tr key={sch.id} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0 hover:text-slate-900 font-mono text-[11px]">
                                <td className="px-2 py-2 text-center border-r border-slate-100/50 align-middle">
                                  <span className="bg-slate-100/90 text-slate-800 px-2 py-0.5 rounded font-extrabold text-[10px] inline-block">งวด {sch.termNumber}</span>
                                </td>
                                <td className="px-2 py-2 text-slate-600 font-bold border-r border-slate-100/50 align-middle">{sch.dueDate}</td>
                                <td className="px-2 py-2 text-right font-bold text-[#1463F3] bg-blue-50/10 border-r border-slate-100/50 align-middle">
                                  {termDisbursedAmount > 0 ? formatThb(termDisbursedAmount) : '-'}
                                </td>
                                <td className="px-2 py-2 text-right border-r border-slate-100/50 align-middle">
                                  <span className="text-slate-700 block text-xs font-semibold">{formatThb(sch.principalDue)}</span>
                                  {initSchTerm && (
                                    <span className="block text-[9px] text-slate-400 font-semibold mt-0.5">แผนเดิม: {formatThb(initSchTerm.principalDue)}</span>
                                  )}
                                  <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">จ่ายแล้ว: {formatThb(sch.principalPaid)}</span>
                                </td>
                                <td className="px-2 py-2 text-right border-r border-slate-100/50 align-middle">
                                  <span className="text-slate-700 block text-xs font-semibold">{formatThb(sch.interestDue)}</span>
                                  {initSchTerm && (
                                    <span className="block text-[9px] text-slate-400 font-semibold mt-0.5">แผนเดิม: {formatThb(initSchTerm.interestDue)}</span>
                                  )}
                                  <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">จ่ายแล้ว: {formatThb(sch.interestPaid)}</span>
                                </td>
                                <td className="px-2 py-2 text-right text-slate-500 border-r border-slate-100/50 align-middle">
                                  {sch.vatDue > 0 ? formatThb(sch.vatDue) : '-'}
                                  {sch.vatDue > 0 && <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">จ่ายแล้ว: {formatThb(sch.vatPaid)}</span>}
                                </td>
                                <td className="px-2 py-2 text-right text-rose-500 font-semibold border-r border-slate-100/50 align-middle">
                                  {sch.penaltyDue > 0 ? formatThb(sch.penaltyDue) : '-'}
                                  {sch.penaltyDue > 0 && <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">จ่ายแล้ว: {formatThb(sch.penaltyPaid)}</span>}
                                </td>
                                <td className="px-2 py-2 text-right text-rose-500 font-semibold border-r border-slate-100/50 align-middle">
                                  {sch.trackingFeeDue > 0 ? formatThb(sch.trackingFeeDue) : '-'}
                                  {sch.trackingFeeDue > 0 && <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">จ่ายแล้ว: {formatThb(sch.trackingFeePaid)}</span>}
                                </td>
                                <td className="px-2 py-2 text-right font-extrabold text-[#1463F3] border-r border-slate-100/50 align-middle">
                                  <span className="block">{formatThb(sch.totalDue)}</span>
                                  {initSchTerm && (
                                    <span className="block text-[9px] text-slate-400 font-normal mt-0.5">แผนเดิม: {formatThb(initSchTerm.totalDue)}</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-right font-extrabold text-[#16a34a] bg-emerald-50/5 border-r border-slate-100/50 align-middle">{formatThb(totalPaidInTerm)}</td>
                                <td className="px-2 py-2 text-right font-bold text-slate-700 bg-emerald-50/5 border-r border-slate-100/50 align-middle">
                                  <span>{formatThb(remainingPrincipalProjected)}</span>
                                  <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">จริงเหลือ: {formatThb(remainingPrincipalActual)}</span>
                                </td>
                                <td className="px-2 py-2 text-center align-middle">{getStatusBadge(sch.status)}</td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'repayments' && (
            <div className="space-y-4">
              <span className="text-xs text-slate-500 font-semibold bg-white px-3 py-1.5 rounded-lg border inline-block">พบบันทึกการชำระเงินคืน: {repayments.length} สลิปย่อย</span>
              
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <th className="px-3 py-3 border-r border-slate-200/30">เลขที่ใบเสร็จ (Receipt)</th>
                        <th className="px-3 py-3 text-center border-r border-slate-200/30">วันที่ชำระค่างวด</th>
                        <th className="px-3 py-3 text-right bg-emerald-50/20 text-emerald-800 font-bold border-r border-slate-200/30">ยอดชำระสุทธิ (Gross)</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดเงินต้น</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดดอกเบี้ย</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดเบี้ยปรับ</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดค่าทวงถาม</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/30">ตัดภาษี VAT</th>
                        <th className="px-3 py-3 w-64 max-w-[260px]">รายละเอียดสับยอดค่างวด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-655 font-medium font-mono">
                      {repayments.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                            ยังไม่มีรายการบันทึกรับเงินชำระค่างวดสำหรับสัญญานี้ในประวัติสารบรรณ
                          </td>
                        </tr>
                      ) : (
                        repayments.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0 hover:text-slate-900">
                            <td className="px-3 py-2 text-[#1463F3] font-bold uppercase border-r border-slate-100">{r.receiptNo}</td>
                            <td className="px-3 py-2 text-center text-slate-600 font-semibold border-r border-slate-100">{r.paymentDate}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-extrabold bg-emerald-50/10 border-r border-slate-100">{formatThb(r.amountPaid)}</td>
                            <td className="px-3 py-2 text-right text-slate-700 border-r border-slate-100">{r.appliedPrincipal > 0 ? formatThb(r.appliedPrincipal) : '-'}</td>
                            <td className="px-3 py-2 text-right text-slate-700 border-r border-slate-100">{r.appliedInterest > 0 ? formatThb(r.appliedInterest) : '-'}</td>
                            <td className="px-3 py-2 text-right text-rose-500 font-bold border-r border-slate-100">{r.appliedPenalty > 0 ? formatThb(r.appliedPenalty) : '-'}</td>
                            <td className="px-3 py-2 text-right text-rose-500 font-bold border-r border-slate-100">{r.appliedTrackingFee > 0 ? formatThb(r.appliedTrackingFee) : '-'}</td>
                            <td className="px-3 py-2 text-right text-slate-500 border-r border-slate-100">{r.appliedVat > 0 ? formatThb(r.appliedVat) : '-'}</td>
                            <td className="px-2.5 py-1.5 text-slate-500 font-sans text-[10px] w-64 max-w-[260px] align-top">
                              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                {r.distributionDetails && r.distributionDetails.map((dist, idx) => (
                                  <div key={idx} className="bg-slate-50/80 p-1 rounded border border-slate-200/60 leading-tight">
                                    <span className="font-bold text-[#1463F3]">งวด {dist.termNumber}</span>: 
                                    ต้น {formatThb(dist.principal)} | ดอก {formatThb(dist.interest)} | ปรับ {formatThb(dist.penalty)}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer font-sans"
          >
            ปิดหน้าต่างข้อมูลรายละเอียด
          </button>
        </div>

      </div>
    </div>
  );
}
