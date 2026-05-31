// Clinic: 피부과 시술 추천 페이지
const CLINIC_TREATMENTS = [
  { id: 'rejuran',      name: '리쥬란 힐러',   cat: '재생',    price: '15~30만원', desc: '연어DNA로 피부 재생 촉진' },
  { id: 'skin_booster', name: '스킨부스터',    cat: '보습',    price: '10~25만원', desc: '히알루론산 직접 주입 보습' },
  { id: 'aqua',         name: '물광주사',      cat: '보습',    price: '5~15만원',  desc: '수분·영양 주사로 광채 피부' },
  { id: 'botox',        name: '보톡스',        cat: '주름',    price: '3~10만원',  desc: '근육 이완으로 동적 주름 완화' },
  { id: 'filler',       name: '필러',          cat: '탄력',    price: '20~80만원', desc: '볼륨 보충 및 정적 주름 개선' },
  { id: 'petit_lift',   name: '쁘띠 리프팅',   cat: '탄력',    price: '30~80만원', desc: '실 삽입 비수술 리프팅' },
  { id: 'rf_lift',      name: '고주파 리프팅', cat: '탄력',    price: '20~60만원', desc: '고주파 열로 콜라겐 자극' },
  { id: 'laser_toning', name: '레이저 토닝',   cat: '미백',    price: '5~15만원',  desc: '저출력 레이저 멜라닌 분해' },
  { id: 'pico',         name: '피코 레이저',   cat: '색소',    price: '10~30만원', desc: '초단펄스 색소·잡티 제거' },
  { id: 'ipl',          name: 'IPL',           cat: '미백',    price: '10~20만원', desc: '다파장 광선 잡티·홍조 개선' },
  { id: 'pore_laser',   name: '모공 레이저',   cat: '모공',    price: '10~30만원', desc: '모공 수축 및 탄력 강화' },
  { id: 'acne_tx',      name: '여드름 치료',   cat: '여드름',  price: '5~20만원',  desc: '광치료·약물 여드름 관리' },
  { id: 'scaling',      name: '스케일링',      cat: '피부결',  price: '5~15만원',  desc: '각질 제거 피부결 개선' },
];

const BUDGET_OPTIONS = ['10만원 이하', '10~30만원', '30~50만원', '50~100만원', '100만원 이상'];

const CAT_STYLE = {
  '재생':   { bg: 'var(--good-soft)',   color: 'var(--good)' },
  '보습':   { bg: '#E8F0FB',            color: '#3B6DB5' },
  '주름':   { bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
  '탄력':   { bg: '#F0EAF8',            color: '#6B4DA8' },
  '미백':   { bg: '#FBF3E0',            color: '#A87820' },
  '색소':   { bg: '#FBF3E0',            color: '#A87820' },
  '모공':   { bg: 'var(--surface-2)',   color: 'var(--ink-muted)' },
  '여드름': { bg: 'var(--warn-soft)',   color: 'var(--warn)' },
  '피부결': { bg: 'var(--bg-2)',        color: 'var(--ink-2)' },
};

const Clinic = ({ analysisData, onGoAnalyze, authHeaders }) => {
  const [mode, setMode]       = React.useState('auto');
  const [selected, setSelected] = React.useState([]);
  const [budget, setBudget]   = React.useState('');
  const [agreed, setAgreed]   = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult]   = React.useState(null);
  const [error, setError]     = React.useState('');
  // #35/#36 면책 동의 모달 — 세션 내 최초 진입 시 1회만 표시
  const [showDisclaimer, setShowDisclaimer] = React.useState(
    !sessionStorage.getItem('clinic_agreed')
  );

  const hasReport = !!(analysisData && analysisData.attributes);

  const toggleTreatment = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleRecommend = async () => {
    setError('');
    if (!agreed)  { setError('이용 약관에 동의해 주세요.'); return; }
    if (!budget)  { setError('예산을 선택해 주세요.'); return; }
    if (mode === 'manual' && selected.length === 0) {
      setError('관심 시술을 하나 이상 선택해 주세요.'); return;
    }
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/clinic/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({
          mode,
          budget,
          selected_treatments: selected.map(id => CLINIC_TREATMENTS.find(t => t.id === id)?.name).filter(Boolean),
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

  // #36 면책 모달 렌더링
  if (showDisclaimer) {
    return (
      <div style={{
        position:'fixed', inset:0, background:'rgba(24,20,18,0.55)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:300,
      }}>
        <div className="card" style={{maxWidth:480, width:'90%', padding:32}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16}}>
            <Icon name="info" size={20} stroke={1.5}/>
            <h2 className="h2-serif" style={{margin:0}}>시술 정보 안내</h2>
          </div>
          <div style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.8, marginBottom:20}}>
            본 서비스의 피부과 시술 추천은 <strong>정보 제공 목적</strong>으로만 제공됩니다.
            의료법상 진단·처방 행위가 아니며, AI가 일반적인 시술 정보를 안내합니다.
            시술 여부와 적합성은 <strong>반드시 전문 피부과 의사와 상담</strong> 후 결정하시기 바랍니다.
          </div>
          <label style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:20}}>
            <input type="checkbox" id="clinic_agree_check" style={{width:16, height:16, accentColor:'var(--accent)'}}/>
            <span style={{fontSize:13, color:'var(--ink-2)'}}>위 내용을 이해했으며, 참고 목적으로만 활용합니다.</span>
          </label>
          <div style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
            <button className="btn btn-ghost" onClick={() => window.history.back()}>뒤로가기</button>
            <button className="btn btn-primary" onClick={() => {
              const cb = document.getElementById('clinic_agree_check');
              if (!cb || !cb.checked) { alert('동의 체크박스를 선택해주세요.'); return; }
              sessionStorage.setItem('clinic_agreed', '1');
              setShowDisclaimer(false);
            }}>
              동의하고 계속하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" data-screen-label="05 Clinic">

      {/* ── 배너 ── */}
      <div className="result-banner" style={{
        background: 'linear-gradient(135deg, #1E3050 0%, #2B4570 60%, #1A2E48 100%)',
      }}>
        <div>
          <div className="eyebrow" style={{color:'rgba(255,255,255,0.55)'}}>피부과 시술 · CLINIC</div>
          <div className="skin-type" style={{marginTop:6, color:'white'}}>
            <em>피부 상태 맞춤</em> 시술 추천
          </div>
          <div className="muted" style={{marginTop:8, fontSize:13, maxWidth:520, color:'rgba(255,255,255,0.6)'}}>
            분석 결과를 바탕으로 적합한 시술을 순서와 예산에 맞게 안내합니다.
            본 내용은 참고용 정보이며 최종 판단은 전문의와 상담하세요.
          </div>
          <div className="pill-row" style={{marginTop:14}}>
            {hasReport
              ? <span className="pill" style={{background:'rgba(255,255,255,0.15)', color:'white'}}>리포트 연동됨</span>
              : <span className="pill" style={{background:'rgba(255,180,80,0.3)', color:'#FFCC88'}}>리포트 없음 — 일반 추천</span>
            }
            <span className="pill" style={{background:'rgba(255,255,255,0.15)', color:'white'}}>AI 에이전트 추천</span>
          </div>
        </div>

        {/* 모드 스위치 */}
        <div style={{textAlign:'right'}}>
          <div className="eyebrow" style={{color:'rgba(255,255,255,0.45)', marginBottom:8}}>추천 방식</div>
          <div style={{display:'flex', gap:6}}>
            {[['auto','리포트 기반'],['manual','직접 선택']].map(([v,label]) => (
              <button key={v} onClick={() => { setMode(v); setResult(null); }}
                style={{
                  padding:'9px 18px', borderRadius:999, fontSize:12.5,
                  fontFamily:'var(--sans)', fontWeight:500, cursor:'pointer', border:'none',
                  background: mode===v ? 'white' : 'rgba(255,255,255,0.1)',
                  color:      mode===v ? 'var(--ink)' : 'rgba(255,255,255,0.65)',
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
          borderLeft:'3px solid var(--accent)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
        }}>
          <div>
            <div className="eyebrow" style={{marginBottom:4}}>리포트 연동 시 더 정확한 추천</div>
            <div style={{fontSize:13.5, color:'var(--ink-2)'}}>
              피부 분석 리포트가 있으면 피부 상태를 반영한 맞춤 시술을 추천해드립니다.
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
            {(analysisData.attributes || []).map((a,i) => (
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

      {/* ── MODULE 01: 직접 선택 (manual 모드) ── */}
      {mode === 'manual' && (
        <>
          <div className="section-head" style={{marginTop:28}}>
            <div>
              <div className="eyebrow">MODULE 01 · 관심 시술</div>
              <h2 className="h2-serif" style={{margin:'4px 0 0'}}>관심 있는 시술을 선택하세요</h2>
            </div>
            <span className="muted" style={{fontSize:12.5}}>
              {selected.length > 0 ? `${selected.length}개 선택됨` : '복수 선택 가능'}
            </span>
          </div>

          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(175px, 1fr))',
            gap:10, marginBottom:8,
          }}>
            {CLINIC_TREATMENTS.map(t => {
              const isSel = selected.includes(t.id);
              const cs = CAT_STYLE[t.cat] || {};
              return (
                <div key={t.id} onClick={() => toggleTreatment(t.id)} style={{
                  padding:'14px 16px', borderRadius:'var(--radius)',
                  border:'1.5px solid ' + (isSel ? 'var(--accent)' : 'var(--line)'),
                  background: isSel ? 'var(--accent-soft)' : 'var(--surface)',
                  cursor:'pointer', transition:'all 0.15s',
                  boxShadow: isSel ? '0 0 0 1.5px var(--accent)' : 'var(--shadow-sm)',
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <span style={{
                      fontSize:10.5, padding:'2px 8px', borderRadius:999,
                      background:cs.bg, color:cs.color, fontWeight:500,
                    }}>{t.cat}</span>
                    {isSel && (
                      <span style={{
                        width:17, height:17, borderRadius:'50%',
                        background:'var(--accent)', display:'flex',
                        alignItems:'center', justifyContent:'center', flexShrink:0,
                      }}>
                        <Icon name="check" size={10} stroke={2.5}/>
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontWeight:600, fontSize:14, marginBottom:4,
                    color: isSel ? 'var(--accent-ink)' : 'var(--ink)',
                  }}>{t.name}</div>
                  <div style={{fontSize:12, color:'var(--ink-muted)', lineHeight:1.45, marginBottom:6}}>
                    {t.desc}
                  </div>
                  <div style={{fontSize:11, fontFamily:'var(--mono)', color:'var(--ink-faint)'}}>
                    {t.price}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── 예산 ── */}
      <div className="section-head" style={{marginTop:28}}>
        <div>
          <div className="eyebrow">{mode==='manual' ? 'MODULE 02' : 'MODULE 01'} · 예산</div>
          <h2 className="h2-serif" style={{margin:'4px 0 0'}}>1회 방문 기준 예산</h2>
        </div>
      </div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
        {BUDGET_OPTIONS.map(b => (
          <button key={b} onClick={() => setBudget(b)} style={{
            padding:'10px 20px', borderRadius:999, fontSize:13,
            fontFamily:'var(--sans)', fontWeight:500, cursor:'pointer',
            border:'1.5px solid ' + (budget===b ? 'var(--accent)' : 'var(--line)'),
            background: budget===b ? 'var(--accent-soft)' : 'var(--surface)',
            color:      budget===b ? 'var(--accent-ink)'  : 'var(--ink-2)',
            boxShadow:  budget===b ? '0 0 0 1.5px var(--accent)' : 'var(--shadow-sm)',
            transition:'all 0.15s',
          }}>{b}</button>
        ))}
      </div>

      {/* ── 약관 ── */}
      <div style={{
        marginTop:28, padding:'20px 24px',
        background:'var(--surface-2)', borderRadius:'var(--radius)',
        border:'1px solid var(--line)',
      }}>
        <div style={{fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-muted)', letterSpacing:'0.05em', marginBottom:10}}>
          이용 안내 및 면책 조항
        </div>
        <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.8}}>
          본 시술 추천 서비스는 <strong>정보 제공 및 참고 목적</strong>으로만 제공됩니다.
          의료법상 시술 처방·진단 행위가 아니며, AI가 피부 상태 데이터를 바탕으로
          일반적인 시술 정보를 안내합니다.<br/>
          시술의 적합 여부, 부작용 여부, 최종 결정은 <strong>반드시 전문 피부과 의사와 상담</strong> 후 진행하시기 바랍니다.
          임신 중이거나 기저질환이 있는 경우 전문의와 먼저 상의하세요.<br/>
          본 서비스는 <strong>과시술 방지와 시술 순서 안내</strong>를 통해 사용자가 피부과와 더 친숙해지도록 돕는 데 목적이 있습니다.
        </div>
        <div
          onClick={() => setAgreed(!agreed)}
          style={{
            marginTop:14, display:'flex', alignItems:'center', gap:10, cursor:'pointer',
          }}
        >
          <div style={{
            width:20, height:20, borderRadius:5, flexShrink:0,
            border:'1.5px solid ' + (agreed ? 'var(--accent)' : 'var(--line)'),
            background: agreed ? 'var(--accent)' : 'white',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {agreed && <Icon name="check" size={11} stroke={2.5}/>}
          </div>
          <span style={{fontSize:13, color: agreed ? 'var(--ink)' : 'var(--ink-muted)', userSelect:'none'}}>
            위 내용을 이해했으며, 정보 참고 목적으로만 사용합니다.
          </span>
        </div>
      </div>

      {/* 오류 */}
      {error && (
        <div style={{
          marginTop:10, padding:'10px 16px', borderRadius:'var(--radius-sm)',
          background:'var(--warn-soft)', color:'var(--warn)', fontSize:13,
        }}>{error}</div>
      )}

      {/* 추천 버튼 */}
      <div style={{marginTop:20, display:'flex', justifyContent:'flex-end'}}>
        <button className="btn btn-primary" onClick={handleRecommend} disabled={loading}
          style={{padding:'12px 32px', fontSize:14, opacity: loading ? 0.75 : 1}}>
          {loading ? (
            <span style={{display:'flex', alignItems:'center', gap:8}}>
              <span className="spinner"/>
              AI 분석 중...
            </span>
          ) : (
            <><Icon name="sparkle" size={14}/> 시술 추천 받기</>
          )}
        </button>
      </div>

      {/* ── 결과 ── */}
      {result && (
        <>
          <div className="section-head" style={{marginTop:40}}>
            <div>
              <div className="eyebrow">AI 추천 결과 · RECOMMENDATION</div>
              <h2 className="h2-serif" style={{margin:'4px 0 0'}}>맞춤 피부과 시술 플랜</h2>
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
                background:'var(--accent-soft)', color:'var(--accent-ink)',
                fontSize:11, marginBottom:14,
              }}>
                <Icon name="sparkle" size={11}/> Claude AI 종합 소견
              </div>
              <div style={{
                fontFamily:'var(--serif-ko)', fontSize:16.5,
                lineHeight:1.85, color:'var(--ink)',
              }}>
                {result.summary}
              </div>
            </div>
          )}

          {/* 추천 시술 카드 */}
          {result.treatments && result.treatments.length > 0 && (
            <div style={{display:'flex', flexDirection:'column', gap:12, marginBottom:16}}>
              {result.treatments.map((t, i) => (
                <div key={i} className="card" style={{
                  padding:'20px 24px',
                  borderLeft:'3px solid ' + (i===0 ? 'var(--accent)' : i===1 ? 'var(--good)' : 'var(--ink-faint)'),
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
                        <span style={{
                          width:26, height:26, borderRadius:'50%', flexShrink:0,
                          background: i===0 ? 'var(--accent)' : i===1 ? 'var(--good)' : 'var(--bg-2)',
                          color: i<2 ? 'white' : 'var(--ink-muted)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:'var(--mono)', fontSize:11, fontWeight:600,
                        }}>{i+1}</span>
                        <span style={{fontWeight:600, fontSize:16}}>{t.name}</span>
                        {t.priority && (
                          <span style={{
                            fontSize:10.5, padding:'2px 9px', borderRadius:999,
                            background: i===0 ? 'var(--accent-soft)' : 'var(--good-soft)',
                            color:      i===0 ? 'var(--accent-ink)'  : 'var(--good)',
                          }}>{t.priority}</span>
                        )}
                      </div>
                      <div style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.7, marginBottom:12}}>
                        {t.reason}
                      </div>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                        {t.effect && (
                          <div style={{
                            padding:'9px 12px', borderRadius:8,
                            background:'var(--good-soft)', fontSize:12.5, color:'var(--good)', lineHeight:1.5,
                          }}>
                            <div style={{fontWeight:600, marginBottom:3}}>기대 효과</div>
                            {t.effect}
                          </div>
                        )}
                        {t.caution && (
                          <div style={{
                            padding:'9px 12px', borderRadius:8,
                            background:'var(--warn-soft)', fontSize:12.5, color:'var(--warn)', lineHeight:1.5,
                          }}>
                            <div style={{fontWeight:600, marginBottom:3}}>주의사항</div>
                            {t.caution}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0, paddingTop:4}}>
                      <div style={{fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-muted)', marginBottom:4}}>예상 가격</div>
                      <div style={{fontWeight:600, fontSize:15}}>{t.price_range}</div>
                      {t.interval && (
                        <div style={{fontSize:11.5, color:'var(--ink-muted)', marginTop:4}}>{t.interval}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 시술 순서 플랜 */}
          {result.order_plan && (
            <div className="card" style={{padding:'22px 26px', marginBottom:16}}>
              <div className="eyebrow" style={{marginBottom:10}}>권장 시술 순서 · ORDER PLAN</div>
              <div style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.85}}>
                {result.order_plan}
              </div>
            </div>
          )}

          {/* 차후 관리 */}
          {result.aftercare && result.aftercare.length > 0 && (
            <>
              <div className="section-head" style={{marginTop:28}}>
                <div>
                  <div className="eyebrow">시술 후 관리</div>
                  <h2 className="h2-serif" style={{margin:'4px 0 0'}}>차후 관리 · 주의사항</h2>
                </div>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
                {result.aftercare.map((tip, i) => (
                  <div key={i} style={{
                    display:'grid', gridTemplateColumns:'32px 1fr', gap:14,
                    alignItems:'flex-start', padding:'14px 18px',
                    background:'var(--surface)', borderRadius:'var(--radius-sm)',
                    border:'1px solid var(--line-2)',
                  }}>
                    <span style={{
                      width:28, height:28, borderRadius:'50%',
                      background:'var(--surface-2)', border:'1px solid var(--line)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-muted)',
                      flexShrink:0,
                    }}>{i+1}</span>
                    <span style={{fontSize:13.5, color:'var(--ink-2)', lineHeight:1.65}}>{tip}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 면책 재고지 */}
          <div style={{
            marginTop:24, padding:'14px 20px',
            background:'var(--bg-2)', borderRadius:'var(--radius-sm)',
            fontSize:12, color:'var(--ink-muted)', lineHeight:1.7,
          }}>
            ※ 본 내용은 AI가 생성한 참고 정보입니다. 시술 여부는 반드시 전문 피부과 의사와 상담 후 결정하시기 바랍니다.
            개인의 건강 상태·알레르기·시술 이력에 따라 결과가 다를 수 있습니다.
          </div>
        </>
      )}

      <div style={{height:40}}/>
    </div>
  );
};

window.Clinic = Clinic;
