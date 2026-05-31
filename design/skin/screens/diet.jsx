// Diet: 피부 맞춤 식단 추천 페이지

const FOOD_ITEMS = [
  // ── 주의 식품 ──
  { id: 'sugar',     name: '단것·설탕류',    cat: '혈당', desc: '과자·단 음료·디저트 자주 섭취' },
  { id: 'dairy',     name: '유제품',          cat: '주의', desc: '우유·치즈·아이스크림 자주 섭취' },
  { id: 'r_carbs',   name: '정제 탄수화물',  cat: '혈당', desc: '흰쌀·흰밀·빵 위주 식단' },
  { id: 'alcohol',   name: '음주',            cat: '주의', desc: '주 1회 이상 음주' },
  { id: 'caffeine',  name: '카페인 과다',     cat: '주의', desc: '커피·에너지음료 하루 2잔 이상' },
  { id: 'spicy',     name: '매운 음식',       cat: '자극', desc: '매운 양념 자주 섭취' },
  { id: 'processed', name: '가공·패스트푸드', cat: '주의', desc: '인스턴트·배달 음식 자주 섭취' },
  // ── 권장 식품 ──
  { id: 'vegetables',name: '채소·나물',       cat: '권장', desc: '매 끼니 채소 충분히 섭취' },
  { id: 'fruits',    name: '신선 과일',        cat: '권장', desc: '매일 과일 1회 이상 섭취' },
  { id: 'fish',      name: '생선·해산물',      cat: '권장', desc: '주 2회 이상 생선 섭취' },
  { id: 'fermented', name: '발효식품',          cat: '장건강',desc: '김치·된장·요거트 매일 섭취' },
  { id: 'water',     name: '물 충분 섭취',      cat: '권장', desc: '하루 6잔(1.5L) 이상 수분 섭취' },
  { id: 'nuts',      name: '견과류·씨앗',       cat: '권장', desc: '아몬드·호두 등 매일 한 줌' },
  { id: 'protein',   name: '달걀·두부·육류',    cat: '권장', desc: '단백질 매끼 충분히 섭취' },
];

const FOOD_CAT_STYLE = {
  '혈당':  { bg: 'var(--warn-soft)',  color: 'var(--warn)' },
  '주의':  { bg: 'var(--warn-soft)',  color: '#8A3B26' },
  '자극':  { bg: '#FBF3E0',           color: '#A87820' },
  '권장':  { bg: 'var(--good-soft)',  color: 'var(--good)' },
  '장건강':{ bg: '#E8F0FB',           color: '#3B6DB5' },
};

const WATER_OPTIONS  = ['부족 (4잔 미만)', '보통 (4-6잔)', '충분 (6잔 이상)'];
const MEAL_OPTIONS   = ['1끼', '2끼', '3끼', '불규칙'];

const Diet = ({ analysisData, onGoAnalyze, authHeaders }) => {
  const [mode, setMode]         = React.useState('auto');
  const [selected, setSelected] = React.useState([]);
  const [water, setWater]       = React.useState('');
  const [mealFreq, setMealFreq] = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const [result, setResult]     = React.useState(null);
  const [error, setError]       = React.useState('');

  const hasReport = !!(analysisData && analysisData.attributes);

  const toggleFood = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleRecommend = async () => {
    setError('');
    if (mode === 'manual' && selected.length === 0) {
      setError('식품을 하나 이상 선택해주세요.'); return;
    }
    setLoading(true); setResult(null);
    try {
      const selectedNames = selected.map(id => FOOD_ITEMS.find(f => f.id === id)?.name).filter(Boolean);
      const res = await fetch('/api/diet/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({
          mode,
          selected_foods: selectedNames,
          water_intake: water,
          meal_freq: mealFreq,
          analysis_data: analysisData || null,
        }),
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch {
      setError('추천 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" data-screen-label="06 Diet">

      {/* ── 배너 ── */}
      <div className="result-banner" style={{
        background: 'radial-gradient(80% 60% at 85% 30%, #C8E8B0 0%, transparent 55%), linear-gradient(120deg, #E8F2DE, #C5D9AD)',
      }}>
        <div>
          <div className="eyebrow" style={{color:'rgba(28,58,18,0.6)'}}>피부 식단 · DIET</div>
          <div className="skin-type" style={{marginTop:6}}>
            <em>피부에 좋은</em> 식단 추천
          </div>
          <div className="muted" style={{marginTop:8, fontSize:13, maxWidth:520}}>
            분석 리포트를 바탕으로 피부와 장 건강에 도움되는 식사를 안내합니다.
            식품 정보는 참고용이며 개인 건강 상태에 따라 다를 수 있습니다.
          </div>
          <div className="pill-row" style={{marginTop:14}}>
            {hasReport
              ? <span className="pill" style={{background:'rgba(28,80,18,0.12)', color:'#224018'}}>리포트 연동됨</span>
              : <span className="pill" style={{background:'rgba(180,130,0,0.15)', color:'#7A5800'}}>리포트 없음 — 일반 추천</span>
            }
            <span className="pill" style={{background:'rgba(28,80,18,0.12)', color:'#224018'}}>Claude AI 추천</span>
          </div>
        </div>

        {/* 모드 스위치 */}
        <div style={{textAlign:'right'}}>
          <div className="eyebrow" style={{color:'rgba(28,58,18,0.5)', marginBottom:8}}>추천 방식</div>
          <div style={{display:'flex', gap:6}}>
            {[['auto','리포트 기반'],['manual','식단 입력']].map(([v,label]) => (
              <button key={v} onClick={() => { setMode(v); setResult(null); setSelected([]); }}
                style={{
                  padding:'9px 18px', borderRadius:999, fontSize:12.5,
                  fontFamily:'var(--sans)', fontWeight:500, cursor:'pointer', border:'none',
                  background: mode===v ? 'white' : 'rgba(255,255,255,0.5)',
                  color:      mode===v ? 'var(--ink)' : 'rgba(28,58,18,0.65)',
                  transition:'all 0.15s',
                }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 리포트 없음 안내 ── */}
      {!hasReport && (
        <div className="card" style={{
          marginTop:20, padding:'18px 24px',
          borderLeft:'3px solid var(--good)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
        }}>
          <div>
            <div className="eyebrow" style={{marginBottom:4}}>리포트 연동 시 더 정확한 추천</div>
            <div style={{fontSize:13.5, color:'var(--ink-2)'}}>
              피부 분석 리포트가 있으면 피부 타입에 맞는 식재료와 영양소를 맞춤 추천해드립니다.
            </div>
          </div>
          <button className="btn btn-outline" style={{flexShrink:0}} onClick={onGoAnalyze}>
            분석 시작 <Icon name="arrowRight" size={13}/>
          </button>
        </div>
      )}

      {/* ── 피부 상태 요약 (리포트 있을 때) ── */}
      {hasReport && (
        <>
          <div className="section-head" style={{marginTop:28}}>
            <div>
              <div className="eyebrow">현재 피부 상태</div>
              <h2 className="h2-serif" style={{margin:'4px 0 0'}}>분석 리포트 기반</h2>
            </div>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:4}}>
            {(analysisData.attributes || []).map((a, i) => (
              <div key={i} style={{
                padding:'7px 14px', borderRadius:999, fontSize:12.5,
                background: a.level==='hi' ? 'var(--warn-soft)' : a.level==='lo' ? 'var(--good-soft)' : 'var(--bg-2)',
                color:      a.level==='hi' ? 'var(--warn)'      : a.level==='lo' ? 'var(--good)'      : 'var(--ink-muted)',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <span style={{fontWeight:600}}>{a.name}</span>
                <span style={{fontFamily:'var(--mono)', fontSize:11}}>{a.value}</span>
                <span style={{fontSize:10, opacity:0.7}}>
                  {a.level==='hi' ? '▲' : a.level==='lo' ? '▽' : '─'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── MODULE 01: 식품 선택 (manual) ── */}
      {mode === 'manual' && (
        <>
          <div className="section-head" style={{marginTop:28}}>
            <div>
              <div className="eyebrow">MODULE 01 · 식품 선택</div>
              <h2 className="h2-serif" style={{margin:'4px 0 0'}}>자주 먹는 음식을 선택하세요</h2>
            </div>
            <span className="muted" style={{fontSize:12.5}}>
              {selected.length > 0 ? `${selected.length}개 선택됨` : '복수 선택 가능'}
            </span>
          </div>

          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(172px, 1fr))',
            gap:10, marginBottom:8,
          }}>
            {FOOD_ITEMS.map(f => {
              const isSel  = selected.includes(f.id);
              const cs     = FOOD_CAT_STYLE[f.cat] || {};
              const isWarn = ['혈당','주의','자극'].includes(f.cat);
              return (
                <div key={f.id} onClick={() => toggleFood(f.id)} style={{
                  padding:'14px 16px', borderRadius:'var(--radius)',
                  border:'1.5px solid ' + (isSel ? (isWarn ? 'var(--warn)' : 'var(--good)') : 'var(--line)'),
                  background: isSel ? (isWarn ? 'var(--warn-soft)' : 'var(--good-soft)') : 'var(--surface)',
                  cursor:'pointer', transition:'all 0.15s',
                  boxShadow: isSel ? ('0 0 0 1.5px ' + (isWarn ? 'var(--warn)' : 'var(--good)')) : 'var(--shadow-sm)',
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <span style={{
                      fontSize:10.5, padding:'2px 8px', borderRadius:999,
                      background:cs.bg, color:cs.color, fontWeight:500,
                    }}>{f.cat}</span>
                    {isSel && (
                      <span style={{
                        width:17, height:17, borderRadius:'50%', flexShrink:0,
                        background: isWarn ? 'var(--warn)' : 'var(--good)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <Icon name="check" size={10} stroke={2.5}/>
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontWeight:600, fontSize:14, marginBottom:4,
                    color: isSel ? (isWarn ? 'var(--warn)' : 'var(--good)') : 'var(--ink)',
                  }}>{f.name}</div>
                  <div style={{fontSize:12, color:'var(--ink-muted)', lineHeight:1.45}}>
                    {f.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── 수분 / 식사 횟수 ── */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginTop:28}}>
        <div>
          <div className="section-head" style={{marginBottom:10}}>
            <div>
              <div className="eyebrow">{mode==='manual' ? 'MODULE 02' : 'MODULE 01'} · 수분 섭취</div>
              <h2 className="h2-serif" style={{margin:'4px 0 0'}}>하루 물 섭취량</h2>
            </div>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {WATER_OPTIONS.map(w => (
              <button key={w} onClick={() => setWater(w)} style={{
                padding:'10px 16px', borderRadius:999, fontSize:12.5,
                fontFamily:'var(--sans)', fontWeight:500, cursor:'pointer',
                border:'1.5px solid ' + (water===w ? 'var(--good)' : 'var(--line)'),
                background: water===w ? 'var(--good-soft)' : 'var(--surface)',
                color:      water===w ? 'var(--good)'      : 'var(--ink-2)',
                boxShadow:  water===w ? '0 0 0 1.5px var(--good)' : 'var(--shadow-sm)',
                transition:'all 0.15s',
              }}>{w}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-head" style={{marginBottom:10}}>
            <div>
              <div className="eyebrow">{mode==='manual' ? 'MODULE 03' : 'MODULE 02'} · 식사 패턴</div>
              <h2 className="h2-serif" style={{margin:'4px 0 0'}}>하루 식사 횟수</h2>
            </div>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {MEAL_OPTIONS.map(m => (
              <button key={m} onClick={() => setMealFreq(m)} style={{
                padding:'10px 16px', borderRadius:999, fontSize:12.5,
                fontFamily:'var(--sans)', fontWeight:500, cursor:'pointer',
                border:'1.5px solid ' + (mealFreq===m ? 'var(--accent)' : 'var(--line)'),
                background: mealFreq===m ? 'var(--accent-soft)' : 'var(--surface)',
                color:      mealFreq===m ? 'var(--accent-ink)'  : 'var(--ink-2)',
                boxShadow:  mealFreq===m ? '0 0 0 1.5px var(--accent)' : 'var(--shadow-sm)',
                transition:'all 0.15s',
              }}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 오류 */}
      {error && (
        <div style={{
          marginTop:12, padding:'10px 16px', borderRadius:'var(--radius-sm)',
          background:'var(--warn-soft)', color:'var(--warn)', fontSize:13,
        }}>{error}</div>
      )}

      {/* 추천 버튼 */}
      <div style={{marginTop:24, display:'flex', justifyContent:'flex-end'}}>
        <button className="btn btn-primary" onClick={handleRecommend} disabled={loading}
          style={{padding:'12px 32px', fontSize:14, opacity: loading ? 0.75 : 1}}>
          {loading ? (
            <span style={{display:'flex', alignItems:'center', gap:8}}>
              <span className="spinner"/>
              AI 분석 중...
            </span>
          ) : (
            <><Icon name="leaf" size={14}/> 식단 추천 받기</>
          )}
        </button>
      </div>

      {/* ════════════════ 결과 ════════════════ */}
      {result && (
        <>
          <div className="section-head" style={{marginTop:40}}>
            <div>
              <div className="eyebrow">AI 추천 결과 · DIET PLAN</div>
              <h2 className="h2-serif" style={{margin:'4px 0 0'}}>
                {mode === 'auto' ? '피부 맞춤 식단 플랜' : '내 식단 피부 영향 분석'}
              </h2>
            </div>
            <span className="pill" style={{background:'var(--good-soft)', color:'var(--good)'}}>AI 생성 완료</span>
          </div>

          {/* 종합 소견 */}
          {result.summary && (
            <div className="card" style={{
              padding:26, marginBottom:16,
              background:'linear-gradient(160deg,var(--surface-2),var(--surface))',
            }}>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'3px 12px', borderRadius:20,
                background:'var(--good-soft)', color:'var(--good)',
                fontSize:11, marginBottom:14,
              }}>
                <Icon name="sparkle" size={11}/> Claude AI 식단 분석
              </div>
              <div style={{fontFamily:'var(--serif-ko)', fontSize:16.5, lineHeight:1.85, color:'var(--ink)'}}>
                {result.summary}
              </div>
            </div>
          )}

          {/* ── 리포트 기반 결과 ── */}
          {mode === 'auto' && (
            <>
              {/* 권장 식품 */}
              {result.recommended_foods && result.recommended_foods.length > 0 && (
                <>
                  <div style={{
                    display:'flex', alignItems:'center', gap:8, marginBottom:12,
                    fontFamily:'var(--mono)', fontSize:11.5, color:'var(--good)', letterSpacing:'0.06em',
                  }}>
                    <Icon name="leaf" size={13}/> RECOMMEND · 권장 식품
                  </div>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fill, minmax(230px, 1fr))',
                    gap:12, marginBottom:24,
                  }}>
                    {result.recommended_foods.map((f, i) => (
                      <div key={i} className="card" style={{
                        padding:'18px 20px',
                        borderLeft:'3px solid var(--good)',
                        background:'linear-gradient(160deg,var(--good-soft),var(--surface))',
                      }}>
                        <div style={{fontWeight:600, fontSize:15, color:'var(--ink)', marginBottom:6}}>{f.name}</div>
                        {f.nutrient && (
                          <span style={{
                            fontSize:10.5, padding:'2px 9px', borderRadius:999,
                            background:'rgba(91,117,83,0.15)', color:'var(--good)',
                            fontWeight:500, display:'inline-block', marginBottom:8,
                          }}>{f.nutrient}</span>
                        )}
                        <div style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.6, marginBottom:8}}>{f.benefit}</div>
                        {f.tip && (
                          <div style={{
                            fontSize:12, color:'var(--good)', padding:'6px 10px',
                            background:'rgba(91,117,83,0.08)', borderRadius:6,
                            display:'flex', alignItems:'flex-start', gap:5,
                          }}>
                            <Icon name="arrowRight" size={11}/>
                            <span>{f.tip}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 피해야 할 식품 */}
              {result.avoid_foods && result.avoid_foods.length > 0 && (
                <>
                  <div style={{
                    display:'flex', alignItems:'center', gap:8, marginBottom:12,
                    fontFamily:'var(--mono)', fontSize:11.5, color:'var(--warn)', letterSpacing:'0.06em',
                  }}>
                    <Icon name="cross" size={13}/> AVOID · 주의 식품
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:24}}>
                    {result.avoid_foods.map((f, i) => (
                      <div key={i} style={{
                        display:'grid', gridTemplateColumns:'1fr auto',
                        gap:16, padding:'14px 18px', alignItems:'center',
                        background:'var(--surface)', borderRadius:'var(--radius-sm)',
                        border:'1px solid var(--line-2)', borderLeft:'3px solid var(--warn)',
                      }}>
                        <div>
                          <div style={{fontWeight:600, fontSize:14, color:'var(--ink)', marginBottom:4}}>{f.name}</div>
                          <div style={{fontSize:13, color:'var(--ink-muted)', lineHeight:1.5}}>{f.reason}</div>
                        </div>
                        {f.alternative && (
                          <div style={{
                            fontSize:11.5, padding:'6px 12px', borderRadius:999,
                            background:'var(--good-soft)', color:'var(--good)',
                            whiteSpace:'nowrap', textAlign:'center', flexShrink:0,
                          }}>
                            대신 → {f.alternative}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 끼니별 팁 */}
              {result.daily_tips && result.daily_tips.length > 0 && (
                <>
                  <div className="section-head" style={{marginTop:8}}>
                    <div>
                      <div className="eyebrow">하루 식단 가이드</div>
                      <h2 className="h2-serif" style={{margin:'4px 0 0'}}>끼니별 추천 팁</h2>
                    </div>
                  </div>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',
                    gap:12, marginBottom:20,
                  }}>
                    {result.daily_tips.map((tip, i) => (
                      <div key={i} className="card" style={{padding:'18px 20px'}}>
                        <div style={{
                          fontFamily:'var(--mono)', fontSize:10.5, color:'var(--ink-muted)',
                          letterSpacing:'0.08em', marginBottom:8,
                        }}>
                          {['MORNING', 'AFTERNOON', 'EVENING'][i] || `TIP ${i+1}`}
                        </div>
                        <div style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.65}}>{tip}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── 식단 입력 결과 ── */}
          {mode === 'manual' && (
            <>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
                {/* 긍정 영향 */}
                {result.positive_impacts && result.positive_impacts.length > 0 && (
                  <div className="card" style={{
                    padding:20,
                    background:'linear-gradient(180deg,var(--good-soft),var(--surface) 50%)',
                    border:'1px solid rgba(91,117,83,0.2)',
                  }}>
                    <div className="eyebrow" style={{color:'var(--good)', marginBottom:10}}>GOOD · 피부에 도움</div>
                    <div style={{display:'flex', flexDirection:'column', gap:10}}>
                      {result.positive_impacts.map((p, i) => (
                        <div key={i} style={{
                          display:'flex', gap:10, alignItems:'flex-start',
                          paddingBottom:10,
                          borderBottom: i < result.positive_impacts.length-1 ? '1px dashed var(--line-2)' : 'none',
                        }}>
                          <span style={{
                            width:22, height:22, borderRadius:'50%', flexShrink:0,
                            background:'var(--good)', color:'white',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}><Icon name="check" size={11} stroke={2.5}/></span>
                          <div>
                            <div style={{fontWeight:600, fontSize:13.5, color:'var(--ink)', marginBottom:3}}>{p.food}</div>
                            <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5}}>{p.benefit}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 부정 영향 */}
                {result.negative_impacts && result.negative_impacts.length > 0 && (
                  <div className="card" style={{
                    padding:20,
                    background:'linear-gradient(180deg,var(--warn-soft),var(--surface) 50%)',
                    border:'1px solid rgba(168,80,51,0.2)',
                  }}>
                    <div className="eyebrow" style={{color:'var(--warn)', marginBottom:10}}>CAUTION · 주의 필요</div>
                    <div style={{display:'flex', flexDirection:'column', gap:10}}>
                      {result.negative_impacts.map((n, i) => (
                        <div key={i} style={{
                          paddingBottom:10,
                          borderBottom: i < result.negative_impacts.length-1 ? '1px dashed var(--line-2)' : 'none',
                        }}>
                          <div style={{display:'flex', gap:10, alignItems:'flex-start', marginBottom:6}}>
                            <span style={{
                              width:22, height:22, borderRadius:'50%', flexShrink:0,
                              background:'var(--warn)', color:'white',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }}><Icon name="cross" size={10} stroke={2}/></span>
                            <div>
                              <div style={{fontWeight:600, fontSize:13.5, color:'var(--ink)', marginBottom:3}}>{n.food}</div>
                              <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5}}>{n.risk}</div>
                            </div>
                          </div>
                          {n.tip && (
                            <div style={{
                              marginLeft:32, fontSize:12, color:'var(--good)',
                              padding:'5px 10px', background:'var(--good-soft)', borderRadius:6,
                            }}>
                              → {n.tip}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 개선 제안 */}
              {result.improvements && result.improvements.length > 0 && (
                <>
                  <div className="section-head" style={{marginTop:8}}>
                    <div>
                      <div className="eyebrow">개선 제안</div>
                      <h2 className="h2-serif" style={{margin:'4px 0 0'}}>지금 바로 실천할 것들</h2>
                    </div>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
                    {result.improvements.map((tip, i) => (
                      <div key={i} style={{
                        display:'grid', gridTemplateColumns:'28px 1fr', gap:14,
                        alignItems:'flex-start', padding:'13px 18px',
                        background:'var(--surface)', borderRadius:'var(--radius-sm)',
                        border:'1px solid var(--line-2)',
                      }}>
                        <span style={{
                          width:24, height:24, borderRadius:'50%',
                          background: i===0 ? 'var(--accent)' : i===1 ? 'var(--good)' : 'var(--bg-2)',
                          color: i<2 ? 'white' : 'var(--ink-muted)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:'var(--mono)', fontSize:11, fontWeight:600, flexShrink:0,
                        }}>{i+1}</span>
                        <span style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.65}}>{tip}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 레시피 팁 */}
              {result.recipe_tip && (
                <div className="card" style={{
                  padding:'20px 24px', marginBottom:16,
                  background:'linear-gradient(160deg,var(--good-soft),var(--surface))',
                  border:'1px solid rgba(91,117,83,0.2)',
                }}>
                  <div style={{
                    fontFamily:'var(--mono)', fontSize:11, color:'var(--good)',
                    letterSpacing:'0.06em', marginBottom:8,
                  }}>RECIPE TIP</div>
                  <div style={{fontFamily:'var(--serif-ko)', fontSize:15, lineHeight:1.8, color:'var(--ink)'}}>
                    {result.recipe_tip}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 장 건강 팁 (공통) */}
          {result.gut_tip && (
            <div style={{
              padding:'18px 22px', borderRadius:'var(--radius)',
              background:'#E8F0FB', border:'1px solid rgba(59,109,181,0.18)',
              marginBottom:16,
            }}>
              <div style={{
                display:'flex', alignItems:'center', gap:8, marginBottom:8,
                fontFamily:'var(--mono)', fontSize:11, color:'#3B6DB5', letterSpacing:'0.06em',
              }}>
                <Icon name="flask" size={13}/> 장 건강 · GUT HEALTH
              </div>
              <div style={{fontSize:13.5, color:'#2A4A8C', lineHeight:1.75}}>{result.gut_tip}</div>
            </div>
          )}

          {/* 면책 */}
          <div style={{
            padding:'14px 20px', background:'var(--bg-2)',
            borderRadius:'var(--radius-sm)', fontSize:12,
            color:'var(--ink-muted)', lineHeight:1.7,
          }}>
            ※ 본 식단 추천은 AI가 생성한 참고 정보입니다. 개인 건강 상태·알레르기·기저질환에 따라 결과가 다를 수 있으며,
            특정 식이 문제가 있다면 영양 전문가와 상담하시기 바랍니다.
          </div>
        </>
      )}

      <div style={{height:40}}/>
    </div>
  );
};

window.Diet = Diet;
