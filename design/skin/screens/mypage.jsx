// 히스토리 목록
const HistoryList = ({ displayHistory, onViewHistoryItem, onViewReport, onRefreshHistory }) => {
  const [loadingId, setLoadingId] = React.useState(null);

  const gradients = [
    'linear-gradient(135deg, #FFB7A1 0%, #FFD6C9 100%)',
    'linear-gradient(135deg, #A1C4FF 0%, #C9DFFF 100%)',
    'linear-gradient(135deg, #A1FFB7 0%, #C9FFD6 100%)',
    'linear-gradient(135deg, #FFFFA1 0%, #FFFFC9 100%)',
  ];

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
    if (!window.confirm('이 분석 기록을 삭제하시겠습니까?')) return;

    const id = h.id || h.analysisId;
    try {
      const token = localStorage.getItem('skin_token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE', headers });
      if (res.ok && onRefreshHistory) {
        onRefreshHistory();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch {
      alert('오류가 발생했습니다.');
    }
  };

  if (displayHistory.length === 0) {
    return (
      <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
        아직 분석 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="history-list">
      {displayHistory.map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="history-row"
            onClick={() => handleClick(h)}
            style={{ flex: 1, cursor: 'pointer', transition: 'background .12s ease', position: 'relative' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            <div className="thumb" style={{ background: gradients[i % gradients.length] }} />
            <div className="meta">
              <span className="date">{h.date}</span>
              <span className="title">{h.label}</span>
              {h.skinLabel && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{h.skinLabel}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                {h.score}
              </span>
              {h.delta && (
                <span className={"delta " + (h.up ? '' : 'down')}>{h.delta} {h.up ? '▲' : '▼'}</span>
              )}
            </div>

            <span className="arrow" style={{ color: loadingId === (h.id || h.analysisId) ? 'var(--accent)' : 'var(--ink-faint)' }}>
              {loadingId === (h.id || h.analysisId) ? '…' : '›'}
            </span>
          </div>

          <button
            className="btn btn-ghost"
            style={{ padding: 8, height: 'auto', minHeight: 0, color: 'var(--warn)', flexShrink: 0 }}
            onClick={(e) => handleDelete(e, h)}
            title="기록 삭제"
          >
            <Icon name="cross" size={14} stroke={2.5} />
          </button>
        </div>
      ))}

    </div>
  );
};



const MyPageScreen = ({ userInfo, historyList, onViewHistoryItem, onViewReport, onRefreshHistory, onWithdrawal }) => {
  const [showAllHistory, setShowAllHistory] = React.useState(false);
  const [wishlist, setWishlist] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const fetchWishlist = async () => {
    try {
      const token = localStorage.getItem('skin_token');
      const res = await fetch('/api/me/wishlist', {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setWishlist(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchWishlist();
  }, []);

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('skin_token');
      const res = await fetch(`/api/me/wishlist/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (res.ok) {
        fetchWishlist();
      }
    } catch (e) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const displayHistory = historyList || [];
  const totalAnalyses = displayHistory.length;
  const visibleHistory = showAllHistory ? displayHistory : displayHistory.slice(0, 3);
  const latestScore = totalAnalyses > 0 ? displayHistory[0].score : '-';
  const latestSkinType = totalAnalyses > 0 ? displayHistory[0].skinLabel : '분석 전';

  return (
    <div className="page pb-safe" data-screen-label="05 MyPage">
      {/* 1. 프로필 요약 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
          }}>
            <Icon name="user" size={30} />
          </div>
          <div>
            <div className="eyebrow">나의 피부 프로필</div>
            <h2 className="h2-serif" style={{ margin: '4px 0' }}>{userInfo?.email || '로그인 필요'}</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              총 {totalAnalyses}회 분석 완료
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <div className="card-flat" style={{ flex: 1, textAlign: 'center', padding: '16px 12px' }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>최근 종합 점수</div>
            <div className="score-big" style={{ fontSize: 28 }}>{latestScore}<span style={{ fontSize: 14, color: 'var(--ink-muted)' }}>/100</span></div>
          </div>
          <div className="card-flat" style={{ flex: 1, textAlign: 'center', padding: '16px 12px' }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>현재 피부 타입</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8, color: 'var(--ink)' }}>{latestSkinType}</div>
          </div>
        </div>
      </div>


      {/* 2. 장기 변화 리포트 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <div className="eyebrow">REPORT</div>
            <h2 className="h2-serif" style={{ margin: '4px 0 0' }}>장기 변화 트렌드</h2>
          </div>
        </div>

        {displayHistory.length >= 2 ? (() => {
          const pts = [...displayHistory].reverse();
          const W = 460, H = 100, pad = 16;
          const scores = pts.map(p => p.score);
          const minS = Math.min(...scores) - 10;
          const maxS = Math.max(...scores) + 10;
          const x = i => pad + (i / (pts.length - 1)) * (W - pad * 2);
          const y = v => H - pad - ((v - minS) / (maxS - minS)) * (H - pad * 2);
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
          const area = `${d} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;

          return (
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)', padding: '16px 0' }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="trendGradMy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#trendGradMy)" />
                <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={x(i)} cy={y(p.score)} r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
                    <text x={x(i)} y={y(p.score) - 10} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 11, fill: 'var(--ink-2)' }}>
                      {p.score}
                    </text>
                  </g>
                ))}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px', marginTop: 12 }}>
                {pts.map((p, i) => (
                  <span key={i} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)' }}>
                    {p.date.slice(5, 10).replace('-', '/')}
                  </span>
                ))}
              </div>
            </div>
          );
        })() : (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13, background: 'var(--surface-2)', borderRadius: 12 }}>
            아직 추이를 분석할 만큼 기록이 쌓이지 않았습니다.<br />꾸준히 피부를 기록해보세요!
          </div>
        )}
      </div>

      {/* 히스토리 (과거 분석 기록) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <div className="eyebrow">HISTORY</div>
            <h2 className="h2-serif" style={{ margin: '4px 0 0' }}>과거 분석 기록</h2>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>총 {totalAnalyses}회</div>
        </div>

        <HistoryList
          displayHistory={visibleHistory}
          onViewHistoryItem={onViewHistoryItem}
          onViewReport={onViewReport}
          onRefreshHistory={onRefreshHistory}
        />

        {displayHistory.length > 3 && (
          <button
            className="btn btn-outline"
            style={{ width: '100%', marginTop: 12, fontSize: 13, padding: 10 }}
            onClick={() => setShowAllHistory(!showAllHistory)}
          >
            {showAllHistory ? '접기 △' : `더보기 (${displayHistory.length - 3}개) ▽`}
          </button>
        )}
      </div>

      {/* 3. 위시리스트 (스크랩) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="section-head" style={{ marginBottom: 16 }}>
          <div>
            <div className="eyebrow">WISHLIST</div>
            <h2 className="h2-serif" style={{ margin: '4px 0 0' }}>나의 위시리스트</h2>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>불러오는 중...</div>
        ) : wishlist.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13, border: '1px dashed var(--line-2)', borderRadius: 12 }}>
            저장된 스크랩 항목이 없습니다.<br />분석 결과에서 ♡ 아이콘을 눌러 추가해보세요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['product', 'treatment'].map(type => {
              const items = wishlist.filter(c => c.item_type === type);
              if (items.length === 0) return null;

              const typeLabel = type === 'product' ? '💄 추천 제품' : '💆‍♀️ 추천 피부과 시술';

              return (
                <div key={type}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8, fontWeight: 500 }}>{typeLabel}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10,
                        background: 'var(--surface)'
                      }}>
                        <div>
                          {item.subtitle && <div style={{ fontSize: 11, color: type === 'treatment' ? 'var(--accent)' : 'var(--ink-muted)', marginBottom: 2 }}>{item.subtitle}</div>}
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.title}</div>
                        </div>
                        <button type="button" onClick={() => handleDelete(item.id)}
                          style={{ background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', padding: 4 }}>
                          <Icon name="heart-fill" size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 계정 관리 */}
      {userInfo && (
        <div className="card" style={{ marginTop: 20, marginBottom: 24 }}>
          <div className="section-head" style={{ marginBottom: 16 }}>
            <div>
              <div className="eyebrow">ACCOUNT</div>
              <h2 className="h2-serif" style={{ margin: '4px 0 0' }}>계정 관리</h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 현재 계정 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 10
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 15, flexShrink: 0
              }}>
                {(userInfo.email?.[0] || '?').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 2 }}>현재 계정</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{userInfo.email}</div>
              </div>
            </div>

            {/* 회원 탈퇴 */}
            <button
              className="btn btn-ghost"
              style={{
                justifyContent: 'flex-start', fontSize: 13, height: 40,
                color: 'var(--warn)', paddingLeft: 4
              }}
              onClick={onWithdrawal}
            >
              회원 탈퇴
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


window.MyPageScreen = MyPageScreen;
