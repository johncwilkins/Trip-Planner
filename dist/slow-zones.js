/* Shared planning assumptions for marked slow sections and bridge approaches. */
(function(root){
 const bridgeRadiusNm=100/2025.3718285;
 function slowRanges(bridges,known){return [...known,...bridges.map(b=>[b.s-bridgeRadiusNm,b.s+bridgeRadiusNm])];}
 function merged(ranges,low,high){let out=[];for(const [a,b] of ranges.map(([a,b])=>[Math.max(a,low),Math.min(b,high)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0])){let last=out.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else out.push([a,b]);}return out;}
 function duration(a,b,speed,slow,ranges,caps){const low=Math.min(a,b),high=Math.max(a,b);let segments=[...ranges.map(([a,b])=>[a,b,slow]),...caps],cuts=[low,high];for(const [a,b] of segments){if(a>low&&a<high)cuts.push(a);if(b>low&&b<high)cuts.push(b);}cuts.sort((a,b)=>a-b);let hours=0;for(let i=1;i<cuts.length;i++){let mid=(cuts[i-1]+cuts[i])/2,v=speed;for(const [a,b,cap] of segments)if(mid>=a&&mid<b)v=Math.min(v,cap);hours+=(cuts[i]-cuts[i-1])/v;}return hours*3600000;}
 function draw(map,route,pos,marks,bridges,known,low,high){for(const [a,b] of merged(slowRanges(bridges,known),low,high)){let points=[pos(a),...route.filter(p=>p[2]>a&&p[2]<b).map(p=>p.slice(0,2)),pos(b)];marks.push(L.polyline(points,{weight:12,color:'#c23538',dashArray:'8 7',lineCap:'butt',interactive:false}).addTo(map));}}
 root.PlannerSlowZones={bridgeRadiusNm,slowRanges,merged,duration,draw};
})(globalThis);
