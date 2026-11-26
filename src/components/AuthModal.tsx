import { useEffect, useState } from 'react';
import { ShieldCheck, User, X, AlertCircle } from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import type { AuthStatus, PublicUser } from '../types';

interface AuthModalProps {
  open: boolean;
  initialTab?: 'member' | 'admin';
  authStatus: AuthStatus;
  onClose: () => void;
  onAuthenticated: (user: PublicUser) => void;
  onStatusRefresh: () => void;
}

export function AuthModal({
  open,
  initialTab = 'member',
  authStatus,
  onClose,
  onAuthenticated,
  onStatusRefresh,
}: AuthModalProps) {
  const [roleTab, setRoleTab] = useState<'member' | 'admin'>(initialTab);
  const [memberMode, setMemberMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRoleTab(initialTab);
      setErrorMsg(null);
      setPassword('');
    }
  }, [open, initialTab]);

  if (!open) return null;

  const showFirstRunAdminClaim =
    roleTab === 'admin' && !authStatus.adminClaimed && !authStatus.envAdminConfigured;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (roleTab === 'admin') {
        if (showFirstRunAdminClaim) {
          const res = await apiRequest<{ token: string; user: PublicUser }>(
            '/api/auth/claim-admin',
            {
              method: 'POST',
              body: JSON.stringify({ name, email, password }),
            }
          );
          setAuthToken(res.token);
          onStatusRefresh();
          onAuthenticated(res.user);
          onClose();
        } else {
          const res = await apiRequest<{ token: string; user: PublicUser }>(
            '/api/auth/login',
            {
              method: 'POST',
              body: JSON.stringify({ email, password, role: 'admin' }),
            }
          );
          setAuthToken(res.token);
          onAuthenticated(res.user);
          onClose();
        }
      } else {
        if (memberMode === 'register') {
          const res = await apiRequest<{ token: string; user: PublicUser }>(
            '/api/auth/register',
            {
              method: 'POST',
              body: JSON.stringify({ name, email, password }),
            }
          );
          setAuthToken(res.token);
          onAuthenticated(res.user);
          onClose();
        } else {
          const res = await apiRequest<{ token: string; user: PublicUser }>(
            '/api/auth/login',
            {
              method: 'POST',
              body: JSON.stringify({ email, password, role: 'member' }),
            }
          );
          setAuthToken(res.token);
          onAuthenticated(res.user);
          onClose();
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Autentikasi gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="auth-modal-title" className="text-base font-semibold text-slate-900">
            Akses Portal Farris Library
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog masuk"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Role Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setRoleTab('member');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                roleTab === 'member'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Portal Member
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab('admin');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                roleTab === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Administrator
            </button>
          </div>

          {roleTab === 'member' && (
            <div className="flex items-center gap-4 border-b border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMemberMode('login');
                  setErrorMsg(null);
                }}
                className={`pb-2.5 font-medium border-b-2 transition-colors cursor-pointer ${
                  memberMode === 'login'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Masuk Anggota
              </button>
              <button
                type="button"
                onClick={() => {
                  setMemberMode('register');
                  setErrorMsg(null);
                }}
                className={`pb-2.5 font-medium border-b-2 transition-colors cursor-pointer ${
                  memberMode === 'register'
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Daftar Anggota Baru
              </button>
            </div>
          )}

          {showFirstRunAdminClaim && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed">
              <div className="font-semibold text-slate-900 mb-1">
                Aktivasi Akun Admin Pertama
              </div>
              Belum ada administrator terdaftar pada server ini. Daftarkan akun administrator
              utama untuk mengelola koleksi, pelaporan otomatis, dan pengiriman pengingat email.
            </div>
          )}

          {roleTab === 'admin' && authStatus.envAdminConfigured && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
              Gunakan alamat email Anda dan <span className="font-mono">ADMIN_PASSCODE</span> yang
              dikonfigurasi pada server.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(showFirstRunAdminClaim || (roleTab === 'member' && memberMode === 'register')) && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Adi Pratama"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domain.id"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {roleTab === 'admin' && authStatus.envAdminConfigured
                  ? 'Passcode Admin'
                  : 'Kata Sandi'}
              </label>
              <input
                type="password"
                required
                minLength={roleTab === 'admin' && authStatus.envAdminConfigured ? 1 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
            >
              {loading
                ? 'Memproses...'
                : showFirstRunAdminClaim
                  ? 'Aktifkan Akun Admin'
                  : roleTab === 'admin'
                    ? 'Masuk sebagai Admin'
                    : memberMode === 'register'
                      ? 'Daftar & Masuk'
                      : 'Masuk sebagai Member'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
