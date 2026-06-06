import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);
const isValidPhone = (value: string) => /^(?:\+?254|0)[71]\d{8}$/.test(value.trim());

interface RegisterProps {
  onNavigateToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onNavigateToLogin }) => {
  const { register } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !businessName.trim() || !email || !phone || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setError('First name and last name must each be at least 2 characters');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isValidPhone(phone)) {
      setError('Please enter a valid Kenyan phone number, e.g. 254712345678');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await register({
        firstName,
        lastName,
        businessName,
        email,
        phone,
        password,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '8px' }}>
            HazinaHub <span style={{ color: 'var(--primary)' }}>💸</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Register your Kenyan business account
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--danger-glow)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                className="input-control"
                placeholder="Bruce"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lastName">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                className="input-control"
                placeholder="Ominde"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="businessName">
              Business Name
            </label>
            <input
              type="text"
              id="businessName"
              className="input-control"
              placeholder="e.g., Hazina Enterprises"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="input-control"
              placeholder="e.g., info@business.co.ke"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              M-Pesa Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              className="input-control"
              placeholder="e.g., 254712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <small style={{ color: 'var(--text-dark)', fontSize: '0.75rem' }}>
              Format: 254XXXXXXXXX (Safaricom line for STK push and payouts)
            </small>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Create Password
            </label>
            <input
              type="password"
              id="password"
              className="input-control"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '12px' }}
            disabled={submitting}
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
          <button
            onClick={onNavigateToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
