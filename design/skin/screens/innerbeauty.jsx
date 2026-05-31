const InnerBeauty = ({ data, user, token, onHome }) => {
  const foods = data ? (data.foods || []) : [];
  const [diary, setDiary] = React.useState([]);

  if (!data) {
    return (
      <div className="page" style={{display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', minHeight:'80vh', padding: 20}}>
        <div style={{fontSize: 48, marginBottom: 16}}>🥗</div>
        <div className="h2-serif" style={{marginBottom: 8}}>추천 식단이 없습니다</div>
        <div className="muted" style={{textAlign:'center', fontSize: 13, lineHeight: 1.5, marginBottom: 24}}>
          피부 분석을 완료해야 맞춤 식단을 추천받을 수 있습니다.<br/>
          홈에서 사진 분석을 먼저 시작해보세요!
        </div>
        <button className="btn btn-primary" onClick={onHome} style={{width: 200}}>
          홈으로 돌아가기
        </button>
      </div>
    );
  }
  
  React.useEffect(() => {
    if (user && token) {
      fetch('/api/me/diary', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.items) setDiary(d.items);
        }).catch(()=>{});
    } else {
      setDiary([]);
    }
  }, [user, token]);

  const [newLog, setNewLog] = React.useState('');

  const handleAddLog = () => {
    if (!newLog.trim() || !user || !token) return;
    const newId = Date.now().toString();
    const entry = { id: newId, date: '오늘', food: newLog, skin_effect: '분석 대기 중...', notes: '' };
    
    setDiary([entry, ...diary]);
    setNewLog('');

    fetch('/api/me/diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(entry)
    }).catch(()=>{});
  };

  const handleDeleteLog = (id) => {
    if (!window.confirm('이 식단 기록을 삭제하시겠습니까?')) return;
    setDiary(diary.filter(d => d.id !== id));
    if (token) {
      fetch('/api/me/diary/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }).catch(()=>{});
    }
  };

  return (
    <div className="page" data-screen-label="05 InnerBeauty">
      <div className="result-banner">
        <div>
          <div className="eyebrow">이너뷰티 & 식단</div>
          <div className="skin-type" style={{ marginTop: 6 }}>속부터 채우는 피부 관리 🥗</div>
        </div>
      </div>

      <div style={{ padding: '0 20px', maxWidth: 600, margin: '0 auto' }}>

        {/* 1. 피부에 좋은 음식 추천 */}
        <div style={{ marginTop: 40, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 className="h2-serif" style={{ margin: 0 }}>피부에 좋은 맞춤 음식</h2>
          <p className="muted" style={{ margin: 0 }}>분석 결과를 바탕으로 현재 피부에 꼭 필요한 영양소를 채워주는 음식입니다.</p>
        </div>

        {foods.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {foods.map((food, i) => (
              <div key={i} className="card" style={{ padding: 20, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ fontSize: 24, marginTop: -4 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--ink)' }}>{food.food_name || food.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
                    {food.key_nutrients && <span style={{ marginRight: 6, background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4 }}>{food.key_nutrients}</span>}
                    {food.tags && food.tags.map(t => <span key={t} style={{ marginRight: 6, background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4 }}>{t}</span>)}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{food.reason}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--ink-muted)' }}>
            추천 음식 데이터가 없습니다. 먼저 피부 분석을 진행해주세요.
          </div>
        )}

        {/* 2. 먹으면 안 좋은 것 경고 */}
        <div style={{ marginTop: 40, marginBottom: 16 }}>
          <h2 className="h2-serif" style={{ margin: 0 }}>주의해야 할 식습관 ⚠️</h2>
        </div>
        <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--warn)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--ink)' }}>당류 과다 섭취 및 야식 주의</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            현재 피지 분비량이 다소 높게 측정되었습니다. 액상과당이 많은 음료나 늦은 시간의 야식은 피지선을 자극하여 트러블을 유발할 수 있으니 섭취를 줄이는 것이 좋습니다.
          </p>
        </div>

        {/* 3. 피부 식단 일기 */}
        <div style={{ marginTop: 40, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 className="h2-serif" style={{ margin: 0 }}>피부 식단 일기 ✍️</h2>
          <p className="muted" style={{ margin: 0 }}>오늘 먹은 음식을 기록하고 피부 상태와의 상관관계를 파악해 보세요.</p>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              type="text"
              className="input"
              placeholder="오늘 어떤 음식을 드셨나요?"
              style={{ flex: 1 }}
              value={newLog}
              onChange={e => setNewLog(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddLog()}
            />
            <button className="btn btn-primary" onClick={handleAddLog}>기록</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {diary.map((d) => (
              <div key={d.id} style={{
                background: 'var(--bg)', padding: 16, borderRadius: 12,
                border: '1px solid var(--line-2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'var(--ink)' }}>{d.food || d.content}</div>
                  <div style={{ fontSize: 13, color: d.bad ? 'var(--warn)' : 'var(--accent)' }}>{d.skin_effect || d.effect}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--ink)' }}>{d.notes}</div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 8, height: 'auto', minHeight: 0, color: 'var(--warn)', flexShrink: 0, marginRight: -8, marginBottom: -8 }}
                    onClick={() => handleDeleteLog(d.id)}
                    title="기록 삭제"
                  >
                    <Icon name="cross" size={14} stroke={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 40, paddingBottom: 60, textAlign: 'center' }}>
          <button className="btn btn-outline" onClick={onHome}>홈으로 돌아가기</button>
        </div>
      </div>
    </div>
  );
};
