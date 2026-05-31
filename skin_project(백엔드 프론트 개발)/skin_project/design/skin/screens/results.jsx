// Results: 실제 API 데이터 표시 (없으면 mock 데이터 fallback)
const Results = ({ data, onRestart, onHome }) => {
  const today = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\. /g,'·').replace('.','');

  // API 데이터 or mock fallback — data가 존재하면 API 결과를 그대로 사용(빈 배열 포함)
  const attrs       = data ? (data.attributes || ATTRIBUTES)            : ATTRIBUTES;
  const composite   = (data && data.composite_score != null) ? data.composite_score : 62;
  const skinLabel   = (data && data.skin_type_label) ? data.skin_type_label : '건성 + 민감성 + T존 지성';
  const summary     = (data && data.summary) ? data.summary : '복합성';
  const goodIngs    = data ? (data.recommended_ingredients || [])       : GOOD_INGREDIENTS;
  const avoidIngs   = data ? (data.avoid_ingredients || [])             : AVOID_INGREDIENTS;
  const products    = data ? (data.products || [])                      : PRODUCTS;
  const mlAvailable = data ? data.ml_available : false;

  const radarValues = attrs.map(a => a.value);
  const radarLabels = attrs.map(a => a.short);

  return (
    <div className="page" data-screen-label="04 Results">
      {/* 상단 배너 */}
      <div className="result-banner">
        <div>
          <div className="eyebrow">분석 결과 · {today}</div>
          <div className="skin-type" style={{marginTop: 6}}>
            {skinLabel.split(' + ').map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && ' + '}
                <em>{part}</em>
              </React.Fragment>
            ))}
          </div>
          <div className="muted" style={{marginTop: 8, fontSize: 13, maxWidth: 520}}>
            AI가 7가지 피부 속성을 분석하고, 입력하신 알러지·라이프스타일 정보와 함께 종합한 결과입니다.
          </div>
          <div className="pill-row" style={{marginTop: 14}}>
            <span className="pill" style={{background:'rgba(255,255,255,0.7)'}}>
              {mlAvailable ? '사진 분석 완료' : '설문 기반 분석'}
            </span>
            <span className="pill" style={{background:'rgba(255,255,255,0.7)'}}>성분 DB 매칭 완료</span>
            <span className="pill" style={{background:'rgba(255,255,255,0.7)'}}>제품 추천 완료</span>
          </div>
        </div>
        <div className="composite">
          <div className="eyebrow">종합 점수</div>
          <div className="composite-score">
            {composite}
            <span style={{fontSize: 24, color:'var(--ink-muted)', fontFamily:'var(--sans)', fontStyle:'normal', marginLeft:2}}>/100</span>
          </div>
          <div className="mono" style={{color:'var(--good)', fontSize:12}}>피부 분석 완료 ✓</div>
        </div>
      </div>

      {/* MODULE 01: 피부 속성 */}
      <div className="section-head" style={{marginTop: 28}}>
        <div>
          <div className="eyebrow">MODULE 01 · 피부 분석</div>
          <h2 className="h2" style={{margin:'4px 0 0'}}>피부 속성 리포트</h2>
        </div>
        <span className="muted" style={{fontSize:12.5}}>AI 분석 · 7가지 속성</span>
      </div>

      <div className="results-grid">
        {/* 레이더 차트 */}
        <div className="attribute-card">
          <div className="radar-wrap">
            <Radar values={radarValues} labels={radarLabels} size={280} max={100} />
            <div className="legend">
              {attrs.map((a, i) => (
                <div key={i} className="legend-row">
                  <span className="swatch" style={{
                    background: a.level === 'hi' ? 'var(--warn)' : a.level === 'lo' ? 'var(--good)' : 'var(--ink-faint)'
                  }} />
                  <div>
                    <div className="name">{a.name}</div>
                    <div className="muted" style={{fontSize:11}}>{a.desc}</div>
                  </div>
                  <span className="val">{a.value}</span>
                  <span className={"tag tag-" + a.level}>
                    {a.level === 'hi' ? 'HIGH' : a.level === 'lo' ? 'LOW' : 'MID'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 바 게이지 */}
        <div className="attribute-card">
          <div className="eyebrow">상세 점수</div>
          <h3 className="h2" style={{margin:'4px 0 16px'}}>속성별 게이지</h3>
          {attrs.map((a, i) => (
            <div key={i} className="bar-row">
              <div className="label">{a.name}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{
                  width: a.value + '%',
                  background: a.level === 'hi'
                    ? 'linear-gradient(90deg, var(--warn-soft), var(--warn))'
                    : a.level === 'lo'
                    ? 'linear-gradient(90deg, var(--good-soft), var(--good))'
                    : 'linear-gradient(90deg, var(--bg-2), var(--ink-faint))'
                }}/>
              </div>
              <div className="val">{a.value}/100</div>
            </div>
          ))}
        </div>
      </div>

      {/* MODULE 02: 성분 */}
      <div className="section-head" style={{marginTop: 32}}>
        <div>
          <div className="eyebrow">MODULE 02 · 성분 매칭</div>
          <h2 className="h2" style={{margin:'4px 0 0'}}>당신에게 맞는 성분 · 피해야 할 성분</h2>
        </div>
        <span className="muted" style={{fontSize:12.5}}>식약처 원료 / 사용제한 DB</span>
      </div>

      <div className="ingredient-block">
        <div className="ing-card good">
          <div className="eyebrow" style={{color:'var(--good)'}}>RECOMMEND</div>
          <h4>찾아주세요 ─ 권장 성분</h4>
          <div className="muted" style={{fontSize:12.5}}>속성 분석 결과 기반, 식약처 고시 성분 우선</div>
          {goodIngs.length === 0 ? (
            <div className="muted" style={{marginTop:14, fontSize:13}}>현재 조건에서 특별 권장 성분이 없습니다.</div>
          ) : (
            <ul className="ing-list">
              {goodIngs.map((g, i) => (
                <li key={i} className="ing-item">
                  <span className="name">{g.name}</span>
                  <span className="pill" style={{background:'var(--good-soft)', color:'var(--good)'}}>{g.tag}</span>
                  <span className="why">→ {g.why}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ing-card avoid">
          <div className="eyebrow" style={{color:'var(--warn)'}}>AVOID</div>
          <h4>피해주세요 ─ 회피 성분</h4>
          <div className="muted" style={{fontSize:12.5}}>알러지 응답 + 민감도 점수 + MFDS 사용제한 원료</div>
          {avoidIngs.length === 0 ? (
            <div className="muted" style={{marginTop:14, fontSize:13}}>회피해야 할 성분이 없습니다.</div>
          ) : (
            <ul className="ing-list">
              {avoidIngs.map((g, i) => (
                <li key={i} className="ing-item">
                  <span className="name">{g.name}</span>
                  <span className="pill" style={{background:'var(--warn-soft)', color:'var(--warn)'}}>{g.tag}</span>
                  <span className="why">→ {g.why}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* MODULE 03: 제품 추천 */}
      <div className="section-head" style={{marginTop: 32}}>
        <div>
          <div className="eyebrow">MODULE 03 · 제품 추천</div>
          <h2 className="h2" style={{margin:'4px 0 0'}}>당신을 위한 Top {products.length} 제품</h2>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card" style={{padding:28, textAlign:'center', color:'var(--ink-muted)'}}>
          피부 고민을 선택하면 식약처 기능성화장품에서 맞춤 제품을 추천해드립니다.
        </div>
      ) : (
        <div className="products-grid">
          {products.map((p, i) => (
            <div key={i} className="product-card">
              <div className={"product-shot " + (p.shot || ['', 'b', 'c'][i] || '')}>
                <span className="match">MATCH · {p.match}%</span>
              </div>
              <div className="product-body">
                <span className="product-brand">{p.brand || '식약처 기능성'}</span>
                <span className="product-name">{p.name}</span>
                <div className="product-tags">
                  {(p.tags || []).map((t, j) => (
                    <span key={j} className={"product-tag " + (j === 0 ? 'green' : '')}>{t}</span>
                  ))}
                </div>
                <div className="product-reason">{p.reason}</div>
                <div className="product-foot">
                  <span className="product-price">{p.price || '가격 문의'}</span>
                  <button className="btn btn-outline btn-sm">자세히 <Icon name="arrowRight" size={12}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODULE 04: 추천 사유 */}
      <div className="section-head" style={{marginTop: 32}}>
        <div>
          <div className="eyebrow">MODULE 04 · 분석 요약</div>
          <h2 className="h2" style={{margin:'4px 0 0'}}>맞춤 추천 요약</h2>
        </div>
      </div>

      <div className="card" style={{background:'linear-gradient(180deg, var(--surface-2), var(--surface))', padding:28}}>
        {data && data.explanation ? (
          /* Claude AI 생성 설명 */
          <div>
            <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize:20, lineHeight:1.7, color:'var(--ink)', maxWidth:820}}>
              "{data.explanation}"
            </div>
            <div className="muted" style={{fontSize:12, marginTop:16, display:'flex', alignItems:'center', gap:8}}>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:4,
                padding:'2px 8px', borderRadius:20,
                background:'var(--accent-soft)', color:'var(--accent-ink)', fontSize:11,
              }}>
                <Icon name="sparkle" size={11}/> AI 분석
              </span>
              사진·생활습관·성분 데이터를 종합해 생성된 개인화 설명입니다.
            </div>
          </div>
        ) : (
          /* 폴백: 템플릿 기반 */
          (() => {
            const dry  = attrs.find(a => a.key === 'hydro');
            const sens = attrs.find(a => a.key === 'sens');
            const rec1 = goodIngs[0];
            const rec2 = goodIngs[1];
            return (
              <div>
                <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize:20, lineHeight:1.7, color:'var(--ink)', maxWidth:820}}>
                  {dry && <span>"수분 <span style={{color:'var(--accent-ink)'}}>{dry.value}%</span></span>}
                  {sens && <span>, 민감도 <span style={{color:'var(--accent-ink)'}}>{sens.value}%</span></span>}
                  {rec1 && rec2 && <span> — <span style={{borderBottom:'2px solid var(--accent)'}}>{rec1.name} + {rec2.name}</span> 조합을 우선 시도해보세요."</span>}
                  {!rec1 && <span> — 피부 고민을 선택하면 더 정확한 성분을 추천해드릴 수 있어요."</span>}
                </div>
                <div className="muted" style={{fontSize:12, marginTop:16}}>
                  → 생활습관 항목을 입력하면 AI 개인화 설명이 생성됩니다.
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* 하단 액션 */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginTop:32, paddingTop:24, borderTop:'1px solid var(--line-2)',
      }}>
        <div>
          <div className="eyebrow">다음 단계</div>
          <div style={{fontSize:14, marginTop:4}}>리포트를 저장하거나, 2주 후 재분석을 예약해보세요.</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-ghost" onClick={onHome}>대시보드로</button>
          <button className="btn btn-outline">PDF 저장</button>
          <button className="btn btn-primary" onClick={onRestart}>
            <Icon name="sparkle" size={14} /> 새 분석 시작
          </button>
        </div>
      </div>
    </div>
  );
};

window.Results = Results;
