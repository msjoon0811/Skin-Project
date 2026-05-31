const LoginScreen = ({ onLogin }) => {
  const [mode, setMode] = React.useState("login");
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const validate = () => {
    if (!email.includes("@")) return "\uC62C\uBC14\uB978 \uC774\uBA54\uC77C \uC8FC\uC18C\uB97C \uC785\uB825\uD558\uC138\uC694.";
    if (pw.length < 6) return "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.";
    if (mode === "register" && pw !== pw2) return "\uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
    return "";
  };
  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      localStorage.setItem("skin_token", data.token);
      onLogin && onLogin(data.user);
    } catch {
      setError("\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    } finally {
      setLoading(false);
    }
  };
  const switchMode = () => {
    setMode((m) => m === "login" ? "register" : "login");
    setError("");
    setEmail("");
    setPw("");
    setPw2("");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "login-page", "data-screen-label": "01 Login" }, /* @__PURE__ */ React.createElement("div", { className: "login-art" }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement(Brand, { size: 28 }), /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { color: "rgba(40,22,12,0.55)" } }, "v 0.4 \xB7 BETA")), /* @__PURE__ */ React.createElement("div", { className: "login-blob", style: { top: "20%", right: "-10%" } }), /* @__PURE__ */ React.createElement("div", { className: "login-blob", style: { bottom: "-10%", left: "40%", width: 220, height: 220 } }), /* @__PURE__ */ React.createElement("div", { className: "login-art-foot" }, "\uD55C\uAD6D\uC778 \uD53C\uBD80\uC5D0 \uB9DE\uCDB0", /* @__PURE__ */ React.createElement("br", null), "\uD559\uC2B5\uB41C \uBD84\uC11D.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { style: { color: "#5C2B17" } }, "\uB2F9\uC2E0\uC758 \uD53C\uBD80\uB97C \uC704\uD55C \uCC98\uBC29."), /* @__PURE__ */ React.createElement("span", { className: "small" }, "EFFICIENT-NET \xB7 MFDS PUBLIC DATA \xB7 MULTIMODAL"))), /* @__PURE__ */ React.createElement("div", { className: "login-form-wrap" }, /* @__PURE__ */ React.createElement("form", { className: "login-form", onSubmit: submit }, /* @__PURE__ */ React.createElement("div", { className: "title" }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, mode === "login" ? "\uB85C\uADF8\uC778 \xB7 SIGN IN" : "\uD68C\uC6D0\uAC00\uC785 \xB7 REGISTER"), /* @__PURE__ */ React.createElement("h1", { className: "h1", style: { margin: "2px 0 0" } }, mode === "login" ? "\uB2E4\uC2DC \uB9CC\uB098\uC11C \uBC18\uAC00\uC6CC\uC694" : "\uCC98\uC74C \uC624\uC168\uAD70\uC694"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 13 } }, mode === "login" ? "\uBD84\uC11D \uAE30\uB85D\uC744 \uC774\uC5B4\uC11C \uBCF4\uAC70\uB098 \uC0C8 \uBD84\uC11D\uC744 \uC2DC\uC791\uD558\uC138\uC694." : "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB85C \uACC4\uC815\uC744 \uB9CC\uB4E4\uC5B4 \uBD84\uC11D \uAE30\uB85D\uC744 \uC800\uC7A5\uD558\uC138\uC694.")), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uC774\uBA54\uC77C"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "input",
      type: "email",
      value: email,
      onChange: (e) => setEmail(e.target.value),
      placeholder: "you@example.com",
      autoComplete: "email"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", style: { justifyContent: "space-between", display: "flex" } }, /* @__PURE__ */ React.createElement("span", null, "\uBE44\uBC00\uBC88\uD638"), mode === "login" && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11.5, color: "var(--ink-muted)" } }, "6\uC790 \uC774\uC0C1")), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "input",
      type: "password",
      value: pw,
      onChange: (e) => setPw(e.target.value),
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      autoComplete: mode === "login" ? "current-password" : "new-password"
    }
  )), mode === "register" && /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uBE44\uBC00\uBC88\uD638 \uD655\uC778"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "input",
      type: "password",
      value: pw2,
      onChange: (e) => setPw2(e.target.value),
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      autoComplete: "new-password"
    }
  )), error && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "var(--warn-soft)",
    color: "var(--warn)",
    fontSize: 13
  } }, error), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary btn-lg", style: { width: "100%" }, disabled: loading }, loading ? "\uCC98\uB9AC \uC911\u2026" : mode === "login" ? /* @__PURE__ */ React.createElement(React.Fragment, null, "\uB85C\uADF8\uC778 ", /* @__PURE__ */ React.createElement(Icon, { name: "arrowRight", size: 15 })) : "\uACC4\uC815 \uB9CC\uB4E4\uAE30"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink-muted)", textAlign: "center", marginTop: 4 } }, mode === "login" ? "\uC544\uC9C1 \uACC4\uC815\uC774 \uC5C6\uC73C\uC2E0\uAC00\uC694? " : "\uC774\uBBF8 \uACC4\uC815\uC774 \uC788\uC73C\uC2E0\uAC00\uC694? ", /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: switchMode,
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--ink)",
        textDecoration: "underline",
        textUnderlineOffset: 3,
        fontSize: 13,
        fontFamily: "inherit"
      }
    },
    mode === "login" ? "\uD68C\uC6D0\uAC00\uC785" : "\uB85C\uADF8\uC778"
  )))));
};
window.LoginScreen = LoginScreen;
