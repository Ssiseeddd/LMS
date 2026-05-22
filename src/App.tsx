/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeDB, getSupabaseSQLMigration, runDailyAudit } from './dbStore';
import Dashboard from './components/Dashboard';
import InputContract from './components/InputContract';
import Disbursement from './components/Disbursement';
import Statement from './components/Statement';
import Repayment from './components/Repayment';
import { 
  getSavedSupabaseConfig, 
  saveSupabaseConfig, 
  clearSupabaseConfig, 
  getSupabaseClient, 
  testSupabaseConnection 
} from './supabaseClient';
import { pushLocalDataToSupabase, pullSupabaseDataToLocal } from './supabaseSync';
import { 
  Landmark, 
  FileText, 
  ArrowUpRight, 
  Coins, 
  LayoutDashboard, 
  Database, 
  Info, 
  Copy, 
  ClipboardCheck, 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'disbursement' | 'statement' | 'repayment'>('dashboard');
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  // Supabase states
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [panelTab, setPanelTab] = useState<'sync' | 'sql'>('sync');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'testing' | 'connected' | 'connected_missing_tables' | 'error'>('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [syncingState, setSyncingState] = useState<'idle' | 'pushing' | 'pulling' | 'done' | 'failed'>('idle');
  const [syncResultMsg, setSyncResultMsg] = useState('');

  useEffect(() => {
    // Bootstrap db and run daily overdue audit on load
    initializeDB();
    runDailyAudit();

    // Load initial config
    const config = getSavedSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseKey(config.key);
    setAutoSync(config.autoSync);
    
    if (config.url && config.key) {
      // Auto test connection on launch
      testConnection(config.url, config.key, config.autoSync);
    }
  }, []);

  const testConnection = async (url: string, key: string, syncVal: boolean) => {
    setConnectionStatus('testing');
    setConnectionMessage('กำลังตรวจสอบสัญญาระบบและทดสอบ Schema โครงสร้างตาราง...');
    try {
      const result = await testSupabaseConnection(url, key);
      if (result.success) {
        if (result.missingTables && result.missingTables.length > 0) {
          setConnectionStatus('connected_missing_tables');
          setMissingTables(result.missingTables);
          setConnectionMessage(result.message);
        } else {
          setConnectionStatus('connected');
          setConnectionMessage(result.message);
          setMissingTables([]);
        }
        saveSupabaseConfig(url, key, syncVal);
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message);
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err?.message || 'Error executing connection parameters.');
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setConnectionStatus('error');
      setConnectionMessage('กรุณากรอกข้อมูลทั้ง Supabase URL และ Anon Key ให้ครบถ้วน');
      return;
    }
    await testConnection(supabaseUrl, supabaseKey, autoSync);
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseKey('');
    setConnectionStatus('disconnected');
    setConnectionMessage('ใช้งานโหมดจำลองออฟไลน์เริ่มต้นเรียบร้อย');
    setMissingTables([]);
  };

  const handlePushData = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setSyncingState('pushing');
    setSyncResultMsg('กำลังนำข้อมูล Local อัปโหลดขยายขึ้นไปสู้โครงฐานบน Supabase...');
    try {
      const res = await pushLocalDataToSupabase(client);
      if (res.success) {
        setSyncingState('done');
        setSyncResultMsg(`${res.message} (สัญญา: ${res.pushedCount?.contracts || 0}, เบิกจ่าย: ${res.pushedCount?.disbursements || 0}, งวดชำระ: ${res.pushedCount?.payments || 0}, ประวัติชำระ: ${res.pushedCount?.repayments || 0})`);
        // Verify again so schema errors (if any) clear out
        await testConnection(supabaseUrl, supabaseKey, autoSync);
      } else {
        setSyncingState('failed');
        setSyncResultMsg(res.message);
      }
    } catch (err: any) {
      setSyncingState('failed');
      setSyncResultMsg(err?.message || 'Failed during sync replication.');
    }
  };

  const handlePullData = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setSyncingState('pulling');
    setSyncResultMsg('กำลังกู้คืนฐานข้อมูล จากบริการระบบคลาวด์ลงบราวเซอร์...');
    try {
      const res = await pullSupabaseDataToLocal(client);
      if (res.success) {
        setSyncingState('done');
        setSyncResultMsg(`${res.message} (สัญญา: ${res.pulledCount?.contracts || 0}, เบิกจ่าย: ${res.pulledCount?.disbursements || 0}, งวดชำระ: ${res.pulledCount?.payments || 0}, ประวัติชำระ: ${res.pulledCount?.repayments || 0})`);
        
        // Refresh page instantly so components reload state
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setSyncingState('failed');
        setSyncResultMsg(res.message);
      }
    } catch (err: any) {
      setSyncingState('failed');
      setSyncResultMsg(err?.message || 'Failed pulling remote tables.');
    }
  };

  const handleCopySQL = () => {
    const sql = getSupabaseSQLMigration();
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans text-slate-800 antialiased selection:bg-[#41C3DB]/30 selection:text-slate-900">
      
      {/* Sidebar for Desktop */}
      <aside className="w-64 bg-[#25348D] text-white hidden lg:flex flex-col shrink-0 border-r border-[#213F9A]">
        <div className="p-6 flex items-center space-x-3 border-b border-[#213F9A]">
          <div className="w-8 h-8 bg-[#41C3DB] text-[#25348D] rounded-lg flex items-center justify-center font-black text-base shadow">
            L
          </div>
          <span className="text-lg font-bold tracking-tight">CorpLMS v2.0</span>
        </div>

        <nav className="flex-1 mt-6 px-4 space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Navigation</div>
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-[#41C3DB] text-[#25348D] shadow-md' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-inherit" />
            <span>DASHBOARD OVERVIEW</span>
          </button>

          <button
            onClick={() => setActiveTab('input')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'input' ? 'bg-[#41C3DB] text-[#25348D] shadow-md' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <FileText className="w-4 h-4 text-inherit" />
            <span>INPUT CONTRACT</span>
          </button>

          <button
            onClick={() => setActiveTab('disbursement')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'disbursement' ? 'bg-[#41C3DB] text-[#25348D] shadow-md' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-inherit" />
            <span>DISBURSEMENTS</span>
          </button>

          <button
            onClick={() => setActiveTab('statement')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'statement' ? 'bg-[#41C3DB] text-[#25348D] shadow-md' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <Landmark className="w-4 h-4 text-inherit" />
            <span>STATEMENTS</span>
          </button>

          <button
            onClick={() => setActiveTab('repayment')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'repayment' ? 'bg-[#41C3DB] text-[#25348D] shadow-md' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <Coins className="w-4 h-4 text-inherit" />
            <span>REPAYMENTS</span>
          </button>
        </nav>

        <div className="p-5 border-t border-white/10 text-[10px] text-slate-400 space-y-1.5 leading-relaxed">
          <div className="flex items-center space-x-1.5">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
              connectionStatus === 'connected_missing_tables' ? 'bg-amber-400' :
              connectionStatus === 'testing' ? 'bg-sky-400 animate-spin' : 'bg-slate-400'
            }`}></div>
            <strong className="text-slate-200">
              {connectionStatus === 'connected' ? 'Supabase Connected' :
               connectionStatus === 'connected_missing_tables' ? 'Schema Incomplete' :
               connectionStatus === 'testing' ? 'Connecting...' : 'Offline Sandbox'}
            </strong>
          </div>
          <div>Node: <span className="text-white font-mono">Prod-East-01</span></div>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <div className="flex-grow flex flex-col min-h-screen lg:h-screen lg:overflow-y-auto bg-slate-50">
        
        {/* Header bar on top */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0 z-30">
          <h1 className="text-base font-bold text-slate-800 tracking-tight uppercase">
            {activeTab === 'dashboard' && 'LMS Dashboard Overview'}
            {activeTab === 'input' && 'Input Contract'}
            {activeTab === 'disbursement' && 'Disbursements Registry'}
            {activeTab === 'statement' && 'Statements Active Billings'}
            {activeTab === 'repayment' && 'Repayments Log & Tax Invoices'}
          </h1>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setShowSqlPanel(true);
                setPanelTab('sync');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#213F9A] hover:bg-[#1C3682] text-[#41C3DB] border border-[#41C3DB]/30 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
            >
              <Database className="w-3.5 h-3.5" />
              <span>SUPABASE SETTINGS</span>
            </button>

            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-700">Admin Operator</div>
              <div className="text-[10px] text-slate-400 font-bold font-mono">ID: 884-291</div>
            </div>
            
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[#25348D] text-xs">
              OP
            </div>
          </div>
        </header>

        {/* Mobile Header Block */}
        <div className="lg:hidden bg-[#25348D] text-white px-4 py-3 flex justify-between items-center border-b border-[#213F9A]">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-[#41C3DB] text-[#25348D] rounded flex items-center justify-center font-bold text-xs">L</div>
            <span className="font-extrabold text-sm tracking-tight text-white">CorpLMS v2.0</span>
          </div>
          <button
            onClick={() => {
              setShowSqlPanel(true);
              setPanelTab('sync');
            }}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#213F9A] hover:bg-[#1C3682] text-[#41C3DB] border border-[#41C3DB]/30 rounded text-xs font-bold cursor-pointer transition"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="text-[10px]">SUPABASE SYNC</span>
          </button>
        </div>

        {/* Mobile Sticky Tab bar */}
        <div className="lg:hidden bg-[#213F9A] text-white overflow-x-auto whitespace-nowrap scrollbar-none flex space-x-1 p-2 sticky top-0 z-40 border-b border-[#25348D] text-xs font-bold leading-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'dashboard' ? 'bg-[#41C3DB] text-[#25348D]' : 'text-white/80'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'input' ? 'bg-[#41C3DB] text-[#25348D]' : 'text-white/80'}`}
          >
            Input Contract
          </button>
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'disbursement' ? 'bg-[#41C3DB] text-[#25348D]' : 'text-white/80'}`}
          >
            Disbursement
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'statement' ? 'bg-[#41C3DB] text-[#25348D]' : 'text-white/80'}`}
          >
            Statement
          </button>
          <button
            onClick={() => setActiveTab('repayment')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'repayment' ? 'bg-[#41C3DB] text-[#25348D]' : 'text-white/80'}`}
          >
            Repayment
          </button>
        </div>

        {/* Main Body Stage Area */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'input' && <InputContract />}
          {activeTab === 'disbursement' && <Disbursement />}
          {activeTab === 'statement' && <Statement />}
          {activeTab === 'repayment' && <Repayment />}
        </main>

        {/* Corporate branding Footer */}
        <footer className="bg-white border-t border-slate-200 px-6 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 shrink-0 gap-3">
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${
                connectionStatus === 'connected' ? 'bg-emerald-500' :
                connectionStatus === 'connected_missing_tables' ? 'bg-amber-500' : 'bg-slate-300'
              }`}></div>
              <span className="font-semibold text-slate-600">
                {connectionStatus === 'connected' ? 'Supabase Sync Active' :
                 connectionStatus === 'connected_missing_tables' ? 'Database Needs Schema SQL' : 'Simulated Sandbox Mode'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Version 1.4.2-stable</div>
          </div>
          <div className="text-center sm:text-right text-slate-400 font-semibold">
            © 2026 LMS Co., Ltd. Enterprise All Rights Reserved.
          </div>
        </footer>

      </div>

      {/* Drawer Panel of Supabase Migration Guideline */}
      {showSqlPanel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-slate-900 text-slate-100 max-w-2xl w-full p-8 overflow-y-auto flex flex-col h-full shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Database className="w-6 h-6 text-[#41C3DB]" />
                <h3 className="text-base font-bold text-[#41C3DB]">เชื่อมต่อคลาวด์ฐานข้อมูล Supabase</h3>
              </div>
              <button
                onClick={() => setShowSqlPanel(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              >
                ✕ Close
              </button>
            </div>

            {/* Tab navigation inside drawer */}
            <div className="flex border-b border-slate-800 mb-6 font-bold text-xs select-none">
              <button
                onClick={() => setPanelTab('sync')}
                className={`py-3 px-4 border-b-2 transition cursor-pointer ${
                  panelTab === 'sync' ? 'border-[#41C3DB] text-[#41C3DB]' : 'border-transparent text-slate-400 hover:text-slate-250'
                }`}
              >
                1. เชื่อมต่อและซิงค์ข้อมูล (Cloud Sync)
              </button>
              <button
                onClick={() => setPanelTab('sql')}
                className={`py-3 px-4 border-b-2 transition cursor-pointer ${
                  panelTab === 'sql' ? 'border-[#41C3DB] text-[#41C3DB]' : 'border-transparent text-slate-400 hover:text-slate-255'
                }`}
              >
                2. สคริปต์ตรวจตารางระบบ (SQL Script)
              </button>
            </div>

            {panelTab === 'sync' ? (
              <div className="space-y-6 flex-1 flex flex-col">
                <p className="text-slate-400 text-xs leading-relaxed">
                  เชื่อมโยงพอร์ทัลคาร์บอนแบงก์และระบบบริหารพอร์ตเงินกู้ยืม (LMS) ของคุณเข้ากับฐานข้อมูลคลาวด์ <strong>Supabase</strong> จริง เพื่อทดสอบการบันทึกข้อมูล สร้างและรับงวดชำระเงินจริง 100% ข้ามเครื่องหรือแชร์ลิงก์ได้จริงโดยข้อมูลจะคงอยู่ถาวร
                </p>

                {/* Connection Status Banner */}
                <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                  connectionStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
                  connectionStatus === 'connected_missing_tables' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                  connectionStatus === 'testing' ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' :
                  connectionStatus === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
                  'bg-slate-800/40 border-slate-700/60 text-slate-400'
                }`}>
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5 shrink-0">
                      {connectionStatus === 'connected' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                      {connectionStatus === 'connected_missing_tables' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                      {connectionStatus === 'testing' && <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />}
                      {connectionStatus === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
                      {connectionStatus === 'disconnected' && <Database className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="font-extrabold flex justify-between">
                        <span>สถานะระบบการเชื่อมต่อ:</span>
                        <span className="uppercase font-mono text-[10px] tracking-wider font-extrabold">
                          {connectionStatus === 'connected' && 'CONNECTED (HEALTHY)'}
                          {connectionStatus === 'connected_missing_tables' && 'CONNECTED (MISSING TABLES)'}
                          {connectionStatus === 'testing' && 'PEERING CONNECT...'}
                          {connectionStatus === 'error' && 'CONNECTION ERROR'}
                          {connectionStatus === 'disconnected' && 'OFFLINE SANDBOX'}
                        </span>
                      </div>
                      <p className="text-slate-300 font-medium">{connectionMessage || 'ยังไม่มีการกำหนดค่าโปรเจกต์ Supabase ข้อมูลทั้งหมดจัดเก็บจำลองบนเว็บบราวเซอร์ปัจจุบัน (Local Storage)'}</p>
                      
                      {connectionStatus === 'connected_missing_tables' && missingTables.length > 0 && (
                        <div className="mt-2.5 p-2.5 bg-slate-950/60 rounded border border-amber-500/20 text-[10px] text-amber-400 space-y-1.5">
                          <strong className="block text-[#41C3DB] font-extrabold pb-0.5">กรุณารันสคริปต์ SQL ขาดตารางดังต่อไปนี้เพื่อให้ระบบพร้อมทำงาน:</strong>
                          <div className="flex flex-wrap gap-1.5 font-mono">
                            {missingTables.map(t => (
                              <span key={t} className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-bold">public.{t}</span>
                            ))}
                          </div>
                          <span className="block text-slate-400 text-[9px] leading-relaxed pt-1">
                            (คลิกเพื่อเปลี่ยนแท็บเป็น <strong>"สคริปต์ตรวจตารางระบบ"</strong> ด้านบน คัดลอกสคริปต์ทั้งหมดไปรันใน Supabase SQL Editor แล้วกดยืนยันการเชื่อมต่อเพื่อทดสอบใช้งานอีกครั้ง)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connection Form */}
                <form onSubmit={handleConnect} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                        Supabase Project URL (API URL)
                      </label>
                      <input
                        type="url"
                        placeholder="https://yourprojectid.supabase.co"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        className="w-full bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#41C3DB]/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
                        <span>Anon Key (Public API Key)</span>
                        <span className="text-slate-500 font-normal tracking-normal lowercase">safe client anon keys only</span>
                      </label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={supabaseKey}
                        onChange={(e) => setSupabaseKey(e.target.value)}
                        className="w-full bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#41C3DB]/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      id="auto-sync-opt"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="w-4 h-4 rounded text-[#41C3DB] accent-[#41C3DB] focus:ring-0 bg-slate-900 border-slate-800 cursor-pointer mt-0.5"
                    />
                    <label htmlFor="auto-sync-opt" className="cursor-pointer font-medium leading-normal">
                      <strong className="text-slate-300 font-bold block">ซิงค์ออนไลน์เรียลไทม์ (Auto real-time sync with cloud DB)</strong>
                      <span className="block mt-0.5 text-[10px] text-slate-500 leading-normal">เมื่อคุณทำรายการในระบบจริง ระบบจะผลักข้อมูลขึ้นคลาวด์ปลอดภัยโดยไม่ต้องคลิกกดปุ่มซิงค์ด้วยตนเอง</span>
                    </label>
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="submit"
                      disabled={connectionStatus === 'testing'}
                      className="flex-1 py-2.5 bg-[#41C3DB] text-[#25348D] hover:bg-[#34b4cc] disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                    >
                      {connectionStatus === 'testing' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังตรวจสอบสัญญาระบบ...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5" />
                          <span>เชื่อมต่อระบบคลาวด์ Supabase</span>
                        </>
                      )}
                    </button>

                    {connectionStatus !== 'disconnected' && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg text-xs font-bold transition text-slate-300 cursor-pointer"
                      >
                        ตัดการเชื่อมต่อ
                      </button>
                    )}
                  </div>
                </form>

                {/* Cloud Replication Stage Section */}
                {(connectionStatus === 'connected' || connectionStatus === 'connected_missing_tables') && (
                  <div className="mt-4 p-5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
                    <div className="flex items-center space-x-2 text-xs font-bold text-[#41C3DB]">
                      <ArrowLeftRight className="w-4 h-4 border-none" />
                      <span>ศูนย์ควบคุมสัญญานข้อมูลออฟไลน์ & คลาวด์</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      เนื่องจากคุณเพิ่งทำการเชื่อมต่อใหม่ คุณสามารถทำการดาวน์โหลดฐานข้อมูลเดิมที่มีอยู่บนระบบคลาวด์ของคุณลงมาใช้งานบนเครื่องคอมพิวเตอร์ปัจจุบัน หรือเลือกอัปโหลดชุดข้อมูลจำลองต้นแบบ (3 สัญญากิจการปัจจุบัน) ที่กำลังจำลองอยู่ ไปสร้างฐานและเติมค่า Seeding เริ่มต้นในตารางได้ฟรีทันที!
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handlePushData}
                        disabled={syncingState === 'pushing' || syncingState === 'pulling'}
                        className="py-2.5 bg-[#25348D] hover:bg-[#213F9A] text-white border border-[#213F9A] rounded-lg text-xs font-extrabold cursor-pointer transition flex flex-col items-center justify-center space-y-1 shadow disabled:opacity-50"
                      >
                        <span className="text-[9px] text-[#41C3DB] uppercase font-bold tracking-widest font-mono">Push Local DB</span>
                        <span>อัปโหลดข้อมูล Local สู่คลาวด์</span>
                      </button>

                      <button
                        onClick={handlePullData}
                        disabled={syncingState === 'pushing' || syncingState === 'pulling'}
                        className="py-2.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-900 text-emerald-200 rounded-lg text-xs font-extrabold cursor-pointer transition flex flex-col items-center justify-center space-y-1 shadow disabled:opacity-50"
                      >
                        <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-widest font-mono">Pull Cloud Live</span>
                        <span>ดาวน์โหลดคลาวด์ลงมาใช้งาน</span>
                      </button>
                    </div>

                    {syncingState !== 'idle' && (
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs leading-normal">
                        <div className="flex items-center space-x-2 font-bold mb-1">
                          {(syncingState === 'pushing' || syncingState === 'pulling') ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#41C3DB]" />
                          ) : syncingState === 'done' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span className={
                            syncingState === 'done' ? 'text-emerald-400' :
                            syncingState === 'failed' ? 'text-rose-400' : 'text-[#41C3DB]'
                          }>
                            {syncingState === 'pushing' && 'กำลังดำเนินการอัปโหลดประสานข้อมูล...'}
                            {syncingState === 'pulling' && 'กำลังดาวน์โหลดข้อมูลและบันทึก...'}
                            {syncingState === 'done' && 'การดำเนินการถ่ายโอนสำเร็จแล้ว!'}
                            {syncingState === 'failed' && 'เกิดข้อผิดพลาดในการรับส่งไฟล์ข้อมูล'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[10px] sm:text-xs font-mono leading-relaxed">{syncResultMsg}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 flex-1 flex flex-col">
                <p className="text-xs text-slate-400 leading-relaxed">
                  ใช้ชุดสคริปต์ SQL ด้านล่างนี้เพื่อสร้างตาราง (Tables) และ Enum Types บนระบบคลาวด์ <strong>Supabase</strong> ต้นแบบจริงขององค์กรคุณ โดยโครงสร้างฟิลด์และดาต้าเบสได้รับการทับซ้อนและแมตช์เข้ากับพอร์ทัล LMS ทันที 100%
                </p>

                {/* Instruction list */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-2 text-xs text-slate-350">
                  <span className="font-extrabold text-[#41C3DB] flex items-center">
                    <Info className="w-4 h-4 mr-1" /> ขั้นตอนการติดตั้ง:
                  </span>
                  <ol className="list-decimal pl-5 space-y-1 text-slate-400 leading-relaxed">
                    <li>เปิดไปที่หน้าคอนโซล <strong>Supabase Project Dash</strong> &rarr; เลือกเมนู <strong>SQL Editor</strong></li>
                    <li>กดคลิกปุ่ม <strong>New Query</strong> หรือสร้างคิวรี่เปล่า</li>
                    <li>กดปุ่ม <strong>Copy SQL</strong> ด้านล่าง แล้วนำไปวางในบราวเซอร์ Supabase</li>
                    <li>กดปุ่ม <strong>Run</strong> ระบบจะดำเนินการติดตั้ง Database Schema เสร็จสิ้นสมบูรณ์</li>
                  </ol>
                </div>

                {/* SQL Snippet View */}
                <div className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-850 relative font-mono text-[11px] overflow-auto max-h-[300px]">
                  <button
                    onClick={handleCopySQL}
                    className="absolute right-4 top-4 bg-slate-800 hover:bg-slate-700 text-xs px-2.5 py-1.5 rounded flex items-center space-x-1.5 transition text-[#41C3DB] cursor-pointer"
                  >
                    {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'คัดลอกแล้ว!' : 'Copy SQL'}</span>
                  </button>
                  <pre className="text-emerald-400 leading-relaxed whitespace-pre font-mono">{getSupabaseSQLMigration()}</pre>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-800 mt-6 text-center">
              <button
                onClick={() => setShowSqlPanel(false)}
                className="px-6 py-2 bg-[#25348D] hover:bg-[#213F9A] text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
              >
                กลับสู่แอปพลิเคชันหลัก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
