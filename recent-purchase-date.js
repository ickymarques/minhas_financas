(()=>{
  const originalRenderDashboard=window.renderDashboard;
  if(typeof originalRenderDashboard!=='function')return;

  function purchaseDateOf(t,all){
    if(t.purchaseDate)return t.purchaseDate;
    if(t.installmentGroup){
      const group=all.filter(x=>x.installmentGroup===t.installmentGroup);
      if(group.length)return group.reduce((min,x)=>x.date<min?x.date:min,group[0].date);
    }
    return t.date;
  }

  function recentPurchases(all){
    const seen=new Set(),rows=[];
    [...all]
      .sort((a,b)=>purchaseDateOf(b,all).localeCompare(purchaseDateOf(a,all)))
      .forEach(t=>{
        const key=t.installmentGroup?`parcel-${t.installmentGroup}`:`tx-${t.id}`;
        if(seen.has(key))return;
        seen.add(key);
        if(t.installmentGroup){
          const group=all.filter(x=>x.installmentGroup===t.installmentGroup).sort((a,b)=>a.date.localeCompare(b.date));
          const first=group[0]||t;
          rows.push({...first,date:purchaseDateOf(first,all),installmentLabel:first.installmentTotal>1?`Compra parcelada · ${first.installmentTotal}x`:first.installmentLabel});
        }else rows.push({...t,date:purchaseDateOf(t,all)});
      });
    return rows.slice(0,3);
  }

  window.renderDashboard=function(){
    originalRenderDashboard();
    const el=document.querySelector('#recentTx');
    if(!el)return;
    const rows=recentPurchases(state.transactions||[]);
    el.innerHTML=rows.length?tableTx(rows,false):empty('Nenhuma transação ainda.');
  };
})();
