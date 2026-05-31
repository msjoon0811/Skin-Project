const HistoryList = ({ displayHistory, onViewHistoryItem, onViewReport, onRefreshHistory }) => {
  const [loadingId, setLoadingId] = React.useState(null);
  const gradients = [
    "linear-gradient(135deg, #FFB7A1 0%, #FFD6C9 100%)",
    "linear-gradient(135deg, #A1C4FF 0%, #C9DFFF 100%)",
    "linear-gradient(135deg, #A1FFB7 0%, #C9FFD6 100%)",
    "linear-gradient(135deg, #FFFFA1 0%, #FFFFC9 100%)"
  ];
  const handleClick = async (h) => {
    const id = h.id || h.analysisId;
    if (!id || !onViewHistoryItem) {
      onViewReport && onViewReport();
      return;
    }
    setLoadingId(id);
    try {
      const token = localStorage.getItem("skin_token");
      const headers = token ? { Authorization: "Bearer " + token } : {};
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
    if (!window.confirm("\uC774 \uBD84\uC11D \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
    const id = h.id || h.analysisId;
    try {
      const token = localStorage.getItem("skin_token");
      const headers = token ? { Authorization: "Bearer " + token } : {};
      const res = await fetch(`/api/history/${id}`, { method: "DELETE", headers });
      if (res.ok && onRefreshHistory) {
        onRefreshHistory();
      } else {
        alert("\uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
      }
    } catch {
      alert("\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  };
  if (displayHistory.length === 0) {
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "28px 0", textAlign: "center", color: "var(--ink-muted)", fontSize: 13 } }, "\uC544\uC9C1 \uBD84\uC11D \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }
  return /* @__PURE__ */ React.createElement("div", { className: "history-list" }, displayHistory.map((h, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "history-row",
      onClick: () => handleClick(h),
      style: { flex: 1, cursor: "pointer", transition: "background .12s ease", position: "relative" },
      onMouseEnter: (e) => e.currentTarget.style.background = "var(--bg-2)",
      onMouseLeave: (e) => e.currentTarget.style.background = ""
    },
    /* @__PURE__ */ React.createElement("div", { className: "thumb", style: { background: gradients[i % gradients.length] } }),
    /* @__PURE__ */ React.createElement("div", { className: "meta" }, /* @__PURE__ */ React.createElement("span", { className: "date" }, h.date), /* @__PURE__ */ React.createElement("span", { className: "title" }, h.label), h.skinLabel && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "var(--ink-faint)" } }, h.skinLabel)),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 600, minWidth: 32, textAlign: "right" } }, h.score), h.delta && /* @__PURE__ */ React.createElement("span", { className: "delta " + (h.up ? "" : "down") }, h.delta, " ", h.up ? "\u25B2" : "\u25BC")),
    /* @__PURE__ */ React.createElement("span", { className: "arrow", style: { color: loadingId === (h.id || h.analysisId) ? "var(--accent)" : "var(--ink-faint)" } }, loadingId === (h.id || h.analysisId) ? "\u2026" : "\u203A")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-ghost",
      style: { padding: 8, height: "auto", minHeight: 0, color: "var(--warn)", flexShrink: 0 },
      onClick: (e) => handleDelete(e, h),
      title: "\uAE30\uB85D \uC0AD\uC81C"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "cross", size: 14, stroke: 2.5 })
  ))));
};
const MyPageScreen = ({ userInfo, historyList, onViewHistoryItem, onViewReport, onRefreshHistory }) => {
  const [showAllHistory, setShowAllHistory] = React.useState(false);
  const [wishlist, setWishlist] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const fetchWishlist = async () => {
    try {
      const token = localStorage.getItem("skin_token");
      const res = await fetch("/api/me/wishlist", {
        headers: token ? { Authorization: "Bearer " + token } : {}
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
      const token = localStorage.getItem("skin_token");
      const res = await fetch(`/api/me/wishlist/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: "Bearer " + token } : {}
      });
      if (res.ok) {
        fetchWishlist();
      }
    } catch (e) {
      alert("\uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  };
  const displayHistory = historyList || [];
  const totalAnalyses = displayHistory.length;
  const visibleHistory = showAllHistory ? displayHistory : displayHistory.slice(0, 3);
  const latestScore = totalAnalyses > 0 ? displayHistory[0].score : "-";
  const latestSkinType = totalAnalyses > 0 ? displayHistory[0].skinLabel : "\uBD84\uC11D \uC804";
  return /* @__PURE__ */ React.createElement("div", { className: "page pb-safe", "data-screen-label": "05 MyPage" }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { marginTop: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "var(--accent-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--accent)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "user", size: 30 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uB098\uC758 \uD53C\uBD80 \uD504\uB85C\uD544"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0" } }, userInfo?.email || "\uB85C\uADF8\uC778 \uD544\uC694"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 13 } }, "\uCD1D ", totalAnalyses, "\uD68C \uBD84\uC11D \uC644\uB8CC"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12, marginTop: 20 } }, /* @__PURE__ */ React.createElement("div", { className: "card-flat", style: { flex: 1, textAlign: "center", padding: "16px 12px" } }, /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12, marginBottom: 4 } }, "\uCD5C\uADFC \uC885\uD569 \uC810\uC218"), /* @__PURE__ */ React.createElement("div", { className: "score-big", style: { fontSize: 28 } }, latestScore, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, color: "var(--ink-muted)" } }, "/100"))), /* @__PURE__ */ React.createElement("div", { className: "card-flat", style: { flex: 1, textAlign: "center", padding: "16px 12px" } }, /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12, marginBottom: 4 } }, "\uD604\uC7AC \uD53C\uBD80 \uD0C0\uC785"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 600, marginTop: 8, color: "var(--ink)" } }, latestSkinType)))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { marginTop: 20 } }, /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "REPORT"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uC7A5\uAE30 \uBCC0\uD654 \uD2B8\uB80C\uB4DC"))), displayHistory.length >= 2 ? (() => {
    const pts = [...displayHistory].reverse();
    const W = 460, H = 100, pad = 16;
    const scores = pts.map((p) => p.score);
    const minS = Math.min(...scores) - 10;
    const maxS = Math.max(...scores) + 10;
    const x = (i) => pad + i / (pts.length - 1) * (W - pad * 2);
    const y = (v) => H - pad - (v - minS) / (maxS - minS) * (H - pad * 2);
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
    const area = `${d} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
    return /* @__PURE__ */ React.createElement("div", { style: { background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)", padding: "16px 0" } }, /* @__PURE__ */ React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", height: H, display: "block", overflow: "visible" } }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "trendGradMy", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "var(--accent)", stopOpacity: "0.2" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "var(--accent)", stopOpacity: "0" }))), /* @__PURE__ */ React.createElement("path", { d: area, fill: "url(#trendGradMy)" }), /* @__PURE__ */ React.createElement("path", { d, fill: "none", stroke: "var(--accent)", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }), pts.map((p, i) => /* @__PURE__ */ React.createElement("g", { key: i }, /* @__PURE__ */ React.createElement("circle", { cx: x(i), cy: y(p.score), r: "4.5", fill: "var(--surface)", stroke: "var(--accent)", strokeWidth: "2" }), /* @__PURE__ */ React.createElement("text", { x: x(i), y: y(p.score) - 10, textAnchor: "middle", style: { fontFamily: "var(--mono)", fontSize: 11, fill: "var(--ink-2)" } }, p.score)))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "0 16px", marginTop: 12 } }, pts.map((p, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)" } }, p.date.slice(5, 10).replace("-", "/")))));
  })() : /* @__PURE__ */ React.createElement("div", { style: { padding: "30px 0", textAlign: "center", color: "var(--ink-muted)", fontSize: 13, background: "var(--surface-2)", borderRadius: 12 } }, "\uC544\uC9C1 \uCD94\uC774\uB97C \uBD84\uC11D\uD560 \uB9CC\uD07C \uAE30\uB85D\uC774 \uC313\uC774\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", /* @__PURE__ */ React.createElement("br", null), "\uAFB8\uC900\uD788 \uD53C\uBD80\uB97C \uAE30\uB85D\uD574\uBCF4\uC138\uC694!")), /* @__PURE__ */ React.createElement("div", { className: "card", style: { marginTop: 20 } }, /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "HISTORY"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uACFC\uAC70 \uBD84\uC11D \uAE30\uB85D")), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-muted)" } }, "\uCD1D ", totalAnalyses, "\uD68C")), /* @__PURE__ */ React.createElement(
    HistoryList,
    {
      displayHistory: visibleHistory,
      onViewHistoryItem,
      onViewReport,
      onRefreshHistory
    }
  ), displayHistory.length > 3 && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-outline",
      style: { width: "100%", marginTop: 12, fontSize: 13, padding: 10 },
      onClick: () => setShowAllHistory(!showAllHistory)
    },
    showAllHistory ? "\uC811\uAE30 \u25B3" : `\uB354\uBCF4\uAE30 (${displayHistory.length - 3}\uAC1C) \u25BD`
  )), /* @__PURE__ */ React.createElement("div", { className: "card", style: { marginTop: 20 } }, /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "WISHLIST"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uB098\uC758 \uC704\uC2DC\uB9AC\uC2A4\uD2B8"))), loading ? /* @__PURE__ */ React.createElement("div", { style: { padding: 20, textAlign: "center", color: "var(--ink-muted)", fontSize: 13 } }, "\uBD88\uB7EC\uC624\uB294 \uC911...") : wishlist.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: 30, textAlign: "center", color: "var(--ink-muted)", fontSize: 13, border: "1px dashed var(--line-2)", borderRadius: 12 } }, "\uC800\uC7A5\uB41C \uC2A4\uD06C\uB7A9 \uD56D\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", /* @__PURE__ */ React.createElement("br", null), "\uBD84\uC11D \uACB0\uACFC\uC5D0\uC11C \u2661 \uC544\uC774\uCF58\uC744 \uB20C\uB7EC \uCD94\uAC00\uD574\uBCF4\uC138\uC694.") : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16 } }, ["product", "treatment"].map((type) => {
    const items = wishlist.filter((c) => c.item_type === type);
    if (items.length === 0) return null;
    const typeLabel = type === "product" ? "\u{1F484} \uCD94\uCC9C \uC81C\uD488" : "\u{1F486}\u200D\u2640\uFE0F \uCD94\uCC9C \uD53C\uBD80\uACFC \uC2DC\uC220";
    return /* @__PURE__ */ React.createElement("div", { key: type }, /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12, marginBottom: 8, fontWeight: 500 } }, typeLabel), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, items.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.id, style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      border: "1px solid var(--line)",
      borderRadius: 10,
      background: "var(--surface)"
    } }, /* @__PURE__ */ React.createElement("div", null, item.subtitle && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: type === "treatment" ? "var(--accent)" : "var(--ink-muted)", marginBottom: 2 } }, item.subtitle), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 500, color: "var(--ink)" } }, item.title)), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => handleDelete(item.id),
        style: { background: "none", border: "none", color: "#e53935", cursor: "pointer", padding: 4 }
      },
      /* @__PURE__ */ React.createElement(Icon, { name: "heart-fill", size: 18 })
    )))));
  }))));
};
window.MyPageScreen = MyPageScreen;
