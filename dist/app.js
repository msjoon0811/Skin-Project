const App = () => {
  const [screen, setScreen] = React.useState("login");
  const [user, setUser] = React.useState(null);
  const [token, setToken] = React.useState(null);
  const [analysisData, setAnalysisData] = React.useState(null);
  const [historyList, setHistoryList] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  React.useEffect(() => {
    if (user && token) {
      fetch("/api/me/notifications", { headers: { Authorization: "Bearer " + token } }).then((r) => r.ok ? r.json() : null).then((d) => {
        if (d && d.items) setNotifications(d.items);
      }).catch(() => {
      });
    } else {
      setNotifications([]);
    }
  }, [user, token]);
  React.useEffect(() => {
    if (!user || !token) return;
    if (!settings.pushEnabled) return;
    let delayCounter = 0;
    const addNotif = (title, message, type) => {
      setNotifications((prev) => {
        const newNotifs = [...prev];
        const exists = newNotifs.some((n) => n.message === message);
        if (!exists) {
          delayCounter++;
          const newId = Date.now().toString() + delayCounter.toString().padStart(4, "0");
          const createdAt = new Date(Date.now() + delayCounter).toISOString();
          const nObj = { id: newId, title, message, type, is_read: false };
          newNotifs.unshift(nObj);
          fetch("/api/me/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ ...nObj, created_at: createdAt })
          }).catch(() => {
          });
        }
        return newNotifs;
      });
    };
    if (historyList && historyList.length > 0) {
      const latest = historyList[0];
      let lastDate = new Date(latest.created_at || latest.date || Date.now());
      if (isNaN(lastDate.getTime())) lastDate = /* @__PURE__ */ new Date();
      const daysPassed = Math.floor((Date.now() - lastDate.getTime()) / (1e3 * 3600 * 24));
      if (daysPassed > 0) {
        if (!localStorage.getItem(`notif_reminder_${user.id}_${daysPassed}`)) {
          addNotif("\uC815\uAE30 \uBD84\uC11D \uB9AC\uB9C8\uC778\uB354", `\uB9C8\uC9C0\uB9C9 \uD53C\uBD80 \uBD84\uC11D \uD6C4 ${daysPassed}\uC77C\uC774 \uC9C0\uB0AC\uC5B4\uC694! \uACC4\uC808\uC774 \uBC14\uB00C\uC5C8\uB294\uB370 \uC624\uB298\uC758 \uD53C\uBD80 \uC0C1\uD0DC\uB97C \uD655\uC778\uD574\uBCFC\uAE4C\uC694?`, "reminder");
          localStorage.setItem(`notif_reminder_${user.id}_${daysPassed}`, "1");
        }
      } else {
        if (!localStorage.getItem(`notif_complete_${user.id}_${latest.id}`)) {
          addNotif("\uBD84\uC11D \uC644\uB8CC", "\uCD5C\uADFC \uD53C\uBD80 \uBD84\uC11D\uC744 \uC644\uB8CC\uD558\uC168\uB124\uC694! \uAFB8\uC900\uD788 \uAE30\uB85D\uC744 \uB0A8\uACA8 \uD53C\uBD80 \uBCC0\uD654\uB97C \uD655\uC778\uD574\uBCF4\uC138\uC694.", "complete");
          localStorage.setItem(`notif_complete_${user.id}_${latest.id}`, "1");
        }
      }
    } else if (historyList && historyList.length === 0) {
      if (!localStorage.getItem(`notif_welcome_${user.id}`)) {
        addNotif("\uD658\uC601\uD569\uB2C8\uB2E4!", "\uC544\uC9C1 \uD53C\uBD80 \uBD84\uC11D \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uCCAB \uBD84\uC11D\uC744 \uC9C4\uD589\uD558\uC5EC \uB9DE\uCDA4 \uCD94\uCC9C\uC744 \uBC1B\uC544\uBCF4\uC138\uC694!", "welcome");
        localStorage.setItem(`notif_welcome_${user.id}`, "1");
      }
    }
  }, [user, token, historyList, settings.pushEnabled]);
  const handleOpenNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      const unread = notifications.filter((n) => !n.is_read);
      if (unread.length > 0) {
        setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
        if (token) {
          fetch("/api/me/notifications/read", { method: "PUT", headers: { Authorization: "Bearer " + token } }).catch(() => {
          });
        }
      }
    }
  };
  const handleDeleteNotification = (id) => {
    setNotifications(notifications.filter((n) => n.id !== id));
    if (token) {
      fetch("/api/me/notifications/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token } }).catch(() => {
      });
    }
  };
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [settings, setSettings] = React.useState({
    hasAllergies: false,
    allergyList: [],
    customAllergies: "",
    lifestyle: "\uBCF4\uD1B5",
    concerns: [],
    darkMode: false,
    fontSize: "\uBCF4\uD1B5",
    pushEnabled: true
  });
  React.useEffect(() => {
    if (settings.darkMode) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
    let scale = 1;
    if (settings.fontSize === "\uC791\uAC8C") scale = 0.9;
    if (settings.fontSize === "\uD06C\uAC8C") scale = 1.15;
    document.documentElement.style.setProperty("zoom", scale);
    document.documentElement.style.setProperty("-moz-transform", `scale(${scale})`);
    document.documentElement.style.setProperty("-moz-transform-origin", "top center");
  }, [settings.darkMode, settings.fontSize]);
  const handlePushToggle = (checked) => {
    if (!checked) {
      alert("\uC54C\uB9BC \uC218\uC2E0 \uB3D9\uC758\uB97C \uD574\uC81C\uD558\uC168\uC2B5\uB2C8\uB2E4. \uC55E\uC73C\uB85C \uD53C\uBD80 \uBD84\uC11D \uB9AC\uB9C8\uC778\uB354 \uB4F1\uC758 \uC54C\uB9BC\uC774 \uC624\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    }
    setSettings({ ...settings, pushEnabled: checked });
  };
  const handleSaveSettings = (newSettings = null) => {
    setShowSettings(false);
    const toSave = newSettings || settings;
    if (newSettings && newSettings !== settings) setSettings(toSave);
    if (token) {
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ settings_json: JSON.stringify(toSave) })
      }).catch(() => {
      });
    }
  };
  const go = (s, replace = false) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setScreen(s);
    if (s !== "login") sessionStorage.setItem("skin_screen", s);
    else sessionStorage.removeItem("skin_screen");
    if (replace) {
      window.history.replaceState({ screen: s }, "", `?screen=${s}`);
    } else {
      window.history.pushState({ screen: s }, "", `?screen=${s}`);
    }
  };
  React.useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.screen) {
        setScreen(e.state.screen);
        if (e.state.screen !== "login") sessionStorage.setItem("skin_screen", e.state.screen);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  React.useEffect(() => {
    if (analysisData) sessionStorage.setItem("skin_analysis", JSON.stringify(analysisData));
  }, [analysisData]);
  const fetchHistory = (tok) => {
    const t = tok || token;
    const headers = t ? { Authorization: "Bearer " + t } : {};
    fetch("/api/history", { headers }).then((r) => r.ok ? r.json() : null).then((d) => {
      if (d && d.items) setHistoryList(d.items);
    }).catch(() => {
    });
  };
  React.useEffect(() => {
    const saved = localStorage.getItem("skin_token");
    if (!saved) return;
    fetch("/api/me", { headers: { Authorization: "Bearer " + saved } }).then((r) => r.ok ? r.json() : null).then((u) => {
      if (!u) {
        localStorage.removeItem("skin_token");
        return;
      }
      setToken(saved);
      setUser(u);
      if (u.settings_json) {
        try {
          setSettings(JSON.parse(u.settings_json));
        } catch (e) {
        }
      }
      fetchHistory(saved);
      const savedData = sessionStorage.getItem("skin_analysis");
      if (savedData) {
        try {
          setAnalysisData(JSON.parse(savedData));
        } catch (e) {
        }
      }
      const savedScreen = sessionStorage.getItem("skin_screen");
      if (savedScreen && savedScreen !== "login") {
        go(savedScreen, true);
      } else {
        go("dashboard", true);
      }
    }).catch(() => localStorage.removeItem("skin_token"));
  }, []);
  const handleLogin = (u) => {
    const tok = localStorage.getItem("skin_token");
    setUser(u);
    setToken(tok);
    if (u.settings_json) {
      try {
        setSettings(JSON.parse(u.settings_json));
      } catch (e) {
      }
    }
    fetchHistory(tok);
    go("dashboard");
  };
  const handleLogout = () => {
    if (token) {
      fetch("/api/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(() => {
      });
    }
    localStorage.removeItem("skin_token");
    sessionStorage.removeItem("skin_screen");
    sessionStorage.removeItem("skin_analysis");
    setToken(null);
    setUser(null);
    setAnalysisData(null);
    setHistoryList([]);
    setShowSettings(false);
    go("login");
  };
  const handleWithdrawal = async () => {
    if (!window.confirm("\uC815\uB9D0\uB85C \uD0C8\uD1F4\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C? \uBAA8\uB4E0 \uBD84\uC11D \uAE30\uB85D\uACFC \uACC4\uC815 \uC815\uBCF4\uAC00 \uC601\uAD6C \uC0AD\uC81C\uB429\uB2C8\uB2E4.")) return;
    if (!window.confirm("\uB2E4\uC2DC \uD55C\uBC88 \uD655\uC778\uD569\uB2C8\uB2E4. \uD0C8\uD1F4 \uD6C4 \uBCF5\uAD6C\uAC00 \uBD88\uAC00\uB2A5\uD569\uB2C8\uB2E4. \uACC4\uC18D\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
    try {
      if (token) {
        await fetch("/api/me", { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      }
    } catch (e) {
    }
    localStorage.removeItem("skin_token");
    sessionStorage.clear();
    setToken(null);
    setUser(null);
    setAnalysisData(null);
    setHistoryList([]);
    setShowSettings(false);
    go("login");
    alert("\uD0C8\uD1F4\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uC6A9\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4.");
  };
  const handleAnalysisComplete = (data) => {
    setAnalysisData(data);
    fetchHistory();
    go("results");
  };
  const authHeaders = () => token ? { Authorization: "Bearer " + token } : {};
  const showNav = screen !== "login";
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  return /* @__PURE__ */ React.createElement("div", { className: "app" }, showNav && /* @__PURE__ */ React.createElement("header", { className: "nav" }, /* @__PURE__ */ React.createElement("div", { className: "nav-left" }, /* @__PURE__ */ React.createElement("div", { onClick: () => go("dashboard"), style: { cursor: "pointer", display: "flex", alignItems: "center" } }, /* @__PURE__ */ React.createElement(Brand, { size: 24 })), /* @__PURE__ */ React.createElement("nav", { className: "nav-tabs" }, /* @__PURE__ */ React.createElement("button", { className: "nav-tab " + (screen === "dashboard" ? "active" : ""), onClick: () => go("dashboard") }, "\uD648"), /* @__PURE__ */ React.createElement("button", { className: "nav-tab " + (screen === "analyze" ? "active" : ""), onClick: () => go("analyze") }, "\uBD84\uC11D"), /* @__PURE__ */ React.createElement("button", { className: "nav-tab " + (screen === "results" ? "active" : ""), onClick: () => go("results") }, "\uB9AC\uD3EC\uD2B8"), /* @__PURE__ */ React.createElement("button", { className: "nav-tab " + (screen === "innerbeauty" ? "active" : ""), onClick: () => go("innerbeauty") }, "\uC774\uB108\uBDF0\uD2F0"))), /* @__PURE__ */ React.createElement("div", { className: "nav-right" }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement("button", { className: "nav-tab", title: "\uC54C\uB9BC", onClick: handleOpenNotifications }, /* @__PURE__ */ React.createElement(Icon, { name: "bell", size: 16 }), unreadCount > 0 && /* @__PURE__ */ React.createElement("span", { style: { position: "absolute", top: 4, right: 4, width: 6, height: 6, background: "var(--warn)", borderRadius: "50%" } })), showNotifications && /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: "100%",
    right: 0,
    width: 300,
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    zIndex: 100,
    padding: 12,
    maxHeight: 400,
    overflowY: "auto"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, marginBottom: 12 } }, "\uC54C\uB9BC (", notifications.length, ")"), notifications.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 13, textAlign: "center", padding: "20px 0" } }, "\uC0C8\uB85C\uC6B4 \uC54C\uB9BC\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") : notifications.map((n, i) => /* @__PURE__ */ React.createElement("div", { key: n.id, style: { fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)", paddingBottom: 10, borderBottom: i === notifications.length - 1 ? "none" : "1px solid var(--line-2)", position: "relative", marginTop: i > 0 ? 10 : 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, color: "var(--ink)", marginBottom: 2 } }, n.title), /* @__PURE__ */ React.createElement("div", null, n.message), /* @__PURE__ */ React.createElement("button", { onClick: () => handleDeleteNotification(n.id), style: { position: "absolute", top: 0, right: 0, background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" } }, "\u2715"))))), /* @__PURE__ */ React.createElement("button", { className: "nav-tab", title: "\uC124\uC815", onClick: () => setShowSettings(!showSettings) }, /* @__PURE__ */ React.createElement(Icon, { name: "settings", size: 16 })), /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement("div", { className: "avatar", title: user?.email || "", onClick: () => setShowAvatarMenu(!showAvatarMenu), style: { cursor: "pointer" } }, (user?.email?.[0] || "?").toUpperCase()), showAvatarMenu && /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: "100%",
    right: 0,
    width: 140,
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    zIndex: 100,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginTop: 4
  } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", style: { justifyContent: "flex-start", fontSize: 13, padding: "8px 12px", height: "auto" }, onClick: () => {
    setShowAvatarMenu(false);
    go("mypage");
  } }, "\uB9C8\uC774\uD398\uC774\uC9C0"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", style: { justifyContent: "flex-start", fontSize: 13, padding: "8px 12px", height: "auto", color: "var(--warn)" }, onClick: () => {
    setShowAvatarMenu(false);
    handleLogout();
  } }, "\uB85C\uADF8\uC544\uC6C3"))))), showSettings && /* @__PURE__ */ React.createElement("div", { style: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "var(--surface)",
    width: "90%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
  } }, /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 20px", fontSize: 18 } }, "\uC571 \uC124\uC815"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, "\uB2E4\uD06C \uBAA8\uB4DC"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12 } }, "\uC5B4\uB450\uC6B4 \uD14C\uB9C8\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.")), /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: settings.darkMode, onChange: (e) => setSettings({ ...settings, darkMode: e.target.checked }) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, "\uC54C\uB9BC \uC218\uC2E0"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12 } }, "\uD478\uC2DC \uC54C\uB9BC \uBC0F \uB9AC\uB9C8\uC778\uB354\uB97C \uBC1B\uC2B5\uB2C8\uB2E4.")), /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: settings.pushEnabled, onChange: (e) => handlePushToggle(e.target.checked) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500, marginBottom: 8 } }, "\uAE00\uC528 \uD06C\uAE30"), /* @__PURE__ */ React.createElement("select", { className: "input", value: settings.fontSize, onChange: (e) => setSettings({ ...settings, fontSize: e.target.value }), style: { width: "100%" } }, /* @__PURE__ */ React.createElement("option", { value: "\uC791\uAC8C" }, "\uC791\uAC8C"), /* @__PURE__ */ React.createElement("option", { value: "\uBCF4\uD1B5" }, "\uBCF4\uD1B5"), /* @__PURE__ */ React.createElement("option", { value: "\uD06C\uAC8C" }, "\uD06C\uAC8C")))), user && /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 4 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500, marginBottom: 12, fontSize: 13, color: "var(--ink-muted)" } }, "\uACC4\uC815 \uAD00\uB9AC"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 } }, "\uD604\uC7AC \uACC4\uC815: ", /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, user.email)), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-outline",
      style: { justifyContent: "flex-start", fontSize: 13, height: 38 },
      onClick: () => {
        handleSaveSettings(null);
        handleLogout();
      }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 14 }),
    " \uB85C\uADF8\uC544\uC6C3"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-ghost",
      style: { justifyContent: "flex-start", fontSize: 13, height: 38, color: "var(--warn)" },
      onClick: handleWithdrawal
    },
    "\uD68C\uC6D0 \uD0C8\uD1F4"
  ))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 24, textAlign: "right", display: "flex", gap: 12, justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setShowSettings(false) }, "\uCDE8\uC18C"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: () => handleSaveSettings(null) }, "\uC800\uC7A5")))), screen === "login" && /* @__PURE__ */ React.createElement(LoginScreen, { onLogin: handleLogin }), screen === "dashboard" && /* @__PURE__ */ React.createElement(
    Dashboard,
    {
      onStart: () => go("analyze"),
      onViewReport: () => go("results"),
      onViewHistoryItem: (data) => {
        setAnalysisData(data);
        go("results");
      },
      onRefreshHistory: () => fetchHistory(),
      analysisData,
      historyList
    }
  ), screen === "analyze" && /* @__PURE__ */ React.createElement(
    Analyze,
    {
      onComplete: handleAnalysisComplete,
      onBack: () => go("dashboard"),
      authHeaders: authHeaders()
    }
  ), screen === "results" && /* @__PURE__ */ React.createElement(
    Results,
    {
      data: analysisData,
      onRestart: () => go("analyze"),
      onHome: () => go("dashboard"),
      onNavigate: (s) => go(s)
    }
  ), screen === "innerbeauty" && /* @__PURE__ */ React.createElement(
    InnerBeauty,
    {
      data: analysisData,
      user,
      token,
      onHome: () => go("dashboard")
    }
  ), screen === "mypage" && /* @__PURE__ */ React.createElement(
    MyPageScreen,
    {
      userInfo: user,
      historyList,
      onViewHistoryItem: (data) => {
        setAnalysisData(data);
        go("results");
      },
      onViewReport: () => go("results"),
      onRefreshHistory: () => fetchHistory()
    }
  ));
};
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ React.createElement(App, null));
