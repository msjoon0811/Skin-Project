// Analyze flow: capture → form → loading → API call
const Analyze = ({ onComplete, onBack }) => {
  const [step, setStep] = React.useState(0);
  const [imageFile, setImageFile] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState(null);
  const [photoError, setPhotoError] = React.useState(false);
  const fileInputRef = React.useRef(null);

  const [form, setForm] = React.useState({
    // 필수
    skinType: '', age: '', gender: '', concerns: [], sensitivity: '', allergies: '',
    // 생활습관 (선택 - 정밀도 향상)
    drinking:   '',
    smoking:    '',
    cleansing:  '',
    hormone:    '',
    gut:        '',
    sleep:      '',
    water:      '',
    heat:       '',
    pollution:  '',
    sweat:      '',
    diet:       '',
    // 기타
    budget: '20-40', routine: '간단 (3단계)',
  });
  const [formErrors, setFormErrors] = React.useState({});

  const toggle = (k, v) => setForm(f => ({
    ...f,
    [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]
  }));
  const set = (k, v) => {
    setForm(f => ({...f, [k]: v}));
    setFormErrors(e => ({...e, [k]: false}));
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setPhotoError(false);
  };

  // 사진 단계 → 폼 단계 이동 시 사진 필수 확인
  const goToForm = () => {
    if (!imageFile) {
      setPhotoError(true);
      return;
    }
    setStep(1);
  };

  // 폼 필수 항목 검증
  const validateForm = () => {
    const errors = {};
    if (!form.skinType)             errors.skinType    = true;
    if (!form.age)                  errors.age         = true;
    if (!form.gender)               errors.gender      = true;
    if (!form.sensitivity)          errors.sensitivity = true;
    if (!form.allergies.trim())     errors.allergies   = true;
    if (form.concerns.length === 0) errors.concerns    = true;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── 로딩 + API 호출 ──────────────────────────────────────────────
  const [loadStep, setLoadStep] = React.useState(0);
  const [apiError, setApiError] = React.useState(null);

  React.useEffect(() => {
    if (step !== 2) return;
    setLoadStep(0);
    setApiError(null);

    const delays = [700, 1000, 900, 1100, 800];
    let cum = 0;
    const timers = delays.map((t, i) => {
      cum += t;
      return setTimeout(() => setLoadStep(i + 1), cum);
    });

    const fd = new FormData();
    fd.append('form_data', JSON.stringify(form));
    if (imageFile) fd.append('image', imageFile);

    fetch('/api/analyze', { method: 'POST', body: fd })
      .then(r => {
        if (!r.ok) throw new Error('서버 오류가 발생했습니다. (' + r.status + ')');
        return r.json();
      })
      .then(data => {
        timers.forEach(clearTimeout);
        setLoadStep(5);
        setTimeout(() => onComplete && onComplete(data), 400);
      })
      .catch(err => {
        timers.forEach(clearTimeout);
        setApiError(err.message || '분석 중 오류가 발생했습니다.');
        setLoadStep(0);
      });

    return () => timers.forEach(clearTimeout);
  }, [step]);

  return (
    <div className="page" data-screen-label="03 Analyze">
      <div className="analyze-wrap">
        {/* 스텝 사이드바 */}
        <aside className="steps">
          <div className="eyebrow" style={{padding: '0 12px 6px'}}>분석 단계</div>
          {[
            {n:'01', t:'사진 업로드', s:'정면 셀카 1장 (필수)'},
            {n:'02', t:'정보 입력',   s:'필수 5가지 · 선택 사항'},
            {n:'03', t:'AI 분석',     s:'분석 중...'},
            {n:'04', t:'리포트',      s:'속성 · 성분 · 제품'},
          ].map((it, i) => (
            <div key={i} className={"step " + (i === step ? 'active' : i < step ? 'done' : '')}>
              <div className="num">{i < step ? <Icon name="check" size={11} stroke={2.2}/> : it.n.slice(1)}</div>
              <div>
                <div className="label">{it.t}</div>
                <div className="sub">{it.s}</div>
              </div>
            </div>
          ))}

          <div style={{
            marginTop: 14, padding: '12px 14px',
            background: 'var(--surface-2)', border: '1px solid var(--line-2)',
            borderRadius: 12, fontSize: 11.5, color: 'var(--ink-muted)', lineHeight: 1.5,
          }}>
            <div className="mono" style={{color: 'var(--ink-2)', fontSize: 10.5, letterSpacing: '0.1em'}}>개인정보 보호</div>
            <div style={{marginTop: 4}}>업로드된 사진은 분석 직후 자동으로 삭제됩니다. 다른 용도로 사용되지 않습니다.</div>
          </div>
        </aside>

        {/* 메인 패널 */}
        <main className="panel">

          {/* ── STEP 0: 사진 업로드 ── */}
          {step === 0 && (
            <>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">단계 01 · 사진 업로드</div>
                  <h1 className="h1">정면 셀카 한 장을 업로드해 주세요.</h1>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{display:'none'}}
                onChange={handleFileChange}
              />

              <div className="capture-stage">
                <div className="cam-frame" style={{cursor:'pointer'}} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="업로드된 이미지"
                      style={{width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0}} />
                  ) : (
                    <>
                      <div className="cam-overlay-tag">사진을 클릭해 업로드</div>
                      <div className="face-guide" />
                      <div className="scan-line" />
                    </>
                  )}
                </div>

                <div className="col-gap-lg">
                  <div>
                    <div className="eyebrow">촬영 가이드</div>
                    <h3 className="h2" style={{margin: '4px 0 12px'}}>이렇게 찍어주세요</h3>
                  </div>
                  <div className="capture-tips">
                    {[
                      {n:1, t:'자연광 · 정면', d:'창가에서 그림자 없는 조명, 정면 응시'},
                      {n:2, t:'맨얼굴 · 세안 직후', d:'메이크업·선크림을 모두 지운 상태'},
                      {n:3, t:'머리·안경 제거', d:'이마와 턱선이 잘 보이도록'},
                    ].map(tip => (
                      <div key={tip.n} className="tip">
                        <div className="icn">{tip.n}</div>
                        <div>
                          <div className="tip-title">{tip.t}</div>
                          <div className="tip-desc">{tip.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn-outline"
                    style={{justifyContent:'flex-start', padding: 14, borderStyle: 'dashed'}}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                    <Icon name="upload" size={15} /> 파일에서 선택하기
                    <span className="muted" style={{marginLeft:'auto', fontSize: 11.5}}>JPG · PNG · ≤10MB</span>
                  </button>

                  {photoError && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--warn-soft)', border: '1px solid var(--warn)',
                      borderRadius: 10, color: 'var(--warn)', fontSize: 13,
                    }}>
                      사진을 먼저 업로드해야 분석을 시작할 수 있습니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="panel-foot">
                <button className="btn btn-ghost" onClick={onBack}>
                  <Icon name="arrowLeft" size={14} /> 취소
                </button>
                <div style={{display:'flex', gap: 8, alignItems:'center'}}>
                  {imageFile && (
                    <span className="muted mono" style={{fontSize: 11.5}}>✓ {imageFile.name}</span>
                  )}
                  <button className="btn btn-primary" onClick={goToForm}>
                    다음: 정보 입력 <Icon name="arrowRight" size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 1: 폼 입력 ── */}
          {step === 1 && (
            <>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">단계 02 · 정보 입력</div>
                  <h1 className="h1">피부에 대해 조금 더 알려주세요.</h1>
                </div>
                <span className="mono muted" style={{fontSize: 11.5}}>* 필수 항목</span>
              </div>

              <div className="form-grid">
                {/* 기본 정보 */}
                <section className="form-section">
                  <div className="form-section-head">
                    <h3 className="h3">기본 정보</h3>
                    <span className="num">필수</span>
                  </div>
                  <div className="fields-2">
                    <div className="field">
                      <label className="field-label" style={{color: formErrors.skinType ? 'var(--warn)' : ''}}>
                        평소 피부 타입 <span className="req">*</span>
                        {formErrors.skinType && <span style={{fontSize:11, marginLeft:6}}>선택해주세요</span>}
                      </label>
                      <div className="chip-group">
                        {['건성','중성','지성','복합성','민감성'].map(t => (
                          <div key={t} className={"chip " + (form.skinType === t ? 'selected' : '')}
                               style={{borderColor: formErrors.skinType ? 'var(--warn)' : ''}}
                               onClick={() => set('skinType', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="fields-2">
                      <div className="field">
                        <label className="field-label" style={{color: formErrors.age ? 'var(--warn)' : ''}}>
                          나이대 <span className="req">*</span>
                          {formErrors.age && <span style={{fontSize:11, marginLeft:6}}>선택해주세요</span>}
                        </label>
                        <div className="chip-group">
                          {['20s','30s','40s','50+'].map(t => (
                            <div key={t} className={"chip " + (form.age === t ? 'selected' : '')}
                                 style={{borderColor: formErrors.age ? 'var(--warn)' : ''}}
                                 onClick={() => set('age', t)}>{t}</div>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label className="field-label" style={{color: formErrors.gender ? 'var(--warn)' : ''}}>
                          성별 <span className="req">*</span>
                          {formErrors.gender && <span style={{fontSize:11, marginLeft:6}}>선택해주세요</span>}
                        </label>
                        <div className="chip-group">
                          {['여성','남성','기타'].map(t => (
                            <div key={t} className={"chip " + (form.gender === t ? 'selected' : '')}
                                 style={{borderColor: formErrors.gender ? 'var(--warn)' : ''}}
                                 onClick={() => set('gender', t)}>{t}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 피부 고민 */}
                <section className="form-section">
                  <div className="form-section-head">
                    <h3 className="h3" style={{color: formErrors.concerns ? 'var(--warn)' : ''}}>
                      피부 고민 (복수 선택)
                      {formErrors.concerns && <span style={{fontSize:11, fontWeight:400, marginLeft:8}}>1개 이상 선택해주세요</span>}
                    </h3>
                    <span className="num">필수</span>
                  </div>
                  <div className="chip-group">
                    {['건조함','유분과다','민감/홍조','색소침착','여드름','모공','주름','탄력저하','각질'].map(t => (
                      <div key={t}
                           className={"chip tone " + (form.concerns.includes(t) ? 'selected' : '')}
                           style={{borderColor: formErrors.concerns && !form.concerns.includes(t) ? 'var(--warn)' : ''}}
                           onClick={() => { toggle('concerns', t); setFormErrors(e => ({...e, concerns: false})); }}>{t}</div>
                    ))}
                  </div>
                </section>

                {/* 민감도 · 알러지 */}
                <section className="form-section">
                  <div className="form-section-head">
                    <h3 className="h3">민감도 · 알러지</h3>
                    <span className="num">필수</span>
                  </div>
                  <div className="fields-2">
                    <div className="field">
                      <label className="field-label" style={{color: formErrors.sensitivity ? 'var(--warn)' : ''}}>
                        새 제품 사용 시 자극 정도 <span className="req">*</span>
                        {formErrors.sensitivity && <span style={{fontSize:11, marginLeft:6}}>선택해주세요</span>}
                      </label>
                      <div className="chip-group">
                        {['거의 없음','가끔','자주','매번'].map(t => (
                          <div key={t} className={"chip " + (form.sensitivity === t ? 'selected' : '')}
                               style={{borderColor: formErrors.sensitivity ? 'var(--warn)' : ''}}
                               onClick={() => set('sensitivity', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" style={{color: formErrors.allergies ? 'var(--warn)' : ''}}>
                        알러지 / 피해야 할 성분 <span className="req">*</span>
                        {formErrors.allergies && <span style={{fontSize:11, marginLeft:6}}>입력해주세요</span>}
                      </label>
                      <input className="input"
                        placeholder="예: 향료, 에센셜오일, 알콜 (없으면 '없음')"
                        style={{borderColor: formErrors.allergies ? 'var(--warn)' : ''}}
                        value={form.allergies}
                        onChange={e => set('allergies', e.target.value)} />
                    </div>
                  </div>
                </section>

                {/* 생활습관 - 선택 (분석 정밀도 향상) */}
                <section className="form-section">
                  <div className="form-section-head">
                    <h3 className="h3">생활습관 · 환경</h3>
                    <span className="num" style={{color:'var(--good)'}}>선택 — 정밀도 향상</span>
                  </div>
                  <div style={{
                    padding: '10px 14px', marginBottom: 16,
                    background: 'var(--accent-soft)', border: '1px solid var(--line-2)',
                    borderRadius: 10, fontSize: 12.5, color: 'var(--accent-ink)',
                  }}>
                    입력할수록 이미지 분석 결과가 더 정확해집니다. 건너뛰어도 분석은 진행됩니다.
                  </div>

                  {/* Row 1: 음주 · 흡연 · 클렌징 */}
                  <div className="fields-3">
                    <div className="field">
                      <label className="field-label">음주 빈도</label>
                      <div className="chip-group">
                        {['안 함','가끔 (월 1-2회)','자주 (주 1회+)'].map(t => (
                          <div key={t} className={"chip " + (form.drinking === t ? 'selected' : '')}
                               onClick={() => set('drinking', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">흡연 여부</label>
                      <div className="chip-group">
                        {['비흡연','흡연'].map(t => (
                          <div key={t} className={"chip " + (form.smoking === t ? 'selected' : '')}
                               onClick={() => set('smoking', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">저녁 클렌징</label>
                      <div className="chip-group">
                        {['매일 함','가끔 빠짐','자주 빠짐'].map(t => (
                          <div key={t} className={"chip " + (form.cleansing === t ? 'selected' : '')}
                               onClick={() => set('cleansing', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: 호르몬 · 소화 · 수면 */}
                  <div className="fields-3" style={{marginTop: 16}}>
                    <div className="field">
                      <label className="field-label">호르몬 · 스트레스</label>
                      <div className="chip-group">
                        {['해당 없음','생리 전후 예민함','스트레스 심함','임신 중'].map(t => (
                          <div key={t} className={"chip " + (form.hormone === t ? 'selected' : '')}
                               onClick={() => set('hormone', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">소화 불편함</label>
                      <div className="field-hint" style={{marginBottom:6}}>식후 더부룩함, 잦은 복통 등</div>
                      <div className="chip-group">
                        {['없음','가끔 있음','자주 있음'].map(t => (
                          <div key={t} className={"chip " + (form.gut === t ? 'selected' : '')}
                               onClick={() => set('gut', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">하루 평균 수면</label>
                      <div className="chip-group">
                        {['<5h','5-6','6-7','7-8','8+'].map(t => (
                          <div key={t} className={"chip " + (form.sleep === t ? 'selected' : '')}
                               onClick={() => set('sleep', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: 수분섭취 · 피부 열 · 미세먼지 */}
                  <div className="fields-3" style={{marginTop: 16}}>
                    <div className="field">
                      <label className="field-label">하루 물 섭취량</label>
                      <div className="chip-group">
                        {['부족 (<4잔)','보통 (4-6잔)','충분 (6잔+)'].map(t => (
                          <div key={t} className={"chip " + (form.water === t ? 'selected' : '')}
                               onClick={() => set('water', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">피부 열 노출</label>
                      <div className="field-hint" style={{marginBottom:6}}>사우나, 찜질, 뜨거운 샤워</div>
                      <div className="chip-group">
                        {['해당 없음','가끔 (뜨거운 샤워)','자주 (사우나/찜질)'].map(t => (
                          <div key={t} className={"chip " + (form.heat === t ? 'selected' : '')}
                               onClick={() => set('heat', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">대기오염 · 미세먼지</label>
                      <div className="chip-group">
                        {['낮음 (주로 실내)','보통','높음 (도심/야외)'].map(t => (
                          <div key={t} className={"chip " + (form.pollution === t ? 'selected' : '')}
                               onClick={() => set('pollution', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 4: 땀 · 식습관 */}
                  <div className="fields-2" style={{marginTop: 16}}>
                    <div className="field">
                      <label className="field-label">땀 분비량</label>
                      <div className="chip-group">
                        {['적음','보통','많음 (운동/야외)'].map(t => (
                          <div key={t} className={"chip " + (form.sweat === t ? 'selected' : '')}
                               onClick={() => set('sweat', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">식습관</label>
                      <div className="field-hint" style={{marginBottom:6}}>야식, 정제탄수화물(빵/면/과자) 섭취 빈도</div>
                      <div className="chip-group">
                        {['해당 없음','야식 자주','정제탄수화물 자주','둘 다'].map(t => (
                          <div key={t} className={"chip " + (form.diet === t ? 'selected' : '')}
                               onClick={() => set('diet', t)}>{t}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* 필수 항목 누락 시 전체 요약 메시지 */}
              {Object.values(formErrors).some(Boolean) && (
                <div style={{
                  margin: '0 0 8px',
                  padding: '12px 16px',
                  background: 'var(--warn-soft)', border: '1px solid var(--warn)',
                  borderRadius: 10, color: 'var(--warn)', fontSize: 13,
                }}>
                  필수 항목을 모두 입력해야 분석을 시작할 수 있습니다.
                </div>
              )}

              <div className="panel-foot">
                <button className="btn btn-ghost" onClick={() => setStep(0)}>
                  <Icon name="arrowLeft" size={14} /> 이전
                </button>
                <button className="btn btn-accent" onClick={() => { if (validateForm()) setStep(2); }}>
                  <Icon name="sparkle" size={14} /> AI 분석 시작
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: 분석 중 ── */}
          {step === 2 && (
            <>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">단계 03 · AI 분석 중</div>
                  <h1 className="h1">
                    {apiError ? '분석 중 문제가 생겼어요.' : '잠깐만요, AI가 열심히 분석 중이에요.'}
                  </h1>
                </div>
              </div>

              {apiError ? (
                <div style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  gap: 20, padding: '60px 0',
                }}>
                  <div style={{
                    padding: '16px 24px',
                    background: 'var(--warn-soft)', border: '1px solid var(--warn)',
                    borderRadius: 12, color: 'var(--warn)', fontSize: 14,
                  }}>
                    {apiError}
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button className="btn btn-ghost" onClick={() => { setApiError(null); setStep(1); }}>
                      <Icon name="arrowLeft" size={14}/> 폼으로 돌아가기
                    </button>
                    <button className="btn btn-primary" onClick={() => { setApiError(null); setStep(2); }}>
                      다시 시도
                    </button>
                  </div>
                </div>
              ) : (
                <div className="loading-stage">
                  <div className="loading-ring" />
                  <div className="loading-steps">
                    {[
                      {t:'사진에서 피부를 확인하는 중...',   sub:'잠시만요'},
                      {t:'피부 상태를 분석하는 중...',       sub:'7가지 속성을 살펴보고 있어요'},
                      {t:'입력 정보와 결합하는 중...',       sub:'더 정확한 결과를 위해 종합해요'},
                      {t:'맞는 성분을 찾는 중...',           sub:'피해야 할 것도 함께 정리해드려요'},
                      {t:'제품을 추천하는 중...',            sub:'거의 다 완성됐어요'},
                    ].map((s, i) => (
                      <div key={i} className={"loading-step " + (loadStep > i ? 'done' : loadStep === i ? 'active' : '')}>
                        <span className="bullet" />
                        <span className="grow">{s.t}</span>
                        <span className="mono faint" style={{fontSize: 11}}>{s.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

window.Analyze = Analyze;
