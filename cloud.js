/* 小作家冒險島 v2.2：GitHub Pages ↔ Google Apps Script iframe bridge。
 * 前端不包含任何 API key。登入的家庭通行碼會保存在此裝置的 sessionStorage。
 * 重要：這是跨來源橋接的待部署實作；需在實際 GitHub Pages + GAS 網址驗證。
 */
(function(){'use strict';
  const CONFIG='lw22_cloud_connection', CREDENTIAL='lw22_cloud_secret', STUDENT_CREDENTIAL='lw22_student_device';
  const data=JSON.parse(localStorage.getItem(CONFIG)||'{}');
  let endpoint=data.endpoint||'', token=sessionStorage.getItem(CREDENTIAL)||localStorage.getItem(STUDENT_CREDENTIAL)||'', identity=null, iframe=null, bridgeSource=null, bridgeOrigin=null, bridgeReady=false, bridgeChannel='', current=new Map(), serial=0, readiness=null;
  const currentOrigin=location.origin;
  function isGoogleOrigin(origin){try{const h=new URL(origin).hostname;return h==='script.google.com'||h.endsWith('.googleusercontent.com');}catch{return false}}
  function normalizeEndpoint(u){const url=new URL(u);if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw Error('請貼上 Apps Script 部署取得的 /exec HTTPS 網址');return url.origin+url.pathname;}
  function clearPending(error){for(const [id,p] of current){clearTimeout(p.timer);p.reject(error)}current.clear()}
  function disconnect(){if(iframe)iframe.remove();iframe=null;bridgeSource=null;bridgeOrigin=null;identity=null;bridgeReady=false;bridgeChannel='';clearPending(new Error('已斷開連線'));}
  function onMessage(e){const m=e.data;if(!m||m.lw22!==true||m.channel!==bridgeChannel||!isGoogleOrigin(e.origin))return;
    if(m.ready){bridgeSource=e.source;bridgeOrigin=e.origin;bridgeReady=true; if(readiness){readiness.resolve();readiness=null}return;}
    if(m.id){const p=current.get(m.id);if(!p)return;clearTimeout(p.timer);current.delete(m.id);if(m.result?.ok)p.resolve(m.result.data);else p.reject(new Error(m.result?.error||'後端沒有回應'));}
  }
  window.addEventListener('message',onMessage);
  function mount(){if(iframe)iframe.remove();bridgeSource=null;bridgeOrigin=null;bridgeReady=false;bridgeChannel=(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Math.random().toString(36).slice(2)+Date.now()).slice(0,50);
    iframe=document.createElement('iframe');iframe.id='lw22-data-bridge';iframe.title='家庭資料安全連線';iframe.setAttribute('aria-hidden','true');iframe.style='position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;';
    const target=endpoint+'?origin='+encodeURIComponent(currentOrigin)+'&channel='+encodeURIComponent(bridgeChannel);
    iframe.src=target;document.body.append(iframe);iframe.addEventListener('load',()=>{try{iframe.contentWindow.postMessage({hello:bridgeChannel},'*')}catch{}});
  }
  async function ready(){if(bridgeReady)return;if(!endpoint)throw Error('尚未設定 Apps Script 網址');if(!iframe)mount();if(bridgeReady)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(readiness){readiness=null;reject(new Error('Google Apps Script 連線逾時：請確認已部署、允許嵌入，以及 LW22_ORIGIN 設定。'))}},16000);readiness={resolve:()=>{clearTimeout(timer);resolve()},reject:(e)=>{clearTimeout(timer);reject(e)}};});}
  async function call(action,payload={}){if(!token)throw Error('尚未登入家庭帳號');await ready();const id='rq'+(++serial)+Date.now();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{current.delete(id);reject(new Error('資料操作逾時，請同步確認後再重試，避免重複送出。'))},action==='xpSandbox'?120000:action==='xpSandboxReset'?60000:30000);current.set(id,{resolve,reject,timer});if(!bridgeSource){clearTimeout(timer);current.delete(id);reject(new Error('GAS 跨來源橋接尚未就緒'));return;}bridgeSource.postMessage({lw22:true,channel:bridgeChannel,id,request:{action,token,payload}},bridgeOrigin);});}
  async function connect(url,code){const valid=normalizeEndpoint(url);if(!code||code.length<20)throw Error('請輸入從 Apps Script 取得的家庭通行碼');const old={endpoint,token};disconnect();endpoint=valid;token=code.trim();
    try{await ready();const r=await call('ping');identity=r.identity;localStorage.setItem(CONFIG,JSON.stringify({endpoint}));sessionStorage.setItem(CREDENTIAL,token);if(identity.role==='student'||identity.role==='device')localStorage.setItem(STUDENT_CREDENTIAL,token);else localStorage.removeItem(STUDENT_CREDENTIAL);return identity;}
    catch(e){disconnect();endpoint=old.endpoint;token=old.token;throw e;}
  }
  function forget(){disconnect();token='';identity=null;sessionStorage.removeItem(CREDENTIAL);localStorage.removeItem(STUDENT_CREDENTIAL);}
  function getSavedEndpoint(){return endpoint}
  async function resume(){if(!endpoint||!token)return null;try{await ready();identity=(await call('ping')).identity;return identity}catch(e){console.warn('雲端連線未恢復',e);return null}}
  window.LWCloud={call,connect,forget,resume,getSavedEndpoint,get identity(){return identity},get active(){return !!identity},get connected(){return !!bridgeReady},get endpoint(){return endpoint}};
})();
