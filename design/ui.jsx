// Shared UI components & helpers

const Icon = ({ name, size = 16, stroke = 1.6 }) => {
  const paths = {
    arrowRight: <path d="M5 12h14M13 6l6 6-6 6"/>,
    arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6"/>,
    sparkle: <path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5z M5 18l.7 1.8L7.5 20.5l-1.8.7L5 23l-.7-1.8L2.5 20.5l1.8-.7z"/>,
    camera: <><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></>,
    chart: <><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-3"/><path d="M12 15V8"/><path d="M16 15v-5"/></>,
    leaf: <path d="M20 4c0 8-4 14-13 14-1.5 0-3-.2-4-.5 0-7 5-13 13-13.5z M7 17c3-3 6-5 10-6"/>,
    flask: <><path d="M9 3v6L4 18a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M8 3h8"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.14 16.9l.06-.06A1.7 1.7 0 0 0 4.54 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.11A1.7 1.7 0 0 0 4.32 7L4.26 7A2 2 0 1 1 7.1 4.14l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.16.39.43.71.78.94.34.22.74.34 1.15.34H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03z"/></>,
    bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="M5 12l5 5L20 7"/>,
    cross: <path d="M6 6l12 12M6 18L18 6"/>,
    upload: <><path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

const Brand = ({ size = 26 }) => (
  <div className="brand" style={{fontSize: size}}>
    <span>skin</span>
    <span className="dot" />
  </div>
);

// ------- Radar chart (SVG) -------
const Radar = ({ values, labels, size = 260, max = 100 }) => {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 30;
  const n = values.length;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i, v) => {
    const rr = (v / max) * r;
    return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))];
  };
  const ringPts = (frac) => {
    return values.map((_, i) => {
      const rr = frac * r;
      return `${cx + rr * Math.cos(angle(i))},${cy + rr * Math.sin(angle(i))}`;
    }).join(' ');
  };
  const polyPts = values.map((v, i) => point(i, v).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon key={i} points={ringPts(f)} fill="none" stroke="#E4DCCC" strokeWidth="1" />
      ))}
      {values.map((_, i) => {
        const [x, y] = point(i, max);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E4DCCC" strokeWidth="1" />;
      })}
      <polygon points={polyPts} fill="rgba(201,98,74,0.18)" stroke="#C9624A" strokeWidth="1.5" />
      {values.map((v, i) => {
        const [x, y] = point(i, v);
        return <circle key={i} cx={x} cy={y} r="3" fill="#C9624A" />;
      })}
      {labels.map((l, i) => {
        const [x, y] = point(i, max + 18);
        return (
          <text key={i} x={x} y={y}
            textAnchor="middle" dominantBaseline="middle"
            fontFamily="JetBrains Mono, monospace" fontSize="10"
            fill="#7A726A">{l}</text>
        );
      })}
    </svg>
  );
};

// ------- Mock data -------
const ATTRIBUTES = [
  { key: 'oil',     name: '유분',       short: 'OIL', value: 72, max: 100, level: 'hi',  desc: 'T존 중심 과다 분비' },
  { key: 'hydro',   name: '수분',       short: 'HYD', value: 38, max: 100, level: 'lo',  desc: '각질층 수분 부족' },
  { key: 'sens',    name: '민감도',     short: 'SEN', value: 64, max: 100, level: 'hi',  desc: '홍반 반응 확인됨' },
  { key: 'pigment', name: '색소침착',   short: 'PIG', value: 51, max: 100, level: 'mid', desc: '광대뼈 부위 멜라닌' },
  { key: 'wrinkle', name: '주름',       short: 'WRK', value: 27, max: 100, level: 'lo',  desc: '경미한 잔주름' },
  { key: 'pore',    name: '모공',       short: 'POR', value: 58, max: 100, level: 'mid', desc: '코·볼 부위 확장' },
  { key: 'tone',    name: '톤 균일도',  short: 'TON', value: 44, max: 100, level: 'mid', desc: '국소적 불균일' },
];

const GOOD_INGREDIENTS = [
  { name: '나이아신아마이드', tag: '미백·진정',     why: '피지 조절 + 색소침착 개선에 식약처 고시 성분' },
  { name: '판테놀',           tag: '진정·보습',     why: '민감도 64% 대응 — 장벽 회복 보조' },
  { name: '히알루론산',       tag: '저분자 보습',   why: '수분 38% — 각질층 수분 보충' },
  { name: '세라마이드 NP',    tag: '장벽',           why: '피부 장벽 강화로 수분 손실 방지' },
];

const AVOID_INGREDIENTS = [
  { name: '에탄올 (denat.)',  tag: '자극',         why: '민감도 높은 피부 — 장벽 손상 위험' },
  { name: '향료(Fragrance)',  tag: '알러지',       why: '홍반 반응 확인 — 회피 권장' },
  { name: '미네랄오일',       tag: '모공 막힘',    why: '피지 분비 과다 — 모낭염 위험' },
  { name: 'SLS / SLES',       tag: '계면활성제',   why: '수분 부족 피부에 과한 세정력' },
];

const PRODUCTS = [
  {
    brand: 'Atrium Lab', name: '5.5 약산성 진정 토너', match: 94,
    tags: ['진정', '약산성', '무향료'],
    reason: '민감도·수분 부족 동시 대응 — 판테놀 + 마데카소사이드 함유',
    price: '24,000원', shot: ''
  },
  {
    brand: '소담초', name: '세라마이드 배리어 크림', match: 91,
    tags: ['장벽', '저자극'],
    reason: '세라마이드 NP·히알루론산으로 수분 38% 보강',
    price: '32,500원', shot: 'b'
  },
  {
    brand: 'Numu', name: '나이아 5% 세럼', match: 88,
    tags: ['미백', '피지조절'],
    reason: '유분 72% + 색소침착 51% 동시 케어',
    price: '28,000원', shot: 'c'
  },
];

const HISTORY = [
  { date: '2026 · 05 · 22', label: '아침 분석 #14', delta: '+4',  up: true,  thumb: 'a' },
  { date: '2026 · 05 · 15', label: '주간 점검 #13', delta: '+1',  up: true,  thumb: 'b' },
  { date: '2026 · 05 · 08', label: '저녁 분석 #12', delta: '-2',  up: false, thumb: 'c' },
  { date: '2026 · 05 · 01', label: '월간 리포트 #11', delta: '+6', up: true, thumb: 'd' },
];

// expose globals
Object.assign(window, {
  Icon, Brand, Radar,
  ATTRIBUTES, GOOD_INGREDIENTS, AVOID_INGREDIENTS, PRODUCTS, HISTORY,
});
