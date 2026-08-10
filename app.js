var ITER = 600000;
var KEY = null, ITEMS = [], STAMP_EPOCH = 0, GU = '', GP = '', CHECKED_EPOCH = 0;
var IMGCACHE = {};
function validAcc(a){return /^FS-2026-\d{3,6}$/.test(a);}
async function deriveKey(user,pass,salt){var base=await crypto.subtle.importKey('raw',new TextEncoder().encode(user+':'+pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);}
async function fetchBin(url){var r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('fetch '+r.status);return new Uint8Array(await r.arrayBuffer());}
async function decryptBin(raw){var nonce=raw.slice(0,12),ct=raw.slice(12);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},KEY,ct));}
async function loadMeta(){var saltbuf=await fetchBin('salt.bin?ts='+Date.now());KEY=await deriveKey(GU,GP,saltbuf.slice(0,16));var raw=await fetchBin('meta.enc?ts='+Date.now());var pt=await decryptBin(raw);var obj=JSON.parse(new TextDecoder().decode(pt));ITEMS=obj.items;STAMP_EPOCH=obj.epoch;CHECKED_EPOCH=Date.now();}
async function loadImg(acc,iv){if(!acc||!iv||!validAcc(acc))return '';var k=acc+'@'+iv;if(IMGCACHE[k])return IMGCACHE[k];var raw=await fetchBin('img/'+encodeURIComponent(acc)+'.enc?v='+encodeURIComponent(iv));var pt=await decryptBin(raw);var s='';for(var i=0;i<pt.length;i++)s+=String.fromCharCode(pt[i]);var url='data:image/jpeg;base64,'+btoa(s);IMGCACHE[k]=url;return url;}
var imgObserver=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var el=e.target;imgObserver.unobserve(el);loadImg(el.getAttribute('data-acc'),el.getAttribute('data-iv')).then(function(url){if(url){var im=document.createElement('img');im.loading='lazy';im.src=url;el.appendChild(im);}}).catch(function(){});}});},{rootMargin:'400px'});
async function tryLogin(){var u=document.getElementById('gu').value.trim().toLowerCase();var p=document.getElementById('gp').value;GU=u;GP=p;var btn=document.querySelector('.gbox button');btn.textContent='Unlocking...';try{await loadMeta();document.getElementById('gate').style.display='none';document.getElementById('app').style.display='block';render();}catch(e){GU='';GP='';KEY=null;document.getElementById('gerr').textContent='Wrong username or password';document.getElementById('gp').value='';}btn.textContent='Enter';}
async function refresh(){try{var raw=await fetchBin('meta.enc?ts='+Date.now());var pt=await decryptBin(raw);var obj=JSON.parse(new TextDecoder().decode(pt));ITEMS=obj.items;STAMP_EPOCH=obj.epoch;CHECKED_EPOCH=Date.now();}catch(e){}render();}


function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
var typeFilter='All', vitrineFilter='All', deckFilter='All', searchQuery='';
var vitrineOpts=['All','In Vitrine','Open','Closed'];
var deckOpts=['All','Deck 3','Deck 4','Deck 5','Deck 6','Deck 9','Deck 10','Deck 11'];
var selMode=false, selected={};

function chipRow(el,label,list,get,set){
  el.innerHTML='';
  if(label){var s=document.createElement('span');s.className='filterlabel';s.textContent=label;el.appendChild(s);}
  list.forEach(function(v){
    var a=document.createElement('a');a.className=get()===v?'on':'';a.textContent=v;
    a.onclick=function(){set(v);render();};el.appendChild(a);
  });
}
function match(i){
  if(typeFilter!=='All' && i.type!==typeFilter) return false;
  if(vitrineFilter==='In Vitrine' && !i.vitrine) return false;
  if(vitrineFilter==='Open' && i.vitrine!=='Open') return false;
  if(vitrineFilter==='Closed' && i.vitrine!=='Closed') return false;
  if(deckFilter!=='All' && String(i.deck)!==deckFilter.slice(5)) return false;
  if(searchQuery){
    var q=searchQuery.toLowerCase();
    var hay=((i.name||'')+' '+(i.full||'')+' '+(i.rest||'')+' '+(i.type||'')+' '+
             (i.dims||'')+' '+(i.deck||'')+' '+(i.vitrine||'')).toLowerCase();
    if(hay.indexOf(q)<0) return false;
  }
  return true;
}
function placeLine(i){
  var p=[];
  if(i.deck) p.push('Deck '+esc(i.deck));
  if(i.vitrine) p.push('Vitrine '+esc(String(i.vitrine).toLowerCase()));
  return p.length?p.join(', '):'Placement TBD';
}
function fmtStamp(ep){
  try{return new Date(ep).toLocaleString([],{dateStyle:'medium',timeStyle:'short'});}
  catch(e){return new Date(ep).toLocaleString();}
}
function checkedText(){
  if(!CHECKED_EPOCH) return '—';
  if(Date.now()-CHECKED_EPOCH < 60000) return 'just now';
  try{return new Date(CHECKED_EPOCH).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
  catch(e){return 'recently';}
}
function renderStamp(shown){
  var el=document.getElementById('stamp');
  el.innerHTML = shown+' of '+ITEMS.length+' items · Last updated '+esc(fmtStamp(CHECKED_EPOCH))+
    ' · <span class="refresh" id="refreshTap">Tap to refresh</span>';
  var r=document.getElementById('refreshTap');
  r.onclick=function(){
    if(typeof refresh==='function'){ r.textContent='Refreshing…'; refresh(); }
    else { render(); }
  };
}

function render(){
  var types=['All'];
  ITEMS.forEach(function(i){if(i.type && types.indexOf(i.type)<0) types.push(i.type);});
  chipRow(document.getElementById('typeBar'),'Type',types,function(){return typeFilter;},function(v){typeFilter=v;});
  chipRow(document.getElementById('vitrineBar'),'Vitrine',vitrineOpts,function(){return vitrineFilter;},function(v){vitrineFilter=v;});
  chipRow(document.getElementById('deckBar'),'Deck',deckOpts,function(){return deckFilter;},function(v){deckFilter=v;});
  var shown=0,g=document.getElementById('grid');g.innerHTML='';
  ITEMS.forEach(function(i){
    if(!match(i)) return;
    shown++;
    var card=document.createElement('div');
    card.className='card'+(selected[i.acc]?' sel':'');
    var meta='<div>'+esc(i.type)+'</div>';
    if(i.dims) meta+='<div>'+esc(i.dims)+'</div>';
    if(i.weight) meta+='<div>'+esc(i.weight)+' kg</div>';
    meta+='<div>'+placeLine(i)+'</div>';
    var ph=i.iv?'<div class="ph" data-acc="'+esc(i.acc)+'" data-iv="'+esc(i.iv)+'"></div>'
               :'<div class="ph"><div class="noph">NO PHOTO</div></div>';
    card.innerHTML=
      '<div class="check">'+(selected[i.acc]?'✓':'')+'</div>'+
      ph+
      '<div class="cnm">'+esc(i.name)+'</div>'+
      '<div class="cmeta">'+meta+'</div>';
    card.onclick=(function(item){return function(){
      if(selMode) toggleSel(item.acc); else openDetail(item);
    };})(i);
    g.appendChild(card);
  });
  g.querySelectorAll('.ph[data-iv]').forEach(function(el){imgObserver.observe(el);});
  if(!shown) g.innerHTML='<div class="empty">Nothing here yet</div>';
  renderStamp(shown);
}

/* selection */
function toggleSelectMode(){
  selMode=!selMode;
  document.body.classList.toggle('selmode',selMode);
  document.getElementById('selectbtn').textContent=selMode?'Done':'Select items';
  document.getElementById('selectbtn').classList.toggle('on',selMode);
  if(!selMode) clearSel();
  render(); updateSelbar();
}
function toggleSel(acc){ if(selected[acc]) delete selected[acc]; else selected[acc]=true; render(); updateSelbar(); }
function clearSel(){ selected={}; render(); updateSelbar(); }
function updateSelbar(){
  var n=Object.keys(selected).length;
  document.getElementById('selcount').textContent=n+(n===1?' selected':' selected');
  document.getElementById('selbar').className=(selMode&&n>0)?'show':'';
}

/* export: selected items -> one PDF -> iPad Share sheet (WhatsApp / Mail live there).
   Text is DRAWN into the PDF by jsPDF, never parsed as HTML, so cell content
   cannot execute. */
function pdfName(){
  var d=new Date();
  var stamp=String(d.getFullYear()).slice(-2)+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2);
  var parts=['FSII', stamp];
  if(typeFilter && typeFilter!=='All') parts.push(typeFilter);
  if(deckFilter && deckFilter!=='All') parts.push(deckFilter);
  if(vitrineFilter && vitrineFilter!=='All') parts.push(vitrineFilter);
  if(searchQuery && searchQuery.trim()) parts.push(searchQuery.trim().slice(0,24));
  var name=parts.join(' ').replace(/[\/\\:*?"<>| -]+/g,' ').replace(/\s+/g,' ').trim();
  return name.slice(0,120)+'.pdf';
}
function buildPdf(items,imgs){
  var jsPDF=window.jspdf.jsPDF;
  var doc=new jsPDF({unit:'pt',format:'a4'});
  var W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=48;
  items.forEach(function(i,idx){
    if(idx>0) doc.addPage();
    var y=M;
    doc.setTextColor(17);
    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('FSII COLLECTION', M, y); y+=8;
    doc.setDrawColor(17); doc.setLineWidth(1); doc.line(M,y,W-M,y); y+=26;
    doc.setFont('times','normal'); doc.setFontSize(20);
    var nm=doc.splitTextToSize(String(i.name||''), W-2*M);
    doc.text(nm, M, y); y+=nm.length*22+10;
    var im=imgs&&imgs[i.acc];
    if(im){
      try{
        var pr=doc.getImageProperties(im);
        var r=Math.min((W-2*M)/pr.width, 300/pr.height);
        var iw=pr.width*r, ih=pr.height*r;
        doc.addImage(im,'JPEG', M, y, iw, ih); y+=ih+20;
      }catch(e){}
    }
    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    function line(l,v){ if(v!==''&&v!=null){ doc.setFont('helvetica','bold');
      doc.text(l+':', M, y); doc.setFont('helvetica','normal');
      doc.text(doc.splitTextToSize(String(v), W-2*M-92), M+92, y); y+=17; } }
    line('Type',i.type); line('Dimensions',i.dims);
    line('Weight', i.weight?i.weight+' kg':'');
    line('Count', i.count&&i.count>1?i.count+' pieces':'');
    line('Deck', i.deck?'Deck '+i.deck:''); line('Vitrine', i.vitrine||'');
    var desc=i.rest||i.full||'';
    if(desc){ y+=10; doc.setFontSize(10.5);
      doc.text(doc.splitTextToSize(String(desc), W-2*M), M, y); }
  });
  var blob=doc.output('blob');
  return new File([blob], pdfName(), {type:'application/pdf'});
}
async function shareSelection(){
  var chosen=ITEMS.filter(function(i){return selected[i.acc];});
  if(!chosen.length) return;
  var btn=document.getElementById('shareBtn'); var old=btn.textContent;
  btn.textContent='Preparing…';
  var imgs={};
  for(var j=0;j<chosen.length;j++){var it=chosen[j];if(it.iv){try{imgs[it.acc]=await loadImg(it.acc,it.iv);}catch(e){}}}
  var file;
  try{ file=buildPdf(chosen, imgs); }
  catch(e){ btn.textContent=old; return; }
  btn.textContent=old;
  if(navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file], title:'FSII selection'}).catch(function(){});
  } else {
    var url=URL.createObjectURL(file), a=document.createElement('a');
    a.href=url; a.download=file.name; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},4000);
  }
}
function cancelSel(){ selected={}; selMode=false;
  document.body.classList.remove('selmode');
  document.getElementById('selectbtn').textContent='Select items';
  document.getElementById('selectbtn').classList.remove('on');
  render(); updateSelbar(); }

/* detail */
function openDetail(i){
  var rows=[];
  function row(l,v){ if(v!==''&&v!=null) rows.push('<tr><td class="l">'+esc(l)+'</td><td class="v">'+esc(v)+'</td></tr>'); }
  row('Type',i.type); row('Dimensions',i.dims);
  row('Weight', i.weight?i.weight+' kg':'');
  row('Count', i.count&&i.count>1?i.count+' pieces':'');
  row('Deck', i.deck?'Deck '+i.deck:'Not decided yet'); row('Vitrine', i.vitrine||'');
  var sims=[];
  ITEMS.forEach(function(o){ if(o.acc!==i.acc && o.type===i.type && sims.length<8 && o.iv) sims.push(o); });
  var simHtml=sims.map(function(o){
    return '<div class="st" data-acc="'+esc(o.acc)+'"><div class="simph" data-acc="'+esc(o.acc)+'" data-iv="'+esc(o.iv)+'"></div>'+
      '<div class="simnm">'+esc(o.name)+'</div></div>';
  }).join('');
  var rest=i.rest||'';
  document.getElementById('dbody').innerHTML=
    '<div class="dcols">'+
    '<div class="dph"'+(i.iv?' data-acc="'+esc(i.acc)+'" data-iv="'+esc(i.iv)+'"':'')+'>'+(i.iv?'':'<div class="noph">NO PHOTO</div>')+'</div>'+
    '<div><div class="dnm">'+esc(i.name)+'</div>'+
    '<table class="spec">'+rows.join('')+'</table>'+
    (rest?'<div class="ddesc">'+esc(rest)+'</div>':'')+'</div>'+
    '</div>'+
    (sims.length?'<div class="dfoot"><div class="lbl">Similar pieces</div><div class="simgrid">'+simHtml+'</div></div>':'');
  document.querySelectorAll('#dbody .dph[data-iv], #dbody .simph[data-iv]').forEach(function(el){
    loadImg(el.getAttribute('data-acc'),el.getAttribute('data-iv')).then(function(url){if(url){var im=document.createElement('img');im.src=url;el.appendChild(im);}}).catch(function(){});
  });
  document.querySelectorAll('.simgrid .st').forEach(function(el){
    el.onclick=function(){var it=ITEMS.filter(function(o){return o.acc===el.getAttribute('data-acc');})[0];
      if(it){openDetail(it);window.scrollTo(0,0);}};
  });
  document.getElementById('overlay').className='open';
  document.body.style.overflow='hidden'; window.scrollTo(0,0);
}
function closeDetail(){ document.getElementById('overlay').className=''; document.body.style.overflow=''; }
document.getElementById('overlay').onclick=function(e){ if(e.target.id==='overlay') closeDetail(); };
document.addEventListener('keydown',function(e){
  if(e.key==='Escape') closeDetail();
  if(e.key==='Enter' && document.getElementById('gate').style.display!=='none') tryLogin();
});
/* handlers wired in JS (no inline on* attributes) so CSP can forbid inline script */
document.getElementById('enterBtn').onclick=tryLogin;
document.getElementById('selectbtn').onclick=toggleSelectMode;
document.getElementById('search').oninput=function(){searchQuery=this.value;render();};
document.getElementById('shareBtn').onclick=shareSelection;
document.getElementById('clearBtn').onclick=cancelSel;
document.getElementById('dcloseBtn').onclick=closeDetail;
