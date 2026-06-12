import React, { useState } from 'react';
import { X, LogOut } from 'lucide-react';
import { isSyncConfigured, signIn, signOut, fullSync } from '../sync';
import { useSyncState } from '../hooks/useSync';

const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    userSelect: 'none',
};

const Dot = ({ color }) => (
    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
);

const formatTime = (ms) =>
    new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

const SyncStatus = () => {
    const sync = useSyncState();
    const [showLogin, setShowLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    if (!isSyncConfigured()) {
        return (
            <div
                style={{ ...rowStyle, cursor: 'help' }}
                title=".env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 설정하면 기기 간 동기화가 켜집니다."
            >
                <Dot color="var(--text-tertiary)" />
                <span>동기화 미설정</span>
            </div>
        );
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await signIn(email, password);
            setShowLogin(false);
            setEmail('');
            setPassword('');
        } catch (err) {
            setError(err.message || '로그인에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const statusRow = (() => {
        switch (sync.status) {
            case 'logged_out':
                return (
                    <div style={rowStyle} onClick={() => setShowLogin(true)}>
                        <Dot color="#F2C94C" />
                        <span>동기화 로그인</span>
                    </div>
                );
            case 'syncing':
                return (
                    <div style={{ ...rowStyle, cursor: 'default' }}>
                        <Dot color="#2D9CDB" />
                        <span>동기화 중…</span>
                    </div>
                );
            case 'error':
                return (
                    <div style={rowStyle} onClick={() => fullSync()} title={`${sync.error}\n클릭하면 다시 시도합니다.`}>
                        <Dot color="#EB5757" />
                        <span>동기화 오류 · 재시도</span>
                    </div>
                );
            default: // idle (로그인됨)
                return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={rowStyle} onClick={() => fullSync()} title="클릭하면 지금 동기화합니다.">
                            <Dot color="#27AE60" />
                            <span>동기화 켜짐{sync.lastSyncAt ? ` · ${formatTime(sync.lastSyncAt)}` : ''}</span>
                        </div>
                        <button onClick={signOut} title="로그아웃" style={{ color: 'var(--text-tertiary)', display: 'flex', padding: '2px' }}>
                            <LogOut size={13} />
                        </button>
                    </div>
                );
        }
    })();

    return (
        <>
            {statusRow}

            {showLogin && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '360px',
                        padding: '1.5rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#1E1E1E'
                    }}>
                        <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem' }}>동기화 로그인</h2>
                            <button onClick={() => setShowLogin(false)}><X size={20} color="var(--text-secondary)" /></button>
                        </div>

                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <input
                                type="email"
                                required
                                autoFocus
                                placeholder="이메일"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                            />
                            <input
                                type="password"
                                required
                                placeholder="비밀번호"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                            />

                            {error && (
                                <p style={{ fontSize: '0.8rem', color: '#EB5757' }}>{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={busy}
                                style={{
                                    marginTop: '0.5rem',
                                    backgroundColor: 'var(--text-primary)',
                                    color: 'var(--bg-primary)',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    opacity: busy ? 0.6 : 1
                                }}
                            >
                                {busy ? '로그인 중…' : '로그인'}
                            </button>

                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                                계정은 Supabase 대시보드 → Authentication → Users에서 만들 수 있어요.
                            </p>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default SyncStatus;
