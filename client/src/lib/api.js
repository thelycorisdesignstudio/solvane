export const API=import.meta.env.VITE_API_URL||'http://localhost:8081/api';
export const workspaceId=()=>{
  const key='solvaneWorkspaceId';
  let id=localStorage.getItem(key);
  if(!id){
    id=(crypto.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2));
    localStorage.setItem(key,id);
  }
  return id;
};

export async function api(path,opts={}){
  const headers={...(opts.headers||{})};
  if(!(opts.body instanceof FormData))headers['Content-Type']='application/json';
  headers['X-Solvane-Session']=workspaceId();
  let res;
  try{
    res=await fetch(API+path,{...opts,headers});
  }catch(e){
    throw new Error(`Cannot reach Solvane API at ${API}. Start the server or check VITE_API_URL.`);
  }
  const contentType=res.headers.get('content-type')||'';
  const data=contentType.includes('application/json')?await res.json().catch(()=>({})):await res.text().then(text=>({text})).catch(()=>({}));
  if(!res.ok){
    const detail=data.detail?`: ${data.detail}`:'';
    throw new Error(`${data.error||data.text||'Request failed'}${detail}`);
  }
  return data;
}
