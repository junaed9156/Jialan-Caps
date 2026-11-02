/* A dependency-free WebGL form study. The catalogue photographs remain the product reference. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('cap-canvas'), view = $('studio-view');
  if (!canvas || !view) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = $('motion-toggle');
  let motionPaused = reduced.matches;
  const shapes = {
    cylinder: {model:'WL100', name:'The signature cylinder', page:4, number:'01', photo:'assets/hero-gold.webp', product:'wl100'},
    ribbed: {model:'KY100', name:'The ribbed classic', page:10, number:'02', photo:'assets/products.webp', product:'ky100'},
    sphere: {model:'JLQ36', name:'The statement sphere', page:26, number:'03', photo:'assets/hero-sphere.webp', product:'jlq36'}
  };
  const metals = {
    gold: {name:'Polished gold', color:[0.78,0.51,0.17], roughness:0.22},
    silver: {name:'Polished silver', color:[0.68,0.75,0.72], roughness:0.19},
    black: {name:'Glossy black', color:[0.035,0.047,0.04], roughness:0.16}
  };
  const state = {shape:'cylinder', metal:'gold', yaw:25*Math.PI/180, pitch:0.22, auto:!reduced.matches, exploded:false, lift:0, visible:false, dragging:false, lost:false};
  let gl, softwareContext, program, capMesh, collarMesh, pumpMesh, labelTexture, locations;
  let softwareFaces = [], softwareLabels = [];
  let frame = 0, lastTime = 0, pointerStart = null;
  let targetPitch = state.pitch, targetYaw = state.yaw;
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  function setMotion(paused) {
    motionPaused = paused;
    document.body.classList.toggle('motion-paused',paused);
    motionButton.setAttribute('aria-pressed',String(paused));
    motionButton.innerHTML = `${paused?'Play':'Pause'} motion <span aria-hidden="true">${paused?'▷':'Ⅱ'}</span>`;
    if (paused) state.auto = false;
    updateSpin(); requestRender();
  }
  motionButton.addEventListener('click',() => {
    const resume = motionPaused;
    setMotion(!resume);
    if (resume) {state.auto = true; updateSpin(); requestRender();}
  });
  reduced.addEventListener('change',() => setMotion(reduced.matches));
  setMotion(motionPaused);
  const hero = document.querySelector('.hero-scene');
  if (matchMedia('(hover: hover)').matches) {
    hero.addEventListener('pointermove',e => {
      if (motionPaused) return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--scene-x',((e.clientX-r.left)/r.width-.5)*2);
      hero.style.setProperty('--scene-y',((e.clientY-r.top)/r.height-.5)*2);
    },{passive:true});
    hero.addEventListener('pointerleave',() => {hero.style.setProperty('--scene-x',0);hero.style.setProperty('--scene-y',0);});
  }
  function updateSpin() {
    const rotating = state.auto && !motionPaused;
    $('studio-spin').setAttribute('aria-pressed',String(rotating));
    $('studio-spin-label').textContent = rotating?'Pause rotation':'Play rotation';
    $('studio-spin-icon').textContent = rotating?'Ⅱ':'▷';
  }
  function announce() {
    $('studio-status').textContent = `${shapes[state.shape].name} in ${metals[state.metal].name.toLowerCase()}. ${state.exploded?'Cap lifted.':'Assembly closed.'}`;
  }
  function updateSelection() {
    const s = shapes[state.shape];
    document.querySelectorAll('[data-shape]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.shape===state.shape)));
    document.querySelectorAll('[data-metal]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.metal===state.metal)));
    $('studio-model').textContent = `${s.model} / ${s.number}`;
    $('studio-caption').textContent = s.name;
    $('studio-finish-name').textContent = metals[state.metal].name;
    $('studio-specs').textContent = `View ${s.model} specifications ↗`;
    $('studio-specs').href = `assets/jialan-catalogue-2026.pdf#page=${s.page}`;
    canvas.setAttribute('aria-label',`Interactive ${metals[state.metal].name.toLowerCase()} ${s.name.toLowerCase()} and collar in 3D. Use the controls below to rotate or separate the assembly.`);
    // With WebGL unavailable, show the exact catalogue photograph for this model and finish.
    const p = window.JIALAN.products.find(p => p.id===s.product);
    const wanted = {gold:'Glossy gold',silver:'Glossy silver',black:'Glossy black'}[state.metal];
    const v = Math.max(0,p.finishes.indexOf(wanted));
    const index = p.images[v];
    const fallback = $('studio-fallback');
    fallback.src = 'assets/products.webp';
    fallback.alt = `${s.model}, ${p.finishes[v]}, catalogue photograph`;
    fallback.style.objectFit = 'none';
    // A sprite-backed element prevents scaling the entire atlas into a fallback photograph.
    let photo = $('studio-fallback-photo');
    if (!photo) {photo = document.createElement('div');photo.id='studio-fallback-photo';photo.className='product-photo';photo.setAttribute('role','img');$('studio-render').append(photo);}
    photo.style.cssText=`--x:${index%10};--y:${Math.floor(index/10)};position:absolute;width:80%;height:90%;left:10%;top:5%;mix-blend-mode:normal;background-color:#e5e9dc;`;
    photo.setAttribute('aria-label',fallback.alt);
    photo.hidden = !!(gl || softwareContext) && !state.lost;
    fallback.hidden = true;
    announce();
  }
  document.querySelectorAll('[data-shape]').forEach(b => b.addEventListener('click',() => {
    if (state.shape===b.dataset.shape) return;
    state.shape=b.dataset.shape;
    if ((gl || softwareContext) && !state.lost) {destroyMesh(capMesh);capMesh=createCap(state.shape);}
    updateSelection(); requestRender();
  }));
  document.querySelectorAll('[data-metal]').forEach(b => b.addEventListener('click',() => {
    state.metal=b.dataset.metal;updateSelection();requestRender();
  }));
  $('studio-explode').addEventListener('click',() => {
    state.exploded=!state.exploded;
    $('studio-explode').setAttribute('aria-pressed',String(state.exploded));
    $('studio-explode-label').textContent=state.exploded?'Close assembly':'Lift the cap';
    view.classList.toggle('is-exploded',state.exploded);
    announce();requestRender();
  });
  $('studio-spin').addEventListener('click',() => {
    if (motionPaused) {setMotion(false);state.auto=true;} else state.auto=!state.auto;
    updateSpin();requestRender();
  });
  $('studio-reset').addEventListener('click',() => {
    targetYaw=25*Math.PI/180;targetPitch=.22;state.exploded=false;
    $('studio-explode').setAttribute('aria-pressed','false');
    $('studio-explode-label').textContent='Lift the cap';
    view.classList.remove('is-exploded');
    state.auto=!motionPaused;updateSpin();announce();requestRender();
  });
  $('studio-angle').addEventListener('input',e => {
    state.auto=false;updateSpin();targetYaw=Number(e.target.value)*Math.PI/180;requestRender();
  });
  function syncAngle() {
    const angle=Math.round(((state.yaw*180/Math.PI)%360+360)%360);
    $('studio-angle').value=angle;$('studio-angle-value').value=`${angle}°`;
  }
  canvas.addEventListener('pointerdown',e => {
    if (e.button!==0) return;
    pointerStart={x:e.clientX,y:e.clientY,yaw:targetYaw,pitch:targetPitch,id:e.pointerId};
    if (e.pointerType==='mouse') {state.dragging=true;canvas.setPointerCapture(e.pointerId);state.auto=false;updateSpin();}
  });
  canvas.addEventListener('pointermove',e => {
    if (!pointerStart || pointerStart.id!==e.pointerId) return;
    const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;
    // Horizontal drags rotate. Vertical touch gestures keep their native page scrolling.
    if (!state.dragging && Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)*1.2) {
      state.dragging=true;canvas.setPointerCapture(e.pointerId);state.auto=false;updateSpin();
    }
    if (!state.dragging) return;
    targetYaw=pointerStart.yaw+dx*.011;
    targetPitch=clamp(pointerStart.pitch+dy*.005,-.38,.65);
    requestRender();
  });
  function releasePointer() {state.dragging=false;pointerStart=null;}
  canvas.addEventListener('pointerup',releasePointer);
  canvas.addEventListener('pointercancel',releasePointer);
  canvas.addEventListener('lostpointercapture',releasePointer);

  // A small software renderer preserves the same real 3D geometry without GPU support.
  // It projects, lights, back-face-culls and depth-sorts the mesh on a 2D canvas.
  function world(m,x,y,z){return [m[0]*x+m[4]*y+m[8]*z,m[1]*x+m[5]*y+m[9]*z,m[2]*x+m[6]*y+m[10]*z];}
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function project(p){const f=canvas.height/(2*Math.tan(.325)),d=5.3-p[2];return [canvas.width/2+p[0]*f/d,canvas.height/2-p[1]*f/d];}
  function softwareDraw(mesh,offset,color,brand,roughness,m){
    const a=mesh.vertices,key=normalize([-2,3,4]);
    for(let i=0;i<a.length;i+=24){
      const p0=world(m,a[i],a[i+1]+offset,a[i+2]);
      const p1=world(m,a[i+8],a[i+9]+offset,a[i+10]);
      const p2=world(m,a[i+16],a[i+17]+offset,a[i+18]);
      const P=p0.map((v,k)=>(v+p1[k]+p2[k])/3);
      const N=normalize(world(m,(a[i+3]+a[i+11]+a[i+19])/3,(a[i+4]+a[i+12]+a[i+20])/3,(a[i+5]+a[i+13]+a[i+21])/3));
      const V=normalize([-P[0],-P[1],5.3-P[2]]),ndv=dot(N,V);
      if(ndv<=0)continue;
      const R=N.map((v,k)=>2*ndv*v-V[k]);
      const horizontal=normalize([R[0],0,R[2]]);
      const band=Math.pow(Math.max(dot(horizontal,normalize([-.6,0,1])),0),18);
      const rim=Math.pow(Math.max(dot(horizontal,normalize([.9,0,.4])),0),34);
      const ceiling=Math.pow(Math.max(R[1],0),3),diffuse=Math.max(dot(N,key),0);
      const spec=Math.pow(Math.max(dot(N,normalize(key.map((v,k)=>v+V[k]))),0),200-170*roughness);
      const fresnel=Math.pow(1-Math.max(ndv,0),3);
      const c=color.map((v,k)=>{
        const light=[.16,.22,.18][k]+[1.8,1.65,1.3][k]*band+[1.3,1.5,1.4][k]*rim+[.75,.8,.69][k]*ceiling;
        let value=v*(light+.18+.21*diffuse)+[1,.95,.8][k]*spec*.65+[.25,.38,.29][k]*fresnel;
        value*=.83+.17*clamp((P[1]+.8)/1.7,0,1);
        return Math.round(255*Math.pow(value/(value+.5),1/2.2));
      });
      softwareFaces.push({z:P[2],points:[project(p0),project(p1),project(p2)],color:`rgb(${c.join(',')})`});
    }
    if(brand){
      const r=state.shape==='sphere'?.88:.664,center=world(m,0,.04+offset,r),normal=world(m,0,0,1);
      if(normal[2]>.2){
        const h=world(m,.5,.04+offset,r),v=world(m,0,-.46+offset,r);
        softwareLabels.push({center:project(center),h:project(h),v:project(v),opacity:normal[2]});
      }
    }
  }
  function paintSoftware(){
    const ctx=softwareContext;
    softwareFaces.sort((a,b)=>a.z-b.z);
    for(const face of softwareFaces){
      const p=face.points;ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();ctx.fillStyle=face.color;ctx.strokeStyle=face.color;ctx.lineWidth=.6;ctx.fill();ctx.stroke();
    }
    for(const label of softwareLabels){
      const {center:c,h,v}=label;ctx.save();ctx.transform((h[0]-c[0])/50,(h[1]-c[1])/50,(v[0]-c[0])/50,(v[1]-c[1])/50,c[0],c[1]);
      ctx.globalAlpha=label.opacity*.4;ctx.fillStyle=state.metal==='black'?'#e4e2c7':'#18382d';ctx.textAlign='center';ctx.font='8px Georgia';ctx.fillText('J I A L A N',0,0);ctx.font='3px Arial';ctx.fillText('C A P S  &  C L O S U R E S',0,6);ctx.restore();
    }
  }
  // Column-major matrices: the view uses a fixed studio camera; the object rotates.
  function rotation(y,p) {
    const c=Math.cos(y),s=Math.sin(y),cp=Math.cos(p),sp=Math.sin(p);
    return new Float32Array([c,sp*s,-cp*s,0,0,cp,sp,0,s,-sp*c,cp*c,0,0,0,0,1]);
  }
  function perspective(aspect) {
    const f=1/Math.tan(.65/2),near=.1,far=30;
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  }
  const vertex=`
    attribute vec3 aPosition; attribute vec3 aNormal; attribute vec2 aUV;
    uniform mat4 uModel; uniform mat4 uProjection; uniform float uOffset;
    varying vec3 vPosition; varying vec3 vNormal; varying vec2 vUV;
    void main(){vec3 p=aPosition+vec3(0.,uOffset,0.);vec4 w=uModel*vec4(p,1.);vPosition=w.xyz;vNormal=mat3(uModel)*aNormal;vUV=aUV;gl_Position=uProjection*vec4(w.xyz-vec3(0.,0.,5.3),1.);}
  `;
  const fragment=`
    precision highp float;
    varying vec3 vPosition; varying vec3 vNormal; varying vec2 vUV;
    uniform vec3 uColor; uniform float uRoughness; uniform float uBrand; uniform sampler2D uLabel;
    void main(){
      vec3 N=normalize(vNormal),V=normalize(vec3(0.,0.,5.3)-vPosition),R=reflect(-V,N);
      vec3 key=normalize(vec3(-2.,3.,4.));
      float diffuse=max(dot(N,key),0.);
      float band=pow(max(dot(normalize(vec3(R.x,0.,R.z)),normalize(vec3(-.6,0.,1.))),0.),18.);
      float rim=pow(max(dot(normalize(vec3(R.x,0.,R.z)),normalize(vec3(.9,0.,.4))),0.),34.);
      float ceiling=pow(max(R.y,0.),3.);
      float spec=pow(max(dot(N,normalize(key+V)),0.),mix(200.,30.,uRoughness));
      float fresnel=pow(1.-max(dot(N,V),0.),3.);
      vec3 light=vec3(.16,.22,.18)+vec3(1.8,1.65,1.3)*band+vec3(1.3,1.5,1.4)*rim+vec3(.75,.8,.69)*ceiling;
      vec3 color=uColor*(light+.18+.21*diffuse)+vec3(1.,.95,.8)*spec*.65+vec3(.25,.38,.29)*fresnel;
      color*=.83+.17*smoothstep(-.8,.9,vPosition.y);
      vec2 labelUV=vec2((vUV.x-.25)*5.+.5,(vUV.y-.51)*3.+.5);
      if(uBrand>.5 && labelUV.x>0. && labelUV.x<1. && labelUV.y>0. && labelUV.y<1.){float ink=texture2D(uLabel,labelUV).a;color=mix(color,color*.38,ink*.65);}
      color=pow(color/(color+vec3(.5)),vec3(.454545));
      gl_FragColor=vec4(color,1.);
    }
  `;
  function shader(type,source) {
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message);}
    return s;
  }
  function normalize(v){const d=Math.hypot(...v)||1;return v.map(x=>x/d);}
  function lathe(profile,ribs=0,segments=192) {
    if(softwareContext)segments=ribs?168:72;
    const data=[];
    function point(i,j){
      const t=j/segments*Math.PI*2,ripple=ribs?.012*Math.cos(t*56):0;
      const [r,y]=profile[i];const radius=r>0.1?r+ripple:r;
      const a=profile[Math.max(0,i-1)],b=profile[Math.min(profile.length-1,i+1)];
      const dr=b[0]-a[0],dy=b[1]-a[1],dtheta=ribs&&r>.1?-.012*56*Math.sin(t*56):0;
      const normal=normalize([dy*(radius*Math.cos(t)+dtheta*Math.sin(t)),-dr*radius,dy*(radius*Math.sin(t)-dtheta*Math.cos(t))]);
      return [radius*Math.cos(t),y,radius*Math.sin(t),...normal,j/segments,(y+.85)/1.7];
    }
    for(let i=0;i<profile.length-1;i++)for(let j=0;j<segments;j++){
      const a=point(i,j),b=point(i,j+1),c=point(i+1,j),d=point(i+1,j+1);
      data.push(...a,...b,...c,...b,...d,...c);
    }
    const vertices=new Float32Array(data);
    if(softwareContext)return {vertices,count:data.length/8};
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    return {buffer,count:data.length/8};
  }
  function createCap(shape) {
    if(shape==='sphere'){
      const profile=[[.001,-.72],[.51,-.72]];
      for(let i=0;i<=50;i++){const a=-1.03+(Math.PI/2+1.03)*i/50;profile.push([Math.max(.001,.88*Math.cos(a)),.88*Math.sin(a)+.04]);}
      return lathe(profile);
    }
    const profile=[[.001,-.71],[.58,-.71],[.637,-.685],[.66,-.635],[.66,-.59]];
    if(shape==='ribbed')for(const y of [-.35,-.10,.15,.40])profile.push([.66,y-.035],[.639,y],[.66,y+.035]);
    profile.push([.66,.58],[.657,.64],[.633,.69],[.59,.714],[.001,.714]);
    return lathe(profile,0,192);
  }
  function destroyMesh(mesh){if(mesh && gl)gl.deleteBuffer(mesh.buffer);}
  function initialize() {
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});
    if(!gl){
      softwareContext=canvas.getContext('2d',{alpha:true});
      if(!softwareContext)throw new Error('3D canvas unavailable');
      capMesh=createCap(state.shape);
      collarMesh=lathe([[.001,-.16],[.46,-.16],[.53,-.12],[.53,.10],[.48,.145],[.38,.145],[.38,.26],[.001,.26]]);
      pumpMesh=lathe([[.001,-.22],[.18,-.22],[.18,.23],[.14,.27],[.14,.35],[.001,.35]]);
      showRenderer();return;
    }
    const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Studio renderer could not start');
    locations={};
    for(const name of ['aPosition','aNormal','aUV'])locations[name]=gl.getAttribLocation(program,name);
    for(const name of ['uModel','uProjection','uOffset','uColor','uRoughness','uBrand','uLabel'])locations[name]=gl.getUniformLocation(program,name);
    capMesh=createCap(state.shape);
    collarMesh=lathe([[.001,-.16],[.46,-.16],[.53,-.12],[.53,.10],[.48,.145],[.38,.145],[.38,.26],[.001,.26]],0,128);
    pumpMesh=lathe([[.001,-.22],[.18,-.22],[.18,.23],[.14,.27],[.14,.35],[.001,.35]],0,96);
    const label=document.createElement('canvas');label.width=512;label.height=256;
    const ctx=label.getContext('2d');ctx.fillStyle='white';ctx.textAlign='center';ctx.font='34px Georgia';ctx.fillText('J I A L A N',256,130);ctx.font='11px Arial';ctx.fillText('C A P S   &   C L O S U R E S',256,159);
    labelTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,labelTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,label);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    showRenderer();
  }
  function showRenderer(){
    canvas.hidden=false;$('studio-fallback').hidden=true;
    $('studio-toolbar').hidden=false;$('studio-angle-control').hidden=false;
    view.classList.remove('is-unavailable','is-restoring');state.lost=false;
    updateSelection();requestRender();
  }
  function fallback() {
    gl=null;softwareContext=null;canvas.hidden=true;view.classList.add('is-unavailable');
    $('studio-toolbar').hidden=true;$('studio-angle-control').hidden=true;
    $('studio-hint').textContent='Catalogue photograph · choose a shape and finish';
    updateSelection();
  }
  function draw(mesh,offset,color,brand,roughness,model,projection) {
    if(softwareContext){softwareDraw(mesh,offset,color,brand,roughness,model);return;}
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    for(const [key,size,offsetBytes] of [['aPosition',3,0],['aNormal',3,12],['aUV',2,24]]){
      const loc=locations[key];gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offsetBytes);
    }
    gl.uniformMatrix4fv(locations.uModel,false,model);gl.uniformMatrix4fv(locations.uProjection,false,projection);
    gl.uniform1f(locations.uOffset,offset);gl.uniform3fv(locations.uColor,color);gl.uniform1f(locations.uRoughness,roughness);gl.uniform1f(locations.uBrand,brand);
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  function requestRender(){const bounds=view.getBoundingClientRect();state.visible=bounds.bottom>-100&&bounds.top<innerHeight+100;view.dataset.renderer=gl?'webgl':softwareContext?'software':'unavailable';if((gl||softwareContext)&&!state.lost&&state.visible&&!document.hidden&&!frame)frame=requestAnimationFrame(render);}
  function render(time) {
    frame=0;
    if((!gl&&!softwareContext)||state.lost||!state.visible||document.hidden)return;
    const dt=Math.min((time-(lastTime||time))/1000,.04);lastTime=time;
    const auto=state.auto&&!motionPaused&&!state.dragging;
    if(auto)targetYaw+=dt*.22;
    const targetLift=state.exploded?1:0;
    const smoothing=reduced.matches||motionPaused?1:Math.min(1,dt*9+.02);
    state.lift+=(targetLift-state.lift)*smoothing;state.yaw+=(targetYaw-state.yaw)*smoothing;state.pitch+=(targetPitch-state.pitch)*smoothing;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.75);
    const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    if(gl){
      gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,labelTexture);gl.uniform1i(locations.uLabel,0);
    }else{softwareContext.clearRect(0,0,width,height);softwareFaces=[];softwareLabels=[];}
    const model=rotation(state.yaw,state.pitch),projection=perspective(width/height);
    const metal=metals[state.metal];
    draw(collarMesh,-.94-state.lift*.2,metal.color,0,metal.roughness,model,projection);
    if(state.lift>.02)draw(pumpMesh,-.65,[.56,.61,.57],0,.25,model,projection);
    draw(capMesh,.04+state.lift*.64,metal.color,1,metal.roughness,model,projection);
    if(softwareContext)paintSoftware();
    syncAngle();
    const moving=Math.abs(targetLift-state.lift)>.001||Math.abs(targetYaw-state.yaw)>.001||Math.abs(targetPitch-state.pitch)>.001;
    if(auto||moving)frame=requestAnimationFrame(render);
  }
  canvas.addEventListener('webglcontextlost',e => {e.preventDefault();state.lost=true;if(frame)cancelAnimationFrame(frame);frame=0;view.classList.add('is-restoring');$('studio-hint').textContent='Restoring the 3D view…';});
  canvas.addEventListener('webglcontextrestored',() => {try{initialize();$('studio-hint').textContent='Drag to explore · Scroll the page as usual';}catch{fallback();}});
  document.addEventListener('visibilitychange',() => {lastTime=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else requestRender();});
  if('ResizeObserver' in window)new ResizeObserver(requestRender).observe(view);else addEventListener('resize',requestRender,{passive:true});
  addEventListener('scroll',requestRender,{passive:true});
  try{initialize();}catch(error){console.warn('Jialan 3D studio:',error.message);fallback();}
})();
