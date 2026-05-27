// Login / Register screen — 실제 API 연동
const LoginScreen = ({ onLogin }) => {
  const [mode, setMode]     = React.useState('login');   // 'login' | 'register'
  const [email, setEmail]   = React.useState('');
  const [pw, setPw]         = React.useState('');
  const [pw2, setPw2]       = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError]   = React.useState('');

  const validate = () => {
    if (!email.includes('@')) return '올바른 이메일 주소를 입력하세요.';
    if (pw.length < 6)        return '비밀번호는 6자 이상이어야 합니다.';
    if (mode === 'register' && pw !== pw2) return '비밀번호가 일치하지 않습니다.';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');
    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || '오류가 발생했습니다.');
        return;
      }
      localStorage.setItem('skin_token', data.token);
      onLogin && onLogin(data.user);
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError('');
    setPw(''); setPw2('');
  };

  return (
    <div className="login-page" data-screen-label="01 Login">
      {/* Left art panel */}
      <div className="login-art">
        <div style={{position:'relative', zIndex:2, display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <Brand size={28} />
          <div className="eyebrow" style={{color:'rgba(40,22,12,0.55)'}}>v 0.4 · BETA</div>
        </div>

        <div className="login-blob" style={{top:'20%', right:'-10%'}} />
        <div className="login-blob" style={{bottom:'-10%', left:'40%', width:220, height:220}} />

        <div className="login-art-foot">
          한국인 피부에 맞춰<br/>
          학습된 분석.<br/>
          <span style={{color:'#5C2B17'}}>당신의 피부를 위한 처방.</span>
          <span className="small">EFFICIENT-NET · MFDS PUBLIC DATA · MULTIMODAL</span>
        </div>
      </div>

      {/* Right form */}
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="title">
            <div className="eyebrow">{mode === 'login' ? '로그인 · SIGN IN' : '회원가입 · REGISTER'}</div>
            <h1 className="h1" style={{margin:'2px 0 0'}}>
              {mode === 'login' ? '다시 만나서 반가워요' : '처음 오셨군요'}
            </h1>
            <div className="muted" style={{fontSize:13}}>
              {mode === 'login'
                ? '분석 기록을 이어서 보거나 새 분석을 시작하세요.'
                : '이메일과 비밀번호로 계정을 만들어 분석 기록을 저장하세요.'}
            </div>
          </div>

          <div className="field">
            <label className="field-label">이메일</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email" />
          </div>

          <div className="field">
            <label className="field-label" style={{justifyContent:'space-between', display:'flex'}}>
              <span>비밀번호</span>
              {mode === 'login' && (
                <span style={{fontSize:11.5, color:'var(--ink-muted)'}}>6자 이상</span>
              )}
            </label>
            <input className="input" type="password" value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>

          {mode === 'register' && (
            <div className="field">
              <label className="field-label">비밀번호 확인</label>
              <input className="input" type="password" value={pw2}
                onChange={e => setPw2(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" />
            </div>
          )}

          {error && (
            <div style={{
              padding:'10px 14px', borderRadius:10,
              background:'var(--warn-soft)', color:'var(--warn)',
              fontSize:13
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
            {loading
              ? '처리 중…'
              : mode === 'login' ? <>로그인 <Icon name="arrowRight" size={15}/></> : '계정 만들기'
            }
          </button>

          <div style={{fontSize:13, color:'var(--ink-muted)', textAlign:'center', marginTop:4}}>
            {mode === 'login' ? '아직 계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
            <button type="button" onClick={switchMode}
              style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink)',
                      textDecoration:'underline', textUnderlineOffset:3, fontSize:13, fontFamily:'inherit'}}>
              {mode === 'login' ? '회원가입' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

window.LoginScreen = LoginScreen;
