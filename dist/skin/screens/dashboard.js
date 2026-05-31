const IngHybrid = ({ avoidList, recList }) => {
  const [tab, setTab] = React.useState("scanner");
  const [scanText, setScanText] = React.useState("");
  const [hits, setHits] = React.useState(null);
  const [ingDetails, setIngDetails] = React.useState({});
  const [loadingIng, setLoadingIng] = React.useState(null);
  const [expanded, setExpanded] = React.useState({});
  const [dictQuery, setDictQuery] = React.useState("");
  const [dictResult, setDictResult] = React.useState(null);
  const [dictLoading, setDictLoading] = React.useState(false);
  const scan = () => {
    const lower = scanText.toLowerCase();
    const found = avoidList.filter((i) => lower.includes(i.name.toLowerCase()));
    const present = recList.filter((i) => lower.includes(i.name.toLowerCase()));
    const missing = recList.filter((i) => !lower.includes(i.name.toLowerCase()));
    setHits({ found, present, missing });
    setExpanded({});
  };
  const fetchIngDetail = async (name) => {
    const key = "d_" + name;
    if (ingDetails[name]) {
      setExpanded((e) => ({ ...e, [key]: !e[key] }));
      return;
    }
    setLoadingIng(name);
    try {
      const res = await fetch(`/api/ingredient/${encodeURIComponent(name)}`);
      const data = await res.json();
      setIngDetails((d) => ({ ...d, [name]: data }));
      setExpanded((e) => ({ ...e, [key]: true }));
    } catch {
    } finally {
      setLoadingIng(null);
    }
  };
  const dictLookup = async () => {
    if (!dictQuery.trim()) return;
    setDictLoading(true);
    setDictResult(null);
    try {
      const res = await fetch(`/api/ingredient/${encodeURIComponent(dictQuery.trim())}`);
      setDictResult(await res.json());
    } catch {
      setDictResult({ description: "\uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", benefits: [], concerns: [] });
    } finally {
      setDictLoading(false);
    }
  };
  const renderDetail = (detail) => /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px 14px",
    background: "var(--surface-2)",
    fontSize: 12.5,
    color: "var(--ink-2)",
    lineHeight: 1.65
  } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6 } }, detail.description), detail.benefits && detail.benefits.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: "var(--good)" } }, "\uD6A8\uACFC: "), detail.benefits.join(" \xB7 ")), detail.concerns && detail.concerns.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: "var(--warn)" } }, "\uC8FC\uC758: "), detail.concerns.join(" \xB7 ")));
  return /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC131\uBD84 \uBD84\uC11D \xB7 INGREDIENTS"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uC131\uBD84\uD45C \uAC80\uC0AC \xB7 \uC131\uBD84 \uC0AC\uC804"))), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1px solid var(--line-2)"
  } }, [["scanner", "\uC804\uC131\uBD84 \uAC80\uC0AC", "flask"], ["dict", "\uC131\uBD84 \uC0AC\uC804", "info"]].map(([id, label, icon]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: id,
      className: "btn btn-sm " + (tab === id ? "btn-primary" : "btn-ghost"),
      onClick: () => setTab(id),
      style: { borderRadius: 999, display: "flex", alignItems: "center", gap: 5 }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 12 }),
    " ",
    label
  ))), tab === "scanner" && /* @__PURE__ */ React.createElement(React.Fragment, null, avoidList.length === 0 && recList.length === 0 && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "var(--accent-soft)",
    color: "var(--accent-ink)",
    fontSize: 12.5,
    marginBottom: 10
  } }, "\uD53C\uBD80 \uBD84\uC11D\uC744 \uC644\uB8CC\uD558\uBA74 \uAC1C\uC778 \uB9DE\uCDA4 \uC131\uBD84 \uAC80\uC0AC\uAC00 \uAC00\uB2A5\uD574\uC694. \uC9C0\uAE08\uB3C4 \uC804\uC131\uBD84 \uBD99\uC5EC\uB123\uAE30\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 10 } }, "\uC81C\uD488 \uB4B7\uBA74\uC758 \uC804\uC131\uBD84\uC744 \uBD99\uC5EC\uB123\uC73C\uBA74 \uC8FC\uC758 \uC131\uBD84 \uC5EC\uBD80\uC640 \uAD8C\uC7A5 \uC131\uBD84 \uD3EC\uD568 \uC5EC\uBD80\uB97C \uD655\uC778\uD574\uB4DC\uB824\uC694."), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      className: "input",
      rows: 4,
      placeholder: "\uC608) Water, Glycerin, Niacinamide, Ethanol, Fragrance...",
      value: scanText,
      onChange: (e) => {
        setScanText(e.target.value);
        setHits(null);
      },
      style: { width: "100%", resize: "vertical", fontSize: 12.5 }
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-primary btn-sm",
      onClick: scan,
      disabled: !scanText.trim(),
      style: { marginTop: 8 }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "flask", size: 13 }),
    " \uC131\uBD84 \uAC80\uC0AC\uD558\uAE30"
  ), hits && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, display: "flex", flexDirection: "column", gap: 10 } }, hits.found.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "var(--good-soft)",
    color: "var(--good)",
    fontSize: 13,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 13 }), " \uC8FC\uC758 \uC131\uBD84\uC774 \uBC1C\uACAC\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694") : /* @__PURE__ */ React.createElement("div", { style: { borderRadius: 10, border: "1px solid var(--warn-soft)", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    background: "var(--warn-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, color: "var(--warn)", fontSize: 13 } }, "\uC8FC\uC758 \uC131\uBD84 ", hits.found.length, "\uAC1C \uBC1C\uACAC"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--warn)" } }, "\uD074\uB9AD\uD558\uBA74 \uC0C1\uC138 \uC815\uBCF4")), hits.found.map((ing, idx) => {
    const dk = "d_" + ing.name;
    return /* @__PURE__ */ React.createElement("div", { key: idx, style: { borderTop: "1px solid rgba(168,80,51,0.12)" } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: () => fetchIngDetail(ing.name),
        style: {
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 10,
          alignItems: "center",
          padding: "10px 14px",
          cursor: "pointer",
          background: expanded[dk] ? "rgba(243,221,211,0.4)" : "var(--surface)"
        }
      },
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 13 } }, ing.name), /* @__PURE__ */ React.createElement("span", { className: "pill", style: {
        marginLeft: 8,
        background: "var(--warn-soft)",
        color: "var(--warn)",
        fontSize: 10
      } }, ing.tag)),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--ink-muted)" } }, ing.why),
      /* @__PURE__ */ React.createElement(Icon, { name: loadingIng === ing.name ? "sparkle" : expanded[dk] ? "cross" : "plus", size: 12 })
    ), expanded[dk] && ingDetails[ing.name] && renderDetail(ingDetails[ing.name]));
  })), hits.present.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { borderRadius: 10, border: "1px solid var(--good-soft)", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    background: "var(--good-soft)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, color: "var(--good)", fontSize: 13 } }, "\uAD8C\uC7A5 \uC131\uBD84 ", hits.present.length, "\uAC1C \uD3EC\uD568"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--good)" } }, "\uD074\uB9AD\uD558\uBA74 \uD6A8\uB2A5 \uD655\uC778")), hits.present.map((ing, idx) => {
    const dk = "d_" + ing.name;
    return /* @__PURE__ */ React.createElement("div", { key: idx, style: { borderTop: "1px solid rgba(91,117,83,0.12)" } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: () => fetchIngDetail(ing.name),
        style: {
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 10,
          alignItems: "center",
          padding: "10px 14px",
          cursor: "pointer",
          background: expanded[dk] ? "rgba(227,234,222,0.4)" : "var(--surface)"
        }
      },
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, fontSize: 13 } }, ing.name), /* @__PURE__ */ React.createElement("span", { className: "pill", style: {
        marginLeft: 8,
        background: "var(--good-soft)",
        color: "var(--good)",
        fontSize: 10
      } }, ing.tag)),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--ink-muted)" } }, ing.why),
      /* @__PURE__ */ React.createElement(Icon, { name: loadingIng === ing.name ? "sparkle" : expanded[dk] ? "cross" : "plus", size: 12 })
    ), expanded[dk] && ingDetails[ing.name] && renderDetail(ingDetails[ing.name]));
  })), hits.missing.length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "var(--bg-2)",
    border: "1px solid var(--line-2)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500, color: "var(--ink-2)", fontSize: 12.5, marginBottom: 8 } }, "\uC774 \uC81C\uD488\uC5D0 \uC5C6\uB294 \uAD8C\uC7A5 \uC131\uBD84 (", hits.missing.length, "\uAC1C) \u2014 \uC131\uBD84\uBA85 \uD074\uB9AD \uC2DC \uC815\uBCF4 \uD655\uC778"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, hits.missing.map((ing, idx) => {
    const dk = "d_" + ing.name;
    return /* @__PURE__ */ React.createElement("div", { key: idx }, /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: () => fetchIngDetail(ing.name),
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12.5,
          cursor: "pointer",
          padding: "4px 0"
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500 } }, ing.name, /* @__PURE__ */ React.createElement("span", { className: "pill", style: { marginLeft: 6, fontSize: 10 } }, ing.tag)),
      /* @__PURE__ */ React.createElement("span", { style: {
        color: "var(--ink-muted)",
        fontSize: 11.5,
        display: "flex",
        alignItems: "center",
        gap: 4
      } }, ing.why, /* @__PURE__ */ React.createElement(Icon, { name: loadingIng === ing.name ? "sparkle" : expanded[dk] ? "cross" : "plus", size: 11 }))
    ), expanded[dk] && ingDetails[ing.name] && renderDetail(ingDetails[ing.name]));
  }))))), tab === "dict" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 10 } }, "\uAD81\uAE08\uD55C \uD654\uC7A5\uD488 \uC131\uBD84 \uC774\uB984\uC744 \uC785\uB825\uD558\uBA74 \uC124\uBA85, \uD6A8\uACFC, \uC8FC\uC758\uC0AC\uD56D\uC744 \uC54C\uB824\uB4DC\uB824\uC694."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "input",
      value: dictQuery,
      onChange: (e) => setDictQuery(e.target.value),
      onKeyDown: (e) => e.key === "Enter" && dictLookup(),
      placeholder: "\uC131\uBD84\uBA85 \uC785\uB825 (\uC608: \uB098\uC774\uC544\uC2E0\uC544\uB9C8\uC774\uB4DC)",
      style: { flex: 1, fontSize: 13 }
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-outline btn-sm",
      onClick: dictLookup,
      disabled: dictLoading || !dictQuery.trim()
    },
    dictLoading ? "\u2026" : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Icon, { name: "info", size: 13 }), " \uC870\uD68C")
  )), dictResult && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 12,
    padding: "14px 16px",
    borderRadius: 12,
    background: "var(--surface-2)",
    border: "1px solid var(--line-2)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--serif-ko)", fontSize: 16, fontWeight: 500, marginBottom: 8 } }, dictQuery), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 10 } }, dictResult.description), dictResult.benefits && dictResult.benefits.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, fontWeight: 600, color: "var(--good)", marginBottom: 4 } }, "\uD6A8\uACFC"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, dictResult.benefits.map((b, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: {
    padding: "3px 9px",
    borderRadius: 999,
    background: "var(--good-soft)",
    color: "var(--good)",
    fontSize: 12
  } }, b)))), dictResult.concerns && dictResult.concerns.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, fontWeight: 600, color: "var(--warn)", marginBottom: 4 } }, "\uC8FC\uC758\uC0AC\uD56D"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, dictResult.concerns.map((c, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: {
    padding: "3px 9px",
    borderRadius: 999,
    background: "var(--warn-soft)",
    color: "var(--warn)",
    fontSize: 12
  } }, c)))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 } }, dictResult.suitable_for && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "8px 10px",
    borderRadius: 8,
    background: "var(--surface)",
    border: "1px solid var(--line-2)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10.5, color: "var(--ink-faint)", marginBottom: 2 } }, "\uC801\uD569 \uD53C\uBD80"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 500 } }, dictResult.suitable_for)), dictResult.found_in && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "8px 10px",
    borderRadius: 8,
    background: "var(--surface)",
    border: "1px solid var(--line-2)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10.5, color: "var(--ink-faint)", marginBottom: 2 } }, "\uC8FC\uC0AC\uC6A9 \uC81C\uD488"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 500 } }, dictResult.found_in)), dictResult.concentration && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "8px 10px",
    borderRadius: 8,
    background: "var(--surface)",
    border: "1px solid var(--line-2)",
    gridColumn: "1/-1"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10.5, color: "var(--ink-faint)", marginBottom: 2 } }, "\uC77C\uBC18 \uC0AC\uC6A9 \uB18D\uB3C4"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 500 } }, dictResult.concentration))))));
};
const Dashboard = ({ onStart, onViewReport, onViewHistoryItem, onRefreshHistory, analysisData, historyList }) => {
  const hasData = !!(analysisData && analysisData.composite_score != null);
  const lastScore = hasData ? analysisData.composite_score : null;
  const lastSkin = hasData ? analysisData.skin_type_label : null;
  const attrs = hasData ? analysisData.attributes || [] : [];
  const goodIngs = hasData ? analysisData.recommended_ingredients || [] : [];
  const attrPills = attrs.filter((a) => a.level !== "mid").slice(0, 4).map((a) => ({
    label: a.short + (a.level === "hi" ? " \u2191" : " \u2193"),
    hi: a.level === "hi"
  }));
  const MOCK_CARE = [
    { n: "01", t: "\uC7A5\uBCBD \uD68C\uBCF5", d: "\uC138\uB77C\uB9C8\uC774\uB4DC \uD568\uC720 \uD06C\uB9BC \uC57C\uAC04 \uC0AC\uC6A9", c: "var(--accent-soft)", ic: "var(--accent-ink)" },
    { n: "02", t: "\uC218\uBD84 \uCDA9\uC804", d: "\uC800\uBD84\uC790 \uD788\uC54C\uB8E8\uB860\uC0B0 \uD1A0\uB108 2\uD68C/\uC77C", c: "var(--good-soft)", ic: "var(--good)" },
    { n: "03", t: "\uC790\uADF9 \uD68C\uD53C", d: "\uC5D0\uD0C4\uC62C\xB7\uD5A5\uB8CC \uD568\uC720 \uC81C\uD488 \uC77C\uC2DC \uC911\uB2E8", c: "var(--bg-2)", ic: "var(--ink-2)" }
  ];
  const careSteps = goodIngs.length >= 3 ? goodIngs.slice(0, 3).map((ing, i) => ({
    n: String(i + 1).padStart(2, "0"),
    t: ing.name,
    d: ing.why || ing.tag || "",
    c: ["var(--accent-soft)", "var(--good-soft)", "var(--bg-2)"][i],
    ic: ["var(--accent-ink)", "var(--good)", "var(--ink-2)"][i]
  })) : MOCK_CARE;
  const displayHistory = historyList || [];
  const gradients = [
    "linear-gradient(135deg, #E8C9B5, #C9624A)",
    "linear-gradient(135deg, #DECBB1, #A88262)",
    "linear-gradient(135deg, #D7C8B2, #8C7660)",
    "linear-gradient(135deg, #E2D3B8, #C29A6F)"
  ];
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  return /* @__PURE__ */ React.createElement("div", { className: "page", "data-screen-label": "02 Dashboard" }, /* @__PURE__ */ React.createElement("div", { className: "hero" }, /* @__PURE__ */ React.createElement("div", { className: "hero-main" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "overline" }, "\uC624\uB298\uC758 \uCD94\uCC9C \xB7 ", today), /* @__PURE__ */ React.createElement("h1", { className: "heading" }, hasData ? /* @__PURE__ */ React.createElement(React.Fragment, null, "\uBD84\uC11D\uC774 \uC644\uB8CC\uB410\uC5B4\uC694.", /* @__PURE__ */ React.createElement("br", null), "\uACB0\uACFC\uB97C \uD655\uC778\uD574\uBCFC\uAE4C\uC694?") : /* @__PURE__ */ React.createElement(React.Fragment, null, "\uC548\uB155\uD558\uC138\uC694.", /* @__PURE__ */ React.createElement("br", null), "\uC624\uB298\uC758 ", /* @__PURE__ */ React.createElement("em", null, "\uD53C\uBD80 \uBD84\uC11D"), "\uC744 \uC2DC\uC791\uD574\uBCFC\uAE4C\uC694?"))), /* @__PURE__ */ React.createElement("div", { className: "actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary btn-lg", onClick: onStart }, /* @__PURE__ */ React.createElement(Icon, { name: "camera", size: 15 }), " ", hasData ? "\uC0C8 \uBD84\uC11D \uC2DC\uC791" : "\uBD84\uC11D \uC2DC\uC791\uD558\uAE30"), hasData && /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost btn-lg", onClick: onViewReport }, "\uCD5C\uADFC \uB9AC\uD3EC\uD2B8 \uBCF4\uAE30"))), /* @__PURE__ */ React.createElement("div", { className: "hero-stat" }, hasData ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow-serif" }, "\uCD5C\uADFC \uC885\uD569 \uC810\uC218"), /* @__PURE__ */ React.createElement("div", { className: "last-row", style: { marginTop: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "score-big" }, lastScore, /* @__PURE__ */ React.createElement("sup", null, "/100")), historyList.length > 1 && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 12, color: historyList[0].up ? "var(--good)" : "var(--warn)" } }, historyList[0].delta, " ", historyList[0].up ? "\u25B2" : "\u25BC"), /* @__PURE__ */ React.createElement("div", { className: "faint", style: { fontSize: 11.5 } }, "\uC9C0\uB09C \uBD84\uC11D \uB300\uBE44"))), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12.5, marginTop: 8 } }, lastSkin)), /* @__PURE__ */ React.createElement("div", { className: "pill-row" }, attrPills.length > 0 ? attrPills.map((p, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "pill", style: {
    background: p.hi ? "var(--warn-soft)" : "var(--good-soft)",
    color: p.hi ? "var(--warn)" : "var(--good)"
  } }, p.label)) : /* @__PURE__ */ React.createElement("span", { className: "pill muted", style: { fontSize: 12 } }, "\uC18D\uC131 \uB370\uC774\uD130 \uC5C6\uC74C"))) : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC544\uC9C1 \uBD84\uC11D \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 } }, "\uC0AC\uC9C4 \uD55C \uC7A5\uACFC \uAC04\uB2E8\uD55C \uD3FC \uC791\uC131\uC73C\uB85C", /* @__PURE__ */ React.createElement("br", null), "\uB9DE\uCDA4 \uD53C\uBD80 \uBD84\uC11D\uC744 \uBC1B\uC544\uBCF4\uC138\uC694."), /* @__PURE__ */ React.createElement("button", { className: "btn btn-accent btn-sm", onClick: onStart }, /* @__PURE__ */ React.createElement(Icon, { name: "sparkle", size: 13 }), " \uC9C0\uAE08 \uC2DC\uC791\uD558\uAE30")))), /* @__PURE__ */ React.createElement("div", { className: "dash-grid" }, /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC774\uBC88 \uC8FC \uCD94\uCC9C"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uCF00\uC5B4 \uC6B0\uC120\uC21C\uC704")), hasData && /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: onViewReport }, "\uB9AC\uD3EC\uD2B8 \uBCF4\uAE30 ", /* @__PURE__ */ React.createElement(Icon, { name: "arrowRight", size: 13 }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 } }, careSteps.map((it, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "card-flat", style: { background: it.c, borderColor: "transparent" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: it.ic, letterSpacing: "0.1em" } }, it.n), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, fontWeight: 600, marginTop: 6 } }, it.t), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12, marginTop: 6, lineHeight: 1.5 } }, it.d))))), /* @__PURE__ */ React.createElement(
    IngHybrid,
    {
      avoidList: analysisData && analysisData.avoid_ingredients || [],
      recList: analysisData && analysisData.recommended_ingredients || []
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("div", { className: "card", style: {
    background: "linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)"
  } }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC11C\uBE44\uC2A4 \uC18C\uAC1C"), /* @__PURE__ */ React.createElement("h3", { className: "h2-serif", style: { margin: "4px 0 14px" } }, "\uC5B4\uB5BB\uAC8C \uBD84\uC11D\uD558\uB098\uC694?"), /* @__PURE__ */ React.createElement("div", { className: "col-gap" }, [
    { label: "\uC0AC\uC9C4 \uBD84\uC11D", sub: "AI\uAC00 \uD53C\uBD80 \uC18D\uC131 7\uAC00\uC9C0\uB97C \uB3D9\uC2DC\uC5D0 \uBD84\uC11D\uD574\uC694", tag: "\uC774\uBBF8\uC9C0 AI", icn: "camera" },
    { label: "\uC131\uBD84 \uB9E4\uCE6D", sub: "\uD53C\uBD80\uC5D0 \uB9DE\uB294 \uC131\uBD84\uACFC \uD53C\uD574\uC57C \uD560 \uC131\uBD84\uC744 \uCC3E\uC544\uC694", tag: "\uC131\uBD84 DB", icn: "flask" },
    { label: "\uC81C\uD488 \uCD94\uCC9C", sub: "\uC2DD\uC57D\uCC98 \uAE30\uB2A5\uC131 \uD654\uC7A5\uD488 \uC911 \uB9DE\uB294 \uC81C\uD488\uC744 \uACE8\uB77C\uC694", tag: "\uCD94\uCC9C", icn: "leaf" },
    { label: "\uBD84\uC11D \uC694\uC57D", sub: "\uACB0\uACFC\uB97C \uC774\uD574\uD558\uAE30 \uC27D\uAC8C \uC815\uB9AC\uD574\uB4DC\uB824\uC694", tag: "\uB9AC\uD3EC\uD2B8", icn: "sparkle" }
  ].map((p, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 12,
    alignItems: "center",
    padding: "10px 12px",
    background: "var(--surface)",
    border: "1px solid var(--line-2)",
    borderRadius: 12
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "var(--bg-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--ink-2)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: p.icn, size: 16 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13.5, fontWeight: 500 } }, p.label), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 11.5 } }, p.sub)), /* @__PURE__ */ React.createElement("span", { className: "pill" }, p.tag))))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC65C \uB2E4\uB978\uAC00\uC694?"), /* @__PURE__ */ React.createElement("h3", { className: "h2-serif", style: { margin: "4px 0 12px" } }, "\uC774 \uC11C\uBE44\uC2A4\uC758 \uD2B9\uC9D5"), /* @__PURE__ */ React.createElement("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 } }, [
    "\uD55C\uAD6D\uC778 \uD53C\uBD80 \uB370\uC774\uD130\uB85C \uD559\uC2B5\uD55C AI",
    "\uC2DD\uC57D\uCC98 \uACF5\uACF5 \uB370\uC774\uD130 \uAE30\uBC18 \u2014 \uC548\uC804\uD55C \uC131\uBD84 \uCD94\uCC9C",
    "\uC0AC\uC9C4 + \uC124\uBB38 \uD568\uAED8 \uBD84\uC11D\uD574 \uB354 \uC815\uD655\uD574\uC694",
    "\uD53C\uD574\uC57C \uD560 \uC131\uBD84\uB3C4 \uD568\uAED8 \uC54C\uB824\uB4DC\uB824\uC694",
    "\uACB0\uACFC\uB97C \uB9AC\uD3EC\uD2B8\uB85C \uC800\uC7A5\uD560 \uC218 \uC788\uC5B4\uC694"
  ].map((t, i) => /* @__PURE__ */ React.createElement("li", { key: i, style: { display: "grid", gridTemplateColumns: "18px 1fr", gap: 10, fontSize: 13, lineHeight: 1.5 } }, /* @__PURE__ */ React.createElement("span", { style: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "var(--accent-soft)",
    color: "var(--accent-ink)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 11, stroke: 2.2 })), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)" } }, t))))))));
};
window.Dashboard = Dashboard;
