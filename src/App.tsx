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
import { Landmark, FileText, ArrowUpRight, Coins, LayoutDashboard, Database, Info, Copy, ClipboardCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'disbursement' | 'statement' | 'repayment'>('dashboard');
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Bootstrap db and run daily overdue audit on load
    initializeDB();
    runDailyAudit();
  }, []);

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
          <div className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            <strong className="text-slate-300">Supabase DB Link</strong>
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
              onClick={() => setShowSqlPanel(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#213F9A] hover:bg-[#1C3682] text-[#41C3DB] border border-[#41C3DB]/30 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
            >
              <Database className="w-3.5 h-3.5" />
              <span>SUPABASE SQL</span>
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
            onClick={() => setShowSqlPanel(true)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#213F9A] hover:bg-[#1C3682] text-[#41C3DB] border border-[#41C3DB]/30 rounded text-xs font-bold cursor-pointer transition"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="text-[10px]">SUPABASE SQL</span>
          </button>
        </div>

        {/* Mobile Sticky Tab bar */}
        <div className="lg:hidden bg-[#213F9A] text-white overflow-x-auto whitespace-nowrap scrollbar-none flex space-x-1 p-2 sticky top-0 z-40 border-b border-[#25348D] text-xs font-bold leading-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'dashboard' ? 'bg-[#41C3DB] text-[#25348D] font-bold' : 'text-white/80'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'input' ? 'bg-[#41C3DB] text-[#25348D] font-bold' : 'text-white/80'}`}
          >
            Input Contract
          </button>
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'disbursement' ? 'bg-[#41C3DB] text-[#25348D] font-bold' : 'text-white/80'}`}
          >
            Disbursement
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'statement' ? 'bg-[#41C3DB] text-[#25348D] font-bold' : 'text-white/80'}`}
          >
            Statement
          </button>
          <button
            onClick={() => setActiveTab('repayment')}
            className={`px-4 py-2 rounded-lg cursor-pointer transition ${activeTab === 'repayment' ? 'bg-[#41C3DB] text-[#25348D] font-bold' : 'text-white/80'}`}
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
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
              <span className="font-semibold text-slate-600">Supabase Connected</span>
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
                <h3 className="text-base font-bold text-[#41C3DB]">Supabase SQL Database Migration</h3>
              </div>
              <button
                onClick={() => setShowSqlPanel(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              ใช้ชุดสคริปต์ SQL ด้านล่างนี้เพื่อสร้างตาราง (Tables) และ Enum Types บนระบบคลาวด์ <strong>Supabase</strong> ต้นแบบจริงขององค์กรคุณ โดยโครงสร้างฟิลด์และดาต้เบสได้รับการทับซ้อนและแมตช์เข้ากับพอร์ทัล LMS ทันที 100%
            </p>

            {/* Instruction list */}
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-2 text-xs text-slate-300 mb-6">
              <span className="font-extrabold text-[#41C3DB] flex items-center">
                <Info className="w-4 h-4 mr-1" /> ขั้นตอนการเชื่อมต่อ Supabase จริง:
              </span>
              <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                <li>ไปที่คอนโซล Supabase &rarr; เข้าเมนู <strong>SQL Editor</strong></li>
                <li>กด <strong>New Query</strong> &rarr; วางข้อความ SQL ด้านล่างทั้งหมด</li>
                <li>กด <strong>Run</strong> ระบบจะติดตั้ง Database Schema ทั้งหมด</li>
                <li>แก้ไขชุด API Key และตัวเชื่อมต่อ DB ในโปรเจกต์ของคุณเพื่อซิงค์ข้อมูลจริงได้ทันที</li>
              </ol>
            </div>

            {/* SQL Snippet View */}
            <div className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-800 relative font-mono text-[11px] overflow-auto max-h-[400px]">
              <button
                onClick={handleCopySQL}
                className="absolute right-4 top-4 bg-slate-800 hover:bg-slate-700 text-xs px-2.5 py-1.5 rounded flex items-center space-x-1.5 transition text-[#41C3DB] cursor-pointer"
              >
                {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'คัดลอกแล้ว!' : 'Copy SQL'}</span>
              </button>
              <pre className="text-emerald-400 leading-relaxed whitespace-pre font-mono">{getSupabaseSQLMigration()}</pre>
            </div>

            <div className="pt-6 border-t border-slate-800 mt-6 text-center">
              <button
                onClick={() => setShowSqlPanel(false)}
                className="px-6 py-2 bg-[#25348D] text-white hover:bg-[#213F9A] text-xs font-bold rounded-lg transition"
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
