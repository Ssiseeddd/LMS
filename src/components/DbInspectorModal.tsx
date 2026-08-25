import React, { useState, useEffect } from 'react';
import { X, Database, RefreshCw, Search, CheckCircle2, AlertCircle, Table } from 'lucide-react';
import { getSupabaseClient, getSavedSupabaseConfig } from '../supabaseClient';
import { getScheduledPayments, getContracts, getDisbursements, getRepayments, getDailyAccruedInterests } from '../dbStore';

interface DbInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DbInspectorModal({ isOpen, onClose }: DbInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<'scheduled_payments' | 'contracts' | 'disbursements' | 'repayments' | 'daily_accrued_interests'>('scheduled_payments');
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');

  const fetchDbData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const client = getSupabaseClient();
    const config = getSavedSupabaseConfig();

    if (client && config.url && config.key) {
      try {
        setDataSource('supabase');
        const { data, error } = await client.from(activeTab).select('*');
        if (error) {
          throw error;
        }
        setRawData(data || []);
      } catch (err: any) {
        console.warn('Failed to fetch from Supabase, falling back to local:', err);
        setErrorMsg(`Supabase Query Error: ${err.message || err}. Falling back to local data.`);
        loadLocalData();
      } finally {
        setLoading(false);
      }
    } else {
      loadLocalData();
      setLoading(false);
    }
  };

  const loadLocalData = () => {
    setDataSource('local');
    if (activeTab === 'scheduled_payments') {
      const data = getScheduledPayments();
      setRawData(data);
    } else if (activeTab === 'contracts') {
      setRawData(getContracts());
    } else if (activeTab === 'disbursements') {
      setRawData(getDisbursements());
    } else if (activeTab === 'repayments') {
      setRawData(getRepayments());
    } else if (activeTab === 'daily_accrued_interests') {
      setRawData(getDailyAccruedInterests());
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDbData();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const filteredData = rawData.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const cId = String(item.contract_id || item.contractId || item.id || '').toLowerCase();
    const due = String(item.due_date || item.dueDate || '').toLowerCase();
    return cId.includes(q) || due.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">ตรวจสอบข้อมูลดิบจาก Database (Raw Database Inspector)</h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>แหล่งข้อมูล:</span>
                {dataSource === 'supabase' ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded text-[10px] border border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" /> Supabase Cloud DB
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded text-[10px] border border-amber-800">
                    LocalStorage / Fallback
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchDbData}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              <span>รีโหลดข้อมูล</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Table Selectors */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-1 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('scheduled_payments')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'scheduled_payments'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              scheduled_payments (ค่างวด)
            </button>
            <button
              onClick={() => setActiveTab('contracts')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'contracts'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              contracts (สัญญา)
            </button>
            <button
              onClick={() => setActiveTab('disbursements')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'disbursements'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              disbursements (เบิกจ่าย)
            </button>
            <button
              onClick={() => setActiveTab('repayments')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'repayments'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              repayments (ชำระ)
            </button>
            <button
              onClick={() => setActiveTab('daily_accrued_interests')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'daily_accrued_interests'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              daily_accrued_interests (ดอกเบี้ยตั้งรับ)
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาตาม contract_id หรือ due_date..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-800 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-4 bg-white">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
              <span>กำลังดึงข้อมูลดิบจากฐานข้อมูล...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <Table className="w-8 h-8 stroke-1 text-slate-300" />
              <span>ไม่พบรายการข้อมูลตรงกับคำค้นหา</span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-mono font-bold uppercase">
                    <th className="p-3 border-r border-slate-200">#</th>
                    {Object.keys(filteredData[0] || {}).map(key => (
                      <th
                        key={key}
                        className={`p-3 border-r border-slate-200 whitespace-nowrap ${
                          key === 'due_date' || key === 'dueDate' ? 'bg-amber-100/70 text-amber-900 font-extrabold' : ''
                        }`}
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-bold text-slate-400 bg-slate-50/50 border-r border-slate-200 text-center">{idx + 1}</td>
                      {Object.keys(filteredData[0] || {}).map(key => {
                        const val = row[key];
                        const isDueDateCol = key === 'due_date' || key === 'dueDate';
                        return (
                          <td
                            key={key}
                            className={`p-2.5 border-r border-slate-200 whitespace-nowrap ${
                              isDueDateCol
                                ? 'bg-amber-50/80 font-extrabold text-amber-800 text-xs'
                                : 'text-slate-700'
                            }`}
                          >
                            {val === null || val === undefined
                              ? <span className="text-slate-300 italic">null</span>
                              : typeof val === 'object'
                              ? JSON.stringify(val)
                              : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono shrink-0">
          <span>จำนวนแถวที่ดึงได้: <strong className="text-slate-800 font-bold">{filteredData.length}</strong> / {rawData.length} รายการ</span>
          <span className="text-[11px] text-slate-400">💡 ฟิลด์ <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800 font-bold">due_date</code> ถูกไฮไลต์สีส้มไว้สำหรับการตรวจสอบวันครบกำหนดชำระตรงจากตาราง</span>
        </div>

      </div>
    </div>
  );
}
