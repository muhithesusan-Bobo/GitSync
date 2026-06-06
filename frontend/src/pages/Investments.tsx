import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { MMFund, Investment, Portfolio, ApiResponse } from '@hazinahub/types';
import { formatKES, formatDate } from '@hazinahub/utils';
import { Briefcase, ArrowUpRight, TrendingUp, AlertCircle, Coins, Clock, X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const Investments: React.FC = () => {
  const { refreshProfile, user } = useAuth();
  
  // Data State
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [funds, setFunds] = useState<MMFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [selectedFund, setSelectedFund] = useState<MMFund | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investError, setInvestError] = useState<string | null>(null);
  const [investing, setInvesting] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchData = async () => {
    if (!user) {
      setError('Please log in to view your investments.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const portfolioRes = await api.get<ApiResponse<Portfolio>>('/portfolio');
      if (portfolioRes.data.success && portfolioRes.data.data) {
        setPortfolio(portfolioRes.data.data);
      } else {
        throw new Error(portfolioRes.data.error || 'Failed to fetch portfolio summary');
      }

      const fundsRes = await api.get<ApiResponse<MMFund[]>>('/investments/funds');
      if (fundsRes.data.success && fundsRes.data.data) {
        setFunds(fundsRes.data.data);
      } else {
        throw new Error(fundsRes.data.error || 'Failed to fetch funds');
      }
    } catch (err: any) {
      console.error('Investments fetch error:', err);
      const apiError = err.response?.data?.error || err.response?.data?.detail || err.message || 'Server error occurred';
      setError(apiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    fetchData();
  }, [user]);

  const handleInvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFund) return;
    
    const amountNum = parseFloat(investAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setInvestError('Please enter a valid investment amount');
      return;
    }

    if (amountNum < selectedFund.minimumInvestment) {
      setInvestError(`Minimum investment is KES ${selectedFund.minimumInvestment.toLocaleString()}`);
      return;
    }

    const walletBalance = user?.walletBalance ?? 0;
    if (amountNum > walletBalance) {
      setInvestError(`Insufficient wallet balance. Available: KES ${walletBalance.toLocaleString()}`);
      return;
    }

    setInvestError(null);
    setInvesting(true);

    try {
      const response = await api.post<ApiResponse<any>>('/investments/invest', {
        fund_id: selectedFund.id,
        amount: amountNum,
      });

      if (response.data.success) {
        setShowInvestModal(false);
        setInvestAmount('');
        setSelectedFund(null);
        await Promise.all([fetchData(), refreshProfile()]);
      } else {
        setInvestError(response.data.error || 'Investment transaction failed');
      }
    } catch (err: any) {
      setInvestError(err.response?.data?.error || err.message || 'Investment failed');
    } finally {
      setInvesting(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;

    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount');
      return;
    }

    if (amountNum > selectedInvestment.currentValue) {
      setWithdrawError(`Maximum withdrawal is ${formatKES(selectedInvestment.currentValue)}`);
      return;
    }

    setWithdrawError(null);
    setWithdrawing(true);

    try {
      const response = await api.post<ApiResponse<any>>('/portfolio/withdraw', {
        investmentId: selectedInvestment.id,
        amount: amountNum
      });

      if (response.data.success) {
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setSelectedInvestment(null);
        await Promise.all([fetchData(), refreshProfile()]);
      } else {
        setWithdrawError(response.data.error || 'Withdrawal request failed');
      }
    } catch (err: any) {
      setWithdrawError(err.response?.data?.error || err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

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
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'var(--danger-glow)' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Failed to Load Investments</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error || 'An unexpected error occurred.'}</p>
        <button className="btn btn-primary" onClick={fetchData}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>MMF Investments</h1>
          <p style={{ color: 'var(--text-muted)' }}>Grow your business funds with Kenyan Money Market Funds.</p>
        </div>
      </div>

      {/* Portfolio Holdings Summary */}
      <div className="dashboard-grid">
        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Portfolio Value</span>
            <Briefcase size={20} color="var(--primary)" />
          </div>
          <div className="summary-value">{formatKES(portfolio.currentValue)}</div>
          <div className="summary-subtext">
            <span className="text-muted">Total capital + returns</span>
          </div>
        </div>

        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Principal Invested</span>
            <Coins size={20} color="var(--secondary)" />
          </div>
          <div className="summary-value">{formatKES(portfolio.totalInvested)}</div>
          <div className="summary-subtext">
            <span className="text-muted">Net deposits to funds</span>
          </div>
        </div>

        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Accrued Returns</span>
            <TrendingUp size={20} color="var(--primary)" />
          </div>
          <div className="summary-value" style={{ color: 'var(--primary)' }}>+{formatKES(portfolio.totalReturns)}</div>
          <div className="summary-subtext">
            <span className="text-success">+{portfolio.yieldPercentage}% total growth</span>
          </div>
        </div>

        <div className="glass-panel summary-card">
          <div className="summary-header">
            <span>Withdrawal Eligible</span>
            <Clock size={20} color="var(--accent)" />
          </div>
          <div className="summary-value">{formatKES(portfolio.withdrawalEligible)}</div>
          <div className="summary-subtext">
            <span className="text-muted">Matured investments only</span>
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      {portfolio.growthData && portfolio.growthData.length > 0 && (
        <div className="glass-panel" style={{ padding: '28px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Portfolio Growth History</h2>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolio.growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-dark)" fontSize={12} tickFormatter={(val) => formatDate(val, { month: 'short', day: 'numeric' })} />
                <YAxis stroke="var(--text-dark)" fontSize={12} axisLine={false} tickFormatter={(val) => `KES ${val.toLocaleString()}`} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-main)' }}
                  itemStyle={{ color: 'var(--secondary)' }}
                  formatter={(value) => [formatKES(Number(value)), 'Value']}
                />
                <Area type="monotone" dataKey="value" stroke="var(--secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Available Funds section */}
      <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Browse MMF Funds</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {funds.map((fund) => (
          <div key={fund.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{fund.name}</h3>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>by {fund.provider}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', lineHeight: '1' }}>
                  {fund.interestRate}%
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 600 }}>ANNUAL YIELD</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: 'var(--text-dark)', marginBottom: '4px' }}>Risk Level</div>
                <span className={`badge ${
                  fund.riskLevel === 'low' ? 'badge-success' : fund.riskLevel === 'medium' ? 'badge-pending' : 'badge-danger'
                }`} style={{ fontSize: '0.7rem' }}>
                  {fund.riskLevel}
                </span>
              </div>
              <div>
                <div style={{ color: 'var(--text-dark)', marginBottom: '4px' }}>Min. Invest</div>
                <div style={{ fontWeight: 600 }}>{formatKES(fund.minimumInvestment)}</div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 'auto' }}
              onClick={() => {
                setSelectedFund(fund);
                setShowInvestModal(true);
              }}
            >
              Invest Capital <ArrowUpRight size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Active Holdings section */}
      <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Active Fund Portfolio</h2>
      <div className="glass-panel" style={{ padding: '24px' }}>
        {portfolio.investments.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
            You do not have any active fund investments. Select an MMF above to start growing your funds.
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fund</th>
                  <th>Yield Rate</th>
                  <th>Principal</th>
                  <th>Accrued Returns</th>
                  <th>Current Value</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.investments.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{(inv as any).fundName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{(inv as any).provider}</div>
                    </td>
                    <td>{(inv as any).interestRate}%</td>
                    <td>{formatKES(inv.amount)}</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 600 }}>+{formatKES(inv.accruedInterest)}</td>
                    <td style={{ fontWeight: 700 }}>{formatKES(inv.currentValue)}</td>
                    <td>
                      <span className={`badge ${
                        inv.status === 'active' ? 'badge-pending' : inv.status === 'matured' ? 'badge-success' : 'badge-danger'
                      }`} style={{ fontSize: '0.65rem' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>Invested: {formatDate(inv.investedAt)}</div>
                      {inv.maturesAt && <div>Matures: {formatDate(inv.maturesAt)}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                        disabled={inv.status !== 'matured'}
                        title={inv.status !== 'matured' ? 'Withdrawal is available upon maturity (simulated yield cycle)' : ''}
                        onClick={() => {
                          setSelectedInvestment(inv);
                          setShowWithdrawModal(true);
                        }}
                      >
                        Withdraw Payout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invest Modal */}
      {showInvestModal && selectedFund && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem' }}>Invest in {selectedFund.name}</h3>
              <button 
                onClick={() => {
                  setShowInvestModal(false);
                  setInvestError(null);
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {investError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                {investError}
              </div>
            )}

            <form onSubmit={handleInvestSubmit}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fund Yield:</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedFund.interestRate}% P.A.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Minimum Deposit:</span>
                  <span style={{ fontWeight: 600 }}>{formatKES(selectedFund.minimumInvestment)}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="investAmount">Investment Amount (KES)</label>
                <input
                  type="number"
                  id="investAmount"
                  className="input-control"
                  placeholder={`Min. ${selectedFund.minimumInvestment}`}
                  min={selectedFund.minimumInvestment}
                  step={1}
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-dark)', fontSize: '0.75rem' }}>
                  Funds will be deducted from your Hazina business wallet balance ({formatKES(user?.walletBalance ?? 0)} available).
                </small>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={investing}
              >
                {investing ? 'Executing transaction...' : 'Confirm MMF Investment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && selectedInvestment && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem' }}>MMF Fund Withdrawal</h3>
              <button 
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawError(null);
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {withdrawError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem' }}>
                {withdrawError}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>MMF Source:</span>
                  <span style={{ fontWeight: 600 }}>{(selectedInvestment as any).fundName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Eligible Value:</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatKES(selectedInvestment.currentValue)}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="withdrawAmount">Withdrawal Amount (KES)</label>
                <input
                  type="number"
                  id="withdrawAmount"
                  className="input-control"
                  placeholder="e.g. 5000"
                  max={selectedInvestment.currentValue}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-dark)', fontSize: '0.75rem' }}>
                  Withdrawals will trigger Safaricom M-Pesa B2C payout directly to your business phone line.
                </small>
              </div>

              <button 
                type="submit" 
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={withdrawing}
              >
                {withdrawing ? 'Processing payout...' : 'Confirm M-Pesa Payout'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investments;
