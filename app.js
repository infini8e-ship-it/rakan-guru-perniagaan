/* Rakan Guru Perniagaan — logik utama */
'use strict';
const SB_URL='https://pnklfeluvwsexhkqolpe.supabase.co';
const SB_KEY='sb_publishable_Gsu_bqlZbT7HtS40bxOhPQ_Rry4NHTi';
const $=id=>document.getElementById(id);
const ls=localStorage;

let KB=[], SP=[], DOK_ADMIN=[], sejarahChat=[];

/* ---------- util ---------- */
async function rpc(fn, args){
  const r=await fetch(`${SB_URL}/rest/v1/rpc/${fn}`,{method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY},
    body:JSON.stringify(args)});
  if(!r.ok) throw new Error((await r.json()).message||'Ralat pelayan');
  return r.json();
}
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}
function mdRingkas(t){ // penukar markdown ringkas & selamat
  let h=esc(t);
  h=h.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  h=h.replace(/^[-•] (.*)$/gm,'&nbsp;&nbsp;• $1');
  return h;
}
function salin(t,btn){navigator.clipboard.writeText(t).then(()=>{const a=btn.textContent;btn.textContent='✓ Disalin';setTimeout(()=>btn.textContent=a,1500)})}

/* ---------- carian KB (offline) ---------- */
function tokenkan(q){return q.toLowerCase().replace(/[^\w\u00C0-\u024F ]/g,' ').split(/\s+/).filter(w=>w.length>=3)}
function cariKB(q, had=6, kategori=''){
  const toks=tokenkan(q); if(!toks.length) return [];
  const semua=[...KB, ...DOK_ADMIN.map(d=>({s:d.tajuk,k:d.kategori,t:d.tingkatan,c:d.kandungan}))];
  const skor=[];
  for(const ch of semua){
    if(kategori && ch.k!==kategori) continue;
    const teks=ch.c.toLowerCase(); let s=0;
    for(const t of toks){let i=-1,n=0;while((i=teks.indexOf(t,i+1))!==-1&&n<8)n++;s+=n*(t.length>=5?2:1)}
    if(s>0) skor.push([s,ch]);
  }
  return skor.sort((a,b)=>b[0]-a[0]).slice(0,had).map(x=>x[1]);
}

/* ---------- Gemini ---------- */
async function gemini(sistem, pengguna, sejarah=[]){
  const kunci=ls.getItem('gemKunci');
  if(!kunci) throw new Error('TIADA_KUNCI');
  const model=ls.getItem('gemModel')||'gemini-2.5-flash';
  const contents=[...sejarah, {role:'user',parts:[{text:pengguna}]}];
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${kunci}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({system_instruction:{parts:[{text:sistem}]},contents,
      generationConfig:{temperature:0.6,maxOutputTokens:4096}})});
  const j=await r.json();
  if(!r.ok) throw new Error(j.error?.message||'Ralat API Gemini');
  return j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'(tiada jawapan)';
}
const SISTEM_ASAS=`Anda ialah pakar kandungan mata pelajaran Perniagaan KSSM (MPEI) Tingkatan 4 & 5 Malaysia dan pakar pembinaan item peperiksaan SPM. Jawab dalam Bahasa Melayu baku sepenuhnya. Rujuk KONTEKS yang diberikan sebagai sumber utama (DSKP, buku teks, modul). Jika konteks tidak mencukupi, guna pengetahuan kurikulum Malaysia dengan berhati-hati dan nyatakan. Gunakan istilah rasmi DSKP.`;

/* ---------- pintu masuk ---------- */
async function initGate(){
  if(ls.getItem('aksesSah')==='1'){$('gate').classList.add('tersembunyi');$('app').classList.remove('tersembunyi');return}
  $('gate').classList.remove('tersembunyi');
  $('btnMasuk').onclick=async()=>{
    const kod=$('kodAkses').value.trim(); if(!kod)return;
    $('btnMasuk').disabled=true;$('gateRalat').textContent='';
    try{
      const ok=await rpc('kb_sahkan_akses',{kod});
      if(ok===true){ls.setItem('aksesSah','1');$('gate').classList.add('tersembunyi');$('app').classList.remove('tersembunyi')}
      else $('gateRalat').textContent='Kod akses tidak sah. Semak dengan penyelaras anda.';
    }catch(e){$('gateRalat').textContent='Tidak dapat menyemak kod — pastikan ada internet untuk kali pertama.'}
    $('btnMasuk').disabled=false;
  };
  $('kodAkses').addEventListener('keydown',e=>{if(e.key==='Enter')$('btnMasuk').click()});
}

/* ---------- navigasi ---------- */
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('aktif',x===b));
  document.querySelectorAll('.view').forEach(v=>v.classList.add('tersembunyi'));
  $('view-'+b.dataset.view).classList.remove('tersembunyi');
});
document.querySelectorAll('.menu-item').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.panel').forEach(p=>p.classList.add('tersembunyi'));
  $('panel-'+b.dataset.buka).classList.remove('tersembunyi');
  b.scrollIntoView({behavior:'smooth'});
  if(b.dataset.buka==='kb') paparKB('');
});

/* ---------- muat data ---------- */
async function muatData(){
  try{
    [KB,SP]=await Promise.all([fetch('data/kb.json').then(r=>r.json()),fetch('data/sp.json').then(r=>r.json())]);
  }catch(e){console.error('KB gagal dimuat',e)}
  // dokumen admin dari Supabase (jika online), cache untuk offline
  try{
    const r=await fetch(`${SB_URL}/rest/v1/kb_dokumen?select=id,tajuk,kategori,tingkatan,kandungan&aktif=eq.true`,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
    if(r.ok){DOK_ADMIN=await r.json();ls.setItem('dokAdmin',JSON.stringify(DOK_ADMIN))}
  }catch(e){DOK_ADMIN=JSON.parse(ls.getItem('dokAdmin')||'[]')}
  isiSP('sSP');isiSP('rSP');
}
function isiSP(id){
  const sel=$(id), ting=id==='sSP'?$('sTing'):$('rTing');
  const isi=()=>{sel.innerHTML='';SP.filter(s=>s.t===ting.value).forEach(s=>{
    const o=document.createElement('option');o.value=s.sp;o.textContent=`${s.sp} — ${s.h.slice(0,80)}`;sel.appendChild(o)})};
  ting.onchange=isi; isi();
}
function spPilihan(kod){return SP.find(s=>s.sp===kod)}

/* ---------- CHAT ---------- */
async function hantarChat(teks){
  if(!teks.trim())return;
  const senarai=$('chatSenarai');
  senarai.querySelector('.chat-kosong')?.remove();
  const bS=document.createElement('div');bS.className='buih saya';bS.textContent=teks;senarai.appendChild(bS);
  const bA=document.createElement('div');bA.className='buih ai memuat';bA.textContent='Sedang berfikir…';senarai.appendChild(bA);
  bA.scrollIntoView({behavior:'smooth'});
  $('chatTeks').value='';
  try{
    const konteks=cariKB(teks,6).map(c=>`[${c.s}] ${c.c}`).join('\n---\n');
    const jawapan=await gemini(SISTEM_ASAS, `KONTEKS:\n${konteks}\n\nSOALAN GURU:\n${teks}`, sejarahChat.slice(-6));
    sejarahChat.push({role:'user',parts:[{text:teks}]},{role:'model',parts:[{text:jawapan}]});
    bA.classList.remove('memuat');bA.innerHTML=mdRingkas(jawapan);
  }catch(e){
    bA.classList.remove('memuat');
    bA.innerHTML=e.message==='TIADA_KUNCI'
      ?'Fungsi AI perlukan kunci Gemini percuma anda. Pergi ke <strong>Lagi → Tetapan API</strong> (setup 2 minit, sekali sahaja).'
      :'Ralat: '+esc(e.message);
  }
  bA.scrollIntoView({behavior:'smooth'});
}
$('btnHantar').onclick=()=>hantarChat($('chatTeks').value);
$('chatTeks').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();hantarChat(e.target.value)}});
document.querySelectorAll('.cadang').forEach(b=>b.onclick=()=>hantarChat(b.dataset.q));

/* ---------- JANA SOALAN ---------- */
$('btnJanaSoalan').onclick=async()=>{
  const sp=spPilihan($('sSP').value); if(!sp)return;
  const hasil=$('soalanHasil');hasil.innerHTML='<div class="memuat">Menjana soalan…</div>';
  const konteks=cariKB(sp.tajuk+' '+sp.h,5).map(c=>`[${c.s}] ${c.c}`).join('\n---\n');
  const arahan=`Bina ${$('sBil').value} soalan ${$('sJenis').value} peperiksaan SPM Perniagaan.
Tingkatan: ${$('sTing').value}
Standard Pembelajaran: ${sp.sp} — ${sp.h} (Tajuk: ${sp.tajuk})
Aras KBAT: ${$('sAras').value}
${$('sSkema').checked?'Sertakan skema jawapan lengkap dengan agihan markah selepas setiap soalan (format skema SPM: F=fakta, H=huraian, C=contoh jika esei).':'Tanpa skema jawapan.'}
Format objektif: soalan bernombor, 4 pilihan A-D, satu jawapan betul. Format struktur/esei: ikut gaya kertas SPM sebenar dengan kata tugas yang tepat (nyatakan/terangkan/huraikan/bincangkan) dan peruntukan markah dalam kurungan.
Konteks rujukan:\n${konteks}`;
  try{
    const t=await gemini(SISTEM_ASAS,arahan);
    hasil.innerHTML=`<div class="hasil-kad"><div class="jana-teks">${mdRingkas(t)}</div><div class="hasil-alat"><button data-t="">📋 Salin</button></div></div>`;
    hasil.querySelector('[data-t]').onclick=e=>salin(t,e.target);
  }catch(e){paparRalatAI(hasil,e)}
};

/* ---------- JANA RPH ---------- */
$('btnJanaRPH').onclick=async()=>{
  const sp=spPilihan($('rSP').value); if(!sp)return;
  const hasil=$('rphHasil');hasil.innerHTML='<div class="memuat">Menjana RPH…</div>';
  const konteks=cariKB(sp.tajuk+' '+sp.h,4).map(c=>`[${c.s}] ${c.c}`).join('\n---\n');
  const arahan=`Sediakan satu Rancangan Pengajaran Harian (RPH) lengkap Perniagaan KSSM.
Tingkatan: ${$('rTing').value} | Masa: ${$('rMasa').value}
Standard Kandungan: ${sp.sk} ${sp.tajuk}
Standard Pembelajaran: ${sp.sp} — ${sp.h}
Strategi PdP: ${$('rStrategi').value} | EMK: ${$('rEMK').value}
${$('rNota').value?'Nota guru: '+$('rNota').value:''}
Format RPH: Tarikh/Hari/Masa/Kelas (kosongkan untuk diisi guru), Tema/Tajuk, SK, SP, Objektif Pembelajaran (boleh diukur, "Pada akhir PdP murid dapat…"), Kriteria Kejayaan, Aktiviti PdP (Set Induksi ~5 min, Aktiviti Utama berperingkat dengan masa, Penutup/Refleksi), EMK, BBB/BBM, Pentaksiran (kaitkan Tahap Penguasaan DSKP), Refleksi (kosongkan). Aktiviti mesti selari dengan strategi ${$('rStrategi').value} dan boleh dilaksana dalam bilik darjah sebenar.
Konteks DSKP:\n${konteks}`;
  try{
    const t=await gemini(SISTEM_ASAS,arahan);
    hasil.innerHTML=`<div class="hasil-kad"><div class="jana-teks">${mdRingkas(t)}</div><div class="hasil-alat"><button data-t="">📋 Salin</button></div></div>`;
    hasil.querySelector('[data-t]').onclick=e=>salin(t,e.target);
  }catch(e){paparRalatAI(hasil,e)}
};
function paparRalatAI(el,e){
  el.innerHTML=e.message==='TIADA_KUNCI'
    ?'<div class="hasil-kad">Fungsi AI perlukan kunci Gemini percuma anda — pergi ke <strong>Lagi → Tetapan API</strong> (sekali sahaja, 2 minit).</div>'
    :`<div class="hasil-kad ralat">Ralat: ${esc(e.message)}</div>`;
}

/* ---------- ANALISIS (offline) ---------- */
let dataAnalisis=null, carta1=null, carta2=null;
function gred(m){return m>=90?'A+':m>=80?'A':m>=75?'A-':m>=70?'B+':m>=65?'B':m>=60?'C+':m>=50?'C':m>=45?'D':m>=40?'E':'G'}
$('btnAnalisis').onclick=()=>{
  const baris=$('aData').value.split('\n').map(b=>b.trim()).filter(Boolean);
  const rekod=baris.map(b=>{const p=b.split(/[,\t;]/);const m=parseFloat(p[p.length-1]);return isNaN(m)?null:{nama:p.length>1?p[0].trim():'',m}}).filter(Boolean);
  if(!rekod.length){$('analisisHasil').innerHTML='<div class="hasil-kad ralat">Tiada markah sah dikesan. Semak format.</div>';return}
  const ms=rekod.map(r=>r.m), n=ms.length;
  const min=Math.min(...ms),maks=Math.max(...ms),purata=ms.reduce((a,b)=>a+b,0)/n;
  const susun=[...ms].sort((a,b)=>a-b), median=n%2?susun[(n-1)/2]:(susun[n/2-1]+susun[n/2])/2;
  const sisih=Math.sqrt(ms.reduce((a,b)=>a+(b-purata)**2,0)/n);
  const lulus=ms.filter(m=>m>=40).length;
  const gredKira={};['A+','A','A-','B+','B','C+','C','D','E','G'].forEach(g=>gredKira[g]=0);
  rekod.forEach(r=>gredKira[gred(r.m)]++);
  dataAnalisis={n,min,maks,purata,median,sisih,lulus,gredKira,rekod};
  $('analisisHasil').innerHTML=`<div class="hasil-kad"><div class="jana-teks"><strong>Ringkasan ${n} murid</strong>
Purata: <strong>${purata.toFixed(1)}</strong> | Median: ${median.toFixed(1)} | Sisihan piawai: ${sisih.toFixed(1)}
Tertinggi: ${maks} | Terendah: ${min}
Lulus (≥40): <strong>${lulus}/${n}</strong> (${(lulus/n*100).toFixed(1)}%)
Kualiti (A- ke atas): ${gredKira['A+']+gredKira['A']+gredKira['A-']}/${n}</div></div>`;
  lukisCarta();
  $('btnUlasAI').classList.remove('tersembunyi');$('ulasanHasil').innerHTML='';
};
function lukisCarta(){
  if(!window.Chart){const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js';s.onload=lukisCarta;document.head.appendChild(s);return}
  const d=dataAnalisis; if(!d)return;
  $('cartaBekas1').classList.remove('tersembunyi');$('cartaBekas2').classList.remove('tersembunyi');
  carta1?.destroy();carta2?.destroy();
  carta1=new Chart($('cartaGred'),{type:'bar',data:{labels:Object.keys(d.gredKira),datasets:[{label:'Bilangan murid',data:Object.values(d.gredKira),backgroundColor:'#1E7A5A'}]},options:{plugins:{title:{display:true,text:'Taburan Gred'}},scales:{y:{ticks:{stepSize:1}}}}});
  const julat=['0-39','40-49','50-59','60-69','70-79','80-100'];
  const kira=[0,0,0,0,0,0];
  d.rekod.forEach(r=>{const m=r.m;kira[m<40?0:m<50?1:m<60?2:m<70?3:m<80?4:5]++});
  carta2=new Chart($('cartaHisto'),{type:'bar',data:{labels:julat,datasets:[{label:'Bilangan murid',data:kira,backgroundColor:'#C0392B'}]},options:{plugins:{title:{display:true,text:'Taburan Markah'}},scales:{y:{ticks:{stepSize:1}}}}});
}
$('btnUlasAI').onclick=async()=>{
  const d=dataAnalisis;if(!d)return;
  $('ulasanHasil').innerHTML='<div class="memuat">Menganalisis…</div>';
  try{
    const t=await gemini(SISTEM_ASAS,`Berikut statistik ujian Perniagaan satu kelas: ${d.n} murid, purata ${d.purata.toFixed(1)}, median ${d.median.toFixed(1)}, sisihan ${d.sisih.toFixed(1)}, lulus ${d.lulus}/${d.n}, taburan gred ${JSON.stringify(d.gredKira)}. Beri: (1) tafsiran ringkas prestasi kelas, (2) 3-4 cadangan intervensi PdP konkrit untuk guru Perniagaan (rujuk strategi DSKP), (3) cadangan fokus murid galus (markah 30-44). Ringkas dan praktikal.`);
    $('ulasanHasil').innerHTML=`<div class="hasil-kad"><div class="jana-teks">${mdRingkas(t)}</div></div>`;
  }catch(e){paparRalatAI($('ulasanHasil'),e)}
};

/* ---------- KB browser ---------- */
function paparKB(q,kategori){
  kategori=kategori??document.querySelector('#kbTapis .cip.aktif')?.dataset.k??'';
  const hasil=q?cariKB(q,20,kategori):[...KB.filter(c=>!kategori||c.k===kategori).slice(0,15)];
  $('kbHasil').innerHTML=hasil.map(c=>`<div class="kb-item"><span class="kb-sumber">${esc(c.s)}</span><div>${esc(c.c.slice(0,600))}${c.c.length>600?'…':''}</div></div>`).join('')||'<p class="nota-view">Tiada hasil.</p>';
}
$('kbCari').addEventListener('input',e=>paparKB(e.target.value));
document.querySelectorAll('#kbTapis .cip').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#kbTapis .cip').forEach(x=>x.classList.toggle('aktif',x===b));
  paparKB($('kbCari').value,b.dataset.k);
});

/* ---------- Tetapan API ---------- */
$('tKunci').value=ls.getItem('gemKunci')||'';
$('tModel').value=ls.getItem('gemModel')||'gemini-2.5-flash';
$('btnSimpanKunci').onclick=async()=>{
  const k=$('tKunci').value.trim();
  ls.setItem('gemKunci',k);ls.setItem('gemModel',$('tModel').value);
  if(!k){$('tStatus').textContent='Kunci dikosongkan.';return}
  $('tStatus').textContent='Menguji kunci…';
  try{await gemini('Jawab satu perkataan sahaja.','Sebut "sedia"');$('tStatus').textContent='✅ Kunci berfungsi! Semua fungsi AI kini aktif.'}
  catch(e){$('tStatus').textContent='❌ '+e.message}
};

/* ---------- Admin ---------- */
let adminPw='';
$('btnAdminMasuk').onclick=async()=>{
  const pw=$('adminPw').value;$('adminRalat').textContent='';
  try{
    if(await rpc('kb_admin_login',{pw})===true){adminPw=pw;$('adminLogin').classList.add('tersembunyi');$('adminPanel').classList.remove('tersembunyi');paparAdminDok()}
    else $('adminRalat').textContent='Kata laluan salah.';
  }catch(e){$('adminRalat').textContent='Ralat sambungan.'}
};
async function paparAdminDok(){
  try{
    const r=await fetch(`${SB_URL}/rest/v1/kb_dokumen?select=id,tajuk,kategori,tingkatan,aktif&order=kemaskini_pada.desc`,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
    const dok=await r.json();
    $('adminSenarai').innerHTML=dok.map(d=>`<div class="admin-dok"><span><strong>${esc(d.tajuk)}</strong> <code>${d.kategori}/T${d.tingkatan}</code></span><span><button data-edit="${d.id}">✏️</button><button data-padam="${d.id}">🗑️</button></span></div>`).join('')||'<p class="nota-view">Belum ada dokumen tambahan.</p>';
    $('adminSenarai').querySelectorAll('[data-edit]').forEach(b=>b.onclick=async()=>{
      const rr=await fetch(`${SB_URL}/rest/v1/kb_dokumen?id=eq.${b.dataset.edit}&select=*`,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
      const d=(await rr.json())[0];
      $('dId').value=d.id;$('dTajuk').value=d.tajuk;$('dKategori').value=d.kategori;$('dTing').value=d.tingkatan;$('dKandungan').value=d.kandungan;
      $('dokBorang').classList.remove('tersembunyi');
    });
    $('adminSenarai').querySelectorAll('[data-padam]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Padam dokumen ini?'))return;
      await rpc('kb_admin_padam',{pw:adminPw,p_id:b.dataset.padam});paparAdminDok();
    });
  }catch(e){$('adminSenarai').innerHTML='<p class="ralat">Gagal memuatkan.</p>'}
}
$('btnDokBaru').onclick=()=>{$('dId').value='';$('dTajuk').value='';$('dKandungan').value='';$('dokBorang').classList.remove('tersembunyi')};
$('btnDokBatal').onclick=()=>$('dokBorang').classList.add('tersembunyi');
$('btnDokSimpan').onclick=async()=>{
  try{
    await rpc('kb_admin_simpan',{pw:adminPw,p_id:$('dId').value||null,p_tajuk:$('dTajuk').value,p_kategori:$('dKategori').value,p_tingkatan:$('dTing').value,p_kandungan:$('dKandungan').value,p_aktif:true});
    $('dokBorang').classList.add('tersembunyi');$('adminStatus').textContent='✅ Disimpan.';paparAdminDok();
  }catch(e){$('adminStatus').textContent='❌ '+e.message}
};
$('btnKodTukar').onclick=async()=>{
  try{await rpc('kb_admin_tetapan',{pw:adminPw,p_kunci:'kod_akses',p_nilai:$('kodBaru').value});$('adminStatus').textContent='✅ Kod akses ditukar. Maklumkan kepada guru.'}
  catch(e){$('adminStatus').textContent='❌ '+e.message}
};
$('btnPwTukar').onclick=async()=>{
  try{await rpc('kb_admin_tetapan',{pw:adminPw,p_kunci:'admin_pw',p_nilai:$('pwBaru').value});adminPw=$('pwBaru').value;$('adminStatus').textContent='✅ Kata laluan admin ditukar.'}
  catch(e){$('adminStatus').textContent='❌ '+e.message}
};

/* ---------- status talian & SW ---------- */
function talian(){const s=$('statusTalian');if(navigator.onLine){s.classList.remove('luar');s.title='Dalam talian'}else{s.classList.add('luar');s.title='Luar talian — KB & analisis masih berfungsi'}}
addEventListener('online',talian);addEventListener('offline',talian);
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

/* ---------- mula ---------- */
initGate();muatData();talian();
