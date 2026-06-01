// 성분 통합 카드 — 전성분 검사 + 성분 사전 한 번에
const IngUnified = ({ avoidList, recList }) => {
  const [input, setInput]           = React.useState('');
  const [hits, setHits]             = React.useState(null);
  const [dictResult, setDictResult] = React.useState(null);
  const [dictName, setDictName]     = React.useState('');
  const [loading, setLoading]       = React.useState(false);
  const [ingDetails, setIngDetails] = React.useState({});
  const [expanded, setExpanded]     = React.useState({});

  const isFullList = (txt) => txt.includes(',') || txt.includes('\n') || txt.length > 60;

  const fetchDict = async (name) => {
    const key = 'd_' + name;
    if (ingDetails[name]) { setExpanded(e => ({...e, [key]: !e[key]})); return; }
    setExpanded(e => ({...e, [key]: 'loading'}));
    try {
      const res  = await fetch(`/api/ingredient/${encodeURIComponent(name)}`);
      const data = await res.json();
      setIngDetails(d => ({...d, [name]: data}));
      setExpanded(e => ({...e, [key]: true}));
    } catch { setExpanded(e => ({...e, [key]: false})); }
  };

  const analyze = async () => {
    const txt = input.trim();
    if (!txt) return;
    setLoading(true); setHits(null); setDictResult(null);

    if (isFullList(txt)) {
      // 전성분 모드
      const lower = txt.toLowerCase();
      const found   = avoidList.filter(i => lower.includes(i.name.toLowerCase()));
      const present = recList.filter(i => lower.includes(i.name.toLowerCase()));
      const missing = recList.filter(i => !lower.includes(i.name.toLowerCase()));
      setHits({ found, present, missing });
      setExpanded({});
    } else {
      // 단일 성분 사전 모드
      setDictName(txt);
      try {
        const res  = await fetch(`/api/ingredient/${encodeURIComponent(txt)}`);
        const data = await res.json();
        setDictResult(data);
        // 동시에 피부 적합 여부도 확인 (avoid/rec 리스트 기준)
        const lower = txt.toLowerCase();
        const inAvoid = avoidList.filter(i => lower.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(lower));
        const inRec   = recList.filter(i => lower.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(lower));
        setHits({ found: inAvoid, present: inRec, missing: [] });
      } catch {}
    }
    setLoading(false);
  };

  const renderDetail = (detail) => (
    <div style={{padding:'8px 14px 12px', background:'var(--surface-2)', fontSize:12.5, color:'var(--ink-2)', lineHeight:1.65}}>
      <div style={{marginBottom:5}}>{detail.description}</div>
      {detail.benefits?.length > 0 && (
        <div style={{marginBottom:3}}>
          <span style={{fontSize:11, fontWeight:600, color:'var(--good)'}}>효과: </span>{detail.benefits.join(' · ')}
        </div>
      )}
      {detail.concerns?.length > 0 && (
        <div><span style={{fontSize:11, fontWeight:600, color:'var(--warn)'}}>주의: </span>{detail.concerns.join(' · ')}</div>
      )}
    </div>
  );

  const renderIngRow = (ing, idx, colorKey) => {
    const dk = 'd_' + ing.name;
    const isWarn = colorKey === 'warn';
    return (
      <div key={idx} style={{borderTop: idx > 0 ? `1px solid ${isWarn ? 'rgba(168,80,51,0.1)' : 'rgba(91,117,83,0.1)'}` : 'none'}}>
        <div onClick={() => fetchDict(ing.name)} style={{
          display:'grid', gridTemplateColumns:'1fr auto auto', gap:10,
          alignItems:'center', padding:'9px 14px', cursor:'pointer',
          background: expanded[dk] ? (isWarn ? 'rgba(243,221,211,0.35)' : 'rgba(227,234,222,0.35)') : 'var(--surface)',
        }}>
          <div>
            <span style={{fontWeight:600, fontSize:13}}>{ing.name}</span>
            {ing.tag && <span className="pill" style={{marginLeft:7,
              background: isWarn ? 'var(--warn-soft)' : 'var(--good-soft)',
              color: isWarn ? 'var(--warn)' : 'var(--good)', fontSize:10}}>{ing.tag}</span>}
          </div>
          <span style={{fontSize:12, color:'var(--ink-muted)'}}>{ing.why}</span>
          <Icon name={expanded[dk]==='loading'?'sparkle':expanded[dk]?'cross':'plus'} size={12}/>
        </div>
        {expanded[dk] === true && ingDetails[ing.name] && renderDetail(ingDetails[ing.name])}
      </div>
    );
  };

  return (
    <div className="card">
      <div className="section-head" style={{marginBottom:12}}>
        <div>
          <div className="eyebrow">성분 분석 · INGREDIENTS</div>
          <h2 className="h2-serif" style={{margin:'4px 0 0'}}>성분 검사 · 사전</h2>
        </div>
        <span className="muted" style={{fontSize:12}}>단일 성분명 또는 전성분 붙여넣기</span>
      </div>

      <div style={{fontSize:12.5, color:'var(--ink-muted)', marginBottom:10}}>
        성분 하나를 입력하면 <strong>사전 정보</strong>를,
        제품 전성분을 붙여넣으면 <strong>주의·권장 성분 검사</strong>를 동시에 해드려요.
      </div>

      <div style={{display:'flex', gap:8, alignItems:'flex-start'}}>
        <textarea className="input" rows={3}
          placeholder={'성분명 하나  →  나이아신아마이드\n전성분 붙여넣기  →  Water, Glycerin, Niacinamide, Ethanol...'}
          value={input}
          onChange={e => { setInput(e.target.value); setHits(null); setDictResult(null); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isFullList(input)) { e.preventDefault(); analyze(); }}}
          style={{flex:1, resize:'vertical', fontSize:12.5, minHeight:72}}
        />
        <button className="btn btn-primary btn-sm" onClick={analyze}
          disabled={loading || !input.trim()}
          style={{marginTop:2, flexShrink:0, display:'flex', alignItems:'center', gap:5}}>
          {loading ? <><span className="spinner" style={{borderColor:'rgba(255,255,255,0.3)', borderTopColor:'white'}}/> 분석 중</> : <><Icon name="flask" size={13}/> 분석</>}
        </button>
      </div>

      {/* 단일 성분 사전 결과 */}
      {dictResult && (
        <div style={{marginTop:14, padding:'14px 16px', borderRadius:12,
          background:'var(--surface-2)', border:'1px solid var(--line-2)'}}>
          <div style={{fontFamily:'var(--serif-ko)', fontSize:16, fontWeight:500, marginBottom:6}}>{dictName}</div>
          <div style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.7, marginBottom:10}}>{dictResult.description}</div>
          {dictResult.benefits?.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11.5, fontWeight:600, color:'var(--good)', marginBottom:4}}>효과</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
                {dictResult.benefits.map((b,i) => (
                  <span key={i} style={{padding:'3px 9px', borderRadius:999, background:'var(--good-soft)', color:'var(--good)', fontSize:12}}>{b}</span>
                ))}
              </div>
            </div>
          )}
          {dictResult.concerns?.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11.5, fontWeight:600, color:'var(--warn)', marginBottom:4}}>주의사항</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
                {dictResult.concerns.map((c,i) => (
                  <span key={i} style={{padding:'3px 9px', borderRadius:999, background:'var(--warn-soft)', color:'var(--warn)', fontSize:12}}>{c}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8}}>
            {dictResult.suitable_for && (
              <div style={{padding:'8px 10px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--line-2)'}}>
                <div style={{fontSize:10.5, color:'var(--ink-faint)', marginBottom:2}}>적합 피부</div>
                <div style={{fontSize:12.5, fontWeight:500}}>{dictResult.suitable_for}</div>
              </div>
            )}
            {dictResult.found_in && (
              <div style={{padding:'8px 10px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--line-2)'}}>
                <div style={{fontSize:10.5, color:'var(--ink-faint)', marginBottom:2}}>주사용 제품</div>
                <div style={{fontSize:12.5, fontWeight:500}}>{dictResult.found_in}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 스캐너 결과 */}
      {hits && (
        <div style={{marginTop:14, display:'flex', flexDirection:'column', gap:10}}>
          {/* 주의 성분 */}
          {hits.found.length > 0 ? (
            <div style={{borderRadius:10, border:'1px solid var(--warn-soft)', overflow:'hidden'}}>
              <div style={{padding:'9px 14px', background:'var(--warn-soft)',
                display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:600, color:'var(--warn)', fontSize:13}}>주의 성분 {hits.found.length}개 발견</span>
                <span style={{fontFamily:'var(--mono)', fontSize:10.5, color:'var(--warn)'}}>클릭 → 상세 정보</span>
              </div>
              {hits.found.map((ing, idx) => renderIngRow(ing, idx, 'warn'))}
            </div>
          ) : !isFullList(input) ? null : (
            <div style={{padding:'9px 14px', borderRadius:10, background:'var(--good-soft)',
              color:'var(--good)', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6}}>
              <Icon name="check" size={13}/> 주의 성분이 발견되지 않았어요
            </div>
          )}

          {/* 권장 성분 포함 */}
          {hits.present.length > 0 && (
            <div style={{borderRadius:10, border:'1px solid var(--good-soft)', overflow:'hidden'}}>
              <div style={{padding:'9px 14px', background:'var(--good-soft)',
                display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontWeight:600, color:'var(--good)', fontSize:13}}>권장 성분 {hits.present.length}개 포함</span>
                <span style={{fontFamily:'var(--mono)', fontSize:10.5, color:'var(--good)'}}>클릭 → 효능 확인</span>
              </div>
              {hits.present.map((ing, idx) => renderIngRow(ing, idx, 'good'))}
            </div>
          )}

          {/* 권장 성분 미포함 (전성분 모드만) */}
          {isFullList(input) && hits.missing.length > 0 && (
            <div style={{padding:'10px 14px', borderRadius:10, background:'var(--bg-2)', border:'1px solid var(--line-2)'}}>
              <div style={{fontWeight:500, color:'var(--ink-2)', fontSize:12.5, marginBottom:8}}>
                이 제품에 없는 권장 성분 ({hits.missing.length}개)
              </div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {hits.missing.map((ing, idx) => (
                  <span key={idx} onClick={() => fetchDict(ing.name)} style={{
                    padding:'4px 10px', borderRadius:999, fontSize:12.5, cursor:'pointer',
                    background:'var(--surface)', border:'1px solid var(--line)', color:'var(--ink-2)',
                  }}>{ing.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 히스토리 목록
const HistoryList = ({ displayHistory, onViewHistoryItem, onViewReport, gradients, onDelete }) => {
  const [loadingId, setLoadingId] = React.useState(null);
  const [deletingId, setDeletingId] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);

  const VISIBLE = 4;
  const visible = expanded ? displayHistory : displayHistory.slice(0, VISIBLE);
  const hiddenCount = displayHistory.length - VISIBLE;

  const handleClick = async (h) => {
    const id = h.id || h.analysisId;
    if (!id || !onViewHistoryItem) { onViewReport && onViewReport(); return; }
    setLoadingId(id);
    try {
      const token = localStorage.getItem('skin_token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      const res = await fetch(`/api/history/${id}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onViewHistoryItem(data);
    } catch {
      onViewReport && onViewReport();
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (e, h) => {
    e.stopPropagation();
    const id = h.id || h.analysisId;
    setDeletingId(id || h.date);
    // 서버 삭제 시도 (id 있을 때만, fire-and-forget)
    if (id) {
      try {
        const token = localStorage.getItem('skin_token');
        const headers = token ? { Authorization: 'Bearer ' + token } : {};
        await fetch(`/api/history/${id}`, { method: 'DELETE', headers });
      } catch {}
    }
    onDelete && onDelete(h);
    setDeletingId(null);
  };

  if (displayHistory.length === 0) {
    return (
      <div style={{padding:'28px 0', textAlign:'center', color:'var(--ink-muted)', fontSize:13}}>
        아직 분석 기록이 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div className="history-list">
        {visible.map((h, i) => {
          const hid = h.id || h.analysisId;
          const isDeleting = deletingId === (hid || h.date);
          const isLoading  = loadingId === hid;
          return (
            <div key={hid || i} className="history-row"
              onClick={() => handleClick(h)}
              style={{cursor:'pointer', transition:'background .12s ease'}}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg-2)'}
              onMouseLeave={e => e.currentTarget.style.background=''}>
              <div className="thumb" style={{background: gradients[i % gradients.length]}} />
              <div className="meta">
                <span className="date">{h.date}</span>
                <span className="title">{h.label}</span>
                {h.skinLabel && <span style={{fontSize:11, color:'var(--ink-faint)'}}>{h.skinLabel}</span>}
              </div>
              {/* 점수 + 델타 (고정 컬럼) */}
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, minWidth:42}}>
                <span style={{fontSize:13, fontWeight:600}}>{h.score}</span>
                {h.delta
                  ? <span className={"delta " + (h.up ? '' : 'down')} style={{fontSize:11}}>
                      {h.delta} {h.up ? '▲' : '▼'}
                    </span>
                  : <span style={{fontSize:11, color:'transparent'}}>—</span>
                }
              </div>
              {/* 삭제 + 이동 (고정 컬럼) */}
              <div style={{display:'flex', alignItems:'center', gap:4}}>
                <button
                  onClick={(e) => handleDelete(e, h)}
                  disabled={isDeleting}
                  title="기록 삭제"
                  style={{
                    background:'none', border:'none',
                    cursor: isDeleting ? 'default' : 'pointer',
                    padding:'5px', color: isDeleting ? 'var(--ink-faint)' : 'var(--ink-muted)',
                    borderRadius:6, display:'flex', alignItems:'center', flexShrink:0,
                    transition:'color .15s',
                  }}
                  onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.color='var(--warn)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = isDeleting ? 'var(--ink-faint)' : 'var(--ink-muted)'; }}
                >
                  {isDeleting
                    ? <span style={{fontSize:12}}>…</span>
                    : <Icon name="trash" size={13}/>
                  }
                </button>
                <span className="arrow" style={{
                  color: isLoading ? 'var(--accent)' : 'var(--ink-faint)',
                  fontSize:18, lineHeight:1,
                }}>
                  {isLoading ? '…' : '›'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && !expanded && (
        <button onClick={() => setExpanded(true)}
          className="btn btn-ghost btn-sm"
          style={{width:'100%', marginTop:10, justifyContent:'center', gap:6}}>
          더보기 ({hiddenCount}개) <Icon name="chevronDown" size={13}/>
        </button>
      )}
      {expanded && displayHistory.length > VISIBLE && (
        <button onClick={() => setExpanded(false)}
          className="btn btn-ghost btn-sm"
          style={{width:'100%', marginTop:10, justifyContent:'center', gap:6}}>
          접기 <Icon name="chevronUp" size={13}/>
        </button>
      )}
    </div>
  );
};

const MOCK_HISTORY = [
  { date: '2026 · 05 · 22', label: '피부 분석', score: 62, delta: '+4', up: true  },
  { date: '2026 · 05 · 15', label: '피부 분석', score: 58, delta: '+1', up: true  },
  { date: '2026 · 05 · 08', label: '피부 분석', score: 57, delta: '-2', up: false },
  { date: '2026 · 05 · 01', label: '피부 분석', score: 59, delta: '+6', up: true  },
];

// Dashboard — 실제 분석 데이터 반영
const Dashboard = ({ onStart, onViewReport, onViewHistoryItem, analysisData, historyList, onDeleteHistory, user }) => {
  const hasData = !!(analysisData && analysisData.composite_score != null);
  const displayName = user ? (user.nickname || user.username || '') : '';
  const [localHistory, setLocalHistory] = React.useState(null);

  // historyList prop 변경 시 로컬 상태 동기화
  // 삭제 후 App 상태가 업데이트되면 이 effect가 재실행되어 올바른 목록으로 초기화
  React.useEffect(() => {
    if (historyList) {
      setLocalHistory(historyList.length > 0 ? historyList : []);
    }
  }, [historyList]);

  const handleDeleteHistory = (item) => {
    // 1. Dashboard 로컬 상태 즉시 반영 (UI 즉각 응답)
    setLocalHistory(prev => {
      const base = prev !== null ? prev : (historyList && historyList.length > 0 ? historyList : MOCK_HISTORY);
      const itemId = item.id || item.analysisId;
      return base.filter(h => {
        if (itemId) return (h.id || h.analysisId) !== itemId;
        return !(h.date === item.date && h.score === item.score);
      });
    });
    // 2. App 상위 상태도 업데이트 → 페이지 이동 후 돌아와도 유지
    onDeleteHistory && onDeleteHistory(item);
  };

  const lastScore    = hasData ? analysisData.composite_score : null;
  const lastSkin     = hasData ? analysisData.skin_type_label : null;
  const attrs        = hasData ? (analysisData.attributes || []) : [];
  const goodIngs     = hasData ? (analysisData.recommended_ingredients || []) : [];

  // 속성 pills (hi/lo 만 표시, 최대 4개)
  const attrPills = attrs
    .filter(a => a.level !== 'mid')
    .slice(0, 4)
    .map(a => ({
      label: a.short + (a.level === 'hi' ? ' ↑' : ' ↓'),
      hi: a.level === 'hi',
    }));

  // 이번 주 케어 — 권장 성분 Top 3 기반 (없으면 mock)
  const MOCK_CARE = [
    {n:'01', t:'장벽 회복', d:'세라마이드 함유 크림 야간 사용', c:'var(--accent-soft)', ic:'var(--accent-ink)'},
    {n:'02', t:'수분 충전', d:'저분자 히알루론산 토너 2회/일',  c:'var(--good-soft)',   ic:'var(--good)'},
    {n:'03', t:'자극 회피', d:'에탄올·향료 함유 제품 일시 중단', c:'var(--bg-2)',        ic:'var(--ink-2)'},
  ];
  const careSteps = goodIngs.length >= 3
    ? goodIngs.slice(0, 3).map((ing, i) => ({
        n: String(i + 1).padStart(2, '0'),
        t: ing.name,
        d: ing.why || ing.tag || '',
        c: ['var(--accent-soft)', 'var(--good-soft)', 'var(--bg-2)'][i],
        ic: ['var(--accent-ink)', 'var(--good)', 'var(--ink-2)'][i],
      }))
    : MOCK_CARE;

  // 히스토리 — 로그인 상태면 실제 기록(없으면 빈 배열), 비로그인이면 mock
  const isLoggedIn = !!localStorage.getItem('skin_token');
  const displayHistory = localHistory !== null ? localHistory
    : (historyList && historyList.length > 0 ? historyList : (isLoggedIn ? [] : MOCK_HISTORY));

  const gradients = [
    'linear-gradient(135deg, #E8C9B5, #C9624A)',
    'linear-gradient(135deg, #DECBB1, #A88262)',
    'linear-gradient(135deg, #D7C8B2, #8C7660)',
    'linear-gradient(135deg, #E2D3B8, #C29A6F)',
  ];

  const today = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'});

  return (
    <div className="page" data-screen-label="02 Dashboard">
      {/* Hero */}
      <div className="hero">
        <div className="hero-main">
          <div>
            <div className="overline">오늘의 추천 · {today}</div>
            <h1 className="heading">
              {hasData
                ? <>분석이 완료됐어요.<br/>결과를 확인해볼까요?</>
                : <>
                    안녕하세요{displayName ? <>, <em>{displayName}</em>님</> : ''}.<br/>
                    오늘의 <em>피부 분석</em>을 시작해볼까요?
                  </>
              }
            </h1>
          </div>
          <div className="actions">
            <button className="btn btn-primary btn-lg" onClick={onStart}>
              <Icon name="camera" size={15} /> {hasData ? '새 분석 시작' : '분석 시작하기'}
            </button>
            {hasData && (
              <button className="btn btn-ghost btn-lg" onClick={onViewReport}>
                최근 리포트 보기
              </button>
            )}
          </div>
        </div>

        {hasData && (
          <div className="hero-stat">
            <div>
              <div className="eyebrow-serif">최근 종합 점수</div>
              <div className="last-row" style={{marginTop: 8}}>
                <div className="score-big">{lastScore}<sup>/100</sup></div>
                {historyList.length > 1 && (
                  <div style={{textAlign:'right'}}>
                    <div className="mono" style={{fontSize: 12, color: historyList[0].up ? 'var(--good)' : 'var(--warn)'}}>
                      {historyList[0].delta} {historyList[0].up ? '▲' : '▼'}
                    </div>
                    <div className="faint" style={{fontSize: 11.5}}>지난 분석 대비</div>
                  </div>
                )}
              </div>
              <div className="muted" style={{fontSize: 12.5, marginTop: 8}}>{lastSkin}</div>
            </div>
            <div className="pill-row">
              {attrPills.length > 0
                ? attrPills.map((p, i) => (
                    <span key={i} className="pill" style={{
                      background: p.hi ? 'var(--warn-soft)' : 'var(--good-soft)',
                      color: p.hi ? 'var(--warn)' : 'var(--good)',
                    }}>{p.label}</span>
                  ))
                : <span className="pill muted" style={{fontSize:12}}>속성 데이터 없음</span>
              }
            </div>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="dash-grid">
        <div className="col">
          {/* 케어 우선순위 */}
          <div className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">이번 주 추천</div>
                <h2 className="h2-serif" style={{margin: '4px 0 0'}}>케어 우선순위</h2>
              </div>
              {hasData && (
                <button className="btn btn-ghost btn-sm" onClick={onViewReport}>
                  리포트 보기 <Icon name="arrowRight" size={13} />
                </button>
              )}
            </div>

            <div style={{display:'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12}}>
              {careSteps.map((it, i) => (
                <div key={i} className="card-flat" style={{background: it.c, borderColor: 'transparent'}}>
                  <div className="mono" style={{fontSize: 10.5, color: it.ic, letterSpacing: '0.1em'}}>{it.n}</div>
                  <div style={{fontSize: 15, fontWeight: 600, marginTop: 6}}>{it.t}</div>
                  <div className="muted" style={{fontSize: 12, marginTop: 6, lineHeight: 1.5}}>{it.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 점수 추이 차트 */}
          {displayHistory.length >= 2 && (() => {
            const pts = [...displayHistory].reverse();
            const W = 460, H = 90, pad = 14;
            const scores = pts.map(p => p.score);
            const minS = Math.min(...scores) - 8;
            const maxS = Math.max(...scores) + 8;
            const x = i => pad + (i / (pts.length - 1)) * (W - pad * 2);
            const y = v => H - pad - ((v - minS) / (maxS - minS)) * (H - pad * 2);
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
            const area = `${d} L${x(pts.length-1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
            return (
              <div className="card">
                <div className="section-head" style={{marginBottom: 10}}>
                  <div>
                    <div className="eyebrow">추이 · TREND</div>
                    <h2 className="h2-serif" style={{margin: '4px 0 0'}}>종합 점수 변화</h2>
                  </div>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-muted)'}}>최근 {pts.length}회</div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height: H, display:'block', overflow:'visible'}}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18"/>
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d={area} fill="url(#trendGrad)"/>
                  <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={x(i)} cy={y(p.score)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2"/>
                      <text x={x(i)} y={y(p.score) - 9} textAnchor="middle"
                        style={{fontFamily:'var(--mono)', fontSize:10.5, fill:'var(--ink-2)'}}>
                        {p.score}
                      </text>
                    </g>
                  ))}
                </svg>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:4}}>
                  {pts.map((p, i) => (
                    <span key={i} style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-faint)'}}>
                      {p.date.slice(-5)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 히스토리 */}
          <div className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">기록 · HISTORY</div>
                <h2 className="h2-serif" style={{margin: '4px 0 0'}}>최근 분석</h2>
              </div>
            </div>
            <HistoryList
              displayHistory={displayHistory}
              onViewHistoryItem={onViewHistoryItem}
              onViewReport={onViewReport}
              gradients={gradients}
              onDelete={handleDeleteHistory}
            />
          </div>

          {/* 성분 검사·사전 통합 */}
          <IngUnified
            avoidList={(analysisData && analysisData.avoid_ingredients) || []}
            recList={(analysisData && analysisData.recommended_ingredients) || []}
          />
        </div>

        {/* right column */}
        <div className="col">
          <div className="card" style={{
            background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)'
          }}>
            <div className="eyebrow">서비스 소개</div>
            <h3 className="h2-serif" style={{margin: '4px 0 14px'}}>어떻게 분석하나요?</h3>

            <div className="col-gap">
              {[
                {label:'사진 분석', sub:'AI가 피부 속성 7가지를 동시에 분석해요', tag:'이미지 AI', icn:'camera'},
                {label:'성분 매칭', sub:'피부에 맞는 성분과 피해야 할 성분을 찾아요', tag:'성분 DB', icn:'flask'},
                {label:'제품 추천', sub:'식약처 기능성 화장품 중 맞는 제품을 골라요', tag:'추천', icn:'leaf'},
                {label:'분석 요약', sub:'결과를 이해하기 쉽게 정리해드려요', tag:'리포트', icn:'sparkle'},
              ].map((p, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'34px 1fr auto', gap: 12, alignItems:'center',
                  padding: '10px 12px',
                  background: 'var(--surface)', border: '1px solid var(--line-2)',
                  borderRadius: 12,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'var(--bg-2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color: 'var(--ink-2)'
                  }}>
                    <Icon name={p.icn} size={16} />
                  </div>
                  <div>
                    <div style={{fontSize: 13.5, fontWeight: 500}}>{p.label}</div>
                    <div className="muted" style={{fontSize: 11.5}}>{p.sub}</div>
                  </div>
                  <span className="pill">{p.tag}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="eyebrow">왜 다른가요?</div>
            <h3 className="h2-serif" style={{margin: '4px 0 12px'}}>이 서비스의 특징</h3>
            <ul style={{margin: 0, padding: 0, listStyle: 'none', display:'flex', flexDirection:'column', gap: 10}}>
              {[
                '한국인 피부 데이터로 학습한 AI',
                '식약처 공공 데이터 기반 — 안전한 성분 추천',
                '사진 + 설문 함께 분석해 더 정확해요',
                '피해야 할 성분도 함께 알려드려요',
                '결과를 리포트로 저장할 수 있어요',
              ].map((t, i) => (
                <li key={i} style={{display:'grid', gridTemplateColumns: '18px 1fr', gap: 10, fontSize: 13, lineHeight: 1.5}}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    marginTop: 2,
                  }}>
                    <Icon name="check" size={11} stroke={2.2}/>
                  </span>
                  <span style={{color: 'var(--ink-2)'}}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
