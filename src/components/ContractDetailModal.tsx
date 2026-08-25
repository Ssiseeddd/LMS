import React, { useState, useEffect } from 'react';
import { Contract, ScheduledPayment, Repayment, Disbursement } from '../types';
import { getScheduledPayments, getRepayments, getDisbursements, updateScheduledPaymentPendingDisbursement, getSystemDate, getFirstDisbursementDate } from '../dbStore';
import { generateInitialSchedule, getDailyInterestLog } from '../financialEngine';
import DetailedScheduleMatrix from './DetailedScheduleMatrix';
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
  Calculator,
  Edit2,
  Check
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
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'repayments' | 'dailyInterest'>('overview');
  const [scheduleMode, setScheduleMode] = useState<'matrix' | 'compact'>('matrix');
  const [selectedLogTerm, setSelectedLogTerm] = useState<number>(1);
  const [logAsOfDate, setLogAsOfDate] = useState<string>('');
  
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editingPendingValue, setEditingPendingValue] = useState<string>('');

  const handleSavePendingDisbursement = (id: string) => {
    const numericVal = parseFloat(editingPendingValue) || 0;
    updateScheduledPaymentPendingDisbursement(id, numericVal);
    
    const conCid = (contract.id || '').trim().toUpperCase();
    // Refresh local payments state
    const allSchedules = getScheduledPayments();
    const contractSchedules = allSchedules
      .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
      .sort((a, b) => a.termNumber - b.termNumber);
    setPayments(contractSchedules);
    
    setEditingTermId(null);
    setEditingPendingValue('');
  };

  useEffect(() => {
    if (isOpen) {
      const conCid = (contract.id || '').trim().toUpperCase();
      // Fetch latest from the store
      const allSchedules = getScheduledPayments();
      const allRepayments = getRepayments();
      const allDisbursements = getDisbursements();
      
      // Filter for this specific contract
      const contractSchedules = allSchedules
        .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
        .sort((a, b) => a.termNumber - b.termNumber);
      
      const contractRepayments = allRepayments
        .filter(r => (r.contractId || '').trim().toUpperCase() === conCid)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      const contractDisbursements = allDisbursements
        .filter(d => (d.contractId || '').trim().toUpperCase() === conCid);

      setPayments(contractSchedules);
      setRepayments(contractRepayments);
      setDisbursements(contractDisbursements);

      // Default term selection to term 1 of this contract
      if (contractSchedules.length > 0) {
        setSelectedLogTerm(contractSchedules[0].termNumber);
      } else {
        setSelectedLogTerm(1);
      }
      setLogAsOfDate(getSystemDate());
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

  const firstDisbursementDate = getFirstDisbursementDate(contract.id) || contract.firstDisburseDate || contract.disburseDate;

  const initialSchedule = React.useMemo(() => {
    const baseAmt = contract.productType === 'HP' ? contract.creditLimit : (contract.disbursedAmount || contract.creditLimit);
    const disburseDate = firstDisbursementDate || contract.startDate;
    return generateInitialSchedule(contract, baseAmt, disburseDate);
  }, [contract, firstDisbursementDate]);

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
          <button
            onClick={() => setActiveTab('dailyInterest')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'dailyInterest' ? 'border-[#1463F3] text-[#1463F3]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>4. บันทึกดอกเบี้ยรายวันสะสม (Daily Accrual Log)</span>
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">ยอดรอเรียกเก็บ</span>
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
                      <span className="text-slate-400 font-medium block">วันที่เซ็นสัญญา (Contract Date)</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5 font-mono">{contract.startDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">วันที่เริ่มเบิกเงิน (เริ่มคิดดอกเบี้ย)</span>
                      <strong className="text-emerald-700 font-semibold block mt-0.5 font-mono">
                        {firstDisbursementDate || contract.startDate}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">ระยะเวลาสัญญากู้</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5">{contract.termMonths} เดือน</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">วันครบกำหนดดิวประจำงวด</span>
                      <strong className="text-slate-700 font-semibold block mt-0.5">ทุกวันที่ {contract.dueDay}</strong>
                    </div>
                    {contract.installmentAmount !== undefined && contract.installmentAmount !== null && (
                      <div>
                        <span className="text-slate-400 font-medium block">ค่างวดผ่อนชำระ (Installment)</span>
                        <strong className="text-emerald-700 font-extrabold block mt-0.5">{formatThb(contract.installmentAmount)}</strong>
                      </div>
                    )}
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
              {/* Summary Header Cards for Each Contract */}
              {(() => {
                const sysDate = getSystemDate();
                let maxAgingDays = 0;
                payments.forEach(p => {
                  const unpaid = Math.max(0, p.totalDue - (p.principalPaid + p.interestPaid + p.vatPaid + p.penaltyPaid + p.trackingFeePaid));
                  if (unpaid > 0 && p.status !== 'PAID') {
                    const tMs = new Date(sysDate).getTime();
                    const dMs = new Date(p.dueDate).getTime();
                    const diff = Math.max(0, Math.ceil((tMs - dMs) / (1000 * 60 * 60 * 24)));
                    if (diff > maxAgingDays) maxAgingDays = diff;
                  }
                });

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">1. ยอดรวมค่างวดตามสัญญา</span>
                      <span className="text-base font-extrabold text-slate-800 block mt-0.5">{formatThb(totalDueSum)}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">รวม {payments.length} งวดผ่อน</span>
                    </div>

                    <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
                      <span className="text-emerald-700 font-bold block text-[10px] uppercase tracking-wider">2. จ่ายสะสมแล้ว (Total Paid)</span>
                      <span className="text-base font-extrabold text-emerald-700 block mt-0.5">{formatThb(totalPaidSum)}</span>
                      <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">ยอดเงินชำระคืนจริงทั้งหมด</span>
                    </div>

                    <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 shadow-xs">
                      <span className="text-rose-700 font-bold block text-[10px] uppercase tracking-wider">3. ยังค้างชำระ (Outstanding Due)</span>
                      <span className="text-base font-extrabold text-rose-700 block mt-0.5">{formatThb(totalOutstandingDue)}</span>
                      <span className="text-[10px] text-rose-600 mt-0.5 block font-medium">ยอดคงค้างรอรับชำระ</span>
                    </div>

                    <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                      <span className="text-amber-800 font-bold block text-[10px] uppercase tracking-wider">4. ระยะค้างชำระ (Aging / DPD)</span>
                      <span className="text-base font-extrabold text-amber-900 block mt-0.5">
                        {maxAgingDays > 0 ? `ค้างสูงสุด ${maxAgingDays} วัน` : 'ปกติ (0 วัน)'}
                      </span>
                      <span className="text-[10px] text-amber-700 mt-0.5 block font-medium">
                        งวดค้างชำระ: {overdueSchedules.length} งวด
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                    📋 ตารางสรุปค่างวดสัญญา ({payments.length} งวดหลัก)
                  </span>
                  
                  {/* Mode Toggle Buttons */}
                  <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center font-bold text-[11px]">
                    <button
                      onClick={() => setScheduleMode('matrix')}
                      className={`px-3 py-1 rounded-md transition ${scheduleMode === 'matrix' ? 'bg-[#1463F3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      ตาราง Plan vs Actual (9 หมวดหมู่)
                    </button>
                    <button
                      onClick={() => setScheduleMode('compact')}
                      className={`px-3 py-1 rounded-md transition ${scheduleMode === 'compact' ? 'bg-[#1463F3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      ตารางสรุปย่อ (Standard)
                    </button>
                  </div>
                </div>

                <span className="font-bold text-slate-500 text-[11px]">
                  อัตราภาษีนำส่ง: {contract.productType === 'HP' ? 'มีภาษีมูลค่าเพิ่ม (VAT 7%)' : 'ได้รับการยกเว้นภาษีค่างวด'}
                </span>
              </div>

              {scheduleMode === 'matrix' ? (
                <DetailedScheduleMatrix
                  contract={contract}
                  schedules={payments}
                  repayments={repayments}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <th className="px-3 py-3 text-center border-r border-slate-200/50">งวดที่</th>
                        <th className="px-3 py-3 border-r border-slate-200/50">วันครบกำหนด (Due Date)</th>
                        <th className="px-3 py-3 text-right bg-blue-50/40 text-[#1463F3] font-bold border-r border-slate-200/50 font-sans">เบิกเงินต้น / ยอดรอเบิก</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/50 font-sans">เงินต้นค่างวด</th>
                        <th className="px-3 py-3 text-right border-r border-slate-200/50 font-sans">ดอกเบี้ยคำนวณ</th>
                        <th className="px-3 py-3 text-right text-[#1463F3] border-r border-slate-200/50 font-sans">ยอดรวมต้องจ่าย</th>
                        <th className="px-3 py-3 text-right text-emerald-700 bg-emerald-50/30 border-r border-slate-200/50 font-sans">จ่ายเท่าไหร่</th>
                        <th className="px-3 py-3 text-right text-rose-700 bg-rose-50/30 border-r border-slate-200/50 font-sans">ยังค้างเท่าไหร่</th>
                        <th className="px-3 py-3 text-center text-amber-800 bg-amber-50/30 border-r border-slate-200/50 font-sans">Aging (กี่วัน)</th>
                        <th className="px-3 py-3 text-right bg-emerald-50/20 text-emerald-800 font-bold border-r border-slate-200/50 font-sans">เงินต้นคงเหลือ (Balance)</th>
                        <th className="px-3 py-3 text-center font-sans">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-655 font-medium font-mono text-[11px]">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-400">
                            ไม่พบตารางผ่อนชำระในฐานข้อมูล กรุณาไปทำรายการสร้างหรืออนุมัติในหน้าเบิกจ่ายเงินกู้
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const sortedSchedules = [...payments].sort((a, b) => a.termNumber - b.termNumber);
                          const sysDate = getSystemDate();

                          return sortedSchedules.map(sch => {
                            const totalPaidInTerm = sch.principalPaid + sch.interestPaid + sch.vatPaid + sch.penaltyPaid + sch.trackingFeePaid;
                            const termOutstanding = Math.max(0, sch.totalDue - totalPaidInTerm);
                            
                            // Aging calculation
                            let agingDays = 0;
                            if (termOutstanding > 0 && sch.status !== 'PAID') {
                              const tMs = new Date(sysDate).getTime();
                              const dMs = new Date(sch.dueDate).getTime();
                              agingDays = Math.max(0, Math.ceil((tMs - dMs) / (1000 * 60 * 60 * 24)));
                            }

                            const renderAgingCol = () => {
                              if (sch.status === 'PAID' || termOutstanding <= 0) {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 inline-block whitespace-nowrap">
                                    0 วัน (ชำระแล้ว)
                                  </span>
                                );
                              }
                              if (agingDays <= 0) {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block whitespace-nowrap">
                                    0 วัน (ยังไม่ถึงดิว)
                                  </span>
                                );
                              } else if (agingDays <= 30) {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-block whitespace-nowrap">
                                    ค้าง {agingDays} วัน
                                  </span>
                                );
                              } else if (agingDays <= 60) {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200 inline-block whitespace-nowrap">
                                    ค้าง {agingDays} วัน
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300 inline-block whitespace-nowrap animate-pulse">
                                    ค้าง {agingDays} วัน
                                  </span>
                                );
                              }
                            };

                            const prevDueDate = sch.termNumber === 1 
                              ? contract.startDate 
                              : sortedSchedules.find(p => p.termNumber === sch.termNumber - 1)?.dueDate || contract.startDate;

                            const addDays = (dStr: string | null | undefined, days: number): string => {
                              if (!dStr) return '';
                              try {
                                const d = new Date(dStr);
                                if (isNaN(d.getTime())) return dStr;
                                d.setDate(d.getDate() + days);
                                return d.toISOString().split('T')[0];
                              } catch (e) {
                                return dStr;
                              }
                            };

                            const bufferDays = contract.paymentFrequency === 'ANNUAL' ? 15 : 0;
                            const maxDate = sch.dueDate ? addDays(sch.dueDate, bufferDays) : '';
                            const minDate = sch.termNumber === 1 ? '' : (prevDueDate ? addDays(prevDueDate, bufferDays) : '');

                            const contractCid = (contract.id || '').trim().toUpperCase();

                            const contractDisbursements = disbursements
                              .filter(d => (d.contractId || '').trim().toUpperCase() === contractCid)
                              .sort((a, b) => new Date(a.disburseDate).getTime() - new Date(b.disburseDate).getTime());

                            const termDisbursedRecs = contractDisbursements.filter((d, idx) => {
                              if (d.batchNumber && Number(d.batchNumber) > 0) {
                                return Number(d.batchNumber) === sch.termNumber;
                              }
                              if (idx === 0) {
                                return sch.termNumber === 1;
                              }
                              if (sch.termNumber === 1) return false;
                              if (!maxDate || !minDate) return false;
                              return d.disburseDate > minDate && d.disburseDate <= maxDate;
                            });

                            let termDisbursedAmount = termDisbursedRecs.reduce((sum, d) => sum + Number(d.amount), 0);

                            if (contractDisbursements.length === 0 && (contract.disbursedAmount || 0) > 0) {
                              if (sch.termNumber === 1) {
                                termDisbursedAmount = contract.disbursedAmount || 0;
                              }
                            }

                            const cumulativeDisburbed = contractDisbursements.length > 0
                              ? contractDisbursements
                                  .filter((d, idx) => {
                                    if (d.batchNumber && Number(d.batchNumber) > 0) {
                                      return Number(d.batchNumber) <= sch.termNumber;
                                    }
                                    if (idx === 0) {
                                      return true;
                                    }
                                    if (!maxDate) return false;
                                    return d.disburseDate <= maxDate;
                                  })
                                  .reduce((sum, d) => sum + Number(d.amount), 0)
                              : (contract.disbursedAmount || contract.creditLimit || 0);

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
                                <td className="px-2 py-2.5 text-center border-r border-slate-100/50 align-middle">
                                  <span className="bg-slate-100/90 text-slate-800 px-2 py-0.5 rounded font-extrabold text-[10px] inline-block">งวด {sch.termNumber}</span>
                                </td>
                                <td className="px-2 py-2.5 text-slate-600 font-bold border-r border-slate-100/50 align-middle">{sch.dueDate}</td>
                                <td className="px-2 py-2.5 text-right bg-blue-50/10 border-r border-slate-100/50 align-middle">
                                  {termDisbursedAmount > 0 ? (
                                    <span className="block font-bold text-[#1463F3]">{formatThb(termDisbursedAmount)}</span>
                                  ) : (
                                    <span className="block text-slate-400 font-bold">-</span>
                                  )}
                                  
                                  {editingTermId === sch.id ? (
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                      <input
                                        type="number"
                                        className="w-20 px-1 py-0.5 text-right border border-blue-400 rounded bg-white text-[10px] font-sans font-bold text-slate-800 focus:outline-none"
                                        value={editingPendingValue}
                                        onChange={(e) => setEditingPendingValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSavePendingDisbursement(sch.id);
                                          if (e.key === 'Escape') {
                                            setEditingTermId(null);
                                            setEditingPendingValue('');
                                          }
                                        }}
                                        autoFocus
                                      />
                                      <button 
                                        onClick={() => handleSavePendingDisbursement(sch.id)}
                                        className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                        title="บันทึก"
                                      >
                                        <Check size={10} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setEditingTermId(null);
                                          setEditingPendingValue('');
                                        }}
                                        className="p-0.5 text-rose-600 hover:bg-rose-50 rounded"
                                        title="ยกเลิก"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1 group mt-0.5">
                                      <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                                        รอเบิก: {formatThb(sch.pendingDisbursement || 0)}
                                      </span>
                                      <button 
                                        onClick={() => {
                                          setEditingTermId(sch.id);
                                          setEditingPendingValue(String(sch.pendingDisbursement || 0));
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-[#1463F3] hover:bg-slate-100 rounded transition-opacity"
                                        title="แก้ไขยอดรอเบิก"
                                      >
                                        <Edit2 size={10} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2.5 text-right border-r border-slate-100/50 align-middle">
                                  <span className="text-slate-700 block text-xs font-semibold">{formatThb(sch.principalDue)}</span>
                                </td>
                                <td className="px-2 py-2.5 text-right border-r border-slate-100/50 align-middle">
                                  <span className="text-slate-700 block text-xs font-semibold">{formatThb(sch.interestDue)}</span>
                                </td>
                                <td className="px-2 py-2.5 text-right font-extrabold text-[#1463F3] border-r border-slate-100/50 align-middle">
                                  <span className="block">{formatThb(sch.totalDue)}</span>
                                </td>
                                
                                {/* จ่ายเท่าไหร่ */}
                                <td className="px-2 py-2.5 text-right font-extrabold text-emerald-700 bg-emerald-50/20 border-r border-slate-100/50 align-middle">
                                  {formatThb(totalPaidInTerm)}
                                </td>

                                {/* ยังค้างเท่าไหร่ */}
                                <td className="px-2 py-2.5 text-right font-extrabold border-r border-slate-100/50 align-middle bg-rose-50/20">
                                  {termOutstanding > 0 ? (
                                    <span className="text-rose-700">{formatThb(termOutstanding)}</span>
                                  ) : (
                                    <span className="text-slate-400 font-bold">0.00 ฿</span>
                                  )}
                                </td>

                                {/* Aging (กี่วัน) */}
                                <td className="px-2 py-2.5 text-center border-r border-slate-100/50 align-middle bg-amber-50/10">
                                  {renderAgingCol()}
                                </td>

                                <td className="px-2 py-2.5 text-right font-bold text-slate-700 bg-emerald-50/5 border-r border-slate-100/50 align-middle">
                                  <span>{formatThb(remainingPrincipalProjected)}</span>
                                  <span className="block text-[9px] text-emerald-600 font-semibold mt-0.5">จริงเหลือ: {formatThb(remainingPrincipalActual)}</span>
                                </td>
                                <td className="px-2 py-2.5 text-center align-middle">{getStatusBadge(sch.status)}</td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
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
                        repayments.map((r, idx) => (
                          <tr key={`${r.id}-${idx}`} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0 hover:text-slate-900">
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

          {activeTab === 'dailyInterest' && (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-[#1463F3] font-bold">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm">กลไกการคำนวณและบันทึกดอกเบี้ยรายวันสะสม (Daily Accrued Interest Audit Log)</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  ระบบคำนวณดอกเบี้ยรายวันสะสมจากเงินต้นคงเหลือจริง ณ สิ้นวัน (<code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-[#1463F3] font-mono">เงินต้นคงเหลือ × อัตราดอกเบี้ย% ÷ 365</code>) แล้วประมวลผลบันทึกลงในระบบทุกๆ วัน เมื่อลูกค้าทำการชำระเงินเข้ามา ระบบจะทำการตัดชำระแบบแนวนอน (Horizontal Cut) โดยนำเงินไปตัดยอดดอกเบี้ยคงค้างสะสมที่บันทึกไว้ ณ วันที่ชำระเงินก่อน แล้วจึงนำยอดเงินส่วนที่เหลือไปตัดลดเงินต้นคงค้างเพื่อลดการคิดดอกเบี้ยในวันถัดไปทันที
                </p>
              </div>

              {/* Term Filter Bar */}
              <div className="flex flex-wrap justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200 text-xs gap-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5">
                    <label className="font-bold text-slate-700">เลือกดูรายงวด:</label>
                    <select
                      value={selectedLogTerm}
                      onChange={(e) => setSelectedLogTerm(Number(e.target.value))}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-[#1463F3] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {payments.map(p => (
                        <option key={p.id} value={p.termNumber}>
                          งวดที่ {p.termNumber} (ดิว {p.dueDate}) {p.status === 'PAID' ? '✓ ชำระแล้ว' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    <label className="font-bold text-slate-600 text-[11px]">คำนวณย้อนหลังถึงวันที่:</label>
                    <input
                      type="date"
                      value={logAsOfDate}
                      onChange={(e) => setLogAsOfDate(e.target.value)}
                      className="font-mono font-bold text-[#1463F3] bg-transparent border-none focus:outline-none text-xs"
                    />
                  </div>
                </div>

                {(() => {
                  const dailyLogs = getDailyInterestLog(contract, selectedLogTerm, payments, repayments, logAsOfDate);
                  const totalCumInt = dailyLogs.length > 0 ? dailyLogs[dailyLogs.length - 1].cumulativeInterest : 0;
                  return (
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-500 font-semibold">จำนวนวันเดินดอกเบี้ย: <strong className="text-slate-800 font-mono">{dailyLogs.length} วัน</strong></span>
                      <span className="text-[#1463F3] font-bold bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                        ดอกเบี้ยสะสม ณ วันที่เลือก: <strong className="font-mono text-sm">{formatThb(totalCumInt)}</strong>
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Daily Log Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 bg-slate-100 z-10">
                        <th className="px-3 py-2.5 text-center border-r border-slate-200">ลำดับ</th>
                        <th className="px-3 py-2.5 text-center border-r border-slate-200">วันที่ (Date)</th>
                        <th className="px-3 py-2.5 text-right border-r border-slate-200 font-mono">เงินต้นคงเหลือ ณ สิ้นวัน</th>
                        <th className="px-3 py-2.5 text-center border-r border-slate-200">อัตราดอกเบี้ยต่อปี</th>
                        <th className="px-3 py-2.5 text-right border-r border-slate-200 text-[#1463F3] font-mono">ดอกเบี้ยเกิดขึ้นประจำวัน</th>
                        <th className="px-3 py-2.5 text-right text-emerald-700 font-mono bg-emerald-50/30">ดอกเบี้ยคงค้างสะสมรวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700 font-mono text-[11px]">
                      {(() => {
                        const dailyLogs = getDailyInterestLog(contract, selectedLogTerm, payments, repayments, logAsOfDate);
                        if (dailyLogs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 font-sans">
                                ไม่อยู่ในงวดช่วงเดินดอกเบี้ย หรือยังไม่ถึงกำหนดเริ่มต้นของงวดนี้
                              </td>
                            </tr>
                          );
                        }
                        return dailyLogs.map((log, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition">
                            <td className="px-3 py-1.5 text-center text-slate-400 font-sans border-r border-slate-100">{idx + 1}</td>
                            <td className="px-3 py-1.5 text-center font-bold text-slate-800 border-r border-slate-100">{log.date}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-slate-700 border-r border-slate-100">{formatThb(log.principal)}</td>
                            <td className="px-3 py-1.5 text-center text-slate-500 border-r border-slate-100">{log.dailyRate}%</td>
                            <td className="px-3 py-1.5 text-right font-bold text-[#1463F3] border-r border-slate-100">{formatThb(log.dailyInterest)}</td>
                            <td className="px-3 py-1.5 text-right font-extrabold text-emerald-800 bg-emerald-50/10">{formatThb(log.cumulativeInterest)}</td>
                          </tr>
                        ));
                      })()}
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
