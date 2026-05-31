// Login screen
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = React.useState('hi@skin.kr');
  const [pw, setPw] = React.useState('••••••••');

  const submit = (e) => { e && e.preventDefault(); onLogin && onLogin({ email }); };

  return (
    <div className="login-page" data-screen-label="01 Login">
      {/* Left art panel */}
      <div className="login-art">
        <div style={{position:'relative', zIndex: 2, display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <Brand size={28} />
          <div className="mono" style={{fontSize: 10.5, letterSpacing: '0.16em', color:'rgba(40,22,12,0.55)'}}>
            v 0.4 · BETA
          </div>
        </div>

        <div className="login-blob" style={{top: '20%', right: '-10%'}} />
        <div className="login-blob" style={{bottom: '-10%', left: '40%', width: 220, height: 220}} />

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
            <div className="eyebrow">로그인 · SIGN IN</div>
            <h1 className="h1" style={{margin:'2px 0 0'}}>다시 만나서 반가워요</h1>
            <div className="muted" style={{fontSize: 13}}>분석 기록을 이어서 보거나 새 분석을 시작하세요.</div>
          </div>

          <div className="field">
            <label className="field-label">이메일</label>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div className="field">
            <label className="field-label" style={{justifyContent:'space-between', display:'flex'}}>
              <span>비밀번호</span>
              <a href="#" style={{fontSize: 11.5, color: 'var(--ink-muted)', textDecoration: 'none'}}>잊어버리셨나요?</a>
            </label>
            <input className="input" type="password" value={pw} onChange={e=>setPw(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{width: '100%'}}>
            로그인 <Icon name="arrowRight" size={15} />
          </button>

          <div className="login-divider">또는</div>

          <div className="social-row">
            <button type="button" className="social-btn">
              <span style={{width:14, height:14, borderRadius: 3, background:'#FEE500', display:'inline-block'}}/> 카카오
            </button>
            <button type="button" className="social-btn">
              <span style={{width:14, height:14, borderRadius: 3, background:'#03C75A', display:'inline-block'}}/> 네이버
            </button>
            <button type="button" className="social-btn">
              <span style={{width:14, height:14, borderRadius: '50%', background:'#000', display:'inline-block'}}/> Apple
            </button>
          </div>

          <div style={{fontSize: 12.5, color:'var(--ink-muted)', textAlign:'center', marginTop: 6}}>
            계정이 없으신가요?{' '}
            <a href="#" style={{color:'var(--ink)', textDecoration:'underline', textUnderlineOffset: 3}}>회원가입</a>
          </div>

          <div style={{
            marginTop: 18, padding: '12px 14px',
            background: 'var(--surface-2)', border: '1px dashed var(--line)',
            borderRadius: 10, fontSize: 11.5, color: 'var(--ink-muted)',
            lineHeight: 1.5
          }}>
            <span className="mono" style={{color:'var(--ink-2)'}}>DEMO ·</span> 어떤 정보든 입력하고 로그인을 누르면
            프로토타입을 둘러볼 수 있습니다.
          </div>
        </form>
      </div>
    </div>
  );
};

window.LoginScreen = LoginScreen;
