// Dashboard — 실제 분석 데이터 반영
const Dashboard = ({ onStart, onViewReport, analysisData, historyList }) => {
  const hasData = !!(analysisData && analysisData.composite_score != null);

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

  // 히스토리 — 실제 분석 기록 or mock
  const MOCK_HISTORY = [
    { date: '2026 · 05 · 22', label: '아침 분석 #14', score: 62, delta: '+4',  up: true  },
    { date: '2026 · 05 · 15', label: '주간 점검 #13', score: 58, delta: '+1',  up: true  },
    { date: '2026 · 05 · 08', label: '저녁 분석 #12', score: 57, delta: '-2',  up: false },
    { date: '2026 · 05 · 01', label: '월간 리포트',   score: 59, delta: '+6',  up: true  },
  ];
  const displayHistory = (historyList && historyList.length > 0) ? historyList : MOCK_HISTORY;

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
                : <>안녕하세요.<br/>오늘의 <em>피부 분석</em>을 시작해볼까요?</>
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

        <div className="hero-stat">
          {hasData ? (
            <>
              <div>
                <div className="eyebrow">최근 종합 점수</div>
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
            </>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:12, alignItems:'flex-start'}}>
              <div className="eyebrow">아직 분석 기록이 없어요</div>
              <div style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.6}}>
                사진 한 장과 간단한 폼 작성으로<br/>맞춤 피부 분석을 받아보세요.
              </div>
              <button className="btn btn-accent btn-sm" onClick={onStart}>
                <Icon name="sparkle" size={13}/> 지금 시작하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="dash-grid">
        <div className="col">
          {/* 케어 우선순위 */}
          <div className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">이번 주 추천</div>
                <h2 className="h2" style={{margin: '4px 0 0'}}>케어 우선순위</h2>
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

          {/* 히스토리 */}
          <div className="card">
            <div className="section-head">
              <div>
                <div className="eyebrow">기록 · HISTORY</div>
                <h2 className="h2" style={{margin: '4px 0 0'}}>최근 분석</h2>
              </div>
            </div>

            {displayHistory.length === 0 ? (
              <div style={{padding:'28px 0', textAlign:'center', color:'var(--ink-muted)', fontSize:13}}>
                아직 분석 기록이 없습니다.
              </div>
            ) : (
              <div className="history-list">
                {displayHistory.map((h, i) => (
                  <div key={i} className="history-row">
                    <div className="thumb" style={{background: gradients[i % gradients.length]}} />
                    <div className="meta">
                      <span className="date">{h.date}</span>
                      <span className="title">{h.label}</span>
                    </div>
                    <span className="score-sm" style={{fontSize:13, fontWeight:600, minWidth:32, textAlign:'right'}}>
                      {h.score}
                    </span>
                    {h.delta && (
                      <span className={"delta " + (h.up ? '' : 'down')}>{h.delta} {h.up ? '▲' : '▼'}</span>
                    )}
                    <span className="arrow">›</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* right column */}
        <div className="col">
          <div className="card" style={{
            background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)'
          }}>
            <div className="eyebrow">서비스 소개</div>
            <h3 className="h2" style={{margin: '4px 0 14px'}}>어떻게 분석하나요?</h3>

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
            <h3 className="h2" style={{margin: '4px 0 12px'}}>이 서비스의 특징</h3>
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
