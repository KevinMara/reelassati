"use strict";(()=>{var e={};e.id=873,e.ids=[873],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},1515:(e,r,t)=>{t.r(r),t.d(r,{originalPathname:()=>m,patchFetch:()=>N,requestAsyncStorage:()=>_,routeModule:()=>E,serverHooks:()=>h,staticGenerationAsyncStorage:()=>T});var a={};t.r(a),t.d(a,{POST:()=>p,dynamic:()=>d});var s=t(9303),o=t(8716),n=t(670),i=t(7070),c=t(728),u=t(5456),l=t(6307);let d="force-dynamic";async function p(e){try{let r;await (0,l.c)();try{r=await e.json()}catch(e){return i.NextResponse.json({ok:!1,error:"invalid_input"},{status:400})}let{email:t,password:a}=r;if(!t||!a)return i.NextResponse.json({ok:!1,error:"invalid_credentials"},{status:401});let s=t.toLowerCase().trim();try{let e=(await c._.$queryRaw`
        SELECT id::text, email, display_name, password_hash, auth_provider
        FROM users_profile
        WHERE lower(email) = lower(${s})
        LIMIT 1;
      `)[0];if(!e||!e.password_hash||"email"!==e.auth_provider||!await (0,u.Oe)(a,e.password_hash))return i.NextResponse.json({ok:!1,error:"invalid_credentials"},{status:401});try{await (0,u.ed)(e.id)}catch(e){return console.error("Session creation failed during login:",e),i.NextResponse.json({ok:!1,error:"auth_session_error"},{status:500})}return i.NextResponse.json({ok:!0,user:{id:e.id,email:e.email,display_name:e.display_name}})}catch(e){if(console.error("Database error during login:",e),"P2022"===e.code)return i.NextResponse.json({ok:!1,error:"auth_schema_error",code:"P2022"},{status:500});return i.NextResponse.json({ok:!1,error:"auth_database_error",code:e.code||"UNKNOWN_PRISMA_ERROR"},{status:500})}}catch(e){return console.error("Login exception:",e),i.NextResponse.json({ok:!1,error:"auth_database_error"},{status:500})}}let E=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/auth/login/route",pathname:"/api/auth/login",filename:"route",bundlePath:"app/api/auth/login/route"},resolvedPagePath:"C:\\Users\\kevin\\reelassati-recovery\\app\\api\\auth\\login\\route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:_,staticGenerationAsyncStorage:T,serverHooks:h}=E,m="/api/auth/login/route";function N(){return(0,n.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:T})}},5456:(e,r,t)=>{t.d(r,{Gg:()=>E,Oe:()=>u,SO:()=>_,c_:()=>c,ed:()=>p});var a=t(322),s=t(8391),o=t(1615),n=t(8691);function i(){let e=process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET;return e?new TextEncoder().encode(e):new TextEncoder().encode("emergency-fallback-secret-do-not-use-in-production")}async function c(e){return n.ZP.hash(e,10)}async function u(e,r){try{return await n.ZP.compare(e,r)}catch(e){return console.error("Bcrypt compare failed:",e),!1}}async function l(e){if(!(process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET))throw console.error("AUTH_SECRET or INTERNAL_AGENT_SECRET is not configured."),Error("auth_not_configured");return await new a.N(e).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(i())}async function d(e){if(!(process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET))return null;try{let{payload:r}=await (0,s._)(e,i(),{algorithms:["HS256"]});return r}catch(e){return null}}async function p(e){let r=new Date(Date.now()+6048e5),t=await l({userId:e,expires:r});(0,o.cookies)().set("reelassati_session",t,{httpOnly:!0,secure:!0,sameSite:"lax",path:"/",expires:r})}async function E(){let e=o.cookies().get("reelassati_session")?.value;return e?await d(e):null}function _(){(0,o.cookies)().set("reelassati_session","",{httpOnly:!0,secure:!0,sameSite:"lax",path:"/",expires:new Date(0)})}},6307:(e,r,t)=>{t.d(r,{c:()=>s});var a=t(728);async function s(){try{return console.log("[SCHEMA] Checking and repairing users_profile schema..."),await a._.$executeRawUnsafe(`
      ALTER TABLE users_profile
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
      ADD COLUMN IF NOT EXISTS google_id TEXT,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    `),await a._.$executeRawUnsafe(`
      UPDATE users_profile
      SET
        auth_provider = COALESCE(auth_provider, 'email'),
        updated_at = COALESCE(updated_at, now()),
        created_at = COALESCE(created_at, now())
      WHERE auth_provider IS NULL OR updated_at IS NULL OR created_at IS NULL;
    `),await a._.$executeRawUnsafe(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users_profile' AND column_name = 'user_id' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users_profile ALTER COLUMN user_id DROP NOT NULL;
        END IF;
      END $$;
    `),console.log("[SCHEMA] users_profile schema repair completed successfully."),{ok:!0}}catch(e){return console.error("[SCHEMA] Schema repair failed:",{message:e.message,code:e.code}),{ok:!1,error:e.message,code:e.code}}}},728:(e,r,t)=>{t.d(r,{_:()=>n});let a=require("@prisma/client"),s=global,o=()=>(s.prisma||(s.prisma=new a.PrismaClient({log:["error"]})),s.prisma),n=new Proxy({},{get:(e,r)=>o()[r]})}};var r=require("../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),a=r.X(0,[948,972,289,120],()=>t(1515));module.exports=a})();