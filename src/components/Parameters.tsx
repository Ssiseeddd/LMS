import React, { useState, useEffect } from 'react';
import { getSystemParameters, saveSystemParameters } from '../dbStore';
import { SystemParameters } from '../types';
import { SlidersHorizontal, ShieldCheck, CheckCircle2, Percent, Coins, BadgeAlert, Landmark } from 'lucide-react';

export default function Parameters() {
  const [penaltyRate, setPenaltyRate] = useState<number>(15);
  const [trackingFee1, setTrackingFee1] = useState<number>(50);
  const [trackingFee2, setTrackingFee2] = useState<number>(100);
  const [vatRate, setVatRate] = useState<number>(7);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const params = getSystemParameters();
    setPenaltyRate(params.penaltyRate);
    setTrackingFee1(params.trackingFeeTier1);
    setTrackingFee2(params.trackingFeeTier2);
    setVatRate(params.vatRate);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updated: SystemParameters = {
      penaltyRate: Number(penaltyRate),
      trackingFeeTier1: Number(trackingFee1),
      trackingFeeTier2: Number(trackingFee2),
      vatRate: Number(vatRate)
    };
    
    saveSystemParameters(updated);
    
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Settings Info Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-[#25348D] tracking-tight flex items-center space-x-2">
            <SlidersHorizontal className="w-5 h-5 text-[#41C3DB]" />
            <span>ปรับแต่งค่ากำหนดและอัตราดอกเบี้ยเบี้ยปรับบวกภาษี (System Parameters Configuration)</span>
          </h2>
          <p className="text-slate-400 text-xs">กำหนดอัตรากลางระบบของส่วนจัดเก็บ รายการอัตราเบี้ยปรับ ค่าทวงถาม และ VAT ชำระ เพื่อให้คำนวณสอดคล้องกับพฤติการณ์สัญญากู้</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">พารามิเตอร์แกนคำนวณระบบ (LMS Calculation Constants)</span>
          {saved && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>บันทึกตั้งค่าลงระบบและคำนวณใหม่เรียบร้อย</span>
            </span>
          )}
        </div>

        {/* Form Grid */}
        <div className="p-6 sm:p-8 space-y-6 text-xs text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Penalty Rate Card */}
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-3 relative overflow-hidden group">
              <div className="w-12 h-12 bg-[#25348D]/5 text-[#25348D] rounded-full flex items-center justify-center absolute -top-2 -right-2 transform rotate-12 opacity-50">
                <BadgeAlert className="w-6 h-6" />
              </div>
              <label className="block font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">อัตราเบี้ยปรับชำระล่าช้า (Penalty Rate)</label>
              <p className="text-slate-400 leading-tight">อัตราดอกเบี้ยผิดนัดส่วนปรับต่อปี คิดคำนวณเฉลี่ยรายวันหลังพ้นระยะเวลาผ่อนปรน (Grace Period 3 วัน) ของเงินต้นที่ค้างจ่ายค่างวด</p>
              <div className="flex items-center space-x-2 pt-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={penaltyRate}
                    onChange={e => setPenaltyRate(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-white text-slate-800 font-bold text-sm text-right pr-9 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold text-[11px] uppercase">% ต่อปี</span>
                </div>
              </div>
            </div>

            {/* VAT Rate Card */}
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-3 relative overflow-hidden">
              <div className="w-12 h-12 bg-[#41C3DB]/10 text-[#41C3DB] rounded-full flex items-center justify-center absolute -top-2 -right-2 transform rotate-12 opacity-50">
                <Percent className="w-6 h-6" />
              </div>
              <label className="block font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">ภาษีมูลค่าเพิ่มที่บังคับใช้ (VAT Rate)</label>
              <p className="text-slate-400 leading-tight">อัตราภาษีมูลค่าเพิ่มที่จะถูกรวมคำนวณในค่างวดเช่าซื้อ (Hire Purchase) และคำนวณภาษีสุทธิของค่าติดตามทวงหนี้</p>
              <div className="flex items-center space-x-2 pt-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={vatRate}
                    onChange={e => setVatRate(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-white text-slate-800 font-bold text-sm text-right pr-9 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold text-[11px] uppercase">%</span>
                </div>
              </div>
            </div>

            {/* Tracking Fee Tier 1 Card */}
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-3 relative overflow-hidden">
              <div className="w-12 h-12 bg-rose-500/5 text-rose-500 rounded-full flex items-center justify-center absolute -top-2 -right-2 transform rotate-12 opacity-50">
                <Coins className="w-6 h-6" />
              </div>
              <label className="block font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">ค่าติดตามงวดแรกที่ค้างชำระ (Tier 1 Tracking Fee)</label>
              <p className="text-slate-400 leading-tight">ค่าติดตามทวงถามที่เรียกเก็บบนรายการค่างวดที่เริ่มเข้าข่ายค้างจ่ายเป็นงวดแรก (ไม่มีประวัติค้างค่างวดติดพันก่อนหน้า)</p>
              <div className="flex items-center space-x-2 pt-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    required
                    value={trackingFee1}
                    onChange={e => setTrackingFee1(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-white text-slate-800 font-bold text-sm text-right pr-12 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold text-[11px] uppercase">บาท / งวด</span>
                </div>
              </div>
            </div>

            {/* Tracking Fee Tier 2 Card */}
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-3 relative overflow-hidden">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center absolute -top-2 -right-2 transform rotate-12 opacity-50">
                <Coins className="w-6 h-6 animate-pulse" />
              </div>
              <label className="block font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">ค่าติดตามค้างสะสมต่อเนื่อง (Tier 2 Tracking Fee)</label>
              <p className="text-slate-400 leading-tight">ค่าติดตามทวงถามที่เรียกเก็บบนสัญญางวดนั้นๆ เมื่อมีรายการค้างชำระสะสมติดต่อกันตั้งแต่ 2 งวดขึ้นไป</p>
              <div className="flex items-center space-x-2 pt-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    required
                    value={trackingFee2}
                    onChange={e => setTrackingFee2(Number(e.target.value))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:border-[#213F9A] bg-white text-slate-800 font-bold text-sm text-right pr-12 font-mono"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold text-[11px] uppercase">บาท / งวด</span>
                </div>
              </div>
            </div>

          </div>

          <div className="bg-[#25348D]/5 p-4 rounded-lg flex items-start space-x-3 text-slate-700 font-medium">
            <ShieldCheck className="w-5 h-5 text-[#25348D] shrink-0 mt-0.5" />
            <div className="space-y-1 leading-snug">
              <strong className="block text-[#25348D] text-[11px] mb-0.5">ประกาศรับรองความถูกต้องพารามิเตอร์ระบบ</strong>
              <p className="text-[11px] font-sans">การบันทึกค่าจะปรับปรุงตารางค่างวดที่ใกล้เกินดิว ผิดนัด และจัดเรียงความเสถียรของเกณฑ์ค้างชำระอัตโนมัติ โดยระบบจะบังคับใช้และทำการคำนวณซ้ำทันทีทุกส่วนในส่วนเบิกจ่าย สัญญาเช่าซื้อ สัญญากลุ่มปลูก และบิลเรียกเก็บรายงวด</p>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#25348D] hover:bg-[#213F9A] text-white font-bold rounded-lg cursor-pointer transition shadow-md hover:shadow-lg text-xs"
          >
            บันทึกตั้งค่าลงระบบกลาง (Apply & Recalculate)
          </button>
        </div>
      </form>
    </div>
  );
}
