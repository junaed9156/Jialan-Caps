'use strict';
(() => {
  const {products, categories} = window.JIALAN;
  const byId = new Map(products.map(p => [p.id, p]));
  const $ = id => document.getElementById(id);
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
  $('year').textContent = new Date().getFullYear();

  // HD photographs: catalogue photos are 400/800 px WebP; store photos come from Alibaba's image CDN.
  const isStore = p => p.source === 'store';
  function photoSources(p, variant) {
    const img = p.images[variant] ?? p.images[0];
    if (isStore(p)) {
      const base = `https://sc04.alicdn.com/kf/${img}`;
      if (/\.png$/i.test(img)) return {src: base, srcset: ''};
      return {src: `${base}_480x480.jpg_.webp`, srcset: `${base}_480x480.jpg_.webp 480w, ${base}_960x960.jpg_.webp 960w`, original: base};
    }
    return {src: `${img}-400.webp`, srcset: `${img}-400.webp 400w, ${img}-800.webp 800w`};
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
    if (isStore(p)) {
      const s = photoSources(p, i);
      return `<button class="swatch thumb" type="button" data-${detail?'detail-variant':'variant'}="${i}" ${detail?'':`data-id="${p.id}"`} aria-label="${escape(p.model+' · '+p.finishes[i])}" title="${escape(p.finishes[i])}" aria-pressed="${active}"><img src="${s.src}" alt="" loading="lazy" decoding="async"></button>`;
    }
    return `<button class="swatch" type="button" data-${detail?'detail-variant':'variant'}="${i}" ${detail?'':`data-id="${p.id}"`} style="--swatch:${swatchColour(p.finishes[i])}" aria-label="${escape(p.model+' · '+p.finishes[i])}" title="${escape(p.finishes[i])}" aria-pressed="${active}"></button>`;
  }
  function card(p) {
    const v=variantOf(p),selected=isSelected(p.id,v);
    return `<article class="product-card" data-product="${p.id}"><button class="product-image-button" data-open="${p.id}" aria-label="Explore ${escape(p.model)} — ${escape(p.name)}">${p.badge?`<span class="card-badge">${p.badge}</span>`:''}<span class="product-photo${isStore(p)?' is-store':''}" role="img" aria-label="${escape(p.model+', '+p.finishes[v])}">${photoHTML(p,v)}</span><span class="card-expand" aria-hidden="true">↗</span></button><div class="card-info"><div class="card-topline"><button class="card-name" data-open="${p.id}"><strong>${escape(p.model)}</strong><span>${escape(p.name)}</span></button><button class="add-piece${selected?' added':''}" data-add="${p.id}" aria-label="${selected?'Remove':'Add'} ${escape(p.model+' · '+p.finishes[v])} ${selected?'from':'to'} enquiry" aria-pressed="${selected}">${selected?'✓':'+'}</button></div><div class="card-bottom">${isStore(p)?`${window.JIALAN.showPrices!==false?`<span class="card-price"><strong>${escape(p.price)}</strong> / piece</span>`:'<span class="card-price">On our Alibaba store</span>'}<span class="card-neck">${moqText(p)}</span>`:`<div class="swatches">${p.finishes.slice(0,5).map((_,i)=>swatch(p,i,i===v)).join('')}${p.finishes.length>5?`<span class="more-finishes">+${p.finishes.length-5}</span>`:''}</div><span class="card-neck">${escape(p.neck)}</span>`}</div></div></article>`;
  }
  function filteredProducts() {
    const q=state.query.trim().toLowerCase();
    return products.filter(p=>(state.category==='all'||p.category===state.category)&&(state.neck==='all'||p.neck.includes(state.neck))&&(!q||[p.model,p.name,p.material,p.neck,p.description,p.listing||'',...p.finishes].join(' ').toLowerCase().includes(q)));
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
      const p=byId.get(item.id);return `<li><div class="mini-photo"><div class="product-photo${isStore(p)?' is-store':''}" role="img" aria-label="${escape(p.model)}">${photoHTML(p,item.variant,'70px')}</div></div><div class="mini-info"><strong>${escape(p.model)}</strong><span>${escape(p.finishes[item.variant])} · ${escape(p.neck)}</span></div><button type="button" data-remove="${keyOf(item.id,item.variant)}" aria-label="Remove ${escape(p.model+' · '+p.finishes[item.variant])}">×</button></li>`;
    }).join('');
    $('enquiry-fallback').hidden=true;
  }
  function updateDetailButton() {
    if(!state.detail)return;
    const p=byId.get(state.detail), selected=isSelected(p.id,variantOf(p));
    $('detail-add').innerHTML=selected?'Remove from enquiry <span aria-hidden="true">−</span>':'Add to enquiry <span aria-hidden="true">+</span>';
    $('detail-add').setAttribute('aria-pressed',selected);
  }
  function showDialog(dialog) {dialog.showModal();document.body.classList.add('modal-open');}
  function closeDialog(dialog) {dialog.close();if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');}
  function openProduct(id) {
    const p=byId.get(id);if(!p)return;state.detail=id;
    $('detail-category').textContent=categories[p.category];$('detail-model').textContent=p.model;
    $('detail-title').textContent=p.name;$('detail-description').textContent=p.description;
    const rows=isStore(p)
      ?[...(window.JIALAN.showPrices!==false?[['Listing price',`${p.price} per piece`]]:[]),['Minimum order',`${Number(p.moq).toLocaleString('en')} pieces`],['Neck fitting',p.neck],['Category',categories[p.category]],['Source',`Alibaba store, checked ${window.JIALAN.storeChecked||''}`]]
      :[['Model',p.model],['Material',p.material],['Dimensions',p.size+(p.size.match(/^\d/)?' mm':'')],['Neck fitting',p.neck],['Catalogue weight',p.weight]];
    $('detail-specs').innerHTML=rows.map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('');
    $('detail-note').textContent=p.note||(isStore(p)?'Prices and minimum orders are from the Alibaba listing and can change. Ask us for a quotation for your quantity and customisation.':'Confirm bottle-neck compatibility and your preferred collar combination when enquiring.');
    $('detail-sheet').href=isStore(p)?p.url:`${catalogue}#page=${p.page}`;
    $('detail-sheet').innerHTML=isStore(p)?'View on Alibaba ↗':'Specification sheet ↗';
    document.querySelector('.detail-finishes>span').textContent=isStore(p)?'PRODUCT PHOTOS':'EXPLORE FINISHES';
    renderDetailVariant();updateDetailButton();showDialog($('product-dialog'));
  }
  function renderDetailVariant() {
    const p=byId.get(state.detail),v=variantOf(p);
    paintPhoto($('detail-photo'),p,v,'(max-width: 760px) 90vw, 400px');$('detail-finish-name').textContent=isStore(p)?p.listing:p.finishes[v];
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
    dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');});
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
  $('enquiry-form').addEventListener('submit',event=>{
    event.preventDefault();const data=new FormData(event.currentTarget);
    const name=String(data.get('name')||'').trim(), email=String(data.get('email')||'').trim(),message=String(data.get('message')||'').trim();
    if(!name||!email||!message){notify('Please add your name, email and project details.');return;}
    const lines=['Hello Jialan, I would like to discuss a packaging enquiry.','',`Name: ${name}`,`Email: ${email}`];
    if(String(data.get('company')||'').trim())lines.push(`Company: ${String(data.get('company')).trim()}`);
    if(data.get('quantity'))lines.push(`Quantity: ${data.get('quantity')} pieces`);
    if(shortlist.length){lines.push('','Selected pieces:');shortlist.forEach(item=>{const p=byId.get(item.id);lines.push(isStore(p)?`• ${p.model} — ${p.name} (${p.url})`:`• ${p.model} — ${p.finishes[item.variant]} (${p.neck})`);});}
    lines.push('','Project:',message);state.draft=lines.join('\n');
    const url=`https://wa.me/8613812950775?text=${encodeURIComponent(state.draft)}`;
    $('whatsapp-link').href=url;$('enquiry-fallback').hidden=false;
    window.open(url,'_blank','noopener,noreferrer');
  });
  const finishStudies=[{id:'wl100',finish:'Glossy gold',material:'ANODIZED ALUMINIUM'},{id:'wl100',finish:'Glossy black',material:'ANODIZED ALUMINIUM'},{id:'wl100',finish:'Matte silver',material:'ANODIZED ALUMINIUM'},{id:'jlm31',finish:'Coffee wood',material:'HARDWOOD'}];
  function chooseFinish(index){const study=finishStudies[index],p=byId.get(study.id);if(!p)return;paintPhoto($('finish-photo'),p,Math.max(0,p.finishes.indexOf(study.finish)),'(max-width: 760px) 80vw, 40vw');$('finish-code').textContent=p.model;$('finish-material').textContent=study.material;document.querySelectorAll('[data-finish]').forEach(b=>{const active=Number(b.dataset.finish)===index;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});}
  document.querySelectorAll('[data-finish]').forEach(b=>b.addEventListener('click',()=>chooseFinish(Number(b.dataset.finish))));
  if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('animations-ready');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));}
  // Motion: one control pauses every animation, CSS and 3D alike.
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton=$('motion-toggle');
  function setMotion(paused){
    document.body.classList.toggle('motion-paused',paused);
    if(motionButton){motionButton.setAttribute('aria-pressed',String(paused));motionButton.innerHTML=`${paused?'Play':'Pause'} motion <span aria-hidden="true">${paused?'▷':'Ⅱ'}</span>`;}
    document.dispatchEvent(new CustomEvent('jialan:motion',{detail:{paused}}));
  }
  motionButton?.addEventListener('click',()=>setMotion(!document.body.classList.contains('motion-paused')));
  reducedMotion.addEventListener('change',()=>setMotion(reducedMotion.matches));
  setMotion(reducedMotion.matches);
  renderProducts();renderShortlist();chooseFinish(0);
})();
