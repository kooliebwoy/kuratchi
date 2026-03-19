"use strict";exports.id=5718,exports.ids=[5718],exports.modules={225718:(a,b,c)=>{c.d(b,{diagram:()=>A});var d=c(424424),e=c(268821),f=c(71844),g=c(169142),h=c(15171),i=c(728777),j=c(867428),k=g.UI.pie,l={sections:new Map,showData:!1,config:k},m=l.sections,n=l.showData,o=structuredClone(k),p=(0,h.K2)(()=>structuredClone(o),"getConfig"),q=(0,h.K2)(()=>{m=new Map,n=l.showData,(0,g.IU)()},"clear"),r=(0,h.K2)(({label:a,value:b})=>{if(b<0)throw Error(`"${a}" has invalid value: ${b}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);m.has(a)||(m.set(a,b),h.Rm.debug(`added new section: ${a}, with value: ${b}`))},"addSection"),s=(0,h.K2)(()=>m,"getSections"),t=(0,h.K2)(a=>{n=a},"setShowData"),u=(0,h.K2)(()=>n,"getShowData"),v={getConfig:p,clear:q,setDiagramTitle:g.ke,getDiagramTitle:g.ab,setAccTitle:g.SV,getAccTitle:g.iN,setAccDescription:g.EI,getAccDescription:g.m7,addSection:r,getSections:s,setShowData:t,getShowData:u},w=(0,h.K2)((a,b)=>{(0,e.S)(a,b),b.setShowData(a.showData),a.sections.map(b.addSection)},"populateDb"),x={parse:(0,h.K2)(async a=>{let b=await (0,i.qg)("pie",a);h.Rm.debug(b),w(b,v)},"parse")},y=(0,h.K2)(a=>`
  .pieCircle{
    stroke: ${a.pieStrokeColor};
    stroke-width : ${a.pieStrokeWidth};
    opacity : ${a.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${a.pieOuterStrokeColor};
    stroke-width: ${a.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${a.pieTitleTextSize};
    fill: ${a.pieTitleTextColor};
    font-family: ${a.fontFamily};
  }
  .slice {
    font-family: ${a.fontFamily};
    fill: ${a.pieSectionTextColor};
    font-size:${a.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${a.pieLegendTextColor};
    font-family: ${a.fontFamily};
    font-size: ${a.pieLegendTextSize};
  }
`,"getStyles"),z=(0,h.K2)(a=>{let b=[...a.values()].reduce((a,b)=>a+b,0),c=[...a.entries()].map(([a,b])=>({label:a,value:b})).filter(a=>a.value/b*100>=1).sort((a,b)=>b.value-a.value);return(0,j.rLf)().value(a=>a.value)(c)},"createPieArcs"),A={parser:x,db:v,renderer:{draw:(0,h.K2)((a,b,c,e)=>{h.Rm.debug("rendering pie chart\n"+a);let i=e.db,k=(0,g.D7)(),l=(0,f.$t)(i.getConfig(),k.pie),m=(0,d.D)(b),n=m.append("g");n.attr("transform","translate(225,225)");let{themeVariables:o}=k,[p]=(0,f.I5)(o.pieOuterStrokeWidth);p??=2;let q=l.textPosition,r=(0,j.JLW)().innerRadius(0).outerRadius(185),s=(0,j.JLW)().innerRadius(185*q).outerRadius(185*q);n.append("circle").attr("cx",0).attr("cy",0).attr("r",185+p/2).attr("class","pieOuterCircle");let t=i.getSections(),u=z(t),v=[o.pie1,o.pie2,o.pie3,o.pie4,o.pie5,o.pie6,o.pie7,o.pie8,o.pie9,o.pie10,o.pie11,o.pie12],w=0;t.forEach(a=>{w+=a});let x=u.filter(a=>"0"!==(a.data.value/w*100).toFixed(0)),y=(0,j.UMr)(v);n.selectAll("mySlices").data(x).enter().append("path").attr("d",r).attr("fill",a=>y(a.data.label)).attr("class","pieCircle"),n.selectAll("mySlices").data(x).enter().append("text").text(a=>(a.data.value/w*100).toFixed(0)+"%").attr("transform",a=>"translate("+s.centroid(a)+")").style("text-anchor","middle").attr("class","slice"),n.append("text").text(i.getDiagramTitle()).attr("x",0).attr("y",-200).attr("class","pieTitleText");let A=[...t.entries()].map(([a,b])=>({label:a,value:b})),B=n.selectAll(".legend").data(A).enter().append("g").attr("class","legend").attr("transform",(a,b)=>"translate(216,"+(22*b-22*A.length/2)+")");B.append("rect").attr("width",18).attr("height",18).style("fill",a=>y(a.label)).style("stroke",a=>y(a.label)),B.append("text").attr("x",22).attr("y",14).text(a=>i.getShowData()?`${a.label} [${a.value}]`:a.label);let C=512+Math.max(...B.selectAll("text").nodes().map(a=>a?.getBoundingClientRect().width??0));m.attr("viewBox",`0 0 ${C} 450`),(0,g.a$)(m,450,C,l.useMaxWidth)},"draw")},styles:y}},268821:(a,b,c)=>{function d(a,b){a.accDescr&&b.setAccDescription?.(a.accDescr),a.accTitle&&b.setAccTitle?.(a.accTitle),a.title&&b.setDiagramTitle?.(a.title)}c.d(b,{S:()=>d}),(0,c(15171).K2)(d,"populateCommonDb")}};