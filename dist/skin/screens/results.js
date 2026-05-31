const Results = ({ data, onRestart, onHome, onNavigate }) => {
  const [wishlist, setWishlist] = React.useState([]);
  React.useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const token = localStorage.getItem("skin_token");
        if (!token) return;
        const res = await fetch("/api/me/wishlist", { headers: { Authorization: "Bearer " + token } });
        if (res.ok) {
          setWishlist(await res.json());
        }
      } catch (e) {
      }
    };
    fetchWishlist();
  }, []);
  const toggleWishlist = async (type, title, subtitle) => {
    const existing = wishlist.find((w) => w.item_type === type && w.title === title);
    const token = localStorage.getItem("skin_token");
    if (!token) {
      alert("\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    if (existing) {
      await fetch(`/api/me/wishlist/${existing.id}`, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
    } else {
      await fetch("/api/me/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ item_type: type, title, subtitle })
      });
    }
    if (existing) {
      setWishlist(wishlist.filter((w) => w.id !== existing.id));
    } else {
      const res = await fetch("/api/me/wishlist", { headers: { Authorization: "Bearer " + token } });
      if (res.ok) setWishlist(await res.json());
    }
  };
  const isWishlisted = (type, title) => wishlist.some((w) => w.item_type === type && w.title === title);
  if (!data) {
    return /* @__PURE__ */ React.createElement("div", { className: "page", style: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: 20 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "\u{1F4CA}"), /* @__PURE__ */ React.createElement("div", { className: "h2-serif", style: { marginBottom: 8 } }, "\uBD84\uC11D \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { textAlign: "center", fontSize: 13, lineHeight: 1.5, marginBottom: 24 } }, "\uC544\uC9C1 \uD53C\uBD80 \uBD84\uC11D\uC744 \uC9C4\uD589\uD558\uC9C0 \uC54A\uC73C\uC168\uC2B5\uB2C8\uB2E4.", /* @__PURE__ */ React.createElement("br", null), "\uD648\uC5D0\uC11C \uC0AC\uC9C4 \uBD84\uC11D\uC744 \uBA3C\uC800 \uC2DC\uC791\uD574\uBCF4\uC138\uC694!"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: onHome, style: { width: 200 } }, "\uD648\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30"));
  }
  const [foodPage, setFoodPage] = React.useState(0);
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, "\xB7").replace(".", "");
  const attrs = data ? data.attributes || ATTRIBUTES : ATTRIBUTES;
  const composite = data && data.composite_score != null ? data.composite_score : 62;
  const skinLabel = data && data.skin_type_label ? data.skin_type_label : "\uAC74\uC131 + \uBBFC\uAC10\uC131 + T\uC874 \uC9C0\uC131";
  const summary = data && data.summary ? data.summary : "\uBCF5\uD569\uC131";
  const goodIngs = data ? data.recommended_ingredients || [] : GOOD_INGREDIENTS;
  const avoidIngs = data ? data.avoid_ingredients || [] : AVOID_INGREDIENTS;
  const cautionIngs = data ? data.caution_ingredients || [] : [];
  const products = data ? data.products || [] : PRODUCTS;
  const procedures = data ? data.procedures || [] : [];
  const foods = data ? data.foods || [] : [];
  const mlAvailable = data ? data.ml_available : false;
  const radarValues = attrs.map((a) => a.value);
  const radarLabels = attrs.map((a) => a.short);
  return /* @__PURE__ */ React.createElement("div", { className: "page", "data-screen-label": "04 Results" }, /* @__PURE__ */ React.createElement("div", { className: "result-banner" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uBD84\uC11D \uACB0\uACFC \xB7 ", today), /* @__PURE__ */ React.createElement("div", { className: "skin-type", style: { marginTop: 6 } }, skinLabel.split(" + ").map((part, i) => /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, i > 0 && " + ", /* @__PURE__ */ React.createElement("em", null, part)))), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { marginTop: 8, fontSize: 13, maxWidth: 520 } }, "AI\uAC00 7\uAC00\uC9C0 \uD53C\uBD80 \uC18D\uC131\uC744 \uBD84\uC11D\uD558\uACE0, \uC785\uB825\uD558\uC2E0 \uC54C\uB7EC\uC9C0\xB7\uB77C\uC774\uD504\uC2A4\uD0C0\uC77C \uC815\uBCF4\uC640 \uD568\uAED8 \uC885\uD569\uD55C \uACB0\uACFC\uC785\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", { className: "pill-row", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("span", { className: "pill" }, mlAvailable ? "\uC0AC\uC9C4 \uBD84\uC11D \uC644\uB8CC" : "\uC124\uBB38 \uAE30\uBC18 \uBD84\uC11D"), /* @__PURE__ */ React.createElement("span", { className: "pill" }, "\uC131\uBD84 DB \uB9E4\uCE6D \uC644\uB8CC"), /* @__PURE__ */ React.createElement("span", { className: "pill" }, "\uC81C\uD488 \uCD94\uCC9C \uC644\uB8CC"))), /* @__PURE__ */ React.createElement("div", { className: "composite" }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC885\uD569 \uC810\uC218"), /* @__PURE__ */ React.createElement("div", { className: "composite-score" }, composite, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 24, color: "var(--ink-muted)", fontFamily: "var(--sans)", fontStyle: "normal", marginLeft: 2 } }, "/100")), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--good)", fontSize: 12 } }, "\uD53C\uBD80 \uBD84\uC11D \uC644\uB8CC \u2713"))), /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginTop: 28 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "MODULE 01 \xB7 \uD53C\uBD80 \uBD84\uC11D"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uD53C\uBD80 \uC18D\uC131 \uB9AC\uD3EC\uD2B8")), /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: 12.5 } }, "AI \uBD84\uC11D \xB7 7\uAC00\uC9C0 \uC18D\uC131")), /* @__PURE__ */ React.createElement("div", { className: "results-grid" }, /* @__PURE__ */ React.createElement("div", { className: "attribute-card" }, /* @__PURE__ */ React.createElement("div", { className: "radar-wrap" }, /* @__PURE__ */ React.createElement(Radar, { values: radarValues, labels: radarLabels, size: 280, max: 100 }), /* @__PURE__ */ React.createElement("div", { className: "legend" }, attrs.map((a, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "legend-row" }, /* @__PURE__ */ React.createElement("span", { className: "swatch", style: {
    background: a.level === "hi" ? "var(--warn)" : a.level === "lo" ? "var(--good)" : "var(--ink-faint)"
  } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "name" }, a.name), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 11 } }, a.desc)), /* @__PURE__ */ React.createElement("span", { className: "val" }, a.value), /* @__PURE__ */ React.createElement("span", { className: "tag tag-" + a.level }, a.level === "hi" ? "HIGH" : a.level === "lo" ? "LOW" : "MID")))))), /* @__PURE__ */ React.createElement("div", { className: "attribute-card" }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uC0C1\uC138 \uC810\uC218"), /* @__PURE__ */ React.createElement("h3", { className: "h2-serif", style: { margin: "4px 0 16px" } }, "\uC18D\uC131\uBCC4 \uAC8C\uC774\uC9C0"), attrs.map((a, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "bar-row" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, a.name), /* @__PURE__ */ React.createElement("div", { className: "bar-track" }, /* @__PURE__ */ React.createElement("div", { className: "bar-fill", style: {
    width: a.value + "%",
    background: a.level === "hi" ? "linear-gradient(90deg, var(--warn-soft), var(--warn))" : a.level === "lo" ? "linear-gradient(90deg, var(--good-soft), var(--good))" : "linear-gradient(90deg, var(--bg-2), var(--ink-faint))"
  } })), /* @__PURE__ */ React.createElement("div", { className: "val" }, a.value, "/100"))))), /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginTop: 32 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "MODULE 02 \xB7 \uC131\uBD84 \uB9E4\uCE6D"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uB2F9\uC2E0\uC5D0\uAC8C \uB9DE\uB294 \uC131\uBD84 \xB7 \uD53C\uD574\uC57C \uD560 \uC131\uBD84")), /* @__PURE__ */ React.createElement("span", { className: "muted", style: { fontSize: 12.5 } }, "\uC2DD\uC57D\uCC98 \uC6D0\uB8CC / \uC0AC\uC6A9\uC81C\uD55C DB")), /* @__PURE__ */ React.createElement("div", { className: "ingredient-block" }, /* @__PURE__ */ React.createElement("div", { className: "ing-card good" }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { color: "var(--good)" } }, "RECOMMEND"), /* @__PURE__ */ React.createElement("h4", null, "\uCC3E\uC544\uC8FC\uC138\uC694 \u2500 \uAD8C\uC7A5 \uC131\uBD84"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12.5 } }, "\uC18D\uC131 \uBD84\uC11D \uACB0\uACFC \uAE30\uBC18, \uC2DD\uC57D\uCC98 \uACE0\uC2DC \uC131\uBD84 \uC6B0\uC120"), goodIngs.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "muted", style: { marginTop: 14, fontSize: 13 } }, "\uD604\uC7AC \uC870\uAC74\uC5D0\uC11C \uD2B9\uBCC4 \uAD8C\uC7A5 \uC131\uBD84\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") : /* @__PURE__ */ React.createElement("ul", { className: "ing-list" }, goodIngs.map((g, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "ing-item" }, /* @__PURE__ */ React.createElement("span", { className: "name" }, g.name), /* @__PURE__ */ React.createElement("span", { className: "pill", style: { background: "var(--good-soft)", color: "var(--good)" } }, g.tag), /* @__PURE__ */ React.createElement("span", { className: "why" }, "\u2192 ", g.why))))), /* @__PURE__ */ React.createElement("div", { className: "ing-card avoid" }, avoidIngs.length > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { color: "var(--warn)" } }, "AVOID"), /* @__PURE__ */ React.createElement("h4", null, "\uD53C\uD574\uC8FC\uC138\uC694 \u2500 \uD68C\uD53C \uC131\uBD84"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12.5 } }, "\uC54C\uB7EC\uC9C0 \uC751\uB2F5 + \uBBFC\uAC10\uB3C4 \uC810\uC218 + MFDS \uC0AC\uC6A9\uC81C\uD55C \uC6D0\uB8CC"), /* @__PURE__ */ React.createElement("ul", { className: "ing-list" }, avoidIngs.map((g, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "ing-item" }, /* @__PURE__ */ React.createElement("span", { className: "name" }, g.name), /* @__PURE__ */ React.createElement("span", { className: "pill", style: { background: "var(--warn-soft)", color: "var(--warn)" } }, g.tag), /* @__PURE__ */ React.createElement("span", { className: "why" }, "\u2192 ", g.why))))) : cautionIngs.length > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { color: "var(--warn)" } }, "CAUTION"), /* @__PURE__ */ React.createElement("h4", null, "\uC870\uC2EC\uD558\uC138\uC694 \u2500 \uC8FC\uC758 \uC131\uBD84"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12.5 } }, "\uBB34\uC870\uAC74 \uAE08\uC9C0\uB294 \uC544\uB2C8\uC9C0\uB9CC \uD604\uC7AC \uD53C\uBD80 \uC0C1\uD0DC\uC5D0\uC11C \uC8FC\uC758\uAC00 \uD544\uC694\uD55C \uC131\uBD84\uC774\uC5D0\uC694"), /* @__PURE__ */ React.createElement("ul", { className: "ing-list" }, cautionIngs.map((g, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "ing-item" }, /* @__PURE__ */ React.createElement("span", { className: "name" }, g.name), /* @__PURE__ */ React.createElement("span", { className: "pill", style: { background: "var(--warn-soft)", color: "var(--warn)" } }, g.tag), /* @__PURE__ */ React.createElement("span", { className: "why" }, "\u2192 ", g.why))))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { color: "var(--warn)" } }, "AVOID"), /* @__PURE__ */ React.createElement("h4", null, "\uD53C\uD574\uC8FC\uC138\uC694 \u2500 \uD68C\uD53C \uC131\uBD84"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { marginTop: 14, fontSize: 13 } }, "\uD604\uC7AC \uBD84\uC11D \uACB0\uACFC\uB85C\uB294 \uD2B9\uBCC4\uD788 \uD53C\uD574\uC57C \uD560 \uC131\uBD84\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.")))), /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginTop: 32 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "MODULE 03 \xB7 \uC81C\uD488 \uCD94\uCC9C"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uB2F9\uC2E0\uC744 \uC704\uD55C Top ", products.length, " \uC81C\uD488"))), products.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 28, textAlign: "center", color: "var(--ink-muted)" } }, "\uD53C\uBD80 \uACE0\uBBFC\uC744 \uC120\uD0DD\uD558\uBA74 \uC2DD\uC57D\uCC98 \uAE30\uB2A5\uC131\uD654\uC7A5\uD488\uC5D0\uC11C \uB9DE\uCDA4 \uC81C\uD488\uC744 \uCD94\uCC9C\uD574\uB4DC\uB9BD\uB2C8\uB2E4.") : (() => {
    const parseReason = (reason) => {
      if (!reason) return { rank: "", desc: "", ingredients: "", avoid: "", usage: "" };
      const parts = reason.split(" \xB7 ");
      return {
        rank: parts[0] || "",
        desc: parts[1] || "",
        ingredients: parts[2] || "",
        avoid: parts[3] || "",
        usage: parts[4] || parts[3] || ""
      };
    };
    const rankColors = [
      { bg: "linear-gradient(160deg,#F3DECB,#DDB69A)", badge: "#C9624A" },
      { bg: "linear-gradient(160deg,#E6D6C0,#B59A7E)", badge: "#8C7660" },
      { bg: "linear-gradient(160deg,#D8CFC2,#8C7A66)", badge: "#6A5C50" }
    ];
    return /* @__PURE__ */ React.createElement("div", { className: "products-grid" }, products.map((p, i) => {
      const r = parseReason(p.reason);
      const rc = rankColors[i] || rankColors[2];
      return /* @__PURE__ */ React.createElement("div", { key: i, className: "product-card" }, /* @__PURE__ */ React.createElement("div", { style: {
        aspectRatio: "4/3",
        background: rc.bg,
        backgroundImage: `url('https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=400&q=80')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "overlay",
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        padding: 12,
        justifyContent: "space-between"
      } }, /* @__PURE__ */ React.createElement("span", { style: {
        background: rc.badge,
        color: "white",
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        padding: "4px 10px",
        borderRadius: 999,
        letterSpacing: "0.08em"
      } }, ["1ST", "2ND", "3RD"][i] || `${i + 1}TH`), /* @__PURE__ */ React.createElement("span", { className: "match" }, "MATCH \xB7 ", p.match, "%")), /* @__PURE__ */ React.createElement("div", { className: "product-body" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "product-brand" }, p.brand || "\uC2DD\uC57D\uCC98 \uAE30\uB2A5\uC131"), /* @__PURE__ */ React.createElement("span", { className: "product-name", style: { lineHeight: 1.35, display: "block" } }, p.name)), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => toggleWishlist("product", p.name, p.brand || "\uC2DD\uC57D\uCC98 \uAE30\uB2A5\uC131"), style: { background: "none", border: "none", cursor: "pointer", padding: 4, color: isWishlisted("product", p.name) ? "#e53935" : "var(--accent)" } }, /* @__PURE__ */ React.createElement(Icon, { name: isWishlisted("product", p.name) ? "heart-fill" : "heart", size: 20 }))), /* @__PURE__ */ React.createElement("div", { className: "product-tags", style: { marginTop: 6 } }, (p.tags || []).map((t, j) => /* @__PURE__ */ React.createElement("span", { key: j, className: "product-tag " + (j === 0 ? "green" : "") }, t))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 } }, r.rank && /* @__PURE__ */ React.createElement("div", { style: {
        fontSize: 11,
        fontFamily: "var(--mono)",
        color: rc.badge,
        letterSpacing: "0.06em"
      } }, r.rank), r.ingredients && /* @__PURE__ */ React.createElement("div", { style: {
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--good-soft)",
        fontSize: 12,
        color: "var(--good)",
        lineHeight: 1.5
      } }, /* @__PURE__ */ React.createElement("strong", null, "\uD575\uC2EC \uC131\uBD84"), /* @__PURE__ */ React.createElement("br", null), r.ingredients), r.avoid && !r.avoid.startsWith("\uC0AC\uC6A9\uBC95") && /* @__PURE__ */ React.createElement("div", { style: {
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--warn-soft)",
        fontSize: 12,
        color: "var(--warn)",
        lineHeight: 1.5
      } }, /* @__PURE__ */ React.createElement("strong", null, "\uC8FC\uC758 \uC131\uBD84 \uD655\uC778"), /* @__PURE__ */ React.createElement("br", null), r.avoid), (p.usage || r.usage) && /* @__PURE__ */ React.createElement("div", { style: {
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--surface-2)",
        borderLeft: "2px solid var(--accent)",
        fontSize: 12,
        color: "var(--ink-2)",
        lineHeight: 1.5
      } }, /* @__PURE__ */ React.createElement("strong", null, "\u{1F4A1} \uC0AC\uC6A9\uBC95"), /* @__PURE__ */ React.createElement("br", null), p.usage || r.usage.replace("\uC0AC\uC6A9\uBC95: ", ""))), /* @__PURE__ */ React.createElement("div", { className: "product-foot", style: { marginTop: "auto", paddingTop: 12 } }, /* @__PURE__ */ React.createElement("span", { className: "product-price" }, p.price || "\uAC00\uACA9 \uBB38\uC758"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-sm" }, "\uC790\uC138\uD788 ", /* @__PURE__ */ React.createElement(Icon, { name: "arrowRight", size: 12 })))));
    }));
  })(), /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginTop: 32 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "MODULE 04 \xB7 \uC2DC\uC220 \uB9E4\uCE6D"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uB2F9\uC2E0\uC758 \uD53C\uBD80\uC5D0 \uC801\uD569\uD55C \uD53C\uBD80\uACFC \uC2DC\uC220"))), procedures.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 28, textAlign: "center", color: "var(--ink-muted)" } }, "\uD604\uC7AC \uD53C\uBD80 \uC0C1\uD0DC\uC5D0 \uD2B9\uBCC4\uD788 \uCD94\uCC9C\uB418\uB294 \uC2DC\uC220\uC774 \uC5C6\uAC70\uB098 \uBBFC\uAC10\uD558\uC5EC \uBCF4\uB958\uB418\uC5C8\uC2B5\uB2C8\uB2E4.") : /* @__PURE__ */ React.createElement("div", { className: "procedures-grid", style: { display: "grid", gap: 16, marginTop: 16 } }, procedures.map((proc, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "card", style: { padding: 20, borderLeft: "4px solid var(--accent)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, paddingRight: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "pill", style: { background: "var(--accent-soft)", color: "var(--accent)", fontSize: 11 } }, proc.category), /* @__PURE__ */ React.createElement("h3", { style: { margin: "8px 0 4px 0", fontSize: 18 } }, proc.name), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 13, lineHeight: 1.5 } }, proc.description)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => toggleWishlist("treatment", proc.name, proc.price_range), style: { background: "none", border: "none", cursor: "pointer", padding: 4, color: isWishlisted("treatment", proc.name) ? "#e53935" : "var(--accent)" } }, /* @__PURE__ */ React.createElement(Icon, { name: isWishlisted("treatment", proc.name) ? "heart-fill" : "heart", size: 24 })), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-2)", textAlign: "right", lineHeight: 1.4 } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink-muted)" } }, "\uC608\uC0C1 \uBE44\uC6A9"), /* @__PURE__ */ React.createElement("br", null), proc.price_range))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-2)" } }, /* @__PURE__ */ React.createElement("strong", null, "\uCD94\uCC9C \uC0AC\uC720:"), " ", proc.match_reasons.join(", ")))))), /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginTop: 32 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "MODULE 05 \xB7 \uC774\uB108\uBDF0\uD2F0"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uC624\uB298\uC758 \uD53C\uBD80 \uB9DE\uCDA4 \uC74C\uC2DD \u{1F957}"), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12.5, marginTop: 4 } }, "\uD53C\uBD80 \uC18D\uC131 \uAE30\uBC18 \xB7 \uB9E4\uC77C \uC5C5\uB370\uC774\uD2B8")), foods.length > 2 && /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-sm", style: { height: 32, padding: "0 12px" }, onClick: () => setFoodPage((p) => (p + 1) * 2 >= foods.length ? 0 : p + 1) }, "\uB2E4\uB978 \uC74C\uC2DD \uBCF4\uAE30"))), foods.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 28, textAlign: "center", color: "var(--ink-muted)" } }, "\uC74C\uC2DD \uCD94\uCC9C \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC774\uAC70\uB098 \uD604\uC7AC \uC870\uAC74\uC5D0 \uB9DE\uB294 \uC2DD\uC7AC\uB8CC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.") : (() => {
    const displayFoods = foods.slice(foodPage * 2, foodPage * 2 + 2);
    return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: `repeat(${displayFoods.length}, 1fr)`, gap: 16 } }, displayFoods.map((food, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: `card ${i === 0 ? "food-card-1st" : "food-card-2nd"}`, style: {
      padding: 24,
      border: "none"
    } }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: {
      color: i === 0 ? "var(--accent-ink)" : "var(--good)",
      marginBottom: 8
    } }, i === 0 ? "1ST PICK" : "2ND PICK"), /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: "var(--serif-ko)",
      fontSize: 22,
      fontWeight: 600,
      color: "var(--ink)",
      marginBottom: 6
    } }, food.food_name), /* @__PURE__ */ React.createElement("div", { className: "food-tag", style: {
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 11.5,
      fontFamily: "var(--mono)",
      marginBottom: 12
    } }, food.key_nutrients), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 13,
      color: "var(--ink-2)",
      lineHeight: 1.65,
      padding: "10px 12px",
      background: "rgba(255,255,255,0.55)",
      borderRadius: 10
    } }, food.reason))));
  })(), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 16, display: "flex", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-sm", onClick: () => onNavigate && onNavigate("innerbeauty"), style: { fontSize: 13, height: 32 } }, "\uC790\uC138\uD788")), /* @__PURE__ */ React.createElement("div", { className: "section-head", style: { marginTop: 32 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "MODULE 06 \xB7 \uBD84\uC11D \uC694\uC57D"), /* @__PURE__ */ React.createElement("h2", { className: "h2-serif", style: { margin: "4px 0 0" } }, "\uB9DE\uCDA4 \uCD94\uCC9C \uC694\uC57D"))), data && data.explanation && typeof data.explanation === "object" ? (
    /* ── Claude 구조화 설명 ── */
    /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 24, background: "linear-gradient(160deg,var(--surface-2),var(--surface))" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: 20,
      background: "var(--accent-soft)",
      color: "var(--accent-ink)",
      fontSize: 11
    } }, /* @__PURE__ */ React.createElement(Icon, { name: "sparkle", size: 11 }), " Claude AI \uBD84\uC11D")), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--serif-ko)", fontWeight: 400, fontSize: 17, lineHeight: 1.75, color: "var(--ink)" } }, data.explanation.skin_summary)), data.explanation.lifestyle_note && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 20, borderLeft: "3px solid var(--accent)" } }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { marginBottom: 6 } }, "\uC0DD\uD65C\uC2B5\uAD00 \uC5F0\uAD00\uC131"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65 } }, data.explanation.lifestyle_note))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, data.explanation.care_tips && data.explanation.care_tips.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 22 } }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { marginBottom: 10 } }, "\uCF00\uC5B4 \uC6B0\uC120\uC21C\uC704"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, data.explanation.care_tips.map((tip, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
      display: "grid",
      gridTemplateColumns: "22px 1fr",
      gap: 10,
      alignItems: "flex-start"
    } }, /* @__PURE__ */ React.createElement("span", { style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      flexShrink: 0,
      background: i === 0 ? "var(--accent)" : i === 1 ? "var(--good)" : "var(--bg-2)",
      color: i < 2 ? "white" : "var(--ink-muted)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      fontWeight: 600
    } }, i + 1), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 } }, tip))))), data.explanation.key_ingredient && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 20, background: "var(--good-soft)", border: "1px solid rgba(91,117,83,0.2)" } }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { marginBottom: 6, color: "var(--good)" } }, "\uC9C0\uAE08 \uB2F9\uC7A5 \uC2DC\uB3C4\uD560 \uC131\uBD84"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--serif-ko)", fontSize: 20, fontWeight: 500, color: "var(--good)", marginBottom: 6 } }, data.explanation.key_ingredient), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--good)", lineHeight: 1.55, opacity: 0.85 } }, data.explanation.key_ingredient_reason))))
  ) : (
    /* ── 폴백: AI 키 없을 때 ── */
    /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 28, background: "linear-gradient(180deg,var(--surface-2),var(--surface))" } }, (() => {
      const dry = attrs.find((a) => a.key === "hydro");
      const sens = attrs.find((a) => a.key === "sens");
      const rec1 = goodIngs[0];
      const rec2 = goodIngs[1];
      return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--serif-ko)", fontSize: 17, lineHeight: 1.8, color: "var(--ink)", maxWidth: 820 } }, dry && /* @__PURE__ */ React.createElement("span", null, "\uC218\uBD84 ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent-ink)", fontWeight: 600 } }, dry.value, "%")), sens && /* @__PURE__ */ React.createElement("span", null, ", \uBBFC\uAC10\uB3C4 ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--accent-ink)", fontWeight: 600 } }, sens.value, "%")), rec1 && rec2 && /* @__PURE__ */ React.createElement("span", null, " \u2014 ", /* @__PURE__ */ React.createElement("span", { style: { borderBottom: "2px solid var(--accent)" } }, rec1.name, " + ", rec2.name), " \uC870\uD569\uC744 \uC6B0\uC120 \uC2DC\uB3C4\uD574\uBCF4\uC138\uC694."), !rec1 && /* @__PURE__ */ React.createElement("span", null, " \u2014 \uD53C\uBD80 \uACE0\uBBFC\uC744 \uC120\uD0DD\uD558\uBA74 \uB354 \uC815\uD655\uD55C \uC131\uBD84\uC744 \uCD94\uCC9C\uD574\uB4DC\uB9B4 \uC218 \uC788\uC5B4\uC694.")), /* @__PURE__ */ React.createElement("div", { className: "muted", style: { fontSize: 12, marginTop: 14 } }, "\u2192 .env\uC5D0 ANTHROPIC_API_KEY\uB97C \uC124\uC815\uD558\uBA74 AI \uAC1C\uC778\uD654 \uC124\uBA85\uC774 \uC0DD\uC131\uB429\uB2C8\uB2E4."));
    })())
  ), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 32,
    paddingTop: 24,
    borderTop: "1px solid var(--line-2)"
  } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uB2E4\uC74C \uB2E8\uACC4"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, marginTop: 4 } }, "\uB9AC\uD3EC\uD2B8\uB97C \uC800\uC7A5\uD558\uAC70\uB098, 2\uC8FC \uD6C4 \uC7AC\uBD84\uC11D\uC744 \uC608\uC57D\uD574\uBCF4\uC138\uC694.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: onHome }, "\uB300\uC2DC\uBCF4\uB4DC\uB85C"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => {
    const prev = document.title;
    document.title = `\uD53C\uBD80 \uBD84\uC11D \uB9AC\uD3EC\uD2B8 ${(/* @__PURE__ */ new Date()).toLocaleDateString("ko-KR")}`;
    window.print();
    document.title = prev;
  } }, "\u{1F4C4} PDF \uC800\uC7A5"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: onRestart }, /* @__PURE__ */ React.createElement(Icon, { name: "sparkle", size: 14 }), " \uC0C8 \uBD84\uC11D \uC2DC\uC791"))));
};
window.Results = Results;
