'use strict';
(() => {
  // Products added on the admin page come first, in the visitor's language. Fields are checked before use.
  (() => {
    const J = window.JIALAN, I = window.I18N, zh = !!(I && I.lang === 'zh'), t = s => (I ? I.t(s) : s);
    const list = window.MAOHAN_ADMIN && Array.isArray(window.MAOHAN_ADMIN.products) ? window.MAOHAN_ADMIN.products : [];
    const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
    const seen = new Set(J.products.map(p => p.id)), added = [];
    for (const a of list) {
      if (!a || typeof a.id !== 'string' || !Array.isArray(a.images) || !Object.prototype.hasOwnProperty.call(J.categories, a.category)) continue;
      const images = a.images.filter(x => typeof x === 'string' && /^assets\/admin\/[A-Za-z0-9-]+$/.test(x)).slice(0, 8);
      const id = 'admin-' + a.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
      if (!images.length || !str(a.model, 40) || !str(a.name, 80) || seen.has(id)) continue;
      seen.add(id);
      const en = images.map((_, i) => str(Array.isArray(a.finishes) && a.finishes[i], 50) || (images.length > 1 ? `Photo ${i + 1}` : 'Standard'));
      const zhF = images.map((_, i) => str(Array.isArray(a.finishes_zh) && a.finishes_zh[i], 50));
      const pick = (enV, zhV) => (zh ? (zhV || t(enV)) : enV);
      added.push({
        id, source: 'admin', category: a.category, images, imageExt: a.imageExt === 'jpg' ? 'jpg' : 'webp',
        model: str(a.model, 40), name: pick(str(a.name, 80), str(a.name_zh, 80)),
        description: pick(str(a.description, 600), str(a.description_zh, 600)),
        material: pick(str(a.material, 80) || 'On request', str(a.material_zh, 80)),
        size: pick(str(a.size, 60) || 'On request'), neck: str(a.neck, 40) || '—', weight: pick(str(a.weight, 40) || 'On request'),
        badge: pick(str(a.badge, 24) || 'NEW'),
        finishes: zh ? en.map((f, i) => zhF[i] || t(f)) : en,
        _en: zh ? { model: str(a.model, 40), name: str(a.name, 80), description: str(a.description, 600), material: str(a.material, 80), finishes: en } : undefined,
      });
    }
    J.products.unshift(...added);
  })();
  const {products, categories} = window.JIALAN;
  const byId = new Map(products.map(p => [p.id, p]));
  const $ = id => document.getElementById(id);
  const T = s => (window.I18N ? window.I18N.t(s) : s);
  const enFinishes = p => (p._en && p._en.finishes) || p.finishes;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const catalogue = window.JIALAN.pdf || 'assets/jialan-catalogue-2026.pdf';
  const state = {category:'all',query:'',neck:'all',expanded:false,variants:new Map(),detail:null,draft:''};
  let toastTimer;
  let shortlist = [];
  try {
    const saved = JSON.parse(localStorage.getItem('jialan-enquiry-v1') || '[]');
    if (Array.isArray(saved)) shortlist = saved.filter(item => item && byId.has(item.id) && Number.isInteger(item.variant) && item.variant >= 0 && item.variant < byId.get(item.id).finishes.length).slice(0,80);
  } catch { /* Browsing and enquiries continue when browser storage is unavailable. */ }

  $('total-products').textContent = products.length;
  // Hide shape filters that have no products in the current range.
  $('category-filters').querySelectorAll('[data-category]').forEach(b => { if (b.dataset.category !== 'all' && !products.some(p => p.category === b.dataset.category)) b.hidden = true; });
  $('year').textContent = new Date().getFullYear();

  // HD photographs: catalogue photos are 400/800 px WebP; extra range photos come from an image CDN.
  const isStore = p => p.source === 'store';
  // Supplied photographs are shown whole, uncropped, at their own proportions.
  const isPhoto = p => p.source === 'photo';
  const photoClass = p => isStore(p) ? ' is-store' : isPhoto(p) ? ' is-photo' : '';
  function photoSources(p, variant) {
    const img = p.images[variant] ?? p.images[0];
    if (isStore(p)) {
      const base = `https://sc04.alicdn.com/kf/${img}`;
      if (/\.png$/i.test(img)) return {src: base, srcset: ''};
      return {src: `${base}_480x480.jpg_.webp`, srcset: `${base}_480x480.jpg_.webp 480w, ${base}_960x960.jpg_.webp 960w`, original: base};
    }
    const ext = p.imageExt || 'webp';
    return {src: `${img}-400.${ext}`, srcset: `${img}-400.${ext} 400w, ${img}-800.${ext} 800w`};
  }
  function photoHTML(p, variant, sizes = '(max-width: 760px) 46vw, 23vw', eager = false) {
    const s = photoSources(p, variant);
    return `<img src="${s.src}"${s.srcset ? ` srcset="${s.srcset}" sizes="${sizes}"` : ''}${s.original ? ` data-original="${s.original}"` : ''} alt="${escape(p.model + ', ' + p.finishes[variant])}" ${eager ? '' : 'loading="lazy" '}decoding="async">`;
  }
  // If a resized store image is unavailable, fall back to the original upload.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.dataset.original && img.src !== img.dataset.original) { img.removeAttribute('srcset'); img.src = img.dataset.original; }
  }, true);
  function paintPhoto(element, p, variant = 0, sizes) {
    element.classList.toggle('is-store', isStore(p));
    element.classList.toggle('is-photo', isPhoto(p));
    element.innerHTML = photoHTML(p, variant, sizes, true);
    element.setAttribute('aria-label', `${p.model}, ${p.finishes[variant]}`);
  }
  const moqText = p => `MOQ ${Number(p.moq).toLocaleString('en')}`;
  function variantOf(p) { return state.variants.get(p.id) ?? p.defaultVariant ?? 0; }
  function keyOf(id,variant) { return `${id}:${variant}`; }
  function isSelected(id,variant) { return shortlist.some(x=>x.id===id && x.variant===variant); }
  function swatchColour(finish) {
    const f=finish.toLowerCase();
    if (f.includes('wood') || f.includes('hydrographic')) {
      if (f.includes('white')) return '#ddd9ca';
      if (f.includes('black')) return '#2e2c25';
      return 'linear-gradient(90deg,#35271e,#73523c,#3b291e)';
    }
    if (f.includes('black')) return f.includes('matte') ? '#303735' : 'linear-gradient(120deg,#111a1a,#5b6661,#172321)';
    if (f.includes('silver')) return 'linear-gradient(115deg,#8a9e9c,#e1eeea,#a7b6b1)';
    if (f.includes('gold')) return 'linear-gradient(115deg,#a0792c,#edce83,#ae8534)';
    if (f.includes('purple')) return '#766790';
    if (f.includes('blue')) return '#5b9aad';
    if (f.includes('red')) return '#8b333b';
    if (f.includes('grey')) return '#667b79';
    if (f.includes('coffee')) return '#655043';
    if (f.includes('white')) return '#e8e5d9';
    return 'linear-gradient(115deg,#b6a467,#e1cf9b,#92b1ad)';
  }
  function swatch(p,i,active=false,detail=false) {
    if (isStore(p) || isPhoto(p)) {
      const s = photoSources(p, i);
      return `<button class="swatch thumb" type="button" data-${detail?'detail-variant':'variant'}="${i}" ${detail?'':`data-id="${p.id}"`} aria-label="${escape(p.model+' · '+p.finishes[i])}" title="${escape(p.finishes[i])}" aria-pressed="${active}"><img src="${s.src}" alt="" loading="lazy" decoding="async"></button>`;
    }
    return `<button class="swatch" type="button" data-${detail?'detail-variant':'variant'}="${i}" ${detail?'':`data-id="${p.id}"`} style="--swatch:${swatchColour(enFinishes(p)[i])}" aria-label="${escape(p.model+' · '+p.finishes[i])}" title="${escape(p.finishes[i])}" aria-pressed="${active}"></button>`;
  }
  function card(p) {
    const v=variantOf(p),selected=isSelected(p.id,v);
    return `<article class="product-card" data-product="${p.id}"><button class="product-image-button" data-open="${p.id}" tabindex="-1" aria-hidden="true">${p.badge?`<span class="card-badge">${escape(p.badge)}</span>`:''}<span class="product-photo${photoClass(p)}" role="img" aria-label="${escape(p.model+', '+p.finishes[v])}">${photoHTML(p,v)}</span><span class="card-expand" aria-hidden="true">↗</span></button><div class="card-info"><div class="card-topline"><button class="card-name" data-open="${p.id}"><strong>${escape(p.model)}</strong><span>${escape(p.name)}</span></button><button class="add-piece${selected?' added':''}" data-add="${p.id}" aria-label="${selected?'Remove':'Add'} ${escape(p.model+' · '+p.finishes[v])} ${selected?'from':'to'} enquiry" aria-pressed="${selected}">${selected?'✓':'+'}</button></div><div class="card-bottom">${isStore(p)?`${window.JIALAN.showPrices!==false?`<span class="card-price"><strong>${escape(p.price)}</strong> / piece</span>`:'<span class="card-price">Price on request</span>'}<span class="card-neck">${moqText(p)}</span>`:`<div class="swatches">${p.finishes.slice(0,5).map((_,i)=>swatch(p,i,i===v)).join('')}${p.finishes.length>5?`<span class="more-finishes">+${p.finishes.length-5}</span>`:''}</div><span class="card-neck">${escape(p.neck)}</span>`}</div></div></article>`;
  }
  function filteredProducts() {
    const q=state.query.trim().toLowerCase();
    return products.filter(p=>(state.category==='all'||p.category===state.category)&&(state.neck==='all'||p.neck.includes(state.neck))&&(!q||[p.model,p.name,p.material,p.neck,p.description,...p.finishes,...(p._en?[p._en.model,p._en.name,p._en.material,p._en.description,...p._en.finishes]:[])].join(' ').toLowerCase().includes(q)));
  }
  function renderProducts() {
    const all=filteredProducts();
    const limited=!state.expanded && state.category==='all' && !state.query && state.neck==='all';
    const shown=limited?all.slice(0,8):all;
    $('product-grid').innerHTML=shown.map(card).join('');
    $('result-count').textContent=`${all.length} ${all.length===1?'piece':'pieces'}`;
    $('shown-count').textContent=`Showing ${shown.length} of ${all.length} pieces`;
    $('show-all').hidden=!limited || all.length<=8;
    $('no-results').hidden=all.length!==0;
    $('category-filters').querySelectorAll('[data-category]').forEach(button=>{
      const active=button.dataset.category===state.category;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);
    });
  }
  function notify(message) {
    clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');
    toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2700);
  }
  function persist() {
    try {localStorage.setItem('jialan-enquiry-v1',JSON.stringify(shortlist));} catch { /* Optional persistence. */ }
    renderShortlist();renderProducts();
  }
  function togglePiece(id,variant=variantOf(byId.get(id))) {
    const p=byId.get(id);if(!p)return;
    const selected=isSelected(id,variant);
    if(selected)shortlist=shortlist.filter(item=>!(item.id===id&&item.variant===variant));
    else shortlist.push({id,variant});
    persist();updateDetailButton();notify(selected?'Piece removed from your enquiry.':`${p.model} added to your enquiry.`);
  }
  function removePiece(key) {
    shortlist=shortlist.filter(item=>keyOf(item.id,item.variant)!==key);persist();updateDetailButton();
  }
  function renderShortlist() {
    $('shortlist-count').textContent=shortlist.length;
    $('open-shortlist').setAttribute('aria-label',`View enquiry shortlist, ${shortlist.length} ${shortlist.length===1?'piece':'pieces'}`);
    $('shortlist-bar').hidden=!shortlist.length;
    $('bar-count').textContent=`${shortlist.length} ${shortlist.length===1?'piece':'pieces'} selected`;
    $('enquiry-selection').hidden=!shortlist.length;
    $('shortlist-empty').hidden=!!shortlist.length;
    $('shortlist-enquire').hidden=!shortlist.length;
    $('enquiry-items').innerHTML=shortlist.map(item=>{
      const p=byId.get(item.id);return `<li><span>${escape(p.model)} · ${escape(p.finishes[item.variant])}</span><button type="button" data-remove="${keyOf(item.id,item.variant)}" aria-label="Remove ${escape(p.model+' · '+p.finishes[item.variant])}">×</button></li>`;
    }).join('');
    $('shortlist-items').innerHTML=shortlist.map(item=>{
      const p=byId.get(item.id);return `<li><div class="mini-photo"><div class="product-photo${photoClass(p)}" role="img" aria-label="${escape(p.model)}">${photoHTML(p,item.variant,'70px')}</div></div><div class="mini-info"><strong>${escape(p.model)}</strong><span>${escape(p.finishes[item.variant])} · ${escape(p.neck)}</span></div><button type="button" data-remove="${keyOf(item.id,item.variant)}" aria-label="Remove ${escape(p.model+' · '+p.finishes[item.variant])}">×</button></li>`;
    }).join('');
    $('enquiry-fallback').hidden=true;
  }
  function updateDetailButton() {
    if(!state.detail)return;
    const p=byId.get(state.detail), selected=isSelected(p.id,variantOf(p));
    $('detail-add').innerHTML=selected?'Remove from enquiry <span aria-hidden="true">−</span>':'Add to enquiry <span aria-hidden="true">+</span>';
    $('detail-add').setAttribute('aria-pressed',selected);
  }
  function showDialog(dialog) {dialog.showModal();document.body.classList.add('modal-open');document.dispatchEvent(new Event('jialan:overlay'));}
  function closeDialog(dialog) {dialog.close();if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');document.dispatchEvent(new Event('jialan:overlay'));}
  function openProduct(id) {
    const p=byId.get(id);if(!p)return;state.detail=id;
    $('detail-category').textContent=categories[p.category];$('detail-model').textContent=p.model;
    $('detail-title').textContent=p.name;$('detail-description').textContent=p.description;
    const rows=isStore(p)
      ?[...(window.JIALAN.showPrices!==false?[['Listing price',`${p.price} per piece`]]:[]),['Minimum order',`${Number(p.moq).toLocaleString('en')} pieces`],['Neck fitting',p.neck],['Category',categories[p.category]]]
      :[['Model',p.model],['Material',p.material],['Dimensions',p.size+(/^\d/.test(p.size)&&!/mm/i.test(p.size)?' mm':'')],['Neck fitting',p.neck],['Catalogue weight',p.weight]];
    $('detail-specs').innerHTML=rows.map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('');
    $('detail-note').textContent=p.note||(isStore(p)?'Ask us for a quotation for your quantity, colours and logo.':'Confirm bottle-neck compatibility and your preferred collar combination when enquiring.');
    $('detail-sheet').hidden=isStore(p)||!p.page;
    if(!isStore(p)&&p.page){$('detail-sheet').href=`${catalogue}#page=${p.page}`;$('detail-sheet').innerHTML='Specification sheet ↗';}
    document.querySelector('.detail-finishes>span').textContent=isStore(p)?'PRODUCT PHOTOS':'EXPLORE FINISHES';
    renderDetailVariant();updateDetailButton();showDialog($('product-dialog'));
  }
  function renderDetailVariant() {
    const p=byId.get(state.detail),v=variantOf(p);
    paintPhoto($('detail-photo'),p,v,'(max-width: 760px) 90vw, 400px');$('detail-finish-name').textContent=isStore(p)?'':p.finishes[v];
    $('detail-picture-label').textContent=`${p.model} / ${p.finishes[v]}`;
    $('detail-swatches').innerHTML=p.finishes.map((_,i)=>swatch(p,i,i===v,true)).join('');
    updateDetailButton();
  }
  $('product-grid').addEventListener('click',event=>{
    const open=event.target.closest('[data-open]');if(open){openProduct(open.dataset.open);return;}
    const add=event.target.closest('[data-add]');if(add){togglePiece(add.dataset.add);return;}
    const finish=event.target.closest('[data-variant]');if(finish){state.variants.set(finish.dataset.id,Number(finish.dataset.variant));renderProducts();}
  });
  $('category-filters').addEventListener('click',event=>{const b=event.target.closest('[data-category]');if(!b)return;state.category=b.dataset.category;state.expanded=true;renderProducts();});
  $('product-search').addEventListener('input',event=>{state.query=event.target.value;renderProducts();});
  $('neck-filter').addEventListener('change',event=>{state.neck=event.target.value;renderProducts();});
  $('show-all').addEventListener('click',()=>{state.expanded=true;renderProducts();});
  $('reset-filters').addEventListener('click',()=>{state.category='all';state.query='';state.neck='all';state.expanded=false;$('product-search').value='';$('neck-filter').value='all';renderProducts();});
  $('detail-swatches').addEventListener('click',event=>{const b=event.target.closest('[data-detail-variant]');if(!b)return;state.variants.set(state.detail,Number(b.dataset.detailVariant));renderDetailVariant();renderProducts();});
  $('detail-add').addEventListener('click',()=>togglePiece(state.detail));
  $('close-product').addEventListener('click',()=>closeDialog($('product-dialog')));
  $('open-shortlist').addEventListener('click',()=>showDialog($('shortlist-dialog')));
  $('close-shortlist').addEventListener('click',()=>closeDialog($('shortlist-dialog')));
  $('shortlist-enquire').addEventListener('click',()=>closeDialog($('shortlist-dialog')));
  $('browse-from-shortlist').addEventListener('click',()=>{closeDialog($('shortlist-dialog'));$('collection').scrollIntoView({behavior:'smooth'});});
  ['enquiry-items','shortlist-items'].forEach(id=>$(id).addEventListener('click',event=>{const b=event.target.closest('[data-remove]');if(b)removePiece(b.dataset.remove);}));
  $('clear-selection').addEventListener('click',()=>{shortlist=[];persist();notify('Your enquiry shortlist is clear.');});
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');document.dispatchEvent(new Event('jialan:overlay'));});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog(dialog);}});
  });
  $('menu-toggle').addEventListener('click',()=>{
    const open=$('menu-toggle').getAttribute('aria-expanded')!=='true';$('menu-toggle').setAttribute('aria-expanded',open);$('menu-toggle').setAttribute('aria-label',open?'Close navigation':'Open navigation');$('mobile-nav').hidden=!open;
  });
  $('mobile-nav').addEventListener('click',event=>{if(event.target.closest('a')){$('mobile-nav').hidden=true;$('menu-toggle').setAttribute('aria-expanded','false');$('menu-toggle').setAttribute('aria-label','Open navigation');}});
  async function copy(text,success) {
    try {await navigator.clipboard.writeText(text);notify(success);}
    catch {const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0';document.body.append(field);field.select();const done=document.execCommand('copy');field.remove();notify(done?success:'Copy is unavailable. Please copy the displayed details.');}
  }
  $('copy-wechat').addEventListener('click',()=>copy('13812950775','WeChat ID copied: 13812950775'));
  $('copy-enquiry').addEventListener('click',()=>copy(state.draft,'Your enquiry draft has been copied.'));
  // Enquiries go by email to the sales team (FormSubmit relays the form; no server of our own).
  const SALES_EMAIL='helens@vip.163.com';
  // Country list with calling codes; choosing a country fills in its code. Names follow the page language.
  const countryField=$('enquiry-country'),dialCode=$('dial-code'),phoneField=$('enquiry-phone');
  const codes=new Map((window.MAOHAN_COUNTRIES||[]).map(([iso,code])=>[iso,code]));
  (()=>{
    if(!countryField)return;
    const lang=(window.I18N&&window.I18N.lang==='zh')?'zh-CN':'en';
    let names=null;try{names=new Intl.DisplayNames([lang],{type:'region'});}catch{/* older browsers show the code */}
    const rows=[...codes].map(([iso,code])=>{let n=iso;try{n=(names&&names.of(iso))||iso;}catch{/* unknown region */}return {iso,code,n};});
    rows.sort((a,b)=>a.n.localeCompare(b.n,lang));
    countryField.insertAdjacentHTML('beforeend',rows.map(r=>`<option value="${r.iso}">${escape(r.n)} (+${r.code})</option>`).join(''));
    // Pre-select the visitor's country when the browser language names one (e.g. en-GB, zh-CN).
    const guess=(navigator.languages||[navigator.language||'']).map(l=>(String(l).split('-')[1]||'').toUpperCase()).find(r=>codes.has(r));
    if(guess)countryField.value=guess;
    const show=()=>{const c=codes.get(countryField.value);dialCode.textContent=c?`+${c}`:'+';};
    countryField.addEventListener('change',()=>{show();phoneField.focus();});show();
  })();
  function phoneFrom(data){
    const raw=String(data.get('phone')||'').replace(/[^\d+ ()-]/g,'').trim();if(!raw)return '';
    if(raw.startsWith('+'))return raw;
    const c=codes.get(String(data.get('country')||''));return c?`+${c} ${raw.replace(/^0+/,'')}`:raw;
  }
  const countryName=data=>{const iso=String(data.get('country')||'');if(!iso)return '';const o=countryField&&countryField.selectedOptions[0];return o&&o.value===iso?o.textContent.replace(/\s*\(\+\d+\)$/,''):iso;};
  function draftFrom(data){
    const name=String(data.get('name')||'').trim(), email=String(data.get('email')||'').trim(), message=String(data.get('message')||'').trim();
    const lines=[T('Hello Mao Han, I would like to discuss a packaging enquiry.'),'',T(`Name: ${name}`),T(`Email: ${email}`)];
    const phone=phoneFrom(data),country=countryName(data);if(phone)lines.push(T(`Phone: ${phone}`));if(country)lines.push(T(`Country: ${country}`));
    if(String(data.get('company')||'').trim())lines.push(T(`Company: ${String(data.get('company')).trim()}`));
    if(data.get('quantity'))lines.push(T(`Quantity: ${data.get('quantity')} pieces`));
    if(shortlist.length){lines.push('',T('Selected pieces:'));shortlist.forEach(item=>{const p=byId.get(item.id);lines.push(isStore(p)?`• ${p.model} — ${p.name}`:`• ${p.model} — ${p.finishes[item.variant]} (${p.neck})`);});}
    lines.push('',T('Project:'),message);
    return {name,email,message,phone,country,text:lines.join('\n')};
  }
  function refreshLinks(){
    const d=draftFrom(new FormData($('enquiry-form')));state.draft=d.text;
    $('whatsapp-link').href=`https://wa.me/8613812950775?text=${encodeURIComponent(d.text)}`;
    $('mailto-link').href=`mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Packaging enquiry from '+(d.name||'the website'))}&body=${encodeURIComponent(d.text)}`;
  }
  $('enquiry-form').addEventListener('input',refreshLinks);
  $('whatsapp-link').addEventListener('click',refreshLinks);
  $('enquiry-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,data=new FormData(form);
    const d=draftFrom(data);
    if(!d.name||!d.email||!d.message){notify('Please add your name, email and project details.');return;}
    if(String(data.get('_honey')||''))return;
    refreshLinks();
    const button=$('enquiry-submit');button.disabled=true;button.firstChild.textContent='Sending… ';
    let ok=false;
    try{
      const r=await fetch(`https://formsubmit.co/ajax/${SALES_EMAIL}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({_subject:`Packaging enquiry from ${d.name}`,_replyto:d.email,_template:'box',_captcha:'false',
          name:d.name,email:d.email,company:String(data.get('company')||''),quantity:String(data.get('quantity')||''),phone:d.phone,country:d.country,message:d.text})});
      const j=await r.json().catch(()=>({}));
      ok=r.ok&&String(j.success)==='true';
    }catch{ok=false;}
    button.disabled=false;button.firstChild.textContent='Send enquiry ';
    $('enquiry-fallback').hidden=false;
    if(ok){$('enquiry-result').textContent='Thank you. Your enquiry has been sent to our sales team, and we will reply by email.';form.reset();refreshLinks();notify('Enquiry sent.');}
    else $('enquiry-result').textContent='We could not send the form just now. Please email it directly or send it on WhatsApp.';
  });
  const finishStudies=[{id:'wl100',finish:'Glossy gold',material:'ANODIZED ALUMINIUM',cut:'glossy-gold'},{id:'wl100',finish:'Glossy black',material:'ANODIZED ALUMINIUM',cut:'glossy-black'},{id:'wl100',finish:'Matte silver',material:'ANODIZED ALUMINIUM',cut:'matte-silver'},{id:'jlm31',finish:'Coffee wood',material:'HARDWOOD',cut:'coffee-wood'}];
  function chooseFinish(index){const study=finishStudies[index],p=byId.get(study.id);if(!p)return;const finishName=T(study.finish),fp=$('finish-photo');fp.classList.remove('is-store','is-photo');fp.classList.add('is-cutout');fp.innerHTML=`<img src="assets/finish/${study.cut}.webp" loading="lazy" alt="${escape(p.model+', '+finishName)}" decoding="async">`;fp.setAttribute('aria-label',`${p.model}, ${finishName}`);$('finish-code').textContent=p.model;$('finish-material').textContent=study.material;document.querySelectorAll('[data-finish]').forEach(b=>{const active=Number(b.dataset.finish)===index;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});}
  document.querySelectorAll('[data-finish]').forEach(b=>b.addEventListener('click',()=>chooseFinish(Number(b.dataset.finish))));
  if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('animations-ready');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));}
  // Motion: one control pauses every animation, CSS and 3D alike.
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton=$('motion-toggle');
  function setMotion(paused){
    document.body.classList.toggle('motion-paused',paused);
    if(motionButton){const label=T(paused?'Play motion':'Pause motion');motionButton.setAttribute('aria-pressed',String(paused));motionButton.setAttribute('aria-label',label);motionButton.title=label;motionButton.innerHTML=`<span aria-hidden="true">${paused?'▷':'Ⅱ'}</span>`;}
    document.dispatchEvent(new CustomEvent('jialan:motion',{detail:{paused}}));
  }
  motionButton?.addEventListener('click',()=>setMotion(!document.body.classList.contains('motion-paused')));
  reducedMotion.addEventListener('change',()=>setMotion(reducedMotion.matches));
  setMotion(reducedMotion.matches);
  // Hidden admin entrance: three quick clicks on the header logo open the admin login.
  (()=>{const logo=document.querySelector('.header .brand');if(!logo)return;let clicks=[];
    logo.addEventListener('click',event=>{const now=Date.now();clicks=clicks.filter(t=>now-t<1500);clicks.push(now);
      if(clicks.length>=3){event.preventDefault();clicks=[];location.href='admin/';}});})();
  renderProducts();renderShortlist();chooseFinish(0);
})();
