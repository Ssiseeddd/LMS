import React, { useState, useMemo } from 'react';
import { X, Database, CheckCircle, Clock, AlertTriangle, RefreshCw, Calendar, Save, Trash2 } from 'lucide-react';
import { Contract, ScheduledPayment, Repayment, DailyAccruedInterest } from '../types';
import { generateDailyAccruedInterestRecords } from '../financialEngine';
import { getFirstDisbursementDate, saveDailyAccruedInterests, saveScheduledPayments, getDailyAccruedInterests, getSystemDate } from '../dbStore';
import { getSupabaseClient } from '../supabaseClient';
import { autoPushItem, clearAccruedInterestInSupabaseAndLocal } from '../supabaseSync';

interface DailyAccruedInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  contracts: Contract[];
  schedules: ScheduledPayment[];
  repayments: Repayment[];
  initialTermNumber?: number;
}

export const DailyAccruedInterestModal: React.FC<DailyAccruedInterestModalProps> = ({
  isOpen,
  onClose,
  contract,
  contracts,
  schedules,
  repayments,
  initialTermNumber = 1
}) => {
  if (!isOpen || !contract) return null;

  const conCid = (contract.id || '').trim().toUpperCase();

  // All schedules for this contract
  const contractSchedules = useMemo(() => {
    return schedules
      .filter(s => (s.contractId || '').trim().toUpperCase() === conCid)
      .sort((a, b) => a.termNumber - b.termNumber);
  }, [schedules, conCid]);

  const [selectedTerm, setSelectedTerm] = useState<number>(initialTermNumber || contractSchedules[0]?.termNumber || 1);
  const [asOfDate, setAsOfDate] = useState<string>(getSystemDate());
  const [isSavingSupabase, setIsSavingSupabase] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected term schedule object
  const activeSch = useMemo(() => {
    return contractSchedules.find(s => s.termNumber === selectedTerm) || contractSchedules[0];
  }, [contractSchedules, selectedTerm]);

  const firstDisbDate = useMemo(() => {
    return getFirstDisbursementDate(contract.id) || contract.firstDisburseDate || contract.startDate;
  }, [contract]);

  // Generate or retrieve records
  const dailyRecords: DailyAccruedInterest[] = useMemo(() => {
    if (!activeSch) return [];
    const termPaidInterest = activeSch.interestPaid || 0;
    return generateDailyAccruedInterestRecords(
      contract,
      activeSch.termNumber,
      schedules,
      repayments,
      asOfDate,
      firstDisbDate,
      termPaidInterest
    );
  }, [contract, activeSch, schedules, repayments, asOfDate, firstDisbDate]);

  // Totals for header
  const totalDays = dailyRecords.length;
  const totalAccrued = Math.round(dailyRecords.reduce((sum, r) => sum + r.dailyInterest, 0) * 100) / 100;
  const totalPaid = Math.round(dailyRecords.reduce((sum, r) => sum + r.amountPaid, 0) * 100) / 100;
  const totalOutstanding = dailyRecords.length > 0 ? (Math.round((dailyRecords[dailyRecords.length - 1].outstandingInterest || 0) * 100) / 100) : 0;

  const formatThb = (val: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const handleSyncToSupabase = async () => {
    setIsSavingSupabase(true);
    setSaveMessage(null);
    try {
      let roundedAccrued = 0;
      if (activeSch) {
        roundedAccrued = Math.round(totalOutstanding * 100) / 100;
        activeSch.accruedInterest = roundedAccrued;
        const schIndex = schedules.findIndex(s => s.id === activeSch.id);
        if (schIndex !== -1) {
          schedules[schIndex].accruedInterest = roundedAccrued;
        }
        saveScheduledPayments(schedules);

        const client = getSupabaseClient();
        if (client) {
          await autoPushItem(client, 'scheduled_payments', activeSch);
          setSaveMessage({
            type: 'success',
            text: `บันทึกดอกเบี้ยตั้งรับสะสม (Accrued Interest = ${formatThb(roundedAccrued)} ฿) ลงในตาราง Scheduled Payments และ Sync ลง Supabase สำเร็จเรียบร้อยแล้ว`
          });
        } else {
          setSaveMessage({
            type: 'success',
            text: `บันทึกดอกเบี้ยตั้งรับสะสม (Accrued Interest = ${formatThb(roundedAccrued)} ฿) ลงใน Local Storage เรียบร้อยแล้ว`
          });
        }
      }
    } catch (err: any) {
      setSaveMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการบันทึก: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSavingSupabase(false);
    }
  };

  const handleClearAccruedInterest = async () => {
    setIsSavingSupabase(true);
    setSaveMessage(null);
    try {
      schedules.forEach(s => {
        s.accruedInterest = 0;
      });
      saveScheduledPayments(schedules);

      const client = getSupabaseClient();
      if (client) {
        await clearAccruedInterestInSupabaseAndLocal(client);
        setSaveMessage({
          type: 'success',
          text: `เคลียร์ column accrued_interest เป็น 0 เรียบร้อยแล้ว (Sync ลง Supabase สำเร็จ)`
        });
      } else {
        setSaveMessage({
          type: 'success',
          text: `เคลียร์ column accrued_interest ใน Local Storage เป็น 0 เรียบร้อยแล้ว`
        });
      }
    } catch (err: any) {
      setSaveMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการเคลียร์: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSavingSupabase(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                ตารางบันทึกดอกเบี้ยตั้งรับรายวัน (Daily Accrued Interest Records - Supabase)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {contract.id} - {contract.customerName} ({contract.productType === 'HP' ? 'เช่าซื้อ HP' : 'เงินกู้ Loan'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls & Filter Bar (Matching Screenshot UI) */}
        <div className="p-5 bg-slate-50/80 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left Controls */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-bold">เลือกดูรายการงวด:</span>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(Number(e.target.value))}
                  className="bg-white border-2 border-blue-500 text-blue-900 rounded-xl px-3 py-1.5 font-bold shadow-xs focus:ring-2 focus:ring-blue-400 focus:outline-none"
                >
                  {contractSchedules.map(sch => (
                    <option key={sch.id} value={sch.termNumber}>
                      งวดที่ {sch.termNumber} (ดิว {sch.dueDate}) {sch.status === 'PAID' ? '✓ ชำระแล้ว' : sch.status === 'PARTIAL' ? '⚠ ชำระบางส่วน' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-bold">คำนวณย้อนหลังถึงวันที่:</span>
                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={e => setAsOfDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono text-slate-800 shadow-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Right Stat Pill */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-1.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-2xs">
                <span>จำนวนวันเดินดอกเบี้ย:</span>
                <span className="font-extrabold text-blue-700 font-mono text-sm">{totalDays} วัน</span>
              </div>
              <div className="bg-sky-50 border border-sky-200 text-sky-900 px-4 py-1.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-2xs">
                <span>ดอกเบี้ยสะสม ณ วันที่เลือก:</span>
                <span className="font-extrabold text-blue-600 font-mono text-base">฿{formatThb(totalAccrued)}</span>
              </div>
            </div>
          </div>

          {/* Allocation & Cutting Status summary bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex justify-between items-center">
              <span className="text-slate-500 font-bold">1. ดอกเบี้ยตามแผน (DB):</span>
              <span className="font-extrabold text-slate-800 font-mono text-sm">฿{formatThb(activeSch?.interestDue || 0)}</span>
            </div>
            <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-200 flex justify-between items-center">
              <span className="text-sky-800 font-bold">2. Recal เกิดขึ้นจริง:</span>
              <span className="font-extrabold text-sky-700 font-mono text-sm">฿{formatThb(totalAccrued)}</span>
            </div>
            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 flex justify-between items-center">
              <span className="text-emerald-800 font-bold">3. ตัดชำระแล้ว:</span>
              <span className="font-extrabold text-emerald-600 font-mono text-sm">฿{formatThb(totalPaid)}</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${totalOutstanding > 0 ? 'bg-amber-50/80 border-amber-200' : 'bg-emerald-50/80 border-emerald-200'}`}>
              <span className={`font-bold ${totalOutstanding > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>4. ดอกเบี้ยคงค้าง:</span>
              <span className={`font-extrabold font-mono text-sm ${totalOutstanding > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                ฿{formatThb(totalOutstanding)}
              </span>
            </div>
          </div>

          {/* Save Status Notification */}
          {saveMessage && (
            <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
              saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <span>{saveMessage.text}</span>
              <button onClick={() => setSaveMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">ปิด</button>
            </div>
          )}
        </div>

        {/* Main Table Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-100/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-center uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-16 border-r border-slate-200">ลำดับ</th>
                  <th className="p-3 border-r border-slate-200 text-left">วันที่ (DATE)</th>
                  <th className="p-3 border-r border-slate-200 text-right">เงินต้นคงเหลือ ณ สิ้นวัน</th>
                  <th className="p-3 border-r border-slate-200">อัตราดอกเบี้ยต่อปี</th>
                  <th className="p-3 border-r border-slate-200 text-right text-blue-700">ดอกเบี้ยเกิดขึ้นประจำวัน</th>
                  <th className="p-3 border-r border-slate-200 text-right text-emerald-700">ดอกเบี้ยคงค้างสะสมรวม</th>
                  <th className="p-3 border-r border-slate-200 text-right text-teal-700">ตัดชำระแล้ว</th>
                  <th className="p-3 border-r border-slate-200 text-right text-amber-700">ดอกเบี้ยคงค้างคงเหลือ</th>
                  <th className="p-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      ไม่พบรายการดอกเบี้ยตั้งรับสำหรับงวดที่เลือก
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-blue-50/30 transition">
                      <td className="p-2.5 text-center font-bold text-slate-400 border-r border-slate-150">{rec.seq}</td>
                      <td className="p-2.5 font-bold text-slate-800 border-r border-slate-150">{rec.entryDate}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-700 border-r border-slate-150">
                        ฿{formatThb(rec.principalBalance)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-150">
                        {rec.interestRate}%
                      </td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-blue-600 border-r border-slate-150">
                        ฿{formatThb(rec.dailyInterest)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-emerald-600 border-r border-slate-150">
                        ฿{formatThb(rec.accumulatedInterest)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-teal-700 border-r border-slate-150">
                        ฿{formatThb(rec.amountPaid)}
                      </td>
                      <td className={`p-2.5 text-right font-mono font-extrabold border-r border-slate-150 ${
                        rec.outstandingInterest > 0 ? 'text-amber-700' : 'text-slate-400'
                      }`}>
                        ฿{formatThb(rec.outstandingInterest)}
                      </td>
                      <td className="p-2.5 text-center">
                        {rec.status === 'PAID' ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> ชำระแล้ว
                          </span>
                        ) : rec.status === 'PARTIAL' ? (
                          <span className="bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ชำระบางส่วน
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> ค้างชำระ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncToSupabase}
              disabled={isSavingSupabase || dailyRecords.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSavingSupabase ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>บันทึกตารางนี้ลง Supabase DB (daily_accrued_interests)</span>
            </button>

            <button
              onClick={handleClearAccruedInterest}
              disabled={isSavingSupabase}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>เคลียร์ column accrued_interest (Set to 0)</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold text-xs px-5 py-2 rounded-xl transition shadow-xs"
          >
            ปิดหน้าต่างข้อมูลรายละเอียด
          </button>
        </div>
      </div>
    </div>
  );
};
