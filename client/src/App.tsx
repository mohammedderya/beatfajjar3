import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
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
const API_URL = RENDER_URL ? `${RENDER_URL}/api` : (window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api');

export default function App() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'voted' | 'not_voted'>('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmVoter, setConfirmVoter] = useState<Voter | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVoters = async () => {
    try {
      const res = await fetch(`${API_URL}/voters`);
      if (res.ok) {
        const data = await res.json();
        setVoters(data);
      }
    } catch (err) {
      console.error('Failed to fetch voters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoters();

    // Establish WebSocket Connection
    // Prioritize Render URL if available so Netlify uses it, otherwise relative
    const socket = RENDER_URL 
      ? io(RENDER_URL) 
      : (window.location.hostname === 'localhost' ? io('http://localhost:3001') : io());
    
    socket.on('voter_updated', (updatedVoter: Voter) => {
      setVoters(prev => prev.map(v => v.id === updatedVoter.id ? updatedVoter : v));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const secret = window.prompt('يرجى إدخال كلمة سر المسؤول (Admin Secret) لإتمام الرفع:');
    if (!secret) {
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/voters/import`, {
        method: 'POST',
        headers: { 'x-admin-secret': secret },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchVoters();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (!window.confirm('هل أنت متأكد من مسح جميع بيانات الناخبين؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    const secret = window.prompt('يرجى إدخال كلمة سر المسؤول (Admin Secret) لمسح البيانات:');
    if (!secret) return;

    try {
      const res = await fetch(`${API_URL}/voters/reset`, {
        method: 'POST',
        headers: { 'x-admin-secret': secret }
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم مسح السجل بنجاح');
        fetchVoters();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to reset database');
    }
  };

  const markVoter = async (id: number) => {
    setConfirmVoter(null);
    setProcessingId(id);
    
    try {
      const res = await fetch(`${API_URL}/voters/vote/${id}`, { method: 'POST' });
      if (res.ok) {
        const updatedVoter = await res.json();
        setVoters(prev => prev.map(v => v.id === id ? updatedVoter : v));
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      alert('Failed to mark voter');
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

  return (
    <div className="container">
      <header className="header">
        <div className="header-top">
          <img src="/logo.png" alt="شعار قائمة بيت فجار الغد" className="main-logo" />
          <div className="election-number-box">
            <span className="election-number-label">الرقم الانتخابي</span>
            <span>3</span>
          </div>
          <div className="list-title-box">
            <h1>قائمة بيت فجار الغد</h1>
            <h2>معاً نحو مستقبل أفضل</h2>
          </div>
        </div>
        <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>نظام سريع وموثوق لتتبع عملية الاقتراع</p>
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
            style={{ marginRight: '0.5rem', color: 'var(--danger)' }}
            onClick={handleReset}
          >
            إفراغ السجل
          </button>
        </div>
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
