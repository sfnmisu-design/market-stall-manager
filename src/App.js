import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';

const APP_VERSION = '3.0.0';

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  primary : '#0f172a', accent  : '#6366f1', accentD : '#4f46e5',
  surface : '#ffffff', bg      : '#f1f5f9', border  : '#e2e8f0',
  text    : '#0f172a', muted   : '#64748b', light   : '#94a3b8',
  success : '#16a34a', danger  : '#dc2626', warning : '#d97706',
  purple  : '#7c3aed', mono    : "'DM Mono',monospace", sans: "'Inter',sans-serif",
};

const PALETTE = [
  { bg:'#fff3e0',border:'#fb8c00',text:'#e65100' },
  { bg:'#e3f2fd',border:'#1e88e5',text:'#0d47a1' },
  { bg:'#f3e5f5',border:'#8e24aa',text:'#4a148c' },
  { bg:'#e8f5e9',border:'#43a047',text:'#1b5e20' },
  { bg:'#fce4ec',border:'#e91e63',text:'#880e4f' },
  { bg:'#e0f7fa',border:'#00acc1',text:'#006064' },
  { bg:'#fff8e1',border:'#ffb300',text:'#e65100' },
  { bg:'#ede7f6',border:'#7b1fa2',text:'#4a148c' },
];

const ROLES = {
  admin:   { label:'Administrator',color:'#7c3aed',bg:'#ede9fe',canManageUsers:true, canDeleteStalls:true, canViewReports:true, canBook:true, canSettings:true  },
  manager: { label:'Manager',      color:'#1d4ed8',bg:'#dbeafe',canManageUsers:false,canDeleteStalls:true, canViewReports:true, canBook:true, canSettings:true  },
  cashier: { label:'Cashier',      color:'#047857',bg:'#d1fae5',canManageUsers:false,canDeleteStalls:false,canViewReports:false,canBook:true, canSettings:false },
};

const PAY_STATUS = {
  unpaid:  { label:'Unpaid', color:'#dc2626',bg:'#fee2e2',border:'#fca5a5' },
  partial: { label:'Partial',color:'#d97706',bg:'#fef3c7',border:'#fbbf24' },
  paid:    { label:'Paid',   color:'#16a34a',bg:'#f0fdf4',border:'#86efac' },
};

// ── Pure helpers ───────────────────────────────────────────────────────────────
const fmt2     = n   => (Math.round(n*100)/100).toFixed(2);
const initials = name=> name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
function diffDays(a,b){ if(!a||!b) return 0; const ms=new Date(b)-new Date(a); return ms>=0?Math.round(ms/86400000)+1:0; }
function fmtDate(d){ if(!d) return ''; const dt=new Date(d+'T00:00:00'); return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function daysUntil(end){ if(!end) return null; const t=new Date(); t.setHours(0,0,0,0); const e=new Date(end+'T00:00:00'); e.setHours(0,0,0,0); return Math.round((e-t)/86400000); }
function calcVAT(sub,rate,on){ if(!on||!rate) return{vatAmt:0,grand:sub}; const v=Math.round(sub*(rate/100)*100)/100; return{vatAmt:v,grand:Math.round((sub+v)*100)/100}; }
function payStatus(paid,grand){ if(!paid||paid===0) return 'unpaid'; if(paid>=grand) return 'paid'; return 'partial'; }

// ── Style helpers ──────────────────────────────────────────────────────────────
const inp = (err,extra={}) => ({
  width:'100%',padding:'10px 13px',borderRadius:8,
  border:`1.5px solid ${err?'#ef4444':'#e2e8f0'}`,
  fontFamily:T.sans,fontSize:14,outline:'none',
  boxSizing:'border-box',background:err?'#fff5f5':'#fff',...extra
});
const selStyle = () => ({
  ...inp(false),appearance:'none',cursor:'pointer',
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',
});

// ── Small Components ───────────────────────────────────────────────────────────
const Badge = ({label,color,bg,border}) => (
  <span style={{background:bg||'#f1f5f9',color:color||T.muted,border:`1px solid ${border||T.border}`,borderRadius:5,fontSize:10,fontWeight:700,padding:'2px 8px',letterSpacing:'0.06em',textTransform:'uppercase'}}>{label}</span>
);
const RoleBadge = ({role}) => { const r=ROLES[role]||ROLES.cashier; return <Badge label={r.label} color={r.color} bg={r.bg} border={r.color+'44'}/>; };
const PayBadge  = ({status}) => { const p=PAY_STATUS[status]||PAY_STATUS.unpaid; return <span style={{background:p.bg,color:p.color,border:`1px solid ${p.border}`,borderRadius:5,fontSize:10,fontWeight:700,padding:'2px 8px',textTransform:'uppercase'}}>{p.label}</span>; };
const Avatar    = ({name,size=36,color='#6366f1'}) => (
  <div style={{width:size,height:size,borderRadius:'50%',background:color+'22',color,border:`2px solid ${color}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.38,fontWeight:800,flexShrink:0}}>{initials(name)}</div>
);
const DueBadge  = ({end}) => {
  const d=daysUntil(end); if(d===null) return null;
  const[bg,c,l]=d<0?['#fee2e2','#dc2626',`Overdue ${Math.abs(d)}d`]:d===0?['#fee2e2','#dc2626','Due today']:d<=3?['#fef3c7','#d97706',`Due in ${d}d`]:d<=7?['#fffbeb','#b45309',`${d}d left`]:['#f0fdf4','#16a34a',`${d}d left`];
  return <span style={{background:bg,color:c,borderRadius:6,fontSize:11,fontWeight:700,padding:'3px 8px',display:'inline-flex',alignItems:'center',gap:3}}>⏰ {l}</span>;
};
const FieldLabel = ({children,optional}) => (
  <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:5,display:'flex',gap:6,alignItems:'center'}}>
    {children}{optional&&<span style={{fontSize:10,fontWeight:400,color:T.light,background:'#f1f5f9',borderRadius:4,padding:'1px 6px'}}>optional</span>}
  </div>
);
const FieldError = ({msg}) => msg ? <div style={{fontSize:11,color:T.danger,marginTop:3}}>⚠ {msg}</div> : null;
const Card = ({children,style={}}) => <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,...style}}>{children}</div>;
const Divider = ({label}) => (
  <div style={{display:'flex',alignItems:'center',gap:12,margin:'16px 0'}}>
    <div style={{flex:1,height:1,background:T.border}}/>
    {label&&<span style={{fontSize:12,color:T.light,fontWeight:500}}>{label}</span>}
    <div style={{flex:1,height:1,background:T.border}}/>
  </div>
);
const Btn = ({children,onClick,disabled,danger,outline,ghost,small,style={}}) => {
  const base={padding:small?'6px 14px':'10px 20px',borderRadius:9,fontFamily:T.sans,fontSize:small?12:14,fontWeight:700,cursor:disabled?'not-allowed':'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,transition:'all 0.15s',opacity:disabled?0.6:1,border:'none',...style};
  const v=ghost?{background:'transparent',color:T.muted,border:`1.5px solid ${T.border}`}:danger&&outline?{background:'transparent',color:T.danger,border:`1.5px solid ${T.danger}`}:danger?{background:T.danger,color:'#fff'}:outline?{background:'transparent',color:T.accent,border:`1.5px solid ${T.accent}`}:{background:T.accent,color:'#fff'};
  return <button onClick={onClick} disabled={disabled} style={{...base,...v}}>{children}</button>;
};
const Modal = ({children,onClose,width=480}) => (
  <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000,padding:16,backdropFilter:'blur(3px)'}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:T.surface,borderRadius:18,width,maxWidth:'100%',maxHeight:'92vh',overflowY:'auto',boxShadow:'0 32px 80px rgba(0,0,0,0.3)',animation:'mIn .2s ease'}}>{children}</div>
  </div>
);
const MHead = ({title,subtitle,icon,onClose}) => (
  <div style={{padding:'22px 26px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
    <div style={{display:'flex',alignItems:'center',gap:14}}>
      {icon&&<div style={{width:40,height:40,borderRadius:10,background:T.accent+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19}}>{icon}</div>}
      <div><div style={{fontSize:17,fontWeight:800,color:T.text}}>{title}</div>{subtitle&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{subtitle}</div>}</div>
    </div>
    <button onClick={onClose} style={{width:30,height:30,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:14,color:T.muted,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
  </div>
);

function Toast({toasts,remove}){
  return(
    <div style={{position:'fixed',bottom:20,right:20,zIndex:9999,display:'flex',flexDirection:'column',gap:8,maxWidth:340}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:t.type==='error'?T.danger:t.type==='warn'?'#d97706':T.primary,color:'#fff',borderRadius:12,padding:'13px 16px',boxShadow:'0 8px 32px #0003',display:'flex',alignItems:'flex-start',gap:10,animation:'tIn .25s ease'}}>
          <span style={{fontSize:16}}>{t.type==='error'?'⛔':t.type==='warn'?'⚠️':'✅'}</span>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{t.title}</div>{t.msg&&<div style={{fontSize:11,opacity:.8,marginTop:1}}>{t.msg}</div>}</div>
          <button onClick={()=>remove(t.id)} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:13}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Print ──────────────────────────────────────────────────────────────────────
function openPrintTab(html){
  const blob=new Blob([html],{type:'text/html'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function printDirect(html){
  const old=document.getElementById('__pfr__');if(old)old.remove();
  const iframe=document.createElement('iframe');iframe.id='__pfr__';
  iframe.style.cssText='position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();iframe.contentDocument.write(html);iframe.contentDocument.close();
  iframe.onload=()=>{ try{iframe.contentWindow.focus();iframe.contentWindow.print();}catch{openPrintTab(html);} setTimeout(()=>iframe.remove(),3000); };
}

function buildReceipt(b,no,branding,vat){
  const sub=b.subtotal||0,{vatAmt,grand}=calcVAT(sub,vat.rate,vat.enabled);
  const paid=b.amount_paid||0,chg=Math.round((paid-grand)*100)/100;
  const d=daysUntil(b.end_date);
  const[dueBg,dueC,dueL]=d<0?['#fee2e2','#dc2626',`OVERDUE ${Math.abs(d)}d`]:d===0?['#fee2e2','#dc2626','Due TODAY']:d<=3?['#fef3c7','#d97706',`Due in ${d}d`]:['#f0fdf4','#16a34a',`${d}d remaining`];
  const logo=branding.logoSrc?`<img src="${branding.logoSrc}" style="width:44px;height:44px;border-radius:9px;object-fit:contain;background:rgba(255,255,255,.1);padding:3px;margin-right:12px" alt="">`:`<div style="width:44px;height:44px;border-radius:9px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:22px;margin-right:12px">🏪</div>`;
  const row=(l,v)=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#64748b">${l}</span><span style="font-weight:600;color:#0f172a;text-align:right;max-width:60%">${v}</span></div>`;
  return`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt #${no}</title><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=DM+Mono:wght@500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#f1f5f9;display:flex;justify-content:center;padding:32px 12px;min-height:100vh}.w{background:#fff;width:100%;max-width:500px;border-radius:18px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,.12)}.hdr{background:linear-gradient(135deg,#1e293b,#312e81);color:#fff;padding:22px 26px}.act{display:flex;gap:10px;padding:14px 26px 22px}.b{flex:1;padding:12px 0;border-radius:10px;border:none;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}.bp{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff}.bc{background:#fff;color:#64748b;border:1.5px solid #e2e8f0!important}@media print{body{background:#fff;padding:0}.act{display:none!important}.w{box-shadow:none;border-radius:0;max-width:100%}}@media(max-width:520px){body{padding:0}.w{border-radius:0;min-height:100vh}}</style><script>function pp(){document.querySelector('.act').style.display='none';window.print();document.querySelector('.act').style.display='flex';}function cc(){window.close();}</script></head>
<body><div class="w"><div class="hdr"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center">${logo}<div>${branding.orgName?`<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:3px">${branding.orgName}</div>`:''}<div style="font-size:19px;font-weight:800">${branding.appName}</div><div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px">RENTAL RECEIPT</div></div></div><div style="text-align:right"><div style="font-family:'DM Mono',monospace;font-size:19px;font-weight:700">#${no}</div><div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px">${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div></div></div>
<div style="height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)"></div>
<div style="padding:22px 26px">
<div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">Renter</div>${row('Name',b.renter_name)}${b.email?row('Email',b.email):''}${b.phone?row('Phone',b.phone):''}${b.notes?row('Notes',b.notes):''}${row('Booked',b.booked_at_fmt||'')}${b.booked_by?row('By',b.booked_by):''}
<div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:16px 0 8px">Stall</div>${row('Stall',`${b.stall_name} — Zone ${b.stall_zone}`)}${row('Type',b.stall_type)}${row('Size',b.stall_size)}${row('Rate',`$${b.stall_price}/week`)}
<div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:16px 0 8px">Period</div>${row('Check-in',fmtDate(b.start_date))}${row('Due Date',fmtDate(b.end_date))}${row('Duration',`${b.days} day${b.days!==1?'s':''}`)}
<div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:16px 0 8px">Payment</div>${row(`Subtotal (${Math.ceil(b.days/7)||0}wk × $${b.stall_price})`,`$${fmt2(sub)}`)}${vat.enabled?row(`${vat.label||'VAT'} (${vat.rate}%)`,`$${fmt2(vatAmt)}`):''}
</div>
<div style="margin:0 26px 14px;background:#1e293b;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;color:#fff"><div style="font-size:12px;color:rgba(255,255,255,.5)">Total Due${vat.enabled?` (incl. ${vat.label||'VAT'})`:''}  </div><div style="font-family:'DM Mono',monospace;font-size:28px;font-weight:700">$${fmt2(grand)}</div></div>
${paid>0?`<div style="margin:0 26px 14px;background:${chg>=0?'#f0fdf4':'#fff1f2'};border:1.5px solid ${chg>=0?'#86efac':'#fca5a5'};border-radius:12px;padding:14px 18px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px"><span style="color:#64748b">Amount Received</span><span style="font-weight:700">$${fmt2(paid)}</span></div><div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${chg>=0?'#d1fae5':'#fecaca'};padding-top:10px"><span style="font-weight:700;font-size:14px">${chg>=0?'Change Due':'Balance Remaining'}</span><span style="font-family:'DM Mono',monospace;font-size:22px;font-weight:800;color:${chg>=0?'#16a34a':'#dc2626'}">${chg>=0?`$${fmt2(chg)}`:`−$${fmt2(Math.abs(chg))}`}</span></div></div>`:''}
<div style="margin:0 26px 20px;background:${dueBg};border-radius:10px;padding:11px 16px;text-align:center;font-size:13px;font-weight:700;color:${dueC}">⏰ ${dueL}</div>
<div style="border-top:2px dashed #e2e8f0;padding:12px 26px;text-align:center;color:#94a3b8;font-size:11px">Thank you · ${branding.appName}</div>
<div class="act"><button class="b bc" onclick="cc()">✕ Close</button><button class="b bp" onclick="pp()">🖨 Print / Save as PDF</button></div>
</div></body></html>`;
}

// ── Login Screen ───────────────────────────────────────────────────────────────
function LoginScreen({branding,onLogin}){
  const[email,setEmail]=useState('');const[pass,setPass]=useState('');
  const[showP,setShowP]=useState(false);const[err,setErr]=useState('');const[loading,setLoading]=useState(false);
  const handle=async()=>{
    if(!email.trim()||!pass){setErr('Please enter your email and password.');return;}
    setLoading(true);setErr('');
    try{
      const{data,error}=await supabase.from('users').select('*').eq('email',email.toLowerCase().trim()).eq('password',pass).single();
      if(error||!data){setErr('Incorrect email or password.');setLoading(false);return;}
      onLogin(data);
    }catch{setErr('Connection error. Check your internet and try again.');setLoading(false);}
  };
  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:T.sans}}>
      <div style={{width:'100%',maxWidth:420,animation:'fUp .4s ease'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          {branding?.logoSrc
            ?<img src={branding.logoSrc} alt="" style={{width:64,height:64,borderRadius:16,objectFit:'contain',background:'rgba(255,255,255,.1)',padding:8,marginBottom:16}}/>
            :<div style={{width:64,height:64,borderRadius:16,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,margin:'0 auto 16px',boxShadow:'0 8px 32px rgba(99,102,241,.4)'}}>🏪</div>}
          <div style={{fontSize:26,fontWeight:900,color:'#fff',letterSpacing:'-0.03em'}}>{branding?.appName||'Market Stall Manager'}</div>
          {branding?.orgName&&<div style={{fontSize:11,color:'rgba(255,255,255,.4)',marginTop:4,letterSpacing:'0.1em',textTransform:'uppercase'}}>{branding.orgName}</div>}
          <div style={{fontSize:13,color:'rgba(255,255,255,.4)',marginTop:8}}>Sign in to continue</div>
        </div>
        <div style={{background:'rgba(255,255,255,.97)',borderRadius:20,padding:'30px 26px',boxShadow:'0 32px 80px rgba(0,0,0,.4)'}}>
          {err&&<div style={{background:'#fff5f5',border:'1.5px solid #fca5a5',borderRadius:9,padding:'11px 14px',marginBottom:18,fontSize:13,color:T.danger}}>⛔ {err}</div>}
          <div style={{marginBottom:14}}><FieldLabel>Email Address</FieldLabel><input type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr('');}} onKeyDown={e=>{if(e.key==='Enter')handle();}} placeholder="you@example.com" style={inp(false)}/></div>
          <div style={{marginBottom:20}}><FieldLabel>Password</FieldLabel>
            <div style={{position:'relative'}}>
              <input type={showP?'text':'password'} value={pass} onChange={e=>{setPass(e.target.value);setErr('');}} onKeyDown={e=>{if(e.key==='Enter')handle();}} placeholder="Enter your password" style={{...inp(false),paddingRight:42}}/>
              <button onClick={()=>setShowP(v=>!v)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'transparent',border:'none',cursor:'pointer',color:T.light,fontSize:14}}>{showP?'🙈':'👁'}</button>
            </div>
          </div>
          <button onClick={handle} disabled={loading} style={{width:'100%',padding:'13px 0',borderRadius:11,border:'none',background:loading?'#94a3b8':'linear-gradient(135deg,#6366f1,#4f46e5)',color:'#fff',fontSize:15,fontWeight:800,cursor:loading?'default':'pointer',boxShadow:loading?'none':'0 4px 20px rgba(99,102,241,.35)',transition:'all .2s'}}>
            {loading?'Signing in…':'Sign In →'}
          </button>
          <Divider label="Demo Accounts"/>
          <div style={{padding:'11px 13px',background:'#f8fafc',borderRadius:8,fontSize:12,color:T.muted,lineHeight:1.8}}>
            💡 <strong>Credentials:</strong><br/>
            admin@market.com / admin123<br/>
            manager@market.com / manager123<br/>
            cashier@market.com / cashier123
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:18,fontSize:11,color:'rgba(255,255,255,.25)'}}>
          {branding?.appName||'Market Stall Manager'} v{APP_VERSION} · Accessible from anywhere
        </div>
      </div>
    </div>
  );
}

// ── Analytics ──────────────────────────────────────────────────────────────────
function AnalyticsView({stalls,bookings,stallTypes,statuses,vat}){
  const bkd=Object.values(statuses).filter(s=>s==='booked').length,pnd=Object.values(statuses).filter(s=>s==='pending').length,tot=stalls.length,avl=tot-bkd-pnd,occ=tot>0?Math.round((bkd/tot)*100):0;
  const totalSub=bookings.reduce((a,b)=>a+parseFloat(b.subtotal||0),0);
  const totalVAT=vat.enabled?Math.round(totalSub*(vat.rate/100)*100)/100:0;
  const revenue=Math.round((totalSub+totalVAT)*100)/100;
  const totalPaid=bookings.reduce((a,b)=>a+parseFloat(b.amount_paid||0),0);
  const outstanding=Math.round((revenue-totalPaid)*100)/100;
  const paid_b=bookings.filter(b=>{const s=parseFloat(b.subtotal||0);const{grand}=calcVAT(s,vat.rate,vat.enabled);return parseFloat(b.amount_paid||0)>=grand;}).length;
  const partial_b=bookings.filter(b=>{const s=parseFloat(b.subtotal||0);const{grand}=calcVAT(s,vat.rate,vat.enabled);const p=parseFloat(b.amount_paid||0);return p>0&&p<grand;}).length;
  const overdue=bookings.filter(b=>daysUntil(b.end_date)<0).length;
  const dueSoon=bookings.filter(b=>{const d=daysUntil(b.end_date);return d!==null&&d>=0&&d<=7;}).length;
  const byType=stallTypes.map(t=>{const tb=bookings.filter(b=>b.stall_type===t.name);const ts=stalls.filter(s=>s.type===t.name);const sub=tb.reduce((a,b)=>a+parseFloat(b.subtotal||0),0);const vA=vat.enabled?Math.round(sub*(vat.rate/100)*100)/100:0;return{...t,sc:ts.length,bc:tb.length,rev:Math.round((sub+vA)*100)/100,occ:ts.length>0?Math.round((tb.length/ts.length)*100):0};});
  const barMax=Math.max(...byType.map(t=>t.rev),1);
  const zones=[...new Set(stalls.map(s=>s.zone))].sort();
  const SC=({icon,val,label,color,sub2})=>(
    <Card style={{padding:'16px 18px',flex:1,minWidth:130}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontFamily:T.mono,fontSize:24,fontWeight:900,color:color||T.text,lineHeight:1}}>{val}</div>
      <div style={{fontSize:11,color:T.light,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4,fontWeight:600}}>{label}</div>
      {sub2&&<div style={{fontSize:12,color:T.muted,marginTop:3}}>{sub2}</div>}
    </Card>
  );
  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:18}}>Analytics Dashboard</div>
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <SC icon="🏪" val={tot} label="Total Stalls" sub2={`${avl} avail · ${pnd} pending`}/>
        <SC icon="📊" val={`${occ}%`} label="Occupancy" color={T.accent} sub2={`${bkd}/${tot} booked`}/>
        <SC icon="💰" val={`$${fmt2(revenue)}`} label="Revenue" color="#0369a1" sub2={vat.enabled?`+$${fmt2(totalVAT)} ${vat.label}`:''}/>
        <SC icon="⚠" val={`$${fmt2(outstanding)}`} label="Outstanding" color={T.danger} sub2={`$${fmt2(totalPaid)} collected`}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14,marginBottom:14}}>
        <Card style={{padding:'16px 18px'}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:T.light,marginBottom:12}}>💳 Payment Status</div>
          {[['✅ Paid',paid_b,'#16a34a'],['🟡 Partial',partial_b,'#d97706'],['🔴 Unpaid',bookings.length-paid_b-partial_b,'#dc2626']].map(([l,c,col])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:13,color:T.text}}>{l}</span>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:72,height:6,background:'#f1f5f9',borderRadius:3,overflow:'hidden'}}><div style={{width:`${bookings.length>0?(c/bookings.length)*100:0}%`,height:'100%',background:col,borderRadius:3,transition:'width .6s ease'}}/></div>
                <span style={{fontFamily:T.mono,fontWeight:800,fontSize:13,color:col,minWidth:18,textAlign:'right'}}>{c}</span>
              </div>
            </div>))}
        </Card>
        <Card style={{padding:'16px 18px'}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:T.light,marginBottom:12}}>⏰ Due Dates</div>
          {[['🔴 Overdue',overdue,T.danger],['🟠 Due this week',dueSoon,T.warning],['🟢 On track',bookings.length-overdue-dueSoon,T.success]].map(([l,c,col])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:13,color:T.text}}>{l}</span>
              <span style={{fontFamily:T.mono,fontWeight:800,fontSize:15,color:col}}>{c}</span>
            </div>))}
        </Card>
      </div>
      <Card style={{padding:'16px 18px',marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:T.light,marginBottom:14}}>📈 Revenue by Stall Type</div>
        {byType.map(t=>(
          <div key={t.name} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:10,height:10,borderRadius:3,background:t.border_color||t.border,display:'inline-block'}}/><span style={{fontSize:13,fontWeight:600,color:T.text}}>{t.name}</span><span style={{fontSize:11,color:T.light}}>{t.bc}/{t.sc} · {t.occ}%</span></div>
              <span style={{fontFamily:T.mono,fontSize:13,fontWeight:700,color:T.text}}>${fmt2(t.rev)}</span>
            </div>
            <div style={{height:7,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}><div style={{width:`${(t.rev/barMax)*100}%`,height:'100%',background:t.border_color||t.border,borderRadius:4,transition:'width .6s ease'}}/></div>
          </div>))}
      </Card>
      <Card style={{padding:'16px 18px'}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:T.light,marginBottom:12}}>🗺 Occupancy by Zone</div>
        {zones.map(zone=>{const zs=stalls.filter(s=>s.zone===zone);const zb=zs.filter(s=>statuses[s.id]==='booked').length;const pct=zs.length>0?Math.round((zb/zs.length)*100):0;return(
          <div key={zone} style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <span style={{fontFamily:T.mono,fontWeight:700,fontSize:13,minWidth:52,color:T.text}}>Zone {zone}</span>
            <div style={{flex:1,height:9,background:'#f1f5f9',borderRadius:5,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${T.accent},#8b5cf6)`,borderRadius:5,transition:'width .6s ease'}}/></div>
            <span style={{fontFamily:T.mono,fontSize:12,color:T.muted,minWidth:65,textAlign:'right'}}>{zb}/{zs.length} · {pct}%</span>
          </div>);})}
      </Card>
    </div>
  );
}

// ── Stall Card ─────────────────────────────────────────────────────────────────
function StallCard({stall,booking,stallTypes,vat,canEdit,canDelete,onBook,onRelease,onEdit,onPending}){
  const status=stall.status||'available';
  const tc=stallTypes.find(t=>t.name===stall.type)||{bg_color:'#f3f4f6',border_color:'#6b7280',text_color:'#374151'};
  const sub=parseFloat(booking?.subtotal||0);const{grand}=calcVAT(sub,vat.rate,vat.enabled);
  const paid=parseFloat(booking?.amount_paid||0),chg=Math.round((paid-grand)*100)/100;
  const ps=booking?payStatus(paid,grand):null;
  const bColor=status==='booked'?'#fca5a5':status==='pending'?'#fbbf24':'#86efac';
  return(
    <div style={{background:T.surface,border:`2px solid ${bColor}`,borderRadius:14,padding:'14px 15px',display:'flex',flexDirection:'column',gap:8,transition:'box-shadow .2s,transform .15s',boxShadow:'0 1px 4px rgba(0,0,0,.06)',position:'relative'}}
      onMouseEnter={e=>{if(status==='available'){e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.10)';e.currentTarget.style.transform='translateY(-2px)';}}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)';e.currentTarget.style.transform='';}}>
      <div style={{position:'absolute',top:9,right:9,display:'flex',gap:3}}>
        {canEdit&&<button onClick={()=>onEdit(stall)} title="Edit" style={{width:26,height:26,borderRadius:6,border:`1px solid ${T.border}`,background:'#fff',cursor:'pointer',fontSize:12,color:T.muted,display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>✎</button>}
        {canDelete&&status==='available'&&<button onClick={()=>{if(window.confirm(`Remove Stall ${stall.name}?`))onEdit({...stall,_delete:true});}} title="Remove" style={{width:26,height:26,borderRadius:6,border:`1px solid ${T.border}`,background:'#fff',cursor:'pointer',fontSize:12,color:T.muted,display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>✕</button>}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingRight:canEdit||canDelete?50:0}}>
        <span style={{fontFamily:T.mono,fontSize:16,fontWeight:800,color:T.text}}>Stall {stall.name}</span>
        <span style={{background:tc.bg_color,border:`1px solid ${tc.border_color}`,color:tc.text_color,borderRadius:5,fontSize:10,fontWeight:700,padding:'2px 7px',textTransform:'uppercase'}}>{stall.type}</span>
      </div>
      <div style={{display:'flex',gap:10,fontSize:12,color:T.muted,flexWrap:'wrap'}}>
        <span>📐 {stall.size}</span><span>🏷 Zone {stall.zone}</span>
        {stall.notes&&<span style={{color:T.light,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:110}} title={stall.notes}>📝 {stall.notes}</span>}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontFamily:T.mono,fontSize:19,fontWeight:900,color:T.text}}>${stall.price}<span style={{fontSize:11,fontWeight:400,color:T.light}}>/week</span></span>
        <span style={{fontSize:12,color:T.muted,display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:{available:'#22c55e',booked:'#ef4444',pending:'#f59e0b'}[status],display:'inline-block',boxShadow:`0 0 0 3px ${{available:'#22c55e',booked:'#ef4444',pending:'#f59e0b'}[status]}28`}}/>
          {{available:'Available',booked:'Booked',pending:'Pending'}[status]}
        </span>
      </div>
      {booking&&(
        <div style={{background:'#f8fafc',border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 11px',fontSize:12,color:T.text,display:'flex',flexDirection:'column',gap:3}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontWeight:600}}>👤 {booking.renter_name}</span>{ps&&<PayBadge status={ps}/>}</div>
          <div style={{color:T.muted}}>📅 {fmtDate(booking.start_date)} → {fmtDate(booking.end_date)}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:2}}>
            <DueBadge end={booking.end_date}/>
            {paid>0&&<span style={{fontSize:10,fontWeight:700,color:chg>=0?T.success:T.danger,background:chg>=0?'#f0fdf4':'#fee2e2',borderRadius:5,padding:'2px 6px',border:`1px solid ${chg>=0?'#86efac':'#fca5a5'}`}}>{chg>=0?`Change $${fmt2(chg)}`:`Bal $${fmt2(Math.abs(chg))}`}</span>}
          </div>
        </div>
      )}
      {status==='available'&&(
        <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:2}}>
          <button onClick={()=>onBook(stall)} style={{padding:'9px',borderRadius:9,border:'none',background:`linear-gradient(135deg,${T.accent},${T.accentD})`,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',boxShadow:'0 2px 8px rgba(99,102,241,.3)'}} onMouseEnter={e=>e.currentTarget.style.opacity='.9'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>Book Stall</button>
          <button onClick={()=>onPending(stall.id)} style={{padding:'6px',borderRadius:8,border:`1.5px solid ${T.warning}`,background:'transparent',color:T.warning,fontWeight:600,fontSize:12,cursor:'pointer'}}>Mark Pending</button>
        </div>
      )}
      {(status==='pending'||status==='booked')&&<button onClick={()=>{if(window.confirm('Release this stall?'))onRelease(stall.id);}} style={{padding:'8px',borderRadius:9,border:`1.5px solid ${T.danger}`,background:'transparent',color:T.danger,fontWeight:700,fontSize:13,cursor:'pointer',marginTop:2}}>Release Stall</button>}
    </div>
  );
}

// ── Booking Modal ──────────────────────────────────────────────────────────────
function BookingModal({stall,vat,currentUser,receiptNo,onConfirm,onClose}){
  const[name,setName]=useState('');const[email,setEmail]=useState('');const[phone,setPhone]=useState('');
  const[startDate,setStart]=useState('');const[endDate,setEnd]=useState('');
  const[amtPaid,setAmtPaid]=useState('');const[notes,setNotes]=useState('');
  const[errors,setErrors]=useState({});const[saving,setSaving]=useState(false);
  const days=diffDays(startDate,endDate),weeks=Math.ceil(days/7)||0,sub=parseFloat(stall.price)*weeks;
  const{vatAmt,grand}=calcVAT(sub,vat.rate,vat.enabled);
  const paid=+amtPaid||0,chg=Math.round((paid-grand)*100)/100;
  const validate=()=>{const e={};if(!name.trim())e.name='Required';if(email&&!email.match(/^[^@]+@[^@]+\.[^@]+$/))e.email='Invalid';if(!startDate)e.startDate='Required';if(!endDate)e.endDate='Required';if(startDate&&endDate&&new Date(endDate)<new Date(startDate))e.endDate='End before start';return e;};
  const confirm=async()=>{
    const e=validate();if(Object.keys(e).length){setErrors(e);return;}
    setSaving(true);
    await onConfirm({stall_id:stall.id,stall_name:stall.name,stall_zone:stall.zone,stall_type:stall.type,stall_size:stall.size,stall_price:stall.price,renter_name:name,email,phone,start_date:startDate,end_date:endDate,days,subtotal:sub,vat_amount:vatAmt,total:grand,amount_paid:paid,notes:notes.trim(),booked_by:currentUser.name,receipt_no:receiptNo});
    setSaving(false);
  };
  return(
    <Modal onClose={onClose} width={460}><MHead title={`Book Stall ${stall.name}`} subtitle={`${stall.type} · Zone ${stall.zone} · ${stall.size} · $${stall.price}/week`} icon="📋" onClose={onClose}/>
    <div style={{padding:'18px 26px 24px'}}>
      {stall.notes&&<div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,padding:'9px 13px',marginBottom:14,fontSize:12,color:'#166534'}}>📝 {stall.notes}</div>}
      <div style={{marginBottom:13}}><FieldLabel>Renter Name</FieldLabel><input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={inp(errors.name)}/><FieldError msg={errors.name}/></div>
      <div style={{display:'flex',gap:12,marginBottom:13}}>
        <div style={{flex:1}}><FieldLabel optional>Email</FieldLabel><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" style={inp(errors.email)}/><FieldError msg={errors.email}/></div>
        <div style={{flex:1}}><FieldLabel optional>Phone</FieldLabel><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 234 567" style={inp(false)}/></div>
      </div>
      <div style={{display:'flex',gap:12,marginBottom:13}}>
        <div style={{flex:1}}><FieldLabel>Start Date</FieldLabel><input type="date" value={startDate} onChange={e=>{setStart(e.target.value);if(endDate&&e.target.value>endDate)setEnd('');}} style={inp(errors.startDate)}/><FieldError msg={errors.startDate}/></div>
        <div style={{flex:1}}><FieldLabel>End / Due Date</FieldLabel><input type="date" value={endDate} min={startDate||undefined} onChange={e=>setEnd(e.target.value)} style={inp(errors.endDate)}/><FieldError msg={errors.endDate}/></div>
      </div>
      {days>0&&<div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:8,padding:'9px 13px',marginBottom:13,fontSize:13,color:'#1d4ed8',fontWeight:600,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span>📅 {days} day{days!==1?'s':''} ({weeks} week{weeks!==1?'s':''}) · {fmtDate(startDate)} → {fmtDate(endDate)}</span><DueBadge end={endDate}/></div>}
      {days>0&&<Card style={{padding:'13px 15px',marginBottom:13}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:T.muted,paddingBottom:6}}><span>Subtotal ({weeks}wk × ${stall.price})</span><span style={{fontWeight:600,color:T.text}}>${fmt2(sub)}</span></div>
        {vat.enabled&&<div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:T.purple,paddingBottom:6}}><span>{vat.label||'VAT'} ({vat.rate}%)</span><span style={{fontWeight:600}}>${fmt2(vatAmt)}</span></div>}
        <div style={{display:'flex',justifyContent:'space-between',borderTop:`1px solid ${T.border}`,paddingTop:9,marginTop:4}}><span style={{fontWeight:700,fontSize:15,color:T.text}}>Total Due</span><span style={{fontFamily:T.mono,fontSize:20,fontWeight:900,color:T.text}}>${fmt2(grand)}</span></div>
      </Card>}
      <div style={{marginBottom:13}}><FieldLabel optional>Amount Received ($)</FieldLabel>
        <input type="number" min={0} step={0.01} value={amtPaid} onChange={e=>setAmtPaid(e.target.value)} placeholder={days>0?fmt2(grand):'0.00'} style={inp(false)}/>
        {paid>0&&days>0&&<div style={{marginTop:8,background:chg>=0?'#f0fdf4':'#fff1f2',border:`1.5px solid ${chg>=0?'#86efac':'#fca5a5'}`,borderRadius:8,padding:'10px 13px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700,fontSize:13,color:T.text}}>{chg>=0?'💚 Change Due':'🔴 Balance'}</span>
          <span style={{fontFamily:T.mono,fontSize:18,fontWeight:900,color:chg>=0?T.success:T.danger}}>{chg>=0?`$${fmt2(chg)}`:`−$${fmt2(Math.abs(chg))}`}</span>
        </div>}
      </div>
      <div style={{marginBottom:18}}><FieldLabel optional>Notes</FieldLabel><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special requirements…" rows={2} style={{...inp(false),resize:'vertical'}}/></div>
      <div style={{display:'flex',gap:10}}><Btn ghost onClick={onClose} style={{flex:1}}>Cancel</Btn><Btn onClick={confirm} disabled={saving} style={{flex:2}}>{saving?'Saving…':'Confirm Booking'}</Btn></div>
    </div></Modal>
  );
}

// ── Receipt Modal ──────────────────────────────────────────────────────────────
function ReceiptModal({booking,branding,vat,onClose}){
  const sub=parseFloat(booking.subtotal||0),{vatAmt,grand}=calcVAT(sub,vat.rate,vat.enabled);
  const paid=parseFloat(booking.amount_paid||0),chg=Math.round((paid-grand)*100)/100;
  const d=daysUntil(booking.end_date);
  const[dueBg,dueC,dueL]=d<0?['#fee2e2',T.danger,`OVERDUE ${Math.abs(d)}d`]:d===0?['#fee2e2',T.danger,'Due TODAY']:d<=3?['#fef3c7',T.warning,`Due in ${d}d`]:['#f0fdf4',T.success,`${d}d remaining`];
  const Row=({l,v,color})=>(<div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${T.border}`,fontSize:13}}><span style={{color:T.muted}}>{l}</span><span style={{fontWeight:600,color:color||T.text,textAlign:'right',maxWidth:'60%'}}>{v}</span></div>);
  const Sec=({title,children})=>(<div style={{marginBottom:16}}><div style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.light,marginBottom:9}}>{title}</div>{children}</div>);
  const html=buildReceipt(booking,booking.receipt_no,branding,vat);
  return(
    <Modal onClose={onClose} width={480}>
      <div style={{background:'linear-gradient(135deg,#1e293b,#312e81)',color:'#fff',padding:'20px 24px',borderRadius:'18px 18px 0 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {branding.logoSrc?<img src={branding.logoSrc} alt="" style={{width:42,height:42,borderRadius:8,objectFit:'contain',background:'rgba(255,255,255,.1)',padding:3}}/>:<div style={{width:42,height:42,borderRadius:8,background:'rgba(255,255,255,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:21}}>🏪</div>}
            <div>{branding.orgName&&<div style={{fontSize:10,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:2}}>{branding.orgName}</div>}<div style={{fontSize:17,fontWeight:800}}>{branding.appName}</div><div style={{fontSize:11,color:'rgba(255,255,255,.4)',marginTop:1}}>RENTAL RECEIPT</div></div>
          </div>
          <div style={{textAlign:'right'}}><div style={{fontFamily:T.mono,fontSize:17,fontWeight:700}}>#{booking.receipt_no}</div><div style={{fontSize:11,color:'rgba(255,255,255,.4)',marginTop:3}}>{new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div><button onClick={onClose} style={{marginTop:6,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',color:'rgba(255,255,255,.6)',borderRadius:6,padding:'2px 9px',fontSize:11,cursor:'pointer'}}>✕ Close</button></div>
        </div>
      </div>
      <div style={{height:3,background:'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)'}}/>
      <div style={{padding:'20px 24px'}}>
        <Sec title="Renter"><Row l="Name" v={booking.renter_name}/>{booking.email&&<Row l="Email" v={booking.email}/>}{booking.phone&&<Row l="Phone" v={booking.phone}/>}{booking.notes&&<Row l="Notes" v={booking.notes}/>}<Row l="Booked" v={booking.booked_at_fmt||new Date(booking.created_at).toLocaleString('en-GB')}/>{booking.booked_by&&<Row l="By" v={booking.booked_by}/>}</Sec>
        <Sec title="Stall"><Row l="Stall" v={`${booking.stall_name} — Zone ${booking.stall_zone}`}/><Row l="Type" v={booking.stall_type}/><Row l="Size" v={booking.stall_size}/><Row l="Rate" v={`$${booking.stall_price}/week`}/></Sec>
        <Sec title="Period"><Row l="Check-in" v={fmtDate(booking.start_date)}/><Row l="Due Date" v={fmtDate(booking.end_date)}/><Row l="Duration" v={`${booking.days} day${booking.days!==1?'s':''}`}/></Sec>
        <Sec title="Payment"><Row l={`Subtotal (${Math.ceil(booking.days/7)||0}wk × $${booking.stall_price})`} v={`$${fmt2(sub)}`}/>{vat.enabled&&<Row l={`${vat.label||'VAT'} (${vat.rate}%)`} v={`$${fmt2(vatAmt)}`} color={T.purple}/>}</Sec>
        <div style={{background:T.primary,color:'#fff',borderRadius:12,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>Total Due{vat.enabled?` (incl. ${vat.label||'VAT'})`:''}</div>
          <div style={{fontFamily:T.mono,fontSize:26,fontWeight:900}}>${fmt2(grand)}</div>
        </div>
        {paid>0&&<div style={{background:chg>=0?'#f0fdf4':'#fff1f2',border:`1.5px solid ${chg>=0?'#86efac':'#fca5a5'}`,borderRadius:11,padding:'13px 16px',marginBottom:12}}>
          <Row l="Amount Received" v={`$${fmt2(paid)}`}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:9,borderTop:`1px solid ${chg>=0?'#d1fae5':'#fecaca'}`,marginTop:6}}>
            <span style={{fontWeight:700,fontSize:14,color:T.text}}>{chg>=0?'Change Due':'Balance Remaining'}</span>
            <span style={{fontFamily:T.mono,fontSize:22,fontWeight:900,color:chg>=0?T.success:T.danger}}>{chg>=0?`$${fmt2(chg)}`:`−$${fmt2(Math.abs(chg))}`}</span>
          </div>
        </div>}
        <div style={{background:dueBg,color:dueC,borderRadius:10,padding:'10px 14px',textAlign:'center',fontSize:13,fontWeight:700,marginBottom:16}}>⏰ {dueL}</div>
      </div>
      <div style={{borderTop:`2px dashed ${T.border}`,padding:'11px 24px',textAlign:'center',color:T.light,fontSize:11}}>Thank you for your business · {branding.appName}</div>
      <div style={{padding:'12px 24px 20px',display:'flex',flexDirection:'column',gap:8}}>
        <button onClick={()=>printDirect(html)} style={{width:'100%',padding:'13px 0',borderRadius:10,border:'none',background:'linear-gradient(135deg,#1e293b,#312e81)',color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 4px 16px rgba(30,41,59,.3)'}}>🖨 Print Receipt</button>
        <div style={{display:'flex',gap:10}}><Btn ghost onClick={onClose} style={{flex:1}}>Close</Btn><Btn ghost onClick={()=>openPrintTab(html)} style={{flex:1}}>↗ Open in New Tab</Btn></div>
      </div>
    </Modal>
  );
}

// ── Settings / User / Stall / EditDates modals — abbreviated versions ──────────
function SettingsModal({branding,vat,onSave,onClose}){
  const[org,setOrg]=useState(branding.orgName||'');const[app,setApp]=useState(branding.appName||'Market Stall Manager');const[tag,setTag]=useState(branding.tagline||'');const[logo,setLogo]=useState(branding.logoSrc||'');
  const[vatOn,setVatOn]=useState(vat.enabled||false);const[vatRate,setVatRate]=useState(vat.rate||0);const[vatLabel,setVatLabel]=useState(vat.label||'VAT');const[saving,setSaving]=useState(false);
  const handleLogo=e=>{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024){alert('Max 2MB');return;}const r=new FileReader();r.onload=ev=>setLogo(ev.target.result);r.readAsDataURL(f);};
  const tog={width:48,height:26,borderRadius:13,cursor:'pointer',background:vatOn?T.accent:'#cbd5e1',display:'inline-flex',alignItems:'center',padding:'3px',border:'none',transition:'background .2s'};
  const knob={width:20,height:20,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px #0002',transition:'transform .2s',transform:vatOn?'translateX(22px)':'translateX(0)'};
  return(
    <Modal onClose={onClose} width={480}><MHead title="System Settings" subtitle="Branding and tax" icon="⚙️" onClose={onClose}/>
    <div style={{padding:'20px 26px 26px'}}>
      <div style={{marginBottom:16}}><FieldLabel>Logo</FieldLabel>
        <div style={{display:'flex',gap:14,alignItems:'center'}}>
          <div style={{width:68,height:68,borderRadius:12,background:logo?'transparent':'#f8fafc',border:`2px dashed ${T.border}`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>{logo?<img src={logo} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span style={{fontSize:28}}>🏪</span>}</div>
          <div style={{flex:1}}>
            <label style={{display:'block',padding:'8px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:'#f8fafc',fontSize:13,fontWeight:600,color:T.text,cursor:'pointer',textAlign:'center'}}>📁 Upload Logo<input type="file" accept="image/*" onChange={handleLogo} style={{display:'none'}}/></label>
            <div style={{fontSize:11,color:T.light,marginTop:4,textAlign:'center'}}>PNG, JPG, SVG · Max 2MB</div>
            {logo&&<button onClick={()=>setLogo('')} style={{marginTop:4,display:'block',width:'100%',padding:'4px',borderRadius:6,border:'1.5px solid #fca5a5',background:'#fff',color:T.danger,fontSize:11,fontWeight:600,cursor:'pointer'}}>✕ Remove</button>}
          </div>
        </div>
      </div>
      <div style={{display:'flex',gap:12,marginBottom:12}}><div style={{flex:1}}><FieldLabel optional>Organisation</FieldLabel><input value={org} onChange={e=>setOrg(e.target.value)} placeholder="City Market Authority" style={inp(false)}/></div><div style={{flex:1}}><FieldLabel>App Name</FieldLabel><input value={app} onChange={e=>setApp(e.target.value)} placeholder="Market Stall Manager" style={inp(false)}/></div></div>
      <div style={{marginBottom:16}}><FieldLabel optional>Tagline</FieldLabel><input value={tag} onChange={e=>setTag(e.target.value)} placeholder="Your market management platform" style={inp(false)}/></div>
      <div style={{background:'linear-gradient(135deg,#1e293b,#312e81)',borderRadius:10,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}>
        {logo?<img src={logo} alt="" style={{width:38,height:38,borderRadius:7,objectFit:'contain',background:'rgba(255,255,255,.12)',padding:2}}/>:<div style={{width:38,height:38,borderRadius:7,background:'rgba(255,255,255,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🏪</div>}
        <div>{org&&<div style={{fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'rgba(255,255,255,.4)'}}>{org}</div>}<div style={{fontSize:15,fontWeight:800,color:'#fff'}}>{app||'App Name'}</div>{tag&&<div style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>{tag}</div>}</div>
      </div>
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:18,marginBottom:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:vatOn?14:0}}>
          <div><div style={{fontWeight:700,fontSize:14,color:T.text}}>🧾 VAT / Tax</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>Applied to all bookings and receipts</div></div>
          <button onClick={()=>setVatOn(v=>!v)} style={tog}><span style={knob}/></button>
        </div>
        {vatOn&&<div style={{background:'#f5f3ff',border:'1.5px solid #c4b5fd',borderRadius:10,padding:'13px 15px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',gap:12}}><div style={{flex:1}}><FieldLabel>Rate (%)</FieldLabel><input type="number" min={0} max={100} step={0.1} value={vatRate} onChange={e=>setVatRate(e.target.value)} placeholder="14" style={inp(false)}/></div><div style={{flex:1}}><FieldLabel>Label</FieldLabel><input value={vatLabel} onChange={e=>setVatLabel(e.target.value)} placeholder="VAT, GST, Tax…" style={inp(false)}/></div></div>
          {vatRate>0&&<div style={{background:'#ede9fe',borderRadius:7,padding:'7px 11px',fontSize:12,color:T.purple,fontWeight:600}}>Preview: $100 + {vatLabel||'VAT'} ${fmt2(100*(vatRate/100))} = <strong>${fmt2(100+100*(vatRate/100))}</strong></div>}
        </div>}
      </div>
      <div style={{display:'flex',gap:10}}><Btn ghost onClick={onClose} style={{flex:1}}>Cancel</Btn><Btn onClick={async()=>{setSaving(true);await onSave({orgName:org.trim(),appName:app.trim(),tagline:tag.trim(),logoSrc:logo},{enabled:vatOn,rate:+vatRate||0,label:vatLabel.trim()||'VAT'});setSaving(false);}} disabled={saving} style={{flex:2}}>{saving?'Saving…':'✅ Save Settings'}</Btn></div>
    </div></Modal>
  );
}

function UserModal({user,onSave,onClose,existingEmails}){
  const isEdit=!!user;
  const[name,setName]=useState(user?.name||'');const[email,setEmail]=useState(user?.email||'');const[role,setRole]=useState(user?.role||'cashier');const[pass,setPass]=useState('');const[confirm,setConfirm]=useState('');const[showP,setShowP]=useState(false);const[errors,setErrors]=useState({});const[saving,setSaving]=useState(false);
  const validate=()=>{const e={};if(!name.trim())e.name='Required';if(!email.match(/^[^@]+@[^@]+\.[^@]+$/))e.email='Valid email required';if(!isEdit&&existingEmails.includes(email.toLowerCase()))e.email='Email in use';if(!isEdit&&!pass)e.pass='Required';if(pass&&pass.length<6)e.pass='Min 6 chars';if(pass&&pass!==confirm)e.confirm='Do not match';return e;};
  const save=async()=>{const e=validate();if(Object.keys(e).length){setErrors(e);return;}setSaving(true);await onSave({...(user||{}),name:name.trim(),email:email.toLowerCase().trim(),role,password:pass||user?.password});setSaving(false);};
  return(
    <Modal onClose={onClose} width={460}><MHead title={isEdit?'Edit User':'New User'} icon={isEdit?'✎':'👤'} onClose={onClose}/>
    <div style={{padding:'20px 26px 24px'}}>
      <div style={{marginBottom:14}}><FieldLabel>Full Name</FieldLabel><input value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Smith" style={inp(errors.name)}/><FieldError msg={errors.name}/></div>
      <div style={{marginBottom:14}}><FieldLabel>Email</FieldLabel><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="jane@market.com" style={inp(errors.email)}/><FieldError msg={errors.email}/></div>
      <div style={{marginBottom:14}}><FieldLabel>Role</FieldLabel><select value={role} onChange={e=>setRole(e.target.value)} style={selStyle()}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <div style={{flex:1}}><FieldLabel>{isEdit?'New Password':'Password'}</FieldLabel><div style={{position:'relative'}}><input type={showP?'text':'password'} value={pass} onChange={e=>setPass(e.target.value)} placeholder="Min 6 chars" style={{...inp(errors.pass),paddingRight:38}}/><button onClick={()=>setShowP(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'transparent',border:'none',cursor:'pointer',color:T.light,fontSize:12}}>{showP?'🙈':'👁'}</button></div><FieldError msg={errors.pass}/></div>
        <div style={{flex:1}}><FieldLabel>Confirm</FieldLabel><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat" style={inp(errors.confirm)}/><FieldError msg={errors.confirm}/></div>
      </div>
      <div style={{display:'flex',gap:10}}><Btn ghost onClick={onClose} style={{flex:1}}>Cancel</Btn><Btn onClick={save} disabled={saving} style={{flex:2}}>{saving?'Saving…':isEdit?'💾 Save Changes':'✅ Create Account'}</Btn></div>
    </div></Modal>
  );
}

function StallModal({stall,stallTypes,existingNames,onSave,onClose}){
  const isEdit=!!stall;
  const[name,setName]=useState(stall?.name||'');const[zone,setZone]=useState(stall?.zone||'A');const[type,setType]=useState(stall?.type||stallTypes[0]?.name||'');const[size,setSize]=useState(stall?.size||'3×3m');const[price,setPrice]=useState(stall?.price||'');const[notes,setNotes]=useState(stall?.notes||'');const[errors,setErrors]=useState({});const[saving,setSaving]=useState(false);
  const validate=()=>{const e={};if(!name.trim())e.name='Required';if(!isEdit&&existingNames.includes(name.trim().toUpperCase()))e.name='Name taken';if(!price||isNaN(price)||+price<=0)e.price='Invalid';return e;};
  return(
    <Modal onClose={onClose} width={440}><MHead title={isEdit?`Edit Stall ${stall.name}`:'Add New Stall'} icon={isEdit?'✎':'🏪'} onClose={onClose}/>
    <div style={{padding:'18px 24px 22px'}}>
      <div style={{display:'flex',gap:12,marginBottom:12}}><div style={{flex:2}}><FieldLabel>Stall Name/ID</FieldLabel><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. D1" style={inp(errors.name)}/><FieldError msg={errors.name}/></div><div style={{flex:1}}><FieldLabel>Zone</FieldLabel><select value={zone} onChange={e=>setZone(e.target.value)} style={selStyle()}>{'ABCDEF'.split('').map(z=><option key={z}>{z}</option>)}</select></div></div>
      <div style={{marginBottom:12}}><FieldLabel>Type</FieldLabel><select value={type} onChange={e=>setType(e.target.value)} style={selStyle()}>{stallTypes.map(t=><option key={t.name} value={t.name}>{t.name}</option>)}</select></div>
      <div style={{display:'flex',gap:12,marginBottom:12}}><div style={{flex:1}}><FieldLabel>Size</FieldLabel><input value={size} onChange={e=>setSize(e.target.value)} placeholder="3×3m" style={inp(false)}/></div><div style={{flex:1}}><FieldLabel>Price/week ($)</FieldLabel><input type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="100" style={inp(errors.price)}/><FieldError msg={errors.price}/></div></div>
      <div style={{marginBottom:20}}><FieldLabel optional>Notes</FieldLabel><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Corner spot, near entrance…" rows={2} style={{...inp(false),resize:'vertical'}}/></div>
      <div style={{display:'flex',gap:10}}><Btn ghost onClick={onClose} style={{flex:1}}>Cancel</Btn><Btn onClick={async()=>{const e=validate();if(Object.keys(e).length){setErrors(e);return;}setSaving(true);await onSave({...(stall||{}),name:name.trim().toUpperCase(),zone,type,size:size.trim(),price:+price,notes:notes.trim()});setSaving(false);}} disabled={saving} style={{flex:2}}>{saving?'Saving…':isEdit?'💾 Save':'➕ Add Stall'}</Btn></div>
    </div></Modal>
  );
}

function EditDatesModal({booking,vat,onSave,onClose}){
  const[startDate,setStart]=useState(booking.start_date);const[endDate,setEnd]=useState(booking.end_date);const[errors,setErrors]=useState({});const[saving,setSaving]=useState(false);
  const newDays=diffDays(startDate,endDate),newWeeks=Math.ceil(newDays/7)||0,newSub=parseFloat(booking.stall_price)*newWeeks;
  const{vatAmt:newVAT,grand:newGrand}=calcVAT(newSub,vat.rate,vat.enabled);
  const diff=Math.round((newGrand-parseFloat(booking.total))*100)/100;
  const validate=()=>{const e={};if(!startDate)e.startDate='Required';if(!endDate)e.endDate='Required';if(startDate&&endDate&&new Date(endDate)<new Date(startDate))e.endDate='End before start';return e;};
  return(
    <Modal onClose={onClose} width={420}><MHead title="Edit Booking Dates" subtitle={`${booking.renter_name} · Stall ${booking.stall_name}`} icon="📅" onClose={onClose}/>
    <div style={{padding:'18px 24px 22px'}}>
      <div style={{display:'flex',gap:12,marginBottom:12}}><div style={{flex:1}}><FieldLabel>Start Date</FieldLabel><input type="date" value={startDate} onChange={e=>{setStart(e.target.value);if(endDate&&e.target.value>endDate)setEnd('');}} style={inp(errors.startDate)}/><FieldError msg={errors.startDate}/></div><div style={{flex:1}}><FieldLabel>End / Due Date</FieldLabel><input type="date" value={endDate} min={startDate||undefined} onChange={e=>setEnd(e.target.value)} style={inp(errors.endDate)}/><FieldError msg={errors.endDate}/></div></div>
      {newDays>0&&<div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:8,padding:'9px 13px',marginBottom:12,fontSize:13,color:'#1d4ed8',fontWeight:600,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span>📅 {newDays}d · {fmtDate(startDate)} → {fmtDate(endDate)}</span><DueBadge end={endDate}/></div>}
      <Card style={{padding:'13px 15px',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:T.light,paddingBottom:7}}><span>Previous ({booking.days}d)</span><span style={{textDecoration:'line-through'}}>${fmt2(booking.total)}</span></div>
        {newDays>0&&vat.enabled&&<div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:T.purple,paddingBottom:7}}><span>{vat.label||'VAT'} ({vat.rate}%)</span><span>${fmt2(newVAT)}</span></div>}
        <div style={{display:'flex',justifyContent:'space-between',borderTop:`1px solid ${T.border}`,paddingTop:9,fontWeight:800,fontSize:15,color:T.text}}><span>New total ({newDays}d)</span><span>{newDays>0?`$${fmt2(newGrand)}`:'$—'}</span></div>
        {newDays>0&&diff!==0&&<div style={{fontSize:12,color:diff>0?T.success:T.danger,textAlign:'right',marginTop:4,fontWeight:700}}>{diff>0?`+$${fmt2(diff)}`:`−$${fmt2(Math.abs(diff))}`}</div>}
      </Card>
      <div style={{display:'flex',gap:10}}><Btn ghost onClick={onClose} style={{flex:1}}>Cancel</Btn><Btn onClick={async()=>{const e=validate();if(Object.keys(e).length){setErrors(e);return;}setSaving(true);await onSave(booking.id,startDate,endDate,newDays,newSub,newGrand);setSaving(false);}} disabled={saving} style={{flex:2}}>{saving?'Saving…':'Save Changes'}</Btn></div>
    </div></Modal>
  );
}

function AddTypeForm({stallTypes,onAdd}){
  const[nt,setNt]=useState('');const[er,setEr]=useState('');
  const submit=async()=>{if(!nt.trim()){setEr('Required');return;}if(stallTypes.find(t=>t.name.toLowerCase()===nt.trim().toLowerCase())){setEr('Already exists');return;}await onAdd(nt.trim());setNt('');setEr('');};
  return(<><FieldLabel>New Type Name</FieldLabel><div style={{display:'flex',gap:8}}><input value={nt} onChange={e=>{setNt(e.target.value);setEr('');}} placeholder="e.g. Electronics, Beauty…" onKeyDown={e=>{if(e.key==='Enter')submit();}} style={{...inp(!!er),flex:1}}/><Btn onClick={submit}>+ Add</Btn></div><FieldError msg={er}/></>);
}

function UsersView({users,currentUser,onAddUser,onEditUser,onDeleteUser,perms}){
  const[modal,setModal]=useState(null);const[selU,setSelU]=useState(null);
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div><div style={{fontSize:20,fontWeight:800,color:T.text}}>User Management</div><div style={{fontSize:13,color:T.muted,marginTop:2}}>{users.length} accounts · Accessible from any location</div></div>
        {perms.canManageUsers&&<Btn onClick={()=>setModal('add')}>+ New User</Btn>}
      </div>
      <Card>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}>
            <thead><tr style={{borderBottom:`2px solid ${T.border}`}}>{['User','Email','Role','Created',''].map(h=><th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:T.light}}>{h}</th>)}</tr></thead>
            <tbody>{users.map(u=>(
              <tr key={u.id} style={{borderBottom:`1px solid ${T.border}`,background:u.id===currentUser.id?'#fafbff':'transparent'}}>
                <td style={{padding:'13px 14px'}}><div style={{display:'flex',alignItems:'center',gap:11}}><Avatar name={u.name} size={34} color={ROLES[u.role]?.color||T.accent}/><div><div style={{fontWeight:700,fontSize:14,color:T.text}}>{u.name}{u.id===currentUser.id&&<span style={{marginLeft:6,fontSize:10,color:T.accent,background:T.accent+'15',borderRadius:4,padding:'1px 6px'}}>You</span>}</div></div></div></td>
                <td style={{padding:'13px 14px',fontSize:13,color:T.muted}}>{u.email}</td>
                <td style={{padding:'13px 14px'}}><RoleBadge role={u.role}/></td>
                <td style={{padding:'13px 14px',fontSize:12,color:T.light}}>{u.created_at?new Date(u.created_at).toLocaleDateString():''}</td>
                <td style={{padding:'13px 14px'}}>{perms.canManageUsers&&<div style={{display:'flex',gap:6}}><Btn ghost small onClick={()=>{setSelU(u);setModal('edit');}}>✎ Edit</Btn>{u.id!==currentUser.id&&<Btn ghost small danger onClick={()=>onDeleteUser(u.id)}>Delete</Btn>}</div>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      {modal==='add'&&<UserModal onSave={async u=>{await onAddUser(u);setModal(null);}} onClose={()=>setModal(null)} existingEmails={users.map(u=>u.email.toLowerCase())}/>}
      {modal==='edit'&&selU&&<UserModal user={selU} onSave={async u=>{await onEditUser(u);setModal(null);setSelU(null);}} onClose={()=>{setModal(null);setSelU(null);}} existingEmails={users.filter(u=>u.id!==selU.id).map(u=>u.email.toLowerCase())}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  // ── Data state ──
  const[stalls,      setStalls]      = useState([]);
  const[bookings,    setBookings]    = useState([]);
  const[stallTypes,  setStallTypes]  = useState([]);
  const[users,       setUsers]       = useState([]);
  const[activityLog, setActivityLog] = useState([]);
  const[branding,    setBranding]    = useState({orgName:'SFN TechGeek',appName:'Market Stall Manager',tagline:'',logoSrc:''});
  const[vat,         setVat]         = useState({enabled:false,rate:0,label:'VAT'});
  const[receiptNo,   setReceiptNo]   = useState(2001);

  // ── UI state ──
  const[currentUser, setCurrentUser] = useState(null);
  const[loading,     setLoading]     = useState(true);
  const[dbError,     setDbError]     = useState(false);
  const[syncing,     setSyncing]     = useState(false);
  const[modal,       setModal]       = useState(null);
  const[selected,    setSelected]    = useState(null);
  const[toasts,      setToasts]      = useState([]);
  const[filterType,  setFT]          = useState('All');
  const[filterStat,  setFS]          = useState('All');
  const[searchQ,     setSearchQ]     = useState('');
  const[view,        setView]        = useState('grid');
  const realtimeRef = useRef(null);

  // ── Toast helpers ──
  const addToast=(type,title,msg)=>{ const id=Date.now().toString(); setToasts(t=>[...t,{id,type,title,msg}]); setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500); };
  const removeToast=id=>setToasts(t=>t.filter(x=>x.id!==id));

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async() => {
    try{
      const [s,b,st,u,al,sets,ctr] = await Promise.all([
        supabase.from('stalls').select('*').order('name'),
        supabase.from('bookings').select('*').order('created_at',{ascending:false}),
        supabase.from('stall_types').select('*').order('name'),
        supabase.from('users').select('*').order('name'),
        supabase.from('activity_log').select('*').order('created_at',{ascending:false}).limit(200),
        supabase.from('settings').select('*'),
        supabase.from('counters').select('*'),
      ]);
      if(s.data)   setStalls(s.data);
      if(b.data)   setBookings(b.data);
      if(st.data)  setStallTypes(st.data);
      if(u.data)   setUsers(u.data);
      if(al.data)  setActivityLog(al.data);
      if(sets.data){ sets.data.forEach(row=>{ if(row.key==='branding') setBranding(row.value); if(row.key==='vat') setVat(row.value); }); }
      if(ctr.data){ const r=ctr.data.find(c=>c.key==='receipts'); if(r) setReceiptNo(r.value); }
      setDbError(false);
    }catch(err){ console.error('Load error:',err); setDbError(true); }
    finally{ setLoading(false); }
  },[]);

  // ── Initial load ──
  useEffect(()=>{ loadAll(); },[loadAll]);

  // ── Real-time subscriptions ────────────────────────────────────────────────
  useEffect(()=>{
    const channel = supabase.channel('msm-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'stalls'},      ()=>supabase.from('stalls').select('*').order('name').then(r=>{ if(r.data) setStalls(r.data); }))
      .on('postgres_changes',{event:'*',schema:'public',table:'bookings'},    ()=>supabase.from('bookings').select('*').order('created_at',{ascending:false}).then(r=>{ if(r.data) setBookings(r.data); }))
      .on('postgres_changes',{event:'*',schema:'public',table:'stall_types'}, ()=>supabase.from('stall_types').select('*').order('name').then(r=>{ if(r.data) setStallTypes(r.data); }))
      .on('postgres_changes',{event:'*',schema:'public',table:'users'},       ()=>supabase.from('users').select('*').order('name').then(r=>{ if(r.data) setUsers(r.data); }))
      .on('postgres_changes',{event:'*',schema:'public',table:'activity_log'},()=>supabase.from('activity_log').select('*').order('created_at',{ascending:false}).limit(200).then(r=>{ if(r.data) setActivityLog(r.data); }))
      .on('postgres_changes',{event:'*',schema:'public',table:'settings'},    ()=>supabase.from('settings').select('*').then(r=>{ if(r.data) r.data.forEach(row=>{ if(row.key==='branding') setBranding(row.value); if(row.key==='vat') setVat(row.value); }); }))
      .subscribe();
    realtimeRef.current = channel;
    return ()=>supabase.removeChannel(channel);
  },[]);

  // ── Keep-alive ping — prevents Supabase free tier from pausing ─────────────
  // Fires once on startup then every 3 days while the app is open.
  useEffect(()=>{
    const ping = async () => {
      try {
        await supabase.from('counters').select('key', { count: 'exact', head: true });
        console.log('[keep-alive] DB ping OK', new Date().toLocaleTimeString());
      } catch(e) {
        console.warn('[keep-alive] ping failed', e?.message);
      }
    };
    ping(); // immediate on first load
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const id = setInterval(ping, THREE_DAYS);
    return () => clearInterval(id);
  }, []);

  // ── Log helper ──────────────────────────────────────────────────────────────
  const logAction = useCallback(async(type,message) => {
    await supabase.from('activity_log').insert({type,message,user_name:currentUser?.name||'System'});
  },[currentUser]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogin = user => { setCurrentUser(user); addToast('success',`Welcome, ${user.name}`,ROLES[user.role].label); logAction('login',`${user.name} signed in.`); };
  const handleLogout = () => { logAction('login',`${currentUser.name} signed out.`); setCurrentUser(null); setView('grid'); };

  const handleAddType = async name => {
    const idx=stallTypes.length%PALETTE.length;
    const{error}=await supabase.from('stall_types').insert({name,bg_color:PALETTE[idx].bg,border_color:PALETTE[idx].border,text_color:PALETTE[idx].text});
    if(!error){ addToast('success','Type added',name); logAction('added',`Stall type "${name}" added.`); }
    else addToast('error','Failed to add type',error.message);
  };
  const handleDeleteType = async name => {
    const{error}=await supabase.from('stall_types').delete().eq('name',name);
    if(!error){ addToast('warn','Type removed',name); logAction('removed',`Stall type "${name}" removed.`); }
  };

  const handleSaveStall = async s => {
    if(s._delete){
      const{error}=await supabase.from('stalls').delete().eq('id',s.id);
      if(!error){ addToast('warn','Stall removed',s.name); logAction('removed',`Stall ${s.name} removed.`); setModal(null); }
      return;
    }
    const isNew=!s.id||!stalls.find(x=>x.id===s.id);
    const payload={name:s.name,zone:s.zone,type:s.type,size:s.size,price:s.price,notes:s.notes,status:'available'};
    const{error}=isNew?await supabase.from('stalls').insert(payload):await supabase.from('stalls').update(payload).eq('id',s.id);
    if(!error){ addToast('success',isNew?'Stall added':'Stall updated',s.name); logAction(isNew?'added':'edited',`Stall ${s.name} ${isNew?'added':'updated'}.`); setModal(null); setSelected(null); }
    else addToast('error','Save failed',error.message);
  };

  const handlePending = async stallId => {
    const s=stalls.find(x=>x.id===stallId);
    const{error}=await supabase.from('stalls').update({status:'pending'}).eq('id',stallId);
    if(!error){ addToast('success','Marked pending',''); logAction('pending',`Stall ${s?.name} marked pending.`); }
  };

  const handleRelease = async stallId => {
    const s=stalls.find(x=>x.id===stallId);
    setSyncing(true);
    const{error}=await supabase.from('stalls').update({status:'available'}).eq('id',stallId);
    if(!error){
      await supabase.from('bookings').delete().eq('stall_id',stallId);
      addToast('success','Stall released',''); logAction('released',`Stall ${s?.name} released.`);
    }
    setSyncing(false);
  };

  const handleConfirmBooking = async data => {
    setSyncing(true);
    // Increment receipt counter
    const newNo = receiptNo + 1;
    await supabase.from('counters').update({value:newNo}).eq('key','receipts');
    setReceiptNo(newNo);
    // Create booking
    const{data:bk,error}=await supabase.from('bookings').insert({...data,receipt_no:newNo}).select().single();
    if(!error){
      await supabase.from('stalls').update({status:'booked'}).eq('id',data.stall_id);
      logAction('booked',`Stall ${data.stall_name} booked for ${data.renter_name} ($${fmt2(data.total)}).`);
      addToast('success','Booking confirmed',`Stall ${data.stall_name} · $${fmt2(data.total)}`);
      setModal(null); setSelected(bk); setTimeout(()=>setModal('receipt'),80);
    }else{ addToast('error','Booking failed',error.message); }
    setSyncing(false);
  };

  const handleSaveDates = async (id,startDate,endDate,newDays,newSub,newGrand) => {
    const{error}=await supabase.from('bookings').update({start_date:startDate,end_date:endDate,days:newDays,subtotal:newSub,total:newGrand}).eq('id',id);
    if(!error){ setModal(null); addToast('success','Dates updated',''); logAction('dates',`Booking dates updated → $${fmt2(newGrand)}.`); }
    else addToast('error','Update failed',error.message);
  };

  const handleSaveSettings = async (br,v) => {
    await supabase.from('settings').upsert([{key:'branding',value:br},{key:'vat',value:v}]);
    setBranding(br); setVat(v); setModal(null);
    addToast('success','Settings saved',''); logAction('settings',`Settings updated. App: "${br.appName}".`);
  };

  const handleAddUser = async u => {
    const{error}=await supabase.from('users').insert({name:u.name,email:u.email,password:u.password,role:u.role});
    if(!error){ addToast('success','User created',u.name); logAction('user',`User ${u.name} (${u.role}) created.`); }
    else addToast('error','Create failed',error.message);
  };
  const handleEditUser = async u => {
    const{error}=await supabase.from('users').update({name:u.name,email:u.email,role:u.role,...(u.password?{password:u.password}:{})}).eq('id',u.id);
    if(!error){ addToast('success','User updated',u.name); }
    else addToast('error','Update failed',error.message);
  };
  const handleDeleteUser = async id => {
    if(id===currentUser.id){ addToast('error','Cannot delete','Cannot delete your own account.'); return; }
    const{error}=await supabase.from('users').delete().eq('id',id);
    if(!error) addToast('warn','User removed','');
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const perms = currentUser ? ROLES[currentUser.role] : {};
  const statuses = Object.fromEntries(stalls.map(s=>[s.id,s.status||'available']));
  const bookingByStall = Object.fromEntries(bookings.map(b=>[b.stall_id,b]));
  const dueSoon = bookings.filter(b=>{const d=daysUntil(b.end_date);return d!==null&&d<=3;});
  const totalSub = bookings.reduce((a,b)=>a+parseFloat(b.subtotal||0),0);
  const totalVAT = vat.enabled?Math.round(totalSub*(vat.rate/100)*100)/100:0;
  const totalRev = Math.round((totalSub+totalVAT)*100)/100;
  const allZones  = [...new Set(stalls.map(s=>s.zone))].sort();
  const allTypes  = stallTypes.map(t=>t.name);
  const existingNames = stalls.map(s=>s.name.toUpperCase());

  const getTC = name => stallTypes.find(t=>t.name===name)||{bg_color:'#f3f4f6',border_color:'#6b7280',text_color:'#374151'};

  const filteredStalls = useMemo(()=>stalls.filter(s=>(filterType==='All'||s.type===filterType)&&(filterStat==='All'||s.status===filterStat)),[stalls,filterType,filterStat]);
  const filteredBookings = useMemo(()=>{
    if(!searchQ.trim()) return bookings;
    const q=searchQ.toLowerCase();
    return bookings.filter(b=>b.renter_name.toLowerCase().includes(q)||b.stall_name.toLowerCase().includes(q)||(b.email||'').toLowerCase().includes(q)||(b.phone||'').includes(q));
  },[bookings,searchQ]);

  const stats={total:stalls.length,available:stalls.filter(s=>s.status==='available').length,booked:stalls.filter(s=>s.status==='booked').length,pending:stalls.filter(s=>s.status==='pending').length,revenue:fmt2(totalRev)};

  // ── Screens ────────────────────────────────────────────────────────────────
  if(loading) return(
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#312e81)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.sans}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:'center',color:'#fff'}}>
        <div style={{width:60,height:60,borderRadius:16,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,margin:'0 auto 20px',boxShadow:'0 8px 32px rgba(99,102,241,.4)'}}>🏪</div>
        <div style={{fontSize:22,fontWeight:900,marginBottom:8}}>Market Stall Manager</div>
        <div style={{fontSize:13,color:'rgba(255,255,255,.4)',marginBottom:20}}>{dbError?'Connection failed. Check your .env file.':'Connecting to database…'}</div>
        {!dbError?<div style={{width:36,height:36,border:'3px solid rgba(255,255,255,.2)',borderTopColor:'#6366f1',borderRadius:'50%',margin:'0 auto',animation:'spin 1s linear infinite'}}/>:<button onClick={()=>window.location.reload()} style={{padding:'9px 22px',borderRadius:9,border:'none',background:'#6366f1',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>Retry</button>}
      </div>
    </div>
  );

  if(!currentUser) return(
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes mIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}@keyframes tIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes fUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}input:focus,select:focus,textarea:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)!important;outline:none!important;}`}</style>
      <LoginScreen branding={branding} onLogin={handleLogin}/>
      <Toast toasts={toasts} remove={removeToast}/>
    </>
  );

  const navItems=[
    {id:'grid',     label:'Stalls',    icon:'🏪'},
    {id:'bookings', label:'Bookings',  icon:'📋'},
    ...(perms.canViewReports?[{id:'analytics',label:'Analytics',icon:'📊'}]:[]),
    ...(perms.canManageUsers?[{id:'users',    label:'Users',    icon:'👥'}]:[]),
    ...(perms.canViewReports?[{id:'log',      label:'Activity', icon:'📋'}]:[]),
  ];

  const fBtn=active=>({padding:'6px 13px',borderRadius:20,fontSize:12,fontWeight:600,border:`1.5px solid ${active?T.text:T.border}`,background:active?T.text:'#fff',color:active?'#fff':T.muted,cursor:'pointer',transition:'all .15s'});

  return(
    <div style={{fontFamily:T.sans,background:T.bg,minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes mIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}@keyframes tIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}input:focus,select:focus,textarea:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)!important;outline:none!important;}@media(max-width:640px){.hide-sm{display:none!important}}`}</style>

      {/* ── Navbar ── */}
      <div style={{background:T.primary,color:'#fff',position:'sticky',top:0,zIndex:200,boxShadow:'0 2px 20px rgba(0,0,0,.3)'}}>
        {/* Row 1 */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 20px',borderBottom:'1px solid rgba(255,255,255,.08)',gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            <div style={{width:36,height:36,borderRadius:9,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,boxShadow:'0 2px 10px rgba(99,102,241,.5)'}}>
              {branding.logoSrc?<img src={branding.logoSrc} alt="" style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:9}}/>:'🏪'}
            </div>
            <div>
              {branding.orgName&&<div style={{fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'rgba(255,255,255,.4)',marginBottom:1}}>{branding.orgName}</div>}
              <div style={{fontSize:14,fontWeight:800,color:'#fff',whiteSpace:'nowrap'}}>{branding.appName}</div>
            </div>
            <span style={{fontSize:10,color:T.success,fontWeight:600,background:'#f0fdf4',padding:'2px 8px',borderRadius:5}}>{syncing?'↻ Syncing':'● Live'}</span>
          </div>
          <div className="hide-sm" style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            {[{l:'Stalls',v:stats.total,c:'rgba(255,255,255,.9)'},{l:'Available',v:stats.available,c:'#86efac'},{l:'Booked',v:stats.booked,c:'#fca5a5'},{l:'Revenue',v:`$${stats.revenue}`,c:'#93c5fd'},...(vat.enabled?[{l:vat.label||'VAT',v:`$${fmt2(totalVAT)}`,c:'#d8b4fe'}]:[])].map(({l,v,c})=>(
              <div key={l} style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',borderRadius:7,padding:'4px 10px',textAlign:'center'}}>
                <div style={{fontFamily:T.mono,fontSize:14,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:9,color:'rgba(255,255,255,.35)',textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:9,flexShrink:0}}>
            <Avatar name={currentUser.name} size={32} color={ROLES[currentUser.role]?.color||T.accent}/>
            <div className="hide-sm"><div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{currentUser.name}</div><div style={{marginTop:1}}><RoleBadge role={currentUser.role}/></div></div>
            <button onClick={handleLogout} style={{marginLeft:4,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',color:'rgba(255,255,255,.6)',borderRadius:7,padding:'5px 11px',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:T.sans}}>Sign out</button>
          </div>
        </div>
        {/* Row 2 */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',gap:10,flexWrap:'wrap'}}>
          <nav style={{display:'flex',alignItems:'center',overflowX:'auto'}}>
            {navItems.map(n=>(
              <button key={n.id} onClick={()=>setView(n.id)} style={{padding:'10px 14px',border:'none',borderBottom:view===n.id?'3px solid #818cf8':'3px solid transparent',background:'transparent',color:view===n.id?'#fff':'rgba(255,255,255,.5)',cursor:'pointer',fontFamily:T.sans,fontSize:13,fontWeight:view===n.id?700:500,display:'flex',alignItems:'center',gap:6,transition:'all .15s',whiteSpace:'nowrap',marginBottom:'-1px'}}>
                {n.icon} {n.label}
                {n.id==='bookings'&&dueSoon.length>0&&<span style={{background:'#ef4444',color:'#fff',borderRadius:8,fontSize:9,fontWeight:800,padding:'1px 5px',marginLeft:2}}>{dueSoon.length}</span>}
              </button>
            ))}
            {perms.canSettings&&<button onClick={()=>setModal('settings')} style={{padding:'10px 14px',border:'none',borderBottom:'3px solid transparent',background:'transparent',color:'rgba(255,255,255,.4)',cursor:'pointer',fontFamily:T.sans,fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6,transition:'all .15s',whiteSpace:'nowrap'}}>⚙️ Settings</button>}
          </nav>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',padding:'5px 0'}}>
            {view==='grid'&&perms.canSettings&&<button onClick={()=>setModal('manageTypes')} style={{padding:'6px 13px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.07)',color:'rgba(255,255,255,.75)',cursor:'pointer',fontFamily:T.sans,fontSize:12,fontWeight:600}}>🏷 Types</button>}
            {perms.canViewReports&&<button onClick={()=>setModal('report')} style={{padding:'6px 13px',borderRadius:8,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.07)',color:'rgba(255,255,255,.75)',cursor:'pointer',fontFamily:T.sans,fontSize:12,fontWeight:600}}>📊 Report</button>}
            {view==='grid'&&perms.canBook&&<Btn onClick={()=>setModal('addStall')} small>+ Add Stall</Btn>}
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'8px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div>
          <span style={{fontSize:14,fontWeight:700,color:T.text}}>{view==='grid'?'Stall Directory':view==='bookings'?'Bookings':view==='analytics'?'Analytics':view==='users'?'User Management':'Activity Log'}</span>
          <span style={{fontSize:12,color:T.muted,marginLeft:8}}>
            {view==='grid'&&`· ${stats.available} available · ${stats.booked} booked · ${stats.pending} pending`}
            {view==='bookings'&&`· ${bookings.length} bookings · $${stats.revenue} revenue`}
            {view==='analytics'&&'· Real-time metrics'}
            {view==='users'&&`· ${users.length} accounts`}
            {view==='log'&&`· ${activityLog.length} events`}
          </span>
        </div>
      </div>

      {/* Due soon banner */}
      {dueSoon.length>0&&<div style={{background:'linear-gradient(90deg,#fef3c7,#fffbeb)',borderBottom:'2px solid #fbbf24',padding:'7px 20px'}}><div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}><span style={{fontWeight:700,fontSize:12,color:'#92400e'}}>⚠️ Attention:</span>{dueSoon.map(b=>{const d=daysUntil(b.end_date);return(<span key={b.id} style={{background:'#fff',border:'1.5px solid #fbbf24',borderRadius:7,padding:'2px 9px',fontSize:12,color:'#78350f',fontWeight:600}}>Stall {b.stall_name} · {b.renter_name} · {d<0?`${Math.abs(d)}d overdue`:d===0?'due today':`${d}d`}</span>);})}</div></div>}

      {/* ── Page content ── */}
      <div style={{flex:1,padding:'20px',overflowY:'auto'}}>

        {/* Stalls Grid */}
        {view==='grid'&&(<>
          <div style={{display:'flex',gap:7,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{['All',...allTypes].map(t=><button key={t} onClick={()=>setFT(t)} style={fBtn(filterType===t)}>{t}</button>)}</div>
            <div style={{width:1,background:T.border,margin:'0 3px',alignSelf:'stretch'}}/>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{['All','available','booked','pending'].map(s=><button key={s} onClick={()=>setFS(s)} style={fBtn(filterStat===s)}>{s==='All'?'All Status':{available:'Available',booked:'Booked',pending:'Pending'}[s]}</button>)}</div>
          </div>
          {allZones.map(zone=>{
            const zs=filteredStalls.filter(s=>s.zone===zone);if(!zs.length)return null;
            return(<div key={zone} style={{marginBottom:26}}>
              <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:11}}><span style={{background:T.primary,color:'#fff',borderRadius:6,padding:'2px 10px',fontSize:10,fontWeight:700,letterSpacing:'0.07em'}}>ZONE {zone}</span><span style={{fontSize:12,color:T.muted}}>{zs.length} stall{zs.length!==1?'s':''} · {zs.filter(s=>s.status==='booked').length} booked</span></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:11}}>
                {zs.map(stall=><StallCard key={stall.id} stall={stall} booking={bookingByStall[stall.id]} stallTypes={stallTypes} vat={vat} canEdit={perms.canBook} canDelete={perms.canDeleteStalls} onBook={s=>{setSelected(s);setModal('book');}} onRelease={handleRelease} onEdit={s=>{if(s._delete){handleSaveStall(s);}else{setSelected(s);setModal('editStall');}}} onPending={handlePending}/>)}
              </div>
            </div>);
          })}
          {filteredStalls.length===0&&<Card style={{padding:'60px',textAlign:'center',color:T.light}}>No stalls match your filters.</Card>}
        </>)}

        {/* Bookings */}
        {view==='bookings'&&<div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div style={{fontSize:16,fontWeight:800,color:T.text}}>Bookings <span style={{fontSize:14,fontWeight:400,color:T.muted}}>({filteredBookings.length})</span></div>
            <input placeholder="🔍 Search name, stall, email, phone…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{...inp(false),width:280,fontSize:13}}/>
          </div>
          {filteredBookings.length===0?<Card style={{padding:'60px',textAlign:'center',color:T.light}}>{searchQ?'No bookings match.':'No bookings yet.'}</Card>
            :<div style={{display:'flex',flexDirection:'column',gap:9}}>
              {filteredBookings.map(b=>{
                const tc=getTC(b.stall_type),due=daysUntil(b.end_date),isUrgent=due!==null&&due<=3;
                const sub=parseFloat(b.subtotal||0),{vatAmt:vA,grand}=calcVAT(sub,vat.rate,vat.enabled);
                const paid=parseFloat(b.amount_paid||0),chg=Math.round((paid-grand)*100)/100;
                const ps=payStatus(paid,grand);
                return(
                  <Card key={b.id} style={{padding:'14px 18px',border:`${isUrgent?'2px':'1px'} solid ${isUrgent?'#fbbf24':T.border}`,boxShadow:isUrgent?'0 0 0 4px #fef3c766':'none',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:4}}>
                        <span style={{fontFamily:T.mono,fontWeight:800,fontSize:14,color:T.text}}>Stall {b.stall_name}</span>
                        <span style={{background:tc.bg_color,border:`1px solid ${tc.border_color}`,color:tc.text_color,borderRadius:5,fontSize:10,fontWeight:700,padding:'2px 6px',textTransform:'uppercase'}}>{b.stall_type}</span>
                        <PayBadge status={ps}/>
                      </div>
                      <div style={{fontSize:13,color:T.muted,marginBottom:5}}>👤 {b.renter_name}{b.email?` · ${b.email}`:''}{b.phone?` · ${b.phone}`:''}</div>
                      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:5}}>
                        <span style={{background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1d4ed8',borderRadius:6,padding:'3px 9px',fontSize:12,fontWeight:700}}>📅 {fmtDate(b.start_date)} → {fmtDate(b.end_date)}</span>
                        <span style={{fontSize:12,color:T.muted}}>{b.days}d</span>
                        <DueBadge end={b.end_date}/>
                      </div>
                      <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                        {vat.enabled&&<span style={{fontSize:11,color:T.purple,background:'#f5f3ff',border:'1px solid #c4b5fd',borderRadius:5,padding:'2px 7px',fontWeight:600}}>Sub ${fmt2(sub)} + {vat.label||'VAT'} ${fmt2(vA)}</span>}
                        {paid>0&&<span style={{fontSize:11,fontWeight:700,color:chg>=0?T.success:T.danger,background:chg>=0?'#f0fdf4':'#fee2e2',border:`1px solid ${chg>=0?'#86efac':'#fca5a5'}`,borderRadius:5,padding:'2px 7px'}}>{chg>=0?`💚 Change $${fmt2(chg)}`:`🔴 Bal $${fmt2(Math.abs(chg))}`}</span>}
                        {b.notes&&<span style={{fontSize:11,color:T.light,fontStyle:'italic'}}>📝 {b.notes}</span>}
                      </div>
                      <div style={{fontSize:10,color:T.light,marginTop:5}}>Booked {b.booked_at_fmt||new Date(b.created_at).toLocaleString('en-GB')}{b.booked_by?` · by ${b.booked_by}`:''}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                      <span style={{fontFamily:T.mono,fontWeight:900,fontSize:17,color:T.text}}>${fmt2(grand)}</span>
                      <Btn ghost small onClick={()=>{setSelected(b);setModal('receipt');}} style={{color:T.success,borderColor:T.success+'66'}}>🖨 Receipt</Btn>
                      {perms.canBook&&<Btn ghost small onClick={()=>{setSelected(b);setModal('editDates');}}>✎ Edit</Btn>}
                      {perms.canBook&&<Btn ghost small danger onClick={()=>handleRelease(b.stall_id)}>Release</Btn>}
                    </div>
                  </Card>
                );
              })}
            </div>}
        </div>}

        {/* Analytics */}
        {view==='analytics'&&<AnalyticsView stalls={stalls} bookings={bookings} stallTypes={stallTypes} statuses={statuses} vat={vat}/>}

        {/* Users */}
        {view==='users'&&<UsersView users={users} currentUser={currentUser} onAddUser={handleAddUser} onEditUser={handleEditUser} onDeleteUser={handleDeleteUser} perms={perms}/>}

        {/* Activity Log */}
        {view==='log'&&<div>
          <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:18}}>Activity Log</div>
          {!activityLog.length?<Card style={{padding:'60px',textAlign:'center',color:T.light}}>No activity yet.</Card>
            :<div style={{display:'flex',flexDirection:'column',gap:8}}>
              {activityLog.map(e=>(
                <Card key={e.id} style={{padding:'13px 16px',display:'flex',gap:13,alignItems:'flex-start'}}>
                  <div style={{width:34,height:34,borderRadius:8,background:'#f8fafc',border:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    {{booked:'✅',released:'🔓',added:'➕',removed:'🗑',edited:'✎',pending:'⏳',dates:'📅',settings:'⚙️',login:'🔑',user:'👤'}[e.type]||'•'}
                  </div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{e.message}</div><div style={{fontSize:11,color:T.light,marginTop:2}}>{new Date(e.created_at).toLocaleString('en-GB')}{e.user_name?` · ${e.user_name}`:''}</div></div>
                </Card>
              ))}
            </div>}
        </div>}
      </div>

      {/* ── Modals ── */}
      {modal==='book'        &&selected&&<BookingModal stall={selected} vat={vat} currentUser={currentUser} receiptNo={receiptNo+1} onConfirm={handleConfirmBooking} onClose={()=>{setModal(null);setSelected(null);}}/>}
      {modal==='receipt'     &&selected&&<ReceiptModal booking={selected} branding={branding} vat={vat} onClose={()=>{setModal(null);setSelected(null);}}/>}
      {modal==='editDates'   &&selected&&<EditDatesModal booking={selected} vat={vat} onSave={handleSaveDates} onClose={()=>{setModal(null);setSelected(null);}}/>}
      {modal==='addStall'    &&<StallModal stallTypes={stallTypes} existingNames={existingNames} onSave={handleSaveStall} onClose={()=>setModal(null)}/>}
      {modal==='editStall'   &&selected&&<StallModal stall={selected} stallTypes={stallTypes} existingNames={existingNames.filter(n=>n!==selected.name.toUpperCase())} onSave={handleSaveStall} onClose={()=>{setModal(null);setSelected(null);}}/>}
      {modal==='settings'    &&<SettingsModal branding={branding} vat={vat} onSave={handleSaveSettings} onClose={()=>setModal(null)}/>}
      {modal==='report'      &&<Modal onClose={()=>setModal(null)} width={720}><MHead title="Report" subtitle="Occupancy & revenue summary" icon="📊" onClose={()=>setModal(null)}/><div style={{padding:'18px 22px'}}><AnalyticsView stalls={stalls} bookings={bookings} stallTypes={stallTypes} statuses={statuses} vat={vat}/></div><div style={{padding:'0 22px 22px',display:'flex',gap:10}}><Btn ghost onClick={()=>setModal(null)} style={{flex:1}}>Close</Btn><Btn onClick={()=>alert('Download the codebase and use the full printable report from there.')} style={{flex:2}}>🖨 Print Report</Btn></div></Modal>}
      {modal==='manageTypes' &&<Modal onClose={()=>setModal(null)} width={400}><MHead title="Stall Types" icon="🏷" onClose={()=>setModal(null)}/><div style={{padding:'18px 24px 22px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:16,maxHeight:230,overflowY:'auto'}}>
          {stallTypes.map(t=>(<div key={t.id||t.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#f8fafc',border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 13px'}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}><span style={{width:11,height:11,borderRadius:3,background:t.border_color,display:'inline-block'}}/><span style={{fontWeight:600,fontSize:14,color:T.text}}>{t.name}</span><Badge label={t.name} color={t.text_color} bg={t.bg_color} border={t.border_color}/></div>
            {stallTypes.length>1&&<button onClick={()=>handleDeleteType(t.name)} style={{background:'transparent',border:'none',color:T.light,fontSize:14,cursor:'pointer',padding:'0 3px'}} onMouseEnter={e=>e.currentTarget.style.color=T.danger} onMouseLeave={e=>e.currentTarget.style.color=T.light}>✕</button>}
          </div>))}
        </div>
        <AddTypeForm stallTypes={stallTypes} onAdd={handleAddType}/>
        <Btn ghost onClick={()=>setModal(null)} style={{width:'100%',marginTop:16}}>Done</Btn>
      </div></Modal>}

      <Toast toasts={toasts} remove={removeToast}/>
    </div>
  );
}
