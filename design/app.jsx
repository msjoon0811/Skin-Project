// Main app — routing + auth + top nav
const App = () => {
  const [screen, setScreen] = React.useState('login');
  const [user, setUser] = React.useState(null);
  const [token, setToken] = React.useState(null);
  const [analysisData, setAnalysisData] = React.useState(null);
  const [historyList, setHistoryList] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [settings, setSettings] = React.useState({
    hasAllergies: false, allergyList: [], customAllergies: '', lifestyle: '보통', concerns: [], darkMode: false, fontSize: '보통', pushEnabled: true
  });

  // Load notifications from DB
  React.useEffect(() => {
    if (user && token) {
      fetch('/api/me/notifications', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && d.items) setNotifications(d.items); })
        .catch(() => {});
    } else {
      setNotifications([]);
    }
  }, [user, token]);

  // Generate notifications based on data
  React.useEffect(() => {
    if (!user || !token) return;
    if (!settings.pushEnabled) return;  // 알림 수신 꺼져 있으면 생성 안 함
    let delayCounter = 0;

    const addNotif = (title, message, type) => {
      setNotifications(prev => {
        const newNotifs = [...prev];
        const exists = newNotifs.some(n => n.message === message);
        if (!exists) {
          delayCounter++;
          const newId = Date.now().toString() + delayCounter.toString().padStart(4, '0');
          const createdAt = new Date(Date.now() + delayCounter).toISOString();
          
          const nObj = { id: newId, title, message, type, is_read: false };
          newNotifs.unshift(nObj);
          
          fetch('/api/me/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ ...nObj, created_at: createdAt })
          }).catch(()=>{});
        }
        return newNotifs;
      });
    };

    if (historyList && historyList.length > 0) {
      const latest = historyList[0];
      let lastDate = new Date(latest.created_at || latest.date || Date.now());
      if (isNaN(lastDate.getTime())) lastDate = new Date();
      
      const daysPassed = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 3600 * 24));
      
      if (daysPassed > 0) {
        if (!localStorage.getItem(`notif_reminder_${user.id}_${daysPassed}`)) {
          addNotif('정기 분석 리마인더', `마지막 피부 분석 후 ${daysPassed}일이 지났어요! 계절이 바뀌었는데 오늘의 피부 상태를 확인해볼까요?`, 'reminder');
          localStorage.setItem(`notif_reminder_${user.id}_${daysPassed}`, '1');
        }
      } else {
        if (!localStorage.getItem(`notif_complete_${user.id}_${latest.id}`)) {
          addNotif('분석 완료', '최근 피부 분석을 완료하셨네요! 꾸준히 기록을 남겨 피부 변화를 확인해보세요.', 'complete');
          localStorage.setItem(`notif_complete_${user.id}_${latest.id}`, '1');
        }
      }
    } else if (historyList && historyList.length === 0) {
      if (!localStorage.getItem(`notif_welcome_${user.id}`)) {
        addNotif('환영합니다!', '아직 피부 분석 기록이 없습니다. 첫 분석을 진행하여 맞춤 추천을 받아보세요!', 'welcome');
        localStorage.setItem(`notif_welcome_${user.id}`, '1');
      }
    }
  }, [user, token, historyList, settings.pushEnabled]);

  const handleOpenNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      const unread = notifications.filter(n => !n.is_read);
      if (unread.length > 0) {
        setNotifications(notifications.map(n => ({...n, is_read: true})));
        if (token) {
          fetch('/api/me/notifications/read', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } }).catch(()=>{});
        }
      }
    }
  };

  const handleDeleteNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
    if (token) {
      fetch('/api/me/notifications/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }).catch(()=>{});
    }
  };

  // Apply CSS classes to body based on settings
  React.useEffect(() => {
    if (settings.darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');

    let scale = 1;
    if (settings.fontSize === '작게') scale = 0.9;
    if (settings.fontSize === '크게') scale = 1.15;
    
    // 강제로 인라인 스타일 적용 (브라우저 캐시 우회 및 확실한 동작 보장)
    document.documentElement.style.setProperty('zoom', scale);
    // Firefox 등 zoom 미지원 브라우저 대비 대체 속성
    document.documentElement.style.setProperty('-moz-transform', `scale(${scale})`);
    document.documentElement.style.setProperty('-moz-transform-origin', 'top center');
  }, [settings.darkMode, settings.fontSize]);

  const handlePushToggle = (checked) => {
    if (!checked) {
      alert("알림 수신 동의를 해제하셨습니다. 앞으로 피부 분석 리마인더 등의 알림이 오지 않습니다.");
    }
    setSettings({...settings, pushEnabled: checked});
  };

  const handleSaveSettings = (newSettings = null) => {
    setShowSettings(false);
    const toSave = newSettings || settings;
    if (newSettings && newSettings !== settings) setSettings(toSave);
    if (token) {
      fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ settings_json: JSON.stringify(toSave) })
      }).catch(()=>{});
    }
  };

  const go = (s, replace = false) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setScreen(s);
    if (s !== 'login') sessionStorage.setItem('skin_screen', s);
    else sessionStorage.removeItem('skin_screen');
    
    if (replace) {
      window.history.replaceState({ screen: s }, '', `?screen=${s}`);
    } else {
      window.history.pushState({ screen: s }, '', `?screen=${s}`);
    }
  };

  React.useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.screen) {
        setScreen(e.state.screen);
        if (e.state.screen !== 'login') sessionStorage.setItem('skin_screen', e.state.screen);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    if (analysisData) sessionStorage.setItem('skin_analysis', JSON.stringify(analysisData));
  }, [analysisData]);

  const fetchHistory = (tok) => {
    const t = tok || token;
    const headers = t ? { Authorization: 'Bearer ' + t } : {};
    fetch('/api/history', { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.items) setHistoryList(d.items); })
      .catch(() => {});
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('skin_token');
    if (!saved) return;
    fetch('/api/me', { headers: { Authorization: 'Bearer ' + saved } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { localStorage.removeItem('skin_token'); return; }
        setToken(saved);
        setUser(u);
        if (u.settings_json) {
           try { setSettings(JSON.parse(u.settings_json)); } catch(e){}
        }
        fetchHistory(saved);
        const savedData = sessionStorage.getItem('skin_analysis');
        if (savedData) {
          try { setAnalysisData(JSON.parse(savedData)); } catch(e){}
        }
        const savedScreen = sessionStorage.getItem('skin_screen');
        if (savedScreen && savedScreen !== 'login') {
          go(savedScreen, true);
        } else {
          go('dashboard', true);
        }
      })
      .catch(() => localStorage.removeItem('skin_token'));
  }, []);

  const handleLogin = (u) => {
    const tok = localStorage.getItem('skin_token');
    setUser(u);
    setToken(tok);
    if (u.settings_json) {
       try { setSettings(JSON.parse(u.settings_json)); } catch(e){}
    }
    fetchHistory(tok);
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
    setAnalysisData(null); setHistoryList([]);
    setShowSettings(false);
    go('login');
  };

  const handleWithdrawal = async () => {
    if (!window.confirm('정말로 탈퇴하시겠습니까? 모든 분석 기록과 계정 정보가 영구 삭제됩니다.')) return;
    if (!window.confirm('다시 한번 확인합니다. 탈퇴 후 복구가 불가능합니다. 계속하시겠습니까?')) return;
    try {
      if (token) {
        await fetch('/api/me', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      }
    } catch (e) {}
    localStorage.removeItem('skin_token');
    sessionStorage.clear();
    setToken(null); setUser(null);
    setAnalysisData(null); setHistoryList([]);
    setShowSettings(false);
    go('login');
    alert('탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');
  };

  const handleAnalysisComplete = (data) => {
    setAnalysisData(data);
    fetchHistory();
    go('results');
  };

  const authHeaders = () => token ? { Authorization: 'Bearer ' + token } : {};
  const showNav = screen !== 'login';
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="app">
      {showNav && (
        <header className="nav">
          <div className="nav-left">
            <div onClick={() => go('dashboard')} style={{cursor:'pointer', display: 'flex', alignItems: 'center'}}>
              <Brand size={24} />
            </div>
            <nav className="nav-tabs">
              <button className={"nav-tab " + (screen === 'dashboard'   ? 'active' : '')} onClick={() => go('dashboard')}>홈</button>
              <button className={"nav-tab " + (screen === 'analyze'     ? 'active' : '')} onClick={() => go('analyze')}>분석</button>
              <button className={"nav-tab " + (screen === 'results'     ? 'active' : '')} onClick={() => go('results')}>리포트</button>
              <button className={"nav-tab " + (screen === 'treatment'   ? 'active' : '')} onClick={() => go('treatment')}>시술 추천</button>
              <button className={"nav-tab " + (screen === 'innerbeauty' ? 'active' : '')} onClick={() => go('innerbeauty')}>이너뷰티</button>
            </nav>
          </div>
          <div className="nav-right">
            <div style={{position: 'relative'}}>
              <button className="nav-tab" title="알림" onClick={handleOpenNotifications}>
                <Icon name="bell" size={16}/>
                {unreadCount > 0 && <span style={{position:'absolute', top: 4, right: 4, width: 6, height: 6, background: 'var(--warn)', borderRadius: '50%'}}></span>}
              </button>
              {showNotifications && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, width: 300, background: 'var(--surface)', 
                  border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100, padding: 12, maxHeight: 400, overflowY: 'auto'
                }}>
                  <div style={{fontWeight: 600, marginBottom: 12}}>알림 ({notifications.length})</div>
                  {notifications.length === 0 ? (
                    <div className="muted" style={{fontSize: 13, textAlign: 'center', padding: '20px 0'}}>새로운 알림이 없습니다.</div>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={n.id} style={{fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', paddingBottom: 10, borderBottom: i === notifications.length - 1 ? 'none' : '1px solid var(--line-2)', position: 'relative', marginTop: i > 0 ? 10 : 0}}>
                        <div style={{fontWeight: 600, color: 'var(--ink)', marginBottom: 2}}>{n.title}</div>
                        <div>{n.message}</div>
                        <button onClick={() => handleDeleteNotification(n.id)} style={{position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)'}}>✕</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <button className="nav-tab" title="설정" onClick={() => setShowSettings(!showSettings)}>
              <Icon name="settings" size={16}/>
            </button>
            
            <div style={{position: 'relative'}}>
              <div className="avatar" title={user?.email || ''} onClick={() => setShowAvatarMenu(!showAvatarMenu)} style={{cursor:'pointer'}}>
                {(user?.email?.[0] || '?').toUpperCase()}
              </div>
              {showAvatarMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, width: 140, background: 'var(--surface)',
                  border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4
                }}>
                  <button className="btn btn-ghost" style={{justifyContent: 'flex-start', fontSize: 13, padding: '8px 12px', height: 'auto'}} onClick={() => {setShowAvatarMenu(false); go('mypage')}}>마이페이지</button>
                  <button className="btn btn-ghost" style={{justifyContent: 'flex-start', fontSize: 13, padding: '8px 12px', height: 'auto', color: 'var(--warn)'}} onClick={() => {setShowAvatarMenu(false); handleLogout();}}>로그아웃</button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', width: '90%', maxWidth: 400, borderRadius: 16,
            padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{margin: '0 0 20px', fontSize: 18}}>앱 설정</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 500}}>다크 모드</div>
                  <div className="muted" style={{fontSize: 12}}>어두운 테마를 사용합니다.</div>
                </div>
                <input type="checkbox" checked={settings.darkMode} onChange={e => setSettings({...settings, darkMode: e.target.checked})} />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 500}}>알림 수신</div>
                  <div className="muted" style={{fontSize: 12}}>푸시 알림 및 리마인더를 받습니다.</div>
                </div>
                <input type="checkbox" checked={settings.pushEnabled} onChange={e => handlePushToggle(e.target.checked)} />
              </div>
              <div>
                <div style={{fontWeight: 500, marginBottom: 8}}>글씨 크기</div>
                <select className="input" value={settings.fontSize} onChange={e => setSettings({...settings, fontSize: e.target.value})} style={{width: '100%'}}>
                  <option value="작게">작게</option>
                  <option value="보통">보통</option>
                  <option value="크게">크게</option>
                </select>
              </div>
            </div>

            <div style={{marginTop: 24, textAlign: 'right', display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
              <button className="btn btn-outline" onClick={() => setShowSettings(false)}>취소</button>
              <button className="btn btn-primary" onClick={() => handleSaveSettings(null)}>저장</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'login' && (
        <LoginScreen onLogin={handleLogin} />
      )}
      {screen === 'dashboard' && (
        <Dashboard
          onStart={() => go('analyze')}
          onViewReport={() => go('results')}
          onViewHistoryItem={(data) => { setAnalysisData(data); go('results'); }}
          onRefreshHistory={() => fetchHistory()}
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
          onNavigate={(s) => go(s)}
        />
      )}
      {screen === 'treatment' && (
        <Treatment
          data={analysisData}
          user={user}
          onHome={() => go('dashboard')}
        />
      )}
      {screen === 'innerbeauty' && (
        <InnerBeauty 
          data={analysisData}
          user={user}
          token={token}
          onHome={() => go('dashboard')}
        />
      )}
      {screen === 'mypage' && (
        <MyPageScreen
          userInfo={user}
          historyList={historyList}
          onViewHistoryItem={(data) => { setAnalysisData(data); go('results'); }}
          onViewReport={() => go('results')}
          onRefreshHistory={() => fetchHistory()}
          onWithdrawal={handleWithdrawal}
        />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
