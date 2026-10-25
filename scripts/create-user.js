require('dotenv').config();
const mysql=require('mysql2/promise');const bcrypt=require('bcryptjs');
(async()=>{
 const name=process.env.SEED_NAME,email=(process.env.SEED_EMAIL||'').toLowerCase(),password=process.env.SEED_PASSWORD,role=process.env.SEED_ROLE||'rw',rw=process.env.SEED_RW||'05',rt=process.env.SEED_RT||null,family=process.env.SEED_FAMILY_ID||null;
 if(!name||!email||!password||!['rw','rt','warga'].includes(role)){console.error('Set SEED_NAME, SEED_EMAIL, SEED_PASSWORD dan SEED_ROLE (rw/rt/warga).');process.exit(1);}
 if(role==='warga'&&!family){console.error('Untuk role warga, set SEED_FAMILY_ID ke ID keluarga yang sudah dibuat.');process.exit(1);}
 const db=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'rt_rw_digital'});
 try{const hash=await bcrypt.hash(password,12);await db.execute('INSERT INTO users (name,email,password_hash,role,rt_number,rw_number,family_id) VALUES (?,?,?,?,?,?,?)',[name,email,hash,role,role==='rt'?rt:null,rw,family]);console.log('Akun berhasil dibuat:',email,'role:',role);}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.end();}
})();
