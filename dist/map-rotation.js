(function(root){
root.setupPlannerMapRotation=function(map,{refit,onRotate}={}){
 const left=document.getElementById('rotateLeft'),right=document.getElementById('rotateRight'),north=document.getElementById('rotateNorth'),label=document.getElementById('mapOrientation');
 if(!left||!right||!north)return;
 if(typeof map.setBearing!=='function'||typeof map.getBearing!=='function'||!L.Browser.any3d){left.disabled=right.disabled=north.disabled=true;if(label)label.textContent='North ↑ · rotation unavailable';return;}
 const bearing=()=>((map.getBearing()%360)+360)%360;
 const update=()=>{let degrees=Math.round(bearing()),step=Math.round(degrees/45)%8,arrow=['↑','↗','→','↘','↓','↙','←','↖'][step];if(label)label.textContent=`North ${arrow}${degrees?' · '+degrees+'°':''}`;north.setAttribute('aria-pressed',String(degrees===0));if(onRotate)onRotate();};
 const turn=degrees=>{map.setBearing(degrees);if(refit)refit();};
 left.onclick=()=>turn(bearing()-45);right.onclick=()=>turn(bearing()+45);north.onclick=()=>turn(0);map.on('rotate',update);update();
};
})(globalThis);
