import { useState, useRef, useEffect } from "react";

const CATEGORIES = ["Operasi","Perjalanan","Makanan","Peralatan","Utiliti","Lain-lain"];
const MONTHS = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

const PLANS = {
  free: { label: "FREE", color: "#94a3b8", limit: 10, features: ["10 resit/bulan","Simpan lokal","Laporan asas"] },
  pro: { label: "PRO", color: "#f59e0b", limit: Infinity, features: ["Resit tanpa had","Google Drive sync","Laporan lengkap","Export Excel","Multi-pengguna"] }
};

function formatRM(num) {
  return "RM " + Number(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function getMonthLabel(key) {
  const [y,m] = key.split("-");
  return `${MONTHS[parseInt(m)-1]} ${y}`;
}

export default function WiraDigital() {
  const [screen, setScreen] = useState("home"); // home | app | pricing
  const [plan, setPlan] = useState("free");
  const [records, setRecords] = useState(() => { try { return JSON.parse(localStorage.getItem("wira_records")||"[]"); } catch { return []; } });
  const [form, setForm] = useState({ penerima:"", kategori:"Operasi", jumlah:"", catatan:"", tarikh: new Date().toISOString().slice(0,10) });
  const [rawInput, setRawInput] = useState("");
  const [view, setView] = useState("tambah");
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [toast, setToast] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [snapMode, setSnapMode] = useState(false);
  const [camErr, setCamErr] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => { try { localStorage.setItem("wira_records", JSON.stringify(records)); } catch {} }, [records]);
  useEffect(() => { if (!snapMode) { stopCam(); return; } startCam(); return () => stopCam(); }, [snapMode]);

  const thisMonthCount = records.filter(r => r.bulan === getMonthKey(new Date())).length;
  const overLimit = plan === "free" && thisMonthCount >= PLANS.free.limit;

  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

  async function startCam() {
    setCamErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setCamErr("Kamera tidak dapat diakses."); }
  }
  function stopCam() { if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; } }

  function snapPhoto() {
    const v=videoRef.current, c=canvasRef.current;
    if (!v||!c) return;
    c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    setSnapMode(false);
    analyzeImage();
  }

  async function analyzeImage() {
    setAnalyzing(true);
    const BACKEND = "https://script.google.com/macros/s/AKfycbxH7B-lfZ867wqPvYj5nktxFt6k8QOUT99LrMbN9oPABN-GahbkSqkFeEw58FOzqNCi8g/exec";
    try {
      const imgData = canvasRef.current.toDataURL("image/jpeg").split(",")[1];
      const res = await fetch(BACKEND, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"analisis", imageBase64: imgData })
      });
      const data = await res.json();
      if (data.status === "ok" && data.data) {
        const obj = data.data;
        setParsed(obj);
        setForm(f=>({...f, penerima:obj.penerima||f.penerima, kategori:CATEGORIES.includes(obj.kategori)?obj.kategori:"Lain-lain", jumlah:obj.jumlah?String(obj.jumlah):f.jumlah, catatan:obj.catatan||f.catatan, tarikh:obj.tarikh||f.tarikh}));
        showToast("✅ Resit berjaya dianalisis!");
      } else { showToast("Gagal analisis. Isi manual.","err"); }
    } catch { showToast("Gagal analisis. Isi manual.","err"); }
    setAnalyzing(false);
  }

  async function analyzeText() {
    if (!rawInput.trim()) return showToast("Masukkan teks resit","err");
    setAnalyzing(true);
    const BACKEND = "https://script.google.com/macros/s/AKfycbxH7B-lfZ867wqPvYj5nktxFt6k8QOUT99LrMbN9oPABN-GahbkSqkFeEw58FOzqNCi8g/exec";
    try {
      const res = await fetch(BACKEND, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"analisis_teks", teks: rawInput })
      });
      const data = await res.json();
      if (data.status === "ok" && data.data) {
        const obj = data.data;
        setParsed(obj);
        setForm(f=>({...f, penerima:obj.penerima||f.penerima, kategori:CATEGORIES.includes(obj.kategori)?obj.kategori:"Lain-lain", jumlah:obj.jumlah?String(obj.jumlah):f.jumlah, catatan:obj.catatan||f.catatan, tarikh:obj.tarikh||f.tarikh}));
        showToast("✅ Teks berjaya dianalisis!");
      } else { showToast("Gagal analisis. Cuba lagi.","err"); }
    } catch { showToast("Gagal analisis. Cuba lagi.","err"); }
    setAnalyzing(false);
  }

  async function handleSimpan() {
    if (overLimit) { setShowUpgrade(true); return; }
    if (!form.penerima.trim()) return showToast("Masukkan nama penerima","err");
    if (!form.jumlah || isNaN(Number(form.jumlah)) || Number(form.jumlah)<=0) return showToast("Masukkan jumlah yang sah","err");
    const BACKEND = "https://script.google.com/macros/s/AKfycbxH7B-lfZ867wqPvYj5nktxFt6k8QOUT99LrMbN9oPABN-GahbkSqkFeEw58FOzqNCi8g/exec";
    const rec = { id:Date.now(), ...form, jumlah:parseFloat(form.jumlah), bulan:getMonthKey(form.tarikh), createdAt:new Date().toISOString() };
    setRecords(r=>[rec,...r]);
    setForm({penerima:"",kategori:"Operasi",jumlah:"",catatan:"",tarikh:new Date().toISOString().slice(0,10)});
    setRawInput(""); setParsed(null);
    showToast("✅ Resit disimpan! Menghantar ke Google Drive...");
    try {
      const res = await fetch(BACKEND, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"simpan", resit: rec })
      });
      const data = await res.json();
      if (data.status === "ok") { showToast("☁️ Resit disimpan ke Google Drive!"); }
      else { showToast("Simpan lokal berjaya. Drive gagal.","err"); }
    } catch { showToast("Simpan lokal berjaya. Drive gagal.","err"); }
  }

  function deleteRecord(id) { setRecords(r=>r.filter(x=>x.id!==id)); setDetailId(null); showToast("Resit dipadam.","err"); }

  const monthRecords = records.filter(r=>r.bulan===selectedMonth);
  const monthTotal = monthRecords.reduce((s,r)=>s+r.jumlah,0);
  const byCategory = CATEGORIES.map(k=>({k, v:monthRecords.filter(r=>r.kategori===k).reduce((s,r)=>s+r.jumlah,0)})).filter(x=>x.v>0);
  const allMonths = [...new Set(records.map(r=>r.bulan))].sort().reverse();
  const detailRecord = records.find(r=>r.id===detailId);
  const totalAll = records.reduce((s,r)=>s+r.jumlah,0);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    :root{
      --bg:#f8f7f4;--card:#ffffff;--border:#e8e4dc;--text:#1a1814;--muted:#8a8278;
      --accent:#e8500a;--accent2:#1a1814;--green:#16a34a;--yellow:#d97706;
    }
    body{background:var(--bg);font-family:'Plus Jakarta Sans',sans-serif;color:var(--text);}
    .serif{font-family:'Instrument Serif',serif;}

    /* HOME */
    .home{min-height:100vh;background:var(--text);color:#f8f7f4;position:relative;overflow:hidden;}
    .home-noise{position:absolute;inset:0;opacity:.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:200px;}
    .home-inner{position:relative;z-index:1;padding:0 24px;}
    .home-nav{display:flex;justify-content:space-between;align-items:center;padding:20px 0;}
    .logo{display:flex;align-items:center;gap:8px;}
    .logo-mark{width:32px;height:32px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;}
    .logo-text{font-weight:800;font-size:18px;letter-spacing:-.5px;}
    .hero{padding:60px 0 40px;}
    .hero-tag{display:inline-flex;align-items:center;gap:6px;background:rgba(232,80,10,.15);border:1px solid rgba(232,80,10,.3);color:#ff7040;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:24px;}
    .hero h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-1.5px;margin-bottom:16px;}
    .hero h1 em{font-style:normal;color:var(--accent);}
    .hero p{color:#94a3b8;font-size:15px;line-height:1.7;margin-bottom:32px;}
    .hero-btns{display:flex;gap:12px;flex-wrap:wrap;}
    .btn-hero{padding:14px 28px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;border:none;letter-spacing:.3px;transition:all .2s;}
    .btn-hero-main{background:var(--accent);color:#fff;}
    .btn-hero-main:hover{background:#c94008;transform:translateY(-2px);}
    .btn-hero-ghost{background:rgba(255,255,255,.08);color:#f8f7f4;border:1px solid rgba(255,255,255,.12);}
    .btn-hero-ghost:hover{background:rgba(255,255,255,.14);}
    .features{padding:40px 0 60px;display:grid;gap:12px;}
    .feat-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;}
    .feat-icon{font-size:24px;margin-bottom:10px;}
    .feat-card h3{font-size:15px;font-weight:700;margin-bottom:6px;}
    .feat-card p{font-size:13px;color:#94a3b8;line-height:1.6;}
    .free-badge{background:rgba(232,80,10,.1);border:1px solid rgba(232,80,10,.2);color:#ff7040;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:1px;}

    /* APP */
    .app{min-height:100vh;background:var(--bg);}
    .app-header{background:var(--card);border-bottom:1px solid var(--border);padding:16px 20px;position:sticky;top:0;z-index:50;}
    .app-header-inner{max-width:640px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;}
    .app-logo{display:flex;align-items:center;gap:8px;font-weight:800;font-size:16px;letter-spacing:-.3px;}
    .plan-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:1px;}
    .plan-free{background:#f1f5f9;color:#64748b;}
    .plan-pro{background:#fef3c7;color:#d97706;}
    .app-body{max-width:640px;margin:0 auto;padding:20px;}

    /* NAV TABS */
    .tabs{display:flex;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:20px;gap:2px;}
    .tab{flex:1;padding:10px 8px;border:none;border-radius:8px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;transition:all .2s;background:transparent;color:var(--muted);}
    .tab-active{background:var(--accent);color:#fff;}

    /* CARDS */
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px;}
    .card-sm{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:all .2s;}
    .card-sm:hover{border-color:var(--accent);box-shadow:0 0 0 3px rgba(232,80,10,.06);}

    /* FORM */
    label{font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px;}
    input,select,textarea{background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;width:100%;outline:none;transition:border .2s;}
    input:focus,select:focus,textarea:focus{border-color:var(--accent);}
    .field{margin-bottom:16px;}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .span2{grid-column:1/-1;}

    /* BUTTONS */
    .btn-main{background:var(--accent);color:#fff;border:none;border-radius:12px;padding:14px 24px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:14px;cursor:pointer;width:100%;transition:all .2s;letter-spacing:.3px;}
    .btn-main:hover{background:#c94008;}
    .btn-main:disabled{background:#d1c9be;cursor:not-allowed;}
    .btn-outline{background:transparent;border:1.5px solid var(--border);color:var(--text);border-radius:10px;padding:10px 18px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;}
    .btn-outline:hover{border-color:var(--accent);color:var(--accent);}
    .btn-danger{background:#fef2f2;border:1.5px solid #fecaca;color:#dc2626;border-radius:10px;padding:12px 18px;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;width:100%;}

    /* STATS */
    .stat-big{font-size:32px;font-weight:800;letter-spacing:-1px;color:var(--text);}
    .stat-label{font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;}

    /* PROGRESS */
    .progress-bg{height:6px;background:var(--border);border-radius:3px;margin-top:6px;}
    .progress-fill{height:6px;border-radius:3px;background:var(--accent);transition:width .5s;}

    /* CATEGORY BADGE */
    .cat-badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569;}

    /* TOAST */
    .toast{position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:999;animation:toastIn .3s;box-shadow:0 8px 24px rgba(0,0,0,.1);}
    .toast-ok{background:#f0fdf4;border:1px solid #86efac;color:#16a34a;}
    .toast-err{background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;}
    @keyframes toastIn{from{transform:translateX(40px);opacity:0;}to{transform:translateX(0);opacity:1;}}

    /* CAM */
    .cam-overlay{position:fixed;inset:0;background:#000;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px;}

    /* MODAL */
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-end;}
    .modal{background:var(--card);border-radius:24px 24px 0 0;padding:28px 24px 40px;width:100%;max-width:640px;margin:0 auto;}

    /* PRICING */
    .pricing{min-height:100vh;background:var(--bg);padding:0 24px 60px;}
    .pricing-header{padding:24px 0 40px;text-align:center;}
    .pricing-header h2{font-size:30px;font-weight:800;letter-spacing:-1px;margin-bottom:8px;}
    .pricing-header p{color:var(--muted);font-size:14px;}
    .price-card{background:var(--card);border:1.5px solid var(--border);border-radius:20px;padding:24px;margin-bottom:16px;}
    .price-card-pro{border-color:var(--accent);background:linear-gradient(135deg,#fff5f0,#fff);}
    .price-tag{font-size:36px;font-weight:800;letter-spacing:-1px;}
    .price-period{font-size:13px;color:var(--muted);}
    .feat-list{list-style:none;margin-top:16px;display:flex;flex-direction:column;gap:10px;}
    .feat-list li{display:flex;align-items:center;gap:10px;font-size:14px;}
    .check{color:var(--green);font-weight:700;}

    /* LIMIT BAR */
    .limit-bar{background:#fff5f0;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:13px;}

    /* ANALYZING */
    .analyzing{display:flex;align-items:center;gap:8px;color:var(--accent);font-size:13px;font-weight:600;padding:10px 0;}
    @keyframes spin{to{transform:rotate(360deg)}}
    .spinner{width:16px;height:16px;border:2px solid #fed7aa;border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
  `;

  // ─── HOME SCREEN ───
  if (screen === "home") return (
    <div className="home">
      <style>{css}</style>
      <div className="home-noise" />
      <div className="home-inner">
        <nav className="home-nav">
          <div className="logo">
            <div className="logo-mark">R</div>
            <span className="logo-text">Ranger Web2U</span>
          </div>
          <button className="btn-hero btn-hero-ghost" style={{padding:"10px 18px",fontSize:13}} onClick={()=>setScreen("pricing")}>Harga</button>
        </nav>
        <div className="hero">
          <div className="hero-tag">🇲🇾 Untuk SME Malaysia</div>
          <h1 className="serif">Snap Resit.<br/><em>Selesai.</em></h1>
          <p>Habis beli barang — snap, buang resit tu. Semua tersimpan dalam Google Drive ikut bulan, kiraan auto. Tak hilang, boleh claim bila-bila.</p>
          <div className="hero-btns">
            <button className="btn-hero btn-hero-main" onClick={()=>setScreen("app")}>Cuba Percuma →</button>
            <button className="btn-hero btn-hero-ghost" onClick={()=>setScreen("pricing")}>Lihat Pelan</button>
          </div>
        </div>
        <div className="features">
          {[
            ["📷","Snap & Selesai","Ambil gambar resit, AI baca terus. Jumlah, tarikh, vendor — semua auto terisi."],
            ["☁️","Google Drive Sync","Resit tersimpan dalam folder ikut bulan. Tak hilang walaupun tukar phone."],
            ["📊","Laporan Auto","Tengok berapa dah keluar bulan ni, pecahan ikut kategori, export bila nak."],
            ["👥","Untuk Pekerja & Company","Pekerja snap resit sendiri. Company tengok semua dalam satu dashboard."],
          ].map(([i,t,d])=>(
            <div className="feat-card" key={t}>
              <div className="feat-icon">{i}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",paddingBottom:40}}>
          <span className="free-badge">FREE</span>
          <p style={{color:"#94a3b8",fontSize:13,marginTop:8}}>10 resit/bulan percuma. Upgrade bila dah ready.</p>
          <button className="btn-hero btn-hero-main" style={{marginTop:16}} onClick={()=>setScreen("app")}>Mula Sekarang</button>
        </div>
      </div>
    </div>
  );

  // ─── PRICING SCREEN ───
  if (screen === "pricing") return (
    <div className="pricing">
      <style>{css}</style>
      <div className="pricing-header">
        <button className="btn-outline" style={{marginBottom:20,width:"auto",padding:"8px 16px",fontSize:12}} onClick={()=>setScreen("home")}>← Kembali</button>
        <h2>Pilih Pelan Anda</h2>
        <p>Mula percuma. Upgrade bila bisnes berkembang.</p>
      </div>
      <div style={{maxWidth:400,margin:"0 auto"}}>
        <div className="price-card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Free</div>
              <div className="price-tag">RM 0</div>
              <div className="price-period">selamanya</div>
            </div>
            <span style={{fontSize:24}}>🆓</span>
          </div>
          <ul className="feat-list">
            {["10 resit sebulan","Simpan dalam peranti","Laporan asas","Analisis AI"].map(f=>(
              <li key={f}><span className="check">✓</span>{f}</li>
            ))}
          </ul>
          <button className="btn-main" style={{marginTop:20,background:"var(--text)"}} onClick={()=>{setPlan("free");setScreen("app");}}>
            {plan==="free"?"✓ Pelan Semasa":"Pilih Free"}
          </button>
        </div>
        <div className="price-card price-card-pro">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Pro ⚡</div>
              <div className="price-tag">RM 29</div>
              <div className="price-period">/ bulan per syarikat</div>
            </div>
            <span style={{fontSize:24}}>🚀</span>
          </div>
          <ul className="feat-list">
            {["Resit tanpa had","Google Drive auto sync","Laporan & analitik penuh","Export Excel / PDF","Multi-pengguna (5 akaun)","Support prioriti"].map(f=>(
              <li key={f}><span className="check" style={{color:"var(--accent)"}}>✓</span>{f}</li>
            ))}
          </ul>
          <button className="btn-main" style={{marginTop:20}} onClick={()=>{setPlan("pro");setScreen("app");showToast("🎉 Pro aktif! (Demo)","ok");}}>
            {plan==="pro"?"✓ Pelan Semasa":"Upgrade ke Pro"}
          </button>
        </div>
        <p style={{textAlign:"center",fontSize:12,color:"var(--muted)",marginTop:16}}>Soalan? DM kami di Threads @rangerweb2u</p>
      </div>
    </div>
  );

  // ─── APP SCREEN ───
  return (
    <div className="app">
      <style>{css}</style>
      {toast && <div className={`toast ${toast.type==="err"?"toast-err":"toast-ok"}`}>{toast.msg}</div>}

      {/* Camera */}
      {snapMode && (
        <div className="cam-overlay">
          {camErr
            ? <div style={{color:"#ff6060",textAlign:"center"}}>{camErr}</div>
            : <video ref={videoRef} autoPlay playsInline style={{maxWidth:440,width:"100%",borderRadius:16,border:"3px solid var(--accent)"}} />
          }
          <canvas ref={canvasRef} style={{display:"none"}} />
          <div style={{display:"flex",gap:12}}>
            {!camErr && <button className="btn-main" style={{width:"auto",padding:"14px 36px",fontSize:16}} onClick={snapPhoto}>📸 Snap</button>}
            <button className="btn-outline" style={{background:"rgba(255,255,255,.1)",color:"#fff",borderColor:"rgba(255,255,255,.2)"}} onClick={()=>setSnapMode(false)}>Batal</button>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="modal-bg" onClick={()=>setShowUpgrade(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:40,marginBottom:12}}>⚡</div>
              <h3 style={{fontSize:20,fontWeight:800,letterSpacing:-.5,marginBottom:8}}>Had Free Dicapai</h3>
              <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.6}}>Anda telah guna 10/10 resit bulan ini. Upgrade ke Pro untuk resit tanpa had & Google Drive sync.</p>
            </div>
            <button className="btn-main" style={{marginBottom:10}} onClick={()=>{setShowUpgrade(false);setScreen("pricing");}}>Upgrade ke Pro — RM 29/bulan</button>
            <button className="btn-outline" style={{width:"100%"}} onClick={()=>setShowUpgrade(false)}>Tunggu Bulan Depan</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <div style={{width:28,height:28,background:"var(--accent)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14}}>R</div>
            Ranger Web2U
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span className={`plan-badge ${plan==="pro"?"plan-pro":"plan-free"}`}>{plan.toUpperCase()}</span>
            <button className="btn-outline" style={{padding:"6px 12px",fontSize:11}} onClick={()=>setScreen("pricing")}>
              {plan==="free"?"Upgrade ⚡":"Pelan Saya"}
            </button>
          </div>
        </div>
      </div>

      <div className="app-body">
        {/* Stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          <div className="card" style={{padding:16}}>
            <div className="stat-label">Bulan Ini</div>
            <div className="stat-big" style={{fontSize:24}}>{formatRM(records.filter(r=>r.bulan===getMonthKey(new Date())).reduce((s,r)=>s+r.jumlah,0))}</div>
          </div>
          <div className="card" style={{padding:16}}>
            <div className="stat-label">Keseluruhan</div>
            <div className="stat-big" style={{fontSize:24}}>{formatRM(totalAll)}</div>
          </div>
        </div>

        {/* Limit bar (free only) */}
        {plan==="free" && (
          <div className="limit-bar">
            <span style={{fontWeight:600}}>{thisMonthCount}/10 resit bulan ini</span>
            <button style={{background:"none",border:"none",color:"var(--accent)",fontWeight:700,fontSize:13,cursor:"pointer"}} onClick={()=>setScreen("pricing")}>Upgrade →</button>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          {[["tambah","+ Tambah"],["laporan","📊 Laporan"],["rekod","📋 Rekod"]].map(([v,l])=>(
            <button key={v} className={`tab ${view===v?"tab-active":""}`} onClick={()=>{setView(v);setDetailId(null);}}>{l}</button>
          ))}
        </div>

        {/* ── TAMBAH ── */}
        {view==="tambah" && (
          <>
            {/* AI Section */}
            <div className="card">
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"var(--muted)",textTransform:"uppercase",marginBottom:12}}>🤖 Analisis AI</div>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <button className="btn-main" style={{flex:"0 0 auto",width:"auto",padding:"11px 18px",fontSize:13}} onClick={()=>setSnapMode(true)}>📷 Snap</button>
                <textarea rows={2} placeholder="Atau tampal teks dari resit..." value={rawInput} onChange={e=>setRawInput(e.target.value)} style={{flex:1,resize:"none",fontSize:13,padding:"10px 12px"}} />
                <button className="btn-outline" style={{flex:"0 0 auto",alignSelf:"flex-end",padding:"11px 14px",fontSize:13,whiteSpace:"nowrap"}} onClick={analyzeText}>Analisis</button>
              </div>
              {analyzing && <div className="analyzing"><div className="spinner"/><span>AI sedang membaca resit...</span></div>}
              {parsed && !analyzing && <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:10,fontSize:12,color:"#16a34a",fontWeight:600}}>✅ Maklumat diekstrak — semak borang di bawah</div>}
            </div>

            {/* Form */}
            <div className="card">
              <div style={{fontSize:15,fontWeight:800,marginBottom:16,letterSpacing:-.3}}>Butiran Resit</div>
              <div className="grid2">
                <div className="field span2">
                  <label>Penerima / Vendor</label>
                  <input placeholder="cth: Petronas, Kedai ABC..." value={form.penerima} onChange={e=>setForm(f=>({...f,penerima:e.target.value}))} />
                </div>
                <div className="field">
                  <label>Jumlah (RM)</label>
                  <input type="number" placeholder="0.00" value={form.jumlah} onChange={e=>setForm(f=>({...f,jumlah:e.target.value}))} style={{fontSize:form.jumlah?22:14,fontWeight:form.jumlah?"800":"400",color:form.jumlah?"var(--accent)":undefined}} />
                  {form.jumlah && !isNaN(Number(form.jumlah)) && <div style={{marginTop:4,fontSize:13,color:"var(--accent)",fontWeight:700}}>{formatRM(form.jumlah)}</div>}
                </div>
                <div className="field">
                  <label>Tarikh</label>
                  <input type="date" value={form.tarikh} onChange={e=>setForm(f=>({...f,tarikh:e.target.value}))} />
                </div>
                <div className="field span2">
                  <label>Kategori</label>
                  <select value={form.kategori} onChange={e=>setForm(f=>({...f,kategori:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field span2">
                  <label>Catatan (pilihan)</label>
                  <input placeholder="Tujuan perbelanjaan..." value={form.catatan} onChange={e=>setForm(f=>({...f,catatan:e.target.value}))} />
                </div>
              </div>
              <button className="btn-main" onClick={handleSimpan} disabled={analyzing}>
                {overLimit ? "⚡ Had Dicapai — Upgrade Pro" : "💾 Simpan Resit"}
              </button>
              {plan==="pro" && <div style={{textAlign:"center",marginTop:10,fontSize:12,color:"var(--muted)"}}>☁️ Auto sync ke Google Drive selepas simpan</div>}
            </div>
          </>
        )}

        {/* ── LAPORAN ── */}
        {view==="laporan" && (
          <>
            <div className="field">
              <label>Pilih Bulan</label>
              <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}>
                {allMonths.length===0 && <option value={selectedMonth}>{getMonthLabel(selectedMonth)}</option>}
                {allMonths.map(m=><option key={m} value={m}>{getMonthLabel(m)}</option>)}
              </select>
            </div>
            <div className="card" style={{borderColor:"rgba(232,80,10,.2)",background:"linear-gradient(135deg,#fff5f0,#fff)"}}>
              <div className="stat-label">{getMonthLabel(selectedMonth)}</div>
              <div className="stat-big">{formatRM(monthTotal)}</div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{monthRecords.length} transaksi</div>
            </div>
            {byCategory.length>0 && (
              <div className="card">
                <div style={{fontSize:14,fontWeight:800,marginBottom:16,letterSpacing:-.3}}>Pecahan Kategori</div>
                {byCategory.sort((a,b)=>b.v-a.v).map(({k,v})=>(
                  <div key={k} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:600}}>
                      <span>{k}</span>
                      <span style={{color:"var(--accent)"}}>{formatRM(v)}</span>
                    </div>
                    <div className="progress-bg"><div className="progress-fill" style={{width:`${(v/monthTotal*100).toFixed(1)}%`}} /></div>
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>{(v/monthTotal*100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            )}
            {monthRecords.length===0
              ? <div style={{textAlign:"center",color:"var(--muted)",padding:40,fontSize:13}}>Tiada rekod untuk bulan ini</div>
              : monthRecords.map(r=>(
                <div key={r.id} className="card-sm" onClick={()=>{setDetailId(r.id);setView("rekod");}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{r.penerima}</div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>{r.tarikh} · <span className="cat-badge">{r.kategori}</span></div>
                    </div>
                    <div style={{fontWeight:800,fontSize:16,color:"var(--accent)"}}>{formatRM(r.jumlah)}</div>
                  </div>
                </div>
              ))
            }
          </>
        )}

        {/* ── REKOD ── */}
        {view==="rekod" && !detailRecord && (
          <>
            <div style={{fontSize:14,fontWeight:800,marginBottom:12,letterSpacing:-.3}}>Semua Rekod ({records.length})</div>
            {records.length===0
              ? <div style={{textAlign:"center",color:"var(--muted)",padding:60,fontSize:14}}>Belum ada rekod.<br/>Snap resit pertama anda!</div>
              : records.map(r=>(
                <div key={r.id} className="card-sm" onClick={()=>setDetailId(r.id)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{r.penerima}</div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{r.tarikh} · {r.kategori} · {getMonthLabel(r.bulan)}</div>
                    </div>
                    <div style={{fontWeight:800,fontSize:15,color:"var(--accent)"}}>{formatRM(r.jumlah)}</div>
                  </div>
                </div>
              ))
            }
          </>
        )}

        {/* ── DETAIL ── */}
        {view==="rekod" && detailRecord && (
          <>
            <button className="btn-outline" style={{width:"auto",marginBottom:16,padding:"8px 14px",fontSize:12}} onClick={()=>setDetailId(null)}>← Kembali</button>
            <div className="card">
              <div className="stat-label">Jumlah Resit</div>
              <div className="stat-big" style={{color:"var(--accent)",marginBottom:16}}>{formatRM(detailRecord.jumlah)}</div>
              <div style={{height:1,background:"var(--border)",marginBottom:16}} />
              {[["Penerima",detailRecord.penerima],["Tarikh",detailRecord.tarikh],["Kategori",detailRecord.kategori],["Bulan",getMonthLabel(detailRecord.bulan)],["Catatan",detailRecord.catatan||"—"],["Dicipta",new Date(detailRecord.createdAt).toLocaleString("ms-MY")]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:12,fontSize:14}}>
                  <span style={{color:"var(--muted)",fontSize:12,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{l}</span>
                  <span style={{fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{v}</span>
                </div>
              ))}
              <div style={{height:1,background:"var(--border)",margin:"16px 0"}} />
              <button className="btn-danger" onClick={()=>deleteRecord(detailRecord.id)}>🗑 Padam Rekod</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
