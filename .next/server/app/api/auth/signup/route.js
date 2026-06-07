"use strict";(()=>{var e={};e.id=654,e.ids=[654],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},4737:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>y,requestAsyncStorage:()=>m,routeModule:()=>d,serverHooks:()=>h,staticGenerationAsyncStorage:()=>_});var a={};r.r(a),r.d(a,{POST:()=>p,dynamic:()=>l});var s=r(9303),n=r(8716),o=r(670),i=r(7070),u=r(728),c=r(5456);let l="force-dynamic";async function p(e){try{let t;try{t=await e.json()}catch(e){return i.NextResponse.json({ok:!1,error:"invalid_input"},{status:400})}let{name:r,email:a,password:s}=t;if(!r||!a||!s||s.length<8)return i.NextResponse.json({ok:!1,error:"invalid_input"},{status:400});let n=a.toLowerCase().trim(),o=await (0,c.c_)(s);try{if((await u._.$queryRaw`
        SELECT id::text, email, display_name, password_hash
        FROM users_profile
        WHERE lower(email) = lower(${n})
        LIMIT 1;
      `).length>0)return i.NextResponse.json({ok:!1,error:"email_already_exists"},{status:409});let e=(await u._.$queryRaw`
        INSERT INTO users_profile (
          id,
          "userId",
          email,
          "displayName",
          password_hash,
          auth_provider,
          display_name,
          user_id,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${n},
          ${n},
          ${r},
          ${o},
          'email',
          ${r},
          gen_random_uuid(),
          now(),
          now()
        )
        RETURNING id::text, email, display_name;
      `)[0];if(!e||!e.id)throw Error("Failed to retrieve new user ID after insert");return await (0,c.ed)(e.id),i.NextResponse.json({ok:!0,user:{id:e.id,email:e.email,display_name:e.display_name}})}catch(e){return console.error("[SIGNUP] Database error:",e.message,e.code),i.NextResponse.json({ok:!1,error:"auth_database_error",code:e.code,message:e.message||"Authentication is temporarily unavailable."},{status:500})}}catch(e){return console.error("[SIGNUP] Exception:",e),i.NextResponse.json({ok:!1,error:"auth_database_error",message:"Authentication is temporarily unavailable."},{status:500})}}let d=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/auth/signup/route",pathname:"/api/auth/signup",filename:"route",bundlePath:"app/api/auth/signup/route"},resolvedPagePath:"C:\\Users\\kevin\\reelassati-recovery\\app\\api\\auth\\signup\\route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:m,staticGenerationAsyncStorage:_,serverHooks:h}=d,E="/api/auth/signup/route";function y(){return(0,o.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:_})}},5456:(e,t,r)=>{r.d(t,{Gg:()=>m,Oe:()=>c,SO:()=>_,c_:()=>u,ed:()=>d});var a=r(322),s=r(8391),n=r(1615),o=r(8691);function i(){let e=process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET;return e?new TextEncoder().encode(e):new TextEncoder().encode("emergency-fallback-secret-do-not-use-in-production")}async function u(e){return o.ZP.hash(e,10)}async function c(e,t){try{return await o.ZP.compare(e,t)}catch(e){return console.error("Bcrypt compare failed:",e),!1}}async function l(e){if(!(process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET))throw console.error("AUTH_SECRET or INTERNAL_AGENT_SECRET is not configured."),Error("auth_not_configured");return await new a.N(e).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(i())}async function p(e){if(!(process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET))return null;try{let{payload:t}=await (0,s._)(e,i(),{algorithms:["HS256"]});return t}catch(e){return null}}async function d(e){let t=new Date(Date.now()+6048e5),r=await l({userId:e,expires:t});(0,n.cookies)().set("reelassati_session",r,{httpOnly:!0,secure:!0,sameSite:"lax",path:"/",expires:t})}async function m(){let e=n.cookies().get("reelassati_session")?.value;return e?await p(e):null}function _(){(0,n.cookies)().set("reelassati_session","",{httpOnly:!0,secure:!0,sameSite:"lax",path:"/",expires:new Date(0)})}},728:(e,t,r)=>{r.d(t,{_:()=>o});let a=require("@prisma/client"),s=global,n=()=>(s.prisma||(s.prisma=new a.PrismaClient({log:["error"]})),s.prisma),o=new Proxy({},{get:(e,t)=>n()[t]})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[948,972,289,120],()=>r(4737));module.exports=a})();