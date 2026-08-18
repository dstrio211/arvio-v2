import "./styles/style.css";
import "./styles/shell.css";
import "./styles/branding.css";
import "./styles/auth.css";
import "./styles/nav.css";
import "./styles/home-profile.css";
import "./styles/create.css";
import "./styles/library.css";
import "./styles/note.css";
import "./styles/share.css";
import "./styles/dialogs.css";
import "./styles/ui-system.css";
import "./styles/page-layout.css";
import "./styles/motion.css";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient.js";

const screens = {
  loading: document.querySelector("#loading-screen"),
  auth: document.querySelector("#auth-screen"),
  workspace: document.querySelector("#workspace")
};
const pages = ["home","library","profile","create","note"];
const ARVIO_MOTION={
  pageOut:120,
  pageSettle:410,
  popClose:210,
  sheetClose:300,
  libraryActionClose:330,
  libraryConfirmClose:320,
  shareClose:260,
  logoutClose:260
};
const prefersReducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
const notes = [
  {title:"Business Processes", path:"Information Systems › Week 04", date:"TODAY", body:"Business processes are collections of related activities..."},
  {title:"Week 03", path:"Database Systems", date:"TODAY", body:"Relational database systems..."},
  {title:"Avanza", path:"Toyota", date:"TODAY", body:"The Avanza has been developed with durability in mind."},
  {title:"Overview", path:"Toyota › Avanza", date:"AUGUST 16, 2026", body:"Since 2010, durability has been improved through..."},
  {title:"Assignment 02", path:"Programming", date:"AUGUST 15, 2026", body:"Application architecture and implementation notes."},
  {title:"History", path:"Toyota › Rush", date:"AUGUST 12, 2026", body:"The first generation Rush focused on practicality and durability."}
];

function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screens[name].classList.add("active");
}
const isStandalone =
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

let pendingSignupCredentials={email:"",password:""};
let authBootstrapped=false;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function setAuthMessage(stage,message="",tone="error"){
  const el=document.querySelector(`#${stage}-message`);
  if(!el) return;
  el.textContent=message;
  el.dataset.tone=tone;
}

function clearAuthMessages(){
  document.querySelectorAll(".auth-inline-message").forEach(el=>{
    el.textContent="";
    el.dataset.tone="";
  });
}

function friendlyAuthError(error,fallback="Something went wrong. Please try again."){
  const raw=(error?.message || "").toLowerCase();
  const code=(error?.code || "").toLowerCase();
  if(code.includes("email_not_confirmed") || raw.includes("email not confirmed")) return "Your email is not confirmed yet. Open the confirmation link, then try again.";
  if(code.includes("invalid_credentials") || raw.includes("invalid login credentials")) return "That email or password doesn’t match.";
  if(raw.includes("password") && raw.includes("least")) return "Use a stronger password, then try again.";
  if(raw.includes("rate limit")) return "Too many attempts. Wait a moment, then try again.";
  if(raw.includes("network") || raw.includes("fetch")) return "Arvio couldn’t reach the server. Check your connection and try again.";
  return error?.message || fallback;
}

async function getArvioProfile(userId){
  if(!supabase || !userId) return null;
  const {data,error}=await supabase
    .from("profiles")
    .select("id,email,display_name,avatar_url")
    .eq("id",userId)
    .maybeSingle();
  if(error){
    console.warn("Arvio profile lookup failed",error);
    return null;
  }
  return data || null;
}

function applyCloudIdentity(user,profile){
  const email=profile?.email || user?.email || "";
  const displayName=(profile?.display_name || user?.user_metadata?.display_name || "").trim();
  if(email) applyPrototypeEmail(email);
  if(displayName) applyPrototypeDisplayName(displayName);
}

function setAuthStageImmediately(name){
  authStages.forEach(stage=>{
    stage.classList.remove(
      "active",
      "auth-stage-exit-left",
      "auth-stage-exit-right",
      "auth-stage-enter-left",
      "auth-stage-enter-right"
    );
    stage.style.position="";
    stage.style.left="";
    stage.style.right="";
    stage.style.top="";
  });
  const target=document.querySelector(`[data-auth-stage="${name}"]`);
  if(target) target.classList.add("active");
  authCard.dataset.authStage=name;
  authTransitioning=false;
}

function splashToAuth(){
  document.body.classList.add("arvio-launching");
  screens.auth.classList.add("active","splash-auth-prep");

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    screens.auth.classList.add("splash-auth-enter");
  }));

  // Let the destination begin breathing underneath the splash first.
  setTimeout(()=>{
    screens.loading.classList.add("splash-depart","splash-depart-auth");
  },150);

  setTimeout(()=>{
    screens.loading.classList.remove("active","splash-depart","splash-depart-auth");
    screens.auth.classList.remove("splash-auth-prep","splash-auth-enter");
    document.body.classList.remove("arvio-launching");
  },820);
}

function splashToWorkspace(){
  document.body.classList.add("arvio-launching","persisted-session-launch");
  document.body.classList.remove("note-route-active","create-route-active");

  // Returning users should NOT watch the bottom nav enter again.
  // It is laid out in its final resting position underneath the splash and is
  // simply revealed together with Home as the splash fades away.
  activatePage("home");
  screens.workspace.classList.add("active","splash-workspace-prep");

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    repairMobileNavState?.({keepImpact:false});
    screens.workspace.classList.add("splash-workspace-enter");
  }));

  setTimeout(()=>{
    screens.loading.classList.add("splash-logo-release");
  },120);

  setTimeout(()=>{
    screens.loading.classList.add("splash-depart","splash-depart-home");
  },250);

  setTimeout(()=>{
    screens.loading.classList.remove(
      "active",
      "splash-depart",
      "splash-depart-home",
      "splash-logo-release"
    );
  },900);

  setTimeout(()=>{
    screens.workspace.classList.remove(
      "splash-workspace-prep",
      "splash-workspace-enter",
      "splash-nav-reveal"
    );
    document.body.classList.remove("arvio-launching","persisted-session-launch");
    repairMobileNavState?.({keepImpact:false});
  },1120);
}

async function bootstrapSupabaseAuth(){
  setAvatarAccent("David");

  const authLookup=(async()=>{
    if(!isSupabaseConfigured || !supabase) return {user:null,profile:null};
    const {data,error}=await supabase.auth.getUser();
    if(error || !data?.user) return {user:null,profile:null};
    const profile=await getArvioProfile(data.user.id);
    return {user:data.user,profile};
  })();

  const [,state]=await Promise.all([sleep(1180),authLookup]);
  authBootstrapped=true;

  if(state.user){
    applyCloudIdentity(state.user,state.profile);
    if((state.profile?.display_name || state.user?.user_metadata?.display_name || "").trim()){
      splashToWorkspace();
    }else{
      setAuthStageImmediately("nickname");
      splashToAuth();
    }
    return;
  }

  setAuthStageImmediately("welcome");
  splashToAuth();
}

bootstrapSupabaseAuth();

// Register and actively refresh the app shell over HTTP(S).
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener("load",async()=>{
    const hadController=Boolean(navigator.serviceWorker.controller);
    try{
      const registration=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
      registration.update().catch(()=>{});

      let reloading=false;
      navigator.serviceWorker.addEventListener("controllerchange",()=>{
        if(!hadController || reloading) return;
        reloading=true;
        location.reload();
      });
    }catch{}
  });
}

const arvioLogoImages=[...document.querySelectorAll('img[src$="arvio-logo.png"]')];
Promise.allSettled(arvioLogoImages.map(img=>img.decode?.() || Promise.resolve())).catch(()=>{});

const authCard=document.querySelector(".auth-card");
const authStages=[...document.querySelectorAll(".auth-stage")];
let authTransitioning=false;

function currentAuthStage(){
  return document.querySelector(".auth-stage.active");
}

function rippleAuthButton(btn){
  btn.classList.remove("auth-ripple");
  void btn.offsetWidth;
  btn.classList.add("auth-ripple");
  setTimeout(()=>btn.classList.remove("auth-ripple"),540);
}

function switchAuthStage(name,{back=false}={}){
  if(authTransitioning) return;
  clearAuthMessages();
  const current=currentAuthStage();
  const next=document.querySelector(`[data-auth-stage="${name}"]`);
  if(!next || current===next) return;

  authTransitioning=true;
  authCard.dataset.authStage=name;
  current.classList.add(back ? "auth-stage-exit-right" : "auth-stage-exit-left");

  next.classList.add(back ? "auth-stage-enter-left" : "auth-stage-enter-right");
  next.style.position="relative";
  next.style.left="auto";
  next.style.right="auto";
  next.style.top="auto";

  setTimeout(()=>{
    current.classList.remove("active","auth-stage-exit-left","auth-stage-exit-right");
    next.classList.add("active");

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        next.classList.remove("auth-stage-enter-left","auth-stage-enter-right");
      });
    });

    setTimeout(()=>{
      next.style.position="";
      next.style.left="";
      next.style.right="";
      next.style.top="";
      authTransitioning=false;

      const firstInput=next.querySelector("input");
      if(firstInput) firstInput.focus({preventScroll:true});
    },400);
  },155);
}

function launchWorkspaceFromAuth(btn,{newUser=false}={}){
  if(btn.dataset.launching==="true") return;
  btn.dataset.launching="true";
  rippleAuthButton(btn);
  btn.classList.add("is-processing","auth-entry-pressed");

  const label=btn.querySelector(".auth-submit-label") || btn;
  const original=label.textContent;
  label.style.opacity="0";

  setTimeout(()=>{
    label.textContent=newUser ? "Welcome to Arvio" : "Opening Arvio";
    // Both successful auth exits now share the same icy-blue Arvio launch state.
    btn.classList.add("is-opening-blue");
    label.style.opacity="1";
  },145);

  setTimeout(()=>{
    authCard.classList.add("auth-success-flash");
    screens.auth.classList.add("auth-exit");

    setTimeout(()=>{
      screens.auth.classList.remove("active","auth-exit");
      btn.classList.remove("is-processing","auth-entry-pressed","is-opening-blue");
      btn.dataset.launching="false";
      label.textContent=original;
      authCard.classList.remove("auth-success-flash");

      screens.workspace.classList.add("active","workspace-enter");
      activatePage("home");

      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          screens.workspace.classList.add("workspace-enter-active");
        });
      });

      setTimeout(()=>{
        screens.workspace.classList.remove("workspace-enter","workspace-enter-active");
      },720);
    },250);
  },520);
}

document.querySelector("#auth-login-start").addEventListener("click",e=>{
  const btn=e.currentTarget;
  rippleAuthButton(btn);
  btn.classList.add("auth-entry-pressed");
  setTimeout(()=>{
    btn.classList.remove("auth-entry-pressed");
    switchAuthStage("login");
  },210);
});

document.querySelector("#auth-signup-start").addEventListener("click",e=>{
  const btn=e.currentTarget;
  rippleAuthButton(btn);
  btn.classList.add("auth-entry-pressed");
  setTimeout(()=>{
    btn.classList.remove("auth-entry-pressed");
    switchAuthStage("signup");
  },210);
});

document.querySelectorAll("[data-auth-back]").forEach(btn=>{
  btn.addEventListener("click",()=>switchAuthStage(btn.dataset.authBack,{back:true}));
});

document.querySelector("#login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=document.querySelector("#login-submit");
  if(btn.dataset.loggingIn==="true") return;
  clearAuthMessages();

  if(!isSupabaseConfigured || !supabase){
    setAuthMessage("login","Supabase is not configured for this deployment.");
    return;
  }

  const email=document.querySelector("#login-email").value.trim();
  const password=document.querySelector("#login-password").value;
  const label=btn.querySelector(".auth-submit-label");
  const original=label.textContent;

  btn.dataset.loggingIn="true";
  btn.disabled=true;
  rippleAuthButton(btn);
  btn.classList.add("is-processing");
  label.textContent="Logging in";

  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error || !data?.user){
    btn.classList.remove("is-processing");
    btn.disabled=false;
    btn.dataset.loggingIn="false";
    label.textContent=original;
    setAuthMessage("login",friendlyAuthError(error));
    return;
  }

  const profile=await getArvioProfile(data.user.id);
  applyCloudIdentity(data.user,profile);
  btn.classList.remove("is-processing");
  btn.disabled=false;
  btn.dataset.loggingIn="false";
  label.textContent=original;

  if(!(profile?.display_name || data.user?.user_metadata?.display_name || "").trim()){
    switchAuthStage("nickname");
    return;
  }

  launchWorkspaceFromAuth(btn);
});

document.querySelector("#signup-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=document.querySelector("#signup-submit");
  if(btn.dataset.creating==="true") return;
  clearAuthMessages();

  if(!isSupabaseConfigured || !supabase){
    setAuthMessage("signup","Supabase is not configured for this deployment.");
    return;
  }

  const email=document.querySelector("#signup-email").value.trim();
  const password=document.querySelector("#signup-password").value;
  const label=btn.querySelector(".auth-submit-label");

  btn.dataset.creating="true";
  btn.disabled=true;
  rippleAuthButton(btn);
  btn.classList.add("is-processing");
  label.classList.add("copy-transition");
  setTimeout(()=>{
    label.textContent="Creating account";
    label.classList.remove("copy-transition");
  },120);

  const {data,error}=await supabase.auth.signUp({
    email,
    password,
    options:{
      emailRedirectTo:`${window.location.origin}/`
    }
  });

  btn.classList.remove("is-processing");
  btn.disabled=false;
  btn.dataset.creating="false";
  label.textContent="Create account";

  if(error){
    setAuthMessage("signup",friendlyAuthError(error));
    return;
  }

  pendingSignupCredentials={email,password};
  document.querySelector("#confirm-email-copy").textContent=email;
  applyPrototypeEmail(email);

  if(data?.session && data?.user){
    const profile=await getArvioProfile(data.user.id);
    applyCloudIdentity(data.user,profile);
    switchAuthStage("nickname");
    return;
  }

  switchAuthStage("confirm");
});

const confirmEmailButton=document.querySelector("#simulate-confirm");
const confirmDifferentEmail=document.querySelector('[data-auth-stage="confirm"] [data-auth-back="signup"]');

confirmEmailButton.addEventListener("click",async e=>{
  const btn=e.currentTarget;
  if(btn.dataset.confirming==="true") return;
  clearAuthMessages();

  if(!isSupabaseConfigured || !supabase){
    setAuthMessage("confirm","Supabase is not configured for this deployment.");
    return;
  }

  const email=pendingSignupCredentials.email || document.querySelector("#signup-email").value.trim();
  const password=pendingSignupCredentials.password || document.querySelector("#signup-password").value;
  if(!email || !password){
    setAuthMessage("confirm","Return to Create account and enter your email and password again.");
    return;
  }

  btn.dataset.confirming="true";
  btn.disabled=true;
  if(confirmDifferentEmail) confirmDifferentEmail.disabled=true;

  rippleAuthButton(btn);
  btn.classList.remove("is-confirmed");
  btn.classList.add("is-processing");
  const label=btn.querySelector(".auth-submit-label");
  label.classList.add("copy-transition");
  setTimeout(()=>{
    label.textContent="Checking email";
    label.classList.remove("copy-transition");
  },120);

  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error || !data?.user){
    btn.classList.remove("is-processing","is-confirmed");
    btn.disabled=false;
    btn.dataset.confirming="false";
    if(confirmDifferentEmail) confirmDifferentEmail.disabled=false;
    label.textContent="I’ve confirmed my email";
    setAuthMessage("confirm",friendlyAuthError(error));
    return;
  }

  const profile=await getArvioProfile(data.user.id);
  applyCloudIdentity(data.user,profile);
  label.textContent="Email confirmed!";
  btn.classList.add("is-confirmed");

  setTimeout(()=>{
    btn.classList.remove("is-processing");
    switchAuthStage("nickname");

    setTimeout(()=>{
      btn.classList.remove("is-confirmed");
      btn.disabled=false;
      btn.dataset.confirming="false";
      if(confirmDifferentEmail) confirmDifferentEmail.disabled=false;
      label.textContent="I’ve confirmed my email";
    },320);
  },620);
});

function applyPrototypeDisplayName(name){
  const clean=(name||"David").trim() || "David";
  const initial=clean.charAt(0).toUpperCase();

  const homeTitle=document.querySelector("#page-home h1");
  if(homeTitle) homeTitle.textContent=`Good afternoon, ${clean}.`;

  document.querySelectorAll("#profile-display-name,#profile-display-heading").forEach(el=>{
    if(el) el.textContent=clean;
  });

  document.querySelectorAll(".person-copy strong").forEach(el=>el.textContent=clean);

  const profileInitial=document.querySelector("#profile-avatar .avatar-initial");
  if(profileInitial) profileInitial.textContent=initial;

  document.querySelectorAll(".person-avatar").forEach(el=>{
    if(!el.classList.contains("has-photo")) el.textContent=initial;
  });

  setAvatarAccent(clean);
}

document.querySelector("#nickname-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=document.querySelector("#nickname-submit");
  if(btn.dataset.savingName==="true") return;
  clearAuthMessages();

  const name=document.querySelector("#nickname-input").value.trim();
  if(!name){
    setAuthMessage("nickname","Enter a display name to continue.");
    return;
  }
  if(!isSupabaseConfigured || !supabase){
    setAuthMessage("nickname","Supabase is not configured for this deployment.");
    return;
  }

  btn.dataset.savingName="true";
  btn.disabled=true;
  btn.classList.add("is-processing");
  const label=btn.querySelector(".auth-submit-label");
  label.textContent="Saving name";

  const {data:userData,error:userError}=await supabase.auth.getUser();
  if(userError || !userData?.user){
    btn.dataset.savingName="false";
    btn.disabled=false;
    btn.classList.remove("is-processing");
    label.textContent="Enter Arvio";
    setAuthMessage("nickname","Your session expired. Log in again to finish setup.");
    return;
  }

  const {error:profileError}=await supabase
    .from("profiles")
    .update({display_name:name,updated_at:new Date().toISOString()})
    .eq("id",userData.user.id);

  if(profileError){
    btn.dataset.savingName="false";
    btn.disabled=false;
    btn.classList.remove("is-processing");
    label.textContent="Enter Arvio";
    setAuthMessage("nickname",friendlyAuthError(profileError,"Arvio couldn’t save your display name."));
    return;
  }

  await supabase.auth.updateUser({data:{display_name:name}}).catch(()=>{});
  applyPrototypeEmail(userData.user.email || "");
  applyPrototypeDisplayName(name);

  btn.dataset.savingName="false";
  btn.disabled=false;
  btn.classList.remove("is-processing");
  label.textContent="Enter Arvio";
  launchWorkspaceFromAuth(btn,{newUser:true});
});




/* v2.4.0 — iPhone status-area scroll scrim */
const mobileStatusScrim=document.querySelector(".mobile-status-scrim");
let statusScrimFrame=0;

function getArvioDocumentScrollTop(){
  const main=document.querySelector(".main");
  return Math.max(
    window.scrollY || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0,
    main?.scrollTop || 0
  );
}

function updateMobileStatusScrim(){
  if(!mobileStatusScrim) return;
  if(!window.matchMedia("(max-width: 760px)").matches){
    mobileStatusScrim.style.setProperty("--status-scrim-progress","0");
    return;
  }

  const progress=Math.max(0,Math.min(1,(getArvioDocumentScrollTop()-4)/46));
  mobileStatusScrim.style.setProperty("--status-scrim-progress",progress.toFixed(3));
}

function queueMobileStatusScrim(){
  cancelAnimationFrame(statusScrimFrame);
  statusScrimFrame=requestAnimationFrame(updateMobileStatusScrim);
}

window.addEventListener("scroll",queueMobileStatusScrim,{passive:true});
document.querySelector(".main")?.addEventListener("scroll",queueMobileStatusScrim,{passive:true});
window.visualViewport?.addEventListener("scroll",queueMobileStatusScrim,{passive:true});
window.addEventListener("resize",queueMobileStatusScrim,{passive:true});
queueMobileStatusScrim();

/* v2.1.0 — single-source mobile nav touch reaction
   One dedicated reaction system. It starts at maximum brightness immediately
   on pointer-down and decays on its own. It is independent of hold duration.

   Important implementation detail:
   .nav-impact is NOT removed at the exact visual endpoint. The animation's
   final frame already equals the resting state, so there is no class-removal
   handoff that can create a visible "tek". A later press simply restarts it. */
function setMobileNavReactionPoint(nav,target){
  const navRect=nav.getBoundingClientRect();
  const itemRect=target.getBoundingClientRect();
  const centerX=itemRect.left - navRect.left + itemRect.width/2;
  const centerY=itemRect.top - navRect.top + itemRect.height/2;

  nav.style.setProperty("--nav-react-x",`${centerX}px`);
  nav.style.setProperty("--nav-react-y",`${centerY}px`);
  nav.style.setProperty("--nav-react-origin-x",`${centerX}px`);
}

function restartCssImpact(el){
  el.classList.remove("nav-impact");
  void el.offsetWidth;
  el.classList.add("nav-impact");
}

function triggerMobileNavImpact(target){
  if(!window.matchMedia("(max-width: 760px)").matches) return;
  const nav=target.closest(".mobile-nav");
  if(!nav) return;

  setMobileNavReactionPoint(nav,target);
  restartCssImpact(nav);
  restartCssImpact(target);
}

function initMobileNavReaction(){
  document.querySelectorAll(".mobile-nav .nav-item").forEach(item=>{
    if(item.dataset.glassReactionBound==="v210") return;
    item.dataset.glassReactionBound="v210";
    item.addEventListener("pointerdown",()=>{
      triggerMobileNavImpact(item);
    },{passive:true});
  });
}

document.addEventListener("DOMContentLoaded",initMobileNavReaction);
setTimeout(initMobileNavReaction,90);

/* v2.0.6 — interruption-safe travelling liquid-glass capsule.
   Rapid taps are allowed. Every new destination cancels the old motion and
   continues from the capsule's CURRENT rendered position, never its stale
   previous target. */
let mobileNavIndicatorAnimation=null;
let mobileNavIndicatorRun=0;

function getRenderedIndicatorX(indicator,fallback=0){
  try{
    const transform=getComputedStyle(indicator).transform;
    if(!transform || transform==="none") return fallback;
    if(typeof DOMMatrixReadOnly!=="undefined"){
      return new DOMMatrixReadOnly(transform).m41;
    }
    const match=transform.match(/matrix(?:3d)?\((.+)\)/);
    if(!match) return fallback;
    const values=match[1].split(",").map(Number);
    return transform.startsWith("matrix3d") ? values[12] : values[4];
  }catch{
    return fallback;
  }
}

function updateMobileNavIndicator({animate=true,targetPage=null}={}){
  const nav=document.querySelector(".mobile-nav");
  const indicator=nav?.querySelector(".mobile-nav-indicator");
  const target=targetPage
    ? nav?.querySelector(`.nav-item[data-page="${targetPage}"]`)
    : nav?.querySelector(".nav-item.active");

  if(!nav || !indicator || !target) return;

  const nextX=target.offsetLeft;
  const nextY=target.offsetTop;
  const nextW=target.offsetWidth;
  const nextH=target.offsetHeight;
  const targetKey=target.dataset.page || String(nextX);

  // Re-tapping the tab we're already travelling to must not start a reverse
  // or stale animation.
  if(
    mobileNavIndicatorAnimation &&
    indicator.dataset.targetKey===targetKey
  ){
    return;
  }

  const fallbackX=Number(indicator.dataset.renderedX || nextX);
  const currentX=indicator.dataset.ready==="true"
    ? getRenderedIndicatorX(indicator,fallbackX)
    : nextX;

  const currentY=nextY;

  // Freeze the currently rendered location BEFORE cancelling the old motion.
  indicator.style.transform=`translate3d(${currentX}px,${currentY}px,0) scaleX(1) scaleY(1)`;
  indicator.style.filter="brightness(1) saturate(1)";
  mobileNavIndicatorAnimation?.cancel();
  mobileNavIndicatorAnimation=null;
  mobileNavIndicatorRun+=1;
  const runId=mobileNavIndicatorRun;

  indicator.classList.remove("travelling-left","travelling-right");
  indicator.style.width=`${nextW}px`;
  indicator.style.height=`${nextH}px`;
  indicator.dataset.targetKey=targetKey;
  indicator.dataset.ready="true";

  const delta=nextX-currentX;

  if(!animate || Math.abs(delta)<1 || !indicator.animate){
    indicator.style.transform=`translate3d(${nextX}px,${nextY}px,0) scaleX(1) scaleY(1)`;
    indicator.dataset.renderedX=String(nextX);
    return;
  }

  const direction=delta>0 ? 1 : -1;
  indicator.classList.add(direction>0 ? "travelling-right" : "travelling-left");

  const animation=indicator.animate([
    {
      transform:`translate3d(${currentX}px,${currentY}px,0) scaleX(1) scaleY(1)`,
      filter:"brightness(1) saturate(1)",
      boxShadow:"0 0 15px rgba(71,173,255,.13), inset 0 1px 0 rgba(255,255,255,.08)"
    },
    {
      offset:.38,
      transform:`translate3d(${currentX + delta*.48}px,${nextY}px,0) scaleX(1.16) scaleY(.975)`,
      filter:"brightness(1.09) saturate(1.08)",
      boxShadow:"0 0 25px rgba(71,173,255,.22), 0 0 44px rgba(71,173,255,.08), inset 0 1px 0 rgba(255,255,255,.14)"
    },
    {
      offset:.76,
      transform:`translate3d(${nextX}px,${nextY}px,0) scaleX(.975) scaleY(1.018)`,
      filter:"brightness(1.04) saturate(1.04)",
      boxShadow:"0 0 20px rgba(71,173,255,.18), 0 0 34px rgba(71,173,255,.06), inset 0 1px 0 rgba(255,255,255,.11)"
    },
    {
      transform:`translate3d(${nextX}px,${nextY}px,0) scaleX(1) scaleY(1)`,
      filter:"brightness(1) saturate(1)",
      boxShadow:"0 0 15px rgba(71,173,255,.13), 0 0 28px rgba(71,173,255,.04), inset 0 1px 0 rgba(255,255,255,.08)"
    }
  ],{
    duration:500,
    easing:"cubic-bezier(.16,1,.3,1)",
    fill:"forwards"
  });

  mobileNavIndicatorAnimation=animation;

  animation.onfinish=()=>{
    if(runId!==mobileNavIndicatorRun || mobileNavIndicatorAnimation!==animation) return;
    indicator.style.transform=`translate3d(${nextX}px,${nextY}px,0) scaleX(1) scaleY(1)`;
    indicator.style.filter="brightness(1) saturate(1)";
    indicator.dataset.renderedX=String(nextX);
    indicator.classList.remove("travelling-left","travelling-right");
    mobileNavIndicatorAnimation=null;
  };

  animation.oncancel=()=>{
    if(mobileNavIndicatorAnimation===animation){
      mobileNavIndicatorAnimation=null;
    }
  };
}

function initMobileNavIndicator(){
  requestAnimationFrame(()=>updateMobileNavIndicator({animate:false}));
}

window.addEventListener("resize",()=>{
  requestAnimationFrame(()=>updateMobileNavIndicator({animate:false}));
});
window.addEventListener("orientationchange",()=>{
  setTimeout(()=>updateMobileNavIndicator({animate:false}),120);
});
document.addEventListener("DOMContentLoaded",initMobileNavIndicator);
setTimeout(initMobileNavIndicator,80);

if("ResizeObserver" in window){
  const mobileNavResizeObserver=new ResizeObserver(()=>{
    if(window.matchMedia("(max-width: 760px)").matches){
      requestAnimationFrame(()=>updateMobileNavIndicator({animate:false}));
    }
  });
  const mobileNav=document.querySelector(".mobile-nav");
  if(mobileNav) mobileNavResizeObserver.observe(mobileNav);
}

/* v2.4.0 — bottom-nav self-healing guard */
let mobileNavRepairTimer=0;

function repairMobileNavState({keepImpact=true}={}){
  if(!window.matchMedia("(max-width: 760px)").matches) return;

  const nav=document.querySelector(".mobile-nav");
  const indicator=nav?.querySelector(".mobile-nav-indicator");
  const active=nav?.querySelector(".nav-item.active");
  if(!nav || !indicator || !active) return;

  if(document.body.classList.contains("persisted-session-launch")) return;

  const maxX=Math.max(0,nav.clientWidth-active.offsetWidth);
  const x=Math.max(0,Math.min(active.offsetLeft,maxX));
  const y=Math.max(0,active.offsetTop);

  mobileNavIndicatorAnimation?.cancel();
  mobileNavIndicatorAnimation=null;
  mobileNavIndicatorRun+=1;

  indicator.style.width=`${active.offsetWidth}px`;
  indicator.style.height=`${active.offsetHeight}px`;
  indicator.style.transform=`translate3d(${x}px,${y}px,0) scaleX(1) scaleY(1)`;
  indicator.style.opacity="1";
  indicator.style.visibility="visible";
  indicator.style.filter="brightness(1) saturate(1)";
  indicator.dataset.renderedX=String(x);
  indicator.dataset.targetKey=active.dataset.page || String(x);
  indicator.dataset.ready="true";
  indicator.classList.remove("travelling-left","travelling-right");

  nav.style.opacity="";
  nav.style.filter="";
  if(!nav.classList.contains("nav-impact")) nav.style.transform="";
  nav.style.pointerEvents="";

  nav.querySelectorAll(".nav-item").forEach(item=>{
    item.style.opacity="";
    item.style.filter="";
    item.style.pointerEvents="";
    if(!keepImpact) item.classList.remove("nav-impact");
  });
}

function scheduleMobileNavRepair(delay=650){
  clearTimeout(mobileNavRepairTimer);
  mobileNavRepairTimer=setTimeout(()=>repairMobileNavState(),delay);
}

document.querySelectorAll(".mobile-nav .nav-item").forEach(item=>{
  item.addEventListener("click",()=>scheduleMobileNavRepair(620));
  item.addEventListener("pointerup",()=>scheduleMobileNavRepair(680),{passive:true});
  item.addEventListener("pointercancel",()=>scheduleMobileNavRepair(60),{passive:true});
});

document.addEventListener("visibilitychange",()=>{
  if(!document.hidden) setTimeout(()=>repairMobileNavState({keepImpact:false}),80);
});
window.addEventListener("pageshow",()=>setTimeout(()=>repairMobileNavState({keepImpact:false}),90));
window.addEventListener("orientationchange",()=>setTimeout(()=>repairMobileNavState({keepImpact:false}),180));



let pageTransitionRun=0;
let pageTransitionTimers=[];

function clearPageTransitionTimers(){
  pageTransitionTimers.forEach(clearTimeout);
  pageTransitionTimers=[];
}

function normalizePageTransitionState(){
  document.querySelectorAll(".page").forEach(page=>{
    page.classList.remove("page-leaving","page-entering","page-enter-active");
  });
}

function activatePage(page){
  const next=document.querySelector(`#page-${page}`);
  if(!next) return;
  if(page==="home") renderHomeDashboard?.();

  const leavingNote=Boolean(document.querySelector("#page-note.active")) && page!=="note";
  if(leavingNote){
    const cleanup=cleanupEmptyActiveDraft?.();
    if(!cleanup?.removed) flushLocalSave?.({quiet:true});
    try{
      [document.querySelector("#command-menu"),document.querySelector("#format-menu")].forEach(menu=>{
        if(menu){ menu.classList.remove("is-open"); menu.hidden=true; }
      });
      document.querySelectorAll(".more-menu,.highlight-palette,.link-picker").forEach(menu=>menu.remove());
      window.getSelection()?.removeAllRanges?.();
    }catch{}
  }

  if(page!=="library"){
    clearTimeout(pendingLibraryConfirmTimer);
    pendingLibraryConfirmTimer=0;
    closeLibraryItemActions?.({immediate:true});
    closeLibraryDeleteConfirm?.({immediate:true});
    closeLibraryManageOverlay?.("library-rename-overlay",{immediate:true});
    closeLibraryManageOverlay?.("library-move-overlay",{immediate:true});
    document.querySelector("#library-filter-overlay")?.remove();
    document.querySelector("#library-options-menu")?.remove();
  }

  document.body.classList.toggle("note-route-active",page==="note");
  screens.workspace?.classList.toggle("note-route-active",page==="note");
  document.body.classList.toggle("create-route-active",page==="create");
  screens.workspace?.classList.toggle("create-route-active",page==="create");

  // Latest tap always owns nav state immediately.
  document.querySelectorAll(".nav-item").forEach(n=>{
    n.classList.toggle("active",n.dataset.page===page);
  });

  if(page==="home" || page==="library" || page==="profile"){
    requestAnimationFrame(()=>{
      updateMobileNavIndicator({animate:true,targetPage:page});
    });
  }

  pageTransitionRun+=1;
  const runId=pageTransitionRun;
  clearPageTransitionTimers();
  normalizePageTransitionState();

  const current=document.querySelector(".page.active");

  // Double-tapping the current tab is harmless: keep the route and capsule
  // exactly where they already are.
  if(next===current) return;

  if(current) current.classList.add("page-leaving");

  const exitTimer=setTimeout(()=>{
    if(runId!==pageTransitionRun) return;

    document.querySelectorAll(".page.active").forEach(p=>{
      if(p!==next) p.classList.remove("active");
      p.classList.remove("page-leaving");
    });

    const main=document.querySelector(".main");
    if(main) main.scrollTo({top:0,behavior:"instant"});

    next.classList.add("active","page-entering");

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        if(runId===pageTransitionRun){
          next.classList.add("page-enter-active");
        }
      });
    });

    const settleTimer=setTimeout(()=>{
      if(runId!==pageTransitionRun) return;
      next.classList.remove("page-entering","page-enter-active");
    },prefersReducedMotion()?1:ARVIO_MOTION.pageSettle);
    pageTransitionTimers.push(settleTimer);
  },prefersReducedMotion()?1:ARVIO_MOTION.pageOut);

  pageTransitionTimers.push(exitTimer);

  if(page==="home" || page==="library" || page==="profile"){
    scheduleMobileNavRepair(720);
  }
}
document.querySelectorAll("[data-page]").forEach(btn=>{
  btn.addEventListener("click",()=>activatePage(btn.dataset.page));
});

document.querySelector("#new-note").addEventListener("click",()=>{
  activatePage("create");
  closeCreateTopicPicker();
  setCreateChoiceState("new");
});

document.querySelector("#page-home")?.addEventListener("click",e=>{
  const target=e.target.closest("[data-home-note-path]");
  if(!target || target.disabled) return;
  const path=target.dataset.homeNotePath.split("›").filter(Boolean);
  if(path.length) openArvioNote(path);
});

const ARVIO_DB_NAME="arvio-local";
const ARVIO_DB_VERSION=2;
const ARVIO_NOTE_STORE="notes";
const ARVIO_APP_STATE_STORE="appState";
const ARVIO_LIBRARY_DB_KEY="library-state";

function openArvioDB(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
    const req=indexedDB.open(ARVIO_DB_NAME,ARVIO_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(ARVIO_NOTE_STORE)){
        db.createObjectStore(ARVIO_NOTE_STORE,{keyPath:"key"});
      }
      if(!db.objectStoreNames.contains(ARVIO_APP_STATE_STORE)){
        db.createObjectStore(ARVIO_APP_STATE_STORE,{keyPath:"key"});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function readArvioStore(storeName,key){
  const db=await openArvioDB();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,"readonly");
      const req=tx.objectStore(storeName).get(key);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  }finally{
    db.close();
  }
}

async function writeArvioStore(storeName,value){
  const db=await openArvioDB();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,"readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    return true;
  }finally{
    db.close();
  }
}

async function deleteArvioStoreRecord(storeName,key){
  const db=await openArvioDB();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,"readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    return true;
  }finally{
    db.close();
  }
}

async function getAllArvioStoreRecords(storeName){
  const db=await openArvioDB();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,"readonly");
      const req=tx.objectStore(storeName).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
  }finally{
    db.close();
  }
}

const libraryTree = [
  {
    title:"Toyota", icon:"▤", meta:"6 notes",
    children:[
      {title:"Avanza", children:[
        {title:"Overview", body:"General information about the Avanza"},
        {title:"Durability", body:"Since 2010, durability has been continuously refined through changes to the platform, materials, and powertrain."},
        {title:"History", body:"Generations and major changes"},
        {title:"Specifications", body:"Key specifications and variants"}
      ]},
      {title:"Rush", children:[
        {title:"Overview", body:"General information about Rush"},
        {title:"Specifications", body:"Key specifications and variants"}
      ]},
      {title:"Fortuner", children:[
        {title:"Overview", body:"General information about Fortuner"}
      ]}
    ]
  },
  {
    title:"Database Systems", icon:"▤", meta:"1 note",
    children:[{title:"Week 03", body:"Relational database systems..."}]
  },
  {
    title:"Information Systems", icon:"▤", meta:"1 note",
    children:[{title:"Week 04", body:"Business processes are collections of related activities..."}]
  },
  {
    title:"Programming", icon:"▤", meta:"1 note",
    children:[{title:"Assignment 02", body:"Application architecture and implementation notes."}]
  }
];


function uniqueLibraryTitle(container,base="Untitled"){
  const used=new Set((container||[]).map(item=>String(item.title||"").toLowerCase()));
  if(!used.has(base.toLowerCase())) return base;
  let i=2;
  while(used.has(`${base} ${i}`.toLowerCase())) i++;
  return `${base} ${i}`;
}

function createDraftAtPath(parentPath=[]){
  const container=getLibraryContainerForParent(parentPath);
  if(!container){
    activatePage("library");
    renderLibrary("");
    return;
  }

  const title=uniqueLibraryTitle(container,"Untitled");
  const id=`note-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const now=new Date().toISOString();
  const node={
    id,
    title,
    body:"",
    html:"<p>Start writing...</p>",
    createdAt:now,
    updatedAt:now,
    lastOpenedAt:now,
    children:[]
  };
  container.push(node);

  const path=[...parentPath,title];
  libraryCreatedAt[path.join("›")]=now;
  persistLibraryState();

  activeNotePath=[...path];
  activeNoteIsDraft=true;
  activeLocalNoteKey=`noteid:${id}`;
  noteDirty=false;
  noteRevision=0;
  savedNoteRevision=0;

  activatePage("note");
  setNoteBreadcrumb(path);

  const titleInput=document.querySelector(".note-title");
  titleInput.value=title;
  document.querySelector(".editor-body").innerHTML=node.html;
  setNoteSaveStatus?.("saved","Saved");

  setTimeout(()=>{
    titleInput.focus({preventScroll:true});
    titleInput.select?.();
  },250);
}

function creatableTopicEntries(){
  return flattenTree(libraryTree)
    .filter(({node})=>Array.isArray(node.children))
    .map(({node,path})=>({
      title:node.title,
      path,
      childCount:node.children.length
    }));
}

function renderCreateTopicChoices(){
  const list=document.querySelector("#create-topic-list");
  if(!list) return;

  list.innerHTML=creatableTopicEntries().map(entry=>`
    <button class="create-topic-row" type="button" data-create-topic-path="${escapeHtml(entry.path.join("›"))}">
      <span class="create-topic-glyph" aria-hidden="true">▤</span>
      <span class="create-topic-copy">
        <span class="create-topic-path">${escapeHtml(entry.path.join(" › "))}</span>
        <strong>${escapeHtml(entry.title)}</strong>
        <small>${entry.childCount} nested note${entry.childCount===1?"":"s"}</small>
      </span>
      <span class="create-choice-arrow" aria-hidden="true">›</span>
    </button>
  `).join("");
}

function setCreateChoiceState(mode="new"){
  const newTopic=document.querySelector("#create-new-topic");
  const existing=document.querySelector("#create-existing-topic");
  if(!newTopic || !existing) return;

  const existingSelected=mode==="existing";
  existing.classList.toggle("is-selected",existingSelected);
  newTopic.classList.toggle("is-demoted",existingSelected);
  newTopic.classList.toggle("is-selected",!existingSelected);
  existing.setAttribute("aria-pressed",String(existingSelected));
  newTopic.setAttribute("aria-pressed",String(!existingSelected));
}

function pulseCreateChoice(button){
  if(!button) return;
  button.classList.remove("create-choice-impact");
  void button.offsetWidth;
  button.classList.add("create-choice-impact");
  clearTimeout(button._createChoiceImpactTimer);
  button._createChoiceImpactTimer=setTimeout(()=>{
    button.classList.remove("create-choice-impact");
  },620);
}

function openCreateTopicPicker(){
  const picker=document.querySelector("#create-topic-picker");
  const trigger=document.querySelector("#create-existing-topic");
  if(!picker || !trigger) return;

  setCreateChoiceState("existing");
  renderCreateTopicChoices();
  picker.hidden=false;
  trigger.setAttribute("aria-expanded","true");

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    picker.classList.add("is-open");
    picker.scrollIntoView({behavior:"smooth",block:"nearest"});
  }));
}

function closeCreateTopicPicker({restoreDefault=true}={}){
  const picker=document.querySelector("#create-topic-picker");
  const trigger=document.querySelector("#create-existing-topic");

  if(restoreDefault) setCreateChoiceState("new");
  if(!picker || picker.hidden) return;

  trigger?.setAttribute("aria-expanded","false");
  picker.classList.remove("is-open");
  picker.classList.add("is-closing");

  setTimeout(()=>{
    picker.hidden=true;
    picker.classList.remove("is-closing");
  },220);
}

document.querySelector("#create-note-back")?.addEventListener("click",()=>{
  closeCreateTopicPicker();
  activatePage("home");
});

document.querySelector("#create-new-topic")?.addEventListener("click",e=>{
  const button=e.currentTarget;
  setCreateChoiceState("new");
  pulseCreateChoice(button);
  closeCreateTopicPicker({restoreDefault:false});
  setTimeout(()=>createDraftAtPath([]),190);
});

document.querySelector("#create-existing-topic")?.addEventListener("click",e=>{
  const button=e.currentTarget;
  const picker=document.querySelector("#create-topic-picker");

  pulseCreateChoice(button);

  if(picker?.hidden){
    // Let the chosen-state reaction land before the Library-like list unfolds.
    setCreateChoiceState("existing");
    setTimeout(openCreateTopicPicker,170);
  }else{
    closeCreateTopicPicker();
  }
});

document.querySelector("#create-topic-close")?.addEventListener("click",()=>closeCreateTopicPicker());

document.querySelector("#create-topic-list")?.addEventListener("click",e=>{
  const row=e.target.closest("[data-create-topic-path]");
  if(!row) return;

  row.classList.remove("is-selected");
  void row.offsetWidth;
  row.classList.add("is-selected");

  setTimeout(()=>{
    createDraftAtPath(row.dataset.createTopicPath.split("›"));
  },190);
});

// Start in the silver-primary state every time the creation route is first rendered.
setCreateChoiceState("new");


const expandedNodes = new Set();

/* Prototype creation timestamps used by Latest / Oldest sorting.
   Backend timestamps will replace these once Library is connected to Supabase. */
const libraryCreatedAt = {
  "Toyota":"2026-08-13T09:10:00",
  "Toyota›Avanza":"2026-08-13T09:14:00",
  "Toyota›Avanza›Overview":"2026-08-13T09:18:00",
  "Toyota›Avanza›Durability":"2026-08-15T18:24:00",
  "Toyota›Avanza›History":"2026-08-14T13:42:00",
  "Toyota›Avanza›Specifications":"2026-08-16T10:12:00",
  "Toyota›Rush":"2026-08-12T15:30:00",
  "Toyota›Rush›Overview":"2026-08-12T15:36:00",
  "Toyota›Rush›Specifications":"2026-08-12T15:48:00",
  "Toyota›Fortuner":"2026-08-11T20:10:00",
  "Toyota›Fortuner›Overview":"2026-08-11T20:14:00",
  "Database Systems":"2026-08-10T11:20:00",
  "Database Systems›Week 03":"2026-08-10T11:26:00",
  "Information Systems":"2026-08-09T08:45:00",
  "Information Systems›Week 04":"2026-08-09T08:52:00",
  "Programming":"2026-08-07T17:10:00",
  "Programming›Assignment 02":"2026-08-07T17:18:00"
};

const ARVIO_LIBRARY_STATE_KEY="arvioLibraryState_v284"; // legacy migration/fallback only
let libraryStatePersistTimer=0;
let libraryStateHydrated=false;

function compactLibraryNodeForAppState(node){
  const compact={
    id:node.id,
    title:node.title,
    icon:node.icon,
    meta:node.meta,
    body:String(node.body||"").slice(0,280),
    createdAt:node.createdAt,
    updatedAt:node.updatedAt,
    lastOpenedAt:node.lastOpenedAt,
    children:Array.isArray(node.children)
      ? node.children.map(compactLibraryNodeForAppState)
      : []
  };
  Object.keys(compact).forEach(key=>compact[key]===undefined && delete compact[key]);
  return compact;
}

function snapshotLibraryState(){
  return {
    key:ARVIO_LIBRARY_DB_KEY,
    tree:libraryTree.map(compactLibraryNodeForAppState),
    createdAt:{...libraryCreatedAt},
    trash:libraryTrash.map(item=>({
      ...item,
      node:compactLibraryNodeForAppState(item.node)
    })),
    savedAt:Date.now()
  };
}

async function persistLibraryStateNow(){
  const snapshot=snapshotLibraryState();
  try{
    await writeArvioStore(ARVIO_APP_STATE_STORE,snapshot);
    try{
      localStorage.removeItem(ARVIO_LIBRARY_STATE_KEY);
      localStorage.removeItem(ARVIO_LIBRARY_TRASH_KEY);
    }catch{}
    return true;
  }catch{
    // Fallback only for browsers/private modes that block IndexedDB.
    try{
      localStorage.setItem(ARVIO_LIBRARY_STATE_KEY,JSON.stringify({
        tree:snapshot.tree,
        createdAt:snapshot.createdAt,
        trash:snapshot.trash
      }));
      return true;
    }catch{return false}
  }
}

function persistLibraryState(){
  clearTimeout(libraryStatePersistTimer);
  libraryStatePersistTimer=setTimeout(()=>{ persistLibraryStateNow(); },90);
}

function restoreLegacyPersistedLibraryState(){
  try{
    const saved=JSON.parse(localStorage.getItem(ARVIO_LIBRARY_STATE_KEY)||"null");
    if(!saved || !Array.isArray(saved.tree)) return false;
    libraryTree.splice(0,libraryTree.length,...saved.tree);
    if(saved.createdAt && typeof saved.createdAt==="object"){
      Object.assign(libraryCreatedAt,saved.createdAt);
    }
    if(Array.isArray(saved.trash)){
      window.__arvioLegacyTrash=saved.trash;
    }
    return true;
  }catch{return false}
}

restoreLegacyPersistedLibraryState();


let librarySort="latest";
try{
  librarySort=localStorage.getItem("arvioLibrarySort") || "latest";
}catch{}

function flattenTree(nodes, path=[], out=[]){
  nodes.forEach(n=>{
    const current=[...path,n.title];
    out.push({node:n,path:current});
    if(n.children) flattenTree(n.children,current,out);
  });
  return out;
}

function getLibraryCreatedAt(path){
  return new Date(libraryCreatedAt[path.join("›")] || "2026-01-01T00:00:00").getTime();
}

function cloneLibraryNodePreservingChildOrder(node){
  return {
    ...node,
    children:Array.isArray(node.children)
      ? node.children.map(cloneLibraryNodePreservingChildOrder)
      : node.children
  };
}

function sortLibraryNodes(nodes,parentPath=[]){
  // Main Library sorting is intentionally based on TOP-LEVEL parent creation time.
  // Child creation timestamps never reorder the parent hierarchy.
  if(parentPath.length){
    return nodes.map(cloneLibraryNodePreservingChildOrder);
  }

  return [...nodes]
    .sort((a,b)=>{
      const aTime=getLibraryCreatedAt([a.title]);
      const bTime=getLibraryCreatedAt([b.title]);
      return librarySort==="oldest" ? aTime-bTime : bTime-aTime;
    })
    .map(cloneLibraryNodePreservingChildOrder);
}


const ARVIO_LIBRARY_TRASH_KEY="arvioLibraryTrash_v264";
let libraryTrash=Array.isArray(window.__arvioLegacyTrash)?window.__arvioLegacyTrash:[];
try{
  const saved=JSON.parse(localStorage.getItem(ARVIO_LIBRARY_TRASH_KEY)||"[]");
  if(Array.isArray(saved) && saved.length) libraryTrash=saved;
}catch{}
try{ delete window.__arvioLegacyTrash; }catch{}

function persistLibraryTrash(){
  persistLibraryState();
}

function findLibraryNode(path){
  const parts=Array.isArray(path)?path:String(path||"").split("›").filter(Boolean);
  let container=libraryTree;
  let node=null;
  let index=-1;

  for(let i=0;i<parts.length;i++){
    index=container.findIndex(item=>item.title===parts[i]);
    if(index<0) return null;
    node=container[index];
    if(i<parts.length-1){
      if(!Array.isArray(node.children)) return null;
      container=node.children;
    }
  }

  return {node,container,index,path:parts,parentPath:parts.slice(0,-1)};
}

function countLibrarySubtree(node){
  if(!node) return 0;
  return 1+(Array.isArray(node.children)
    ? node.children.reduce((sum,child)=>sum+countLibrarySubtree(child),0)
    : 0);
}

function pruneExpandedPaths(path){
  const key=path.join("›");
  [...expandedNodes].forEach(expanded=>{
    if(expanded===key || expanded.startsWith(`${key}›`)) expandedNodes.delete(expanded);
  });
}

function removeLibraryPath(path,{recordTrash=false}={}){
  const found=findLibraryNode(path);
  if(!found) return null;
  const [node]=found.container.splice(found.index,1);
  pruneExpandedPaths(found.path);

  if(recordTrash){
    const trashItem={
      id:`trash-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      node,
      path:found.path,
      parentPath:found.parentPath,
      originalIndex:found.index,
      deletedAt:new Date().toISOString()
    };
    libraryTrash.unshift(trashItem);
    persistLibraryTrash();
    persistLibraryState();
    return trashItem;
  }

  persistLibraryState();
  return {node,path:found.path,parentPath:found.parentPath,originalIndex:found.index};
}

function getLibraryContainerForParent(parentPath){
  if(!parentPath?.length) return libraryTree;
  const parent=findLibraryNode(parentPath);
  if(!parent?.node) return null;
  if(!Array.isArray(parent.node.children)) parent.node.children=[];
  return parent.node.children;
}

function restoreLibraryTrashItem(id){
  const index=libraryTrash.findIndex(item=>item.id===id);
  if(index<0) return {ok:false};
  const item=libraryTrash[index];
  const container=getLibraryContainerForParent(item.parentPath);
  if(!container) return {ok:false,missingParent:true};

  const insertAt=Math.min(Math.max(0,item.originalIndex ?? container.length),container.length);
  container.splice(insertAt,0,item.node);
  libraryTrash.splice(index,1);
  persistLibraryTrash();
  persistLibraryState();
  syncLibrarySubtreeRecordsToIndexedDB(item.node,item.path);
  renderHomeDashboard();
  return {ok:true,item};
}

function applyPersistedLibraryTrash(){
  // Re-create the user's prototype trash state after reload without duplicating trash entries.
  [...libraryTrash].reverse().forEach(item=>removeLibraryPath(item.path,{recordTrash:false}));
}

applyPersistedLibraryTrash();

function ensureLibraryNodeIds(nodes=libraryTree){
  let changed=false;
  const walk=list=>{
    list.forEach(node=>{
      if(!node.id){
        node.id=`note-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
        changed=true;
      }
      if(Array.isArray(node.children)) walk(node.children);
    });
  };
  walk(nodes);
  return changed;
}

ensureLibraryNodeIds();

async function hydrateLibraryStateFromIndexedDB(){
  try{
    const saved=await readArvioStore(ARVIO_APP_STATE_STORE,ARVIO_LIBRARY_DB_KEY);
    if(saved?.tree && Array.isArray(saved.tree)){
      libraryTree.splice(0,libraryTree.length,...saved.tree);
      Object.keys(libraryCreatedAt).forEach(key=>delete libraryCreatedAt[key]);
      if(saved.createdAt && typeof saved.createdAt==="object"){
        Object.assign(libraryCreatedAt,saved.createdAt);
      }
      libraryTrash=Array.isArray(saved.trash)?saved.trash:[];
      ensureLibraryNodeIds();
      try{
        localStorage.removeItem(ARVIO_LIBRARY_STATE_KEY);
        localStorage.removeItem(ARVIO_LIBRARY_TRASH_KEY);
      }catch{}
    }else{
      // First v3 boot: migrate the already-restored legacy state into IndexedDB.
      ensureLibraryNodeIds();
      await persistLibraryStateNow();
    }
    libraryStateHydrated=true;
    await hydrateLibraryNoteContentFromIndexedDB();
    await seedIndexedDbNotesFromLibrary();
    renderLibrary(librarySearch?.value||"");
    renderHomeDashboard();
  }catch{
    libraryStateHydrated=true;
    ensureLibraryNodeIds();
    await hydrateLibraryNoteContentFromIndexedDB();
    renderLibrary(librarySearch?.value||"");
    renderHomeDashboard();
  }
}


function remapExpandedPathPrefix(oldPath,newPath){
  const oldKey=oldPath.join("›");
  const newKey=newPath.join("›");
  [...expandedNodes].forEach(key=>{
    if(key===oldKey || key.startsWith(`${oldKey}›`)){
      expandedNodes.delete(key);
      expandedNodes.add(`${newKey}${key.slice(oldKey.length)}`);
    }
  });
}

function removeCreatedAtPrefix(path){
  const key=path.join("›");
  Object.keys(libraryCreatedAt).forEach(existing=>{
    if(existing===key || existing.startsWith(`${key}›`)) delete libraryCreatedAt[existing];
  });
}

function stampCreatedAtTree(node,path,iso=new Date().toISOString()){
  libraryCreatedAt[path.join("›")]=iso;
  node.createdAt=iso;
  node.updatedAt=iso;
  node.lastOpenedAt=null;
  if(Array.isArray(node.children)){
    node.children.forEach(child=>stampCreatedAtTree(child,[...path,child.title],iso));
  }
}

function cloneLibraryNodeForDuplicate(node){
  const clone={
    ...node,
    id:`note-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
    title:node.title,
    children:Array.isArray(node.children)
      ? node.children.map(cloneLibraryNodeForDuplicate)
      : []
  };
  delete clone.updatedAt;
  return clone;
}

function renameLibraryPath(path,requestedTitle){
  const found=findLibraryNode(path);
  if(!found) return {ok:false};

  const clean=String(requestedTitle||"").trim();
  if(!clean) return {ok:false,reason:"empty"};

  const siblings=found.container.filter((_,index)=>index!==found.index);
  const title=uniqueLibraryTitle(siblings,clean);
  const oldPath=[...found.path];

  if(title===found.node.title) return {ok:true,path:oldPath,title,unchanged:true};

  found.node.title=title;
  found.node.updatedAt=new Date().toISOString();
  const newPath=[...found.parentPath,title];
  remapLibraryCreatedAtPrefix(oldPath,newPath);
  remapExpandedPathPrefix(oldPath,newPath);
  persistLibraryState();
  syncLibrarySubtreeRecordsToIndexedDB(found.node,newPath);
  renderHomeDashboard();
  return {ok:true,path:newPath,title,adjusted:title!==clean};
}

function moveLibraryPath(path,targetParentPath=[]){
  const found=findLibraryNode(path);
  if(!found) return {ok:false,reason:"missing"};

  const oldPath=[...found.path];
  const targetPath=[...(targetParentPath||[])];
  const oldParentKey=found.parentPath.join("›");
  const targetKey=targetPath.join("›");
  const sourceKey=oldPath.join("›");

  if(oldParentKey===targetKey) return {ok:false,reason:"same"};
  if(targetKey===sourceKey || targetKey.startsWith(`${sourceKey}›`)){
    return {ok:false,reason:"descendant"};
  }

  const targetContainer=getLibraryContainerForParent(targetPath);
  if(!targetContainer) return {ok:false,reason:"target"};

  const [node]=found.container.splice(found.index,1);
  const title=uniqueLibraryTitle(targetContainer,node.title);
  node.title=title;
  targetContainer.push(node);

  const newPath=[...targetPath,title];
  remapLibraryCreatedAtPrefix(oldPath,newPath);
  remapExpandedPathPrefix(oldPath,newPath);
  pruneExpandedPaths(oldPath);
  persistLibraryState();
  syncLibrarySubtreeRecordsToIndexedDB(node,newPath);
  renderHomeDashboard();

  return {ok:true,path:newPath,title,adjusted:title!==found.node.title};
}

function duplicateLibraryPath(path){
  const found=findLibraryNode(path);
  if(!found) return {ok:false};

  const clone=cloneLibraryNodeForDuplicate(found.node);
  clone.title=uniqueLibraryTitle(found.container,`${found.node.title} Copy`);
  found.container.splice(found.index+1,0,clone);

  const newPath=[...found.parentPath,clone.title];
  stampCreatedAtTree(clone,newPath);
  persistLibraryState();
  syncLibrarySubtreeRecordsToIndexedDB(clone,newPath);
  renderHomeDashboard();
  return {ok:true,path:newPath,node:clone};
}

function getMoveDestinationEntries(sourcePath){
  const sourceKey=sourcePath.join("›");
  const sourceParentKey=sourcePath.slice(0,-1).join("›");

  const entries=[{
    path:[],
    key:"",
    title:"Library",
    display:"Library root",
    depth:0,
    current:sourceParentKey==="",
    blocked:false
  }];

  flattenTree(libraryTree).forEach(({node,path})=>{
    const key=path.join("›");
    const blocked=key===sourceKey || key.startsWith(`${sourceKey}›`);
    entries.push({
      path,
      key,
      title:node.title,
      display:path.join(" › "),
      depth:path.length,
      current:key===sourceParentKey,
      blocked
    });
  });

  return entries;
}

function isUntouchedDraftTitle(title){
  return /^Untitled(?: \d+)?$/i.test(String(title||"").trim());
}

function activeDraftHasMeaningfulContent(){
  const text=(editor?.innerText||"")
    .replace(/\u00a0/g," ")
    .trim();
  return Boolean(text && text!=="Start writing..." && text!=="Start writing your note here...");
}

async function deleteLocalNoteRecord(key){
  if(!key) return;
  try{
    const db=await openArvioDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(ARVIO_NOTE_STORE,"readwrite");
      tx.objectStore(ARVIO_NOTE_STORE).delete(key);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }catch{
    try{
      const item=JSON.parse(localStorage.getItem("arvioFallbackNote")||"null");
      if(item?.key===key) localStorage.removeItem("arvioFallbackNote");
    }catch{}
  }
}

function cleanupEmptyActiveDraft(){
  if(!activeNoteIsDraft || !activeNotePath?.length) return {removed:false};

  const found=findLibraryNode(activeNotePath);
  if(!found) return {removed:false};

  const title=noteTitleInput?.value?.trim() || found.node.title;
  if(!isUntouchedDraftTitle(title) || activeDraftHasMeaningfulContent()){
    activeNoteIsDraft=false;
    return {removed:false};
  }

  const removedPath=[...found.path];
  const parentPath=[...found.parentPath];
  const key=activeLocalNoteKey;

  removeLibraryPath(removedPath,{recordTrash:false});
  removeCreatedAtPrefix(removedPath);
  persistLibraryState();
  deleteLocalNoteRecord(key);

  activeNoteIsDraft=false;
  return {removed:true,path:removedPath,parentPath};
}

function formatTrashTime(iso){
  try{
    return new Date(iso).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  }catch{return "Recently"}
}

function escapeHtml(text=""){
  return String(text)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function highlightText(text,q){
  const safe=escapeHtml(text);
  if(!q) return safe;
  const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return safe.replace(new RegExp(`(${escaped})`,"ig"),"<mark class=\"search-match\">$1</mark>");
}

function librarySearchScore(entry,q){
  const query=q.toLowerCase();
  const title=entry.node.title.toLowerCase();
  const body=(entry.node.body||"").toLowerCase();
  const path=entry.path.join(" › ").toLowerCase();

  let score=0;
  if(title===query) score+=120;
  if(title.startsWith(query)) score+=70;
  if(title.includes(query)) score+=48;
  if(path.includes(query)) score+=24;
  if(body.includes(query)) score+=18;
  return score;
}

function getSearchSnippet(entry,q){
  const body=entry.node.body || "";
  if(!body){
    const childCount=entry.node.children?.length || 0;
    return childCount
      ? `${childCount} nested note${childCount===1?"":"s"}`
      : "Note";
  }

  const lower=body.toLowerCase();
  const index=lower.indexOf(q.toLowerCase());
  if(index<0){
    return body.length>118 ? `${body.slice(0,115)}…` : body;
  }

  const start=Math.max(0,index-34);
  const end=Math.min(body.length,index+q.length+72);
  return `${start>0?"…":""}${body.slice(start,end)}${end<body.length?"…":""}`;
}

function focusLibraryPath(path){
  const targetPath=Array.isArray(path)?path:[];
  targetPath.slice(0,-1).forEach((name,j)=>{
    expandedNodes.add(targetPath.slice(0,j+1).join("›"));
  });

  const search=document.querySelector("#library-search");
  if(search) search.value="";
  activatePage("library");
  renderLibrary("");

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const preferred=targetPath.length
      ? document.querySelector(`[data-tree-key="${CSS.escape(targetPath.join("›"))}"]`) ||
        document.querySelector(`[data-note-path="${CSS.escape(targetPath.join("›"))}"]`)
      : null;
    const parentKey=targetPath.slice(0,-1).join("›");
    const parent=parentKey
      ? document.querySelector(`[data-tree-key="${CSS.escape(parentKey)}"]`)
      : null;
    const target=preferred || parent;
    if(target){
      target.scrollIntoView({behavior:"smooth",block:"center"});
      target.classList.add("library-return-target");
      if(target.matches("[data-tree-key]")){
        target.classList.add("expanded");
        target.setAttribute("aria-expanded","true");
        target.nextElementSibling?.classList.add("open");
      }
      setTimeout(()=>target.classList.remove("library-return-target"),1050);
    }
  }));
}

function setNoteBreadcrumb(path){
  activeNotePath=[...path];
  const crumb=document.querySelector(".breadcrumb");
  crumb.className="breadcrumb breadcrumb-btn note-breadcrumb";
  crumb.innerHTML=`<button class="crumb library-root" data-library-root="true">Library</button>`+
    path.map((name,i)=>{
      const current=i===path.length-1;
      return `<span class="sep">›</span><button class="crumb ${current?"current":""}" data-crumb-index="${i}" ${current?'aria-current="page"':""}>${escapeHtml(name)}</button>`;
    }).join("");

  crumb.querySelector("[data-library-root]")?.addEventListener("click",async()=>{
    const before=[...activeNotePath];
    const cleanup=cleanupEmptyActiveDraft();
    if(!cleanup.removed) await flushLocalSave({quiet:true});
    focusLibraryPath(cleanup.removed ? cleanup.parentPath : before);
  });

  crumb.querySelectorAll("[data-crumb-index]").forEach(b=>{
    b.addEventListener("click",async()=>{
      const index=Number(b.dataset.crumbIndex);
      if(index===path.length-1) return;
      const requested=activeNotePath.slice(0,index+1);
      const cleanup=cleanupEmptyActiveDraft();
      if(!cleanup.removed) await flushLocalSave({quiet:true});
      focusLibraryPath(requested);
    });
  });
}

function openArvioNote(path){
  const found=findLibraryNode(path);
  if(!found) return;
  activeNotePath=[...path];
  activeNoteIsDraft=false;

  const node=found.node;
  if(!node.id) node.id=`note-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  const legacyLocalNoteKey=`note:${path.join("/").toLowerCase()}`;
  activeLocalNoteKey=`noteid:${node.id}`;
  noteDirty=false;
  noteRevision=0;
  savedNoteRevision=0;
  markNoteOpened(path);

  activatePage("note");
  setNoteBreadcrumb(path);

  document.querySelector(".note-title").value=node?.title || path[path.length-1];
  const bodyByPath={
    "Toyota›Avanza›History":"The Avanza has evolved across multiple generations, with each generation bringing changes in platform, design, and powertrain.",
    "Toyota›Avanza›Durability":"Since 2010, durability has been continuously refined through changes to the platform, materials, and powertrain.",
    "Toyota›Avanza›Overview":"The Toyota Avanza is a compact MPV designed around practicality and everyday usability.",
    "Toyota›Avanza›Specifications":"Key specifications and variants for the Toyota Avanza."
  };

  if(node?.html){
    document.querySelector(".editor-body").innerHTML=node.html;
  }else{
    const body=node?.body || bodyByPath[path.join("›")] || `${path.join(" › ")} is open.`;
    document.querySelector(".editor-body").innerHTML=`<p>${escapeHtml(body)}</p><p>Start writing your note here...</p>`;
  }
  restoreLocalNoteIfPresent(activeLocalNoteKey,legacyLocalNoteKey);
}

function countLibraryLeafNotes(node){
  if(!node) return 0;
  if(!Array.isArray(node.children) || !node.children.length) return 1;
  return node.children.reduce((sum,child)=>sum+countLibraryLeafNotes(child),0);
}

function renderTree(nodes,parentPath=[]){
  return nodes.map(n=>{
    const path=[...parentPath,n.title];
    const key=path.join("›");
    const depth=parentPath.length;
    const hasChildren=Array.isArray(n.children)&&n.children.length>0;
    const shouldOpen=expandedNodes.has(key);

    return `
      <div class="tree-item" data-tree-item-path="${escapeHtml(key)}">
        <div class="tree-row-shell ${shouldOpen?"is-expanded":""}" data-depth="${depth}">
          <button
            class="tree-row ${shouldOpen?"expanded":""}"
            data-tree-key="${escapeHtml(key)}"
            data-has-children="${hasChildren}"
            data-depth="${depth}"
            aria-expanded="${hasChildren ? String(shouldOpen) : "false"}"
          >
            <span class="tree-icon" aria-hidden="true">${escapeHtml(n.icon||"▤")}</span>
            <span class="tree-copy">
              <span class="tree-name">${escapeHtml(n.title)}</span>
              ${hasChildren?`<small class="tree-meta">${countLibraryLeafNotes(n)} notes</small>`:(n.meta?`<small class="tree-meta">${escapeHtml(n.meta)}</small>`:"")}
            </span>
          </button>
          <span class="tree-row-rail">
            <button class="tree-more" type="button" data-library-item-menu="${escapeHtml(key)}" aria-label="More options for ${escapeHtml(n.title)}">•••</button>
            ${hasChildren?`<span class="tree-chevron" aria-hidden="true">›</span>`:`<span class="tree-open-arrow" aria-hidden="true">›</span>`}
          </span>
        </div>

        ${hasChildren?`
          <div class="tree-children ${shouldOpen?"open":""}" data-tree-children-for="${escapeHtml(key)}">
            <div class="tree-children-inner">
              ${n.children.map(child=>{
                const childPath=[...path,child.title];
                const childKey=childPath.join("›");
                const childDepth=depth+1;
                const hasGrand=Array.isArray(child.children)&&child.children.length>0;
                const childOpen=expandedNodes.has(childKey);

                return `
                  <div class="tree-child-wrap" data-tree-item-path="${escapeHtml(childKey)}">
                    ${hasGrand ? `
                      <div class="tree-row-shell tree-row-shell-nested ${childOpen?"is-expanded":""}" data-depth="${childDepth}">
                        <button
                          class="tree-row tree-row-nested ${childOpen?"expanded":""}"
                          data-tree-key="${escapeHtml(childKey)}"
                          data-has-children="true"
                          data-depth="${childDepth}"
                          aria-expanded="${String(childOpen)}"
                        >
                          <span class="tree-icon" aria-hidden="true">▤</span>
                          <span class="tree-copy">
                            <span class="tree-name">${escapeHtml(child.title)}</span>
                            <small class="tree-meta">${countLibraryLeafNotes(child)} notes</small>
                          </span>
                        </button>
                        <span class="tree-row-rail">
                          <button class="tree-more" type="button" data-library-item-menu="${escapeHtml(childKey)}" aria-label="More options for ${escapeHtml(child.title)}">•••</button>
                          <span class="tree-chevron" aria-hidden="true">›</span>
                        </span>
                      </div>

                      <div class="tree-children ${childOpen?"open":""}" data-tree-children-for="${escapeHtml(childKey)}">
                        <div class="tree-children-inner">
                          ${child.children.map(grand=>{
                            const grandPath=[...childPath,grand.title];
                            const grandKey=grandPath.join("›");
                            return `
                              <div class="tree-leaf-shell" data-tree-item-path="${escapeHtml(grandKey)}" data-depth="${childDepth+1}">
                                <button class="tree-child" data-note-path="${escapeHtml(grandKey)}" data-depth="${childDepth+1}">
                                  <span class="dot" aria-hidden="true"></span>
                                  <span class="tree-copy">
                                    <span class="tree-name">${escapeHtml(grand.title)}</span>
                                    ${grand.body?`<small class="tree-meta">${escapeHtml(grand.body)}</small>`:""}
                                  </span>
                                </button>
                                <span class="tree-row-rail tree-leaf-rail">
                                  <button class="tree-more" type="button" data-library-item-menu="${escapeHtml(grandKey)}" aria-label="More options for ${escapeHtml(grand.title)}">•••</button>
                                  <span class="tree-open-arrow" aria-hidden="true">›</span>
                                </span>
                              </div>
                            `;
                          }).join("")}
                        </div>
                      </div>
                    ` : `
                      <div class="tree-leaf-shell" data-tree-item-path="${escapeHtml(childKey)}" data-depth="${childDepth}">
                        <button class="tree-child" data-note-path="${escapeHtml(childKey)}" data-depth="${childDepth}">
                          <span class="dot" aria-hidden="true"></span>
                          <span class="tree-copy">
                            <span class="tree-name">${escapeHtml(child.title)}</span>
                            ${child.body?`<small class="tree-meta">${escapeHtml(child.body)}</small>`:""}
                          </span>
                        </button>
                        <span class="tree-row-rail tree-leaf-rail">
                          <button class="tree-more" type="button" data-library-item-menu="${escapeHtml(childKey)}" aria-label="More options for ${escapeHtml(child.title)}">•••</button>
                          <span class="tree-open-arrow" aria-hidden="true">›</span>
                        </span>
                      </div>
                    `}
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `:""}
      </div>
    `;
  }).join("");
}

function getDayKeyFromTimestamp(timestamp){
  const d=new Date(timestamp);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function formatLibraryDateGroupLabel(timestamp){
  const d=new Date(timestamp);
  const now=new Date();
  const startOfToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const startOfDay=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const diffDays=Math.round((startOfToday-startOfDay)/86400000);

  if(diffDays===0) return "TODAY";
  if(diffDays===1) return "YESTERDAY";

  return d.toLocaleDateString("en-US",{
    day:"2-digit",
    month:"short",
    year:"numeric"
  }).toUpperCase();
}

function renderLibraryDateGroups(nodes){
  const groups=[];

  nodes.forEach(node=>{
    const timestamp=getLibraryCreatedAt([node.title]);
    const dayKey=getDayKeyFromTimestamp(timestamp);
    const last=groups[groups.length-1];

    if(last && last.dayKey===dayKey){
      last.nodes.push(node);
    }else{
      groups.push({
        dayKey,
        timestamp,
        label:formatLibraryDateGroupLabel(timestamp),
        nodes:[node]
      });
    }
  });

  return groups.map(group=>`
    <section class="tree-date-block" data-date-group="${group.dayKey}">
      <div class="tree-date-label">${group.label}</div>
      <div class="tree-date-stack">
        ${renderTree(group.nodes)}
      </div>
    </section>
  `).join("");
}

function libraryEntryCreatedAt(entry){
  return getLibraryCreatedAt(entry.path) || Date.now();
}

function libraryEntryUpdatedAt(entry){
  const raw=entry.node.updatedAt || libraryCreatedAt[entry.path.join("›")];
  const value=new Date(raw||0).getTime();
  return Number.isFinite(value) && value>0 ? value : libraryEntryCreatedAt(entry);
}

function libraryEntryLastOpenedAt(entry){
  const value=new Date(entry.node.lastOpenedAt||0).getTime();
  return Number.isFinite(value)?value:0;
}

function isHomeOpenableEntry(entry){
  const node=entry.node;
  const hasChildren=Array.isArray(node.children)&&node.children.length>0;
  return !hasChildren || Boolean(node.body||node.html||node.updatedAt||node.lastOpenedAt);
}

function homeNoteEntries(){
  return flattenTree(libraryTree).filter(isHomeOpenableEntry);
}

function formatRelativeActivity(timestamp){
  const diff=Math.max(0,Date.now()-Number(timestamp||0));
  const minute=60_000, hour=3_600_000, day=86_400_000;
  if(diff<45_000) return "Just now";
  if(diff<hour) return `${Math.max(1,Math.round(diff/minute))} min ago`;
  if(diff<day) return `${Math.max(1,Math.round(diff/hour))} hr ago`;
  if(diff<day*2) return "Yesterday";
  if(diff<day*7) return `${Math.round(diff/day)} days ago`;
  try{
    return new Date(timestamp).toLocaleDateString("en-US",{month:"short",day:"numeric"});
  }catch{return "Recently"}
}

function homeEntrySnippet(entry){
  const text=String(entry.node.body||"")
    .replace(/\s+/g," ")
    .trim();
  if(text) return text.length>116?`${text.slice(0,113)}…`:text;
  if(Array.isArray(entry.node.children)&&entry.node.children.length){
    return `${entry.node.children.length} nested note${entry.node.children.length===1?"":"s"}`;
  }
  return "Ready when you are.";
}

function renderHomeDashboard(){
  const continueCard=document.querySelector("#home-continue-note");
  const recentList=document.querySelector("#home-recent-list");
  if(!continueCard || !recentList) return;

  const entries=homeNoteEntries();
  if(!entries.length){
    continueCard.disabled=true;
    continueCard.removeAttribute("data-home-note-path");
    continueCard.innerHTML=`
      <div>
        <span class="note-path">No notes yet</span>
        <h3>Create your first note</h3>
        <p>Your latest work will appear here automatically.</p>
      </div>
      <span class="saved">Ready</span>
    `;
    recentList.innerHTML=`<div class="home-recent-empty">Recently edited notes will show up here.</div>`;
    return;
  }

  const byOpened=[...entries].sort((a,b)=>libraryEntryLastOpenedAt(b)-libraryEntryLastOpenedAt(a));
  const continueEntry=libraryEntryLastOpenedAt(byOpened[0])>0
    ? byOpened[0]
    : [...entries].sort((a,b)=>libraryEntryUpdatedAt(b)-libraryEntryUpdatedAt(a))[0];

  const continuePath=continueEntry.path.join("›");
  const parentPath=continueEntry.path.slice(0,-1).join(" › ") || "Library";
  continueCard.disabled=false;
  continueCard.dataset.homeNotePath=continuePath;
  continueCard.innerHTML=`
    <div>
      <span class="note-path">${escapeHtml(parentPath)}</span>
      <h3>${escapeHtml(continueEntry.node.title)}</h3>
      <p>${escapeHtml(homeEntrySnippet(continueEntry))}</p>
    </div>
    <span class="saved">${libraryEntryLastOpenedAt(continueEntry)>0?`Opened ${formatRelativeActivity(libraryEntryLastOpenedAt(continueEntry))}`:`Edited ${formatRelativeActivity(libraryEntryUpdatedAt(continueEntry))}`}</span>
  `;

  let recents=[...entries]
    .sort((a,b)=>libraryEntryUpdatedAt(b)-libraryEntryUpdatedAt(a))
    .filter(entry=>entry.path.join("›")!==continuePath)
    .slice(0,3);
  if(!recents.length) recents=[continueEntry];

  recentList.innerHTML=recents.map(entry=>{
    const path=entry.path.join("›");
    const parent=entry.path.slice(0,-1).join(" › ") || "Library";
    return `
      <button type="button" data-home-note-path="${escapeHtml(path)}">
        <span>${escapeHtml(parent)}</span>
        <small>${escapeHtml(entry.node.title)} · ${formatRelativeActivity(libraryEntryUpdatedAt(entry))}</small>
      </button>
    `;
  }).join("");
}

function markNoteOpened(path){
  const found=findLibraryNode(path);
  if(!found) return;
  found.node.lastOpenedAt=new Date().toISOString();
  persistLibraryState();
  syncLibrarySubtreeRecordsToIndexedDB(found.node,found.path);
  renderHomeDashboard();
}

function renderLibrarySearch(query){
  const q=query.trim();
  const matches=flattenTree(libraryTree)
    .filter(entry=>{
      const haystack=[
        entry.node.title,
        entry.node.body||"",
        entry.path.join(" ")
      ].join(" ").toLowerCase();
      return haystack.includes(q.toLowerCase());
    })
    .map(entry=>({...entry,score:librarySearchScore(entry,q)}))
    .sort((a,b)=>{
      if(b.score!==a.score) return b.score-a.score;
      const aTime=getLibraryCreatedAt(a.path);
      const bTime=getLibraryCreatedAt(b.path);
      return librarySort==="oldest" ? aTime-bTime : bTime-aTime;
    });

  if(!matches.length){
    return `
      <section class="library-search-results">
        <div class="library-empty">
          <span class="library-empty-icon">⌕</span>
          <strong>No matching notes</strong>
          <p>Try another title, phrase, note path, or attachment name.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="library-search-results">
      ${matches.map(entry=>{
        const fullPath=entry.path.join(" › ");
        return `
          <button class="library-search-result" data-note-path="${escapeHtml(entry.path.join("›"))}">
            <span class="library-result-path">${highlightText(fullPath,q)}</span>
            <span class="library-result-title">${highlightText(entry.node.title,q)}</span>
            <span class="library-result-snippet">${highlightText(getSearchSnippet(entry,q),q)}</span>
            <span class="library-result-arrow" aria-hidden="true">›</span>
          </button>
        `;
      }).join("")}
    </section>
  `;
}

function renderLibrary(query=""){
  const root=document.querySelector("#library-results");
  const summary=document.querySelector("#library-search-summary");
  const clear=document.querySelector("#library-search-clear");
  const q=query.trim();

  if(clear) clear.hidden=!q;

  if(q){
    const total=flattenTree(libraryTree).filter(entry=>
      [entry.node.title,entry.node.body||"",entry.path.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    ).length;

    if(summary){
      summary.textContent=`${total} result${total===1?"":"s"} for “${q}”`;
      summary.classList.add("is-visible");
    }

    root.innerHTML=renderLibrarySearch(q);
    return;
  }

  if(summary){
    summary.textContent="";
    summary.classList.remove("is-visible");
  }

  const sorted=sortLibraryNodes(libraryTree);
  root.innerHTML=`
    <section class="tree-group tree-group-root">
      <div class="tree-title">
        <span>ALL NOTES</span>
        <span class="tree-sort-label">${librarySort==="oldest"?"OLDEST FIRST":"LATEST FIRST"}</span>
      </div>
      ${renderLibraryDateGroups(sorted)}
    </section>
  `;
}

const librarySearch=document.querySelector("#library-search");
const librarySearchClear=document.querySelector("#library-search-clear");
const libraryFilter=document.querySelector("#library-filter");

renderLibrary();
renderHomeDashboard();
queueMicrotask(()=>hydrateLibraryStateFromIndexedDB());

librarySearch.addEventListener("input",e=>{
  renderLibrary(e.target.value);
});

librarySearchClear.addEventListener("click",()=>{
  librarySearch.value="";
  renderLibrary("");
  librarySearch.focus();
});

function closeLibraryFilter(){
  const overlay=document.querySelector("#library-filter-overlay");
  if(!overlay) return;

  libraryFilter?.setAttribute("aria-expanded","false");
  overlay.classList.remove("is-open");
  overlay.classList.add("is-closing");
  setTimeout(()=>overlay.remove(),240);
}

function openLibraryFilter(){
  closeLibraryFilter();

  const overlay=document.createElement("div");
  overlay.id="library-filter-overlay";
  overlay.className="library-filter-overlay";
  overlay.innerHTML=`
    <div class="library-filter-sheet" role="dialog" aria-modal="true" aria-label="Sort Library">
      <span class="library-filter-grabber" aria-hidden="true"></span>
      <div class="library-filter-heading">
        <div>
          <span>SORT LIBRARY</span>
          <strong>Created date</strong>
        </div>
        <button type="button" class="library-filter-close" aria-label="Close">×</button>
      </div>
      <div class="library-filter-options">
        <button type="button" class="library-filter-choice ${librarySort==="latest"?"active":""}" data-sort="latest">
          <span>
            <strong>Latest created</strong>
            <small>Newest notes appear first</small>
          </span>
          <span class="filter-choice-check">${librarySort==="latest"?"●":""}</span>
        </button>
        <button type="button" class="library-filter-choice ${librarySort==="oldest"?"active":""}" data-sort="oldest">
          <span>
            <strong>Oldest created</strong>
            <small>Oldest notes appear first</small>
          </span>
          <span class="filter-choice-check">${librarySort==="oldest"?"●":""}</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  libraryFilter?.setAttribute("aria-expanded","true");

  if(!window.matchMedia("(max-width: 760px)").matches){
    const rect=libraryFilter.getBoundingClientRect();
    const sheet=overlay.querySelector(".library-filter-sheet");
    sheet.style.left=`${Math.max(12,rect.left)}px`;
    sheet.style.top=`${rect.bottom+8}px`;
  }

  requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add("is-open")));

  overlay.addEventListener("click",e=>{
    if(e.target===overlay || e.target.closest(".library-filter-close")){
      closeLibraryFilter();
      return;
    }

    const choice=e.target.closest("[data-sort]");
    if(!choice) return;

    librarySort=choice.dataset.sort;
    try{localStorage.setItem("arvioLibrarySort",librarySort)}catch{}
    const label=libraryFilter.querySelector(".filter-label");
    if(label) label.textContent=librarySort==="oldest"?"Oldest":"Latest";
    renderLibrary(librarySearch.value);
    closeLibraryFilter();
  });
}

libraryFilter.addEventListener("click",openLibraryFilter);

const libraryResults=document.querySelector("#library-results");
libraryResults.addEventListener("click",e=>{
  const moreButton=e.target.closest("[data-library-item-menu]");
  if(moreButton && libraryResults.contains(moreButton)){
    e.preventDefault();
    e.stopPropagation();
    openLibraryItemActions(moreButton.dataset.libraryItemMenu,moreButton);
    return;
  }

  const treeBtn=e.target.closest("[data-tree-key]");
  if(treeBtn && libraryResults.contains(treeBtn)){
    if(treeBtn.dataset.hasChildren==="true"){
      const key=treeBtn.dataset.treeKey;
      const shell=treeBtn.closest(".tree-row-shell");
      const item=shell?.parentElement;
      const children=[...(item?.children||[])].find(el=>el.classList?.contains("tree-children"));
      const willOpen=treeBtn.getAttribute("aria-expanded")!=="true";

      treeBtn.setAttribute("aria-expanded",String(willOpen));
      treeBtn.classList.toggle("expanded",willOpen);
      shell?.classList.toggle("is-expanded",willOpen);

      if(children?.classList.contains("tree-children")){
        children.classList.toggle("open",willOpen);
      }

      if(willOpen) expandedNodes.add(key);
      else expandedNodes.delete(key);
    }
    return;
  }

  const noteBtn=e.target.closest("[data-note-path]");
  if(noteBtn && libraryResults.contains(noteBtn)){
    openArvioNote(noteBtn.dataset.notePath.split("›"));
  }
});




let pendingLibraryDeletePath=null;
let pendingLibraryConfirmTimer=0;

function closeLibraryItemActions({immediate=false}={}){
  const overlay=document.querySelector("#library-item-action-overlay");
  if(!overlay) return;
  if(immediate){ overlay.remove(); return; }
  overlay.classList.remove("is-open");
  overlay.classList.add("is-closing");
  setTimeout(()=>overlay.remove(),ARVIO_MOTION.libraryActionClose);
}

function closeLibraryManageOverlay(id,{immediate=false}={}){
  const overlay=document.querySelector(`#${id}`);
  if(!overlay) return;
  if(immediate){ overlay.remove(); return; }
  overlay.classList.remove("is-open");
  overlay.classList.add("is-closing");
  setTimeout(()=>overlay.remove(),260);
}

function openLibraryRenameSheet(path){
  closeLibraryManageOverlay("library-rename-overlay",{immediate:true});
  const found=findLibraryNode(path);
  if(!found) return;

  const overlay=document.createElement("div");
  overlay.id="library-rename-overlay";
  overlay.className="library-manage-overlay";
  overlay.innerHTML=`
    <div class="library-manage-sheet library-rename-sheet" role="dialog" aria-modal="true" aria-labelledby="library-rename-title">
      <span class="library-sheet-grabber" aria-hidden="true"></span>
      <div class="library-manage-head">
        <span>RENAME</span>
        <h2 id="library-rename-title">Rename note</h2>
        <p>${escapeHtml(found.path.join(" › "))}</p>
      </div>
      <label class="library-manage-field">
        <span>Note name</span>
        <input class="library-rename-input" type="text" maxlength="80" value="${escapeHtml(found.node.title)}" autocomplete="off" spellcheck="true">
      </label>
      <div class="library-manage-actions">
        <button class="library-manage-cancel" type="button">Cancel</button>
        <button class="library-manage-primary library-rename-save" type="button">Rename</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input=overlay.querySelector(".library-rename-input");
  const submit=()=>{
    const result=renameLibraryPath(found.path,input.value);
    if(!result.ok){
      input.classList.add("is-invalid");
      input.focus();
      return;
    }
    const button=overlay.querySelector(".library-rename-save");
    button.textContent=result.adjusted?"Renamed safely":"Renamed";
    button.classList.add("is-done");
    renderLibrary(librarySearch?.value||"");
    setTimeout(()=>{
      closeLibraryManageOverlay("library-rename-overlay");
      setTimeout(()=>focusLibraryPath(result.path),190);
    },260);
  };

  overlay.addEventListener("click",e=>{
    if(e.target===overlay || e.target.closest(".library-manage-cancel")){
      closeLibraryManageOverlay("library-rename-overlay");
      return;
    }
    if(e.target.closest(".library-rename-save")) submit();
  });
  input.addEventListener("keydown",e=>{
    if(e.key==="Enter"){ e.preventDefault(); submit(); }
    if(e.key==="Escape") closeLibraryManageOverlay("library-rename-overlay");
  });
  input.addEventListener("input",()=>input.classList.remove("is-invalid"));

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    overlay.classList.add("is-open");
    setTimeout(()=>{ input.focus({preventScroll:true}); input.select(); },120);
  }));
}

function openLibraryMoveSheet(path){
  closeLibraryManageOverlay("library-move-overlay",{immediate:true});
  const found=findLibraryNode(path);
  if(!found) return;

  const entries=getMoveDestinationEntries(found.path);
  const overlay=document.createElement("div");
  overlay.id="library-move-overlay";
  overlay.className="library-manage-overlay";
  overlay.innerHTML=`
    <div class="library-manage-sheet library-move-sheet" role="dialog" aria-modal="true" aria-labelledby="library-move-title">
      <span class="library-sheet-grabber" aria-hidden="true"></span>
      <div class="library-manage-head">
        <span>MOVE NOTE</span>
        <h2 id="library-move-title">Choose a destination</h2>
        <p>Move “${escapeHtml(found.node.title)}” without changing when it was created.</p>
      </div>
      <div class="library-move-list">
        ${entries.map(entry=>`
          <button
            class="library-move-destination ${entry.current?"is-current":""} ${entry.blocked?"is-blocked":""}"
            type="button"
            data-move-destination="${escapeHtml(entry.key)}"
            ${entry.current||entry.blocked?"disabled":""}
          >
            <span class="library-move-glyph" aria-hidden="true">${entry.key?"▤":"⌂"}</span>
            <span class="library-move-copy">
              <strong>${escapeHtml(entry.key?entry.title:"Library root")}</strong>
              <small>${entry.current?"Current location":entry.blocked?"Inside this note":escapeHtml(entry.display)}</small>
            </span>
            <span class="library-move-arrow" aria-hidden="true">›</span>
          </button>
        `).join("")}
      </div>
      <button class="library-manage-cancel library-move-cancel" type="button">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click",e=>{
    if(e.target===overlay || e.target.closest(".library-manage-cancel")){
      closeLibraryManageOverlay("library-move-overlay");
      return;
    }

    const row=e.target.closest("[data-move-destination]");
    if(!row || row.disabled) return;
    row.classList.add("is-selected");
    const key=row.dataset.moveDestination;
    const target=key?key.split("›"):[];
    const result=moveLibraryPath(found.path,target);
    if(!result.ok){
      row.classList.remove("is-selected");
      return;
    }
    row.querySelector(".library-move-arrow").textContent="✓";
    renderLibrary(librarySearch?.value||"");
    setTimeout(()=>{
      closeLibraryManageOverlay("library-move-overlay");
      setTimeout(()=>focusLibraryPath(result.path),190);
    },300);
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add("is-open")));
}

function openLibraryItemActions(pathKey,trigger){
  clearTimeout(pendingLibraryConfirmTimer);
  closeLibraryItemActions({immediate:true});
  const found=findLibraryNode(pathKey.split("›"));
  if(!found) return;

  const overlay=document.createElement("div");
  overlay.id="library-item-action-overlay";
  overlay.className="library-item-action-overlay";
  const isParent=Array.isArray(found.node.children)&&found.node.children.length>0;
  const count=countLibrarySubtree(found.node);
  overlay.innerHTML=`
    <div class="library-item-action-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(found.node.title)} actions">
      <span class="library-sheet-grabber" aria-hidden="true"></span>
      <div class="library-item-action-head">
        <span>${isParent?"PARENT NOTE":"NOTE"}</span>
        <strong>${escapeHtml(found.node.title)}</strong>
        <small>${escapeHtml(found.path.join(" › "))}</small>
      </div>

      <div class="library-item-action-list">
        <button class="library-item-action library-item-add-child" type="button" data-library-action="add-child">
          <span class="library-item-action-icon" aria-hidden="true">＋</span>
          <span><strong>Add nested note</strong><small>Create a new note inside this one.</small></span>
        </button>
        <button class="library-item-action" type="button" data-library-action="rename">
          <span class="library-item-action-icon" aria-hidden="true">✎</span>
          <span><strong>Rename</strong><small>Change this note’s name.</small></span>
        </button>
        <button class="library-item-action" type="button" data-library-action="move">
          <span class="library-item-action-icon" aria-hidden="true">↗</span>
          <span><strong>Move</strong><small>Choose another location in Library.</small></span>
        </button>
        <button class="library-item-action" type="button" data-library-action="duplicate">
          <span class="library-item-action-icon" aria-hidden="true">⧉</span>
          <span><strong>Duplicate</strong><small>${isParent?"Copy this entire branch.":"Create a copy beside this note."}</small></span>
        </button>
      </div>

      <div class="library-item-action-divider"></div>

      <button class="library-item-delete" type="button" data-library-action="trash">
        <span class="library-item-delete-icon" aria-hidden="true">⌫</span>
        <span><strong>Move to Trash</strong><small>${isParent?`${count-1} nested item${count-1===1?"":"s"} will move with it.`:"You can restore it later from Trash."}</small></span>
      </button>
      <button class="library-item-cancel" type="button">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);

  if(window.matchMedia("(min-width:761px)").matches && trigger){
    const rect=trigger.getBoundingClientRect();
    const sheet=overlay.querySelector(".library-item-action-sheet");
    const estimatedHeight=430;
    sheet.style.left=`${Math.max(12,Math.min(window.innerWidth-320,rect.right-306))}px`;
    sheet.style.top=`${Math.max(12,Math.min(window.innerHeight-estimatedHeight,rect.bottom+8))}px`;
  }

  overlay.addEventListener("click",e=>{
    if(e.target===overlay || e.target.closest(".library-item-cancel")){
      closeLibraryItemActions();
      return;
    }

    const action=e.target.closest("[data-library-action]")?.dataset.libraryAction;
    if(!action) return;

    if(action==="rename"){
      closeLibraryItemActions();
      setTimeout(()=>openLibraryRenameSheet(found.path),ARVIO_MOTION.libraryActionClose+30);
      return;
    }

    if(action==="move"){
      closeLibraryItemActions();
      setTimeout(()=>openLibraryMoveSheet(found.path),ARVIO_MOTION.libraryActionClose+30);
      return;
    }

    if(action==="add-child"){
      closeLibraryItemActions();
      setTimeout(()=>createDraftAtPath(found.path),ARVIO_MOTION.libraryActionClose+30);
      return;
    }

    if(action==="duplicate"){
      const button=e.target.closest("[data-library-action='duplicate']");
      if(button.disabled) return;
      button.disabled=true;
      const result=duplicateLibraryPath(found.path);
      if(!result.ok){ closeLibraryItemActions(); return; }
      button.classList.add("is-done");
      button.querySelector("strong").textContent="Duplicated";
      button.querySelector("small").textContent="A fresh copy is ready in Library.";
      renderLibrary(librarySearch?.value||"");
      setTimeout(()=>{
        closeLibraryItemActions();
        setTimeout(()=>focusLibraryPath(result.path),180);
      },360);
      return;
    }

    if(action==="trash"){
      closeLibraryItemActions();
      clearTimeout(pendingLibraryConfirmTimer);
      pendingLibraryConfirmTimer=setTimeout(()=>{
        pendingLibraryConfirmTimer=0;
        openLibraryDeleteConfirm(found.path);
      },ARVIO_MOTION.libraryActionClose+35);
    }
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add("is-open")));
}

function closeLibraryDeleteConfirm({immediate=false}={}){
  const overlay=document.querySelector("#library-delete-overlay");
  pendingLibraryDeletePath=null;
  if(!overlay) return;
  if(immediate){ overlay.remove(); return; }
  overlay.classList.remove("is-open");
  overlay.classList.add("is-closing");
  setTimeout(()=>overlay.remove(),ARVIO_MOTION.libraryConfirmClose);
}

function openLibraryDeleteConfirm(path){
  closeLibraryDeleteConfirm({immediate:true});
  const found=findLibraryNode(path);
  if(!found) return;
  pendingLibraryDeletePath=[...found.path];

  const isParent=Array.isArray(found.node.children)&&found.node.children.length>0;
  const count=countLibrarySubtree(found.node);
  const overlay=document.createElement("div");
  overlay.id="library-delete-overlay";
  overlay.className="library-delete-overlay";
  overlay.innerHTML=`
    <div class="library-delete-sheet" role="dialog" aria-modal="true" aria-labelledby="library-delete-title">
      <span class="library-sheet-grabber" aria-hidden="true"></span>
      <div class="library-delete-icon" aria-hidden="true">⌫</div>
      <h2 id="library-delete-title">Move “${escapeHtml(found.node.title)}” to Trash?</h2>
      <p>${isParent
        ? `This parent and ${count-1} item${count-1===1?"":"s"} inside it will move together. You can restore the whole branch from Trash.`
        : `This note will leave the Library, but you can restore it later from Trash.`}</p>
      <div class="library-delete-actions">
        <button class="library-delete-cancel" type="button">Cancel</button>
        <button class="library-delete-confirm" type="button">Move to Trash</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click",e=>{
    if(e.target===overlay || e.target.closest(".library-delete-cancel")) closeLibraryDeleteConfirm();
    const confirm=e.target.closest(".library-delete-confirm");
    if(confirm && pendingLibraryDeletePath){
      confirm.disabled=true;
      confirm.textContent="Moving…";
      const deleted=removeLibraryPath(pendingLibraryDeletePath,{recordTrash:true});
      if(deleted){
        const search=document.querySelector("#library-search");
        renderLibrary(search?.value||"");
        confirm.textContent="Moved to Trash";
        confirm.classList.add("is-done");
        setTimeout(closeLibraryDeleteConfirm,430);
      }else{
        closeLibraryDeleteConfirm();
      }
    }
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add("is-open")));
}

function closeLibraryTrashSheet(){
  const overlay=document.querySelector("#library-trash-overlay");
  if(!overlay) return;
  clearTimeout(overlay._trashDeleteArmTimer);
  overlay.classList.remove("is-open");
  overlay.classList.add("is-closing");
  setTimeout(()=>overlay.remove(),220);
}

function permanentlyDeleteLibraryTrashItems(ids){
  const selected=new Set(ids);
  const before=libraryTrash.length;
  const deleting=libraryTrash.filter(item=>selected.has(item.id));
  libraryTrash=libraryTrash.filter(item=>!selected.has(item.id));
  deleting.forEach(item=>{
    if(!findLibraryNode(item.path)) removeCreatedAtPrefix(item.path);
    deleteLibrarySubtreeRecordsFromIndexedDB(item.node);
  });
  if(libraryTrash.length!==before){
    persistLibraryTrash();
    persistLibraryState();
  }
  return before-libraryTrash.length;
}

function selectedTrashIds(overlay){
  return [...(overlay?.querySelectorAll(".library-trash-select:checked")||[])]
    .map(input=>input.value)
    .filter(Boolean);
}

function resetTrashPermanentDeleteArm(overlay){
  if(!overlay) return;
  clearTimeout(overlay._trashDeleteArmTimer);
  overlay.dataset.deleteArmed="false";
  const button=overlay.querySelector(".library-trash-permanent");
  if(button){
    button.classList.remove("is-armed");
    button.textContent="Delete permanently";
  }
}

function updateLibraryTrashActions(overlay){
  if(!overlay) return;
  const ids=selectedTrashIds(overlay);
  const count=ids.length;
  const summary=overlay.querySelector(".library-trash-selection-count");
  const support=overlay.querySelector(".library-trash-selection-support");
  const restore=overlay.querySelector(".library-trash-restore-selected");
  const permanent=overlay.querySelector(".library-trash-permanent");

  if(summary) summary.textContent=count ? `${count} selected` : "Select notes";
  if(support) support.textContent=count ? "Choose what happens to the selected notes." : "Tap a card or checkbox to select it.";
  if(restore) restore.disabled=!count;
  if(permanent) permanent.disabled=!count;

  overlay.querySelectorAll(".library-trash-row").forEach(row=>{
    const checked=Boolean(row.querySelector(".library-trash-select")?.checked);
    row.classList.toggle("is-selected",checked);
  });

  resetTrashPermanentDeleteArm(overlay);
}

function renderLibraryTrashList(container,selectedIds=[]){
  if(!container) return;
  const selected=new Set(selectedIds);

  if(!libraryTrash.length){
    container.innerHTML=`
      <div class="library-trash-empty">
        <span aria-hidden="true">⌫</span>
        <strong>Trash is empty</strong>
        <p>Deleted notes will appear here until you permanently remove them.</p>
      </div>
    `;
    return;
  }

  container.innerHTML=libraryTrash.map(item=>{
    const count=countLibrarySubtree(item.node);
    const checked=selected.has(item.id);
    return `
      <label class="library-trash-row ${checked?"is-selected":""}" data-trash-id="${escapeHtml(item.id)}">
        <input class="library-trash-select" type="checkbox" value="${escapeHtml(item.id)}" ${checked?"checked":""} aria-label="Select ${escapeHtml(item.node.title)}">
        <span class="library-trash-check" aria-hidden="true"><span></span></span>
        <span class="library-trash-glyph" aria-hidden="true">▤</span>
        <span class="library-trash-copy">
          <strong>${escapeHtml(item.node.title)}</strong>
          <small>${escapeHtml(item.path.join(" › "))}</small>
          <em>${count>1?`${count} items · `:""}${escapeHtml(formatTrashTime(item.deletedAt))}</em>
        </span>
      </label>
    `;
  }).join("");
}

function openLibraryTrashSheet(){
  closeLibraryOptions();
  document.querySelector("#library-trash-overlay")?.remove();
  const overlay=document.createElement("div");
  overlay.id="library-trash-overlay";
  overlay.className="library-trash-overlay";
  overlay.dataset.deleteArmed="false";
  overlay.innerHTML=`
    <div class="library-trash-sheet" role="dialog" aria-modal="true" aria-labelledby="library-trash-title">
      <div class="library-trash-head">
        <div class="library-trash-title-copy">
          <span>LIBRARY</span>
          <h2 id="library-trash-title">Trash</h2>
          <p>Select one or more notes to restore or permanently delete.</p>
        </div>
        <button class="library-trash-close" type="button" aria-label="Close Trash">×</button>
      </div>
      <div class="library-trash-list"></div>
      <div class="library-trash-footer">
        <div class="library-trash-selection-copy">
          <strong class="library-trash-selection-count">Select notes</strong>
          <small class="library-trash-selection-support">Tap a card or checkbox to select it.</small>
        </div>
        <div class="library-trash-actions">
          <button class="library-trash-restore-selected" type="button" disabled>Restore</button>
          <button class="library-trash-permanent" type="button" disabled>Delete permanently</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  renderLibraryTrashList(overlay.querySelector(".library-trash-list"));
  updateLibraryTrashActions(overlay);

  overlay.addEventListener("change",e=>{
    if(!e.target.matches(".library-trash-select")) return;
    updateLibraryTrashActions(overlay);
  });

  overlay.addEventListener("click",e=>{
    if(e.target===overlay || e.target.closest(".library-trash-close")){
      closeLibraryTrashSheet();
      return;
    }

    const restore=e.target.closest(".library-trash-restore-selected");
    if(restore && !restore.disabled){
      const ids=selectedTrashIds(overlay);
      const ordered=ids
        .map(id=>libraryTrash.find(item=>item.id===id))
        .filter(Boolean)
        .sort((a,b)=>a.path.length-b.path.length);

      let restored=0;
      const failed=[];
      ordered.forEach(item=>{
        const result=restoreLibraryTrashItem(item.id);
        if(result.ok) restored++;
        else failed.push(item.id);
      });

      renderLibrary(document.querySelector("#library-search")?.value||"");
      renderLibraryTrashList(overlay.querySelector(".library-trash-list"),failed);
      updateLibraryTrashActions(overlay);

      const support=overlay.querySelector(".library-trash-selection-support");
      if(support){
        support.textContent=failed.length
          ? `${restored} restored. ${failed.length} still need their parent restored first.`
          : `${restored} note${restored===1?"":"s"} restored.`;
      }
      return;
    }

    const permanent=e.target.closest(".library-trash-permanent");
    if(permanent && !permanent.disabled){
      const ids=selectedTrashIds(overlay);
      if(overlay.dataset.deleteArmed!=="true"){
        overlay.dataset.deleteArmed="true";
        permanent.classList.add("is-armed");
        permanent.textContent=`Confirm delete ${ids.length}`;
        clearTimeout(overlay._trashDeleteArmTimer);
        overlay._trashDeleteArmTimer=setTimeout(()=>resetTrashPermanentDeleteArm(overlay),3600);
        return;
      }

      const removed=permanentlyDeleteLibraryTrashItems(ids);
      resetTrashPermanentDeleteArm(overlay);
      renderLibraryTrashList(overlay.querySelector(".library-trash-list"));
      updateLibraryTrashActions(overlay);
      const support=overlay.querySelector(".library-trash-selection-support");
      if(support) support.textContent=`${removed} note${removed===1?"":"s"} permanently deleted.`;
    }
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add("is-open")));
}

function closeLibraryOptions(){
  const menu=document.querySelector("#library-options-menu");
  if(!menu) return;
  menu.classList.remove("is-open");
  menu.classList.add("is-closing");
  setTimeout(()=>menu.remove(),210);
}

document.querySelector("#library-menu").addEventListener("click",e=>{
  e.stopPropagation();
  const existing=document.querySelector("#library-options-menu");
  if(existing){ closeLibraryOptions(); return; }

  const menu=document.createElement("div");
  menu.id="library-options-menu";
  menu.className="library-options-menu";
  menu.innerHTML=`
    <div class="menu-label">LIBRARY</div>
    <button class="trash-action" type="button">
      <span class="trash-action-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6.5 7l.7 13h9.6l.7-13"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
      </span>
      <span class="trash-action-copy"><strong>Trash</strong><small>Review deleted notes</small></span>
    </button>
  `;
  document.body.appendChild(menu);

  const rect=e.currentTarget.getBoundingClientRect();
  menu.style.left=`${Math.max(12,rect.right-180)}px`;
  menu.style.top=`${rect.bottom+8}px`;

  requestAnimationFrame(()=>requestAnimationFrame(()=>menu.classList.add("is-open")));

  menu.querySelector(".trash-action").addEventListener("click",()=>{
    closeLibraryOptions();
    setTimeout(openLibraryTrashSheet,120);
  });
});

document.addEventListener("click",e=>{
  const menu=document.querySelector("#library-options-menu");
  if(menu && !menu.contains(e.target) && !e.target.closest("#library-menu")){
    closeLibraryOptions();
  }
});

const editor=document.querySelector("#editor-body");
const noteTitleInput=document.querySelector(".note-title");
let saveTimer;
let activeLocalNoteKey="note:toyota/avanza/durability";
let activeNotePath=["Toyota","Avanza","Durability"];
let activeNoteIsDraft=false;
let noteDirty=false;
let noteRevision=0;
let savedNoteRevision=0;
let noteSaveChain=Promise.resolve();

function activeNoteCreatedAt(){
  const found=findLibraryNode(activeNotePath);
  return found?.node?.createdAt || libraryCreatedAt[activeNotePath.join("›")] || new Date().toISOString();
}

function buildActiveNotePayload(revision=noteRevision){
  const found=findLibraryNode(activeNotePath);
  const now=new Date().toISOString();
  return {
    key:activeLocalNoteKey,
    noteId:found?.node?.id || activeLocalNoteKey.replace(/^noteid:/,""),
    title:noteTitleInput?.value || "Untitled",
    html:editor?.innerHTML || "",
    text:editor?.innerText?.trim() || "",
    path:[...activeNotePath],
    pathLabel:activeNotePath.join(" › "),
    createdAt:activeNoteCreatedAt(),
    updatedAt:now,
    lastOpenedAt:found?.node?.lastOpenedAt || now,
    revision
  };
}

async function putNotePayload(payload){
  try{
    await writeArvioStore(ARVIO_NOTE_STORE,payload);
    return true;
  }catch{
    // Minimal fallback only when IndexedDB cannot be used.
    try{
      localStorage.setItem("arvioFallbackNote",JSON.stringify(payload));
      return true;
    }catch{return false}
  }
}

async function saveNoteLocally(revision=noteRevision){
  syncActiveNoteIntoLibrary();
  const payload=buildActiveNotePayload(revision);

  const run=async()=>{
    const ok=await putNotePayload(payload);
    if(ok){
      if(revision>=savedNoteRevision) savedNoteRevision=revision;
      if(revision===noteRevision) noteDirty=false;
      persistLibraryState();
    }
    return ok;
  };

  noteSaveChain=noteSaveChain.then(run,run);
  return noteSaveChain;
}

async function loadNoteLocally(key,legacyKey=null){
  try{
    let item=await readArvioStore(ARVIO_NOTE_STORE,key);
    if(!item && legacyKey){
      item=await readArvioStore(ARVIO_NOTE_STORE,legacyKey);
      if(item){
        const migrated={...item,key,noteId:key.replace(/^noteid:/,""),path:[...activeNotePath],pathLabel:activeNotePath.join(" › ")};
        await writeArvioStore(ARVIO_NOTE_STORE,migrated);
        await deleteArvioStoreRecord(ARVIO_NOTE_STORE,legacyKey).catch(()=>{});
        item=migrated;
      }
    }
    return item;
  }catch{
    try{
      const item=JSON.parse(localStorage.getItem("arvioFallbackNote")||"null");
      return (item?.key===key || (legacyKey && item?.key===legacyKey)) ? item : null;
    }catch{return null}
  }
}

async function hydrateLibraryNoteContentFromIndexedDB(){
  try{
    const records=await getAllArvioStoreRecords(ARVIO_NOTE_STORE);
    const byId=new Map(records.filter(item=>item?.noteId).map(item=>[item.noteId,item]));
    flattenTree(libraryTree).forEach(entry=>{
      const record=byId.get(entry.node.id);
      if(!record) return;
      entry.node.html=record.html || entry.node.html || "";
      entry.node.body=record.text || entry.node.body || "";
      entry.node.updatedAt=record.updatedAt || entry.node.updatedAt;
      entry.node.lastOpenedAt=record.lastOpenedAt || entry.node.lastOpenedAt;
      entry.node.createdAt=record.createdAt || entry.node.createdAt;
    });
  }catch{}
}

async function seedIndexedDbNotesFromLibrary(){
  try{
    const existing=await getAllArvioStoreRecords(ARVIO_NOTE_STORE);
    const existingKeys=new Set(existing.map(item=>item.key));
    const writes=[];
    flattenTree(libraryTree).forEach(entry=>{
      if(!entry.node.id) return;
      const key=`noteid:${entry.node.id}`;
      if(existingKeys.has(key)) return;
      const created=entry.node.createdAt || libraryCreatedAt[entry.path.join("›")] || new Date().toISOString();
      const updated=entry.node.updatedAt || created;
      writes.push(writeArvioStore(ARVIO_NOTE_STORE,{
        key,
        noteId:entry.node.id,
        title:entry.node.title,
        html:entry.node.html || (entry.node.body?`<p>${escapeHtml(entry.node.body)}</p>`:""),
        text:entry.node.body || "",
        path:[...entry.path],
        pathLabel:entry.path.join(" › "),
        createdAt:created,
        updatedAt:updated,
        lastOpenedAt:entry.node.lastOpenedAt || null,
        revision:0
      }));
    });
    await Promise.all(writes);
  }catch{}
}

async function syncLibrarySubtreeRecordsToIndexedDB(node,path){
  if(!node?.id) return;
  try{
    const key=`noteid:${node.id}`;
    const existing=await readArvioStore(ARVIO_NOTE_STORE,key).catch(()=>null);
    const created=node.createdAt || libraryCreatedAt[path.join("›")] || existing?.createdAt || new Date().toISOString();
    const updated=node.updatedAt || existing?.updatedAt || created;
    await writeArvioStore(ARVIO_NOTE_STORE,{
      ...(existing||{}),
      key,
      noteId:node.id,
      title:node.title,
      html:node.html ?? existing?.html ?? (node.body?`<p>${escapeHtml(node.body)}</p>`:""),
      text:node.body ?? existing?.text ?? "",
      path:[...path],
      pathLabel:path.join(" › "),
      createdAt:created,
      updatedAt:updated,
      lastOpenedAt:node.lastOpenedAt || existing?.lastOpenedAt || null,
      revision:Number(existing?.revision||0)
    });
    if(Array.isArray(node.children)){
      for(const child of node.children){
        await syncLibrarySubtreeRecordsToIndexedDB(child,[...path,child.title]);
      }
    }
  }catch{}
}

async function deleteLibrarySubtreeRecordsFromIndexedDB(node){
  if(!node) return;
  if(node.id){
    await deleteArvioStoreRecord(ARVIO_NOTE_STORE,`noteid:${node.id}`).catch(()=>{});
  }
  if(Array.isArray(node.children)){
    for(const child of node.children){
      await deleteLibrarySubtreeRecordsFromIndexedDB(child);
    }
  }
}

function remapLibraryCreatedAtPrefix(oldPath,newPath){
  const oldKey=oldPath.join("›");
  const newKey=newPath.join("›");
  Object.keys(libraryCreatedAt).forEach(key=>{
    if(key===oldKey || key.startsWith(`${oldKey}›`)){
      const suffix=key.slice(oldKey.length);
      libraryCreatedAt[`${newKey}${suffix}`]=libraryCreatedAt[key];
      if(`${newKey}${suffix}`!==key) delete libraryCreatedAt[key];
    }
  });
}

function refreshCurrentBreadcrumbLabel(){
  const current=document.querySelector(".note-breadcrumb .crumb.current");
  if(current) current.textContent=activeNotePath[activeNotePath.length-1] || "Untitled";
}

function syncActiveNoteTitleIntoLibrary(){
  if(!activeNotePath?.length || !noteTitleInput) return;
  const found=findLibraryNode(activeNotePath);
  if(!found) return;

  const typed=noteTitleInput.value.trim();
  const nextTitle=typed || "Untitled";
  if(found.node.title===nextTitle) return;

  const oldPath=[...activeNotePath];
  found.node.title=nextTitle;
  activeNotePath=[...found.parentPath,nextTitle];
  remapLibraryCreatedAtPrefix(oldPath,activeNotePath);
  refreshCurrentBreadcrumbLabel();
  persistLibraryState();
}

function syncActiveNoteIntoLibrary(){
  if(!activeNotePath?.length) return;
  syncActiveNoteTitleIntoLibrary();
  const found=findLibraryNode(activeNotePath);
  if(!found) return;
  const now=new Date().toISOString();
  found.node.html=editor?.innerHTML || found.node.html || "";
  found.node.body=editor?.innerText?.trim() || "";
  found.node.updatedAt=now;
  if(!found.node.createdAt) found.node.createdAt=libraryCreatedAt[activeNotePath.join("›")] || now;
  persistLibraryState();
}

function setNoteSaveStatus(state,text){
  const status=document.querySelector(".save-status");
  if(!status) return;
  status.dataset.state=state;
  status.textContent=text;
}

async function restoreLocalNoteIfPresent(key,legacyKey=null){
  const local=await loadNoteLocally(key,legacyKey);
  if(!local){
    noteDirty=false;
    setNoteSaveStatus("saved","Saved");
    return;
  }
  const found=findLibraryNode(activeNotePath);
  if(noteTitleInput) noteTitleInput.value=found?.node?.title || noteTitleInput.value || local.title || "Untitled";
  if(local.html) editor.innerHTML=local.html;
  if(found?.node){
    found.node.html=local.html || found.node.html;
    found.node.body=local.text || found.node.body;
    found.node.updatedAt=local.updatedAt || found.node.updatedAt;
  }
  noteRevision=Math.max(noteRevision,Number(local.revision||0));
  savedNoteRevision=noteRevision;
  noteDirty=false;
  setNoteSaveStatus("saved","Saved");
}

function queueLocalSave(){
  noteDirty=true;
  const revision=++noteRevision;
  setNoteSaveStatus("saving","Saving…");
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    const ok=await saveNoteLocally(revision);
    if(revision!==noteRevision) return;
    setNoteSaveStatus(ok?"saved":"error",ok?"Saved":"Couldn’t save");
    if(ok) renderHomeDashboard();
  },420);
}

async function flushLocalSave({quiet=false,force=false}={}){
  clearTimeout(saveTimer);
  if(!editor || !noteTitleInput) return false;
  if(!force && !noteDirty) return true;
  const revision=noteRevision || ++noteRevision;
  if(!quiet) setNoteSaveStatus("saving","Saving…");
  const ok=await saveNoteLocally(revision);
  if(!quiet){
    setNoteSaveStatus(ok?"saved":"error",ok?"Saved":"Couldn’t save");
  }
  if(ok) renderHomeDashboard();
  return ok;
}

window.addEventListener("pagehide",()=>{
  if(document.querySelector("#page-note.active") && noteDirty) flushLocalSave({quiet:true});
  persistLibraryStateNow();
});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden"){
    if(document.querySelector("#page-note.active") && noteDirty) flushLocalSave({quiet:true});
    persistLibraryStateNow();
  }
});
window.addEventListener("offline",()=>{
  if(document.querySelector("#page-note.active")) setNoteSaveStatus("saved","Offline · saved on device");
});
window.addEventListener("online",()=>{
  if(document.querySelector("#page-note.active")) setNoteSaveStatus("saved",noteDirty?"Saving…":"Saved");
});
editor.addEventListener("input",queueLocalSave);
noteTitleInput?.addEventListener("input",()=>{
  syncActiveNoteTitleIntoLibrary();
  queueLocalSave();
});

/* editorBody must exist before mobile focus listeners are bound. */
const editorBody = editor;

/* v2.2 — mobile writing focus state */
function syncMobileEditorFocus(){
  const active=document.activeElement;
  const focused=
    active===editorBody ||
    active===noteTitleInput ||
    editorBody.contains(active);

  document.body.classList.toggle("mobile-editor-focused",Boolean(focused));
}

editorBody.addEventListener("focus",syncMobileEditorFocus);
editorBody.addEventListener("blur",()=>setTimeout(syncMobileEditorFocus,40));
noteTitleInput?.addEventListener("focus",syncMobileEditorFocus);
noteTitleInput?.addEventListener("blur",()=>setTimeout(syncMobileEditorFocus,40));

/* iPhone visual viewport: keep floating controls above the keyboard. */
function updateArvioVisualViewport(){
  const vv=window.visualViewport;
  let keyboardInset=0;
  if(vv){
    keyboardInset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
  }
  document.documentElement.style.setProperty("--arvio-keyboard-inset",`${keyboardInset}px`);
  document.body.classList.toggle("keyboard-open",keyboardInset>100);
}
window.visualViewport?.addEventListener("resize",updateArvioVisualViewport);
window.visualViewport?.addEventListener("scroll",updateArvioVisualViewport);
window.addEventListener("resize",updateArvioVisualViewport);
updateArvioVisualViewport();

// Note editor interactions
const commandMenu = document.querySelector("#command-menu");
const formatMenu = document.querySelector("#format-menu");
let savedRange = null;

function getArvioSafeTopInset(){
  const raw=getComputedStyle(document.documentElement).getPropertyValue("--arvio-safe-top");
  const parsed=parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSelectionActiveRect(sel,range,mobile=false){
  if(!mobile) return range.getBoundingClientRect();

  // Follow the handle the user is actively moving on iOS instead of anchoring
  // to the full selection box. A multi-line Range keeps its top edge at the
  // first selected line, which made the Arvio toolbar appear "stuck" above.
  try{
    const focusNode=sel.focusNode;
    if(focusNode && editorBody.contains(focusNode)){
      const focusRange=document.createRange();
      if(focusNode.nodeType===Node.TEXT_NODE){
        const max=focusNode.textContent?.length || 0;
        const offset=Math.max(0,Math.min(sel.focusOffset,max));
        focusRange.setStart(focusNode,offset);
        focusRange.setEnd(focusNode,offset);
      }else{
        const max=focusNode.childNodes?.length || 0;
        const offset=Math.max(0,Math.min(sel.focusOffset,max));
        focusRange.setStart(focusNode,offset);
        focusRange.setEnd(focusNode,offset);
      }
      const focusRects=focusRange.getClientRects();
      const focusRect=focusRects[0] || focusRange.getBoundingClientRect();
      if(focusRect && (focusRect.height || focusRect.width)) return focusRect;
    }
  }catch{}

  const rects=Array.from(range.getClientRects()).filter(r=>r.height || r.width);
  if(rects.length){
    // Safari may return an empty rectangle for a collapsed focus range.
    // Work out which edge of the selection is the active/focus edge.
    let focusAtEnd=true;
    try{
      const anchorRange=document.createRange();
      anchorRange.setStart(sel.anchorNode,sel.anchorOffset);
      anchorRange.collapse(true);
      const focusRange=document.createRange();
      focusRange.setStart(sel.focusNode,sel.focusOffset);
      focusRange.collapse(true);
      focusAtEnd=anchorRange.compareBoundaryPoints(Range.START_TO_START,focusRange)<=0;
    }catch{}
    return focusAtEnd ? rects[rects.length-1] : rects[0];
  }

  return range.getBoundingClientRect();
}

function placeMenuNearSelection(menu){
  const sel=window.getSelection();
  if(!sel || !sel.rangeCount || sel.isCollapsed) return;

  const range=sel.getRangeAt(0);
  const vv=window.visualViewport;
  const viewportLeft=vv?.offsetLeft || 0;
  const viewportTop=vv?.offsetTop || 0;
  const viewportWidth=vv?.width || window.innerWidth;
  const mobile=window.matchMedia("(max-width: 760px)").matches;
  const rect=getSelectionActiveRect(sel,range,mobile);

  // Native iOS edit-menu geometry is not exposed to webpages. Keep a smaller
  // reserved lane than before so the custom toolbar remains close to the
  // selection while still sitting above the native Cut / Copy / Paste menu.
  const estimatedWidth=Math.min(mobile ? 286 : 300,viewportWidth-16);
  const centerX=rect.left + rect.width/2;
  const left=Math.max(
    viewportLeft+8,
    Math.min(centerX-estimatedWidth/2,viewportLeft+viewportWidth-estimatedWidth-8)
  );

  const nativeMenuLane=mobile ? 50 : 46;
  const toolbarHeight=mobile ? 46 : 50;
  const safeInset=mobile ? getArvioSafeTopInset() : 0;
  const safeTop=viewportTop + (mobile ? Math.max(10,safeInset+8) : 8);
  const viewportBottom=viewportTop+(vv?.height || window.innerHeight);
  const desiredTop=rect.top-nativeMenuLane-toolbarHeight;
  const maxTop=Math.max(safeTop,viewportBottom-toolbarHeight-8);
  const top=Math.max(safeTop,Math.min(desiredTop,maxTop));

  menu.style.position="fixed";
  menu.style.left=`${left}px`;
  menu.style.top=`${top}px`;
  menu.style.right="auto";
  menu.style.bottom="auto";
}
function saveSelection(){
  const sel=window.getSelection();
  if(sel && sel.rangeCount && !sel.isCollapsed) savedRange=sel.getRangeAt(0).cloneRange();
}
editorBody.addEventListener("mouseup",()=>{
  saveSelection();
  const sel=window.getSelection();
  if(sel && !sel.isCollapsed){
    placeMenuNearSelection(formatMenu);
    arvioShowFixedPopover(formatMenu);
  } else {
    arvioHideFixedPopover(formatMenu);
  }
});
editorBody.addEventListener("keyup",()=>{
  saveSelection();
  if(window.getSelection()?.isCollapsed) arvioHideFixedPopover(formatMenu);
});

let mobileSelectionFrame=null;
function refreshMobileSelectionBubble(){
  if(!window.matchMedia("(max-width: 760px)").matches) return;
  if(mobileSelectionFrame) cancelAnimationFrame(mobileSelectionFrame);
  mobileSelectionFrame=requestAnimationFrame(()=>{
    mobileSelectionFrame=null;
    const sel=window.getSelection();
    const inEditor=sel && sel.rangeCount &&
      ((sel.anchorNode && editorBody.contains(sel.anchorNode)) ||
       (sel.focusNode && editorBody.contains(sel.focusNode)));

    if(inEditor && !sel.isCollapsed){
      saveSelection();
      placeMenuNearSelection(formatMenu);
      arvioShowFixedPopover(formatMenu);
    }else if(sel?.isCollapsed || !inEditor){
      arvioHideFixedPopover(formatMenu);
    }
  });
}

function repositionOpenSelectionBubble(){
  if(window.matchMedia("(max-width: 760px)").matches &&
     !formatMenu.hidden && formatMenu.classList.contains("is-open")){
    refreshMobileSelectionBubble();
  }
}

editorBody.addEventListener("touchend",refreshMobileSelectionBubble,{passive:true});
// iOS does not always emit selectionchange on every pixel of a dragged handle.
// touchmove + scroll tracking keeps the bubble attached to the active handle.
editorBody.addEventListener("touchmove",repositionOpenSelectionBubble,{passive:true});
document.addEventListener("selectionchange",refreshMobileSelectionBubble);
window.addEventListener("scroll",repositionOpenSelectionBubble,{passive:true,capture:true});
document.querySelector(".main")?.addEventListener("scroll",repositionOpenSelectionBubble,{passive:true});
window.visualViewport?.addEventListener("resize",repositionOpenSelectionBubble);
window.visualViewport?.addEventListener("scroll",repositionOpenSelectionBubble);
window.addEventListener("orientationchange",()=>setTimeout(repositionOpenSelectionBubble,120));

let activeSlashRange=null;
let commandKeyboardIndex=0;

function getSlashContext(){
  const sel=window.getSelection();
  if(!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const range=sel.getRangeAt(0);
  const node=range.startContainer;
  if(node.nodeType!==Node.TEXT_NODE) return null;

  const before=node.data.slice(0,range.startOffset);
  const match=before.match(/\/([a-z]*)$/i);
  if(!match) return null;

  const tokenRange=document.createRange();
  tokenRange.setStart(node,range.startOffset-match[0].length);
  tokenRange.setEnd(node,range.startOffset);
  return {term:match[1].toLowerCase(),range:tokenRange};
}

function placeCommandNearCaret(){
  const sel=window.getSelection();
  if(!sel || !sel.rangeCount) return;
  const caret=sel.getRangeAt(0).cloneRange();
  caret.collapse(true);
  let rect=caret.getBoundingClientRect();

  // Empty lines can return a zero rectangle, so fall back near the editor.
  if(!rect || (!rect.width && !rect.height)){
    const eRect=editorBody.getBoundingClientRect();
    rect={left:eRect.left+24,top:eRect.top+55,bottom:eRect.top+75,width:1,height:20};
  }

  const pageRect=document.querySelector("#page-note").getBoundingClientRect();
  commandMenu.style.left=`${Math.max(190,Math.min(rect.left-pageRect.left+175,pageRect.width-190))}px`;
  commandMenu.style.top=`${Math.max(90,rect.bottom-pageRect.top+10)}px`;
}

function filterSlashCommands(term=""){
  const buttons=[...commandMenu.querySelectorAll("[data-command]")];

  const meta={
    link:{title:"link", keywords:["link","internal","note","connect"], index:0},
    image:{title:"image", keywords:["image","photo","picture"], index:1},
    highlight:{title:"highlight", keywords:["highlight","marker","stabilo"], index:2},
    heading:{title:"heading", keywords:["heading","header","title","h1"], index:3},
    bullet:{title:"bullet list", keywords:["bullet","list"], index:4}
  };

  function scoreCommand(cmd, rawTerm){
    const t=rawTerm.trim().toLowerCase();
    if(!t) return 0;
    const item=meta[cmd];
    if(!item) return 0;

    let best=0;
    const values=[item.title, ...item.keywords];

    values.forEach(v=>{
      if(v===t) best=Math.max(best,120);
      else if(v.startsWith(t)) best=Math.max(best,100);
      else if(v.split(/\s+/).some(word=>word.startsWith(t))) best=Math.max(best,88);
      else if(v.includes(t)) best=Math.max(best,62);
    });

    return best;
  }

  const visible=buttons
    .map(btn=>{
      const cmd=btn.dataset.command;
      const score=scoreCommand(cmd, term);
      const matches=!term || score>0;
      btn.classList.toggle("command-hidden", !matches);
      btn.classList.remove("keyboard-active");
      return {btn, cmd, score, matches, index:meta[cmd]?.index ?? 99};
    })
    .filter(item=>item.matches);

  // Bare slash: keep designed order and don't pre-highlight anything.
  if(!term){
    visible.sort((a,b)=>a.index-b.index).forEach(item=>commandMenu.appendChild(item.btn));
    commandKeyboardIndex=-1;
    return visible.map(v=>v.btn);
  }

  // Typed slash query: sort by relevance, then by default command order.
  visible
    .sort((a,b)=>(b.score-a.score) || (a.index-b.index))
    .forEach(item=>commandMenu.appendChild(item.btn));

  commandKeyboardIndex = visible.length ? 0 : -1;
  if(visible[commandKeyboardIndex]) visible[commandKeyboardIndex].btn.classList.add("keyboard-active");
  return visible.map(v=>v.btn);
}
editorBody.addEventListener("input",()=>{
  const ctx=getSlashContext();
  if(ctx){
    activeSlashRange=ctx.range.cloneRange();
    commandKeyboardIndex=0;
    filterSlashCommands(ctx.term);
    placeCommandNearCaret();
    arvioHideFixedPopover(formatMenu);
    arvioShowFixedPopover(commandMenu);
  }else{
    activeSlashRange=null;
    arvioHideFixedPopover(commandMenu);
  }
});


const highlightColors = [
  {name:"Deep Gold", color:"#66551D", glow:"rgba(210,178,52,.38)"},
  {name:"Deep Peach", color:"#633D2A", glow:"rgba(215,132,88,.34)"},
  {name:"Deep Mint", color:"#214C3A", glow:"rgba(82,198,143,.34)"},
  {name:"Deep Icy Blue", color:"#174B70", glow:"rgba(77,183,255,.48)"},
  {name:"Deep Cyan", color:"#18565A", glow:"rgba(75,211,216,.38)"},
  {name:"Deep Lavender", color:"#403363", glow:"rgba(157,132,235,.38)"},
  {name:"Deep Pink", color:"#5C304C", glow:"rgba(224,126,183,.35)"},
  {name:"Deep Red", color:"#612C32", glow:"rgba(236,104,113,.34)"},
  {name:"Deep Neutral", color:"#3C424A", glow:"rgba(190,198,209,.28)"}
];

function getNotePageRect(){ return document.querySelector("#page-note").getBoundingClientRect(); }


function placePopoverAboveAnchor(popover,anchor,{gap=8,align="right"}={}){
  if(!popover || !anchor) return;

  // Some legacy mobile rules used !important bottom anchoring. Positioning is
  // now owned by this helper, so dynamic coordinates also use !important.
  popover.style.setProperty("position","fixed","important");
  popover.style.setProperty("top","0px","important");
  popover.style.setProperty("left","0px","important");
  popover.style.setProperty("right","auto","important");
  popover.style.setProperty("bottom","auto","important");
  popover.hidden=false;

  requestAnimationFrame(()=>{
    const anchorRect=anchor.getBoundingClientRect();
    const popRect=popover.getBoundingClientRect();
    const vv=window.visualViewport;
    const viewportLeft=vv?.offsetLeft || 0;
    const viewportTop=vv?.offsetTop || 0;
    const viewportWidth=vv?.width || window.innerWidth;
    const mobile=window.matchMedia("(max-width: 760px)").matches;

    let left=align==="center"
      ? anchorRect.left + anchorRect.width/2 - popRect.width/2
      : anchorRect.right - popRect.width;

    left=Math.max(
      viewportLeft+8,
      Math.min(left,viewportLeft+viewportWidth-popRect.width-8)
    );

    const safeInset=mobile ? getArvioSafeTopInset() : 0;
    const safeTop=viewportTop+(mobile ? Math.max(8,safeInset+8) : 8);
    let top=Math.max(safeTop,anchorRect.top-popRect.height-gap);

    // If a secondary formatting bubble cannot physically fit above the
    // formatting toolbar, nudge the toolbar down just enough to keep the two
    // bubbles separated instead of letting them overlap.
    if(anchor===formatMenu && top===safeTop){
      const requiredAnchorTop=safeTop+popRect.height+gap;
      if(requiredAnchorTop>anchorRect.top){
        anchor.style.setProperty("top",`${requiredAnchorTop}px`,"important");
      }
    }

    popover.style.setProperty("left",`${left}px`,"important");
    popover.style.setProperty("top",`${top}px`,"important");
    popover.style.setProperty("right","auto","important");
    popover.style.setProperty("bottom","auto","important");
  });
}

function openHighlightPalette(){
  if(!savedRange) return;
  arvioHideFixedPopover(formatMenu);
  let palette=document.querySelector("#highlight-palette");
  if(!palette){
    palette=document.createElement("div");
    palette.id="highlight-palette";
    palette.className="highlight-palette";
    palette.innerHTML=highlightColors.map(c=>`
      <button class="highlight-swatch" title="${c.name}" aria-label="${c.name}"
        style="--swatch:${c.color};--glow:${c.glow}" data-highlight="${c.color}"></button>
    `).join("");
    document.querySelector("#page-note").appendChild(palette);
    palette.querySelectorAll("[data-highlight]").forEach(btn=>{
      btn.addEventListener("mousedown",e=>e.preventDefault());
      btn.addEventListener("click",()=>{
        const sel=window.getSelection();
        sel.removeAllRanges(); sel.addRange(savedRange);
        const color=btn.dataset.highlight;
        const selectedText = savedRange.toString();
        const common = savedRange.commonAncestorContainer.nodeType === 3
          ? savedRange.commonAncestorContainer.parentElement
          : savedRange.commonAncestorContainer;

        // If the selected text is already highlighted, clicking the highlighter
        // again removes the highlight instead of stacking another one.
        const existingMark = common.closest ? common.closest("span[style*='background-color'], mark") : null;
        if(existingMark && editorBody.contains(existingMark)){
          document.execCommand("backColor",false,"transparent");
          document.execCommand("removeFormat",false,null);
        }else{
          document.execCommand("backColor",false,color);
        }
        arvioAnimateClose(palette);
        savedRange=null;
      });
    });
  }
  palette.style.width="max-content";
  palette.hidden=false;
  placePopoverAboveAnchor(
    palette,
    document.querySelector("#format-menu"),
    {gap:8,align:"center"}
  );
  arvioAnimateOpen(palette);
}


function openMoreMenu(){
  let menu=document.querySelector("#more-menu");
  if(menu){
    arvioAnimateClose(menu);
    setTimeout(()=>placeMenuNearSelection(formatMenu),170);
    return;
  }

  menu=document.createElement("div");
  menu.id="more-menu";
  menu.className="more-menu";
  menu.innerHTML=`
    <button data-more-action="highlight-color">Highlight color</button>
    <button data-more-action="clear-highlight">Remove highlight</button>
  `;
  document.querySelector("#page-note").appendChild(menu);

  placePopoverAboveAnchor(
    menu,
    document.querySelector("#format-menu"),
    {gap:8,align:"right"}
  );
  arvioAnimateOpen(menu);

  menu.querySelector('[data-more-action="highlight-color"]').addEventListener("click",()=>{
    arvioAnimateClose(menu);
    setTimeout(openHighlightPalette, 210);
  });

  menu.querySelector('[data-more-action="clear-highlight"]').addEventListener("click",()=>{
    if(savedRange){
      const sel=window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
      document.execCommand("backColor",false,"transparent");
      document.execCommand("removeFormat",false,null);
    }
    arvioAnimateClose(menu);
    formatMenu.hidden=true;
    savedRange=null;
  });
}

document.querySelector("#format-more").addEventListener("mousedown",e=>e.preventDefault());
document.querySelector("#format-more").addEventListener("click",openMoreMenu);


let pendingLinkRange=null;
let pendingLinkLabel=null;
let linkKeyboardIndex=0;

function allArvioLinkTargets(){
  return flattenTree(libraryTree).map(({node,path})=>({
    title:node.title,
    path,
    body:node.body||""
  }));
}

function closeLinkPicker(){
  const picker=document.querySelector("#link-picker");
  if(!picker) return;
  picker.classList.remove("is-open");
  picker.classList.add("is-closing");
  setTimeout(()=>picker.remove(),210);
}

function renderLinkResults(query=""){
  const picker=document.querySelector("#link-picker");
  if(!picker) return [];
  const results=picker.querySelector(".link-results");
  const q=query.trim().toLowerCase();

  const matches=allArvioLinkTargets()
    .filter(item=>{
      const hay=[item.title,item.path.join(" "),item.body].join(" ").toLowerCase();
      return !q || hay.includes(q);
    })
    .slice(0,9);

  linkKeyboardIndex=Math.min(linkKeyboardIndex,Math.max(0,matches.length-1));

  results.innerHTML=matches.length
    ? matches.map((item,i)=>`
      <button class="link-result ${i===linkKeyboardIndex?"keyboard-active":""}"
        data-link-path="${item.path.join("›")}">
        <span class="link-result-icon">↗</span>
        <span>
          <span class="link-result-title">${highlightText(item.title,query)}</span>
          <span class="link-result-path">${item.path.join(" › ")}</span>
        </span>
        <span class="link-result-enter">↵</span>
      </button>`).join("")
    : `<div class="link-empty">No Arvio notes found.</div>`;

  results.querySelectorAll("[data-link-path]").forEach(btn=>{
    btn.addEventListener("mousedown",e=>e.preventDefault());
    btn.addEventListener("click",()=>insertInternalLink(btn.dataset.linkPath.split("›")));
  });
  return matches;
}

function insertInternalLink(path){
  if(!pendingLinkRange) return;

  const range=pendingLinkRange.cloneRange();
  const label=pendingLinkLabel || path[path.length-1];

  range.deleteContents();

  const anchor=document.createElement("a");
  anchor.href="#";
  anchor.className="internal-note-link";
  anchor.dataset.notePath=path.join("›");
  anchor.textContent=label;
  range.insertNode(anchor);

  // Put the caret naturally after the inserted link.
  const spacer=document.createTextNode("\u00A0");
  anchor.after(spacer);
  const caret=document.createRange();
  caret.setStartAfter(spacer);
  caret.collapse(true);
  const sel=window.getSelection();
  sel.removeAllRanges();
  sel.addRange(caret);

  pendingLinkRange=null;
  pendingLinkLabel=null;
  activeSlashRange=null;
  closeLinkPicker();
  arvioHideFixedPopover(commandMenu);
  arvioHideFixedPopover(formatMenu);
  editorBody.focus();
}

function openLinkPicker({range=null,label=null}={}){
  closeLinkPicker();
  arvioHideFixedPopover(commandMenu);
  arvioHideFixedPopover(formatMenu);

  pendingLinkRange=(range || activeSlashRange || savedRange)?.cloneRange() || null;
  pendingLinkLabel=label;

  if(!pendingLinkRange) return;

  const picker=document.createElement("div");
  picker.id="link-picker";
  picker.className="link-picker";
  picker.innerHTML=`
    <div class="link-picker-head">
      <span class="link-search-icon">⌕</span>
      <input class="link-picker-input" autocomplete="off" spellcheck="false"
        placeholder="Search Arvio notes..." aria-label="Search Arvio notes">
    </div>
    <div class="link-picker-rule"></div>
    <div class="link-results"></div>
  `;
  document.querySelector("#page-note").appendChild(picker);

  const rect=pendingLinkRange.getBoundingClientRect();
  const pageRect=getNotePageRect();
  const width=Math.min(390,pageRect.width-32);
  let left=rect.left-pageRect.left;
  left=Math.max(12,Math.min(left,pageRect.width-width-12));
  picker.style.left=`${left}px`;
  picker.style.top=`${Math.max(80,rect.bottom-pageRect.top+11)}px`;

  const input=picker.querySelector(".link-picker-input");
  renderLinkResults("");

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    picker.classList.add("is-open");
    input.focus({preventScroll:true});
  }));

  input.addEventListener("input",()=>{
    linkKeyboardIndex=0;
    renderLinkResults(input.value);
  });

  input.addEventListener("keydown",e=>{
    const visible=[...picker.querySelectorAll("[data-link-path]")];
    if(e.key==="ArrowDown" && visible.length){
      e.preventDefault();
      linkKeyboardIndex=(linkKeyboardIndex+1)%visible.length;
      renderLinkResults(input.value);
    }else if(e.key==="ArrowUp" && visible.length){
      e.preventDefault();
      linkKeyboardIndex=(linkKeyboardIndex-1+visible.length)%visible.length;
      renderLinkResults(input.value);
    }else if(e.key==="Enter" && visible.length){
      e.preventDefault();
      visible[linkKeyboardIndex]?.click();
    }else if(e.key==="Escape"){
      e.preventDefault();
      closeLinkPicker();
      editorBody.focus();
    }
  });
}

editorBody.addEventListener("click",e=>{
  const link=e.target.closest(".internal-note-link");
  if(!link) return;
  e.preventDefault();
  openArvioNote(link.dataset.notePath.split("›"));
});



let pendingImageRange=null;

function showImageToast(text){
  let toast=document.querySelector("#image-upload-toast");
  if(!toast){
    toast=document.createElement("div");
    toast.id="image-upload-toast";
    toast.className="image-upload-toast";
    document.body.appendChild(toast);
  }
  toast.textContent=text;
  requestAnimationFrame(()=>requestAnimationFrame(()=>toast.classList.add("is-open")));
  clearTimeout(toast._timer);
  toast._timer=setTimeout(()=>{
    toast.classList.remove("is-open");
  },1500);
}

function openImagePicker(){
  pendingImageRange=(activeSlashRange || savedRange)?.cloneRange() || null;
  if(!pendingImageRange) return;

  // Remove the slash command token before opening the picker.
  if(activeSlashRange){
    const sel=window.getSelection();
    sel.removeAllRanges();
    sel.addRange(activeSlashRange);
    activeSlashRange.deleteContents();
    pendingImageRange=sel.getRangeAt(0).cloneRange();
    activeSlashRange=null;
  }

  arvioHideFixedPopover(commandMenu);
  arvioHideFixedPopover(formatMenu);

  let input=document.querySelector("#arvio-image-input");
  if(!input){
    input=document.createElement("input");
    input.id="arvio-image-input";
    input.type="file";
    input.accept="image/*";
    input.hidden=true;
    document.body.appendChild(input);

    input.addEventListener("change",()=>{
      const file=input.files?.[0];
      if(!file){ input.value=""; return; }

      if(!file.type.startsWith("image/")){
        showImageToast("Please choose an image.");
        input.value="";
        return;
      }

      const reader=new FileReader();
      reader.onload=()=>{
        insertInlineImage(reader.result,file.name);
        input.value="";
      };
      reader.readAsDataURL(file);
    });
  }
  input.click();
}

function insertInlineImage(src,alt="Image"){
  if(!pendingImageRange) return;

  const range=pendingImageRange.cloneRange();
  const wrap=document.createElement("div");
  wrap.className="note-image-wrap";
  wrap.contentEditable="false";
  wrap.innerHTML=`
    <img class="note-image" src="${src}" alt="${alt.replace(/"/g,"&quot;")}">
    <div class="note-image-controls">
      <button type="button" data-size="small">S</button>
      <button type="button" data-size="medium" class="active">M</button>
      <button type="button" data-size="large">L</button>
      <button type="button" class="delete-image">Delete</button>
    </div>
  `;

  range.deleteContents();
  range.insertNode(wrap);

  // Leave an editable paragraph immediately after the image.
  const next=document.createElement("p");
  next.innerHTML="<br>";
  wrap.after(next);

  const caret=document.createRange();
  caret.setStart(next,0);
  caret.collapse(true);
  const sel=window.getSelection();
  sel.removeAllRanges();
  sel.addRange(caret);

  pendingImageRange=null;
  wireImageBlock(wrap);
  showImageToast("Image added");
  editorBody.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertContent"}));
}

function wireImageBlock(wrap){
  const img=wrap.querySelector(".note-image");
  const controls=wrap.querySelector(".note-image-controls");

  wrap.addEventListener("click",e=>{
    e.stopPropagation();
    document.querySelectorAll(".note-image-wrap.image-selected").forEach(x=>{
      if(x!==wrap) x.classList.remove("image-selected");
    });
    wrap.classList.add("image-selected");
  });

  controls.querySelectorAll("[data-size]").forEach(btn=>{
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      controls.querySelectorAll("[data-size]").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      const size=btn.dataset.size;
      img.style.width=size==="small" ? "48%" : size==="medium" ? "72%" : "100%";
    });
  });

  controls.querySelector(".delete-image").addEventListener("click",e=>{
    e.stopPropagation();
    wrap.style.transition="opacity 150ms ease,transform 190ms cubic-bezier(.4,0,.6,1)";
    wrap.style.opacity="0";
    wrap.style.transform="scale(.97)";
    setTimeout(()=>{
      wrap.remove();
      editorBody.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"deleteContent"}));
    },190);
  });
}

document.addEventListener("click",e=>{
  if(!e.target.closest(".note-image-wrap")){
    document.querySelectorAll(".note-image-wrap.image-selected")
      .forEach(x=>x.classList.remove("image-selected"));
  }
});

// Paste an image directly into the note (useful for screenshots).
editorBody.addEventListener("paste",e=>{
  const items=[...(e.clipboardData?.items||[])];
  const imageItem=items.find(item=>item.type.startsWith("image/"));
  if(!imageItem) return;

  e.preventDefault();
  const file=imageItem.getAsFile();
  if(!file) return;

  const sel=window.getSelection();
  if(!sel || !sel.rangeCount) return;
  pendingImageRange=sel.getRangeAt(0).cloneRange();

  const reader=new FileReader();
  reader.onload=()=>insertInlineImage(reader.result,file.name||"Pasted image");
  reader.readAsDataURL(file);
});


function applyCommand(cmd){
  if(cmd==="highlight"){
    openHighlightPalette();
    return;
  }else if(cmd==="heading"){
    document.execCommand("formatBlock",false,"h2");
  }else if(cmd==="bullet"){
    document.execCommand("insertUnorderedList");
  }else if(cmd==="link"){
    const source=activeSlashRange?.cloneRange();
    if(source){
      pendingLinkLabel=null;
      openLinkPicker({range:source});
    }
    return;
  }else if(cmd==="image"){
    openImagePicker();
    return;
  }
  arvioHideFixedPopover(commandMenu);
  arvioHideFixedPopover(formatMenu);
}
commandMenu.querySelectorAll("button[data-command]").forEach(b=>{
  b.addEventListener("mousedown",e=>e.preventDefault());
  b.addEventListener("click",()=>applyCommand(b.dataset.command));
});

editorBody.addEventListener("keydown",e=>{
  if(!commandMenu.hidden && commandMenu.classList.contains("is-open")){
    const visible=[...commandMenu.querySelectorAll("[data-command]:not(.command-hidden)")];
    if(e.key==="ArrowDown" && visible.length){
      e.preventDefault();
      commandKeyboardIndex = commandKeyboardIndex < 0 ? 0 : (commandKeyboardIndex+1)%visible.length;
      filterSlashCommands(getSlashContext()?.term||"");
    }else if(e.key==="ArrowUp" && visible.length){
      e.preventDefault();
      commandKeyboardIndex = commandKeyboardIndex < 0 ? visible.length-1 : (commandKeyboardIndex-1+visible.length)%visible.length;
      filterSlashCommands(getSlashContext()?.term||"");
    }else if(e.key==="Enter" && visible.length){
      e.preventDefault();
      visible[commandKeyboardIndex]?.click();
    }else if(e.key==="Escape"){
      e.preventDefault();
      activeSlashRange=null;
      arvioHideFixedPopover(commandMenu);
    }
  }
});

function toggleSelectedHighlight(){
  if(!savedRange) return;
  const sel=window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);

  const node=savedRange.commonAncestorContainer.nodeType===3
    ? savedRange.commonAncestorContainer.parentElement
    : savedRange.commonAncestorContainer;
  const existing=node.closest ? node.closest("span[style*='background-color'], mark") : null;

  if(existing && editorBody.contains(existing)){
    document.execCommand("backColor",false,"transparent");
    document.execCommand("removeFormat",false,null);
  }else{
    // Default Arvio action: apply the signature Icy Blue highlight.
    document.execCommand("backColor",false,"#72C9FF");
  }
  arvioHideFixedPopover(formatMenu);
  savedRange=null;
}

formatMenu.querySelectorAll("button[data-format]").forEach(b=>{
  b.addEventListener("mousedown",e=>e.preventDefault());
  b.addEventListener("click",()=>{
    if(savedRange){
      const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
    }
    const f=b.dataset.format;
    if(f==="highlight"){ toggleSelectedHighlight(); return; }
    else if(f==="link"){
      const label=savedRange ? savedRange.toString() : null;
      openLinkPicker({range:savedRange,label});
      return;
    }
    else document.execCommand(f==="bold"?"bold":f==="italic"?"italic":"underline");
    arvioHideFixedPopover(formatMenu);
  });
});

document.querySelector("#undo-btn").addEventListener("click",()=>document.execCommand("undo"));
document.querySelector("#redo-btn").addEventListener("click",()=>document.execCommand("redo"));

document.querySelectorAll(".child-note").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const title=btn.querySelector("strong").textContent;
    document.querySelector(".note-title").value=title;
    document.querySelector(".breadcrumb").innerHTML=`Toyota <span>›</span> Avanza <span>›</span> ${title}`;
    setNoteSaveStatus("saved","Saved");
    document.querySelectorAll(".child-note").forEach(x=>x.classList.remove("active-child"));
    btn.classList.add("active-child");
  });
});

document.addEventListener("mousedown",e=>{
  const picker=document.querySelector("#link-picker");
  if(picker && !picker.contains(e.target) && !e.target.closest('[data-format="link"]') && !e.target.closest('[data-command="link"]')){
    closeLinkPicker();
  }
  const palette=document.querySelector("#highlight-palette");
  if(palette && !palette.contains(e.target) && !e.target.closest('[data-format="highlight"]') && !e.target.closest('[data-command="highlight"]')){
    arvioAnimateClose(palette);
  }
  const more=document.querySelector("#more-menu");
  if(more && !more.contains(e.target) && !e.target.closest("#format-more")){
    arvioAnimateClose(more);
  }
});


function arvioShowFixedPopover(el){
  if(!el) return;
  clearTimeout(el._arvioHideTimer);
  el.hidden=false;
  el.classList.remove("is-closing","bubble-bloom");
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      el.classList.add("is-open","bubble-bloom");
      setTimeout(()=>el.classList.remove("bubble-bloom"),380);
    });
  });
}
function arvioHideFixedPopover(el){
  if(!el || el.hidden) return;
  el.classList.remove("is-open");
  el.classList.add("is-closing");
  clearTimeout(el._arvioHideTimer);
  el._arvioHideTimer=setTimeout(()=>{
    el.hidden=true;
    el.classList.remove("is-closing");
  },210);
}

/* Arvio motion helpers */
function arvioAnimateOpen(el){
  requestAnimationFrame(()=>el.classList.add("is-open"));
}
function arvioAnimateClose(el){
  if(!el) return;
  el.classList.remove("is-open");
  setTimeout(()=>{ if(el && el.parentNode) el.remove(); }, 280);
}
document.addEventListener("pointerdown", e=>{
  const target=e.target.closest("button,[data-tree-key],[data-note-path]");
  if(!target) return;

  // Stateful subsystems own their own press/release feedback.
  // Stacking the legacy generic box-shadow animation on those controls can
  // temporarily override their selected/open/copy/destructive state and create
  // the exact post-click “tek” Arvio is trying to avoid.
  if(target.closest(".mobile-nav, #page-library, #auth-screen, #page-create, #page-note, .share-overlay, .logout-overlay")) return;

  target.classList.remove("arvio-click-feedback");
  void target.offsetWidth;
  target.classList.add("arvio-click-feedback");
});


/* Share flow */
const shareOverlay=document.querySelector("#share-overlay");
const shareClose=document.querySelector("#share-close");
const publicToggle=document.querySelector("#public-toggle");
const permissionButton=document.querySelector("#permission-button");
const permissionMenu=document.querySelector("#permission-menu");
const permissionValue=document.querySelector("#permission-value");
const copyShareLink=document.querySelector("#copy-share-link");
const previewShared=document.querySelector("#preview-shared");
const sharedPreview=document.querySelector("#shared-preview");
const sharedPreviewCopy=document.querySelector("#shared-preview-copy");
const sharedPreviewClose=document.querySelector("#shared-preview-close");

let sharePermission="Viewer";
let shareCloseTimer=0;
let permissionCloseTimer=0;
let sharedPreviewCloseTimer=0;
let copyShareTimers=[];

function clearCopyShareTimers(){
  copyShareTimers.forEach(clearTimeout);
  copyShareTimers=[];
}
function resetCopyShareFeedback(){
  clearCopyShareTimers();
  if(!copyShareLink) return;
  const label=copyShareLink.querySelector(".copy-label");
  if(label) label.textContent="Copy link";
  copyShareLink.classList.remove("copied","copy-transition");
  copyShareLink.dataset.copying="false";
}

function syncShareNoteMeta(){
  const title=document.querySelector(".note-title")?.value || "Untitled";

  // Read the active breadcrumb from the editor itself.
  // This avoids depending on a separate currentNotePath variable.
  const crumbNames=[...document.querySelectorAll(".note-breadcrumb .crumb")]
    .map(el=>el.textContent.trim())
    .filter(Boolean);

  let breadcrumb=crumbNames.length ? crumbNames.join(" › ") : "";

  // Fallback for the initial static breadcrumb before a Library note has been opened.
  if(!breadcrumb){
    const raw=document.querySelector(".breadcrumb")?.textContent || "";
    breadcrumb=raw
      .split("›")
      .map(part=>part.trim())
      .filter(Boolean)
      .join(" › ");
  }

  document.querySelector("#share-title").textContent=title;
  document.querySelector(".share-path").textContent=breadcrumb || title;
}

function openShareSheet(){
  clearTimeout(shareCloseTimer);
  shareOverlay.classList.remove("is-closing");
  syncShareNoteMeta();
  shareOverlay.hidden=false;
  requestAnimationFrame(()=>requestAnimationFrame(()=>shareOverlay.classList.add("is-open")));
}

function closePermissionMenu(){
  if(permissionMenu.hidden) return;
  clearTimeout(permissionCloseTimer);
  permissionMenu.classList.remove("is-open");
  permissionMenu.classList.add("is-closing");
  permissionCloseTimer=setTimeout(()=>{
    permissionMenu.hidden=true;
    permissionMenu.classList.remove("is-closing");
    permissionCloseTimer=0;
  },ARVIO_MOTION.popClose);
}

function closeShareSheet(){
  closePermissionMenu();
  clearTimeout(shareCloseTimer);
  shareOverlay.classList.remove("is-open");
  shareOverlay.classList.add("is-closing");
  shareCloseTimer=setTimeout(()=>{
    shareOverlay.hidden=true;
    shareOverlay.classList.remove("is-closing");
    shareCloseTimer=0;
    resetCopyShareFeedback();
  },ARVIO_MOTION.shareClose);
}

document.querySelectorAll(".share-btn").forEach(btn=>{
  btn.addEventListener("click",openShareSheet);
});

shareClose.addEventListener("click",closeShareSheet);

shareOverlay.addEventListener("mousedown",e=>{
  if(e.target===shareOverlay) closeShareSheet();
});

publicToggle.addEventListener("click",()=>{
  const next=publicToggle.getAttribute("aria-pressed")!=="true";
  publicToggle.setAttribute("aria-pressed",String(next));
});

permissionButton.addEventListener("click",e=>{
  e.stopPropagation();

  if(!permissionMenu.hidden){
    closePermissionMenu();
    return;
  }

  clearTimeout(permissionCloseTimer);
  permissionMenu.classList.remove("is-closing");
  permissionMenu.hidden=false;
  requestAnimationFrame(()=>requestAnimationFrame(()=>permissionMenu.classList.add("is-open")));
});

permissionMenu.querySelectorAll("[data-permission]").forEach(choice=>{
  choice.addEventListener("click",()=>{
    sharePermission=choice.dataset.permission;
    permissionValue.textContent=sharePermission;

    permissionMenu.querySelectorAll("[data-permission]").forEach(x=>{
      const active=x===choice;
      x.classList.toggle("active",active);
      x.lastElementChild.textContent=active ? "✓" : "";
    });

    closePermissionMenu();
  });
});

document.addEventListener("mousedown",e=>{
  if(!permissionMenu.hidden && !permissionMenu.contains(e.target) && !e.target.closest("#permission-button")){
    closePermissionMenu();
  }
});

copyShareLink.addEventListener("click",async()=>{
  if(copyShareLink.dataset.copying==="true") return;
  copyShareLink.dataset.copying="true";

  const label=copyShareLink.querySelector(".copy-label");
  const fakeLink="https://arvio.app/shared/toyota-avanza-overview";

  try{
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(fakeLink);
  }catch{}

  // Fade the current label out first so the state change feels deliberate.
  copyShareLink.classList.add("copy-transition");

  clearCopyShareTimers();
  copyShareTimers.push(setTimeout(()=>{
    label.textContent="Copied";
    copyShareLink.classList.remove("copy-transition");
    copyShareLink.classList.add("copied");

    copyShareTimers.push(setTimeout(()=>{
      copyShareLink.classList.add("copy-transition");

      copyShareTimers.push(setTimeout(()=>{
        label.textContent="Copy link";
        copyShareLink.classList.remove("copied","copy-transition");
        copyShareLink.dataset.copying="false";
      },150));
    },1050));
  },150));
});

previewShared.addEventListener("click",()=>{
  closeShareSheet();

  setTimeout(()=>{
    document.body.classList.add("shared-guest-mode");
    sharedPreviewCopy.textContent=
      sharePermission==="Editor"
        ? "Editor access is available after logging in."
        : "You’re viewing this note as a guest. Editing is disabled.";

    sharedPreview.hidden=false;
    requestAnimationFrame(()=>requestAnimationFrame(()=>sharedPreview.classList.add("is-open")));
  },180);
});

sharedPreviewClose.addEventListener("click",()=>{
  clearTimeout(sharedPreviewCloseTimer);
  sharedPreview.classList.remove("is-open");
  sharedPreviewCloseTimer=setTimeout(()=>{
    sharedPreview.hidden=true;
    document.body.classList.remove("shared-guest-mode");
    sharedPreviewCloseTimer=0;
  },ARVIO_MOTION.shareClose);
});

document.querySelector("#shared-login-cta").addEventListener("click",()=>{
  // Prototype only: return to the normal signed-in editor.
  sharedPreview.classList.remove("is-open");
  setTimeout(()=>{
    sharedPreview.hidden=true;
    document.body.classList.remove("shared-guest-mode");
  },220);
});


/* Profile identity + logout */
const avatarPalette=[
  "#78CBFF",
  "#9BE2BE",
  "#BDA8FF",
  "#87E1E5",
  "#F0C987",
  "#F0A9C8"
];

function avatarAccentForName(name){
  const value=(name||"David").split("").reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
  return avatarPalette[value % avatarPalette.length];
}

function setAvatarAccent(name){
  const accent=avatarAccentForName(name);
  document.querySelectorAll(".avatar,.person-avatar").forEach(el=>{
    el.style.setProperty("--avatar-accent",accent);
  });
}

function setPrototypeProfilePhoto(dataUrl){
  const targets=[
    document.querySelector("#profile-avatar"),
    ...document.querySelectorAll(".person-avatar")
  ].filter(Boolean);

  targets.forEach(el=>{
    el.style.backgroundImage=`url("${dataUrl}")`;
    el.classList.add("has-photo");
  });

  try{
    // Keep the prototype photo across local refreshes when the browser permits it.
    if(dataUrl.length < 3_500_000) localStorage.setItem("arvioProfilePhoto",dataUrl);
  }catch{}
}

function clearPrototypeProfilePhoto(){
  document.querySelectorAll(".avatar,.person-avatar").forEach(el=>{
    el.style.backgroundImage="";
    el.classList.remove("has-photo");
  });
}

function applyPrototypeEmail(email){
  const clean=(email||"david@example.com").trim() || "david@example.com";
  document.querySelectorAll("#profile-email,#profile-email-heading").forEach(el=>{
    if(el) el.textContent=clean;
  });
}

const profileAvatar=document.querySelector("#profile-avatar");
const profilePhotoInput=document.querySelector("#profile-photo-input");

profileAvatar?.addEventListener("click",()=>{
  profilePhotoInput?.click();
});

profilePhotoInput?.addEventListener("change",()=>{
  const file=profilePhotoInput.files?.[0];
  if(!file || !file.type.startsWith("image/")){
    profilePhotoInput.value="";
    return;
  }

  const reader=new FileReader();
  reader.onload=()=>{
    setPrototypeProfilePhoto(reader.result);
    profileAvatar.classList.remove("arvio-click-feedback");
    void profileAvatar.offsetWidth;
    profileAvatar.classList.add("arvio-click-feedback");
    profilePhotoInput.value="";
  };
  reader.readAsDataURL(file);
});

try{
  const savedPhoto=localStorage.getItem("arvioProfilePhoto");
  if(savedPhoto) setPrototypeProfilePhoto(savedPhoto);
}catch{}

/* Logout confirmation */
const logoutOverlay=document.querySelector("#logout-overlay");
const logoutButton=document.querySelector("#logout-button");
const logoutCancel=document.querySelector("#logout-cancel");
const logoutConfirm=document.querySelector("#logout-confirm");
let logoutCloseTimer=0;

function openLogoutSheet(){
  if(!logoutOverlay) return;
  clearTimeout(logoutCloseTimer);
  logoutOverlay.classList.remove("is-closing");
  logoutOverlay.hidden=false;
  requestAnimationFrame(()=>requestAnimationFrame(()=>logoutOverlay.classList.add("is-open")));
}

function closeLogoutSheet(){
  if(!logoutOverlay) return;
  clearTimeout(logoutCloseTimer);
  logoutOverlay.classList.remove("is-open");
  logoutOverlay.classList.add("is-closing");
  logoutCloseTimer=setTimeout(()=>{
    logoutOverlay.hidden=true;
    logoutOverlay.classList.remove("is-closing");
    logoutCloseTimer=0;
  },ARVIO_MOTION.logoutClose);
}

function resetAuthWelcome(){
  authStages.forEach(stage=>{
    stage.classList.remove(
      "active",
      "auth-stage-exit-left",
      "auth-stage-exit-right",
      "auth-stage-enter-left",
      "auth-stage-enter-right"
    );
    stage.style.position="";
    stage.style.left="";
    stage.style.right="";
    stage.style.top="";
  });

  const welcome=document.querySelector('[data-auth-stage="welcome"]');
  welcome.classList.add("active");
  authCard.dataset.authStage="welcome";
  authTransitioning=false;
}

logoutButton?.addEventListener("click",openLogoutSheet);
logoutCancel?.addEventListener("click",closeLogoutSheet);

logoutOverlay?.addEventListener("mousedown",e=>{
  if(e.target===logoutOverlay) closeLogoutSheet();
});

logoutConfirm?.addEventListener("click",()=>{
  if(logoutConfirm.dataset.loggingOut==="true") return;
  logoutConfirm.dataset.loggingOut="true";
  logoutConfirm.classList.add("is-processing");

  const label=logoutConfirm.querySelector("span");
  label.style.opacity="0";
  const signOutRequest=(isSupabaseConfigured && supabase)
    ? supabase.auth.signOut()
    : Promise.resolve({error:null});

  setTimeout(()=>{
    label.textContent="Logging out";
    label.style.opacity="1";
  },130);

  setTimeout(async()=>{
    const {error}=await signOutRequest;
    if(error){
      label.textContent="Log out";
      logoutConfirm.classList.remove("is-processing");
      logoutConfirm.dataset.loggingOut="false";
      return;
    }

    closeLogoutSheet();
    screens.workspace.classList.add("workspace-exit");

    setTimeout(()=>{
      screens.workspace.classList.remove("active","workspace-exit");
      resetAuthWelcome();
      clearAuthMessages();

      screens.auth.classList.add("active");
      authCard.classList.add("auth-success-flash");

      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          authCard.classList.remove("auth-success-flash");
        });
      });

      label.textContent="Log out";
      logoutConfirm.classList.remove("is-processing");
      logoutConfirm.dataset.loggingOut="false";
    },290);
  },520);
});


/* v2.8.0 — global escape / overlay safety */
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape") return;

  if(document.querySelector("#library-trash-overlay")){ closeLibraryTrashSheet?.(); return; }
  if(document.querySelector("#library-delete-overlay")){ closeLibraryDeleteConfirm?.(); return; }
  if(document.querySelector("#library-rename-overlay")){ closeLibraryManageOverlay?.("library-rename-overlay"); return; }
  if(document.querySelector("#library-move-overlay")){ closeLibraryManageOverlay?.("library-move-overlay"); return; }
  if(document.querySelector("#library-item-action-overlay")){ closeLibraryItemActions?.(); return; }
  if(document.querySelector("#library-filter-overlay")){ closeLibraryFilter?.(); return; }
  if(document.querySelector("#library-options-menu")){ closeLibraryOptions?.(); return; }
  if(!shareOverlay?.hidden){ closeShareSheet?.(); return; }
  if(!logoutOverlay?.hidden){ closeLogoutSheet?.(); return; }

  [document.querySelector("#command-menu"),document.querySelector("#format-menu")].forEach(menu=>{
    if(menu && !menu.hidden){
      menu.classList.remove("is-open");
      menu.hidden=true;
    }
  });
  document.querySelectorAll(".more-menu,.highlight-palette,.link-picker").forEach(menu=>menu.remove());
});
