"use strict";(()=>{var e={};e.id=716,e.ids=[716],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},3124:(e,r,t)=>{t.r(r),t.d(r,{originalPathname:()=>S,patchFetch:()=>m,requestAsyncStorage:()=>d,routeModule:()=>E,serverHooks:()=>_,staticGenerationAsyncStorage:()=>T});var a={};t.r(a),t.d(a,{POST:()=>p,dynamic:()=>l});var o=t(9303),n=t(8716),s=t(670),i=t(7070),c=t(5456),u=t(6307);let l="force-dynamic";async function p(){try{return await (0,u.c)(),(0,c.SO)(),i.NextResponse.json({ok:!0})}catch(e){return console.error("Logout error:",e),i.NextResponse.json({ok:!0})}}let E=new o.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/auth/logout/route",pathname:"/api/auth/logout",filename:"route",bundlePath:"app/api/auth/logout/route"},resolvedPagePath:"C:\\Users\\kevin\\reelassati-recovery\\app\\api\\auth\\logout\\route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:d,staticGenerationAsyncStorage:T,serverHooks:_}=E,S="/api/auth/logout/route";function m(){return(0,s.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:T})}},5456:(e,r,t)=>{t.d(r,{Gg:()=>d,Oe:()=>u,SO:()=>T,c_:()=>c,ed:()=>E});var a=t(322),o=t(8391),n=t(1615),s=t(8691);function i(){let e=process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET;return e?new TextEncoder().encode(e):new TextEncoder().encode("emergency-fallback-secret-do-not-use-in-production")}async function c(e){return s.ZP.hash(e,10)}async function u(e,r){try{return await s.ZP.compare(e,r)}catch(e){return console.error("Bcrypt compare failed:",e),!1}}async function l(e){if(!(process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET))throw console.error("AUTH_SECRET or INTERNAL_AGENT_SECRET is not configured."),Error("auth_not_configured");return await new a.N(e).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(i())}async function p(e){if(!(process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET))return null;try{let{payload:r}=await (0,o._)(e,i(),{algorithms:["HS256"]});return r}catch(e){return null}}async function E(e){let r=new Date(Date.now()+6048e5),t=await l({userId:e,expires:r});(0,n.cookies)().set("reelassati_session",t,{httpOnly:!0,secure:!0,sameSite:"lax",path:"/",expires:r})}async function d(){let e=n.cookies().get("reelassati_session")?.value;return e?await p(e):null}function T(){(0,n.cookies)().set("reelassati_session","",{httpOnly:!0,secure:!0,sameSite:"lax",path:"/",expires:new Date(0)})}},6307:(e,r,t)=>{t.d(r,{c:()=>o});var a=t(728);async function o(){try{return console.log("[SCHEMA] Checking and repairing users_profile schema..."),await a._.$executeRawUnsafe(`
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
    `),console.log("[SCHEMA] users_profile schema repair completed successfully."),{ok:!0}}catch(e){return console.error("[SCHEMA] Schema repair failed:",{message:e.message,code:e.code}),{ok:!1,error:e.message,code:e.code}}}},728:(e,r,t)=>{t.d(r,{_:()=>s});let a=require("@prisma/client"),o=global,n=()=>(o.prisma||(o.prisma=new a.PrismaClient({log:["error"]})),o.prisma),s=new Proxy({},{get:(e,r)=>n()[r]})}};var r=require("../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),a=r.X(0,[948,972,289,120],()=>t(3124));module.exports=a})();