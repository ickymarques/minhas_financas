(function(){
  var draft = [];
  function el(id){ return document.getElementById(id); }
  function escHtml(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function normalize(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  function money(v){ var n=String(v||'').replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''); return Number(n)||0; }
  function guessCategory(desc){
    var d=normalize(desc);
    if(/posto|combust|shell|ipiranga|petrobras/.test(d)) return 'Carro';
    if(/uber|99app|taxi|pedagio|estacion/.test(d)) return 'Transporte';
    if(/mercado|supermerc|padaria|restaur|ifood|lanche|pizza|cafe|sorvete/.test(d)) return 'Alimentação';
    if(/farm|droga|clinica|medic|hospital/.test(d)) return 'Saúde';
    if(/amazon|shopee|magalu|eletron|iphone|celular/.test(d)) return 'Eletrônicos';
    if(/netflix|spotify|youtube|google|apple com|assinatura/.test(d)) return 'Serviços';
    return 'Outros';
  }
  function refreshCards(){
    var select=el('invoiceCard'); if(!select) return;
    var current=select.value;
    if(!state.cards.length){ select.innerHTML='<option value="">Cadastre um cartão primeiro</option>'; return; }
    select.innerHTML=state.cards.map(function(c){ return '<option value="'+escHtml(c.id)+'">'+escHtml(c.name)+'</option>'; }).join('');
    if(state.cards.some(function(c){return c.id===current;})) select.value=current;
  }
  function cleanDesc(v){
    return normalize(v)
      .replace(/\b(parcela|parcelado|parcelamento|compra|cartao|credito|debito|fatura)\b/g,' ')
      .replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/g,' ')
      .replace(/\b\d{1,2}\b/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function descriptionSimilarity(a,b){
    var A=cleanDesc(a),B=cleanDesc(b);
    if(!A||!B)return 0;
    if(A===B)return 1;
    if((A.length>=6&&B.indexOf(A)>=0)||(B.length>=6&&A.indexOf(B)>=0))return .95;
    var at=A.split(' ').filter(function(x){return x.length>=3}),bt=B.split(' ').filter(function(x){return x.length>=3});
    if(!at.length||!bt.length)return 0;
    var common=at.filter(function(x){return bt.indexOf(x)>=0});
    return common.length/Math.min(at.length,bt.length);
  }
  function duplicateStatus(row){
    var found=null;
    state.transactions.some(function(t){
      if(t.type!=='expense' || Math.abs((+t.amount)-(+row.amount))>=0.01) return false;
      if(descriptionSimilarity(t.description,row.description)>=0.5){found=t;return true}
      return false;
    });
    if(!found)return '';
    return (found.tags||[]).includes('Importado da fatura')?'imported':'manual';
  }
  function installmentInfo(text){
    var raw=String(text||''),m;
    m=raw.match(/\b(?:parcela\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
    if(m)return{isInstallment:true,current:+m[1],total:+m[2],label:m[1]+'/'+m[2]};
    m=raw.match(/\b(\d{1,2})\s*x\b/i);
    if(m)return{isInstallment:true,current:null,total:+m[1],label:'?/'+m[1]};
    if(/\bparcela(?:do|mento)?\b/i.test(raw))return{isInstallment:true,current:null,total:null,label:'Parcelada'};
    return{isInstallment:false,current:null,total:null,label:''};
  }
  async function extractLines(file){
    if(!window.pdfjsLib) throw new Error('Leitor de PDF não carregou. Reabra o app conectado à internet.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    var lines=[];
    for(var p=1;p<=pdf.numPages;p++){
      var page=await pdf.getPage(p), tc=await page.getTextContent(), groups={};
      tc.items.forEach(function(it){
        var y=Math.round(it.transform[5]/3)*3;
        if(!groups[y]) groups[y]=[];
        groups[y].push({x:it.transform[4],s:it.str});
      });
      Object.keys(groups).sort(function(a,b){return Number(b)-Number(a);}).forEach(function(y){
        lines.push(groups[y].sort(function(a,b){return a.x-b.x;}).map(function(x){return x.s;}).join(' ').replace(/\s+/g,' ').trim());
      });
    }
    return lines.filter(Boolean);
  }
  function parseLines(lines){
    var year=new Date().getFullYear(), out=[];
    lines.forEach(function(line,idx){
      if(/total|pagamento|vencimento|limite|saldo|anuidade|encargos|juros|iof/i.test(line)) return;
      var dm=line.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
      var re=/(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\b/g, matches=[],m;
      while((m=re.exec(line))!==null) matches.push(m);
      if(!dm || !matches.length) return;
      var last=matches[matches.length-1], amount=Math.abs(money(last[1])); if(!amount) return;
      var yy=dm[3]?Number(dm[3]):year; if(yy<100) yy+=2000;
      var date=yy+'-'+String(Number(dm[2])).padStart(2,'0')+'-'+String(Number(dm[1])).padStart(2,'0');
      var description=line.replace(dm[0],'').replace(last[0],'').replace(/\s{2,}/g,' ').replace(/^[-–—•]+|[-–—•]+$/g,'').trim();
      if(description.length<2) return;
      var category=guessCategory(description);
      var subcategory=Object.keys(CATS[category]||{})[0]||'';
      var context=[lines[idx-1]||'',line,lines[idx+1]||''].join(' ');
      var inst=installmentInfo(context);
      out.push({date:date,description:description,amount:amount,category:category,subcategory:subcategory,installmentLabel:inst.label,selected:true,duplicateStatus:''});
    });
    var seen={};
    return out.filter(function(r){ var k=r.date+'|'+normalize(r.description)+'|'+r.amount; if(seen[k]) return false; seen[k]=1; return true; });
  }
  function render(){
    var box=el('invoicePreview'), sum=el('invoiceSummary'), actions=el('invoiceActions'); if(!box) return;
    if(!draft.length){ box.innerHTML=''; sum.innerHTML=''; actions.style.display='none'; return; }
    var cats=Object.keys(CATS);
    box.innerHTML='<div class="invoice-columns"><span>Importar</span><span>Data</span><span>Descrição da compra</span><span>Parcela</span><span>Categoria</span><span>Subcategoria</span><span>Valor</span><span>Status</span></div>'+draft.map(function(r,i){
      var subs=Object.keys(CATS[r.category]||{});
      var statusText=r.duplicateStatus==='manual'?'JÁ FOI LANÇADO MANUALMENTE':(r.duplicateStatus==='imported'?'JÁ FOI IMPORTADO DA FATURA':'OK');
      return '<div class="invoice-row '+(r.duplicateStatus?'duplicate':'')+'" data-i="'+i+'">'+
        '<input class="inv-use" type="checkbox" '+(r.selected?'checked':'')+'>'+
        '<input class="inv-date" type="date" value="'+escHtml(r.date)+'">'+
        '<input class="inv-desc" value="'+escHtml(r.description)+'">'+
        '<input class="inv-inst" value="'+escHtml(r.installmentLabel||'')+'" placeholder="Ex.: 3/10">'+
        '<select class="inv-cat">'+cats.map(function(c){return '<option value="'+escHtml(c)+'" '+(c===r.category?'selected':'')+'>'+escHtml(c)+'</option>';}).join('')+'</select>'+
        '<select class="inv-sub">'+subs.map(function(sub){return '<option value="'+escHtml(sub)+'" '+(sub===r.subcategory?'selected':'')+'>'+escHtml(sub)+'</option>';}).join('')+'</select>'+
        '<input class="inv-amount" type="number" min="0.01" step="0.01" value="'+Number(r.amount).toFixed(2)+'">'+
        '<div class="inv-dup note">'+statusText+'</div></div>';
    }).join('');
    Array.from(box.querySelectorAll('.invoice-row')).forEach(function(row){
      var i=Number(row.dataset.i);
      row.querySelector('.inv-use').onchange=function(e){draft[i].selected=e.target.checked; updateSummary();};
      row.querySelector('.inv-date').onchange=function(e){draft[i].date=e.target.value;};
      row.querySelector('.inv-desc').oninput=function(e){draft[i].description=e.target.value;};
      row.querySelector('.inv-inst').oninput=function(e){draft[i].installmentLabel=e.target.value.trim();};
      row.querySelector('.inv-cat').onchange=function(e){
        draft[i].category=e.target.value;
        var subs=Object.keys(CATS[draft[i].category]||{});
        draft[i].subcategory=subs[0]||'';
        var subSel=row.querySelector('.inv-sub');
        subSel.innerHTML=subs.map(function(sub){return '<option value="'+escHtml(sub)+'">'+escHtml(sub)+'</option>';}).join('');
        subSel.value=draft[i].subcategory;
      };
      row.querySelector('.inv-sub').onchange=function(e){draft[i].subcategory=e.target.value;};
      row.querySelector('.inv-amount').oninput=function(e){draft[i].amount=Number(e.target.value)||0; updateSummary();};
    });
    actions.style.display='flex'; updateSummary();
  }
  function updateSummary(){
    var sum=el('invoiceSummary'); if(!sum) return;
    var chosen=draft.filter(function(x){return x.selected;}),total=chosen.reduce(function(a,b){return a+(+b.amount||0);},0);
    var manual=draft.filter(function(x){return x.duplicateStatus==='manual';}).length;
    var imported=draft.filter(function(x){return x.duplicateStatus==='imported';}).length;
    var warn=(manual?' · '+manual+' já lançado(s) manualmente':'')+(imported?' · '+imported+' já importado(s)':'');
    sum.innerHTML='<span><strong>'+draft.length+'</strong> encontrados · <strong>'+chosen.length+'</strong> selecionados</span><span>Total: <strong>'+fmt(total)+'</strong>'+warn+'</span>';
  }
  function init(){
    var analyze=el('analyzeInvoice'); if(!analyze) return;
    refreshCards();
    el('invoiceCard').addEventListener('focus',refreshCards);
    analyze.onclick=async function(){
      refreshCards();
      var file=el('invoicePdf').files[0], cardId=el('invoiceCard').value, status=el('invoiceStatus');
      if(!cardId){status.textContent='Cadastre ou selecione um cartão.';return;}
      if(!file){status.textContent='Selecione um PDF.';return;}
      status.textContent='Lendo e analisando a fatura…';
      try{
        var lines=await extractLines(file); draft=parseLines(lines);
        draft.forEach(function(r){r.duplicateStatus=duplicateStatus(r);if(r.duplicateStatus)r.selected=false;});
        status.textContent=draft.length?'Confira os lançamentos abaixo antes de importar.':'Não encontrei compras automaticamente. Esse layout pode precisar de um interpretador específico.';
        render();
      }catch(e){console.error(e);status.textContent='Não foi possível ler a fatura: '+e.message;}
    };
    el('clearInvoice').onclick=function(){draft=[];el('invoicePdf').value='';el('invoiceStatus').textContent='';render();};
    el('importInvoice').onclick=function(){
      var cardId=el('invoiceCard').value, card=state.cards.find(function(c){return c.id===cardId;});
      var rows=draft.filter(function(r){return r.selected&&r.amount>0&&r.date&&r.description.trim();});
      if(!rows.length){alert('Nenhum lançamento selecionado.');return;}
      rows.forEach(function(r){
        var kind=(CATS[r.category]||{})[r.subcategory]||'Variável';
        var parcelTag=r.installmentLabel?['Parcela '+r.installmentLabel]:[];
        state.transactions.push({id:uid(),type:'expense',amount:+r.amount,description:r.description.trim(),category:r.category,subcategory:r.subcategory||'',expenseKind:kind,date:r.date,account:card?card.name:'Cartão',payment:(card?card.name:'Cartão')+' - Crédito',cardId:cardId,installments:1,installmentLabel:r.installmentLabel||'',tags:['Importado da fatura'].concat(parcelTag)});
      });
      draft=[];el('invoicePdf').value='';el('invoiceStatus').textContent=rows.length+' lançamento(s) importado(s) com sucesso.';render();save();go('cards');
    };
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
// write-check-20260913-f
