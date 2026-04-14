import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "./supabaseClient";

const CHEM_ORDER = ['C','Si','Mn','P','S','Cu','Ni','Cr','Mo','V','Nb','Ti','B','Ceq'];
const CHEM_LABELS = {C:'탄소 (C)',Si:'규소 (Si)',Mn:'망간 (Mn)',P:'인 (P)',S:'황 (S)',Cu:'구리 (Cu)',Ni:'니켈 (Ni)',Cr:'크롬 (Cr)',Mo:'몰리브덴 (Mo)',V:'바나듐 (V)',Nb:'니오브 (Nb)',Ti:'티타늄 (Ti)',B:'보론 (B)',Ceq:'탄소당량 (Ceq)'};
const MECH_PROPS = ['yieldStrength','tensileStrength','elongation','charpy'];
const MECH_LABELS = {yieldStrength:'항복강도',tensileStrength:'인장강도',elongation:'연신율',charpy:'샤르피충격값'};
const MECH_UNITS = {yieldStrength:'MPa',tensileStrength:'MPa',elongation:'%',charpy:'J'};

const DEFAULT_CODES = [
  {id:1,code:'SS400',standard:'KS D 3503',description:'일반구조용 압연강재',chemical:{C:{max:null},P:{max:0.050},S:{max:0.050}},mechanical:{yieldStrength:{min:245},tensileStrength:{min:400,max:510},elongation:{min:21}}},
  {id:2,code:'SM400A',standard:'KS D 3515',description:'용접구조용 압연강재',chemical:{C:{max:0.23},P:{max:0.035},S:{max:0.035}},mechanical:{yieldStrength:{min:245},tensileStrength:{min:400,max:510},elongation:{min:23}}},
  {id:3,code:'SM400B',standard:'KS D 3515',description:'용접구조용 압연강재',chemical:{C:{max:0.20},Si:{max:0.35},Mn:{min:0.60},P:{max:0.035},S:{max:0.035}},mechanical:{yieldStrength:{min:245},tensileStrength:{min:400,max:510},elongation:{min:23}}},
  {id:4,code:'SM490A',standard:'KS D 3515',description:'용접구조용 압연강재',chemical:{C:{max:0.20},Si:{max:0.55},Mn:{max:1.65},P:{max:0.035},S:{max:0.035}},mechanical:{yieldStrength:{min:315},tensileStrength:{min:490,max:610},elongation:{min:17}}},
  {id:5,code:'SM490B',standard:'KS D 3515',description:'용접구조용 압연강재',chemical:{C:{max:0.18},Si:{max:0.55},Mn:{max:1.65},P:{max:0.035},S:{max:0.035}},mechanical:{yieldStrength:{min:315},tensileStrength:{min:490,max:610},elongation:{min:17},charpy:{min:27}}},
  {id:6,code:'SM490YA',standard:'KS D 3515',description:'용접구조용 압연강재 (고항복점)',chemical:{C:{max:0.20},Si:{max:0.55},Mn:{max:1.65},P:{max:0.035},S:{max:0.035}},mechanical:{yieldStrength:{min:365},tensileStrength:{min:490,max:610},elongation:{min:15}}},
  {id:7,code:'SM520B',standard:'KS D 3515',description:'용접구조용 압연강재',chemical:{C:{max:0.20},Si:{max:0.55},Mn:{max:1.65},P:{max:0.035},S:{max:0.035}},mechanical:{yieldStrength:{min:365},tensileStrength:{min:520,max:640},elongation:{min:15}}},
  {id:8,code:'SM570',standard:'KS D 3515',description:'용접구조용 압연강재 (고강도)',chemical:{C:{max:0.18},Si:{max:0.55},Mn:{max:1.70},P:{max:0.035},S:{max:0.035}},mechanical:{yieldStrength:{min:450},tensileStrength:{min:570,max:720},elongation:{min:19},charpy:{min:47}}},
  {id:9,code:'ASTM A36',standard:'ASTM A36',description:'일반구조용 탄소강',chemical:{C:{max:0.26},P:{max:0.04},S:{max:0.05}},mechanical:{yieldStrength:{min:250},tensileStrength:{min:400,max:550},elongation:{min:20}}},
  {id:10,code:'A572 Gr.50',standard:'ASTM A572',description:'고장력 저합금 구조용강',chemical:{C:{max:0.23},Si:{max:0.40},Mn:{max:1.35},P:{max:0.04},S:{max:0.05}},mechanical:{yieldStrength:{min:345},tensileStrength:{min:450,max:620},elongation:{min:18}}},
];

const fmtLim = (lim) => {
  if (!lim) return '—';
  const p = [];
  if (lim.min != null) p.push('≥' + lim.min);
  if (lim.max != null) p.push('≤' + lim.max);
  return p.join(' ~ ') || '—';
};

const gn = (v) => (v === '' ? null : parseFloat(v));

// ── 스타일 상수 ────────────────────────────────────────────
const c = {
  bg:        '#080c14',
  s1:        '#0d1220',
  s2:        '#111827',
  s3:        '#1a2235',
  b1:        '#1e2d45',
  b2:        '#253450',
  acc:       '#1d6fdb',
  acc2:      '#0ea5e9',
  t1:        '#e2e8f0',
  t2:        '#94a3b8',
  t3:        '#4a5568',
  passBg:    'rgba(22,163,74,0.1)',
  passB:     'rgba(22,163,74,0.3)',
  failBg:    'rgba(220,38,38,0.1)',
  failB:     'rgba(220,38,38,0.3)',
};

const css = {
  wrap:      { fontFamily:"'Noto Sans KR',sans-serif", background: c.bg, minHeight:'100vh', color: c.t1 },
  hdr:       { background:`linear-gradient(180deg,#0a1628,${c.s1})`, borderBottom:`1px solid ${c.b1}`, padding:'13px 20px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:100 },
  hdrIcon:   { width:34, height:34, background:`linear-gradient(135deg,${c.acc},${c.acc2})`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, boxShadow:'0 0 16px rgba(29,111,219,.4)', flexShrink:0 },
  tabs:      { display:'flex', borderBottom:`1px solid ${c.b1}`, background: c.s1, padding:'0 20px' },
  tab:       (on) => ({ padding:'10px 16px', fontSize:13, fontWeight:500, color: on ? c.acc2 : c.t2, cursor:'pointer', borderBottom: on ? `2px solid ${c.acc}` : '2px solid transparent', transition:'all .15s', fontFamily:"'Noto Sans KR',sans-serif" }),
  main:      { padding:20, maxWidth:1040, margin:'0 auto' },
  card:      { background: c.s2, border:`1px solid ${c.b1}`, borderRadius:10, overflow:'hidden', marginBottom:14 },
  cardHdr:   { padding:'12px 16px', borderBottom:`1px solid ${c.b1}`, background: c.s1, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8 },
  cardBody:  { padding:16 },
  uploadZone:(drag) => ({ border:`2px dashed ${drag?c.acc:c.b2}`, borderRadius:10, padding:'40px 24px', textAlign:'center', cursor:'pointer', transition:'all .2s', background: drag?`rgba(29,111,219,.08)`:c.s1 }),
  fileRow:   { background: c.s1, border:`1px solid ${c.b1}`, borderRadius:8, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 },
  btn:       (v='p') => {
    const base = { display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', transition:'all .2s', fontFamily:"'Noto Sans KR',sans-serif", whiteSpace:'nowrap' };
    if (v==='p') return {...base, background:`linear-gradient(135deg,${c.acc},${c.acc2})`, color:'#fff', boxShadow:'0 0 16px rgba(29,111,219,.3)'};
    if (v==='s') return {...base, background: c.s3, color: c.t1, border:`1px solid ${c.b2}`};
    if (v==='d') return {...base, background:'rgba(220,38,38,.1)', color:'#f87171', border:'1px solid rgba(220,38,38,.3)'};
    if (v==='sm') return {...base, padding:'5px 11px', fontSize:11, background: c.s3, color: c.t1, border:`1px solid ${c.b2}`};
    return base;
  },
  verdict:   (pass) => ({ borderRadius:10, padding:'16px 20px', display:'flex', alignItems:'center', gap:14, marginBottom:14, background: pass?c.passBg:c.failBg, border:`1px solid ${pass?c.passB:c.failB}` }),
  vResult:   (pass) => ({ fontSize:22, fontWeight:700, fontFamily:'monospace', color: pass?'#4ade80':'#f87171' }),
  infoGrid:  { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8 },
  infoItem:  { background: c.s1, border:`1px solid ${c.b1}`, borderRadius:7, padding:'10px 12px' },
  summary:   { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 },
  sumCard:   (type) => ({ background: c.s2, border:`1px solid ${c.b1}`, borderRadius:8, padding:'10px', textAlign:'center', color: type==='total'?c.acc2 : type==='pass'?'#4ade80':'#f87171' }),
  th:        { padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', letterSpacing:'1px', color: c.t2, borderBottom:`1px solid ${c.b1}`, background: c.s1, whiteSpace:'nowrap' },
  td:        { padding:'9px 12px', borderBottom:`1px solid rgba(30,45,69,.4)`, verticalAlign:'middle' },
  badge:     (st) => {
    if (st==='pass') return { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, fontFamily:'monospace', background:'rgba(22,163,74,.1)', color:'#4ade80', border:'1px solid rgba(22,163,74,.3)' };
    if (st==='fail') return { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, fontFamily:'monospace', background:'rgba(220,38,38,.1)', color:'#f87171', border:'1px solid rgba(220,38,38,.3)' };
    return { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, fontFamily:'monospace', background: c.s3, color: c.t3, border:`1px solid ${c.b1}` };
  },
  fi:        { background: c.s1, border:`1px solid ${c.b1}`, borderRadius:6, padding:'7px 10px', color: c.t1, fontSize:13, fontFamily:'monospace', outline:'none', width:'100%' },
  modal:     { position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modalBox:  { background: c.s2, border:`1px solid ${c.b2}`, borderRadius:12, width:'100%', maxWidth:620, maxHeight:'82vh', overflowY:'auto' },
  formGrid:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 },
  fsec:      { fontSize:10, fontFamily:'monospace', letterSpacing:'1px', color: c.acc2, margin:'14px 0 8px', paddingBottom:5, borderBottom:`1px solid ${c.b1}` },
  spinner:   { width:34, height:34, border:`3px solid ${c.b2}`, borderTopColor: c.acc, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' },
};

// ── 코드 모달 컴포넌트 ─────────────────────────────────────
const CHEM_FIELDS = [
  { key:'C',   label:'탄소 (C)' },
  { key:'Si',  label:'규소 (Si)' },
  { key:'Mn',  label:'망간 (Mn)' },
  { key:'P',   label:'인 (P)' },
  { key:'S',   label:'황 (S)' },
  { key:'Cu',  label:'구리 (Cu)' },
  { key:'Ni',  label:'니켈 (Ni)' },
  { key:'Cr',  label:'크롬 (Cr)' },
  { key:'Mo',  label:'몰리브덴 (Mo)' },
  { key:'V',   label:'바나듐 (V)' },
  { key:'Nb',  label:'니오브 (Nb)' },
  { key:'Ti',  label:'티타늄 (Ti)' },
  { key:'B',   label:'보론 (B)' },
  { key:'Ceq', label:'탄소당량 (Ceq)' },
];

function CodeModal({ editing, codes, onSave, onClose }) {
  const found = editing ? codes.find(x => x.id === editing) : null;
  const gv = (elem, sub) => found?.chemical?.[elem]?.[sub] != null ? String(found.chemical[elem][sub]) : '';
  const gm = (prop, sub) => found?.mechanical?.[prop]?.[sub] != null ? String(found.mechanical[prop][sub]) : '';

  const initChem = {};
  CHEM_FIELDS.forEach(({ key }) => {
    initChem[key + '_min'] = gv(key, 'min');
    initChem[key + '_max'] = gv(key, 'max');
  });

  const [f, setF] = useState({
    code: found?.code||'', std: found?.standard||'', desc: found?.description||'',
    ...initChem,
    ysmin: gm('yieldStrength','min'),   ysmax: gm('yieldStrength','max'),
    tsmin: gm('tensileStrength','min'), tsmax: gm('tensileStrength','max'),
    elmin: gm('elongation','min'),      charpymin: gm('charpy','min'),
  });
  const set = k => e => setF(p => ({...p, [k]: e.target.value}));
  const inp = (k, ph='—', step='0.001') => (
    <input style={css.fi} value={f[k]||''} onChange={set(k)} placeholder={ph} type="number" step={step} />
  );

  function save() {
    if (!f.code.trim()) { alert('코드명은 필수입니다.'); return; }
    const chemical = {};
    CHEM_FIELDS.forEach(({ key }) => {
      const mn = gn(f[key+'_min']), mx = gn(f[key+'_max']);
      if (mn != null || mx != null) chemical[key] = { min: mn, max: mx };
    });
    onSave({
      id: editing || f.code.toLowerCase().replace(/\s/g,'-') + Date.now(),
      code: f.code.trim(), standard: f.std.trim(), description: f.desc.trim(),
      chemical,
      mechanical: {
        yieldStrength:  { min:gn(f.ysmin),      max:gn(f.ysmax) },
        tensileStrength:{ min:gn(f.tsmin),      max:gn(f.tsmax) },
        elongation:     { min:gn(f.elmin) },
        charpy:         { min:gn(f.charpymin) },
      }
    });
  }

  const labelStyle = { fontSize:10, fontFamily:'monospace', color:c.t2, marginBottom:4 };
  const rangeRow = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 };

  return (
    <div style={css.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{...css.modalBox, maxWidth:700}}>
        <div style={{padding:'14px 20px', borderBottom:`1px solid ${c.b1}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:c.s2}}>
          <span style={{fontSize:14,fontWeight:700}}>{found ? '코드 수정: '+found.code : '코드 추가'}</span>
          <span style={{cursor:'pointer',color:c.t2,fontSize:18}} onClick={onClose}>✕</span>
        </div>
        <div style={{padding:20}}>

          {/* 기본 정보 */}
          <div style={css.fsec}>기본 정보</div>
          <div style={css.formGrid}>
            <div><div style={labelStyle}>코드명 *</div><input style={css.fi} value={f.code} onChange={set('code')} placeholder="예: SS400" /></div>
            <div><div style={labelStyle}>규격</div><input style={css.fi} value={f.std} onChange={set('std')} placeholder="예: KS D 3503" /></div>
            <div style={{gridColumn:'1/-1'}}><div style={labelStyle}>설명</div><input style={css.fi} value={f.desc} onChange={set('desc')} placeholder="예: 일반구조용 압연강재" /></div>
          </div>

          {/* 화학조성 */}
          <div style={css.fsec}>화학조성 (wt%) — 비어있으면 기준 없음</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10}}>
            {CHEM_FIELDS.map(({ key, label }) => (
              <div key={key} style={{background:c.s1, border:`1px solid ${c.b1}`, borderRadius:7, padding:'10px 12px'}}>
                <div style={{fontSize:11, fontWeight:600, marginBottom:8, color:c.acc2, fontFamily:'monospace'}}>{label}</div>
                <div style={rangeRow}>
                  <div>
                    <div style={labelStyle}>min</div>
                    {inp(key+'_min')}
                  </div>
                  <div>
                    <div style={labelStyle}>max</div>
                    {inp(key+'_max')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 기계적 성질 */}
          <div style={css.fsec}>기계적 성질</div>
          <div style={css.formGrid}>
            {[
              ['ysmin','항복강도 min (MPa)','1'],['ysmax','항복강도 max (MPa)','1'],
              ['tsmin','인장강도 min (MPa)','1'],['tsmax','인장강도 max (MPa)','1'],
              ['elmin','연신율 min (%)','0.1'],['charpymin','샤르피충격 min (J)','1'],
            ].map(([k,l,step]) => (
              <div key={k}><div style={labelStyle}>{l}</div><input style={css.fi} value={f[k]||''} onChange={set(k)} placeholder="—" type="number" step={step} /></div>
            ))}
          </div>

        </div>
        <div style={{padding:'12px 20px', borderTop:`1px solid ${c.b1}`, display:'flex', gap:8, justifyContent:'flex-end', position:'sticky', bottom:0, background:c.s2}}>
          <button style={css.btn('s')} onClick={onClose}>취소</button>
          <button style={css.btn('p')} onClick={save}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 앱 ────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('analyze');
  const [codes, setCodes] = useState(DEFAULT_CODES);
  const [history, setHistory] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // ── Supabase: 앱 시작 시 코드 DB + 이력 불러오기 ──────────
  useEffect(() => {
    (async () => {
      // 코드 DB 로드
      const { data: codeRows } = await supabase
        .from('qc_codes')
        .select('*')
        .order('id', { ascending: true });

      if (codeRows && codeRows.length > 0) {
        setCodes(codeRows);
        setSelCode(String(codeRows[0].id));
      } else {
        // 최초 실행: 기본 코드를 Supabase에 삽입
        const { data: inserted } = await supabase
          .from('qc_codes')
          .insert(DEFAULT_CODES)
          .select();
        if (inserted) { setCodes(inserted); setSelCode(String(inserted[0].id)); }
      }

      // 이력 로드 (최신순 100건)
      const { data: histRows } = await supabase
        .from('qc_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (histRows) setHistory(histRows);

      setStorageReady(true);
    })();
  }, []);

  // ── Supabase: 코드 저장 함수 ────────────────────────────────
  async function saveCode(entry, isNew) {
    setSaveStatus('저장 중...');
    let result;
    if (isNew) {
      // 신규: id 제외하고 insert (DB가 bigserial로 자동 생성)
      const { id: _drop, ...rest } = entry;
      result = await supabase.from('qc_codes').insert(rest).select().single();
    } else {
      // 수정: id 기준 update
      const { id, ...rest } = entry;
      result = await supabase.from('qc_codes').update(rest).eq('id', id).select().single();
    }
    if (result.error) { setSaveStatus('저장 실패: ' + result.error.message); console.error(result.error); return null; }
    setSaveStatus('저장됨 ✓');
    setTimeout(() => setSaveStatus(''), 2000);
    return result.data;
  }

  // ── Supabase: 코드 삭제 함수 ────────────────────────────────
  async function deleteCode(id) {
    const { error } = await supabase.from('qc_codes').delete().eq('id', id);
    if (!error) setCodes(prev => prev.filter(x => x.id !== id));
  }

  // ── Supabase: 이력 저장 함수 ────────────────────────────────
  async function saveHistory(entry) {
    const { data } = await supabase.from('qc_history').insert(entry).select();
    if (data) setHistory(prev => [...data, ...prev]);
  }

  // 업로드
  const [file, setFile] = useState(null);
  const [b64, setB64] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  // 분석
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState('');
  const [result, setResult] = useState(null);
  const [selCode, setSelCode] = useState(null);
  const [error, setError] = useState(null);

  // 코드 모달
  const [modal, setModal] = useState(null);

  const loadFile = useCallback(f => {
    if (!f) return;
    if (!['application/pdf','image/jpeg','image/jpg','image/png'].includes(f.type)) { alert('PDF, JPG, PNG 파일만 지원합니다.'); return; }
    setFile(f); setResult(null); setError(null);
    const rd = new FileReader();
    rd.onload = e => setB64(e.target.result.split(',')[1]);
    rd.readAsDataURL(f);
  }, []);

  async function analyze() {
    if (!file || !b64) return;
    setLoading(true); setError(null); setResult(null);

    const steps = ['성적서 OCR 처리 중...','화학조성 추출 중...','기계적 성질 추출 중...','코드 매칭 및 판정 중...'];
    let si = 0;
    setLoadStep(steps[0]);
    const timer = setInterval(() => setLoadStep(steps[si = (si + 1) % steps.length]), 1400);

    const isImg = file.type.startsWith('image/');
    const part = isImg
      ? { type:'image', source:{ type:'base64', media_type:file.type, data:b64 } }
      : { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } };

    try {
      // API 키는 서버(/api/analyze)에서 관리 — 브라우저에 노출되지 않음
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: `You are a steel mill test certificate (MTC) data extractor. Output ONLY a single valid JSON object. No explanation. Start with { end with }.

══════════════════════════════════════════
CRITICAL INSTRUCTION: CHEMICAL UNIT CONVERSION
══════════════════════════════════════════

STEP 1 — IDENTIFY CHEMICAL COLUMNS ONLY
The chemical composition columns are: C, Si, Mn, P, S, Cu, Ni, Cr, Mo, V, Nb, Ti, B, Ceq, Sol(Al).
WARNING: Do NOT read coating weight (부착량, g/m², COATING WEIGHT) as chemical values.
WARNING: Do NOT read tensile/yield strength numbers as chemical values.
Only extract numbers from columns clearly labeled with element symbols.

STEP 2 — DETECT UNIT FORMAT (choose exactly one)

FORMAT A — Hyundai Steel (현대제철) digit-code style:
  The legend shows: "2:×100  3:×1,000  4:×10,000  5:×100,000"
  A row of single digit numbers (2, 3, 4, or 5) appears between the column headers and the data row.
  Each digit is positioned directly above its column's data value.
  Rule: read the digit above each column independently, then apply:
    digit 2 → divide value by 100
    digit 3 → divide value by 1,000
    digit 4 → divide value by 10,000
    digit 5 → divide value by 100,000
  
  CONCRETE EXAMPLE from actual Hyundai Steel certificate:
    Digit row:  C=4,  Si=3, Mn=3, P=4,   S=4
    Raw values: C=548, Si=7, Mn=890, P=100, S=58
    Converted:  C=548÷10000=0.0548, Si=7÷1000=0.007, Mn=890÷1000=0.890, P=100÷10000=0.010, S=58÷10000=0.0058
  
  COMMON MISTAKE TO AVOID: Do not apply the same digit to all columns.
  Each column has its OWN digit. Read each digit separately by horizontal position.

FORMAT B — Dongbu Steel (동부제철) per-column text style:
  Each column header cell contains its own multiplier text: "X 1000", "X 100", "×1/1000" etc.
  Rule: for each column, find its own header text and divide its value by that number.
  
  CONCRETE EXAMPLE from actual Dongbu Steel certificate:
    C header: "X 1000" → raw value 36 → 36÷1000 = 0.036
    P header: "X 1000" → raw value 9  → 9÷1000  = 0.009
    S header: "X 1000" → raw value 3  → 3÷1000  = 0.003
    Mn header: "X 100" → raw value 18 → 18÷100  = 0.18
    Sol header: "X 1000" → raw value 19 → 19÷1000 = 0.019

FORMAT C — Dongkuk Steel (동국제강) whole-table style:
  A single "×1000" or "<×1000>" notation applies to ALL chemical columns uniformly.
  Rule: divide every chemical value by 1,000.

FORMAT D — Already in wt%:
  No multiplier notation present AND values are already in range 0.0001~2.0.
  Rule: use values as-is.

FORMAT E — No notation but abnormally large values (>5):
  Rule: divide by 1,000.

STEP 3 — VALIDATE EVERY VALUE
After conversion, every chemical value MUST satisfy: 0.0001 ≤ value ≤ 2.0 wt%
If any value falls outside this range, you made an error — recheck digit code or multiplier for that column.

STEP 4 — SPECIAL VALUES
"TR", "Tr", "trace" → null
"—", blank, "-" → null

STEP 5 — MECHANICAL PROPERTIES
Locate each property by its column HEADER label, not by position alone.

yieldStrength: column labeled "YP", "Y.P", "항복강도", "Yield" → value in MPa or N/mm² (typical range: 150~700)
tensileStrength: column labeled "TS", "T.S", "인장강도", "Tensile" → value in MPa or N/mm² (typical range: 300~900)
elongation: column labeled "EL", "EL.", "연신율", "Elongation", "연신율(%)" → value in % (typical range: 10~50)
charpy: column labeled "Charpy", "충격값", "CVN" → value in J

CRITICAL WARNING — DO NOT CONFUSE THESE COLUMNS WITH ELONGATION:
Many certificates have additional columns AFTER elongation that look like small numbers:
  "n" column = strain hardening exponent (typical value: 0.1~0.3) — NOT elongation
  "r" column = Lankford r-value (typical value: 0.5~3.0) — NOT elongation
  "HR30T", "HR30N" = hardness values — NOT elongation
  "Bend" = bending test result — NOT elongation
The elongation value is ALWAYS a percentage typically between 10% and 50%.
If you find a value like 9 or 37 next to the tensile data, verify: is it under the "EL." header? 
A value of 9% elongation is extremely unusual — double-check. 37.4% is a normal elongation value.

CONCRETE EXAMPLE (KG Dongbu Steel / 현대제철 type):
  Table columns: YP=247.1 | TS=357.9 | EL.=37.4 | n=(ignore) | r=(ignore)
  Correct extraction: yieldStrength=247.1, tensileStrength=357.9, elongation=37.4
  WRONG extraction: elongation=9 ← this is the "n" column value, NOT elongation

MULTIPLE DIMENSIONS: If multiple thickness rows exist, extract each separately. If chemistry is shared, copy to all dimensions.

Output ONLY this JSON:
{"steelGrade":"exact grade e.g. SS400","manufacturer":"mill name","heatNo":"heat/charge number","orderNo":"cert number","dimensions":[{"thickness":"e.g. 4.5mm","chemical":{"C":null,"Si":null,"Mn":null,"P":null,"S":null,"Cu":null,"Ni":null,"Cr":null,"Mo":null,"V":null,"Nb":null,"Ti":null,"B":null,"Ceq":null},"mechanical":{"yieldStrength":null,"tensileStrength":null,"elongation":null,"charpy":null}}]}

Use null for any value not found.`,
          messages: [{ role:'user', content:[
            part,
            { type:'text', text:'이 철판 성적서의 화학조성과 기계적 성질을 모두 추출하여 JSON으로 반환해주세요.' }
          ]}]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const txt = data.content.map(i => i.text || '').join('');
      // 자연어가 섞여 나와도 JSON 부분만 추출
      const jsonStart = txt.indexOf('{');
      const jsonEnd = txt.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('성적서에서 데이터를 추출할 수 없습니다. 파일이 선명한지 확인해주세요.');
      const parsed = JSON.parse(txt.slice(jsonStart, jsonEnd + 1));
      setResult(parsed);
      const appliedCode = codes.find(cd => String(cd.id) === String(selCode));

      // 이력 저장 — 전체 dimension 합산
      const dims = parsed.dimensions || [{ thickness: parsed.thickness, chemical: parsed.chemical, mechanical: parsed.mechanical }];
      const chemComps = dims.map(d => calcChemComp(d, appliedCode));
      const mechComps = dims.map(d => calcMechComp(d, appliedCode));
      const totalFail = [...chemComps, ...mechComps].reduce((s, m) => s + (m?.fail || 0), 0);
      await saveHistory({
        date: new Date().toLocaleString('ko-KR',{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
        filename: file.name, grade: parsed.steelGrade||'—',
        maker: parsed.manufacturer||'—', heat: parsed.heatNo||'—',
        result: totalFail === 0 ? 'pass' : 'fail', fail: totalFail
      });
    } catch(e) {
      setError('분석 오류: ' + e.message);
    }
    clearInterval(timer);
    setLoading(false);
  }

  // 화학조성 비교 (dimension 안의 chemical 사용)
  function calcChemComp(dim, code) {
    if (!dim || !code) return null;
    let pass = 0, fail = 0;
    const rows = [];
    CHEM_ORDER.forEach(elem => {
      const val = dim.chemical?.[elem];
      if (val == null) return;
      const lim = code.chemical?.[elem];
      let st = 'na';
      if (lim) { st='pass'; if(lim.max!=null&&val>lim.max) st='fail'; if(lim.min!=null&&val<lim.min) st='fail'; }
      if (st==='pass') pass++; if (st==='fail') fail++;
      const ls = lim ? [lim.min!=null?'≥'+lim.min:'',lim.max!=null?'≤'+lim.max:''].filter(Boolean).join(', ')||'—' : '—';
      rows.push({ label:CHEM_LABELS[elem]||elem, val:val.toFixed(4), unit:'wt%', ls:ls+' %', st });
    });
    return { rows, pass, fail, total:pass+fail };
  }

  // 기계적 성질 비교 (단일 dimension)
  function calcMechComp(dim, code) {
    if (!dim || !code) return null;
    let pass = 0, fail = 0;
    const rows = [];
    MECH_PROPS.forEach(prop => {
      const val = dim.mechanical?.[prop];
      if (val == null) return;
      const lim = code.mechanical?.[prop], unit = MECH_UNITS[prop];
      let st = 'na';
      if (lim) { st='pass'; if(lim.max!=null&&val>lim.max) st='fail'; if(lim.min!=null&&val<lim.min) st='fail'; }
      if (st==='pass') pass++; if (st==='fail') fail++;
      rows.push({ label:MECH_LABELS[prop], val:String(val), unit, ls:fmtLim(lim)+' '+unit, st });
    });
    return { rows, pass, fail, total:pass+fail };
  }

  const code = codes.find(cd => String(cd.id) === String(selCode));
  const dims = result ? (result.dimensions || [{ thickness: result.thickness, chemical: result.chemical, mechanical: result.mechanical }]) : [];
  const chemComps = dims.map(d => calcChemComp(d, code));
  const mechComps = dims.map(d => calcMechComp(d, code));
  const totalPass = [...chemComps, ...mechComps].reduce((s,m)=>s+(m?.pass||0),0);
  const totalFail = [...chemComps, ...mechComps].reduce((s,m)=>s+(m?.fail||0),0);
  const overallPass = result && code && totalFail === 0;

  return (
    <div style={css.wrap}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:${c.b2};border-radius:3px} select option{background:${c.s2}}`}</style>

      {/* 헤더 */}
      <div style={css.hdr}>
        <div style={css.hdrIcon}>🔩</div>
        <div>
          <div style={{fontSize:14,fontWeight:700}}>철판 성적서 품질검증 시스템</div>
          <div style={{fontSize:10,color:c.t2,fontFamily:'monospace',marginTop:1}}>STEEL MILL CERTIFICATE QC VERIFIER v3.0</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
          {saveStatus && <span style={{fontSize:11,fontFamily:'monospace',color:saveStatus.includes('✓')?'#4ade80':'#f87171'}}>{saveStatus}</span>}
          <div style={{background:'rgba(29,111,219,.15)',border:`1px solid ${c.acc}`,color:c.acc2,fontSize:10,fontFamily:'monospace',padding:'3px 8px',borderRadius:4,letterSpacing:'1px'}}>
            AI OCR
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div style={css.tabs}>
        {[['analyze','📄 성적서 분석'],['codes','📋 코드 DB'],['history','📊 이력']].map(([id,label]) => (
          <div key={id} style={css.tab(tab===id)} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      <div style={css.main}>

        {/* ── 분석 탭 ── */}
        {tab === 'analyze' && (
          <div>
            {/* 업로드 + 코드 선택 카드 */}
            <div style={css.card}>
              <div style={css.cardHdr}>📂 성적서 업로드 및 코드 선택</div>
              <div style={css.cardBody}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 300px', gap:16, alignItems:'stretch'}}>

                  {/* 좌: 파일 업로드 */}
                  <div>
                    {!file ? (
                      <div
                        style={{...css.uploadZone(drag), height:'100%', minHeight:140, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}
                        onClick={() => fileRef.current.click()}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDrag(true); }}
                        onDragLeave={e => { e.preventDefault(); setDrag(false); }}
                        onDrop={e => { e.preventDefault(); e.stopPropagation(); setDrag(false); loadFile(e.dataTransfer.files[0]); }}
                      >
                        <span style={{fontSize:32,marginBottom:8}}>📄</span>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>성적서 드래그 또는 클릭하여 업로드</div>
                        <div style={{fontSize:11,color:c.t2,marginBottom:10}}>Mill Test Certificate</div>
                        <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                          {['PDF','JPG','PNG'].map(t => (
                            <span key={t} style={{background:c.s3,border:`1px solid ${c.b1}`,color:c.t2,fontSize:10,fontFamily:'monospace',padding:'2px 7px',borderRadius:4}}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', gap:12}}>
                        <div style={css.fileRow}>
                          <span style={{fontSize:20}}>{file.type==='application/pdf'?'📄':'🖼️'}</span>
                          <div>
                            <div style={{fontSize:13,fontWeight:600}}>{file.name}</div>
                            <div style={{fontSize:11,color:c.t2,fontFamily:'monospace'}}>{(file.size/1024).toFixed(1)} KB</div>
                          </div>
                          <span style={{marginLeft:'auto',cursor:'pointer',color:c.t3,fontSize:16}} onClick={() => { setFile(null); setB64(null); setResult(null); setError(null); }}>✕</span>
                        </div>
                        <div style={{fontSize:12,color:'#4ade80',fontFamily:'monospace'}}>✓ 파일 준비 완료 — 우측에서 코드를 선택 후 분석하세요</div>
                      </div>
                    )}
                  </div>

                  {/* 우: 코드 선택 + 분석 버튼 */}
                  <div style={{display:'flex', flexDirection:'column', gap:12, background:c.s1, border:`1px solid ${c.b1}`, borderRadius:8, padding:16}}>
                    <div>
                      <div style={{fontSize:11,fontFamily:'monospace',color:c.t2,marginBottom:6,letterSpacing:'0.5px'}}>적용 코드 선택 *</div>
                      <select
                        value={selCode||''}
                        onChange={e => { setSelCode(e.target.value); setResult(null); setError(null); }}
                        style={{...css.fi, fontSize:13, padding:'8px 10px'}}
                      >
                        {codes.map(cd => <option key={cd.id} value={cd.id}>{cd.code}</option>)}
                      </select>
                    </div>
                    {selCode && (() => {
                      const cd = codes.find(x => String(x.id) === String(selCode));
                      return cd ? (
                        <div style={{fontSize:11,color:c.t2, lineHeight:1.7}}>
                          <div style={{color:c.t1,fontWeight:600,marginBottom:2}}>{cd.standard}</div>
                          <div>{cd.description}</div>
                          <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:4}}>
                            {cd.chemical?.C?.max!=null && <span style={{background:c.s3,border:`1px solid ${c.b1}`,fontSize:10,fontFamily:'monospace',padding:'1px 6px',borderRadius:3}}>C≤{cd.chemical.C.max}</span>}
                            {cd.chemical?.P?.max!=null && <span style={{background:c.s3,border:`1px solid ${c.b1}`,fontSize:10,fontFamily:'monospace',padding:'1px 6px',borderRadius:3}}>P≤{cd.chemical.P.max}</span>}
                            {cd.chemical?.S?.max!=null && <span style={{background:c.s3,border:`1px solid ${c.b1}`,fontSize:10,fontFamily:'monospace',padding:'1px 6px',borderRadius:3}}>S≤{cd.chemical.S.max}</span>}
                            {cd.mechanical?.yieldStrength?.min!=null && <span style={{background:c.s3,border:`1px solid ${c.b1}`,fontSize:10,fontFamily:'monospace',padding:'1px 6px',borderRadius:3}}>YS≥{cd.mechanical.yieldStrength.min}MPa</span>}
                            {cd.mechanical?.tensileStrength?.min!=null && <span style={{background:c.s3,border:`1px solid ${c.b1}`,fontSize:10,fontFamily:'monospace',padding:'1px 6px',borderRadius:3}}>TS≥{cd.mechanical.tensileStrength.min}MPa</span>}
                          </div>
                        </div>
                      ) : null;
                    })()}
                    <div style={{marginTop:'auto'}}>
                      <button
                        style={{...css.btn('p'), width:'100%', justifyContent:'center', padding:'11px', fontSize:14, opacity: (!file||loading) ? 0.5 : 1}}
                        disabled={!file || loading}
                        onClick={analyze}
                      >
                        {loading ? '⏳ 분석 중...' : '🔍 분석 시작'}
                      </button>
                      {!file && <div style={{fontSize:11,color:c.t3,textAlign:'center',marginTop:6}}>성적서를 먼저 업로드하세요</div>}
                    </div>
                  </div>

                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}} onChange={e => loadFile(e.target.files[0])} />
              </div>
            </div>

            {/* 로딩 */}
            {loading && (
              <div style={css.card}>
                <div style={{textAlign:'center',padding:'48px 24px'}}>
                  <div style={css.spinner} />
                  <div style={{fontSize:13,color:c.t2,marginBottom:5}}>{loadStep}</div>
                  <div style={{fontSize:11,color:c.t3,fontFamily:'monospace'}}>OCR → 화학조성 → 기계적성질 → 코드매칭 → 판정</div>
                </div>
              </div>
            )}

            {/* 에러 */}
            {error && (
              <div style={{background:'rgba(220,38,38,.1)',border:'1px solid rgba(220,38,38,.3)',color:'#fca5a5',borderRadius:7,padding:'10px 14px',fontSize:12,display:'flex',gap:8,marginBottom:14}}>
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            {/* 결과 */}
            {result && code && (
              <>
                {/* 종합 판정 배너 */}
                <div style={css.verdict(overallPass)}>
                  <span style={{fontSize:34}}>{overallPass?'✅':'❌'}</span>
                  <div>
                    <div style={{fontSize:10,fontFamily:'monospace',color:c.t2,marginBottom:2}}>종합 판정</div>
                    <div style={css.vResult(overallPass)}>{overallPass?'합  격':'불  합  격'}</div>
                    <div style={{fontSize:12,color:c.t2,marginTop:2}}>
                      {totalFail > 0 ? `불합격 ${totalFail}개 / 전체 ${totalPass+totalFail}개 검사` : `전체 ${totalPass}개 항목 기준 충족`}
                    </div>
                  </div>
                  <div style={{marginLeft:'auto',textAlign:'right'}}>
                    <div style={{fontSize:14,fontWeight:700,fontFamily:'monospace',marginBottom:3}}>{code?.code}</div>
                    <div style={{fontSize:11,color:c.t2}}>{code?.standard}</div>
                    <div style={{fontSize:11,color:c.t2}}>{code?.description}</div>
                  </div>
                </div>

                {/* 추출 정보 */}
                <div style={css.card}>
                  <div style={css.cardHdr}>📋 추출 정보</div>
                  <div style={css.cardBody}>
                    <div style={css.infoGrid}>
                      {[['GRADE',result.steelGrade],['제조사',result.manufacturer],['HEAT NO.',result.heatNo],['오더번호',result.orderNo],['두께',dims.map(d=>d.thickness).filter(Boolean).join(' / ')]].map(([l,v]) => (
                        <div key={l} style={css.infoItem}>
                          <div style={{fontSize:10,fontFamily:'monospace',color:c.t2,marginBottom:3}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:600}}>{v||'—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 두께별 카드 (화학성분 + 기계적 성질 통합) */}
                {dims.map((dim, di) => {
                  const cc = chemComps[di];
                  const mc = mechComps[di];
                  const dimFail = (cc?.fail||0) + (mc?.fail||0);
                  const dimPass = (cc?.pass||0) + (mc?.pass||0);
                  const dimOk = dimFail === 0;

                  const CompTable = ({ rows, emptyMsg }) => (
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead><tr>{['항목','측정값','기준값','판정'].map(h=><th key={h} style={css.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {rows.map((row,i) => (
                          <tr key={i} style={row.st==='fail'?{background:'rgba(220,38,38,.04)'}:{}}>
                            <td style={{...css.td,fontWeight:500}}>{row.label}</td>
                            <td style={{...css.td,fontFamily:'monospace',fontWeight:600,color:row.st==='fail'?'#f87171':row.st==='pass'?'#4ade80':c.t1}}>
                              {row.val} <span style={{fontSize:10,color:c.t2}}>{row.unit}</span>
                            </td>
                            <td style={{...css.td,fontFamily:'monospace',color:c.t2,fontSize:11}}>{row.ls}</td>
                            <td style={css.td}><span style={css.badge(row.st)}>{row.st==='pass'?'✓ 합격':row.st==='fail'?'✗ 불합격':'— 기준없음'}</span></td>
                          </tr>
                        ))}
                        {rows.length===0 && <tr><td colSpan={4} style={{...css.td,textAlign:'center',padding:16,color:c.t3}}>{emptyMsg}</td></tr>}
                      </tbody>
                    </table>
                  );

                  return (
                    <div key={di} style={css.card}>
                      {/* 두께 헤더 */}
                      <div style={{...css.cardHdr, justifyContent:'space-between'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{background:c.s3,border:`1px solid ${c.b2}`,fontSize:12,fontFamily:'monospace',padding:'3px 12px',borderRadius:4,color:c.acc2,fontWeight:700}}>
                            T = {dim.thickness||'—'}
                          </span>
                          <span style={{fontSize:12,color:c.t2}}>{dimPass+dimFail}개 검사</span>
                        </div>
                        <span style={{fontSize:12,fontFamily:'monospace',fontWeight:700,color:dimOk?'#4ade80':'#f87171'}}>
                          {dimOk ? '✓ 합격' : `✗ 불합격 ${dimFail}개`}
                        </span>
                      </div>

                      {/* 요약 바 */}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,borderBottom:`1px solid ${c.b1}`}}>
                        {[['전체',dimPass+dimFail,c.acc2],['합격',dimPass,'#4ade80'],['불합격',dimFail,'#f87171']].map(([l,n,col])=>(
                          <div key={l} style={{textAlign:'center',padding:'10px 0',background:c.s1}}>
                            <div style={{fontSize:20,fontWeight:700,fontFamily:'monospace',color:col}}>{n}</div>
                            <div style={{fontSize:11,color:c.t2,marginTop:1}}>{l}</div>
                          </div>
                        ))}
                      </div>

                      {/* 화학성분 */}
                      {cc && cc.rows.length > 0 && (
                        <div>
                          <div style={{padding:'9px 14px',fontSize:11,fontFamily:'monospace',color:c.acc2,letterSpacing:'0.5px',borderBottom:`1px solid ${c.b1}`,background:'rgba(14,165,233,0.04)'}}>
                            ⚗ 화학조성 (wt%)
                          </div>
                          <div style={{overflowX:'auto'}}>
                            <CompTable rows={cc.rows} emptyMsg="화학조성 데이터 없음" />
                          </div>
                        </div>
                      )}

                      {/* 기계적 성질 */}
                      {mc && mc.rows.length > 0 && (
                        <div>
                          <div style={{padding:'9px 14px',fontSize:11,fontFamily:'monospace',color:c.acc,letterSpacing:'0.5px',borderBottom:`1px solid ${c.b1}`,background:'rgba(29,111,219,0.04)'}}>
                            🔧 기계적 성질
                          </div>
                          <div style={{overflowX:'auto'}}>
                            <CompTable rows={mc.rows} emptyMsg="기계적 성질 데이터 없음" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── 코드 DB 탭 ── */}
        {tab === 'codes' && (
          <div>
            <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
              <span style={{fontSize:13,color:c.t2}}>등록 코드: <b style={{color:c.acc2,fontFamily:'monospace'}}>{codes.length}</b>개</span>
              <div style={{marginLeft:'auto',display:'flex',gap:8}}>
                <button style={css.btn('s')} onClick={async () => { if(confirm('기본 코드 목록으로 초기화하시겠습니까?\n추가/수정한 코드는 모두 삭제됩니다.')) {
                    await supabase.from('qc_codes').delete().neq('id', 0);
                    const { data: ins } = await supabase.from('qc_codes').insert(DEFAULT_CODES).select();
                    if(ins) { setCodes(ins); setSaveStatus('초기화 완료 ✓'); setTimeout(()=>setSaveStatus(''),2000); }
                  }}}>초기화</button>
                <button style={css.btn('p')} onClick={() => setModal('add')}>＋ 코드 추가</button>
              </div>
            </div>
            <div style={css.card}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr>{['코드명','규격','설명','C max','P max','S max','YS min','TS','El min',''].map(h => <th key={h} style={css.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {codes.map(cd => (
                      <tr key={cd.id}>
                        <td style={css.td}><span style={{fontFamily:'monospace',fontWeight:700,color:c.acc2}}>{cd.code}</span></td>
                        <td style={{...css.td,fontFamily:'monospace',fontSize:11,color:c.t2}}>{cd.standard||'—'}</td>
                        <td style={{...css.td,fontSize:12,color:c.t2}}>{cd.description||'—'}</td>
                        <td style={{...css.td,fontFamily:'monospace',fontSize:11}}>{cd.chemical?.C?.max!=null?'≤'+cd.chemical.C.max:'—'}</td>
                        <td style={{...css.td,fontFamily:'monospace',fontSize:11}}>{cd.chemical?.P?.max!=null?'≤'+cd.chemical.P.max:'—'}</td>
                        <td style={{...css.td,fontFamily:'monospace',fontSize:11}}>{cd.chemical?.S?.max!=null?'≤'+cd.chemical.S.max:'—'}</td>
                        <td style={{...css.td,fontFamily:'monospace',fontSize:11}}>{cd.mechanical?.yieldStrength?.min!=null?'≥'+cd.mechanical.yieldStrength.min:'—'}</td>
                        <td style={{...css.td,fontFamily:'monospace',fontSize:11}}>{fmtLim(cd.mechanical?.tensileStrength)}</td>
                        <td style={{...css.td,fontFamily:'monospace',fontSize:11}}>{cd.mechanical?.elongation?.min!=null?'≥'+cd.mechanical.elongation.min:'—'}</td>
                        <td style={css.td}>
                          <div style={{display:'flex',gap:6}}>
                            <button style={css.btn('sm')} onClick={() => setModal(cd.id)}>수정</button>
                            <button style={{...css.btn('sm'),color:'#f87171',border:'1px solid rgba(220,38,38,.3)'}} onClick={() => { if(confirm(`"${cd.code}" 삭제하시겠습니까?`)) deleteCode(cd.id); }}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 이력 탭 ── */}
        {tab === 'history' && (
          <div style={css.card}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr>{['일시','파일명','강종','제조사','HEAT NO.','판정','불합격'].map(h => <th key={h} style={css.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {history.length ? history.map((h, i) => (
                    <tr key={i}>
                      <td style={{...css.td,fontFamily:'monospace',fontSize:11,color:c.t2}}>{h.date}</td>
                      <td style={{...css.td,fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.filename}</td>
                      <td style={{...css.td,fontFamily:'monospace',fontWeight:700,color:c.acc2}}>{h.grade}</td>
                      <td style={{...css.td,fontSize:12,color:c.t2}}>{h.maker}</td>
                      <td style={{...css.td,fontFamily:'monospace',fontSize:11}}>{h.heat}</td>
                      <td style={css.td}>{h.result==='pass'?<span style={{color:'#4ade80',fontWeight:700,fontFamily:'monospace'}}>✓ 합격</span>:<span style={{color:'#f87171',fontWeight:700,fontFamily:'monospace'}}>✗ 불합격</span>}</td>
                      <td style={{...css.td,fontSize:12,color:c.t2}}>{h.fail}개</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} style={{...css.td,textAlign:'center',padding:28,color:c.t3}}>분석 이력이 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* 코드 모달 */}
      {modal && (
        <CodeModal
          editing={modal === 'add' ? null : modal}
          codes={codes}
          onSave={async entry => {
            const isNew = modal === 'add';
            const saved = await saveCode(entry, isNew);
            if (saved) {
              setCodes(prev => isNew ? [...prev, saved] : prev.map(x => x.id === modal ? saved : x));
              setModal(null);
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
