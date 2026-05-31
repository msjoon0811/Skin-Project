// Main app — routing + auth + top nav
const App = () => {
  const [screen, setScreen]       = React.useState('login');
  const [user, setUser]           = React.useState(null);
  const [token, setToken]         = React.useState(null);
  const [analysisData, setAnalysisData] = React.useState(null);
  const [historyList, setHistoryList]   = React.useState([]);
  const [clinicData, setClinicData]     = React.useState(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showBell, setShowBell]         = React.useState(false);
  const settingsRef = React.useRef(null);
  const bellRef     = React.useRef(null);

  const go = (s) => { window.scrollTo({top:0, behavior:'instant'}); setScreen(s); };

  // 앱 시작 시 저장된 토큰으로 자동 로그인
  React.useEffect(() => {
    const saved = localStorage.getItem('skin_token');
    if (!saved) return;
    fetch('/api/me', { headers: { Authorization: 'Bearer ' + saved } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { localStorage.removeItem('skin_token'); return; }
        setToken(saved);
        setUser(u);
        fetchHistory(saved);
        go('dashboard');
      })
      .catch(() => localStorage.removeItem('skin_token'));
  }, []);

  // 드롭다운 외부 클릭 닫기
  React.useEffect(() => {
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchHistory = (tok) => {
    const t = tok || token;
    const headers = t ? { Authorization: 'Bearer ' + t } : {};
    fetch('/api/history', { headers })
      .then(r => r.json())
      .then(d => { if (d.items) setHistoryList(d.items); })
      .catch(() => {});
  };

  const handleLogin = (u) => {
    const tok = localStorage.getItem('skin_token');
    setUser(u);
    setToken(tok);
    fetchHistory(tok);
    go('dashboard');
  };

  const handleLogout = () => {
    if (token) {
      fetch('/api/logout', { method:'POST', headers:{ Authorization:'Bearer ' + token } }).catch(() => {});
    }
    localStorage.removeItem('skin_token');
    setToken(null); setUser(null);
    setAnalysisData(null); setHistoryList([]);
    setShowSettings(false);
    go('login');
  };

  const handleDeleteAccount = () => {
    if (!window.confirm('계정을 탈퇴하면 모든 분석 기록이 삭제됩니다.\n정말 탈퇴하시겠습니까?')) return;
    fetch('/api/me', {
      method: 'DELETE',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error('탈퇴 처리 실패');
        localStorage.removeItem('skin_token');
        setToken(null); setUser(null);
        setAnalysisData(null); setHistoryList([]);
        setShowSettings(false);
        go('login');
      })
      .catch(() => alert('탈퇴 처리 중 오류가 발생했습니다.'));
  };

  const handleAnalysisComplete = (data) => {
    setAnalysisData(data);
    fetchHistory();
    go('results');
  };

  // 히스토리 삭제: App 레벨 상태도 즉시 반영 (Dashboard 재마운트 후에도 유지)
  const handleDeleteHistory = (item) => {
    setHistoryList(prev => {
      const itemId = item.id || item.analysisId;
      return prev.filter(h => {
        if (itemId) return (h.id || h.analysisId) !== itemId;
        return !(h.date === item.date && h.score === item.score);
      });
    });
  };

  const authHeaders = () => token ? { Authorization: 'Bearer ' + token } : {};

  const showNav = screen !== 'login';

  // 알림 목록 (분석 기록 기반 + 정적 팁)
  const notifItems = [
    ...historyList.slice(0, 2).map(h => ({
      icon: 'chart',
      title: '피부 분석 결과',
      body: `${h.date} · 종합 ${h.score}점 (${h.skinLabel || '분석 완료'})`,
      action: () => { setShowBell(false); },
    })),
    {
      icon: 'sparkle',
      title: '2주 후 재분석 권장',
      body: '피부 상태 변화를 꾸준히 추적해보세요',
      action: () => { setShowBell(false); go('analyze'); },
    },
    {
      icon: 'leaf',
      title: '오늘의 케어 팁',
      body: '외출 전 SPF 50+ 자외선 차단제를 잊지 마세요',
      action: () => { setShowBell(false); },
    },
  ];

  return (
    <div className="app">
      {showNav && (
        <header className="nav">
          <div className="nav-left">
            <div onClick={() => go('dashboard')} style={{cursor:'pointer'}}>
              <Brand size={24} />
            </div>
            <nav className="nav-tabs">
              <button className={"nav-tab " + (screen === 'dashboard' ? 'active' : '')} onClick={() => go('dashboard')}>홈</button>
              <button className={"nav-tab " + (screen === 'analyze'   ? 'active' : '')} onClick={() => go('analyze')}>분석</button>
              <button className={"nav-tab " + (screen === 'results'   ? 'active' : '')} onClick={() => go('results')}>리포트</button>
              <button className={"nav-tab " + (screen === 'clinic'    ? 'active' : '')} onClick={() => go('clinic')}
                style={{display:'flex', alignItems:'center', gap:5}}>
                <Icon name="clinic" size={13}/>피부과 시술
              </button>
              <button className={"nav-tab " + (screen === 'diet'      ? 'active' : '')} onClick={() => go('diet')}
                style={{display:'flex', alignItems:'center', gap:5}}>
                <Icon name="leaf" size={13}/>식단
              </button>
            </nav>
          </div>
          <div className="nav-right">

            {/* ── 알림 버튼 ── */}
            <div className="dropdown-wrap" ref={bellRef}>
              <button
                className={"nav-tab nav-icon-btn " + (showBell ? 'active' : '')}
                title="알림"
                onClick={() => { setShowBell(v => !v); setShowSettings(false); }}>
                <Icon name="bell" size={16}/>
                {historyList.length > 0 && <span className="notif-dot"/>}
              </button>
              {showBell && (
                <div className="dropdown dropdown-bell">
                  <div className="dropdown-header">
                    <div style={{fontWeight:600, fontSize:13.5}}>알림</div>
                    <div className="muted" style={{fontSize:11.5, marginTop:2}}>최근 활동 및 추천</div>
                  </div>
                  {notifItems.map((n, i) => (
                    <button key={i} className="dropdown-item" onClick={n.action}>
                      <span className="notif-icon"><Icon name={n.icon} size={14}/></span>
                      <div style={{flex:1, textAlign:'left'}}>
                        <div style={{fontSize:13, fontWeight:500, color:'var(--ink)'}}>{n.title}</div>
                        <div style={{fontSize:11.5, color:'var(--ink-muted)', marginTop:2}}>{n.body}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── 설정 버튼 ── */}
            <div className="dropdown-wrap" ref={settingsRef}>
              <button
                className={"nav-tab nav-icon-btn " + (showSettings ? 'active' : '')}
                title="설정"
                onClick={() => { setShowSettings(v => !v); setShowBell(false); }}>
                <Icon name="settings" size={16}/>
              </button>
              {showSettings && (
                <div className="dropdown">
                  {user ? (
                    <>
                      <div className="dropdown-header" style={{display:'flex', alignItems:'center', gap:10}}>
                        <div className="avatar-sm">{(user.username?.[0] || '?').toUpperCase()}</div>
                        <div>
                          <div style={{fontWeight:600, fontSize:13.5}}>{user.username}</div>
                          <div className="muted" style={{fontSize:11.5}}>로그인됨</div>
                        </div>
                      </div>
                      <div className="dropdown-divider"/>
                      <button className="dropdown-item" onClick={() => { setShowSettings(false); go('dashboard'); }}>
                        <Icon name="chart" size={15}/> 대시보드
                      </button>
                      <button className="dropdown-item" onClick={() => { setShowSettings(false); go('analyze'); }}>
                        <Icon name="camera" size={15}/> 새 분석 시작
                      </button>
                      <div className="dropdown-divider"/>
                      <button className="dropdown-item" onClick={handleLogout}>
                        <Icon name="arrowLeft" size={15}/> 로그아웃
                      </button>
                      <button className="dropdown-item dropdown-danger" onClick={handleDeleteAccount}>
                        <Icon name="trash" size={15}/> 회원 탈퇴
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="dropdown-header">
                        <div className="muted" style={{fontSize:13}}>로그인이 필요합니다</div>
                      </div>
                      <button className="dropdown-item" onClick={() => { setShowSettings(false); go('login'); }}>
                        <Icon name="user" size={15}/> 로그인 / 회원가입
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── 아바타 (단순 표시, 클릭 없음) ── */}
            <div className="avatar" style={{cursor:'default'}} title={user ? user.username : '미로그인'}>
              {(user?.username?.[0] || '?').toUpperCase()}
            </div>

          </div>
        </header>
      )}

      {screen === 'login' && (
        <LoginScreen onLogin={handleLogin} />
      )}
      {screen === 'dashboard' && (
        <Dashboard
          onStart={() => go('analyze')}
          onViewReport={() => go('results')}
          onViewHistoryItem={(data) => { setAnalysisData(data); go('results'); }}
          analysisData={analysisData}
          historyList={historyList}
          onDeleteHistory={handleDeleteHistory}
        />
      )}
      {screen === 'analyze' && (
        <Analyze
          onComplete={handleAnalysisComplete}
          onBack={() => go('dashboard')}
          authHeaders={authHeaders()}
        />
      )}
      {screen === 'results' && (
        <Results
          data={analysisData}
          onRestart={() => go('analyze')}
          onHome={() => go('dashboard')}
          onGoClinic={() => go('clinic')}
        />
      )}
      {screen === 'clinic' && (
        <Clinic
          analysisData={analysisData}
          onGoAnalyze={() => go('analyze')}
          authHeaders={authHeaders()}
        />
      )}
      {screen === 'diet' && (
        <Diet
          analysisData={analysisData}
          onGoAnalyze={() => go('analyze')}
          authHeaders={authHeaders()}
        />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
