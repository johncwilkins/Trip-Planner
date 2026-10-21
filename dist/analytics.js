(function(){
 const code=window.BitterRadishAnalytics?.goatcounterCode;
 if(!code||! /^[a-z0-9][a-z0-9-]*$/i.test(code))return;
 window.goatcounter={path:location.pathname};
 const script=document.createElement('script');
 script.async=true;script.src='https://gc.zgo.at/count.js';
 script.dataset.goatcounter='https://'+code+'.goatcounter.com/count';
 document.head.appendChild(script);
})();
