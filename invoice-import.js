(function(){
  var draft = [];
  function el(id){ return document.getElementById(id); }
  function escHtml(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function normalize(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  function money(v){ var n=String(v||'').replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''); return Number(n)||0; }

  function guessCategory(desc){
    var d = normalize(desc);
    if(/posto|combust|shell|ipiranga|petrobras|etanol|gasolina|sewal/.test(d)) return 'Carro';
    if(/uber|99app|99|taxi|pedagio|estacion|zul/.test(d)) return 'Transporte';
    if(/mercado|supermerc|carrefour|pao de acucar|dia|assai|atacad|padaria|restaur|ifood|lanche|pizza|kfc|mequi|mcdonald|burger|subway|cafe|sorvete|cacau|choc|doceria|cogeb|jau serve|savegnago|franca/.test(d)) return 'Alimentação';
    if(/farm|droga|raia|drogasil|sp|clinica|medic|hospital|consulta|exame|laborat/.test(d)) return 'Saúde';
    if(/amazon|shopee|magalu|mercado livre|eletron|celular|kabum|pichau|dell|samsung|apple|itaushop|itau shop/.test(d)) return 'Eletrônicos';
    if(/netflix|spotify|youtube|google|icloud|apple com|assinatura|prime|disney|max/.test(d)) return 'Serviços';
    if(/pet|racao|vet|veterin|cobasi|petz|petlove/.test(d)) return 'Pets';
    if(/smart fit|academia|vestuario|roupa|tenis|shoes|zara|riachuelo|renner|c&a|gympass|barbearia/.test(d)) return 'Pessoais';
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

  // Identificação e separação rigorosa de parcelas e estabelecimentos
  function parseInstallmentAndEstablishment(rawDescription, transactionDate){
    var desc = String(rawDescription || '').trim();
    var inst = { isInstallment: false, current: null, total: null, label: '' };
    var txMonth = transactionDate ? transactionDate.split('-')[1] : null;

    var m = desc.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
    if(m){
      var cur = parseInt(m[1], 10);
      var tot = parseInt(m[2], 10);
      var isDateCollision = (txMonth && parseInt(m[2], 10) === parseInt(txMonth, 10) && parseInt(m[1], 10) <= 31);

      if(!isDateCollision && tot >= 2 && cur <= tot){
        inst = { isInstallment: true, current: cur, total: tot, label: cur + '/' + tot };
        desc = desc.replace(m[0], '').replace(/\s{2,}/g, ' ').trim();
      } else if(isDateCollision) {
        desc = desc.replace(m[0], '').replace(/\s{2,}/g, ' ').trim();
      }
    } else {
      var mDe = desc.match(/\b(?:parcela\s*)?(\d{1,2})\s*de\s*(\d{1,2})\b/i);
      if(mDe){
        var curDe = parseInt(mDe[1], 10);
        var totDe = parseInt(mDe[2], 10);
        if(totDe >= 2 && curDe <= totDe){
          inst = { isInstallment: true, current: curDe, total: totDe, label: curDe + '/' + totDe };
          desc = desc.replace(mDe[0], '').replace(/\s{2,}/g, ' ').trim();
        }
      }
    }

    desc = desc.replace(/^[-–—*•\s]+|[-–—*•\s]+$/g, '').trim();

    var cleanEst = desc;
    if(cleanEst.indexOf('*') !== -1){
      cleanEst = cleanEst.split('*')[0].trim();
    } else if(cleanEst.indexOf(' - ') !== -1){
      cleanEst = cleanEst.split(' - ')[0].trim();
    } else if(/\bFILIAL\b/i.test(cleanEst)){
      cleanEst = cleanEst.split(/\bFILIAL\b/i)[0].trim();
    } else if(/\bSUPERMERCADO/i.test(cleanEst)){
      cleanEst = cleanEst.split(/\bSUPERMERCADO/i)[0].trim();
    }

    return {
      cleanDescription: desc || rawDescription,
      establishment: cleanEst || desc || 'Não informado',
      installment: inst
    };
  }

  // Checagem inteligente de duplicidades
  function checkDuplicate(row){
    var rowDate = new Date(row.date + 'T12:00:00');
    var rowAmount = Math.abs(+row.amount);
    var exactMatch = null;
    var suspectMatch = null;

    (state.transactions || []).forEach(function(t){
      if(t.type !== 'expense') return;
      var tAmount = Math.abs(+t.amount);
      if(Math.abs(tAmount - rowAmount) >= 0.01) return;

      var tDate = new Date(t.date + 'T12:00:00');
      var diffDays = Math.round(Math.abs((rowDate - tDate) / (1000 * 60 * 60 * 24)));
      var sim = descriptionSimilarity(t.description || t.establishment, row.description);

      if(diffDays === 0 && (sim >= 0.35 || t.date === row.date)){
        exactMatch = t;
      } else if(diffDays <= 2 && !exactMatch){
        suspectMatch = { tx: t, days: diffDays };
      }
    });

    if(exactMatch){
      var isImported = (exactMatch.tags || []).includes('Importado da fatura');
      return {
        level: 'exact',
        selected: false,
        text: isImported ? 'JÁ IMPORTADO' : 'CADASTRADO EM ' + exactMatch.date.split('-').reverse().join('/'),
        suggestedCategory: exactMatch.category,
        suggestedSubcategory: exactMatch.subcategory
      };
    }

    if(suspectMatch){
      var dStr = suspectMatch.tx.date.split('-').reverse().join('/');
      return {
        level: 'suspect',
        selected: false,
        text: 'POSSÍVEL DUPLICATA (' + dStr + ')',
        suggestedCategory: suspectMatch.tx.category,
        suggestedSubcategory: suspectMatch.tx.subcategory
      };
    }

    return {
      level: 'none',
      selected: true,
      text: 'NOVO',
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
      
      var parsed = parseInstallmentAndEstablishment(rawDescription, date);

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

  function renderBatchDeletionSection(){
    var section = el('batchDeletionSection');
    if(!section){
      section = document.createElement('div');
      section.id = 'batchDeletionSection';
      section.style.cssText = 'margin-top:20px;padding:16px;background:#fff5f5;border:1px solid #fed7d7;border-radius:14px;';
      var container = el('invoiceActions');
      if(container && container.parentNode){
        container.parentNode.appendChild(section);
      }
    }

    var cardId = el('invoiceCard') ? el('invoiceCard').value : '';
    var card = (state.cards || []).find(function(c){ return c.id === cardId; });
    var cardName = card ? card.name : '';

    var importedTxs = (state.transactions || []).filter(function(t){
      var isImp = (t.tags || []).includes('Importado da fatura');
      var matchCard = !cardId || t.cardId === cardId || (cardName && t.account === cardName);
      return isImp && matchCard;
    });

    if(!importedTxs.length){
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    section.innerHTML = 
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
        '<div>' +
          '<strong style="color:#c53030;font-size:14px;display:block;">Gerenciamento de Lançamentos Importados</strong>' +
          '<span style="font-size:12px;color:#742a2a;">Existem <strong>' + importedTxs.length + '</strong> lançamentos deste cartão importados no sistema.</span>' +
        '</div>' +
        '<button type="button" id="btnDeleteImportedBatch" class="btn danger" style="background:#e53e3e;color:#fff;border:none;padding:10px 16px;border-radius:10px;font-weight:700;cursor:pointer;">' +
          '🗑️ Excluir Todos os Importados Deste Cartão (' + importedTxs.length + ')' +
        '</button>' +
      '</div>';

    var btn = el('btnDeleteImportedBatch');
    if(btn){
      btn.onclick = function(){
        if(confirm('Tem certeza que deseja apagar TODOS os ' + importedTxs.length + ' lançamentos importados deste cartão?\n\nIsso permite refazer a leitura e conferência do zero sem duplicidades.')){
          var idsToRemove = new Set(importedTxs.map(function(t){ return t.id; }));
          state.transactions = state.transactions.filter(function(t){ return !idsToRemove.has(t.id); });
          save();
          renderBatchDeletionSection();
          if(el('invoiceStatus')) el('invoiceStatus').textContent = importedTxs.length + ' lançamentos importados foram removidos com sucesso.';
          alert(importedTxs.length + ' lançamentos removidos. Você já pode reimportar a fatura limpa.');
        }
      };
    }
  }

  // Grid responsivo com frações proporcionais para ocupar 100% da largura do card
  var GRID_LAYOUT = 'display:grid!important;grid-template-columns:28px 120px minmax(130px,1.4fr) minmax(140px,1.5fr) 60px 115px minmax(120px,1.3fr) 85px minmax(120px,1.2fr)!important;gap:8px!important;align-items:center!important;width:100%!important;box-sizing:border-box!important;';

  function render(){
    var box = el('invoicePreview'), sum = el('invoiceSummary'), actions = el('invoiceActions'); 
    if(!box) return;
    if(!draft.length){ 
      box.innerHTML = ''; 
      sum.innerHTML = ''; 
      actions.style.display = 'none'; 
      renderBatchDeletionSection();
      return; 
    }
    
    // Ocupa 100% do bloco do card e permite scroll suave em telas estreitas
    box.style.cssText = 'overflow-x:auto;width:100%;margin-top:14px;padding-bottom:10px;box-sizing:border-box;';

    var cats = Object.keys(CATS);
    box.innerHTML = '<div class="invoice-columns" style="' + GRID_LAYOUT + 'padding:0 8px 8px;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">' + 
      '<span style="text-align:center;">✓</span><span>Data</span><span>Estabelecimento</span><span>Descrição</span><span>Parcela</span><span>Categoria</span><span>Subcategoria</span><span style="text-align:right;">Valor</span><span style="text-align:center;">Status</span></div>' + 
      draft.map(function(r, i){
        var subs = Object.keys(CATS[r.category] || {});
        var badgeClass = r.dupLevel === 'exact' ? 'duplicate' : (r.dupLevel === 'suspect' ? 'suspect' : '');
        var styleBg = r.dupLevel === 'exact' ? 'opacity:0.65;background:#f8fafc;' : (r.dupLevel === 'suspect' ? 'background:#fffdf0;border-color:#f6e05e;' : 'background:#ffffff;');
        var statusColor = r.dupLevel === 'exact' ? 'color:#b42318;background:#fee2e2;border:1px solid #fecaca;' : (r.dupLevel === 'suspect' ? 'color:#b7791f;background:#fef3c7;border:1px solid #fde68a;' : 'color:#047857;background:#d1fae5;border:1px solid #a7f3d0;');

        return '<div class="invoice-row ' + badgeClass + '" style="' + GRID_LAYOUT + styleBg + 'padding:8px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:6px;" data-i="' + i + '">' +
          '<input class="inv-use" type="checkbox" ' + (r.selected ? 'checked' : '') + ' style="width:18px;height:18px;margin:0 auto;cursor:pointer;">' +
          '<input class="inv-date" type="date" value="' + escHtml(r.date) + '" style="width:100%;box-sizing:border-box;padding:6px 6px;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;">' +
          '<input class="inv-est" value="' + escHtml(r.establishment) + '" placeholder="Estabelecimento" style="width:100%;box-sizing:border-box;padding:6px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;">' +
          '<input class="inv-desc" value="' + escHtml(r.description) + '" placeholder="Descrição" style="width:100%;box-sizing:border-box;padding:6px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;">' +
          '<input class="inv-inst" value="' + escHtml(r.installmentLabel || '') + '" placeholder="1x" style="width:100%;box-sizing:border-box;padding:6px 4px;font-size:12px;text-align:center;border:1px solid #cbd5e1;border-radius:8px;">' +
          '<select class="inv-cat" style="width:100%;box-sizing:border-box;padding:6px 4px;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;">' + cats.map(function(c){ return '<option value="' + escHtml(c) + '" ' + (c === r.category ? 'selected' : '') + '>' + escHtml(c) + '</option>'; }).join('') + '</select>' +
          '<select class="inv-sub" style="width:100%;box-sizing:border-box;padding:6px 4px;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;">' + subs.map(function(sub){ return '<option value="' + escHtml(sub) + '" ' + (sub === r.subcategory ? 'selected' : '') + '>' + escHtml(window.subcategoryLabel(sub)) + '</option>'; }).join('') + '</select>' +
          '<input class="inv-amount" type="number" min="0.01" step="0.01" value="' + Number(r.amount).toFixed(2) + '" style="width:100%;box-sizing:border-box;padding:6px 6px;font-size:12px;text-align:right;font-weight:700;border:1px solid #cbd5e1;border-radius:8px;">' +
          '<div class="inv-dup" style="font-size:11px;font-weight:800;padding:6px 8px;border-radius:8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;box-sizing:border-box;' + statusColor + '" title="' + escHtml(r.dupText) + '">' + escHtml(r.dupText) + '</div></div>';
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
    renderBatchDeletionSection();
  }

  function updateSummary(){
    var sum = el('invoiceSummary'); if(!sum) return;
    var chosen = draft.filter(function(x){ return x.selected; });
    var total = chosen.reduce(function(a,b){ return a + (+b.amount || 0); }, 0);
    var exacts = draft.filter(function(x){ return x.dupLevel === 'exact'; }).length;
    var suspects = draft.filter(function(x){ return x.dupLevel === 'suspect'; }).length;

    var warn = '';
    if(exacts) warn += ' · <span style="color:#b42318">' + exacts + ' já cadastrada(s)</span>';
    if(suspects) warn += ' · <span style="color:#b7791f">' + suspects + ' suspeita(s)</span>';

    sum.innerHTML = '<span><strong>' + draft.length + '</strong> compras · <strong>' + chosen.length + '</strong> selecionadas</span>' +
                    '<span>Total selecionado: <strong>' + fmt(total) + '</strong>' + warn + '</span>';
  }

  function init(){
    var analyze = el('analyzeInvoice'); if(!analyze) return;
    refreshCards();
    renderBatchDeletionSection();
    el('invoiceCard').addEventListener('focus', function(){ refreshCards(); renderBatchDeletionSection(); });
    el('invoiceCard').addEventListener('change', renderBatchDeletionSection);

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
