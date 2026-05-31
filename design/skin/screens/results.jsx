// Results: 실제 API 데이터 표시 (없으면 mock 데이터 fallback)

const Results = ({ data, onRestart, onHome, onNavigate }) => {
  const [wishlist, setWishlist] = React.useState([]);
  const [productData, setProductData] = React.useState({});

  React.useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const token = localStorage.getItem('skin_token');
        if (!token) return;
        const res = await fetch('/api/me/wishlist', { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) {
          setWishlist(await res.json());
        }
      } catch(e) {}
    };
    fetchWishlist();
  }, []);

  const toggleWishlist = async (type, title, subtitle) => {
    const existing = wishlist.find(w => w.item_type === type && w.title === title);
    const token = localStorage.getItem('skin_token');
    if (!token) { alert('로그인이 필요합니다.'); return; }
    
    if (existing) {
      await fetch(`/api/me/wishlist/${existing.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    } else {
      await fetch('/api/me/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ item_type: type, title, subtitle })
      });
    }
    // Optimistic update
    if (existing) {
      setWishlist(wishlist.filter(w => w.id !== existing.id));
    } else {
      // refetch to get real ID
      const res = await fetch('/api/me/wishlist', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setWishlist(await res.json());
    }
  };

  const isWishlisted = (type, title) => wishlist.some(w => w.item_type === type && w.title === title);

  // 제품별 Naver 이미지·가격·링크 로딩
  React.useEffect(() => {
    if (!data) return;
    const prods = data.products || [];
    if (prods.length === 0) return;
    prods.forEach((p, i) => {
      if (p.image || p.link) {
        setProductData(prev => ({...prev, [i]: { image: p.image||null, price: p.price||null, link: p.link||null }}));
        return;
      }
      const q = encodeURIComponent((p.name || '').trim());
      const b = encodeURIComponent((p.brand || '').trim());
      fetch('/api/product/search?q=' + q + '&brand=' + b)
        .then(r => r.json())
        .then(d => { if (d.image || d.price) setProductData(prev => ({...prev, [i]: d})); })
        .catch(() => {});
    });
  }, [data ? (data.products||[]).length : 0]);

  if (!data) {
    return (
      <div className="page" style={{display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', minHeight:'80vh', padding: 20}}>
        <div style={{fontSize: 48, marginBottom: 16}}>📊</div>
        <div className="h2-serif" style={{marginBottom: 8}}>분석 결과가 없습니다</div>
        <div className="muted" style={{textAlign:'center', fontSize: 13, lineHeight: 1.5, marginBottom: 24}}>
          아직 피부 분석을 진행하지 않으셨습니다.<br/>
          홈에서 사진 분석을 먼저 시작해보세요!
        </div>
        <button className="btn btn-primary" onClick={onHome} style={{width: 200}}>
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  const [foodPage, setFoodPage] = React.useState(0);
  const today = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\. /g,'·').replace('.','');

  // API 데이터 or mock fallback — data가 존재하면 API 결과를 그대로 사용(빈 배열 포함)
  const attrs       = data ? (data.attributes || ATTRIBUTES)            : ATTRIBUTES;
  const composite   = (data && data.composite_score != null) ? data.composite_score : 62;
  const skinLabel   = (data && data.skin_type_label) ? data.skin_type_label : '건성 + 민감성 + T존 지성';
  const summary     = (data && data.summary) ? data.summary : '복합성';
  const goodIngs    = data ? (data.recommended_ingredients || [])       : GOOD_INGREDIENTS;
  const avoidIngs   = data ? (data.avoid_ingredients || [])             : AVOID_INGREDIENTS;
  const cautionIngs = data ? (data.caution_ingredients || [])           : [];
  const products    = data ? (data.products || [])                      : PRODUCTS;
  const procedures  = data ? (data.procedures || [])                    : [];
  const foods       = data ? (data.foods || [])                         : [];
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
            <span className="pill">
              {mlAvailable ? '사진 분석 완료' : '설문 기반 분석'}
            </span>
            <span className="pill">성분 DB 매칭 완료</span>
            <span className="pill">제품 추천 완료</span>
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
          <h2 className="h2-serif" style={{margin:'4px 0 0'}}>피부 속성 리포트</h2>
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
          <h3 className="h2-serif" style={{margin:'4px 0 16px'}}>속성별 게이지</h3>
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
          <h2 className="h2-serif" style={{margin:'4px 0 0'}}>당신에게 맞는 성분 · 피해야 할 성분</h2>
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
          {avoidIngs.length > 0 ? (
            <>
              <div className="eyebrow" style={{color:'var(--warn)'}}>AVOID</div>
              <h4>피해주세요 ─ 회피 성분</h4>
              <div className="muted" style={{fontSize:12.5}}>알러지 응답 + 민감도 점수 + MFDS 사용제한 원료</div>
              <ul className="ing-list">
                {avoidIngs.map((g, i) => (
                  <li key={i} className="ing-item">
                    <span className="name">{g.name}</span>
                    <span className="pill" style={{background:'var(--warn-soft)', color:'var(--warn)'}}>{g.tag}</span>
                    <span className="why">→ {g.why}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : cautionIngs.length > 0 ? (
            <>
              <div className="eyebrow" style={{color:'var(--warn)'}}>CAUTION</div>
              <h4>조심하세요 ─ 주의 성분</h4>
              <div className="muted" style={{fontSize:12.5}}>무조건 금지는 아니지만 현재 피부 상태에서 주의가 필요한 성분이에요</div>
              <ul className="ing-list">
                {cautionIngs.map((g, i) => (
                  <li key={i} className="ing-item">
                    <span className="name">{g.name}</span>
                    <span className="pill" style={{background:'var(--warn-soft)', color:'var(--warn)'}}>{g.tag}</span>
                    <span className="why">→ {g.why}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="eyebrow" style={{color:'var(--warn)'}}>AVOID</div>
              <h4>피해주세요 ─ 회피 성분</h4>
              <div className="muted" style={{marginTop:14, fontSize:13}}>현재 분석 결과로는 특별히 피해야 할 성분이 없습니다.</div>
            </>
          )}
        </div>
      </div>

      {/* MODULE 03: 제품 추천 */}
      <div className="section-head" style={{marginTop: 32}}>
        <div>
          <div className="eyebrow">MODULE 03 · 제품 추천</div>
          <h2 className="h2-serif" style={{margin:'4px 0 0'}}>당신을 위한 Top {products.length} 제품</h2>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card" style={{padding:28, textAlign:'center', color:'var(--ink-muted)'}}>
          피부 고민을 선택하면 식약처 기능성화장품에서 맞춤 제품을 추천해드립니다.
        </div>
      ) : (() => {
        // reason 파싱: "· " 구분자로 분리된 구조화 텍스트
        const parseReason = (reason) => {
          if (!reason) return { rank:'', desc:'', ingredients:'', avoid:'', usage:'' };
          const parts = reason.split(' · ');
          return {
            rank:        parts[0] || '',
            desc:        parts[1] || '',
            ingredients: parts[2] || '',
            avoid:       parts[3] || '',
            usage:       parts[4] || parts[3] || '',
          };
        };
        const rankColors = [
          {bg:'linear-gradient(160deg,#F3DECB,#DDB69A)', badge:'#C9624A'},
          {bg:'linear-gradient(160deg,#E6D6C0,#B59A7E)', badge:'#8C7660'},
          {bg:'linear-gradient(160deg,#D8CFC2,#8C7A66)', badge:'#6A5C50'},
        ];
        return (
          <div className="products-grid">
            {products.map((p, i) => {
              const r = parseReason(p.reason);
              const rc = rankColors[i] || rankColors[2];
              const pd = productData[i] || {};
              const naverUrl = pd.link || `https://search.shopping.naver.com/search/all?query=${encodeURIComponent((p.brand||'')+' '+(p.name||''))}`;
              const displayPrice = pd.price || p.price || null;
              const formattedName = p.name || '';
              return (
                <div key={i} className="product-card">
                  {/* 썸네일 — Naver 실제 이미지 or 그라디언트 */}
                  <div style={{
                    aspectRatio:'4/3', background: rc.bg,
                    position:'relative', display:'flex',
                    alignItems:'flex-end', padding:12,
                    justifyContent:'space-between', overflow:'hidden',
                  }}>
                    {pd.image && (
                      <img src={pd.image} alt={p.name}
                        style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}}
                        onError={e => { e.target.style.display='none'; }}
                      />
                    )}
                    {!pd.image && (
                      <div style={{
                        position:'absolute', right:-8, bottom:-20,
                        fontSize:90, fontFamily:'var(--serif)', fontStyle:'italic',
                        color:'rgba(255,255,255,0.18)', lineHeight:1,
                        userSelect:'none', pointerEvents:'none',
                      }}>{(p.name||p.brand||'S')[0]}</div>
                    )}
                    <div style={{
                      position:'absolute', inset:0,
                      background: pd.image ? 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)' : 'none',
                    }}/>
                    <span style={{
                      background: rc.badge, color:'white',
                      fontFamily:'var(--mono)', fontSize:10.5,
                      padding:'4px 10px', borderRadius:999,
                      letterSpacing:'0.08em', zIndex:1, position:'relative',
                    }}>
                      {['1ST', '2ND', '3RD'][i] || `${i+1}TH`}
                    </span>
                    <span className="match" style={{zIndex:1, position:'relative',
                      color: pd.image ? 'rgba(255,255,255,0.9)' : undefined}}>
                      MATCH · {p.match}%
                    </span>
                  </div>

                  <div className="product-body">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                      <div>
                        <span className="product-brand">{p.brand || '식약처 기능성'}</span>
                        <span className="product-name" style={{lineHeight:1.35, display:'block', wordBreak:'keep-all'}}>{formattedName}</span>
                      </div>
                      <button type="button" onClick={() => toggleWishlist('product', p.name, p.brand || '식약처 기능성')}
                        style={{background:'none',border:'none',cursor:'pointer',padding:4,
                          color: isWishlisted('product', p.name) ? '#e53935' : 'var(--accent)'}}>
                        <Icon name={isWishlisted('product', p.name) ? 'heart-fill' : 'heart'} size={20} />
                      </button>
                    </div>

                    <div className="product-tags" style={{marginTop:6}}>
                      {(p.tags || []).map((t, j) => (
                        <span key={j} className={"product-tag " + (j === 0 ? 'green' : '')}>{t}</span>
                      ))}
                    </div>

                    <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:6}}>
                      {r.rank && (
                        <div style={{fontSize:11, fontFamily:'var(--mono)', color: rc.badge, letterSpacing:'0.06em'}}>{r.rank}</div>
                      )}
                      {r.desc && (
                        <div style={{fontSize:12.5, fontFamily:'var(--serif-ko)', color:'var(--ink-2)', lineHeight:1.7}}>{r.desc}</div>
                      )}
                      {r.ingredients && !r.ingredients.startsWith("'") && (
                        <div style={{padding:'8px 10px', borderRadius:8, background:'var(--good-soft)', fontSize:12, color:'var(--good)', lineHeight:1.5}}>
                          <strong>핵심 성분</strong><br/>{r.ingredients}
                        </div>
                      )}
                      {r.avoid && !r.avoid.startsWith('사용법') && (
                        <div style={{padding:'8px 10px', borderRadius:8, background:'var(--warn-soft)', fontSize:12, color:'var(--warn)', lineHeight:1.5}}>
                          <strong>주의 성분</strong><br/>{r.avoid}
                        </div>
                      )}
                      {(p.usage || r.usage) && (
                        <div style={{padding:'8px 10px', borderRadius:8, background:'var(--surface-2)', borderLeft:'2px solid var(--accent)', fontSize:12, color:'var(--ink-2)', lineHeight:1.5}}>
                          <strong>💡 사용법</strong><br/>{p.usage || r.usage.replace('사용법: ','')}
                        </div>
                      )}
                    </div>

                    <div className="product-foot" style={{marginTop:'auto', paddingTop:12}}>
                      {displayPrice
                        ? <span style={{fontFamily:'var(--mono)', fontSize:15, fontWeight:700, color:'var(--ink)'}}>{displayPrice}</span>
                        : <span className="product-price">가격 검색</span>
                      }
                      <a href={naverUrl} target="_blank" rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5}}>
                        <Icon name="arrowRight" size={12}/> 구매하러 가기
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* MODULE 04: 피부과 시술 추천 — Teaser */}
      <div className="section-head" style={{marginTop: 32}}>
        <div>
          <div className="eyebrow">MODULE 04 · 시술 매칭</div>
          <h2 className="h2-serif" style={{margin:'4px 0 0'}}>추천 피부과 시술</h2>
        </div>
      </div>

      {procedures.length === 0 ? (
        <div className="card" style={{padding:28, textAlign:'center', color:'var(--ink-muted)'}}>
          현재 피부 상태에 추천되는 시술이 없거나 분석 후 확인 가능합니다.
        </div>
      ) : (() => {
        const top = procedures[0];
        const concerns = top.target_concerns || top.match_reasons || [];
        return (
          <div className="card" style={{padding: 22, borderLeft: '4px solid var(--accent)'}}>
            {/* BEST MATCH 뱃지 */}
            <div style={{display:'flex', gap: 6, marginBottom: 10, alignItems:'center'}}>
              <span style={{
                background:'var(--gold)', color:'#fff',
                fontSize: 10.5, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
              }}>🏆 BEST MATCH</span>
              <span className="pill" style={{
                background:'var(--accent-soft)', color:'var(--accent-ink)', fontSize: 11,
              }}>{top.category}</span>
            </div>

            {/* 시술명 + 핵심 효과 */}
            <div style={{
              fontFamily:'var(--serif-ko)', fontSize: 20, fontWeight: 600,
              color:'var(--ink)', marginBottom: 6,
            }}>{top.name}</div>

            {concerns.length > 0 && (
              <div style={{fontSize: 13, color:'var(--ink-2)', lineHeight: 1.6, marginBottom: 12}}>
                ✨ <strong style={{color:'var(--accent-ink)'}}>{concerns.join(' · ')}</strong> 개선에 적합한 시술로 분석됩니다.
              </div>
            )}

            {/* 가격 + 회복기간 요약 */}
            <div style={{display:'flex', gap: 16, marginBottom: 16}}>
              {top.price_bracket && (
                <div style={{fontSize: 12, color:'var(--ink-muted)'}}>
                  💰 <strong style={{color:'var(--ink)'}}>{top.price_bracket}</strong>
                </div>
              )}
              {top.downtime && (
                <div style={{fontSize: 12, color:'var(--ink-muted)'}}>
                  ⏱️ <strong style={{color:'var(--ink)'}}>{top.downtime}</strong>
                </div>
              )}
            </div>

            {/* CTA 버튼 */}
            <button
              className="btn btn-primary"
              style={{width:'100%', gap: 6}}
              onClick={() => onNavigate && onNavigate('treatment')}
            >
              나에게 맞는 시술 {procedures.length}개 전체보기 →
            </button>
          </div>
        );
      })()}


      {/* MODULE 05: 이너뷰티 음식 추천 */}
      <div className="section-head" style={{marginTop: 32}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', width:'100%'}}>
          <div>
            <div className="eyebrow">MODULE 05 · 이너뷰티</div>
            <h2 className="h2-serif" style={{margin:'4px 0 0'}}>오늘의 피부 맞춤 음식 🥗</h2>
            <div className="muted" style={{fontSize:12.5, marginTop: 4}}>피부 속성 기반 · 매일 업데이트</div>
          </div>
          {foods.length > 2 && (
            <button className="btn btn-outline btn-sm" style={{height:32, padding:'0 12px'}} onClick={() => setFoodPage(p => (p+1)*2 >= foods.length ? 0 : p+1)}>
              다른 음식 보기
            </button>
          )}
        </div>
      </div>

      {foods.length === 0 ? (
        <div className="card" style={{padding:28, textAlign:'center', color:'var(--ink-muted)'}}>
          음식 추천 데이터를 불러오는 중이거나 현재 조건에 맞는 식재료가 없습니다.
        </div>
      ) : (() => {
        const displayFoods = foods.slice(foodPage * 2, foodPage * 2 + 2);
        return (
          <div style={{display:'grid', gridTemplateColumns: `repeat(${displayFoods.length}, 1fr)`, gap:16}}>
            {displayFoods.map((food, i) => (
              <div key={i} className={`card ${i === 0 ? 'food-card-1st' : 'food-card-2nd'}`} style={{
                padding:24,
                border: 'none',
              }}>
                <div className="eyebrow" style={{
                  color: i === 0 ? 'var(--accent-ink)' : 'var(--good)',
                  marginBottom: 8,
                }}>
                  {i === 0 ? '1ST PICK' : '2ND PICK'}
                </div>
                <div style={{
                  fontFamily:'var(--serif-ko)',
                  fontSize: 22,
                  fontWeight: 600,
                  color:'var(--ink)',
                  marginBottom: 6,
                }}>
                  {food.food_name}
                </div>
              <div className="food-tag" style={{
                display:'inline-block',
                padding:'3px 10px',
                borderRadius:999,
                fontSize:11.5,
                fontFamily:'var(--mono)',
                marginBottom:12,
              }}>
                {food.key_nutrients}
              </div>
              <div style={{
                fontSize:13,
                color:'var(--ink-2)',
                lineHeight:1.65,
                padding:'10px 12px',
                background:'rgba(255,255,255,0.55)',
                borderRadius:10,
              }}>
                {food.reason}
              </div>
            </div>
            ))}
          </div>
        );
      })()}
      
      <div style={{marginTop: 16, display: 'flex', justifyContent: 'flex-end'}}>
        <button className="btn btn-outline btn-sm" onClick={() => onNavigate && onNavigate('innerbeauty')} style={{fontSize: 13, height: 32}}>
          자세히
        </button>
      </div>

      {/* MODULE 06: 추천 사유 */}
      <div className="section-head" style={{marginTop: 32}}>
        <div>
          <div className="eyebrow">MODULE 06 · 분석 요약</div>
          <h2 className="h2-serif" style={{margin:'4px 0 0'}}>맞춤 추천 요약</h2>
        </div>
      </div>

      {data && data.explanation && typeof data.explanation === 'object' ? (
        /* ── Claude 구조화 설명 ── */
        <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16}}>
          {/* 왼쪽: 피부 상태 요약 + 생활습관 */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div className="card" style={{padding:24, background:'linear-gradient(160deg,var(--surface-2),var(--surface))'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:4,
                  padding:'3px 10px', borderRadius:20,
                  background:'var(--accent-soft)', color:'var(--accent-ink)', fontSize:11,
                }}>
                  <Icon name="sparkle" size={11}/> Claude AI 분석
                </span>
              </div>
              <div style={{fontFamily:'var(--serif-ko)', fontWeight:400, fontSize:17, lineHeight:1.75, color:'var(--ink)'}}>
                {data.explanation.skin_summary}
              </div>
            </div>

            {data.explanation.lifestyle_note && (
              <div className="card" style={{padding:20, borderLeft:'3px solid var(--accent)'}}>
                <div className="eyebrow" style={{marginBottom:6}}>생활습관 연관성</div>
                <div style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.65}}>
                  {data.explanation.lifestyle_note}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 케어 포인트 + 핵심 성분 */}
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            {data.explanation.care_tips && data.explanation.care_tips.length > 0 && (
              <div className="card" style={{padding:22}}>
                <div className="eyebrow" style={{marginBottom:10}}>케어 우선순위</div>
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {data.explanation.care_tips.map((tip, i) => (
                    <div key={i} style={{
                      display:'grid', gridTemplateColumns:'22px 1fr', gap:10, alignItems:'flex-start',
                    }}>
                      <span style={{
                        width:22, height:22, borderRadius:'50%', flexShrink:0,
                        background: i===0 ? 'var(--accent)' : i===1 ? 'var(--good)' : 'var(--bg-2)',
                        color: i<2 ? 'white' : 'var(--ink-muted)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'var(--mono)', fontSize:10.5, fontWeight:600,
                      }}>{i+1}</span>
                      <span style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.55}}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.explanation.key_ingredient && (
              <div className="card" style={{padding:20, background:'var(--good-soft)', border:'1px solid rgba(91,117,83,0.2)'}}>
                <div className="eyebrow" style={{marginBottom:6, color:'var(--good)'}}>지금 당장 시도할 성분</div>
                <div style={{fontFamily:'var(--serif-ko)', fontSize:20, fontWeight:500, color:'var(--good)', marginBottom:6}}>
                  {data.explanation.key_ingredient}
                </div>
                <div style={{fontSize:12.5, color:'var(--good)', lineHeight:1.55, opacity:0.85}}>
                  {data.explanation.key_ingredient_reason}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── 폴백: AI 키 없을 때 ── */
        <div className="card" style={{padding:28, background:'linear-gradient(180deg,var(--surface-2),var(--surface))'}}>
          {(() => {
            const dry  = attrs.find(a => a.key === 'hydro');
            const sens = attrs.find(a => a.key === 'sens');
            const rec1 = goodIngs[0];
            const rec2 = goodIngs[1];
            return (
              <div>
                <div style={{fontFamily:'var(--serif-ko)', fontSize:17, lineHeight:1.8, color:'var(--ink)', maxWidth:820}}>
                  {dry && <span>수분 <span style={{color:'var(--accent-ink)', fontWeight:600}}>{dry.value}%</span></span>}
                  {sens && <span>, 민감도 <span style={{color:'var(--accent-ink)', fontWeight:600}}>{sens.value}%</span></span>}
                  {rec1 && rec2 && <span> — <span style={{borderBottom:'2px solid var(--accent)'}}>{rec1.name} + {rec2.name}</span> 조합을 우선 시도해보세요.</span>}
                  {!rec1 && <span> — 피부 고민을 선택하면 더 정확한 성분을 추천해드릴 수 있어요.</span>}
                </div>
                <div className="muted" style={{fontSize:12, marginTop:14}}>
                  → .env에 ANTHROPIC_API_KEY를 설정하면 AI 개인화 설명이 생성됩니다.
                </div>
              </div>
            );
          })()}
        </div>
      )}

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
          <button className="btn btn-outline" onClick={() => {
            const prev = document.title;
            document.title = `피부 분석 리포트 ${new Date().toLocaleDateString('ko-KR')}`;
            window.print();
            document.title = prev;
          }}>📄 PDF 저장</button>
          <button className="btn btn-primary" onClick={onRestart}>
            <Icon name="sparkle" size={14} /> 새 분석 시작
          </button>
        </div>
      </div>
    </div>
  );
};

window.Results = Results;
