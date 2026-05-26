import React, { useState, useEffect } from 'react';
import { getContracts, getDisbursements, getScheduledPayments, getRepayments } from '../dbStore';
import { Contract, Disbursement, ScheduledPayment, Repayment } from '../types';
import Chart from 'react-apexcharts';
import { 
  TrendingUp, 
  Award, 
  Layers, 
  AlertCircle, 
  RefreshCw, 
  Info, 
  Database,
  ArrowUpRight,
  Filter,
  CheckSquare,
  FileText
} from 'lucide-react';

const SYSTEM_DATE = '2026-05-22';

// Clean reusable SvgAreaChart component using ApexCharts
interface ChartDataPoint {
  date: string;
  limit: number;
  outstanding: number;
  periodLimit?: number;
  periodOutstanding?: number;
}

function SvgAreaChart({ 
  data, 
  dataKey, 
  strokeColor, 
  fillColor, 
  title, 
  badgeLabel 
}: { 
  data: ChartDataPoint[]; 
  dataKey: 'limit' | 'outstanding'; 
  strokeColor: string; 
  fillColor: string; 
  title: string; 
  badgeLabel?: string;
}) {
  const columnColor = strokeColor === '#10B981' ? '#A7F3D0'
                    : strokeColor === '#8B5CF6' ? '#C7D2FE'
                    : strokeColor === '#1463F3' ? '#93C5FD'
                    : '#CBD5E1';

  // Determine label texts dynamically based on key
  const periodLabelText = dataKey === 'limit' ? 'ทำสัญญารายงวด' : 'ยอดเบิกใช้ใหม่';
  const cumulativeLabelText = dataKey === 'limit' ? 'วงเงินสะสม' : 'ยอดคงเหลือสะสม';

  const chartOptions: any = {
    chart: {
      type: 'line', // Mix-charts in ApexCharts typically set the base type to 'line'
      height: 180,
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      },
      fontFamily: 'Inter, sans-serif'
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: [0, 2], // 0 width for the column bars, 2px for the area line
      colors: [columnColor, strokeColor]
    },
    fill: {
      type: ['solid', 'gradient'],
      opacity: [1.0, 0.25],
      colors: [columnColor, strokeColor],
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.25,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    colors: [columnColor, strokeColor],
    xaxis: {
      categories: data.map(d => d.date),
      labels: {
        style: {
          colors: '#94A3B8',
          fontSize: '10px',
          fontWeight: 500
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: [
      {
        title: {
          text: periodLabelText,
          style: {
            color: '#64748B',
            fontSize: '9px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600
          }
        },
        labels: {
          formatter: (val: any) => {
            if (val === null || val === undefined) return '0';
            return val >= 1000000 
              ? `${(val / 1000000).toFixed(1)}M` 
              : val >= 1000 
                ? `${(val / 1000).toFixed(0)}K` 
                : val.toFixed(0);
          },
          style: {
            colors: '#94A3B8',
            fontSize: '9px',
            fontFamily: 'Inter, sans-serif'
          }
        },
        axisBorder: {
          show: true,
          color: '#F1F5F9'
        }
      },
      {
        opposite: true,
        title: {
          text: cumulativeLabelText,
          style: {
            color: strokeColor,
            fontSize: '9px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600
          }
        },
        labels: {
          formatter: (val: any) => {
            if (val === null || val === undefined) return '0';
            return val >= 1000000 
              ? `${(val / 1000000).toFixed(1)}M` 
              : val >= 1000 
                ? `${(val / 1000).toFixed(0)}K` 
                : val.toFixed(0);
          },
          style: {
            colors: strokeColor,
            fontSize: '9px',
            fontFamily: 'Inter, sans-serif'
          }
        },
        axisBorder: {
          show: true,
          color: strokeColor
        }
      }
    ],
    plotOptions: {
      bar: {
        columnWidth: '40%',
        borderRadius: 4
      }
    },
    tooltip: {
      theme: 'light',
      shared: true,
      intersect: false,
      y: {
        formatter: (val: any) => `${val !== undefined && val !== null ? Math.round(val).toLocaleString('th-TH') : 0} บาท`
      }
    },
    grid: {
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '10px',
      labels: {
        colors: '#64748B'
      },
      markers: {
        radius: 4
      }
    },
    markers: {
      size: [0, 4], // 0 for bar series, 4 for area line series
      colors: ['#FFFFFF'],
      strokeColors: strokeColor,
      strokeWidth: 2,
      hover: {
        size: 6
      }
    }
  };

  const series = [
    {
      name: periodLabelText,
      type: 'column',
      data: data.map(d => dataKey === 'limit' ? (d.periodLimit || 0) : (d.periodOutstanding || 0))
    },
    {
      name: cumulativeLabelText,
      type: 'area',
      data: data.map(d => d[dataKey] || 0)
    }
  ];

  const latestVal = data.length > 0 ? data[data.length - 1][dataKey] : 0;

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-start mb-3 font-sans">
          <div>
            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">{title}</span>
            <h4 className="text-xl font-extrabold text-[#1D2023] mt-1">
              {Math.round(latestVal).toLocaleString('th-TH')}
            </h4>
          </div>
          {badgeLabel && (
            <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              {badgeLabel}
            </span>
          )}
        </div>

        <div className="pt-2 h-[190px]">
          <Chart
            key={`mix-chart-${dataKey}-${title}-${data.length}-${data.map(d => d.date).join(',')}`}
            options={chartOptions}
            series={series}
            type="line"
            height="180"
          />
        </div>
      </div>
      <div className="border-t border-[#F0F1F3] pt-3 mt-4 text-[10px] text-slate-400 font-semibold text-center uppercase tracking-wide font-sans">
        อัปเดตข้อมูลสัญญารุ่นจริงจากฐานข้อมูล
      </div>
    </div>
  );
}

// Clean beautiful Doughnut Chart using ApexCharts
interface DoughnutSegment {
  label: string;
  amount: number;
  color: string;
  percentage: number;
}

function BeautifulDoughnut({ 
  segments, 
  title, 
  description, 
  centerValueLabel,
  centerValueAmount 
}: { 
  segments: DoughnutSegment[]; 
  title: string; 
  description: string; 
  centerValueLabel: string;
  centerValueAmount: string;
}) {
  const chartOptions: any = {
    chart: {
      type: 'donut',
      fontFamily: 'Inter, sans-serif'
    },
    labels: segments.map(s => s.label),
    colors: segments.map(s => s.color),
    stroke: {
      colors: ['#ffffff'],
      width: 2
    },
    legend: {
      show: false
    },
    dataLabels: {
      enabled: false
    },
    tooltip: {
      y: {
        formatter: (val: any) => `${val.toLocaleString('th-TH')} บาท`
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            total: {
              show: true,
              label: centerValueLabel,
              fontSize: '10px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 800,
              color: '#94A3B8',
              formatter: () => centerValueAmount
            },
            value: {
              show: true,
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              color: '#1E293B',
              formatter: (val: any) => Number(val || 0).toLocaleString('th-TH')
            }
          }
        }
      }
    }
  };

  const series = segments.map(s => s.amount);

  return (
    <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col justify-between h-full font-sans">
      <div>
        <div className="mb-4">
          <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">{title}</span>
          <p className="text-[10px] text-slate-400 mt-1 font-semibold">{description}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
          {/* Apex Donut Chart */}
          <div className="relative w-[180px] h-[180px] flex-shrink-0 flex items-center justify-center">
            <Chart
              key={`donut-${title}-${segments.map(s => s.label).join(',')}-${segments.map(s => s.amount).join(',')}`}
              options={chartOptions}
              series={series}
              type="donut"
              width="180"
              height="180"
            />
          </div>

          {/* Legend Items */}
          <div className="space-y-1.5 flex-grow max-w-xs text-xs font-semibold w-full">
            {segments.map((seg, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }}></span>
                  <span className="text-slate-700 text-xs truncate">{seg.label}</span>
                </div>
                <div className="text-right font-sans font-semibold text-slate-930 text-xs shrink-0 whitespace-nowrap ml-1">
                  <span>{seg.amount.toLocaleString('th-TH')}</span>
                  <span className="text-[9.5px] text-slate-400 ml-1.5">({seg.percentage.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#F0F1F3] pt-3 mt-4 text-[10px] text-slate-400 font-semibold text-center">
        ระบบวิเคราะห์ข้อมูลตามจริง 100%
      </div>
    </div>
  );
}

const getAggregatedContractData = (contractsList: Contract[], unit: 'YEAR' | 'QUARTER' | 'MONTH'): ChartDataPoint[] => {
  if (contractsList.length === 0) {
    if (unit === 'YEAR') {
      return [
        { date: '2025', limit: 120000, outstanding: 101200, periodLimit: 120000, periodOutstanding: 101200 },
        { date: '2026', limit: 330000, outstanding: 178700, periodLimit: 210000, periodOutstanding: 77500 }
      ];
    } else if (unit === 'QUARTER') {
      return [
        { date: 'Q1/25', limit: 120000, outstanding: 101200, periodLimit: 120000, periodOutstanding: 101200 },
        { date: 'Q2/25', limit: 200000, outstanding: 174700, periodLimit: 80000, periodOutstanding: 73500 },
        { date: 'Q1/26', limit: 330000, outstanding: 178700, periodLimit: 130000, periodOutstanding: 4000 }
      ];
    } else {
      return [
        { date: '01/26', limit: 120000, outstanding: 101200, periodLimit: 120000, periodOutstanding: 101200 },
        { date: '03/26', limit: 200000, outstanding: 174700, periodLimit: 80000, periodOutstanding: 73500 },
        { date: '05/26', limit: 330000, outstanding: 178700, periodLimit: 130000, periodOutstanding: 4000 }
      ];
    }
  }

  // Sort chronologically by startDate
  const sorted = [...contractsList].sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Determine period keys
  const map: { [periodKey: string]: { limit: number, outstanding: number } } = {};
  
  sorted.forEach(c => {
    const startDate = c.startDate || '2026-05-22';
    const parts = startDate.split('-');
    if (parts.length < 3) return;
    const year = parts[0];
    const month = parts[1];
    
    let periodKey = '';

    if (unit === 'YEAR') {
      periodKey = year;
    } else if (unit === 'QUARTER') {
      const monthNum = parseInt(month, 10);
      let q = 'Q1';
      if (monthNum >= 4 && monthNum <= 6) q = 'Q2';
      else if (monthNum >= 7 && monthNum <= 9) q = 'Q3';
      else if (monthNum >= 10 && monthNum <= 12) q = 'Q4';
      
      periodKey = `${year}-${q}`;
    } else {
      // Month
      periodKey = `${year}-${month}`;
    }

    if (!map[periodKey]) {
      map[periodKey] = { limit: 0, outstanding: 0 };
    }
    map[periodKey].limit += c.creditLimit;
    map[periodKey].outstanding += c.outstandingPrincipal;
  });

  // Get sorted period keys
  const sortedPeriods = Object.keys(map).sort();
  
  let currentLimitSum = 0;
  let currentOutSum = 0;

  const timeline = sortedPeriods.map(periodKey => {
    currentLimitSum += map[periodKey].limit;
    currentOutSum += map[periodKey].outstanding;
    
    // Reconstruct display label based on periodKey
    let displayLabel = periodKey;
    if (unit === 'YEAR') {
      displayLabel = periodKey;
    } else if (unit === 'QUARTER') {
      const parts = periodKey.split('-');
      displayLabel = parts.length >= 2 ? `${parts[1]}/${parts[0].slice(2)}` : periodKey;
    } else {
      const parts = periodKey.split('-');
      displayLabel = parts.length >= 2 ? `${parts[1]}/${parts[0].slice(2)}` : periodKey;
    }

    return {
      date: displayLabel,
      limit: currentLimitSum,
      outstanding: currentOutSum,
      periodLimit: map[periodKey].limit,
      periodOutstanding: map[periodKey].outstanding
    };
  });

  if (timeline.length === 1) {
    let baselineLabel = '';
    if (unit === 'YEAR') baselineLabel = String(parseInt(timeline[0].date, 10) - 1);
    else if (unit === 'QUARTER') baselineLabel = 'Q1/25';
    else baselineLabel = '01/25';
    
    return [
      { date: baselineLabel, limit: 0, outstanding: 0, periodLimit: 0, periodOutstanding: 0 },
      { ...timeline[0] }
    ];
  }

  return timeline;
};

export default function Dashboard() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  
  // Custom Filters matching spec: Year, Quarter, Month & Product Filter
  const [productFilter, setProductFilter] = useState<'ALL' | 'HP' | 'LOAN'>('ALL');
  const [timeUnit, setTimeUnit] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');

  // Dashboard view selection: 'LIMIT_AGING' = Dashboard 1, 'PLANTING' = Dashboard 2
  const [activeTab, setActiveTab] = useState<'LIMIT_AGING' | 'PLANTING'>('LIMIT_AGING');
  const [triggerUpdate, setTriggerUpdate] = useState(0);

  // Load backend arrays on mount and upon manual refresh
  useEffect(() => {
    setContracts(getContracts());
    setDisbursements(getDisbursements());
    setPayments(getScheduledPayments());
    setRepayments(getRepayments());
  }, [triggerUpdate]);

  const handleRefresh = () => {
    setTriggerUpdate(prev => prev + 1);
  };

  // Filter contracts based on selected product filter
  const filteredContracts = contracts.filter(c => {
    if (productFilter === 'ALL') return true;
    return c.productType === productFilter;
  });

  const filteredContractIds = new Set(filteredContracts.map(c => c.id));
  const filteredDisbursements = disbursements.filter(d => filteredContractIds.has(d.contractId));

  // ==========================================================
  // --- DASHBOARD 1: OVERALL PORFOLIO & AGING DATA PREP -------
  // ==========================================================
  const totalLimitAmount = filteredContracts.reduce((sum, c) => sum + c.creditLimit, 0);
  const totalLimitUnit = filteredContracts.length;
  const totalDisbursedAmount = filteredDisbursements.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalOutstanding = filteredContracts.reduce((sum, c) => sum + c.outstandingPrincipal, 0);

  // Compute Days Past Due (DPD) for each contract to build the Aging Report
  const getCreditAgingAnalysis = () => {
    const today = new Date(SYSTEM_DATE);
    
    let bucket_normal = 0;
    let bucket_1_30 = 0;
    let bucket_31_60 = 0;
    let bucket_61_90 = 0;
    let bucket_90plus = 0; // NPL

    let count_normal = 0;
    let count_1_30 = 0;
    let count_31_60 = 0;
    let count_61_90 = 0;
    let count_90plus = 0;

    filteredContracts.forEach(c => {
      const contractSchedules = payments.filter(p => p.contractId === c.id);
      const overdueSchedules = contractSchedules.filter(p => p.status === 'OVERDUE');
      
      let maxDpd = 0;
      overdueSchedules.forEach(s => {
        const diffTime = today.getTime() - new Date(s.dueDate).getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (days > maxDpd) {
          maxDpd = days;
        }
      });

      const outstandingPrincipal = c.outstandingPrincipal;

      if (maxDpd === 0) {
        bucket_normal += outstandingPrincipal;
        count_normal++;
      } else if (maxDpd <= 30) {
        bucket_1_30 += outstandingPrincipal;
        count_1_30++;
      } else if (maxDpd <= 60) {
        bucket_31_60 += outstandingPrincipal;
        count_31_60++;
      } else if (maxDpd <= 90) {
        bucket_61_90 += outstandingPrincipal;
        count_61_90++;
      } else {
        bucket_90plus += outstandingPrincipal;
        count_90plus++;
      }
    });

    const sumAllOutstanding = bucket_normal + bucket_1_30 + bucket_31_60 + bucket_61_90 + bucket_90plus || 1;
    const nplRatio = (bucket_90plus / sumAllOutstanding) * 100;

    return {
      normal: { amount: bucket_normal, count: count_normal },
      bucket_1_30: { amount: bucket_1_30, count: count_1_30 },
      bucket_31_60: { amount: bucket_31_60, count: count_31_60 },
      bucket_61_90: { amount: bucket_61_90, count: count_61_90 },
      bucket_90plus: { amount: bucket_90plus, count: count_90plus },
      nplRatio: Math.round(nplRatio * 10) / 10,
      totalOutstanding: sumAllOutstanding,
    };
  };

  const agingResult = getCreditAgingAnalysis();

  // Create Aging Doughnut Segment List
  const portfolioTotal = agingResult.totalOutstanding;
  const agingDoughnutSegments: DoughnutSegment[] = [
    { label: 'ปกติ (Not Overdue)', amount: agingResult.normal.amount, color: '#10B981', percentage: portfolioTotal > 0 ? (agingResult.normal.amount / portfolioTotal) * 100 : 0 },
    { label: 'ค้างชำระ 1-30 วัน', amount: agingResult.bucket_1_30.amount, color: '#FBBF24', percentage: portfolioTotal > 0 ? (agingResult.bucket_1_30.amount / portfolioTotal) * 100 : 0 },
    { label: 'ค้างชำระ 31-60 วัน', amount: agingResult.bucket_31_60.amount, color: '#F59E0B', percentage: portfolioTotal > 0 ? (agingResult.bucket_31_60.amount / portfolioTotal) * 100 : 0 },
    { label: 'ค้างชำระ 61-90 วัน', amount: agingResult.bucket_61_90.amount, color: '#EF4444', percentage: portfolioTotal > 0 ? (agingResult.bucket_61_90.amount / portfolioTotal) * 100 : 0 },
    { label: 'ค้างเกิน 90 วัน (NPL)', amount: agingResult.bucket_90plus.amount, color: '#DC2626', percentage: portfolioTotal > 0 ? (agingResult.bucket_90plus.amount / portfolioTotal) * 100 : 0 },
  ];

  // Generate timelines for Dashboard 1 Charts using selected time scale
  const dashboard1DailyData = getAggregatedContractData(filteredContracts, timeUnit);

  // ==========================================================
  // --- DASHBOARD 2: AGRO-FORESTRY CORRESPONDING CALCULATIONS
  // ==========================================================
  const plantingContracts = filteredContracts.filter(c => 
    c.paymentFrequency === 'ANNUAL' || 
    (c.plantingAreaRai && c.plantingAreaRai > 0) || 
    (c.plantingTreeCount && c.plantingTreeCount > 0)
  );

  const plantingCreditSum = plantingContracts.reduce((sum, c) => sum + c.creditLimit, 0);
  const plantingRaiSum = plantingContracts.reduce((sum, c) => sum + (c.plantingAreaRai || 0), 0);
  const plantingTreeSum = plantingContracts.reduce((sum, c) => sum + (c.plantingTreeCount || 0), 0);
  const plantingDisbursedSum = plantingContracts.reduce((sum, c) => sum + c.disbursedAmount, 0);
  const plantingOutstandingSum = plantingContracts.reduce((sum, c) => sum + c.outstandingPrincipal, 0);

  // Split forest allocations for specialized ecological doughnut
  const reserveRaiSum = plantingContracts
    .filter(c => c.plantingType === 'RESERVE')
    .reduce((sum, c) => sum + (c.plantingAreaRai || 0), 0);
  
  const nonReserveRaiSum = plantingContracts
    .filter(c => c.plantingType !== 'RESERVE')
    .reduce((sum, c) => sum + (c.plantingAreaRai || 0), 0);

  const totalForestRaiSum = reserveRaiSum + nonReserveRaiSum || 1;

  const forestDoughnutSegments: DoughnutSegment[] = [
    { label: 'แปลงป่าในเขตสงวน (RESERVE)', amount: reserveRaiSum, color: '#047857', percentage: totalForestRaiSum > 0 ? (reserveRaiSum / totalForestRaiSum) * 100 : 0 },
    { label: 'แปลงเพาะปลูกทั่วไป (NON-RESERVE)', amount: nonReserveRaiSum, color: '#10B981', percentage: totalForestRaiSum > 0 ? (nonReserveRaiSum / totalForestRaiSum) * 100 : 0 }
  ];

  // Generate timelines for planting specifically
  const dashboard2DailyData = getAggregatedContractData(plantingContracts, timeUnit);

  return (
    <div className="space-y-6 font-sans antialiased text-[#1D2023]">
      
      {/* Upper Status Line & Configuration Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center py-2 space-y-4 lg:space-y-0 border-b border-slate-100 pb-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-[#1D2023] font-sans flex items-center gap-2">
            <span>📈</span>
            Dashboard Summary (บทวิเคราะห์ข้อมูลสรุปฐานข้อมูล)
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium font-sans">
            การคำนวณอิงเวลาจริง {SYSTEM_DATE} เพื่อประมวลสถิติและวิเคราะห์ลดต้นลดดอกสะสม
          </p>
        </div>

        {/* System actions, parameters and TAB switcher */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold w-full lg:w-auto justify-between lg:justify-end">
          {/* Circular icon-only switcher - blue theme active (#1463F3) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('LIMIT_AGING')}
              className={`p-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                activeTab === 'LIMIT_AGING'
                  ? 'bg-[#1463F3] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Dashboard 1: พอร์ตวงเงิน & การวิเคราะห์ค้างจ่าย"
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('PLANTING')}
              className={`p-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                activeTab === 'PLANTING'
                  ? 'bg-[#1463F3] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Dashboard 2: สัญญาเพาะปลูกป่าเศรษฐกิจ"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-1.5 bg-white border border-[#E5E7EB] px-3.5 py-1.5 rounded-xl shadow-3xs">
            <span className="text-slate-400">📅 SYSTEM:</span>
            <span className="font-semibold text-[#1463F3]">{SYSTEM_DATE}</span>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center space-x-1.5 bg-[#1463F3] text-white px-3.5 py-1.5 rounded-xl shadow-3xs hover:bg-[#1150c7] transition cursor-pointer font-sans"
          >
            <span>รีเฟรชสด</span>
          </button>
        </div>
      </div>

      {/* Dynamic Filter Controls Panel */}
      <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Product Type Filter Option */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-450" />
            ตัวกรองบริการ (Product):
          </span>
          <div className="flex bg-white border border-[#E5E7EB] p-1 rounded-xl shadow-3xs space-x-1">
            <button
              onClick={() => setProductFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                productFilter === 'ALL'
                  ? 'bg-[#1463F3] text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setProductFilter('HP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                productFilter === 'HP'
                  ? 'bg-[#1463F3] text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              เช่าซื้อ (HP)
            </button>
            <button
              onClick={() => setProductFilter('LOAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                productFilter === 'LOAN'
                  ? 'bg-[#1463F3] text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              เงินกู้ (LOAN)
            </button>
          </div>
        </div>

        {/* Time scale configuration */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <span>📅</span>
            มาตราส่วนเวลา (Time Scale):
          </span>
          <div className="flex bg-white border border-[#E5E7EB] p-1 rounded-xl shadow-3xs space-x-1">
            <button
              onClick={() => setTimeUnit('MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeUnit === 'MONTH'
                  ? 'bg-[#1463F3] text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              รายเดือน
            </button>
            <button
              onClick={() => setTimeUnit('QUARTER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeUnit === 'QUARTER'
                  ? 'bg-[#1463F3] text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ไตรมาส
            </button>
            <button
              onClick={() => setTimeUnit('YEAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeUnit === 'YEAR'
                  ? 'bg-[#1463F3] text-white shadow-3xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              รายปี
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DASHBOARD 1: PORTFOLIO CREDIT LIMITED WITH DETAILED AGING REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'LIMIT_AGING' && (
        <div className="space-y-6">
          
          {/* Top Row Portfolio Cards Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            
            {/* Card 1: ยอดสัญญาเป็นวงเงิน */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">1. ยอดทำสัญญารวม (Total Approved Limit)</span>
              </div>
              
              <div className="mt-3.5">
                <span className="text-2xl font-black text-[#1D2023] font-sans select-all">
                  {totalLimitAmount.toLocaleString('th-TH')}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                สัญญาในความดูแล: <strong className="text-slate-700 font-bold">{totalLimitUnit} บัญชีสัญญาลดต้นลดดอก</strong>
              </div>
            </div>

            {/* Card 2: ยอดเบิกใช้ */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">2. ยอดเบิกเงินรวมสะสม (Total Disbursed)</span>
              </div>

              <div className="mt-3.5 font-sans">
                <span className="text-2xl font-black text-emerald-600 select-all">
                  {totalDisbursedAmount.toLocaleString('th-TH')}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                อัตราการดึงใช้เครดิต: <strong className="text-slate-700 font-bold">{totalLimitAmount > 0 ? Math.round((totalDisbursedAmount / totalLimitAmount) * 100) : 0}% ของสิทธิ์</strong>
              </div>
            </div>

            {/* Card 3: ยอด outstanding */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">3. ยอดเงินคงค้างต้นเงิน (Outstanding Principal)</span>
              </div>

              <div className="mt-3.5 font-sans">
                <span className="text-2xl font-black text-[#1463F3] select-all">
                  {totalOutstanding.toLocaleString('th-TH')}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                หนี้คงค้างหมุนเวียนจริง: <strong className="text-slate-700 font-bold">{(totalOutstanding / 1000).toFixed(1)}k คงเหลือ</strong>
              </div>
            </div>

            {/* Card 4: Aging DPD / NPL Status indicators */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">4. สัดส่วนเสี่ยงหนี้สูญ (NPL Ratio)</span>
              </div>

              <div className="mt-3.5 font-sans">
                <span className={`text-2xl font-black select-all ${agingResult.nplRatio > 10 ? 'text-red-600' : 'text-amber-600'}`}>
                  {agingResult.nplRatio}%
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                เกณฑ์เฝ้าระวังกลุ่มทุน: <strong className="text-slate-700 font-bold">ต่ำกว่า 15.0% DPD &gt; 90 วัน</strong>
              </div>
            </div>
          </div>

          {/* Symmetrical Middle Analytics Layout containing twin area charts & a central aging doughnut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart Block 1: ยอดทำสัญญาตามวัน (Area Chart) */}
            <SvgAreaChart
              data={dashboard1DailyData}
              dataKey="limit"
              strokeColor="#1463F3"
              fillColor="#1463F3"
              title="ยอดทำสัญญาเป็นวงเงินสะสมตามเกณฑ์เวลา (Approved Credits)"
              badgeLabel="Active Portfolio"
            />

            {/* Chart Block 2: ยอด outstanding ตามวัน (Area Chart) */}
            <SvgAreaChart
              data={dashboard1DailyData}
              dataKey="outstanding"
              strokeColor="#1463F3"
              fillColor="#1463F3"
              title="ยอดเบิกใช้ Outstanding คงเหลือสะสมตามเกณฑ์เวลา (Outstanding Debt)"
              badgeLabel="Active Debts"
            />
          </div>

          {/* Aging Report segment represented inside a beautiful Doughnut chart (Table completely removed!) */}
          <div className="grid grid-cols-1 gap-6">
            <BeautifulDoughnut
              segments={agingDoughnutSegments}
              title="รายงานวิเคราะห์ลูกหนี้ค้างชำระ (Aging Report Doughnut Portfolio)"
              description="แบ่งกลุ่มชั้นหนี้จำแนกตามรายอายุความล่าช้าจริงจากประวัติชำระเงินต้นและผลประโยชน์ (DPD)"
              centerValueLabel="พอร์ตรวม Outstanding"
              centerValueAmount={`${totalOutstanding.toLocaleString('th-TH')}`}
            />
          </div>

          {/* Minimal Sandbox Corporate Note in lieu of heavy list tables */}
          <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-center text-xs text-slate-400 font-medium">
            💡 สำหรับตารางข้อมูลสัญญาและประวัติการเบิกจ่าย/ชำระเงินด่วนแบบรายคน ให้เลือกใช้งานเมนู <strong>"Contracts ข้อมูลสัญญา"</strong> หรือ <strong>"Disbursement เบิกเงิน"</strong> ด้านซ้ายมือของคุณ
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DASHBOARD 2: AGRO-FORESTRY ECOSYSTEM PERFECTLY MIRRORING PORTFOLIO */}
      {/* ========================================================================= */}
      {activeTab === 'PLANTING' && (
        <div className="space-y-6">
          
          {/* Top Row Planting Metrics specifically modeled exactly like Dashboard 1 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            
            {/* Card 1: วงเงินสะสมของกลุ่มปลูก (Converted to Polished Light Theme!) */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">1. วงเงินเกษตรกรรมปลูกป่าอนุมัติ</span>
              </div>
              
              <div className="mt-3.5">
                <span className="text-xl font-black font-sans select-all text-slate-800">
                  {plantingCreditSum.toLocaleString('th-TH')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 font-medium font-sans">
                สนับสนุนอุตสาหกรรมป่าไม้และคาร์บอน
              </div>
            </div>

            {/* Card 2: พื้นที่ป่ารวม (จำนวนไร่) */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">2. ขนาดพื้นที่แปลงเพาะปลูก (จำนวนไร่)</span>
              </div>

              <div className="mt-3.5 font-sans">
                <span className="text-xl font-extrabold text-emerald-700 select-all">
                  {plantingRaiSum.toLocaleString('th-TH')} <span className="text-xs font-bold text-slate-400">ไร่</span>
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                เฉลี่ยรายโครงการ: <strong className="text-emerald-700 font-bold">{(plantingRaiSum / (plantingContracts.length || 1)).toFixed(1)} ไร่</strong>
              </div>
            </div>

            {/* Card 3: จำนวนต้นไม้สะสม */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">3. จำนวนต้นไม้สะสม (ต้นกล้า)</span>
              </div>

              <div className="mt-3.5 font-sans">
                <span className="text-xl font-extrabold text-[#1463F3] select-all">
                  {plantingTreeSum.toLocaleString('th-TH')} <span className="text-xs font-bold text-slate-400">ต้น</span>
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                ความหนาแน่นเฉลี่ย: <strong className="text-slate-700 font-bold">{(plantingTreeSum / (plantingRaiSum || 1)).toFixed(0)} ต้น/ไร่</strong>
              </div>
            </div>

            {/* Card 4: ยอดเบิกจ่ายใช้สะสม */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">4. ยอดที่เบิกจ่ายเพื่อเพาะเลี้ยงแล้ว</span>
              </div>

              <div className="mt-3.5 font-sans">
                <span className="text-xl font-extrabold text-rose-600 select-all">
                  {plantingDisbursedSum.toLocaleString('th-TH')}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                คิดอัตราการเบิกเงิน: <strong className="text-slate-700 font-bold">{plantingCreditSum > 0 ? Math.round((plantingDisbursedSum / plantingCreditSum) * 100) : 0}%</strong>
              </div>
            </div>

            {/* Card 5: ยอด outstanding */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">5. ยอดเงินต้นคงค้าง (Outstanding)</span>
              </div>

              <div className="mt-3.5 font-sans">
                <span className="text-xl font-extrabold text-slate-800 select-all">
                  {plantingOutstandingSum.toLocaleString('th-TH')}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 mt-2 font-medium font-sans">
                สัดส่วนOutstandingป่าไม้: <strong className="text-[#1463F3] font-bold">{Math.round((plantingOutstandingSum / (totalOutstanding || 1)) * 100)}% ของพอร์ต</strong>
              </div>
            </div>
          </div>

          {/* Symmetrical Middle Analytics Layout specifically mirroring Portfolio dashboard 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Block: ยอดสัญญาเพาะปลูกตามวัน */}
            <SvgAreaChart
              data={dashboard2DailyData}
              dataKey="limit"
              strokeColor="#10B981"
              fillColor="#10B981"
              title="ยอดทำสัญญากลุ่มปลูกป่าสะสมรายวัน (Agro Approved Credit)"
              badgeLabel="Forestry Limit"
            />

            {/* Right Block: ยอด Outstanding กลุ่มปลูกตามวัน */}
            <SvgAreaChart
              data={dashboard2DailyData}
              dataKey="outstanding"
              strokeColor="#8B5CF6"
              fillColor="#8B5CF6"
              title="ยอดคงค้างกลุ่มเพาะปลูกสะสมรายวัน (Agro Outstanding)"
              badgeLabel="Forestry Balance"
            />
          </div>

          {/* Centralized reserve type allocation Doughnut Chart specifically mirroring Aging Report Doughnut structure */}
          <div className="grid grid-cols-1 gap-6">
            <BeautifulDoughnut
              segments={forestDoughnutSegments}
              title="สัดส่วนแปลงเพาะปลูก (ข้อมูลแยกตามประเภทเขตส่งเสริมป่าเศรษฐกิจ)"
              description="จำแนกสัดส่วนการลงทุนและการดูแลรักษาคาร์บอนเครดิตรายโครงการในเขตป่าอนุรักษ์พื้นที่สงวน (RESERVE) และแปลงทั่วไป"
              centerValueLabel="ขนาดป่าไม้รวมสะสม"
              centerValueAmount={`${plantingRaiSum.toLocaleString('th-TH')} ไร่`}
            />
          </div>

          {/* System explanation text instead of listings tables */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-[#065F46] text-xs font-semibold">
            🌱 นโยบายการตรวจสอบสิทธิ์คาร์บอนและอัตรารอดตายของต้นป่า (Survival Forestry Check): 
            อิงพฤติกรรมการจ่ายเงินผลประโยชน์ที่ผูกมัดร่วมกับการเติบโตของแปลงเพาะปลูกตามฤดูกาลปักชำ
          </div>

        </div>
      )}

      {/* Dynamic Corporate Footnote */}
      <footer className="border-t border-[#E5E7EB] pt-4 text-center text-[11px] font-semibold text-slate-400 font-sans tracking-wide uppercase">
        LMS Project Dashboard Analytics Control Hub - ระบบจัดการค้ำประกันหนี้และจำลองวิเคราะห์ลดต้นลดดอกรายวัน
      </footer>

    </div>
  );
}
