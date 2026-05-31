// Main app — routing + top nav
const App = () => {
  const [screen, setScreen] = React.useState('login');
  const [user, setUser] = React.useState(null);
  const [analysisData, setAnalysisData] = React.useState(null);
  const [historyList, setHistoryList] = React.useState([]);

  const go = (s) => { window.scrollTo({top:0, behavior:'instant'}); setScreen(s); };

  const handleAnalysisComplete = (data) => {
    setAnalysisData(data);
    const now = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\. /g,'·').replace('.','');
    setHistoryList(prev => {
      const delta = prev.length > 0 ? data.composite_score - prev[0].score : null;
      return [{
        date: now,
        label: '피부 분석 #' + (prev.length + 1),
        score: data.composite_score,
        skinLabel: data.skin_type_label,
        delta: delta !== null ? (delta >= 0 ? '+' + delta : String(delta)) : null,
        up: delta !== null ? delta >= 0 : true,
        attributes: data.attributes,
      }, ...prev];
    });
    go('results');
  };

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
              <button className={"nav-tab " + (screen === 'analyze' ? 'active' : '')} onClick={() => go('analyze')}>분석</button>
              <button className={"nav-tab " + (screen === 'results' ? 'active' : '')} onClick={() => go('results')}>리포트</button>
            </nav>
          </div>
          <div className="nav-right">
            <button className="nav-tab" title="알림"><Icon name="bell" size={16}/></button>
            <button className="nav-tab" title="설정"><Icon name="settings" size={16}/></button>
            <div className="avatar" title={user?.email || '정연'} onClick={() => go('login')}>
              {(user?.email?.[0] || '정').toUpperCase()}
            </div>
          </div>
        </header>
      )}

      {screen === 'login' && (
        <LoginScreen onLogin={(u) => { setUser(u); go('dashboard'); }} />
      )}
      {screen === 'dashboard' && (
        <Dashboard
          onStart={() => go('analyze')}
          onViewReport={() => go('results')}
          analysisData={analysisData}
          historyList={historyList}
        />
      )}
      {screen === 'analyze' && (
        <Analyze
          onComplete={handleAnalysisComplete}
          onBack={() => go('dashboard')}
        />
      )}
      {screen === 'results' && (
        <Results
          data={analysisData}
          onRestart={() => go('analyze')}
          onHome={() => go('dashboard')}
        />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
