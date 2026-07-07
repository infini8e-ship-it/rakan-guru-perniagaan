/* Rakan Guru Perniagaan v2 — logik utama */
'use strict';
const SB_URL='https://pnklfeluvwsexhkqolpe.supabase.co';
const SB_KEY='sb_publishable_Gsu_bqlZbT7HtS40bxOhPQ_Rry4NHTi';
const $=id=>document.getElementById(id);
const ls=localStorage;

let KB=[], SP=[], DOK_ADMIN=[], RUJ={versi_kampoi:'2025',peta:{}}, sejarahChat=[];

/* ---------- util ---------- */
async function rpc(fn, args){
  const r=await fetch(`${SB_URL}/rest/v1/rpc/${fn}`,{method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY},
    body:JSON.stringify(args)});
  if(!r.ok) throw new Error((await r.json()).message||'Ralat pelayan');
  return r.json();
}
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}
function mdRingkas(t){
  let h=esc(t);
  h=h.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  h=h.replace(/^[-•] (.*)$/gm,'&nbsp;&nbsp;• $1');
  return h;
}
function salin(t,btn){navigator.clipboard.writeText(t).then(()=>{const a=btn.textContent;btn.textContent='✓ Disalin';setTimeout(()=>btn.textContent=a,1500)})}
function skripLuar(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Gagal memuat pustaka — perlukan internet kali pertama.'));document.head.appendChild(s)})}

/* ---------- carian KB (offline) ---------- */
function tokenkan(q){return q.toLowerCase().replace(/[^\w\u00C0-\u024F ]/g,' ').split(/\s+/).filter(w=>w.length>=3)}
function cariKB(q, had=6, kategori=''){
  const toks=tokenkan(q); if(!toks.length) return [];
  const semua=[...KB, ...DOK_ADMIN.filter(d=>!d.tajuk.startsWith('__')).map(d=>({s:d.tajuk,k:d.kategori,t:d.tingkatan,c:d.kandungan}))];
  const skor=[];
  for(const ch of semua){
    if(kategori && ch.k!==kategori) continue;
    const teks=ch.c.toLowerCase(); let s=0;
    for(const t of toks){let i=-1,n=0;while((i=teks.indexOf(t,i+1))!==-1&&n<8)n++;s+=n*(t.length>=5?2:1)}
    if(s>0) skor.push([s,ch]);
  }
  return skor.sort((a,b)=>b[0]-a[0]).slice(0,had).map(x=>x[1]);
}

/* ---------- rujukan SP-BT-KAMPOI ---------- */
function rujukanUntuk(kodSKatauSP){
  const sk=kodSKatauSP.split('.').slice(0,2).join('.');
  const p=RUJ.peta[sk]; if(!p) return '';
  const kampoi=p.kampoi.replace('Modul KAMPOI:',`Modul KAMPOI ${RUJ.versi_kampoi}:`);
  return `${p.bt}${p.ms?' ('+p.ms+')':''}; ${kampoi}`;
}
const ARAHAN_RUJUKAN=`PERATURAN RUJUKAN (WAJIB): DSKP ialah dokumen induk — sentiasa nyatakan kod Standard Pembelajaran (SP) DSKP yang tepat. Nombor topik buku teks TIDAK sama dengan nombor SP DSKP — jangan keliru antara keduanya. Apabila merujuk buku teks atau Modul KAMPOI, guna HANYA maklumat bab/topik/muka surat yang diberikan dalam JADUAL RUJUKAN di bawah. JANGAN SEKALI-KALI mereka-reka nombor muka surat yang tidak diberikan.`;

/* ---------- Gemini (2 mod) ---------- */
function modAPI(){return ls.getItem('apiMode')||'percuma'}
function kuotaHarian(){
  const hariIni=new Date().toISOString().slice(0,10);
  let k=JSON.parse(ls.getItem('kuota')||'{}');
  if(k.hari!==hariIni)k={hari:hariIni,guna:0};
  return k;
}
async function gemini(sistem, pengguna, sejarah=[]){
  const contents=[...sejarah, {role:'user',parts:[{text:pengguna}]}];
  const gen={temperature:0.6,maxOutputTokens:4096};
  if(modAPI()==='sendiri'){
    const kunci=ls.getItem('gemKunci');
    if(!kunci) throw new Error('TIADA_KUNCI');
    const model=ls.getItem('gemModel')||'gemini-2.5-flash';
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${kunci}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({system_instruction:{parts:[{text:sistem}]},contents,generationConfig:gen})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error?.message||'Ralat API Gemini');
    return j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'(tiada jawapan)';
  }
  // Versi Percuma
  const k=kuotaHarian();
  if(k.guna>=15) throw new Error('HAD_HARIAN');
  const r=await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sistem,contents,generationConfig:gen})});
  const j=await r.json();
  if(!r.ok){
    if(j.error==='BELUM_AKTIF') throw new Error('BELUM_AKTIF');
    throw new Error(j.error?.message||j.error||'Ralat pelayan AI');
  }
  k.guna++;ls.setItem('kuota',JSON.stringify(k));
  return j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'(tiada jawapan)';
}
const SISTEM_ASAS=`Anda ialah pakar kandungan mata pelajaran Perniagaan KSSM (MPEI) Tingkatan 4 & 5 Malaysia dan pakar pembinaan item peperiksaan SPM. Jawab dalam Bahasa Melayu baku sepenuhnya. Rujuk KONTEKS yang diberikan sebagai sumber utama (DSKP, buku teks, modul KAMPOI). Jika konteks tidak mencukupi, guna pengetahuan kurikulum Malaysia dengan berhati-hati dan nyatakan. Gunakan istilah rasmi DSKP. ${ARAHAN_RUJUKAN}`;
function paparRalatAI(el,e){
  const mesej={
    'TIADA_KUNCI':'Mod <strong>API Sendiri</strong> perlukan kunci Gemini anda — pergi ke <strong>Lagi → Tetapan AI</strong> (2 minit, sekali sahaja).',
    'HAD_HARIAN':'Had Versi Percuma hari ini (15 janaan) telah dicapai. Tukar ke <strong>Versi API Sendiri</strong> di Lagi → Tetapan AI untuk penggunaan tanpa had — percuma juga.',
    'BELUM_AKTIF':'Versi Percuma belum diaktifkan oleh penyelaras. Buat sementara, guna <strong>Versi API Sendiri</strong> di Lagi → Tetapan AI.'
  };
  el.innerHTML=`<div class="hasil-kad">${mesej[e.message]||'Ralat: '+esc(e.message)}</div>`;
}

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
    [KB,SP,RUJ]=await Promise.all([
      fetch('data/kb.json').then(r=>r.json()),
      fetch('data/sp.json').then(r=>r.json()),
      fetch('data/rujukan.json').then(r=>r.json())
    ]);
  }catch(e){console.error('KB gagal dimuat',e)}
  try{
    const r=await fetch(`${SB_URL}/rest/v1/kb_dokumen?select=id,tajuk,kategori,tingkatan,kandungan&aktif=eq.true`,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
    if(r.ok){DOK_ADMIN=await r.json();ls.setItem('dokAdmin',JSON.stringify(DOK_ADMIN))}
  }catch(e){DOK_ADMIN=JSON.parse(ls.getItem('dokAdmin')||'[]')}
  // gunakan override admin: versi KAMPOI & jadual rujukan ms
  const vDoc=DOK_ADMIN.find(d=>d.tajuk==='__KAMPOI_VERSI__');
  if(vDoc) RUJ.versi_kampoi=vDoc.kandungan.trim();
  const rDoc=DOK_ADMIN.find(d=>d.tajuk==='__RUJUKAN__');
  if(rDoc) rDoc.kandungan.split('\n').forEach(b=>{
    const p=b.split('|').map(x=>x.trim());
    if(p.length>=2 && RUJ.peta[p[0]]){RUJ.peta[p[0]].ms='';RUJ.peta[p[0]].bt=p[1]||RUJ.peta[p[0]].bt;if(p[2])RUJ.peta[p[0]].kampoi='Modul KAMPOI: '+p[2]}
  });
  isiSP();
}
function isiSP(){
  const sel=$('sSP'), ting=$('sTing');
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
    const jadualRuj=Object.entries(RUJ.peta).map(([k,p])=>`SK ${k}: ${rujukanUntuk(k)}`).join('\n');
    const jawapan=await gemini(SISTEM_ASAS, `JADUAL RUJUKAN:\n${jadualRuj}\n\nKONTEKS:\n${konteks}\n\nSOALAN GURU:\n${teks}`, sejarahChat.slice(-6));
    sejarahChat.push({role:'user',parts:[{text:teks}]},{role:'model',parts:[{text:jawapan}]});
    bA.classList.remove('memuat');bA.innerHTML=mdRingkas(jawapan);
  }catch(e){
    bA.classList.remove('memuat');
    paparRalatAI(bA,e);bA.innerHTML=bA.querySelector('.hasil-kad')?.innerHTML||bA.innerHTML;
  }
  bA.scrollIntoView({behavior:'smooth'});
}
$('btnHantar').onclick=()=>hantarChat($('chatTeks').value);
$('chatTeks').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();hantarChat(e.target.value)}});
document.querySelectorAll('.cadang').forEach(b=>b.onclick=()=>hantarChat(b.dataset.q));

/* ---------- JANA SOALAN (K1 / K2 A,B,C) ---------- */
const FORMAT_KERTAS={
 K1:`FORMAT KERTAS 1 (Objektif): setiap soalan aneka pilihan dengan 4 pilihan A, B, C, D; SATU jawapan tepat sahaja; pilihan pengganggu munasabah; ikut gaya soalan SPM Perniagaan sebenar (boleh guna stem situasi ringkas, "Antara berikut yang manakah…", penyataan I,II,III,IV bila sesuai).`,
 K2A:`FORMAT KERTAS 2 BAHAGIAN A (Struktur): setiap soalan berpecahan seperti (a), (b), atau (a)(i)(ii) — 2 hingga 3 pecahan sesoalan; markah kecil setiap pecahan antara 2-6 markah; jumlah satu soalan sekitar 8-10 markah; kata tugas tepat (nyatakan/senaraikan/terangkan/jelaskan/bezakan); boleh sertakan stimulus ringkas (situasi 1-2 ayat, senarai, atau jadual mudah).`,
 K2B:`FORMAT KERTAS 2 BAHAGIAN B (Situasi & aplikasi): setiap soalan WAJIB bermula dengan stimulus situasi perniagaan sebenar (3-5 ayat, syarikat rekaan Malaysia) ATAU data kewangan/jadual; pecahan (a)(b)(c); sertakan elemen pengiraan jika SP berkaitan (TPM, nisbah asas, penyata) dengan data lengkap yang boleh dikira; jumlah sekitar 10-12 markah sesoalan; aras aplikasi/analisis.`,
 K2C:`FORMAT KERTAS 2 BAHAGIAN C (Kajian kes/esei): satu kes perniagaan terperinci (satu perenggan 5-8 ayat, syarikat rekaan Malaysia dengan situasi/masalah realistik); pecahan (a)(b) menuntut analisis, penilaian, cadangan dan justifikasi; jumlah 15-20 markah; aras KBAT tinggi (menganalisis/menilai/mencipta).`
};
$('btnJanaSoalan').onclick=async()=>{
  const sp=spPilihan($('sSP').value); if(!sp)return;
  const hasil=$('soalanHasil');hasil.innerHTML='<div class="memuat">Menjana soalan…</div>';
  const kertas=$('sKertas').value;
  const aras={campuran:'Campuran aras kesukaran ikut nisbah JSU R:S:T = 5:3:2 (rendah:sederhana:tinggi)',rendah:'Aras rendah (mengingat/memahami)',sederhana:'Aras sederhana (mengaplikasi)',tinggi:'Aras tinggi (menganalisis/menilai/mencipta)'}[$('sAras').value];
  const konteks=cariKB(sp.tajuk+' '+sp.h,5).map(c=>`[${c.s}] ${c.c}`).join('\n---\n');
  const arahan=`Bina ${$('sBil').value} soalan peperiksaan SPM Perniagaan.
${FORMAT_KERTAS[kertas]}
Tingkatan: ${$('sTing').value}
Standard Pembelajaran (DSKP): ${sp.sp} — ${sp.h} (SK ${sp.sk}: ${sp.tajuk})
Aras: ${aras}
${$('sSkema').checked?`Selepas SETIAP soalan, sediakan skema jawapan gaya peraturan pemarkahan SPM: label F1,F2 (fakta), H1,H2 (huraian), C (contoh) dengan agihan markah jelas, dan jalan kira penuh jika ada pengiraan. Akhiri skema setiap soalan dengan baris "Rujukan: SP ${sp.sp} | ${rujukanUntuk(sp.sp)||'—'}".`:'Tanpa skema jawapan.'}
JADUAL RUJUKAN: SK ${sp.sk}: ${rujukanUntuk(sp.sp)||'tiada'}
Konteks rujukan:\n${konteks}`;
  try{
    const t=await gemini(SISTEM_ASAS,arahan);
    hasil.innerHTML=`<div class="hasil-kad"><div class="jana-teks">${mdRingkas(t)}</div><div class="hasil-alat"><button data-t="">📋 Salin</button></div></div>`;
    hasil.querySelector('[data-t]').onclick=e=>salin(t,e.target);
  }catch(e){paparRalatAI(hasil,e)}
};

/* ---------- ANALISIS ---------- */
let dataAnalisis=null, carta1=null, carta2=null, rekodSemasa=null;
document.querySelectorAll('#aTab .cip').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#aTab .cip').forEach(x=>x.classList.toggle('aktif',x===b));
  $('aPanelUpload').classList.toggle('tersembunyi',b.dataset.tab!=='upload');
  $('aPanelTampal').classList.toggle('tersembunyi',b.dataset.tab!=='tampal');
});
function gred(m){return m>=90?'A+':m>=80?'A':m>=75?'A-':m>=70?'B+':m>=65?'B':m>=60?'C+':m>=50?'C':m>=45?'D':m>=40?'E':'G'}
function kesanRekod(baris2D){
  // baris2D: array of array. Kesan lajur nama (teks) & markah (nombor 0-100)
  const rekod=[];
  for(const b of baris2D){
    if(!b||!b.length)continue;
    let nama='',markah=null;
    for(const sel of b){
      const v=(sel??'').toString().trim(); if(!v)continue;
      const n=parseFloat(v.replace('%',''));
      if(!isNaN(n)&&n>=0&&n<=100&&/^\d+(\.\d+)?%?$/.test(v)){if(markah===null)markah=n}
      else if(!nama&&isNaN(n))nama=v;
    }
    if(markah!==null)rekod.push({nama,m:markah});
  }
  return rekod;
}
async function bacaFail(f){
  const ext=f.name.split('.').pop().toLowerCase();
  if(ext==='csv'||ext==='txt'){
    const t=await f.text();
    return kesanRekod(t.split('\n').map(b=>b.split(/[,\t;]/)));
  }
  if(ext==='xlsx'||ext==='xls'){
    await skripLuar('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb=XLSX.read(await f.arrayBuffer());
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true});
    return kesanRekod(rows);
  }
  if(ext==='docx'){
    await skripLuar('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js');
    const h=await mammoth.convertToHtml({arrayBuffer:await f.arrayBuffer()});
    const div=document.createElement('div');div.innerHTML=h.value;
    const baris=[...div.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td,th')].map(td=>td.textContent));
    if(baris.length) return kesanRekod(baris);
    return kesanRekod(div.textContent.split('\n').map(b=>b.split(/[,\t;]/)));
  }
  throw new Error('Format fail tidak disokong. Guna .xlsx, .csv, atau .docx');
}
$('aFail').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f)return;
  $('aPratonton').innerHTML='<div class="memuat">Membaca fail…</div>';
  try{
    rekodSemasa=await bacaFail(f);
    if(!rekodSemasa.length){$('aPratonton').innerHTML='<div class="hasil-kad ralat">Tiada markah dikesan dalam fail. Pastikan ada lajur markah bernombor 0–100.</div>';return}
    const s=rekodSemasa.slice(0,5).map(r=>`<tr><td>${esc(r.nama||'—')}</td><td>${r.m}</td><td>${gred(r.m)}</td></tr>`).join('');
    $('aPratonton').innerHTML=`<div class="hasil-kad"><strong>Pratonton — ${rekodSemasa.length} murid dikesan</strong><table class="jadual-pra"><tr><th>Nama</th><th>Markah</th><th>Gred</th></tr>${s}</table>${rekodSemasa.length>5?`<p class="nota-view">…dan ${rekodSemasa.length-5} lagi. Jika betul, tekan Analisis.</p>`:''}</div>`;
  }catch(err){$('aPratonton').innerHTML=`<div class="hasil-kad ralat">${esc(err.message)}</div>`}
});
$('btnAnalisis').onclick=()=>{
  let rekod;
  if(!$('aPanelTampal').classList.contains('tersembunyi')){
    rekod=kesanRekod($('aData').value.split('\n').map(b=>b.split(/[,\t;]/)));
  }else rekod=rekodSemasa;
  if(!rekod||!rekod.length){$('analisisHasil').innerHTML='<div class="hasil-kad ralat">Tiada markah — muat naik fail atau tampal markah dahulu.</div>';return}
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
Kualiti (A- ke atas): ${gredKira['A+']+gredKira['A']+gredKira['A-']}/${n}
Galus 30–44: ${rekod.filter(r=>r.m>=30&&r.m<=44).length} murid</div></div>`;
  lukisCarta();
  $('btnUlasAI').classList.remove('tersembunyi');$('ulasanHasil').innerHTML='';
};
function lukisCarta(){
  if(!window.Chart){skripLuar('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js').then(lukisCarta).catch(()=>{});return}
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
  $('ulasanHasil').innerHTML='<div class="memuat">Menyediakan laporan intervensi…</div>';
  const senarai=d.rekod.map(r=>`${r.nama||'(tanpa nama)'}: ${r.m}`).join('; ');
  const jadualRuj=Object.entries(RUJ.peta).map(([k,p])=>`SK ${k}: ${rujukanUntuk(k)}`).join('\n');
  try{
    const t=await gemini(SISTEM_ASAS,`Sediakan LAPORAN ANALISIS & INTERVENSI untuk guru Perniagaan.
${$('aNamaUjian').value?'Ujian: '+$('aNamaUjian').value:''}
${$('aTajuk').value?'Tajuk/SP yang diuji: '+$('aTajuk').value:''}
Statistik: ${d.n} murid, purata ${d.purata.toFixed(1)}, median ${d.median.toFixed(1)}, sisihan ${d.sisih.toFixed(1)}, lulus ${d.lulus}/${d.n}, gred ${JSON.stringify(d.gredKira)}.
Markah penuh: ${senarai}

JADUAL RUJUKAN:\n${jadualRuj}

Format laporan (guna tajuk bernombor):
1. RUMUSAN PRESTASI — tafsiran ringkas & objektif keseluruhan kelas.
2. KUMPULAN TINDAKAN — senaraikan NAMA murid mengikut kumpulan: Cemerlang (75+), Sederhana (50-74), Galus (40-49), Kritikal (<40). Jika tiada nama diberikan, guna bilangan sahaja.
3. INTERVENSI SETIAP KUMPULAN — cadangan konkrit & boleh laksana, kaitkan dengan strategi PdP DSKP (kolaboratif, masteri, inkuiri dll) dan Tahap Penguasaan.
4. FOKUS TAJUK — ${$('aTajuk').value?'berdasarkan tajuk/SP diuji, nyatakan SP tepat yang perlu diulang kaji dan rujukan bab buku teks & KAMPOI daripada JADUAL RUJUKAN sahaja':'cadangkan cara guru mengenal pasti tajuk lemah (analisis item)'}. 
5. TINDAKAN SUSULAN PANITIA — headcount, kelas fokus, sasaran gred.
Ringkas, praktikal, terus boleh guna dalam mesyuarat panitia.`);
    $('ulasanHasil').innerHTML=`<div class="hasil-kad"><div class="jana-teks">${mdRingkas(t)}</div><div class="hasil-alat"><button data-t="">📋 Salin</button></div></div>`;
    $('ulasanHasil').querySelector('[data-t]').onclick=e=>salin(t,e.target);
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

/* ---------- Tetapan AI ---------- */
document.querySelectorAll('input[name=mod]').forEach(r=>{
  r.checked=(modAPI()===r.value);
  r.onchange=()=>{ls.setItem('apiMode',r.value);$('modSendiri').classList.toggle('tersembunyi',r.value!=='sendiri')};
});
$('modSendiri').classList.toggle('tersembunyi',modAPI()!=='sendiri');
$('tKunci').value=ls.getItem('gemKunci')||'';
$('tModel').value=ls.getItem('gemModel')||'gemini-2.5-flash';
$('btnSimpanKunci').onclick=async()=>{
  ls.setItem('gemKunci',$('tKunci').value.trim());ls.setItem('gemModel',$('tModel').value);
  $('tStatus').textContent='Menguji…';
  try{await gemini('Jawab satu perkataan sahaja.','Sebut "sedia"');$('tStatus').textContent=modAPI()==='percuma'?'✅ Versi Percuma berfungsi! (baki kuota hari ini: '+(15-kuotaHarian().guna)+')':'✅ Kunci berfungsi! Penggunaan tanpa had aktif.'}
  catch(e){const p=document.createElement('div');paparRalatAI(p,e);$('tStatus').innerHTML=p.textContent}
};

/* ---------- Admin ---------- */
let adminPw='';
$('btnAdminMasuk').onclick=async()=>{
  const pw=$('adminPw').value;$('adminRalat').textContent='';
  try{
    if(await rpc('kb_admin_login',{pw})===true){adminPw=pw;$('adminLogin').classList.add('tersembunyi');$('adminPanel').classList.remove('tersembunyi');paparAdminDok();
      $('kampoiVersi').value=RUJ.versi_kampoi;
      $('rujukanTeks').value=(DOK_ADMIN.find(d=>d.tajuk==='__RUJUKAN__')||{}).kandungan||'';
    } else $('adminRalat').textContent='Kata laluan salah.';
  }catch(e){$('adminRalat').textContent='Ralat sambungan.'}
};
async function simpanDokKhas(tajuk,kandungan){
  const sedia=DOK_ADMIN.find(d=>d.tajuk===tajuk);
  await rpc('kb_admin_simpan',{pw:adminPw,p_id:sedia?.id||null,p_tajuk:tajuk,p_kategori:'rujukan',p_tingkatan:'45',p_kandungan:kandungan,p_aktif:true});
}
$('btnKampoiSimpan').onclick=async()=>{
  try{await simpanDokKhas('__KAMPOI_VERSI__',$('kampoiVersi').value.trim());$('adminStatus').textContent='✅ Versi KAMPOI disimpan. Muat semula app untuk berkuat kuasa.'}
  catch(e){$('adminStatus').textContent='❌ '+e.message}
};
$('btnRujukanSimpan').onclick=async()=>{
  try{await simpanDokKhas('__RUJUKAN__',$('rujukanTeks').value);$('adminStatus').textContent='✅ Jadual rujukan disimpan. Muat semula app untuk berkuat kuasa.'}
  catch(e){$('adminStatus').textContent='❌ '+e.message}
};
async function paparAdminDok(){
  try{
    const r=await fetch(`${SB_URL}/rest/v1/kb_dokumen?select=id,tajuk,kategori,tingkatan,aktif&order=kemaskini_pada.desc`,{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
    const dok=(await r.json()).filter(d=>!d.tajuk.startsWith('__'));
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
