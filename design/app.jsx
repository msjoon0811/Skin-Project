// Main app — routing + auth + top nav
const App = () => {
  const [screen, setScreen]             = React.useState('login');
  const [user, setUser]                 = React.useState(null);
  const [token, setToken]               = React.useState(null);
  const [analysisData, setAnalysisData] = React.useState(null);
  const [historyList, setHistoryList]   = React.useState([]);
  const [clinicData, setClinicData]     = React.useState(null);
  const [notifications, setNotifications] = React.useState([]);  // #10 DB알림
  const [showSettings, setShowSettings]   = React.useState(false);
  const [showBell, setShowBell]           = React.useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = React.useState(false);
  const [darkMode, setDarkMode]           = React.useState(() => localStorage.getItem('skin_dark') === '1');
  const [fontSize, setFontSize]           = React.useState(() => localStorage.getItem('skin_fontsize') || 'md');
  const settingsRef = React.useRef(null);
  const bellRef     = React.useRef(null);
  const avatarRef   = React.useRef(null);

  // 다크모드 적용
  React.useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('skin_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  // 글자 크기 적용 — zoom으로 전체 스케일링 (px 단위 CSS에 유일하게 효과 있음)
  React.useEffect(() => {
    const map = { sm: '0.88', md: '1', lg: '1.14' };
    document.body.style.zoom = map[fontSize] || '1';
    localStorage.setItem('skin_fontsize', fontSize);
  }, [fontSize]);

  // #12 브라우저 뒤로가기 지원
  const go = (s) => {
    window.scrollTo({top:0, behavior:'instant'});
    window.history.pushState({screen: s}, '');
    setScreen(s);
    // #1 F5 새로고침 유지 — 현재 화면 저장
    if (s !== 'login') sessionStorage.setItem('skin_screen', s);
    else sessionStorage.removeItem('skin_screen');
  };

  React.useEffect(() => {
    const handlePop = (e) => {
      const s = (e.state && e.state.screen) ? e.state.screen : 'dashboard';
      window.scrollTo({top:0, behavior:'instant'});
      setScreen(s);
    };
    window.addEventListener('popstate', handlePop);
    window.history.replaceState({screen: screen}, '');
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

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
        fetchNotifications(saved);
        // #1 F5 새로고침 — 이전 화면 및 분석 데이터 복원
        const savedScreen   = sessionStorage.getItem('skin_screen');
        const savedAnalysis = sessionStorage.getItem('skin_analysis');
        if (savedAnalysis) {
          try { setAnalysisData(JSON.parse(savedAnalysis)); } catch {}
        }
        go(savedScreen && savedScreen !== 'login' ? savedScreen : 'dashboard');
      })
      .catch(() => localStorage.removeItem('skin_token'));
  }, []);

  // #1 F5 — 분석 데이터 변경 시 세션 저장
  React.useEffect(() => {
    if (analysisData) sessionStorage.setItem('skin_analysis', JSON.stringify(analysisData));
  }, [analysisData]);

  // 드롭다운 외부 클릭 닫기
  React.useEffect(() => {
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setShowAvatarMenu(false);
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

  // #10 DB 알림 로드
  const fetchNotifications = (tok) => {
    const t = tok || token;
    if (!t) return;
    fetch('/api/me/notifications', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.items) setNotifications(d.items); })
      .catch(() => {});
  };

  // #10/#16 알림 생성 — 고유 ID로 중복/타임스탬프 충돌 방지
  const pushNotification = (type, title, message) => {
    if (!token) return;
    // #16 타임스탬프 충돌 방지: nano-precision ID
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const created_at = new Date().toISOString();
    const notif = { id, type, title, message, is_read: false, created_at };
    // #18 이미 존재하는 같은 메시지 중복 방지
    setNotifications(prev => {
      if (prev.some(n => n.message === message)) return prev;
      return [notif, ...prev];
    });
    fetch('/api/me/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(notif),
    }).catch(() => {});
  };

  // #18 알림 삭제 — DB + 로컬 상태 동기화
  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!token) return;
    fetch('/api/me/notifications/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    }).catch(() => {});
  };

  const handleLogin = (u) => {
    const tok = localStorage.getItem('skin_token');
    setUser(u);
    setToken(tok);
    fetchHistory(tok);
    fetchNotifications(tok);
    go('dashboard');
  };

  const handleLogout = () => {
    if (token) {
      fetch('/api/logout', { method:'POST', headers:{ Authorization:'Bearer ' + token } }).catch(() => {});
    }
    localStorage.removeItem('skin_token');
    sessionStorage.removeItem('skin_screen');
    sessionStorage.removeItem('skin_analysis');
    setToken(null); setUser(null);
    setAnalysisData(null); setHistoryList([]); setNotifications([]);
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
        sessionStorage.clear();
        setToken(null); setUser(null);
        setAnalysisData(null); setHistoryList([]); setNotifications([]);
        setShowSettings(false);
        go('login');
      })
      .catch(() => alert('탈퇴 처리 중 오류가 발생했습니다.'));
  };

  const handleAnalysisComplete = (data) => {
    setAnalysisData(data);
    fetchHistory();
    // #10 분석 완료 알림 생성
    if (data && data.composite_score != null) {
      pushNotification('analysis', '피부 분석 완료', `종합 점수 ${data.composite_score}점 · ${data.skin_type_label || '분석 완료'}`);
    }
    go('results');
  };

  // 닉네임 등 user 정보 업데이트 — Mypage에서 저장 후 호출
  const handleUpdateUser = (updated) => {
    setUser(prev => ({ ...prev, ...updated }));
  };

  // 히스토리 삭제: App 레벨 상태도 즉시 반영
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

  // #10 알림 드롭다운 항목: DB 알림 우선, 없으면 히스토리 기반 정적 생성
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const notifItems = notifications.length > 0
    ? notifications.slice(0, 5)
    : [
        ...historyList.slice(0, 2).map(h => ({
          id: 'h_' + h.id,
          icon: 'chart',
          title: '피부 분석 결과',
          body: `${h.date} · 종합 ${h.score}점`,
          is_read: true,
        })),
        { id: 'tip1', icon: 'sparkle', title: '2주 후 재분석 권장', body: '피부 상태 변화를 꾸준히 추적해보세요', is_read: true },
        { id: 'tip2', icon: 'leaf',    title: '오늘의 케어 팁',      body: '외출 전 SPF 50+ 자외선 차단제를 잊지 마세요', is_read: true },
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
                onClick={() => {
                  setShowBell(v => !v);
                  setShowSettings(false);
                  // 열 때 읽음 처리
                  if (!showBell && unreadCount > 0 && token) {
                    setNotifications(prev => prev.map(n => ({...n, is_read: true})));
                    fetch('/api/me/notifications/read', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
                  }
                }}>
                <Icon name="bell" size={16}/>
                {unreadCount > 0 && <span className="notif-dot"/>}
              </button>
              {showBell && (
                <div className="dropdown dropdown-bell">
                  <div className="dropdown-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:600, fontSize:13.5}}>알림</div>
                      <div className="muted" style={{fontSize:11.5, marginTop:2}}>최근 활동 및 추천</div>
                    </div>
                  </div>
                  {notifItems.map((n, i) => (
                    <div key={n.id || i} style={{display:'flex', alignItems:'center', position:'relative'}}>
                      <button className="dropdown-item" style={{flex:1}}
                        onClick={() => { setShowBell(false); if (n.action) n.action(); }}>
                        <span className="notif-icon">
                          <Icon name={n.icon || (n.type === 'analysis' ? 'chart' : 'sparkle')} size={14}/>
                        </span>
                        <div style={{flex:1, textAlign:'left'}}>
                          <div style={{fontSize:13, fontWeight: n.is_read ? 400 : 600, color:'var(--ink)'}}>{n.title}</div>
                          <div style={{fontSize:11.5, color:'var(--ink-muted)', marginTop:2}}>{n.body || n.message}</div>
                        </div>
                      </button>
                      {/* #18 삭제 버튼 — 삭제 후 재생성 방지 */}
                      {notifications.length > 0 && (
                        <button onClick={() => dismissNotification(n.id)}
                          style={{padding:'4px 8px', background:'none', border:'none', cursor:'pointer',
                                  color:'var(--ink-faint)', flexShrink:0, marginRight:4}}
                          title="알림 삭제">
                          <Icon name="cross" size={11}/>
                        </button>
                      )}
                    </div>
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
                <div className="dropdown" style={{minWidth:230}}>
                  <div className="dropdown-header">
                    <div style={{fontWeight:600, fontSize:13}}>설정</div>
                  </div>

                  {/* 대시보드 */}
                  <button className="dropdown-item" onClick={() => { setShowSettings(false); go('dashboard'); }}>
                    <Icon name="chart" size={15}/> 대시보드
                  </button>

                  <div className="dropdown-divider"/>

                  {/* 다크모드 토글 */}
                  <div className="dropdown-item" style={{justifyContent:'space-between', cursor:'default'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <Icon name="sparkle" size={15}/> 다크모드
                    </div>
                    <button onClick={() => setDarkMode(v => !v)} style={{
                      width:38, height:20, borderRadius:10, border:'none', cursor:'pointer',
                      background: darkMode ? 'var(--accent)' : 'var(--line)',
                      position:'relative', transition:'background 0.2s', flexShrink:0,
                    }}>
                      <span style={{
                        position:'absolute', top:2,
                        left: darkMode ? 20 : 2,
                        width:16, height:16, borderRadius:'50%',
                        background:'white', transition:'left 0.2s', display:'block',
                      }}/>
                    </button>
                  </div>

                  {/* 글자 크기 */}
                  <div style={{padding:'10px 16px 14px'}}>
                    <div style={{fontSize:12, color:'var(--ink-muted)', marginBottom:8, display:'flex', alignItems:'center', gap:7}}>
                      <Icon name="info" size={13}/> 전체 글자 크기
                    </div>
                    <div style={{display:'flex', gap:6}}>
                      {[['sm','작게'],['md','보통'],['lg','크게']].map(([v,l]) => (
                        <button key={v} onClick={() => setFontSize(v)} style={{
                          flex:1, padding:'6px 0', borderRadius:8,
                          border: '1.5px solid ' + (fontSize===v ? 'var(--accent)' : 'var(--line)'),
                          background: fontSize===v ? 'var(--accent-soft)' : 'var(--surface)',
                          color: fontSize===v ? 'var(--accent-ink)' : 'var(--ink-muted)',
                          cursor:'pointer', fontSize:12, fontFamily:'var(--sans)', fontWeight:500,
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 아바타 (클릭: 마이페이지 · 로그아웃) ── */}
            <div className="dropdown-wrap" ref={avatarRef}>
              <div className="avatar" style={{cursor:'pointer'}}
                title={user ? (user.nickname || user.username) : '미로그인'}
                onClick={() => { setShowAvatarMenu(v => !v); setShowSettings(false); setShowBell(false); }}>
                {((user && (user.nickname || user.username) && (user.nickname || user.username)[0]) || '?').toUpperCase()}
              </div>
              {showAvatarMenu && user && (
                <div className="dropdown" style={{right:0, minWidth:160}}>
                  <button className="dropdown-item" onClick={() => { setShowAvatarMenu(false); go('mypage'); }}>
                    <Icon name="user" size={15}/> 마이페이지
                  </button>
                  <button className="dropdown-item" onClick={() => { setShowAvatarMenu(false); handleLogout(); }}>
                    <Icon name="arrowLeft" size={15}/> 로그아웃
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>
      )}

      {screen === 'login' && <LoginScreen onLogin={handleLogin} />}
      {screen === 'dashboard' && (
        <Dashboard
          onStart={() => go('analyze')}
          onViewReport={() => go('results')}
          onViewHistoryItem={(data) => { setAnalysisData(data); go('results'); }}
          analysisData={analysisData}
          historyList={historyList}
          onDeleteHistory={handleDeleteHistory}
          user={user}
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
      {screen === 'mypage' && (
        <Mypage
          user={user}
          token={token}
          historyList={historyList}
          onGoAnalyze={() => go('analyze')}
          onGoResults={(data) => { setAnalysisData(data); go('results'); }}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          authHeaders={authHeaders()}
          onUpdateUser={handleUpdateUser}
        />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
