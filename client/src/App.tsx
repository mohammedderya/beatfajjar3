import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Upload, CheckCircle2, XCircle, AlertTriangle, Lock } from 'lucide-react';
import { io } from 'socket.io-client';

interface Voter {
  id: number;
  m_serial: string | null;
  num: string | null;
  first_name: string | null;
  father_name: string | null;
  grand_name: string | null;
  family_name: string | null;
  code: string | null;
  national_id: string | null;
  school: string | null;
  voted: boolean;
  time: string | null;
}

const RENDER_URL = 'https://betfajjar-app.onrender.com';
const API_URL = RENDER_URL ? `${RENDER_URL}/api` : '/api';

// Robust fetch helper to handle retries, content-type checks, and raw logging
const robustFetch = async (url: string, options: RequestInit, retries = 3): Promise<any> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return { ok: response.ok, data, status: response.status };
      } else {
        // Not JSON! Log raw text for debugging
        const rawText = await response.text();
        console.error(`ABS-API-ERROR: Expected JSON but received: ${contentType}`, {
          url,
          status: response.status,
          peek: rawText.substring(0, 200)
        });
        
        if (i < retries - 1 && response.status >= 500) {
          console.warn(`Retrying... (${i + 1}/${retries})`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }
    } catch (error: any) {
      if (i === retries - 1) throw error;
      console.warn(`Fetch attempt ${i + 1} failed: ${error.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
};

export default function App() {
  const [password, setPassword] = useState(localStorage.getItem('auth_pass') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const [loginError, setLoginError] = useState('');

  const [voters, setVoters] = useState<Voter[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'voted' | 'not_voted'>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmVoter, setConfirmVoter] = useState<Voter | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const { ok, data } = await robustFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (ok) {
        setIsAuthenticated(true);
        setRole(data.role);
        roleRef.current = data.role;
        localStorage.setItem('auth_pass', password);
        fetchVoters(password);
        setupSocket(data.role);
      } else {
        setLoginError(data.error || 'كلمة المرور غير صحيحة');
        setLoading(false);
        localStorage.removeItem('auth_pass');
      }
    } catch (err: any) {
      setLoginError(`خطأ في الاتصال: ${err.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (password) {
      handleLogin();
    } else {
      setLoading(false);
    }
  }, []);

  const setupSocket = (userRole: string) => {
    if (!RENDER_URL && window.location.hostname !== 'localhost') return null;

    const socket = io(RENDER_URL || '', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      socket.emit('register', { role: userRole });
    });

    socket.on('voter_updated', (updatedVoter: Voter) => {
      setVoters(prev => prev.map(v => v.id === updatedVoter.id ? updatedVoter : v));
    });



    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    return socket;
  };

  const fetchVoters = async (currentPass: string) => {
    try {
      const { ok, data, status } = await robustFetch(`${API_URL}/voters`, {
        headers: { 'x-auth-password': currentPass }
      });
      if (ok) {
        setVoters(data);
      } else if (status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch voters:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setRole(null);
    setPassword('');
    localStorage.removeItem('auth_pass');
    setVoters([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { ok, data } = await robustFetch(`${API_URL}/voters/import`, {
        method: 'POST',
        headers: { 'x-auth-password': password },
        body: formData,
      });
      if (ok) {
        alert(data.message);
        fetchVoters(password);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Failed to upload file: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (!window.confirm('هل أنت متأكد من مسح جميع بيانات الناخبين؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    try {
      const { ok, data } = await robustFetch(`${API_URL}/voters/reset`, {
        method: 'POST',
        headers: { 'x-auth-password': password }
      });
      if (ok) {
        alert('تم مسح السجل بنجاح');
        fetchVoters(password);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Failed to reset database: ${err.message}`);
    }
  };

  const handleResetVotes = async () => {
    if (!window.confirm('هل أنت متأكد من تصفير سجل التصويت؟ سيتم إرجاع جميع الناخبين إلى حالة "لم يصوت".')) return;
    
    setLoading(true);
    try {
      const { ok, data } = await robustFetch(`${API_URL}/reset-vote`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-password': password
        }
      });
      
      if (ok) {
        alert(data.message || 'تم التصفير بنجاح');
        fetchVoters(password);
      } else {
        alert(`Failed to reset voting status: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Failed to reset voting status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const markVoter = async (id: number) => {
    setConfirmVoter(null);
    setProcessingId(id);
    
    try {
      const { ok, data } = await robustFetch(`${API_URL}/voters/vote/${id}`, { 
        method: 'POST',
        headers: { 'x-auth-password': password }
      });
      if (ok) {
        setVoters(prev => prev.map(v => v.id === id ? data : v));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Failed to mark voter: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Derived state
  const stats = useMemo(() => {
    const total = voters.length;
    const voted = voters.filter(v => v.voted).length;
    const notVoted = total - voted;
    return { total, voted, notVoted };
  }, [voters]);

  const filteredVoters = useMemo(() => {
    return voters.filter(v => {
      // Filter logic
      if (filter === 'voted' && !v.voted) return false;
      if (filter === 'not_voted' && v.voted) return false;
      
      // Search logic
      if (search) {
        const s = search.toLowerCase();
        const fullName = `${v.first_name || ''} ${v.father_name || ''} ${v.grand_name || ''} ${v.family_name || ''}`.toLowerCase();
        const nMatch = fullName.includes(s);
        const idMatch = v.national_id ? v.national_id.toLowerCase().includes(s) : false;
        
        if (!nMatch && !idMatch) return false;
      }
      return true;
    });
  }, [voters, search, filter]);

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ background: 'white', padding: '3rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <img src="/logo.png" alt="شعار قائمة بيت فجار الغد" style={{ height: '80px', marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-dark)' }}>نظام قائمة بيت فجار الغد</h2>
          <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>تسجيل الدخول للنظام</p>
          
          <form onSubmit={handleLogin}>
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <Lock size={20} color="#9CA3AF" style={{ position: 'absolute', top: '12px', right: '12px' }} />
              <input
                type="password"
                className="search-input"
                style={{ paddingRight: '2.5rem', textAlign: 'right' }}
                placeholder="كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            
            {loginError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{loginError}</div>}
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={loading}>
              {loading ? <div className="loading-spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px', display: 'inline-block' }}/> : 'دخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header" style={{ position: 'relative' }}>
        <button onClick={handleLogout} className="btn" style={{ position: 'absolute', top: '1rem', left: '1rem', background: '#f3f4f6', color: 'var(--text-dark)' }}>
          تسجيل الخروج
        </button>
        <div className="header-top">
          <img src="/logo.png" alt="شعار قائمة بيت فجار الغد" className="main-logo" />
          <div style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '0.7rem', color: '#ccc' }}>v1.3</div>
          <div className="election-number-box">
            <span className="election-number-label">الرقم الانتخابي</span>
            <span>3</span>
          </div>
          <div className="list-title-box">
            <h1>قائمة بيت فجار الغد</h1>
            <h2>معاً نحو مستقبل أفضل</h2>
          </div>
          <img 
            src="/candidates.jpg" 
            alt="المرشحين" 
            style={{ 
              height: '130px', 
              objectFit: 'contain', 
              borderRadius: '8px', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              marginLeft: '1rem'
            }} 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
        <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
          نظام سريع وموثوق لتتبع عملية الاقتراع
          {role === 'staff' && <span style={{display: 'inline-block', background: '#ede9fe', color: '#6d28d9', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', marginRight: '0.5rem'}}>صلاحية: مساعد</span>}
          {role === 'admin' && <span style={{display: 'inline-block', background: '#fee2e2', color: '#b91c1c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', marginRight: '0.5rem'}}>صلاحية: مدير</span>}
        </p>
      </header>

      {/* Stats row */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value stat-total">{stats.total}</span>
          <span className="stat-title">إجمالي الناخبين</span>
        </div>
        <div className="stat-card">
          <span className="stat-value stat-voted">{stats.voted}</span>
          <span className="stat-title">تم التصويت</span>
        </div>
        <div className="stat-card">
          <span className="stat-value stat-not-voted">{stats.notVoted}</span>
          <span className="stat-title">لم يصوت</span>
        </div>

      </div>

      {/* Controls */}
      <div className="controls-panel">
        <div className="search-wrapper">
          <Search size={20} color="#9CA3AF" style={{ position: 'absolute', top: '12px', right: '12px' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingRight: '2.5rem', paddingLeft: '1rem' }}
            placeholder="ابحث بالاسم أو رقم الهوية..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button 
            className={`btn btn-filter ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            الكل
          </button>
          <button 
            className={`btn btn-filter ${filter === 'voted' ? 'active' : ''}`}
            onClick={() => setFilter('voted')}
          >
            صوت
          </button>
          <button 
            className={`btn btn-filter ${filter === 'not_voted' ? 'active' : ''}`}
            onClick={() => setFilter('not_voted')}
          >
            لم يصوت
          </button>
        </div>

        {role === 'admin' && (
          <div>
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              id="file-upload" 
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              ref={fileInputRef}
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="import-label">
              {uploading ? <div className="loading-spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}/> : <Upload size={18} />}
              استيراد بيانات (Excel/CSV)
            </label>
            <button 
              className="btn btn-filter" 
              style={{ marginRight: '0.5rem', color: 'var(--primary)' }}
              onClick={handleResetVotes}
            >
              تصفير سجل التصويت
            </button>
            <button 
              className="btn btn-filter" 
              style={{ marginRight: '0.5rem', color: 'var(--danger)' }}
              onClick={handleReset}
            >
              حذف سجل الناخبين
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="loading-spinner"></div>
            <p style={{ marginTop: '1rem', color: 'var(--text-light)' }}>جاري تحميل البيانات...</p>
          </div>
        ) : (
          <table className="voter-table">
            <thead>
              <tr>
                <th>م</th>
                <th>الرقم</th>
                <th>الاسم الأول</th>
                <th>اسم الأب</th>
                <th>اسم الجد</th>
                <th>اللقب</th>
                <th>الرمز</th>
                <th>رقم الهوية</th>
                <th>المدرسة</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredVoters.map(voter => (
                <tr key={voter.id}>
                  <td>{voter.m_serial || '-'}</td>
                  <td>{voter.num || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{voter.first_name || '-'}</td>
                  <td>{voter.father_name || '-'}</td>
                  <td>{voter.grand_name || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{voter.family_name || '-'}</td>
                  <td>{voter.code || '-'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{voter.national_id || '-'}</td>
                  <td>{voter.school || '-'}</td>
                  <td>
                    {voter.voted ? (
                      <span className="badge badge-voted">
                         <CheckCircle2 size={14} style={{ marginLeft: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                        تم التصويت
                      </span>
                    ) : (
                      <span className="badge badge-not-voted">
                         <XCircle size={14} style={{ marginLeft: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                        لم يصوت
                      </span>
                    )}
                  </td>
                  <td>
                    <button 
                      className={`btn ${voter.voted ? 'btn-filter' : 'btn-primary'}`}
                      disabled={voter.voted || processingId === voter.id}
                      onClick={() => !voter.voted && setConfirmVoter(voter)}
                    >
                      {processingId === voter.id ? (
                        <><div className="loading-spinner" style={{width: '1rem', height: '1rem', borderWidth: '2px', marginRight: '0.5rem'}}/> جاري المعالجة...</>
                      ) : voter.voted ? 'مكتمل' : 'تسجيل حضور'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredVoters.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '3rem' }}>
                    لا يوجد نتائج مطابقة للبحث أو الفلتر
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmVoter && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
              <AlertTriangle />
              تأكيد تسجيل الحضور
            </h2>
            <p className="modal-text">
              هل أنت متأكد من تسجيل الناخب <strong>{[confirmVoter.first_name, confirmVoter.father_name, confirmVoter.grand_name, confirmVoter.family_name].filter(Boolean).join(' ')}</strong> كحاضر ومصوت؟
              <br/><br/>
              <span style={{ fontSize: '0.9rem' }}>لا يمكن التراجع عن هذه الخطوة.</span>
            </p>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setConfirmVoter(null)}
              >
                إلغاء
              </button>
              <button 
                className="btn btn-success"
                onClick={() => markVoter(confirmVoter.id)}
              >
                تأكيد وتسجيل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
