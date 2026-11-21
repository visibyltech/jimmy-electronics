import crypto from 'node:crypto';

const projectId = process.env.FIREBASE_PROJECT_ID || 'jimmy-electronics';
const certUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache: { expiresAt: number; certs: Record<string, string> } | null = null;

async function verifyToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid token');
  if (!certCache || certCache.expiresAt <= Date.now()) {
    const response = await fetch(certUrl);
    if (!response.ok) throw new Error('Token verification unavailable');
    const certs = await response.json() as Record<string, string>;
    const age = Number((response.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 300);
    certCache = { certs, expiresAt: Date.now() + age * 1000 };
  }
  const cert = certCache.certs[header.kid];
  if (!cert || !crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), cert, Buffer.from(parts[2], 'base64url'))) throw new Error('Invalid signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== 'https://securetoken.google.com/' + projectId || !payload.sub || !payload.exp || payload.exp <= now || !payload.iat || payload.iat > now) throw new Error('Expired token');
  return payload as { uid: string; email?: string };
}

function shipping({city='',state='',subtotalNgn=0,settings={}}: any) {
  const subtotal = Math.max(0, Number(subtotalNgn) || 0);
  const c = String(city).trim().toLowerCase(), st = String(state).trim().toLowerCase();
  const threshold = Number(settings.ibadanFreeShippingThresholdNgn ?? 2000000);
  const fees = { ibadan: Number(settings.ibadanStandardFeeNgn ?? 15000), lagos: Number(settings.lagosFeeNgn ?? 35000), oyo: Number(settings.oyoStateFeeNgn ?? 25000), sw: Number(settings.southWestFeeNgn ?? 45000), other: Number(settings.otherStatesFeeNgn ?? 65000) };
  const days = Number(settings.deliveryTargetDays ?? 30);
  const isIbadan = c.includes('ibadan'), isLagos = c.includes('lagos') || st === 'lagos', isOyo = st === 'oyo' || st === 'oyo state';
  const sw = ['ogun','osun','ondo','ekiti','lagos','oyo'].some(x => st.includes(x));
  if (isIbadan && subtotal > threshold) return {city,state,subtotalNgn:subtotal,freeShippingApplied:true,shippingFeeNgn:0,totalNgn:subtotal,reason:'Free Ibadan delivery unlocked.',deliveryTargetDays:days};
  const fee = isIbadan ? fees.ibadan : isLagos ? fees.lagos : isOyo ? fees.oyo : sw ? fees.sw : fees.other;
  return {city,state,subtotalNgn:subtotal,freeShippingApplied:false,shippingFeeNgn:fee,totalNgn:subtotal+fee,reason:isIbadan && subtotal===threshold ? 'Orders of exactly ₦2,000,000 do not qualify for free Ibadan shipping.' : 'Standard delivery charge.',deliveryTargetDays:days};
}

function saveToBuy({totalOrderNgn,durationMonths,rates={},depositPercent=50,startDateIso}: any) {
  const total = Math.max(0, Math.round(Number(totalOrderNgn) || 0));
  const duration = [3,6,9,12].includes(Number(durationMonths)) ? Number(durationMonths) : 3;
  const defaults: Record<number,number> = {3:0,6:12,9:18,12:24};
  const rate = Number.isFinite(Number(rates[String(duration)])) && Number(rates[String(duration)]) >= 0 ? Number(rates[String(duration)]) : defaults[duration];
  const deposit = Math.round(total * Number(depositPercent) / 100);
  const principal = Math.max(0,total-deposit);
  const interest = Math.round(principal*rate/100);
  const repayment = principal+interest;
  const base = Math.floor(repayment/duration), rem = repayment-base*duration;
  const date = startDateIso ? new Date(startDateIso) : new Date();
  const schedule = Array.from({length:duration},(_,i)=>{const due=new Date(date);due.setMonth(due.getMonth()+i+1);return {instalmentNumber:i+1,dueDateIso:due.toISOString(),amountNgn:i===duration-1?base+rem:base,lateFeeNgn:0,status:'pending'};});
  return {totalOrderNgn:total,initialDepositNgn:deposit,outstandingPrincipalNgn:principal,durationMonths:duration,interestRatePercent:rate,interestAmountNgn:interest,totalRepaymentNgn:repayment,monthlyInstalmentNgn:Math.round(repayment/duration),schedule};
}

function lateFee({instalmentAmountNgn,dueDateIso,extensionDaysGranted=0,referenceDateIso}: any) {
  const due=new Date(dueDateIso), now=referenceDateIso?new Date(referenceDateIso):new Date();
  const effective=new Date(due.getTime()+(7+Math.max(0,Number(extensionDaysGranted)||0))*86400000);
  const days=Math.max(0,Math.ceil((now.getTime()-effective.getTime())/86400000));
  const weeks=days?Math.ceil(days/7):0, percent=Math.min(5,weeks);
  const fee=Math.round(Number(instalmentAmountNgn)*percent/100);
  return {isOverdue:days>0,overdueDays:days,overdueWeeks:weeks,lateFeePercent:percent,lateFeeNgn:fee,totalDueNgn:Number(instalmentAmountNgn)+fee};
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control','no-store');
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path || '');
  if (path === 'health' && req.method === 'GET') {
    const missingCloud=['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].filter(k=>!process.env[k]);
    const missingCred=['CREDABLY_MERCHANT_ID','CREDABLY_API_KEY','CREDABLY_WEBHOOK_SECRET'].filter(k=>!process.env[k]);
    return res.status(200).json({ok:true,firebaseProjectConfigured:true,cloudinary:{configured:!missingCloud.length,missingEnv:missingCloud},credably:{configured:!missingCred.length,baseUrl:process.env.CREDABLY_BASE_URL||'https://api.credably.ng/v1',missingEnv:missingCred}});
  }
  if (path.startsWith('calculations/') && req.method === 'POST') {
    if(path==='calculations/shipping') return res.status(200).json(shipping(req.body||{}));
    if(path==='calculations/save-to-buy') return res.status(200).json(saveToBuy(req.body||{}));
    if(path==='calculations/late-fee') return res.status(200).json(lateFee(req.body||{}));
  }
  if(path==='credably/status' && req.method==='GET') {
    const missingEnv=['CREDABLY_MERCHANT_ID','CREDABLY_API_KEY','CREDABLY_WEBHOOK_SECRET'].filter(k=>!process.env[k]);
    return res.status(200).json({configured:!missingEnv.includes('CREDABLY_MERCHANT_ID')&&!missingEnv.includes('CREDABLY_API_KEY'),webhookConfigured:!missingEnv.includes('CREDABLY_WEBHOOK_SECRET'),baseUrl:process.env.CREDABLY_BASE_URL||'https://api.credably.ng/v1',missingEnv,providerWebsite:'https://credably.ng/'});
  }
  if(path==='credably/initiate' && req.method==='POST') {
    const bearer=String(req.headers.authorization||'');
    if(!bearer.startsWith('Bearer ')) return res.status(401).json({error:'Sign in to continue.'});
    try { await verifyToken(bearer.slice(7)); } catch { return res.status(401).json({error:'Your sign-in session has expired.'}); }
    const merchant=process.env.CREDABLY_MERCHANT_ID, key=process.env.CREDABLY_API_KEY;
    if(!merchant||!key) return res.status(503).json({configured:false,status:'PENDING_CREDENTIALS',message:'Credably merchant credentials are not configured.',missingEnv:['CREDABLY_MERCHANT_ID','CREDABLY_API_KEY','CREDABLY_WEBHOOK_SECRET'],onboardingUrl:'https://credably.ng/'});
    const b=req.body||{};
    if(!b.orderRef||!(Number(b.amountNgn)>0)||!b.customerEmail) return res.status(400).json({error:'Order reference, amount and customer email are required.'});
    try {
      const base=process.env.CREDABLY_BASE_URL||'https://api.credably.ng/v1';
      const response=await fetch(base+'/bnpl/applications/initialize',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Merchant-Id':merchant},body:JSON.stringify({merchantId:merchant,reference:b.orderRef,amount:b.amountNgn,currency:'NGN',customer:{name:b.customerName,email:b.customerEmail,phone:b.customerPhone},items:Array.isArray(b.items)?b.items:[],callbackUrl:process.env.APP_URL||'https://www.mj-multiconcept.com',webhookUrl:'https://www.mj-multiconcept.com/api/credably/webhook'})});
      const payload=await response.json() as any;
      if(!response.ok) return res.status(response.status).json({configured:true,status:'failed',error:payload.message||'Credably rejected the application.'});
      return res.status(200).json({configured:true,status:payload.status||'pending',credablyReference:payload.reference||payload.transactionReference||b.orderRef,checkoutUrl:payload.checkoutUrl||payload.authorizationUrl||null});
    } catch { return res.status(502).json({configured:true,status:'failed',error:'Could not reach Credably.'}); }
  }
  if(path.startsWith('credably/verify/') && req.method==='GET') {
    const bearer=String(req.headers.authorization||'');
    if(!bearer.startsWith('Bearer ')) return res.status(401).json({error:'Sign in to continue.'});
    try { await verifyToken(bearer.slice(7)); } catch { return res.status(401).json({error:'Your sign-in session has expired.'}); }
    const merchant=process.env.CREDABLY_MERCHANT_ID, key=process.env.CREDABLY_API_KEY;
    if(!merchant||!key) return res.status(503).json({configured:false,status:'PENDING_CREDENTIALS',error:'Credably merchant credentials are not configured.'});
    const reference=decodeURIComponent(path.slice('credably/verify/'.length));
    try {
      const base=process.env.CREDABLY_BASE_URL||'https://api.credably.ng/v1';
      const response=await fetch(base+'/bnpl/transactions/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+key,'X-Merchant-Id':merchant}});
      const payload=await response.json() as any;
      return res.status(response.status).json({configured:true,reference,status:payload.status||'pending',settlementStatus:payload.settlementStatus||'unsettled',error:payload.message});
    } catch { return res.status(502).json({configured:true,status:'failed',error:'Credably verification failed.'}); }
  }
  if(path==='credably/webhook' && req.method==='POST') {
    const secret=process.env.CREDABLY_WEBHOOK_SECRET;
    if(!secret) return res.status(503).json({error:'Credably webhook is not configured.'});
    const signature=String(req.headers['x-credably-signature']||'');
    const computed=crypto.createHmac('sha256',secret).update(JSON.stringify(req.body||{})).digest('hex');
    if(!signature||signature.length!==computed.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(computed))) return res.status(401).json({error:'Invalid webhook signature.'});
    return res.status(200).json({received:true,event:req.body?.event||'unknown'});
  }
  return res.status(404).json({error:'API endpoint not found.'});
}
