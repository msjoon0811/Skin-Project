// Main app — routing + auth + top nav
const App = () => {
  const [screen, setScreen]       = React.useState('login');
  const [user, setUser]           = React.useState(null);
  const [token, setToken]         = React.useState(null);
  const [analysisData, setAnalysisData] = React.useState(null);
  const [historyList, setHistoryList]   = React.useState([]);
  const [clinicData, setClinicData]     = React.useState(null);

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
    go('login');
  };

  const handleAnalysisComplete = (data) => {
    setAnalysisData(data);
    // 서버 기록 최신화
    fetchHistory();
    go('results');
  };

  const authHeaders = () => token ? { Authorization: 'Bearer ' + token } : {};

  const showNav = screen !== 'login';

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
            </nav>
          </div>
          <div className="nav-right">
            <button className="nav-tab" title="알림"><Icon name="bell" size={16}/></button>
            <button className="nav-tab" title="설정"><Icon name="settings" size={16}/></button>
            <div className="avatar" onClick={handleLogout}
              style={{cursor:'pointer'}} title="클릭하면 로그아웃">
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
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
