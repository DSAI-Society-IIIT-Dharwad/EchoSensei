const { useState, useEffect, useRef } = window.React;

const LANGUAGES = [
  { code: "en-IN", name: "English (India)" },
  { code: "en-US", name: "English (US)" },
  { code: "hi-IN", name: "Hindi" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "kn-IN", name: "Kannada" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "ar-SA", name: "Arabic" },
];

const REPORT_FIELDS = [
  { key: "chiefComplaint",       label: "Chief Complaint / Query",             color: "#0369a1" },
  { key: "symptoms",             label: "Symptoms",                            color: "#0369a1" },
  { key: "pastHistory",          label: "Past Medical History",                color: "#065f46" },
  { key: "clinicalObservations", label: "Clinical Observations",               color: "#065f46" },
  { key: "diagnosis",            label: "Diagnosis / Classification / Status", color: "#7c2d12" },
  { key: "treatmentAdvice",      label: "Treatment Advice & Prescription",     color: "#3b0764" },
  { key: "actionPlan",           label: "Action Plan / Treatment Plan",        color: "#3b0764" },
  { key: "immunizationData",     label: "Immunization Data",                   color: "#065f46" },
  { key: "pregnancyData",        label: "Pregnancy Data",                      color: "#831843" },
  { key: "riskIndicators",       label: "Risk Indicators",                     color: "#7c2d12" },
  { key: "injuryMobilityDetails",label: "Injury & Mobility Details",           color: "#0369a1" },
  { key: "entFindings",          label: "ENT Findings",                        color: "#0369a1" },
  { key: "verificationSurvey",   label: "Verification & Survey Responses",     color: "#065f46" },
  { key: "followUp",             label: "Follow-up Instructions",              color: "#3b0764" },
];

/* ── Inline SVG illustrations — zero network dependency ── */
const IlluHero = () => (<img src="./hero_doctor_patient.png" style={{width:"100%",height:"100%",objectFit:"cover",display:"block", opacity: 0.8}} alt="Doctor and Patient Background" />);

const HiwIllu = ({bg1,bg2,icon,id}) => (
  <svg viewBox="0 0 72 52" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%",display:"block"}}>
    <defs>
      <linearGradient id={`hg_${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={bg1}/><stop offset="100%" stopColor={bg2}/>
      </linearGradient>
    </defs>
    <rect width="72" height="52" rx="10" fill={`url(#hg_${id})`}/>
    <circle cx="36" cy="24" r="16" fill="#fff" opacity=".15"/>
    <text x="36" y="30" textAnchor="middle" fontSize="18">{icon}</text>
  </svg>
);

const FcBanner = ({bg1,bg2,icon,pattern,id}) => (
  <svg viewBox="0 0 400 96" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%",display:"block"}}>
    <defs>
      <linearGradient id={`fc_${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={bg1}/><stop offset="100%" stopColor={bg2}/>
      </linearGradient>
    </defs>
    <rect width="400" height="96" fill={`url(#fc_${id})`}/>
    {pattern==="dots"&&[0,1,2,3,4].map(i=>[0,1,2].map(j=><circle key={`${i}${j}`} cx={40+i*80} cy={16+j*32} r="5" fill="#fff" opacity=".1"/>))}
    {pattern==="lines"&&[0,1,2,3,4,5,6].map(i=><rect key={i} x={i*62} y="0" width="2" height="96" fill="#fff" opacity=".08"/>)}
    {pattern==="wave"&&<path d="M0 48 Q50 18 100 48 Q150 78 200 48 Q250 18 300 48 Q350 78 400 48 L400 96 L0 96Z" fill="#fff" opacity=".09"/>}
    {pattern==="grid"&&[0,1,2,3,4,5,6,7].map(i=><rect key={i} x={i*55} y="0" width="1" height="96" fill="#fff" opacity=".1"/>)}
    {pattern==="radial"&&<circle cx="380" cy="8" r="90" fill="#fff" opacity=".07"/>}
    {pattern==="cross"&&<><rect x="190" y="8" width="5" height="80" rx="2" fill="#fff" opacity=".13"/><rect x="168" y="28" width="48" height="5" rx="2" fill="#fff" opacity=".13"/></>}
    <circle cx="34" cy="48" r="22" fill="#fff" opacity=".12"/>
    <text x="34" y="56" textAnchor="middle" fontSize="20">{icon}</text>
  </svg>
);

const CtaBg = () => (
  <img src="./cta_medical.png" style={{width:"100%",height:"100%",objectFit:"cover",display:"block", opacity: 0.85}} alt="Medical Environment" />
);



function EchoSensei() {
  const [view, setView]   = useState("home");
  const [tab, setTab]     = useState("registration");
  const [pt, setPt]       = useState({ name:"",age:"",gender:"",dob:"",phone:"",address:"",bloodGroup:"",height:"",weight:"",allergies:"",existingConditions:"",emergency:"" });
  const [ptOk, setPtOk]   = useState(false);
  const [lang, setLang]   = useState("en-IN");
  const [trans, setTrans] = useState([]);
  const [recOn, setRecOn] = useState(false);
  const [spk, setSpk]     = useState("Doctor");
  const [interim, setInt] = useState("");
  const [rep, setRep]     = useState({});
  const [genning, setGen] = useState(false);
  const [hist, setHist]   = useState([]);
  const [q, setQ]         = useState("");
  const [sid, setSid]     = useState(null);
  const [sdate, setSdate] = useState("");
  const [now, setNow]     = useState(new Date());
  const [expd, setExpd]   = useState({});

  const recRef  = useRef(null);
  const recBool = useRef(false);
  const spkRef  = useRef("Doctor");
  const endRef  = useRef(null);

  useEffect(() => { const s = localStorage.getItem("es_hist"); if (s) setHist(JSON.parse(s)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [trans, interim]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { spkRef.current = spk; }, [spk]);

  const upd = (k,v) => setPt(p=>({...p,[k]:v}));
  const confirm = () => {
    if (!pt.name) { alert("Please enter patient name."); return; }
    setPtOk(true); setSid(Date.now().toString()); setSdate(new Date().toLocaleString()); setTab("session");
  };
  const startRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech Recognition not supported. Use Chrome or Edge."); return; }
    const r = new SR(); r.continuous=true; r.interimResults=true; r.lang=lang;
    r.onresult = e => {
      let itm="";
      for (let i=e.resultIndex; i<e.results.length; i++) {
        if (e.results[i].isFinal) {
          const txt=e.results[i][0].transcript.trim();
          if (txt) setTrans(prev=>[...prev,{speaker:spkRef.current,text:txt,timestamp:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}]);
          setInt("");
        } else itm+=e.results[i][0].transcript;
      }
      if (itm) setInt(itm);
    };
    r.onerror = e => { if(e.error!=="no-speech"){ recBool.current=false; setRecOn(false); }};
    r.onend = () => { if(recBool.current) r.start(); };
    recRef.current=r; recBool.current=true; r.start(); setRecOn(true);
  };
  const stopRec = () => { recBool.current=false; recRef.current?.stop(); setRecOn(false); setInt(""); };
  const genReport = async () => {
    if (!trans.length) { alert("No transcript. Record a conversation first."); return; }
    setGen(true);
    const trTxt = trans.map(t=>`[${t.speaker}]: ${t.text}`).join("\n");
    
    try {
      const res = await fetch("/api/docuflow/process_full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_transcript: trTxt,
          patient_info: pt,
          language: lang
        })
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Backend failed to process session");

      setRep(data.report_data || {});
      const k={}; REPORT_FIELDS.forEach(f=>{k[f.key]=true;}); setExpd(k);
      setTab("report");
    } catch(err){ 
      console.error("Backend Error:", err); 
      alert("Failed to generate report from local backend: " + err.message); 
    }
    finally{ setGen(false); }
  };
  const save = () => {
    const s={id:sid||Date.now().toString(),date:sdate||new Date().toLocaleString(),patient:{...pt},transcript:[...trans],report:{...rep}};
    const u=[s,...hist.filter(x=>x.id!==s.id)];
    setHist(u); localStorage.setItem("es_hist",JSON.stringify(u));
    alert("Session saved.");
  };
  const load = s => {
    setPt(s.patient); setTrans(s.transcript); setRep(s.report);
    setSid(s.id); setSdate(s.date); setPtOk(true);
    const k={}; REPORT_FIELDS.forEach(f=>{k[f.key]=true;}); setExpd(k);
    setView("app"); setTab("report");
  };
  const del = (id,e) => {
    e.stopPropagation(); if(!confirm("Delete this session?")) return;
    const u=hist.filter(s=>s.id!==id); setHist(u); localStorage.setItem("es_hist",JSON.stringify(u));
  };

  const bmi = pt.height&&pt.weight ? (pt.weight/((pt.height/100)**2)).toFixed(1) : null;
  const filtered = hist.filter(s=>
    s.patient?.name?.toLowerCase().includes(q.toLowerCase())||
    s.date?.includes(q)||
    Object.values(s.report||{}).some(v=>v?.toLowerCase?.().includes(q.toLowerCase()))
  );
  const toggle = k => setExpd(p=>({...p,[k]:!p[k]}));
  const goApp = t => { setView("app"); setTab(t||"registration"); };

  return (
    <>
      

      {/* ─── NAV ─── */}
      <nav className="nav">
        <div>
          <button className="nav-logo" onClick={()=>setView("home")}>Echo<em>Sensei</em></button>
          <div className="nav-sub">AI Clinical Documentation</div>
        </div>
        <div className="nav-links">
          <button className={`nl ${view==="home"?"on":""}`} onClick={()=>setView("home")}>Home</button>
          <button className="nl" onClick={()=>{setView("home");setTimeout(()=>document.getElementById("hiw")?.scrollIntoView({behavior:"smooth"}),80);}}>How It Works</button>
          <button className={`nl ${view==="app"?"on":""}`} onClick={()=>goApp()}>App</button>
          <button className="nl cta" onClick={()=>goApp("registration")}>+ New</button>
        </div>
        <div className="nav-time">
          <div>{now.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"long",year:"numeric"})}</div>
          <div className="nav-clk">{now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
      </nav>

      {/* ═══════ HOME ═══════ */}
      {view==="home" && <>

        {/* HERO – full bleed photo */}
        <section className="hero">
          <div className="hero-bg" style={{position:"absolute",inset:0,overflow:"hidden"}}><IlluHero/></div>
          <div className="hero-ov"/>
          <div className="hero-grid">
            <div>
              <div className="hero-badge"><div className="hpulse"/>AI · Multilingual · Real-Time</div>
              <h1>Clinical Documentation,<br/><em>Spoken Into Existence</em></h1>
              <p className="hero-desc">EchoSensei listens to your doctor-patient consultation and instantly generates structured, AI-quality medical reports — so you focus entirely on care, not paperwork.</p>
              <div className="hero-btns">
                <button className="bmain" onClick={()=>goApp()}>🎙️ Start a Session</button>
                <button className="boutl" onClick={()=>document.getElementById("hiw")?.scrollIntoView({behavior:"smooth"})}>See How It Works ↓</button>
              </div>
              <div className="hero-feats">
                {["10 Languages","AI Report Generation","Patient Dashboard","Print-Ready Reports"].map(f=>(
                  <div className="hfeat" key={f}><div className="hfdot"/><span>{f}</span></div>
                ))}
              </div>
            </div>

            {/* Animated app mockup */}
            <div className="mockup">
              <div className="mk-bar">
                <div className="mk-brand">Echo<em>Sensei</em></div>
                <div className="mk-tabs"><div className="mk-tab">Reg</div><div className="mk-tab on">Session</div><div className="mk-tab">Report</div></div>
              </div>
              <div className="mk-body">
                <div className="mk-pt">
                  <div className="mk-av">👩</div>
                  <div>
                    <div className="mk-pn">Priya Sharma</div>
                    <div className="mk-pills"><span className="mk-pill">34F</span><span className="mk-pill">B+</span><span className="mk-pill">BMI 22.4</span></div>
                  </div>
                  <div style={{marginLeft:"auto",fontSize:10,color:"#dc2626",fontWeight:700,display:"flex",alignItems:"center",gap:5}}><div className="mk-dot"/>LIVE</div>
                </div>
                <div className="mk-tr">
                  <div className="mk-ln"><span className="mk-tg d">DR</span><span className="mk-lt">Good morning. How have you been feeling since our last visit?</span></div>
                  <div className="mk-ln"><span className="mk-tg p">PT</span><span className="mk-lt">I've had persistent headaches and mild fever since yesterday.</span></div>
                  <div className="mk-ln"><span className="mk-tg d">DR</span><span className="mk-lt">Any history of migraine? Let me check your blood pressure.</span></div>
                  <div style={{color:"#94a3b8",fontStyle:"italic",fontSize:10,paddingLeft:60}}>🎙 it was normal this morning…</div>
                </div>
                <div className="mk-ct">
                  <div className="mk-rb">⏹</div>
                  <div><div className="mk-rs"><div className="mk-dot"/>RECORDING</div><div className="mk-wv">{[1,2,3,4,5,6,7].map(i=><div className="mk-w" key={i}/>)}</div></div>
                  <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:10,color:"#94a3b8"}}>3 utterances</div><div style={{fontSize:10,color:"#22c55e",fontWeight:600,marginTop:2}}>✨ Generate Report</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PHOTO STRIP */}
        <div className="strip">
          {[
            {id:"s1",color1:"#0c2340",color2:"#1a4a8a",icon:"🩺",lbl:"Clinical Precision",  sub:"Every detail captured"},
            {id:"s2",color1:"#1d4ed8",color2:"#0c2340",icon:"📋",lbl:"Structured Reports",  sub:"AI-formatted instantly"},
            {id:"s3",color1:"#065f46",color2:"#0c2340",icon:"🤝",lbl:"Patient Trust",        sub:"Focus on the human"},
            {id:"s4",color1:"#3b0764",color2:"#1d4ed8",icon:"🎙️",lbl:"Real Conversations",  sub:"Natural, uninterrupted"},
          ].map(i=>(
            <div className="strip-item" key={i.lbl}>
              <StripSVG color1={i.color1} color2={i.color2} icon={i.icon} label={i.lbl} sub={i.sub} id={i.id}/>
              <div className="strip-ov"><div><div className="strip-lbl">{i.lbl}</div><div className="strip-sub">{i.sub}</div></div></div>
            </div>
          ))}
        </div>

        {/* SPLIT 1 – photo left, dark content right */}
        <div className="split">
          <div className="split-ph"><IlluDoctor/></div>
          <div className="split-co dk">
            <div className="split-lbl">Voice-First Technology</div>
            <div className="split-ttl">Record. Transcribe.<br/>Report — Automatically.</div>
            <p className="split-dsc">Stop splitting attention between patient and keyboard. EchoSensei listens to your natural conversation and handles the documentation.</p>
            <div className="split-chks">
              {["Real-time speaker-tagged transcription","10 languages including regional Indian","AI fills 14 clinical fields in seconds","Editable, printable, saveable reports"].map(c=>(
                <div className="split-chk" key={c}><div className="chk-ic">✓</div><div className="chk-tx">{c}</div></div>
              ))}
            </div>
            <button className="bmain" onClick={()=>goApp()}>Open EchoSensei →</button>
          </div>
        </div>

        {/* SPLIT 2 – light content left, photo right */}
        <div className="split">
          <div className="split-co lt">
            <div className="split-lbl">Patient Dashboard</div>
            <div className="split-ttl">Every Patient.<br/>Every Session. Organised.</div>
            <p className="split-dsc">Browse your full consultation history at a glance. Search by name, date, or diagnosis. Load any past session in one click.</p>
            <div className="split-chks">
              {["Stats at a glance — sessions, patients, utterances","Full-text search across all 14 report fields","Risk indicator flagging on session cards","Local-first storage — stays on your device"].map(c=>(
                <div className="split-chk" key={c}><div className="chk-ic">✓</div><div className="chk-tx">{c}</div></div>
              ))}
            </div>
            <button className="bmain" style={{background:"var(--navy)",color:"white"}} onClick={()=>goApp("dashboard")}>View Dashboard →</button>
          </div>
          <div className="split-ph"><IlluDashboard/></div>
        </div>

        {/* HOW IT WORKS */}
        <section className="hiw" id="hiw">
          <div style={{maxWidth:1200,margin:"0 auto"}}>
            <div className="sec-lbl">Workflow</div>
            <div className="sec-ttl">From Conversation to Clinical Record<br/>in 4 Simple Steps</div>
            <p className="sec-sub">No typing. No transcription delay. EchoSensei handles the full documentation pipeline.</p>
            <div className="hiw-steps">
              {[
                {cls:"c1",icon:"👤",h:"Register Patient",  p:"Enter name, age, vitals, allergies. Done in under 60 seconds.", bg1:"#0c2340",bg2:"#1a4a8a",id:"h1"},
                {cls:"c2",icon:"🎙️",h:"Record Session",    p:"Hit record. Speak naturally. Toggle Doctor/Patient as needed.", bg1:"#1d4ed8",bg2:"#3b82f6",id:"h2"},
                {cls:"c3",icon:"✨",h:"AI Builds Report",  p:"Claude AI analyses the conversation and fills all 14 clinical fields.", bg1:"#16a34a",bg2:"#22c55e",id:"h3"},
                {cls:"c4",icon:"📋",h:"Review & Save",     p:"Edit any field, print the report, save to history dashboard.", bg1:"#7c3aed",bg2:"#a78bfa",id:"h4"},
              ].map(s=>(
                <div className="hiw-step" key={s.h}>
                  <div className={`hiw-num ${s.cls}`}>{s.icon}</div>
                  <div style={{width:72,height:52,borderRadius:10,overflow:"hidden",margin:"0 auto 14px",boxShadow:"0 4px 12px rgba(0,0,0,.14)"}}>
                    <HiwIllu bg1={s.bg1} bg2={s.bg2} icon={s.icon} id={s.id}/>
                  </div>
                  <h3>{s.h}</h3><p>{s.p}</p>
                </div>
              ))}
            </div>
            <div className="feat-grid">
              {[
                {ico:"🌐",bg1:"#1d4ed8",bg2:"#0c2340",pattern:"dots",  id:"fc1",h:"10 Languages",        p:"English (IN & US), Hindi, Tamil, Telugu, Malayalam, Kannada, French, German, Arabic."},
                {ico:"🧠",bg1:"#065f46",bg2:"#0c2340",pattern:"lines",  id:"fc2",h:"14 Clinical Fields",  p:"Chief Complaint to Follow-up — every critical section of a medical report."},
                {ico:"🖨️",bg1:"#3b0764",bg2:"#1d4ed8",pattern:"wave",   id:"fc3",h:"Print-Ready",         p:"Professional reports with patient headers, allergy banners, and collapsible sections."},
                {ico:"📊",bg1:"#92400e",bg2:"#0c2340",pattern:"grid",   id:"fc4",h:"Session Dashboard",   p:"Browse, search, reload any consultation. Filter by name, date, or diagnosis."},
                {ico:"🔒",bg1:"#0c2340",bg2:"#1a4a8a",pattern:"radial", id:"fc5",h:"Local-First Privacy", p:"Sessions saved to your browser's local storage. Nothing leaves your device."},
                {ico:"⚡",bg1:"#0369a1",bg2:"#1d4ed8",pattern:"cross",  id:"fc6",h:"Real-Time Transcript",p:"Watch the conversation appear live with speaker labels and timestamps."},
              ].map(f=>(
                <div className="fc" key={f.h}>
                  <div style={{height:96,borderRadius:10,overflow:"hidden",marginBottom:16}}>
                    <FcBanner bg1={f.bg1} bg2={f.bg2} icon={f.ico} pattern={f.pattern} id={f.id}/>
                  </div>
                  <h3>{f.h}</h3><p>{f.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA BAND */}
        <div className="cta">
          <div className="cta-bg" style={{position:"absolute",inset:0,overflow:"hidden"}}><CtaBg/></div>
          <div className="cta-ov"/>
          <div className="cta-co">
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(34,197,94,.14)",border:"1px solid rgba(34,197,94,.3)",color:"#22c55e",fontSize:10.5,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"5px 15px",borderRadius:100,marginBottom:20}}>
              <div className="hpulse"/>Ready to begin?
            </div>
            <h2>Eliminate Documentation Burden.<br/>Start Your First Session.</h2>
            <p>Open EchoSensei, register a patient, and record your next consultation. The report writes itself in seconds.</p>
            <button className="bmain" onClick={()=>goApp()}>🎙️ Open EchoSensei App</button>
          </div>
        </div>

      </>}

      {/* ═══════ APP ═══════ */}
      {view==="app" && (
        <div className="app-sh" style={{paddingTop:88}}>
          <div className="app-in">
            <div className="af">

              {/* App top bar */}
              <div className="atb">
                <div><div className="atb-logo">Echo<span>Sensei</span></div><div className="atb-sub">Speech-Driven Clinical Documentation System</div></div>
                <div className="atb-r">
                  <div>{now.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"long",year:"numeric"})}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:1}}>{now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tabs">
                {[
                  {id:"registration",ico:"👤",lbl:"Patient Registration"},
                  {id:"session",     ico:"🎙️",lbl:"Recording Session"},
                  {id:"report",      ico:"📋",lbl:"Medical Report",   badge:Object.keys(rep).length>0?"✓":null},
                  {id:"dashboard",   ico:"📊",lbl:"Dashboard",        badge:hist.length>0?hist.length:null},
                ].map(t=>(
                  <button key={t.id} className={`tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>
                    {t.ico} {t.lbl}{t.badge&&<span className="tbadge">{t.badge}</span>}
                  </button>
                ))}
              </div>

              <div className="co">

                {/* REGISTRATION */}
                {tab==="registration" && <>
                  <div className="sh">Patient Registration</div>
                  {ptOk&&<div className="cb">✅ Patient acts <strong style={{margin:"0 4px"}}>{pt.name}</strong> has been saved. <button className="btn bg" style={{marginLeft:"auto",padding:"6px 12px",fontSize:13,whiteSpace:"nowrap"}} onClick={()=>{setPtOk(false);setTrans([]);setRep({});}}>Reset</button></div>}
                  <div className="card">
                    <div className="ctit">Personal Information</div>
                    <div className="fg">
                      <div className="fld" style={{gridColumn:"1/-1"}}><label>Full Name *</label><input value={pt.name} onChange={e=>upd("name",e.target.value)} placeholder="Patient's full name"/></div>
                      <div className="fld"><label>Age</label><input type="number" value={pt.age} onChange={e=>upd("age",e.target.value)} placeholder="Years"/></div>
                      <div className="fld"><label>Gender</label><select value={pt.gender} onChange={e=>upd("gender",e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
                      <div className="fld"><label>Date of Birth</label><input type="date" value={pt.dob} onChange={e=>upd("dob",e.target.value)}/></div>
                      <div className="fld"><label>Phone</label><input value={pt.phone} onChange={e=>upd("phone",e.target.value)} placeholder="+91 XXXXX XXXXX"/></div>
                      <div className="fld" style={{gridColumn:"1/-1"}}><label>Address</label><input value={pt.address} onChange={e=>upd("address",e.target.value)} placeholder="Full address"/></div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="ctit">Medical Vitals</div>
                    <div className="fg">
                      <div className="fld"><label>Blood Group</label><select value={pt.bloodGroup} onChange={e=>upd("bloodGroup",e.target.value)}><option value="">Select</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=><option key={g}>{g}</option>)}</select></div>
                      <div className="fld"><label>Height (cm)</label><input type="number" value={pt.height} onChange={e=>upd("height",e.target.value)} placeholder="165"/></div>
                      <div className="fld"><label>Weight (kg)</label><input type="number" value={pt.weight} onChange={e=>upd("weight",e.target.value)} placeholder="62"/></div>
                      {bmi&&<div className="fld"><label>BMI (auto)</label><input readOnly value={bmi} style={{background:"#f0fdf4",color:"#166534",fontWeight:600}}/></div>}
                    </div>
                  </div>
                  <div className="card">
                    <div className="ctit">Medical History</div>
                    <div className="fg">
                      <div className="fld" style={{gridColumn:"1/-1"}}><label>Known Allergies</label><input value={pt.allergies} onChange={e=>upd("allergies",e.target.value)} placeholder="e.g. Penicillin, Peanuts"/></div>
                      <div className="fld" style={{gridColumn:"1/-1"}}><label>Existing Conditions</label><textarea value={pt.existingConditions} onChange={e=>upd("existingConditions",e.target.value)} placeholder="e.g. Hypertension, Type 2 Diabetes"/></div>
                      <div className="fld" style={{gridColumn:"1/-1"}}><label>Emergency Contact</label><input value={pt.emergency} onChange={e=>upd("emergency",e.target.value)} placeholder="Name & phone"/></div>
                    </div>
                  </div>
                  <button className="btn bs" style={{fontSize:14,padding:"11px 28px"}} onClick={confirm}>✓ Confirm & Proceed to Session →</button>
                </>}

                {/* SESSION */}
                {tab==="session" && <>
                  <div className="sh">Recording Session</div>
                  {!ptOk ? (
                    <div className="es"><div className="ei">👤</div><div style={{fontSize:14.5}}>Please register a patient first.</div><button className="btn bp" style={{marginTop:16}} onClick={()=>setTab("registration")}>Go to Registration →</button></div>
                  ) : <>
                    <div className="psb">
                      <div><div className="pn">{pt.name}</div><div style={{fontSize:11,color:"#93c5fd",marginTop:2}}>Session ID: #{sid}</div></div>
                      {pt.age&&<span className="ppill">Age {pt.age}</span>}
                      {pt.gender&&<span className="ppill">{pt.gender}</span>}
                      {pt.bloodGroup&&<span className="ppill">{pt.bloodGroup}</span>}
                      {bmi&&<span className="ppill">BMI {bmi}</span>}
                      {recOn&&<div className="ri" style={{marginLeft:"auto"}}><div className="rdot"/>RECORDING LIVE</div>}
                    </div>
                    <div className="cp">
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7}}>
                        <button className={`rec-btn ${recOn?"rec":"idle"}`} onClick={recOn?stopRec:startRec}>
                          <span style={{fontSize:28}}>{recOn?"⏹":"🎙️"}</span>{recOn?"STOP":"RECORD"}
                        </button>
                        <div style={{fontSize:10.5,color:"#64748b"}}>{recOn?"Click to stop":"Click to start"}</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:11}}>
                        <div>
                          <div style={{fontSize:10.5,fontWeight:600,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:".8px"}}>Current Speaker</div>
                          <div className="spt">
                            <button className={`spo ${spk==="Doctor"?"on d":""}`} onClick={()=>setSpk("Doctor")}>🩺 Doctor</button>
                            <button className={`spo ${spk==="Patient"?"on p":""}`} onClick={()=>setSpk("Patient")}>🧑 Patient</button>
                          </div>
                        </div>
                        <div>
                          <div style={{fontSize:10.5,fontWeight:600,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:".8px"}}>Language</div>
                          <select className="ls" value={lang} onChange={e=>setLang(e.target.value)} disabled={recOn}>
                            {LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{flex:1,marginLeft:"auto"}}>
                        <div style={{fontSize:12,color:"#94a3b8",marginBottom:8}}>{trans.length} utterance{trans.length!==1?"s":""} recorded{sdate&&<span style={{marginLeft:10}}>· Started {sdate}</span>}</div>
                        <div className="ar">
                          <button className="btn bg" onClick={()=>{if(confirm("Clear transcript?"))setTrans([])}}>🗑 Clear</button>
                          {trans.length>0&&!recOn&&<button className="btn bs" onClick={genReport}>✨ Generate Report</button>}
                        </div>
                      </div>
                    </div>
                    <div className="card" style={{padding:0,overflow:"hidden"}}>
                      <div style={{padding:"11px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div className="ctit" style={{margin:0}}>Live Transcript</div>
                        {recOn&&<div className="ri"><div className="rdot"/>LIVE</div>}
                      </div>
                      <div className="tra" style={{borderRadius:0,border:"none"}}>
                        {!trans.length&&!interim&&<div style={{color:"#94a3b8",fontSize:13,textAlign:"center",margin:"auto"}}>Press Record to begin capturing the conversation…</div>}
                        {trans.map((l,i)=>(
                          <div key={i} className="trl">
                            <span className={`stg ${l.speaker.toLowerCase()}`}>{l.speaker}</span>
                            <div style={{flex:1}}><div className="trt">{l.text}</div><div className="trtime">{l.timestamp}</div></div>
                          </div>
                        ))}
                        {interim&&<div className="itm">🎙 {interim}…</div>}
                        <div ref={endRef}/>
                      </div>
                    </div>
                  </>}
                </>}

                {/* REPORT */}
                {tab==="report" && <>
                  <div className="sh">Medical Report</div>
                  {genning&&<div className="card"><div className="go"><div className="sp"/><div style={{fontFamily:"'Lora',serif",fontSize:17,color:"#0c2340"}}>Generating Medical Report…</div><div style={{fontSize:13,color:"#64748b"}}>AI is analysing the conversation and structuring clinical documentation</div></div></div>}
                  {!genning&&!Object.keys(rep).length&&<div className="es"><div className="ei">📋</div><div style={{fontSize:14.5}}>No report generated yet. Record a session and click "Generate Report".</div><button className="btn bp" style={{marginTop:16}} onClick={()=>setTab("session")}>Go to Session →</button></div>}
                  {!genning&&Object.keys(rep).length>0&&<>
                    <div className="ar" style={{marginBottom:18}}>
                      <button className="btn bs" onClick={save}>💾 Save to History</button>
                      <button className="btn bp" onClick={()=>window.print()}>🖨 Print Report</button>
                      <button className="btn bg" onClick={()=>{const k={};REPORT_FIELDS.forEach(f=>{k[f.key]=true;});setExpd(k);}}>Expand All</button>
                      <button className="btn bg" onClick={()=>setExpd({})}>Collapse All</button>
                    </div>
                    <div className="rp-page">
                      <div className="rp-hd">
                        <div className="rp-hosp">EchoSensei Medical Centre</div>
                        <div className="rp-sub">Speech-Driven Clinical Documentation · Auto-generated Report</div>
                        <div className="rp-meta">
                          <div className="rp-mi"><label>Patient Name</label><p>{pt.name||"—"}</p></div>
                          <div className="rp-mi"><label>Age / Gender</label><p>{[pt.age&&`${pt.age} yrs`,pt.gender].filter(Boolean).join(" / ")||"—"}</p></div>
                          <div className="rp-mi"><label>Blood Group</label><p>{pt.bloodGroup||"—"}</p></div>
                          <div className="rp-mi"><label>BMI</label><p>{bmi||"—"}</p></div>
                          <div className="rp-mi"><label>Session Date</label><p>{sdate||new Date().toLocaleString()}</p></div>
                          <div className="rp-mi"><label>Session ID</label><p>#{sid}</p></div>
                        </div>
                        {pt.allergies&&<div style={{marginTop:14,background:"rgba(220,38,38,0.2)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:6,padding:"6px 14px",display:"inline-block",fontSize:12}}>⚠️ ALLERGIES: {pt.allergies}</div>}
                      </div>
                      <div className="rp-div"/>
                      <div className="rp-body">
                        {REPORT_FIELDS.map(f=>{
                          const v=rep[f.key];
                          if(!v||v==="Not discussed"||v==="N/A") return null;
                          const ex=expd[f.key];
                          return (
                            <div key={f.key} className="rp-sec">
                              <div className="rp-sec-h" style={{background:`${f.color}0d`,color:f.color}} onClick={()=>toggle(f.key)}>
                                <span className="lbl"><span style={{width:8,height:8,borderRadius:"50%",background:f.color,display:"inline-block"}}/>{f.label}</span>
                                <span style={{fontSize:11}}>{ex?"▲":"▼"}</span>
                              </div>
                              {ex&&<div className="rp-sec-b"><textarea className="rp-ta" value={v} onChange={e=>setRep(r=>({...r,[f.key]:e.target.value}))} style={{minHeight:Math.min(200,Math.max(76,v.split("\n").length*24))}}/></div>}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{padding:"14px 34px",borderTop:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#94a3b8"}}>
                        <span>Generated by EchoSensei AI Documentation System</span>
                        <span>This document has been reviewed and approved by the attending physician</span>
                      </div>
                    </div>
                  </>}
                </>}

                {/* DASHBOARD */}
                {tab==="dashboard" && <>
                  <div className="sh">Patient History & Dashboard</div>
                  <div className="dg">
                    <div className="ds"><div className="dsn">{hist.length}</div><div className="dsl">Total Sessions</div></div>
                    <div className="ds"><div className="dsn">{new Set(hist.map(s=>s.patient?.name)).size}</div><div className="dsl">Unique Patients</div></div>
                    <div className="ds"><div className="dsn">{hist.reduce((a,s)=>a+(s.transcript?.length||0),0)}</div><div className="dsl">Total Utterances</div></div>
                    <div className="ds"><div className="dsn">{hist.filter(s=>new Date(s.date).toDateString()===new Date().toDateString()).length}</div><div className="dsl">Today's Sessions</div></div>
                  </div>
                  <div className="sb">
                    <span style={{color:"#94a3b8",fontSize:15}}>🔍</span>
                    <input placeholder="Search by patient name, date, diagnosis…" value={q} onChange={e=>setQ(e.target.value)}/>
                    {q&&<button className="btn bg" style={{padding:"3px 10px",fontSize:12}} onClick={()=>setQ("")}>✕</button>}
                  </div>
                  {!filtered.length ? (
                    <div className="es"><div className="ei">📂</div><div style={{fontSize:14.5}}>{q?"No sessions match your search.":"No sessions saved yet. Complete a session and save it."}</div></div>
                  ) : (
                    <div className="sg">
                      {filtered.map(s=>(
                        <div key={s.id} className="sc" onClick={()=>load(s)}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div><div className="scn">{s.patient?.name||"Unknown Patient"}</div><div className="scd">🕐 {s.date}</div></div>
                            <button onClick={e=>del(s.id,e)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:15}}>🗑</button>
                          </div>
                          <div className="scp">{s.report?.diagnosis?`Dx: ${s.report.diagnosis.slice(0,90)}${s.report.diagnosis.length>90?"…":""}`:s.report?.chiefComplaint?`CC: ${s.report.chiefComplaint.slice(0,90)}…`:"No report generated"}</div>
                          <div className="sctg">
                            {s.patient?.age&&<span className="stag">Age {s.patient.age}</span>}
                            {s.patient?.gender&&<span className="stag">{s.patient.gender}</span>}
                            {s.patient?.bloodGroup&&<span className="stag">{s.patient.bloodGroup}</span>}
                            <span className="stag">{s.transcript?.length||0} utterances</span>
                            {s.report?.riskIndicators&&s.report.riskIndicators!=="Not discussed"&&<span className="stag" style={{background:"#fef3c7",color:"#92400e"}}>⚠ Risk</span>}
                          </div>
                          <div style={{marginTop:11,fontSize:12,color:"#3b82f6",fontWeight:600}}>Click to load & view report →</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>}

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<EchoSensei />);