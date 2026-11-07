(function(){
  var draft = [];
  function el(id){ return document.getElementById(id); }
  function escHtml(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function normalize(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  function money(v){ var n=String(v||'').replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''); return Number(n)||0; }

  function guessCategory(desc){
    var d = normalize(desc);
    if(/posto|combust|shell|ipiranga|petrobras|etanol|gasolina/.test(d)) return 'Carro';
    if(/uber|99app|99|taxi|pedagio|estacion|zul/.test(d)) return 'Transporte';
    if(/mercado|supermerc|carrefour|pao de acucar|dia|assai|atacad|padaria|restaur|ifood|lanche|pizza|kfc|mequi|mcdonald|burger|subway|cafe|sorvete|cacau|choc|doceria/.test(d)) return 'Alimentação';
    if(/farm|droga|raia|drogasil|sp|clinica|medic|hospital|consulta|exame|laborat/.test(d)) return 'Saúde';
    if(/amazon|shopee|magalu|mercado livre|eletron|celular|kabum|pichau|dell|samsung|apple/.test(d)) return 'Eletrônicos';
    if(/netflix|spotify|youtube|google|icloud|apple com|assinatura|prime|disney|max/.test(d)) return 'Serviços';
    if(/pet|racao|vet|veterin|cobasi|petz/.test(d)) return 'Pets';
    if(/smart fit|academia|vestuario|roupa|tenis|shoes|zara|riachuelo|renner|c&a/.test(d)) return 'Pessoais';
    return 'Outros';
  }

  function refreshCards(){
    var select = el('invoiceCard'); if(!select) return;
    var current = select.value;
    if(!state.cards || !state.cards.length){ 
      select.innerHTML = '<option value="">Cadastre um cartão primeiro</option>'; 
      return; 
    }
    select.innerHTML = state.cards.map(function(c){ 
      return '<option value="'+escHtml(c.id)+'">'+escHtml(c.name)+'</option>'; 
    }).join('');
    if(state.cards.some(function(c){ return c.id === current; })) select.value = current;
  }

  function cleanDesc(v){
    return normalize(v)
      .replace(/\b(parcela|parcelado|parcelamento|compra|cartao|credito|debito|fatura)\b/g,' ')
      .replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/g,' ')
      .replace(/\b\d{1,2}\b/g,' ')
      .replace(/\s+/g,' ').trim();
  }

  function descriptionSimilarity(a,b){
    var A = cleanDesc(a), B = cleanDesc(b);
    if(!A || !B) return 0;
    if(A === B) return 1;
    if((A.length >= 5 && B.indexOf(A) >= 0) || (B.length >= 5 && A.indexOf(B) >= 0)) return 0.9;
    var at = A.split(' ').filter(function(x){ return x.length >= 3; });
    var bt = B.split(' ').filter(function(x){ return x.length >= 3; });
    if(!at.length || !bt.length) return 0;
    var common = at.filter(function(x){ return bt.indexOf(x) >= 0; });
    return common.length / Math.min(at.length, bt.length);
  }

  // Identificação e separação de parcelas e estabelecimentos
  // Exemplos reais da fatura: "ITAUSHOP 15/18", "FLEXPAG*CPFLRE 02/03", "UBER *TRIP"
  function parseInstallmentAndEstablishment(rawDescription){
    var desc = String(rawDescription || '').trim();
    var inst = { isInstallment: false, current: null, total: null, label: '' };
    
    // 1. Procura padrão explícito de parcelas: XX/YY (ex: 15/18, 02/03, 1/10)
    var m = desc.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
    if(m){
      var cur = parseInt(m[1], 10);
      var tot = parseInt(m[2], 10);
      // Validação: a parcela atual deve ser menor ou igual ao total, e total >= 2
      if(tot >= 2 && cur <= tot){
        inst = { isInstallment: true, current: cur, total: tot, label: cur + '/' + tot };
        desc = desc.replace(m[0], '').replace(/\s{2,}/g, ' ').trim();
      }
    } else {
      // 2. Procura padrão "XX de YY" ou "XX deYY"
      var mDe = desc.match(/\b(?:parcela\s*)?(\d{1,2})\s*de\s*(\d{1,2})\b/i);
      if(mDe){
        var curDe = parseInt(mDe[1], 10);
        var totDe = parseInt(mDe[2], 10);
        if(totDe >= 2 && curDe <= totDe){
          inst = { isInstallment: true, current: curDe, total: totDe, label: curDe + '/' + totDe };
          desc = desc.replace(mDe[0], '').replace(/\s{2,}/g, ' ').trim();
        }
      } else {
        // 3. Procura padrão "XXx" isolado (ex: "10x")
        var mX = desc.match(/\b(\d{1,2})\s*x\b/i);
        if(mX && parseInt(mX[1], 10) >= 2){
          var totX = parseInt(mX[1], 10);
          inst = { isInstallment: true, current: 1, total: totX, label: '1/' + totX };
          desc = desc.replace(mX[0], '').replace(/\s{2,}/g, ' ').trim();
        }
      }
    }

    // Limpeza de caracteres residuais nas pontas
    desc = desc.replace(/^[-–—*•\s]+|[-–—*•\s]+$/g, '').trim();

    // Extração do Estabelecimento: primeiro segmento antes de asterisco, traço ou barra
    var cleanEst = desc;
    if(cleanEst.indexOf('*') !== -1){
      cleanEst = cleanEst.split('*')[0].trim();
    } else if(cleanEst.indexOf(' - ') !== -1){
      cleanEst = cleanEst.split(' - ')[0].trim();
    }

    return {
      cleanDescription: desc || rawDescription,
      establishment: cleanEst || desc || 'Não informado',
      installment: inst
    };
  }

  // Motor de Desduplicação Inteligente (Exato vs Variação de +- 2 dias)
  function checkDuplicate(row){
    var rowDate = new Date(row.date + 'T12:00:00');
    var rowAmount = Math.abs(+row.amount);
    var exactMatch = null;
    var suspectMatch = null;

    (state.transactions || []).forEach(function(t){
      if(t.type !== 'expense') return;
      var tAmount = Math.abs(+t.amount);
      if(Math.abs(tAmount - rowAmount) >= 0.01) return; // Valores diferentes

      var tDate = new Date(t.date + 'T12:00:00');
      var diffDays = Math.round(Math.abs((rowDate - tDate) / (1000 * 60 * 60 * 24)));
      var sim = descriptionSimilarity(t.description || t.establishment, row.description);

      // 1. Duplicata Exata: Mesmo valor e mesma data OU altíssima semelhança de nome na mesma data
      if(diffDays === 0 && (sim >= 0.35 || t.date === row.date)){
        exactMatch = t;
      }
      // 2. Suspeito: Mesmo valor exato com até 2 dias de diferença
      else if(diffDays <= 2 && !exactMatch){
        suspectMatch = { tx: t, days: diffDays };
      }
    });

    if(exactMatch){
      var isImported = (exactMatch.tags || []).includes('Importado da fatura');
      return {
        level: 'exact',
        selected: false,
        text: isImported ? 'JÁ IMPORTADO DA FATURA' : 'JÁ CADASTRADO NO DIA ' + exactMatch.date.split('-').reverse().join('/'),
        suggestedCategory: exactMatch.category,
        suggestedSubcategory: exactMatch.subcategory
      };
    }

    if(suspectMatch){
      var dStr = suspectMatch.tx.date.split('-').reverse().join('/');
      return {
        level: 'suspect',
        selected: false,
        text: 'POSSÍVEL DUPLICIDADE (R$ ' + suspectMatch.tx.amount.toFixed(2) + ' em ' + dStr + ')',
        suggestedCategory: suspectMatch.tx.category,
        suggestedSubcategory: suspectMatch.tx.subcategory
      };
    }

    return {
      level: 'none',
      selected: true,
      text: 'NOVO LANÇAMENTO',
      suggestedCategory: guessCategory(row.description),
      suggestedSubcategory: ''
    };
  }

  async function extractLines(file){
    if(!window.pdfjsLib) throw new Error('Leitor de PDF não carregou. Reabra o app conectado à internet.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var pdf = await window.pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
    var lines = [];
    for(var p=1; p<=pdf.numPages; p++){
      var page = await pdf.getPage(p), tc = await page.getTextContent(), groups = {};
      tc.items.forEach(function(it){
        var y = Math.round(it.transform[5]/3)*3;
        if(!groups[y]) groups[y] = [];
        groups[y].push({x: it.transform[4], s: it.str});
      });
      Object.keys(groups).sort(function(a,b){ return Number(b)-Number(a); }).forEach(function(y){
        lines.push(groups[y].sort(function(a,b){ return a.x-b.x; }).map(function(x){ return x.s; }).join(' ').replace(/\s+/g,' ').trim());
      });
    }
    return lines.filter(Boolean);
  }

  function parseLines(lines){
    var year = new Date().getFullYear(), out = [];
    lines.forEach(function(line, idx){
      if(/total|pagamento|vencimento|limite|saldo|anuidade|encargos|juros|iof/i.test(line)) return;
      var dm = line.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
      var re = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\b/g, matches = [], m;
      while((m = re.exec(line)) !== null) matches.push(m);
      if(!dm || !matches.length) return;
      var last = matches[matches.length-1], amount = Math.abs(money(last[1])); 
      if(!amount) return;
      var yy = dm[3] ? Number(dm[3]) : year; if(yy < 100) yy += 2000;
      var date = yy + '-' + String(Number(dm[2])).padStart(2,'0') + '-' + String(Number(dm[1])).padStart(2,'0');
      var rawDescription = line.replace(dm[0],'').replace(last[0],'').replace(/\s{2,}/g,' ').replace(/^[-–—•]+|[-–—•]+$/g,'').trim();
      if(rawDescription.length < 2) return;
      
      var parsed = parseInstallmentAndEstablishment(rawDescription);

      out.push({
        date: date,
        description: parsed.cleanDescription,
        establishment: parsed.establishment,
        amount: amount,
        installmentLabel: parsed.installment.label,
        isInstallment: parsed.installment.isInstallment,
        installmentTotal: parsed.installment.total || 1,
        installmentPaid: parsed.installment.current ? (parsed.installment.current - 1) : 0
      });
    });

    var seen = {};
    return out.filter(function(r){ 
      var k = r.date + '|' + normalize(r.description) + '|' + r.amount; 
      if(seen[k]) return false; 
      seen[k] = 1; 
      return true; 
    });
  }

  function render(){
    var box = el('invoicePreview'), sum = el('invoiceSummary'), actions = el('invoiceActions'); 
    if(!box) return;
    if(!draft.length){ box.innerHTML = ''; sum.innerHTML = ''; actions.style.display = 'none'; return; }
    
    var cats = Object.keys(CATS);
    box.innerHTML = '<div class="invoice-columns"><span>Importar</span><span>Data</span><span>Estabelecimento</span><span>Descrição</span><span>Parcela</span><span>Categoria</span><span>Subcategoria</span><span>Valor</span><span>Status</span></div>' + 
      draft.map(function(r, i){
        var subs = Object.keys(CATS[r.category] || {});
        var badgeClass = r.dupLevel === 'exact' ? 'duplicate' : (r.dupLevel === 'suspect' ? 'suspect' : '');
        var styleBg = r.dupLevel === 'exact' ? 'opacity:0.6;' : (r.dupLevel === 'suspect' ? 'background:#fffdf0;border-color:#f6e05e;' : '');
        var statusColor = r.dupLevel === 'exact' ? 'color:#b42318;font-weight:bold;' : (r.dupLevel === 'suspect' ? 'color:#b7791f;font-weight:bold;' : 'color:#047857;font-weight:bold;');

        return '<div class="invoice-row ' + badgeClass + '" style="' + styleBg + '" data-i="' + i + '">' +
          '<input class="inv-use" type="checkbox" ' + (r.selected ? 'checked' : '') + '>' +
          '<input class="inv-date" type="date" value="' + escHtml(r.date) + '">' +
          '<input class="inv-est" value="' + escHtml(r.establishment) + '" placeholder="Estabelecimento">' +
          '<input class="inv-desc" value="' + escHtml(r.description) + '" placeholder="Descrição da compra">' +
          '<input class="inv-inst" value="' + escHtml(r.installmentLabel || '') + '" placeholder="Ex.: 02/03">' +
          '<select class="inv-cat">' + cats.map(function(c){ return '<option value="' + escHtml(c) + '" ' + (c === r.category ? 'selected' : '') + '>' + escHtml(c) + '</option>'; }).join('') + '</select>' +
          '<select class="inv-sub">' + subs.map(function(sub){ return '<option value="' + escHtml(sub) + '" ' + (sub === r.subcategory ? 'selected' : '') + '>' + escHtml(window.subcategoryLabel(sub)) + '</option>'; }).join('') + '</select>' +
          '<input class="inv-amount" type="number" min="0.01" step="0.01" value="' + Number(r.amount).toFixed(2) + '">' +
          '<div class="inv-dup note" style="' + statusColor + '">' + escHtml(r.dupText) + '</div></div>';
      }).join('');

    Array.from(box.querySelectorAll('.invoice-row')).forEach(function(row){
      var i = Number(row.dataset.i);
      row.querySelector('.inv-use').onchange = function(e){ draft[i].selected = e.target.checked; updateSummary(); };
      row.querySelector('.inv-date').onchange = function(e){ draft[i].date = e.target.value; };
      row.querySelector('.inv-est').oninput = function(e){ draft[i].establishment = e.target.value; };
      row.querySelector('.inv-desc').oninput = function(e){ draft[i].description = e.target.value; };
      row.querySelector('.inv-inst').oninput = function(e){ 
        draft[i].installmentLabel = e.target.value.trim();
        var m = draft[i].installmentLabel.match(/(\d+)\s*\/\s*(\d+)/);
        if(m){
          draft[i].isInstallment = true;
          draft[i].installmentTotal = parseInt(m[2], 10);
          draft[i].installmentPaid = parseInt(m[1], 10) - 1;
        } else {
          draft[i].isInstallment = false;
          draft[i].installmentTotal = 1;
          draft[i].installmentPaid = 0;
        }
      };
      row.querySelector('.inv-cat').onchange = function(e){
        draft[i].category = e.target.value;
        var subs = Object.keys(CATS[draft[i].category] || {});
        draft[i].subcategory = subs[0] || '';
        var subSel = row.querySelector('.inv-sub');
        subSel.innerHTML = subs.map(function(sub){ return '<option value="' + escHtml(sub) + '">' + escHtml(window.subcategoryLabel(sub)) + '</option>'; }).join('');
        subSel.value = draft[i].subcategory;
      };
      row.querySelector('.inv-sub').onchange = function(e){ draft[i].subcategory = e.target.value; };
      row.querySelector('.inv-amount').oninput = function(e){ draft[i].amount = Number(e.target.value) || 0; updateSummary(); };
    });

    actions.style.display = 'flex'; 
    updateSummary();
  }

  function updateSummary(){
    var sum = el('invoiceSummary'); if(!sum) return;
    var chosen = draft.filter(function(x){ return x.selected; });
    var total = chosen.reduce(function(a,b){ return a + (+b.amount || 0); }, 0);
    var exacts = draft.filter(function(x){ return x.dupLevel === 'exact'; }).length;
    var suspects = draft.filter(function(x){ return x.dupLevel === 'suspect'; }).length;

    var warn = '';
    if(exacts) warn += ' · <span style="color:#b42318">' + exacts + ' duplicata(s) ignorada(s)</span>';
    if(suspects) warn += ' · <span style="color:#b7791f">' + suspects + ' suspeita(s) de duplicidade</span>';

    sum.innerHTML = '<span><strong>' + draft.length + '</strong> itens lidos · <strong>' + chosen.length + '</strong> selecionados para importar</span>' +
                    '<span>Total selecionado: <strong>' + fmt(total) + '</strong>' + warn + '</span>';
  }

  function init(){
    var analyze = el('analyzeInvoice'); if(!analyze) return;
    refreshCards();
    el('invoiceCard').addEventListener('focus', refreshCards);

    analyze.onclick = async function(){
      refreshCards();
      var file = el('invoicePdf').files[0], cardId = el('invoiceCard').value, status = el('invoiceStatus');
      if(!cardId){ status.textContent = 'Cadastre ou selecione um cartão.'; return; }
      if(!file){ status.textContent = 'Selecione um PDF.'; return; }
      status.textContent = 'Lendo e analisando a fatura com checagem de duplicidades…';
      try{
        var lines = await extractLines(file);
        var parsed = parseLines(lines);

        draft = parsed.map(function(r){
          var dup = checkDuplicate(r);
          var category = dup.suggestedCategory || guessCategory(r.description);
          var subs = Object.keys(CATS[category] || {});
          var subcategory = dup.suggestedSubcategory || subs[0] || '';

          return {
            date: r.date,
            description: r.description,
            establishment: r.establishment,
            amount: r.amount,
            installmentLabel: r.installmentLabel,
            isInstallment: r.isInstallment,
            installmentTotal: r.installmentTotal,
            installmentPaid: r.installmentPaid,
            category: category,
            subcategory: subcategory,
            dupLevel: dup.level,
            dupText: dup.text,
            selected: dup.selected
          };
        });

        status.textContent = draft.length ? 'Conferência pronta! Duplicidades foram desmarcadas automaticamente.' : 'Não foram encontradas compras no formato padrão.';
        render();
      }catch(e){
        console.error(e);
        status.textContent = 'Não foi possível ler a fatura: ' + e.message;
      }
    };

    el('clearInvoice').onclick = function(){
      draft = [];
      el('invoicePdf').value = '';
      el('invoiceStatus').textContent = '';
      render();
    };

    el('importInvoice').onclick = function(){
      var cardId = el('invoiceCard').value;
      var card = (state.cards || []).find(function(c){ return c.id === cardId; });
      var rows = draft.filter(function(r){ return r.selected && r.amount > 0 && r.date && r.description.trim(); });
      if(!rows.length){ alert('Nenhum lançamento selecionado.'); return; }

      rows.forEach(function(r){
        var kind = (CATS[r.category] || {})[r.subcategory] || 'Variável';
        var parcelTag = r.installmentLabel ? ['Parcela ' + r.installmentLabel] : [];
        var totalInstallments = r.isInstallment ? r.installmentTotal : 1;
        state.transactions.push({
          id: uid(),
          type: 'expense',
          amount: +r.amount,
          description: r.description.trim(),
          establishment: r.establishment.trim(),
          category: r.category,
          subcategory: r.subcategory || '',
          expenseKind: kind,
          date: r.date,
          account: card ? card.name : 'Cartão',
          payment: (card ? card.name : 'Cartão') + ' - Crédito',
          cardId: cardId,
          installments: totalInstallments,
          installmentTotal: totalInstallments,
          installmentPaid: r.installmentPaid || 0,
          installmentLabel: r.installmentLabel || '',
          tags: ['Importado da fatura'].concat(parcelTag)
        });
      });

      draft = [];
      el('invoicePdf').value = '';
      el('invoiceStatus').textContent = rows.length + ' lançamento(s) importado(s) com sucesso.';
      render();
      save();
      go('cards');
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); 
  else init();
})();
