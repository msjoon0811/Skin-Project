// Mypage: 프로필 · 위시리스트 · 계정 관리 (#22, #23, #24, #27, #33)
const Mypage = ({ user, token, historyList, onGoAnalyze, onGoResults, onLogout, onDeleteAccount, authHeaders, onUpdateUser }) => {
  const [nickname, setNickname]   = React.useState((user && user.nickname) || '');

  // user prop이 바뀌면 닉네임 입력값도 동기화 (다른 탭 갔다 왔을 때 최신값 유지)
  React.useEffect(() => {
    setNickname((user && user.nickname) || '');
  }, [user && user.nickname]);
  const [editNick, setEditNick]   = React.useState(false);
  const [nickSaving, setNickSaving] = React.useState(false);
  const [wishlist, setWishlist]   = React.useState([]);
  const [wishInput, setWishInput] = React.useState('');
  const [wishType, setWishType]   = React.useState('product');
  const [wishLoading, setWishLoading] = React.useState(false);
  const [tab, setTab]             = React.useState('profile');  // profile | wishlist | history

  // 위시리스트 로드
  React.useEffect(() => {
    if (!token) return;
    fetch('/api/me/wishlist', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.items) setWishlist(d.items); })
      .catch(() => {});
  }, [token]);

  // 닉네임 저장 — 성공 시 부모(App) user 상태도 즉시 업데이트
  const saveNickname = () => {
    if (!nickname.trim()) return;
    setNickSaving(true);
    fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ nickname: nickname.trim() }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(updated => {
        setEditNick(false);
        // App의 user 상태 업데이트 → 네비게이션 아바타·홈 인사말 즉시 반영
        if (updated && onUpdateUser) onUpdateUser(updated);
        else if (onUpdateUser) onUpdateUser({ ...user, nickname: nickname.trim() });
      })
      .catch(() => alert('저장에 실패했습니다.'))
      .finally(() => setNickSaving(false));
  };

  // 위시리스트 추가
  const addWish = () => {
    if (!wishInput.trim()) return;
    setWishLoading(true);
    fetch('/api/me/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ item_type: wishType, title: wishInput.trim() }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.id) {
          setWishlist(prev => [{ id: d.id, item_type: wishType, title: wishInput.trim(), created_at: new Date().toISOString() }, ...prev]);
          setWishInput('');
        }
      })
      .catch(() => {})
      .finally(() => setWishLoading(false));
  };

  // 위시리스트 삭제
  const removeWish = (id) => {
    if (!window.confirm('위시리스트에서 제거하시겠습니까?')) return;
    fetch('/api/me/wishlist/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    }).catch(() => {});
    setWishlist(prev => prev.filter(w => w.id !== id));
  };

  const TAB_ITEMS = [
    { key: 'profile',  label: '내 프로필' },
    { key: 'wishlist', label: '위시리스트' },
    { key: 'history',  label: '분석 기록' },
  ];

  return (
    <div className="page" data-screen-label="07 Mypage">

      {/* 배너 */}
      <div className="result-banner" style={{
        background: 'radial-gradient(70% 60% at 85% 40%, #E4D0C8 0%, transparent 55%), linear-gradient(120deg, #F5EDE8, #E8D5CE)',
      }}>
        <div>
          <div className="eyebrow" style={{color:'rgba(60,30,20,0.55)'}}>마이페이지 · MYPAGE</div>
          <div className="skin-type" style={{marginTop:6}}>
            <em>{user && (user.nickname || user.username) || '내 계정'}</em>
          </div>
          <div className="muted" style={{marginTop:6, fontSize:13}}>
            프로필 관리, 위시리스트, 분석 기록을 한 곳에서 확인하세요.
          </div>
        </div>
        <div className="avatar" style={{
          width:60, height:60, fontSize:22, cursor:'default',
        }}>
          {((user && (user.nickname || user.username) && (user.nickname || user.username)[0]) || '?').toUpperCase()}
        </div>
      </div>

      {/* 탭 */}
      <div style={{display:'flex', gap:4, marginTop:24, marginBottom:24, background:'var(--bg-2)', padding:4, borderRadius:999, width:'fit-content'}}>
        {TAB_ITEMS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'8px 20px', borderRadius:999, fontSize:13, fontWeight:500,
            border:'none', cursor:'pointer', fontFamily:'var(--sans)',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--ink)' : 'var(--ink-muted)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
            transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 프로필 탭 ── */}
      {tab === 'profile' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
          {/* 계정 정보 */}
          <div className="card" style={{padding:28}}>
            <div className="eyebrow" style={{marginBottom:14}}>계정 정보</div>

            <div style={{marginBottom:16}}>
              <div className="field-label" style={{marginBottom:6}}>아이디</div>
              <div style={{
                padding:'10px 14px', borderRadius:10, background:'var(--bg-2)',
                fontSize:14, color:'var(--ink-muted)', border:'1px solid var(--line-2)',
              }}>{user && user.username}</div>
            </div>

            <div style={{marginBottom:20}}>
              <div className="field-label" style={{marginBottom:6}}>닉네임</div>
              {editNick ? (
                <div style={{display:'flex', gap:8}}>
                  <input className="input" value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveNickname()}
                    placeholder="닉네임 입력" style={{flex:1}} />
                  <button className="btn btn-primary btn-sm" onClick={saveNickname} disabled={nickSaving}>
                    {nickSaving ? '…' : '저장'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditNick(false)}>취소</button>
                </div>
              ) : (
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{
                    padding:'10px 14px', borderRadius:10, background:'var(--bg-2)',
                    fontSize:14, color:'var(--ink)', border:'1px solid var(--line-2)', flex:1,
                  }}>{(user && user.nickname) || '닉네임 없음'}</div>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditNick(true)}>수정</button>
                </div>
              )}
            </div>

            <div style={{
              padding:'14px', borderRadius:10, background:'var(--surface-2)',
              border:'1px solid var(--line-2)',
            }}>
              <div style={{fontSize:12.5, color:'var(--ink-muted)', marginBottom:10}}>분석 통계</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:28, fontFamily:'var(--serif)', fontStyle:'italic', color:'var(--ink)'}}>{historyList.length}</div>
                  <div style={{fontSize:11.5, color:'var(--ink-muted)'}}>총 분석 횟수</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:28, fontFamily:'var(--serif)', fontStyle:'italic', color:'var(--accent)'}}>
                    {historyList.length > 0 ? historyList[0].score : '—'}
                  </div>
                  <div style={{fontSize:11.5, color:'var(--ink-muted)'}}>최근 점수</div>
                </div>
              </div>
            </div>
          </div>

          {/* #33 계정 관리 — 마이페이지로 이동 */}
          <div className="card" style={{padding:28}}>
            <div className="eyebrow" style={{marginBottom:14}}>계정 관리</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <button className="btn btn-outline" onClick={onGoAnalyze}
                style={{justifyContent:'flex-start', gap:10}}>
                <Icon name="camera" size={15}/> 새 분석 시작
              </button>
              {historyList.length > 0 && (
                <button className="btn btn-outline"
                  onClick={() => onGoResults && onGoResults(null)}
                  style={{justifyContent:'flex-start', gap:10}}>
                  <Icon name="chart" size={15}/> 최근 리포트 보기
                </button>
              )}
              <div style={{height:8}}/>
              <button className="btn btn-ghost" onClick={onLogout}
                style={{justifyContent:'flex-start', gap:10, color:'var(--ink-muted)'}}>
                <Icon name="arrowLeft" size={15}/> 로그아웃
              </button>
              <button onClick={onDeleteAccount}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'12px 18px',
                  background:'none', border:'1px solid var(--warn-soft)', borderRadius:999,
                  color:'var(--warn)', cursor:'pointer', fontSize:14, fontFamily:'inherit',
                  fontWeight:500, transition:'all 0.12s',
                }}>
                <Icon name="trash" size={15}/> 회원 탈퇴
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 위시리스트 탭 (#23) ── */}
      {tab === 'wishlist' && (
        <>
          {/* 추가 폼 */}
          <div className="card" style={{padding:20, marginBottom:16}}>
            <div className="eyebrow" style={{marginBottom:12}}>새 항목 추가</div>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
              {/* 타입 선택 */}
              <div style={{display:'flex', background:'var(--bg-2)', padding:3, borderRadius:999, gap:3, flexShrink:0}}>
                {[['product','제품'],['treatment','시술']].map(([v,l]) => (
                  <button key={v} onClick={() => setWishType(v)} style={{
                    padding:'6px 14px', borderRadius:999, fontSize:12, border:'none',
                    background: wishType===v ? 'var(--surface)' : 'transparent',
                    color: wishType===v ? 'var(--ink)' : 'var(--ink-muted)',
                    cursor:'pointer', fontFamily:'var(--sans)', fontWeight:500,
                    boxShadow: wishType===v ? 'var(--shadow-sm)' : 'none',
                  }}>{l}</button>
                ))}
              </div>
              <input className="input" style={{flex:1}}
                value={wishInput} onChange={e => setWishInput(e.target.value)}
                placeholder={wishType === 'product' ? '제품명 입력' : '시술명 입력'}
                onKeyDown={e => e.key === 'Enter' && addWish()} />
              <button className="btn btn-primary btn-sm" onClick={addWish}
                disabled={wishLoading || !wishInput.trim()}
                style={{display:'flex', alignItems:'center', gap:5, flexShrink:0}}>
                <Icon name="plus" size={13}/> 추가
              </button>
            </div>
          </div>

          {/* 목록 */}
          {wishlist.length === 0 ? (
            <div className="card" style={{padding:'32px', textAlign:'center', color:'var(--ink-muted)', fontSize:13}}>
              아직 위시리스트가 비어 있어요.<br/>
              <span style={{fontSize:12}}>관심 있는 제품이나 시술을 추가해보세요.</span>
            </div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12}}>
              {wishlist.map((w, i) => (
                <div key={w.id || i} className="card" style={{
                  padding:'16px 18px',
                  display:'flex', alignItems:'center', gap:12,
                }}>
                  <span style={{
                    padding:'3px 9px', borderRadius:999, fontSize:10.5,
                    background: w.item_type === 'treatment' ? 'var(--accent-soft)' : 'var(--good-soft)',
                    color: w.item_type === 'treatment' ? 'var(--accent-ink)' : 'var(--good)',
                    fontWeight:500, flexShrink:0,
                  }}>{w.item_type === 'treatment' ? '시술' : '제품'}</span>
                  <div style={{flex:1, fontSize:14, fontWeight:500, color:'var(--ink)'}}>{w.title}</div>
                  <button onClick={() => removeWish(w.id)}
                    style={{background:'none', border:'none', cursor:'pointer',
                            color:'var(--ink-faint)', padding:4, flexShrink:0}}
                    title="제거">
                    <Icon name="cross" size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 분석 기록 탭 ── */}
      {tab === 'history' && (
        historyList.length === 0 ? (
          <div className="card" style={{padding:'32px', textAlign:'center', color:'var(--ink-muted)', fontSize:13}}>
            분석 기록이 없습니다. 첫 분석을 시작해보세요.
            <div style={{marginTop:14}}>
              <button className="btn btn-primary btn-sm" onClick={onGoAnalyze}>
                <Icon name="camera" size={13}/> 분석 시작
              </button>
            </div>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {historyList.map((h, i) => (
              <div key={h.id || i} className="card" style={{
                padding:'14px 18px',
                display:'grid', gridTemplateColumns:'1fr auto auto', gap:16, alignItems:'center',
                cursor:'pointer',
              }}
                onClick={() => onGoResults && onGoResults(h)}>
                <div>
                  <div style={{fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-muted)', marginBottom:3}}>{h.date}</div>
                  <div style={{fontSize:14, fontWeight:500}}>{h.skinLabel || '피부 분석'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:22, fontFamily:'var(--serif)', fontStyle:'italic'}}>{h.score}</div>
                  <div style={{fontSize:11, color:'var(--ink-muted)'}}>/ 100</div>
                </div>
                <span style={{color:'var(--ink-faint)', fontSize:18}}>›</span>
              </div>
            ))}
          </div>
        )
      )}

      <div style={{height:40}}/>
    </div>
  );
};

window.Mypage = Mypage;
