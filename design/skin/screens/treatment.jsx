// Treatment: 피부과 시술 전용 탭 — 풀 리디자인

// 분석 없이도 볼 수 있는 전체 시술 카탈로그 (Fallback용)
const FULL_CATALOG = [
  {
    id: "rejuran", name: "리쥬란 힐러", category: "스킨부스터",
    emoji: "💉",
    description: "연어 DNA 추출 PN 성분 주사로 피부 장벽을 강화하고 속건조를 해결합니다. 재생 효과가 뛰어나 민감한 피부에도 안전합니다.",
    target_concerns: ["속건조 해결", "피부 장벽 강화", "주름 개선"],
    is_safe_for_sensitive: true, price_range: "20~40만원",
    price_bracket: "스탠다드 (10~30만원)", price_level: 1,
    downtime: "당일 시술 후 바로 일상 가능", downtime_level: 0,
    pain_level: "따끔함 (마취 크림 사용)", cycle: "3~4주 간격, 3회 세트", match_score: 0,
  },
  {
    id: "ldm", name: "LDM 물방울 리프팅", category: "리프팅/진정",
    emoji: "💧",
    description: "고밀도 초음파 에너지로 피부 속 수분을 끌어올리고 민감한 피부를 진정시킵니다. 비침습으로 즉각적 효과를 경험할 수 있습니다.",
    target_concerns: ["속건조 해결", "탄력 개선", "피부 장벽 강화"],
    is_safe_for_sensitive: true, price_range: "5~15만원",
    price_bracket: "가성비 (10만원 이하)", price_level: 0,
    downtime: "당일 화장 가능, 즉시 일상복귀", downtime_level: 0,
    pain_level: "거의 없음", cycle: "주 1~2회, 4~8회", match_score: 0,
  },
  {
    id: "ultherapy", name: "울쎄라 리프팅", category: "리프팅",
    emoji: "⚡",
    description: "고강도 집속 초음파(HIFU)를 근막층까지 전달해 처진 피부를 강력하게 끌어올립니다. 1회 시술로 6~12개월 효과가 지속됩니다.",
    target_concerns: ["탄력 개선", "주름 개선"],
    is_safe_for_sensitive: false, price_range: "80~150만원",
    price_bracket: "프리미엄 (30만원 이상)", price_level: 2,
    downtime: "2~3일 붉은기, 당일 일상 가능", downtime_level: 1,
    pain_level: "강한 통증 (마취 필수)", cycle: "6개월~1년 1회", match_score: 0,
  },
  {
    id: "picotoning", name: "피코 토닝", category: "레이저",
    emoji: "✨",
    description: "기존 레이저보다 1000배 빠른 속도로 에너지를 조사하여 기미·잡티·색소침착을 부수어 배출합니다. 회복이 빠릅니다.",
    target_concerns: ["색소 침착", "잡티 제거"],
    is_safe_for_sensitive: false, price_range: "5~15만원",
    price_bracket: "가성비 (10만원 이하)", price_level: 0,
    downtime: "1~2일 붉은기", downtime_level: 1,
    pain_level: "따끔거림 (마취 크림 선택)", cycle: "2~3주 간격, 5~8회", match_score: 0,
  },
  {
    id: "fraxel", name: "프락셀 레이저", category: "레이저",
    emoji: "🔬",
    description: "피부에 미세한 구멍을 뚫어 새살이 돋아나게 함으로써 넓은 모공과 흉터를 개선합니다. 피부 결이 전반적으로 매끄러워집니다.",
    target_concerns: ["모공 축소", "흉터 개선"],
    is_safe_for_sensitive: false, price_range: "10~25만원",
    price_bracket: "스탠다드 (10~30만원)", price_level: 1,
    downtime: "3~5일 (붉은기, 각질, 부종 가능)", downtime_level: 2,
    pain_level: "강한 따끔거림 (마취 크림 필수)", cycle: "4~6주 간격, 3~5회", match_score: 0,
  },
  {
    id: "botox", name: "주름 보톡스", category: "주사시술",
    emoji: "💊",
    description: "표정 근육 움직임을 일시적으로 마비시켜 이마·미간·눈가의 표정 주름을 개선합니다. 빠른 효과와 짧은 회복 기간이 장점입니다.",
    target_concerns: ["주름 개선"],
    is_safe_for_sensitive: true, price_range: "3~10만원",
    price_bracket: "가성비 (10만원 이하)", price_level: 0,
    downtime: "당일 세안/화장 가능", downtime_level: 0,
    pain_level: "따끔함 (매우 짧음)", cycle: "3~6개월 1회", match_score: 0,
  },
  {
    id: "aqua_peel", name: "아쿠아필", category: "스킨케어",
    emoji: "🌊",
    description: "모공 속 피지와 노폐물을 부드럽게 녹여내고 수분을 채워줍니다. 블랙헤드와 유분 관리에 탁월하며 민감성 피부도 가능합니다.",
    target_concerns: ["모공 축소", "피부 장벽 강화"],
    is_safe_for_sensitive: true, price_range: "3~8만원",
    price_bracket: "가성비 (10만원 이하)", price_level: 0,
    downtime: "당일 즉시 일상복귀", downtime_level: 0,
    pain_level: "없음", cycle: "2~4주 1회", match_score: 0,
  },
];

// 카테고리별 색상
const CATEGORY_STYLE = {
  "스킨부스터": { bg: "#E8F4FD", color: "#1D6FA4", border: "#90CAF9" },
  "리프팅/진정": { bg: "#E8F5E9", color: "#2E7D32", border: "#A5D6A7" },
  "리프팅": { bg: "#E8F5E9", color: "#2E7D32", border: "#A5D6A7" },
  "레이저": { bg: "#FFF3E0", color: "#E65100", border: "#FFCC80" },
  "주사시술": { bg: "#F3E5F5", color: "#6A1B9A", border: "#CE93D8" },
  "스킨케어": { bg: "#E0F2F1", color: "#00695C", border: "#80CBC4" },
};

const DOWNTIME_INFO = {
  0: { label: "당일 복귀", color: "#2E7D32", bg: "#E8F5E9", icon: "🟢" },
  1: { label: "2~3일", color: "#E65100", bg: "#FFF3E0", icon: "🟡" },
  2: { label: "1주일+", color: "#B71C1C", bg: "#FFEBEE", icon: "🔴" },
};

const Treatment = ({ data, user, onHome }) => {
  const [filterConcern, setFilterConcern] = React.useState('전체');
  const [filterPrice, setFilterPrice] = React.useState('전체');
  const [filterDown, setFilterDown] = React.useState('전체');
  const [sortBy, setSortBy] = React.useState('추천순');
  const [expanded, setExpanded] = React.useState(null);

  const rawProcedures = data ? (data.procedures || []) : [];
  const hasAnalysis = rawProcedures.length > 0;

  // "3~8만원" 등에서 최소, 최대 가격 추출
  const parsePrices = (p) => {
    const nums = ((p.price_range || '').match(/\d+/g) || []).map(Number);
    return { min: nums[0] ?? 999, max: nums[1] ?? (nums[0] ?? 999) };
  };

  // 정렬 함수
  const sortFn = (a, b) => {
    const aP = a.price_level ?? 1;
    const bP = b.price_level ?? 1;
    const aD = a.downtime_level ?? 1;
    const bD = b.downtime_level ?? 1;
    const priceA = parsePrices(a);
    const priceB = parsePrices(b);

    if (sortBy === '낮은 가격순') {
      if (aP !== bP) return aP - bP;                                 // 1차: price_level
      if (priceA.min !== priceB.min) return priceA.min - priceB.min; // 2차: 최솟값
      if (priceA.max !== priceB.max) return priceA.max - priceB.max; // 3차: 최댓값
      return aD - bD;                                                // 4차: 회복 기간
    }
    if (sortBy === '회복 기간 짧은순') {
      if (aD !== bD) return aD - bD;                                 // 1차: downtime_level
      if (aP !== bP) return aP - bP;                                 // 2차: price_level
      if (priceA.min !== priceB.min) return priceA.min - priceB.min; // 3차: 최솟값
      return priceA.max - priceB.max;                                // 4차: 최댓값
    }
    // 추천순: 매칭 점수 내림차순
    return (b.match_score ?? 0) - (a.match_score ?? 0);
  };

  // AI 추천 시술 정렬
  const sortedRawProcedures = [...rawProcedures].sort(sortFn);

  // 전체 시술 목록 (필터 적용 대상) - 매칭된 시술에 뱃지를 달기 위해 정보 병합
  const fullProcedures = FULL_CATALOG.map(catItem => {
    const match = rawProcedures.find(p => p.id === catItem.id);
    return match ? { ...catItem, ...match, is_matched: true } : { ...catItem, is_matched: false, match_score: 0, match_reasons: [] };
  });

  const isSensitive = (user && (user.skinType === '민감성')) ||
    (data && data.input_form && data.input_form.skinType === '민감성');

  const concernOptions = ['전체', '모공 축소', '색소 침착', '주름 개선', '탄력 개선', '속건조 해결', '피부 장벽 강화'];
  const priceOptions = ['전체', '가성비 (10만원 이하)', '스탠다드 (10~30만원)', '프리미엄 (30만원 이상)'];
  const downOptions = ['전체', '당일 일상복귀', '2~3일', '일주일 이상'];
  const sortOptions = ['추천순', '낮은 가격순', '회복 기간 짧은순'];

  const filtered = fullProcedures
    .filter(p => {
      const concerns = p.target_concerns || p.match_reasons || [];
      if (filterConcern !== '전체' && !concerns.includes(filterConcern)) return false;
      if (filterPrice !== '전체' && p.price_bracket !== filterPrice) return false;
      if (filterDown !== '전체') {
        const dl = p.downtime_level ?? 1;
        if (filterDown === '당일 일상복귀' && dl !== 0) return false;
        if (filterDown === '2~3일' && dl !== 1) return false;
        if (filterDown === '일주일 이상' && dl !== 2) return false;
      }
      return true;
    })
    .sort(sortFn);

  const activeCount = [filterConcern, filterPrice, filterDown].filter(v => v !== '전체').length;
  const resetFilters = () => { setFilterConcern('전체'); setFilterPrice('전체'); setFilterDown('전체'); };
  const catStyle = (cat) => CATEGORY_STYLE[cat] || { bg: 'var(--accent-soft)', color: 'var(--accent-ink)', border: 'var(--accent)' };

  const renderCard = (proc, idx, sectionId) => {
    const uniqueId = `${sectionId}-${proc.id || idx}`;
    const isOpen = expanded === uniqueId;
    const concerns = proc.target_concerns || proc.match_reasons || [];
    const notSafe = proc.is_safe_for_sensitive === false || proc.safe_for_sensitive === false;
    const cStyle = catStyle(proc.category);
    const dtInfo = DOWNTIME_INFO[proc.downtime_level ?? 1];
    
    // sectionId === 'top' 이면 모두 추천 시술임
    const isMatched = sectionId === 'top' || proc.is_matched || proc.match_score > 0;

    return (
      <div key={uniqueId}
        onClick={() => setExpanded(isOpen ? null : uniqueId)}
        style={{
          background: 'var(--surface)',
          border: notSafe && isSensitive
            ? '1.5px solid var(--warn)'
            : isOpen ? '1.5px solid var(--accent)' : '1px solid var(--line)',
          borderRadius: 16,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color .2s, box-shadow .2s',
          boxShadow: isOpen ? '0 4px 20px rgba(201,98,74,0.1)' : 'var(--shadow-sm)',
        }}>
        {/* ── 카드 헤더 ── */}
        <div style={{ padding: '18px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            {/* 왼쪽 정보 */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: cStyle.bg, color: cStyle.color, border: `1px solid ${cStyle.border}`,
                }}>{proc.category}</span>
                {isMatched && idx === 0 && sectionId === 'top' && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: 'linear-gradient(90deg, #B98A3A, #D4A84B)', color: '#fff',
                  }}>🏆 BEST MATCH</span>
                )}
                {isMatched && (idx > 0 || sectionId !== 'top') && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                  }}>✦ AI 추천</span>
                )}
                {notSafe && (
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'var(--warn-soft)', color: 'var(--warn)',
                  }}>⚠ 민감성 주의</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{proc.emoji || '💊'}</span>
                <span style={{ fontFamily: 'var(--serif-ko)', fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>{proc.name}</span>
              </div>
              {concerns.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {concerns.map((c, ci) => (
                    <span key={ci} style={{
                      fontSize: 11.5, padding: '3px 9px', borderRadius: 20,
                      background: 'var(--bg-2)', color: 'var(--ink-2)', border: '1px solid var(--line)',
                    }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
            {/* 오른쪽 정보 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 90 }}>
              {dtInfo && (
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: dtInfo.bg, color: dtInfo.color }}>
                  {dtInfo.icon} {dtInfo.label}
                </span>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--mono)', textAlign: 'right', lineHeight: 1.2 }}>{(proc.price_range || '').replace('-', '~')}</div>
              <div style={{ fontSize: 16, color: 'var(--ink-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .25s ease' }}>▾</div>
            </div>
          </div>
        </div>
        {/* ── 카드 상세 ── */}
        {isOpen && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '18px 20px 20px', background: 'var(--surface-2)' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.75 }}>{proc.description}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { label: '예상 비용', value: proc.price_range, icon: '💰' },
                { label: '회복 기간', value: proc.downtime, icon: '⏱️' },
                { label: '통증 강도', value: proc.pain_level, icon: '💉' },
                { label: '권장 주기', value: proc.cycle, icon: '🔁' },
              ].filter(m => m.value).map((m, mi) => (
                <div key={mi} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-muted)', marginBottom: 3 }}>{m.icon} {m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{m.value}</div>
                </div>
              ))}
            </div>
            {isMatched && concerns.length > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10, background: 'var(--accent-soft)', borderLeft: '3px solid var(--accent)', fontSize: 12.5, color: 'var(--accent-ink)', lineHeight: 1.6 }}>
                ✨ <strong>AI 추천 사유:</strong> {concerns.join(' · ')} 개선에 적합합니다
              </div>
            )}
            {notSafe && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--warn-soft)', borderLeft: '3px solid var(--warn)', fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.6 }}>
                ⚠️ <strong>민감성 피부 주의:</strong> 자극이 강할 수 있으니 전문의 상담 후 시술하세요.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page" data-screen-label="07 Treatment" style={{ maxWidth: 900, padding: '0 20px 60px' }}>
      {/* ─────────── HERO 헤더 ─────────────────────────────── */}
      <div style={{
        margin: '20px 0 28px', padding: '28px 32px', borderRadius: 20,
        background: 'linear-gradient(135deg, #1A1412 0%, #3D2018 50%, #5A2E1A 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(201,98,74,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '40%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, marginBottom: 14, background: 'rgba(201,98,74,0.3)', border: '1px solid rgba(201,98,74,0.5)' }}>
            <span style={{ fontSize: 12, color: '#E8A090', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>🏥 CLINIC MATCH</span>
          </div>
          <h1 style={{ margin: '0 0 8px', fontFamily: 'var(--serif-ko)', fontSize: 28, fontWeight: 600, color: '#FFFFFF', lineHeight: 1.3 }}>나에게 맞는 시술 탐색</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            {hasAnalysis ? `피부 분석 기반 · AI 맞춤 추천 및 전체 카탈로그` : '분석 전 전체 시술 카탈로그 · 분석 후 맞춤 추천이 활성화됩니다'}
          </p>
          {!hasAnalysis && (
            <button onClick={onHome} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 10, background: 'rgba(201,98,74,0.35)', border: '1px solid rgba(201,98,74,0.6)', color: '#FFD5C8', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--sans)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>✦</span> 지금 피부 분석하러 가기
            </button>
          )}
        </div>
      </div>

      {/* ─────────── 1. AI 추천 시술 (Top) ─────────────────── */}
      {hasAnalysis && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
             <h2 style={{ margin: 0, fontFamily: 'var(--serif-ko)', fontSize: 22, fontWeight: 600 }}>AI 추천 시술</h2>
             <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>가장 효과적인 선택지</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedRawProcedures.map((proc, i) => renderCard(proc, i, 'top'))}
          </div>
        </div>
      )}

      {/* ─────────── 2. 필터링 및 전체 시술 (Bottom) ───────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
         <h2 style={{ margin: 0, fontFamily: 'var(--serif-ko)', fontSize: 22, fontWeight: 600 }}>전체 시술 둘러보기</h2>
      </div>

      {/* 정렬 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', flexWrap: 'wrap' }}>
        {sortOptions.map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', border: sortBy === s ? '1.5px solid var(--accent)' : '1.5px solid transparent', background: sortBy === s ? 'var(--accent)' : 'var(--bg-2)', color: sortBy === s ? '#fff' : 'var(--ink-2)', fontWeight: sortBy === s ? 600 : 400, transition: 'all .15s ease' }}>{s}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {activeCount > 0 && <button onClick={resetFilters} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid var(--warn)', background: 'var(--warn-soft)', color: 'var(--warn)', fontFamily: 'var(--sans)' }}>✕ 필터 초기화 ({activeCount})</button>}
        </div>
      </div>

      {/* 필터 패널 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--mono)', marginBottom: 8, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            해결하고 싶은 고민
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {concernOptions.map(c => (
              <button key={c} onClick={() => setFilterConcern(c)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12.5, cursor: 'pointer', border: filterConcern === c ? '1.5px solid var(--accent)' : '1px solid var(--line)', background: filterConcern === c ? 'var(--accent)' : 'transparent', color: filterConcern === c ? '#fff' : 'var(--ink-2)', fontWeight: filterConcern === c ? 600 : 400, transition: 'all .18s ease' }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--line)', margin: '0 -20px 16px', width: 'calc(100% + 40px)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--mono)', marginBottom: 8, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              가격대
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {priceOptions.map(p => (
                <button key={p} onClick={() => setFilterPrice(p)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12.5, cursor: 'pointer', textAlign: 'left', border: filterPrice === p ? '1.5px solid var(--accent)' : '1px solid var(--line)', background: filterPrice === p ? 'var(--accent-soft)' : 'transparent', color: filterPrice === p ? 'var(--accent-ink)' : 'var(--ink-2)', fontWeight: filterPrice === p ? 600 : 400, transition: 'all .15s ease' }}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--mono)', marginBottom: 8, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
              회복 기간
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {downOptions.map(d => (
                <button key={d} onClick={() => setFilterDown(d)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12.5, cursor: 'pointer', textAlign: 'left', border: filterDown === d ? '1.5px solid var(--good)' : '1px solid var(--line)', background: filterDown === d ? 'var(--good-soft)' : 'transparent', color: filterDown === d ? 'var(--good)' : 'var(--ink-2)', fontWeight: filterDown === d ? 600 : 400, transition: 'all .15s ease' }}>{d}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 14, paddingLeft: 2 }}>
        <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>{filtered.length}</span>
        <span style={{ marginLeft: 4 }}>개 시술이 조건에 맞습니다</span>
        {activeCount > 0 && <span style={{ marginLeft: 8, color: 'var(--ink-faint)' }}>· 필터 {activeCount}개 적용 중</span>}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>조건에 맞는 시술이 없습니다</div>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 20 }}>필터 조건을 조정해보세요</div>
          <button onClick={resetFilters} style={{ padding: '10px 24px', borderRadius: 24, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'var(--sans)' }}>필터 초기화</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((proc, i) => renderCard(proc, i, 'bottom'))}
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

window.Treatment = Treatment;
