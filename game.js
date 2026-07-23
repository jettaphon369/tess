/* ===== math.js ===== */
window.OD = window.OD || {};

OD.Vec3 = class {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  clone(){return new OD.Vec3(this.x,this.y,this.z);}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  scale(s){this.x*=s;this.y*=s;this.z*=s;return this;}
  length(){return Math.hypot(this.x,this.y,this.z);}
  normalize(){const l=this.length()||1;return this.scale(1/l);}
};

OD.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
OD.lerp=(a,b,t)=>a+(b-a)*t;


/* ===== renderer.js ===== */
window.OD = window.OD || {};

OD.Renderer = class {
  constructor(canvas){
    this.canvas=canvas;
    this.gl=canvas.getContext("webgl",{antialias:true,alpha:false});
    if(!this.gl) throw new Error("อุปกรณ์นี้ไม่รองรับ WebGL");
    this.program=this.createProgram();
    this.locations={
      pos:this.gl.getAttribLocation(this.program,"aPosition"),
      color:this.gl.getUniformLocation(this.program,"uColor"),
      mvp:this.gl.getUniformLocation(this.program,"uMVP")
    };
    this.cube=this.createCube();
    this.view=new Float32Array(16);
    this.proj=new Float32Array(16);
    this.camera={x:0,y:8,z:12,targetX:0,targetY:0,targetZ:0};
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.CULL_FACE);
  }

  shader(type,src){
    const s=this.gl.createShader(type);
    this.gl.shaderSource(s,src);this.gl.compileShader(s);
    if(!this.gl.getShaderParameter(s,this.gl.COMPILE_STATUS)) throw new Error(this.gl.getShaderInfoLog(s));
    return s;
  }

  createProgram(){
    const vs=this.shader(this.gl.VERTEX_SHADER,`
      attribute vec3 aPosition;
      uniform mat4 uMVP;
      void main(){gl_Position=uMVP*vec4(aPosition,1.0);}
    `);
    const fs=this.shader(this.gl.FRAGMENT_SHADER,`
      precision mediump float;
      uniform vec4 uColor;
      void main(){gl_FragColor=uColor;}
    `);
    const p=this.gl.createProgram();
    this.gl.attachShader(p,vs);this.gl.attachShader(p,fs);this.gl.linkProgram(p);
    if(!this.gl.getProgramParameter(p,this.gl.LINK_STATUS)) throw new Error(this.gl.getProgramInfoLog(p));
    return p;
  }

  createCube(){
    const v=new Float32Array([
      -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
      -1,-1, 1, 1,-1, 1, 1,1, 1, -1,1, 1
    ]);
    const i=new Uint16Array([
      0,1,2,0,2,3, 4,6,5,4,7,6,
      0,4,5,0,5,1, 3,2,6,3,6,7,
      1,5,6,1,6,2, 0,3,7,0,7,4
    ]);
    const vb=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,vb);this.gl.bufferData(this.gl.ARRAY_BUFFER,v,this.gl.STATIC_DRAW);
    const ib=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,ib);this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,i,this.gl.STATIC_DRAW);
    return {vb,ib,count:i.length};
  }

  resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.floor(this.canvas.clientWidth*dpr),h=Math.floor(this.canvas.clientHeight*dpr);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    this.gl.viewport(0,0,w,h);
    this.proj=this.perspective(Math.PI/3,w/h,.1,100);
  }

  begin(){
    this.resize();
    this.gl.clearColor(.53,.80,.94,1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);
    this.gl.useProgram(this.program);
    this.view=this.lookAt(
      [this.camera.x,this.camera.y,this.camera.z],
      [this.camera.targetX,this.camera.targetY,this.camera.targetZ],
      [0,1,0]
    );
  }

  drawBox(x,y,z,sx,sy,sz,color,rotY=0){
    const model=this.modelMatrix(x,y,z,sx,sy,sz,rotY);
    const mvp=this.multiply(this.proj,this.multiply(this.view,model));
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.cube.vb);
    this.gl.enableVertexAttribArray(this.locations.pos);
    this.gl.vertexAttribPointer(this.locations.pos,3,this.gl.FLOAT,false,0,0);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.cube.ib);
    this.gl.uniformMatrix4fv(this.locations.mvp,false,mvp);
    this.gl.uniform4fv(this.locations.color,color);
    this.gl.drawElements(this.gl.TRIANGLES,this.cube.count,this.gl.UNSIGNED_SHORT,0);
  }

  modelMatrix(x,y,z,sx,sy,sz,rotY=0){
    const c=Math.cos(rotY),s=Math.sin(rotY);
    return new Float32Array([
      sx*c,0,-sx*s,0,
      0,sy,0,0,
      sz*s,0,sz*c,0,
      x,y,z,1
    ]);
  }

  perspective(fov,aspect,near,far){
    const f=1/Math.tan(fov/2),nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  }

  lookAt(e,c,u){
    let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2];
    let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
    let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;
    l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([
      xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*e[0]+xy*e[1]+xz*e[2]),
      -(yx*e[0]+yy*e[1]+yz*e[2]),
      -(zx*e[0]+zy*e[1]+zz*e[2]),1
    ]);
  }

  multiply(a,b){
    const o=new Float32Array(16);
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)
      o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
    return o;
  }
};


/* ===== world.js ===== */
window.OD = window.OD || {};

OD.World = class {
  constructor(){
    this.player={pos:new OD.Vec3(0,0,0),facing:0,walkTime:0,attackTime:0};
    this.enemies=[];
    this.projectiles=[];
    this.drops=[];

    this.regions=[
      {id:"village",name:"Seedling Village",thai:"หมู่บ้านต้นกล้า",level:"Lv.1–10",cx:0,cz:0,halfX:14,halfZ:14,color:[.30,.58,.24,1],
       mobs:["hopper","aphid"],boss:null,desc:"เมืองเริ่มต้น ศูนย์กลางร้านค้า NPC และจุดเชื่อมทุกภูมิภาค"},
      {id:"beetleWoods",name:"Beetle Woods",thai:"ป่าด้วง",level:"Lv.8–20",cx:-31,cz:0,halfX:16,halfZ:18,color:[.18,.42,.17,1],
       mobs:["beetle","caterpillar"],boss:"kingBeetle",desc:"ป่าทึบ รังด้วง ถ้ำ และราชาด้วงเกราะ"},
      {id:"sporeMarsh",name:"Sporeveil Marsh",thai:"บึงหมอกเห็ด",level:"Lv.18–32",cx:31,cz:0,halfX:16,halfZ:18,color:[.22,.42,.31,1],
       mobs:["spore","slug","fly"],boss:"queenSpore",desc:"บึงพิษ หมอก เห็ดยักษ์ ทาก และราชินีสปอร์"},
      {id:"sunDesert",name:"Sunscorch Desert",thai:"ทะเลทรายสุริยะ",level:"Lv.30–45",cx:0,cz:31,halfX:18,halfZ:16,color:[.67,.52,.28,1],
       mobs:["scorpion","sandworm"],boss:"sandTitan",desc:"ทะเลทราย โอเอซิส ซากวิหาร และไททันหนอนทราย"},
      {id:"frostHighlands",name:"Frostleaf Highlands",thai:"ที่ราบสูงใบเยือกแข็ง",level:"Lv.42–60",cx:0,cz:-31,halfX:18,halfZ:16,color:[.53,.70,.72,1],
       mobs:["frostMoth","iceGolem"],boss:"frostGuardian",desc:"ที่ราบหิมะ คริสตัลน้ำแข็ง และผู้พิทักษ์เขาน้ำแข็ง"}
    ];

    this.enemyDefs={
      hopper:{name:"ตั๊กแตน",hp:75,speed:1.7,damage:8,color1:[.34,.62,.20,1],color2:[.46,.72,.27,1]},
      aphid:{name:"เพลี้ยฝูง",hp:55,speed:1.9,damage:6,color1:[.42,.70,.34,1],color2:[.62,.82,.42,1]},
      beetle:{name:"ด้วงเกราะ",hp:140,speed:1.1,damage:14,color1:[.24,.12,.08,1],color2:[.36,.20,.12,1]},
      caterpillar:{name:"หนอนกัดใบ",hp:110,speed:1.25,damage:12,color1:[.45,.70,.18,1],color2:[.65,.82,.28,1]},
      spore:{name:"เห็ดสปอร์",hp:125,speed:1.0,damage:15,color1:[.44,.25,.55,1],color2:[.65,.40,.73,1]},
      slug:{name:"ทากพิษ",hp:210,speed:.75,damage:19,color1:[.25,.48,.32,1],color2:[.45,.68,.42,1]},
      fly:{name:"แมลงวันบึง",hp:85,speed:2.0,damage:10,color1:[.18,.32,.28,1],color2:[.42,.58,.48,1]},
      scorpion:{name:"แมงป่องทราย",hp:180,speed:1.25,damage:22,color1:[.56,.34,.12,1],color2:[.78,.54,.18,1]},
      sandworm:{name:"หนอนทะเลทราย",hp:260,speed:.9,damage:26,color1:[.62,.40,.20,1],color2:[.80,.58,.28,1]},
      frostMoth:{name:"ผีเสื้อน้ำแข็ง",hp:155,speed:1.65,damage:20,color1:[.55,.78,.84,1],color2:[.76,.92,.96,1]},
      iceGolem:{name:"โกเลมน้ำแข็ง",hp:320,speed:.7,damage:30,color1:[.42,.62,.70,1],color2:[.68,.84,.90,1]},
      kingBeetle:{name:"ราชาด้วงเกราะ",hp:900,speed:.9,damage:34,color1:[.32,.10,.06,1],color2:[.62,.25,.10,1]},
      queenSpore:{name:"ราชินีสปอร์",hp:1050,speed:.82,damage:36,color1:[.40,.16,.52,1],color2:[.72,.38,.82,1]},
      sandTitan:{name:"ไททันหนอนทราย",hp:1250,speed:.72,damage:42,color1:[.54,.30,.12,1],color2:[.90,.60,.20,1]},
      frostGuardian:{name:"ผู้พิทักษ์เขาน้ำแข็ง",hp:1450,speed:.68,damage:46,color1:[.38,.60,.72,1],color2:[.78,.94,1,1]}
    };

    this.npc={pos:new OD.Vec3(-7.2,0,-5.6),name:"ผู้ดูแลสวน"};
    this.merchant={pos:new OD.Vec3(-8.4,0,-7.0),name:"พ่อค้าเมล็ดพันธุ์"};
    this.chest={pos:new OD.Vec3(7.1,0,5.8),opened:false};

    this.spawnInitial();
  }

  getRegionAt(x,z){
    for(const r of this.regions){
      if(Math.abs(x-r.cx)<=r.halfX && Math.abs(z-r.cz)<=r.halfZ)return r;
    }
    return this.regions[0];
  }

  spawnInitial(){
    // Starter village monsters
    this.spawnZone("village",6,9);

    // Region-specific monster populations
    this.spawnZone("beetleWoods",10,12);
    this.spawnZone("sporeMarsh",10,12);
    this.spawnZone("sunDesert",9,11);
    this.spawnZone("frostHighlands",9,11);

    // Permanent regional bosses
    this.spawnEnemy("kingBeetle",true,-42,0,"beetleWoods");
    this.spawnEnemy("queenSpore",true,42,0,"sporeMarsh");
    this.spawnEnemy("sandTitan",true,0,42,"sunDesert");
    this.spawnEnemy("frostGuardian",true,0,-42,"frostHighlands");
  }

  spawnZone(regionId,count,radius){
    const r=this.regions.find(v=>v.id===regionId);
    if(!r)return;
    for(let i=0;i<count;i++){
      const angle=(i/count)*Math.PI*2+(i%3)*.19;
      const rr=radius*(.55+(i%4)*.12);
      const x=r.cx+Math.cos(angle)*rr;
      const z=r.cz+Math.sin(angle)*rr;
      const kind=r.mobs[i%r.mobs.length];
      this.spawnEnemy(kind,false,x,z,regionId);
    }
  }

  spawnEnemy(kind,boss,x,z,regionId="village"){
    const def=this.enemyDefs[kind]||this.enemyDefs.hopper;
    const hp=boss?def.hp:def.hp;
    this.enemies.push({
      kind,
      name:def.name,
      regionId,
      boss,
      pos:new OD.Vec3(x,0,z),
      spawn:new OD.Vec3(x,0,z),
      hp,
      maxHp:hp,
      speed:def.speed,
      damage:def.damage,
      color1:def.color1,
      color2:def.color2,
      cooldown:0,
      wander:Math.random()*Math.PI*2,
      dead:false,
      respawnAt:0,
      hitFlash:0,
      bob:Math.random()*6.28
    });
  }
};


/* ===== entities.js ===== */
window.OD = window.OD || {};

OD.findNearestEnemy=function(world,maxDistance=8){
  let best=null,bestD=maxDistance;
  for(const enemy of world.enemies){
    if(enemy.dead) continue;
    const dx=enemy.pos.x-world.player.pos.x,dz=enemy.pos.z-world.player.pos.z;
    const d=Math.hypot(dx,dz);
    if(d<bestD){bestD=d;best=enemy;}
  }
  return best;
};


/* ===== input.js ===== */
window.OD = window.OD || {};

OD.Input = class {
  constructor(){
    this.move={x:0,y:0};this.keys={};
    addEventListener("keydown",e=>this.keys[e.key.toLowerCase()]=true);
    addEventListener("keyup",e=>this.keys[e.key.toLowerCase()]=false);

    const joy=document.getElementById("joystick");
    const stick=document.getElementById("stick");
    let active=false;

    const update=e=>{
      const r=joy.getBoundingClientRect();
      let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
      const max=38,len=Math.hypot(dx,dy);
      if(len>max){dx=dx/len*max;dy=dy/len*max;}
      this.move.x=dx/max;this.move.y=dy/max;
      stick.style.transform=`translate(${dx}px,${dy}px)`;
    };

    joy.addEventListener("pointerdown",e=>{active=true;joy.setPointerCapture(e.pointerId);update(e);});
    joy.addEventListener("pointermove",e=>{if(active)update(e);});
    joy.addEventListener("pointerup",()=>{active=false;this.move.x=this.move.y=0;stick.style.transform="translate(0,0)";});
  }

  axis(){
    return {
      x:(this.keys.d?1:0)-(this.keys.a?1:0)+this.move.x,
      y:(this.keys.s?1:0)-(this.keys.w?1:0)+this.move.y
    };
  }
};


/* ===== game.js ===== */
(function(){
"use strict";
const V303UtilityRailCleanup=()=>{
  document.querySelector(".quest-card")?.classList.remove("combat-hide");
  document.querySelector(".minimap")?.classList.remove("combat-hide");
  document.querySelector(".utility-rail")?.classList.remove("combat-hide");
};
addEventListener("pageshow",V303UtilityRailCleanup);
setTimeout(V303UtilityRailCleanup,0);
document.documentElement.classList.add("combatHud221");
console.log("Orchardia Online V2.0.1 Startup Hotfix loaded");
const hitVignette=document.createElement("div");
hitVignette.className="hit-vignette";
document.body.appendChild(hitVignette);
console.log("Orchardia Online V1.5.1 Cooldown Fix loaded");

// Mobile browser protection:
// - Prevent Safari double-tap zoom while repeatedly attacking.
// - Prevent pinch zoom/gesture zoom inside the game.
// - Prevent page scrolling and text selection during play.
let lastTouchEnd = 0;
document.addEventListener("touchend", event => {
  const now = Date.now();
  if (now - lastTouchEnd <= 320) event.preventDefault();
  lastTouchEnd = now;
}, { passive:false });

document.addEventListener("dblclick", event => event.preventDefault(), { passive:false });
document.addEventListener("gesturestart", event => event.preventDefault(), { passive:false });
document.addEventListener("gesturechange", event => event.preventDefault(), { passive:false });
document.addEventListener("gestureend", event => event.preventDefault(), { passive:false });

document.addEventListener("touchmove", event => {
  if (event.touches && event.touches.length > 1) event.preventDefault();
}, { passive:false });

function bindMobileAction(buttonId, handler){
  const button = document.getElementById(buttonId);
  if (!button) return;

  let activePointer = null;

  const press = event => {
    event.preventDefault();
    event.stopPropagation();
    if (activePointer !== null) return;
    activePointer = event.pointerId ?? "touch";
    button.classList.add("pressed");
    try { button.setPointerCapture?.(event.pointerId); } catch (_) {}
    handler();
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const release = event => {
    event.preventDefault();
    button.classList.remove("pressed");
    activePointer = null;
  };

  button.addEventListener("pointerdown", press, { passive:false });
  button.addEventListener("pointerup", release, { passive:false });
  button.addEventListener("pointercancel", release, { passive:false });
  button.addEventListener("contextmenu", event => event.preventDefault());
}

function showError(msg){
  const el=document.getElementById("errorBox");
  el.style.display="block";
  el.textContent="เกิดข้อผิดพลาด: "+msg;
}
window.addEventListener("error",e=>showError(e.message||"Unknown error"));

try{
  const canvas=document.getElementById("game");
  const renderer=new OD.Renderer(canvas);
  const world=new OD.World();
  const input=new OD.Input();

  let cameraYaw=0;
  let cameraDistance=11.5;
  let cameraDrag=null;
  canvas.addEventListener("pointerdown",event=>{
    if(event.target!==canvas)return;
    cameraDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    try{canvas.setPointerCapture(event.pointerId);}catch(_){}
  },{passive:false});
  canvas.addEventListener("pointermove",event=>{
    if(!cameraDrag||cameraDrag.id!==event.pointerId)return;
    const dx=event.clientX-cameraDrag.x;
    const dy=event.clientY-cameraDrag.y;
    if(Math.abs(dx)+Math.abs(dy)>3)cameraDrag.moved=true;
    cameraYaw-=dx*.008;
    cameraDistance=OD.clamp(cameraDistance+dy*.01,9.5,14.5);
    cameraDrag.x=event.clientX;
    cameraDrag.y=event.clientY;
    event.preventDefault();
  },{passive:false});
  canvas.addEventListener("pointerup",event=>{
    if(cameraDrag&&cameraDrag.id===event.pointerId)cameraDrag=null;
  },{passive:false});

  // Keyboard shortcuts: PC
  addEventListener("keydown",event=>{
    if(state.uiOpen)return;
    const k=event.key.toLowerCase();
    if(k===" "){event.preventDefault();document.getElementById("attackBtn")?.click();}
    if(k==="1")document.getElementById("skillBtn")?.click();
    if(k==="2")document.getElementById("skill2Btn")?.click();
    if(k==="shift")document.getElementById("rollBtn")?.click();
    if(k==="f")document.getElementById("interactBtn")?.click();
    if(k==="r")document.getElementById("autoBtn")?.click();
    if(k==="tab"){event.preventDefault();document.getElementById("lockBtn")?.click();}
    if(k==="b")document.getElementById("bagBtn")?.click();
    if(k==="h")setCombatControlsHidden(!state.combatControlsHidden);
  });


  function applyResponsiveProfile(){
    const w=window.visualViewport?.width||innerWidth;
    const h=window.visualViewport?.height||innerHeight;
    const portrait=h>=w;
    const classes=[
      "profile-phone-small","profile-phone","profile-tablet",
      "profile-desktop","profile-landscape-phone"
    ];
    document.body.classList.remove(...classes);

    if(!portrait && h<650){
      document.body.classList.add("profile-landscape-phone");
    }else if(w<390){
      document.body.classList.add("profile-phone-small");
    }else if(w<768){
      document.body.classList.add("profile-phone");
    }else if(w<1100){
      document.body.classList.add("profile-tablet");
    }else{
      document.body.classList.add("profile-desktop");
    }
  }

  addEventListener("resize",applyResponsiveProfile);
  addEventListener("orientationchange",()=>setTimeout(applyResponsiveProfile,120));
  if(window.visualViewport){
    visualViewport.addEventListener("resize",applyResponsiveProfile);
  }
  applyResponsiveProfile();

  const save=JSON.parse(localStorage.getItem("orchardiaSaveV1")||'{"level":1,"xp":0,"coins":0,"items":0,"kills":0,"questDone":false,"potions":1,"rareSeeds":0,"weaponLevel":1}');
  const state={
    hp:100,maxHp:100,mp:100,maxMp:100,
    level:save.level,xp:save.xp,coins:save.coins,items:save.items,kills:save.kills,
    questDone:!!save.questDone,
    potions:Number(save.potions||1),rareSeeds:Number(save.rareSeeds||0),weaponLevel:Number(save.weaponLevel||1),
    attackCd:0,skillCd:0,skill2Cd:0,rollCd:0,target:null,lockedTarget:null,autoCombat:false,autoEngaged:false,autoIdleTime:0,combatControlsHidden:false,autoSkill:true,autoLoot:true,autoTimer:0,autoSkillTimer:0,autoAnchor:null,autoRange:14,
    nearbyNpc:false,nearbyMerchant:false,nearbyChest:false,uiOpen:false,currentRegion:"village",zoneKills:(save.zoneKills||{}),zoneBossKills:(save.zoneBossKills||{})
  };

  function persist(){
    localStorage.setItem("orchardiaSaveV1",JSON.stringify({
      level:state.level,xp:state.xp,coins:state.coins,items:state.items,kills:state.kills,questDone:state.questDone,potions:state.potions,rareSeeds:state.rareSeeds,weaponLevel:state.weaponLevel,zoneKills:state.zoneKills,zoneBossKills:state.zoneBossKills
    }));
  }

  function addSystemLog(text){
    const log=document.getElementById("systemLog");
    if(!log)return;
    const row=document.createElement("div");
    row.textContent="ระบบ  "+text;
    log.appendChild(row);
    while(log.children.length>5)log.removeChild(log.firstChild);
  }

  function flash(text){
    const m=document.getElementById("message");
    m.textContent=text;m.classList.add("show");
    clearTimeout(flash.t);
    flash.t=setTimeout(()=>m.classList.remove("show"),1200);
  }

  function shoot(damage,speed){
    const target=(state.lockedTarget&&!state.lockedTarget.dead?state.lockedTarget:null)||(state.target&&!state.target.dead?state.target:OD.findNearestEnemy(world));
    if(!target)return flash("ไม่มีเป้าหมาย");
    state.target=target;
    world.projectiles.push({
      pos:world.player.pos.clone().add(new OD.Vec3(0,.8,0)),
      target,damage,speed,dead:false
    });
  }


  const inventoryPanel=document.getElementById("inventoryPanel");
  const dialoguePanel=document.getElementById("dialoguePanel");

  function attackDamage(){
    return 22+(state.weaponLevel-1)*7;
  }


  function setActionCooldown(buttonId,label,remaining){
    const button=document.getElementById(buttonId);
    if(!button)return;
    let cdEl=button.querySelector(".cooldown-text");
    if(!cdEl){
      cdEl=document.createElement("span");
      cdEl.className="cooldown-text";
      button.appendChild(cdEl);
    }
    const cooling=remaining>0.01;
    button.classList.toggle("cooling",cooling);
    cdEl.textContent=cooling?remaining.toFixed(1):"";
  }

  function syncInventory(){
    document.getElementById("attackStat").textContent=attackDamage();
    document.getElementById("maxHpStat").textContent=state.maxHp;
    document.getElementById("potionCount").textContent=state.potions;
    document.getElementById("seedCount").textContent=state.rareSeeds;
    document.getElementById("upgradeWeaponBtn").textContent=
      state.weaponLevel>=5?"ธนูระดับสูงสุด":`อัปเกรดธนู ${80*state.weaponLevel} 🪙`;
  }

  function setUiOpen(open){
    state.uiOpen=open;
    if(open){
      input.move.x=0;input.move.y=0;
      const stick=document.getElementById("stick");
      if(stick)stick.style.transform="translate(0,0)";
    }
  }

  function openInventory(){
    syncInventory();
    if(state.autoCombat)showAutoToast("AUTO ยังทำงานอยู่");
    inventoryPanel.classList.remove("hidden");
    setUiOpen(true);
  }

  function closeInventory(){
    inventoryPanel.classList.add("hidden");
    setUiOpen(false);
  }

  function openDialogue(name,text,actions=[]){
    if(state.autoCombat)showAutoToast("AUTO ทำงานต่อระหว่างเปิดหน้าต่าง");
    document.getElementById("dialogueName").textContent=name;
    document.getElementById("dialogueText").textContent=text;
    const holder=document.getElementById("dialogueActions");
    holder.innerHTML="";
    actions.forEach(action=>{
      const button=document.createElement("button");
      button.textContent=action.label;
      button.onclick=action.onClick;
      holder.appendChild(button);
    });
    dialoguePanel.classList.remove("hidden");
    setUiOpen(true);
  }

  function closeDialogue(){
    dialoguePanel.classList.add("hidden");
    setUiOpen(false);
  }

  document.getElementById("bagBtn").onclick=openInventory;

  let selectedWorldRegion="village";

  function syncWorldMap(){
    const selected=world.regions.find(r=>r.id===selectedWorldRegion)||world.regions[0];
    document.querySelectorAll(".world-node").forEach(btn=>{
      btn.classList.toggle("selected",btn.dataset.region===selectedWorldRegion);
    });
    const title=document.getElementById("worldMapSelected");
    const desc=document.getElementById("worldMapDescription");
    if(title)title.textContent=selected.thai+" · "+selected.name;
    if(desc)desc.textContent=selected.desc||selected.level;
  }

  function openWorldMap(){
    selectedWorldRegion=state.currentRegion||"village";
    syncWorldMap();
    document.getElementById("worldMapPanel")?.classList.remove("hidden");
    setUiOpen(true);
  }

  document.getElementById("worldMapBtn")?.addEventListener("click",openWorldMap);
  document.getElementById("closeWorldMapBtn")?.addEventListener("click",()=>{
    document.getElementById("worldMapPanel")?.classList.add("hidden");
    setUiOpen(false);
  });

  document.querySelectorAll(".world-node").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selectedWorldRegion=btn.dataset.region;
      syncWorldMap();
    });
  });

  document.getElementById("travelBtn")?.addEventListener("click",()=>{
    const r=world.regions.find(v=>v.id===selectedWorldRegion);
    if(!r)return;
    world.player.pos.x=r.cx;
    world.player.pos.z=r.cz;
    state.lockedTarget=null;
    state.target=null;
    if(state.autoCombat){
      state.autoAnchor=world.player.pos.clone();
    }
    document.getElementById("worldMapPanel")?.classList.add("hidden");
    setUiOpen(false);
    flash("เดินทางถึง "+r.thai);
  });


  const gameMenuPanel=document.getElementById("gameMenuPanel");
  const menuBtn=document.getElementById("menuBtn");
  const closeGameMenuBtn=document.getElementById("closeGameMenuBtn");
  const resumeBtn=document.getElementById("resumeBtn");
  const menuBagBtn=document.getElementById("menuBagBtn");
  const menuAutoBtn=document.getElementById("menuAutoBtn");
  const exitBtn=document.getElementById("exitBtn");

  if(menuBtn)menuBtn.onclick=()=>{
    gameMenuPanel?.classList.remove("hidden");
    setUiOpen(true);
  };
  if(closeGameMenuBtn)closeGameMenuBtn.onclick=()=>{
    gameMenuPanel?.classList.add("hidden");
    setUiOpen(false);
  };
  if(resumeBtn)resumeBtn.onclick=()=>{
    gameMenuPanel?.classList.add("hidden");
    setUiOpen(false);
  };
  if(menuBagBtn)menuBagBtn.onclick=()=>{
    gameMenuPanel?.classList.add("hidden");
    openInventory();
  };
  if(menuAutoBtn)menuAutoBtn.onclick=()=>{
    gameMenuPanel?.classList.add("hidden");
    setUiOpen(false);
    setAutoCombat(!state.autoCombat);
  };
  if(exitBtn)exitBtn.onclick=()=>{
    if(confirm("ออกจากเกมและกลับหน้าเริ่มต้น?")){
      state.autoCombat=false;
      location.reload();
    }
  };
  const el_bagBtnSide=document.getElementById("bagBtnSide");
  if(el_bagBtnSide) el_bagBtnSide.onclick=openInventory;
  const el_questToggleBtn=document.getElementById("questToggleBtn");
  if(el_questToggleBtn) el_questToggleBtn.onclick=()=>{
    const card=document.querySelector(".quest-card");
    card.classList.toggle("collapsed");
    document.getElementById("questToggleBtn").textContent=card.classList.contains("collapsed")?"‹":"›";
  };
  const el_closeInventoryBtn=document.getElementById("closeInventoryBtn");
  if(el_closeInventoryBtn) el_closeInventoryBtn.onclick=closeInventory;
  const el_closeDialogueBtn=document.getElementById("closeDialogueBtn");
  if(el_closeDialogueBtn) el_closeDialogueBtn.onclick=closeDialogue;
  const el_shopQuickBtn=document.getElementById("shopQuickBtn");
  if(el_shopQuickBtn) el_shopQuickBtn.onclick=()=>{
    openDialogue("พ่อค้าเมล็ดพันธุ์","ร้านค้าด่วน",[
      {label:"ซื้อยา HP 25 🪙",onClick:()=>{
        if(state.coins<25)return flash("เหรียญไม่พอ");
        state.coins-=25;state.potions++;persist();flash("ซื้อยา HP แล้ว");
      }},
      {label:"ซื้อเมล็ดหายาก 60 🪙",onClick:()=>{
        if(state.coins<60)return flash("เหรียญไม่พอ");
        state.coins-=60;state.rareSeeds++;persist();flash("ซื้อเมล็ดหายากแล้ว");
      }}
    ]);
  };

  const el_questQuickBtn=document.getElementById("questQuickBtn");
  if(el_questQuickBtn) el_questQuickBtn.onclick=()=>{
    const text=state.questDone
      ?"ภารกิจหลักสำเร็จแล้ว — สำรวจหมู่บ้าน"
      :(state.kills>=5?"กลับไปคุยกับผู้ดูแลสวนเพื่อรับรางวัล":`กำจัดตั๊กแตน ${Math.min(5,state.kills)}/5`);
    flash(text);
  };

  document.getElementById("usePotionBtn").onclick=()=>{
    if(state.potions<=0)return flash("ไม่มียา HP");
    if(state.hp>=state.maxHp)return flash("HP เต็มแล้ว");
    state.potions--;
    state.hp=Math.min(state.maxHp,state.hp+55);
    flash("+55 HP");
    syncInventory();
    persist();
  };

  document.getElementById("upgradeWeaponBtn").onclick=()=>{
    if(state.weaponLevel>=5)return flash("ธนูถึงระดับสูงสุดแล้ว");
    const cost=80*state.weaponLevel;
    if(state.coins<cost)return flash("เหรียญไม่พอ");
    state.coins-=cost;
    state.weaponLevel++;
    flash("อัปเกรดธนูสำเร็จ!");
    syncInventory();
    persist();
  };


  const respawnAutoToast=document.createElement("div");
  respawnAutoToast.className="respawn-auto-toast";
  document.body.appendChild(respawnAutoToast);

  function showRespawnAutoToast(text){
    respawnAutoToast.textContent=text;
    respawnAutoToast.classList.add("show");
    clearTimeout(showRespawnAutoToast.t);
    showRespawnAutoToast.t=setTimeout(()=>respawnAutoToast.classList.remove("show"),1300);
  }

  const autoToast=document.createElement("div");
  autoToast.className="auto-toast";
  document.body.appendChild(autoToast);

  function showAutoToast(text){
    autoToast.textContent=text;
    autoToast.classList.add("show");
    clearTimeout(showAutoToast.t);
    showAutoToast.t=setTimeout(()=>autoToast.classList.remove("show"),900);
  }


  function chooseSmartAutoTarget(){
    const alive=world.enemies.filter(e=>!e.dead);
    let best=null,bestScore=Infinity;
    for(const e of alive){
      if(state.autoAnchor){
        const leash=Math.hypot(e.pos.x-state.autoAnchor.x,e.pos.z-state.autoAnchor.z);
        if(leash>state.autoRange)continue;
      }
      const dist=Math.hypot(e.pos.x-world.player.pos.x,e.pos.z-world.player.pos.z);
      let score=dist;
      if(dist<2.6)score-=4;
      if(e.boss)score-=2.5;
      if(e.cooldown>0&&dist<3.2)score-=1.5;
      if(score<bestScore){best=e;bestScore=score;}
    }
    return best;
  }

  function setAutoSkill(enabled){
    state.autoSkill=enabled;
    const btn=document.getElementById("autoSkillBtn");
    if(btn){
      btn.classList.toggle("on",enabled);
      btn.textContent=enabled?"สกิลออโต้ ON":"สกิลออโต้ OFF";
    }
    showAutoToast(enabled?"เปิดใช้สกิลอัตโนมัติ":"โจมตีธรรมดาอัตโนมัติ");
  }

  function setAutoCombat(enabled){
    state.autoCombat=enabled;
    if(enabled){state.autoAnchor=world.player.pos.clone();}
    else{state.autoAnchor=null;}
    document.body.classList.toggle("auto-combat",enabled);
    const btn=document.getElementById("autoBtn");
    if(btn)btn.classList.toggle("on",enabled);
    if(!enabled){
      state.autoTimer=0;
      state.autoSkillTimer=0;
      state.autoIdleTime=0;
      state.autoEngaged=false;
      state.lockedTarget=null;
      state.target=null;
    }
    showAutoToast(enabled?"AUTO ON · ต่อสู้และเก็บของอัตโนมัติ":"AUTO OFF");
  }


  const hideCombatBtn=document.getElementById("hideCombatBtn");
  const showCombatBtn=document.getElementById("showCombatBtn");

  function setCombatControlsHidden(hidden){
    state.combatControlsHidden=hidden;
    document.body.classList.toggle("combat-controls-hidden",hidden);
    showCombatBtn?.classList.toggle("hidden",!hidden);
    if(hidden){
      showAutoToast(state.autoCombat?"ซ่อนปุ่มแล้ว · AUTO ยังทำงาน":"ซ่อนปุ่มควบคุมแล้ว");
    }
  }

  if(hideCombatBtn)hideCombatBtn.onclick=()=>{
    setCombatControlsHidden(true);
  };

  if(showCombatBtn)showCombatBtn.onclick=()=>{
    setCombatControlsHidden(false);
  };

  bindMobileAction("autoBtn",()=>{
    if(state.uiOpen)return;
    setAutoCombat(!state.autoCombat);
  });
  bindMobileAction("autoSkillBtn",()=>{
    if(state.uiOpen)return;
    setAutoSkill(!state.autoSkill);
  });
  setAutoSkill(state.autoSkill);

  bindMobileAction("attackBtn",()=>{
    if(state.uiOpen||state.attackCd>0)return;
    state.attackCd=.55;
    world.player.attackTime=.28;
    shoot(attackDamage(),8);
  });

  bindMobileAction("skillBtn",()=>{
    if(state.uiOpen||state.skillCd>0||state.mp<25)return;
    state.skillCd=5;
    state.mp-=25;
    world.player.attackTime=.42;
    shoot(60,11);
    flash("Seed Burst!");
  });

  bindMobileAction("skill2Btn",()=>{
    if(state.uiOpen||state.skill2Cd>0||state.mp<35)return;
    state.skill2Cd=7;
    state.mp-=35;
    world.player.attackTime=.5;
    let hits=0;
    for(const enemy of world.enemies){
      if(enemy.dead)continue;
      const dx=enemy.pos.x-world.player.pos.x;
      const dz=enemy.pos.z-world.player.pos.z;
      if(Math.hypot(dx,dz)<=3.2){
        const dealt=38+(state.weaponLevel-1)*5;
        enemy.hp-=dealt;
        enemy.hitFlash=.18;
        showDamagePop(enemy,dealt,false);
        enemy.pos.x+=dx*.18;
        enemy.pos.z+=dz*.18;
        hits++;
        if(enemy.hp<=0)killEnemy(enemy);
      }
    }
    flash(hits?`Whirl Seed! โดน ${hits} ตัว`:"Whirl Seed!");
  });

  bindMobileAction("lockBtn",()=>{
    if(state.uiOpen)return;
    const nearest=OD.findNearestEnemy(world,10);
    if(!nearest){
      state.lockedTarget=null;
      document.getElementById("lockBtn").classList.remove("locked");
      return flash("ไม่มีเป้าหมายให้ล็อก");
    }
    if(state.lockedTarget===nearest){
      state.lockedTarget=null;
      document.getElementById("lockBtn").classList.remove("locked");
      flash("ยกเลิกล็อกเป้าหมาย");
    }else{
      state.lockedTarget=nearest;
      document.getElementById("lockBtn").classList.add("locked");
      flash("ล็อกเป้าหมายแล้ว");
    }
  });

  bindMobileAction("rollBtn",()=>{
    if(state.uiOpen||state.rollCd>0)return;
    state.rollCd=2;
    const a=world.player.facing;
    world.player.pos.x+=Math.sin(a)*2.2;
    world.player.pos.z+=Math.cos(a)*2.2;
  });

  bindMobileAction("interactBtn",()=>{
    if(state.uiOpen)return;

    if(state.nearbyNpc){
      if(state.kills>=5&&!state.questDone){
        openDialogue(world.npc.name,"เจ้าช่วยสวนของเราไว้ได้ รับรางวัลนี้ไปเถอะ",[
          {label:"รับรางวัล",onClick:()=>{
            state.questDone=true;
            state.coins+=100;
            state.potions+=2;
            state.rareSeeds+=1;
            persist();
            closeDialogue();
            flash("รับ 100 เหรียญ ยา 2 ขวด และเมล็ดหายาก");
          }}
        ]);
      }else if(state.questDone){
        openDialogue(world.npc.name,"ตอนนี้หมู่บ้านปลอดภัยขึ้นมาก ขอบคุณนักผจญภัย",[
          {label:"ลาก่อน",onClick:closeDialogue}
        ]);
      }else{
        openDialogue(world.npc.name,`ตั๊กแตนกำลังทำลายสวน กำจัดให้ครบ 5 ตัว ตอนนี้ ${Math.min(5,state.kills)}/5`,[
          {label:"รับทราบ",onClick:closeDialogue}
        ]);
      }
      return;
    }

    if(state.nearbyMerchant){
      openDialogue(world.merchant.name,"ข้ามีสินค้าสำหรับนักผจญภัย",[
        {label:"ซื้อยา HP 25 🪙",onClick:()=>{
          if(state.coins<25)return flash("เหรียญไม่พอ");
          state.coins-=25;state.potions++;persist();flash("ซื้อยา HP แล้ว");
        }},
        {label:"ซื้อเมล็ดหายาก 60 🪙",onClick:()=>{
          if(state.coins<60)return flash("เหรียญไม่พอ");
          state.coins-=60;state.rareSeeds++;persist();flash("ซื้อเมล็ดหายากแล้ว");
        }}
      ]);
      return;
    }

    if(state.nearbyChest){
      world.chest.opened=true;
      state.coins+=35;
      state.potions+=1;
      flash("เปิดหีบ: +35 เหรียญ และยา HP");
      persist();
      return;
    }

    flash("ไม่มีสิ่งที่โต้ตอบได้");
  });

  function showDamagePop(enemy,amount,crit=false){
    const layer=document.getElementById("combatFeedback");
    if(!layer)return;
    const pop=document.createElement("div");
    pop.className="damage-pop"+(crit?" crit":"");
    pop.textContent=Math.round(amount);
    const dx=enemy.pos.x-world.player.pos.x;
    const dz=enemy.pos.z-world.player.pos.z;
    pop.style.left=(50+OD.clamp(dx/14,-.42,.42)*100)+"%";
    pop.style.top=(48+OD.clamp(dz/14,-.35,.35)*100)+"%";
    layer.appendChild(pop);
    setTimeout(()=>pop.remove(),760);
  }

  function pulsePlayerHit(){
    document.body.classList.add("player-hit");
    clearTimeout(pulsePlayerHit.t);
    pulsePlayerHit.t=setTimeout(()=>document.body.classList.remove("player-hit"),120);
  }

  function killEnemy(enemy){
    enemy.dead=true;
    enemy.respawnAt=performance.now()+(enemy.boss?60000:10000);
    state.kills++;
    const killedRegion=enemy.regionId||"village";
    if(enemy.boss){
      state.zoneBossKills[killedRegion]=(state.zoneBossKills[killedRegion]||0)+1;
    }else{
      state.zoneKills[killedRegion]=(state.zoneKills[killedRegion]||0)+1;
    }
    state.coins+=enemy.boss?50:5;
    state.xp+=enemy.boss?100:20;

    world.drops.push({
      pos:enemy.pos.clone(),
      value:enemy.boss?3:1,
      kind:enemy.boss?"rareSeed":(Math.random()<.28?"potion":"coin"),
      life:12,
      spin:Math.random()*6.28
    });

    if(state.xp>=state.level*100){
      state.xp-=state.level*100;
      state.level++;
      state.maxHp+=15;
      state.hp=state.maxHp;
      flash("เลเวลอัป!");addSystemLog("เลเวลอัปเป็น Lv."+state.level);
    }
persist();
  }

  let lastRegionId=null;
  let zoneBannerTimer=0;

  function update(dt){
    state.attackCd=Math.max(0,state.attackCd-dt);
    state.skillCd=Math.max(0,state.skillCd-dt);
    state.skill2Cd=Math.max(0,state.skill2Cd-dt);
    state.rollCd=Math.max(0,state.rollCd-dt);
    state.mp=Math.min(state.maxMp,state.mp+10*dt);

    world.player.attackTime=Math.max(0,world.player.attackTime-dt);

    const axis=(state.uiOpen||state.autoCombat)?{x:0,y:0}:input.axis();
    const len=Math.hypot(axis.x,axis.y);
    if(len>.05){
      const sx=axis.x/(len>1?len:1);
      const sy=axis.y/(len>1?len:1);
      const nx=sx*Math.cos(cameraYaw)+sy*Math.sin(cameraYaw);
      const nz=-sx*Math.sin(cameraYaw)+sy*Math.cos(cameraYaw);
      world.player.pos.x+=nx*4*dt;
      world.player.pos.z+=nz*4*dt;
      world.player.facing=Math.atan2(nx,nz);
      world.player.walkTime+=dt*9;
    }else{
      world.player.walkTime+=dt*2;
    }
    world.player.pos.x=OD.clamp(world.player.pos.x,-47,47);
    world.player.pos.z=OD.clamp(world.player.pos.z,-47,47);

    const currentRegion=world.getRegionAt(world.player.pos.x,world.player.pos.z);
    state.currentRegion=currentRegion.id;
    if(lastRegionId!==currentRegion.id){
      lastRegionId=currentRegion.id;
      const zoneBanner=document.getElementById("zoneBanner");
      const zoneName=document.getElementById("zoneName");
      const zoneLevel=document.getElementById("zoneLevel");
      if(zoneName)zoneName.textContent=currentRegion.thai+" · "+currentRegion.name;
      if(zoneLevel)zoneLevel.textContent=currentRegion.level;
      zoneBanner?.classList.remove("hidden");
      zoneBannerTimer=2.8;
      addSystemLog?.("เข้าสู่ "+currentRegion.thai);
    }
    if(zoneBannerTimer>0){
      zoneBannerTimer-=dt;
      if(zoneBannerTimer<=0)document.getElementById("zoneBanner")?.classList.add("hidden");
    }

    if(state.lockedTarget&&state.lockedTarget.dead)state.lockedTarget=null;

    // Manual mode can preview nearest target.
    // AUTO mode manages its own target so UI fading and target previews cannot pause AI.
    if(!state.autoCombat){
      state.target=state.lockedTarget||OD.findNearestEnemy(world);
    }

    if(state.autoCombat){
      state.autoTimer-=dt;
      state.autoSkillTimer-=dt;

      // Validate current target. Never keep an invalid/out-of-leash target.
      let currentLocked=state.lockedTarget&&!state.lockedTarget.dead?state.lockedTarget:null;
      if(currentLocked&&state.autoAnchor){
        const leash=Math.hypot(
          currentLocked.pos.x-state.autoAnchor.x,
          currentLocked.pos.z-state.autoAnchor.z
        );
        if(leash>state.autoRange+2){
          currentLocked=null;
          state.lockedTarget=null;
        }
      }

      let autoTarget=currentLocked||chooseSmartAutoTarget();

      // If the local pack is temporarily dead, widen search smoothly instead of freezing.
      if(!autoTarget){
        state.autoIdleTime+=dt;
        if(state.autoIdleTime>.6){
          const alive=world.enemies.filter(e=>!e.dead);
          let nearest=null,nearestDist=Infinity;
          for(const e of alive){
            const d=Math.hypot(
              e.pos.x-world.player.pos.x,
              e.pos.z-world.player.pos.z
            );
            // Still stay reasonably close to the current region.
            if(d<nearestDist&&d<=18){
              nearest=e;
              nearestDist=d;
            }
          }
          autoTarget=nearest;
          if(autoTarget){
            // Move the farming anchor toward the new pack so AUTO can continue naturally.
            state.autoAnchor=world.player.pos.clone();
          }
        }
      }else{
        state.autoIdleTime=0;
      }

      if(autoTarget){
        state.autoEngaged=true;
        state.lockedTarget=autoTarget;
        state.target=autoTarget;

        const dx=autoTarget.pos.x-world.player.pos.x;
        const dz=autoTarget.pos.z-world.player.pos.z;
        const dist=Math.hypot(dx,dz)||1;

        world.player.facing=Math.atan2(dx,dz);

        if(dist>2.55){
          world.player.pos.x+=dx/dist*3.1*dt;
          world.player.pos.z+=dz/dist*3.1*dt;
          world.player.walkTime+=dt*8;
        }else{
          if(state.autoSkill&&state.autoSkillTimer<=0&&state.skillCd<=0&&state.mp>=25){
            state.skillCd=5;
            state.mp-=25;
            world.player.attackTime=.42;
            shoot(60,11);
            state.autoSkillTimer=3.8;
          }else if(state.attackCd<=0&&state.autoTimer<=0){
            state.attackCd=.55;
            world.player.attackTime=.28;
            shoot(attackDamage(),8);
            state.autoTimer=.18;
          }
        }
      }else{
        // No target right now: remain in AUTO idle without touching HUD/UI state.
        state.autoEngaged=false;
        state.lockedTarget=null;
        state.target=null;
        state.autoTimer=0;
        state.autoSkillTimer=0;
      }
    }

    for(const e of world.enemies){
      e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);
      e.bob=(e.bob||0)+dt*(e.boss?2:3);
      if(e.dead){
        if(performance.now()>=e.respawnAt){
          e.dead=false;
          e.hp=e.maxHp;
          e.pos.set(e.spawn.x,0,e.spawn.z);
        }
        continue;
      }

      const dx=world.player.pos.x-e.pos.x;
      const dz=world.player.pos.z-e.pos.z;
      const d=Math.hypot(dx,dz);
      const aggro=e.boss?12:6.5;

      if(d<=aggro){
        if(d>1.1){
          e.pos.x+=dx/d*e.speed*dt;
          e.pos.z+=dz/d*e.speed*dt;
        }else{
          e.cooldown-=dt;
          if(e.cooldown<=0){
            e.cooldown=1.1;
            state.hp-=e.damage;
            pulsePlayerHit();
            flash("-"+e.damage+" HP");
          }
        }
      }else{
        e.wander+=dt*.45;
        const tx=e.spawn.x+Math.cos(e.wander)*1.4;
        const tz=e.spawn.z+Math.sin(e.wander)*1.4;
        const wx=tx-e.pos.x,wz=tz-e.pos.z,wd=Math.hypot(wx,wz)||1;
        e.pos.x+=wx/wd*e.speed*.28*dt;
        e.pos.z+=wz/wd*e.speed*.28*dt;
      }
    }

    for(const p of world.projectiles){
      if(!p.target||p.target.dead){p.dead=true;continue;}
      const dx=p.target.pos.x-p.pos.x,dz=p.target.pos.z-p.pos.z;
      const d=Math.hypot(dx,dz),step=p.speed*dt;
      if(d<=step){
        const crit=Math.random()<0.12;
        const dealt=crit?p.damage*1.75:p.damage;
        p.target.hp-=dealt;
        p.target.hitFlash=.16;
        showDamagePop(p.target,dealt,crit);
        p.dead=true;
        if(p.target.hp<=0)killEnemy(p.target);
      }else{
        p.pos.x+=dx/d*step;p.pos.z+=dz/d*step;
      }
    }
    world.projectiles=world.projectiles.filter(p=>!p.dead);

    for(let i=world.drops.length-1;i>=0;i--){
      const drop=world.drops[i];
      drop.life-=dt;
      drop.spin+=dt*3;

      const dx=drop.pos.x-world.player.pos.x;
      const dz=drop.pos.z-world.player.pos.z;
      const distance=Math.hypot(dx,dz);

      let autoCollect=false;
      if(state.autoCombat&&state.autoLoot){
        if(state.autoAnchor){
          autoCollect=Math.hypot(drop.pos.x-state.autoAnchor.x,drop.pos.z-state.autoAnchor.z)<=state.autoRange+2;
        }else{
          autoCollect=distance<=12;
        }
      }

      if(distance<1.25||autoCollect){
        if(drop.kind==="potion"){
          state.potions+=drop.value;
          flash("เก็บยา HP +" + drop.value);
        }else if(drop.kind==="rareSeed"){
          state.rareSeeds+=drop.value;
          flash("เก็บเมล็ดหายาก +" + drop.value);
        }else{
          state.coins+=drop.value*3;
          flash("เก็บเหรียญ +" + (drop.value*3));
        }
        state.items=state.potions+state.rareSeeds;
        world.drops.splice(i,1);
        persist();
      }else if(drop.life<=0){
        world.drops.splice(i,1);
      }
    }

    const npcDx=world.npc.pos.x-world.player.pos.x;
    const npcDz=world.npc.pos.z-world.player.pos.z;
    state.nearbyNpc=Math.hypot(npcDx,npcDz)<1.8;

    const merchantDx=world.merchant.pos.x-world.player.pos.x;
    const merchantDz=world.merchant.pos.z-world.player.pos.z;
    state.nearbyMerchant=Math.hypot(merchantDx,merchantDz)<1.8;

    const chestDx=world.chest.pos.x-world.player.pos.x;
    const chestDz=world.chest.pos.z-world.player.pos.z;
    state.nearbyChest=!world.chest.opened&&Math.hypot(chestDx,chestDz)<1.5;

    if(state.hp<=0){
      const keepAutoAfterRespawn=state.autoCombat;
      state.hp=state.maxHp;
      if(keepAutoAfterRespawn){
        state.lockedTarget=null;
        state.target=null;
        state.autoEngaged=false;
        state.autoIdleTime=0;
        state.autoAnchor=world.player.pos.clone();
        state.autoTimer=0;
        state.autoSkillTimer=0;
        showRespawnAutoToast("เกิดใหม่แล้ว · AUTO ทำงานต่อ");
      }
      world.player.pos.set(0,0,0);
      flash("คุณพ่ายแพ้และฟื้นคืนชีพ");
    }

    document.getElementById("hpFill").style.width=(state.hp/state.maxHp*100)+"%";
    document.getElementById("mpFill").style.width=(state.mp/state.maxMp*100)+"%";
    document.getElementById("xpFill").style.width=(state.xp/(state.level*100)*100)+"%";
    document.getElementById("coins").textContent=state.coins;
    state.items=state.potions+state.rareSeeds;
    document.getElementById("items").textContent=state.items;
    if(!inventoryPanel.classList.contains("hidden"))syncInventory();
    const questText=document.getElementById("questText");
    const region=world.regions.find(r=>r.id===state.currentRegion)||world.regions[0];
    const localKills=state.zoneKills[state.currentRegion]||0;
    const bossKills=state.zoneBossKills[state.currentRegion]||0;

    if(region.id==="village"){
      if(state.questDone){
        questText.textContent="สำเร็จแล้ว — ออกสำรวจโลกกว้าง";
      }else if(state.kills>=5){
        questText.textContent="กลับไปหาผู้ดูแลสวน";
      }else{
        questText.innerHTML='ปกป้องหมู่บ้าน <span id="questCount">'+Math.min(5,state.kills)+'</span>/5';
      }
    }else if(localKills<5){
      questText.textContent=region.thai+" · กำจัดมอนสเตอร์ "+localKills+"/5";
    }else if(region.boss && bossKills<1){
      const boss=world.enemyDefs[region.boss];
      questText.textContent="ภารกิจบอส · ปราบ "+boss.name;
    }else{
      questText.textContent=region.thai+" · สำรวจพื้นที่สำเร็จ";
    }

    setActionCooldown("attackBtn","โจมตี",state.attackCd);
    setActionCooldown("skillBtn","สกิล 1",state.skillCd);
    setActionCooldown("skill2Btn","สกิล 2",state.skill2Cd);
    setActionCooldown("rollBtn","กลิ้ง",state.rollCd);
    const levelValue=document.getElementById("levelValue");
    if(levelValue)levelValue.textContent=state.level;
    const hpText=document.getElementById("hpText");
    const mpText=document.getElementById("mpText");
    if(hpText)hpText.textContent=`${Math.max(0,Math.ceil(state.hp))}/${state.maxHp}`;
    if(mpText)mpText.textContent=`${Math.max(0,Math.ceil(state.mp))}/${state.maxMp}`;
    document.body.classList.toggle("low-hp",state.hp/state.maxHp<=0.25);
    const activeCombatTarget=state.lockedTarget||state.target;
    const targetAlive=!!(activeCombatTarget&&!activeCombatTarget.dead);
    const targetDist=targetAlive?Math.hypot(
      activeCombatTarget.pos.x-world.player.pos.x,
      activeCombatTarget.pos.z-world.player.pos.z
    ):Infinity;

    // UI fades only during real nearby combat.
    // It no longer controls or blocks AUTO behavior.
    const inCombat=state.autoCombat
      ? !!(state.autoEngaged&&targetAlive&&targetDist<=8)
      : !!(targetAlive&&targetDist<=8);

    document.body.classList.toggle("in-combat",inCombat);
    // V3.0.3: utility UI must stay visible at all times.
    document.querySelector(".quest-card")?.classList.remove("combat-hide");
    document.querySelector(".minimap")?.classList.remove("combat-hide");
    document.querySelector(".utility-rail")?.classList.remove("combat-hide");
    const targetBoss=document.getElementById("targetBossBar");
    if(activeCombatTarget&&!activeCombatTarget.dead){
      targetBoss.classList.remove("hidden");
      const nm=activeCombatTarget.name||(activeCombatTarget.boss?"บอสประจำพื้นที่":"มอนสเตอร์");
      document.getElementById("targetName").textContent=nm;
      const dx=activeCombatTarget.pos.x-world.player.pos.x;
      const dz=activeCombatTarget.pos.z-world.player.pos.z;
      document.getElementById("targetDistance").textContent=Math.hypot(dx,dz).toFixed(1)+"m";
      document.getElementById("targetHpFill").style.width=Math.max(0,activeCombatTarget.hp/activeCombatTarget.maxHp*100)+"%";
    }else{
      targetBoss.classList.add("hidden");
    }

    document.getElementById("target").textContent="เป้าหมาย: "+(state.target?(state.target.boss?"บอสตั๊กแตนยักษ์":state.target.kind):"ไม่มี");
    const hint=document.getElementById("hint");
    const interact=document.getElementById("interactBtn");
    interact.classList.toggle("visible",state.nearbyNpc||state.nearbyMerchant||state.nearbyChest);
    if(state.nearbyNpc){
      hint.textContent=state.kills>=5&&!state.questDone?"กด คุย เพื่อส่งเควสต์":"กด คุย กับผู้ดูแลสวน";
      interact.textContent="คุย";
      hint.classList.remove("hidden");
    }else if(state.nearbyMerchant){
      hint.textContent="กด คุย เพื่อเปิดร้านค้า";
      interact.textContent="ร้านค้า";
      hint.classList.remove("hidden");
    }else if(state.nearbyChest){
      hint.textContent="กด เปิด เพื่อเปิดหีบสมบัติ";
      interact.textContent="เปิด";
      hint.classList.remove("hidden");
    }else{
      hint.textContent="ลากพื้นที่ว่างเพื่อหมุนกล้อง";
      interact.textContent="คุย";
      if(state.kills>0)hint.classList.add("hidden");
    }
  }

  function render(){
    const desiredCamX=world.player.pos.x+Math.sin(cameraYaw)*cameraDistance;
    const desiredCamY=8.4+(cameraDistance-11.5)*.18;
    const desiredCamZ=world.player.pos.z+Math.cos(cameraYaw)*cameraDistance;

    const focusTarget=state.lockedTarget&&!state.lockedTarget.dead?state.lockedTarget:null;
    const focusX=focusTarget?OD.lerp(world.player.pos.x,focusTarget.pos.x,.22):world.player.pos.x;
    const focusZ=focusTarget?OD.lerp(world.player.pos.z,focusTarget.pos.z,.22):world.player.pos.z;
    renderer.camera.targetX=OD.lerp(renderer.camera.targetX,focusX,.14);
    renderer.camera.targetY=OD.lerp(renderer.camera.targetY,.75,.14);
    renderer.camera.targetZ=OD.lerp(renderer.camera.targetZ,focusZ,.14);
    renderer.camera.x=OD.lerp(renderer.camera.x,desiredCamX,.12);
    renderer.camera.y=OD.lerp(renderer.camera.y,desiredCamY,.12);
    renderer.camera.z=OD.lerp(renderer.camera.z,desiredCamZ,.12);

    renderer.begin();

    // ===== OPEN WORLD REGIONS V3.0 =====
    // Large connected world base
    renderer.drawBox(0,-1.15,0,49,.85,49,[.25,.43,.20,1]);

    // Village / Meadow
    renderer.drawBox(0,-.24,0,14,.18,14,[.33,.62,.25,1]);

    // Beetle Woods
    renderer.drawBox(-31,-.22,0,16,.18,18,[.16,.40,.16,1]);
    // Sporeveil Marsh
    renderer.drawBox(31,-.24,0,16,.18,18,[.20,.40,.30,1]);
    // Sunscorch Desert
    renderer.drawBox(0,-.22,31,18,.18,16,[.66,.51,.29,1]);
    // Frostleaf Highlands
    renderer.drawBox(0,-.20,-31,18,.18,16,[.55,.72,.74,1]);

    // Main roads connecting all regions
    for(let i=-36;i<=36;i+=3){
      renderer.drawBox(i,-.01,0,1.45,.035,1.05,[.54,.39,.25,1]);
      renderer.drawBox(0,-.005,i,1.05,.035,1.45,[.54,.39,.25,1]);
    }

    // Region gates / landmarks
    // ===== VISIBLE REGION LANDMARKS =====
    // Four large directional monuments visible from the central hub
    // West: Beetle Woods
    renderer.drawBox(-12,1.25,0,.35,1.45,2.6,[.25,.13,.06,1]);
    renderer.drawBox(-12,3.0,0,1.7,.28,2.6,[.18,.35,.14,1]);
    // East: Spore Marsh
    renderer.drawBox(12,1.25,0,.35,1.45,2.6,[.40,.30,.42,1]);
    renderer.drawBox(12,3.0,0,1.7,.28,2.6,[.52,.25,.62,1]);
    // South: Desert
    renderer.drawBox(0,1.25,12,2.6,1.45,.35,[.58,.40,.14,1]);
    renderer.drawBox(0,3.0,12,2.6,.28,1.7,[.78,.58,.22,1]);
    // North: Frost
    renderer.drawBox(0,1.25,-12,2.6,1.45,.35,[.38,.58,.66,1]);
    renderer.drawBox(0,3.0,-12,2.6,.28,1.7,[.68,.88,.94,1]);
    renderer.drawBox(-15,.75,0,.28,.85,2.2,[.38,.24,.12,1]);
    renderer.drawBox(15,.75,0,.28,.85,2.2,[.30,.24,.18,1]);
    renderer.drawBox(0,.75,15,2.2,.85,.28,[.48,.34,.15,1]);
    renderer.drawBox(0,.75,-15,2.2,.85,.28,[.42,.58,.62,1]);

    // ===== REGION IDENTITY BOOST =====
    // Beetle Woods dark ridge
    renderer.drawBox(-31,.18,-14,14,.36,2,[.10,.26,.11,1]);
    // Spore marsh bright poisonous basin
    renderer.drawBox(31,-.05,10,10,.06,5,[.20,.54,.60,1]);
    // Desert temple ruin
    renderer.drawBox(-8,.55,31,1.6,.75,1.6,[.62,.43,.22,1]);
    renderer.drawBox(8,.55,31,1.6,.75,1.6,[.62,.43,.22,1]);
    renderer.drawBox(0,1.8,31,7,.35,1.1,[.72,.52,.26,1]);
    // Frost crystal shrine
    renderer.drawBox(0,.85,-37,.4,1.2,.4,[.70,.92,1,1],.4);
    renderer.drawBox(-2,.6,-36,.25,.9,.25,[.58,.84,.96,1],-.3);
    renderer.drawBox(2,.6,-36,.25,.9,.25,[.58,.84,.96,1],.3);

    // Beetle Woods dense trees
    for(let i=0;i<20;i++){
      const x=-31+Math.cos(i*1.73)*13;
      const z=Math.sin(i*2.11)*15;
      renderer.drawBox(x,.55,z,.20,.70,.20,[.28,.18,.10,1]);
      renderer.drawBox(x,1.55,z,.72,.86,.72,[.08,.32,.13,1],i*.17);
    }

    // Spore marsh pools and giant mushrooms
    for(let i=0;i<9;i++){
      const x=31+Math.cos(i*2.3)*12;
      const z=Math.sin(i*1.6)*14;
      renderer.drawBox(x,-.02,z,1.2,.035,.8,[.16,.48,.55,1],i*.2);
      renderer.drawBox(x,.55,z,.18,.50,.18,[.76,.70,.56,1]);
      renderer.drawBox(x,1.15,z,.55,.16,.55,[.50,.24,.62,1],i*.12);
    }

    // Desert dunes / stones
    for(let i=0;i<16;i++){
      const x=Math.cos(i*1.9)*15;
      const z=31+Math.sin(i*2.2)*12;
      renderer.drawBox(x,.10,z,.65,.18,.55,[.74,.57,.30,1],i*.24);
    }

    // Frost crystals / pines
    for(let i=0;i<14;i++){
      const x=Math.cos(i*1.7)*15;
      const z=-31+Math.sin(i*2.05)*12;
      renderer.drawBox(x,.55,z,.16,.65,.16,[.30,.40,.34,1]);
      renderer.drawBox(x,1.45,z,.50,.70,.50,[.28,.58,.52,1],i*.18);
      if(i%3===0)renderer.drawBox(x+1,.55,z+.5,.18,.70,.18,[.62,.88,.95,1],.4);
    }


    // Central village foundation is now part of the connected open world.

    // Main dirt path
    for(let i=-9;i<=9;i++){
      renderer.drawBox(i*1.3,-.03,0,0.62,.035,1.25,[.63,.46,.29,1],0.02*Math.sin(i));
    }

    // Village area
    renderer.drawBox(-8.6,.65,-7.1,1.7,.8,1.55,[.84,.75,.55,1],.18);
    renderer.drawBox(-8.6,1.75,-7.1,1.95,.32,1.75,[.78,.25,.19,1],.18);
    renderer.drawBox(-7.9,.55,-5.2,1.1,.7,1.0,[.74,.66,.48,1],-.22);
    renderer.drawBox(-7.9,1.5,-5.2,1.28,.28,1.15,[.72,.22,.16,1],-.22);

    // Pond and bridge
    renderer.drawBox(7.6,-.02,6.6,2.4,.04,1.7,[.18,.58,.78,1],-.28);
    for(let i=-2;i<=2;i++){
      renderer.drawBox(7.6+i*.52,.16,6.6,.22,.07,1.92,[.52,.34,.18,1],-.28);
    }

    // Decorative rocks, flowers and trees
    for(let i=0;i<28;i++){
      const a=i*Math.PI*2/28;
      const r=12.4+(i%4)*.55;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      renderer.drawBox(x,.5,z,.18,.65,.18,[.39,.24,.13,1]);
      renderer.drawBox(x,1.38,z,.62+(i%2)*.12,.72,.62,[.10,.43+(i%3)*.03,.18,1],a*.3);
      renderer.drawBox(x,2.15,z,.44,.54,.44,[.14,.50,.22,1],-a*.2);
    }

    for(let i=0;i<16;i++){
      const x=((i*7)%21)-10;
      const z=((i*11)%19)-9;
      if(Math.abs(z)<1.7) continue;
      renderer.drawBox(x,.12,z,.18,.12,.16,[.48,.48,.46,1],i*.31);
      renderer.drawBox(x+.17,.16,z-.10,.10,.08,.10,[.60,.58,.54,1],i*.13);
    }

    for(let i=0;i<20;i++){
      const x=((i*5)%23)-11;
      const z=((i*9)%21)-10;
      if(Math.abs(z)<1.5) continue;
      const colors=[[1,.38,.45,1],[1,.78,.25,1],[.72,.43,1,1]];
      renderer.drawBox(x,.12,z,.04,.16,.04,[.18,.48,.16,1]);
      renderer.drawBox(x,.28,z,.11,.06,.11,colors[i%colors.length],i*.4);
    }

    // NPC quest giver
    const npc=world.npc.pos;
    renderer.drawBox(npc.x,.48,npc.z,.30,.42,.25,[.34,.28,.58,1],.35);
    renderer.drawBox(npc.x,.98,npc.z,.34,.34,.28,[.52,.42,.76,1],.35);
    renderer.drawBox(npc.x,1.48,npc.z,.25,.25,.25,[.86,.67,.52,1],.35);
    renderer.drawBox(npc.x,1.92,npc.z,.09,.09,.09,[1,.84,.18,1],0);

    // Merchant NPC
    const merchant=world.merchant.pos;
    renderer.drawBox(merchant.x,.48,merchant.z,.30,.42,.25,[.43,.24,.12,1],-.2);
    renderer.drawBox(merchant.x,.98,merchant.z,.34,.34,.28,[.72,.43,.16,1],-.2);
    renderer.drawBox(merchant.x,1.48,merchant.z,.25,.25,.25,[.84,.64,.48,1],-.2);
    renderer.drawBox(merchant.x,1.76,merchant.z,.34,.10,.34,[.52,.18,.08,1],-.2);

    // Treasure chest
    const chest=world.chest.pos;
    if(!world.chest.opened){
      renderer.drawBox(chest.x,.24,chest.z,.48,.22,.34,[.44,.23,.10,1],-.25);
      renderer.drawBox(chest.x,.55,chest.z,.50,.12,.36,[.68,.38,.14,1],-.25);
      renderer.drawBox(chest.x,.46,chest.z,.08,.08,.38,[1,.72,.18,1],-.25);
    }

    // Player: stylized Seed Ranger with procedural movement
    const p=world.player.pos;
    const f=world.player.facing;
    const axisNow=input.axis();
    const moving=Math.abs(axisNow.x)+Math.abs(axisNow.y)>.08;
    const walkSwing=moving?Math.sin(world.player.walkTime):0;
    const bob=moving?Math.abs(Math.sin(world.player.walkTime))*.07:Math.sin(world.player.walkTime)*.012;
    const attackPhase=Math.max(0,Math.min(1,world.player.attackTime/.42));
    const attackSwing=Math.sin((1-attackPhase)*Math.PI)*Math.min(1,world.player.attackTime*5);

    renderer.drawBox(p.x,.48+bob,p.z,.16,.30,.16,[.16,.44,.24,1],f+walkSwing*.08);
    renderer.drawBox(p.x,.95+bob,p.z,.31,.35,.25,[.24,.64,.34,1],f);
    renderer.drawBox(p.x,1.46+bob,p.z,.24,.24,.24,[.92,.72,.58,1],f);
    renderer.drawBox(p.x,1.75+bob,p.z,.33,.15,.33,[.10,.34,.20,1],f);

    renderer.drawBox(p.x+Math.cos(f)*(.17+walkSwing*.07),.23+bob,p.z-Math.sin(f)*(.17+walkSwing*.07),.09,.22,.09,[.11,.34,.18,1],f);
    renderer.drawBox(p.x-Math.cos(f)*(.17+walkSwing*.07),.23+bob,p.z+Math.sin(f)*(.17+walkSwing*.07),.09,.22,.09,[.11,.34,.18,1],f);

    renderer.drawBox(p.x+Math.cos(f)*(.34+attackSwing*.14),1.02+bob+walkSwing*.09,p.z-Math.sin(f)*(.34+attackSwing*.14),.07,.35,.07,[.48,.28,.12,1],f);
    renderer.drawBox(p.x-Math.cos(f)*(.34+attackSwing*.10),1.02+bob-walkSwing*.09,p.z+Math.sin(f)*(.34+attackSwing*.10),.07,.35,.07,[.48,.28,.12,1],f);

    if(attackSwing>.2){
      const sx=p.x+Math.sin(f)*.72;
      const sz=p.z+Math.cos(f)*.72;
      renderer.drawBox(sx,1.05+bob,sz,.06,.40,.70,[1,.78,.25,.72],f+attackSwing*.8);
    }

    // Enemies
    for(const e of world.enemies){
      if(e.dead)continue;
      const s=e.boss?1.75:1;
      const dx=world.player.pos.x-e.pos.x;
      const dz=world.player.pos.z-e.pos.z;
      const ang=Math.atan2(dx,dz);
      const bounce=Math.abs(Math.sin(e.bob||0))*.05;
      const flash=e.hitFlash>0;
      const base1=flash?[1,.82,.82,1]:(e.color1||[.34,.62,.20,1]);
      const base2=flash?[1,.62,.62,1]:(e.color2||[.46,.72,.27,1]);

      if(["beetle","iceGolem","kingBeetle","sandTitan"].includes(e.kind)){
        renderer.drawBox(e.pos.x,.43*s+bounce,e.pos.z,.58*s,.33*s,.44*s,base1,ang);
        renderer.drawBox(e.pos.x+Math.sin(ang)*.48*s,.50*s+bounce,e.pos.z+Math.cos(ang)*.48*s,.28*s,.23*s,.28*s,base2,ang);
        renderer.drawBox(e.pos.x,.69*s+bounce,e.pos.z,.42*s,.18*s,.34*s,flash?[1,.45,.35,1]:[.44,.18,.10,1],ang);
      }else{
        renderer.drawBox(e.pos.x,.46*s+bounce,e.pos.z,.54*s,.30*s,.38*s,base1,ang);
        renderer.drawBox(e.pos.x+Math.sin(ang)*.48*s,.53*s+bounce,e.pos.z+Math.cos(ang)*.48*s,.27*s,.22*s,.26*s,base2,ang);
        renderer.drawBox(e.pos.x-Math.cos(ang)*.42*s,.18*s+bounce,e.pos.z+Math.sin(ang)*.42*s,.08*s,.32*s,.08*s,[.18,.28,.10,1],ang+.55);
        renderer.drawBox(e.pos.x+Math.cos(ang)*.42*s,.18*s+bounce,e.pos.z-Math.sin(ang)*.42*s,.08*s,.32*s,.08*s,[.18,.28,.10,1],ang-.55);
      }

      const hpRatio=Math.max(0,e.hp/e.maxHp);
      renderer.drawBox(e.pos.x,1.28*s+bounce,e.pos.z,.52*s,.045*s,.06*s,[.22,.08,.08,1],0);
      renderer.drawBox(e.pos.x-(1-hpRatio)*.52*s,1.29*s+bounce,e.pos.z,.52*s*hpRatio,.032*s,.065*s,[.92,.18,.16,1],0);

      if((state.lockedTarget||state.target)===e){
        renderer.drawBox(e.pos.x,1.58*s+bounce,e.pos.z,.16*s,.06*s,.16*s,[1,.78,.15,1],performance.now()*.003);
      }
    }

    // Loot drops
    for(const drop of world.drops){
      const floatY=.28+Math.sin(drop.spin)*.10;
      const primary=drop.kind==="potion"?[.95,.20,.28,1]:(drop.kind==="rareSeed"?[.62,.35,1,1]:[1,.76,.18,1]);
      renderer.drawBox(drop.pos.x,floatY,drop.pos.z,.14,.14,.14,primary,drop.spin);
      renderer.drawBox(drop.pos.x,floatY+.20,drop.pos.z,.07,.07,.07,[.45,.90,1,1],-drop.spin);
    }

    // Projectiles with a short trail
    for(const pr of world.projectiles){
      renderer.drawBox(pr.pos.x,.76,pr.pos.z,.10,.10,.10,[1,.72,.18,1]);
      renderer.drawBox(pr.pos.x-.13,.76,pr.pos.z,.07,.06,.06,[1,.42,.08,.75]);
    }
  }

  let last=performance.now();
  function loop(now){
    requestAnimationFrame(loop);
    const dt=Math.min(.04,(now-last)/1000);last=now;
    update(dt);render();
  }
  requestAnimationFrame(loop);

}catch(err){
  showError(err.message||String(err));
}
})();


