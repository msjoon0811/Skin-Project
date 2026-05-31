const Analyze = ({ onComplete, onBack, authHeaders = {}, skinProfile }) => {
  const [step, setStep] = React.useState(0);
  const [imageFile, setImageFile] = React.useState(null);
  const [imagePreview, setImagePreview] = React.useState(null);
  const [photoError, setPhotoError] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const [form, setForm] = React.useState({
    // 필수
    skinType: "",
    age: "",
    gender: "",
    concerns: [],
    sensitivity: "",
    allergyMode: "",
    allergies: [],
    allergyOther: "",
    // 생활습관 (선택 - 정밀도 향상)
    drinking: "",
    smoking: "",
    cleansing: "",
    hormone: [],
    gut: "",
    sleep: "",
    water: "",
    heat: "",
    pollution: "",
    sweat: "",
    diet: [],
    // 기타
    budget: "20-40",
    routine: "\uAC04\uB2E8 (3\uB2E8\uACC4)"
  });
  const [formErrors, setFormErrors] = React.useState({});
  const toggle = (k, v) => setForm((f) => ({
    ...f,
    [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]
  }));
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFormErrors((e) => ({ ...e, [k]: false }));
  };
  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setPhotoError(false);
  };
  const goToForm = () => {
    if (!imageFile) {
      setPhotoError(true);
      return;
    }
    setStep(1);
  };
  const validateForm = () => {
    const errors = {};
    if (!form.skinType) errors.skinType = true;
    if (!form.age) errors.age = true;
    if (!form.gender) errors.gender = true;
    if (!form.sensitivity) errors.sensitivity = true;
    if (!form.allergyMode) errors.allergyMode = true;
    else if (form.allergyMode === "\uC788\uC74C" && form.allergies.length === 0 && !form.allergyOther.trim()) errors.allergies = true;
    if (form.concerns.length === 0) errors.concerns = true;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const loadPreviousForm = () => {
    if (!window.confirm("\uAC00\uC7A5 \uCD5C\uADFC\uC5D0 \uC785\uB825\uD558\uC168\uB358 \uD504\uB85C\uD544 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
    fetch("/api/history/last_form", { headers: authHeaders }).then((res) => {
      if (!res.ok) throw new Error("\uC774\uC804 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return res.json();
    }).then((data) => {
      setForm(data);
      setFormErrors({});
      alert("\uC131\uACF5\uC801\uC73C\uB85C \uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4.");
    }).catch((err) => {
      alert(err.message);
    });
  };
  const [loadStep, setLoadStep] = React.useState(0);
  const [apiError, setApiError] = React.useState(null);
  React.useEffect(() => {
    if (step !== 2) return;
    setLoadStep(0);
    setApiError(null);
    const delays = [700, 1e3, 900, 1100, 800];
    let cum = 0;
    const timers = delays.map((t, i) => {
      cum += t;
      return setTimeout(() => setLoadStep(i + 1), cum);
    });
    const fd = new FormData();
    const finalForm = { ...form };
    if (finalForm.allergyMode === "\uC788\uC74C") {
      const allAllergies = [...finalForm.allergies];
      if (finalForm.allergyOther.trim()) {
        finalForm.allergyOther.split(",").forEach((s) => {
          if (s.trim()) allAllergies.push(s.trim());
        });
      }
      finalForm.allergies = allAllergies;
    } else {
      finalForm.allergies = [];
    }
    fd.append("form_data", JSON.stringify(finalForm));
    if (imageFile) fd.append("image", imageFile);
    fetch("/api/analyze", { method: "POST", headers: authHeaders, body: fd }).then((r) => {
      if (!r.ok) throw new Error("\uC11C\uBC84 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. (" + r.status + ")");
      return r.json();
    }).then((data) => {
      timers.forEach(clearTimeout);
      setLoadStep(5);
      setTimeout(() => onComplete && onComplete(data), 400);
    }).catch((err) => {
      timers.forEach(clearTimeout);
      setApiError(err.message || "\uBD84\uC11D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
      setLoadStep(0);
    });
    return () => timers.forEach(clearTimeout);
  }, [step]);
  return /* @__PURE__ */ React.createElement("div", { className: "page", "data-screen-label": "03 Analyze" }, /* @__PURE__ */ React.createElement("div", { className: "analyze-wrap" }, /* @__PURE__ */ React.createElement("aside", { className: "steps" }, /* @__PURE__ */ React.createElement("div", { className: "eyebrow", style: { padding: "0 12px 6px" } }, "\uBD84\uC11D \uB2E8\uACC4"), [
    { n: "01", t: "\uC0AC\uC9C4 \uC5C5\uB85C\uB4DC", s: "\uC815\uBA74 \uC140\uCE74 1\uC7A5 (\uD544\uC218)" },
    { n: "02", t: "\uC815\uBCF4 \uC785\uB825", s: "\uD544\uC218 5\uAC00\uC9C0 \xB7 \uC120\uD0DD \uC0AC\uD56D" },
    { n: "03", t: "AI \uBD84\uC11D", s: "\uBD84\uC11D \uC911..." },
    { n: "04", t: "\uB9AC\uD3EC\uD2B8", s: "\uC18D\uC131 \xB7 \uC131\uBD84 \xB7 \uC81C\uD488" }
  ].map((it, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "step " + (i === step ? "active" : i < step ? "done" : "") }, /* @__PURE__ */ React.createElement("div", { className: "num" }, i < step ? /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 11, stroke: 2.2 }) : it.n.slice(1)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "label" }, it.t), /* @__PURE__ */ React.createElement("div", { className: "sub" }, it.s)))), /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 14,
    padding: "12px 14px",
    background: "var(--surface-2)",
    border: "1px solid var(--line-2)",
    borderRadius: 12,
    fontSize: 11.5,
    color: "var(--ink-muted)",
    lineHeight: 1.5
  } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-2)", fontSize: 10.5, letterSpacing: "0.1em" } }, "\uAC1C\uC778\uC815\uBCF4 \uBCF4\uD638"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, "\uC5C5\uB85C\uB4DC\uB41C \uC0AC\uC9C4\uC740 \uBD84\uC11D \uC9C1\uD6C4 \uC790\uB3D9\uC73C\uB85C \uC0AD\uC81C\uB429\uB2C8\uB2E4. \uB2E4\uB978 \uC6A9\uB3C4\uB85C \uC0AC\uC6A9\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."))), /* @__PURE__ */ React.createElement("main", { className: "panel" }, step === 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uB2E8\uACC4 01 \xB7 \uC0AC\uC9C4 \uC5C5\uB85C\uB4DC"), /* @__PURE__ */ React.createElement("h1", { className: "h1" }, "\uC815\uBA74 \uC140\uCE74 \uD55C \uC7A5\uC744 \uC5C5\uB85C\uB4DC\uD574 \uC8FC\uC138\uC694."))), /* @__PURE__ */ React.createElement(
    "input",
    {
      ref: fileInputRef,
      type: "file",
      accept: "image/jpeg,image/png",
      style: { display: "none" },
      onChange: handleFileChange
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "capture-stage" }, /* @__PURE__ */ React.createElement("div", { className: "cam-frame", style: { cursor: "pointer" }, onClick: () => fileInputRef.current && fileInputRef.current.click() }, imagePreview ? /* @__PURE__ */ React.createElement(
    "img",
    {
      src: imagePreview,
      alt: "\uC5C5\uB85C\uB4DC\uB41C \uC774\uBBF8\uC9C0",
      style: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }
    }
  ) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "cam-overlay-tag" }, "\uC0AC\uC9C4\uC744 \uD074\uB9AD\uD574 \uC5C5\uB85C\uB4DC"), /* @__PURE__ */ React.createElement("div", { className: "face-guide" }), /* @__PURE__ */ React.createElement("div", { className: "scan-line" }))), /* @__PURE__ */ React.createElement("div", { className: "col-gap-lg" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uCD2C\uC601 \uAC00\uC774\uB4DC"), /* @__PURE__ */ React.createElement("h3", { className: "h2", style: { margin: "4px 0 12px" } }, "\uC774\uB807\uAC8C \uCC0D\uC5B4\uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement("div", { className: "capture-tips" }, [
    { n: 1, t: "\uC790\uC5F0\uAD11 \xB7 \uC815\uBA74", d: "\uCC3D\uAC00\uC5D0\uC11C \uADF8\uB9BC\uC790 \uC5C6\uB294 \uC870\uBA85, \uC815\uBA74 \uC751\uC2DC" },
    { n: 2, t: "\uB9E8\uC5BC\uAD74 \xB7 \uC138\uC548 \uC9C1\uD6C4", d: "\uBA54\uC774\uD06C\uC5C5\xB7\uC120\uD06C\uB9BC\uC744 \uBAA8\uB450 \uC9C0\uC6B4 \uC0C1\uD0DC" },
    { n: 3, t: "\uBA38\uB9AC\xB7\uC548\uACBD \uC81C\uAC70", d: "\uC774\uB9C8\uC640 \uD131\uC120\uC774 \uC798 \uBCF4\uC774\uB3C4\uB85D" }
  ].map((tip) => /* @__PURE__ */ React.createElement("div", { key: tip.n, className: "tip" }, /* @__PURE__ */ React.createElement("div", { className: "icn" }, tip.n), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "tip-title" }, tip.t), /* @__PURE__ */ React.createElement("div", { className: "tip-desc" }, tip.d))))), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-outline",
      style: { justifyContent: "flex-start", padding: 14, borderStyle: "dashed" },
      onClick: () => fileInputRef.current && fileInputRef.current.click()
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "upload", size: 15 }),
    " \uD30C\uC77C\uC5D0\uC11C \uC120\uD0DD\uD558\uAE30",
    /* @__PURE__ */ React.createElement("span", { className: "muted", style: { marginLeft: "auto", fontSize: 11.5 } }, "JPG \xB7 PNG \xB7 \u226410MB")
  ), photoError && /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    background: "var(--warn-soft)",
    border: "1px solid var(--warn)",
    borderRadius: 10,
    color: "var(--warn)",
    fontSize: 13
  } }, "\uC0AC\uC9C4\uC744 \uBA3C\uC800 \uC5C5\uB85C\uB4DC\uD574\uC57C \uBD84\uC11D\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."))), /* @__PURE__ */ React.createElement("div", { className: "panel-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: onBack }, /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 14 }), " \uCDE8\uC18C"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, imageFile && /* @__PURE__ */ React.createElement("span", { className: "muted mono", style: { fontSize: 11.5 } }, "\u2713 ", imageFile.name), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: goToForm }, "\uB2E4\uC74C: \uC815\uBCF4 \uC785\uB825 ", /* @__PURE__ */ React.createElement(Icon, { name: "arrowRight", size: 14 }))))), step === 1 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "panel-head", style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uB2E8\uACC4 02 \xB7 \uC815\uBCF4 \uC785\uB825"), /* @__PURE__ */ React.createElement("h1", { className: "h1" }, "\uD53C\uBD80\uC5D0 \uB300\uD574 \uC870\uAE08 \uB354 \uC54C\uB824\uC8FC\uC138\uC694."), /* @__PURE__ */ React.createElement("span", { className: "mono muted", style: { fontSize: 11.5 } }, "* \uD544\uC218 \uD56D\uBAA9")), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-outline",
      style: { padding: "8px 12px", fontSize: 13, gap: 6 },
      onClick: loadPreviousForm,
      title: "\uB9C8\uC9C0\uB9C9\uC73C\uB85C \uBD84\uC11D\uD560 \uB54C \uC785\uB825\uD588\uB358 \uB0B4\uC6A9\uC744 \uADF8\uB300\uB85C \uAC00\uC838\uC635\uB2C8\uB2E4"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 14 }),
    " \uC774\uC804 \uAE30\uB85D \uBD88\uB7EC\uC624\uAE30"
  )), /* @__PURE__ */ React.createElement("div", { className: "form-grid" }, /* @__PURE__ */ React.createElement("section", { className: "form-section" }, /* @__PURE__ */ React.createElement("div", { className: "form-section-head" }, /* @__PURE__ */ React.createElement("h3", { className: "h3" }, "\uAE30\uBCF8 \uC815\uBCF4"), /* @__PURE__ */ React.createElement("span", { className: "num" }, "\uD544\uC218")), /* @__PURE__ */ React.createElement("div", { className: "fields-2" }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", style: { color: formErrors.skinType ? "var(--warn)" : "" } }, "\uD3C9\uC18C \uD53C\uBD80 \uD0C0\uC785 ", /* @__PURE__ */ React.createElement("span", { className: "req" }, "*"), formErrors.skinType && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, marginLeft: 6 } }, "\uC120\uD0DD\uD574\uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uAC74\uC131", "\uC911\uC131", "\uC9C0\uC131", "\uBCF5\uD569\uC131", "\uBBFC\uAC10\uC131"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.skinType === t ? "selected" : ""),
      style: { borderColor: formErrors.skinType ? "var(--warn)" : "" },
      onClick: () => set("skinType", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "fields-2" }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", style: { color: formErrors.age ? "var(--warn)" : "" } }, "\uB098\uC774\uB300 ", /* @__PURE__ */ React.createElement("span", { className: "req" }, "*"), formErrors.age && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, marginLeft: 6 } }, "\uC120\uD0DD\uD574\uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["20s", "30s", "40s", "50+"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.age === t ? "selected" : ""),
      style: { borderColor: formErrors.age ? "var(--warn)" : "" },
      onClick: () => set("age", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", style: { color: formErrors.gender ? "var(--warn)" : "" } }, "\uC131\uBCC4 ", /* @__PURE__ */ React.createElement("span", { className: "req" }, "*"), formErrors.gender && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, marginLeft: 6 } }, "\uC120\uD0DD\uD574\uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uC5EC\uC131", "\uB0A8\uC131", "\uAE30\uD0C0"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.gender === t ? "selected" : ""),
      style: { borderColor: formErrors.gender ? "var(--warn)" : "" },
      onClick: () => set("gender", t)
    },
    t
  ))))))), /* @__PURE__ */ React.createElement("section", { className: "form-section" }, /* @__PURE__ */ React.createElement("div", { className: "form-section-head" }, /* @__PURE__ */ React.createElement("h3", { className: "h3", style: { color: formErrors.concerns ? "var(--warn)" : "" } }, "\uD53C\uBD80 \uACE0\uBBFC (\uBCF5\uC218 \uC120\uD0DD)", formErrors.concerns && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 400, marginLeft: 8 } }, "1\uAC1C \uC774\uC0C1 \uC120\uD0DD\uD574\uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement("span", { className: "num" }, "\uD544\uC218")), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uAC74\uC870\uD568", "\uC720\uBD84\uACFC\uB2E4", "\uBBFC\uAC10/\uD64D\uC870", "\uC0C9\uC18C\uCE68\uCC29", "\uC5EC\uB4DC\uB984", "\uBAA8\uACF5", "\uC8FC\uB984", "\uD0C4\uB825\uC800\uD558", "\uAC01\uC9C8"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip tone " + (form.concerns.includes(t) ? "selected" : ""),
      style: { borderColor: formErrors.concerns && !form.concerns.includes(t) ? "var(--warn)" : "" },
      onClick: () => {
        toggle("concerns", t);
        setFormErrors((e) => ({ ...e, concerns: false }));
      }
    },
    t
  )))), /* @__PURE__ */ React.createElement("section", { className: "form-section" }, /* @__PURE__ */ React.createElement("div", { className: "form-section-head" }, /* @__PURE__ */ React.createElement("h3", { className: "h3" }, "\uBBFC\uAC10\uB3C4 \xB7 \uC54C\uB7EC\uC9C0"), /* @__PURE__ */ React.createElement("span", { className: "num" }, "\uD544\uC218")), /* @__PURE__ */ React.createElement("div", { className: "fields-2" }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label", style: { color: formErrors.sensitivity ? "var(--warn)" : "" } }, "\uC0C8 \uC81C\uD488 \uC0AC\uC6A9 \uC2DC \uC790\uADF9 \uC815\uB3C4 ", /* @__PURE__ */ React.createElement("span", { className: "req" }, "*"), formErrors.sensitivity && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, marginLeft: 6 } }, "\uC120\uD0DD\uD574\uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uAC70\uC758 \uC5C6\uC74C", "\uAC00\uB054", "\uC790\uC8FC", "\uB9E4\uBC88"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.sensitivity === t ? "selected" : ""),
      style: { borderColor: formErrors.sensitivity ? "var(--warn)" : "" },
      onClick: () => set("sensitivity", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement(
    "label",
    {
      className: "field-label",
      style: { color: formErrors.allergyMode || formErrors.allergies ? "var(--warn)" : "" }
    },
    "\uC54C\uB7EC\uC9C0 / \uD53C\uD574\uC57C \uD560 \uC131\uBD84 ",
    /* @__PURE__ */ React.createElement("span", { className: "req" }, "*"),
    formErrors.allergyMode && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, marginLeft: 6 } }, "\uC120\uD0DD\uD574\uC8FC\uC138\uC694"),
    formErrors.allergies && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, marginLeft: 6 } }, "\uC131\uBD84\uBA85\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694")
  ), /* @__PURE__ */ React.createElement("div", { className: "chip-group", style: { marginBottom: form.allergyMode === "\uC788\uC74C" ? 8 : 0 } }, ["\uC5C6\uC74C", "\uC788\uC74C"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.allergyMode === t ? "selected" : ""),
      style: { borderColor: formErrors.allergyMode ? "var(--warn)" : "" },
      onClick: () => {
        setForm((f) => ({
          ...f,
          allergyMode: t,
          allergies: t === "\uC5C6\uC74C" ? [] : f.allergies,
          allergyOther: t === "\uC5C6\uC74C" ? "" : f.allergyOther
        }));
        setFormErrors((e) => ({ ...e, allergyMode: false, allergies: false }));
      }
    },
    t
  ))), form.allergyMode === "\uC788\uC74C" && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uC54C\uCF54\uC62C", "\uD5A5\uB8CC", "\uC5D0\uC13C\uC15C\uC624\uC77C", "\uD30C\uB77C\uBCA4", "\uC124\uD398\uC774\uD2B8", "\uC2E4\uB9AC\uCF58", "\uBBF8\uB124\uB784\uC624\uC77C"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip tone " + (form.allergies.includes(t) ? "selected" : ""),
      onClick: () => {
        toggle("allergies", t);
        setFormErrors((e) => ({ ...e, allergies: false }));
      }
    },
    t
  ))), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "input",
      placeholder: "\uAE30\uD0C0 \uC131\uBD84 \uC9C1\uC811 \uC785\uB825 (\uC608: \uD398\uB179\uC2DC\uC5D0\uD0C4\uC62C)",
      style: { borderColor: formErrors.allergies && form.allergies.length === 0 && !form.allergyOther.trim() ? "var(--warn)" : "" },
      value: form.allergyOther,
      onChange: (e) => {
        setForm((f) => ({ ...f, allergyOther: e.target.value }));
        setFormErrors((e2) => ({ ...e2, allergies: false }));
      }
    }
  ))))), /* @__PURE__ */ React.createElement("section", { className: "form-section" }, /* @__PURE__ */ React.createElement("div", { className: "form-section-head" }, /* @__PURE__ */ React.createElement("h3", { className: "h3" }, "\uC0DD\uD65C\uC2B5\uAD00 \xB7 \uD658\uACBD"), /* @__PURE__ */ React.createElement("span", { className: "num", style: { color: "var(--good)" } }, "\uC120\uD0DD \u2014 \uC815\uBC00\uB3C4 \uD5A5\uC0C1")), /* @__PURE__ */ React.createElement("div", { style: {
    padding: "10px 14px",
    marginBottom: 16,
    background: "var(--accent-soft)",
    border: "1px solid var(--line-2)",
    borderRadius: 10,
    fontSize: 12.5,
    color: "var(--accent-ink)"
  } }, "\uC785\uB825\uD560\uC218\uB85D \uC774\uBBF8\uC9C0 \uBD84\uC11D \uACB0\uACFC\uAC00 \uB354 \uC815\uD655\uD574\uC9D1\uB2C8\uB2E4. \uAC74\uB108\uB6F0\uC5B4\uB3C4 \uBD84\uC11D\uC740 \uC9C4\uD589\uB429\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", { className: "fields-3" }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uC74C\uC8FC \uBE48\uB3C4"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uC548 \uD568", "\uAC00\uB054 (\uC6D4 1-2\uD68C)", "\uC790\uC8FC (\uC8FC 1\uD68C+)"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.drinking === t ? "selected" : ""),
      onClick: () => set("drinking", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uD761\uC5F0 \uC5EC\uBD80"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uBE44\uD761\uC5F0", "\uD761\uC5F0"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.smoking === t ? "selected" : ""),
      onClick: () => set("smoking", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uC800\uB141 \uD074\uB80C\uC9D5"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uB9E4\uC77C \uD568", "\uAC00\uB054 \uBE60\uC9D0", "\uC790\uC8FC \uBE60\uC9D0"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.cleansing === t ? "selected" : ""),
      onClick: () => set("cleansing", t)
    },
    t
  ))))), /* @__PURE__ */ React.createElement("div", { className: "fields-3", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uD638\uB974\uBAAC \xB7 \uC2A4\uD2B8\uB808\uC2A4 ", /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 400 } }, "(\uBCF5\uC218 \uC120\uD0DD)")), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uD574\uB2F9 \uC5C6\uC74C", "\uC0DD\uB9AC \uC804\uD6C4 \uC608\uBBFC\uD568", "\uC2A4\uD2B8\uB808\uC2A4 \uC2EC\uD568", "\uC784\uC2E0 \uC911"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.hormone.includes(t) ? "selected" : ""),
      onClick: () => toggle("hormone", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uC18C\uD654 \uBD88\uD3B8\uD568"), /* @__PURE__ */ React.createElement("div", { className: "field-hint", style: { marginBottom: 6 } }, "\uC2DD\uD6C4 \uB354\uBD80\uB8E9\uD568, \uC7A6\uC740 \uBCF5\uD1B5 \uB4F1"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uC5C6\uC74C", "\uAC00\uB054 \uC788\uC74C", "\uC790\uC8FC \uC788\uC74C"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.gut === t ? "selected" : ""),
      onClick: () => set("gut", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uD558\uB8E8 \uD3C9\uADE0 \uC218\uBA74"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["<5h", "5-6", "6-7", "7-8", "8+"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.sleep === t ? "selected" : ""),
      onClick: () => set("sleep", t)
    },
    t
  ))))), /* @__PURE__ */ React.createElement("div", { className: "fields-3", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uD558\uB8E8 \uBB3C \uC12D\uCDE8\uB7C9"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uBD80\uC871 (<4\uC794)", "\uBCF4\uD1B5 (4-6\uC794)", "\uCDA9\uBD84 (6\uC794+)"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.water === t ? "selected" : ""),
      onClick: () => set("water", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uD53C\uBD80 \uC5F4 \uB178\uCD9C"), /* @__PURE__ */ React.createElement("div", { className: "field-hint", style: { marginBottom: 6 } }, "\uC0AC\uC6B0\uB098, \uCC1C\uC9C8, \uB728\uAC70\uC6B4 \uC0E4\uC6CC"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uD574\uB2F9 \uC5C6\uC74C", "\uAC00\uB054 (\uB728\uAC70\uC6B4 \uC0E4\uC6CC)", "\uC790\uC8FC (\uC0AC\uC6B0\uB098/\uCC1C\uC9C8)"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.heat === t ? "selected" : ""),
      onClick: () => set("heat", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uB300\uAE30\uC624\uC5FC \xB7 \uBBF8\uC138\uBA3C\uC9C0"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uB0AE\uC74C (\uC8FC\uB85C \uC2E4\uB0B4)", "\uBCF4\uD1B5", "\uB192\uC74C (\uB3C4\uC2EC/\uC57C\uC678)"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.pollution === t ? "selected" : ""),
      onClick: () => set("pollution", t)
    },
    t
  ))))), /* @__PURE__ */ React.createElement("div", { className: "fields-2", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uB540 \uBD84\uBE44\uB7C9"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uC801\uC74C", "\uBCF4\uD1B5", "\uB9CE\uC74C (\uC6B4\uB3D9/\uC57C\uC678)"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.sweat === t ? "selected" : ""),
      onClick: () => set("sweat", t)
    },
    t
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "\uC2DD\uC2B5\uAD00 ", /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 400 } }, "(\uBCF5\uC218 \uC120\uD0DD)")), /* @__PURE__ */ React.createElement("div", { className: "field-hint", style: { marginBottom: 6 } }, "\uC57C\uC2DD, \uC815\uC81C\uD0C4\uC218\uD654\uBB3C(\uBE75/\uBA74/\uACFC\uC790) \uC12D\uCDE8 \uBE48\uB3C4"), /* @__PURE__ */ React.createElement("div", { className: "chip-group" }, ["\uD574\uB2F9 \uC5C6\uC74C", "\uC57C\uC2DD \uC790\uC8FC", "\uC815\uC81C\uD0C4\uC218\uD654\uBB3C \uC790\uC8FC"].map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t,
      className: "chip " + (form.diet.includes(t) ? "selected" : ""),
      onClick: () => toggle("diet", t)
    },
    t
  ))))))), Object.values(formErrors).some(Boolean) && /* @__PURE__ */ React.createElement("div", { style: {
    margin: "0 0 8px",
    padding: "12px 16px",
    background: "var(--warn-soft)",
    border: "1px solid var(--warn)",
    borderRadius: 10,
    color: "var(--warn)",
    fontSize: 13
  } }, "\uD544\uC218 \uD56D\uBAA9\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC57C \uBD84\uC11D\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", { className: "panel-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: () => setStep(0) }, /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 14 }), " \uC774\uC804"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-accent", onClick: () => {
    if (validateForm()) setStep(2);
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "sparkle", size: 14 }), " AI \uBD84\uC11D \uC2DC\uC791"))), step === 2 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "eyebrow" }, "\uB2E8\uACC4 03 \xB7 AI \uBD84\uC11D \uC911"), /* @__PURE__ */ React.createElement("h1", { className: "h1" }, apiError ? "\uBD84\uC11D \uC911 \uBB38\uC81C\uAC00 \uC0DD\uACBC\uC5B4\uC694." : "\uC7A0\uAE50\uB9CC\uC694, AI\uAC00 \uC5F4\uC2EC\uD788 \uBD84\uC11D \uC911\uC774\uC5D0\uC694."))), apiError ? /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    padding: "60px 0"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    padding: "16px 24px",
    background: "var(--warn-soft)",
    border: "1px solid var(--warn)",
    borderRadius: 12,
    color: "var(--warn)",
    fontSize: 14
  } }, apiError), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-ghost", onClick: () => {
    setApiError(null);
    setStep(1);
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 14 }), " \uD3FC\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: () => {
    setApiError(null);
    setStep(2);
  } }, "\uB2E4\uC2DC \uC2DC\uB3C4"))) : /* @__PURE__ */ React.createElement("div", { className: "loading-stage" }, /* @__PURE__ */ React.createElement("div", { className: "loading-ring" }), /* @__PURE__ */ React.createElement("div", { className: "loading-steps" }, [
    { t: "\uC0AC\uC9C4\uC5D0\uC11C \uD53C\uBD80\uB97C \uD655\uC778\uD558\uB294 \uC911...", sub: "\uC7A0\uC2DC\uB9CC\uC694" },
    { t: "\uD53C\uBD80 \uC0C1\uD0DC\uB97C \uBD84\uC11D\uD558\uB294 \uC911...", sub: "7\uAC00\uC9C0 \uC18D\uC131\uC744 \uC0B4\uD3B4\uBCF4\uACE0 \uC788\uC5B4\uC694" },
    { t: "\uC785\uB825 \uC815\uBCF4\uC640 \uACB0\uD569\uD558\uB294 \uC911...", sub: "\uB354 \uC815\uD655\uD55C \uACB0\uACFC\uB97C \uC704\uD574 \uC885\uD569\uD574\uC694" },
    { t: "\uB9DE\uB294 \uC131\uBD84\uC744 \uCC3E\uB294 \uC911...", sub: "\uD53C\uD574\uC57C \uD560 \uAC83\uB3C4 \uD568\uAED8 \uC815\uB9AC\uD574\uB4DC\uB824\uC694" },
    { t: "\uC81C\uD488\uC744 \uCD94\uCC9C\uD558\uB294 \uC911...", sub: "\uAC70\uC758 \uB2E4 \uC644\uC131\uB410\uC5B4\uC694" }
  ].map((s, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "loading-step " + (loadStep > i ? "done" : loadStep === i ? "active" : "") }, /* @__PURE__ */ React.createElement("span", { className: "bullet" }), /* @__PURE__ */ React.createElement("span", { className: "grow" }, s.t), /* @__PURE__ */ React.createElement("span", { className: "mono faint", style: { fontSize: 11 } }, s.sub)))))))));
};
window.Analyze = Analyze;
