/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeDB, getSupabaseSQLMigration, runDailyAudit, isSandboxActive, enterSandboxMode, exitSandboxMode, resetSandboxData } from './dbStore';
import Dashboard from './components/Dashboard';
import InputContract from './components/InputContract';
import Disbursement from './components/Disbursement';
import Statement from './components/Statement';
import Repayment from './components/Repayment';
import Parameters from './components/Parameters';
import Accounting from './components/Accounting';
import DbInspectorModal from './components/DbInspectorModal';
import { 
  getSavedSupabaseConfig, 
  saveSupabaseConfig, 
  clearSupabaseConfig, 
  getSupabaseClient, 
  testSupabaseConnection,
  fetchServerSupabaseConfig
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
  RefreshCw,
  SlidersHorizontal,
  BookOpen
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'disbursement' | 'statement' | 'repayment' | 'parameters' | 'accounting'>('dashboard');
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Syncing states
  const [isInitialSyncing, setIsInitialSyncing] = useState(true);

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

  // Modal states
  const [isDbInspectorOpen, setIsDbInspectorOpen] = useState(false);

  // Sandbox Mode states
  const [sandboxActive, setSandboxActive] = useState(isSandboxActive());

  const handleToggleSandbox = (active: boolean) => {
    if (active) {
      enterSandboxMode();
    } else {
      exitSandboxMode();
    }
    setSandboxActive(active);
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleResetSandbox = () => {
    resetSandboxData();
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  useEffect(() => {
    // Bootstrap db and run daily overdue audit on load
    initializeDB();
    runDailyAudit();

    // Load initial config asynchronously from server, falling back to localStorage/env
    async function initSupabase() {
      setIsInitialSyncing(true);
      const serverConfig = await fetchServerSupabaseConfig();
      const config = getSavedSupabaseConfig();
      
      const urlToUse = serverConfig?.url || config.url;
      const keyToUse = serverConfig?.key || config.key;

      setSupabaseUrl(urlToUse);
      setSupabaseKey(keyToUse);
      setAutoSync(config.autoSync);
      
      if (urlToUse && keyToUse) {
        await testConnection(urlToUse, keyToUse, config.autoSync);
      }
      setIsInitialSyncing(false);
    }

    initSupabase();
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
          
          // Auto sync database to local storage
          try {
            const client = getSupabaseClient();
            if (client) {
              await pullSupabaseDataToLocal(client);
            }
          } catch (syncErr) {
            console.error('Auto loading pull failed:', syncErr);
          }
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
    // Silent delay and clean page reload to refresh states for all views
    setTimeout(() => {
      window.location.reload();
    }, 1200);
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
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col lg:flex-row font-sans text-[#1D2023] antialiased selection:bg-[#1463F3]/20 selection:text-slate-900">
      
      {/* Sidebar for Desktop - Light Styled matching Nexus Mockup exactly */}
      <aside className={`bg-white border-r border-[#CCD0D8] hidden lg:flex flex-col shrink-0 transition-all duration-300 ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className="p-5 flex items-center justify-between border-b border-[#F0F1F3]">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            {/* Nexus brand emblem */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#1463F3] to-[#84A4FC] flex items-center justify-center font-black text-white text-sm shadow-sm shrink-0">
              N
            </div>
            {!isSidebarCollapsed && (
              <span className="text-base font-extrabold tracking-tight text-[#1D2023] font-sans whitespace-nowrap">
                Nexus <span className="text-xs font-medium text-slate-400 font-mono">LMS</span>
              </span>
            )}
          </div>
          <button 
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg border border-slate-150 text-slate-400 hover:text-[#1D2023] hover:bg-slate-50 cursor-pointer transition text-xs font-bold"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="flex-grow mt-5 px-4 space-y-5 overflow-y-auto">
          {/* Group 1: GENERAL */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider font-sans">General</div>
            )}
            
            <button
              onClick={() => setActiveTab('dashboard')}
              title="Dashboard Overview"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-[#F0F3F9] text-[#1463F3] font-bold' 
                  : 'text-slate-500 hover:text-[#1D2023] hover:bg-slate-50'
              } ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-[#1463F3]' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && <span className="truncate">Dashboard</span>}
            </button>

            <button
              onClick={() => setActiveTab('repayment')}
              title="Repayments Log & Payment"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'repayment' 
                  ? 'bg-[#F0F3F9] text-[#1463F3] font-bold' 
                  : 'text-slate-500 hover:text-[#1D2023] hover:bg-slate-50'
              } ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <Coins className={`w-4 h-4 shrink-0 ${activeTab === 'repayment' ? 'text-[#1463F3]' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && <span className="truncate">Payment (เงินคืน)</span>}
            </button>

            <button
              onClick={() => setActiveTab('input')}
              title="Customers & Contracts Registry"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'input' 
                  ? 'bg-[#F0F3F9] text-[#1463F3] font-bold' 
                  : 'text-slate-500 hover:text-[#1D2023] hover:bg-slate-50'
              } ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'input' ? 'text-[#1463F3]' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && <span className="truncate flex-1 text-left">Customers สัญญา</span>}
            </button>

            <button
              onClick={() => setActiveTab('statement')}
              title="Billing Statements Active"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'statement' 
                  ? 'bg-[#F0F3F9] text-[#1463F3] font-bold' 
                  : 'text-slate-500 hover:text-[#1D2023] hover:bg-slate-50'
              } ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <Landmark className={`w-4 h-4 shrink-0 ${activeTab === 'statement' ? 'text-[#1463F3]' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && (
                <div className="flex items-center justify-between flex-grow min-w-0">
                  <span className="truncate">Statements บิล</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">3</span>
                </div>
              )}
            </button>
          </div>

          {/* Group 2: TOOLS */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider font-sans">Tools</div>
            )}

            <button
              onClick={() => setActiveTab('disbursement')}
              title="Disbursements Register"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'disbursement' 
                  ? 'bg-[#F0F3F9] text-[#1463F3] font-bold' 
                  : 'text-slate-500 hover:text-[#1D2023] hover:bg-slate-50'
              } ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <ArrowUpRight className={`w-4 h-4 shrink-0 ${activeTab === 'disbursement' ? 'text-[#1463F3]' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && <span className="truncate">Disbursment เบิก</span>}
            </button>

            <button
              onClick={() => setActiveTab('parameters')}
              title="System Parameters & Rates"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-[11px] lg:text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'parameters' 
                  ? 'bg-[#F0F3F9] text-[#1463F3] font-bold' 
                  : 'text-slate-500 hover:text-[#1D2023] hover:bg-slate-50'
              } ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <SlidersHorizontal className={`w-4 h-4 shrink-0 ${activeTab === 'parameters' ? 'text-[#1463F3]' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && <span className="truncate">LMS Parameters</span>}
            </button>

            <button
              onClick={() => setActiveTab('accounting')}
              title="Accounting Journal Entries"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-[11px] lg:text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'accounting' 
                  ? 'bg-[#F0F3F9] text-[#1463F3] font-bold' 
                  : 'text-slate-500 hover:text-[#1D2023] hover:bg-slate-50'
              } ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
            >
              <BookOpen className={`w-4 h-4 shrink-0 ${activeTab === 'accounting' ? 'text-[#1463F3]' : 'text-slate-400'}`} />
              {!isSidebarCollapsed && <span className="truncate">Accounting บัญชี</span>}
            </button>
          </div>

          {/* Group 3: SUPPORT */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider font-sans">Support</div>
            )}

            <button
              onClick={() => {
                setShowSqlPanel(true);
                setPanelTab('sync');
              }}
              title="Supabase Database Settings"
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs text-slate-500 hover:text-[#1D2023] hover:bg-slate-50 cursor-pointer transition ${
                isSidebarCollapsed ? 'justify-center' : 'space-x-3'
              }`}
            >
              <Database className="w-4 h-4 text-slate-400 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Database Sync</span>}
            </button>
          </div>
        </nav>

        {/* User Card at bottom-left exactly matching Team segment */}
        <div className="p-4 border-t border-[#F0F1F3] shrink-0 space-y-3">
          {!isSidebarCollapsed && (
            <div className="bg-[#F8F9FA] p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-[#1463F3] text-white flex items-center justify-center font-bold text-[10px]">
                  TM
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-[11px]">Team Marketing</div>
                  <div className="text-[10px] text-slate-400">Main Account</div>
                </div>
              </div>
              <span className="text-slate-400 text-[9px]">↕</span>
            </div>
          )}

          {/* Sandbox Toggle Option */}
          {!isSidebarCollapsed && (
            <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-800 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${sandboxActive ? 'bg-emerald-500' : 'bg-amber-400'} animate-pulse`}></span>
                  โหมดทดสอบ {sandboxActive ? 'Active' : 'Off'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sandboxActive}
                    onChange={(e) => handleToggleSandbox(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                จำลองข้อมูลสำหรับการทดลองเล่น รับชำระเงิน หรือคำนวณดอกเบี้ย โดยไม่กระทบฐานข้อมูลจริงบนคลาวด์
              </p>
              {sandboxActive && (
                <button
                  type="button"
                  onClick={handleResetSandbox}
                  className="w-full py-1 text-[9px] bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer transition text-center uppercase tracking-wider"
                  title="เริ่มทดสอบใหม่ ดึง snapshot ล่าสุดจาก DB ลง sandbox ใหม่"
                >
                  Reset Sandbox Data (คัดลอกจาก DB)
                </button>
              )}
            </div>
          )}

          {!isSidebarCollapsed && (
            <button
              onClick={() => {
                setShowSqlPanel(true);
                setPanelTab('sync');
              }}
              className="w-full py-2 bg-white hover:bg-slate-50 text-[#1D2023] border border-[#CCD0D8] rounded-xl text-xs font-bold font-sans cursor-pointer transition shadow-xs text-center"
            >
              Configure Cloud DB (Supabase)
            </button>
          )}

          <div className="text-center text-[9px] text-slate-400 font-medium">
            {!isSidebarCollapsed && <span>@ 2026 Nexus LMS Inc.</span>}
          </div>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <div className="flex-grow flex flex-col min-h-screen lg:h-screen lg:overflow-y-auto">
        
        {/* Header bar on top - Light colored, premium style from Nexus */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 lg:px-8 shrink-0 z-30">
          
          {/* Custom Search Box looking like screenshot */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="ค้นหารายชื่อผู้เช่าชื้อหรือข้อมูลสัญญา... (Search ⌘+F)"
                onChange={(e) => {
                  // Custom window event to dynamically stream search filtering inside input tables or listings
                  const event = new CustomEvent('global-contract-search', { detail: e.target.value });
                  window.dispatchEvent(event);
                }}
                className="w-72 bg-[#F8F9FB] pl-10 pr-10 py-2 rounded-xl text-xs font-semibold text-[#1D2023] placeholder-slate-400 border border-transparent focus:outline-none focus:border-[#1463F3] focus:bg-white transition"
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 hidden sm:inline-flex">
                ⌘ + F
              </span>
            </div>
          </div>

          {/* Right utility items */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsDbInspectorOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="ตรวจสอบตารางข้อมูลดิบและค่า due_date จาก Database"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Raw DB Inspector</span>
            </button>

            {/* User Profile matching 'Young Alaska' from screenshot */}
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-[#1D2023]">Young Alaska</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Business Operator</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#1463F3]/10 border border-[#1463F3]/20 flex items-center justify-center font-bold text-[#1463F3] text-xs shadow-xs shrink-0 select-none">
                YA
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header Block */}
        <div className="lg:hidden bg-white text-[#1D2023] px-4 py-3 flex justify-between items-center border-b border-[#E5E7EB]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-tr from-[#1463F3] to-[#84A4FC] text-white rounded flex items-center justify-center font-bold text-xs shadow-xs">N</div>
            <span className="font-extrabold text-xs tracking-tight text-[#1D2023] font-sans uppercase">Nexus LMS</span>
          </div>
          <button
            onClick={() => {
              setShowSqlPanel(true);
              setPanelTab('sync');
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#F0F3F9] hover:bg-sky-100 text-[#1463F3] rounded-lg text-xs font-bold cursor-pointer transition"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="text-[10px]">Cloud settings</span>
          </button>
        </div>

        {/* Mobile Sticky Tab bar with dynamic visibleTabs filtering */}
        <div className="lg:hidden bg-white text-slate-600 overflow-x-auto whitespace-nowrap scrollbar-none flex space-x-1.5 p-2.5 sticky top-0 z-40 border-b border-[#E5E7EB] text-[10px] font-bold leading-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-2 rounded-lg cursor-pointer transition ${activeTab === 'dashboard' ? 'bg-[#F0F3F9] text-[#1463F3] font-extrabold' : 'hover:bg-slate-50'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('repayment')}
            className={`px-3 py-2 rounded-lg cursor-pointer transition ${activeTab === 'repayment' ? 'bg-[#F0F3F9] text-[#1463F3] font-extrabold' : 'hover:bg-slate-50'}`}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`px-3 py-2 rounded-lg cursor-pointer transition ${activeTab === 'input' ? 'bg-[#F0F3F9] text-[#1463F3] font-extrabold' : 'hover:bg-slate-50'}`}
          >
            Contracts
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`px-3 py-2 rounded-lg cursor-pointer transition ${activeTab === 'statement' ? 'bg-[#F0F3F9] text-[#1463F3] font-extrabold' : 'hover:bg-slate-50'}`}
          >
            Statements
          </button>
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`px-3 py-2 rounded-lg cursor-pointer transition ${activeTab === 'disbursement' ? 'bg-[#F0F3F9] text-[#1463F3] font-extrabold' : 'hover:bg-slate-50'}`}
          >
            Disbursements
          </button>
          <button
            onClick={() => setActiveTab('parameters')}
            className={`px-3 py-2 rounded-lg cursor-pointer transition ${activeTab === 'parameters' ? 'bg-[#F0F3F9] text-[#1463F3] font-extrabold' : 'hover:bg-slate-50'}`}
          >
            Parameters
          </button>
          <button
            onClick={() => setActiveTab('accounting')}
            className={`px-3 py-2 rounded-lg cursor-pointer transition ${activeTab === 'accounting' ? 'bg-[#F0F3F9] text-[#1463F3] font-extrabold' : 'hover:bg-slate-50'}`}
          >
            Accounting
          </button>
        </div>

        {/* Sandbox Global Warning Banner */}
        {sandboxActive && (
          <div className="bg-[#FFF9E6] border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-4 text-xs shrink-0 select-none shadow-xs font-sans">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-amber-800 font-bold">
                คุณกำลังใช้งาน [โหมดจำลองทดสอบ Sandbox 🔒]
              </span>
              <span className="text-amber-600 hidden sm:inline font-medium">
                — ข้อมูลทั้งหมดถูกจำลองแยกออกมา คุณสามารถทดลองชำระเงิน เบิกถอน หรือลงระบบได้เต็มที่ โดยระบบจะไม่บันทึกลงคลาวด์จริง
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleResetSandbox}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                title="ล้างข้อมูลจำลองและดึง snapshot ล่าสุดจาก DB ใหม่"
              >
                Reset Sandbox
              </button>
              <button
                onClick={() => handleToggleSandbox(false)}
                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-bold transition cursor-pointer"
              >
                ออกจากโหมดจำลอง
              </button>
            </div>
          </div>
        )}

        {/* Main Body Stage Area */}
        <main className="flex-grow p-4 sm:p-5 lg:p-6 overflow-y-auto bg-[#F4F5F7]">
          {isInitialSyncing ? (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center space-y-4 font-sans py-16">
              <div className="w-12 h-12 rounded-2xl bg-[#1463F3]/10 flex items-center justify-center border border-[#1463F3]/20 text-[#1463F3]">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <div className="text-center space-y-1.5 max-w-sm">
                <h4 className="font-extrabold text-sm text-slate-800">กำลังเชื่อมต่อฐานข้อมูล Supabase อัตโนมัติ</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">กำลังซิงโครไนซ์ข้อมูลสัญญากระดาษและลดต้นลดดอกล่าสุดจากเซิร์ฟเวอร์เพื่อให้พาร์ตเนอร์พร้อมทำงานทันที</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'input' && <InputContract />}
              {activeTab === 'disbursement' && <Disbursement />}
              {activeTab === 'statement' && <Statement />}
              {activeTab === 'repayment' && <Repayment />}
              {activeTab === 'parameters' && <Parameters />}
              {activeTab === 'accounting' && <Accounting />}
            </>
          )}
        </main>

        {/* Corporate branding Footer */}
        <footer className="bg-white border-t border-[#E5E7EB] px-6 sm:px-8 py-3 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 shrink-0 gap-3">
          <div className="flex items-center space-x-6 font-sans">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${
                connectionStatus === 'connected' ? 'bg-emerald-500' :
                connectionStatus === 'connected_missing_tables' ? 'bg-amber-500' : 'bg-slate-350'
              }`}></div>
              <span className="font-bold text-slate-500">
                {connectionStatus === 'connected' ? 'Supabase Sync Active' :
                 connectionStatus === 'connected_missing_tables' ? 'Database Needs Schema SQL' : 'Simulated Sandbox Mode'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Version 2.0.0-stable</div>
          </div>
          <div className="text-center sm:text-right text-slate-400 font-bold font-mono">
            © 2026 CorpLMS Enterprise All Rights Reserved.
          </div>
        </footer>

      </div>

      {/* Drawer Panel of Supabase Migration Guideline */}
      {showSqlPanel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-slate-900 text-slate-100 max-w-2xl w-full p-8 overflow-y-auto flex flex-col h-full shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Database className="w-6 h-6 text-sky-400" />
                <h3 className="text-base font-bold text-sky-400">เชื่อมต่อคลาวด์ฐานข้อมูล Supabase</h3>
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
                  panelTab === 'sync' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-250'
                }`}
              >
                1. เชื่อมต่อและซิงค์ข้อมูล (Cloud Sync)
              </button>
              <button
                onClick={() => setPanelTab('sql')}
                className={`py-3 px-4 border-b-2 transition cursor-pointer ${
                  panelTab === 'sql' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-255'
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
                          <strong className="block text-sky-400 font-extrabold pb-0.5">กรุณารันสคริปต์ SQL ขาดตารางดังต่อไปนี้เพื่อให้ระบบพร้อมทำงาน:</strong>
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
                        className="w-full bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
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
                        className="w-full bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500/50"
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
                      className="w-4 h-4 rounded text-sky-500 accent-sky-500 focus:ring-0 bg-slate-900 border-slate-800 cursor-pointer mt-0.5"
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
                      className="flex-1 py-2.5 bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
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
                    <div className="flex items-center space-x-2 text-xs font-bold text-sky-400">
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
                        className="py-2.5 bg-sky-600 hover:bg-sky-700 text-white border border-sky-600 rounded-lg text-xs font-extrabold cursor-pointer transition flex flex-col items-center justify-center space-y-1 shadow disabled:opacity-50"
                      >
                        <span className="text-[9px] text-sky-200 uppercase font-bold tracking-widest font-mono">Push Local DB</span>
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
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-450" />
                          ) : syncingState === 'done' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span className={
                            syncingState === 'done' ? 'text-emerald-400' :
                            syncingState === 'failed' ? 'text-rose-400' : 'text-sky-400'
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
                  <span className="font-extrabold text-sky-450 flex items-center">
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
                    className="absolute right-4 top-4 bg-slate-800 hover:bg-slate-700 text-xs px-2.5 py-1.5 rounded flex items-center space-x-1.5 transition text-sky-450 cursor-pointer"
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
                className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
              >
                กลับสู่แอปพลิเคชันหลัก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Database Inspector Modal */}
      <DbInspectorModal
        isOpen={isDbInspectorOpen}
        onClose={() => setIsDbInspectorOpen(false)}
      />
    </div>
  );
}
