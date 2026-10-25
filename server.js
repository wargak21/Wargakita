require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const PDFDocument = require('pdfkit');
const path = require('path');

const app = express();
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rt_rw_digital',
  waitForConnections: true, connectionLimit: 10, queueLimit: 0
});
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-this-secret',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8*60*60*1000 }
}));
app.use((req, res, next) => { res.locals.user = req.session.user || null; res.locals.path = req.path; next(); });

async function query(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows; }
function auth(req,res,next){ if(!req.session.user) return res.redirect('/login'); next(); }
function roles(...allowed){ return (req,res,next)=> { if(!req.session.user) return res.redirect('/login'); if(!allowed.includes(req.session.user.role)) return res.status(403).render('error',{message:'Anda tidak memiliki akses ke halaman ini.'}); next(); }; }
function scopeResidents(user, alias='r') {
  if (user.role === 'rt') return [`${alias}.family_id IN (SELECT id FROM families WHERE rt_number=? AND rw_number=?)`, [user.rt_number,user.rw_number]];
  if (user.role === 'warga') return [`${alias}.family_id=?`, [user.family_id || 0]];
  return ['1=1', []];
}
app.get('/', (req,res)=>res.redirect(req.session.user?'/dashboard':'/login'));
app.get('/login',(req,res)=>res.render('login',{error:null}));
app.post('/login',async(req,res)=>{
  try {
    const email=(req.body.email||'').trim().toLowerCase();
    const rows=await query('SELECT * FROM users WHERE email=? LIMIT 1',[email]);
    if(!rows.length || !await bcrypt.compare(req.body.password||'',rows[0].password_hash))
      return res.status(401).render('login',{error:'Email atau password tidak sesuai.'});
    const u=rows[0]; req.session.user={id:u.id,name:u.name,email:u.email,role:u.role,rt_number:u.rt_number,rw_number:u.rw_number,family_id:u.family_id};
    res.redirect('/dashboard');
  } catch(e) { console.error(e); res.status(500).render('login',{error:'Database belum siap. Pastikan konfigurasi .env dan schema.sql sudah dijalankan.'}); }
});
app.post('/logout',auth,(req,res)=>req.session.destroy(()=>res.redirect('/login')));

app.get('/dashboard',auth,async(req,res)=>{
  try {
    const u=req.session.user;
    let residentWhere='1=1', params=[];
    if(u.role==='rt'){residentWhere='f.rt_number=? AND f.rw_number=?';params=[u.rt_number,u.rw_number];}
    if(u.role==='warga'){residentWhere='r.family_id=?';params=[u.family_id||0];}
    const [totals, rtStats, familyRows, recent, settingRows] = await Promise.all([
      query(`SELECT COUNT(*) total, SUM(r.gender='Laki-laki') male, SUM(r.gender='Perempuan') female FROM residents r JOIN families f ON f.id=r.family_id WHERE r.status='Aktif' AND ${residentWhere}`,params),
      query(`SELECT f.rt_number, COUNT(r.id) total FROM families f LEFT JOIN residents r ON r.family_id=f.id AND r.status='Aktif' WHERE f.rw_number=? GROUP BY f.rt_number ORDER BY f.rt_number`,[u.rw_number]),
      u.role==='warga' ? query('SELECT * FROM families WHERE id=?',[u.family_id||0]) : query('SELECT COUNT(*) total FROM families f WHERE '+(u.role==='rt'?'f.rt_number=? AND f.rw_number=?':'f.rw_number=?'),u.role==='rt'?[u.rt_number,u.rw_number]:[u.rw_number]),
      query(`SELECT l.id,l.letter_type,l.status,l.created_at,r.name resident_name,f.rt_number FROM letters l JOIN residents r ON r.id=l.resident_id JOIN families f ON f.id=r.family_id WHERE ${u.role==='rt'?'f.rt_number=? AND f.rw_number=?':u.role==='warga'?'r.family_id=?':'f.rw_number=?'} ORDER BY l.created_at DESC LIMIT 6`,u.role==='rt'?[u.rt_number,u.rw_number]:u.role==='warga'?[u.family_id||0]:[u.rw_number]),
      query('SELECT * FROM settings WHERE id=1')
    ]);
    const rwTotal=await query("SELECT COUNT(*) total FROM residents r JOIN families f ON f.id=r.family_id WHERE f.rw_number=? AND r.status='Aktif'",[u.rw_number]);
    const rtTotal=u.role==='warga'?await query("SELECT COUNT(*) total FROM residents r JOIN families f ON f.id=r.family_id WHERE f.rt_number=(SELECT rt_number FROM families WHERE id=?) AND f.rw_number=? AND r.status='Aktif'",[u.family_id||0,u.rw_number]):[];
    res.render('dashboard',{totals:totals[0],rtStats,familyCount:u.role==='warga'?(familyRows[0]||{}).id?1:0:(familyRows[0]||{}).total||0,recent,settings:settingRows[0]||{},rwTotal:rwTotal[0].total,rtTotal:rtTotal[0]?.total||null});
  } catch(e){console.error(e);res.status(500).render('error',{message:'Gagal memuat dashboard. Pastikan database telah diinisialisasi.'});}
});

app.get('/warga',roles('rw','rt'),async(req,res)=>{
  const u=req.session.user; const where=u.role==='rt'?'f.rt_number=? AND f.rw_number=?':'f.rw_number=?';
  const params=u.role==='rt'?[u.rt_number,u.rw_number]:[u.rw_number];
  const residents=await query(`SELECT r.*,f.family_card_number,f.rt_number,f.rw_number FROM residents r JOIN families f ON f.id=r.family_id WHERE ${where} ORDER BY f.rt_number,r.name`,params);
  res.render('residents',{residents});
});
app.get('/keluarga',roles('rw','rt'),async(req,res)=>{
 const u=req.session.user; const where=u.role==='rt'?'rt_number=? AND rw_number=?':'rw_number=?';
 const params=u.role==='rt'?[u.rt_number,u.rw_number]:[u.rw_number];
 const families=await query(`SELECT f.*,COUNT(r.id) member_count FROM families f LEFT JOIN residents r ON r.family_id=f.id WHERE f.${where.replaceAll(' AND ',' AND f.').replace('rt_number','rt_number').replace('rw_number','rw_number')} GROUP BY f.id ORDER BY f.rt_number,f.head_name`,params);
 res.render('families',{families});
});
app.get('/keluarga-saya',roles('warga'),async(req,res)=>{
 const members=await query('SELECT r.*,f.family_card_number,f.address,f.rt_number,f.rw_number FROM residents r JOIN families f ON f.id=r.family_id WHERE r.family_id=? ORDER BY r.name',[req.session.user.family_id||0]);
 res.render('my-family',{members});
});

app.get('/surat',auth,async(req,res)=>{
 const u=req.session.user;
 let where='f.rw_number=?',params=[u.rw_number];
 if(u.role==='rt'){where+=' AND f.rt_number=?';params.push(u.rt_number);}
 if(u.role==='warga'){where+=' AND r.family_id=?';params.push(u.family_id||0);}
 const letters=await query(`SELECT l.*,r.name resident_name,r.nik,f.rt_number FROM letters l JOIN residents r ON r.id=l.resident_id JOIN families f ON f.id=r.family_id WHERE ${where} ORDER BY l.created_at DESC`,params);
 const residents=u.role==='warga'?await query('SELECT id,name,nik FROM residents WHERE family_id=? AND status="Aktif" ORDER BY name',[u.family_id||0]):[];
 res.render('letters',{letters,residents});
});
app.post('/surat',roles('warga'),async(req,res)=>{
 const {resident_id,letter_type,purpose,notes}=req.body;
 const allowed=await query('SELECT r.id FROM residents r WHERE r.id=? AND r.family_id=? AND r.status="Aktif"',[resident_id,req.session.user.family_id||0]);
 if(!allowed.length) return res.status(403).render('error',{message:'Warga yang dipilih bukan anggota keluarga Anda.'});
 if(!letter_type || !purpose) return res.redirect('/surat');
 await query('INSERT INTO letters (resident_id,letter_type,purpose,notes) VALUES (?,?,?,?)',[resident_id,letter_type.trim(),purpose.trim(),(notes||'').trim()||null]);
 res.redirect('/surat');
});
app.post('/surat/:id/approval',roles('rt','rw'),async(req,res)=>{
 const id=Number(req.params.id), u=req.session.user, action=req.body.action, reason=(req.body.reason||'').trim();
 const rows=await query('SELECT l.*,f.rt_number,f.rw_number FROM letters l JOIN residents r ON r.id=l.resident_id JOIN families f ON f.id=r.family_id WHERE l.id=?',[id]);
 if(!rows.length) return res.status(404).render('error',{message:'Surat tidak ditemukan.'});
 const l=rows[0];
 if(l.rw_number!==u.rw_number || (u.role==='rt' && (l.rt_number!==u.rt_number || l.status!=='Menunggu RT')) || (u.role==='rw' && l.status!=='Menunggu RW')) return res.status(403).render('error',{message:'Surat ini tidak berada dalam tahap persetujuan Anda.'});
 if(action==='reject' && !reason) return res.redirect('/surat');
 if(action==='reject'){
   const status=u.role==='rt'?'Ditolak RT':'Ditolak RW';
   await query('UPDATE letters SET status=?,rejection_reason=? WHERE id=?',[status,reason,id]);
 } else if(action==='approve' && u.role==='rt'){
   await query('UPDATE letters SET status="Menunggu RW",rt_approver=?,rt_approved_at=NOW() WHERE id=?',[u.id,id]);
 } else if(action==='approve' && u.role==='rw'){
   await query('UPDATE letters SET status="Disetujui",rw_approver=?,rw_approved_at=NOW() WHERE id=?',[u.id,id]);
 } else return res.redirect('/surat');
 res.redirect('/surat');
});

app.get('/surat/:id/download',auth,async(req,res)=>{
 const id=Number(req.params.id),u=req.session.user;
 const rows=await query(`SELECT l.*,r.name resident_name,r.nik,r.gender,f.family_card_number,f.address,f.rt_number,f.rw_number,rt.name rt_name,rw.name rw_name,s.community_name,s.chair_rt_name,s.chair_rw_name,s.rt_stamp_text,s.rw_stamp_text FROM letters l JOIN residents r ON r.id=l.resident_id JOIN families f ON f.id=r.family_id LEFT JOIN users rt ON rt.id=l.rt_approver LEFT JOIN users rw ON rw.id=l.rw_approver LEFT JOIN settings s ON s.id=1 WHERE l.id=?`,[id]);
 if(!rows.length)return res.status(404).render('error',{message:'Surat tidak ditemukan.'});
 const l=rows[0];
 if(l.status!=='Disetujui')return res.status(403).render('error',{message:'Surat hanya dapat diunduh setelah disetujui RT dan RW.'});
 if(u.role==='warga' && u.family_id!==Number((await query('SELECT family_id FROM residents WHERE id=?',[l.resident_id]))[0].family_id))return res.status(403).render('error',{message:'Akses ditolak.'});
 if(u.role==='rt' && (l.rt_number!==u.rt_number||l.rw_number!==u.rw_number))return res.status(403).render('error',{message:'Akses ditolak.'});
 if(u.rw_number!==l.rw_number)return res.status(403).render('error',{message:'Akses ditolak.'});
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="surat-pengantar-${l.id}.pdf"`);
 const doc=new PDFDocument({size:'A4',margin:55});doc.pipe(res);
 const center=(txt,y,size=11,bold=false)=>{doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).text(txt,55,y,{width:485,align:'center'});};
 center(l.community_name||'PEMERINTAH LINGKUNGAN RT/RW',55,15,true);
 center(`RT ${l.rt_number} / RW ${l.rw_number}`,78,12,true);
 doc.moveTo(55,105).lineTo(540,105).lineWidth(2).stroke();
 center('SURAT PENGANTAR',125,14,true);center(`Nomor: ${String(l.id).padStart(3,'0')}/SP/RT${l.rt_number}/RW${l.rw_number}/${new Date(l.created_at).getFullYear()}`,147,10);
 doc.font('Helvetica').fontSize(11).text('Yang bertanda tangan di bawah ini menerangkan bahwa:',70,190);
 doc.text(`Nama                 : ${l.resident_name}`,85,225).text(`NIK                    : ${l.nik}`,85,247).text(`No. Kartu Keluarga : ${l.family_card_number}`,85,269).text(`Alamat                : ${l.address}`,85,291).text(`RT/RW                : ${l.rt_number}/${l.rw_number}`,85,313);
 doc.text(`Benar bahwa yang bersangkutan mengajukan surat pengantar untuk keperluan:`,70,355,{width:465});
 doc.font('Helvetica-Bold').text(l.letter_type,85,385,{width:440});
 doc.font('Helvetica').text(l.purpose,85,410,{width:440});
 if(l.notes)doc.text(`Catatan: ${l.notes}`,85,460,{width:440});
 doc.text('Demikian surat pengantar ini dibuat untuk dipergunakan sebagaimana mestinya.',70,510,{width:465});
 const date=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
 doc.fontSize(10).text(`Tanggal persetujuan: ${date}`,70,555);
 doc.text(`RT ${l.rt_number}`,105,590,{width:130,align:'center'});doc.text(`RW ${l.rw_number}`,355,590,{width:130,align:'center'});
 doc.font('Helvetica-Bold').fontSize(9).fillColor('#0b6b3a').text(l.rt_stamp_text||'STEMPEL RT',105,625,{width:130,align:'center'}).text(l.rw_stamp_text||'STEMPEL RW',355,625,{width:130,align:'center'});
 doc.font('Helvetica').fillColor('black').fontSize(10).text(l.chair_rt_name||l.rt_name||'Ketua RT',105,665,{width:130,align:'center'}).text(l.chair_rw_name||l.rw_name||'Ketua RW',355,665,{width:130,align:'center'});
 doc.fontSize(8).fillColor('#666').text('Dokumen digital. Nama pejabat ditampilkan berdasarkan data persetujuan sistem.',55,755,{width:485,align:'center'});
 doc.end();
});

app.get('/pengaturan',roles('rw'),async(req,res)=>{const rows=await query('SELECT * FROM settings WHERE id=1');res.render('settings',{settings:rows[0]||{}});});
app.post('/pengaturan',roles('rw'),async(req,res)=>{
 const b=req.body;
 await query('UPDATE settings SET community_name=?,chair_rt_name=?,chair_rw_name=?,rt_stamp_text=?,rw_stamp_text=? WHERE id=1',[b.community_name,b.chair_rt_name||null,b.chair_rw_name||null,b.rt_stamp_text||'STEMPEL RT',b.rw_stamp_text||'STEMPEL RW']);
 res.redirect('/pengaturan');
});
app.use((req,res)=>res.status(404).render('error',{message:'Halaman tidak ditemukan.'}));
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`RT/RW Digital berjalan di http://localhost:${port}`));
