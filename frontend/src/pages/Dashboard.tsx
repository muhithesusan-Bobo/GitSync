import React, { useState, useEffect } from 'react';
import api from '../services/api';
import type { DashboardSummary, ApiResponse } from '@hazinahub/types';
import { formatKES, formatDate } from '@hazinahub/utils';
import { Wallet, TrendingUp, DollarSign, BrainCircuit, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<DashboardSummary>>('/dashboard');
      if (response.data.success && response.data.data) {
        setData(response.data.data);
      } else {
        setError(response.data.error || 'Failed to load dashboard summary');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Server error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'var(--danger-glow)' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Failed to Load Dashboard</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error || 'An unexpected error occurred.'}</p>
        <button className="btn btn-primary" onClick={fetchDashboardData}>
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time business and wallet statistics.</p>
        </div>
        <button className="btn btn-glass" onClick={fetchDashboardData}>
          <RefreshCw size={16} /> Sync
        </button>
      </div>

      {/* AI Insight banner */}
      <div className="glass-panel" style={{ 
        padding: '24px', 
        marginBottom: '32px', 
        background: 'radial-gradient(100% 100% at 0% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.45) 100%)',
        borderLeft: '4px solid var(--primary)',
        display: 'flex',
        gap: '20px',
        alignItems: 'center'
      }}>
        <div style={{
          background: 'var(--primary-glow)',
          padding: '12px',
          borderRadius: '12px',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <BrainCircuit size={28} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '4px', color: 'var(--text-main)' }}>Hazina AI Insight</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', lineHeight: '1.5' }}>
            "{data.aiInsight}"
          </p>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="dashboard-grid">
        {/* Card 1: Balance */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Account Balance</span>
            <Wallet size={20} color="var(--primary)" />
          </div>
          <div className="summary-value">{formatKES(data.accountBalance)}</div>
          <div className="summary-subtext">
            <span className="text-success">Active Business Wallet</span>
          </div>
        </div>

        {/* Card 2: Sales */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>24h Revenue</span>
            <TrendingUp size={20} color="var(--secondary)" />
          </div>
          <div className="summary-value">{formatKES(data.totalSales)}</div>
          <div className="summary-subtext">
            <span className="text-success">C2B & STK push deposits</span>
          </div>
        </div>

        {/* Card 3: Monthly profits */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Monthly Net Margin</span>
            <DollarSign size={20} color="var(--accent)" />
          </div>
          <div className="summary-value">{formatKES(data.monthlyProfits)}</div>
          <div className="summary-subtext">
            <span className={data.profitGrowth >= 0 ? "text-success" : "text-danger"}>
              {data.profitGrowth >= 0 ? '+' : ''}{data.profitGrowth}% from last month
            </span>
          </div>
        </div>

        {/* Card 4: Investments Yield */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Active MMF Yield</span>
            <TrendingUp size={20} color="var(--primary)" />
          </div>
          <div className="summary-value">13.8%</div>
          <div className="summary-subtext">
            <span style={{ color: 'var(--text-muted)' }}>Kenyan MMF average</span>
          </div>
        </div>

        {/* Card 5: Financial Health */}
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Financial Health</span>
            <ShieldCheck size={20} color="var(--secondary)" />
          </div>
          <div className="summary-value">{data.financialHealth.overall}%</div>
          <div className="summary-subtext" style={{ display: 'grid', gap: '4px' }}>
            <span style={{ color: 'var(--text-success)' }}>Cash flow: {data.financialHealth.cashFlow}%</span>
            <span>Debt ratio: {data.financialHealth.debtRatio}%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Transaction Volume Chart */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Transaction Volume (7 Days)</h2>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyTransactions} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="var(--text-dark)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-dark)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `KES ${val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}`} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-main)', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--primary)' }}
                  formatter={(value) => [formatKES(Number(value)), 'Volume']}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="glass-panel" style={{ padding: '28px', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Recent Activity</h2>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {data.recentTransactions.length === 0 ? (
              <div style={{ color: 'var(--text-dark)', textAlign: 'center', padding: '40px 0' }}>No recent transactions</div>
            ) : (
              data.recentTransactions.map((tx) => (
                <div key={tx.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>
                      {tx.type === 'c2b' || tx.type === 'stk_push' ? 'M-Pesa Deposit' : 'Business Withdrawal'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                      {tx.mpesaReceiptNumber ? tx.mpesaReceiptNumber : `Ref: ${tx.id.substring(0, 8)}`} • {formatDate(tx.createdAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontWeight: 700, 
                      fontSize: '0.95rem',
                      color: tx.type === 'c2b' || tx.type === 'stk_push' ? 'var(--primary)' : 'var(--danger)',
                      marginBottom: '4px'
                    }}>
                      {tx.type === 'c2b' || tx.type === 'stk_push' ? '+' : '-'}{formatKES(tx.amount)}
                    </div>
                    <span className={`badge ${
                      tx.status === 'completed' ? 'badge-success' : tx.status === 'pending' ? 'badge-pending' : 'badge-danger'
                    }`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '28px', marginTop: '32px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Cash Flow Trend</h2>
        <div style={{ width: '100%', height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.profitLossTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="var(--text-dark)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--text-dark)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `KES ${val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                labelStyle={{ color: 'var(--text-main)', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--primary)' }}
                formatter={(value: number, name: string) => [formatKES(Number(value)), name]}
              />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="var(--danger)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" stroke="var(--secondary)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
