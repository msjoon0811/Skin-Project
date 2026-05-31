const InnerBeauty = ({ data, user, token, onHome }) => {
  const foods = data ? data.foods || [] : [];
  const [diary, setDiary] = React.useState([]);
  if (!data) {
    return /* @__PURE__ */ React.createElement("div", { className: "page", style: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "\u{1F957}"), /* @__PURE__ */ React.createElement("div", { className: "h2-serif", style: { marginBottom: 8 } }, "\uCD94\uCC9C \uC2DD\uB2E8\uC774 \uC5C6\uC2B5\uB2C8\uB2E4"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { textAlign: "center", fontSize: 13, lineHeight: 1.5, marginBottom: 24 } }, "\uD53C\uBD80 \uBD84\uC11D\uC744 \uC644\uB8CC\uD574\uC57C \uB9DE\uCDA4 \uC2DD\uB2E8\uC744 \uCD94\uCC9C\uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", /* @__PURE__ */ React.createElement("br", null), "\uD648\uC5D0\uC11C \uC0AC\uC9C4 \uBD84\uC11D\uC744 \uBA3C\uC800 \uC2DC\uC791\uD574\uBCF4\uC138\uC694!"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: onHome, style: { width: 200 } }, "\uD648\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30"));
  }
  React.useEffect(() => {
    if (user && token) {
      fetch("/api/me/diary", { headers: { Authorization: "Bearer " + token } }).then((r) => r.ok ? r.json() : null).then((d) => {
        if (d && d.items) setDiary(d.items);
      }).catch(() => {
      });
    } else {
      setDiary([]);
    }
  }, [user, token]);
  const [newLog, setNewLog] = React.useState("");
  const handleAddLog = () => {
    if (!newLog.trim() || !user || !token) return;
    const newId = Date.now().toString();
    const entry = { id: newId, date: "\uC624\uB298", food: newLog, skin_effect: "\uBD84\uC11D \uB300\uAE30 \uC911...", notes: "" };
    setDiary([entry, ...diary]);
    setNewLog("");
    fetch("/api/me/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(entry)
    }).catch(() => {
    });
  };
  const handleDeleteLog = (id) => {
    if (!window.confirm("\uC774 \uC2DD\uB2E8 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
    setDiary(diary.filter((d) => d.id !== id));
    if (token) {
      fetch("/api/me/diary/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token } }).catch(() => {
      });
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "page", "data-screen-label": "05 InnerBeauty" }, /* @__PURE__ */ React.createElement("div", { className: "result-banner" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC774\uB108\uBDF0\uD2F0 & \uC2DD\uB2E8"), /* @__PURE__ */ React.createElement("div", { className: "skin-type", style: { marginTop: 6 } }, "\uC18D\uBD80\uD130 \uCC44\uC6B0\uB294 \uD53C\uBD80 \uAD00\uB9AC \u{1F957}"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "0 20px", maxWidth: 600, margin: "0 auto" } }, /* @__PURE__ */ React.createElement("div", { style: { marginTop: 40, marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: 0 } }, "\uD53C\uBD80\uC5D0 \uC88B\uC740 \uB9DE\uCDA4 \uC74C\uC2DD"), /* @__PURE__ */ React.createElement("p", { className: "muted", style: { margin: 0 } }, "\uBD84\uC11D \uACB0\uACFC\uB97C \uBC14\uD0D5\uC73C\uB85C \uD604\uC7AC \uD53C\uBD80\uC5D0 \uAF2D \uD544\uC694\uD55C \uC601\uC591\uC18C\uB97C \uCC44\uC6CC\uC8FC\uB294 \uC74C\uC2DD\uC785\uB2C8\uB2E4.")), foods.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, foods.map((food, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "card", style: { padding: 20, display: "flex", alignItems: "flex-start", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 24, marginTop: -4 } }, i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : "\u{1F949}"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { margin: "0 0 6px", fontSize: 16, color: "var(--ink)" } }, food.food_name || food.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-2)", marginBottom: 8 } }, food.key_nutrients && /* @__PURE__ */ React.createElement("span", { style: { marginRight: 6, background: "var(--surface-2)", padding: "2px 8px", borderRadius: 4 } }, food.key_nutrients), food.tags && food.tags.map((t) => /* @__PURE__ */ React.createElement("span", { key: t, style: { marginRight: 6, background: "var(--surface-2)", padding: "2px 8px", borderRadius: 4 } }, t))), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.5 } }, food.reason))))) : /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 24, textAlign: "center", color: "var(--ink-muted)" } }, "\uCD94\uCC9C \uC74C\uC2DD \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uD53C\uBD80 \uBD84\uC11D\uC744 \uC9C4\uD589\uD574\uC8FC\uC138\uC694."), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 40, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: 0 } }, "\uC8FC\uC758\uD574\uC57C \uD560 \uC2DD\uC2B5\uAD00 \u26A0\uFE0F")), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 20, borderLeft: "4px solid var(--warn)" } }, /* @__PURE__ */ React.createElement("h3", { style: { margin: "0 0 8px", fontSize: 15, color: "var(--ink)" } }, "\uB2F9\uB958 \uACFC\uB2E4 \uC12D\uCDE8 \uBC0F \uC57C\uC2DD \uC8FC\uC758"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 } }, "\uD604\uC7AC \uD53C\uC9C0 \uBD84\uBE44\uB7C9\uC774 \uB2E4\uC18C \uB192\uAC8C \uCE21\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC561\uC0C1\uACFC\uB2F9\uC774 \uB9CE\uC740 \uC74C\uB8CC\uB098 \uB2A6\uC740 \uC2DC\uAC04\uC758 \uC57C\uC2DD\uC740 \uD53C\uC9C0\uC120\uC744 \uC790\uADF9\uD558\uC5EC \uD2B8\uB7EC\uBE14\uC744 \uC720\uBC1C\uD560 \uC218 \uC788\uC73C\uB2C8 \uC12D\uCDE8\uB97C \uC904\uC774\uB294 \uAC83\uC774 \uC88B\uC2B5\uB2C8\uB2E4.")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 40, marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: 0 } }, "\uD53C\uBD80 \uC2DD\uB2E8 \uC77C\uAE30 \u270D\uFE0F"), /* @__PURE__ */ React.createElement("p", { className: "muted", style: { margin: 0 } }, "\uC624\uB298 \uBA39\uC740 \uC74C\uC2DD\uC744 \uAE30\uB85D\uD558\uACE0 \uD53C\uBD80 \uC0C1\uD0DC\uC640\uC758 \uC0C1\uAD00\uAD00\uACC4\uB97C \uD30C\uC545\uD574 \uBCF4\uC138\uC694.")), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 20 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      className: "input",
      placeholder: "\uC624\uB298 \uC5B4\uB5A4 \uC74C\uC2DD\uC744 \uB4DC\uC168\uB098\uC694?",
      style: { flex: 1 },
      value: newLog,
      onChange: (e) => setNewLog(e.target.value),
      onKeyDown: (e) => e.key === "Enter" && handleAddLog()
    }
  ), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: handleAddLog }, "\uAE30\uB85D")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, diary.map((d) => /* @__PURE__ */ React.createElement("div", { key: d.id, style: {
    background: "var(--bg)",
    padding: 16,
    borderRadius: 12,
    border: "1px solid var(--line-2)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink)" } }, d.food || d.content), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: d.bad ? "var(--warn)" : "var(--accent)" } }, d.skin_effect || d.effect)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "var(--ink)" } }, d.notes), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-ghost",
      style: { padding: 8, height: "auto", minHeight: 0, color: "var(--warn)", flexShrink: 0, marginRight: -8, marginBottom: -8 },
      onClick: () => handleDeleteLog(d.id),
      title: "\uAE30\uB85D \uC0AD\uC81C"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "cross", size: 14, stroke: 2.5 })
  )))))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 40, paddingBottom: 60, textAlign: "center" } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: onHome }, "\uD648\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30"))));
};
