"use strict";(()=>{var e={};e.id=374,e.ids=[374],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},6113:e=>{e.exports=require("crypto")},1017:e=>{e.exports=require("path")},2911:(e,a,t)=>{t.r(a),t.d(a,{originalPathname:()=>T,patchFetch:()=>w,requestAsyncStorage:()=>C,routeModule:()=>v,serverHooks:()=>y,staticGenerationAsyncStorage:()=>S});var r={};t.r(r),t.d(r,{GET:()=>b,dynamic:()=>E,revalidate:()=>h,runtime:()=>f});var s=t(9303),n=t(8716),o=t(670),i=t(7070),u=t(728),l=t(8691),c=t(322);let p=require("fs");var d=t.n(p),m=t(1017),_=t.n(m),g=t(6113);let E="force-dynamic",h=0,f="nodejs";function R(e){if(!e)return"none";let a=(0,g.createHash)("sha256").update(e).digest("hex");return`sha256:${a.slice(-8)}`}async function b(){let e={ok:!0,debugVersion:"schema-debug-v3-live-check-force-redeployment-1",databaseConnected:!1,runtime:"undefined"!=typeof process?`Node ${process.version}`:"Unknown",nodeEnv:"production",vercelEnv:process.env.VERCEL_ENV,vercelGitCommitSha:process.env.VERCEL_GIT_COMMIT_SHA,vercelGitCommitRef:process.env.VERCEL_GIT_COMMIT_REF,databaseUrlConfigured:!!process.env.DATABASE_URL,postgresUrlConfigured:!!process.env.POSTGRES_URL,databaseUrlFingerprint:R(process.env.DATABASE_URL),postgresUrlFingerprint:R(process.env.POSTGRES_URL),currentDatabase:null,currentSchema:null,currentUser:null,usersProfileRegclass:null,usersProfileColumnsOrdered:[],notNullColumns:[],constraints:[],triggers:[],rules:[],viewsOrTablesNamedUsersProfile:[],authRoutesDetected:{signup:d().existsSync(_().join(process.cwd(),"app/api/auth/signup/route.ts")),login:d().existsSync(_().join(process.cwd(),"app/api/auth/login/route.ts")),logout:d().existsSync(_().join(process.cwd(),"app/api/auth/logout/route.ts")),me:d().existsSync(_().join(process.cwd(),"app/api/auth/me/route.ts"))},authSecretConfigured:!!process.env.AUTH_SECRET,internalAgentSecretConfigured:!!process.env.INTERNAL_AGENT_SECRET,sessionSecretConfigured:!!(process.env.AUTH_SECRET||process.env.INTERNAL_AGENT_SECRET),bcryptAvailable:"function"==typeof l.ZP?.hash,joseAvailable:"function"==typeof c.N};try{let a=await u._.$queryRaw`SELECT 1 as connected, current_database(), current_schema(), current_user`.catch(()=>null);if(a&&a[0]?.connected===1){e.databaseConnected=!0,e.currentDatabase=a[0].current_database,e.currentSchema=a[0].current_schema,e.currentUser=a[0].current_user;let t=await u._.$queryRaw`SELECT 'public.users_profile'::regclass::text as reg`.catch(()=>null);e.usersProfileRegclass=t?t[0]?.reg:null;let r=await u._.$queryRaw`
        SELECT 
          ordinal_position as "ordinalPosition",
          column_name as "columnName", 
          is_nullable = 'YES' as "nullable", 
          column_default is not null as "hasDefault",
          column_default as "columnDefault",
          data_type as "dataType" 
        FROM information_schema.columns 
        WHERE table_name = 'users_profile'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `.catch(()=>[]);e.usersProfileColumnsOrdered=r||[],e.notNullColumns=(r||[]).filter(e=>!e.nullable).map(e=>e.columnName);let s=await u._.$queryRaw`
        SELECT
          conname AS name,
          contype AS type,
          pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = 'public.users_profile'::regclass
        ORDER BY conname
      `.catch(()=>[]);e.constraints=s||[];let n=await u._.$queryRaw`
        SELECT 
          trigger_name as "triggerName",
          event_manipulation as "eventManipulation",
          action_statement as "actionStatement"
        FROM information_schema.triggers
        WHERE event_object_table = 'users_profile'
      `.catch(()=>[]);e.triggers=n||[];let o=await u._.$queryRaw`
        SELECT 
          schemaname, tablename, rulename as "ruleName", definition
        FROM pg_rules
        WHERE tablename = 'users_profile'
      `.catch(()=>[]);e.rules=o||[];let i=await u._.$queryRaw`
        SELECT table_schema as "tableSchema", table_name as "tableName", table_type as "tableType"
        FROM information_schema.tables
        WHERE table_name = 'users_profile'
      `.catch(()=>[]);e.viewsOrTablesNamedUsersProfile=i||[]}}catch(a){e.databaseConnected=!1,e.error=a.message}return i.NextResponse.json(e,{headers:{"Cache-Control":"no-store, no-cache, must-revalidate, proxy-revalidate",Pragma:"no-cache",Expires:"0"}})}let v=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/admin/auth-debug/route",pathname:"/api/admin/auth-debug",filename:"route",bundlePath:"app/api/admin/auth-debug/route"},resolvedPagePath:"C:\\Users\\kevin\\reelassati-recovery\\app\\api\\admin\\auth-debug\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:C,staticGenerationAsyncStorage:S,serverHooks:y}=v,T="/api/admin/auth-debug/route";function w(){return(0,o.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:S})}},728:(e,a,t)=>{t.d(a,{_:()=>o});let r=require("@prisma/client"),s=global,n=()=>(s.prisma||(s.prisma=new r.PrismaClient({log:["error"]})),s.prisma),o=new Proxy({},{get:(e,a)=>n()[a]})}};var a=require("../../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[948,972,289],()=>t(2911));module.exports=r})();