import 'dotenv/config';
import express from 'express';import cors from 'cors';import helmet from 'helmet';import rateLimit from 'express-rate-limit';import path from 'path';import {fileURLToPath} from 'url';import mongoose from 'mongoose';
import docRoutes from './routes/documents.js';import signRoutes from './routes/signatures.js';import autoRoutes from './routes/automation.js';import aiRoutes from './routes/ai.js';import toolRoutes from './routes/tools.js';import shareRoutes from './routes/share.js';import teamRoutes from './routes/team.js';import formRoutes from './routes/forms.js';import advancedRoutes from './routes/advanced.js';import convertRoutes from './routes/convert.js';import commentRoutes from './routes/comments.js';import protectRoutes from './routes/protect.js';import securityRoutes from './routes/security.js';
const __dirname=path.dirname(fileURLToPath(import.meta.url));const app=express();
app.set('trust proxy', 1);
const origins=(process.env.CORS_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(',');
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors({origin:(o,cb)=>!o||origins.includes(o)?cb(null,true):cb(new Error('CORS blocked')),credentials:true}));app.use(express.json({limit:'5mb'}));app.use(rateLimit({windowMs:15*60*1000,limit:500}));
app.use('/uploads',express.static(path.join(__dirname,'uploads')));
app.get('/api/health',(req,res)=>res.json({ok:true,service:'solvane-document-os',database:mongoose.connection.readyState===1?'mongo':'memory-fallback',time:new Date().toISOString()}));
app.get('/api/capabilities',(req,res)=>res.json({
  product:'Solvane',
  engine:'document-os',
  database:mongoose.connection.readyState===1?'mongo':'memory-fallback',
  pillars:[
    {name:'PDF operations',status:'active',items:['upload','view','annotate','redact','organize pages','watermark','stamp','compress']},
    {name:'Advanced engine',status:'active',items:['text-block extraction','paragraph inference','bounded reflow overlay','table-region inspection','OCR tool detection']},
    {name:'Collaboration',status:'active',items:['comments','share links','team workspace groundwork','signature evidence']},
    {name:'Automation',status:'active',items:['document analysis','template generation','document chat fallback','RTL-ready drafts']},
    {name:'Access',status:'active',items:['free public workspace','anonymous browser workspace id','no login wall','transient uploads','metadata cleaning']},
    {name:'Safety',status:'active',items:['rate limiting','helmet headers','file type limits','preserve originals','new-version outputs']}
  ],
  standards:['free to use without accounts','preserve originals','create new PDF versions','do not fake unsupported PDF editing','backend-only provider keys','mobile-first workspace']
}));
app.use('/api/documents',docRoutes);app.use('/api/signatures',signRoutes);app.use('/api/automation',autoRoutes);app.use('/api/ai',aiRoutes);app.use('/api/tools',toolRoutes);app.use('/api/share',shareRoutes);app.use('/api/team',teamRoutes);app.use('/api/forms',formRoutes);app.use('/api/advanced',advancedRoutes);app.use('/api/convert',convertRoutes);app.use('/api/comments',commentRoutes);app.use('/api/protect',protectRoutes);app.use('/api/security',securityRoutes);
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||500).json({error:err.message||'Server error'});});
const PORT=process.env.PORT||8081;async function start(){if(process.env.MONGO_URI){try{await mongoose.connect(process.env.MONGO_URI);console.log('Mongo connected');}catch(e){console.warn('Mongo unavailable, using memory fallback:',e.message)}}else console.warn('MONGO_URI missing, using memory fallback for local dev only');app.listen(PORT,()=>console.log(`Solvane API on ${PORT}`));}start();
