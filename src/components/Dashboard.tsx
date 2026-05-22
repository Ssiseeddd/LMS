import React, { useState, useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { getContracts, getDisbursements, getScheduledPayments, getRepayments } from '../dbStore';

interface ApexChartProps {
  options: any;
  series: any[];
  type: 'area' | 'bar' | 'donut';
  height?: number | string;
  width?: number | string;
}

function ApexChart({ options, series, type, height = 'auto', width = '100%' }: ApexChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ApexCharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy any existing chart instance
    if (chartInstance.current) {
      try {
        chartInstance.current.destroy();
      } catch (err) {
        console.warn('Error destroying chart:', err);
      }
      chartInstance.current = null;
    }

    const config = {
      ...options,
      chart: {
        ...(options.chart || {}),
        type,
        height,
        width
      },
      series
    };

    const chart = new ApexCharts(containerRef.current, config);
    chart.render().then(() => {
      chartInstance.current = chart;
    }).catch(err => {
      console.error('Error rendering chart:', err);
    });

    return () => {
      if (chartInstance.current) {
        try {
          chartInstance.current.destroy();
        } catch (err) {
          // ignore or warn
        }
        chartInstance.current = null;
      }
    };
  }, [options, series, type, height, width]);

  return <div ref={containerRef} className="w-full" style={{ minHeight: height }} />;
}
import { Contract, Disbursement, ScheduledPayment, Repayment } from '../types';
import { TrendingUp, Award, Layers, AlertCircle, Calendar, RefreshCcw, Landmark, Users } from 'lucide-react';

const SYSTEM_DATE = '2026-05-22';

export default function Dashboard() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);

  // Filters
  const [timeframe, setTimeframe] = useState<'Day' | 'Month' | 'Quarter' | 'Year'>('Month');
  const [selectedProduct, setSelectedProduct] = useState<'ALL' | 'HP' | 'LOAN'>('ALL');

  const [triggerUpdate, setTriggerUpdate] = useState(0);

  useEffect(() => {
    setContracts(getContracts());
    setDisbursements(getDisbursements());
    setPayments(getScheduledPayments());
    setRepayments(getRepayments());
  }, [triggerUpdate]);

  const handleRefresh = () => {
    setTriggerUpdate(prev => prev + 1);
  };

  // --- OVERVIEW COMPUTATIONS ---
  // approved
  const totalLimitAmount = contracts.reduce((sum, c) => sum + c.creditLimit, 0);
  const totalLimitUnit = contracts.length;

  // disbursed
  const totalDisbursedAmount = disbursements.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalDisbursedUnit = disbursements.length;

  // outstanding
  const totalOutstanding = contracts.reduce((sum, c) => sum + c.outstandingPrincipal, 0);

  // --- AREA CHART COMTEMPORARY (ยอดวงเงินตามเวลา) ---
  // Group disbursement amounts by YYYY-MM
  const getDisbursementTimelineData = () => {
    const sorted = [...disbursements].sort((a, b) => new Date(a.disburseDate).getTime() - new Date(b.disburseDate).getTime());
    const groups: { [key: string]: number } = {};
    
    sorted.forEach(d => {
      let key = d.disburseDate; // Day default
      if (timeframe === 'Month') {
        key = d.disburseDate.substring(0, 7); // YYYY-MM
      } else if (timeframe === 'Quarter') {
        const date = new Date(d.disburseDate);
        const q = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${q}`;
      } else if (timeframe === 'Year') {
        key = d.disburseDate.substring(0, 4); // YYYY
      }
      groups[key] = (groups[key] || 0) + Number(d.amount);
    });

    const categories = Object.keys(groups);
    const seriesData = Object.values(groups);

    // If nothing, use fallback defaults
    if (categories.length === 0) {
      return {
        series: [{ name: 'ยอดจัดสรรสินเชื่อ', data: [0] }],
        categories: ['ไม่มีข้อมูล']
      };
    }

    return {
      series: [{ name: 'ยอดการจัดสรร (เบิกใช้)', data: seriesData }],
      categories
    };
  };

  const timeline = getDisbursementTimelineData();

  const areaChartOptions = {
    chart: {
      type: 'area' as const,
      toolbar: { show: false },
      zoom: { enabled: false }
    },
    colors: ['#41C3DB'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.6,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth' as const, width: 3, colors: ['#41C3DB'] },
    xaxis: {
      categories: timeline.categories,
      labels: {
        style: { colors: '#64748b', fontFamily: 'Sarabun, sans-serif' }
      }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => {
          return new Intl.NumberFormat('th-TH', { notation: "compact", compactDisplay: "short" }).format(val);
        },
        style: { colors: '#64748b', fontFamily: 'Sarabun, sans-serif' }
      }
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: (val: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val)
      }
    }
  };

  // --- WATERFALL CHART COMPONENT ---
  // Displays: Start Ledger -> Disbursement Plus -> Repayment Minus -> Net Outstanding
  // Build a custom waterfall simulation data sequence
  const getWaterfallData = () => {
    const totalDisb = disbursements.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalRepaidPr = repayments.reduce((sum, r) => sum + r.appliedPrincipal, 0);
    const out = totalDisb - totalRepaidPr;

    // Series format for bar charts
    return {
      series: [{
        name: 'ยอดรวมกระแสเงินต้น',
        data: [
          { x: '1. ยอดเริ่มเบิกเงินสะสม', y: totalDisb, fillColor: '#213F9A' },
          { x: '2. ยอดเบิกเพิ่มใหม่', y: 0, fillColor: '#41C3DB' }, // Can render dynamic based on filter later
          { x: '3. ชำระคืนเงินต้น (-)', y: -totalRepaidPr, fillColor: '#FF4560' },
          { x: '4. คงเหลือสุทธิ (Outstanding)', y: out, fillColor: '#25348D' }
        ]
      }],
      options: {
        chart: { type: 'bar' as const, toolbar: { show: false } },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '55%',
            colors: {
              backgroundBarColors: [],
              backgroundBarOpacity: 1,
              backgroundBarRadius: 0,
            }
          }
        },
        grid: {
          borderColor: '#f1f5f9'
        },
        stroke: { width: 0 },
        dataLabels: {
          enabled: true,
          formatter: (val: number) => {
            return new Intl.NumberFormat('th-TH', { notation: 'compact', compactDisplay: 'short' }).format(Math.abs(val));
          },
          style: { colors: ['#fff'], fontSize: '11px', fontFamily: 'Sarabun' }
        },
        xaxis: {
          labels: { style: { colors: '#64748b', fontSize: '10px' } }
        },
        yaxis: {
          labels: {
            formatter: (val: number) => {
              return new Intl.NumberFormat('th-TH', { notation: 'compact', compactDisplay: 'short' }).format(val);
            },
            style: { colors: '#64748b' }
          }
        }
      }
    };
  };

  const waterfall = getWaterfallData();

  // --- AGING DASHBOARD COMPUTATIONS ---
  // Filtering contracts based on Product selection
  const filteredContracts = contracts.filter(c => {
    if (selectedProduct === 'ALL') return true;
    return c.productType === selectedProduct;
  });

  const getAgingDistribution = () => {
    const filteredIds = filteredContracts.map(c => c.id);
    const overdueSchedules = payments.filter(p => filteredIds.includes(p.contractId) && p.status === 'OVERDUE');

    let currentCount = 0;
    let currentAmount = 0;

    let bucket_1_30_count = 0;
    let bucket_1_30_amount = 0;

    let bucket_31_60_count = 0;
    let bucket_31_60_amount = 0;

    let bucket_61_90_count = 0;
    let bucket_61_90_amount = 0;

    let bucket_90plus_count = 0; // NPL Buckets
    let bucket_90plus_amount = 0;

    const todayStr = '2026-05-22';
    const today = new Date(todayStr);

    overdueSchedules.forEach(s => {
      const parentCon = filteredContracts.find(c => c.id === s.contractId);
      if (!parentCon) return;

      const diffTime = today.getTime() - new Date(s.dueDate).getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const unpaidPrincipal = s.principalDue - s.principalPaid;

      if (days <= 0) {
        currentCount++;
        currentAmount += unpaidPrincipal;
      } else if (days <= 30) {
        bucket_1_30_count++;
        bucket_1_30_amount += unpaidPrincipal;
      } else if (days <= 60) {
        bucket_31_60_count++;
        bucket_31_60_amount += unpaidPrincipal;
      } else if (days <= 90) {
        bucket_61_90_count++;
        bucket_61_90_amount += unpaidPrincipal;
      } else {
        bucket_90plus_count++;
        bucket_90plus_amount += unpaidPrincipal;
      }
    });

    // Healthy Accounts (No overdue elements)
    filteredContracts.forEach(c => {
      const activeOverdues = overdueSchedules.filter(s => s.contractId === c.id);
      if (activeOverdues.length === 0) {
        currentCount++;
        currentAmount += c.outstandingPrincipal;
      }
    });

    // Sum Total Outstanding for NPL calculation
    const totalOutSum = filteredContracts.reduce((sum, c) => sum + c.outstandingPrincipal, 0);
    // Any account with status='DEFAULT' or with 90+ days overdue is marked as NPL
    const nplOutstanding = filteredContracts
      .filter(c => c.status === 'DEFAULT' || overdueSchedules.some(s => s.contractId === c.id && (Math.ceil((today.getTime() - new Date(s.dueDate).getTime()) / (1000 * 60 * 60 * 24)) > 90)))
      .reduce((sum, c) => sum + c.outstandingPrincipal, 0);

    const nplPct = totalOutSum > 0 ? (nplOutstanding / totalOutSum) * 100 : 0;

    return {
      nplPct: Math.round(nplPct * 100) / 100,
      totalOutstanding: totalOutSum,
      totalDisbursed: filteredContracts.reduce((sum, c) => sum + c.disbursedAmount, 0),
      units: [currentCount, bucket_1_30_count, bucket_31_60_count, bucket_61_90_count, bucket_90plus_count],
      outstandings: [currentAmount, bucket_1_30_amount, bucket_31_60_amount, bucket_61_90_amount, bucket_90plus_amount]
    };
  };

  const agingData = getAgingDistribution();

  const donutOptionsUnits = {
    chart: { type: 'donut' as const },
    labels: ['ปกติ / รอดำเนินการ', 'ค้าง 1-30 วัน', 'ค้าง 31-60 วัน', 'ค้าง 61-90 วัน', 'ค้างเกิน 90 วัน (NPL)'],
    colors: ['#41C3DB', '#213F9A', '#FDA4AF', '#F43F5E', '#BE123C'],
    legend: { position: 'bottom' as const, fontFamily: 'Sarabun_sans-serif' },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: 'จำนวนสัญญาค้างจ่าย',
              formatter: () => String(agingData.units.reduce((a, b) => a + b, 0))
            }
          }
        }
      }
    }
  };

  const donutOptionsAmount = {
    chart: { type: 'donut' as const },
    labels: ['ปกติ / รอดำเนินการ', 'ค้าง 1-30 วัน', 'ค้าง 31-60 วัน', 'ค้าง 61-90 วัน', 'ค้างเกิน 90 วัน (NPL)'],
    colors: ['#41C3DB', '#213F9A', '#FDA4AF', '#F43F5E', '#BE123C'],
    legend: { position: 'bottom' as const, fontFamily: 'Sarabun_sans-serif' },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: 'เงินต้นค้างชำระรวม',
              formatter: () => '฿' + new Intl.NumberFormat('th-TH', { notation: 'compact' }).format(agingData.outstandings.reduce((a, b) => a + b, 0))
            }
          }
        }
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Title Segment */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-[#25348D] tracking-tight">ระบบบริหารจัดการพอร์ตลูกหนี้ (LMS Dashboards)</h2>
          <p className="text-slate-500 text-xs mt-1">ข้อมูลวิเคราะห์ภาพรวมวงเงินหนี้ ผลิตภัณฑ์เช่าซื้อ และสินเชื่อกลุ่มปลูกป่า (ข้อมูลจำลอง ณ วันที่ {SYSTEM_DATE})</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
        >
          <RefreshCcw className="w-4 h-4 cursor-pointer" />
          <span>ดึงข้อมูลล่าสุด</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW DASHBOARD */}
      <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <Landmark className="w-5 h-5 text-[#25348D]" />
            <h3 className="font-bold text-base text-[#25348D] tracking-tight">1. Overview Portfolio Dashboard</h3>
          </div>
          <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 text-xs">
            {(['Day', 'Month', 'Quarter', 'Year'] as const).map(option => (
              <button
                key={option}
                onClick={() => setTimeframe(option)}
                className={`px-3 py-1 cursor-pointer rounded-md font-medium transition ${timeframe === option ? 'bg-[#25348D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {option === 'Day' ? 'รายวัน' : option === 'Month' ? 'รายเดือน' : option === 'Quarter' ? 'รายไตรมาส' : 'รายปี'}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: approved */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">อนุมัติวงเงินสะสม</span>
              <span className="text-2xl font-bold text-[#25348D] mt-2 block">
                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(totalLimitAmount)}
              </span>
              <span className="text-[11px] text-[#41C3DB] font-semibold mt-1 block">จำนวนสัญญาอนุมัติ: {totalLimitUnit} สัญญา</span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-[#25348D]">
              <Award className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: drawn */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">ยอดเบิกใช้วงเงินรวม</span>
              <span className="text-2xl font-bold text-[#213F9A] mt-2 block">
                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(totalDisbursedAmount)}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">รอบการสั่งจ่ายสะสม: {totalDisbursedUnit} ครั้ง</span>
            </div>
            <div className="p-3 bg-cyan-50 rounded-xl text-[#41C3DB]">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: outstanding */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">เงินต้นคงเหลือรวม (Outstanding)</span>
              <span className="text-2xl font-bold text-[#FF4560] mt-2 block">
                {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(totalOutstanding)}
              </span>
              <span className="text-[11px] text-slate-500 font-semibold mt-1 block">อัตราจัดเก็บหนี้คงที่ในเกณฑ์ควบคุม</span>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl text-[#FF4560]">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Charts: Left Area / Right Waterfall */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="font-bold text-sm text-slate-700">ปริมาณและกรอบการเบิกใช้วงเงินแยกตามช่วงเวลา ({timeframe})</h4>
            <div className="min-h-[300px]">
              <ApexChart
                options={areaChartOptions}
                series={timeline.series}
                type="area"
                height={300}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="font-bold text-sm text-slate-700">ตารางวิเคราะห์กระแสเงินต้นคงค้าง (Waterfall Principal Ledger)</h4>
            <div className="min-h-[300px]">
              <ApexChart
                options={waterfall.options}
                series={waterfall.series}
                type="bar"
                height={300}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TAB 2: AGING DASHBOARD */}
      <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100 space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-200 pb-3 space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-base text-[#25348D] tracking-tight">2. Portfolio Aging & NPL Monitor</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">กรองผลิตภัณฑ์สินเชื่อ:</span>
            <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 text-xs">
              {(['ALL', 'HP', 'LOAN'] as const).map(pType => (
                <button
                  key={pType}
                  onClick={() => setSelectedProduct(pType)}
                  className={`px-3 py-1 cursor-pointer rounded-md font-medium transition ${selectedProduct === pType ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {pType === 'ALL' ? 'ทั้งหมด' : pType === 'HP' ? 'เช่าซื้อ (HP)' : 'เงินกู้ (Loan)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">เบิกใช้พอร์ตจัดสรรค้าง</span>
            <span className="text-xl font-bold text-slate-800 mt-1 block">
              {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(agingData.totalDisbursed)}
            </span>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm font-sans">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">เงินต้นคงเหลือจัดสรรค้าง</span>
            <span className="text-xl font-bold text-slate-800 mt-1 block">
              {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(agingData.totalOutstanding)}
            </span>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-rose-500">
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-widest block">สัดส่วนหนี้ด้อยคุณภาพ (%NPL)</span>
            <span className="text-xl font-extrabold text-[#25348D] mt-1 block">
              {agingData.nplPct}%
            </span>
          </div>
        </div>

        {/* Donut Layout aging analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-700 bg-slate-50 p-2 rounded text-center border border-slate-100">สัดส่วนคุณภาพหนี้แบ่งตามจำนวนสัญญา (Count / Unit)</h4>
            <div className="min-h-[300px] flex items-center justify-center">
              <ApexChart
                options={donutOptionsUnits}
                series={agingData.units}
                type="donut"
                width={360}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-700 bg-slate-50 p-2 rounded text-center border border-slate-100">สัดส่วนมูลหนี้ค้างเงินต้น (Outstanding Balances Amount)</h4>
            <div className="min-h-[300px] flex items-center justify-center">
              <ApexChart
                options={donutOptionsAmount}
                series={agingData.outstandings}
                type="donut"
                width={360}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
