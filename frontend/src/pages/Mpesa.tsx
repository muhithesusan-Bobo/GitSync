import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import api, { getOfflineQueueLength, processOfflineQueue } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Transaction, ApiResponse, PaginatedResponse } from '@hazinahub/types';
import { formatKES, formatDate } from '@hazinahub/utils';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck, RefreshCw, AlertCircle, CheckCircle, Mic, UploadCloud, FileText, WifiOff } from 'lucide-react';

const Mpesa: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  
  // Tab State
  const [activeSubTab, setActiveSubTab] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Deposit Form State
  const [depPhone, setDepPhone] = useState(user?.phone || '');
  const [depAmount, setDepAmount] = useState('');
  const [depLoading, setDepLoading] = useState(false);
  const [depSuccess, setDepSuccess] = useState<string | null>(null);
  const [depError, setDepError] = useState<string | null>(null);

  // Withdraw Form State
  const [witPhone, setWitPhone] = useState(user?.phone || '');
  const [witAmount, setWitAmount] = useState('');
  const [witLoading, setWitLoading] = useState(false);
  const [witSuccess, setWitSuccess] = useState<string | null>(null);
  const [witError, setWitError] = useState<string | null>(null);

  // Ledger State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [offlineQueueLength, setOfflineQueueLength] = useState(0);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState('');
  const [voiceAction, setVoiceAction] = useState<{ type: 'deposit' | 'withdraw'; amount: number; phone: string } | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [receiptScanLoading, setReceiptScanLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState<number | null>(null);
  const [receiptPhone, setReceiptPhone] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  const fetchTransactions = async () => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const typeQuery = filterType ? `&type=${filterType}` : '';
      const statusQuery = filterStatus ? `&status=${filterStatus}` : '';
      const response = await api.get<PaginatedResponse<Transaction>>(
        `/transactions?page=${page}&limit=10${typeQuery}${statusQuery}`
      );
      if (response.data.success && response.data.data) {
        setTransactions(response.data.data);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages);
        }
      } else {
        setLedgerError(response.data.error || 'Failed to load transaction ledger');
      }
    } catch (err: any) {
      setLedgerError(err.response?.data?.error || err.message || 'Error fetching transactions');
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    setOfflineQueueLength(getOfflineQueueLength());

    const onOnline = async () => {
      await processOfflineQueue();
      setOfflineQueueLength(getOfflineQueueLength());
      fetchTransactions();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [page, filterType, filterStatus]);

  const parseCommand = (text: string) => {
    const normalized = text.toLowerCase();
    const depositPattern = /(?:deposit|add|pay|fund)\s+([0-9,]+(?:\.\d{1,2})?)(?:\s*(?:kes|shs|sh))?(?:\s*(?:to|into|for)\s*(2547\d{8}|\+2547\d{8}|07\d{8}))?/i;
    const withdrawPattern = /(?:withdraw|cash\s*out|send|payout|pay)\s+([0-9,]+(?:\.\d{1,2})?)(?:\s*(?:kes|shs|sh))?(?:\s*(?:to|into|for)\s*(2547\d{8}|\+2547\d{8}|07\d{8}))?/i;

    let match = normalized.match(depositPattern);
    if (match) {
      return {
        type: 'deposit' as const,
        amount: Number(match[1].replace(/,/g, '')),
        phone: match[2] || depPhone || witPhone,
      };
    }

    match = normalized.match(withdrawPattern);
    if (match) {
      return {
        type: 'withdraw' as const,
        amount: Number(match[1].replace(/,/g, '')),
        phone: match[2] || witPhone || depPhone,
      };
    }

    return null;
  };

  const handleVoiceStart = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice commands are not supported by your browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setVoiceResult(transcript);
      setVoiceError(null);
      const parsed = parseCommand(transcript);
      if (!parsed || !parsed.amount || !parsed.phone) {
        setVoiceAction(null);
        setVoiceError('Could not identify a deposit or withdrawal voice command. Try “deposit 1000 to 2547...” or “withdraw 500 to 072...”');
        return;
      }
      setVoiceAction(parsed);
    };

    recognition.onerror = (event: any) => {
      setVoiceError(event.error || 'Voice recognition failed.');
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    setVoiceListening(true);
    setVoiceResult('Listening...');
    setVoiceError(null);
    recognition.start();
  };

  const handleVoiceStop = () => {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  };

  const handleVoiceAction = async () => {
    if (!voiceAction) {
      setVoiceError('No parsed voice command available to execute.');
      return;
    }

    setVoiceLoading(true);
    setVoiceError(null);
    setVoiceSuccess(null);
    try {
      const response = await api.post<ApiResponse<any>>(
        voiceAction.type === 'deposit' ? '/transactions/pay' : '/transactions/withdraw',
        {
          phone: voiceAction.phone,
          amount: voiceAction.amount,
        }
      );

      if (response.data.success) {
        setVoiceSuccess(
          voiceAction.type === 'deposit'
            ? response.data.data?.customerMessage || 'Voice deposit command queued. Confirm on your phone.'
            : response.data.data?.message || 'Voice withdrawal command initiated.'
        );
        setVoiceAction(null);
        setVoiceResult('');
        setOfflineQueueLength(getOfflineQueueLength());
        setTimeout(() => {
          refreshProfile();
          fetchTransactions();
        }, 4000);
      } else {
        setVoiceError(response.data.error || 'Voice transaction request failed.');
      }
    } catch (err: any) {
      setVoiceError(err.response?.data?.error || err.message || 'Voice transaction failed.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const parseReceiptText = (text: string) => {
    const amountMatch = text.match(/(?:total|amount|due|pay)\s*[:\-]?\s*(?:kes|shs|sh)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    const phoneMatch = text.match(/(2547\d{8}|\+2547\d{8}|07\d{8})/);
    return {
      amount: amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null,
      phone: phoneMatch ? phoneMatch[0] : '',
    };
  };

  const handleReceiptUpload = async (file: File) => {
    setReceiptScanLoading(true);
    setReceiptError(null);
    setReceiptText('');
    setReceiptAmount(null);
    setReceiptPhone('');

    try {
      const worker = await createWorker({ logger: () => {} });
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data } = await worker.recognize(file);
      const extracted = data.text || '';
      setReceiptText(extracted);
      const parsed = parseReceiptText(extracted);
      if (!parsed.amount) {
        setReceiptError('Unable to detect a payment amount from the receipt image.');
      } else {
        setReceiptAmount(parsed.amount);
        setReceiptPhone(parsed.phone || '');
      }
      await worker.terminate();
    } catch (err: any) {
      setReceiptError(err?.message || 'Receipt scan failed. Please try another image.');
    } finally {
      setReceiptScanLoading(false);
    }
  };

  const useReceiptForDeposit = () => {
    if (receiptAmount) {
      setDepAmount(receiptAmount.toString());
    }
    if (receiptPhone) {
      setDepPhone(receiptPhone);
    }
  };

  const useReceiptForWithdraw = () => {
    if (receiptAmount) {
      setWitAmount(receiptAmount.toString());
    }
    if (receiptPhone) {
      setWitPhone(receiptPhone);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepError(null);
    setDepSuccess(null);

    const amountNum = parseFloat(depAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setDepError('Please enter a valid deposit amount');
      return;
    }

    setDepLoading(true);
    try {
      const response = await api.post<ApiResponse<any>>('/transactions/pay', {
        phone: depPhone,
        amount: amountNum,
      });

      if (response.data.success) {
        setDepSuccess(response.data.data?.customerMessage || 'STK Push query sent! Please enter your M-Pesa PIN on your phone.');
        setDepAmount('');
        // Refresh profile and transactions shortly after
        setTimeout(() => {
          refreshProfile();
          fetchTransactions();
        }, 5000);
      } else {
        setDepError(response.data.error || 'STK Push initiation failed');
      }
    } catch (err: any) {
      setDepError(err.response?.data?.error || err.message || 'Deposit error occurred');
    } finally {
      setDepLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWitError(null);
    setWitSuccess(null);

    const amountNum = Number(witAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setWitError('Please enter a withdrawal amount greater than zero');
      return;
    }

    const currentBalance = Number((user as any)?.walletBalance || 0);
    if (amountNum > currentBalance) {
      setWitError(`Insufficient funds. Your maximum cashout is KES ${currentBalance.toLocaleString()}`);
      return;
    }

    setWitLoading(true);
    try {
      const response = await api.post<ApiResponse<any>>('/transactions/withdraw', {
        phone: witPhone,
        amount: amountNum
      });

      if (response.data.success) {
        setWitSuccess(response.data.data?.message || `KES ${amountNum.toLocaleString()} successfully cashed out.`);
        setWitAmount('');
        await Promise.all([refreshProfile(), fetchTransactions()]);
      } else {
        setWitError(response.data.error || 'Withdrawal transaction failed');
      }
    } catch (err: any) {
      setWitError(err.response?.data?.error || err.message || 'Withdrawal failed');
    } finally {
      setWitLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>M-Pesa Transfers</h1>
          <p style={{ color: 'var(--text-muted)' }}>Deposit capital securely via STK Push or initiate withdrawals to your phone.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '32px', alignItems: 'start', marginBottom: '40px' }}>
        {/* Form panel */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          {/* Sub tabs */}
          <div style={{ 
            display: 'flex', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '10px', 
            padding: '4px',
            marginBottom: '28px',
            border: '1px solid var(--border-glass)'
          }}>
            <button 
              className="btn" 
              style={{ 
                flex: 1, 
                borderRadius: '8px',
                background: activeSubTab === 'deposit' ? 'var(--primary-glow)' : 'transparent',
                color: activeSubTab === 'deposit' ? 'var(--primary)' : 'var(--text-muted)',
                padding: '8px 0'
              }}
              onClick={() => setActiveSubTab('deposit')}
            >
              <ArrowDownLeft size={16} /> Deposit (STK Push)
            </button>
            <button 
              className="btn" 
              style={{ 
                flex: 1, 
                borderRadius: '8px',
                background: activeSubTab === 'withdraw' ? 'var(--secondary-glow)' : 'transparent',
                color: activeSubTab === 'withdraw' ? 'var(--secondary)' : 'var(--text-muted)',
                padding: '8px 0'
              }}
              onClick={() => setActiveSubTab('withdraw')}
            >
              <ArrowUpRight size={16} /> Withdraw (Payout)
            </button>
          </div>

          {activeSubTab === 'deposit' ? (
            /* DEPOSIT FORM */
            <form onSubmit={handleDepositSubmit}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Paystack STK Push Deposit</h3>
              
              {depSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{depSuccess}</span>
                </div>
              )}

              {depError && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{depError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="depPhone">Safaricom Line</label>
                <input
                  type="tel"
                  id="depPhone"
                  className="input-control"
                  placeholder="e.g. 254712345678"
                  value={depPhone}
                  onChange={(e) => setDepPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="depAmount">Deposit Amount (KES)</label>
                <input
                  type="number"
                  id="depAmount"
                  className="input-control"
                  placeholder="e.g. 1000"
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={depLoading}
              >
                {depLoading ? 'Initiating Push...' : 'Request M-Pesa STK Push'}
              </button>
            </form>
          ) : (
            /* WITHDRAW FORM */
            <form onSubmit={handleWithdrawSubmit}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Paystack Mobile Money Payout</h3>
              
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-glass)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Withdrawable Balance: </span>
                <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{formatKES((user as any)?.walletBalance || 0)}</span>
                <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Funds will be paid out directly via Paystack to the phone number below.</div>
              </div>

              {witSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{witSuccess}</span>
                </div>
              )}

              {witError && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{witError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="witPhone">Safaricom Line</label>
                <input
                  type="tel"
                  id="witPhone"
                  className="input-control"
                  placeholder="e.g. 254712345678"
                  value={witPhone}
                  onChange={(e) => setWitPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="witAmount">Withdrawal Amount (KES)</label>
                <input
                  type="number"
                  id="witAmount"
                  className="input-control"
                  placeholder="e.g. 500"
                  min={1}
                  step={1}
                  max={(user as any)?.walletBalance || 0}
                  value={witAmount}
                  onChange={(e) => setWitAmount(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                disabled={witLoading}
              >
                {witLoading ? 'Requesting Paystack payout...' : 'Request Cashout'}
              </button>
            </form>
          )}
        </div>

        {/* Transaction Ledger Table */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Transaction Ledger</h2>
            <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={fetchTransactions}>
              <RefreshCw size={12} /> Sync
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <select 
                className="input-control" 
                style={{ paddingRight: '24px', fontSize: '0.875rem' }}
                value={filterType} 
                onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              >
                <option value="">All Types</option>
                <option value="stk_push">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <select 
                className="input-control" 
                style={{ fontSize: '0.875rem' }}
                value={filterStatus} 
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {ledgerLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ width: '30px', height: '30px', border: '2px solid rgba(16, 185, 129, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : ledgerError ? (
            <div style={{ color: 'var(--danger)', padding: '20px 0', textAlign: 'center', fontSize: '0.875rem' }}>{ledgerError}</div>
          ) : transactions.length === 0 ? (
            <div style={{ color: 'var(--text-dark)', padding: '40px 0', textAlign: 'center' }}>No transactions match search criteria.</div>
          ) : (
            <div>
              <div className="data-table-wrapper" style={{ maxHeight: '380px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref/Receipt</th>
                      <th>Type</th>
                      <th>Phone</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                          {tx.mpesaReceiptNumber ? tx.mpesaReceiptNumber : tx.id.substring(0, 8)}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {tx.type === 'c2b' || tx.type === 'stk_push' ? 'Deposit' : 'Payout'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx.phone}</td>
                        <td style={{ 
                          fontWeight: 700,
                          color: tx.type === 'c2b' || tx.type === 'stk_push' ? 'var(--primary)' : 'var(--danger)'
                        }}>
                          {tx.type === 'c2b' || tx.type === 'stk_push' ? '+' : '-'}{formatKES(tx.amount)}
                        </td>
                        <td>
                          <span className={`badge ${
                            tx.status === 'completed' ? 'badge-success' : tx.status === 'pending' ? 'badge-pending' : 'badge-danger'
                          }`} style={{ fontSize: '0.65rem' }}>
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px', alignItems: 'center' }}>
                  <button 
                    className="btn btn-glass" 
                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }} 
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                  <button 
                    className="btn btn-glass" 
                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }} 
                    disabled={page === totalPages}
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '28px', marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Smart Capture</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Use voice commands or receipt scanning to populate deposits and withdrawals faster.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <WifiOff size={16} /> Offline queue: {offlineQueueLength}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '24px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Voice-to-Ledger</h3>
            {voiceSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
                {voiceSuccess}
              </div>
            )}
            {voiceError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
                {voiceError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={voiceListening ? handleVoiceStop : handleVoiceStart}
              >
                <Mic size={16} /> {voiceListening ? 'Stop Listening' : 'Start Voice Capture'}
              </button>
              <button
                type="button"
                className="btn btn-glass"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={handleVoiceAction}
                disabled={!voiceAction || voiceLoading}
              >
                <ArrowUpRight size={16} /> Execute
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', minHeight: '72px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>Detected Voice Command</div>
              <div>{voiceResult || 'Listening will capture a command like “deposit 1000 to 2547...”'}</div>
              {voiceAction && (
                <div style={{ marginTop: '12px', color: 'var(--text-main)' }}>
                  Parsed action: <strong>{voiceAction.type}</strong> <strong>{formatKES(voiceAction.amount)}</strong> to <strong>{voiceAction.phone}</strong>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Receipt Scan</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <label className="btn btn-glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <UploadCloud size={16} /> Upload Receipt
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleReceiptUpload(file);
                    }
                  }}
                />
              </label>
            </div>
            {receiptScanLoading && (
              <div style={{ color: 'var(--text-muted)', marginBottom: '14px' }}>Scanning receipt... please wait.</div>
            )}
            {receiptError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '14px', borderRadius: '10px', marginBottom: '14px' }}>
                {receiptError}
              </div>
            )}
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
              <FileText size={16} style={{ marginRight: '8px' }} /> Parsed amount and phone are shown below.
            </div>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Amount detected</div>
                <div style={{ fontWeight: 700, color: receiptAmount ? 'var(--primary)' : 'var(--text-dark)' }}>
                  {receiptAmount ? formatKES(receiptAmount) : 'None yet'}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Phone detected</div>
                <div style={{ fontWeight: 700, color: receiptPhone ? 'var(--text-main)' : 'var(--text-dark)' }}>
                  {receiptPhone || 'None yet'}
                </div>
              </div>
            </div>
            {receiptText && (
              <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: 'var(--text-dark)', whiteSpace: 'pre-wrap', fontSize: '0.825rem', marginBottom: '16px' }}>
                <strong>Extracted Receipt Text</strong>
                <div style={{ marginTop: '8px' }}>{receiptText}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-primary" onClick={useReceiptForDeposit} disabled={!receiptAmount}>
                Use for Deposit
              </button>
              <button type="button" className="btn btn-secondary" onClick={useReceiptForWithdraw} disabled={!receiptAmount}>
                Use for Withdraw
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Mpesa;
